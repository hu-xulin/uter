package service

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestInspectLiveUterRoute(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	snapshot, err := FetchUterRouteUpstream(ctx, "https://dreamrouter.ai")
	require.NoError(t, err)
	review := 0
	for _, item := range snapshot.Models {
		if item.VendorID == 0 {
			continue
		}
		view, internal := uterRouteChannelOfficialPricing(snapshot, item, snapshot.FetchedAt.Unix(), "default")
		if view.NeedsReview || internal == "" {
			review++
			fmt.Printf("REVIEW %s | status=%s reasons=%v expr_error=%q\n", item.ModelName, item.PriceStatus, view.ReviewReasons, view.ExpressionError)
		}
	}
	fmt.Printf("live_models=%d review=%d\n", len(snapshot.Models), review)
}
