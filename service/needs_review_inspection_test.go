package service

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

func needsReviewRow(t *testing.T, channelID int, name string, view model.ChannelOfficialPricing) model.ChannelOfficialPricingRecord {
	t.Helper()
	encoded, err := common.Marshal(view)
	require.NoError(t, err)
	return model.ChannelOfficialPricingRecord{
		ChannelId: channelID, Provider: "bailian", ModelName: name,
		NormalizedPricing: string(encoded), Source: "test",
	}
}

func TestInspectNeedsReviewPricingClassifiesRowsWithoutWriting(t *testing.T) {
	setupBatchPricingDB(t)

	input, output := 3.0, 6.0
	tier := model.ChannelPricingTier{
		InputPerMillionUSD: model.MoneyFromFloatPtr(&input),
		OutputPerMillionUSD: model.MoneyFromFloatPtr(&output),
	}
	rows := []model.ChannelOfficialPricingRecord{
		needsReviewRow(t, 42, "tiered-model", model.ChannelOfficialPricing{
			Tiers: []model.ChannelPricingTier{tier, tier},
			ChannelPrice: &tier,
			NeedsReview: true, ReviewReasons: []string{"multiple tiers"},
		}),
		needsReviewRow(t, 42, "no-channel-price", model.ChannelOfficialPricing{
			Tiers: []model.ChannelPricingTier{tier},
			NeedsReview: true, ReviewReasons: []string{"official only"},
		}),
	}
	_, err := model.UpsertChannelOfficialPricing(rows)
	require.NoError(t, err)

	inspection, err := InspectNeedsReviewPricing(42)
	require.NoError(t, err)
	require.Equal(t, 2, inspection.NeedsReview)
	require.Empty(t, inspection.Remediable, "unknown/tiered reasons must never be auto-remediated")
	require.Len(t, inspection.Manual, 2)
	classifications := map[string]string{}
	for _, row := range inspection.Manual {
		classifications[row.ModelName] = row.Classification
	}
	require.Equal(t, needsReviewClassTiered, classifications["tiered-model"])
	require.Equal(t, needsReviewClassNoChannel, classifications["no-channel-price"])
}

func TestInspectNeedsReviewPricingRequiresChannel(t *testing.T) {
	_, err := InspectNeedsReviewPricing(0)
	require.Error(t, err)
}
