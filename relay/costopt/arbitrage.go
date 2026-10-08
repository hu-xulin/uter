package costopt

import (
	"sort"
	"strings"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"

	"github.com/uter-ai/uter/relaykit/dto"
)

// ===== 4. 多供应商套利 + 5. 同模型跨通道比价 =====
//
// 现状缺口（V2 标记为 🟡）：倍率数据已有、渠道机制可接任意上游，但缺「同质量
// 自动选最便宜供应商」的择优引擎。V2.2 补齐该引擎：以配置价目表为准，在同一
// 基准模型的候选供应商中按单价升序择优。
//
// 价目表 key 形如 "供应商/模型"（如 "groq/llama-3.3-70b"）或纯模型名；
// value = 每百万 input token 的美元单价。归一化规则：取最后一个 "/" 之后的部分
// 作为基准模型名，用于把不同供应商的同质模型归入一组比较。

// baseModelOf 归一化出基准模型名（去掉供应商前缀）。
func baseModelOf(name string) string {
	if i := strings.LastIndex(name, "/"); i >= 0 && i < len(name)-1 {
		return name[i+1:]
	}
	return name
}

// ArbitrageCandidates 返回与 model 同质（同基准名）的候选，按单价升序。
// 未启用、价目表为空或未命中时返回 nil。
func ArbitrageCandidates(model string) []struct {
	Name  string
	Price float64
} {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.ArbitrageEnabled || len(cfg.ArbitrageModelPrices) == 0 || model == "" {
		return nil
	}
	base := baseModelOf(model)
	if cfg.ArbitragePreferSameModelOnly {
		// #5 场景：只在同模型名（跨通道）之间比价，此时基准名就是完整模型名。
		base = model
	}

	type cand struct {
		Name  string
		Price float64
	}
	var out []cand
	for name, price := range cfg.ArbitrageModelPrices {
		if price <= 0 {
			continue
		}
		b := baseModelOf(name)
		if cfg.ArbitragePreferSameModelOnly {
			b = name
		}
		if b != base {
			continue
		}
		out = append(out, cand{Name: name, Price: price})
	}
	if len(out) == 0 {
		return nil
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Price < out[j].Price })

	// 价差护栏：最便宜单价 × MaxPriceRatio 之内的候选都可接受（默认 1.0=只选最便宜）。
	ratio := cfg.ArbitrageMaxPriceRatio
	if ratio <= 0 {
		ratio = 1.0
	}
	best := out[0].Price
	limit := best * ratio
	kept := out[:0]
	for _, c := range out {
		if c.Price <= limit {
			kept = append(kept, c)
		}
	}
	res := make([]struct {
		Name  string
		Price float64
	}, 0, len(kept))
	for _, c := range kept {
		res = append(res, struct {
			Name  string
			Price float64
		}{Name: c.Name, Price: c.Price})
	}
	return res
}

// ApplyArbitrage 自动择优：把请求模型改写到同质候选中最便宜的那个。
// 保守策略：未命中价目表时按配置走兜底模型或不改动；改写后仍走正常计费/缓存路径。
func ApplyArbitrage(req *dto.GeneralOpenAIRequest) bool {
	if req == nil || req.Model == "" {
		return false
	}
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.ArbitrageEnabled {
		return false
	}
	cands := ArbitrageCandidates(req.Model)
	if len(cands) > 0 {
		best := cands[0].Name
		if best != req.Model {
			req.Model = best
			return true
		}
		return false
	}
	// 价目表完全未命中：用兜底模型（可留空=不改动）。
	if cfg.ArbitrageFallbackModel != "" && cfg.ArbitrageFallbackModel != req.Model {
		req.Model = cfg.ArbitrageFallbackModel
		return true
	}
	return false
}

// ===== 6. Serverless 开源模型价值层 =====

// ValueTierMatch 判断该请求是否应下沉到价值层（Groq/Fireworks/DeepInfra 等）。
// BulkOnly 模式下仅对长 prompt（bulk）流量生效，短交互仍走前沿模型保体验。
func ValueTierMatch(req *dto.GeneralOpenAIRequest) bool {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.ValueTierEnabled || req == nil || req.Model == "" {
		return false
	}
	if len(cfg.ValueTierModels) > 0 {
		hit := false
		base := baseModelOf(req.Model)
		for _, m := range cfg.ValueTierModels {
			if m == req.Model || m == base {
				hit = true
				break
			}
		}
		if !hit {
			return false
		}
	}
	if cfg.ValueTierBulkOnly {
		minChars := cfg.ValueTierMinPromptChars
		if minChars <= 0 {
			minChars = 2000
		}
		if len([]rune(lastUserMessageText(req))) < minChars {
			return false
		}
	}
	return true
}

// ValueTierChannelTypes 配置的价值层渠道类型清单（供选路加权使用）。
func ValueTierChannelTypes() []string {
	if !costoptcfg.GetCostOptSetting().ValueTierEnabled {
		return nil
	}
	return costoptcfg.GetCostOptSetting().ValueTierChannelTypes
}

// ===== 7. A-tier + 价值层混合（用户可见走贵模，后台走便宜模） =====

// TierSplitEnabled A-tier 分层是否启用（供 handler 决定是否收集请求头，避免无谓开销）。
func TierSplitEnabled() bool {
	return costoptcfg.GetCostOptSetting().TierSplitEnabled
}

// IsBackgroundRequest 判断是否为后台流量：请求头或 model 后缀命中后台标记即算。
func IsBackgroundRequest(req *dto.GeneralOpenAIRequest, headers map[string]string) bool {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.TierSplitEnabled || len(cfg.TierSplitBackgroundTags) == 0 {
		return false
	}
	for k, v := range headers {
		lk := strings.ToLower(k)
		lv := strings.ToLower(v)
		for _, tag := range cfg.TierSplitBackgroundTags {
			t := strings.ToLower(tag)
			if t == "" {
				continue
			}
			if strings.Contains(lk, t) || strings.Contains(lv, t) {
				return true
			}
		}
	}
	return false
}

// ApplyTierSplit 后台流量下沉到便宜模型；用户可见请求保留前沿模型（VisibleModels 白名单）。
// 返回是否改写了模型。
func ApplyTierSplit(req *dto.GeneralOpenAIRequest, isBackground bool) bool {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.TierSplitEnabled || req == nil || req.Model == "" {
		return false
	}
	if !isBackground {
		return false
	}
	// 用户可见白名单内的模型不下沉，保证交互质量。
	base := baseModelOf(req.Model)
	for _, m := range cfg.TierSplitVisibleModels {
		if m == req.Model || m == base {
			return false
		}
	}
	if cfg.TierSplitBackgroundModel != "" && cfg.TierSplitBackgroundModel != req.Model {
		req.Model = cfg.TierSplitBackgroundModel
		return true
	}
	return false
}

// ApplyValueTierRouting 价值层路由：命中价值层的请求把偏好渠道类型写入返回值，
// 由 handler 通过 gin 上下文透传给选路层加权（与地理比价同一机制）。
func ApplyValueTierRouting(req *dto.GeneralOpenAIRequest) string {
	if !ValueTierMatch(req) {
		return ""
	}
	types := ValueTierChannelTypes()
	if len(types) == 0 {
		return ""
	}
	return types[0]
}
