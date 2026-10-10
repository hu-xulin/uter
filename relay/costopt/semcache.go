package costopt

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/uter-ai/uter/common"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
	costoptcfg "github.com/uter-ai/uter/setting/costopt"
)

const semVecListKey = "uter:sem_vecs"

// semVecKey 按「模型 + 租户」分桶生成语义缓存的 Redis 键。
//
// 🔴 模型保真（安全红线）：语义缓存**绝不能跨模型复用回答**。客户用 claude-opus
// 得到的内容，绝不能返回给请求 gpt-4o 的客户——那等于用便宜模型冒充客户指定的
// 模型。因此缓存桶必须以模型名为第一维度：同名模型才可能命中。
//
// 租户（UserId）作为第二维度，遵循与精确缓存 CacheKey 相同的租户隔离原则：
// 绝不跨用户复用私有响应。
//
// 🔴 同一桶内仍存在「语义相近但不等价」的风险（例如问"A 还是 B 更好"与
// "A 还是 C 更好"可能相似度高）。因此 CheckSemantic 仍必须过相似度阈值，
// 且该阈值应配得足够高；不能因为做了模型隔离就放松阈值。
func semVecKey(model string, userID int) string {
	return fmt.Sprintf("%s:%d:%s", semVecListKey, userID, semCacheBucket(model))
}

// semCacheBucket 把模型名规整成缓存桶标识，避免大小写/别名导致的桶分裂或误合并。
func semCacheBucket(model string) string {
	m := strings.ToLower(strings.TrimSpace(model))
	if m == "" {
		// 模型缺失时归入独立桶，宁可缓存不命中，也不能把无名模型的回答
		// 到处复用。
		return "_nomodel_"
	}
	// 非 ASCII（部分厂商模型名含中文）直接用原文，避免哈希后不可读/碰撞判断困难。
	return m
}

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
	vecs, err := openAIEmbed(ctx, cfg.SemanticCacheEmbedBaseURL, cfg.SemanticCacheEmbedAPIKey, cfg.SemanticCacheEmbedModel, cfg.SemanticCacheEmbedEndpoint, []string{prompt})
	if err != nil || len(vecs) == 0 {
		return false, nil
	}
	q := vecs[0]
	// 🔑 只在「同模型 + 同租户」桶内检索（模型保真红线，见 semVecKey）。
	raw, err := common.RDB.Get(ctx, semVecKey(req.Model, info.UserId)).Bytes()
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
//
// info 提供租户与模型隔离所需的标识：写入的桶必须与 CheckSemantic 读取的桶
// 完全一致（同模型 + 同租户），否则会出现「写进A 桶、从 B 桶读」而永不命中，
// 或更糟：跨模型串味。传 nil 时退化为userID=0 的独立桶（仍按模型隔离）。
func StoreSemantic(ctx context.Context, req *dto.GeneralOpenAIRequest, resp []byte, info *relaycommon.RelayInfo) {
	if !SemCacheEnabled() || resp == nil {
		return
	}
	userID := 0
	if info != nil {
		userID = info.UserId
	}
	prompt := SemCachePrompt(req)
	if prompt == "" {
		return
	}
	// 同样在响应写回后执行，请求上下文已取消；脱离它，否则 embedding 与 Redis 全失败。
	ctx, cancel := cacheWriteCtx()
	defer cancel()
	cfg := costoptcfg.GetCostOptSetting()
	vecs, err := openAIEmbed(ctx, cfg.SemanticCacheEmbedBaseURL, cfg.SemanticCacheEmbedAPIKey, cfg.SemanticCacheEmbedModel, cfg.SemanticCacheEmbedEndpoint, []string{prompt})
	if err != nil || len(vecs) == 0 {
		return
	}
	entry := semEntry{Vec: vecs[0], Resp: resp}
	key := semVecKey(req.Model, userID)
	raw, err := common.RDB.Get(ctx, key).Bytes()
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
	common.RDB.Set(ctx, key, data, time.Duration(ttl)*time.Second)
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
