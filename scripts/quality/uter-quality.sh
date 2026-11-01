#!/usr/bin/env bash
#
# UEQE 统一质量编排器（Uter Engineering Quality Engine）
#
# 整合三份规范（全面代码审查 / 全面自动化测试 / 统一工程质量管理）为单一入口，
# 复用既有门禁而非重建（宪法 AGENTS.md 与规范第三部分均要求）。五个引擎：
#
#   review     静态审查：gofmt/go vet × 3 模块 + 前端 lint/i18n/design-strict/copyright
#              + ai-specs（docs/ai-specs/ 规范体系完整性，见 ai-specs-check.sh）
#   test       自动化测试：Go test × 3 模块 + vitest（含 spec-guards 92 项）
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
source "$ROOT/.quality/policy.env"

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
    tail -5 "$log" | sed 's/^/    │ /' >&2
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
  rm -rf "$ROOT/$UEQE_STATE_DIR/head-tree"
  for m in $UEQE_GO_MODULES; do
    ( cd "$m" && test -z "$(gofmt -l . | head -1)" ) \
      && mark review "gofmt:$m" PASSED \
      || { mark review "gofmt:$m" FAILED; ( cd "$m" && gofmt -l . ) > "$ROOT/$UEQE_STATE_DIR/review.gofmt:$m.log" 2>&1; }
    run_check review "vet:$m" bash -c "cd '$m' && go vet ./..." || true
  done
  run_check review "web:lint" bash -c "cd web && bun run lint" || true
  run_check review "web:design-strict" bash -c "cd web && bun run lint:design:strict" || true
  run_check review "web:copyright" bash -c "cd web && bun run copyright:check" || true
  # AI 规范体系完整性（AGENTS.md「AI Spec System」节的程序化守护）。
  run_check review "ai-specs" "$ROOT/scripts/quality/ai-specs-check.sh" || true
}

stage_test() {
  for m in $UEQE_GO_MODULES; do
    run_check test "go:$m" bash -c "cd '$m' && go build ./... && go test -count=1 -timeout ${UEQE_GO_TEST_TIMEOUT}s ./..." || true
  done
  run_check test "web:vitest" bash -c "cd web && bun run test" || true
}

stage_security() {
  local tool found=0
  for tool in $UEQE_SEC_TOOLS; do
    if command -v "$tool" >/dev/null 2>&1; then
      found=1
      case "$tool" in
        govulncheck) run_check security "govulncheck" bash -c "cd . && govulncheck ./... 2>&1 | tail -40" || true ;;
        gitleaks)
          # 口径=当前跟踪内容（git archive HEAD 解包后扫描）：dir 直扫会把 gitignored
          # 的 node_modules/.next/.env 全卷进来产生海量噪音；历史模式则被上游开源
          # 继承的已删文件误报淹没（296 条，已逐类人工核验为误报并记录在
          # .quality/gitleaks.toml 与质量报告）。当前树口径防「新增密钥入库」。
          run_check security "gitleaks" bash -c "rm -rf '$ROOT/$UEQE_STATE_DIR/head-tree' && mkdir -p '$ROOT/$UEQE_STATE_DIR/head-tree' && git archive HEAD | tar -x -C '$ROOT/$UEQE_STATE_DIR/head-tree' && cd '$ROOT/$UEQE_STATE_DIR/head-tree' && gitleaks dir . --no-banner --config '$ROOT/.quality/gitleaks.toml'" || true ;;
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
  # tokenkit/relaykit 走 go vet 口径（golangci-lint 暂缓），覆盖率仅采集不设阈值
  for m in tokenkit relaykit; do
    run_check coverage "go-$m-collect" bash -c "cd '$m' && go test -count=1 -cover -timeout ${UEQE_GO_TEST_TIMEOUT}s ./... | tail -20" || true
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
    ;;
  "") sed -n '2,30p' "$0"; exit 2 ;;
  *) echo "未知 stage：$STAGE" >&2; exit 2 ;;
esac
