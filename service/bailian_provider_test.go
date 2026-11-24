package service

import (
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/pkg/billingexpr"
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
	assert.Equal(t, "alibaba-bailian", records[0].Provider)
	assert.Equal(t, "aliyun-bailian", records[0].ModelProvider)
	assert.Contains(t, records[0].OfficialPricing, "qwen-plus")
	assert.Empty(t, records[0].InternalPricing, "official sync must not create a sale price")

	var normalized model.ChannelOfficialPricing
	require.NoError(t, common.UnmarshalJsonStr(records[0].NormalizedPricing, &normalized))
	require.Empty(t, normalized.Tiers, "Bailian publishes a channel quote, not the vendor list price")
	require.Len(t, normalized.ChannelPriceTiers, 1)
	require.NotNil(t, normalized.ChannelPriceTiers[0].InputPerMillionUSD)
	require.NotNil(t, normalized.ChannelPriceTiers[0].OutputPerMillionUSD)
	assert.InDelta(t, 10.0/7.3, normalized.ChannelPriceTiers[0].InputPerMillionUSD.Float64(), 1e-9)
	assert.InDelta(t, 30.0/7.3, normalized.ChannelPriceTiers[0].OutputPerMillionUSD.Float64(), 1e-9)
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
	// Token tiers are fully representable by one tiered expression.
	assert.False(t, normalized.NeedsReview, normalized.ReviewReasons)
	assert.Equal(t, int64(0), normalized.ChannelPriceTiers[0].MinInputTokens)
	assert.Equal(t, int64(32*1024), normalized.ChannelPriceTiers[0].MaxInputTokens)
	assert.Equal(t, int64(32*1024), normalized.ChannelPriceTiers[1].MinInputTokens)
	assert.Equal(t, int64(128*1024), normalized.ChannelPriceTiers[1].MaxInputTokens)
}

func TestBailianTTSUnitsBecomeExecutablePrices(t *testing.T) {
	previousRate := operation_setting.USDExchangeRate
	operation_setting.USDExchangeRate = 7.3
	t.Cleanup(func() { operation_setting.USDExchangeRate = previousRate })

	price := func(unit string) []BailianPriceRange {
		return []BailianPriceRange{{
			RangeName: "Default",
			Prices: []BailianPrice{{
				Type: "cosy_tts_number", Price: "7.3", PriceUnit: unit, TimeBand: "standard",
			}},
		}}
	}
	catalog := &BailianCatalog{
		ChannelID: 7,
		Region:    BailianRegionBeijing,
		FetchedAt: time.Now(),
		Models: []BailianModel{
			{Model: "tts-per-10k-chars", Prices: price("每万字符")},
			{Model: "tts-per-call", Prices: price("每次")},
		},
	}
	records := BailianPricingRecords(catalog, []string{"tts-per-10k-chars", "tts-per-call"})
	require.Len(t, records, 2)

	var chars model.ChannelOfficialPricing
	require.NoError(t, common.UnmarshalJsonStr(records[0].NormalizedPricing, &chars))
	require.Len(t, chars.ChannelPriceTiers, 1)
	require.NotNil(t, chars.ChannelPriceTiers[0].InputPerMillionUSD)
	assert.InDelta(t, 100, chars.ChannelPriceTiers[0].InputPerMillionUSD.Float64(), 1e-9, "one character bills as one token, so 1 USD per 10k chars is 100 USD per 1M")
	assert.Equal(t, "per_1m_tokens", chars.ChannelPriceTiers[0].Unit)
	assert.False(t, chars.NeedsReview)

	var call model.ChannelOfficialPricing
	require.NoError(t, common.UnmarshalJsonStr(records[1].NormalizedPricing, &call))
	require.Len(t, call.ChannelPriceTiers, 1)
	require.NotNil(t, call.ChannelPriceTiers[0].PerUnitUSD)
	assert.InDelta(t, 1, call.ChannelPriceTiers[0].PerUnitUSD.Float64(), 1e-9)
	assert.Equal(t, "per_call", call.ChannelPriceTiers[0].Unit)
	assert.False(t, call.NeedsReview)

	internal := bailianInternalPricing(chars)
	require.NotEmpty(t, internal)
	assert.Contains(t, internal, `"mode":"per_1m_token"`)
	internal = bailianInternalPricing(call)
	require.NotEmpty(t, internal)
	assert.Contains(t, internal, `"mode":"per_call"`)
}

func TestBailianMultimodalPrimaryTokenPrice(t *testing.T) {
	previousRate := operation_setting.USDExchangeRate
	operation_setting.USDExchangeRate = 1
	t.Cleanup(func() { operation_setting.USDExchangeRate = previousRate })

	omni := BailianModel{Model: "omni-flash", Prices: []BailianPriceRange{{
		RangeName: "Default",
		Prices: []BailianPrice{
			{Type: "text_input_token", Price: "1.8", PriceUnit: "每百万tokens"},
			{Type: "audio_input_token", Price: "15.8", PriceUnit: "每百万tokens"},
			{Type: "vision_input_token", Price: "3.3", PriceUnit: "每百万tokens"},
			{Type: "purein_text_output_token", Price: "6.9", PriceUnit: "每百万tokens"},
			{Type: "multi_output_token", Price: "62.6", PriceUnit: "每百万tokens"},
			{Type: "thinking_text_input_token", Price: "1.8", PriceUnit: "每百万tokens"},
		},
	}}}
	normalized := bailianOfficialPricing(omni, BailianRegionBeijing, 1, 100)
	require.Len(t, normalized.ChannelPriceTiers, 1)
	tier := normalized.ChannelPriceTiers[0]
	require.NotNil(t, tier.InputPerMillionUSD)
	require.NotNil(t, tier.OutputPerMillionUSD)
	require.NotNil(t, tier.AudioInputPerMillionUSD)
	require.NotNil(t, tier.AudioOutputPerMillionUSD)
	assert.InDelta(t, 1.8, tier.InputPerMillionUSD.Float64(), 1e-9, "text input stays the primary input price")
	assert.InDelta(t, 6.9, tier.OutputPerMillionUSD.Float64(), 1e-9)
	assert.InDelta(t, 15.8, tier.AudioInputPerMillionUSD.Float64(), 1e-9)
	assert.InDelta(t, 62.6, tier.AudioOutputPerMillionUSD.Float64(), 1e-9)
	assert.NotContains(t, normalized.ReviewReasons, "multiple input token prices")
	require.NotNil(t, tier.ImageInputPerMillionUSD)
	assert.InDelta(t, 3.3, tier.ImageInputPerMillionUSD.Float64(), 1e-9)
	internal := bailianInternalPricing(normalized)
	require.NotEmpty(t, internal)
	var pricing model.ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(internal, &pricing))
	assert.Contains(t, pricing.BillingExpr, "img * 3.3")
	assert.Contains(t, pricing.BillingExpr, "ai * 15.8")

	sameVision := BailianModel{Model: "omni-same", Prices: []BailianPriceRange{{
		RangeName: "Default",
		Prices: []BailianPrice{
			{Type: "text_input_token", Price: "1.8", PriceUnit: "每百万tokens"},
			{Type: "vision_input_token", Price: "1.8", PriceUnit: "每百万tokens"},
			{Type: "purein_text_output_token", Price: "6.9", PriceUnit: "每百万tokens"},
		},
	}}}
	normalized = bailianOfficialPricing(sameVision, BailianRegionBeijing, 1, 100)
	assert.Empty(t, normalized.ReviewReasons)
	assert.NotEmpty(t, bailianInternalPricing(normalized), "identical modality prices are the same price")

	mt := BailianModel{Model: "mt-uni", Prices: []BailianPriceRange{{
		RangeName: "Default",
		Prices: []BailianPrice{
			{Type: "mt_character_input_token", Price: "65", PriceUnit: "每百万tokens"},
			{Type: "mt_image_input_token", Price: "32", PriceUnit: "每百万tokens"},
		},
	}}}
	normalized = bailianOfficialPricing(mt, BailianRegionBeijing, 1, 100)
	require.NotNil(t, normalized.ChannelPriceTiers[0].InputPerMillionUSD)
	assert.InDelta(t, 65, normalized.ChannelPriceTiers[0].InputPerMillionUSD.Float64(), 1e-9)
	require.NotNil(t, normalized.ChannelPriceTiers[0].ImageInputPerMillionUSD)
	assert.InDelta(t, 32, normalized.ChannelPriceTiers[0].ImageInputPerMillionUSD.Float64(), 1e-9)
	assert.NotContains(t, normalized.ReviewReasons, "multiple input token prices")
	internal = bailianInternalPricing(normalized)
	require.NotEmpty(t, internal)
	require.NoError(t, common.UnmarshalJsonStr(internal, &pricing))
	assert.Contains(t, pricing.BillingExpr, "img * 32")
}

func TestBailianThinkingPricesBecomeReasoningAware(t *testing.T) {
	previousRate := operation_setting.USDExchangeRate
	operation_setting.USDExchangeRate = 1
	t.Cleanup(func() { operation_setting.USDExchangeRate = previousRate })

	item := BailianModel{Model: "qwen-plus", Prices: []BailianPriceRange{{
		RangeName: "Default",
		Prices: []BailianPrice{
			{Type: "input_token", Price: "2", PriceUnit: "每百万tokens"},
			{Type: "output_token", Price: "2", PriceUnit: "每百万tokens"},
			{Type: "thinking_input_token", Price: "2", PriceUnit: "每百万tokens"},
			{Type: "thinking_output_token", Price: "8", PriceUnit: "每百万tokens"},
			{Type: "input_token_cache", Price: "0.16", PriceUnit: "每百万tokens"},
			{Type: "thinking_input_token_cache", Price: "0.32", PriceUnit: "每百万tokens"},
		},
	}}}
	normalized := bailianOfficialPricing(item, BailianRegionBeijing, 1, 100)
	assert.Empty(t, normalized.ReviewReasons)
	internal := bailianInternalPricing(normalized)
	require.NotEmpty(t, internal)
	var pricing model.ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(internal, &pricing))
	assert.Contains(t, pricing.BillingExpr, "c * (rt > 0 ? 8 : 2)")
	assert.Contains(t, pricing.BillingExpr, "cr * (rt > 0 ? 0.32 : 0.16)")
}

func TestBailianPerCallServiceNextToTokenPrice(t *testing.T) {
	previousRate := operation_setting.USDExchangeRate
	operation_setting.USDExchangeRate = 1
	t.Cleanup(func() { operation_setting.USDExchangeRate = previousRate })

	speech := BailianModel{Model: "speech-02-hd", Prices: []BailianPriceRange{{
		RangeName: "Default",
		Prices: []BailianPrice{
			{Type: "tts_vc_model", Price: "9.9", PriceUnit: "每次", PriceName: "声音复刻及声音设计"},
			{Type: "cosy_tts_number", Price: "3.5", PriceUnit: "每万字符", PriceName: "语音合成"},
		},
	}}}
	normalized := bailianOfficialPricing(speech, BailianRegionBeijing, 1, 100)
	require.Len(t, normalized.ChannelPriceTiers, 1)
	require.NotNil(t, normalized.ChannelPriceTiers[0].InputPerMillionUSD)
	assert.InDelta(t, 350, normalized.ChannelPriceTiers[0].InputPerMillionUSD.Float64(), 1e-9, "synthesis stays the billable primary")
	assert.Nil(t, normalized.ChannelPriceTiers[0].PerUnitUSD, "the per-call service must not become the flat price")
	require.Len(t, normalized.ComponentPrices, 1)
	component := normalized.ComponentPrices[0]
	assert.Equal(t, "per_call", component.Unit)
	assert.InDelta(t, 9.9, component.USD.Float64(), 1e-9)
	assert.Equal(t, "声音复刻及声音设计", component.Name)
	assert.NotContains(t, normalized.ReviewReasons, "mixed per-call and token prices")
	internal := bailianInternalPricing(normalized)
	require.NotEmpty(t, internal)
	assert.Contains(t, internal, `"mode":"per_1m_token"`)
}

func TestBailianInternalPricingRejectsConflictingPerCallPrices(t *testing.T) {
	two := 2.0
	normalized := model.ChannelOfficialPricing{
		ChannelPriceTiers: []model.ChannelPricingTier{{
			RangeName: "Default", Unit: "per_call", PerUnitUSD: model.MoneyFromFloatPtr(&two),
		}},
		ReviewReasons: []string{"multiple per-call prices"},
	}
	assert.Empty(t, bailianInternalPricing(normalized))
}

func TestSeedBailianInternalPricingIsExplicit(t *testing.T) {
	setupBatchPricingDB(t)
	input, output := 3.0, 6.0
	normalized, _ := common.Marshal(model.ChannelOfficialPricing{
		Currency: "USD",
		Unit:     "per_1m_token",
		ChannelPriceTiers: []model.ChannelPricingTier{{
			RangeName:           "Default",
			InputPerMillionUSD:  model.MoneyFromFloatPtr(&input),
			OutputPerMillionUSD: model.MoneyFromFloatPtr(&output),
			Unit:                "per_1m_token",
		}},
	})
	_, err := model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{{
		ChannelId: 41, Provider: "aliyun-bailian", ModelName: "qwen-plus",
		Currency: "USD", OfficialPricing: `{}`, NormalizedPricing: string(normalized),
		Source: "bailian-official", FetchedAt: time.Now().Unix() - 10,
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
	assert.InDelta(t, 1.5*DefaultUterSaleMarkup, pricing.ModelRatio, 1e-9)

	// A later sync does not create a sale price, but an operator-seeded one is
	// retained because its source is no longer the automatic provider value.
	manual := model.ChannelInternalPricing{
		Mode: model.ChannelPricingModePerCall, PerCallUSD: model.MoneyFromFloatPtr(floatPtr64(0.1)),
	}
	require.NoError(t, model.SetChannelInternalPricing(41, "qwen-plus", manual))
	updated := model.ChannelOfficialPricingRecord{
		ChannelId: 41, Provider: "aliyun-bailian", ModelName: "qwen-plus",
		Currency: "USD", OfficialPricing: `{}`, NormalizedPricing: string(normalized),
		Source: "bailian-official", FetchedAt: time.Now().Unix(),
	}
	_, err = model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{updated})
	require.NoError(t, err)
	row, err = model.GetChannelModelPricing(41, "qwen-plus")
	require.NoError(t, err)
	require.Equal(t, model.ChannelPricingStatusConfigured, row.PricingStatus)
	require.Contains(t, row.InternalPricing, `"per_call"`)
}

func floatPtr64(value float64) *float64 { return &value }

func TestBailianCacheAndBatchPriceMapping(t *testing.T) {
	previousRate := operation_setting.USDExchangeRate
	operation_setting.USDExchangeRate = 1
	t.Cleanup(func() { operation_setting.USDExchangeRate = previousRate })

	modelWithCache := BailianModel{Model: "qwen-cache", Prices: []BailianPriceRange{{
		RangeName: "Default",
		Prices: []BailianPrice{
			{Type: "input_token", Price: "2", PriceUnit: "每百万tokens"},
			{Type: "output_token", Price: "8", PriceUnit: "每百万tokens"},
			{Type: "input_token_cache", Price: "0.4", PriceUnit: "每百万tokens"},
			{Type: "input_token_cache_creation_5m", Price: "2.5", PriceUnit: "每百万tokens"},
			{Type: "input_token_batch", Price: "1", PriceUnit: "每百万tokens"},
			{Type: "output_token_batch", Price: "4", PriceUnit: "每百万tokens"},
		},
	}}}
	normalized := bailianOfficialPricing(modelWithCache, BailianRegionBeijing, 1, 100)
	require.False(t, normalized.NeedsReview)
	tier := normalized.ChannelPriceTiers[0]
	require.NotNil(t, tier.CachePerMillionUSD)
	require.NotNil(t, tier.CreateCachePerMillionUSD)
	assert.InDelta(t, 0.4, tier.CachePerMillionUSD.Float64(), 1e-9)
	assert.InDelta(t, 2.5, tier.CreateCachePerMillionUSD.Float64(), 1e-9)
	assert.NotContains(t, tier.RawPriceTypes, "input_token_batch", "batch endpoints are a separate service")

	internal := bailianInternalPricing(normalized)
	require.NotEmpty(t, internal)
	assert.Contains(t, internal, `"cache_per_million_usd":0.4`)
	assert.Contains(t, internal, `"create_cache_per_million_usd":2.5`)
}

func TestBailianImageDimensionPricesBecomeTaskExpression(t *testing.T) {
	previousRate := operation_setting.USDExchangeRate
	operation_setting.USDExchangeRate = 1
	t.Cleanup(func() { operation_setting.USDExchangeRate = previousRate })

	image := BailianModel{Model: "qwen-image-3.0", Prices: []BailianPriceRange{{
		RangeName: "Default",
		Prices: []BailianPrice{
			{Type: "qima_input_1k", Price: "0.02", PriceUnit: "每张"},
			{Type: "qima_input_2k", Price: "0.18", PriceUnit: "每张"},
			{Type: "qima_output_1k", Price: "0.02", PriceUnit: "每张"},
			{Type: "qima_output_2k", Price: "0.18", PriceUnit: "每张"},
		},
	}}}
	normalized := bailianOfficialPricing(image, BailianRegionBeijing, 1, 100)
	assert.Empty(t, normalized.ReviewReasons)
	internal := bailianInternalPricing(normalized)
	require.NotEmpty(t, internal)
	var pricing model.ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(internal, &pricing))
	assert.Contains(t, pricing.BillingExpr, `u("output_image_type") == "qima_output_2k"`)
	assert.Contains(t, pricing.BillingExpr, `u("input_image_count")`)

	zimage := BailianModel{Model: "z-image-turbo", Prices: []BailianPriceRange{{
		RangeName: "Default",
		Prices: []BailianPrice{
			{Type: "image_standard", Price: "0.1", PriceUnit: "每张"},
			{Type: "image_thinking", Price: "0.2", PriceUnit: "每张"},
		},
	}}}
	normalized = bailianOfficialPricing(zimage, BailianRegionBeijing, 1, 100)
	assert.Empty(t, normalized.ReviewReasons)
	internal = bailianInternalPricing(normalized)
	require.NotEmpty(t, internal)
	require.NoError(t, common.UnmarshalJsonStr(internal, &pricing))
	assert.Contains(t, pricing.BillingExpr, `u("prompt_extend")`)
}

func TestBailianUnsupportedTimeBandsStayReviewOnly(t *testing.T) {
	previousRate := operation_setting.USDExchangeRate
	operation_setting.USDExchangeRate = 1
	t.Cleanup(func() { operation_setting.USDExchangeRate = previousRate })

	timeBanded := BailianModel{Model: "deepseek-v4-flash", Prices: []BailianPriceRange{{
		RangeName: "Default",
		Prices: []BailianPrice{
			{Type: "input_token", Price: "1", PriceUnit: "每百万tokens", TimeBand: "峰时"},
			{Type: "output_token", Price: "4", PriceUnit: "每百万tokens", TimeBand: "峰时"},
			{Type: "input_token", Price: "0.5", PriceUnit: "每百万tokens", TimeBand: "非峰时"},
			{Type: "output_token", Price: "2", PriceUnit: "每百万tokens", TimeBand: "非峰时"},
		},
	}}}
	normalized := bailianOfficialPricing(timeBanded, BailianRegionBeijing, 1, 100)
	assert.Contains(t, normalized.ReviewReasons, "unsupported time band: 峰时")
	assert.Empty(t, bailianInternalPricing(normalized))
}

func TestBailianPeakOffpeakPricingBecomesTimeAware(t *testing.T) {
	previousRate := operation_setting.USDExchangeRate
	operation_setting.USDExchangeRate = 1
	t.Cleanup(func() { operation_setting.USDExchangeRate = previousRate })

	timeBanded := BailianModel{Model: "deepseek-v4-flash", Prices: []BailianPriceRange{{
		RangeName: "Default",
		Prices: []BailianPrice{
			{Type: "input_token", Price: "2", PriceUnit: "每百万tokens", TimeBand: "peak"},
			{Type: "output_token", Price: "8", PriceUnit: "每百万tokens", TimeBand: "peak"},
			{Type: "input_token", Price: "1", PriceUnit: "每百万tokens", TimeBand: "offpeak"},
			{Type: "output_token", Price: "4", PriceUnit: "每百万tokens", TimeBand: "offpeak"},
		},
	}}}
	normalized := bailianOfficialPricing(timeBanded, BailianRegionBeijing, 1, 100)
	assert.Empty(t, normalized.ReviewReasons)
	internal := bailianInternalPricing(normalized)
	require.NotEmpty(t, internal)
	var pricing model.ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(internal, &pricing))
	assert.Contains(t, pricing.BillingExpr, `hour("Asia/Shanghai") >= 22`)
	assert.Contains(t, pricing.BillingExpr, "peak:Default")
	assert.Contains(t, pricing.BillingExpr, "offpeak:Default")
}

func TestBailianSynchronousASRDurationPriceStaysReviewOnly(t *testing.T) {
	previousRate := operation_setting.USDExchangeRate
	operation_setting.USDExchangeRate = 1
	t.Cleanup(func() { operation_setting.USDExchangeRate = previousRate })

	asr := BailianModel{
		Model: "qwen-audio-3.0-asr-flash", Capabilities: []string{"ASR"},
		Prices: []BailianPriceRange{{
			RangeName: "Default",
			Prices: []BailianPrice{{
				Type: "content_duration", Price: "0.00022", PriceUnit: "每秒",
			}},
		}},
	}
	normalized := bailianOfficialPricing(asr, BailianRegionBeijing, 1, 100)
	assert.Contains(t, normalized.ReviewReasons, "duration-based audio requires task billing")
	assert.Empty(t, bailianInternalPricing(normalized), "the relay cannot settle ASR duration per second")

	video := BailianModel{
		Model: "wan-video", Capabilities: []string{"Video-Generation"},
		Prices: []BailianPriceRange{{
			RangeName: "Default",
			Prices: []BailianPrice{{
				Type: "content_duration", Price: "0.08", PriceUnit: "每秒",
			}},
		}},
	}
	normalized = bailianOfficialPricing(video, BailianRegionBeijing, 1, 100)
	assert.NotContains(t, normalized.ReviewReasons, "duration-based audio requires task billing")
	assert.NotEmpty(t, bailianInternalPricing(normalized), "async video tasks support per-second settlement")
}

func TestBailianMultiTierAudioBecomesExpression(t *testing.T) {
	item := BailianModel{Model: "qwen-audio-tiered", Prices: []BailianPriceRange{
		{RangeName: "0-32k", Prices: []BailianPrice{
			{Type: "input_token", Price: "1", PriceUnit: "每百万tokens", TimeBand: "standard"},
			{Type: "audio_input_token", Price: "2", PriceUnit: "每百万tokens", TimeBand: "standard"},
		}},
		{RangeName: "32k-128k", Prices: []BailianPrice{
			{Type: "input_token", Price: "2", PriceUnit: "每百万tokens", TimeBand: "standard"},
			{Type: "audio_input_token", Price: "4", PriceUnit: "每百万tokens", TimeBand: "standard"},
		}},
	}}
	view := bailianOfficialPricing(item, BailianRegionBeijing, 1, 100)
	assert.Empty(t, view.ReviewReasons)
	internal := bailianInternalPricing(view)
	require.NotEmpty(t, internal)
	var pricing model.ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(internal, &pricing))
	assert.Contains(t, pricing.BillingExpr, "ai * 2")
	assert.Contains(t, pricing.BillingExpr, "ai * 4")
	for _, tier := range view.ChannelPriceTiers {
		require.NotNil(t, tier.AudioInputPerMillionUSD, "the audio dimension must stay visible")
	}
}

func TestBailianMultiTierMixedUnitsStayReviewOnly(t *testing.T) {
	item := BailianModel{Model: "mixed-units", Prices: []BailianPriceRange{
		{RangeName: "0-32k", Prices: []BailianPrice{
			{Type: "input_token", Price: "1", PriceUnit: "每百万tokens", TimeBand: "standard"},
		}},
		{RangeName: "32k-128k", Prices: []BailianPrice{
			{Type: "video_duration", Price: "0.3", PriceUnit: "每秒", TimeBand: "standard"},
		}},
	}}
	view := bailianOfficialPricing(item, BailianRegionBeijing, 1, 100)
	require.True(t, view.NeedsReview, view.ReviewReasons)
	assert.Contains(t, view.ReviewReasons, "mixed price units across tiers need manual pricing")
	assert.Empty(t, bailianInternalPricing(view))
}

func TestBailianTokenTiersBecomeCompleteExpression(t *testing.T) {
	item := BailianModel{Model: "qwen-long-context", Prices: []BailianPriceRange{
		{RangeName: "0-32k", Prices: []BailianPrice{
			{Type: "input_token", Price: "1", PriceUnit: "每百万tokens", TimeBand: "standard"},
			{Type: "output_token", Price: "4", PriceUnit: "每百万tokens", TimeBand: "standard"},
		}},
		{RangeName: "32k-128k", Prices: []BailianPrice{
			{Type: "input_token", Price: "2", PriceUnit: "每百万tokens", TimeBand: "standard"},
			{Type: "output_token", Price: "8", PriceUnit: "每百万tokens", TimeBand: "standard"},
		}},
	}}
	view := bailianOfficialPricing(item, BailianRegionBeijing, 1, 100)
	require.False(t, view.NeedsReview, view.ReviewReasons)
	encoded := bailianInternalPricing(view)
	require.NotEmpty(t, encoded)
	var internal model.ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(encoded, &internal))
	assert.Equal(t, model.ChannelPricingModeTieredExpr, internal.Mode)
	assert.Contains(t, internal.BillingExpr, `tier("0-32k"`)
	assert.Contains(t, internal.BillingExpr, `tier("32k-128k"`)
	assert.Contains(t, internal.BillingExpr, "len <= 32768")
	if _, err := billingexpr.CompileFromCache(internal.BillingExpr); err != nil {
		t.Fatalf("tiered expression does not compile: %v", err)
	}
}

func TestBailianSeenModelsIncludesAliasesAndExcludesRemovedModels(t *testing.T) {
	catalog := &BailianCatalog{Models: []BailianModel{{Model: "qwen-plus"}, {Model: "qwen-max"}}}
	seen := BailianSeenChannelModels(catalog, []string{"qwen-plus", "cmaas-qwen-max", "qwen-removed"})
	require.Equal(t, []string{"qwen-plus", "cmaas-qwen-max"}, seen)
}

func TestBailianPricingKeepsRawCurrencyUnitAndFXAudit(t *testing.T) {
	previousRate := operation_setting.USDExchangeRate
	operation_setting.USDExchangeRate = 7.3
	t.Cleanup(func() { operation_setting.USDExchangeRate = previousRate })

	catalog := &BailianCatalog{
		ChannelID: 93, Region: BailianRegionBeijing, FetchedAt: time.Unix(1234, 0),
		Models: []BailianModel{{
			Model: "qwen-audit", Provider: "qwen", InferenceProvider: "aliyun-bailian",
			Prices: []BailianPriceRange{{
				RangeName: "Default",
				Prices: []BailianPrice{{
					Type: "input_token", Price: "10", PriceUnit: "每百万tokens",
				}},
			}},
		}},
	}
	records := BailianPricingRecords(catalog, []string{"qwen-audit"})
	require.Len(t, records, 1)
	var view model.ChannelOfficialPricing
	require.NoError(t, common.UnmarshalJsonStr(records[0].NormalizedPricing, &view))
	require.Empty(t, view.Tiers)
	require.Len(t, view.ChannelPriceTiers, 1)
	require.Len(t, view.ChannelPriceTiers[0].RawComponents, 1)
	raw := view.ChannelPriceTiers[0].RawComponents[0]
	assert.Equal(t, 10.0, raw.RawAmount.Float64())
	assert.Equal(t, "CNY", raw.RawCurrency)
	assert.Equal(t, "每百万tokens", raw.RawUnit)
	assert.InDelta(t, 10.0/7.3, raw.NormalizedUSD.Float64(), 1e-9)
	assert.Equal(t, 7.3, raw.FXRate)
	assert.True(t, raw.CurrencyInferred)
	assert.Equal(t, "bailian-channel", raw.PriceSource)
	assert.Equal(t, int64(1234), raw.FXTimestamp)
}

func TestBuildBailianCatalogCoverageMarksUnmatchedModels(t *testing.T) {
	setupBatchPricingDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Channel{}))
	channel := model.Channel{Id: 96, Name: "bailian", Type: 17, Models: "qwen-a,private-x", Status: 1}
	require.NoError(t, model.DB.Create(&channel).Error)

	catalog := &BailianCatalog{ChannelID: 96, Models: []BailianModel{{Model: "qwen-a"}}}
	raw, err := common.Marshal(catalog)
	require.NoError(t, err)
	if common.OptionMap == nil {
		common.OptionMap = map[string]string{}
	}
	old, had := common.OptionMap[BailianCatalogSnapshotKey+":96"]
	common.OptionMap[BailianCatalogSnapshotKey+":96"] = string(raw)
	t.Cleanup(func() {
		if had {
			common.OptionMap[BailianCatalogSnapshotKey+":96"] = old
		} else {
			delete(common.OptionMap, BailianCatalogSnapshotKey+":96")
		}
	})
	_, err = model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{
		{ChannelId: 96, Provider: "alibaba-bailian", ModelName: "private-x", Currency: "USD", NormalizedPricing: `{}`, Source: "bailian-channel"},
	})
	require.NoError(t, err)
	price := 2.0
	require.NoError(t, model.SetChannelInternalPricing(96, "private-x", model.ChannelInternalPricing{
		Mode: model.ChannelPricingModePerMillionTokens, InputUSDPerMillion: model.MoneyFromFloatPtr(&price), OutputUSDPerMillion: model.MoneyFromFloatPtr(&price), Source: "manual",
	}))

	report, err := BuildBailianCatalogCoverage(96)
	require.NoError(t, err)
	require.Equal(t, 1, report.Matched)
	require.Equal(t, 1, report.Unmatched)
	byName := map[string]BailianCoverageModel{}
	for _, item := range report.Models {
		byName[item.ModelName] = item
	}
	require.Equal(t, "KEEP_MANUAL", byName["private-x"].Action)
	require.Equal(t, "IN_CATALOG", byName["qwen-a"].Action)
}

func TestBailianUnknownAndUSRegionsAreExplicit(t *testing.T) {
	assert.Equal(t, BailianRegionUS, BailianRegionOf("https://dashscope-us.aliyuncs.com"))
	assert.Equal(t, BailianRegionBeijing, BailianRegionOf("https://dashscope.aliyuncs.com"))
	assert.Equal(t, BailianRegionUnspecified, BailianRegionOf("https://dashscope-unknown.aliyuncs.com"))

	catalog := &BailianCatalog{Region: BailianRegionUnspecified, Models: []BailianModel{{Model: "m"}}}
	assert.Empty(t, BailianPricingRecords(catalog, []string{"m"}), "unknown region must not produce price records")
	currency, inferred := bailianCurrencyForRegion(BailianRegionUnspecified)
	assert.Empty(t, currency)
	assert.False(t, inferred)
}

func TestBailianMissingOutputIsNotFreeAndCacheConflictsBlock(t *testing.T) {
	input := 1.0
	missingOutput := model.ChannelOfficialPricing{
		Currency: "USD", Unit: "per_1m_token",
		ChannelPriceTiers: []model.ChannelPricingTier{{
			RangeName: "Default", InputPerMillionUSD: model.MoneyFromFloatPtr(&input), Unit: "per_1m_token",
			RawPriceTypes: []string{"text_input_token"},
		}},
	}
	assert.Empty(t, bailianInternalPricing(missingOutput), "chat model without output must stay review-only")

	conflict := model.ChannelOfficialPricing{
		Currency: "USD", Unit: "per_1m_token",
		ReviewReasons: []string{"multiple cache read prices"},
		ChannelPriceTiers: []model.ChannelPricingTier{{
			RangeName: "Default", InputPerMillionUSD: model.MoneyFromFloatPtr(&input), OutputPerMillionUSD: model.MoneyFromFloatPtr(&input),
			Unit: "per_1m_token",
		}},
	}
	assert.Empty(t, bailianInternalPricing(conflict), "conflicting cache prices must block automatic pricing")

	ttsInput := 100.0
	tts := model.ChannelOfficialPricing{
		Currency: "USD", Unit: "per_1m_token",
		ChannelPriceTiers: []model.ChannelPricingTier{{
			RangeName: "Default", InputPerMillionUSD: model.MoneyFromFloatPtr(&ttsInput), Unit: "per_1m_tokens",
			RawPriceTypes: []string{"cosy_tts_number"},
		}},
	}
	assert.NotEmpty(t, bailianInternalPricing(tts), "audio synthesis has no output-token dimension")
}

func TestSeedBailianRefreshesAutomaticPriceWithDefaultMarkup(t *testing.T) {
	setupBatchPricingDB(t)
	input, output := 3.0, 6.0
	normalized, _ := common.Marshal(model.ChannelOfficialPricing{
		Currency: "USD", Unit: "per_1m_token",
		ChannelPriceTiers: []model.ChannelPricingTier{{
			RangeName: "Default", InputPerMillionUSD: model.MoneyFromFloatPtr(&input),
			OutputPerMillionUSD: model.MoneyFromFloatPtr(&output), Unit: "per_1m_token",
		}},
	})
	_, err := model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{{
		ChannelId: 42, Provider: "aliyun-bailian", ModelName: "qwen-auto",
		Currency: "USD", OfficialPricing: `{}`, NormalizedPricing: string(normalized),
		Source: "bailian-official", FetchedAt: time.Now().Unix(),
	}})
	require.NoError(t, err)
	require.NoError(t, model.SetChannelInternalPricingFor(model.ChannelPricingIdentity{
		ChannelId: 42, Provider: "aliyun-bailian", ModelName: "qwen-auto",
	}, model.ChannelInternalPricing{
		Mode:               model.ChannelPricingModePerMillionTokens,
		InputUSDPerMillion: model.MoneyFromFloatPtr(&input), OutputUSDPerMillion: model.MoneyFromFloatPtr(&output), Source: "bailian-channel",
	}))

	seeded, _, err := SeedBailianInternalPricing(42, nil, false)
	require.NoError(t, err)
	assert.Equal(t, 1, seeded)
	pricing, ok := model.ResolveChannelBillingPricing(42, "qwen-auto")
	require.True(t, ok)
	assert.InDelta(t, 3*DefaultUterSaleMarkup/2, pricing.ModelRatio, 1e-9)
}

// 原始币种与标准化金额币种必须分开记录，不能从 Currency 再次推断金额单位。
func TestBailianCurrencyProvenanceIsExplicit(t *testing.T) {
	item := BailianModel{
		Model: "qwen-provenance",
		Prices: []BailianPriceRange{{
			RangeName: "Default",
			Prices: []BailianPrice{
				{Type: "input_token", Price: "10", PriceUnit: "每百万tokens"},
			},
		}},
	}
	view := bailianOfficialPricing(item, BailianRegionBeijing, 7, 100)

	assert.Equal(t, "CNY", view.SourceCurrency)
	assert.Equal(t, "USD", view.NormalizedCurrency)
	assert.True(t, view.CurrencyInferred)
	require.NotEmpty(t, view.ChannelPriceTiers)
	require.NotEmpty(t, view.ChannelPriceTiers[0].RawComponents)
	component := view.ChannelPriceTiers[0].RawComponents[0]
	assert.Equal(t, "CNY", component.SourceCurrency)
	assert.Equal(t, "USD", component.NormalizedCurrency)
	assert.Equal(t, 10.0, component.RawAmount.Float64())
	require.NotNil(t, view.ChannelPriceTiers[0].InputPerMillionUSD)
	assert.InDelta(t, 10.0/7, view.ChannelPriceTiers[0].InputPerMillionUSD.Float64(), 1e-9)

	catalog := &BailianCatalog{
		Region: BailianRegionBeijing,
		Models: []BailianModel{item},
	}
	reference := NormalizeBailianPrices(catalog)
	require.Len(t, reference, 1)
	assert.Equal(t, "CNY", reference[0].SourceCurrency)
	assert.Equal(t, "USD", reference[0].NormalizedCurrency)
}

// 币种无法确认或缺少汇率时必须进入待审核，不能自动发布。
func TestBailianUnconfirmedCurrencyNeedsReview(t *testing.T) {
	item := BailianModel{
		Model: "qwen-unknown",
		Prices: []BailianPriceRange{{
			RangeName: "Default",
			Prices: []BailianPrice{
				{Type: "input_token", Price: "10", PriceUnit: "每百万tokens"},
			},
		}},
	}

	unknown := bailianOfficialPricing(item, BailianRegionUnspecified, 7, 100)
	assert.True(t, unknown.NeedsReview)
	assert.Empty(t, unknown.SourceCurrency)
	assert.Empty(t, unknown.NormalizedCurrency)
	assert.Contains(t, unknown.ReviewReasons, "source currency cannot be confirmed")

	noRate := bailianOfficialPricing(item, BailianRegionBeijing, 0, 100)
	assert.True(t, noRate.NeedsReview)
	assert.Contains(t, noRate.ReviewReasons, "CNY quote has no valid USD exchange rate")
}
