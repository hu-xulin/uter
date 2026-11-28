package service

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
)

func TestCommitUterRouteSnapshotAndHistoryWritesBothOptions(t *testing.T) {
	setupBatchPricingDB(t)
	previous := common.OptionMap
	common.OptionMap = map[string]string{}
	t.Cleanup(func() { common.OptionMap = previous })

	snapshot := &UpstreamSnapshot{
		ProviderID:     "uterroute",
		PricingVersion: "v2",
		FetchedAt:      time.Now().UTC(),
		Models:         []UpstreamModelRecord{{ModelName: "model-a"}},
	}
	change := UpstreamPriceChange{
		ProviderID: "uterroute", ModelID: "model-a", Kind: "price_changed",
		Field: "official_input_usd", PricingVersion: "v2", DetectedAt: time.Now(),
	}
	require.NoError(t, CommitUterRouteSnapshotAndHistory(snapshot, []UpstreamPriceChange{change}))

	loaded := LoadUterRouteUpstreamSnapshot()
	require.NotNil(t, loaded)
	require.Equal(t, "v2", loaded.PricingVersion, "the new snapshot must be persisted")
	history := LoadUterRouteUpstreamHistory()
	require.NotNil(t, history)
	require.Len(t, history.Entries, 1, "the audited change must be persisted in the same commit")
}

func TestCommitUterRouteSnapshotAndHistoryIsIdempotentOnRetry(t *testing.T) {
	setupBatchPricingDB(t)
	previous := common.OptionMap
	common.OptionMap = map[string]string{}
	t.Cleanup(func() { common.OptionMap = previous })

	snapshot := &UpstreamSnapshot{ProviderID: "uterroute", PricingVersion: "v1"}
	change := UpstreamPriceChange{
		ProviderID: "uterroute", ModelID: "model-a", Kind: "price_changed",
		Field: "input", PricingVersion: "v1", DetectedAt: time.Now(),
	}
	require.NoError(t, CommitUterRouteSnapshotAndHistory(snapshot, []UpstreamPriceChange{change}))
	change.DetectedAt = time.Now().Add(time.Hour)
	require.NoError(t, CommitUterRouteSnapshotAndHistory(snapshot, []UpstreamPriceChange{change}))

	require.Len(t, LoadUterRouteUpstreamHistory().Entries, 1,
		"a retried commit must not duplicate the logical change")
}

func TestCommitUterRouteSnapshotAndHistoryRejectsNilSnapshot(t *testing.T) {
	require.Error(t, CommitUterRouteSnapshotAndHistory(nil, nil))
}
