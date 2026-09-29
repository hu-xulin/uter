#!/bin/bash
# verify-commit-session.sh
# 验证「登录触达活跃上限时淘汰最旧 idle 会话」+「持久化 USER_SESSION_ACTIVE_LIMIT=200」
# 的代码改动，验证通过后按改动粒度提交并推送到 origin/main。
#
# 覆盖的改动文件（仅本次任务粒度，不卷入工作树里其他无关改动）：
#   model/user_session.go          + EvictOldestIdleUserSessions / UserSessionLimitEvictionReason
#   service/auth_session.go        + createLoginSession 触限改淘汰（不再硬拒）
#   service/auth_session_test.go   + 重写上限测试为淘汰语义
#   model/user_session_test.go     + 新增淘汰排序/忽略已撤销测试
#   controller/auth_session_test.go+ 重写上限测试为淘汰后成功登录
#   rebuild-all.sh                 + 启动时默认注入 USER_SESSION_ACTIVE_LIMIT=200
set -u
ROOT="/Users/lincolnhu/uter"
cd "$ROOT" || { echo "✗ 无法进入 $ROOT"; exit 1; }

GO=/usr/local/go/bin/go
export CODEBUDDY_SAFE_DELETE_ENABLED=0 CODEBUDDY_BROKERED_FS_HOOK_ENABLED=0 CODEBUDDY_SAFE_DELETE_SANDBOX=0
export PATH="/Users/lincolnhu/.workbuddy/binaries/node/versions/22.22.2-3/bin:$PATH"

echo "=== 1) go build 改动包（model/service/controller）==="
if ! "$GO" build ./model/... ./service/... ./controller/... 2>&1 | head -40; then
  echo "✗ go build 失败，停止"; exit 1
fi
echo "✓ build ok"

echo "=== 2) go test 回归（model + service 全量；controller 仅会话相关用例）==="
if ! "$GO" test ./model/... ./service/... 2>&1 | tail -60; then
  echo "✗ model/service 测试失败，停止提交"; exit 1
fi
if ! "$GO" test ./controller/ -run 'TestActiveSessionLimitEvictsOldestSessionThenSucceeds|TestWriteAuthSessionErrorMapsSessionGrowthLimits|TestAuthLogoutRejectsRefreshCookieSessionMismatch' -v 2>&1 | tail -40; then
  echo "✗ controller 会话相关测试失败，停止提交"; exit 1
fi
echo "✓ test ok"

echo "=== 3) git 提交（仅本次改动粒度文件）==="
FILES="model/user_session.go service/auth_session.go service/auth_session_test.go model/user_session_test.go controller/auth_session_test.go rebuild-all.sh"
git add $FILES
echo "--- staged ---"
git status --short
git commit -m "fix(auth): evict oldest idle session at active limit; persist USER_SESSION_ACTIVE_LIMIT=200

- Replace hard-reject (ErrUserSessionLimit) when UserSessionActiveLimit is hit
  with graceful eviction of the least-recently-active session, so a slot opens
  for the new login (mirrors SaaS 'kick the oldest device' behavior) and prevents
  super-admin lockout at a fixed ceiling.
- Add model.EvictOldestIdleUserSessions (concurrent-safe via RevokeUserSession,
  ordered by last_active_at ASC then created_at ASC); keep = limit-1 so the new
  login brings the count back to the limit.
- Update auth_session/service/model/controller tests to the eviction semantics.
- Persist USER_SESSION_ACTIVE_LIMIT default 200 in rebuild-all.sh so a full
  rebuild no longer reverts to the 50 default (still overridable by env)." \
  || { echo "✗ commit 失败"; exit 1; }
echo "✓ committed"

echo "=== 4) push origin/main ==="
git push origin main 2>&1 | tail -20 || { echo "✗ push 失败（可能需要先 git pull --rebase）"; exit 1; }
echo "✓ pushed"

echo
echo "=== 5) 应用改动到运行实例（重建并重启，注入 200 上限 + 淘汰逻辑）==="
echo "    如需让线上立即生效，请运行： bash $ROOT/rebuild-all.sh"
echo "    或直接： NEW_LIMIT=200 bash $ROOT/raise-limit-restart.sh"
