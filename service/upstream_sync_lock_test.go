package service

import (
	"context"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

func TestAcquireUpstreamSyncLockRejectsSecondInstanceAndReleases(t *testing.T) {
	// Drain cache-sync goroutines left by earlier service tests before changing
	// the process-wide Redis configuration they may still be reading.
	model.WaitCacheSyncForTest()
	server := miniredis.RunT(t)
	previousEnabled, previousRDB := common.RedisEnabled, common.RDB
	common.RedisEnabled = true
	common.RDB = redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() {
		// Do not restore shared Redis globals while asynchronous cache syncs
		// from this test (or a future extension of it) are still in flight.
		model.WaitCacheSyncForTest()
		common.RedisEnabled = previousEnabled
		common.RDB = previousRDB
	})

	ctx := context.Background()
	release, ok, err := acquireUpstreamSyncLock(ctx, "test-provider")
	require.NoError(t, err)
	require.True(t, ok)

	secondRelease, secondOK, secondErr := acquireUpstreamSyncLock(ctx, "test-provider")
	require.NoError(t, secondErr)
	require.False(t, secondOK, "another instance must not re-enter the same sync")
	require.Nil(t, secondRelease)

	release()
	release, ok, err = acquireUpstreamSyncLock(ctx, "test-provider")
	require.NoError(t, err)
	require.True(t, ok, "released lock must be reusable")
	release()
}
