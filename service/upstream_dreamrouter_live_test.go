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
)

// Pulls the real public DreamRouter pricing document into the isolated
// snapshot. It does not touch ModelRatio / ModelPrice / billing_expr.
//
//	UPSTREAM_LIVE=1 go test -tags upstream_live ./service -run TestPullDreamRouterUpstreamLive -v
func TestPullDreamRouterUpstreamLive(t *testing.T) {
	if os.Getenv("UPSTREAM_LIVE") == "" {
		t.Skip("set UPSTREAM_LIVE=1 to pull the real DreamRouter pricing")
	}
	_ = godotenv.Load("../.env")
	absDB, err := os.Getwd()
	require.NoError(t, err)
	require.NoError(t, os.Setenv("SQLITE_PATH", absDB+"/../one-api.db"))
	common.InitEnv()
	require.NoError(t, model.InitDB())
	model.InitOptionMap()

	snapshot, err := FetchDreamRouterUpstream(context.Background(), "")
	require.NoError(t, err)
	require.NoError(t, SaveDreamRouterUpstreamSnapshot(snapshot))
	require.NotEmpty(t, snapshot.Models)
	t.Logf("dreamrouter upstream: models=%d groups=%d group_overrides=%d version=%s basis=%s",
		len(snapshot.Models), len(snapshot.GroupRatio), len(snapshot.GroupGroupRatio),
		snapshot.PricingVersion, snapshot.PriceBasis)
}
