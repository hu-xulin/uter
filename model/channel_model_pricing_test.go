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
	"github.com/uter-ai/uter/constant"
	"gorm.io/gorm"
)

func TestPrepareChannelModelPricingOwnerBackfillsHistory(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.Exec(`
		CREATE TABLE channel_model_pricing (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			channel_id INTEGER,
			provider TEXT,
			model_name TEXT,
			region TEXT,
			deployment_id TEXT,
			pricing_source TEXT,
			internal_pricing TEXT,
			pricing_status TEXT,
			pricing_version TEXT,
			normalized_pricing TEXT
		)`).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO channel_model_pricing (id, pricing_source, internal_pricing) VALUES
		(1, 'uterroute-official', ''),
		(2, '', '{"source":"batch"}'),
		(3, 'operator-manual', ''),
		(4, 'review-approved', '')`).Error)

	require.NoError(t, PrepareChannelModelPricingOwner(db))
	require.True(t, db.Migrator().HasColumn(&ChannelModelPricing{}, "pricing_owner"))
	require.True(t, db.Migrator().HasIndex(&ChannelModelPricing{}, "idx_channel_model_pricing_pricing_owner"))

	got := map[int64]string{}
	rows, err := db.Raw("SELECT id, pricing_owner FROM channel_model_pricing").Rows()
	require.NoError(t, err)
	defer rows.Close()
	for rows.Next() {
		var id int64
		var owner string
		require.NoError(t, rows.Scan(&id, &owner))
		got[id] = owner
	}
	assert.Equal(t, map[int64]string{
		1: ChannelPricingOwnerAuto,
		2: ChannelPricingOwnerBatch,
		3: ChannelPricingOwnerOperator,
		4: ChannelPricingOwnerApproved,
	}, got)

	require.NoError(t, db.Exec("UPDATE channel_model_pricing SET pricing_owner = ? WHERE id = ?",
		ChannelPricingOwnerOperator, 1).Error)
	require.NoError(t, PrepareChannelModelPricingOwner(db))
	var preserved string
	require.NoError(t, db.Raw("SELECT pricing_owner FROM channel_model_pricing WHERE id = 1").Scan(&preserved).Error)
	assert.Equal(t, ChannelPricingOwnerOperator, preserved)
}

func setupChannelModelPricingDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&ChannelModelPricing{}, &ChannelPricingHistory{}))
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
			InputPerMillionUSD:  MoneyFromFloatPtr(floatPtr(3)),
			OutputPerMillionUSD: MoneyFromFloatPtr(floatPtr(6)),
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
		InputUSDPerMillion:  MoneyFromFloatPtr(floatPtr(2)),
		OutputUSDPerMillion: MoneyFromFloatPtr(floatPtr(8)),
		CacheUSDPerMillion:  MoneyFromFloatPtr(floatPtr(0.5)),
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
			OutputUSDPerMillion: MoneyFromFloatPtr(floatPtr(2)),
		},
		"missing output": {
			Mode:               ChannelPricingModePerMillionTokens,
			InputUSDPerMillion: MoneyFromFloatPtr(floatPtr(2)),
		},
		"negative price": {
			Mode:                ChannelPricingModePerMillionTokens,
			InputUSDPerMillion:  MoneyFromFloatPtr(floatPtr(-1)),
			OutputUSDPerMillion: MoneyFromFloatPtr(floatPtr(2)),
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
		PerCallUSD: MoneyFromFloatPtr(floatPtr(0.04)),
	}))
	pricing, ok := ResolveChannelBillingPricing(7, "image-model")
	require.True(t, ok)
	assert.True(t, pricing.UsePrice)
	assert.InDelta(t, 0.04, pricing.ModelPrice, 1e-9)

	// A save invalidates the cached value immediately.
	require.NoError(t, SetChannelInternalPricing(7, "image-model", ChannelInternalPricing{
		Mode:       ChannelPricingModePerCall,
		PerCallUSD: MoneyFromFloatPtr(floatPtr(0.02)),
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
		InputUSDPerMillion:  MoneyFromFloatPtr(floatPtr(2)),
		OutputUSDPerMillion: MoneyFromFloatPtr(floatPtr(8)),
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
		InputUSDPerMillion:  MoneyFromFloatPtr(floatPtr(1)),
		OutputUSDPerMillion: MoneyFromFloatPtr(floatPtr(2)),
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
		Mode: ChannelPricingModePerMillionTokens, InputUSDPerMillion: MoneyFromFloatPtr(floatPtr(2)), UpdatedAt: 10,
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
		Mode: ChannelPricingModePerMillionTokens, InputUSDPerMillion: MoneyFromFloatPtr(floatPtr(2)), UpdatedAt: 10,
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
		InputUSDPerMillion:       MoneyFromFloatPtr(floatPtr(2)),
		OutputUSDPerMillion:      MoneyFromFloatPtr(floatPtr(4)),
		CacheUSDPerMillion:       MoneyFromFloatPtr(floatPtr(1)),
		CreateCacheUSDPerMillion: MoneyFromFloatPtr(floatPtr(2.5)),
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
			InputUSDPerMillion:  MoneyFromFloatPtr(floatPtr(input)),
			OutputUSDPerMillion: MoneyFromFloatPtr(floatPtr(input * 5)),
			Source:              "uterroute-discount",
		})
		require.NoError(t, err)
		return string(encoded)
	}
	record := officialRecord(7, "gpt-a", "uterroute-official")
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
		InputUSDPerMillion:  MoneyFromFloatPtr(floatPtr(9)),
		OutputUSDPerMillion: MoneyFromFloatPtr(floatPtr(45)),
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
			PerUnitUSD: MoneyFromFloatPtr(&official),
		}},
		ChannelPrice: &ChannelPricingTier{
			RangeName:  "base",
			Unit:       "per_second",
			PerUnitUSD: MoneyFromFloatPtr(&channel),
		},
		Source: "uterroute-official",
	}
	normalized, err := common.Marshal(view)
	require.NoError(t, err)
	_, err = UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{{
		ChannelId: 8, Provider: "uterroute", ModelName: "wan-video",
		Currency: "USD", NormalizedPricing: string(normalized), Source: "uterroute-official",
	}})
	require.NoError(t, err)

	require.InDelta(t, 0.6, ResolveChannelUsageDiscount(8, "wan-video"), 0.0001)
	require.Equal(t, float64(1), ResolveChannelUsageDiscount(8, "unknown-model"))

	// A per-second internal price is stored for display but is not a token
	// price, so the token relay path must not treat it as billable.
	seconds := 0.06
	internal, err := common.Marshal(ChannelInternalPricing{
		Mode:         ChannelPricingModePerSecond,
		PerSecondUSD: MoneyFromFloatPtr(&seconds),
		Source:       "uterroute-discount",
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
		Mode: ChannelPricingModePerSecond, PerSecondUSD: MoneyFromFloatPtr(&price),
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
			InputUSDPerMillion:  MoneyFromFloatPtr(floatPtr(input)),
			OutputUSDPerMillion: MoneyFromFloatPtr(floatPtr(output)),
			Source:              "uterroute-discount",
		})
		require.NoError(t, err)
		return string(encoded)
	}
	_, err := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{
		{ChannelId: 1, Provider: "uterroute", ModelName: "m", Currency: "USD", InternalPricing: internal(0.3, 1.2), Source: "uterroute-official"},
		{ChannelId: 2, Provider: "uterroute", ModelName: "m", Currency: "USD", InternalPricing: internal(0.2, 0.8), Source: "uterroute-official"},
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
		Mode: ChannelPricingModePerMinute, PerMinuteUSD: MoneyFromFloatPtr(&price),
	})
	require.NoError(t, err)
	require.True(t, normalized.UsePerSecond)
	require.InDelta(t, 0.1, normalized.PerSecondPrice, 1e-9)
}

func TestNormalizeChannelInternalPricingRejectsNonPositivePerMinute(t *testing.T) {
	zero := 0.0
	_, err := NormalizeChannelInternalPricing(&ChannelInternalPricing{
		Mode: ChannelPricingModePerMinute, PerMinuteUSD: MoneyFromFloatPtr(&zero),
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
		InputUSDPerMillion:  MoneyFromFloatPtr(floatPtr(1)),
		OutputUSDPerMillion: MoneyFromFloatPtr(floatPtr(2)),
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
		InputUSDPerMillion:  MoneyFromFloatPtr(floatPtr(3)),
		OutputUSDPerMillion: MoneyFromFloatPtr(floatPtr(6)),
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
		InputUSDPerMillion:  MoneyFromFloatPtr(floatPtr(1)),
		OutputUSDPerMillion: MoneyFromFloatPtr(floatPtr(2)),
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
			Mode: ChannelPricingModePerMillionTokens, InputUSDPerMillion: MoneyFromFloatPtr(input(price)), OutputUSDPerMillion: MoneyFromFloatPtr(&out),
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
	}, ChannelInternalPricing{Mode: ChannelPricingModePerMillionTokens, InputUSDPerMillion: MoneyFromFloatPtr(&input), OutputUSDPerMillion: MoneyFromFloatPtr(&output)}))

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
			Mode: ChannelPricingModePerMillionTokens, InputUSDPerMillion: MoneyFromFloatPtr(input(item.price)), OutputUSDPerMillion: MoneyFromFloatPtr(&out),
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
			RangeName: "Default", Unit: "per_1m_token", InputPerMillionUSD: MoneyFromFloatPtr(&purchase),
		},
		Tiers: []ChannelPricingTier{{RangeName: "Default", Unit: "per_1m_token", InputPerMillionUSD: MoneyFromFloatPtr(&purchase)}},
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
	}, ChannelInternalPricing{Mode: ChannelPricingModePerMillionTokens, InputUSDPerMillion: MoneyFromFloatPtr(&input), OutputUSDPerMillion: MoneyFromFloatPtr(&output)}))

	effective := ResolveEffectiveChannelPricingFor(ChannelPricingIdentity{
		ChannelId: 3, Provider: "aliyun-bailian", Region: "cn-beijing", ModelName: "qwen-snap",
	})
	require.True(t, effective.Billable)
	require.NotNil(t, effective.Pricing.PurchaseUSD)
	assert.InDelta(t, 0.5, *effective.Pricing.PurchaseUSD, 1e-9)
	assert.Equal(t, "CNY", effective.Pricing.Currency)
	assert.InDelta(t, 7.3, effective.Pricing.FXRate, 1e-9)
}

func TestNormalizeTieredTablePricingBuildsExecutableExpression(t *testing.T) {
	input1, output1 := 1.0, 4.0
	input2, output2 := 2.0, 8.0
	pricing := ChannelInternalPricing{
		Mode: ChannelPricingModeTieredTable,
		Tiers: []ChannelInternalPricingTier{
			{RangeName: "0-32k", MaxInputTokens: 32 * 1024, InputUSDPerMillion: MoneyFromFloatPtr(&input1), OutputUSDPerMillion: MoneyFromFloatPtr(&output1), Unit: ChannelPricingModePerMillionTokens},
			{RangeName: "32k-128k", MinInputTokens: 32 * 1024, MaxInputTokens: 128 * 1024, InputUSDPerMillion: MoneyFromFloatPtr(&input2), OutputUSDPerMillion: MoneyFromFloatPtr(&output2), Unit: ChannelPricingModePerMillionTokens},
		},
	}
	billing, err := NormalizeChannelInternalPricing(&pricing)
	require.NoError(t, err)
	require.Equal(t, ChannelPricingModeTieredTable, billing.Mode)
	assert.Contains(t, billing.BillingExpr, `tier("0-32k"`)
	assert.Contains(t, billing.BillingExpr, `tier("32k-128k"`)
	assert.Contains(t, billing.BillingExpr, "len <= 32768")

	mixed := pricing
	mixed.Tiers = append([]ChannelInternalPricingTier(nil), pricing.Tiers...)
	mixed.Tiers[1].TimeBand = "night"
	_, err = NormalizeChannelInternalPricing(&mixed)
	require.ErrorContains(t, err, "mix time bands")

	missing := pricing
	missing.Tiers = append([]ChannelInternalPricingTier(nil), pricing.Tiers...)
	missing.Tiers[1].InputUSDPerMillion = nil
	_, err = NormalizeChannelInternalPricing(&missing)
	require.ErrorContains(t, err, "positive input")

	nonToken := pricing
	nonToken.Tiers = append([]ChannelInternalPricingTier(nil), pricing.Tiers...)
	nonToken.Tiers[1].Unit = ChannelPricingModePerSecond
	nonToken.Tiers[1].PerUnitUSD = MoneyFromFloatPtr(&input1)
	_, err = NormalizeChannelInternalPricing(&nonToken)
	require.ErrorContains(t, err, "not executable")
}

func TestNormalizeModalityPricesBuildExpression(t *testing.T) {
	input, output := 2.0, 4.0
	image, thinkingInput, thinkingOutput := 1.5, 3.0, 6.0
	thinkingCache, multiOutput, cache := 0.5, 5.0, 1.0
	pricing := ChannelInternalPricing{
		Mode:               ChannelPricingModePerMillionTokens,
		InputUSDPerMillion: MoneyFromFloatPtr(&input), OutputUSDPerMillion: MoneyFromFloatPtr(&output), CacheUSDPerMillion: MoneyFromFloatPtr(&cache),
		ImageInputUSDPerMillion: MoneyFromFloatPtr(&image), ThinkingInputUSDPerMillion: MoneyFromFloatPtr(&thinkingInput),
		ThinkingOutputUSDPerMillion: MoneyFromFloatPtr(&thinkingOutput), ThinkingCacheUSDPerMillion: MoneyFromFloatPtr(&thinkingCache),
		MultiInputOutputUSDPerMillion: MoneyFromFloatPtr(&multiOutput),
	}
	billing, err := NormalizeChannelInternalPricing(&pricing)
	require.NoError(t, err)
	require.Equal(t, ChannelPricingModePerMillionTokens, billing.Mode)
	require.NotEmpty(t, billing.BillingExpr)
	assert.Contains(t, billing.BillingExpr, "img * 1.5")
	assert.Contains(t, billing.BillingExpr, "rt > 0 ? 3 : 2")
	assert.Contains(t, billing.BillingExpr, "rt > 0 ? 6 : (img > 0 ? 5 : 4)")
	assert.Contains(t, billing.BillingExpr, "cr * (rt > 0 ? 0.5 : ")

	tierPricing := ChannelInternalPricing{
		Mode: ChannelPricingModeTieredTable,
		Tiers: []ChannelInternalPricingTier{{
			RangeName: "base", InputUSDPerMillion: MoneyFromFloatPtr(&input), OutputUSDPerMillion: MoneyFromFloatPtr(&output),
			ImageInputUSDPerMillion: MoneyFromFloatPtr(&image), ThinkingOutputUSDPerMillion: MoneyFromFloatPtr(&thinkingOutput),
			Unit: ChannelPricingModePerMillionTokens,
		}},
	}
	billing, err = NormalizeChannelInternalPricing(&tierPricing)
	require.NoError(t, err)
	assert.Contains(t, billing.BillingExpr, "img * 1.5")
	assert.Contains(t, billing.BillingExpr, "rt > 0 ? 6 : 4")
}

func TestNormalizeAudioAbsolutePricesDeriveRatios(t *testing.T) {
	input, output := 2.0, 4.0
	audioInput, audioOutput := 0.5, 1.0
	stale := 0.1
	pricing := ChannelInternalPricing{
		Mode:               ChannelPricingModePerMillionTokens,
		InputUSDPerMillion: MoneyFromFloatPtr(&input), OutputUSDPerMillion: MoneyFromFloatPtr(&output),
		AudioInputUSDPerMillion: MoneyFromFloatPtr(&audioInput), AudioOutputUSDPerMillion: MoneyFromFloatPtr(&audioOutput),
		AudioRatio: &stale,
	}
	billing, err := NormalizeChannelInternalPricing(&pricing)
	require.NoError(t, err)
	require.NotNil(t, billing.AudioRatio)
	require.NotNil(t, billing.AudioCompletionRatio)
	assert.InDelta(t, 0.25, *billing.AudioRatio, 1e-9)
	assert.InDelta(t, 0.25, *billing.AudioCompletionRatio, 1e-9)
}

func TestSetChannelInternalPricingWithAuditIsAtomic(t *testing.T) {
	db := setupChannelModelPricingDB(t)
	input, output := 1.0, 2.0
	_, err := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{{
		ChannelId: 5, Provider: "test", ModelName: "atomic-model",
		Currency: "USD", Source: "test", FetchedAt: 100,
	}})
	require.NoError(t, err)
	identity := ChannelPricingIdentity{ChannelId: 5, Provider: "test", ModelName: "atomic-model"}
	old := input
	newPrice := 2.0
	require.NoError(t, SetChannelInternalPricingWithAudit(identity, ChannelInternalPricing{
		Mode: ChannelPricingModePerMillionTokens, InputUSDPerMillion: MoneyFromFloatPtr(&old), OutputUSDPerMillion: MoneyFromFloatPtr(&output),
	}, "", ChannelPricingHistory{Source: "manual"}))
	var history []ChannelPricingHistory
	require.NoError(t, db.Where("channel_id = ?", 5).Find(&history).Error)
	require.Len(t, history, 1)

	require.NoError(t, db.Migrator().DropTable(&ChannelPricingHistory{}))
	err = SetChannelInternalPricingWithAudit(identity, ChannelInternalPricing{
		Mode: ChannelPricingModePerMillionTokens, InputUSDPerMillion: MoneyFromFloatPtr(&newPrice), OutputUSDPerMillion: MoneyFromFloatPtr(&output),
	}, "", ChannelPricingHistory{Source: "manual"})
	require.Error(t, err, "a failed history write must fail the price change")

	row, err := GetChannelModelPricingFor(identity)
	require.NoError(t, err)
	var stored ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(row.InternalPricing, &stored))
	require.NotNil(t, stored.InputUSDPerMillion)
	assert.InDelta(t, 1.0, stored.InputUSDPerMillion.Float64(), 1e-9, "price must roll back with the history failure")
}

func TestSetChannelInternalPricingWithAuditRejectsStaleVersion(t *testing.T) {
	setupChannelModelPricingDB(t)
	input, output := 1.0, 2.0
	_, err := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{{
		ChannelId: 6, Provider: "test", ModelName: "versioned-model",
		Currency: "USD", Source: "test", FetchedAt: 100,
	}})
	require.NoError(t, err)
	identity := ChannelPricingIdentity{ChannelId: 6, Provider: "test", ModelName: "versioned-model"}
	require.NoError(t, SetChannelInternalPricingFor(identity, ChannelInternalPricing{
		Mode: ChannelPricingModePerMillionTokens, InputUSDPerMillion: MoneyFromFloatPtr(&input), OutputUSDPerMillion: MoneyFromFloatPtr(&output),
	}))
	err = SetChannelInternalPricingWithAudit(identity, ChannelInternalPricing{
		Mode: ChannelPricingModePerMillionTokens, InputUSDPerMillion: MoneyFromFloatPtr(&output), OutputUSDPerMillion: MoneyFromFloatPtr(&input),
	}, "stale-version", ChannelPricingHistory{Source: "manual"})
	require.ErrorIs(t, err, ErrChannelPricingVersionConflict)
	var history []ChannelPricingHistory
	require.NoError(t, DB.Where("channel_id = ?", 6).Find(&history).Error)
	assert.Empty(t, history, "a version conflict must not write history")
}

func TestLoadChannelInternalPricesKeepsPerChannelAndReviewEntries(t *testing.T) {
	setupChannelModelPricingDB(t)
	inputA, outputA := 1.0, 2.0
	inputB, outputB := 0.8, 1.6
	normalized := func(input, output float64) string {
		encoded, err := common.Marshal(ChannelOfficialPricing{
			Currency: "USD",
			Unit:     "per_1m_token",
			Tiers: []ChannelPricingTier{{
				RangeName: "Default", Unit: "per_1m_token",
				InputPerMillionUSD: MoneyFromFloatPtr(&input), OutputPerMillionUSD: MoneyFromFloatPtr(&output),
			}},
		})
		require.NoError(t, err)
		return string(encoded)
	}
	internal := func(input, output float64) string {
		encoded, err := common.Marshal(ChannelInternalPricing{
			Mode:               ChannelPricingModePerMillionTokens,
			InputUSDPerMillion: MoneyFromFloatPtr(&input), OutputUSDPerMillion: MoneyFromFloatPtr(&output),
			Source: "bailian-official",
		})
		require.NoError(t, err)
		return string(encoded)
	}
	_, err := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{
		{ChannelId: 1, Provider: "bailian", ModelName: "shared", Currency: "USD", NormalizedPricing: normalized(inputA, outputA), InternalPricing: internal(inputA, outputA), Source: "bailian-official"},
		{ChannelId: 2, Provider: "bailian", ModelName: "shared", Currency: "USD", NormalizedPricing: normalized(inputB, outputB), InternalPricing: internal(inputB, outputB), Source: "bailian-official"},
		{ChannelId: 3, Provider: "bailian", ModelName: "review-only", Currency: "USD", NormalizedPricing: normalized(3, 6), Source: "bailian-official"},
	})
	require.NoError(t, err)
	// Mark channel 3's row review-only.
	require.NoError(t, DB.Model(&ChannelModelPricing{}).
		Where("channel_id = ? AND model_name = ?", 3, "review-only").
		Update("pricing_status", ChannelPricingStatusNeedsReview).Error)
	InvalidatePricingCache()

	best, byChannel := loadChannelInternalPrices([]AbilityWithChannel{
		{Ability: Ability{ChannelId: 1, Model: "shared", Enabled: true}, ChannelName: "阿里百炼", ChannelStatus: common.ChannelStatusEnabled},
		{Ability: Ability{ChannelId: 2, Model: "shared", Enabled: true}, ChannelName: "优特渠道", ChannelStatus: common.ChannelStatusEnabled},
		{Ability: Ability{ChannelId: 3, Model: "review-only", Enabled: true}, ChannelName: "阿里百炼", ChannelStatus: common.ChannelStatusEnabled},
	})
	require.InDelta(t, 0.4, best["shared"].modelRatio, 1e-9, "best view keeps the lowest channel price")
	require.Len(t, byChannel["shared"], 2)
	require.InDelta(t, 0.5, byChannel["shared"]["阿里百炼"].modelRatio, 1e-9)
	require.InDelta(t, 0.4, byChannel["shared"]["优特渠道"].modelRatio, 1e-9)
	review := byChannel["review-only"]["阿里百炼"]
	require.Equal(t, -1, review.quotaType)
	require.Equal(t, ChannelPricingStatusNeedsReview, review.status)
	require.NotNil(t, review.officialTier)
}

// Regression: a tiered-expression row carries no single amount (its inputUSD is
// a placeholder of 1). It must never win the lowest-price comparison against a
// configured absolute row for the same channel and model, whichever order the
// database returns them in.
func TestLoadChannelInternalPricesAbsolutePriceWinsOverExpressionRow(t *testing.T) {
	setupChannelModelPricingDB(t)
	input, output := 6.6, 33.0
	officialInput, officialOutput := 10.0, 50.0
	normalized, err := common.Marshal(ChannelOfficialPricing{
		Currency: "USD",
		Unit:     "per_1m_token",
		Tiers: []ChannelPricingTier{{
			RangeName: "Default", Unit: "per_1m_token",
			InputPerMillionUSD: MoneyFromFloatPtr(&officialInput), OutputPerMillionUSD: MoneyFromFloatPtr(&officialOutput),
		}},
	})
	require.NoError(t, err)
	absolute, err := common.Marshal(ChannelInternalPricing{
		Mode:               ChannelPricingModePerMillionTokens,
		InputUSDPerMillion: MoneyFromFloatPtr(&input), OutputUSDPerMillion: MoneyFromFloatPtr(&output),
		Source: "batch",
	})
	require.NoError(t, err)
	expression, err := common.Marshal(ChannelInternalPricing{
		Mode:        ChannelPricingModeTieredExpr,
		BillingExpr: `tier("base", p * 10 + c * 50) * 1.1`,
		Source:      "newapi-expression",
	})
	require.NoError(t, err)
	records := []ChannelOfficialPricingRecord{
		{ChannelId: 9, Provider: "uterroute", ModelName: "m", Currency: "USD",
			NormalizedPricing: string(normalized), InternalPricing: string(absolute), Source: "uterroute-official"},
		{ChannelId: 9, Provider: "newapi-compatible", ModelName: "m", Currency: "USD",
			NormalizedPricing: `{}`, InternalPricing: string(expression), Source: "newapi:/api/pricing"},
	}
	// Both orders must select the absolute row.
	for _, order := range [][]ChannelOfficialPricingRecord{records, {records[1], records[0]}} {
		require.NoError(t, DB.Exec("DELETE FROM channel_model_pricing").Error)
		_, err = UpsertChannelOfficialPricing(order)
		require.NoError(t, err)
		InvalidatePricingCache()

		best, byChannel := loadChannelInternalPrices([]AbilityWithChannel{
			{Ability: Ability{ChannelId: 9, Model: "m", Enabled: true}, ChannelName: "优特精选", ChannelStatus: common.ChannelStatusEnabled},
		})
		require.Equal(t, 0, best["m"].quotaType, "expression placeholder must not outrank the absolute price")
		require.InDelta(t, 3.3, best["m"].modelRatio, 1e-9) // $6.6 / 2
		require.Equal(t, 0, byChannel["m"]["优特精选"].quotaType)
	}
}

func TestCanonicalModelTagClassifiesSixCategories(t *testing.T) {
	modalities := func(raw string) *Model { return &Model{InputModalities: raw} }
	cases := []struct {
		name      string
		model     *Model
		endpoints []constant.EndpointType
		want      string
	}{
		{"qwen4-max", nil, nil, "Text"},
		{"gpt-4o", modalities("text,image"), nil, "Image"},
		{"wan3.0-video", nil, nil, "Video"},
		{"qwen3-tts-flash", nil, nil, "Audio"},
		{"qwen3.7-text-embedding", nil, nil, "Embedding"},
		{"qwen3.5-omni-plus", nil, nil, "Omni"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, canonicalModelTag(tc.name, tc.model, tc.endpoints))
		})
	}
}

func TestUpsertAdoptsLegacyBailianModelProviderIdentity(t *testing.T) {
	setupChannelModelPricingDB(t)
	_, err := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{{
		ChannelId: 95, Provider: "qwen", ModelName: "qwen-max", Currency: "USD",
		NormalizedPricing: `{"currency":"USD","channel_price_tiers":[]}`, Source: "bailian-channel",
	}})
	require.NoError(t, err)
	_, err = UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{{
		ChannelId: 95, Provider: "alibaba-bailian", ModelProvider: "qwen", ModelName: "qwen-max",
		Currency: "USD", NormalizedPricing: `{"currency":"USD","channel_price_tiers":[]}`, Source: "bailian-channel",
	}})
	require.NoError(t, err)

	rows, err := ListChannelModelPricing(95)
	require.NoError(t, err)
	require.Len(t, rows, 1, "the legacy row must be adopted, not duplicated")
	require.Equal(t, "alibaba-bailian", rows[0].Provider)
	require.Equal(t, "qwen", rows[0].ModelProvider)
}

func TestUpsertAdoptsStaleGenericProviderIdentity(t *testing.T) {
	setupChannelModelPricingDB(t)
	_, err := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{{
		ChannelId: 96, Provider: "newapi-compatible", ModelName: "claude-a", Currency: "USD",
		NormalizedPricing: `{"currency":"USD","channel_price_tiers":[]}`, Source: "newapi:/api/pricing",
	}})
	require.NoError(t, err)
	_, err = UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{{
		ChannelId: 96, Provider: "uterapi", ModelName: "claude-a", Currency: "USD",
		NormalizedPricing: `{"currency":"USD","channel_price_tiers":[]}`, Source: "newapi:/api/pricing",
	}})
	require.NoError(t, err)

	rows, err := ListChannelModelPricing(96)
	require.NoError(t, err)
	require.Len(t, rows, 1, "a stale provider label must be rewritten, not duplicated")
	assert.Equal(t, "uterapi", rows[0].Provider)
}

func TestPurchaseCostIsSeparateFromQuoteAndFeedsSnapshot(t *testing.T) {
	db := setupChannelModelPricingDB(t)
	input, output, quote := 2.0, 4.0, 1.2
	normalized := ChannelOfficialPricing{
		Currency: "USD", Unit: "per_1m_token",
		Tiers:        []ChannelPricingTier{{RangeName: "base", InputPerMillionUSD: MoneyFromFloatPtr(&input), OutputPerMillionUSD: MoneyFromFloatPtr(&output), Unit: "per_1m_token"}},
		ChannelPrice: &ChannelPricingTier{RangeName: "quote", InputPerMillionUSD: MoneyFromFloatPtr(&quote), Unit: "per_1m_token"},
	}
	encoded, err := common.Marshal(normalized)
	require.NoError(t, err)
	_, err = UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{{
		ChannelId: 7, Provider: "test", ModelName: "costed", Currency: "USD",
		OfficialPricing: `{}`, NormalizedPricing: string(encoded), Source: "test", FetchedAt: 1,
	}})
	require.NoError(t, err)

	identity := ChannelPricingIdentity{ChannelId: 7, Provider: "test", ModelName: "costed"}
	require.NoError(t, SetChannelInternalPricingFor(identity, ChannelInternalPricing{
		Mode: ChannelPricingModePerMillionTokens, InputUSDPerMillion: MoneyFromFloatPtr(&input),
		OutputUSDPerMillion: MoneyFromFloatPtr(&output), Source: "manual", UpdatedAt: 2,
	}))

	effective := ResolveEffectiveChannelPricingFor(identity)
	require.True(t, effective.Billable)
	require.NotNil(t, effective.Pricing.PurchaseUSD)
	assert.InDelta(t, 1.2, *effective.Pricing.PurchaseUSD, 1e-9, "without a contract cost the public quote is used")
	assert.False(t, effective.Pricing.PurchaseVerified)

	contractInput, contractOutput := 0.8, 1.6
	require.NoError(t, SetChannelPurchaseCostFor(identity, ChannelPurchaseCost{
		Pricing: ChannelInternalPricing{
			Mode: ChannelPricingModePerMillionTokens, InputUSDPerMillion: MoneyFromFloatPtr(&contractInput),
			OutputUSDPerMillion: MoneyFromFloatPtr(&contractOutput),
		},
		Verified: true, Source: "contract-2026",
	}))

	effective = ResolveEffectiveChannelPricingFor(identity)
	require.NotNil(t, effective.Pricing.PurchaseUSD)
	assert.InDelta(t, 0.8, *effective.Pricing.PurchaseUSD, 1e-9, "contract cost overrides the quote")
	assert.True(t, effective.Pricing.PurchaseVerified)
	assert.Equal(t, "contract-2026", effective.Pricing.PurchaseSource)

	var row ChannelModelPricing
	require.NoError(t, db.Where("channel_id = ? AND model_name = ?", 7, "costed").First(&row).Error)
	assert.Contains(t, row.PurchasePricing, `"verified":true`)
}

func TestBillingPriceSnapshotIsImmutablePerIdentity(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&BillingPriceSnapshot{}))
	previous := DB
	DB = db
	t.Cleanup(func() { DB = previous })

	first := BillingPriceSnapshot{
		RequestId: "req-1", ModelName: "gpt-a", ChannelId: 3,
		PricingVersion: "v1", BillingMode: ChannelPricingModePerMillionTokens, CreatedAt: 10,
	}
	require.NoError(t, SaveBillingPriceSnapshot(first))
	require.NoError(t, SaveBillingPriceSnapshot(BillingPriceSnapshot{
		RequestId: "req-1", ModelName: "gpt-a", ChannelId: 3,
		PricingVersion: "v2", CreatedAt: 20,
	}))

	got, err := GetBillingPriceSnapshot("req-1", "", "gpt-a")
	require.NoError(t, err)
	assert.Equal(t, "v1", got.PricingVersion, "a retry must not rewrite the original contract")

	require.NoError(t, SaveBillingPriceSnapshot(BillingPriceSnapshot{
		RequestId: "req-2", TaskId: "task-9", ModelName: "video-a", ChannelId: 3, PricingVersion: "v3",
	}))
	got, err = GetBillingPriceSnapshot("req-2", "task-9", "video-a")
	require.NoError(t, err)
	assert.Equal(t, "v3", got.PricingVersion)

	rows, err := ListBillingPriceSnapshots(3, 10)
	require.NoError(t, err)
	assert.Len(t, rows, 2)
}

func TestUpsertReviewRecordNeverBecomesBillable(t *testing.T) {
	db := setupChannelModelPricingDB(t)
	input, output := 2.0, 4.0
	internal, err := common.Marshal(ChannelInternalPricing{
		Mode: ChannelPricingModePerMillionTokens, InputUSDPerMillion: MoneyFromFloatPtr(&input),
		OutputUSDPerMillion: MoneyFromFloatPtr(&output), Source: "uterroute-discount", UpdatedAt: 1,
	})
	require.NoError(t, err)
	normalized := `{"currency":"USD","unit":"expression","needs_review":true,"review_reasons":["HISTORICAL_SNAPSHOT"]}`
	_, err = UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{{
		ChannelId: 61, Provider: "uterroute", ModelName: "reviewed", Currency: "USD",
		OfficialPricing: `{}`, NormalizedPricing: normalized,
		InternalPricing: string(internal), Source: "uterroute-official", FetchedAt: 1,
	}})
	require.NoError(t, err)
	var row ChannelModelPricing
	require.NoError(t, db.Where("channel_id = ? AND model_name = ?", 61, "reviewed").First(&row).Error)
	assert.Empty(t, row.InternalPricing)
	assert.Equal(t, ChannelPricingStatusNeedsReview, row.PricingStatus)
	effective := ResolveEffectiveChannelPricing(61, "reviewed")
	assert.False(t, effective.Billable)
}

func TestReviewGateKeepsBatchPriceAndClearsAutoPrice(t *testing.T) {
	db := setupChannelModelPricingDB(t)
	input, output := 2.0, 4.0
	batchPricing, _ := common.Marshal(ChannelInternalPricing{
		Mode: ChannelPricingModePerMillionTokens, InputUSDPerMillion: MoneyFromFloatPtr(&input),
		OutputUSDPerMillion: MoneyFromFloatPtr(&output), Source: "batch", UpdatedAt: 1,
	})
	autoPricing, _ := common.Marshal(ChannelInternalPricing{
		Mode: ChannelPricingModePerMillionTokens, InputUSDPerMillion: MoneyFromFloatPtr(&input),
		OutputUSDPerMillion: MoneyFromFloatPtr(&output), Source: "bailian-channel", UpdatedAt: 1,
	})
	normalized := `{"currency":"USD","unit":"per_1m_token","needs_review":true,"review_reasons":["multiple cache read prices"]}`
	for name, internal := range map[string]string{"batch-row": string(batchPricing), "auto-row": string(autoPricing)} {
		require.NoError(t, db.Create(&ChannelModelPricing{
			ChannelId: 71, Provider: "test", ModelName: name, NormalizedPricing: normalized,
			InternalPricing: internal, PricingStatus: ChannelPricingStatusConfigured,
		}).Error)
	}
	cleared, err := EnforcePricingReviewGate()
	require.NoError(t, err)
	assert.Equal(t, 1, cleared)

	var batchRow, autoRow ChannelModelPricing
	require.NoError(t, db.Where("channel_id = ? AND model_name = ?", 71, "batch-row").First(&batchRow).Error)
	require.NoError(t, db.Where("channel_id = ? AND model_name = ?", 71, "auto-row").First(&autoRow).Error)
	assert.Equal(t, ChannelPricingStatusConfigured, batchRow.PricingStatus)
	assert.NotEmpty(t, batchRow.InternalPricing)
	assert.Equal(t, ChannelPricingStatusNeedsReview, autoRow.PricingStatus)
	assert.Empty(t, autoRow.InternalPricing)
}

func TestAutoDerivedSourcesAgreeAcrossFunctions(t *testing.T) {
	for _, source := range []string{
		"uterroute-discount", "bailian-channel", "newapi:/api/pricing",
		"generic:/api/pricing", "uterapi-group", "apiko-expression",
	} {
		require.True(t, autoDerivedInternalSource(source), source)
		encoded, err := common.Marshal(ChannelInternalPricing{Source: source})
		require.NoError(t, err)
		require.True(t, internalPricingReplaceable(string(encoded)), source)
	}
	encoded, err := common.Marshal(ChannelInternalPricing{Source: "operator"})
	require.NoError(t, err)
	require.False(t, internalPricingReplaceable(string(encoded)))
}

func TestChannelUsesScopedPricing(t *testing.T) {
	db := setupChannelModelPricingDB(t)
	require.NoError(t, db.Create(&ChannelModelPricing{
		ChannelId: 77, Provider: "uterapi", ModelName: "gpt-a",
	}).Error)
	InvalidateChannelPricingPresence(77)
	InvalidateChannelPricingPresence(78)

	assert.True(t, ChannelUsesScopedPricing(77))
	assert.False(t, ChannelUsesScopedPricing(78))
}

// 显式定价模式必须压过“价格表是否有行”的旧推断。
func TestChannelScopedPricingRequiredHonoursExplicitMode(t *testing.T) {
	db := setupChannelModelPricingDB(t)
	require.NoError(t, db.Create(&ChannelModelPricing{
		ChannelId: 79, Provider: "uterroute", ModelName: "m-a",
	}).Error)
	InvalidateChannelPricingPresence(79)
	InvalidateChannelPricingPresence(80)

	assert.True(t, ChannelScopedPricingRequired(80, "CHANNEL_SCOPED_PENDING"))
	assert.True(t, ChannelScopedPricingRequired(79, "CHANNEL_SCOPED_ACTIVE"))
	assert.False(t, ChannelScopedPricingRequired(79, "GLOBAL_LEGACY"))
	// 未打标签的旧渠道保持历史行为。
	assert.True(t, ChannelScopedPricingRequired(79, ""))
	assert.False(t, ChannelScopedPricingRequired(80, ""))
}

func TestListOrphanChannelPricing(t *testing.T) {
	db := setupChannelModelPricingDB(t)
	require.NoError(t, db.AutoMigrate(&Channel{}))
	require.NoError(t, db.Create(&Channel{Id: 1, Name: "live", Status: 1}).Error)
	require.NoError(t, db.Create(&ChannelModelPricing{ChannelId: 1, Provider: "p", ModelName: "a"}).Error)
	require.NoError(t, db.Create(&ChannelModelPricing{ChannelId: 99, Provider: "p", ModelName: "b"}).Error)
	require.NoError(t, db.Create(&ChannelModelPricing{ChannelId: 99, Provider: "p", ModelName: "c"}).Error)

	orphans, err := ListOrphanChannelPricing()
	require.NoError(t, err)
	require.Len(t, orphans, 1)
	assert.Equal(t, 99, orphans[0].ChannelId)
	assert.EqualValues(t, 2, orphans[0].Count)

	rows, err := ListOrphanChannelPricingRows()
	require.NoError(t, err)
	require.Len(t, rows, 2)
	assert.Equal(t, 99, rows[0].ChannelId)
}

func TestPricingOwnerMapping(t *testing.T) {
	assert.Equal(t, ChannelPricingOwnerAuto, PricingOwnerForSource("newapi-expression"))
	assert.Equal(t, ChannelPricingOwnerAuto, PricingOwnerForSource("bailian-channel"))
	assert.Equal(t, ChannelPricingOwnerApproved, PricingOwnerForSource("review-approved"))
	assert.Equal(t, ChannelPricingOwnerBatch, PricingOwnerForSource("batch"))
	assert.Equal(t, ChannelPricingOwnerOperator, PricingOwnerForSource("manual"))
	assert.Empty(t, PricingOwnerForSource(""))
}

// 人工价格必须靠显式所有权阻止自动同步覆盖，而不是继续猜测 Source 字符串。
func TestPricingOwnerProtectsOperatorPriceFromSync(t *testing.T) {
	setupChannelModelPricingDB(t)
	record := officialRecord(97, "owner-protected", "newapi-expression")
	record.InternalPricing = `{"mode":"per_1m_token","input_per_million_usd":1,"output_per_million_usd":2,"source":"manual"}`
	_, err := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{record})
	require.NoError(t, err)

	row, err := GetChannelModelPricing(97, "owner-protected")
	require.NoError(t, err)
	assert.Equal(t, ChannelPricingOwnerOperator, row.PricingOwner)

	record.InternalPricing = `{"mode":"per_1m_token","input_per_million_usd":9,"output_per_million_usd":9,"source":"newapi-expression"}`
	_, err = UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{record})
	require.NoError(t, err)
	row, err = GetChannelModelPricing(97, "owner-protected")
	require.NoError(t, err)
	assert.Contains(t, row.InternalPricing, `"input_per_million_usd":1`)
	assert.Equal(t, ChannelPricingOwnerOperator, row.PricingOwner)
}

// AUTO 价格可以被后续同步刷新；APPROVED 价格即使官方记录被标记待审核也不清除。
// 原始 SQL 改价可能留下过期 owner；此时必须以价格自身的 Source 为准，
// 不能把人工价格当作自动价格覆盖。
func TestStaleAutoOwnerDoesNotOverwriteManualPrice(t *testing.T) {
	setupChannelModelPricingDB(t)
	record := officialRecord(100, "stale-owner", "newapi-expression")
	record.InternalPricing = `{"mode":"per_1m_token","input_per_million_usd":1,"source":"newapi-expression"}`
	_, err := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{record})
	require.NoError(t, err)
	require.NoError(t, DB.Model(&ChannelModelPricing{}).
		Where("channel_id = ? AND model_name = ?", 100, "stale-owner").
		Update("internal_pricing", `{"mode":"per_1m_token","input_per_million_usd":9,"source":"manual"}`).Error)

	record.InternalPricing = `{"mode":"per_1m_token","input_per_million_usd":2,"source":"newapi-expression"}`
	_, err = UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{record})
	require.NoError(t, err)
	row, err := GetChannelModelPricing(100, "stale-owner")
	require.NoError(t, err)
	assert.Contains(t, row.InternalPricing, `"input_per_million_usd":9`)
}

func TestPricingOwnerRefreshesAutoAndKeepsApproved(t *testing.T) {
	setupChannelModelPricingDB(t)
	record := officialRecord(98, "owner-auto", "newapi-expression")
	record.InternalPricing = `{"mode":"per_1m_token","input_per_million_usd":1,"source":"newapi-expression"}`
	_, err := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{record})
	require.NoError(t, err)
	row, err := GetChannelModelPricing(98, "owner-auto")
	require.NoError(t, err)
	assert.Equal(t, ChannelPricingOwnerAuto, row.PricingOwner)

	record.InternalPricing = `{"mode":"per_1m_token","input_per_million_usd":2,"source":"newapi-expression"}`
	_, err = UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{record})
	require.NoError(t, err)
	row, err = GetChannelModelPricing(98, "owner-auto")
	require.NoError(t, err)
	assert.Contains(t, row.InternalPricing, `"input_per_million_usd":2`)

	approved := `{"mode":"per_1m_token","input_per_million_usd":3,"source":"review-approved"}`
	require.NoError(t, DB.Create(&ChannelModelPricing{
		ChannelId: 99, Provider: "newapi-compatible", ModelName: "owner-approved",
		NormalizedPricing: `{"currency":"USD","needs_review":true}`,
		InternalPricing:   approved, PricingOwner: ChannelPricingOwnerApproved,
		PricingStatus: ChannelPricingStatusConfigured,
	}).Error)
	cleared, err := EnforcePricingReviewGate()
	require.NoError(t, err)
	assert.Zero(t, cleared)
	row, err = GetChannelModelPricing(99, "owner-approved")
	require.NoError(t, err)
	assert.Equal(t, approved, row.InternalPricing)
}
