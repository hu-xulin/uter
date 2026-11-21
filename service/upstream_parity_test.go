package service

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

func TestBuildUpstreamParityReportClassifiesRows(t *testing.T) {
	now := time.Unix(2_000_000, 0)
	price := 2.0
	channelTier, _ := common.Marshal(model.ChannelOfficialPricing{
		ChannelPriceTiers: []model.ChannelPricingTier{{Unit: "per_1m_token", InputPerMillionUSD: &price}},
		Source:            "bailian-channel",
	})
	configured, _ := common.Marshal(model.ChannelInternalPricing{
		Mode: model.ChannelPricingModePerMillionTokens, InputUSDPerMillion: &price, OutputUSDPerMillion: &price,
	})
	unsupported, _ := common.Marshal(model.ChannelOfficialPricing{
		ExpressionStatus: UpstreamExpressionUnsupported, BillingExpr: "not valid (", Source: "newapi",
	})
	rows := []model.ChannelModelPricing{
		{ModelName: "matched", LifecycleStatus: model.ChannelModelLifecycleActive, PricingStatus: model.ChannelPricingStatusConfigured, NormalizedPricing: string(channelTier), InternalPricing: string(configured), FetchedAt: now.Add(-time.Hour).Unix()},
		{ModelName: "stale", LifecycleStatus: model.ChannelModelLifecycleActive, PricingStatus: model.ChannelPricingStatusConfigured, NormalizedPricing: string(channelTier), InternalPricing: string(configured), FetchedAt: now.Add(-8 * 24 * time.Hour).Unix()},
		{ModelName: "no-sale", LifecycleStatus: model.ChannelModelLifecycleActive, PricingStatus: model.ChannelPricingStatusOfficialOnly, NormalizedPricing: string(channelTier), FetchedAt: now.Unix()},
		{ModelName: "disabled", LifecycleStatus: model.ChannelModelLifecycleDisabled, PricingStatus: model.ChannelPricingStatusConfigured, NormalizedPricing: string(channelTier), InternalPricing: string(configured), FetchedAt: now.Unix()},
		{ModelName: "unsupported", LifecycleStatus: model.ChannelModelLifecycleActive, PricingStatus: model.ChannelPricingStatusNeedsReview, NormalizedPricing: string(unsupported), FetchedAt: now.Unix()},
	}
	report := BuildUpstreamParityReport(1, "test", rows, now)
	byName := map[string]UpstreamParityModel{}
	for _, item := range report.Models {
		byName[item.ModelName] = item
	}
	require.Equal(t, UpstreamParityFullyMatched, byName["matched"].Status)
	require.Equal(t, UpstreamParityStale, byName["stale"].Status)
	require.Equal(t, UpstreamParityPriceMismatch, byName["no-sale"].Status)
	require.Equal(t, UpstreamParityModelMismatch, byName["disabled"].Status)
	require.Equal(t, UpstreamParityUnsupported, byName["unsupported"].Status)
	require.Equal(t, 1, report.Summary[UpstreamParityFullyMatched])
}
