package costopt

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/uter-ai/uter/common"
	costoptcfg "github.com/uter-ai/uter/setting/costopt"

	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
	"github.com/go-redis/redis/v8"
)

const negCacheNamespace = "uter:neg_cache:"

// NegativeEnabled 是否启用负缓存（且 Redis 可用）。
func NegativeEnabled() bool {
	return costoptcfg.GetCostOptSetting().NegativeCacheEnabled && common.RDB != nil
}

// NegativeKey 计算负缓存键（与精确缓存同源：模型+消息+参数+租户）。
func NegativeKey(req *dto.GeneralOpenAIRequest, info *relaycommon.RelayInfo) string {
	return negCacheNamespace + CacheKey(req, info)[len(respCacheNamespace):]
}

// CheckNegative 命中负缓存（该请求此前已被上游确定性拒绝）返回 (true, 上游状态码)。
// 调用方应快速复用该状态码返回，不再调上游，避免重复烧钱。
func CheckNegative(ctx context.Context, key string) (bool, int) {
	rdb := common.RDB
	if rdb == nil {
		return false, 0
	}
	val, err := rdb.Get(ctx, key).Result()
	if err != nil {
		return false, 0
	}
	code, _ := strconv.Atoi(val)
	if code == 0 {
		code = http.StatusBadRequest
	}
	return true, code
}

// IsDeterministicClientError 仅对"确定性"客户端错误（4xx 且非 429 限流）做负缓存，
// 避免对瞬时故障（429 / 5xx）过度缓存。
func IsDeterministicClientError(statusCode int) bool {
	return statusCode >= 400 && statusCode < 500 && statusCode != http.StatusTooManyRequests
}

// StoreNegative 写入负标记：值为上游状态码，短 TTL（配置 NegativeCacheTTLSeconds，默认 30s）
// 后自动失效，避免对瞬时故障过度缓存。
func StoreNegative(ctx context.Context, key string, statusCode int) {
	rdb := common.RDB
	if rdb == nil {
		return
	}
	ttl := costoptcfg.GetCostOptSetting().NegativeCacheTTLSeconds
	if ttl <= 0 {
		ttl = 30
	}
	if statusCode == 0 {
		statusCode = http.StatusBadRequest
	}
	_ = rdb.Set(ctx, key, strconv.Itoa(statusCode), time.Duration(ttl)*time.Second)
}

var _ = redis.Nil // 保持 redis 依赖显式（与 cache.go 一致）
