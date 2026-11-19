package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/uter-ai/uter/common"
)

const upstreamSyncLockTTL = 30 * time.Minute

const releaseUpstreamSyncLockScript = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
	return redis.call("DEL", KEYS[1])
end
return 0
`

// acquireUpstreamSyncLock prevents duplicate provider syncs across instances.
// Without Redis the caller's in-process mutex remains the only guard.
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
