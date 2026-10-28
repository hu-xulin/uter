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

package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/service"
)

// TestGetDreamRouterSyncModelsReturnsComparison 锁定「渠道登录与同步」对照表
// 的响应契约。
//
// 页面要同时展示上游与 Uter 两侧的名称、原价、折扣比率、折扣价，并给出
// 逐行对齐结论。这些字段全部来自同步快照；接口一旦少给一侧（例如只回
// uter 的折扣、不回上游的），前端就只能显示半张表——这正是「折扣没获取到」
// 在页面上的表现。
func TestGetDreamRouterSyncModelsReturnsComparison(t *testing.T) {
	restore := setDreamRouterSnapshotForTest(t, &service.DreamRouterSnapshot{
		PricingVersion: "v-test",
		SyncedAt:       time.Unix(1_700_000_000, 0).UTC(),
		RuleDirection:  "decrease",
		RuleAmount:     0.1,
		ChannelID:      7,
		Models: []service.DreamRouterModelRow{
			{
				UpstreamName: "gpt-4o", LocalName: "gpt-4o", BillingClass: "per_token",
				GroupRatio:              0.6,
				Official:                service.DreamRouterPriceLine{Input: 2.5, Output: 10},
				Upstream:                service.DreamRouterPriceLine{Input: 1.5, Output: 6},
				Uter:                    service.DreamRouterPriceLine{Input: 1.25, Output: 5},
				UpstreamDiscountPercent: 40,
				UterDiscountPercent:     50,
				UpstreamZhe:             6,
				UterZhe:                 5,
				Aligned:                 true,
			},
			{
				UpstreamName: "claude-x", LocalName: "claude-x", BillingClass: "per_token",
				GroupRatio:              0.8,
				Official:                service.DreamRouterPriceLine{Input: 3},
				Upstream:                service.DreamRouterPriceLine{Input: 2.4},
				Uter:                    service.DreamRouterPriceLine{Input: 3},
				UpstreamDiscountPercent: 20,
				UterDiscountPercent:     0,
				UpstreamZhe:             8,
				UterZhe:                 10,
				Aligned:                 false,
				Note:                    "uter 未按规则落价",
			},
		},
	})
	defer restore()

	body := decodeDreamRouterModelsResponse(t)

	require.True(t, body.Synced)
	assert.Equal(t, "v-test", body.PricingVersion)
	assert.Equal(t, "decrease", body.RuleDirection)
	assert.Equal(t, 0.1, body.RuleAmount)
	assert.Equal(t, 7, body.ChannelID)
	require.Len(t, body.Models, 2)

	first := body.Models[0]
	// 两侧的四列都必须齐：模型名 / 原价 / 折扣比率 / 折扣价。
	assert.Equal(t, "gpt-4o", first.UpstreamName)
	assert.Equal(t, "gpt-4o", first.LocalName)
	assert.Equal(t, 2.5, first.Official.Input, "官方原价")
	assert.Equal(t, 1.5, first.Upstream.Input, "上游折扣价")
	assert.Equal(t, 1.25, first.Uter.Input, "Uter 售价")
	assert.Equal(t, 40.0, first.UpstreamDiscountPercent, "上游折扣比率")
	assert.Equal(t, 50.0, first.UterDiscountPercent, "Uter 折扣比率")
	assert.Equal(t, 6.0, first.UpstreamZhe)
	assert.Equal(t, 5.0, first.UterZhe)
	assert.True(t, first.Aligned)

	assert.False(t, body.Models[1].Aligned)
	assert.Equal(t, "uter 未按规则落价", body.Models[1].Note)

	// 汇总必须能把「有偏差」直接算出来，页面顶部徽标据此显示。
	assert.Equal(t, 2, body.Summary.Total)
	assert.Equal(t, 1, body.Summary.Aligned)
	assert.Equal(t, 1, body.Summary.Drifted)
	assert.False(t, body.Summary.AllAligned)
}

// TestGetDreamRouterSyncModelsWithoutSnapshot 锁定「尚未同步」的空态：
// 返回 synced=false 而不是 500，页面据此提示先执行同步。
func TestGetDreamRouterSyncModelsWithoutSnapshot(t *testing.T) {
	restore := setDreamRouterSnapshotForTest(t, nil)
	defer restore()

	body := decodeDreamRouterModelsResponse(t)
	assert.False(t, body.Synced)
	assert.Empty(t, body.Models)
}

type dreamRouterModelsBody struct {
	Synced         bool                          `json:"synced"`
	PricingVersion string                        `json:"pricing_version"`
	RuleDirection  string                        `json:"rule_direction"`
	RuleAmount     float64                       `json:"rule_amount"`
	ChannelID      int                           `json:"channel_id"`
	Models         []service.DreamRouterModelRow `json:"models"`
	Summary        struct {
		Total      int  `json:"total"`
		Aligned    int  `json:"aligned"`
		Drifted    int  `json:"drifted"`
		AllAligned bool `json:"all_aligned"`
	} `json:"summary"`
}

func decodeDreamRouterModelsResponse(t *testing.T) dreamRouterModelsBody {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/ratio_sync/dreamrouter/models", nil)

	GetDreamRouterSyncModels(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)

	var envelope struct {
		Success bool                  `json:"success"`
		Data    dreamRouterModelsBody `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &envelope))
	require.True(t, envelope.Success)
	return envelope.Data
}

// dreamRouterSnapshotOptionKey 是快照在 options 表里的键。
//
// service 包把它保持为未导出常量；这里用字面量是为了不给生产代码开测试口子。
// 一旦改键，本用例与 service 包的单测会同时失败，改名不会被漏掉。
const dreamRouterSnapshotOptionKey = "DreamRouterSyncSnapshot"

// setDreamRouterSnapshotForTest 直接写入快照 option（绕过上游登录）。
//
// 不需要额外清缓存：service.LoadDreamRouterSnapshot 的缓存以「原始 JSON 串」
// 为键，换了内容自然重新解析，换回旧内容也能命中对应解析结果。
func setDreamRouterSnapshotForTest(t *testing.T, snapshot *service.DreamRouterSnapshot) func() {
	t.Helper()
	if common.OptionMap == nil {
		common.OptionMap = map[string]string{}
	}
	previous, had := common.OptionMap[dreamRouterSnapshotOptionKey]
	if snapshot == nil {
		delete(common.OptionMap, dreamRouterSnapshotOptionKey)
	} else {
		encoded, err := json.Marshal(snapshot)
		require.NoError(t, err)
		common.OptionMap[dreamRouterSnapshotOptionKey] = string(encoded)
	}
	return func() {
		if had {
			common.OptionMap[dreamRouterSnapshotOptionKey] = previous
		} else {
			delete(common.OptionMap, dreamRouterSnapshotOptionKey)
		}
	}
}
