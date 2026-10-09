package costopt

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync/atomic"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"

	"github.com/uter-ai/uter/relaykit/dto"
)

// MetricsSnapshot 降本中间层聚合计数器（可观测性看板 / 成本 per 成功任务 / 异常审计共用）。
type MetricsSnapshot struct {
	CacheHits           int64 `json:"cache_hits"`
	ShortCircuits       int64 `json:"short_circuits"`
	NegativeHits        int64 `json:"negative_hits"`
	SpikeAlerts         int64 `json:"spike_alerts"`
	SemHits             int64 `json:"sem_hits"`
	ToolCacheHits       int64 `json:"tool_cache_hits"`
	CascadeEscalations  int64 `json:"cascade_escalations"`
	LoopBreaks          int64 `json:"loop_breaks"`
	AgentBudgetBlocks   int64 `json:"agent_budget_blocks"`
	AnomalyAlerts       int64 `json:"anomaly_alerts"`
	TotalTokensSavedEst int64 `json:"total_tokens_saved_est"`
	// 按节省来源拆分，便于定位「到底哪个特性在省 token」。
	TokensSavedByExactCache    int64 `json:"tokens_saved_by_exact_cache"`
	TokensSavedBySemantic      int64 `json:"tokens_saved_by_semantic_cache"`
	TokensSavedByShortCircuit  int64 `json:"tokens_saved_by_short_circuit"`
	TokensSavedByNegativeCache int64 `json:"tokens_saved_by_negative_cache"`
	TokensSavedByLoopBreak     int64 `json:"tokens_saved_by_loop_break"`
	// 41. 成本 per 成功任务：成功/总请求计数（比值即"每成功任务成本"的分母/分子）。
	SuccessRequests int64 `json:"success_requests"`
	TotalRequests   int64 `json:"total_requests"`

	// ===== 各降本钩子命中率（定位"开了但没生效"） =====
	// 分母 = 进入降本钩子段的请求数；各钩子分子 = 该钩子实际改写了请求/注入了上下文的次数。
	CostOptRequests     int64 `json:"costopt_requests"`       // 进入降本钩子段的请求数（命中率分母）
	ValueTierHits       int64 `json:"value_tier_hits"`       // 价值层下沉改写模型次数
	ComplexityHits      int64 `json:"complexity_hits"`       // 复杂度路由降级次数
	CascadeHits         int64 `json:"cascade_hits"`          // 级联降级次数
	RouterLMHits        int64 `json:"router_lm_hits"`        // RouterLM 选模改写次数
	CompressionRequests int64 `json:"compression_requests"`  // Prompt 压缩尝试次数
	CompressionHits     int64 `json:"compression_hits"`      // Prompt 压缩生效（至少改写 1 段）次数
	CompressionEmpty    int64 `json:"compression_empty"`     // 压缩返回空内容次数（静默失败告警计数）
	RAGRequests         int64 `json:"rag_requests"`          // RAG 检索尝试次数
	RAGHits             int64 `json:"rag_hits"`              // RAG 注入成功次数
	RAGSkipped          int64 `json:"rag_skipped"`           // RAG 被净收益闸门跳过次数
}

var metrics MetricsSnapshot

func enabledInc(p *int64) {
	if costoptcfg.GetCostOptSetting().MetricsEnabled {
		atomic.AddInt64(p, 1)
	}
}

func IncCacheHit()          { enabledInc(&metrics.CacheHits) }
func IncShortCircuit()      { enabledInc(&metrics.ShortCircuits) }
func IncNegativeHit()       { enabledInc(&metrics.NegativeHits) }
func IncSpikeAlert()        { enabledInc(&metrics.SpikeAlerts) }
func IncSemHit()            { enabledInc(&metrics.SemHits) }
func IncToolCacheHit()      { enabledInc(&metrics.ToolCacheHits) }
func IncCascadeEscalation() { enabledInc(&metrics.CascadeEscalations) }
func IncLoopBreak()         { enabledInc(&metrics.LoopBreaks) }
func IncAgentBudgetBlock()  { enabledInc(&metrics.AgentBudgetBlocks) }
func IncAnomalyAlert()      { enabledInc(&metrics.AnomalyAlerts) }

// ===== 各降本钩子命中率计数（仅在 MetricsEnabled 时累加） =====
func IncCostOptRequest()     { enabledInc(&metrics.CostOptRequests) }
func IncValueTierHit()       { enabledInc(&metrics.ValueTierHits) }
func IncComplexityHit()      { enabledInc(&metrics.ComplexityHits) }
func IncCascadeHit()         { enabledInc(&metrics.CascadeHits) }
func IncRouterLMHit()        { enabledInc(&metrics.RouterLMHits) }
func IncCompressionRequest() { enabledInc(&metrics.CompressionRequests) }
func IncCompressionHit()     { enabledInc(&metrics.CompressionHits) }
func IncCompressionEmpty()   { enabledInc(&metrics.CompressionEmpty) }
func IncRAGRequest()         { enabledInc(&metrics.RAGRequests) }
func IncRAGHit()             { enabledInc(&metrics.RAGHits) }
func IncRAGSkipped()         { enabledInc(&metrics.RAGSkipped) }

// AddTokensSaved 累加估算节省的 token（用于"成本 per 成功任务"与看板）。
func AddTokensSaved(n int64) {
	if costoptcfg.GetCostOptSetting().MetricsEnabled && n > 0 {
		atomic.AddInt64(&metrics.TotalTokensSavedEst, n)
	}
}

// 节省 token 的来源分类，用于看板按特性拆分。
const (
	SavedSourceExactCache    = "exact_cache"
	SavedSourceSemanticCache = "semantic_cache"
	SavedSourceShortCircuit  = "short_circuit"
	SavedSourceNegativeCache = "negative_cache"
	SavedSourceLoopBreak     = "loop_break"
)

// RecordTokensSavedBy 按来源累加「本次因降本而未向上游花费的 token」。
//
// 语义：**传入的是"本可发生但被省下"的 token 数**，而非本次实际计费的 token。
// 判定依据：
//   - 精确/语义缓存命中：完全没调上游，因此把该响应的**全部**用量
//     （prompt+completion）计为节省；
//   - 短路 / 负缓存 / 循环收敛：同样未调上游，按 estimateUsage 的口径估算本次
//     请求「若真的发出去」的用量计为节省；
//   - n <= 0 时直接忽略（估算不出用量不计账，避免污染平均值）。
//
// 只累加、不覆盖 TotalTokensSavedEst：后者仍由各调用点传入总量，保持
// "总量 == 各来源之和"这一不变量，便于在看板上对账。
func RecordTokensSavedBy(source string, n int64) {
	if n <= 0 || !costoptcfg.GetCostOptSetting().MetricsEnabled {
		return
	}
	atomic.AddInt64(&metrics.TotalTokensSavedEst, n)
	switch source {
	case SavedSourceExactCache:
		atomic.AddInt64(&metrics.TokensSavedByExactCache, n)
	case SavedSourceSemanticCache:
		atomic.AddInt64(&metrics.TokensSavedBySemantic, n)
	case SavedSourceShortCircuit:
		atomic.AddInt64(&metrics.TokensSavedByShortCircuit, n)
	case SavedSourceNegativeCache:
		atomic.AddInt64(&metrics.TokensSavedByNegativeCache, n)
	case SavedSourceLoopBreak:
		atomic.AddInt64(&metrics.TokensSavedByLoopBreak, n)
	}
}

// UsageTokens 返回一次响应上报的总 token（prompt+completion）。
// 对缓存/短路等回放路径，这是「本来会花掉」的量。
func UsageTokens(usage *dto.Usage) int64 {
	if usage == nil {
		return 0
	}
	if usage.TotalTokens > 0 {
		return int64(usage.TotalTokens)
	}
	return int64(usage.PromptTokens + usage.CompletionTokens)
}

// ===== 41. 成本 per 成功任务（补上「成功信号」，杜绝"省 token 却降质量"的假节省） =====

// RequestSucceeded 按配置的「成功信号」判定本次请求是否算成功。
//
// 三种信号（cost_per_success_signal）：
//   - http_ok    ：上游返回 2xx 即算成功（最宽松）。
//   - no_error   ：链路无错误即算成功（默认，与 Uter 现有错误语义一致）。
//   - json_field ：解析响应体 JSON 的指定字段，等于期望值才算成功（最严格，
//     适合"分类/抽取"这类有明确成功字段的任务）。
//
// 判定不可靠时一律按「成功」计，避免把优化成果误判为失败。
func RequestSucceeded(statusCode int, respErr error, body []byte) bool {
	cfg := costoptcfg.GetCostOptSetting()
	switch strings.ToLower(strings.TrimSpace(cfg.CostPerSuccessSignal)) {
	case "http_ok":
		if statusCode <= 0 {
			return true // 未知状态不误判
		}
		return statusCode >= 200 && statusCode < 300
	case "json_field":
		field := strings.TrimSpace(cfg.CostPerSuccessField)
		if field == "" || len(body) == 0 {
			return true
		}
		var parsed map[string]any
		if err := json.Unmarshal(body, &parsed); err != nil {
			return true // 非 JSON 响应不做判定
		}
		got, ok := parsed[field]
		if !ok {
			return false // 关键字段缺失=任务未真正完成
		}
		return fmt.Sprint(got) == cfg.CostPerSuccessExpected
	default: // no_error
		return respErr == nil
	}
}

// MarkRequestOutcome 累计一次请求结果（仅在 CostPerSuccess 开启时计数）。
func MarkRequestOutcome(statusCode int, respErr error, body []byte) {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.CostPerSuccessEnabled {
		return
	}
	atomic.AddInt64(&metrics.TotalRequests, 1)
	if RequestSucceeded(statusCode, respErr, body) {
		atomic.AddInt64(&metrics.SuccessRequests, 1)
	}
}

// CostPerSuccessRatio 成功任务占比（分母为 0 时返回 0）。
func CostPerSuccessRatio() float64 {
	total := atomic.LoadInt64(&metrics.TotalRequests)
	if total == 0 {
		return 0
	}
	return float64(atomic.LoadInt64(&metrics.SuccessRequests)) / float64(total)
}

// AnomalyAlertEnabled 是否启用异常用量审计增强。
func AnomalyAlertEnabled() bool {
	return costoptcfg.GetCostOptSetting().AnomalyAlertEnabled
}

// MetricsEnabled 是否启用可观测性看板/指标收集。
func MetricsEnabled() bool {
	return costoptcfg.GetCostOptSetting().MetricsEnabled
}

// MetricsSnapshotNow 返回当前计数器快照（原子读）。
func MetricsSnapshotNow() MetricsSnapshot {
	return MetricsSnapshot{
		CacheHits:                  atomic.LoadInt64(&metrics.CacheHits),
		ShortCircuits:              atomic.LoadInt64(&metrics.ShortCircuits),
		NegativeHits:               atomic.LoadInt64(&metrics.NegativeHits),
		SpikeAlerts:                atomic.LoadInt64(&metrics.SpikeAlerts),
		SemHits:                    atomic.LoadInt64(&metrics.SemHits),
		ToolCacheHits:              atomic.LoadInt64(&metrics.ToolCacheHits),
		CascadeEscalations:         atomic.LoadInt64(&metrics.CascadeEscalations),
		LoopBreaks:                 atomic.LoadInt64(&metrics.LoopBreaks),
		AgentBudgetBlocks:          atomic.LoadInt64(&metrics.AgentBudgetBlocks),
		AnomalyAlerts:              atomic.LoadInt64(&metrics.AnomalyAlerts),
		TotalTokensSavedEst:        atomic.LoadInt64(&metrics.TotalTokensSavedEst),
		TokensSavedByExactCache:    atomic.LoadInt64(&metrics.TokensSavedByExactCache),
		TokensSavedBySemantic:      atomic.LoadInt64(&metrics.TokensSavedBySemantic),
		TokensSavedByShortCircuit:  atomic.LoadInt64(&metrics.TokensSavedByShortCircuit),
		TokensSavedByNegativeCache: atomic.LoadInt64(&metrics.TokensSavedByNegativeCache),
		TokensSavedByLoopBreak:     atomic.LoadInt64(&metrics.TokensSavedByLoopBreak),
		SuccessRequests:            atomic.LoadInt64(&metrics.SuccessRequests),
		TotalRequests:              atomic.LoadInt64(&metrics.TotalRequests),
		CostOptRequests:            atomic.LoadInt64(&metrics.CostOptRequests),
		ValueTierHits:              atomic.LoadInt64(&metrics.ValueTierHits),
		ComplexityHits:             atomic.LoadInt64(&metrics.ComplexityHits),
		CascadeHits:                atomic.LoadInt64(&metrics.CascadeHits),
		RouterLMHits:               atomic.LoadInt64(&metrics.RouterLMHits),
		CompressionRequests:        atomic.LoadInt64(&metrics.CompressionRequests),
		CompressionHits:            atomic.LoadInt64(&metrics.CompressionHits),
		CompressionEmpty:           atomic.LoadInt64(&metrics.CompressionEmpty),
		RAGRequests:                atomic.LoadInt64(&metrics.RAGRequests),
		RAGHits:                    atomic.LoadInt64(&metrics.RAGHits),
		RAGSkipped:                 atomic.LoadInt64(&metrics.RAGSkipped),
	}
}
