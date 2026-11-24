package model

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"gorm.io/gorm"

	"github.com/uter-ai/uter/common"
)

// UterRouteDiscountGroupOptionKey 是按渠道 ID 为键保存 Uter Route 折扣组的配置项名称。
// 常量放在 model 层，使渠道级联删除能在同一事务内原子清理已删渠道的键；
// service 层通过别名引用，保证该名称只有一个定义来源。
const UterRouteDiscountGroupOptionKey = "UterRouteChannelDiscountGroups"

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
	// 以渠道 ID 为键的 JSON 配置项不是 channel_id 列里的行，上面的表循环无法覆盖。
	// 必须在同一事务内清理，避免留下孤儿键（例如已删除的渠道 1240 在折扣组映射里残留 "1240":"default"）。
	if err := cleanupChannelKeyedOptions(tx, valid); err != nil {
		return err
	}
	return nil
}

// cleanupChannelKeyedOptions 从以渠道 ID 为键的 JSON 配置项中移除所有已删除的渠道 ID。
// 只改动实际存在的键，其余渠道的设置值保持不变。写入走调用方的事务，
// 因此与渠道删除一起原子提交或回滚。
func cleanupChannelKeyedOptions(tx *gorm.DB, ids []int) error {
	if tx == nil || len(ids) == 0 {
		return nil
	}
	// 隔离的内存测试库可能没有迁移 options 表，跳过即可。
	if !tx.Migrator().HasTable(&Option{}) {
		return nil
	}
	var row Option
	err := tx.Where("key = ?", UterRouteDiscountGroupOptionKey).First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("read option %s: %w", UterRouteDiscountGroupOptionKey, err)
	}
	raw := strings.TrimSpace(row.Value)
	if raw == "" {
		return nil
	}
	groups := map[string]string{}
	if err := common.UnmarshalJsonStr(raw, &groups); err != nil {
		// 配置内容损坏时绝不能让一次合法的渠道删除回滚；孤儿键无害，审计会报告它。
		common.SysError(common.LogText("cleanup %s: malformed JSON, skipped: %v", UterRouteDiscountGroupOptionKey, err))
		return nil
	}
	changed := false
	for _, id := range ids {
		key := strconv.Itoa(id)
		if _, ok := groups[key]; ok {
			delete(groups, key)
			changed = true
		}
	}
	if !changed {
		return nil
	}
	encoded, err := common.Marshal(groups)
	if err != nil {
		return fmt.Errorf("encode option %s: %w", UterRouteDiscountGroupOptionKey, err)
	}
	if err := tx.Model(&Option{}).Where("key = ?", UterRouteDiscountGroupOptionKey).
		Update("value", string(encoded)).Error; err != nil {
		return fmt.Errorf("update option %s: %w", UterRouteDiscountGroupOptionKey, err)
	}
	// 刷新各节点的内存配置（GetUterRouteDiscountGroup 从内存读取）。同步任务与本事务
	// 一起提交，因此回滚不会导致重新加载到一个从未落库的值。
	// 隔离测试库可能没有迁移 system_tasks 表；生产环境始终有。
	if tx.Migrator().HasTable(&SystemTask{}) {
		if err := bumpSyncTopic(tx, SyncTopicOptions); err != nil {
			return fmt.Errorf("bump options sync topic: %w", err)
		}
	}
	return nil
}
