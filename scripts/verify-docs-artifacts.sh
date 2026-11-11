#!/usr/bin/env bash
# 发布前完整性检查：确认 web/dist 里 SPA 外壳与**原生文档**静态产物齐备。
#
# 背景：文档收敛后不再有独立的 Next.js 静态站。MDX 正文编译进 SPA 的异步
# chunk，但 7 份搜索索引（`public/docs-search/<lang>.json`）与 user-guide
# 截图（`public/user-guide/...`）仍是稳定 URL 的静态文件，由
# `cd web && bun run build` 拷进 web/dist。Go 用 //go:embed web/dist 把它们
# 一起打进二进制；只编译 Go 而漏掉前端构建时编译不会报错，服务能起，但
# 搜索空、截图 404，启动日志也只能给一条告警。
#
# 因此发布链路的每一步构建之后都要跑这个脚本，把「缺产物」变成硬失败。
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

# 1. SPA 外壳：空文件是 CI 占位，不能进发布产物。
[ -s "$DIST/index.html" ] || fail "$DIST/index.html is missing or empty (SPA shell)"
size=$(wc -c < "$DIST/index.html")
[ "$size" -gt 1024 ] ||
  fail "$DIST/index.html is only ${size} bytes (placeholder or truncated build?)"

# 2. SPA 的 bundle：原生文档的 MDX 就编译在这些异步 chunk 里。
[ -d "$DIST/static/js" ] || fail "$DIST/static/js is missing (SPA bundles)"
js_count=$(find "$DIST/static/js" -type f -name '*.js' -print -quit 2>/dev/null || true)
[ -n "$js_count" ] || fail "$DIST/static/js has no .js bundle (frontend was not built)"

# 3. 七语言的搜索索引，缺一份就有一个语言的搜索永远空。
for lang in en fr ja ru vi zh zh-TW; do
  index="$DIST/docs-search/$lang.json"
  [ -s "$index" ] || fail "$index is missing or empty (native docs search index: $lang)"
  index_size=$(wc -c < "$index")
  [ "$index_size" -gt 1024 ] ||
    fail "$index is only ${index_size} bytes (truncated search index?)"
done

# 4. user-guide 明暗主题截图：MDX 里是绝对路径，缺文件就是裂图。
for loc in zh en; do
  for theme in light dark; do
    shot="$DIST/user-guide/$loc/auth/$theme/01-login.webp"
    [ -s "$shot" ] || fail "$shot is missing or empty (user-guide screenshot)"
  done
done

# 5. sitemap 与 robots：原生文档的 URL 要能被搜索引擎发现，robots 里也指着
#    这份 sitemap。两份都是构建期生成/拷贝的静态文件，缺一份就是线上悄悄丢失。
[ -s "$DIST/sitemap.xml" ] || fail "$DIST/sitemap.xml is missing (native docs sitemap)"
[ -s "$DIST/robots.txt" ] || fail "$DIST/robots.txt is missing (crawler policy)"

echo "docs artifact verification passed: $DIST contains the SPA shell and all native docs assets (7 search indexes + screenshots + sitemap)"
