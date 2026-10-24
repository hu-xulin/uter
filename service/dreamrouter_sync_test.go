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
	change := dreamRouterComputeTarget(rec, 0.6, 0.1)
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
	change := dreamRouterComputeTarget(rec, 0.85, 0.1)
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
	change := dreamRouterComputeTarget(rec, 0.6, 0.1)
	if change.BillingClass != "tiered" {
		t.Fatalf("billing class = %s, want tiered", change.BillingClass)
	}
	if !nearlyEqualSync(change.NewModelRatio, 1.75) {
		t.Errorf("NewModelRatio(r=0.6) = %v, want 1.75", change.NewModelRatio)
	}
	if !nearlyEqualSync(change.CompletionRatio, 6) {
		t.Errorf("CompletionRatio = %v, want 6（基线 out/in = 18/3）", change.CompletionRatio)
	}

	change = dreamRouterComputeTarget(rec, 0.5, 0.1)
	if !nearlyEqualSync(change.NewModelRatio, 1.5) {
		t.Errorf("NewModelRatio(r=0.5) = %v, want 1.5（基线线性缩放）", change.NewModelRatio)
	}
}

func TestDreamRouterComputeTargetUnregisteredTiered(t *testing.T) {
	// 上游新增未登记基线的 tiered 模型：不改价（BillingClass 标记），
	// 避免把错误公式套到生产价格上。
	rec := dreamRouterRecord{
		ModelName:   "gpt-99-future",
		ModelRatio:  1,
		BillingExpr: `tier("base", p * 1)`,
	}
	change := dreamRouterComputeTarget(rec, 0.6, 0.1)
	if change.BillingClass != "tiered_unregistered" {
		t.Errorf("billing class = %s, want tiered_unregistered", change.BillingClass)
	}
	if change.NewModelRatio != 0 {
		t.Errorf("NewModelRatio = %v, want 0（未登记基线不得改价）", change.NewModelRatio)
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

func TestDreamRouterTieredBaselinesCoverUpstreamExprModels(t *testing.T) {
	// 2026-10-24 抓取时上游共 16 个 billing_expr 模型；基线表必须全覆盖，
	// 否则这些模型会被标记 tiered_unregistered 而不改价（静默不同步）。
	wantModels := []string{
		"claude-haiku-5-5", "gemini-2.5-pro", "gemini-3.1-flash-image",
		"gemini-3.1-pro-preview", "gemini-nano-banana-2.1", "gpt-5.5",
		"gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-6-astra",
		"gpt-6-luna", "gpt-6-sol", "gpt-image-2", "gpt-image-2.5-flare",
		"gpt-image-2.5-sunburst", "qwen3.6-flash",
	}
	if len(dreamRouterTieredBaselines) != len(wantModels) {
		t.Fatalf("baseline count = %d, want %d", len(dreamRouterTieredBaselines), len(wantModels))
	}
	for _, name := range wantModels {
		baseline, ok := dreamRouterTieredBaselines[name]
		if !ok {
			t.Errorf("missing baseline for %s", name)
			continue
		}
		if baseline.In <= 0 || baseline.R0 <= 0 || baseline.R0 > 1 {
			t.Errorf("%s: invalid baseline %+v", name, baseline)
		}
	}
}
