package model

import (
	"testing"

	"github.com/Uter-AI/Uter/common"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// useAutoFillDB installs an in-memory database for the pricing fill, which
// persists into the options table through mutateModelPricingOptions. The
// in-memory option map must exist because every write also republishes into
// common.OptionMap.
func useAutoFillDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB := DB
	previousType := common.MainDatabaseType()
	previousOptionMap := common.OptionMap
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Option{}, &Model{}))
	DB = db
	common.OptionMap = make(map[string]string)
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		DB = previousDB
		common.OptionMap = previousOptionMap
		common.SetMainDatabaseType(previousType)
	})
	return db
}

// A model with no saved price must receive the official price, and re-running
// the fill must be a no-op rather than overwriting the stored value.
func TestAutoFillOfficialPricingFillsUnpricedModelsOnly(t *testing.T) {
	useAutoFillDB(t)
	require.NoError(t, DB.Create(&Model{ModelName: "opted-out"}).Error)
	// The column carries a `default:1` tag, so a zero value is dropped from the
	// INSERT and the default applies. Set the opt-out explicitly, exactly as
	// the admin save path does after creating a row.
	require.NoError(t, DB.Model(&Model{}).Where("model_name = ?", "opted-out").
		Update("sync_official", 0).Error)
	require.NoError(t, DB.Create(&Model{ModelName: "already-priced"}).Error)
	require.NoError(t, UpdateModelPricing([]ModelPricingChange{{
		ModelName:       "already-priced",
		ExpectedVersion: ModelPricingVersion(PricingValues{}),
		Pricing:         PricingValues{"ModelRatio": 42.0},
	}}))

	preset := map[string]map[string]float64{
		"unpriced":       {"model_ratio": 3, "completion_ratio": 4},
		"already-priced": {"model_ratio": 99},
		"opted-out":      {"model_ratio": 77},
	}
	names := []string{"unpriced", "already-priced", "opted-out", "not-in-preset"}

	result, err := AutoFillOfficialPricing(names, preset)
	require.NoError(t, err)
	require.Equal(t, []string{"unpriced"}, result.FilledModels)
	require.Equal(t, 1, result.SkippedPriced)
	require.Equal(t, 1, result.SkippedOptOut)
	require.Equal(t, 1, result.SkippedUpstream)

	snapshot, err := GetModelPricingSnapshot([]string{"unpriced", "already-priced", "opted-out", "not-in-preset"})
	require.NoError(t, err)
	configured := map[string]PricingValues{}
	for _, entry := range snapshot.Entries {
		configured[entry.ModelName] = entry.Configured
	}
	require.Equal(t, 3.0, configured["unpriced"]["ModelRatio"])
	require.Equal(t, 4.0, configured["unpriced"]["CompletionRatio"])
	require.Equal(t, 42.0, configured["already-priced"]["ModelRatio"], "an existing price is never replaced")
	require.NotContains(t, configured["opted-out"], "ModelRatio", "sync_official = 0 excludes the model")
	require.NotContains(t, configured["not-in-preset"], "ModelRatio")

	// Idempotence: a second pass finds nothing left to do for the models the
	// preset covers and leaves the stored price untouched even though the
	// preset still quotes a different value. `not-in-preset` is still
	// unpriced, so it is reported as unknown rather than filled.
	second, err := AutoFillOfficialPricing(names, preset)
	require.NoError(t, err)
	require.Empty(t, second.FilledModels)
	require.Equal(t, 2, second.SkippedPriced)
	require.Equal(t, 1, second.SkippedOptOut)
	require.Equal(t, 1, second.SkippedUpstream)

	after, err := GetModelPricingSnapshot([]string{"unpriced"})
	require.NoError(t, err)
	require.Equal(t, 3.0, after.Entries[0].Configured["ModelRatio"])
}

// A per-call official price must not leave a contradictory ratio behind.
func TestAutoFillOfficialPricingPrefersPerCallPrice(t *testing.T) {
	useAutoFillDB(t)

	result, err := AutoFillOfficialPricing([]string{"per-call"}, map[string]map[string]float64{
		"per-call": {"model_price": 0.02, "model_ratio": 8},
	})
	require.NoError(t, err)
	require.Equal(t, []string{"per-call"}, result.FilledModels)

	snapshot, err := GetModelPricingSnapshot([]string{"per-call"})
	require.NoError(t, err)
	configured := snapshot.Entries[0].Configured
	require.Equal(t, 0.02, configured["ModelPrice"])
	require.NotContains(t, configured, "ModelRatio")
}

func TestAutoFillOfficialPricingNoOpWithoutPreset(t *testing.T) {
	useAutoFillDB(t)

	result, err := AutoFillOfficialPricing([]string{"anything"}, nil)
	require.NoError(t, err)
	require.Empty(t, result.FilledModels)
}
