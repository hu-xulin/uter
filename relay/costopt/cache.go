// Package costopt 实现 Uter 网关层"降本中间层"：精确响应缓存（含租户隔离 +
// in-flight 合并）、零调用短路规则层、max_tokens 成本硬上限。
//
// 设计原则（与《中转站API降本技术清单_轻资产版》对齐）：
//   - 纯软件、无重资产；复用现有 common.RDB（go-redis）与 ModelRatio/GroupRatio 价格体系。
//   - 缓存命中仍按缓存用量计费，保证收入与配额不漏扣。
//   - 缓存键含 UserId（租户隔离），绝不跨用户复用私有响应（安全红线）。
package costopt

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/uter-ai/uter/common"
	costoptcfg "github.com/uter-ai/uter/setting/costopt"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
	"github.com/uter-ai/uter/relaykit/types"
	"github.com/uter-ai/uter/service"
	"github.com/uter-ai/uter/setting/ratio_setting"
)

const respCacheNamespace = "uter:resp_cache:"

type inflightCall struct {
	done chan struct{}
}

// inflight 记录正在计算同一缓存键的请求，用于 in-flight 合并（singleflight），
// 避免并发相同请求重复打到上游。
var inflight sync.Map // key -> *inflightCall

// CacheEnabled 是否启用精确缓存（且 Redis 可用）。
func CacheEnabled() bool {
	return costoptcfg.GetCostOptSetting().ResponseCacheEnabled && common.RDB != nil
}

// CacheKey 计算精确缓存键。键包含：模型、消息、temperature/top_p/max_tokens/n/
// stop/stream/penalty 等影响输出的参数；以及 UserId 实现租户隔离。
//
// 结果按请求对象 memoize 到 relayInfo：负缓存键与精确缓存键同源，一次请求里本来
// 要序列化两遍整个 Messages（400KB payload 约 2-5ms + 等大的临时分配）。
func CacheKey(req *dto.GeneralOpenAIRequest, info *relaycommon.RelayInfo) string {
	if key, ok := info.LoadCostOptCacheKey(req); ok {
		return key
	}
	key := computeCacheKey(req, info)
	info.StoreCostOptCacheKey(req, key)
	return key
}

func computeCacheKey(req *dto.GeneralOpenAIRequest, info *relaycommon.RelayInfo) string {
	norm := map[string]any{
		"model":             req.Model,
		"messages":          req.Messages,
		"temperature":       derefFloat(req.Temperature),
		"top_p":             derefFloat(req.TopP),
		"max_tokens":        derefUint(req.MaxTokens),
		"n":                 derefInt(req.N),
		"stop":              req.Stop,
		"stream":            req.Stream != nil && *req.Stream,
		"presence_penalty":  derefFloat(req.PresencePenalty),
		"frequency_penalty": derefFloat(req.FrequencyPenalty),
		// 租户隔离：绝不跨用户复用响应（安全红线）
		"tenant_user_id": info.UserId,
	}
	b, _ := json.Marshal(norm)
	sum := sha256.Sum256(b)
	return respCacheNamespace + hex.EncodeToString(sum[:])
}

func derefFloat(p *float64) float64 {
	if p == nil {
		return 0
	}
	return *p
}

func derefUint(p *uint) uint {
	if p == nil {
		return 0
	}
	return *p
}

func derefInt(p *int) int {
	if p == nil {
		return 0
	}
	return *p
}

// ReserveOrGet 精确缓存读取 + in-flight 合并。
//
// 返回 (data, isOwner)：
//   - data != nil            -> 命中缓存（可能立即命中，也可能等待他人计算后命中），调用方直接返回 data 即可。
//   - data == nil && isOwner -> 本请求成为 owner，必须执行上游；成功后 Store，最后 ReleaseOwner。
//   - data == nil && !isOwner -> 本请求为等待者且 owner 失败；调用方应再次调用本函数（重试，可能成为 owner）。
func ReserveOrGet(ctx context.Context, key string) (data []byte, isOwner bool) {
	rdb := common.RDB
	if rdb == nil {
		return nil, true
	}
	val, err := rdb.Get(ctx, key).Bytes()
	if err == nil {
		return val, false
	}
	if err != redis.Nil {
		// Redis 故障：退化为直接走上游，不阻塞请求。
		return nil, true
	}
	call := &inflightCall{done: make(chan struct{})}
	actual, loaded := inflight.LoadOrStore(key, call)
	if loaded {
		// 已有 owner 在计算，等待其完成。
		<-actual.(*inflightCall).done
		val, err := rdb.Get(ctx, key).Bytes()
		if err == nil {
			return val, false
		}
		// owner 失败：返回 (nil,false)，调用方重试（下一轮 LoadOrStore 将无人占有 -> 成为 owner）。
		return nil, false
	}
	return nil, true
}

// ReleaseOwner 释放 in-flight 占有权（owner 在 Store 之后、或任何失败路径上调用）。
func ReleaseOwner(key string) {
	if v, ok := inflight.LoadAndDelete(key); ok {
		close(v.(*inflightCall).done)
	}
}

// cacheWriteCtx 返回一个脱离请求生命周期的短超时上下文，专用于 fire-and-forget 的缓存回写。
//
// 为什么必须脱离：这些回写发生在 DoResponse 把响应写回客户端之后，此时
// c.Request.Context() 已被取消（Go 在响应写完后即 cancel 请求上下文）。若沿用入参 ctx，
// rdb.Set 会以 "context canceled" 失败，而错误又被 `_ =` 丢弃，导致精确/语义/负缓存
// 永不落盘（现象：配置全开、Redis 正常，却永远没有 uter:resp_cache:* 键）。
// 读路径（ReserveOrGet/CheckNegative）仍用请求上下文——客户端断开时应当 promptly 中断读。
func cacheWriteCtx() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 3*time.Second)
}

// Store 写入缓存（仅成功响应、且仅非流式）。
func Store(ctx context.Context, key string, data []byte, ttlSeconds int) {
	rdb := common.RDB
	if rdb == nil {
		return
	}
	if ttlSeconds <= 0 {
		ttlSeconds = 300
	}
	wctx, cancel := cacheWriteCtx()
	defer cancel()
	_ = rdb.Set(wctx, key, data, time.Duration(ttlSeconds)*time.Second)
}

// StoreIfCachable 回写缓存：仅当缓存启用、buf 非空、且 completionTokens 未超上限时写入。
// 由 owner 在成功计费后调用。completion_tokens 过大的响应不值得缓存（占内存、命中率低）。
func StoreIfCachable(ctx context.Context, key string, buf *bytes.Buffer, completionTokens int) {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.ResponseCacheEnabled || buf == nil || buf.Len() == 0 {
		return
	}
	if completionTokens > cfg.ResponseCacheMaxTokens {
		return
	}
	Store(ctx, key, buf.Bytes(), cfg.ResponseCacheTTLSeconds)
}

// CaptureBody 包裹非流式上游响应体，使其在被 DoResponse 读取的同时复制到 buf，
// 供回写缓存使用。返回原 body（已替换为 tee reader）与收集缓冲。
func CaptureBody(httpResp *http.Response) (orig io.ReadCloser, buf *bytes.Buffer) {
	buf = &bytes.Buffer{}
	httpResp.Body = io.NopCloser(io.TeeReader(httpResp.Body, buf))
	return httpResp.Body, buf
}

// ExtractCachedUsage 从缓存/回放的响应体中取出 usage。
// 缓存里存的是上游**原始响应**，因此其中的 usage 是上游真实上报值，
// 用它统计「省下的 token」比字符数估算更可信。
// 解析失败返回 nil，调用方据此跳过计账（宁可少记，也不要记错）。
func ExtractCachedUsage(data []byte) *dto.Usage {
	var resp dto.TextResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil
	}
	return &resp.Usage
}

// RespondWithCached 命中缓存：先按缓存用量计费（保证收入/配额不漏），再原样回写响应。
func RespondWithCached(c *gin.Context, info *relaycommon.RelayInfo, data []byte) *types.UterError {
	var resp dto.TextResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		// 理论上不会发生：存入的是合法上游 JSON。
		return nil
	}
	// 缓存命中未占用任何渠道，置 0 避免渠道统计失真（UpdateChannelUsedQuota(0) 为空操作）。
	info.ChannelId = 0
	billCached(c, info, &resp.Usage)
	c.Data(http.StatusOK, "application/json", data)
	return nil
}

// billCached 按缓存响应用量计费（与正常路径一致：音频走 PostAudio，否则 PostText）。
func billCached(c *gin.Context, info *relaycommon.RelayInfo, usage *dto.Usage) {
	hasAudio := usage.CompletionTokenDetails.AudioTokens > 0 || usage.PromptTokensDetails.AudioTokens > 0
	hasAudioRatio := ratio_setting.ContainsAudioRatio(info.OriginModelName) ||
		ratio_setting.ContainsAudioCompletionRatio(info.OriginModelName)
	if hasAudio && hasAudioRatio {
		service.PostAudioConsumeQuota(c, info, usage, nil)
	} else {
		service.PostTextConsumeQuota(c, info, usage, nil)
	}
}
