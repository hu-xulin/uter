//go:build bailian_live

package service

import (
	"context"
	"os"
	"testing"

	"github.com/joho/godotenv"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
)

// Pulls the real official catalog with the configured Bailian channel key and
// stores it as a reference snapshot. Run only against a local database:
//
//	BAILIAN_CHANNEL_ID=28 go test -tags bailian_live ./service -run TestPullBailianCatalogLive -v
func TestPullBailianCatalogLive(t *testing.T) {
	if os.Getenv("BAILIAN_LIVE") == "" {
		t.Skip("set BAILIAN_LIVE=1 to pull the real catalog")
	}
	_ = godotenv.Load("../.env")
	absDB, err := os.Getwd()
	require.NoError(t, err)
	require.NoError(t, os.Setenv("SQLITE_PATH", absDB+"/../one-api.db"))
	common.InitEnv()
	require.NoError(t, model.InitDB())
	model.InitOptionMap()

	channels, err := model.GetAllChannels(0, 1000, true, true)
	require.NoError(t, err)
	var channel *model.Channel
	for _, candidate := range channels {
		if candidate.Type == constant.ChannelTypeAli && candidate.Status == 1 {
			channel = candidate
			break
		}
	}
	require.NotNil(t, channel, "no enabled Alibaba Bailian channel")
	channelID := channel.Id
	key, _, apiErr := channel.GetNextEnabledKey()
	require.Nil(t, apiErr)

	catalog, err := FetchBailianCatalog(context.Background(), channel.GetBaseURL(), key)
	require.NoError(t, err)
	catalog.ChannelID = channelID
	catalog.Region = BailianRegionOf(channel.GetBaseURL())
	catalog.ReferencePrice = NormalizeBailianPrices(catalog)
	require.NoError(t, SaveBailianCatalogSnapshot(catalog))

	priced := 0
	for _, item := range catalog.Models {
		if len(item.Prices) > 0 {
			priced++
		}
	}
	t.Logf("catalog: total=%d priced=%d references=%d region=%s base=%s",
		len(catalog.Models), priced, len(catalog.ReferencePrice), catalog.Region, catalog.BaseURL)

	if os.Getenv("BAILIAN_APPLY") != "" {
		result, err := ApplyBailianCatalog(catalog, channel.GetModels())
		require.NoError(t, err)
		require.NotNil(t, result.Metadata)
		t.Logf("apply: channel_models=%d matched=%d unmatched=%d metadata_created=%d metadata_updated=%d reference_prices=%d",
			result.ChannelModels, result.MatchedModels, len(result.UnmatchedModels),
			len(result.Metadata.CreatedModels), len(result.Metadata.UpdatedModels), result.ReferencePrices)
	}
}
