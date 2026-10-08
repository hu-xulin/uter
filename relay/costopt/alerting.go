package costopt

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	costoptcfg "github.com/uter-ai/uter/setting/costopt"

	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/go-redis/redis/v8"
)

const spikeNamespace = "uter:spike:"

// RecordAndCheckSpike 每租户滚动 60s 窗口统计 token，超过硬阈值（SpikeAlertTokensPerMin）
// 即判定为突增/尖峰，返回 spike=true（调用方据此告警/限流）。best-effort：Redis 不可用时永远返回 false。
//
// 设计：ZSET 每个成员 score=请求时间戳（秒，便于按时间窗口裁剪），member 为 "纳秒唯一ID:本次token数"，
// 在按时间窗口取回成员后，直接从 member 解析出每次贡献的 token 并求和，避免 score 同时承载时间戳与
// 累计量导致的还原错误。
func RecordAndCheckSpike(ctx context.Context, info *relaycommon.RelayInfo, tokens int) bool {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.SpikeAlertEnabled || common.RDB == nil || info == nil || tokens <= 0 {
		return false
	}
	rdb := common.RDB
	key := spikeNamespace + strconv.Itoa(info.UserId)
	now := time.Now()
	nowSec := now.Unix()
	cutoff := nowSec - 60

	// 唯一成员 = 纳秒时间戳 + 本次 token 量，score 仅记录秒级时间戳。
	member := fmt.Sprintf("%d:%d", now.UnixNano(), tokens)

	pipe := rdb.Pipeline()
	pipe.ZAdd(ctx, key, &redis.Z{Score: float64(nowSec), Member: member})
	pipe.ZRemRangeByScore(ctx, key, "-inf", strconv.FormatInt(cutoff, 10))
	pipe.Expire(ctx, key, 2*time.Minute)
	_, _ = pipe.Exec(ctx)

	// 取回窗口内成员并解析 token 量求和
	items, err := rdb.ZRangeByScore(ctx, key, &redis.ZRangeBy{
		Min: strconv.FormatInt(cutoff, 10),
		Max: "+inf",
	}).Result()
	if err != nil {
		return false
	}
	var total int64
	for _, m := range items {
		if idx := strings.LastIndex(m, ":"); idx >= 0 {
			if amt, e := strconv.ParseInt(m[idx+1:], 10, 64); e == nil {
				total += amt
			}
		}
	}

	threshold := cfg.SpikeAlertTokensPerMin
	if threshold <= 0 {
		threshold = 200000
	}
	return float64(total) > float64(threshold)
}
