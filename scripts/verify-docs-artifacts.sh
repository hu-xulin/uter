#!/usr/bin/env bash
# 发布前完整性检查：确认 web/dist 里同时有 SPA 外壳与文档静态站产物。
#
# 背景：Go 后端用 //go:embed web/dist 把前端和文档一起打进二进制，
# router/web-router.go 再把 web/dist/docs-content 挂到 /docs-content。
# 文档站是独立的 Next.js 工程（docs-web），它的 postbuild 才把静态导出
# 拷贝进 web/dist/docs-content。任何只构建 web 而漏掉 docs-web 的发布流程
# （Docker、正式发布包、Electron）都会产出一个「能跑但没有文档」的二进制，
# 而 Go 编译不会因此报错——嵌入的只是空目录。
#
# 因此发布链路的每一步构建之后都要跑这个脚本，把「缺产物」变成一个硬失败，
# 而不是等用户打开 /docs 看到空白。
#
# 用法：scripts/verify-docs-artifacts.sh [web/dist 路径]
set -euo pipefail

DIST="${1:-web/dist}"

fail() {
  echo "::error::docs artifact verification failed: $1" >&2
  echo "docs artifact verification failed: $1" >&2
  exit 1
}

[ -d "$DIST" ] || fail "$DIST does not exist (frontend was not built)"

# 1. SPA 外壳
[ -s "$DIST/index.html" ] || fail "$DIST/index.html is missing or empty (SPA shell)"

# 2. 文档静态站：至少要有中文落地页和 _next 资源目录。
#    路径与 docs-web/next.config.mjs 的 basePath、copy-to-web.mjs 的拷贝目标一致。
[ -s "$DIST/docs-content/docs/zh/index.html" ] ||
  fail "$DIST/docs-content/docs/zh/index.html is missing or empty (docs static export)"
[ -d "$DIST/docs-content/_next" ] ||
  fail "$DIST/docs-content/_next is missing (docs static assets)"

# 3. 落地页不能是个空壳：Next 导出的页面远大于 1KB。
size=$(wc -c < "$DIST/docs-content/docs/zh/index.html")
[ "$size" -gt 1024 ] ||
  fail "$DIST/docs-content/docs/zh/index.html is only ${size} bytes (truncated export?)"

# 4. 多语言落地页：与 content 目录下的语言保持一致，缺一个都算缺产物。
for lang in en fr ja ru vi zh zh-TW; do
  [ -s "$DIST/docs-content/docs/$lang/index.html" ] ||
    fail "$DIST/docs-content/docs/$lang/index.html is missing (docs language: $lang)"
done

echo "docs artifact verification passed: $DIST contains the SPA shell and the docs static export"
