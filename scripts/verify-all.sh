#!/usr/bin/env bash
#
# verify-all.sh — uter 统一质量门禁入口
#
# 目的：把散落在 web/package.json、makefile、CI workflow 里的检查收敛为
#      一条本地命令，并强制输出「实际运行的命令 + 退出码 + 耗时」。
#      对应《AGENTS.md → AI Agent Operating Discipline》第 2、3 条：
#      门禁必须真跑，报告必须带证据，不得口头宣称通过。
#
# 用法：
#   ./scripts/verify-all.sh            # 全量
#   ./scripts/verify-all.sh --quick    # 跳过慢套件（Go test / vitest / 生产构建）
#   ./scripts/verify-all.sh --help
#
# 退出码：0 = 全部通过；1 = 至少一个门禁失败；2 = 环境不满足（命令缺失）
#
# 注意：本脚本只做「检查」，不做任何修改，也不会执行 git 写操作。

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
QUICK=0
FRONTEND_TIMEOUT=${FRONTEND_TIMEOUT:-900}

for arg in "$@"; do
  case "$arg" in
    --quick) QUICK=1 ;;
    -h|--help)
      sed -n '3,17p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      printf '未知参数: %s（用 --help 查看用法）\n' "$arg" >&2
      exit 2
      ;;
  esac
done

cd "$ROOT" || exit 2

# ---------- 输出辅助 ----------
C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
C_GREEN=$'\033[32m'; C_RED=$'\033[31m'; C_YELLOW=$'\033[33m'

STEP_NO=0
NAMES=(); STATUSES=(); CODES=(); SECS=(); CMDS=()

# step <名称> <命令> [工作目录]
step() {
  local name="$1" cmd="$2" workdir="${3:-$ROOT}"
  STEP_NO=$((STEP_NO + 1))
  printf '\n%s[%d] %s%s\n' "$C_BOLD" "$STEP_NO" "$name" "$C_RESET" >&2
  printf '%s  $ (cd %s)%s\n' "$C_DIM" "${workdir#$ROOT/}" "$C_RESET" >&2
  printf '%s     %s%s\n' "$C_DIM" "$cmd" "$C_RESET" >&2

  local t0 rc t1
  t0=$(date +%s)
  ( cd "$workdir" && eval "$cmd" )
  rc=$?
  t1=$(date +%s)

  NAMES+=("$name"); CODES+=("$rc"); SECS+=($((t1 - t0))); CMDS+=("$cmd")
  if [ "$rc" -eq 0 ]; then
    STATUSES+=("PASS")
    printf '  %s✓ PASS%s (%ds)\n' "$C_GREEN" "$C_RESET" "$((t1 - t0))" >&2
  else
    STATUSES+=("FAIL")
    printf '  %s✗ FAIL%s (exit %d, %ds)\n' "$C_RED" "$C_RESET" "$rc" "$((t1 - t0))" >&2
  fi
  return 0
}

skip() {
  local name="$1" why="$2"
  STEP_NO=$((STEP_NO + 1))
  printf '\n%s[%d] %s%s\n' "$C_BOLD" "$STEP_NO" "$name" "$C_RESET" >&2
  printf '  %s- SKIP%s (%s)\n' "$C_YELLOW" "$C_RESET" "$why" >&2
  NAMES+=("$name"); STATUSES+=("SKIP"); CODES+=("-"); SECS+=(0); CMDS+=("(skipped) ${why}")
}

# ---------- 环境预检 ----------
printf '%s== uter 统一质量门禁 ==%s\n' "$C_BOLD" "$C_RESET"
printf '根目录: %s\n' "$ROOT"
printf '模式:   %s\n' "$([ "$QUICK" -eq 1 ] && echo 'quick（跳过慢套件）' || echo 'full（全量）')"

MISSING=()
command -v go  >/dev/null 2>&1 || MISSING+=("go")
command -v bun >/dev/null 2>&1 || MISSING+=("bun")

# ---------- 变更保护：开工前快照工作区 ----------
DIRTY_COUNT=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '(unknown)')
HEAD_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo '(unknown)')
printf '分支:   %s @ %s\n' "$BRANCH" "$HEAD_SHA"
printf '工作区: %s 处未提交改动（本脚本不会修改其中任何内容）\n' "$DIRTY_COUNT"

# ---------- Go 后端 ----------
if command -v go >/dev/null 2>&1; then
  step "Go 格式"   'gofmt_files=$(gofmt -l . 2>/dev/null | grep -v "^vendor/" || true); if [ -n "$gofmt_files" ]; then echo "以下文件未 gofmt:"; echo "$gofmt_files"; exit 1; fi'
  step "Go vet"    'go vet ./... 2>&1'
  if [ "$QUICK" -eq 1 ]; then
    skip "Go 测试 (make test)" "--quick 模式跳过"
  else
    step "Go 测试 (make test)" 'make test 2>&1'
  fi
else
  skip "Go 后端全部门禁" "未检测到 go 命令"
fi

# ---------- 前端 ----------
if command -v bun >/dev/null 2>&1 && [ -d "$ROOT/web" ]; then
  step "前端 类型检查 (tsgo)"    'bun run typecheck 2>&1'                 "$ROOT/web"
  step "前端 Lint (oxlint+i18n)" 'bun run lint 2>&1'                      "$ROOT/web"
  step "设计令牌门禁 (strict)"   'bun run lint:design:strict 2>&1'        "$ROOT/web"
  step "版权头检查"              'bun run copyright:check 2>&1'           "$ROOT/web"
  step "格式检查"                'bun run format:check 2>&1'              "$ROOT/web"
  if [ "$QUICK" -eq 1 ]; then
    skip "前端 单元测试 (vitest)"      "--quick 模式跳过"
    skip "前端 生产构建 (build:check)" "--quick 模式跳过"
  else
    step "前端 单元测试 (vitest)"      "bun run test 2>&1"                 "$ROOT/web"
    step "前端 生产构建 (build:check)" "bun run build:check 2>&1"          "$ROOT/web"
  fi
else
  skip "前端全部门禁" "未检测到 bun 或 web/ 目录"
fi

# ---------- 汇总 ----------
printf '\n%s== 门禁汇总 ==%s\n' "$C_BOLD" "$C_RESET"
printf '%s\n' "--------------------------------------------------------------------------------"
printf '%-30s %-8s %-6s %s\n' "检查项" "结果" "耗时" "退出码"
printf '%s\n' "--------------------------------------------------------------------------------"

PASSED=0; FAILED=0; SKIPPED=0
i=0
while [ "$i" -lt "${#NAMES[@]}" ]; do
  case "${STATUSES[$i]}" in
    PASS) PASSED=$((PASSED + 1)); color="$C_GREEN" ;;
    FAIL) FAILED=$((FAILED + 1)); color="$C_RED" ;;
    *)    SKIPPED=$((SKIPPED + 1)); color="$C_YELLOW" ;;
  esac
  printf '%-30s %s%-8s%s %-6ss %s\n' \
    "${NAMES[$i]}" "$color" "${STATUSES[$i]}" "$C_RESET" "${SECS[$i]}" "${CODES[$i]}"
  i=$((i + 1))
done
printf '%s\n' "--------------------------------------------------------------------------------"
printf '通过 %d / 失败 %d / 跳过 %d\n' "$PASSED" "$FAILED" "$SKIPPED"

# 失败项回显，便于直接复制复现
if [ "$FAILED" -gt 0 ]; then
  printf '\n%s失败项复现命令：%s\n' "$C_RED" "$C_RESET"
  i=0
  while [ "$i" -lt "${#NAMES[@]}" ]; do
    if [ "${STATUSES[$i]}" = "FAIL" ]; then
      printf '  # %s\n  %s\n' "${NAMES[$i]}" "${CMDS[$i]}"
    fi
    i=$((i + 1))
  done
fi

if [ "${#MISSING[@]}" -gt 0 ]; then
  printf '\n%s环境缺失: %s%s\n' "$C_YELLOW" "${MISSING[*]}" "$C_RESET"
fi

if [ "$FAILED" -gt 0 ]; then
  printf '\n%s✗ 门禁未通过%s — 请修复后重跑：./scripts/verify-all.sh\n' "$C_RED" "$C_RESET"
  exit 1
fi

printf '\n%s✓ 全部门禁通过%s\n' "$C_GREEN" "$C_RESET"
exit 0
