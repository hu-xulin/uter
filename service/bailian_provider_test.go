package service

import (
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/operation_setting"
	"gorm.io/gorm"
)

func TestBailianWorkspaceHosts(t *testing.T) {
	cases := []struct {
		region BailianRegion
		suffix string
	}{
		{BailianRegionBeijing, "cn-beijing.maas.aliyuncs.com"},
		{BailianRegionSingapore, "ap-southeast-1.maas.aliyuncs.com"},
		{BailianRegionHongKong, "cn-hongkong.maas.aliyuncs.com"},
		{BailianRegionGermany, "eu-central-1.maas.aliyuncs.com"},
		{BailianRegionJapan, "ap-northeast-1.maas.aliyuncs.com"},
		{BailianRegionUS, "us-east-1.maas.aliyuncs.com"},
	}
	for _, tc := range cases {
		base, err := BailianWorkspaceBaseURL(tc.region, "ws-test")
		require.NoError(t, err)
		assert.Equal(t, "https://ws-test."+tc.suffix, base)
		workspace, region, ok := ParseBailianWorkspace(base)
		assert.True(t, ok)
		assert.Equal(t, "ws-test", workspace)
		assert.Equal(t, tc.region, region)
	}
	_, err := BailianWorkspaceBaseURL(BailianRegionBeijing, "")
	require.Error(t, err)
	_, err = BailianWorkspaceBaseURL(BailianRegionBeijing, "ws/evil")
	require.Error(t, err)
}

func TestBailianPriceNormalization(t *testing.T) {
	catalog := &BailianCatalog{
		Region:    BailianRegionBeijing,
		FetchedAt: time.Date(2026, 11, 19, 0, 0, 0, 0, time.UTC),
		Models: []BailianModel{{
			Model:             "qwen4-max",
			Provider:          "qwen",
			InferenceProvider: "aliyun-bailian",
			Prices: []BailianPriceRange{
				{RangeName: "Default", Prices: []BailianPrice{
					{Type: "input_token", Price: "10", PriceUnit: "每百万tokens", PriceName: "输入", TimeBand: "standard"},
					{Type: "output_token", Price: "30", PriceUnit: "每百万tokens", PriceName: "输出", TimeBand: "standard"},
					{Type: "input_token_cache", Price: "0.5", PriceUnit: "每百万tokens", PriceName: "缓存命中", TimeBand: "standard"},
				}},
				{RangeName: "0-32K", Prices: []BailianPrice{
					{Type: "input_token", Price: "12.5", PriceUnit: "每百万tokens", TimeBand: "peak"},
					{Type: "output_token", Price: "not-a-number", PriceUnit: "每百万tokens"},
				}},
				{RangeName: "image", Prices: []BailianPrice{
					{Type: "image_output", Price: "0.2", PriceUnit: "每张"},
				}},
			},
		}},
	}
	prices := NormalizeBailianPrices(catalog)
	require.Len(t, prices, 6)
	assert.Equal(t, "CNY", prices[0].Currency)
	assert.True(t, prices[0].CurrencyInferred)
	assert.Equal(t, "per_1m_tokens", prices[0].Unit)
	assert.Equal(t, 10.0, prices[0].PriceValue)
	assert.Equal(t, "0-32K", prices[3].RangeName)
	assert.Equal(t, "peak", prices[3].TimeBand)
	assert.Equal(t, 0.0, prices[4].PriceValue, "unparsable numbers keep raw and report 0")
	assert.Equal(t, "not-a-number", prices[4].Price)
	assert.Equal(t, "per_image", prices[5].Unit)
	assert.Equal(t, "bailian-channel", prices[0].Source)
}

func TestBailianMetadataMapping(t *testing.T) {
	item := BailianModel{
		Model:       "qwen4-max",
		Name:        "Qwen4-Max",
		Description: "旗舰多模态模型",
		Provider:    "qwen",
		Capabilities: []string{
			"TG", "Reasoning", "VU",
		},
		Features:      []string{"function-calling", "web-search", "cache"},
		PublishedTime: "2026-11-16 10:00:00",
		InferenceMetadata: map[string]any{
			"request_modality":  []any{"Text", "Image", "Video"},
			"response_modality": []any{"Text"},
		},
		ModelInfo: map[string]any{
			"context_window":    float64(1000000),
			"max_output_tokens": float64(131072),
		},
	}
	values := BailianMetadata(item)
	assert.Equal(t, "旗舰多模态模型", values.Description)
	assert.Equal(t, "Qwen", values.Vendor)
	assert.Equal(t, 1000000, values.ContextLength)
	assert.Equal(t, 131072, values.MaxOutputTokens)
	assert.Equal(t, "2026-11-16", values.ReleaseDate)
	assert.Equal(t, "image,text,video", values.InputModalities)
	assert.Equal(t, "text", values.OutputModalities)
	assert.Equal(t, model.NameRuleExact, values.NameRule)
	assert.Contains(t, values.Tags, "Reasoning")
}

func TestApplyBailianCatalogKeepsManualFieldsAndChannelScope(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Model{}, &model.Vendor{}, &model.Option{}, &model.VendorMergeRule{}, &model.Ability{}, &model.Channel{}))
	previous := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previous })

	manualDescription := "手工维护的描述"
	local := model.Model{
		ModelName:   "qwen4-max",
		Description: manualDescription,
		VendorID:    0,
		Status:      1,
		NameRule:    model.NameRuleExact,
	}
	require.NoError(t, db.Create(&local).Error)

	catalog := &BailianCatalog{
		Region: BailianRegionBeijing,
		Models: []BailianModel{
			{
				Model: "qwen4-max", Provider: "qwen", Description: "官方描述",
				InferenceMetadata: map[string]any{"request_modality": []any{"Text"}},
				ModelInfo:         map[string]any{"context_window": float64(1000000)},
			},
			{
				Model: "catalog-only", Provider: "qwen", Description: "目录独有",
				InferenceMetadata: map[string]any{"request_modality": []any{"Text"}},
			},
		},
	}
	result, err := ApplyBailianCatalog(catalog, []string{"qwen4-max"})
	require.NoError(t, err)
	assert.Equal(t, 1, result.MatchedModels)
	assert.Equal(t, 2, result.CatalogModels)

	var stored model.Model
	require.NoError(t, db.Where("model_name = ?", "qwen4-max").First(&stored).Error)
	assert.Equal(t, manualDescription, stored.Description, "manual description must not be overwritten")
	assert.Equal(t, 1000000, stored.ContextLength, "blank specs are filled")

	var catalogOnly int64
	require.NoError(t, db.Model(&model.Model{}).Where("model_name = ?", "catalog-only").Count(&catalogOnly).Error)
	assert.Zero(t, catalogOnly, "catalog-only models must not be added to the channel")

	second, err := ApplyBailianCatalog(catalog, []string{"qwen4-max"})
	require.NoError(t, err)
	require.NotNil(t, second.Metadata)
	assert.Zero(t, len(second.Metadata.CreatedModels), "repeat apply must not create models")
	assert.Zero(t, len(second.Metadata.UpdatedModels), "repeat apply must be idempotent")
}

func TestBailianPricingRecordsStayChannelScoped(t *testing.T) {
	previousRate := operation_setting.USDExchangeRate
	operation_setting.USDExchangeRate = 7.3
	t.Cleanup(func() { operation_setting.USDExchangeRate = previousRate })

	catalog := &BailianCatalog{
		ChannelID: 5,
		Region:    BailianRegionBeijing,
		FetchedAt: time.Date(2026, 11, 19, 0, 0, 0, 0, time.UTC),
		Models: []BailianModel{
			{
				Model: "qwen-plus", Provider: "qwen", InferenceProvider: "aliyun-bailian",
				Prices: []BailianPriceRange{{
					RangeName: "Default",
					Prices: []BailianPrice{
						{Type: "input_token", Price: "10", PriceUnit: "每百万tokens", TimeBand: "standard"},
						{Type: "output_token", Price: "30", PriceUnit: "每百万tokens", TimeBand: "standard"},
					},
				}},
			},
			{
				Model: "not-served", Provider: "qwen", InferenceProvider: "aliyun-bailian",
			},
		},
	}
	records := BailianPricingRecords(catalog, []string{"qwen-plus"})
	require.Len(t, records, 1)
	assert.Equal(t, 5, records[0].ChannelId)
	assert.Equal(t, "aliyun-bailian", records[0].Provider)
	assert.Contains(t, records[0].OfficialPricing, "qwen-plus")
	assert.Empty(t, records[0].InternalPricing, "official sync must not create a sale price")

	var normalized model.ChannelOfficialPricing
	require.NoError(t, common.UnmarshalJsonStr(records[0].NormalizedPricing, &normalized))
	require.Empty(t, normalized.Tiers, "Bailian publishes the channel quote, not the vendor official list")
	require.Len(t, normalized.ChannelPriceTiers, 1)
	require.NotNil(t, normalized.ChannelPriceTiers[0].InputPerMillionUSD)
	require.NotNil(t, normalized.ChannelPriceTiers[0].OutputPerMillionUSD)
	assert.InDelta(t, 10.0/7.3, *normalized.ChannelPriceTiers[0].InputPerMillionUSD, 1e-9)
	assert.InDelta(t, 30.0/7.3, *normalized.ChannelPriceTiers[0].OutputPerMillionUSD, 1e-9)
	assert.False(t, normalized.NeedsReview)
}

func TestBailianPricingRecordsPreserveTiersAndRanges(t *testing.T) {
	previousRate := operation_setting.USDExchangeRate
	operation_setting.USDExchangeRate = 7.3
	t.Cleanup(func() { operation_setting.USDExchangeRate = previousRate })

	catalog := &BailianCatalog{
		ChannelID: 6,
		Region:    BailianRegionBeijing,
		FetchedAt: time.Now(),
		Models: []BailianModel{{
			Model: "qwen-tiered", Provider: "qwen", InferenceProvider: "aliyun-bailian",
			Prices: []BailianPriceRange{
				{RangeName: "0-32K", Prices: []BailianPrice{
					{Type: "input_token", Price: "10", PriceUnit: "每百万tokens"},
					{Type: "output_token", Price: "30", PriceUnit: "每百万tokens"},
				}},
				{RangeName: "32K-128K", Prices: []BailianPrice{
					{Type: "input_token", Price: "20", PriceUnit: "每百万tokens"},
					{Type: "output_token", Price: "60", PriceUnit: "每百万tokens"},
				}},
			},
		}},
	}
	records := BailianPricingRecords(catalog, []string{"qwen-tiered"})
	require.Len(t, records, 1)
	var normalized model.ChannelOfficialPricing
	require.NoError(t, common.UnmarshalJsonStr(records[0].NormalizedPricing, &normalized))
	require.Empty(t, normalized.Tiers)
	require.Len(t, normalized.ChannelPriceTiers, 2)
	assert.True(t, normalized.NeedsReview)
	assert.Contains(t, normalized.ReviewReasons, "multiple price ranges")
	assert.Equal(t, int64(0), normalized.ChannelPriceTiers[0].MinInputTokens)
	assert.Equal(t, int64(32*1024), normalized.ChannelPriceTiers[0].MaxInputTokens)
	assert.Equal(t, int64(32*1024), normalized.ChannelPriceTiers[1].MinInputTokens)
	assert.Equal(t, int64(128*1024), normalized.ChannelPriceTiers[1].MaxInputTokens)
}

func TestSeedBailianInternalPricingIsExplicit(t *testing.T) {
	setupBatchPricingDB(t)
	input, output := 3.0, 6.0
	normalized, _ := common.Marshal(model.ChannelOfficialPricing{
		Currency: "USD",
		Unit:     "per_1m_token",
		ChannelPriceTiers: []model.ChannelPricingTier{{
			RangeName:           "Default",
			InputPerMillionUSD:  &input,
			OutputPerMillionUSD: &output,
			Unit:                "per_1m_token",
		}},
	})
	_, err := model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{{
		ChannelId: 41, Provider: "aliyun-bailian", ModelName: "qwen-plus",
		Currency: "USD", OfficialPricing: `{}`, NormalizedPricing: string(normalized),
		Source: "bailian-official", FetchedAt: 100,
	}})
	require.NoError(t, err)

	row, err := model.GetChannelModelPricing(41, "qwen-plus")
	require.NoError(t, err)
	require.Equal(t, model.ChannelPricingStatusOfficialOnly, row.PricingStatus)
	require.Empty(t, row.InternalPricing)
	if _, ok := model.ResolveChannelBillingPricing(41, "qwen-plus"); ok {
		t.Fatal("official-only row must not bill before an explicit seed")
	}

	seeded, skipped, err := SeedBailianInternalPricing(41, nil, false)
	require.NoError(t, err)
	require.Equal(t, 1, seeded)
	require.Zero(t, skipped)
	pricing, ok := model.ResolveChannelBillingPricing(41, "qwen-plus")
	require.True(t, ok)
	assert.InDelta(t, 1.5, pricing.ModelRatio, 1e-9)

	// A later sync does not create a sale price, but an operator-seeded one is
	// retained because its source is no longer the automatic provider value.
	manual := model.ChannelInternalPricing{
		Mode: model.ChannelPricingModePerCall, PerCallUSD: floatPtr64(0.1),
	}
	require.NoError(t, model.SetChannelInternalPricing(41, "qwen-plus", manual))
	updated := model.ChannelOfficialPricingRecord{
		ChannelId: 41, Provider: "aliyun-bailian", ModelName: "qwen-plus",
		Currency: "USD", OfficialPricing: `{}`, NormalizedPricing: string(normalized),
		Source: "bailian-official", FetchedAt: 200,
	}
	_, err = model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{updated})
	require.NoError(t, err)
	row, err = model.GetChannelModelPricing(41, "qwen-plus")
	require.NoError(t, err)
	require.Equal(t, model.ChannelPricingStatusConfigured, row.PricingStatus)
	require.Contains(t, row.InternalPricing, `"per_call"`)
}

func floatPtr64(value float64) *float64 { return &value }
