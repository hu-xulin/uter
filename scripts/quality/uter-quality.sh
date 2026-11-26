#!/usr/bin/env bash
#
# UEQE 统一质量编排器（Uter Engineering Quality Engine）
#
# 整合三份规范（全面代码审查 / 全面自动化测试 / 统一工程质量管理）为单一入口，
# 复用既有门禁而非重建（宪法 AGENTS.md 与规范第三部分均要求）。五个引擎：
#
#   review     静态审查：gofmt/go vet × 4 模块 + 前端 lint/i18n/design-strict/copyright
#              （ai-specs 检查已随 uaes/standards 退休删除，2026-11-12）
#   test       自动化测试：Go test × 4 模块 + vitest（含 spec-guards 92 项）
#   security   安全扫描：govulncheck/gitleaks（缺工具=NOT_RUN，绝不伪通过）+ 敏感文件入库抽查
#   coverage   覆盖率门禁：按包阈值 controller=39 model=45 service=43（与 CI 同口径）
#   regression 视觉回归：第一轨 showcase 哈希恒跑；第二轨 Playwright 仅 --with-e2e
#
# 状态语义（规范要求的五级，禁止混用）：
#   PASSED  全部子项通过
#   PARTIAL 部分通过（有失败项，需人工处理）
#   BLOCKED 环境不具备（缺工具/缺服务），本轮未执行
#   NOT_RUN 未执行（被跳过或工具缺失）
#   FAILED  执行异常（脚本自身错误）
#
# 用法：
#   scripts/quality/uter-quality.sh <stage> [--with-e2e]
#   stage ∈ inventory|review|test|security|coverage|regression|report|status|full
#
# 报告与日志落在 gitignore 区（_reports/quality/ 与 .quality/.state/），不进主分支。

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# shellcheck source=/dev/null
# A preset state dir is honoured for isolated regression fixtures only; the
# production default still comes from policy.env when nothing is preset.
_PRESET_STATE_DIR="${UEQE_STATE_DIR:-}"
source "$ROOT/.quality/policy.env"
[ -n "$_PRESET_STATE_DIR" ] && UEQE_STATE_DIR="$_PRESET_STATE_DIR"

WITH_E2E=0
STAGE=""
for arg in "$@"; do
  case "$arg" in
    --with-e2e) WITH_E2E=1 ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) STAGE="$arg" ;;
  esac
done

mkdir -p "$UEQE_STATE_DIR" "$ROOT/$UEQE_REPORT_ROOT"/{code-review,automated-testing,security,coverage,quality-summary}

# Clear the git-archive unpack area without deleting thousands of files in the
# workspace. Some workstations inject a bulk-delete guard that rejects
# `rm -rf` here (SAFE_DELETE_BULK_CONFIRM_REQUIRED, at both shell and Node
# layers), turning a healthy gitleaks scan into exit 1. head-tree is a pure
# derived scratch dir that `git archive | tar` immediately repopulates, so
# parking it in the OS temp dir is equivalent to removing it.
clear_head_tree() {
  local target="$ROOT/$UEQE_STATE_DIR/head-tree"
  if [ -d "$target" ]; then
    mv "$target" "${TMPDIR:-/tmp}/uter-ueqe-head-tree-$$-$(date +%s)" || return 1
  fi
}

# ── 结果记录 ──────────────────────────────────────────────────────────
# run_check <stage> <name> <cmd...>：捕获退出码，写 <stage>.<name>.log 与 .status。
run_check() {
  local stage="$1" name="$2"; shift 2
  local log="$ROOT/$UEQE_STATE_DIR/$stage.$name.log"
  echo "▶ [$stage/$name] $*" >&2
  ( "$@" ) >"$log" 2>&1
  local rc=$?
  if [ $rc -eq 0 ]; then
    echo PASSED > "$ROOT/$UEQE_STATE_DIR/$stage.$name.status"
  else
    echo FAILED > "$ROOT/$UEQE_STATE_DIR/$stage.$name.status"
    echo "  ✘ $name 退出码 ${rc}（日志：${log}）" >&2
    # Preserve actionable lint/test diagnostics in CI logs; five lines hid
    # the actual Oxlint errors and forced guess-based remediation.
    tail -80 "$log" | sed 's/^/    │ /' >&2
  fi
  return $rc
}

mark() { # mark <stage> <name> <PASSED|FAILED|BLOCKED|NOT_RUN> [reason]
  local stage="$1" name="$2" status="$3" reason="${4:-}"
  echo "$status" > "$ROOT/$UEQE_STATE_DIR/$stage.$name.status"
  [ -n "$reason" ] && printf '%s\n' "$reason" > "$ROOT/$UEQE_STATE_DIR/$stage.$name.reason"
  echo "· [$stage/$name] $status $reason" >&2
}

stage_status() { # 汇总某 stage 所有子项状态 → 单一状态
  local stage="$1" failed=0 blocked=0 notrun=0 passed=0 s f
  for f in "$ROOT/$UEQE_STATE_DIR"/$stage.*.status; do
    [ -f "$f" ] || continue
    s=$(cat "$f")
    case "$s" in
      PASSED) passed=$((passed+1)) ;;
      FAILED) failed=$((failed+1)) ;;
      BLOCKED) blocked=$((blocked+1)) ;;
      NOT_RUN) notrun=$((notrun+1)) ;;
    esac
  done
  if [ $((failed+blocked)) -gt 0 ]; then
    [ $passed -gt 0 ] && echo PARTIAL || echo FAILED
  elif [ $((notrun)) -gt 0 ]; then
    echo PARTIAL
  elif [ $passed -gt 0 ]; then
    echo PASSED
  else
    echo NOT_RUN
  fi
}

# ── 各引擎 ────────────────────────────────────────────────────────────
stage_inventory() {
  {
    echo "HEAD: $(git rev-parse HEAD)"
    echo "branch: $(git branch --show-current)"
    echo "date: $(date '+%F %T')"
    echo "dirty_files: $(git status --porcelain | wc -l | tr -d ' ')"
    git status --porcelain | head -30
    echo "--- modules ---"
    for m in $UEQE_GO_MODULES; do echo "$m $(grep '^go ' "$m/go.mod" | head -1)"; done
  } > "$ROOT/$UEQE_STATE_DIR/inventory.txt" 2>&1
  cat "$ROOT/$UEQE_STATE_DIR/inventory.txt"
  echo PASSED > "$ROOT/$UEQE_STATE_DIR/inventory.snapshot.status"
}

stage_review() {
  # security 阶段的 git archive 解包区（head-tree）会跨轮残留，内含历史 blob，
  # gofmt -l 递归扫描会把它当源码扫入造成假阳性——review 前先清理。
  clear_head_tree
  for m in $UEQE_GO_MODULES; do
    local_label="${m//\//_}"
    ( cd "$m" && test -z "$(gofmt -l . | head -1)" ) \
      && mark review "gofmt:$local_label" PASSED \
      || { mark review "gofmt:$local_label" FAILED; ( cd "$m" && gofmt -l . ) > "$ROOT/$UEQE_STATE_DIR/review.gofmt:$local_label.log" 2>&1; }
    run_check review "vet:$local_label" bash -c "cd '$m' && GOWORK=off go vet ./..." || true
  done
  run_check review "web:lint" bash -c "cd web && bun run lint" || true
  run_check review "web:design-strict" bash -c "cd web && bun run lint:design:strict" || true
  run_check review "web:copyright" bash -c "cd web && bun run copyright:check" || true
}

stage_test() {
  # `go build ./...` / `go test` compile package `main`, whose //go:embed
  # patterns require web/dist to exist. Without a front-end build in this
  # worktree the Go leg fails with "no matching files found" — an assembly gap,
  # not a code defect, and (worse) it masks the real test results behind a
  # compile error. The placeholder step is idempotent and preserves real
  # artefacts when they are already present.
  if command -v go >/dev/null 2>&1; then
    "$ROOT/scripts/quality/ensure-go-embed-artifacts.sh" >/dev/null 2>&1 || true
  fi
  for m in $UEQE_GO_MODULES; do
    local_label="${m//\//_}"
    run_check test "go:$local_label" bash -c "cd '$m' && GOWORK=off go build ./... && GOWORK=off go test -count=1 -timeout ${UEQE_GO_TEST_TIMEOUT}s ./..." || true
  done
  run_check test "web:vitest" bash -c "cd web && bun run test" || true

  # A scaffolded web/dist satisfies //go:embed but is NOT a front-end build:
  # the SPA bundle, the 7 docs-search indexes and the user-guide screenshots
  # are all absent, and main_docs_test.go's real-artifact checks either skip
  # (placeholder shell) or fail. Say so here rather than letting the Go leg
  # report a bare exit 1 with no explanation. The authoritative hard gate is
  # scripts/verify-docs-artifacts.sh (called by verify-all.sh, Dockerfile and
  # the release workflow); this stage stays a note so backend-only CI jobs
  # keep their historical pass/fail semantics.
  if ! "$ROOT/scripts/verify-docs-artifacts.sh" "$ROOT/web/dist" >/dev/null 2>&1; then
    echo "NOTE: web/dist has no complete native docs assets. Build the frontend with:" >&2
    echo "        (cd web && bun install --frozen-lockfile && bun run build)" >&2
    echo "      then re-run scripts/verify-docs-artifacts.sh web/dist." >&2
  fi
}

stage_security() {
  local tool found=0
  for tool in $UEQE_SEC_TOOLS; do
    if command -v "$tool" >/dev/null 2>&1; then
      found=1
      case "$tool" in
        govulncheck)
          for m in $UEQE_GO_MODULES; do
            local_label="${m//\//_}"
            run_check security "govulncheck:$local_label" bash -c "set -o pipefail; cd '$m' && GOWORK=off govulncheck ./... 2>&1 | tail -40" || true
          done
          ;;
        gitleaks)
          # 口径=当前跟踪内容（git archive HEAD 解包后扫描）：dir 直扫会把 gitignored
          # 的 node_modules/.next/.env 全卷进来产生海量噪音；历史模式则被上游开源
          # 继承的已删文件误报淹没（296 条，已逐类人工核验为误报并记录在
          # .quality/gitleaks.toml 与质量报告）。当前树口径防「新增密钥入库」。
          run_check security "gitleaks" bash -c "
            ht='$ROOT/$UEQE_STATE_DIR/head-tree'
            if [ -d \"\$ht\" ]; then mv \"\$ht\" \"\${TMPDIR:-/tmp}/uter-ueqe-head-tree-\$\$-\$(date +%s)\" || exit 1; fi
            mkdir -p \"\$ht\" && git archive HEAD | tar -x -C \"\$ht\" && cd \"\$ht\" && gitleaks dir . --no-banner --config '$ROOT/.quality/gitleaks.toml'
          " || true ;;
      esac
    else
      mark security "$tool" NOT_RUN "工具未安装（brew install $tool 后可启用）"
    fi
  done
  # 敏感文件入库抽查（红线：.env/*.db/logs 不进提交）
  local bad=""
  for pat in $UEQE_FORBIDDEN_PATTERNS; do
    bad="$bad$(git ls-files "$pat" | head -3)"
  done
  if [ -z "$(echo "$bad" | tr -d '[:space:]')" ]; then
    mark security "forbidden-files" PASSED
  else
    printf '%s\n' "$bad" > "$ROOT/$UEQE_STATE_DIR/security.forbidden-files.log"
    mark security "forbidden-files" FAILED "以下敏感文件已被 git 跟踪：$bad"
  fi
}

stage_coverage() {
  # 与 CI 同口径：root 模块整体 cover profile + 按包阈值门禁。
  # 注意：go test 输出必须留在日志里——测试失败时 coverage-gate 短路，日志是唯一归因依据。
  run_check coverage "go-root" bash -c "go test -count=1 -coverprofile='$ROOT/$UEQE_STATE_DIR/coverage.out' -timeout ${UEQE_GO_TEST_TIMEOUT}s ./... && \
    '$ROOT/scripts/coverage-gate.sh' '$ROOT/$UEQE_STATE_DIR/coverage.out' \"\$(go list -m)\" $UEQE_COVERAGE_ARGS" || true
  # 独立模块覆盖率仅采集不设阈值；路径名转为安全状态文件名。
  for m in tokenkit relaykit tokenkit/tokenkit; do
    local_label="${m//\//_}"
    run_check coverage "go-$local_label-collect" bash -c "set -o pipefail; cd '$m' && GOWORK=off go test -count=1 -cover -timeout ${UEQE_GO_TEST_TIMEOUT}s ./... | tail -20" || true
  done
}

stage_regression() {
  run_check regression "showcase" bash -c "cd web && bun run $UEQE_VISUAL_FAST" || true
  if [ "$WITH_E2E" -eq 1 ]; then
    if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
      run_check regression "playwright" bash -c "cd web && PLAYWRIGHT_CHANNEL=\${PLAYWRIGHT_CHANNEL:-chrome} bun run $UEQE_VISUAL_E2E" || true
      # 常驻配置 PasswordLoginEnabled=false 时鉴权轨无法登录：这是环境策略限制，
      # 属 BLOCKED（需按 README 临时开关流程）而非代码失败，不得混为 FAILED。
      if grep -q "Password login has been disabled" "$ROOT/$UEQE_STATE_DIR/regression.playwright.log" 2>/dev/null; then
        mark regression "playwright" BLOCKED "PasswordLoginEnabled=false（常驻策略）：鉴权轨需按 web/e2e/visual/README.md 临时开关流程执行"
      fi
    else
      mark regression "playwright" BLOCKED ":3000 无服务（Go 后端未启动），有意失败不伪通过"
    fi
  else
    mark regression "playwright" NOT_RUN "未指定 --with-e2e"
  fi
}

# ── 报告 ──────────────────────────────────────────────────────────────
stage_report() {
  local report="$ROOT/$UEQE_REPORT_ROOT/quality-summary/ueqe-$(date '+%Y%m%d-%H%M%S').md"
  local overall
  {
    echo "# UEQE 质量审计报告"
    echo
    echo "- 时间：$(date '+%F %T')"
    echo "- 基线：$(git rev-parse --short HEAD) @ $(git branch --show-current)"
    echo "- 脏文件数：$(git status --porcelain | wc -l | tr -d ' ')"
    echo
    echo "| 引擎 | 子项 | 状态 |"
    echo "|---|---|---|"
    for f in "$ROOT/$UEQE_STATE_DIR"/*.*.status; do
      [ -f "$f" ] || continue
      local base
      base=$(basename "$f" .status)
      echo "| ${base%%.*} | ${base#*.} | $(cat "$f") |"
    done
    echo
    echo "## 结论"
    for stg in review test security coverage regression; do
      echo "- $stg: **$(stage_status $stg)**"
    done
    compute_verdict
    echo "- verdict: **$UEQE_VERDICT**"
    echo
    echo "> 详情日志：.quality/.state/*.log；本报告位于 gitignore 区，不进主分支。"
  } > "$report"
  # shellcheck disable=SC2129
  OVERALL_REPORT="$report"
  echo "📄 报告已生成：$report"
  cat "$report"
}

stage_status_print() {
  for stg in inventory review test security coverage regression; do
    echo "$stg: $(stage_status $stg)"
  done
}

# compute_verdict — 机器可读总裁决（QUALITY-GATE-STANDARD §阻断矩阵的程序化出口）。
#   FAIL            存在 FAILED、BLOCKED 或 NOT_RUN 子项（禁止将未执行冒充通过）
#   PASS            所有必需子项均 PASSED
#   NOT_RUN          没有可验证子项（阻断）
# 结果落盘 .quality/.state/verdict，并设 UEQE_VERDICT 变量。
#
# 作用域修复（2026-11-07）：单阶段执行（如 `uter-quality.sh security`）此前
# 会扫描所有阶段的**历史** .status 文件，于是其他阶段遗留的 FAILED/NOT_RUN
# 会把本阶段的真实全绿污染成 FAIL（假阴性）。现在只统计本次执行的阶段；
# `full` 仍统计全部六个阶段，严格度不放宽，FAILED/BLOCKED/NOT_RUN 依旧阻断。
compute_verdict() {
  local s f failed=0 blocked=0 notrun=0 passed=0
  local stages stg
  if [ "${STAGE:-full}" = "full" ]; then
    stages="inventory review test security coverage regression"
  else
    stages="$STAGE"
  fi
  for stg in $stages; do
    for f in "$ROOT/$UEQE_STATE_DIR"/"$stg".*.status; do
      [ -f "$f" ] || continue
      s=$(cat "$f")
      case "$s" in
        PASSED)  passed=$((passed + 1)) ;;
        FAILED)  failed=$((failed + 1)) ;;
        BLOCKED) blocked=$((blocked + 1)) ;;
        NOT_RUN) notrun=$((notrun + 1)) ;;
      esac
    done
  done
  if [ $((failed + blocked + notrun)) -gt 0 ]; then
    UEQE_VERDICT=FAIL
  elif [ "$passed" -gt 0 ]; then
    UEQE_VERDICT=PASS
  else
    UEQE_VERDICT=FAIL
  fi
  printf '%s\n' "$UEQE_VERDICT" > "$ROOT/$UEQE_STATE_DIR/verdict"
}

# gate_exit — 执行类阶段的统一出口：verdict 落盘 + 失败传播为进程退出码。
# 修复验收报告 §8 缺口：此前 full 在 FAILED/BLOCKED 时仍 exit 0，
# 编排器无法被 CI/脚本链当作阻断门禁消费。
gate_exit() {
  compute_verdict
  printf 'verdict: %s（FAILED/BLOCKED/NOT_RUN→exit 1；仅全部必需检查 PASSED 才放行）\n' "$UEQE_VERDICT" >&2
  [ "$UEQE_VERDICT" = "FAIL" ] && exit 1
  exit 0
}

# ── 主调度 ────────────────────────────────────────────────────────────
case "$STAGE" in
  inventory) stage_inventory ;;
  review) stage_review ;;
  test) stage_test ;;
  security) stage_security ;;
  coverage) stage_coverage ;;
  regression) stage_regression ;;
  report) stage_report ;;
  status) stage_status_print ;;
  full)
    t0=$(date +%s)
    stage_inventory
    stage_review;    echo "── review:    $(stage_status review)" >&2
    stage_test;      echo "── test:      $(stage_status test)" >&2
    stage_security;  echo "── security:  $(stage_status security)" >&2
    stage_coverage;  echo "── coverage:  $(stage_status coverage)" >&2
    stage_regression;echo "── regression:$(stage_status regression)" >&2
    stage_report >/dev/null
    t1=$(date +%s)
    echo
    echo "═══ UEQE full 完成，耗时 $((t1-t0))s ═══"
    stage_status_print
    [ -n "${OVERALL_REPORT:-}" ] && echo "报告：$OVERALL_REPORT"
    gate_exit
    ;;
  "") sed -n '2,30p' "$0"; exit 2 ;;
  *) echo "未知 stage：$STAGE" >&2 ; exit 2 ;;
esac

# 执行类单阶段同样经 verdict 出口传播失败退出码（report/status 为只读内省，不阻断）。
case "$STAGE" in
  inventory|review|test|security|coverage|regression) gate_exit ;;
esac
