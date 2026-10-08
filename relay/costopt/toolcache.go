package costopt

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"time"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"
	"github.com/uter-ai/uter/common"
	"github.com/go-redis/redis/v8"
)

// ToolResultCacheEnabled 是否启用工具/检索结果缓存（Redis 可用）。
func ToolResultCacheEnabled() bool {
	cfg := costoptcfg.GetCostOptSetting()
	return cfg.ToolResultCacheEnabled && common.RDB != nil
}

// ToolResultKey 计算工具/检索结果的缓存键（工具名+参数）。
func ToolResultKey(toolName, args string) string {
	h := sha256.Sum256([]byte(toolName + "|" + args))
	return "uter:toolres:" + hex.EncodeToString(h[:])
}

// GetToolResult 命中返回缓存结果（已 JSON 编码的 tool 消息内容）。
func GetToolResult(ctx context.Context, key string) ([]byte, bool) {
	if !ToolResultCacheEnabled() {
		return nil, false
	}
	raw, err := common.RDB.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return nil, false
	} else if err != nil {
		return nil, false
	}
	return raw, true
}

// SetToolResult 写入工具/检索结果缓存。Agent 框架在工具执行后应调用本函数。
func SetToolResult(ctx context.Context, key string, val []byte) {
	cfg := costoptcfg.GetCostOptSetting()
	if !ToolResultCacheEnabled() || val == nil {
		return
	}
	ttl := cfg.ToolResultCacheTTLSeconds
	if ttl <= 0 {
		ttl = 600
	}
	common.RDB.Set(ctx, key, val, time.Duration(ttl)*time.Second)
}
