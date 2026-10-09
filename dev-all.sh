#!/usr/bin/env bash
# dev-all.sh —— 在一个终端里前台运行全部 4 个本地服务，输出带颜色分标签。
#
#   ./dev-all.sh          启动全部（默认）
#   ./dev-all.sh --keep   不停掉已占端口的旧进程，直接尝试启动（端口冲突时报错退出）
#
# Ctrl+C 一次性停止全部子进程。日志同时落盘，便于事后回看。
#
# 服务清单：
#   3000  uter            AI 网关本体（Go 二进制，内嵌 SPA + 文档站）
#   3200  uter-cs         智能客服（挂件 + /api/rag/search）
#   3500  rag-shim        RAG 零依赖测试桩
#   3510  rag-adapter     RAG 适配器（本地语料 + SiliconFlow 向量）

set -uo pipefail

ROOT="/Users/lincolnhu/uter"
UTER_CS="/Users/lincolnhu/uter-cs"
RAG_SHIM="/Users/lincolnhu/Downloads/Uter/rag-shim"
RAG_ADAPTER="/Users/lincolnhu/Downloads/Uter/rag-adapter"
NODE="/Users/lincolnhu/.workbuddy/binaries/node/versions/22.22.2-6/bin/node"
LOGDIR="${TMPDIR:-/tmp}/dev-all-logs"

# 🔑 SiliconFlow Key 从 Options 表读（与线上运行保持同一来源），不要硬编码进脚本。
# ⚠️ 必须用 SF 的 key，不能用 costopt_setting.batch_api_key —— 那是智谱的，
#    传给 SiliconFlow embedding 会 401「Token is invalid」并退化成词法检索。
read_opt() { /usr/bin/sqlite3 "$ROOT/one-api.db" "select value from options where key='$1'" 2>/dev/null; }
SF_KEY="${SF_KEY:-$(read_opt costopt_setting.semantic_cache_embed_api_key)}"
if [ -z "$SF_KEY" ]; then
  SF_KEY="$(/usr/bin/sqlite3 "$ROOT/one-api.db" "select key from channels where id=22" 2>/dev/null)"
fi
LOCAL_CORPUS="${LOCAL_CORPUS:-$RAG_ADAPTER/corpus.json}"

mkdir -p "$LOGDIR"
[ -t 1 ] || { echo "提示：非交互终端，彩色标签已关闭"; }

# 颜色
if [ -t 1 ]; then
  C_UTER=$'\033[36m'; C_CS=$'\033[35m'; C_SHIM=$'\033[33m'; C_ADAPTER=$'\033[32m'
  C_DIM=$'\033[2m'; C_OFF=$'\033[0m'
else
  C_UTER=""; C_CS=""; C_SHIM=""; C_ADAPTER=""; C_DIM=""; C_OFF=""
fi

# 前缀器：给每一行日志加上颜色标签。sed -u 关闭缓冲，保证实时输出。
prefix() { local tag="$1" color="$2"; sed -u "s/^/${color}[${tag}]${C_OFF} /"; }

port_busy() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t >/dev/null 2>&1; }

stop_port() {
  local port="$1" pids i
  pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  [ -n "$pids" ] || return 0
  echo "${C_DIM}停止 :$port (pid: $(echo $pids | tr '\n' ' '))${C_OFF}"
  kill $pids 2>/dev/null || true
  for i in $(seq 1 20); do
    port_busy "$port" || return 0
    sleep 0.25
  done
  pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  [ -n "$pids" ] && kill -9 $pids 2>/dev/null || true
  sleep 0.5
}

PIDS=()
TAILERS=()

# 🔑 架构：服务本体 → 直接写自己的日志文件（干净的独立进程，信号能直达）；
#    终端显示由 tail -F 聚合 + sed 加标签。
# ⚠️ 早先版本用 `服务 | sed | tee &`，$! 拿到的是 tee 的 pid，Ctrl+C 时信号被
#    tee 吃掉，最上游的服务残留（实测 uter 停不掉）。日志+聚合分离可彻底避免。
# 用法: start_svc <tag> <color> <logfile> <cmd...>
start_svc() {
  local tag="$1" color="$2" logfile="$3"; shift 3
  : > "$logfile"
  ( "$@" >>"$logfile" 2>&1 ) &
  PIDS+=($!)
  # 聚合到终端：加颜色标签
  tail -n 0 -F "$logfile" 2>/dev/null | prefix "$tag" "$color" &
  TAILERS+=($!)
}

cleanup() {
  echo ""
  echo "${C_DIM}收到中断，停止全部服务…${C_OFF}"
  # 1) 停聚合器（否则会继续刷屏）
  for p in "${TAILERS[@]:-}"; do
    [ -n "$p" ] && kill "$p" 2>/dev/null || true
  done
  # 2) 停服务本体（先 TERM 后 KILL；Go 服务对 SIGTERM 偶尔响应慢）
  for p in "${PIDS[@]:-}"; do
    [ -n "$p" ] && kill "$p" 2>/dev/null || true
  done
  sleep 1
  for p in "${PIDS[@]:-}"; do
    [ -n "$p" ] && kill -9 "$p" 2>/dev/null || true
  done
  # 3) 兜底按端口清理，确保不残留
  for port in 3000 3200 3500 3510; do
    pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
    [ -n "$pids" ] && kill -9 $pids 2>/dev/null || true
  done
  echo "${C_DIM}全部已停止。日志留在 $LOGDIR${C_OFF}"
  exit 0
}
trap cleanup INT TERM

KEEP=0
[ "${1:-}" = "--keep" ] && KEEP=1

for port in 3000 3200 3500 3510; do
  if port_busy "$port"; then
    if [ "$KEEP" = "1" ]; then
      echo "${C_DIM}--keep：跳过 :$port（已被占用）${C_OFF}"
      continue
    fi
    stop_port "$port"
  fi
done

echo ""
echo "  ${C_UTER}uter${C_OFF}       http://127.0.0.1:3000   AI 网关（控制台 / 文档站）"
echo "  ${C_CS}uter-cs${C_OFF}     http://127.0.0.1:3200   智能客服 + RAG 检索"
echo "  ${C_SHIM}rag-shim${C_OFF}   http://127.0.0.1:3500   RAG 测试桩"
echo "  ${C_ADAPTER}rag-adapter${C_OFF} http://127.0.0.1:3510 RAG 适配器（真实语料）"
echo "  ${C_DIM}日志目录：$LOGDIR${C_OFF}"
if [ -z "$SF_KEY" ]; then
  echo "  ${C_DIM}注意：未读到 SiliconFlow Key，rag-adapter 将退化为纯词法检索${C_OFF}"
fi
echo "  ${C_DIM}Ctrl+C 停止全部${C_OFF}"
echo ""

# ---- 1. uter：AI 网关本体 ----
cd "$ROOT" || exit 1
if ! port_busy 3000; then
  start_svc "uter" "$C_UTER" "$LOGDIR/uter.log" ./uter-bin
fi

# ---- 2. uter-cs：智能客服 ----
cd "$UTER_CS" || exit 1
if ! port_busy 3200; then
  start_svc "cs" "$C_CS" "$LOGDIR/uter-cs.log" env PORT=3200 "$NODE" server/index.js
fi

# ---- 3. rag-shim：RAG 测试桩 ----
cd "$RAG_SHIM" || exit 1
if ! port_busy 3500; then
  start_svc "shim" "$C_SHIM" "$LOGDIR/rag-shim.log" env PORT=3500 "$NODE" server.js
fi

# ---- 4. rag-adapter：RAG 适配器（依赖本地语料 + SF Key）----
cd "$RAG_ADAPTER" || exit 1
if ! port_busy 3510; then
  # CS_BASE 留空 → 只用本地语料，不去打客服的鉴权接口（实测 401 会回退，纯浪费延迟）
  start_svc "adapter" "$C_ADAPTER" "$LOGDIR/rag-adapter.log" \
    env SF_KEY="$SF_KEY" LOCAL_CORPUS="$LOCAL_CORPUS" CS_BASE="" PORT=3510 \
    "$NODE" server.js
fi

# 等待任一服务退出即整体退出（避免出现"半个服务在跑"的错位状态）
wait -n 2>/dev/null || wait