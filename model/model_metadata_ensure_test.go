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

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// prepareEnsureModelRowsDB 为 EnsureModelRows 准备最小表结构。
//
// 共享的 TestMain 只迁移业务主表，模型元数据两张表由本文件按需迁移，
// 用完即删，避免污染其他用例。options 表是 metadataTransaction 的锁锚点
// （metadata_sync_lock），缺表会让写入整体失败，因此必须一并迁移。
func prepareEnsureModelRowsDB(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(&Model{}, &Vendor{}, &Option{}))
	t.Cleanup(func() {
		DB.Exec("DELETE FROM models")
		DB.Exec("DELETE FROM vendors")
		DB.Exec("DELETE FROM options WHERE key = ?", "metadata_sync_lock")
	})
}

// TestEnsureModelRowsCreatesMissingRowsOnly 锁定「只建不改」与「只认已存在
// 供应商」两条约束。
//
// 背景：官方目录不认识的渠道私有模型（seedance-* 等）永远没有元数据行，
// 定价页拿不到 vendor_id，按供应商筛选时整条模型不可见。
func TestEnsureModelRowsCreatesMissingRowsOnly(t *testing.T) {
	prepareEnsureModelRowsDB(t)

	vendor := &Vendor{Name: "字节跳动", Icon: "Doubao"}
	require.NoError(t, DB.Create(vendor).Error)
	existing := &Model{ModelName: "existing-model", Description: "运营手填的简介", Icon: "Kept", VendorID: vendor.Id, Status: 1, SyncOfficial: 1}
	require.NoError(t, DB.Create(existing).Error)

	created, err := EnsureModelRows(map[string]string{
		"existing-model": "字节跳动",
		"seedance-2.0":   "字节跳动",
		"unknown-vendor": "上游新出现的供应商",
	})
	require.NoError(t, err)
	require.ElementsMatch(t, []string{"seedance-2.0", "unknown-vendor"}, created)

	var rows []Model
	require.NoError(t, DB.Order("model_name").Find(&rows).Error)
	require.Len(t, rows, 3)

	// 已存在的行一个字段都不能动。
	require.Equal(t, "运营手填的简介", rows[0].Description)
	require.Equal(t, "Kept", rows[0].Icon)
	require.Equal(t, vendor.Id, rows[0].VendorID)

	// 新建行按已存在的供应商名归属。
	require.Equal(t, vendor.Id, rows[1].VendorID, "seedance-2.0 应归到字节跳动")

	// 供应商名匹配不到时留空——绝不自动新建供应商。
	require.Zero(t, rows[2].VendorID)
	var vendorCount int64
	require.NoError(t, DB.Model(&Vendor{}).Count(&vendorCount).Error)
	require.EqualValues(t, 1, vendorCount, "不得为上游新名字自动创建供应商")
}

// TestEnsureModelRowsRespectsNameRules 确保已被名称规则覆盖的模型不建显式行。
//
// 显式行会遮蔽运营设置的 catch-all 规则，改变该模型下所有字段的归因。
func TestEnsureModelRowsRespectsNameRules(t *testing.T) {
	prepareEnsureModelRowsDB(t)

	pattern := &Model{ModelName: "seedance", NameRule: NameRulePrefix, Status: 1, SyncOfficial: 1}
	require.NoError(t, DB.Create(pattern).Error)

	created, err := EnsureModelRows(map[string]string{"seedance-2.0": "字节跳动"})
	require.NoError(t, err)
	require.Empty(t, created, "已被前缀规则覆盖的模型不应建显式行")
}

// TestEnsureModelRowsNoopOnEmptyInput 空输入不查库、不报错。
func TestEnsureModelRowsNoopOnEmptyInput(t *testing.T) {
	created, err := EnsureModelRows(nil)
	require.NoError(t, err)
	require.Empty(t, created)
}

// TestEnsureModelRowsInfersVendorFromSiblings 锁定「上游中文供应商名 → 本地
// 英文供应商」的归属反推。
//
// 上游创梦的 vendors[] 用中文名（字节跳动 / 阿里巴巴 / 智谱 …），本地 vendors
// 用英文名（ByteDance / Alibaba / Z.AI …），运营还会合并、软删除重名供应商。
// 直接按名字查不到时，用「同一上游供应商下已归属的模型」反推——否则
// seedance-* 这类渠道私有命名的模型建出来的行没有供应商，定价页按供应商
// 筛选时仍然看不见，等于没修。
func TestEnsureModelRowsInfersVendorFromSiblings(t *testing.T) {
	prepareEnsureModelRowsDB(t)

	byteDance := &Vendor{Name: "ByteDance", Icon: "ByteDance"}
	require.NoError(t, DB.Create(byteDance).Error)
	// 已归属的兄弟模型：它就是「字节跳动 = ByteDance」的证据。
	require.NoError(t, DB.Create(&Model{
		ModelName: "doubao-seedream-4-5-251128", VendorID: byteDance.Id, Status: 1, SyncOfficial: 1,
	}).Error)

	created, err := EnsureModelRows(map[string]string{
		"doubao-seedream-4-5-251128": "字节跳动",
		"seedance-2.0":               "字节跳动",
		"seedance-2.5":               "字节跳动",
	})
	require.NoError(t, err)
	require.ElementsMatch(t, []string{"seedance-2.0", "seedance-2.5"}, created)

	var rows []Model
	require.NoError(t, DB.Order("model_name").Find(&rows).Error)
	require.Len(t, rows, 3)
	for _, row := range rows {
		require.Equal(t, byteDance.Id, row.VendorID, "%s 应继承兄弟模型反推出的供应商", row.ModelName)
	}
}

// TestInferUpstreamVendorIDsPicksMajorityAndSkipsActiveNames 锁定反推的两条
// 细节：多票取多数；名字本身能命中时不做反推。
func TestInferUpstreamVendorIDsPicksMajorityAndSkipsActiveNames(t *testing.T) {
	locals := map[string]*Model{
		"a": {ModelName: "a", VendorID: 7},
		"b": {ModelName: "b", VendorID: 7},
		"c": {ModelName: "c", VendorID: 9},
	}
	aliases := inferUpstreamVendorIDs(
		locals,
		map[string]string{"a": "智谱", "b": "智谱", "c": "智谱", "d": "OpenAI"},
		// 只有启用中的供应商才可作为反推目标（软删除的不算）。
		map[string]int{"OpenAI": 3, "Z.AI": 7, "XAI": 9},
	)
	require.Equal(t, 7, aliases["智谱"], "应取出现次数最多的本地供应商")
	require.NotContains(t, aliases, "OpenAI", "名字能直接命中的供应商不参与反推")
}
