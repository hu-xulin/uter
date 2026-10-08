package costopt

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync/atomic"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"
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
	// 41. 成本 per 成功任务：成功/总请求计数（比值即"每成功任务成本"的分母/分子）。
	SuccessRequests int64 `json:"success_requests"`
	TotalRequests   int64 `json:"total_requests"`
}

var metrics MetricsSnapshot

func enabledInc(p *int64) {
	if costoptcfg.GetCostOptSetting().MetricsEnabled {
		atomic.AddInt64(p, 1)
	}
}

func IncCacheHit()             { enabledInc(&metrics.CacheHits) }
func IncShortCircuit()         { enabledInc(&metrics.ShortCircuits) }
func IncNegativeHit()          { enabledInc(&metrics.NegativeHits) }
func IncSpikeAlert()           { enabledInc(&metrics.SpikeAlerts) }
func IncSemHit()               { enabledInc(&metrics.SemHits) }
func IncToolCacheHit()         { enabledInc(&metrics.ToolCacheHits) }
func IncCascadeEscalation()    { enabledInc(&metrics.CascadeEscalations) }
func IncLoopBreak()            { enabledInc(&metrics.LoopBreaks) }
func IncAgentBudgetBlock()     { enabledInc(&metrics.AgentBudgetBlocks) }
func IncAnomalyAlert()         { enabledInc(&metrics.AnomalyAlerts) }

// AddTokensSaved 累加估算节省的 token（用于"成本 per 成功任务"与看板）。
func AddTokensSaved(n int64) {
	if costoptcfg.GetCostOptSetting().MetricsEnabled && n > 0 {
		atomic.AddInt64(&metrics.TotalTokensSavedEst, n)
	}
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
		CacheHits:           atomic.LoadInt64(&metrics.CacheHits),
		ShortCircuits:       atomic.LoadInt64(&metrics.ShortCircuits),
		NegativeHits:        atomic.LoadInt64(&metrics.NegativeHits),
		SpikeAlerts:         atomic.LoadInt64(&metrics.SpikeAlerts),
		SemHits:             atomic.LoadInt64(&metrics.SemHits),
		ToolCacheHits:       atomic.LoadInt64(&metrics.ToolCacheHits),
		CascadeEscalations:  atomic.LoadInt64(&metrics.CascadeEscalations),
		LoopBreaks:          atomic.LoadInt64(&metrics.LoopBreaks),
		AgentBudgetBlocks:   atomic.LoadInt64(&metrics.AgentBudgetBlocks),
		AnomalyAlerts:       atomic.LoadInt64(&metrics.AnomalyAlerts),
		TotalTokensSavedEst: atomic.LoadInt64(&metrics.TotalTokensSavedEst),
		SuccessRequests:     atomic.LoadInt64(&metrics.SuccessRequests),
		TotalRequests:       atomic.LoadInt64(&metrics.TotalRequests),
	}
}
