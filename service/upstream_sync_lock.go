package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/uter-ai/uter/common"
)

// upstreamSyncLockTTL bounds how long a crashed instance can block scheduled
// syncs. A normal run takes seconds and releases the lock explicitly; 30
// minutes meant one killed process silently stopped price auto-updates for
// half an hour, so the fallback expiry is kept short. Upserts are idempotent,
// which makes the rare overlap after an overrun harmless.
const upstreamSyncLockTTL = 5 * time.Minute

const releaseUpstreamSyncLockScript = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
	return redis.call("DEL", KEYS[1])
end
return 0
`

// acquireUpstreamSyncLock prevents duplicate provider syncs across instances.
// Without Redis the caller's in-process mutex remains the only guard.
// AcquireUterRouteUpstreamSyncLock is the single cross-instance guard used by
// both the scheduled Uter Route task and the manual sync endpoint. The manual
// path previously relied on a process-local mutex only, so two instances could
// race on the read-modify-write audit history and lose change records.
func AcquireUterRouteUpstreamSyncLock(ctx context.Context) (func(), bool, error) {
	return acquireUpstreamSyncLock(ctx, "uterroute-upstream")
}

func acquireUpstreamSyncLock(ctx context.Context, name string) (func(), bool, error) {
	if !common.RedisEnabled || common.RDB == nil {
		return func() {}, true, nil
	}
	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		return nil, false, fmt.Errorf("generate sync lock token: %w", err)
	}
	token := hex.EncodeToString(raw)
	key := "uter:sync-lock:" + name
	acquired, err := common.RDB.SetNX(ctx, key, token, upstreamSyncLockTTL).Result()
	if err != nil {
		return nil, false, fmt.Errorf("acquire sync lock: %w", err)
	}
	if !acquired {
		return nil, false, nil
	}
	release := func() {
		_ = common.RDB.Eval(context.Background(), releaseUpstreamSyncLockScript, []string{key}, token).Err()
	}
	return release, true, nil
}
