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
	"testing"

	"github.com/uter-ai/uter/common"
)

// setDreamRouterSnapshot 在测试里写入一份快照 option，并在用例结束时还原。
//
// common.OptionMap 在未初始化 DB 的测试进程里是 nil，必须先建表再写，
// 否则「往 nil map 赋值」会 panic。
func setDreamRouterSnapshot(t *testing.T, raw string) {
	t.Helper()
	if common.OptionMap == nil {
		common.OptionMap = map[string]string{}
	}
	previous, existed := common.OptionMap[dreamRouterSyncSnapshotKey]
	common.OptionMap[dreamRouterSyncSnapshotKey] = raw
	t.Cleanup(func() {
		if existed {
			common.OptionMap[dreamRouterSyncSnapshotKey] = previous
			return
		}
		delete(common.OptionMap, dreamRouterSyncSnapshotKey)
	})
}

// TestLoadDreamRouterOfficialReferenceFromSnapshot 锁定「定价页官方价参照
// 来自上游快照」这条链路：上游官方价 $5/1M + 输出 $25 + 缓存 $0.5 必须换算成
// 倍率空间的 model_ratio 2.5 / completion_ratio 5 / cache_ratio 0.1。
//
// 这是「折扣没获取到」的修复点：公开定价页此前只认 basellm / models.dev 预设，
// 上游私有模型在预设里查不到 → 卡片没有官方价、没有折扣徽标。
func TestLoadDreamRouterOfficialReferenceFromSnapshot(t *testing.T) {
	setDreamRouterSnapshot(t, `{
		"pricing_version": "test-version",
		"synced_at": "2026-10-26T19:00:00+08:00",
		"rule_direction": "increase",
		"rule_amount": 0.1,
		"channel_id": 20,
		"models": [
			{"upstream_name":"claude-opus-4-5","local_name":"claude-opus-4-5",
			 "billing_class":"per_token","quota_type":0,"group_ratio":0.6,
			 "official":{"input":5,"output":25,"cache":0.5,"create_cache":6.25},
			 "upstream":{"input":3,"output":15,"cache":0.3,"create_cache":3.75},
			 "uter":{"input":3.5,"output":17.5,"cache":0.35,"create_cache":4.375},
			 "upstream_discount_percent":40,"uter_discount_percent":30,
			 "upstream_zhe":6,"uter_zhe":7,"aligned":true},
			{"upstream_name":"doubao-seedream-4-0-250828","local_name":"seedream-4-0",
			 "billing_class":"per_call","quota_type":1,"group_ratio":0.85,
			 "official":{"input":0.029},
			 "upstream":{"input":0.02465},
			 "uter":{"input":0.02755},
			 "upstream_discount_percent":15,"uter_discount_percent":5,
			 "upstream_zhe":8.5,"uter_zhe":9.5,"aligned":true}
		]
	}`)

	reference := LoadDreamRouterOfficialReference()
	if reference == nil {
		t.Fatal("reference is nil")
	}

	token, ok := reference["claude-opus-4-5"]
	if !ok {
		t.Fatal("claude-opus-4-5 missing from reference")
	}
	if !nearlyEqualSync(token["model_ratio"], 2.5) {
		t.Errorf("model_ratio = %v, want 2.5（$5/1M ÷ 2）", token["model_ratio"])
	}
	if !nearlyEqualSync(token["completion_ratio"], 5) {
		t.Errorf("completion_ratio = %v, want 5", token["completion_ratio"])
	}
	if !nearlyEqualSync(token["cache_ratio"], 0.1) {
		t.Errorf("cache_ratio = %v, want 0.1", token["cache_ratio"])
	}
	if !nearlyEqualSync(token["create_cache_ratio"], 1.25) {
		t.Errorf("create_cache_ratio = %v, want 1.25", token["create_cache_ratio"])
	}

	// 按次计费模型用 model_price 表达官方价，且本地名与上游名都能查到。
	for _, name := range []string{"doubao-seedream-4-0-250828", "seedream-4-0"} {
		perCall, ok := reference[name]
		if !ok {
			t.Fatalf("%s missing from reference", name)
		}
		if !nearlyEqualSync(perCall["model_price"], 0.029) {
			t.Errorf("%s model_price = %v, want 0.029", name, perCall["model_price"])
		}
	}
}

// TestLoadDreamRouterOfficialReferenceEmpty 锁定「没同步过就没有参照」：
// 不能返回空 map 之外的任何默认值，否则定价页会拿平台自己的价当官方价。
func TestLoadDreamRouterOfficialReferenceEmpty(t *testing.T) {
	setDreamRouterSnapshot(t, "")
	if reference := LoadDreamRouterOfficialReference(); reference != nil {
		t.Errorf("reference = %v, want nil", reference)
	}
	setDreamRouterSnapshot(t, "not json")
	if reference := LoadDreamRouterOfficialReference(); reference != nil {
		t.Errorf("invalid json reference = %v, want nil", reference)
	}
}

func TestDreamRouterDiscountPercentAndZhe(t *testing.T) {
	cases := []struct {
		official, actual float64
		wantPercent      float64
		wantZhe          float64
	}{
		{5, 3.5, 30, 7},
		{5, 3, 40, 6},
		{1.14, 0.3705, 67.5, 3.25},
		// 售价不低于官方价时没有折扣，折数按 10 折（不是 0）。
		{5, 5, 0, 10},
		{5, 6, 0, 12},
		// 官方价缺失时不编造折扣。
		{0, 3, 0, 10},
		{5, 0, 0, 10},
	}
	for _, c := range cases {
		if got := discountPercent(c.official, c.actual); !nearlyEqualSync(got, c.wantPercent) {
			t.Errorf("discountPercent(%v,%v) = %v, want %v", c.official, c.actual, got, c.wantPercent)
		}
		if got := zheOf(c.actual, c.official); !nearlyEqualSync(got, c.wantZhe) {
			t.Errorf("zheOf(%v,%v) = %v, want %v", c.actual, c.official, got, c.wantZhe)
		}
	}
}

// TestDreamRouterRowAligned 锁定对齐判定：只有「写入成功且等于官方价×系数」
// 才算对齐；表达式解析失败或降价规则非正（本次没改价）一律未对齐。
func TestDreamRouterRowAligned(t *testing.T) {
	base := DreamRouterModelChange{
		Name:         "claude-opus-4-5",
		BillingClass: "per_token",
		Factor:       0.7,
		Official:     DreamRouterPriceLine{Input: 5},
	}

	aligned := DreamRouterModelRow{Official: base.Official, Uter: DreamRouterPriceLine{Input: 3.5}}
	if !dreamRouterRowAligned(base, aligned) {
		t.Error("3.5 = 5 × 0.7 应判为已对齐")
	}

	drifted := DreamRouterModelRow{Official: base.Official, Uter: DreamRouterPriceLine{Input: 5}}
	if dreamRouterRowAligned(base, drifted) {
		t.Error("售价仍为官方原价应判为未对齐")
	}

	unparsable := base
	unparsable.BillingClass = "tiered_unparsable"
	if dreamRouterRowAligned(unparsable, aligned) {
		t.Error("表达式解析失败（未改价）不得判为已对齐")
	}

	skipped := base
	skipped.Factor = 0
	if dreamRouterRowAligned(skipped, aligned) {
		t.Error("降价规则非正而跳过时不得判为已对齐")
	}
}
