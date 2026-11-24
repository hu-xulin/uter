package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestApplyChannelLifecycleSnapshotDisablesMissingModels(t *testing.T) {
	setupChannelModelPricingDB(t)
	_, err := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{
		officialRecord(71, "active-model", "test"),
		officialRecord(71, "removed-model", "test"),
	})
	require.NoError(t, err)
	for _, name := range []string{"active-model", "removed-model"} {
		input, output := 2.0, 4.0
		require.NoError(t, SetChannelInternalPricing(71, name, ChannelInternalPricing{
			Mode: ChannelPricingModePerMillionTokens, InputUSDPerMillion: MoneyFromFloatPtr(&input), OutputUSDPerMillion: MoneyFromFloatPtr(&output),
			Source: "bailian-channel",
		}))
	}

	active, missing, disabled, err := ApplyChannelLifecycleSnapshot(71, []string{"active-model"}, 100, 2)
	require.NoError(t, err)
	require.Equal(t, 1, active)
	require.Equal(t, 1, missing)
	require.Zero(t, disabled)
	require.True(t, ResolveEffectiveChannelPricing(71, "active-model").Billable)
	require.False(t, ResolveEffectiveChannelPricing(71, "removed-model").Billable)

	_, _, disabled, err = ApplyChannelLifecycleSnapshot(71, []string{"active-model"}, 200, 2)
	require.NoError(t, err)
	require.Equal(t, 1, disabled)
	row, err := GetChannelModelPricing(71, "removed-model")
	require.NoError(t, err)
	require.Equal(t, ChannelModelLifecycleDisabled, row.LifecycleStatus)
	require.False(t, ResolveEffectiveChannelPricing(71, "removed-model").Billable,
		"a disabled model must not bill even when its historical price is intact")

	_, _, _, err = ApplyChannelLifecycleSnapshot(71, []string{"active-model", "removed-model"}, 300, 2)
	require.NoError(t, err)
	row, err = GetChannelModelPricing(71, "removed-model")
	require.NoError(t, err)
	require.Equal(t, ChannelModelLifecycleActive, row.LifecycleStatus)
	require.True(t, ResolveEffectiveChannelPricing(71, "removed-model").Billable)
}

func TestApplyChannelLifecycleSnapshotRejectsEmptySnapshot(t *testing.T) {
	setupChannelModelPricingDB(t)
	_, err := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{officialRecord(72, "model-a", "test")})
	require.NoError(t, err)

	_, _, _, err = ApplyChannelLifecycleSnapshot(72, nil, 100, 2)
	require.ErrorContains(t, err, "complete catalog snapshot")
	row, err := GetChannelModelPricing(72, "model-a")
	require.NoError(t, err)
	require.NotEqual(t, ChannelModelLifecycleDisabled, row.LifecycleStatus)
}

func TestApplyChannelLifecycleSnapshotRetainsManualPrice(t *testing.T) {
	setupChannelModelPricingDB(t)
	_, err := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{
		officialRecord(73, "catalog-model", "test"),
		officialRecord(73, "contract-model", "test"),
	})
	require.NoError(t, err)
	input, output := 2.0, 4.0
	require.NoError(t, SetChannelInternalPricing(73, "catalog-model", ChannelInternalPricing{
		Mode: ChannelPricingModePerMillionTokens, InputUSDPerMillion: MoneyFromFloatPtr(&input), OutputUSDPerMillion: MoneyFromFloatPtr(&output),
		Source: "bailian-channel",
	}))
	require.NoError(t, SetChannelInternalPricing(73, "contract-model", ChannelInternalPricing{
		Mode: ChannelPricingModePerMillionTokens, InputUSDPerMillion: MoneyFromFloatPtr(&input), OutputUSDPerMillion: MoneyFromFloatPtr(&output),
		Source: "manual",
	}))

	_, _, disabled, err := ApplyChannelLifecycleSnapshot(73, []string{"catalog-model"}, 100, 2)
	require.NoError(t, err)
	require.Zero(t, disabled)
	row, err := GetChannelModelPricing(73, "contract-model")
	require.NoError(t, err)
	require.Equal(t, ChannelModelLifecycleActive, row.LifecycleStatus)
	require.True(t, ResolveEffectiveChannelPricing(73, "contract-model").Billable)
}

func TestManualPriceReactivatesDisabledModel(t *testing.T) {
	setupChannelModelPricingDB(t)
	_, err := UpsertChannelOfficialPricing([]ChannelOfficialPricingRecord{officialRecord(74, "removed", "test")})
	require.NoError(t, err)
	price := 2.0
	require.NoError(t, SetChannelInternalPricing(74, "removed", ChannelInternalPricing{
		Mode: ChannelPricingModePerMillionTokens, InputUSDPerMillion: MoneyFromFloatPtr(&price), OutputUSDPerMillion: MoneyFromFloatPtr(&price),
		Source: "bailian-channel",
	}))
	_, _, _, err = ApplyChannelLifecycleSnapshot(74, []string{"another-model"}, 100, 1)
	require.NoError(t, err)
	row, err := GetChannelModelPricing(74, "removed")
	require.NoError(t, err)
	require.Equal(t, ChannelModelLifecycleDisabled, row.LifecycleStatus)
	require.False(t, ResolveEffectiveChannelPricing(74, "removed").Billable)

	require.NoError(t, SetChannelInternalPricing(74, "removed", ChannelInternalPricing{
		Mode: ChannelPricingModePerMillionTokens, InputUSDPerMillion: MoneyFromFloatPtr(&price), OutputUSDPerMillion: MoneyFromFloatPtr(&price),
		Source: "manual",
	}))
	row, err = GetChannelModelPricing(74, "removed")
	require.NoError(t, err)
	require.Equal(t, ChannelModelLifecycleActive, row.LifecycleStatus)
	require.True(t, ResolveEffectiveChannelPricing(74, "removed").Billable)
}
