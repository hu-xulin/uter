package costopt

import (
	"context"
	"encoding/json"
	"time"

	"github.com/uter-ai/uter/common"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
	costoptcfg "github.com/uter-ai/uter/setting/costopt"
)

// WarmupCache 把配置里的预热条目写入精确缓存（启动时调用一次）。
func WarmupCache() {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.CacheWarmupEnabled || len(cfg.CacheWarmupEntries) == 0 || common.RDB == nil {
		return
	}
	ctx := context.Background()
	for _, e := range cfg.CacheWarmupEntries {
		if e.Model == "" || e.Messages == "" || e.Response == "" {
			continue
		}
		var msgs []dto.Message
		if json.Unmarshal([]byte(e.Messages), &msgs) != nil {
			continue
		}
		req := &dto.GeneralOpenAIRequest{Model: e.Model, Messages: msgs}
		key := CacheKey(req, &relaycommon.RelayInfo{UserId: 0, UsingGroup: "default", TokenGroup: "default", OriginModelName: e.Model})
		ttl := cfg.ResponseCacheTTLSeconds
		if ttl <= 0 {
			ttl = 300
		}
		common.RDB.Set(ctx, key, []byte(e.Response), time.Duration(ttl)*time.Second)
	}
}
