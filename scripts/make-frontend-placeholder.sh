#!/usr/bin/env bash
# 为只测后端、不构建前端的 CI 作业生成 //go:embed 所需的最小产物骨架。
#
# 背景：main.go 用
#
#	//go:embed web/dist
#	//go:embed web/dist/index.html
#
# 把前端 SPA 打进二进制。两个 pattern 都要求 web/dist/index.html 在 go build
# 时真实存在，否则编译直接失败（no matching files found）。
#
# 后端测试/vet 作业不需要真正的前端产物，所以这里造一个空骨架让编译通过。
# 文档收敛后不再有独立的 docs-web 静态站，因此也不再有
# `all:web/dist/docs-content/_next` 这条 embed 模式 —— 不要在这里重建
# `_next` 目录，那会让「文档没打进二进制」看起来像编译通过。
#
# 生成的是空文件，因此 main_docs_test.go 里的真实产物用例会自动跳过
# （见 isPlaceholderFrontend），不会在 CI 里误报缺文档。发布链路另由
# scripts/verify-docs-artifacts.sh 硬校验 7 份搜索索引与截图。
#
# 用法：scripts/make-frontend-placeholder.sh
set -euo pipefail

mkdir -p web/dist

: > web/dist/index.html

echo "frontend embed placeholder created at web/dist (SPA shell only)"
