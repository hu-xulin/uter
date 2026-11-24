package model

import (
	"fmt"

	"gorm.io/gorm"
)

// channelCascadeTables enumerates every table that stores a logical foreign
// reference to channels.id. Deleting a channel MUST clear these rows in the
// same transaction; leaving them behind produced 10,647 orphan rows across the
// retired 优特精选 / 阿里百炼 / Uter.ai channels and polluted pricing, sync and
// quota statistics for subsequently created channels.
//
// Deliberately NOT included:
//   - audit_logs: append-only compliance history (stores channel name as text),
//     never a channel business row;
//   - tokens: an API token is a user resource, not channel data. A token that
//     merely shares a channel's name is preserved (deleting it could break a
//     live integration).
//
// channel_id = 0 is a sentinel meaning "no channel" (system billing
// adjustments / quota records). All callers pass concrete channel IDs, so the
// IN (?) predicate never touches 0.
var channelCascadeTables = []string{
	"abilities",
	"billing_cost_breakdowns",
	"billing_financial_ledgers",
	"billing_price_snapshots",
	"channel_model_pricing",
	"channel_pricing_history",
	"channel_pricing_review",
	"channel_sync_states",
	"logs",
	"midjourney_refund_operations",
	"quota_data",
	"tasks",
	"upstream_billing_invoices",
}

// channelCascadeExtraColumns covers secondary channel columns on tables that
// are already in channelCascadeTables. midjourneys.billing_channel_id records
// which channel funded a MJ job; it must be purged together with channel_id.
var channelCascadeExtraColumns = []struct{ table, column string }{
	{"midjourneys", "channel_id"},
	{"midjourneys", "billing_channel_id"},
}

// deleteChannelCascadeRows removes every row in the channel-referencing tables
// that belongs to any of ids. The caller MUST supply an open transaction so the
// channel row and its dependent rows commit or roll back atomically.
//
// Table and column names are compile-time constants from the slices above; ids
// are always bound parameters. Nothing here is derived from user input.
func deleteChannelCascadeRows(tx *gorm.DB, ids []int) error {
	if tx == nil {
		return fmt.Errorf("deleteChannelCascadeRows: nil transaction")
	}
	if len(ids) == 0 {
		return nil
	}
	// Defensive: drop the "no channel" sentinel and any invalid id even if a
	// caller passes a malformed list. A channel row can never have id <= 0.
	valid := make([]int, 0, len(ids))
	for _, id := range ids {
		if id > 0 {
			valid = append(valid, id)
		}
	}
	if len(valid) == 0 {
		return nil
	}

	// In production every table below exists (all 56 are migrated). Isolated
	// in-memory test databases may only migrate a subset, so skip absent tables
	// rather than turning a valid channel delete into an error. Real SQL errors
	// on tables that DO exist still fail the transaction (no silent success).
	for _, table := range channelCascadeTables {
		if !tx.Migrator().HasTable(table) {
			continue
		}
		if err := tx.Exec(fmt.Sprintf("DELETE FROM %s WHERE channel_id IN (?)", table), valid).Error; err != nil {
			return fmt.Errorf("cascade delete %s: %w", table, err)
		}
	}
	for _, extra := range channelCascadeExtraColumns {
		if !tx.Migrator().HasTable(extra.table) {
			continue
		}
		if err := tx.Exec(fmt.Sprintf("DELETE FROM %s WHERE %s IN (?)", extra.table, extra.column), valid).Error; err != nil {
			return fmt.Errorf("cascade delete %s.%s: %w", extra.table, extra.column, err)
		}
	}
	return nil
}
