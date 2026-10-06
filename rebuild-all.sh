#!/bin/bash
# rebuild-all.sh — 一键重建 + 发布 + 重启
#
# 覆盖所有前后端产物并重启服务，保证任何改动都生效：
#   1. web/       React SPA        → rsbuild build    （产出 web/dist）
#   2. docs-web/  Next.js 文档站   → npm run build    （postbuild 自动拷贝到 web/dist/docs）
#   3. Go 后端    //go:embed       → go build -o uter-bin .（内嵌新前端）
#      构建时通过 -ldflags -X 注入仓库根 VERSION 文件里的版本号；
#      构建成功后自动把 patch 位 +1 写回 VERSION，下次构建即递进
#      （v1.0.0 → v1.0.1 → v1.0.2 ...），首页 logo 旁即显示该版本。
#   4. 重启       杀掉旧进程后以独立会话启动 uter-bin，并做端口 + HTTP 体检
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
    subprocess.Popen(sys.argv[3:], cwd=cwd, env=env, stdout=f,
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
  "$NODE_DIR/npm" run build   # postbuild 会自动把 out/ 拷进 web/dist/docs-content
  [ -d "$ROOT/web/dist/docs-content" ] || fail "web/dist/docs-content 不存在，文档站拷贝失败"
  # 文档站是 locale 前缀导出，根目录没有 index.html，用搜索索引当指纹。
  echo "    产物: $(stat_line "$ROOT/web/dist/docs-content/search-index.json")"
else
  echo "    跳过 (--no-docs)"
fi

echo "==> [3/5] 编译 Go 后端（内嵌 web/dist）"
cd "$ROOT"

# 文档站完整性闸门：`--no-docs` 之外的任何路径都必须带着 docs-content 进 Go 编译。
# 起因：rsbuild build 会清空整个 web/dist（含 docs-content）。若有人只跑 web 构建
# （或上一次 --no-docs 之后直接编 Go），docs-content 会整个消失，而
# `//go:embed all:web/dist` 对缺失目录是**静默跳过**的 —— 编译照样成功，
# 结果是二进制里没有文档站，/docs 与 /about 的 iframe 拿到 SPA 壳渲染成 404，
# 且 `strings uter-bin | grep -c docs-content/docs/zh` 为 0，只能上线后才发现。
# 这里在编译前拦住，把故障从「上线后页面消失」提前到「构建时报错」。
if [ "$NO_DOCS" = 0 ]; then
  [ -d "$ROOT/web/dist/docs-content/docs" ] \
    || fail "web/dist/docs-content/docs 缺失：文档站没被拷进来（是否只跑了 web 构建？）。请重跑 $0（不要带 --no-docs）"
  [ -d "$ROOT/web/dist/docs-content/about" ] \
    || fail "web/dist/docs-content/about 缺失：关于页没被拷进来。请重跑 $0（不要带 --no-docs）"
fi

# 读取 VERSION 用于本次构建（与 Dockerfile 注入方式一致：-X 'pkg=Version'）。
# 构建成功后按进位规则写回：patch 满 100 进位 minor（v1.0.99 → v1.0.100 → v1.1.01 ...）。
set +u
BUILD_VERSION="$(cat "$ROOT/VERSION" 2>/dev/null | tr -d '[:space:]')"
[ -n "$BUILD_VERSION" ] || BUILD_VERSION="v0.0.0"
echo "    本次版本: $BUILD_VERSION（构建成功后将按进位规则自增：patch 满 100 进位 minor）"
set -u
"$GO" build -ldflags "-s -w -X 'github.com/Uter-AI/Uter/common.Version=$BUILD_VERSION'" -o "$BIN" . || fail "go build 失败"
bump_version
echo "    VERSION 已自增为: $(cat "$ROOT/VERSION")"
fi

if [ "$NO_RESTART" = 1 ]; then
  echo "==> 完成（未重启，--no-restart）"
  exit 0
fi

echo "==> [4/5] 重启服务 (端口 $PORT)"

# 4.1 停掉旧进程（可能是 uter-bin，也可能是 go run 的临时二进制）
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

# 4.4 文档站落地校验：`/docs-content/...` 返回 200 不代表内容对——静态目录缺失时
# Go 的 NoRoute 会把 SPA 壳返回给这个路径，状态码同样是 200。所以这里不看状态码，
# 只确认响应体确实是文档站的 HTML（含 lang 标记）而不是 SPA 的 <!doctype html><html
# lang="en"> 壳。缺文档站的二进制在这一步就会被当场发现，而不是等读者打开 /docs。
if [ "$NO_DOCS" = 0 ]; then
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

echo "  日志: $LOG"
echo "  说明: 本项目生产形态是单端口 $PORT —— SPA 与文档站已内嵌进 Go 二进制，"
echo "        没有独立前端端口。改前端源码后想热更新调试，用 $0 --dev（3001/3100）。"

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
echo "  改 web/src 下的代码即时热更新；API 与 /docs 代理到后端 $PORT。"
