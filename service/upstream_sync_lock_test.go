package service

import (
	"context"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
)

func TestAcquireUpstreamSyncLockRejectsSecondInstanceAndReleases(t *testing.T) {
	server := miniredis.RunT(t)
	previousEnabled, previousRDB := common.RedisEnabled, common.RDB
	common.RedisEnabled = true
	common.RDB = redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() {
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
