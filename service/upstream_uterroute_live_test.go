//go:build upstream_live

package service

import (
	"context"
	"os"
	"testing"

	"github.com/joho/godotenv"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/pkg/testdb"
)

// Pulls the real public Uter Route pricing document into the isolated
// snapshot. It does not touch ModelRatio / ModelPrice / billing_expr.
//
//	UPSTREAM_LIVE=1 go test -tags upstream_live ./service -run TestPullUterRouteUpstreamLive -v
func TestPullUterRouteUpstreamLive(t *testing.T) {
	if os.Getenv("UPSTREAM_LIVE") == "" {
		t.Skip("set UPSTREAM_LIVE=1 to pull the real Uter Route pricing")
	}
	_ = godotenv.Load("../.env")
	absDB, err := os.Getwd()
	require.NoError(t, err)
	require.NoError(t, os.Setenv("SQLITE_PATH", testdb.LiveDBForTest(t, absDB+"/../one-api.db")))
	common.InitEnv()
	require.NoError(t, model.InitDB())
	model.InitOptionMap()

	snapshot, err := FetchUterRouteUpstream(context.Background(), "")
	require.NoError(t, err)
	require.NoError(t, SaveUterRouteUpstreamSnapshot(snapshot))
	require.NotEmpty(t, snapshot.Models)
	t.Logf("uterroute upstream: models=%d groups=%d group_overrides=%d version=%s basis=%s",
		len(snapshot.Models), len(snapshot.GroupRatio), len(snapshot.GroupGroupRatio),
		snapshot.PricingVersion, snapshot.PriceBasis)
	for _, item := range snapshot.Models {
		if item.ModelName != "claude-fable-5-2" {
			continue
		}
		discount, modelGroup, ok := UterRouteDiscountForModel(snapshot, item, UterRouteDiscountGroupDefault)
		require.True(t, ok, "default group must publish a discount for an enabled model group")
		require.NotNil(t, item.OfficialPrice)
		channelLine := scaleUpstreamPriceLine(item.OfficialPrice, discount)
		t.Logf("channel price sample: %s official=%v discount=%v group=%s channel=%v",
			item.ModelName, *item.OfficialPrice.Input, discount, modelGroup, *channelLine.Input)
	}
	channel, err := model.GetChannelById(32, true)
	require.NoError(t, err)
	records, err := UterRouteChannelPricingRecords(
		snapshot, channel.Id, channel.GetModels(), GetUterRouteDiscountGroup(channel.Id),
	)
	require.NoError(t, err)
	priced := 0
	for _, record := range records {
		if record.InternalPricing != "" {
			priced++
		}
	}
	t.Logf("channel %d: records=%d derived_channel_prices=%d discount_group=%s",
		channel.Id, len(records), priced, GetUterRouteDiscountGroup(channel.Id))
	if os.Getenv("UPSTREAM_LIVE_APPLY") == "1" {
		written, writeErr := model.UpsertChannelOfficialPricing(records)
		require.NoError(t, writeErr)
		t.Logf("applied channel %d pricing records: %d", channel.Id, written)
	}
}
