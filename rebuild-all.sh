#!/bin/bash
# rebuild-all.sh — 一键重建 + 发布 + 重启
#
# 覆盖所有前后端产物并重启服务，保证任何改动都生效：
#   1. web/       React SPA        → rsbuild build    （产出 web/dist）
#   2. docs-web/  Next.js 文档站   → npm run build    （postbuild 自动拷贝到 web/dist/docs）
#   3. Go 后端    //go:embed       → go build -o u-routers-bin .（内嵌新前端）
#   4. 重启       杀掉旧进程后以独立会话启动 u-routers-bin，并做端口 + HTTP 体检
#
# 关键约束（改动前先读）：
#   - 顺序不可换：rsbuild 会清空整个 web/dist（含 dist/docs），所以必须
#     先 web 后 docs-web，最后才编 Go，否则文档站会被打进旧产物。
#   - CODEBUDDY_SAFE_DELETE_ENABLED=0 必须带上：WorkBuddy 的删除 shim 会
#     让 Next 清理 .next 时报 ENOTEMPTY 或静默失效。
#   - 本仓库无 bun：一律用 ./node_modules/.bin/ 下的可执行文件。
#   - 重启不能用 nohup &：终端会回收子进程。这里用 python Popen 的
#     start_new_session=True 派生独立会话。
#
# 关于「前端服务」：
#   本项目没有独立的前端进程。SPA 构建产物 web/dist 由 Go 用 //go:embed
#   内嵌，和 API 一起在 $PORT(3000) 上对外服务——所以「启动前端」就是
#   重新编译并重启 Go 二进制，不需要、也不能单独起一个前端服务。
#   需要热更新（HMR）开发时用 --dev：额外拉起 rsbuild dev（SPA）与
#   next dev（文档站），API 与 /docs 资源仍代理到 3000 的 Go 后端。
#
# 用法：
#   ./rebuild-all.sh                 # 全量：web + docs + Go + 重启
#   ./rebuild-all.sh --no-restart    # 只构建，不重启服务
#   ./rebuild-all.sh --no-docs       # 跳过文档站（改了 Go/SPA 时用）
#   ./rebuild-all.sh --install       # 构建前先 npm install 两个前端
#   ./rebuild-all.sh --dev           # 构建+重启后，再拉起前端 HMR 开发服务
#   ./rebuild-all.sh --dev --no-build  # 不重新构建，只重启后端 + 拉起 dev 服务
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=3000
BIN="$ROOT/u-routers-bin"
LOG=/tmp/u-routers-console.log
GO=/usr/local/go/bin/go
NODE_DIR=/Users/lincolnhu/.workbuddy/binaries/node/versions/22.22.2-3/bin
PYTHON=/usr/bin/python3

NO_RESTART=0; NO_DOCS=0; INSTALL=0; DEV=0; NO_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --no-build)   NO_BUILD=1 ;;
    --no-restart) NO_RESTART=1 ;;
    --no-docs)    NO_DOCS=1 ;;
    --install)    INSTALL=1 ;;
    --dev)        DEV=1 ;;
    *) echo "未知参数: $arg"; exit 1 ;;
  esac
done

# WorkBuddy 的 node-safe-delete-shim 会让 Next 的清理步骤炸掉，提前关掉。
export CODEBUDDY_SAFE_DELETE_ENABLED=0
# dev server 的 CLI 是 `#!/usr/bin/env node` shim，node 必须在 PATH 上。
export PATH="$NODE_DIR:$PATH"

fail() { echo "✗ $1" >&2; exit 1; }
stat_line() { stat -f '%Sm  %8z  %N' -t '%F %T' "$1" 2>/dev/null || echo "    缺失: $1"; }
port_in_use() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t >/dev/null 2>&1; }
pick_port() { local p="$1"; while port_in_use "$p"; do p=$((p + 1)); done; echo "$p"; }
wait_http() { # $1=port $2=重试次数；成功打印 HTTP 码
  local p="$1" n="${2:-40}" i code
  for ((i = 0; i < n; i++)); do
    sleep 0.5
    code="$(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:$p/" || true)"
    if [ -n "$code" ] && [ "$code" != "000" ]; then echo "$code"; return 0; fi
  done
  return 1
}
spawn() { # $1=日志 $2=cwd $3..=命令；以独立会话派生，终端退出也不被回收
  local log="$1" cwd="$2"; shift 2
  : >> "$log"
  echo "---- start $(date '+%F %T') ----" >> "$log"
  "$PYTHON" - "$log" "$cwd" "$@" <<'PY'
import subprocess, sys
log, cwd = sys.argv[1], sys.argv[2]
with open(log, 'a') as f:
    subprocess.Popen(sys.argv[3:], cwd=cwd, stdout=f, stderr=subprocess.STDOUT,
                     start_new_session=True)
PY
}

if [ "$NO_BUILD" = 1 ]; then
  echo "==> 跳过构建（--no-build），直接用现有 web/dist 与 $BIN"
else
echo "==> [1/5] 构建前端 SPA (web/)"
cd "$ROOT/web"
if [ "$INSTALL" = 1 ]; then "$NODE_DIR/npm" install; fi
[ -x node_modules/.bin/rsbuild ] || fail "web/node_modules 缺失，先跑 $0 --install"
./node_modules/.bin/rsbuild build
echo "    产物: $(stat_line "$ROOT/web/dist/index.html")"
ls "$ROOT"/web/dist/static/js/*.js >/dev/null 2>&1 || fail "web/dist/static/js 为空，SPA 构建异常"

echo "==> [2/5] 构建文档站 (docs-web/ → web/dist/docs)"
if [ "$NO_DOCS" = 0 ]; then
  cd "$ROOT/docs-web"
  if [ "$INSTALL" = 1 ]; then "$NODE_DIR/npm" install; fi
  "$NODE_DIR/npm" run build   # postbuild 会自动把 out/ 拷进 web/dist/docs
  [ -d "$ROOT/web/dist/docs" ] || fail "web/dist/docs 不存在，文档站拷贝失败"
  # 文档站是 locale 前缀导出，根目录没有 index.html，用搜索索引当指纹。
  echo "    产物: $(stat_line "$ROOT/web/dist/docs/search-index.json")"
else
  echo "    跳过 (--no-docs)"
fi

echo "==> [3/5] 编译 Go 后端（内嵌 web/dist）"
cd "$ROOT"
"$GO" build -o "$BIN" . || fail "go build 失败"
fi

if [ "$NO_RESTART" = 1 ]; then
  echo "==> 完成（未重启，--no-restart）"
  exit 0
fi

echo "==> [4/5] 重启服务 (端口 $PORT)"

# 4.1 停掉旧进程（可能是 u-routers-bin，也可能是 go run 的临时二进制）
old_pids="$(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t 2>/dev/null || true)"
if [ -n "$old_pids" ]; then
  echo "    停止旧进程: $(echo $old_pids | tr '\n' ' ')"
  kill $old_pids 2>/dev/null || true
  for _ in $(seq 1 20); do
    lsof -nP -iTCP:$PORT -sTCP:LISTEN -t >/dev/null 2>&1 || break
    sleep 0.5
  done
  # 还占着端口就强杀
  if lsof -nP -iTCP:$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    kill -9 $(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t) 2>/dev/null || true
    sleep 1
  fi
fi

# 4.2 独立会话启动，日志追加到 $LOG
spawn "$LOG" "$ROOT" "$BIN"

# 4.3 体检：端口监听 + HTTP 可达，失败把日志尾部甩出来
code="$(wait_http "$PORT" 30 || true)"
if [ -z "$code" ] || [ "$code" = "000" ]; then
  echo "✗ 服务未就绪，日志尾部:" >&2
  tail -30 "$LOG" >&2
  exit 1
fi
pid="$(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
echo "✓ 后端已重启（同时提供 API 与前端 SPA）: pid=$pid  http://127.0.0.1:$PORT/  (HTTP $code)"
echo "  日志: $LOG"

if [ "$DEV" = 0 ]; then exit 0; fi

# ---------------------------------------------------------------------------
# 5/5 前端 HMR 开发服务（可选，--dev）
#
# 生产模式下前端是 Go 内嵌的静态产物，改一行代码也要重编 Go。开发时把
# rsbuild dev 拉起来可热更新：它把 /api 等代理到 $PORT 的 Go 后端，把
# /docs、/about 代理到 next dev（NEXT_DOCS_PORT），所以后端仍是唯一数据源。
# ---------------------------------------------------------------------------
echo "==> [5/5] 启动前端开发服务（HMR）"

DOCS_DEV_PORT="$PORT"
if [ "$NO_DOCS" = 0 ]; then
  DOCS_DEV_PORT="$(pick_port 3100)"
  DOCS_DEV_LOG=/tmp/u-routers-docs-dev.log
  [ -x "$ROOT/docs-web/node_modules/.bin/next" ] || fail "docs-web/node_modules 缺失，先跑 $0 --install"
  spawn "$DOCS_DEV_LOG" "$ROOT/docs-web" "$ROOT/docs-web/node_modules/.bin/next" dev --port "$DOCS_DEV_PORT"
  docs_code="$(wait_http "$DOCS_DEV_PORT" 60 || echo 000)"
  [ "$docs_code" != "000" ] || { echo "✗ 文档站 dev 未就绪:" >&2; tail -20 "$DOCS_DEV_LOG" >&2; exit 1; }
  echo "    文档站 dev : http://127.0.0.1:$DOCS_DEV_PORT/  (HTTP $docs_code)  日志: $DOCS_DEV_LOG"
fi

WEB_DEV_PORT="$(pick_port 3001)"
WEB_DEV_LOG=/tmp/u-routers-web-dev.log
[ -x "$ROOT/web/node_modules/.bin/rsbuild" ] || fail "web/node_modules 缺失，先跑 $0 --install"
spawn "$WEB_DEV_LOG" "$ROOT/web" env NEXT_DOCS_PORT="$DOCS_DEV_PORT" \
  "$ROOT/web/node_modules/.bin/rsbuild" dev --port "$WEB_DEV_PORT"
web_code="$(wait_http "$WEB_DEV_PORT" 60 || echo 000)"
if [ "$web_code" = "000" ]; then
  echo "✗ SPA dev 未就绪:" >&2
  tail -20 "$WEB_DEV_LOG" >&2
  exit 1
fi
echo "✓ SPA dev      : http://127.0.0.1:$WEB_DEV_PORT/  (HTTP $web_code)  日志: $WEB_DEV_LOG"
echo "  改 web/src 下的代码即时热更新；API 与 /docs 代理到后端 $PORT。"
