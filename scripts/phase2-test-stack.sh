#!/usr/bin/env bash
# =============================================================================
# Phase 2 测试专用隔离栈（TEST-ONLY，绝不改动生产配置 / DB / 进程）
# -----------------------------------------------------------------------------
# 背景：VISUAL-REGRESSION.json 的 3 个失败全部来自 loginViaApi 报
#   "HTTP 200 Password login has been disabled by administrator"。
# 生产栈 :3000 的运营配置 PasswordLoginEnabled=false，审计红线禁止修改生产
# 鉴权策略。正确做法是「测试专用隔离栈」：
#   - 把 one-api.db / -wal / -shm 复制（cp，绝不 move/删除原件）到 TMPDIR 隔离目录；
#   - 仅在【副本】上把 PasswordLoginEnabled 置 true，RegisterEnabled 保持 false；
#   - 独立 Redis 6380（已监听则复用，绝不杀用户 6379）；
#   - 独立 Go 二进制 + 后端端口 3100（SQLITE_PATH 指向副本）；
#   - 独立 rsbuild dev server 3101，/api 反代到 3100；
#   - 所有 PID 记录在隔离目录的 pidfile，stop 只杀这些 PID 及其后代。
#
# 这条测试鉴权「永远不会进入生产构建」：后端源码零改动，只是给测试进程注入
# 环境变量 + 指向一个 DB 副本。生产 :3000 用的仍是原 one-api.db 与原配置。
#
# 用法： scripts/phase2-test-stack.sh start|stop|status
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
ISOLATED_DIR="${UTER_PHASE2_DIR:-${TMPDIR:-/tmp}/uter-phase2}"

# 固定专用端口：与生产/用户进程 3000 / 3001 / 3003 / 3200 / 6379 完全分开。
BACKEND_PORT=3100
FRONTEND_PORT=3101
REDIS_PORT=6380
BACKEND_ORIGIN="http://localhost:${BACKEND_PORT}"
TEST_FRONTEND_URL="${TEST_FRONTEND_URL:-http://localhost:${FRONTEND_PORT}}"
export TEST_FRONTEND_URL

LIVE_DB="${REPO_ROOT}/one-api.db"
ISOLATED_DB="${ISOLATED_DIR}/one-api.db"
BINARY="${ISOLATED_DIR}/uter-e2e-bin"
PIDFILE="${ISOLATED_DIR}/phase2-test-stack.pids"
ENVFILE="${ISOLATED_DIR}/env.sh"
BACKEND_LOG="${ISOLATED_DIR}/backend-${BACKEND_PORT}.log"
FRONTEND_LOG="${ISOLATED_DIR}/frontend-${FRONTEND_PORT}.log"
REDIS_LOG="${ISOLATED_DIR}/redis-${REDIS_PORT}.log"

abspath() {
  if command -v realpath >/dev/null 2>&1; then
    realpath "$1" 2>/dev/null || printf '%s\n' "$1"
  else
    ( cd "$(dirname "$1")" 2>/dev/null && printf '%s/%s\n' "$(pwd -P)" "$(basename "$1")" ) \
      || printf '%s\n' "$1"
  fi
}

port_listening() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

# ---------------------------------------------------------------------------
# 安全护栏：任何可能碰到生产库 / 生产端口的情形都拒绝执行。
# ---------------------------------------------------------------------------
guard_production() {
  # 1) 隔离目录必须位于仓库之外，避免把副本误当成生产文件操作。
  case "${ISOLATED_DIR}" in
    "${REPO_ROOT}"|"${REPO_ROOT}"/*)
      echo "拒绝执行：隔离目录 ${ISOLATED_DIR} 位于仓库内，可能与生产文件混淆。" >&2
      echo "请通过 UTER_PHASE2_DIR 指定 TMPDIR 下的目录。" >&2
      exit 2
      ;;
  esac

  # 2) 本脚本给子进程用的 SQLITE_PATH 绝不能就是生产库。
  local live_abs iso_abs
  live_abs="$(abspath "${LIVE_DB}")"
  iso_abs="$(abspath "${ISOLATED_DB}")"
  if [ "${iso_abs}" = "${live_abs}" ]; then
    echo "拒绝执行：SQLITE_PATH 会指向生产库 ${live_abs}。" >&2
    exit 2
  fi

  # 3) 调用方若显式导出 SQLITE_PATH 指向生产库，拒绝（防止环境变量串味）。
  if [ -n "${SQLITE_PATH:-}" ]; then
    local caller_db
    caller_db="$(abspath "${SQLITE_PATH}")"
    if [ "${caller_db}" = "${live_abs}" ]; then
      echo "拒绝执行：检测到 SQLITE_PATH=${SQLITE_PATH} 指向生产库。" >&2
      echo "请 unset SQLITE_PATH 后重试；隔离栈只使用副本。" >&2
      exit 2
    fi
  fi

  # 4) 调用方若显式导出 PORT 指向生产/用户端口，拒绝。
  case "${PORT:-}" in
    3000|3001|3003|3200)
      echo "拒绝执行：检测到 PORT=${PORT} 为生产/用户进程端口。" >&2
      echo "隔离栈后端固定使用 ${BACKEND_PORT}，请 unset PORT 后重试。" >&2
      exit 2
      ;;
  esac

  # 5) 前置文件检查：生产库必须存在（只读复制，绝不改动）。
  if [ ! -f "${LIVE_DB}" ]; then
    echo "拒绝执行：找不到生产库 ${LIVE_DB}（只读复制源）。" >&2
    exit 2
  fi
  if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "拒绝执行：缺少 sqlite3。" >&2
    exit 2
  fi
  if ! command -v go >/dev/null 2>&1; then
    echo "拒绝执行：缺少 go。" >&2
    exit 2
  fi
}

record_pid() {
  # pidfile 行格式： label:pid
  printf '%s:%s\n' "$1" "$2" >> "${PIDFILE}"
}

read_pidfile() {
  [ -f "${PIDFILE}" ] || return 0
  # 只接受合法行，忽略注释/空行。
  grep -E '^[a-z]+:[0-9]+$' "${PIDFILE}" 2>/dev/null || true
}

any_alive() {
  local line pid
  while IFS= read -r line; do
    [ -n "${line}" ] || continue
    pid="${line##*:}"
    if kill -0 "${pid}" 2>/dev/null; then return 0; fi
  done <<EOF
$(read_pidfile)
EOF
  return 1
}

# 仅杀掉「本脚本启动的 PID」及其后代；绝不按端口名批量杀（避免误伤 6379/3000 等）。
kill_tree() {
  local pid="$1" child
  for child in $(pgrep -P "${pid}" 2>/dev/null || true); do
    kill_tree "${child}"
  done
  kill -TERM "${pid}" 2>/dev/null || true
}

# 杀之前复核进程命令行特征，防止 PID 被复用后误杀用户进程。
safe_kill() {
  local label="$1" pid="$2" cmd
  cmd="$(ps -p "${pid}" -o command= 2>/dev/null || true)"
  [ -n "${cmd}" ] || return 0
  case "${label}" in
    backend)
      case "${cmd}" in *uter-e2e-bin*) ;; *) echo "  skip ${label}:${pid}（命令行不匹配，非本栈进程）"; return 0 ;; esac ;;
    frontend)
      case "${cmd}" in *rsbuild*|*@rsbuild*) ;; *) echo "  skip ${label}:${pid}（命令行不匹配，非本栈进程）"; return 0 ;; esac ;;
    redis)
      case "${cmd}" in *redis-server*6380*) ;; *) echo "  skip ${label}:${pid}（命令行不匹配，非本栈进程）"; return 0 ;; esac ;;
  esac
  echo "  kill ${label}:${pid}"
  kill_tree "${pid}"
}

wait_for_port() {
  local port="$1" label="$2" i
  for i in $(seq 1 90); do
    if port_listening "${port}"; then return 0; fi
    sleep 1
  done
  echo "错误：${label} 端口 ${port} 在 90s 内未监听。" >&2
  return 1
}

do_start() {
  guard_production

  mkdir -p "${ISOLATED_DIR}"
  : > "${PIDFILE}"

  if any_alive; then
    echo "隔离栈已在运行（pidfile 中仍有存活进程），不重复启动。"
    do_status
    return 0
  fi

  # 端口被「不在 pidfile 里的」进程占用时，下面新起的后端/前端会因端口占用
  # 立即退出（rsbuild 还带 --strict-port），但 wait_for_port 会被那个旧进程
  # 骗过并立刻返回成功 —— 于是脚本打印「已就绪」，实际却没有任何一个新进程
  # 在跑。实测过：编排器 isolated_stack_start exit=0 / frontend=null，随后
  # 所有浏览器验证都打在上一轮的孤儿栈上。这里 fail-closed，拒绝静默复用。
  for p in "${BACKEND_PORT}" "${FRONTEND_PORT}"; do
    if port_listening "${p}"; then
      echo "错误：端口 ${p} 已被占用，但 pidfile 中没有存活的本栈进程（疑似上次遗留的孤儿栈）。" >&2
      echo "请先执行 '$0 stop' 或清理该端口上的隔离栈进程，再重试。" >&2
      lsof -nP -iTCP:"${p}" -sTCP:LISTEN >&2 || true
      exit 4
    fi
  done

  echo "=== [1/6] 复制生产库到隔离目录（cp，原件不动）==="
  # 先清掉上一次运行遗留的副本 WAL/SHM，避免陈旧 WAL 干扰副本恢复。
  rm -f "${ISOLATED_DIR}/one-api.db-wal" "${ISOLATED_DIR}/one-api.db-shm"
  for suffix in "" "-wal" "-shm"; do
    local src="${LIVE_DB}${suffix}"
    if [ -f "${src}" ]; then
      cp "${src}" "${ISOLATED_DIR}/one-api.db${suffix}"
      echo "  cp ${src} -> ${ISOLATED_DIR}/one-api.db${suffix}"
    fi
  done

  echo "=== [2/6] 仅在【副本】上开启密码登录，注册保持关闭 ==="
  # UPDATE 只作用于 ISOLATED_DB（副本）。生产库 one-api.db 全程只读，从未被写。
  sqlite3 "${ISOLATED_DB}" \
    "UPDATE options SET value='true'  WHERE key='PasswordLoginEnabled';
     UPDATE options SET value='false' WHERE key='RegisterEnabled';
     PRAGMA wal_checkpoint(TRUNCATE);" >/dev/null
  # 把副本的 WAL 合并后清掉，保证副本自洽（只删副本文件）。
  rm -f "${ISOLATED_DIR}/one-api.db-wal" "${ISOLATED_DIR}/one-api.db-shm"

  local pw reg
  pw="$(sqlite3 "${ISOLATED_DB}" "SELECT value FROM options WHERE key='PasswordLoginEnabled';")"
  reg="$(sqlite3 "${ISOLATED_DB}" "SELECT value FROM options WHERE key='RegisterEnabled';")"
  echo "  副本 PasswordLoginEnabled=${pw:-<缺失>}  RegisterEnabled=${reg:-<缺失>}"
  if [ "${pw}" != "true" ]; then
    echo "错误：副本未能开启密码登录（options 表缺少该键？）。" >&2
    exit 3
  fi
  if [ "${reg}" != "false" ]; then
    echo "错误：副本 RegisterEnabled 不是 false，红线要求注册必须保持关闭。" >&2
    exit 3
  fi

  echo "=== [3/6] 独立 Redis :${REDIS_PORT}（已监听则复用，绝不碰 6379）==="
  if port_listening "${REDIS_PORT}"; then
    echo "  :${REDIS_PORT} 已在监听，复用现有实例（不记录 PID，stop 不会杀它）。"
  else
    if ! command -v redis-server >/dev/null 2>&1; then
      echo "错误：缺少 redis-server，且 :${REDIS_PORT} 未监听。" >&2
      exit 3
    fi
    redis-server --port "${REDIS_PORT}" --save '' --appendonly no \
      --dir "${ISOLATED_DIR}" > "${REDIS_LOG}" 2>&1 &
    local redis_pid=$!
    record_pid redis "${redis_pid}"
    echo "  已启动 redis :${REDIS_PORT} (pid=${redis_pid})"
  fi

  echo "=== [4/6] 构建隔离 Go 二进制（需要 web/dist）==="
  # main.go 有 //go:embed web/dist；缺目录时 go build 必失败。这里显式给出
  # 可操作的错误，绝不创建一个假的 web/dist 来蒙混编译。
  if [ ! -f "${REPO_ROOT}/web/dist/index.html" ]; then
    echo "错误：缺少 ${REPO_ROOT}/web/dist（//go:embed web/dist 需要它）。" >&2
    echo "请先在真实前端构建产物就绪后再启动隔离栈，例如：" >&2
    echo "  cd ${REPO_ROOT}/web && bun run build" >&2
    echo "本脚本不会创建伪造的 web/dist，也不会改动任何生产配置。" >&2
    exit 3
  fi
  ( cd "${REPO_ROOT}" && GOWORK=off go build -o "${BINARY}" . )
  echo "  go build -> ${BINARY}"

  echo "=== [5/6] 启动隔离后端 :${BACKEND_PORT} ==="
  # 进程 CWD 必须是仓库根（读取 .env 的 SESSION_SECRET）。
  # 以下环境变量只作用于这个测试进程，生产 :3000 进程完全不受影响。
  #
  # CORS_ALLOWED_ORIGINS 必须补上隔离前端的 origin：middleware/cors.go 的
  # AllowOriginFunc 只放行 .env 里配置的精确 origin，仓库 .env 默认只写了
  # http://localhost:3001。浏览器从 :3101 提交登录表单会带 Origin:
  # http://localhost:3101，被 CORS 中间件以 403 空 body 直接拒绝（实测：
  # 带该 Origin 的 POST /api/user/login 403，不带 Origin 或带 :3001 均 200）。
  # 结果就是 biz_23 的表单登录兜底永远失败、dashboard 永远停在 sign-in。
  # 这里在原值基础上追加隔离 origin，不删除任何既有放行来源。
  local base_cors="${CORS_ALLOWED_ORIGINS:-}"
  if [ -z "${base_cors}" ] && [ -f "${REPO_ROOT}/.env" ]; then
    base_cors="$(grep -E '^CORS_ALLOWED_ORIGINS=' "${REPO_ROOT}/.env" | head -1 | cut -d= -f2- || true)"
  fi
  case ",${base_cors}," in
    *",${TEST_FRONTEND_URL},"*) isolated_cors="${base_cors}" ;;
    *) isolated_cors="${base_cors:+${base_cors},}${TEST_FRONTEND_URL}" ;;
  esac
  echo "  CORS_ALLOWED_ORIGINS=${isolated_cors}"
  # 必须用 exec：普通 `( ...; cmd ) &` 记下的是 bash 子 shell 的 PID，
  # 真正监听端口的是它的子进程。do_stop 的 safe_kill 会按命令行特征
  # （*uter-e2e-bin*）复核，bash 子 shell 不匹配 → 直接 skip，孤儿栈永远
  # 清不掉，下一次 start 的 wait_for_port 又被旧进程骗过（假成功）。
  # exec 让 $! 就是二进制进程本身，PID 与命令行特征一致。
  (
    cd "${REPO_ROOT}"
    exec env \
      PORT="${BACKEND_PORT}" \
      SQLITE_PATH="${ISOLATED_DB}" \
      REDIS_CONN_STRING="redis://127.0.0.1:${REDIS_PORT}/0" \
      CORS_ALLOWED_ORIGINS="${isolated_cors}" \
      "${BINARY}" > "${BACKEND_LOG}" 2>&1
  ) &
  local backend_pid=$!
  record_pid backend "${backend_pid}"
  echo "  backend pid=${backend_pid}, log=${BACKEND_LOG}"

  echo "=== [6/6] 启动隔离前端 dev server :${FRONTEND_PORT} ==="
  if [ ! -x "${REPO_ROOT}/web/node_modules/.bin/rsbuild" ]; then
    echo "错误：缺少 web/node_modules/.bin/rsbuild，请先安装前端依赖。" >&2
    exit 3
  fi
  (
    cd "${REPO_ROOT}/web"
    exec env VITE_REACT_APP_SERVER_URL="${BACKEND_ORIGIN}" \
      ./node_modules/.bin/rsbuild dev --port "${FRONTEND_PORT}" --strict-port \
      > "${FRONTEND_LOG}" 2>&1
  ) &
  local frontend_pid=$!
  record_pid frontend "${frontend_pid}"
  echo "  frontend pid=${frontend_pid}, log=${FRONTEND_LOG}"

  if ! wait_for_port "${BACKEND_PORT}" "隔离后端"; then
    echo "--- backend log (tail) ---" >&2; tail -n 30 "${BACKEND_LOG}" >&2 || true
    exit 4
  fi
  if ! wait_for_port "${FRONTEND_PORT}" "隔离前端"; then
    echo "--- frontend log (tail) ---" >&2; tail -n 30 "${FRONTEND_LOG}" >&2 || true
    exit 4
  fi

  # 供使用者 source 的环境片段（TEST_FRONTEND_URL 等）。
  cat > "${ENVFILE}" <<EOF
export TEST_FRONTEND_URL='${TEST_FRONTEND_URL}'
export VISUAL_BASE_URL='${TEST_FRONTEND_URL}'
export BUSINESS_BASE_URL='${TEST_FRONTEND_URL}'
export AXE_BASE_URL='${TEST_FRONTEND_URL}'
export UTER_TEST_STACK='isolated'
# UAP 运行器读取的是 UAP_TEST_STACK（见 .uap/bin/uap.mjs 的
# testAuthIsolated 判定）。只写 UTER_TEST_STACK 会让隔离性判定落回
# 「靠 VISUAL_BASE_URL 猜测」，属于环境契约不一致；两个名字都写入。
export UAP_TEST_STACK='isolated'
EOF

  echo ""
  echo "===================== TEST-ONLY 隔离栈已就绪 ====================="
  echo "  隔离前端 (visual/axe/business 用) : ${TEST_FRONTEND_URL}"
  echo "  隔离后端 (直接 API 用)            : ${BACKEND_ORIGIN}"
  echo "  隔离 Redis                        : 127.0.0.1:${REDIS_PORT}"
  echo "  隔离 DB 副本                      : ${ISOLATED_DB}"
  echo "  后端日志                          : ${BACKEND_LOG}"
  echo "  前端日志                          : ${FRONTEND_LOG}"
  echo "  PID 记录                          : ${PIDFILE}"
  echo "  环境片段（可 source）             : ${ENVFILE}"
  echo ""
  echo "  运行测试（从 web/ 目录）："
  echo "    source '${ENVFILE}'"
  echo "    npx playwright test --config e2e/visual/playwright.config.ts"
  echo "    npx playwright test --config e2e/business/playwright.config.ts"
  echo ""
  echo "  ⚠ 这是【测试专用】隔离栈："
  echo "    · 生产库 one-api.db 全程只读复制，从未被修改；"
  echo "    · PasswordLoginEnabled=true 只存在于 /tmp 副本，后端源码零改动；"
  echo "    · 该测试鉴权永远不会进入任何生产构建（纯环境变量 + DB 副本）；"
  echo "    · 生产/用户进程 3000 / 3001 / 3003 / 3200 / 6379 未被触碰。"
  echo "  ⚠ 停止请执行： $0 stop （只杀本栈 PID，绝不批量杀端口）"
  echo "=================================================================="
}

do_stop() {
  if [ ! -f "${PIDFILE}" ]; then
    echo "没有 pidfile（${PIDFILE}），无需停止。"
    return 0
  fi
  echo "=== 停止隔离栈（仅杀 pidfile 中记录的 PID 及其后代）==="
  local line label pid
  while IFS= read -r line; do
    [ -n "${line}" ] || continue
    label="${line%%:*}"
    pid="${line##*:}"
    safe_kill "${label}" "${pid}"
  done <<EOF
$(read_pidfile)
EOF
  rm -f "${PIDFILE}"
  echo "已移除 pidfile。"
  echo "  ⚠ 未触碰任何未记录在 pidfile 的进程：3000 / 3001 / 3003 / 3200 / 6379 保持原状。"
  echo "  ⚠ 隔离 Redis :${REDIS_PORT} 若为本脚本启动则已停止；若为预先存在的实例则从未记录、从未被杀。"
}

do_status() {
  echo "=== 隔离栈状态 ==="
  echo "  TEST_FRONTEND_URL : ${TEST_FRONTEND_URL}"
  echo "  BACKEND_ORIGIN    : ${BACKEND_ORIGIN}"
  echo "  ISOLATED_DB       : ${ISOLATED_DB}"
  if [ -f "${ISOLATED_DB}" ]; then
    echo "  副本 PasswordLoginEnabled : $(sqlite3 "${ISOLATED_DB}" "SELECT value FROM options WHERE key='PasswordLoginEnabled';" 2>/dev/null || echo '<读取失败>')"
    echo "  副本 RegisterEnabled      : $(sqlite3 "${ISOLATED_DB}" "SELECT value FROM options WHERE key='RegisterEnabled';" 2>/dev/null || echo '<读取失败>')"
  else
    echo "  副本 DB : 不存在（尚未 start）"
  fi
  local port label
  for pair in "${BACKEND_PORT}:隔离后端" "${FRONTEND_PORT}:隔离前端" "${REDIS_PORT}:隔离Redis"; do
    port="${pair%%:*}"; label="${pair##*:}"
    if port_listening "${port}"; then echo "  :${port} ${label} : LISTENING"; else echo "  :${port} ${label} : down"; fi
  done
  if [ -f "${PIDFILE}" ]; then
    echo "  pidfile 内容："
    while IFS= read -r line; do [ -n "${line}" ] && echo "    ${line}"; done <<EOF
$(read_pidfile)
EOF
  else
    echo "  pidfile : 无"
  fi
  echo "  生产/用户端口 3000 / 3001 / 3003 / 3200 / 6379 由用户自行管理，本脚本从不触碰。"
}

case "${1:-}" in
  start)  do_start ;;
  stop)   do_stop ;;
  status) do_status ;;
  *)
    echo "用法: $0 start|stop|status" >&2
    echo "  start  复制 DB 副本 → 副本开启密码登录 → 独立 Redis/后端/前端" >&2
    echo "  stop   仅杀 pidfile 记录的 PID 及其后代" >&2
    echo "  status 打印端口 / 副本配置 / pidfile 状态" >&2
    exit 1
    ;;
esac
