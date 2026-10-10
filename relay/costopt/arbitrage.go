package costopt

import (
	"math"
	"sort"
	"strings"

	"github.com/uter-ai/uter/common"
	costoptcfg "github.com/uter-ai/uter/setting/costopt"
	"github.com/uter-ai/uter/setting/ratio_setting"

	"github.com/uter-ai/uter/relaykit/dto"
)

// ===== #4 多供应商套利 / #5 同模型跨通道比价 / #6 Serverless 价值层 / #7 A-tier 分层 =====
//
// 定位：**自动实现 + 手动可配置，默认走自动**（三态：auto 默认 | manual | off）。
//
// 自动模式在做什么：
//   - #5 同模型跨通道比价、#4 多供应商套利：比价动作发生在**渠道选择**环节
//     （model.GetRandomSatisfiedChannel 按「渠道对该模型的有效单价」在同优先级档内择优），
//     而不是改模型名。单价来自渠道 model_mapping 之后的上游模型定价，无需手填价目表。
//   - #6 Serverless 价值层：自动识别 bulk（长 prompt）流量，按人工确认的等价组
//     （ValueTierModelEquivalents）自动下沉到组内最便宜的开源模型，并偏好价值层渠道类型。
//   - #7 A-tier 分层：自动识别后台流量（显式请求头/模型后缀），下沉到最便宜的等价模型；
//     用户可见请求保留前沿模型。
//
// 手动配置扮演的角色是**边界约束**，不是前提条件：
//   - 等价模型组：质量等价关系必须人工确认，这是自动执行的边界。
//   - 渠道类型白名单、兜底模型、可见模型白名单：约束自动择优的搜索范围。
//   - 手填价目表：覆盖自动推算的单价（可疑定价用手动值纠偏）。
//
// 取不到任何定价信息时不参与择优，回退原加权随机——「没有价格信息」不会导致选不出渠道。

// baseModelOf 归一化出基准模型名（去掉供应商前缀）。
func baseModelOf(name string) string {
	if i := strings.LastIndex(name, "/"); i >= 0 && i < len(name)-1 {
		return name[i+1:]
	}
	return name
}

// AutoPriceFirst 是否让选路层按有效单价择优（handler 据此写 costopt_price_first）。
// #4/#5/#6/#7 任一处于自动模式即为 true。
func AutoPriceFirst() bool {
	return costoptcfg.GetCostOptSetting().AutoPriceFirst()
}

// unitPriceOfModel 模型单价，归一到「每 1M token 美元」；无定价返回 0。
// 与 model.channelEffectiveUnitPrice 保持同一口径，便于跨层比较。
func unitPriceOfModel(name string) float64 {
	if name == "" {
		return 0
	}
	v, usePrice, exists := ratio_setting.GetModelRatioOrPrice(name)
	if !exists || v <= 0 {
		return 0
	}
	if usePrice {
		return v
	}
	return v * 1e6 / common.QuotaPerUnit
}

// cheapestEquivalent 在等价模型组中选有效单价最低者（人工定义组、自动挑最便宜）。
// 组未配置或组内无有效定价时返回 ""。
func cheapestEquivalent(model string) string {
	cfg := costoptcfg.GetCostOptSetting()
	if model == "" || len(cfg.ValueTierModelEquivalents) == 0 {
		return ""
	}
	group, ok := cfg.ValueTierModelEquivalents[model]
	if !ok || len(group) == 0 {
		// 退一步按基准名匹配（"vendor/model" 形态）
		group, ok = cfg.ValueTierModelEquivalents[baseModelOf(model)]
		if !ok || len(group) == 0 {
			return ""
		}
	}
	best := ""
	bestPrice := math.MaxFloat64
	for _, m := range group {
		if m == "" || m == model {
			continue
		}
		if p := unitPriceOfModel(m); p > 0 && p < bestPrice {
			bestPrice, best = p, m
		}
	}
	return best
}

// ===== 4. 多供应商套利 + 5. 同模型跨通道比价 =====

// ArbitrageCandidates 返回与 model **完全同模型**的候选，按单价升序。
//
// 🔴 模型保真（不可配置的红线）：本函数恒定按完整模型名精确匹配候选，
// **忽略** ArbitragePreferSameModelOnly 开关。历史行为是把它设为 false 时
// 退化为「按去供应商前缀的基准名匹配」，于是 `{"gpt-4o": 1.5}` 这类价目表
// 能把 claude-sonnet 的请求改写成 gpt-4o——那正是保真红线禁止的跨模型替换，
// 且仅靠一个布尔开关就能重新打开。这里改为硬约束，无配置可绕过。
//
// 因此本函数的实际作用范围收窄为：**同一模型名跨渠道比价**（模型名不变，
// 只在选路层决定走哪条通道），这才是 #5 场景真正的成本节约点。
func ArbitrageCandidates(model string) []struct {
	Name  string
	Price float64
} {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.ArbitrageActive() || len(cfg.ArbitrageModelPrices) == 0 || model == "" {
		return nil
	}
	// 模型保真：基准名就是完整模型名，绝不退化为去前缀的基准名。
	base := model

	type cand struct {
		Name  string
		Price float64
	}
	var out []cand
	for name, price := range cfg.ArbitrageModelPrices {
		if price <= 0 {
			continue
		}
		b := name
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

// ApplyArbitrage 自动择优：把请求模型改写到**同模型名**候选中最便宜的那个。
//
// 注意：#4/#5 的主战场是**渠道选择**（同一模型名在 direct/Bedrock/Azure 等通道间的价差），
// 由 AutoPriceFirst 交给选路层按有效单价完成；这里处理的是「同一模型名、不同供应商渠道」
// 的映射（价目表里同一个模型名对应多个渠道报价时取最低）。
//
// 🔴 模型保真（不可配置的红线）：本函数**恒定不改写模型名**。
//   - 候选由 ArbitrageCandidates 强制按完整模型名精确匹配，best 必等于 req.Model。
//   - 价目表未命中时**不再有换模型的兜底分支**：那是货真价实的跨模型替换
//     （客户要 A、服务方回 B），已按保真原则整体停用，相关配置项亦已删除。
//
// 真实成本节约发生在**渠道**层而非模型层：同一个模型走 direct 与走 Bedrock、
// 走国内中转与走海外中转，单价可以差数倍，而客户拿到的模型分毫不变。
func ApplyArbitrage(req *dto.GeneralOpenAIRequest) bool {
	// 模型保真：本函数恒为 no-op，保留调用契约以维持主链路结构稳定。
	_ = req
	_ = ModelFidelityLocked
	return false
}

// ===== 6. Serverless 开源模型价值层 =====

// ValueTierMatch 判断该请求是否应下沉到价值层（Groq/Fireworks/DeepInfra 等）。
// auto 模式下 ValueTierAutoDetectBulk 控制是否自动按长 prompt 判定 bulk；
// BulkOnly 模式下仅对长 prompt（bulk）流量生效，短交互仍走前沿模型保体验。
func ValueTierMatch(req *dto.GeneralOpenAIRequest) bool {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.ValueTierActive() || req == nil || req.Model == "" {
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
	if cfg.ValueTierBulkOnly || cfg.ValueTierAutoDetectBulk {
		// 只有长prompt（bulk）流量才下沉到价值层，短交互仍走前沿模型保体验。
		//
		//🔑 这里曾漏掉 `|| cfg.ValueTierAutoDetectBulk`，导致 ValueTierBulkOnly=false
		//	（默认值）时整段长度判定被跳过 → **所有请求无条件下沉**。实测
		//	claude-haiku-4-5-20251001 的 81 token 短问答也被改写成
		//	openai/gpt-oss-120b，与字段文档「仅对 bulk 流量下沉」完全相反，
		//	且会让降本 A/B 测试两组走同一条路径、失去可比性。
		//
		// auto_detect_bulk 本身语义就是「auto 模式下自动按长 prompt 判定 bulk」，
		// 因此它开启时就必须执行长度门槛；显式 bulk_only 同理。
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
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.ValueTierActive() {
		return nil
	}
	return cfg.ValueTierChannelTypes
}

// ===== 7. A-tier + 价值层混合（用户可见走贵模，后台走便宜模） =====

// TierSplitEnabled A-tier 分层是否启用（供 handler 决定是否收集请求头，避免无谓开销）。
func TierSplitEnabled() bool {
	return costoptcfg.GetCostOptSetting().TierSplitActive()
}

// backgroundHeaderKeys 自动模式下判定后台流量的请求头关键字。
var backgroundHeaderKeys = []string{"background", "async", "cron", "-task", "batch"}

// visibleHeaderKeys 命中即视为"用户可见"流量（不判为后台）。
var visibleHeaderKeys = []string{"visible", "interactive", "user-facing"}

// truthyHeader 请求头值是否为"真"（空值或 0/false 视为假）。
func truthyHeader(v string) bool {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "", "0", "false", "no", "off":
		return false
	}
	return true
}

// IsBackgroundRequest 判断是否为后台流量。
// 判定顺序：手动 tags（manual/auto 都生效）→ 自动显式信号（请求头/模型后缀）→ 可选非流式。
func IsBackgroundRequest(req *dto.GeneralOpenAIRequest, headers map[string]string) bool {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.TierSplitActive() {
		return false
	}
	// 1) 手动配置：命中请求头/元信息标记即判定为后台流量。
	if len(cfg.TierSplitBackgroundTags) > 0 {
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
	}
	if !cfg.TierSplitAuto() || !cfg.TierSplitAutoDetect {
		return false
	}
	// 2) 自动：显式后台信号（请求头关键字，且值为真）。
	hasVisible := false
	for k, v := range headers {
		lk := strings.ToLower(k)
		for _, key := range visibleHeaderKeys {
			if strings.Contains(lk, key) {
				hasVisible = true
			}
		}
		for _, key := range backgroundHeaderKeys {
			if strings.Contains(lk, key) && truthyHeader(v) {
				return true
			}
		}
	}
	// 3) 自动：模型名显式后台后缀。
	if req != nil {
		lm := strings.ToLower(req.Model)
		if strings.HasSuffix(lm, "-batch") || strings.Contains(lm, ":batch") ||
			strings.HasSuffix(lm, ":background") || strings.HasSuffix(lm, "-background") {
			return true
		}
	}
	// 4) 可选：非流式视为后台。默认关闭——非流式不等于后台，开启可能让交互式请求掉质量。
	if cfg.TierSplitNonStreamAsBackground && !hasVisible && req != nil {
		if req.Stream != nil && !*req.Stream {
			return true
		}
	}
	return false
}

// ApplyTierSplit 后台流量下沉到便宜模型；用户可见请求保留前沿模型（VisibleModels 白名单）。
// auto 模式下未指定 BackgroundModel 时，自动取等价组内最便宜的模型。
func ApplyTierSplit(req *dto.GeneralOpenAIRequest, isBackground bool) bool {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.TierSplitActive() || req == nil || req.Model == "" {
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
	target := cfg.TierSplitBackgroundModel
	if target == "" && cfg.TierSplitAuto() {
		// 自动模式：从人工确认的等价组里挑最便宜的。
		target = cheapestEquivalent(req.Model)
	}
	if target != "" && target != req.Model {
		req.Model = target
		return true
	}
	return false
}

// ApplyValueTierRouting 价值层路由：**已停用（模型保真）**。
//
// 原实现会把 claude/gemini 等请求的模型下沉到等价组里的廉价开源模型
// （如 claude-sonnet → groq-gpt-oss-120b）。这属于「把客户选择的模型换成另一个
// 模型」，违反客户明确要求，现整体停用：恒定返回 ""，绝不修改 req.Model。
//
// 保留函数签名以维持既有调用方与配置项；ModelFidelityLocked 是该约束的显式表达。
//
// 跨供应商比价（ApplyArbitrage）不受影响——它在**同一模型**的多个渠道间选最便宜的，
// 模型名不变，属真实成本节约。
func ApplyValueTierRouting(req *dto.GeneralOpenAIRequest) string {
	// 模型保真：不改写模型、不返回渠道偏好。
	return ""
}
