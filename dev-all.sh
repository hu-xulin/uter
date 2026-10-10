#!/usr/bin/env bash
# dev-all.sh —— 在一个终端里前台运行全部 4 个本地服务，输出带颜色分标签。
#
#   ./dev-all.sh              启动全部（默认，不构建，用现有 uter-bin）
#   ./dev-all.sh --build      先构建（复用 rebuild-all.sh --no-restart）再启动全部
#   ./dev-all.sh --keep       不停掉已占端口的旧进程，直接尝试启动（端口冲突时报错退出）
#   ./dev-all.sh --build --keep
#
# Ctrl+C 一次性停止全部子进程。日志同时落盘，便于事后回看。
#
# 与 rebuild-all.sh 的关系（务必先读）：
#   rebuild-all.sh = **构建 + 发布**：rsbuild → docs-web → go build（VERSION 自增）
#                    → detached 启动 uter-bin（独立会话，脚本退出后仍存活）→ 体检。
#                    它是「代码改动后」的默认动作，逻辑只有这一份，**不要复制**。
#   dev-all.sh     = **联调编排**：只跑不编译。把已构建好的 uter-bin 连同 uter-cs、
#                    rag-shim、rag-adapter 四个服务端到一个前台终端里，彩色分标签，
#                    Ctrl+C 全停。适合跨服务联调、看实时日志。
#
#   两者唯一的耦合点是端口 3000，且是**互斥**关系：谁后跑谁把对方顶掉。
#   本脚本的解法是 **单向依赖**：`--build` 只调`rebuild-all.sh --no-restart`
#   （只构建、不重启、不碰 3000），构建成功后才由本脚本独占 3000。
#   于是端口 3000 的启动者永远只有本脚本一个，不会出现「detached 进程被前台 Ctrl+C
#   杀掉」或「前台进程被后台 spawn 悄悄替换」这种错位。
#
#   ⚠️ 反向仍然要小心：dev-all.sh 跑着的时候执行**完整**的 ./rebuild-all.sh
#   （不带 --no-restart），它会杀掉本脚本持有的 :3000 子进程。本脚本的守护协程会
#   检测到并告警，但不会自动重启 —— 请Ctrl+C 后重跑。
#
# 服务清单：
#   3000  uter            AI 网关本体（Go 二进制，内嵌 SPA + 文档站）
#   3200  uter-cs         智能客服（挂件 + /api/rag/search）
#   3500  rag-shim        RAG 零依赖测试桩
#   3510  rag-adapter     RAG 适配器（本地语料 + SiliconFlow 向量）
#
# ⚠️ 系统 bash 是 3.2（macOS 自带），不支持 `wait -n`。脚本末尾的
#    `wait -n 2>/dev/null || wait` 靠 || 兜底退化为「等所有子进程」，
#    行为等价于「只能 Ctrl+C 退出」，不要删那个 ||。

set -uo pipefail

ROOT="/Users/lincolnhu/uter"
UTER_CS="/Users/lincolnhu/uter-cs"
RAG_SHIM="/Users/lincolnhu/Downloads/Uter/rag-shim"
RAG_ADAPTER="/Users/lincolnhu/Downloads/Uter/rag-adapter"
LOGDIR="${TMPDIR:-/tmp}/dev-all-logs"

# ---------------------------------------------------------------------------
# 参数解析
# ---------------------------------------------------------------------------
DO_BUILD=0
KEEP=0
# ⚠️ 必须用 `[ $# -gt 0 ]` 显式守卫：macOS 自带 bash 3.2 在 `set -u` 下展开空的
#    "$@" 会抛 `arg: unbound variable`（bash 4.4+ 才修）。无参数时直接跳过循环。
if [ $# -gt 0 ]; then
for arg in "$@"; do
  case "$arg" in
    --build) DO_BUILD=1 ;;
    --keep)  KEEP=1 ;;
    -h|--help)
      # 打印头部用法说明：从第 2 行起连续注释块（遇首个非注释行即止），避免
      # 写死行号——注释一改行号就错位。
      awk 'NR>1 { if ($0 !~ /^#/) exit; sub(/^#[[:space:]]?/, ""); print }' "$0"
      exit 0 ;;
    *) echo "未知参数: ${arg}（可用：--build --keep）"; exit 1 ;;
  esac
done
fi

# ---------------------------------------------------------------------------
# 运行时定位
# ---------------------------------------------------------------------------
# managed node 目录不写死版本号：WorkBuddy 升级 node 时会改写 versions/current
# 指针，跟指针走，必要时回退到目录里版本号最高的那个，避免路径失效。
NODE_BASE=/Users/lincolnhu/.workbuddy/binaries/node/versions
NODE_VER="$(cat "$NODE_BASE/current" 2>/dev/null | tr -d '[:space:]')"
if [ -z "$NODE_VER" ] || [ ! -d "$NODE_BASE/$NODE_VER/bin" ]; then
  NODE_VER="$(ls -d "$NODE_BASE"/*/ 2>/dev/null | sed 's#.*/##; s#/$##' | sort -V | tail -1)"
fi
NODE="$NODE_BASE/$NODE_VER/bin/node"
if [ ! -x "$NODE" ]; then
  echo "✗ managed node 运行时缺失: $NODE" >&2
  echo "  请确认 WorkBuddy 已安装 node 运行时（rebuild-all.sh 也依赖它）。" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 环境处理（与 rebuild-all.sh 对齐，避免"能跑起来但行为不一致"）
# ---------------------------------------------------------------------------

# 剔除指向本机回环地址的 HTTP(S)_PROXY 等变量。
#
# 背景：本机的 agent/沙箱会话经常注入 HTTP_PROXY=http://127.0.0.1:<随机端口>，
# 而该代理是临时的、随会话结束即退出。uter-bin 用 Go 默认 transport，出站请求走
# ProxyFromEnvironment，一旦继承到这种代理，所有对外 HTTPS 都会报
# `proxyconnect tcp: dial tcp 127.0.0.1:<port>: connect: connection refused`
# （插件市场拉索引、上游渠道测试、渠道回调全挂）。
#
# 🔑 为什么**不做存活探测**、连「启动时还活着」的一律丢弃：代理在探测那一刻监听
# 着，之后会话结束就退出，而服务进程会一直活着 —— 于是渠道测试在启动后一段时间内
# 正常，随后突然全量报 connection refused。存活探测只能过滤「启动前已死」，
# 过滤不掉「启动后退出」。回环代理对本机出站没有不可替代的价值（直连本来就通），
# 所以默认全部剔除，一劳永逸。远程代理（非回环地址）始终保留：那是显式配置。
#
# 与 rebuild-all.sh 的唯一差异：那边把剔除放在 python spawn 里做（因为要派生独立
# 会话），那边支持 KEEP_LOOPBACK_PROXY=1「只保留存活者」；本脚本在当前 shell 里
# unset，所以 KEEP_LOOPBACK_PROXY=1 语义是「一个都不剔除」，不做逐个探测。
# 开关：
#   KEEP_LOOPBACK_PROXY=1  不剔除任何回环代理（例如你确实在用常驻 Clash 7890）
#   KEEP_PROXY=1           原样继承，一个都不动
strip_loopback_proxy() {
  [ "${KEEP_PROXY:-}" = "1" ] && return 0
  [ "${KEEP_LOOPBACK_PROXY:-}" = "1" ] && return 0

  local name value rest host dropped=""
  for name in HTTP_PROXY HTTPS_PROXY FTP_PROXY ALL_PROXY \
              http_proxy https_proxy ftp_proxy all_proxy; do
    eval "value=\${$name:-}"
    [ -n "$value" ] || continue
    rest="${value#*://}"      # 无 scheme 时原样保留
    host="${rest%%/*}"
    host="${host%%:*}"
    host="$(printf '%s' "$host" | tr '[:upper:]' '[:lower:]')"
    host="${host#[}"          # urlsplit 对 [::1] 会去掉方括号，这里对齐
    host="${host%]}"
    case "$host" in
      localhost|127.*|::1|0.0.0.0|'')
        eval "unset $name"
        dropped="${dropped}${dropped:+, }${name}=${value}"
        ;;
    esac
  done
  if [ -n "$dropped" ]; then
    echo "${C_DIM}已剔除回环代理：${dropped}${C_OFF}"
  fi
}

# WorkBuddy / CodeBuddy 沙箱注入的 node shim 必须剔除，否则长驻 node 服务会崩。
#
# 🔑 背景（实测崩过）：会话环境里有
#   NODE_OPTIONS=--require=.../node-language-shim.cjs
#   CODEBUDDY_BROKERED_FS_HOOK_ENABLED=1
#   CODEBUDDY_SAFE_DELETE_ENABLED=1
# shim 把 node 的 fs 调用代理到 broker IPC（socket 由会话持有）。服务进程要活得
# 比会话久，会话一旦结束或 broker 退出，所有 fs 调用抛
# `Error: connect failed: Connection refused at tryBrokerFileTokenSync`
#（栈里有 wrappedCreateReadStream → @fastify/send → SendStream），进程直接崩，
# 表现为「uter-cs 刚起来是200，几分钟后自己没了」。
#
# 与 vitest 必须 `env -u NODE_OPTIONS` 才能跑是**同一个根因**（区别只在于
# vitest 是短进程、超时假红；长驻服务是直接崩）。rebuild-all.sh 已在构建阶段
# 关掉 CODEBUDDY_*，但那只影响它自己派生的构建进程，管不到本脚本拉起的 node 服务。
#
# 开关：KEEP_SANDBOX_SHIM=1 保留原样（仅当你要在沙箱内调试 node 服务本身）。
if [ "${KEEP_SANDBOX_SHIM:-}" != "1" ]; then
  unset NODE_OPTIONS
  export CODEBUDDY_BROKERED_FS_HOOK_ENABLED=0
  export CODEBUDDY_SAFE_DELETE_ENABLED=0
  export CODEBUDDY_SAFE_DELETE_SANDBOX=0
fi

# 登录会话活跃上限：默认拉到 200，防止多设备/多浏览器把超管锁在门外
# （配合 auth_session.go 的「淘汰最旧 idle 会话」逻辑，硬上限只作兜底）。
export USER_SESSION_ACTIVE_LIMIT="${USER_SESSION_ACTIVE_LIMIT:-200}"

# 智能客服（uter-cs）挂件地址：独立仓库、独立部署，前端按此地址**跨域直连**，
# Uter 后端不做任何反向代理。该值经 /api/status 的 customer_service_url 下发给前端；
# 留空则挂件不渲染。本地默认指向本机 3200（与 dev-all.sh 拉起的 uter-cs 对齐）；
# 生产用 CUSTOMER_SERVICE_URL=https://cs.uter.ai 覆盖。
export CUSTOMER_SERVICE_URL="${CUSTOMER_SERVICE_URL:-http://127.0.0.1:3200}"

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
[ -t 1 ] || echo "提示：非交互终端，彩色标签已关闭"

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
OWNED_PORTS=()   # 本脚本亲手拉起并占用的端口，供 cleanup 精确兜底

# 🔑 架构：服务本体→ 直接写自己的日志文件（干净的独立进程，信号能直达）；
#    终端显示由 tail -F 聚合 + sed 加标签。
# ⚠️ 早先版本用 `服务 | sed | tee &`，$! 拿到的是 tee 的 pid，Ctrl+C 时信号被
#    tee 吃掉，最上游的服务残留（实测 uter 停不掉）。日志+聚合分离可彻底避免。
# 用法: start_svc <tag> <color> <logfile> <port> <cmd...>
start_svc() {
  local tag="$1" color="$2" logfile="$3" port="$4"; shift 4
  : > "$logfile"
  ( "$@" >>"$logfile" 2>&1 ) &
  PIDS+=($!)
  OWNED_PORTS+=("$port")
  # 聚合到终端：加颜色标签
  tail -n 0 -F "$logfile" 2>/dev/null | prefix "$tag" "$color" &
  TAILERS+=($!)
}

cleanup() {
  echo ""
  echo "${C_DIM}收到中断，停止全部服务…${C_OFF}"
  # 0) 停守护协程
  [ -n "${WATCH_PID:-}" ] && kill "$WATCH_PID" 2>/dev/null || true
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
  # 3) 兜底：只清理由**本脚本亲手拉起**的端口，绝不按端口无差别清扫
  # ⚠️ 早期版本无条件 `for port in 3000 3200 3500 3510; do kill -9 $(lsof ...)`，
  #    这会误杀**别的** dev-all.sh 实例持有的服务——实测清理一个探针进程时，
  #    它的 cleanup 把另一个正常实例的四个服务一起带走了。端口是全局资源，
  #    「我退出了」不等于「这个端口归我」。因此这里逐个比对：只有当端口上的
  #    监听进程确实属于本脚本启动的 PID 集合时才终止它。
  for i in "${!OWNED_PORTS[@]}"; do
    local_port="${OWNED_PORTS[$i]}"
    on_port="$(lsof -nP -iTCP:"$local_port" -sTCP:LISTEN -t 2>/dev/null || true)"
    [ -n "$on_port" ] || continue
    for opid in $on_port; do
      for mine in "${PIDS[@]:-}"; do
        if [ "$opid" = "$mine" ]; then
          kill -9 "$opid" 2>/dev/null || true
          break
        fi
      done
    done
  done
  echo "${C_DIM}全部已停止。日志留在 $LOGDIR${C_OFF}"
  exit 0
}
trap cleanup INT TERM

# ---------------------------------------------------------------------------
# 可选：先构建（单向调用 rebuild-all.sh，只构建不重启）
# ---------------------------------------------------------------------------
if [ "$DO_BUILD" = 1 ]; then
  echo ""
  echo "==> 构建中（委托 rebuild-all.sh --no-restart，不动端口 3000）"
  echo "${C_DIM}    web/ → docs-web/ → go build（VERSION 自增）${C_OFF}"
  if [ ! -x "$ROOT/rebuild-all.sh" ]; then
    echo "✗ 缺少 $ROOT/rebuild-all.sh，无法 --build（去掉 --build 可直接跑现有二进制）" >&2
    exit 1
  fi
  if "$ROOT/rebuild-all.sh" --no-restart; then
    echo "✓ 构建完成。注意：二进制已更新，但 :3000 上跑的还是旧进程 —— 下面由本脚本启动新二进制。"
  else
    echo "✗ 构建失败（见上方输出），已中止；未启动任何服务。" >&2
    exit 1
  fi
  echo ""
fi

strip_loopback_proxy

for port in 3000 3200 3500 3510; do
  if port_busy "$port"; then
    if [ "$KEEP" = "1" ]; then
      echo "${C_DIM}--keep：跳过 :${port}（已被占用）${C_OFF}"
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
  start_svc "uter" "$C_UTER" "$LOGDIR/uter.log" 3000 ./uter-bin
fi

# ---- 2. uter-cs：智能客服 ----
cd "$UTER_CS" || exit 1
if ! port_busy 3200; then
  start_svc "cs" "$C_CS" "$LOGDIR/uter-cs.log" 3200 \
    env PORT=3200 "$NODE" server/index.js
fi

# ---- 3. rag-shim：RAG 测试桩 ----
cd "$RAG_SHIM" || exit 1
if ! port_busy 3500; then
  start_svc "shim" "$C_SHIM" "$LOGDIR/rag-shim.log" 3500 \
    env PORT=3500 "$NODE" server.js
fi

# ---- 4. rag-adapter：RAG 适配器（依赖本地语料 + SF Key）----
cd "$RAG_ADAPTER" || exit 1
if ! port_busy 3510; then
  # CS_BASE 留空→ 只用本地语料，不去打客服的鉴权接口（实测 401 会回退，纯浪费延迟）
  start_svc "adapter" "$C_ADAPTER" "$LOGDIR/rag-adapter.log" 3510 \
    env SF_KEY="$SF_KEY" LOCAL_CORPUS="$LOCAL_CORPUS" CS_BASE="" PORT=3510 \
    "$NODE" server.js
fi

# ---------------------------------------------------------------------------
# 守护：检查本脚本**自己拉起**的端口是否还活着。
#
# 为什么不用 `wait`：bash 3.2 无 `wait -n`，末尾的 `wait -n || wait` 退化成
# 「等所有子进程」——而 tail -F 聚合器是永不退出的，于是脚本在服务全崩后
# 依然挂着，日志只剩空文件刷新，看着一切正常实则全挂（实测 uter-cs 崩掉后
# :3200返回 000，而终端毫无提示）。
#
# 这里按端口逐一探活：任一自建服务消失就报一次（含它的日志尾部，便于定位），
# 报完仍继续等待 Ctrl+C。**不自动重启**——崩了通常有根因（配置/端口/依赖），
# 自动重启只会刷屏并掩盖首因。
# ---------------------------------------------------------------------------
if [ "${#OWNED_PORTS[@]}" -gt 0 ]; then
  ( sleep 3   # 给服务一点启动时间再开始判定，避免误报
    while true; do
      for i in "${!OWNED_PORTS[@]}"; do
        p="${OWNED_PORTS[$i]}"
        if ! port_busy "$p"; then
          echo ""
          echo "${C_DIM}⚠️  :${p} 上的服务已消失。${C_OFF}"
          case "$p" in
            3000) echo "${C_DIM}   若是另一终端跑了完整 ./rebuild-all.sh 顶掉了它，属预期。${C_OFF}" ;;
            3200) echo "${C_DIM}   查${LOGDIR}/uter-cs.log 尾部；若见 node-brokered-fs-shim / Connection refused，${C_OFF}"
                   echo "${C_DIM}   说明继承了 NODE_OPTIONS 里的沙箱 shim（已在本脚本剔除，确认走的是新脚本）。${C_OFF}" ;;
            *)    echo "${C_DIM}   查 $LOGDIR 下对应日志尾部。${C_OFF}" ;;
          esac
          echo "${C_DIM}   其余服务仍在运行；修好后 Ctrl+C 全部停止再重跑。${C_OFF}"
          # 只报一次：把该端口移出监控范围，避免每 2 秒刷屏
          unset 'OWNED_PORTS[i]'
        fi
      done
      [ "${#OWNED_PORTS[@]}" -eq 0 ] && break
      sleep 2
    done
  ) &
  WATCH_PID=$!
fi

# 等待任一服务退出即整体退出（避免出现"半个服务在跑"的错位状态）
# ⚠️ bash 3.2 无 `wait -n`，靠 || 退化为等所有子进程（即只能 Ctrl+C 退出）。
wait -n 2>/dev/null || wait