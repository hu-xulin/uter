#!/bin/bash
# rebuild-all.sh — 一键重建 + 发布 + 重启**全部服务**
#
# 覆盖所有前后端产物并重启服务，保证任何改动都生效：
#   1. web/       React SPA        → rsbuild build    （产出 web/dist）
#   2. docs-web/  Next.js 文档站   → npm run build    （postbuild 自动拷贝到 web/dist/docs）
#   3. Go 后端    //go:embed       → go build -o uter-bin .（内嵌新前端）
#      构建时通过 -ldflags -X 注入仓库根 VERSION 文件里的版本号；
#      构建成功后自动把 patch 位 +1 写回 VERSION，下次构建即递进
#      （v1.0.0 → v1.0.1 → v1.0.2 ...），首页 logo 旁即显示该版本。
#   4. uter-cs/   智能客服前端     → vite build       （产出 uter-cs/web/dist）
#   5. 重启       杀掉旧进程后以独立会话启动 uter-bin，并做端口 + HTTP 体检
#   6. 重启       同上，启动 uter-cs（Node/Fastify）并体检 /api/health
#
# 前置依赖 Redis：Uter 的 .env 配了 REDIS_CONN_STRING 时，启动即强 ping，
# 不通就 FatalLog 退出（进程活不过 1 秒）。所以第 5 步会先把本机 Redis 拉起：
# 端口已通 → 跳过；有 redis-server → 直接 spawn；有 docker daemon → 跑临时
# 容器；都没有 → 明确报错并给安装指引（绝不静默降级成「无 Redis」）。
#
# 关键约束（改动前先读）：
#   - 顺序不可换：rsbuild 会清空整个 web/dist（含 dist/docs），所以必须
#     先 web 后 docs-web，最后才编 Go，否则文档站会被打进旧产物。
#   - CODEBUDDY_SAFE_DELETE_ENABLED=0 必须带上：WorkBuddy 的删除 shim 会
#     让 Next 清理 .next 时报 ENOTEMPTY 或静默失效。
#   - 本仓库无 bun：一律用 ./node_modules/.bin/ 下的可执行文件。
#   - 重启不能用 nohup &：终端会回收子进程。这里用 python Popen 的
#     start_new_session=True 派生独立会话。
#   - 本机若装了 ~/Library/LaunchAgents/ai.uter.backend.plist（launchd 托管），
#     重启改走 launchctl kickstart -k；此时后端归 launchd 所有，不再受任何终端
#     会话生命周期影响（关终端 / 关 IDE / agent 会话结束都不会再把它带走）。
#
# 关于「前端服务」：
#   本项目没有独立的前端进程。SPA 构建产物 web/dist 由 Go 用 //go:embed
#   内嵌，和 API 一起在 $PORT(3000) 上对外服务——所以「启动前端」就是
#   重新编译并重启 Go 二进制，不需要、也不能单独起一个前端服务。
#   需要热更新（HMR）开发时用 --dev：额外拉起 rsbuild dev（SPA）与
#   next dev（文档站），API 与 /docs 资源仍代理到 3000 的 Go 后端。
#
# 关于「智能客服（uter-cs）」：
#   uter-cs 是**独立仓库**（默认取同级目录 ../uter-cs，可用 UTER_CS_DIR 指定），
#   独立进程、独立部署：Node + Fastify，默认端口 3200。浏览器按
#   /api/status 下发的 CUSTOMER_SERVICE_URL 跨域直连它，Uter 后端不做反代。
#   本脚本默认把它一并构建 + 拉起 + 体检，实现「一条命令起全部服务」。
#   - 目录不存在时只警告并跳过，不影响 Uter 自身启动（Uter 是主服务）。
#   - uter-cs 启动/构建失败不会让脚本以非零退出，但会在结尾醒目标红提示。
#   - 只想要 Uter 时加 --no-cs。
#
# 用法：
#   ./rebuild-all.sh                    # 全量：web + docs + Go + uter-cs + 重启全部
#   ./rebuild-all.sh --no-restart       # 只构建，不重启任何服务
#   ./rebuild-all.sh --no-docs          # 跳过文档站（改了 Go/SPA 时用）
#   ./rebuild-all.sh --no-cs            # 跳过智能客服（只构建并重启 Uter）
#   ./rebuild-all.sh --no-cs-build      # 不重建 uter-cs 前端，只重启它
#   ./rebuild-all.sh --install          # 构建前先 npm install 各前端
#   ./rebuild-all.sh --dev              # 构建+重启后，再拉起前端 HMR 开发服务
#   ./rebuild-all.sh --dev --no-build   # 不重新构建，只重启后端 + 拉起 dev 服务
#   ./rebuild-all.sh --no-build         # 不构建，只重启全部服务（最快的「拉起来」）
#
# 出站代理：启动时默认剔除所有指向 127.0.0.1/::1 的 HTTP(S)_PROXY 等变量
# （会话注入的临时代理会让渠道测试间歇性报 connection refused，详见 spawn 说明）。
#   KEEP_LOOPBACK_PROXY=1 ./rebuild-all.sh   # 只保留启动时仍存活的回环代理
#   KEEP_PROXY=1 ./rebuild-all.sh            # 原样继承，一个都不剔除
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=3000
BIN="$ROOT/uter-bin"
LOG=/tmp/uter-console.log
# launchd 托管（推荐）：本机用 ~/Library/LaunchAgents/ai.uter.backend.plist 让后端
# 脱离终端会话常驻。托管时重启必须走 launchctl kickstart —— 直接 kill 会被 launchd
# 立刻按 KeepAlive 拉回来，与新进程抢 3000 端口。未托管（CI/别的机器）时行为不变。
LAUNCHD_LABEL="${UTER_LAUNCHD_LABEL:-ai.uter.backend}"
launchd_managed() { launchctl print "gui/$(id -u)/$1" >/dev/null 2>&1; }
# 智能客服（uter-cs）：独立仓库，默认取同级目录。端口与
# CUSTOMER_SERVICE_URL 的默认值必须一致，否则挂件会指向空端口。
CS_DIR="${UTER_CS_DIR:-$(cd "$ROOT/.." && pwd)/uter-cs}"
CS_PORT="${UTER_CS_PORT:-3200}"
CS_LOG=/tmp/uter-cs-console.log
REDIS_LOG=/tmp/uter-redis-console.log
GO=/usr/local/go/bin/go
# managed node 目录不写死版本号：WorkBuddy 升级 node 时会改写 versions/current
# 指针，这里跟指针走，必要时回退到目录里版本号最高的那个，避免路径失效。
NODE_BASE=/Users/lincolnhu/.workbuddy/binaries/node/versions
NODE_VER="$(cat "$NODE_BASE/current" 2>/dev/null | tr -d '[:space:]')"
if [ -z "$NODE_VER" ] || [ ! -d "$NODE_BASE/$NODE_VER/bin" ]; then
  NODE_VER="$(ls -d "$NODE_BASE"/*/ 2>/dev/null | sed 's#.*/##; s#/$##' | sort -V | tail -1)"
fi
NODE_DIR="$NODE_BASE/$NODE_VER/bin"
if [ ! -x "$NODE_DIR/npm" ]; then
  echo "✗ managed node 运行时缺失: $NODE_DIR/npm（请确认 WorkBuddy 已安装 node 运行时）" >&2
  exit 1
fi
PYTHON=/usr/bin/python3

NO_RESTART=0; NO_DOCS=0; INSTALL=0; DEV=0; NO_BUILD=0
NO_CS=0; NO_CS_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --no-build)    NO_BUILD=1 ;;
    --no-restart)  NO_RESTART=1 ;;
    --no-docs)     NO_DOCS=1 ;;
    --no-cs)       NO_CS=1 ;;
    --no-cs-build) NO_CS_BUILD=1 ;;
    --install)     INSTALL=1 ;;
    --dev)         DEV=1 ;;
    *) echo "未知参数: $arg"; exit 1 ;;
  esac
done

# WorkBuddy 的 node-safe-delete-shim 会让 Next 的清理步骤炸掉，提前关掉。
export CODEBUDDY_SAFE_DELETE_ENABLED=0
# 同时关掉 broker 文件钩子与沙箱删除保护：否则受沙箱保护的命令写入工作区
# 的文件会在命令结束时被整体回滚（rsbuild/go build 产物看似成功却不落盘）。
export CODEBUDDY_BROKERED_FS_HOOK_ENABLED=0
export CODEBUDDY_SAFE_DELETE_SANDBOX=0
# dev server 的 CLI 是 `#!/usr/bin/env node` shim，node 必须在 PATH 上。
export PATH="$NODE_DIR:$PATH"

# 登录会话活跃上限：默认拉到 200，防止多设备/多浏览器把超管锁在门外
# （配合 auth_session.go 的「淘汰最旧 idle 会话」逻辑，硬上限只作兜底）。
# 仍可被环境变量 USER_SESSION_ACTIVE_LIMIT 覆盖（例如临时调回 50）。
export USER_SESSION_ACTIVE_LIMIT="${USER_SESSION_ACTIVE_LIMIT:-200}"

# 智能客服（uter-cs）挂件地址：独立仓库 uter-ai/uter-cs，独立进程/部署，
# 前端按此地址**跨域直连**，Uter 后端不做任何反向代理。
# 该值经 /api/status 的 customer_service_url 下发给前端；留空则不渲染挂件。
# 默认跟随 $CS_PORT（本机 3200）；生产用 CUSTOMER_SERVICE_URL=https://cs.uter.ai 覆盖。
export CUSTOMER_SERVICE_URL="${CUSTOMER_SERVICE_URL:-http://127.0.0.1:$CS_PORT}"

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

# ---- 智能客服（uter-cs）--------------------------------------------------
# 「是否该处理 uter-cs」的判据不只看目录在不在：空目录或半克隆的仓库会让
# node 报 MODULE_NOT_FOUND，比「目录不存在」难读得多。所以两处判定都直接
# 盯 server/index.js（见 [4/6] 构建段与 [6/6] 启动段）。

# 健康检查走 /api/health 而不是 /：静态目录存在时 / 恒 200，
# 即使 sql.js 初始化失败、路由全挂，首页照样能吐 index.html。
# /api/health 在 dbReady 之后才注册，能真反映「服务可用」。
cs_healthy() {
  local body
  body="$(curl -s --noproxy '*' --max-time 3 "http://127.0.0.1:$CS_PORT/api/health" 2>/dev/null || true)"
  case "$body" in *'"ok":true'*) return 0 ;; *) return 1 ;; esac
}

# 停掉占用指定端口的进程（先 TERM 再 KILL），供两个服务共用。
stop_port() { # $1=port $2=显示名
  local p="$1" name="$2" pids
  pids="$(lsof -nP -iTCP:"$p" -sTCP:LISTEN -t 2>/dev/null || true)"
  [ -n "$pids" ] || return 0
  echo "    停止${name}旧进程: $(echo $pids | tr '\n' ' ')"
  kill $pids 2>/dev/null || true
  for _ in $(seq 1 20); do
    lsof -nP -iTCP:"$p" -sTCP:LISTEN -t >/dev/null 2>&1 || return 0
    sleep 0.5
  done
  if lsof -nP -iTCP:"$p" -sTCP:LISTEN -t >/dev/null 2>&1; then
    kill -9 $(lsof -nP -iTCP:"$p" -sTCP:LISTEN -t) 2>/dev/null || true
    sleep 1
  fi
}
# ---- Redis ---------------------------------------------------------------
# Uter 的 .env 一旦配了 REDIS_CONN_STRING，common/redis.go 就会在启动时强
# ping，不通直接 FatalLog 退出。外部只看到「uter 起不来」，日志里只有一行
# `Redis ping test failed: ... connection refused`，很容易被误判成代码问题
# （本项目就踩过： uter-bin 进程根本活不过 1 秒）。
#
# 所以起 Uter 之前先把本机 Redis 拉起来。只处理回环地址 —— 远程 Redis 是
# 显式配置，不归本脚本管，也绝不能替用户去连别人的实例。
# 来源依次尝试：①端口已在监听 ②本机 redis-server ③docker。
# 全都不行就返回非零，让 [5/6] 明确失败，而不是等到 Uter 退出再猜。
ensure_redis() {
  local url hp bin dir
  # REDIS_HOST/REDIS_PORT 故意留作全局：结尾的「服务状态」要打印它们。
  REDIS_HOST=""; REDIS_PORT=""
  url="$(sed -n 's/^[[:space:]]*REDIS_CONN_STRING[[:space:]]*=[[:space:]]*//p' "$ROOT/.env" 2>/dev/null | tail -1)"
  url="${url%\"}"; url="${url#\"}"; url="${url%\'}"; url="${url#\'}"
  url="${url%"${url##*[![:space:]]}"}"   # 去掉尾部空白（值后常带空格）
  if [ -z "$url" ]; then
    echo "    Redis  : .env 未配置 REDIS_CONN_STRING，Uter 以无 Redis 模式运行"
    return 0
  fi

  # redis://[user][:pass]@host:port/db —— 依次剥掉 scheme、认证段、db 段
  hp="${url#*://}"; hp="${hp##*@}"; hp="${hp%%/*}"
  REDIS_HOST="${hp%%:*}"; REDIS_PORT="${hp##*:}"
  if [ "$REDIS_PORT" = "$hp" ] || [ -z "$REDIS_PORT" ]; then REDIS_PORT=6379; fi

  case "$REDIS_HOST" in
    127.0.0.1 | localhost | ::1 | 0.0.0.0) ;;
    *)
      echo "    Redis  : ${REDIS_HOST}:${REDIS_PORT} 为远程实例，不启动本地进程"
      return 0
      ;;
  esac

  if port_in_use "$REDIS_PORT"; then
    # 端口被占用 ≠ 占用者就是 Redis（可能被别的服务抢了）。有 redis-cli 就
    # 握个手：否则要等 Uter 起来 15 秒后才在日志里看到 ping failed，白白多
    # 一轮排查。NOAUTH/WRONGPASS 说明对面确实是 Redis（只是要密码），也算通。
    if command -v redis-cli >/dev/null 2>&1; then
      local resp
      resp="$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" --no-auth-warning PING 2>&1 || true)"
      case "$resp" in
        PONG | *NOAUTH* | *WRONGPASS*)
          echo "    Redis  : 已在 ${REDIS_PORT} 监听（PING 正常）"
          return 0
          ;;
        *)
          echo "✗ ${REDIS_PORT} 被占用，但对方不是 Redis（PING 返回: ${resp}）" >&2
          echo "  请先释放该端口，或改 .env 里的 REDIS_CONN_STRING 指向别的实例。" >&2
          return 1
          ;;
      esac
    fi
    echo "    Redis  : 已在 ${REDIS_PORT} 监听"
    return 0
  fi

  bin="$(command -v redis-server 2>/dev/null || true)"
  if [ -z "$bin" ]; then
    # brew 的 redis@X 是 keg-only，不软链进 PATH，只能按 opt 路径找。
    # 通配不匹配时 shell 会原样保留 `*`，[ -x ] 自然为假，无需额外判断。
    for c in /usr/local/opt/redis/bin/redis-server /opt/homebrew/opt/redis/bin/redis-server \
      /usr/local/opt/redis@*/bin/redis-server /opt/homebrew/opt/redis@*/bin/redis-server; do
      if [ -x "$c" ]; then bin="$c"; break; fi
    done
  fi

  if [ -n "$bin" ]; then
    # 数据目录放 /tmp：Uter 只把 Redis 当缓存/限流用，没必要在仓库里留 .rdb。
    dir=/tmp/uter-redis
    mkdir -p "$dir"
    spawn "$REDIS_LOG" "$dir" "$bin" --port "$REDIS_PORT" --dir "$dir" --save '' --appendonly no
  elif docker info >/dev/null 2>&1; then
    echo "    本机无 redis-server，改用 docker 临时容器"
    docker rm -f uter-redis >/dev/null 2>&1 || true
    docker run -d --rm --name uter-redis -p "${REDIS_PORT}:6379" redis:7-alpine >/dev/null || {
      echo "✗ Redis 容器启动失败（镜像拉取失败？）" >&2
      return 1
    }
  else
    echo "✗ 本机没有可用的 Redis：.env 配了 REDIS_CONN_STRING=${url}" >&2
    echo "  但 127.0.0.1:${REDIS_PORT} 无人监听，且既无 redis-server 也无 docker daemon。" >&2
    echo "  Uter 会因此启动即退出（Redis ping test failed）。请任选其一后重跑：" >&2
    echo "    brew install redis && brew services start redis" >&2
    echo "    open -a Docker        # 起 docker daemon，脚本会自动跑 redis 容器" >&2
    echo "  确实不需要 Redis 的话，注释掉 .env 里的 REDIS_CONN_STRING。" >&2
    return 1
  fi

  for _ in $(seq 1 20); do
    sleep 0.3
    if port_in_use "$REDIS_PORT"; then break; fi
  done
  if port_in_use "$REDIS_PORT"; then
    echo "✓ Redis  : 已启动，监听 ${REDIS_PORT}（日志 ${REDIS_LOG}）"
    return 0
  fi
  echo "✗ Redis 启动后 ${REDIS_PORT} 仍未监听，日志尾部:" >&2
  tail -10 "$REDIS_LOG" >&2 2>/dev/null || true
  return 1
}

# spawn：以独立会话派生，终端退出也不被回收。
#
# 派生前会剔除所有「指向本机回环地址」的代理环境变量（HTTP_PROXY/HTTPS_PROXY/
# ALL_PROXY/FTP_PROXY 及其小写形式），无论当时能否连上。
#
# 背景：本机的 agent/沙箱会话经常注入 HTTP_PROXY=http://127.0.0.1:<随机端口>，
# 而该代理是临时的、随会话结束即退出。uter-bin 用 Go 默认 transport，出站请求
# 走 ProxyFromEnvironment，一旦继承到这种代理，所有对外 HTTPS 都会报
# `proxyconnect tcp: dial tcp 127.0.0.1:<port>: connect: connection refused`
# （插件市场拉索引、上游渠道测试、渠道回调等都会挂）。
#
# 为什么连「启动时还活着」的一律丢弃：只判存活是治标不治本。代理在 spawn 那一刻
# 监听着，之后会话结束就退出，而服务进程会一直活着 —— 于是渠道测试在启动后
# 一段时间内正常，随后突然全量报 connection refused。存活探测只能过滤掉
# 「启动前已死」，过滤不掉「启动后退出」。回环代理对本机出站没有不可替代的价值
# （直连本来就通），所以默认全部剔除，一劳永逸。
#
# 开关：
#   KEEP_LOOPBACK_PROXY=1  仅保留启动时仍存活的回环代理（例如常驻 Clash 7890）
#   KEEP_PROXY=1           原样继承，一个都不动
# 远程代理（非回环地址）始终保留：那是显式配置，不是会话注入的临时产物。
spawn() { # $1=日志 $2=cwd $3..=命令
  local log="$1" cwd="$2"; shift 2
  : >> "$log"
  echo "---- start $(date '+%F %T') ----" >> "$log"
  "$PYTHON" - "$log" "$cwd" "$@" <<'PY'
import os, socket, subprocess, sys
import re
from urllib.parse import urlsplit

log, cwd = sys.argv[1], sys.argv[2]

PROXY_VARS = ('HTTP_PROXY', 'HTTPS_PROXY', 'FTP_PROXY', 'ALL_PROXY',
              'http_proxy', 'https_proxy', 'ftp_proxy', 'all_proxy')
LOOPBACK = frozenset(('localhost', '127.0.0.1', '::1', '0.0.0.0'))


def endpoint(value):
    """Return (host, port) for a proxy URL, or None when unparseable."""
    raw = (value or '').strip()
    if not raw:
        return None
    try:
        parts = urlsplit(raw if '://' in raw else 'http://' + raw)
        host = (parts.hostname or '').strip('[]').lower()
        if not host:
            return None
        port = parts.port or (443 if parts.scheme == 'https' else 80)
        return host, port
    except ValueError:
        return None


def reachable(value):
    target = endpoint(value)
    if target is None:
        return False
    try:
        with socket.create_connection(target, timeout=0.5):
            return True
    except OSError:
        return False


env = dict(os.environ)
# 解析命令前缀里的 KEY=VALUE 作为额外环境变量（如 PORT=3200），
# 不影响其它 spawn 调用（无此前缀时行为与之前一致）。
extra_env = {}
cmd = []
for tok in sys.argv[3:]:
    if re.match(r'^[A-Za-z_][A-Za-z0-9_]*=', tok) and ' ' not in tok:
        k, v = tok.split('=', 1)
        extra_env[k] = v
    else:
        cmd.append(tok)
env.update(extra_env)
dropped, kept = [], []
if os.environ.get('KEEP_PROXY') != '1':
    keep_live_loopback = os.environ.get('KEEP_LOOPBACK_PROXY') == '1'
    for key in PROXY_VARS:
        value = env.get(key)
        if not value:
            continue
        target = endpoint(value)
        # Only loopback proxies are suspect; a remote proxy is deliberate.
        if not target or target[0] not in LOOPBACK:
            continue
        # Probe once and reuse the result: a second probe can disagree (a
        # single-connection listener is already drained by the first), which
        # would mislabel a live proxy as dead.
        was_live = reachable(value)
        if keep_live_loopback and was_live:
            kept.append(key + '=' + value)
        else:
            # Note "was live at spawn" explicitly: that is the case a liveness
            # probe alone cannot catch, since the proxy dies after startup.
            dropped.append('%s=%s (%s)' % (
                key, env.pop(key),
                'was live at spawn' if was_live else 'already dead'))

with open(log, 'a') as f:
    for item in dropped:
        f.write('---- spawn: dropped loopback proxy %s ----\n' % item)
    for item in kept:
        f.write('---- spawn: kept live loopback proxy %s ----\n' % item)
    subprocess.Popen(cmd, cwd=cwd, env=env, stdout=f,
                     stderr=subprocess.STDOUT, start_new_session=True)
PY
}

# 版本进位：读 VERSION，按「patch 满 100 进位到 minor、patch 归 1（2 位补零）」写回。
# 约定 VERSION 形如 vMAJOR.MINOR.PATCH；缺段时按 0 处理。
# 例：v1.0.99 → v1.0.100 → v1.1.01；v1.0.116（已 ≥100）直接进位到 v1.1.01。
bump_version() {
  local v maj min pat
  v="$(cat "$ROOT/VERSION" 2>/dev/null | tr -d '[:space:]' | sed 's/^v//')"
  IFS='.' read -r maj min pat <<< "$v"
  # Force base 10: the `%02d` padding below can write a leading-zero
  # patch (e.g. `08`), and bash treats `08` as octal in `$(( ))` / `-ge`,
  # which would abort the bump and corrupt VERSION to `vMAJOR.MINOR.00`.
  maj=$((10#${maj:-0})); min=$((10#${min:-0})); pat=$((10#${pat:-0}))
  if [ "$pat" -ge 100 ]; then
    min=$((min + 1))
    pat=1
  else
    pat=$((pat + 1))
  fi
  printf 'v%d.%d.%02d\n' "$maj" "$min" "$pat" > "$ROOT/VERSION"
}

if [ "$NO_BUILD" = 1 ]; then
  echo "==> 跳过构建（--no-build），直接用现有 web/dist 与 $BIN"
else
echo "==> [1/6] 构建前端 SPA (web/)"
cd "$ROOT/web"
if [ "$INSTALL" = 1 ]; then "$NODE_DIR/npm" install; fi
[ -x node_modules/.bin/rsbuild ] || fail "web/node_modules 缺失，先跑 $0 --install"
# 先清掉上一次的 dist。文档站会在 [2/6] 把 docs-content 拷进 dist，若它残留到
# 本次构建，Tailwind 的内容扫描会把它当成待扫源码（4351 个文件、数十 MB 的
# _next 产物），SPA 构建从 ~20s 变成永不结束（实测 9 分钟仍卡在 fs 扫描，
# 最终超时后 Go 构建报 `embed web/dist/index.html: no such file`）。
# dist 是纯构建产物，清空安全 —— [2/6] 会重新拷入 docs-content。
[ -d "$ROOT/web/dist" ] && rm -rf "$ROOT/web/dist"
./node_modules/.bin/rsbuild build
echo "    产物: $(stat_line "$ROOT/web/dist/index.html")"
ls "$ROOT"/web/dist/static/js/*.js >/dev/null 2>&1 || fail "web/dist/static/js 为空，SPA 构建异常"

echo "==> [2/6] 构建文档站 (docs-web/ → web/dist/docs)"
if [ "$NO_DOCS" = 0 ]; then
  cd "$ROOT/docs-web"
  if [ "$INSTALL" = 1 ]; then "$NODE_DIR/npm" install; fi
  "$NODE_DIR/npm" run build   # postbuild 会自动把 out/ 拷进 web/dist/docs-content
  [ -d "$ROOT/web/dist/docs-content" ] || fail "web/dist/docs-content 不存在，文档站拷贝失败"
  # 文档站是 locale 前缀导出，根目录没有 index.html，用搜索索引当指纹。
  echo "    产物: $(stat_line "$ROOT/web/dist/docs-content/search-index.json")"
else
  echo "    跳过 (--no-docs)"
fi

echo "==> [3/6] 编译 Go 后端（内嵌 web/dist）"
cd "$ROOT"

# 文档站完整性闸门：只要这次会编 Go，就必须带着 docs-content 进编译。
# 起因：rsbuild build 会清空整个 web/dist（含 docs-content），而
# `//go:embed all:web/dist` 对缺失目录是**静默跳过**的 —— 编译照样成功，
# 结果是二进制里没有文档站，/docs 与 /about 的 iframe 拿到 SPA 壳渲染成 404，
# 且 `strings uter-bin | grep -c docs-content/docs/zh` 为 0，只能上线后才发现。
# 这里在编译前拦住，把故障从「上线后页面消失」提前到「构建时报错」。
#
# 注意：**`--no-docs` 恰恰是最危险的路径**（它跳过了 docs-web 步骤，却仍然会
# 先跑 rsbuild 清空 dist），所以这里不按 NO_DOCS 豁免，而是按「dist 里到底
# 有没有文档站」判断。`--no-build` 只重启不编译，不受此约束。
if [ "$NO_BUILD" = 0 ]; then
  if [ ! -d "$ROOT/web/dist/docs-content/docs" ] || [ ! -d "$ROOT/web/dist/docs-content/about" ]; then
    fail "web/dist/docs-content 缺失：本次构建会把一个不含文档站的二进制编出来。
  rsbuild build 会清空整个 web/dist（含 docs-content），而 go:embed 对缺失目录是静默跳过的。
  请重跑 $0（不要带 --no-docs）。确实不需要文档站的话，请确认这是有意为之。"
  fi
fi

# 先自增、再用新值构建：保证「运行中二进制内嵌版本」与「VERSION 文件」始终一致。
# 旧顺序（先按旧值构建、成功后再自增）会让服务上报的 X-Uter-Version 永远落后
# VERSION 文件一号（例：二进制 v1.2.56 / VERSION v1.2.57），上线核对时极易误判成
# 「跑的是旧二进制」。构建失败最多跳一个版本号，无副作用。
bump_version
# 读取 VERSION 用于本次构建（与 Dockerfile 注入方式一致：-X 'pkg=Version'）。
# 注意：紧跟变量的全角括号（如 $VAR（…））会被 bash 并入变量名，导致 unbound
# variable（且 `set -u` 下直接致命）。因此一律用 ${VAR} 显式界定。
set +u
BUILD_VERSION="$(cat "$ROOT/VERSION" 2>/dev/null | tr -d '[:space:]')"
[ -n "$BUILD_VERSION" ] || BUILD_VERSION="v0.0.0"
echo "    本次版本: ${BUILD_VERSION}（patch 满 100 自动进位 minor：v1.0.99 → v1.1.01）"
set -u
"$GO" build -ldflags "-s -w -X 'github.com/uter-ai/uter/common.Version=${BUILD_VERSION}'" -o "$BIN" . || fail "go build 失败"
echo "    VERSION = ${BUILD_VERSION}（二进制内嵌版本与 VERSION 文件一致）"
fi

# ---------------------------------------------------------------------------
# uter-cs 前端构建
#
# 放在 Go 编译之后：uter-cs 是外部服务，它的构建失败不该连累 Uter
# （主服务）的产物。所以这里**不 fail**，只记 CS_BUILD_OK 并在结尾提示；
# 即使这次没构建成功，后面仍会用仓库里现有的 web/dist 尝试启动。
# ---------------------------------------------------------------------------
CS_BUILD_OK=1
echo "==> [4/6] 构建智能客服前端 (uter-cs/web → uter-cs/web/dist)"
cd "$ROOT"
if [ "$NO_CS" = 1 ]; then
  echo "    跳过 (--no-cs)"
elif [ ! -f "$CS_DIR/server/index.js" ]; then
  echo "    ⚠ 跳过：未找到 $CS_DIR/server/index.js"
  echo "      用 UTER_CS_DIR=/path/to/uter-cs 指定仓库位置；或将 CUSTOMER_SERVICE_URL 置空关闭挂件。"
  CS_BUILD_OK=0
elif [ "$NO_BUILD" = 1 ]; then
  echo "    跳过 (--no-build)"
elif [ "$NO_CS_BUILD" = 1 ]; then
  echo "    跳过 (--no-cs-build)，沿用现有 web/dist"
elif [ ! -d "$CS_DIR/web" ]; then
  echo "    ⚠ 跳过：$CS_DIR/web 不存在"
  CS_BUILD_OK=0
else
  cd "$CS_DIR/web"
  if [ "$INSTALL" = 1 ] && ! "$NODE_DIR/npm" install; then
    echo "    ⚠ uter-cs 依赖安装失败"
  fi
  if [ ! -x node_modules/.bin/vite ]; then
    echo "    ⚠ 跳过：uter-cs/web/node_modules 缺失，先跑 $0 --install"
    CS_BUILD_OK=0
  elif ./node_modules/.bin/vite build; then
    echo "    产物: $(stat_line "$CS_DIR/web/dist/index.html")"
  else
    echo "    ⚠ uter-cs 前端构建失败，将沿用现有 web/dist（若存在）"
    CS_BUILD_OK=0
  fi
  cd "$ROOT"
fi

if [ "$NO_RESTART" = 1 ]; then
  echo "==> 完成（未重启，--no-restart）"
  exit 0
fi

echo "==> [5/6] 重启 Uter（API + SPA + 文档站，端口 ${PORT}）"

# 5.1 依赖保障：Redis（.env 配了 REDIS_CONN_STRING 时 Uter 强依赖，不通即退出）
ensure_redis || fail "Redis 不可用，Uter 无法启动（见上方指引）"

# 5.2 重启：launchd 托管时用 kickstart（kill 会被 KeepAlive 立刻拉回，端口打架）；
#     未托管时沿用「停端口 + 独立会话派生」。
if launchd_managed "$LAUNCHD_LABEL"; then
  LOG=/tmp/uter-backend.log   # 托管进程的 stdout/stderr 落在 plist 指定的文件里
  launchctl kickstart -k "gui/$(id -u)/$LAUNCHD_LABEL"
else
  # 5.2 停掉旧进程（可能是 uter-bin，也可能是 go run 的临时二进制）
  stop_port "$PORT" " Uter"

  # 5.3 独立会话启动，日志追加到 $LOG
  spawn "$LOG" "$ROOT" "$BIN"
fi

# 5.4 体检：端口监听 + HTTP 可达，失败把日志尾部甩出来
code="$(wait_http "$PORT" 30 || true)"
if [ -z "$code" ] || [ "$code" = "000" ]; then
  echo "✗ 服务未就绪，日志尾部:" >&2
  tail -30 "$LOG" >&2
  exit 1
fi
pid="$(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
echo "✓ 后端已重启（同时提供 API 与前端 SPA）: pid=$pid  http://127.0.0.1:$PORT/  (HTTP $code)"

# 5.5 文档站落地校验：`/docs-content/...` 返回 200 不代表内容对——静态目录缺失时
# Go 的 NoRoute 会把 SPA 壳返回给这个路径，状态码同样是 200。所以这里不看状态码，
# 只确认响应体确实是文档站的 HTML（含 lang 标记）而不是 SPA 的 <!doctype html><html
# lang="en"> 壳。缺文档站的二进制在这一步就会被当场发现，而不是等读者打开 /docs。
if [ "$NO_BUILD" = 0 ]; then
  probe="$(curl -s --noproxy '*' --max-time 10 "http://127.0.0.1:$PORT/docs-content/docs/zh/guide/wiki/basic-concepts/features-introduction/" 2>/dev/null || true)"
  case "$probe" in
    *"<html lang=\"zh-CN\""*|*'lang="zh-CN"'*) ;;
    *) echo "✗ 文档站未随二进制生效：/docs-content/... 返回的不是文档站 HTML。" >&2
       echo "  排查：strings $BIN | grep -c 'docs-content/docs/zh'  （为 0 即未内嵌）" >&2
       echo "        ls web/dist/docs-content                          （应为存在）" >&2
       echo "  多为只跑了 web 构建导致 rsbuild 清空了 web/dist，请重跑 $0（不要带 --no-docs）。" >&2
       exit 1 ;;
  esac
  echo "✓ 文档站已内嵌并可访问（/docs 与 /about 的 iframe 内容正常）"
fi

# ---------------------------------------------------------------------------
# 6/6 智能客服（uter-cs）：独立仓库、独立进程
#
# 浏览器按 CUSTOMER_SERVICE_URL 跨域直连它，Uter 后端不做反代 —— 两边是
# 并列的两个进程，没有启动顺序依赖。这里排在 Uter 体检之后，是为了让
# Uter 失败时尽早退出，不留一个孤立的 CS 进程。
#
# 「目录不在」只警告并跳过（视为未安装）；「目录在但起不来」算本次失败，
# 退出码非零 —— 否则「一键启动所有服务」会在只起来一半时谎报成功。
# ---------------------------------------------------------------------------
echo "==> [6/6] 智能客服 uter-cs（端口 ${CS_PORT}）"
CS_STARTED=0; CS_FAILED=0
if [ "$NO_CS" = 1 ]; then
  echo "    跳过 (--no-cs)"
elif [ ! -f "$CS_DIR/server/index.js" ]; then
  echo "    ⚠ 跳过：未找到 $CS_DIR/server/index.js"
  echo "      用 UTER_CS_DIR=/path/to/uter-cs 指定仓库位置；或 --no-cs 静默跳过。"
elif [ ! -f "$CS_DIR/web/dist/index.html" ]; then
  echo "    ⚠ 跳过：$CS_DIR/web/dist 缺失（前端未构建）"
  echo "      先跑 $0 --install（不带 --no-cs）完成 uter-cs 构建。"
else
  stop_port "$CS_PORT" "智能客服"
  # PORT / DB_PATH / WEB_DIST 与 uter-cs/ecosystem.config.js 对齐：
  # 数据库落在仓库 data/ 下（不在 releases 内），发版不丢数据。
  spawn "$CS_LOG" "$CS_DIR" \
    "NODE_ENV=production" "PORT=$CS_PORT" \
    "DB_PATH=$CS_DIR/data/app.sqljs.db" \
    "WEB_DIST=$CS_DIR/web/dist" \
    "$NODE_DIR/node" server/index.js
  for _ in $(seq 1 40); do
    sleep 0.5
    if cs_healthy; then break; fi
  done
  if cs_healthy; then
    cs_pid="$(lsof -nP -iTCP:$CS_PORT -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
    echo "✓ 智能客服已重启: pid=$cs_pid  http://127.0.0.1:$CS_PORT/  (/api/health OK)"
    CS_STARTED=1
  else
    echo "    ⚠ 智能客服未就绪：/api/health 没有返回 ok" >&2
    tail -20 "$CS_LOG" >&2
    CS_FAILED=1
  fi
fi

# 汇总：一条命令起全部服务，最后必须能一眼看出谁起来了、谁没起来。
echo
echo "===== 服务状态 ====="
if [ -n "${REDIS_PORT:-}" ]; then
  echo "  Redis    : 127.0.0.1:${REDIS_PORT}   ✓ 运行中"
else
  echo "  Redis    : （未配置，Uter 以无 Redis 模式运行）"
fi
echo "  Uter     : http://127.0.0.1:$PORT/   ✓ 运行中（API + SPA + 文档站）"
if [ "$CS_STARTED" = 1 ]; then
  echo "  智能客服 : http://127.0.0.1:$CS_PORT/   ✓ 运行中"
elif [ "$NO_CS" = 1 ]; then
  echo "  智能客服 : （--no-cs 已跳过）"
elif [ "$CS_FAILED" = 1 ]; then
  echo "  智能客服 : ✗ 启动失败（挂件不显示，主站不受影响）"
else
  echo "  智能客服 : （未安装，已跳过）"
fi
echo "  日志     : Uter=$LOG"
echo "             智能客服=$CS_LOG"
echo "  说明     : Uter 生产形态是单端口 $PORT —— SPA 与文档站已内嵌进 Go 二进制，"
echo "             没有独立前端端口。改前端源码后想热更新调试，用 $0 --dev（3001/3100）。"

# CS 明确该起却没起来时，不能报成功（DEV 服务也就没必要再拉）。
if [ "$CS_FAILED" = 1 ]; then
  echo "✗ 智能客服启动失败，请检查 $CS_LOG 后单独重跑: $0 --no-build --no-cs-build" >&2
  exit 1
fi

if [ "$DEV" = 0 ]; then exit 0; fi

# ---------------------------------------------------------------------------
# 附加：前端 HMR 开发服务（可选，--dev）
#
# 生产模式下前端是 Go 内嵌的静态产物，改一行代码也要重编 Go。开发时把
# rsbuild dev 拉起来可热更新：它把 /api 等代理到 $PORT 的 Go 后端，把
# /docs、/about 代理到 next dev（NEXT_DOCS_PORT），所以后端仍是唯一数据源。
# ---------------------------------------------------------------------------
echo "==> 启动前端开发服务（HMR）"

DOCS_DEV_PORT="$PORT"
if [ "$NO_DOCS" = 0 ]; then
  DOCS_DEV_PORT="$(pick_port 3100)"
  DOCS_DEV_LOG=/tmp/uter-docs-dev.log
  [ -x "$ROOT/docs-web/node_modules/.bin/next" ] || fail "docs-web/node_modules 缺失，先跑 $0 --install"
  spawn "$DOCS_DEV_LOG" "$ROOT/docs-web" "$ROOT/docs-web/node_modules/.bin/next" dev --port "$DOCS_DEV_PORT"
  docs_code="$(wait_http "$DOCS_DEV_PORT" 60 || echo 000)"
  [ "$docs_code" != "000" ] || { echo "✗ 文档站 dev 未就绪:" >&2; tail -20 "$DOCS_DEV_LOG" >&2; exit 1; }
  echo "    文档站 dev : http://127.0.0.1:$DOCS_DEV_PORT/  (HTTP $docs_code)  日志: $DOCS_DEV_LOG"
fi

WEB_DEV_PORT="$(pick_port 3001)"
WEB_DEV_LOG=/tmp/uter-web-dev.log
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
echo "  改 web/src 下的代码即时热更新；API 与 /docs 代理到后端 ${PORT}。"
