#!/usr/bin/env bash
# ensure-go-embed-artifacts.sh — 为 go vet / 后端测试补齐 //go:embed 前置产物。
#
# 背景：main.go 有两条 embed 指令
#   //go:embed web/dist
#   //go:embed web/dist/index.html
# 两者都要求 web/dist/index.html 在编译期真实存在，否则 go vet / go build
# 直接报 "no matching files found"。CI 的后端作业用
# scripts/make-frontend-placeholder.sh 在 go vet 前生成最小骨架，
# 但本地统一门禁 scripts/verify-all.sh 此前缺了这一步，于是「代码无问题、
# 却因未构建前端而失败」——这是构建顺序/前置条件缺陷，不是 Go 代码缺陷。
#
# 文档收敛后不再有第二条 `all:web/dist/docs-content/_next` embed 模式：
# Next.js 静态站已退役，MDX 正文编译进 SPA 的异步 chunk，7 份搜索索引与
# user-guide 截图由 `cd web && bun run build` 拷进 web/dist。因此本脚本
# **只**补 web/dist/index.html，绝不创建任何 docs-content 骨架 —— 留着那种
# 空目录只会掩盖「文档产物没打进二进制」。真实产物由发布链路的
# scripts/verify-docs-artifacts.sh 硬校验。
#
# 与 CI 脚本的区别（重要）：本脚本是**幂等且非破坏性**的。CI 在干净检出上
# 可以无条件截断文件，本地工作区可能已有真实前端产物，绝不能覆盖：
#   - web/dist/index.html 已存在 → 原样保留
#   - 只有确实缺失的目标才补空文件
#
# 这个空文件只是让 //go:embed 的 pattern 能解析，**不能替代**
# `bun run build:check`；main_docs_test.go 的 isPlaceholderFrontend() 会在
# 这种状态下跳过真实产物用例，因此完整前端产物验证仍由 build:check 与
# verify-docs-artifacts.sh 门禁负责。
#
# 用法：scripts/quality/ensure-go-embed-artifacts.sh
# 退出码：0 = embed 目标可解析；非 0 = 前置条件无法满足
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 1

DIST="$ROOT/web/dist"
INDEX="$DIST/index.html"

mkdir -p "$DIST"

CREATED=()

if [ ! -e "$INDEX" ]; then
  : > "$INDEX"
  CREATED+=("web/dist/index.html")
fi

if [ "${#CREATED[@]}" -eq 0 ]; then
  echo "embed targets already present; no placeholder created"
else
  echo "created build-time embed skeleton (NOT a frontend build):"
  printf '  - %s\n' "${CREATED[@]}"
  echo "NOTE: the empty file only satisfies //go:embed pattern resolution for go vet/go test."
  echo "      It does NOT substitute for 'bun run build:check'."
fi

# 自检：pattern 必须能被 go:embed 解析，否则宁可显式失败。
[ -f "$INDEX" ] || { echo "FATAL: $INDEX missing" >&2; exit 1; }

# 退役回归护栏：docs-web 已删除，这里再生成 docs-content 骨架就是旧逻辑复活。
if [ -e "$DIST/docs-content" ]; then
  echo "FATAL: retired docs-content tree still present at $DIST/docs-content" >&2
  echo "       remove the stale static-export leftovers; native docs live in the SPA bundle." >&2
  exit 1
fi

echo "embed precondition OK: web/dist/index.html"
