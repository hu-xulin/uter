#!/bin/bash
set -e

echo "[1/2] 构建前端正式版..."
cd web
bun install
bun run build

echo ""
echo "[2/2] 启动后端服务（已内嵌新前端）..."
cd ..
go run main.go
