#!/bin/bash
# raise-limit-restart.sh — 调高单用户活跃登录会话上限并重启 Uter 实例
#
# 会话上限由环境变量 USER_SESSION_ACTIVE_LIMIT 在启动时读取
# （common/init.go:142 positiveUserSessionEnv，默认 50）。
# 本脚本仅重启进程并注入新上限，无需重新编译（现有二进制已支持该变量）。
#
# 用法：
#   bash /Users/lincolnhu/uter/raise-limit-restart.sh
#   NEW_LIMIT=300 bash /Users/lincolnhu/uter/raise-limit-restart.sh
set -u
ROOT="/Users/lincolnhu/uter"
PORT=3000
BIN="$ROOT/uter-bin"
LOG=/tmp/uter-console.log
GO=/usr/local/go/bin/go
NEW_LIMIT="${NEW_LIMIT:-200}"

# 0) 前置：找到监听 3000 的进程
old_pids="$(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t 2>/dev/null || true)"
if [ -z "$old_pids" ]; then
  echo "⚠ 未发现监听 $PORT 的进程（实例可能未运行）。将直接尝试拉起 $BIN。"
fi

# 1) 确保二进制可用：存在则直接用；否则尝试 go build（要求 web/dist 已存在）
if [ ! -x "$BIN" ]; then
  echo "==> $BIN 不存在，尝试构建…"
  if [ ! -d "$ROOT/web/dist" ]; then
    echo "✗ web/dist 缺失，无法构建。请先跑 ./rebuild-all.sh 或手动 rsbuild。" >&2
    exit 1
  fi
  export CODEBUDDY_SAFE_DELETE_ENABLED=0 CODEBUDDY_BROKERED_FS_HOOK_ENABLED=0 CODEBUDDY_SAFE_DELETE_SANDBOX=0
  ( cd "$ROOT" && "$GO" build -ldflags "-s -w" -o "$BIN" . ) || { echo "✗ go build 失败" >&2; exit 1; }
  echo "    构建完成: $BIN"
fi

# 2) 停掉旧进程
if [ -n "$old_pids" ]; then
  echo "==> 停止旧进程: $(echo $old_pids | tr '\n' ' ')"
  kill $old_pids 2>/dev/null || true
  for _ in $(seq 1 20); do
    lsof -nP -iTCP:$PORT -sTCP:LISTEN -t >/dev/null 2>&1 || break
    sleep 0.5
  done
  if lsof -nP -iTCP:$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    kill -9 $(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t) 2>/dev/null || true
    sleep 1
  fi
fi

# 3) 以独立会话拉起，注入新的会话上限（沿用 rebuild-all.sh 的 spawn 模式）
: >> "$LOG"
echo "---- start $(date '+%F %T') [USER_SESSION_ACTIVE_LIMIT=$NEW_LIMIT] ----" >> "$LOG"
/usr/bin/python3 - "$LOG" "$ROOT" "$BIN" "$NEW_LIMIT" <<'PY'
import subprocess, sys, os
log, cwd = sys.argv[1], sys.argv[2]
new_limit = sys.argv[4]
env = dict(os.environ)
env["USER_SESSION_ACTIVE_LIMIT"] = new_limit
with open(log, 'a') as f:
    subprocess.Popen([sys.argv[3]], cwd=cwd, env=env,
                     stdout=f, stderr=subprocess.STDOUT, start_new_session=True)
PY

# 4) 体检：等端口监听 + HTTP 200
for i in $(seq 1 40); do
  sleep 0.5
  code="$(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:$PORT/" || true)"
  if [ -n "$code" ] && [ "$code" != "000" ]; then
    pid="$(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
    echo "✓ 已重启: pid=$pid  http://127.0.0.1:$PORT/  (HTTP $code)  会话上限=$NEW_LIMIT"
    echo "  日志: $LOG"
    exit 0
  fi
done
echo "✗ 服务未就绪，日志尾部:" >&2
tail -30 "$LOG" >&2
exit 1
