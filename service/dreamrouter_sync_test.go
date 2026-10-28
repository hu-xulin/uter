/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/

package service

import (
	"encoding/json"
	"math"
	"testing"
)

// 取自 https://dreamrouter.ai/api/pricing 的真实结构（2026-10-24）：
// claude-opus-4-5（claude 组，default 映射 0.6）、
// deepseek-v4-pro（deepseek 组 0.65）、
// seedance-2.0-ab（vd-seedance-ab 组，default 无映射、group_ratio 0.9）。
func testGroupRatios() (map[string]float64, map[string]float64) {
	userGroupRatio := map[string]float64{
		"claude":   0.6,
		"deepseek": 0.65,
		"openai":   0.6,
		"glm":      0.55,
	}
	groupRatio := map[string]float64{
		"claude":          0.6,
		"deepseek":        0.65,
		"vd-seedance-ab":  0.9,
		"vd-seedance":     0.85,
		"vd-seedance-min": 0.55,
	}
	return userGroupRatio, groupRatio
}

func TestDreamRouterGroupRatio(t *testing.T) {
	userGroupRatio, groupRatio := testGroupRatios()

	cases := []struct {
		name   string
		groups []string
		want   float64
	}{
		{"default 映射命中", []string{"claude"}, 0.6},
		{"多组取最小", []string{"claude", "deepseek"}, 0.6},
		{"default 缺失回退 group_ratio", []string{"vd-seedance-ab"}, 0.9},
		{"default 与 group_ratio 混取最小", []string{"vd-seedance", "vd-seedance-min"}, 0.55},
		{"无任何映射时按 1.0", []string{"unknown-group"}, 1.0},
		{"空组按 1.0", nil, 1.0},
	}
	for _, c := range cases {
		got := dreamRouterGroupRatio(c.groups, userGroupRatio, groupRatio)
		if !nearlyEqualSync(got, c.want) {
			t.Errorf("%s: dreamRouterGroupRatio(%v) = %v, want %v", c.name, c.groups, got, c.want)
		}
	}
}

func TestDreamRouterComputeTargetPerToken(t *testing.T) {
	// claude-opus-4-5：官方基准 model_ratio=2.5（$5/1M），r=0.6（-40%）。
	// 创梦默认组售价 $3/1M；uter「+1 折」= 打 7 折 = $3.5/1M
	// → ModelRatio = 3.5/2 = 1.75 = 2.5 × (0.6+0.1)。
	rec := dreamRouterRecord{
		ModelName:       "claude-opus-4-5",
		QuotaType:       0,
		ModelRatio:      2.5,
		CompletionRatio: 5,
		CacheRatio:      0.1,
		EnableGroups:    []string{"claude"},
	}
	// 第三个参数是**价格规则作用后的系数**（r + amount），不是 amount 本身。
	factor := dreamRouterRuleFactor(0.6, 0.1, DreamRouterRuleDirectionIncrease)
	change := dreamRouterComputeTarget(rec, 0.6, factor)
	if change.BillingClass != "per_token" {
		t.Fatalf("billing class = %s, want per_token", change.BillingClass)
	}
	if !nearlyEqualSync(change.NewModelRatio, 1.75) {
		t.Errorf("NewModelRatio = %v, want 1.75（官方 $5 × 0.7 ÷ 2）", change.NewModelRatio)
	}
	if !nearlyEqualSync(change.CompletionRatio, 5) {
		t.Errorf("CompletionRatio = %v, want 5（比值不随加成变化）", change.CompletionRatio)
	}
	if !nearlyEqualSync(change.CacheRatio, 0.1) {
		t.Errorf("CacheRatio = %v, want 0.1", change.CacheRatio)
	}
	if change.NewModelPrice != 0 {
		t.Errorf("NewModelPrice = %v, want 0（按量模型不设按次价）", change.NewModelPrice)
	}
}

func TestDreamRouterComputeTargetPerCall(t *testing.T) {
	// doubao-seedream-4-0-250828：按次计费，model_price=0.029（$/次），
	// r=0.85（-15%）。创梦默认组 $0.0247/次；uter = 0.029 × 0.95 = 0.02755。
	rec := dreamRouterRecord{
		ModelName:  "doubao-seedream-4-0-250828",
		QuotaType:  1,
		ModelPrice: 0.029,
	}
	factor := dreamRouterRuleFactor(0.85, 0.1, DreamRouterRuleDirectionIncrease)
	change := dreamRouterComputeTarget(rec, 0.85, factor)
	if change.BillingClass != "per_call" {
		t.Fatalf("billing class = %s, want per_call", change.BillingClass)
	}
	if !nearlyEqualSync(change.NewModelPrice, 0.02755) {
		t.Errorf("NewModelPrice = %v, want 0.02755", change.NewModelPrice)
	}
	if change.NewModelRatio != 0 {
		t.Errorf("NewModelRatio = %v, want 0（按次模型不设按量倍率）", change.NewModelRatio)
	}
}

func TestDreamRouterComputeTargetTiered(t *testing.T) {
	// gpt-5.5：带 billing_expr，页面抓取基线 in=$3.0/1M（r0=0.6）。
	// r 不变时：uter = 3.0/2 × 0.7/0.6 = 1.75。
	// r 降到 0.5 时：C 对 r 线性缩放 → 3.0/2 × 0.6/0.6 = 1.5。
	rec := dreamRouterRecord{
		ModelName:       "gpt-5.5",
		QuotaType:       0,
		ModelRatio:      2.5,
		CompletionRatio: 6,
		EnableGroups:    []string{"openai"},
		BillingExpr:     `len <= 272000 ? tier("standard", p * 5 + c * 30 + cr * 0.5) : tier("long_context", p * 10 + c * 45 + cr * 1)`,
	}
	factor := dreamRouterRuleFactor(0.6, 0.1, DreamRouterRuleDirectionIncrease)
	change := dreamRouterComputeTarget(rec, 0.6, factor)
	if change.BillingClass != "tiered" {
		t.Fatalf("billing class = %s, want tiered", change.BillingClass)
	}
	if !nearlyEqualSync(change.NewModelRatio, 1.75) {
		t.Errorf("NewModelRatio(r=0.6) = %v, want 1.75", change.NewModelRatio)
	}
	if !nearlyEqualSync(change.CompletionRatio, 6) {
		t.Errorf("CompletionRatio = %v, want 6（基线 out/in = 18/3）", change.CompletionRatio)
	}

	factor = dreamRouterRuleFactor(0.5, 0.1, DreamRouterRuleDirectionIncrease)
	change = dreamRouterComputeTarget(rec, 0.5, factor)
	if !nearlyEqualSync(change.NewModelRatio, 1.5) {
		t.Errorf("NewModelRatio(r=0.5) = %v, want 1.5（基线线性缩放）", change.NewModelRatio)
	}
}

// TestDreamRouterRuleFactor 锁定价格规则两个方向的系数语义。
//
//	increase：r + amount（加价）
//	decrease：r - amount（降价）
//
// 降价幅度 ≥ 上游折扣时系数非正——必须返回 0（调用方据此跳过该模型），
// 绝不能返回负数：负系数会算出负价格并被写进倍率表。
func TestDreamRouterRuleFactor(t *testing.T) {
	if got := dreamRouterRuleFactor(0.6, 0.1, DreamRouterRuleDirectionIncrease); !nearlyEqualSync(got, 0.7) {
		t.Errorf("increase factor = %v, want 0.7", got)
	}
	if got := dreamRouterRuleFactor(0.6, 0.1, DreamRouterRuleDirectionDecrease); !nearlyEqualSync(got, 0.5) {
		t.Errorf("decrease factor = %v, want 0.5", got)
	}
	// 幅度恰好等于折扣 → 系数为 0（非正）→ 调用方跳过。
	if got := dreamRouterRuleFactor(0.6, 0.6, DreamRouterRuleDirectionDecrease); got != 0 {
		t.Errorf("decrease factor = %v, want 0（幅度等于折扣时必须非正）", got)
	}
	// 幅度超过折扣 → 系数为 0，绝不为负。
	if got := dreamRouterRuleFactor(0.6, 0.8, DreamRouterRuleDirectionDecrease); got != 0 {
		t.Errorf("decrease factor = %v, want 0（幅度超过折扣时不得为负）", got)
	}
	// 未知方向按加价处理（保守：不会意外降价）。
	if got := dreamRouterRuleFactor(0.6, 0.1, "unknown"); !nearlyEqualSync(got, 0.7) {
		t.Errorf("unknown direction factor = %v, want 0.7（按加价兜底）", got)
	}
}

// TestDreamRouterComputeTargetDecrease 锁定「降价」方向的实际算价结果。
func TestDreamRouterComputeTargetDecrease(t *testing.T) {
	// 与 TestDreamRouterComputeTargetPerToken 同一模型，但规则为降价 0.1 折：
	// r=0.6 − 0.1 = 0.5 → ModelRatio = 2.5 × 0.5 = 1.25（$2.5/1M）。
	rec := dreamRouterRecord{
		ModelName:    "claude-opus-4-5",
		QuotaType:    0,
		ModelRatio:   2.5,
		EnableGroups: []string{"claude"},
	}
	factor := dreamRouterRuleFactor(0.6, 0.1, DreamRouterRuleDirectionDecrease)
	change := dreamRouterComputeTarget(rec, 0.6, factor)
	if !nearlyEqualSync(change.NewModelRatio, 1.25) {
		t.Errorf("NewModelRatio = %v, want 1.25（2.5 × 0.5）", change.NewModelRatio)
	}
}

func TestDreamRouterComputeTargetUnparsableTiered(t *testing.T) {
	// 上游表达式里没有可用的输入单价（p 系数）时，不猜价、不改价，
	// 只把计费类别标记为 tiered_unparsable 并告警。
	rec := dreamRouterRecord{
		ModelName:   "gpt-99-future",
		ModelRatio:  1,
		BillingExpr: `tier("base", img_o * 1)`,
	}
	factor := dreamRouterRuleFactor(0.6, 0.1, DreamRouterRuleDirectionIncrease)
	change := dreamRouterComputeTarget(rec, 0.6, factor)
	if change.BillingClass != "tiered_unparsable" {
		t.Errorf("billing class = %s, want tiered_unparsable", change.BillingClass)
	}
	if change.NewModelRatio != 0 {
		t.Errorf("NewModelRatio = %v, want 0（解析不出官方单价不得改价）", change.NewModelRatio)
	}
}

func TestDreamRouterParsePayload(t *testing.T) {
	// 验证 /api/pricing 响应结构（含 group_group_ratio 嵌套）可正确解析。
	raw := `{
		"success": true,
		"pricing_version": "c8e1b5f9",
		"data": [
			{"model_name": "claude-opus-4-5", "quota_type": 0, "model_ratio": 2.5,
			 "completion_ratio": 5, "cache_ratio": 0.1, "enable_groups": ["claude"]},
			{"model_name": "doubao-seedream-4-0-250828", "quota_type": 1,
			 "model_price": 0.029, "enable_groups": ["seedream-image-4-0"]}
		],
		"group_ratio": {"claude": 0.6, "seedream-image-4-0": 0.85},
		"group_group_ratio": {"default": {"claude": 0.6}}
	}`
	payload := &dreamRouterPayload{}
	if err := json.Unmarshal([]byte(raw), payload); err != nil {
		t.Fatalf("parse payload: %v", err)
	}
	if !payload.Success {
		t.Fatal("payload success = false")
	}
	if len(payload.Data) != 2 {
		t.Fatalf("data len = %d, want 2", len(payload.Data))
	}
	userGroupRatio := payload.GroupGroupRatio[dreamRouterDefaultGroup]
	if userGroupRatio == nil {
		t.Fatal("default group mapping missing")
	}
	if got := dreamRouterGroupRatio(payload.Data[0].EnableGroups, userGroupRatio, payload.GroupRatio); !nearlyEqualSync(got, 0.6) {
		t.Errorf("claude-opus-4-5 group ratio = %v, want 0.6", got)
	}
	// seedream-image-4-0 在 default 映射中缺失 → 回退 group_ratio 的 0.85。
	if got := dreamRouterGroupRatio(payload.Data[1].EnableGroups, userGroupRatio, payload.GroupRatio); !nearlyEqualSync(got, 0.85) {
		t.Errorf("doubao-seedream group ratio = %v, want 0.85（group_ratio 回退）", got)
	}
}

func TestMergeFloatMaps(t *testing.T) {
	base := map[string]float64{"a": 1, "b": 2}
	override := map[string]float64{"b": 3, "c": 4}
	merged := mergeFloatMaps(base, override)
	want := map[string]float64{"a": 1, "b": 3, "c": 4}
	if len(merged) != len(want) {
		t.Fatalf("merged len = %d, want %d", len(merged), len(want))
	}
	for k, v := range want {
		if !nearlyEqualSync(merged[k], v) {
			t.Errorf("merged[%s] = %v, want %v", k, merged[k], v)
		}
	}
	// 原 map 不被修改。
	if !nearlyEqualSync(base["b"], 2) {
		t.Errorf("base was mutated: base[b] = %v, want 2", base["b"])
	}
}

func TestMergeFloatMapsRemoving(t *testing.T) {
	base := map[string]float64{"a": 1, "b": 2, "gpt-image-2": 0.211}
	override := map[string]float64{"b": 3, "c": 4}
	remove := map[string]struct{}{"gpt-image-2": {}, "not-present": {}}

	merged, changed := mergeFloatMapsRemoving(base, override, remove)
	if !changed {
		t.Fatal("changed = false, want true（gpt-image-2 应被删除）")
	}
	want := map[string]float64{"a": 1, "b": 3, "c": 4}
	if len(merged) != len(want) {
		t.Fatalf("merged len = %d, want %d: %v", len(merged), len(want), merged)
	}
	for k, v := range want {
		if !nearlyEqualSync(merged[k], v) {
			t.Errorf("merged[%s] = %v, want %v", k, merged[k], v)
		}
	}
	// 原 map 不被修改。
	if !nearlyEqualSync(base["gpt-image-2"], 0.211) {
		t.Errorf("base was mutated: base[gpt-image-2] = %v, want 0.211", base["gpt-image-2"])
	}
	// 删除集里没有真实存在的键时 changed=false，且不丢数据。
	merged2, changed2 := mergeFloatMapsRemoving(base, nil, map[string]struct{}{"zzz": {}})
	if changed2 {
		t.Error("changed2 = true, want false（无键可删）")
	}
	if len(merged2) != 3 {
		t.Errorf("merged2 len = %d, want 3", len(merged2))
	}
}

func TestRoundRatioValue(t *testing.T) {
	cases := []struct {
		in   float64
		want float64
	}{
		{1.75, 1.75},
		{0.027550000000000002, 0.02755},
		{3.000750187547124, 3.0007501875},
		{0, 0},
	}
	for _, c := range cases {
		if got := roundRatioValue(c.in); !nearlyEqualSync(got, c.want) {
			t.Errorf("roundRatioValue(%v) = %v, want %v", c.in, got, c.want)
		}
	}
	if got := roundRatioValue(math.NaN()); !math.IsNaN(got) {
		t.Errorf("roundRatioValue(NaN) = %v, want NaN", got)
	}
}

func TestDreamRouterTieredModelsParseOfficialUnitPrices(t *testing.T) {
	// 上游 2026-10-26 抓取时共 16 个 billing_expr 模型。官方单价一律从表达式
	// 的 p/c/cr/cc 系数解析，不再维护人工基线表——表会过期，表达式不会。
	// 这里锁住其中 4 条真实表达式（含时段折扣与多层 tier），确保解析路径覆盖
	// 「单层」「多层 ternary」「带 weekday/hour 条件」三种形态。
	cases := []struct {
		name string
		expr string
		want dreamRouterUnitPrices
	}{
		{
			name: "gpt-5.5 单层 standard",
			expr: `len <= 272000 ? tier("standard", p * 5 + c * 30 + cr * 0.5) : tier("long_context", p * 10 + c * 45 + cr * 1)`,
			want: dreamRouterUnitPrices{Input: 5, Output: 30, Cache: 0.5},
		},
		{
			name: "gemini-nano-banana-2.1 图像项",
			expr: `tier("base", p * 1.5 + c * 7.5 + img_o * 30)`,
			want: dreamRouterUnitPrices{Input: 1.5, Output: 7.5},
		},
		{
			name: "deepseek-v4-1-flash 时段折扣（按基准价解析）",
			expr: `(tier("base", p * 0.3 + c * 1.2 + cr * 0.01)) * (weekday("Asia/Shanghai") == 0 ? 0.5 : 1)`,
			want: dreamRouterUnitPrices{Input: 0.3, Output: 1.2, Cache: 0.01},
		},
		{
			name: "claude-haiku-5-5 缓存写入项",
			expr: `tier("base", p * 0.05 + c * 0.25 + cr * 0.005 + cc * 0.0625)`,
			want: dreamRouterUnitPrices{Input: 0.05, Output: 0.25, Cache: 0.005, CreateCache: 0.0625},
		},
	}
	for _, c := range cases {
		got, ok := dreamRouterOfficialUnitPrices(c.expr)
		if !ok {
			t.Errorf("%s: parse failed", c.name)
			continue
		}
		if !nearlyEqualSync(got.Input, c.want.Input) ||
			!nearlyEqualSync(got.Output, c.want.Output) ||
			!nearlyEqualSync(got.Cache, c.want.Cache) ||
			!nearlyEqualSync(got.CreateCache, c.want.CreateCache) {
			t.Errorf("%s: got %+v, want %+v", c.name, got, c.want)
		}
	}
}

func TestDreamRouterExprTimeDiscountDetection(t *testing.T) {
	// 时段折扣（夜间/周末半价）无法用倍率字段表达，必须被识别出来并告警，
	// 否则运营会以为「上游半价我们也是半价」。
	if !dreamRouterExprHasTimeDiscount(`tier("base", p * 0.3) * (weekday("Asia/Shanghai") == 0 ? 0.5 : 1)`) {
		t.Error("weekday() 表达式未被识别为时段折扣")
	}
	if !dreamRouterExprHasTimeDiscount(`tier("base", p * 0.3) * (hour("Asia/Shanghai") >= 18 ? 0.5 : 1)`) {
		t.Error("hour() 表达式未被识别为时段折扣")
	}
	if dreamRouterExprHasTimeDiscount(`tier("base", p * 5 + c * 30)`) {
		t.Error("普通表达式被误判为时段折扣")
	}
}

// TestDreamRouterVendorIndex 验证上游 vendors[] 的索引口径。
func TestDreamRouterVendorIndex(t *testing.T) {
	index := dreamRouterVendorIndex([]dreamRouterVendor{
		{ID: 1, Name: "Anthropic"},
		{ID: 3, Name: "OpenAI"},
		{ID: 0, Name: "无 id 的脏数据"},
	})
	if len(index) != 2 {
		t.Fatalf("index size = %d, want 2（id<=0 必须丢弃）", len(index))
	}
	if index[1] != "Anthropic" || index[3] != "OpenAI" {
		t.Errorf("index = %v", index)
	}
}

// TestDreamRouterOfferedReason 锁定「上游在售模型」的判定。
//
// 判据是**分组可售性**（enable_groups ∩ usable_group），不是 vendor：
// 上游存在没有 vendor_id 却照常在定价页展示、照常可调用的模型
// （实测 2026-10-28：MiniMax-M2.5，-5%，输入 $0.285/1M、输出 $1.14/1M）。
// 历史上这里按 vendor 判定，导致该模型每次同步都被跳过——价格冻结、
// 快照与后台对照表里永远少一条。这条用例锁住「不许再退回 vendor 判据」。
func TestDreamRouterOfferedReason(t *testing.T) {
	usable := map[string]string{
		"claude":  "Claude",
		"minimax": "MiniMax",
		"openai":  "OpenAI",
	}

	// 1) 正常记录：挂了可售分组 → 在售。
	if offered, _ := dreamRouterOfferedReason(dreamRouterRecord{
		ModelName: "claude-opus-4-5", VendorID: 1, EnableGroups: []string{"claude"},
	}, usable); !offered {
		t.Error("挂了可售分组的记录被误判为不在售")
	}

	// 2) 回归点：vendor_id 缺失（MiniMax-M2.5 的真实形态）→ 必须在售。
	//    上游定价页展示它、标 -5%，用户也买得到；跳过它就是「模型和价格
	//    信息一直没同步过来」。
	if offered, reason := dreamRouterOfferedReason(dreamRouterRecord{
		ModelName: "MiniMax-M2.5", EnableGroups: []string{"minimax"},
	}, usable); !offered {
		t.Errorf("vendor_id 缺失但分组可售的记录必须视为在售，实际被排除：%s", reason)
	}

	// 3) vendor_id 指向已删除供应商 → 同样不影响可售性（vendor 只是展示分组）。
	if offered, _ := dreamRouterOfferedReason(dreamRouterRecord{
		ModelName: "gone-vendor-model", VendorID: 99, EnableGroups: []string{"openai"},
	}, usable); !offered {
		t.Error("vendor_id 悬空但分组可售的记录应视为在售")
	}

	// 4) 没有任何分组 → 谁也调不到，必须排除，并给出原因供审计。
	if offered, reason := dreamRouterOfferedReason(dreamRouterRecord{
		ModelName: "no-group", VendorID: 1,
	}, usable); offered {
		t.Error("enable_groups 为空的记录必须被排除")
	} else if reason == "" {
		t.Error("排除时必须给出原因，供同步结果审计")
	}

	// 5) 挂的分组全部不在 usable_group 里 → 分组已下线，必须排除。
	if offered, reason := dreamRouterOfferedReason(dreamRouterRecord{
		ModelName: "retired-group", VendorID: 1, EnableGroups: []string{"claude-d-f51"},
	}, usable); offered {
		t.Error("分组与 usable_group 无交集的记录必须被排除")
	} else if reason == "" {
		t.Error("排除时必须给出原因，供同步结果审计")
	}

	// 6) usable_group 缺失是上游响应结构变化，不是「全部下架」：一律放行，
	//    否则一次结构变更就会把整张价格表清空。
	if offered, _ := dreamRouterOfferedReason(dreamRouterRecord{
		ModelName: "x", EnableGroups: []string{"anything"},
	}, nil); !offered {
		t.Error("usable_group 缺失时应放行，避免整表被清空")
	}
}

// TestDreamRouterComputeTargetTieredCarriesScaledExpr 验证分层计费模型
// 除了倍率，还会给出按同一系数缩放的目标表达式。
//
// 只写倍率是历史 bug：分层计费模型的实际计价只读 billing_expr，倍率对它们
// 不参与计算，于是「价格没同步、折扣不显示」。
func TestDreamRouterComputeTargetTieredCarriesScaledExpr(t *testing.T) {
	rec := dreamRouterRecord{
		ModelName:    "gemini-2.5-pro",
		QuotaType:    0,
		ModelRatio:   0.5625,
		EnableGroups: []string{"gemini"},
		BillingExpr:  `len <= 200000 ? tier("standard", p * 1.25 + c * 10 + cr * 0.13) : tier("long_context", p * 2.5 + c * 15 + cr * 0.25)`,
	}
	factor := dreamRouterRuleFactor(0.6, 0.1, DreamRouterRuleDirectionIncrease)
	change := dreamRouterComputeTarget(rec, 0.6, factor)
	if change.BillingClass != "tiered" {
		t.Fatalf("billing class = %s, want tiered", change.BillingClass)
	}
	if change.NewBillingExpr == "" {
		t.Fatal("目标表达式为空：分层计费模型不会真正改价")
	}
	prices, ok := dreamRouterOfficialUnitPrices(change.NewBillingExpr)
	if !ok {
		t.Fatalf("目标表达式无法解析：%s", change.NewBillingExpr)
	}
	if !nearlyEqualSync(prices.Input, 1.25*0.7) {
		t.Errorf("目标输入单价 = %v, want 0.875（官方 1.25 × 0.7）", prices.Input)
	}
	if !nearlyEqualSync(prices.Output, 10*0.7) {
		t.Errorf("目标输出单价 = %v, want 7", prices.Output)
	}
	// 倍率仍按同一系数写入，作为表达式缺失时的兜底。
	if !nearlyEqualSync(change.NewModelRatio, 1.25/2*0.7) {
		t.Errorf("NewModelRatio = %v, want %v", change.NewModelRatio, 1.25/2*0.7)
	}
}

// TestDreamRouterModelsPricedAboveOfficial 锁定「售价高于官方目录价」的识别。
//
// 规则系数 > 1 说明加价幅度盖过了上游折扣（例如上游 9.5 折、加价 1 折 →
// 1.05 倍官方价）。这不是对齐失败，但定价页不会显示折扣，必须显式告知运营，
// 而不是让它悄悄发生。
func TestDreamRouterModelsPricedAboveOfficial(t *testing.T) {
	changes := []DreamRouterModelChange{
		{Name: "kimi-k2.6", Factor: 1.05},
		{Name: "claude-opus-4-5", Factor: 0.7},
		{Name: "seedance-2.0-ab", Factor: 1.0},
		{Name: "doubao-seedream-4-5-251128", Factor: 1.05},
	}
	got := dreamRouterModelsPricedAboveOfficial(changes)
	want := []string{"doubao-seedream-4-5-251128", "kimi-k2.6"}
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("got %v, want %v", got, want)
		}
	}
	// 恰好等于 1（不打折也不加价）不算高于官方价。
	if above := dreamRouterModelsPricedAboveOfficial([]DreamRouterModelChange{{Name: "x", Factor: 1}}); len(above) != 0 {
		t.Errorf("Factor=1 不应被列为高于官方价，got %v", above)
	}
}
