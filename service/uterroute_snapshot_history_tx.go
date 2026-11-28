package service

import (
	"errors"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

// CommitUterRouteSnapshotAndHistory persists the new isolated snapshot and its
// audited change log in ONE database transaction.
//
// The previous code wrote history and snapshot as two independent options. If
// the snapshot write failed after history succeeded, the next diff compared
// against the OLD snapshot and re-emitted the same changes; if the history write
// failed after the snapshot succeeded, those changes became invisible forever.
// Both are half-states. One transaction removes the window entirely, and the
// existing process + instance locks still serialize concurrent syncs.
func CommitUterRouteSnapshotAndHistory(snapshot *UpstreamSnapshot, changes []UpstreamPriceChange) error {
	if snapshot == nil {
		return errors.New("uterroute upstream snapshot is nil")
	}
	version := snapshot.ProviderID

	history := LoadUterRouteUpstreamHistory()
	if history == nil {
		history = &UpstreamPriceHistory{ProviderID: version}
	}
	seen := make(map[string]bool, len(history.Entries))
	for _, entry := range history.Entries {
		seen[upstreamPriceChangeDedupeKey(entry)] = true
	}
	for _, change := range changes {
		key := upstreamPriceChangeDedupeKey(change)
		if seen[key] {
			continue
		}
		seen[key] = true
		history.Entries = append(history.Entries, change)
	}
	if len(history.Entries) > upstreamHistoryLimit {
		history.Entries = history.Entries[len(history.Entries)-upstreamHistoryLimit:]
	}
	historyRaw, err := common.Marshal(history)
	if err != nil {
		return err
	}
	snapshotRaw, err := common.Marshal(snapshot)
	if err != nil {
		return err
	}
	return model.UpdateOptionsBulk(map[string]string{
		UterRouteUpstreamHistoryKey:  string(historyRaw),
		UterRouteUpstreamSnapshotKey: string(snapshotRaw),
	})
}
