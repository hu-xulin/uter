package service

import (
	"encoding/json"
	"testing"

	"github.com/uter-ai/uter/setting/billing_setting"
	"github.com/uter-ai/uter/setting/config"
)

// TestLoadDreamRouterOfficialReferenceLegacySnapshotPerSecondFallback 锁定升级
// 兼容路径：**旧快照没有 per_second 标记**（上线前写入的历史数据）时，
// 仍必须靠本地 billing_expr 的结构认出按秒计费模型，否则 ×586 的溢价角标
// 要等到下一轮同步才消失——同步失败的话永远不消失。
func TestLoadDreamRouterOfficialReferenceLegacySnapshotPerSecondFallback(t *testing.T) {
	before := config.GlobalConfig.ExportAllConfigs()
	t.Cleanup(func() {
		config.GlobalConfig.LoadFromDB(map[string]string{
			"billing_setting.billing_mode": before["billing_setting.billing_mode"],
			"billing_setting.billing_expr": before["billing_setting.billing_expr"],
		})
	})

	const expr = `u("resolution") == "1080P" ? tier("1080p", (duration > 0 ? duration : 5) * 0.12537315) : (u("resolution") == "480P" ? tier("480p", (duration > 0 ? duration : 5) * 0.03134327) : tier("720p", (duration > 0 ? duration : 5) * 0.06268654))`
	// 表达式里含大量双引号，手写 JSON 字符串极易转义出错（会导致整条静默
	// 不装载）。用 json.Marshal 生成，与线上落库路径完全一致。
	modeJSON, err := json.Marshal(map[string]string{"wan3.0-video": "tiered_expr"})
	if err != nil {
		t.Fatalf("marshal mode: %v", err)
	}
	exprJSON, err := json.Marshal(map[string]string{"wan3.0-video": expr})
	if err != nil {
		t.Fatalf("marshal expr: %v", err)
	}
	if err := config.UpdateConfigFromMap(
		config.GlobalConfig.Get("billing_setting"),
		map[string]string{
			"billing_mode": string(modeJSON),
			"billing_expr": string(exprJSON),
		},
	); err != nil {
		t.Fatalf("装载 billing_setting 失败: %v", err)
	}
	if _, ok := billing_setting.GetBillingExpr("wan3.0-video"); !ok {
		t.Fatal("前置条件不成立：billing_expr 未装载")
	}

	// 历史快照：billing_class=tiered，**没有 per_second 字段**。
	setDreamRouterSnapshot(t, `{
		"pricing_version":"legacy","synced_at":"2026-11-04T09:31:19+08:00",
		"rule_direction":"increase","rule_amount":0.1,"channel_id":20,
		"models":[
			{"upstream_name":"wan3.0-video","local_name":"wan3.0-video",
			 "billing_class":"tiered","quota_type":0,"group_ratio":0.6,
			 "official":{"input":0.0895522},
			 "upstream":{"input":0.05373132},
			 "uter":{"input":0.06268654}}
		]}`)

	entry, ok := LoadDreamRouterOfficialReference()["wan3.0-video"]
	if !ok {
		t.Fatal("旧快照的按秒模型也必须给出官方参照价")
	}
	if _, found := entry["model_ratio"]; found {
		t.Error("旧快照也绝不能下发 model_ratio：那会算出 ×586 溢价")
	}
	if !nearlyEqualSync(entry[officialPerSecondField], 0.0895522) {
		t.Errorf("%s = %v, want 0.0895522",
			officialPerSecondField, entry[officialPerSecondField])
	}
}
