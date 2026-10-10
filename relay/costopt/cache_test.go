package costopt

import (
	"bytes"
	"context"
	"testing"
	"time"

	"github.com/uter-ai/uter/common"
	costoptcfg "github.com/uter-ai/uter/setting/costopt"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
)

// useCostOptMiniRedis 启动内存 Redis 并替换 common.RDB，测试结束后还原。
func useCostOptMiniRedis(t *testing.T) *miniredis.Miniredis {
	t.Helper()
	prevRDB := common.RDB
	prevEnabled := common.RedisEnabled

	srv := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: srv.Addr()})
	require.NoError(t, client.Ping(context.Background()).Err())

	common.RDB = client
	common.RedisEnabled = true
	t.Cleanup(func() {
		_ = client.Close()
		common.RDB = prevRDB
		common.RedisEnabled = prevEnabled
	})
	return srv
}

// withCacheConfig 临时开启缓存并设置 TTL/MaxTokens，结束后还原。
func withCacheConfig(t *testing.T, ttl, maxTokens int) {
	t.Helper()
	cfg := costoptcfg.GetCostOptSetting()
	prev := *cfg
	cfg.ResponseCacheEnabled = true
	cfg.ResponseCacheTTLSeconds = ttl
	cfg.ResponseCacheMaxTokens = maxTokens
	t.Cleanup(func() { *cfg = prev })
}

func sampleCacheRequest() *dto.GeneralOpenAIRequest {
	stream := false
	temp := 0.7
	return &dto.GeneralOpenAIRequest{
		Model:       "gpt-4o",
		Temperature: &temp,
		Stream:      &stream,
		Messages: []dto.Message{
			{Role: "user", Content: "请解释什么是精确缓存"},
		},
	}
}

func TestCacheKey_DeterministicAndTenantIsolated(t *testing.T) {
	req := sampleCacheRequest()
	info := &relaycommon.RelayInfo{UserId: 42, UsingGroup: "default"}

	k1 := CacheKey(req, info)
	k2 := CacheKey(req, info)
	assert.Equal(t, k1, k2, "相同请求+相同用户应得到相同键")

	// 不同用户 -> 不同键（租户隔离红线）
	other := &relaycommon.RelayInfo{UserId: 43, UsingGroup: "default"}
	k3 := CacheKey(req, other)
	assert.NotEqual(t, k1, k3, "不同用户必须得到不同键，禁止跨租户复用响应")

	// 不同 temperature -> 不同键（影响输出）
	hot := *req
	hotTemp := 1.0
	hot.Temperature = &hotTemp
	k4 := CacheKey(&hot, info)
	assert.NotEqual(t, k1, k4, "不同采样参数应得到不同键")
}

func TestCacheStoreAndGet(t *testing.T) {
	useCostOptMiniRedis(t)
	ctx := context.Background()
	key := "uter:resp_cache:unit-store-get"

	// miss -> owner
	data, owner := ReserveOrGet(ctx, key)
	require.Nil(t, data)
	require.True(t, owner)

	payload := []byte(`{"id":"x","choices":[],"usage":{"prompt_tokens":1,"completion_tokens":2,"total_tokens":3}}`)
	Store(ctx, key, payload, 300)
	ReleaseOwner(key)

	// 再次请求 -> 命中
	got, owner2 := ReserveOrGet(ctx, key)
	require.False(t, owner2, "缓存命中不应是 owner")
	require.Equal(t, payload, got)
}

func TestCacheInFlightCoalescing(t *testing.T) {
	useCostOptMiniRedis(t)
	ctx := context.Background()
	key := "uter:resp_cache:unit-coalesce"

	// 第一个请求成为 owner（缓存未命中）
	data, owner := ReserveOrGet(ctx, key)
	require.Nil(t, data)
	require.True(t, owner)

	received := make(chan []byte, 1)
	go func() {
		// 并发的相同请求：应阻塞等待 owner 完成，然后拿到缓存
		d, _ := ReserveOrGet(ctx, key)
		received <- d
	}()

	// 给 goroutine 一点时间进入等待
	time.Sleep(30 * time.Millisecond)

	// owner 回写并释放
	Store(ctx, key, []byte("coalesced"), 300)
	ReleaseOwner(key)

	select {
	case v := <-received:
		require.Equal(t, []byte("coalesced"), v, "等待者应在 owner 完成后拿到缓存，避免重复打上游")
	case <-time.After(2 * time.Second):
		t.Fatal("in-flight 等待者未拿到缓存（合并失效）")
	}
}

func TestStoreIfCachable_RespectsMaxTokens(t *testing.T) {
	useCostOptMiniRedis(t)
	withCacheConfig(t, 300, 100)
	ctx := context.Background()
	key := "uter:resp_cache:unit-cap"

	// completion_tokens 超过上限 -> 不写入
	StoreIfCachable(ctx, key, bytes.NewBufferString("big response"), 200)
	_, err := common.RDB.Get(ctx, key).Bytes()
	require.Error(t, err, "超过 maxTokens 上限的响应不应被缓存")

	// completion_tokens 在限额内 -> 写入
	StoreIfCachable(ctx, key, bytes.NewBufferString("small"), 10)
	got, err := common.RDB.Get(ctx, key).Bytes()
	require.NoError(t, err)
	require.Equal(t, []byte("small"), got)
}

func TestCacheEnabled_Gate(t *testing.T) {
	useCostOptMiniRedis(t)

	// 门控之一：Redis 不可用时必须关闭，即便开关为真（否则会 panic 或静默失效）。
	withCacheConfig(t, 300, 4096)
	prevRDB := common.RDB
	common.RDB = nil
	require.False(t, CacheEnabled(), "Redis 不可用时缓存必须关闭")
	common.RDB = prevRDB
	require.True(t, CacheEnabled(), "开关开启且 Redis 可用时应为真")

	// 门控之二：开关是真实门控，显式关闭即失效（防缓存被误当成常开）。
	cfg := costoptcfg.GetCostOptSetting()
	prevEnabled := cfg.ResponseCacheEnabled
	cfg.ResponseCacheEnabled = false
	require.False(t, CacheEnabled(), "开关关闭时缓存必须关闭")
	cfg.ResponseCacheEnabled = prevEnabled
}
