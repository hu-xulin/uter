#!/usr/bin/env bash
# 启动 UTER 产品规格中心（PRD ⇄ Prototype 双向同步）。
# 仅绑定 127.0.0.1；写操作需要 X-Uter-Role: admin。
# 用法：bash tools/product-workspace/start.sh [port]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
PORT="${1:-${UTER_PRODUCT_WORKSPACE_PORT:-7788}}"
MODEL="docs/product/registry/product-model.json"

if ! command -v node >/dev/null 2>&1; then
  echo "[product-workspace] 需要 Node.js >= 18" >&2
  exit 1
fi
if [ ! -f "$MODEL" ]; then
  echo "[product-workspace] 统一需求模型不存在，正在建立初始基线…"
  node tools/product-workspace/build-model.mjs
  node tools/product-workspace/render-docs.mjs
fi

echo "[product-workspace] 一致性门禁…"
node tools/product-workspace/cli.mjs check

echo "[product-workspace] 生成 Uter 内嵌投影（web/public/product-spec）…"
node tools/product-workspace/embed.mjs

echo "[product-workspace] 启动： http://127.0.0.1:${PORT}/"
exec node tools/product-workspace/cli.mjs serve --port "$PORT"
