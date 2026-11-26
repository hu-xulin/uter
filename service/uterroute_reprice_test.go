package service

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

func TestUterRouteOfficialPriceChangeDetection(t *testing.T) {
	before := map[string]channelOfficialPricePoint{
		"model-a": {official: 10, channel: 8},
		"model-b": {official: 20, channel: 16},
		"model-c": {official: 30, channel: 24},
	}
	after := map[string]channelOfficialPricePoint{
		"model-a": {official: 12, channel: 8},  // 官方价变化 → 需重算
		"model-b": {official: 20, channel: 14}, // 渠道价变化 → 需重算
		"model-c": {official: 30, channel: 24}, // 无变化 → 跳过
		"model-d": {official: 40, channel: 32}, // 新增 → 需重算
	}
	served := []string{"model-a", "model-b", "model-c", "model-d"}
	changed := channelOfficialPriceChanged(before, after, served)
	require.ElementsMatch(t, []string{"model-a", "model-b", "model-d"}, changed)

	// 未服务的模型即使变化也不触发重算。
	changed = channelOfficialPriceChanged(before, after, []string{"model-c"})
	require.Empty(t, changed)
}

func TestUterRouteRepriceChangedChannelRespectsManualPrice(t *testing.T) {
	setupBatchPricingDB(t)
	_, err := model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{
		batchOfficialRecord(1, "model-a"),
		batchOfficialRecord(1, "model-b"),
	})
	require.NoError(t, err)

	schedule := ChannelPricingSchedule{
		ApplyOnSync: true, Basis: BatchPricingBasisOfficial,
		Mode: BatchPricingModeDiscount, Value: 0.5,
	}
	updated := repriceChangedChannel(1, []string{"model-a", "model-b"}, schedule)
	require.Equal(t, 2, updated, "both auto-priced models must be repriced")

	rows, err := model.ListChannelModelPricing(1)
	require.NoError(t, err)
	require.Len(t, rows, 2)
	for _, row := range rows {
		var pricing model.ChannelInternalPricing
		require.NoError(t, common.UnmarshalJsonStr(row.InternalPricing, &pricing))
		require.Equal(t, 1.5, pricing.InputUSDPerMillion.Float64(), "official 3 * 0.5")
	}

	// 手填价不能被自动重算覆盖。
	require.NoError(t, model.SetChannelInternalPricing(1, "model-a", model.ChannelInternalPricing{
		Mode:                model.ChannelPricingModePerMillionTokens,
		InputUSDPerMillion:  model.MoneyFromFloatPtr(floatPtrForTest(9)),
		OutputUSDPerMillion: model.MoneyFromFloatPtr(floatPtrForTest(18)),
		Source:              "operator", Note: "manual",
	}))
	beforeRows, err := model.ListChannelModelPricing(1)
	require.NoError(t, err)
	manualPrice := ""
	for _, row := range beforeRows {
		if row.ModelName == "model-a" {
			manualPrice = row.InternalPricing
		}
	}
	updated = repriceChangedChannel(1, []string{"model-a", "model-b"}, schedule)
	require.Equal(t, 1, updated, "only the non-manual model should be repriced")
	afterRows, err := model.ListChannelModelPricing(1)
	require.NoError(t, err)
	for _, row := range afterRows {
		if row.ModelName == "model-a" {
			require.Equal(t, manualPrice, row.InternalPricing, "hand-edited price must survive")
		}
	}
}

func TestUterRouteRepriceNoOpWithoutRule(t *testing.T) {
	setupBatchPricingDB(t)
	_, err := model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{
		batchOfficialRecord(1, "model-a"),
	})
	require.NoError(t, err)
	require.Equal(t, 0, repriceChangedChannel(1, []string{"model-a"}, ChannelPricingSchedule{}))
	require.Equal(t, 0, repriceChangedChannel(1, []string{"model-a"}, ChannelPricingSchedule{ApplyOnSync: true}))
	require.Equal(t, 0, repriceChangedChannel(1, []string{"model-a"}, ChannelPricingSchedule{
		ApplyOnSync: true, Mode: BatchPricingModeNone,
	}))
	require.Equal(t, 0, repriceChangedChannel(1, nil, ChannelPricingSchedule{
		ApplyOnSync: true, Mode: BatchPricingModeDiscount, Value: 0.5,
	}))
}

func floatPtrForTest(v float64) *float64 { return &v }
