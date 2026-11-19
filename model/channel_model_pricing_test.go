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
