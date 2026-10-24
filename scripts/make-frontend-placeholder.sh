#!/usr/bin/env bash
# 为只测后端、不构建前端的 CI 作业生成 //go:embed 所需的最小产物骨架。
#
# 背景：main.go 用
#
#	//go:embed web/dist all:web/dist/docs-content/_next
#
# 把前端 SPA 与文档静态站打进二进制。两个 pattern 都要求对应路径在 go build
# 时真实存在，否则编译直接失败（no matching files found）。
#
# 后端测试/vet 作业不需要真正的前端产物，所以这里造一个空骨架让编译通过。
# 注意必须包含 docs-content/_next——只 touch web/dist/index.html 会让
# go build 失败，而且失败信息（指向 _next）很容易被误判成别的问题。
#
# 生成的内容是空文件，因此 main_docs_test.go 里的文档完整性用例会自动跳过
# （见 isPlaceholderFrontend），不会在 CI 里误报缺文档。
#
# 用法：scripts/make-frontend-placeholder.sh
set -euo pipefail

mkdir -p web/dist
mkdir -p web/dist/docs-content/_next/static/chunks

: > web/dist/index.html
: > web/dist/docs-content/_next/static/chunks/placeholder.css

echo "frontend embed placeholder created at web/dist (docs skeleton included)"
