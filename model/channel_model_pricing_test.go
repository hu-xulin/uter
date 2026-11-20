package model

import (
	"math"
	"strings"
	"sync"
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

	row := ChannelModelPricing{
		ChannelId: 1, Provider: "aliyun-bailian", Region: "cn-beijing",
		ModelName: "qwen-plus", PricingStatus: ChannelPricingStatusOfficialOnly,
	}
	require.NoError(t, db.Create(&row).Error)
	duplicate := ChannelModelPricing{
		ChannelId: 1, Provider: "aliyun-bailian", Region: "cn-beijing",
		ModelName: "qwen-plus", PricingStatus: ChannelPricingStatusOfficialOnly,
	}
	require.Error(t, db.Create(&duplicate).Error)
	// The same model in another region or on another channel is a separate row.
	require.NoError(t, db.Create(&ChannelModelPricing{
		ChannelId: 1, Provider: "aliyun-bailian", Region: "ap-southeast-1",
		ModelName: "qwen-plus", PricingStatus: ChannelPricingStatusOfficialOnly,
	}).Error)
	require.NoError(t, db.Create(&ChannelModelPricing{
		ChannelId: 2, ModelName: "qwen-plus", PricingStatus: ChannelPricingStatusOfficialOnly,
	}).Error)
}

func TestPrepareChannelModelPricingIdentityMergesLegacyDuplicates(t *testing.T) {
	path := t.TempDir() + "/channel-pricing-migrate.db"
	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{})
	require.NoError(t, err)

	// Build the legacy shape: unique (channel, model), no identity columns in
	// the index. Dropping the new index afterwards reproduces a pre-migration
	// database that already contains duplicate identities.
	require.NoError(t, db.AutoMigrate(&ChannelModelPricing{}))
	if db.Migrator().HasIndex(&ChannelModelPricing{}, "idx_channel_model_pricing_identity") {
		require.NoError(t, db.Migrator().DropIndex(&ChannelModelPricing{}, "idx_channel_model_pricing_identity"))
	}
	internal, _ := common.Marshal(ChannelInternalPricing{
		Mode: ChannelPricingModePerMillionTokens, InputUSDPerMillion: floatPtr(2), UpdatedAt: 10,
	})
	older := ChannelModelPricing{
		ChannelId: 1, Provider: "aliyun-bailian", Region: "cn-beijing", ModelName: "qwen-plus",
		PricingStatus: ChannelPricingStatusOfficialOnly, FetchedAt: 10, UpdatedAt: 10,
	}
	newer := ChannelModelPricing{
		ChannelId: 1, Provider: "aliyun-bailian", Region: "cn-beijing", ModelName: "qwen-plus",
		PricingStatus: ChannelPricingStatusConfigured, InternalPricing: string(internal), FetchedAt: 20, UpdatedAt: 20,
	}
	require.NoError(t, db.Create(&older).Error)
	require.NoError(t, db.Create(&newer).Error)

	require.NoError(t, PrepareChannelModelPricingIdentity(db))
	require.NoError(t, db.AutoMigrate(&ChannelModelPricing{}))

	var rows []ChannelModelPricing
	require.NoError(t, db.Where("channel_id = ?", 1).Find(&rows).Error)
	require.Len(t, rows, 1)
	assert.Equal(t, ChannelPricingStatusConfigured, rows[0].PricingStatus)
	assert.False(t, db.Migrator().HasIndex(&ChannelModelPricing{}, legacyChannelPricingIndex))
	assert.True(t, db.Migrator().HasIndex(&ChannelModelPricing{}, "idx_channel_model_pricing_identity"))
}

func TestUpsertKeepsRegionAndDeploymentIsolated(t *testing.T) {
	setupChannelModelPricingDB(t)
	beijing := officialRecord(1, "qwen-plus", "bailian-official")
	singapore := officialRecord(1, "qwen-plus", "bailian-official")
	singapore.Region = "ap-southeast-1"
	deployment := officialRecord(1, "qwen-plus", "bailian-official")
	deployment.DeploymentId = "deploy-2"

	written, err := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{beijing, singapore, deployment})
	require.NoError(t, err)
	assert.Equal(t, 3, written)

	var rows []ChannelModelPricing
	require.NoError(t, DB.Where("channel_id = ? AND model_name = ?", 1, "qwen-plus").Find(&rows).Error)
	require.Len(t, rows, 3)
	regions := map[string]bool{}
	for _, row := range rows {
		regions[row.Region+"/"+row.DeploymentId] = true
	}
	assert.Contains(t, regions, "cn-beijing/")
	assert.Contains(t, regions, "ap-southeast-1/")
	assert.Contains(t, regions, "cn-beijing/deploy-2")

	// Re-syncing one identity updates only that row.
	updated := singapore
	updated.Source = "bailian-official-v2"
	written, err = UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{updated})
	require.NoError(t, err)
	assert.Equal(t, 1, written)
	var refreshed []ChannelModelPricing
	require.NoError(t, DB.Where("channel_id = ? AND model_name = ?", 1, "qwen-plus").Find(&refreshed).Error)
	require.Len(t, refreshed, 3)
	for _, row := range refreshed {
		if row.Region == "ap-southeast-1" {
			assert.Equal(t, "bailian-official-v2", row.PricingSource)
		} else {
			assert.Equal(t, "bailian-official", row.PricingSource)
		}
	}
}

func TestGetChannelModelPricingPrefersConfiguredIdentity(t *testing.T) {
	setupChannelModelPricingDB(t)
	official := ChannelModelPricing{
		ChannelId: 1, Provider: "aliyun-bailian", Region: "cn-beijing", ModelName: "qwen-plus",
		PricingStatus: ChannelPricingStatusOfficialOnly, FetchedAt: 200, UpdatedAt: 200,
	}
	internal, _ := common.Marshal(ChannelInternalPricing{
		Mode: ChannelPricingModePerMillionTokens, InputUSDPerMillion: floatPtr(2), UpdatedAt: 10,
	})
	configured := ChannelModelPricing{
		ChannelId: 1, Provider: "aliyun-bailian", Region: "ap-southeast-1", ModelName: "qwen-plus",
		PricingStatus: ChannelPricingStatusConfigured, InternalPricing: string(internal), FetchedAt: 100, UpdatedAt: 100,
	}
	require.NoError(t, DB.Create(&official).Error)
	require.NoError(t, DB.Create(&configured).Error)

	row, err := GetChannelModelPricing(1, "qwen-plus")
	require.NoError(t, err)
	assert.Equal(t, ChannelPricingStatusConfigured, row.PricingStatus)
	assert.Equal(t, "ap-southeast-1", row.Region)
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

func TestResolveChannelUsageDiscountUsesChannelPrice(t *testing.T) {
	setupChannelModelPricingDB(t)
	official := 0.1
	channel := 0.06
	view := ChannelOfficialPricing{
		Currency: "USD",
		Unit:     "per_second",
		Tiers: []ChannelPricingTier{{
			RangeName:  "base",
			Unit:       "per_second",
			PerUnitUSD: &official,
		}},
		ChannelPrice: &ChannelPricingTier{
			RangeName:  "base",
			Unit:       "per_second",
			PerUnitUSD: &channel,
		},
		Source: "dreamrouter-official",
	}
	normalized, err := common.Marshal(view)
	require.NoError(t, err)
	_, err = UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{{
		ChannelId: 8, Provider: "dreamrouter", ModelName: "wan-video",
		Currency: "USD", NormalizedPricing: string(normalized), Source: "dreamrouter-official",
	}})
	require.NoError(t, err)

	require.InDelta(t, 0.6, ResolveChannelUsageDiscount(8, "wan-video"), 0.0001)
	require.Equal(t, float64(1), ResolveChannelUsageDiscount(8, "unknown-model"))

	// A per-second internal price is stored for display but is not a token
	// price, so the token relay path must not treat it as billable.
	seconds := 0.06
	internal, err := common.Marshal(ChannelInternalPricing{
		Mode:         ChannelPricingModePerSecond,
		PerSecondUSD: &seconds,
		Source:       "dreamrouter-discount",
	})
	require.NoError(t, err)
	var row ChannelModelPricing
	require.NoError(t, DB.Where("channel_id = ? AND model_name = ?", 8, "wan-video").First(&row).Error)
	row.InternalPricing = string(internal)
	row.PricingStatus = ChannelPricingStatusConfigured
	require.NoError(t, DB.Save(&row).Error)
	InvalidateChannelPricingCache()

	if _, ok := ResolveChannelBillingPricing(8, "wan-video"); ok {
		t.Fatal("per-second pricing must not become a token/per-call price")
	}
	require.InDelta(t, 0.6, ResolveChannelUsageDiscount(8, "wan-video"), 0.0001)
}

func TestNormalizeChannelInternalPricingPerSecond(t *testing.T) {
	price := 0.08
	normalized, err := NormalizeChannelInternalPricing(&ChannelInternalPricing{
		Mode: ChannelPricingModePerSecond, PerSecondUSD: &price,
	})
	require.NoError(t, err)
	require.True(t, normalized.UsePerSecond)
	require.InDelta(t, 0.08, normalized.PerSecondPrice, 1e-9)
}

func TestLoadChannelInternalPricesPrefersLowestConfiguredChannel(t *testing.T) {
	setupChannelModelPricingDB(t)
	internal := func(input, output float64) string {
		encoded, err := common.Marshal(ChannelInternalPricing{
			Mode:                ChannelPricingModePerMillionTokens,
			InputUSDPerMillion:  floatPtr(input),
			OutputUSDPerMillion: floatPtr(output),
			Source:              "dreamrouter-discount",
		})
		require.NoError(t, err)
		return string(encoded)
	}
	_, err := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{
		{ChannelId: 1, Provider: "dreamrouter", ModelName: "m", Currency: "USD", InternalPricing: internal(0.3, 1.2), Source: "dreamrouter-official"},
		{ChannelId: 2, Provider: "dreamrouter", ModelName: "m", Currency: "USD", InternalPricing: internal(0.2, 0.8), Source: "dreamrouter-official"},
	})
	require.NoError(t, err)
	prices, _ := loadChannelInternalPrices([]AbilityWithChannel{
		{Ability: Ability{ChannelId: 1, Model: "m", Enabled: true}, ChannelName: "渠道一", ChannelStatus: common.ChannelStatusEnabled},
		{Ability: Ability{ChannelId: 2, Model: "m", Enabled: true}, ChannelName: "渠道二", ChannelStatus: common.ChannelStatusEnabled},
		{Ability: Ability{ChannelId: 3, Model: "m", Enabled: true}, ChannelName: "停用渠道", ChannelStatus: common.ChannelStatusManuallyDisabled},
	})
	price, ok := prices["m"]
	require.True(t, ok)
	require.Equal(t, "渠道二", price.channelName)
	require.InDelta(t, 0.1, price.modelRatio, 0.0001)
	require.InDelta(t, 4, price.completionRatio, 0.0001)
}

func TestNormalizeChannelInternalPricingPerMinuteConvertsToSeconds(t *testing.T) {
	price := 6.0
	normalized, err := NormalizeChannelInternalPricing(&ChannelInternalPricing{
		Mode: ChannelPricingModePerMinute, PerMinuteUSD: &price,
	})
	require.NoError(t, err)
	require.True(t, normalized.UsePerSecond)
	require.InDelta(t, 0.1, normalized.PerSecondPrice, 1e-9)
}

func TestNormalizeChannelInternalPricingRejectsNonPositivePerMinute(t *testing.T) {
	zero := 0.0
	_, err := NormalizeChannelInternalPricing(&ChannelInternalPricing{
		Mode: ChannelPricingModePerMinute, PerMinuteUSD: &zero,
	})
	require.ErrorContains(t, err, "per-minute price is required")
}

func TestOfficialSyncClearsOnlyAutoDerivedInternalPrice(t *testing.T) {
	setupChannelModelPricingDB(t)
	derived := `{"mode":"per_1m_token","input_per_million_usd":3,"output_per_million_usd":6,"source":"bailian-official"}`
	record := officialRecord(51, "qwen-auto", "bailian-official")
	record.InternalPricing = derived
	_, err := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{record})
	require.NoError(t, err)
	row, err := GetChannelModelPricing(51, "qwen-auto")
	require.NoError(t, err)
	require.Equal(t, ChannelPricingStatusConfigured, row.PricingStatus)

	// The next official sync carries no internal price; the auto-derived one
	// must not stay billable.
	record.InternalPricing = ""
	_, err = UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{record})
	require.NoError(t, err)
	row, err = GetChannelModelPricing(51, "qwen-auto")
	require.NoError(t, err)
	require.Equal(t, ChannelPricingStatusOfficialOnly, row.PricingStatus)
	require.Empty(t, row.InternalPricing)

	// An operator price (source empty) is preserved across the same sync.
	require.NoError(t, SetChannelInternalPricing(51, "qwen-auto", ChannelInternalPricing{
		Mode:                ChannelPricingModePerMillionTokens,
		InputUSDPerMillion:  floatPtr(1),
		OutputUSDPerMillion: floatPtr(2),
	}))
	_, err = UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{record})
	require.NoError(t, err)
	row, err = GetChannelModelPricing(51, "qwen-auto")
	require.NoError(t, err)
	require.Equal(t, ChannelPricingStatusConfigured, row.PricingStatus)
	require.Contains(t, row.InternalPricing, `"per_1m_token"`)
}

func TestClearAutoDerivedChannelPricingPreservesOperatorAndOtherChannels(t *testing.T) {
	setupChannelModelPricingDB(t)
	derived, _ := common.Marshal(ChannelInternalPricing{
		Mode:                ChannelPricingModePerMillionTokens,
		InputUSDPerMillion:  floatPtr(3),
		OutputUSDPerMillion: floatPtr(6),
		Source:              "bailian-official",
	})
	autoA := officialRecord(61, "auto-a", "bailian-official")
	autoA.InternalPricing = string(derived)
	autoB := officialRecord(61, "auto-b", "bailian-official")
	autoB.InternalPricing = string(derived)
	other := officialRecord(62, "auto-a", "bailian-official")
	other.InternalPricing = string(derived)
	_, err := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{autoA, autoB, other})
	require.NoError(t, err)
	require.NoError(t, SetChannelInternalPricing(61, "auto-a", ChannelInternalPricing{
		Mode:                ChannelPricingModePerMillionTokens,
		InputUSDPerMillion:  floatPtr(1),
		OutputUSDPerMillion: floatPtr(2),
	}))

	cleared, err := ClearAutoDerivedChannelPricing(61, "bailian-")
	require.NoError(t, err)
	require.Equal(t, 1, cleared)

	manual, err := GetChannelModelPricing(61, "auto-a")
	require.NoError(t, err)
	require.Equal(t, ChannelPricingStatusConfigured, manual.PricingStatus)
	derivedRow, err := GetChannelModelPricing(61, "auto-b")
	require.NoError(t, err)
	require.Equal(t, ChannelPricingStatusOfficialOnly, derivedRow.PricingStatus)
	require.Empty(t, derivedRow.InternalPricing)
	otherRow, err := GetChannelModelPricing(62, "auto-a")
	require.NoError(t, err)
	require.Equal(t, ChannelPricingStatusConfigured, otherRow.PricingStatus,
		"another channel must not be cleared")
}

func TestOfficialPricingReviewStateRequiresOperatorConfiguration(t *testing.T) {
	setupChannelModelPricingDB(t)
	reviewView, err := common.Marshal(ChannelOfficialPricing{
		Unit:          "per_1m_token",
		NeedsReview:   true,
		ReviewReasons: []string{"multiple time bands"},
	})
	require.NoError(t, err)
	_, err = UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{{
		ChannelId: 12, Provider: "aliyun-bailian", ModelName: "deepseek-v4-flash",
		Currency: "USD", OfficialPricing: `{}`, NormalizedPricing: string(reviewView),
		Source: "bailian-official", FetchedAt: 100,
	}})
	require.NoError(t, err)
	row, err := GetChannelModelPricing(12, "deepseek-v4-flash")
	require.NoError(t, err)
	assert.Equal(t, ChannelPricingStatusNeedsReview, row.PricingStatus)
	if _, ok := ResolveChannelBillingPricing(12, "deepseek-v4-flash"); ok {
		t.Fatal("a review-only row must not bill")
	}

	clearView, err := common.Marshal(ChannelOfficialPricing{Unit: "per_1m_token"})
	require.NoError(t, err)
	_, err = UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{{
		ChannelId: 12, Provider: "aliyun-bailian", ModelName: "deepseek-v4-flash",
		Currency: "USD", OfficialPricing: `{}`, NormalizedPricing: string(clearView),
		Source: "bailian-official", FetchedAt: 101,
	}})
	require.NoError(t, err)
	row, err = GetChannelModelPricing(12, "deepseek-v4-flash")
	require.NoError(t, err)
	assert.Equal(t, ChannelPricingStatusOfficialOnly, row.PricingStatus)
}

func TestResolveEffectiveChannelPricingUsesFullIdentity(t *testing.T) {
	setupChannelModelPricingDB(t)
	input := func(value float64) *float64 { v := value; return &v }
	makeRecord := func(region, deployment string) ChannelOfficialPricingRecord {
		record := officialRecord(1, "qwen-max", "bailian-official")
		record.Provider = "aliyun-bailian"
		record.Region = region
		record.DeploymentId = deployment
		return record
	}
	_, err := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{
		makeRecord("cn-beijing", ""),
		makeRecord("cn-beijing", "deploy-x"),
		makeRecord("ap-southeast-1", ""),
		makeRecord("ap-southeast-1", "deploy-x"),
	})
	require.NoError(t, err)

	prices := map[string]float64{
		"cn-beijing/":             1.0,
		"cn-beijing/deploy-x":     2.0,
		"ap-southeast-1/":         3.0,
		"ap-southeast-1/deploy-x": 4.0,
	}
	for key, price := range prices {
		parts := strings.SplitN(key, "/", 2)
		out := price * 2
		require.NoError(t, SetChannelInternalPricingFor(ChannelPricingIdentity{
			ChannelId: 1, Provider: "aliyun-bailian", Region: parts[0], DeploymentId: parts[1], ModelName: "qwen-max",
		}, ChannelInternalPricing{
			Mode: ChannelPricingModePerMillionTokens, InputUSDPerMillion: input(price), OutputUSDPerMillion: &out,
		}))
	}
	for key, price := range prices {
		parts := strings.SplitN(key, "/", 2)
		effective := ResolveEffectiveChannelPricingFor(ChannelPricingIdentity{
			ChannelId: 1, Provider: "aliyun-bailian", Region: parts[0], DeploymentId: parts[1], ModelName: "qwen-max",
		})
		require.True(t, effective.Billable, key)
		require.NotNil(t, effective.Pricing)
		assert.InDelta(t, price/2, effective.Pricing.ModelRatio, 1e-9, key)
	}

	unknown := ResolveEffectiveChannelPricingFor(ChannelPricingIdentity{
		ChannelId: 1, Provider: "aliyun-bailian", Region: "eu-central-1", ModelName: "qwen-max",
	})
	assert.True(t, unknown.Exists)
	assert.False(t, unknown.Billable)
	assert.Equal(t, ChannelPricingReasonIdentityMissing, unknown.Reason)

	legacy := ResolveEffectiveChannelPricing(1, "qwen-max")
	assert.False(t, legacy.Billable, "legacy lookup must not pick one of several identities")
	assert.NotEmpty(t, legacy.Reason)
}

// Bailian rows store the model's inference provider, not the channel vendor.
// A single region/deployment row must still match without guessing between
// different identities.
func TestResolveIdentityAcceptsSingleBailianInferenceProviderRow(t *testing.T) {
	setupChannelModelPricingDB(t)
	record := officialRecord(1, "qwen-plus", "bailian-official")
	record.Provider = "qwen"
	record.Region = "cn-beijing"
	_, err := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{record})
	require.NoError(t, err)
	input, output := 2.0, 4.0
	require.NoError(t, SetChannelInternalPricingFor(ChannelPricingIdentity{
		ChannelId: 1, Provider: "alibaba-bailian", Region: "cn-beijing", ModelName: "qwen-plus",
	}, ChannelInternalPricing{Mode: ChannelPricingModePerMillionTokens, InputUSDPerMillion: &input, OutputUSDPerMillion: &output}))

	effective := ResolveEffectiveChannelPricingFor(ChannelPricingIdentity{
		ChannelId: 1, Provider: "alibaba-bailian", Region: "cn-beijing", ModelName: "qwen-plus",
	})
	require.True(t, effective.Billable)
	assert.InDelta(t, 1.0, effective.Pricing.ModelRatio, 1e-9)
}

func TestResolveChannelPricingIdentityConcurrentIsolation(t *testing.T) {
	// A file-backed database keeps every pooled connection on the same data;
	// :memory: opens a separate empty database per connection.
	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/pricing-concurrent.db"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&ChannelModelPricing{}))
	previous := DB
	DB = db
	InvalidateChannelPricingCache()
	t.Cleanup(func() {
		DB = previous
		InvalidateChannelPricingCache()
	})
	input := func(value float64) *float64 { v := value; return &v }
	identities := []struct {
		region     string
		deployment string
		price      float64
	}{
		{"cn-beijing", "", 1},
		{"cn-beijing", "deploy-x", 2},
		{"ap-southeast-1", "", 3},
		{"ap-southeast-1", "deploy-x", 4},
	}
	for _, item := range identities {
		record := officialRecord(1, "qwen-max", "bailian-official")
		record.Provider = "aliyun-bailian"
		record.Region = item.region
		record.DeploymentId = item.deployment
		_, upsertErr := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{record})
		require.NoError(t, upsertErr)
		out := item.price * 2
		require.NoError(t, SetChannelInternalPricingFor(ChannelPricingIdentity{
			ChannelId: 1, Provider: "aliyun-bailian", Region: item.region, DeploymentId: item.deployment, ModelName: "qwen-max",
		}, ChannelInternalPricing{
			Mode: ChannelPricingModePerMillionTokens, InputUSDPerMillion: input(item.price), OutputUSDPerMillion: &out,
		}))
	}

	var wg sync.WaitGroup
	failures := make(chan string, 1)
	report := func(reason string) {
		select {
		case failures <- reason:
		default:
		}
	}
	for i := 0; i < 8; i++ {
		for _, item := range identities {
			item := item
			wg.Add(1)
			go func() {
				defer wg.Done()
				for j := 0; j < 5; j++ {
					effective := ResolveEffectiveChannelPricingFor(ChannelPricingIdentity{
						ChannelId: 1, Provider: "aliyun-bailian",
						Region: item.region, DeploymentId: item.deployment, ModelName: "qwen-max",
					})
					if !effective.Billable || effective.Pricing == nil {
						report("not billable")
						return
					}
					if math.Abs(effective.Pricing.ModelRatio-item.price/2) > 1e-9 {
						report("cross-region price")
						return
					}
				}
			}()
		}
	}
	wg.Wait()
	close(failures)
	for failure := range failures {
		t.Fatal(failure)
	}
}

func TestResolveSnapshotsPurchasePrice(t *testing.T) {
	setupChannelModelPricingDB(t)
	purchase := 0.5
	normalized, _ := common.Marshal(ChannelOfficialPricing{
		Currency:    "CNY",
		FXRateToUSD: 7.3,
		Unit:        "per_1m_token",
		ChannelPrice: &ChannelPricingTier{
			RangeName: "Default", Unit: "per_1m_token", InputPerMillionUSD: &purchase,
		},
		Tiers: []ChannelPricingTier{{RangeName: "Default", Unit: "per_1m_token", InputPerMillionUSD: &purchase}},
	})
	_, err := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{{
		ChannelId: 3, Provider: "aliyun-bailian", Region: "cn-beijing", ModelName: "qwen-snap",
		Currency: "USD", OfficialPricing: `{}`, NormalizedPricing: string(normalized),
		Source: "bailian-official", FetchedAt: 100,
	}})
	require.NoError(t, err)
	input, output := 1.0, 2.0
	require.NoError(t, SetChannelInternalPricingFor(ChannelPricingIdentity{
		ChannelId: 3, Provider: "aliyun-bailian", Region: "cn-beijing", ModelName: "qwen-snap",
	}, ChannelInternalPricing{Mode: ChannelPricingModePerMillionTokens, InputUSDPerMillion: &input, OutputUSDPerMillion: &output}))

	effective := ResolveEffectiveChannelPricingFor(ChannelPricingIdentity{
		ChannelId: 3, Provider: "aliyun-bailian", Region: "cn-beijing", ModelName: "qwen-snap",
	})
	require.True(t, effective.Billable)
	require.NotNil(t, effective.Pricing.PurchaseUSD)
	assert.InDelta(t, 0.5, *effective.Pricing.PurchaseUSD, 1e-9)
	assert.Equal(t, "CNY", effective.Pricing.Currency)
	assert.InDelta(t, 7.3, effective.Pricing.FXRate, 1e-9)
}
