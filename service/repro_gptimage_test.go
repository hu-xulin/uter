package service

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestReproGptImage(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	snapshot, err := FetchUterRouteUpstream(ctx, "https://dreamrouter.ai")
	require.NoError(t, err)
	for _, item := range snapshot.Models {
		if item.ModelName != "gpt-image-2" && item.ModelName != "gpt-image-2.5-flare" {
			continue
		}
		view, internal := uterRouteChannelOfficialPricing(snapshot, item, snapshot.FetchedAt.Unix(), "default")
		b, _ := json.Marshal(view)
		fmt.Printf("\n== %s\nview=%s\ninternal=%q\n", item.ModelName, string(b), internal)
	}
}
