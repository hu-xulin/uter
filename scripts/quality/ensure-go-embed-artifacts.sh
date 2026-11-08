#!/usr/bin/env bash
# ensure-go-embed-artifacts.sh — 为 go vet / 后端测试补齐 //go:embed 前置产物。
#
# 背景：main.go 有两条 embed 指令
#   //go:embed web/dist all:web/dist/docs-content/_next
#   //go:embed web/dist/index.html
# 两者都要求目标在编译期真实存在，否则 go vet / go build 直接报
# "no matching files found"。CI 的后端作业用
# scripts/make-frontend-placeholder.sh 在 go vet 前生成最小骨架，
# 但本地统一门禁 scripts/verify-all.sh 此前缺了这一步，于是「代码无问题、
# 却因未构建前端而失败」——这是构建顺序/前置条件缺陷，不是 Go 代码缺陷。
#
# 与 CI 脚本的区别（重要）：本脚本是**幂等且非破坏性**的。CI 在干净检出上
# 可以无条件截断文件，本地工作区可能已有真实前端产物，绝不能覆盖：
#   - web/dist/index.html 已存在 → 原样保留
#   - docs-content/_next 下已有任意文件 → 原样保留，不追加占位文件
#   - 只有确实缺失的目标才补空文件
#
# 这些空文件只是让 //go:embed 的 pattern 能解析，**不能替代**
# `bun run build:check` 与 docs-web 构建；main_docs_test.go 的
# isPlaceholderFrontend() 会在这种状态下跳过文档完整性用例，因此
# 完整前端产物验证仍由 build:check 门禁负责。
#
# 用法：scripts/quality/ensure-go-embed-artifacts.sh
# 退出码：0 = 两个 embed 目标均可解析；非 0 = 前置条件无法满足
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 1

DIST="$ROOT/web/dist"
DOCS_NEXT="$DIST/docs-content/_next"
INDEX="$DIST/index.html"
PLACEHOLDER_CSS="$DOCS_NEXT/static/chunks/embed-placeholder.css"

mkdir -p "$DIST" "$DOCS_NEXT/static/chunks"

CREATED=()

if [ ! -e "$INDEX" ]; then
  : > "$INDEX"
  CREATED+=("web/dist/index.html")
fi

# `all:` 前缀要求 _next 目录里至少有一个真实文件（目录本身不算）。
# 用 `find -print -quit` 而非管道，避免 pipefail 下 grep -q 提前退出造成的假失败。
FOUND_DOC_FILE="$(find "$DOCS_NEXT" -type f -print -quit 2>/dev/null || true)"
if [ -z "$FOUND_DOC_FILE" ]; then
  : > "$PLACEHOLDER_CSS"
  CREATED+=("web/dist/docs-content/_next/static/chunks/embed-placeholder.css")
fi

if [ "${#CREATED[@]}" -eq 0 ]; then
  echo "embed targets already present; no placeholder created"
else
  echo "created build-time embed skeleton (NOT a frontend build):"
  printf '  - %s\n' "${CREATED[@]}"
  echo "NOTE: empty files only satisfy //go:embed pattern resolution for go vet/go test."
  echo "      They do NOT substitute for 'bun run build:check' or the docs-web build."
fi

# 自检：两个 pattern 都必须能被 go:embed 解析，否则宁可显式失败。
[ -f "$INDEX" ] || { echo "FATAL: $INDEX missing" >&2; exit 1; }
[ -n "$(find "$DOCS_NEXT" -type f -print -quit 2>/dev/null || true)" ] || {
  echo "FATAL: no file under $DOCS_NEXT" >&2
  exit 1
}

echo "embed precondition OK: web/dist/index.html + web/dist/docs-content/_next"
