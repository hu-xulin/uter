package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"gorm.io/gorm"
)

func setupChannelModelPricingDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&ChannelModelPricing{}))
	previous := DB
	DB = db
	InvalidateChannelPricingCache()
	t.Cleanup(func() {
		DB = previous
		InvalidateChannelPricingCache()
	})
	return db
}

func officialRecord(channelID int, modelName, source string) ChannelOfficialPricingRecord {
	normalized := ChannelOfficialPricing{
		Currency: "USD",
		Unit:     "per_1m_token",
		Tiers: []ChannelPricingTier{{
			RangeName:           "Default",
			InputPerMillionUSD:  floatPtr(3),
			OutputPerMillionUSD: floatPtr(6),
			Unit:                "per_1m_token",
		}},
		Source: source,
	}
	encoded, _ := common.Marshal(normalized)
	official := string(encoded)
	return ChannelOfficialPricingRecord{
		ChannelId:         channelID,
		Provider:          "aliyun-bailian",
		Region:            "cn-beijing",
		ModelName:         modelName,
		Currency:          "USD",
		OfficialPricing:   `{"model":"` + modelName + `"}`,
		NormalizedPricing: official,
		Source:            source,
		FetchedAt:         100,
	}
}

func floatPtr(value float64) *float64 { return &value }

func TestChannelPricingIsolatedPerChannel(t *testing.T) {
	setupChannelModelPricingDB(t)
	_, err := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{
		officialRecord(1, "qwen-plus", "bailian-official"),
		officialRecord(2, "qwen-plus", "newapi:/api/pricing"),
	})
	require.NoError(t, err)

	first, err := GetChannelModelPricing(1, "qwen-plus")
	require.NoError(t, err)
	second, err := GetChannelModelPricing(2, "qwen-plus")
	require.NoError(t, err)
	assert.Equal(t, "bailian-official", first.PricingSource)
	assert.Equal(t, "newapi:/api/pricing", second.PricingSource)
	assert.Equal(t, ChannelPricingStatusOfficialOnly, first.PricingStatus)
	assert.Equal(t, ChannelPricingStatusOfficialOnly, second.PricingStatus)
	assert.NotEqual(t, first.PricingVersion, second.PricingVersion)

	// Official-only rows never bill.
	if pricing, ok := ResolveChannelBillingPricing(1, "qwen-plus"); ok {
		t.Fatalf("official-only row must not be billable: %#v", pricing)
	}

	require.NoError(t, SetChannelInternalPricing(1, "qwen-plus", ChannelInternalPricing{
		Mode:                ChannelPricingModePerMillionTokens,
		InputUSDPerMillion:  floatPtr(2),
		OutputUSDPerMillion: floatPtr(8),
		CacheUSDPerMillion:  floatPtr(0.5),
	}))
	firstPricing, ok := ResolveChannelBillingPricing(1, "qwen-plus")
	require.True(t, ok)
	assert.InDelta(t, 1.0, firstPricing.ModelRatio, 1e-9) // $2 / 2
	require.NotNil(t, firstPricing.CompletionRatio)
	assert.InDelta(t, 4.0, *firstPricing.CompletionRatio, 1e-9)
	require.NotNil(t, firstPricing.CacheRatio)
	assert.InDelta(t, 0.25, *firstPricing.CacheRatio, 1e-9)

	// Channel 2 stays official-only: setting channel 1's internal price did not
	// leak into the same model on another channel.
	if pricing, ok := ResolveChannelBillingPricing(2, "qwen-plus"); ok {
		t.Fatalf("channel 2 must remain unbillable: %#v", pricing)
	}
}

func TestChannelInternalPricingRejectsInvalidValues(t *testing.T) {
	setupChannelModelPricingDB(t)
	_, err := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{
		officialRecord(1, "qwen-plus", "bailian-official"),
	})
	require.NoError(t, err)

	for name, pricing := range map[string]ChannelInternalPricing{
		"missing input": {
			Mode:                ChannelPricingModePerMillionTokens,
			OutputUSDPerMillion: floatPtr(2),
		},
		"missing output": {
			Mode:               ChannelPricingModePerMillionTokens,
			InputUSDPerMillion: floatPtr(2),
		},
		"negative price": {
			Mode:                ChannelPricingModePerMillionTokens,
			InputUSDPerMillion:  floatPtr(-1),
			OutputUSDPerMillion: floatPtr(2),
		},
		"unknown mode":           {Mode: "tiered"},
		"per-call without price": {Mode: ChannelPricingModePerCall},
	} {
		t.Run(name, func(t *testing.T) {
			require.Error(t, SetChannelInternalPricing(1, "qwen-plus", pricing))
		})
	}
}

func TestChannelPerCallPricingAndCachedInvalidation(t *testing.T) {
	setupChannelModelPricingDB(t)
	_, err := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{
		officialRecord(7, "image-model", "newapi:/api/pricing"),
	})
	require.NoError(t, err)

	require.NoError(t, SetChannelInternalPricing(7, "image-model", ChannelInternalPricing{
		Mode:       ChannelPricingModePerCall,
		PerCallUSD: floatPtr(0.04),
	}))
	pricing, ok := ResolveChannelBillingPricing(7, "image-model")
	require.True(t, ok)
	assert.True(t, pricing.UsePrice)
	assert.InDelta(t, 0.04, pricing.ModelPrice, 1e-9)

	// A save invalidates the cached value immediately.
	require.NoError(t, SetChannelInternalPricing(7, "image-model", ChannelInternalPricing{
		Mode:       ChannelPricingModePerCall,
		PerCallUSD: floatPtr(0.02),
	}))
	pricing, ok = ResolveChannelBillingPricing(7, "image-model")
	require.True(t, ok)
	assert.InDelta(t, 0.02, pricing.ModelPrice, 1e-9)

	names, err := ChannelPricedModelNames()
	require.NoError(t, err)
	assert.True(t, names["image-model"])
}

func TestResolveEffectiveChannelPricingIsSingleDecisionPoint(t *testing.T) {
	setupChannelModelPricingDB(t)

	// No row: exists=false, not billable.
	absent := ResolveEffectiveChannelPricing(41, "never-synced-model")
	assert.False(t, absent.Exists)
	assert.False(t, absent.Billable)
	assert.Nil(t, absent.Pricing)
	assert.Empty(t, absent.Status)

	// Official-only row: exists=true but must never be billable (no free pass).
	_, err := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{
		officialRecord(42, "official-only-model", "bailian-official"),
	})
	require.NoError(t, err)
	official := ResolveEffectiveChannelPricing(42, "official-only-model")
	assert.True(t, official.Exists)
	assert.False(t, official.Billable)
	assert.Equal(t, ChannelPricingStatusOfficialOnly, official.Status)
	assert.Nil(t, official.Pricing)

	// Configured row: billable, and every accessor agrees with the unified result.
	require.NoError(t, SetChannelInternalPricing(42, "official-only-model", ChannelInternalPricing{
		Mode:                ChannelPricingModePerMillionTokens,
		InputUSDPerMillion:  floatPtr(2),
		OutputUSDPerMillion: floatPtr(8),
	}))
	configured := ResolveEffectiveChannelPricing(42, "official-only-model")
	require.True(t, configured.Billable)
	require.NotNil(t, configured.Pricing)
	assert.Equal(t, ChannelPricingStatusConfigured, configured.Status)
	assert.InDelta(t, 1.0, configured.Pricing.ModelRatio, 1e-9)

	legacyPricing, legacyOK := ResolveChannelBillingPricing(42, "official-only-model")
	assert.Equal(t, configured.Billable, legacyOK)
	assert.Equal(t, configured.Pricing, legacyPricing)
	legacyStatus, legacyExists := ChannelPricingState(42, "official-only-model")
	assert.Equal(t, configured.Status, legacyStatus)
	assert.Equal(t, configured.Exists, legacyExists)
}

func TestUpsertOfficialPricingPreservesInternalPrice(t *testing.T) {
	setupChannelModelPricingDB(t)
	_, err := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{
		officialRecord(3, "qwen-plus", "bailian-official"),
	})
	require.NoError(t, err)
	require.NoError(t, SetChannelInternalPricing(3, "qwen-plus", ChannelInternalPricing{
		Mode:                ChannelPricingModePerMillionTokens,
		InputUSDPerMillion:  floatPtr(1),
		OutputUSDPerMillion: floatPtr(2),
	}))

	updated := officialRecord(3, "qwen-plus", "bailian-official")
	updated.FetchedAt = 200
	_, err = UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{updated})
	require.NoError(t, err)

	row, err := GetChannelModelPricing(3, "qwen-plus")
	require.NoError(t, err)
	assert.Equal(t, ChannelPricingStatusConfigured, row.PricingStatus)
	assert.Contains(t, row.InternalPricing, `"per_1m_token"`)
	assert.Equal(t, int64(200), row.FetchedAt)
}

func TestChannelModelPricingMigrationAndUniqueKey(t *testing.T) {
	path := t.TempDir() + "/channel-pricing.db"
	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&ChannelModelPricing{}))
	// Running migration again must be a no-op.
	require.NoError(t, db.AutoMigrate(&ChannelModelPricing{}))

	row := ChannelModelPricing{ChannelId: 1, ModelName: "qwen-plus", PricingStatus: ChannelPricingStatusOfficialOnly}
	require.NoError(t, db.Create(&row).Error)
	duplicate := ChannelModelPricing{ChannelId: 1, ModelName: "qwen-plus", PricingStatus: ChannelPricingStatusOfficialOnly}
	require.Error(t, db.Create(&duplicate).Error)
	// The same model on another channel is a separate row.
	require.NoError(t, db.Create(&ChannelModelPricing{ChannelId: 2, ModelName: "qwen-plus", PricingStatus: ChannelPricingStatusOfficialOnly}).Error)
}

func TestNormalizeChannelInternalPricingCacheWrite(t *testing.T) {
	pricing := &ChannelInternalPricing{
		Mode:                     ChannelPricingModePerMillionTokens,
		InputUSDPerMillion:       floatPtr(2),
		OutputUSDPerMillion:      floatPtr(4),
		CacheUSDPerMillion:       floatPtr(1),
		CreateCacheUSDPerMillion: floatPtr(2.5),
	}
	normalized, err := NormalizeChannelInternalPricing(pricing)
	require.NoError(t, err)
	require.NotNil(t, normalized.CacheRatio)
	require.InDelta(t, 0.5, *normalized.CacheRatio, 1e-9)
	require.NotNil(t, normalized.CreateCacheRatio)
	require.InDelta(t, 1.25, *normalized.CreateCacheRatio, 1e-9)
}

func TestUpsertDerivedPricingPreservesManualOperatorPrice(t *testing.T) {
	setupChannelModelPricingDB(t)
	derived := func(input float64) string {
		encoded, err := common.Marshal(ChannelInternalPricing{
			Mode:                ChannelPricingModePerMillionTokens,
			InputUSDPerMillion:  floatPtr(input),
			OutputUSDPerMillion: floatPtr(input * 5),
			Source:              "dreamrouter-discount",
		})
		require.NoError(t, err)
		return string(encoded)
	}
	record := officialRecord(7, "gpt-a", "dreamrouter-official")
	record.InternalPricing = derived(3)
	_, err := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{record})
	require.NoError(t, err)

	row, err := GetChannelModelPricing(7, "gpt-a")
	require.NoError(t, err)
	require.Equal(t, ChannelPricingStatusConfigured, row.PricingStatus)
	require.Contains(t, row.InternalPricing, `"input_per_million_usd":3`)

	// A later sync may refresh a price it derived itself.
	record.InternalPricing = derived(2.5)
	_, err = UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{record})
	require.NoError(t, err)
	row, err = GetChannelModelPricing(7, "gpt-a")
	require.NoError(t, err)
	require.Contains(t, row.InternalPricing, `"input_per_million_usd":2.5`)

	// An operator-saved price is never overwritten by a sync.
	require.NoError(t, SetChannelInternalPricing(7, "gpt-a", ChannelInternalPricing{
		Mode:                ChannelPricingModePerMillionTokens,
		InputUSDPerMillion:  floatPtr(9),
		OutputUSDPerMillion: floatPtr(45),
	}))
	record.InternalPricing = derived(1)
	_, err = UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{record})
	require.NoError(t, err)
	row, err = GetChannelModelPricing(7, "gpt-a")
	require.NoError(t, err)
	require.Contains(t, row.InternalPricing, `"input_per_million_usd":9`)
}
