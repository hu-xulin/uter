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

// TestLoadDreamRouterOfficialReferenceSkipsPerSecondModels 锁定「按秒计费的
// 视频模型不能被换算成 token 倍率」。
//
// 回归背景（2026-11-04 用户反馈）：wan3.0-video 与 wan3.0-video-prime 的
// 卡片角标显示 `×586.25` / `×390.83`，实际是 -30% 折扣。根因是快照里
// Official.Input 的单位是**美元/秒**（0.0895522），却被按「美元/1M tokens」
// 的规则 ÷2 得到 model_ratio=0.0447761；前端再拿真实的 model_ratio=26.25
// 去除它，就是 586 倍溢价。
//
// 正确行为：按秒模型下发独立的 `official_price_per_second`（原值，不缩放），
// 且**绝不**写入 model_ratio。
func TestLoadDreamRouterOfficialReferenceSkipsPerSecondModels(t *testing.T) {
	setDreamRouterSnapshot(t, `{
		"pricing_version": "test-persecond",
		"synced_at": "2026-11-04T09:31:19+08:00",
		"rule_direction": "increase",
		"rule_amount": 0.1,
		"channel_id": 20,
		"models": [
			{"upstream_name":"wan3.0-video","local_name":"wan3.0-video",
			 "billing_class":"tiered","per_second":true,"quota_type":0,
			 "group_ratio":0.6,
			 "official":{"input":0.0895522,"output":0,"cache":0,"create_cache":0},
			 "upstream":{"input":0.05373132,"output":0,"cache":0,"create_cache":0},
			 "uter":{"input":0.06268654,"output":0,"cache":0,"create_cache":0}},
			{"upstream_name":"wan3.0-video-prime","local_name":"wan3.0-video-prime",
			 "billing_class":"tiered","per_second":true,"quota_type":0,
			 "group_ratio":0.6,
			 "official":{"input":0.1343284,"output":0,"cache":0,"create_cache":0},
			 "upstream":{"input":0.08059704,"output":0,"cache":0,"create_cache":0},
			 "uter":{"input":0.09402988,"output":0,"cache":0,"create_cache":0}}
		]
	}`)

	reference := LoadDreamRouterOfficialReference()
	if reference == nil {
		t.Fatal("reference is nil")
	}

	for name, wantPerSecond := range map[string]float64{
		"wan3.0-video":       0.0895522,
		"wan3.0-video-prime": 0.1343284,
	} {
		entry, ok := reference[name]
		if !ok {
			t.Fatalf("%s 缺失：按秒模型也必须有官方参照价", name)
		}
		// 官方秒价必须原值下发，不能被 /2 缩放。
		if !nearlyEqualSync(entry[officialPerSecondField], wantPerSecond) {
			t.Errorf("%s %s = %v, want %v（原值，不缩放）",
				name, officialPerSecondField, entry[officialPerSecondField], wantPerSecond)
		}
		// 关键断言：绝不能出现 model_ratio —— 那正是 ×586 倍溢价的来源。
		if _, found := entry["model_ratio"]; found {
			t.Errorf("%s 不得下发 model_ratio（单位是美元/秒，与 token 倍率不同构）",
				name)
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

func TestMergeChannelModelNamesAddsOnlyNewModels(t *testing.T) {
	added := mergeChannelModelNames(
		[]string{"gpt-a", " claude-b "},
		[]string{"claude-b", "gpt-a", "gpt-new", ""},
	)
	if len(added) != 1 || added[0] != "gpt-new" {
		t.Fatalf("added = %v, want [gpt-new]", added)
	}
	if added := mergeChannelModelNames([]string{"gpt-a"}, []string{"gpt-a"}); len(added) != 0 {
		t.Fatalf("added = %v, want empty", added)
	}
}
