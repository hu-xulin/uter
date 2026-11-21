//go:build bailian_live

package controller

import (
	"os"
	"testing"

	"github.com/joho/godotenv"

	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
)

// Runs the real post-create pipeline against the configured Bailian channel.
//
//	BAILIAN_LIVE=1 go test -tags bailian_live ./controller -run TestBailianSyncAfterCreateLive -v
func TestBailianSyncAfterCreateLive(t *testing.T) {
	if os.Getenv("BAILIAN_LIVE") == "" {
		t.Skip("set BAILIAN_LIVE=1 to run the real pipeline")
	}
	_ = godotenv.Load("../.env")
	absDB, err := os.Getwd()
	require.NoError(t, err)
	liveDB := os.Getenv("BAILIAN_LIVE_DB")
	if liveDB == "" {
		liveDB = absDB + "/../one-api.db"
	}
	require.NoError(t, os.Setenv("SQLITE_PATH", liveDB))
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

	syncBailianAfterCreate(channel.Id)

	status := service.LoadBailianSyncStatus()
	require.NotNil(t, status)
	require.Equal(t, "ok", status.Steps["discover_models"].Status)
	require.Equal(t, "ok", status.Steps["fetch_catalog"].Status)
	require.Equal(t, "ok", status.Steps["apply_metadata"].Status)
	require.Greater(t, status.ActualModels, 0)
	require.Greater(t, status.CatalogModels, 0)
	require.Greater(t, status.ReferencePrices, 0)

	updated, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	require.NotEmpty(t, updated.GetModels())
	t.Logf("sync: actual=%d catalog=%d matched=%d refs=%d created=%d updated=%d",
		status.ActualModels, status.CatalogModels, status.MatchedModels,
		status.ReferencePrices, status.MetadataCreated, status.MetadataUpdated)

	if os.Getenv("BAILIAN_SEED") != "" {
		seeded, skipped, err := service.SeedBailianInternalPricing(channel.Id, nil, false)
		require.NoError(t, err)
		// The post-create pipeline already seeds unambiguous prices; a second
		// explicit seed is allowed to be a no-op.
		require.GreaterOrEqual(t, seeded, 0)
		t.Logf("seed: adopted=%d skipped=%d", seeded, skipped)
	}
}
