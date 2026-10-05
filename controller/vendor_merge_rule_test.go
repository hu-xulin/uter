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
	"testing"

	"github.com/Uter-AI/Uter/common"
	"github.com/Uter-AI/Uter/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ByteDance 是定价广场按 "doubao" 规则合成的默认品牌（保留负 ID -1016）。
// 这些用例守护的诉求是「合并一次，后续同类来源自动跟进」：
//  1. 合并操作要把决策持久化下来；
//  2. 被合并的合成品牌不再出现在供应商管理列表；
//  3. 后续命中同一模型名规则的新模型自动归到合并目标，而不是把合成品牌重新生成出来。
func TestVendorMergeRuleAutoFollowsLaterVendors(t *testing.T) {
	db := modelManagementDB(t, "sqlite", "")

	target := model.Vendor{Name: "Volcano Engine", Icon: "Doubao"}
	require.NoError(t, target.Insert())

	channel := model.Channel{Name: "Merge rule fixture", Type: 1, Status: common.ChannelStatusEnabled}
	require.NoError(t, db.Create(&channel).Error)
	addAbility := func(name string) {
		require.NoError(t, db.Create(&model.Ability{Model: name, Group: "default", ChannelId: channel.Id, Enabled: true}).Error)
		model.RefreshPricing()
	}

	addAbility("doubao-pro-32k")

	counts, err := model.GetEffectiveVendorModelCounts()
	require.NoError(t, err)
	assert.NotZero(t, counts[-1016], "doubao 模型应归因到合成品牌 ByteDance")

	withDefaults, _, err := model.SearchVendorsIncludingDefaults("", 0, 200)
	require.NoError(t, err)
	var brandID int
	found := false
	for _, v := range withDefaults {
		if v.Name == "ByteDance" {
			brandID = v.Id
			found = true
		}
	}
	require.True(t, found, "合成品牌 ByteDance 必须在合并前出现在管理列表")
	assert.Negative(t, brandID, "合成品牌应携带负 ID")

	// 合并一次。
	preview, err := model.PreviewVendorOperation(model.VendorOperation{
		Action: "merge", VendorIDs: []int{brandID}, TargetVendorID: target.Id,
	})
	require.NoError(t, err)
	_, err = model.ApplyVendorOperation(model.VendorOperation{
		Action: "merge", VendorIDs: []int{brandID}, TargetVendorID: target.Id, ExpectedVersion: preview.Version,
	})
	require.NoError(t, err)

	// 1) 合并决策被记住，且只记一条。
	rules, err := model.ListVendorMergeRules()
	require.NoError(t, err)
	require.Len(t, rules, 1)
	assert.Equal(t, "ByteDance", rules[0].SourceName)
	assert.Equal(t, target.Id, rules[0].TargetVendorID)
	assert.Equal(t, "doubao", rules[0].SourcePatterns)

	// 2) 规则幂等：重复合并同一来源不得堆积孤儿规则行。
	require.NoError(t, model.RecordVendorMergeRule(model.DB, "ByteDance", []string{"doubao"}, target.Id))
	require.NoError(t, model.RecordVendorMergeRule(model.DB, "ByteDance", []string{"doubao"}, target.Id))
	rules, err = model.ListVendorMergeRules()
	require.NoError(t, err)
	assert.Len(t, rules, 1, "同一来源重复合并必须收敛为一条规则")

	// 3) 已合并的合成品牌不再作为可管理的独立条目出现。
	withDefaults, _, err = model.SearchVendorsIncludingDefaults("", 0, 200)
	require.NoError(t, err)
	for _, v := range withDefaults {
		assert.NotEqual(t, "ByteDance", v.Name, "已合并的合成品牌不应再出现在管理列表")
	}

	// 4) 核心诉求：后续进来的同类模型自动跟进到合并目标。
	addAbility("doubao-later-release")
	counts, err = model.GetEffectiveVendorModelCounts()
	require.NoError(t, err)
	assert.Zero(t, counts[-1016], "后续 doubao 模型不得再生成合成品牌 ByteDance")
	assert.Equal(t, int64(2), counts[int64(target.Id)], "两代 doubao 模型都应归到合并目标")
}
