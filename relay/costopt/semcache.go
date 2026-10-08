package costopt

import (
	"context"
	"encoding/json"
	"time"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"
	"github.com/uter-ai/uter/common"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
	"github.com/go-redis/redis/v8"
)

const semVecListKey = "uter:sem_vecs"

// SemCacheEnabled 是否启用语义缓存（embedding 端点已配置且 Redis 可用）。
func SemCacheEnabled() bool {
	cfg := costoptcfg.GetCostOptSetting()
	return cfg.SemanticCacheEnabled && cfg.SemanticCacheEmbedBaseURL != "" &&
		cfg.SemanticCacheEmbedAPIKey != "" && cfg.SemanticCacheEmbedModel != "" && common.RDB != nil
}

// SemCachePrompt 取用于语义匹配的归一化提示文本（最后一条用户消息）。
func SemCachePrompt(req *dto.GeneralOpenAIRequest) string {
	for i := len(req.Messages) - 1; i >= 0; i-- {
		if req.Messages[i].Role == "user" {
			return req.Messages[i].StringContent()
		}
	}
	return ""
}

// CheckSemantic 计算提示 embedding 并在缓存中找最相近且达阈值的命中。
// 命中返回 (true, 缓存响应体)；否则 (false, nil)。
func CheckSemantic(ctx context.Context, req *dto.GeneralOpenAIRequest, info *relaycommon.RelayInfo) (bool, []byte) {
	if !SemCacheEnabled() {
		return false, nil
	}
	prompt := SemCachePrompt(req)
	if prompt == "" {
		return false, nil
	}
	cfg := costoptcfg.GetCostOptSetting()
	vecs, err := openAIEmbed(ctx, cfg.SemanticCacheEmbedBaseURL, cfg.SemanticCacheEmbedAPIKey, cfg.SemanticCacheEmbedModel, []string{prompt})
	if err != nil || len(vecs) == 0 {
		return false, nil
	}
	q := vecs[0]
	raw, err := common.RDB.Get(ctx, semVecListKey).Bytes()
	if err == redis.Nil {
		return false, nil
	} else if err != nil {
		return false, nil
	}
	var entries []semEntry
	if json.Unmarshal(raw, &entries) != nil {
		return false, nil
	}
	bestScore := float64(0)
	var best []byte
	for _, e := range entries {
		if s := cosine(q, e.Vec); s > bestScore {
			bestScore = s
			best = e.Resp
		}
	}
	if bestScore >= cfg.SemanticCacheScoreThreshold && best != nil {
		return true, best
	}
	return false, nil
}

// StoreSemantic 把本次响应按提示向量存入语义缓存。
func StoreSemantic(ctx context.Context, req *dto.GeneralOpenAIRequest, resp []byte) {
	if !SemCacheEnabled() || resp == nil {
		return
	}
	prompt := SemCachePrompt(req)
	if prompt == "" {
		return
	}
	cfg := costoptcfg.GetCostOptSetting()
	vecs, err := openAIEmbed(ctx, cfg.SemanticCacheEmbedBaseURL, cfg.SemanticCacheEmbedAPIKey, cfg.SemanticCacheEmbedModel, []string{prompt})
	if err != nil || len(vecs) == 0 {
		return
	}
	entry := semEntry{Vec: vecs[0], Resp: resp}
	raw, err := common.RDB.Get(ctx, semVecListKey).Bytes()
	var entries []semEntry
	if err == nil {
		_ = json.Unmarshal(raw, &entries)
	}
	entries = append(entries, entry)
	if len(entries) > 5000 {
		entries = entries[len(entries)-5000:]
	}
	data, err := json.Marshal(entries)
	if err != nil {
		return
	}
	ttl := cfg.SemanticCacheTTLSeconds
	if ttl <= 0 {
		ttl = 300
	}
	common.RDB.Set(ctx, semVecListKey, data, time.Duration(ttl)*time.Second)
}

type semEntry struct {
	Vec  []float32 `json:"vec"`
	Resp []byte    `json:"resp"`
}

func cosine(a, b []float32) float64 {
	if len(a) == 0 || len(b) == 0 || len(a) != len(b) {
		return 0
	}
	var dot, na, nb float64
	for i := range a {
		dot += float64(a[i]) * float64(b[i])
		na += float64(a[i]) * float64(a[i])
		nb += float64(b[i]) * float64(b[i])
	}
	if na == 0 || nb == 0 {
		return 0
	}
	return dot / (na * nb)
}
