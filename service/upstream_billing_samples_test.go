package service

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

func TestReconcileUpstreamBillingSamplesComparesConfiguredPrice(t *testing.T) {
	setupBatchPricingDB(t)
	base := "https://api.example.com"
	channel := &model.Channel{Id: 97, Type: 60, BaseURL: &base}
	input, output := 2.0, 4.0
	pricing, err := common.Marshal(model.ChannelInternalPricing{
		Mode:               model.ChannelPricingModePerMillionTokens,
		InputUSDPerMillion: &input, OutputUSDPerMillion: &output, Source: "manual",
	})
	require.NoError(t, err)
	_, err = model.UpsertChannelOfficialPricing([]model.ChannelOfficialPricingRecord{{
		ChannelId: 97, Provider: "uter", ModelName: "m", Currency: "USD",
		NormalizedPricing: `{}`, InternalPricing: string(pricing), Source: "manual",
	}})
	require.NoError(t, err)

	report, err := ReconcileUpstreamBillingSamples(channel, []UpstreamBillingSample{
		{ModelName: "m", InputTokens: 1_000_000, OutputTokens: 1_000_000, UpstreamCostUSD: 6},
		{ModelName: "m", InputTokens: 1_000_000, OutputTokens: 1_000_000, UpstreamCostUSD: 7},
		{ModelName: "missing", InputTokens: 1000, UpstreamCostUSD: 1},
	})
	require.NoError(t, err)
	require.Equal(t, UpstreamSampleMatched, report.Results[0].Status)
	require.InDelta(t, 6, report.Results[0].UterCostUSD, 1e-9)
	require.Equal(t, UpstreamSampleMismatched, report.Results[1].Status)
	require.InDelta(t, -1, report.Results[1].DifferenceUSD, 1e-9)
	require.Equal(t, UpstreamSampleNoPrice, report.Results[2].Status)
}
