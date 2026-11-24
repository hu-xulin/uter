package model

import (
	"fmt"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"gorm.io/gorm"
)

// setupChannelCascadeTest builds an in-memory DB containing every table that
// deleteChannelCascadeRows touches, plus sentinel/live rows that must survive.
func setupChannelCascadeTest(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	for _, table := range channelCascadeTables {
		require.NoError(t, db.Exec(
			fmt.Sprintf("CREATE TABLE %s (id INTEGER PRIMARY KEY AUTOINCREMENT, channel_id INTEGER)", table),
		).Error)
	}
	require.NoError(t, db.Exec(
		"CREATE TABLE midjourneys (id INTEGER PRIMARY KEY AUTOINCREMENT, channel_id INTEGER, billing_channel_id INTEGER)",
	).Error)

	// For each table seed: target channel 99, live channel 22, sentinel 0.
	for _, table := range channelCascadeTables {
		require.NoError(t, db.Exec(
			fmt.Sprintf("INSERT INTO %s (channel_id) VALUES (99),(22),(0)", table),
		).Error)
	}
	require.NoError(t, db.Exec(
		"INSERT INTO midjourneys (channel_id,billing_channel_id) VALUES (99,99),(22,22),(0,0),(22,99)",
	).Error)
	return db
}

func countRows(t *testing.T, db *gorm.DB, query string) int {
	t.Helper()
	var n int
	require.NoError(t, db.Raw(query).Scan(&n).Error)
	return n
}

func TestDeleteChannelCascadeRowsPurgesTargetOnly(t *testing.T) {
	db := setupChannelCascadeTest(t)

	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		return deleteChannelCascadeRows(tx, []int{99})
	}))

	for _, table := range channelCascadeTables {
		assert.Equal(t, 0, countRows(t, db, fmt.Sprintf("SELECT count(*) FROM %s WHERE channel_id=99", table)), "table %s", table)
		assert.Equal(t, 1, countRows(t, db, fmt.Sprintf("SELECT count(*) FROM %s WHERE channel_id=22", table)), "live channel in %s", table)
		assert.Equal(t, 1, countRows(t, db, fmt.Sprintf("SELECT count(*) FROM %s WHERE channel_id=0", table)), "sentinel in %s", table)
	}
	assert.Equal(t, 0, countRows(t, db, "SELECT count(*) FROM midjourneys WHERE channel_id=99"))
	assert.Equal(t, 0, countRows(t, db, "SELECT count(*) FROM midjourneys WHERE billing_channel_id=99"))
	// The (22,99) job is purged too: its billing_channel_id referenced the
	// deleted channel. Only the (22,22) job and the sentinel row survive.
	assert.Equal(t, 1, countRows(t, db, "SELECT count(*) FROM midjourneys WHERE channel_id=22"))
	assert.Equal(t, 0, countRows(t, db, "SELECT count(*) FROM midjourneys WHERE billing_channel_id=99"))
	assert.Equal(t, 1, countRows(t, db, "SELECT count(*) FROM midjourneys WHERE channel_id=0"))
}

func TestDeleteChannelCascadeRowsRollsBackOnFailure(t *testing.T) {
	db := setupChannelCascadeTest(t)

	// A transaction that purges 99 then fails must leave 99 intact everywhere.
	err := db.Transaction(func(tx *gorm.DB) error {
		if e := deleteChannelCascadeRows(tx, []int{99}); e != nil {
			return e
		}
		return fmt.Errorf("forced failure")
	})
	require.Error(t, err)

	for _, table := range channelCascadeTables {
		assert.Equal(t, 1, countRows(t, db, fmt.Sprintf("SELECT count(*) FROM %s WHERE channel_id=99", table)), "rollback in %s", table)
	}
}

func TestDeleteChannelCascadeRowsIgnoresSentinelAndEmpty(t *testing.T) {
	db := setupChannelCascadeTest(t)

	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		return deleteChannelCascadeRows(tx, []int{0})
	}))
	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		return deleteChannelCascadeRows(tx, nil)
	}))

	for _, table := range channelCascadeTables {
		assert.Equal(t, 1, countRows(t, db, fmt.Sprintf("SELECT count(*) FROM %s WHERE channel_id=0", table)), "sentinel preserved in %s", table)
		assert.Equal(t, 1, countRows(t, db, fmt.Sprintf("SELECT count(*) FROM %s WHERE channel_id=99", table)), "target untouched in %s", table)
	}
}

func TestCascadeTableListCoversAllProductionChannelRefs(t *testing.T) {
	// Guard against adding a channel-referencing table without cascading it.
	for _, name := range []string{
		"abilities", "billing_cost_breakdowns", "billing_financial_ledgers",
		"billing_price_snapshots", "channel_model_pricing", "channel_pricing_history",
		"channel_pricing_review", "channel_sync_states", "logs",
		"midjourney_refund_operations", "quota_data", "tasks",
		"upstream_billing_invoices",
	} {
		assert.Contains(t, channelCascadeTables, name)
	}
	assert.Len(t, channelCascadeExtraColumns, 2)
	assert.Equal(t, "midjourneys", channelCascadeExtraColumns[0].table)
	assert.Equal(t, "billing_channel_id", channelCascadeExtraColumns[1].column)
}

// 回归测试：以渠道 ID 为键的 JSON 配置项（Uter Route 折扣组映射）不是 channel_id 列里的行，
// 表级联循环无法覆盖。删除渠道 1240 曾残留 "1240":"default" 孤儿键。
// 清理必须只移除已删除的 ID，其余渠道的组值保持原样，并与删除事务原子一致。
func TestDeleteChannelCascadeCleansChannelKeyedOptions(t *testing.T) {
	db := setupChannelCascadeTest(t)
	require.NoError(t, db.AutoMigrate(&Option{}))

	const seed = `{"22":"vip","99":"default","1232":"default","67":"svip"}`
	require.NoError(t, db.Create(&Option{Key: UterRouteDiscountGroupOptionKey, Value: seed}).Error)

	// 删除目标 99；存续渠道 22/1232/67 的折扣组必须保留。
	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		return deleteChannelCascadeRows(tx, []int{99, 0})
	}))

	var row Option
	require.NoError(t, db.Where("key = ?", UterRouteDiscountGroupOptionKey).First(&row).Error)
	var got map[string]string
	require.NoError(t, common.UnmarshalJsonStr(row.Value, &got))
	assert.Equal(t, map[string]string{"22": "vip", "1232": "default", "67": "svip"}, got,
		"只应移除已删除渠道的键，其余渠道的组值保持原样")
	assert.NotContains(t, got, "99")
}

func TestDeleteChannelCascadeKeepsOptionsWhenNoKeyMatches(t *testing.T) {
	db := setupChannelCascadeTest(t)
	require.NoError(t, db.AutoMigrate(&Option{}))

	const seed = `{"22":"vip","67":"svip"}`
	require.NoError(t, db.Create(&Option{Key: UterRouteDiscountGroupOptionKey, Value: seed}).Error)

	// 删除一个没有折扣组键的渠道时不应改写配置（无多余写入、无同步触发）。
	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		return deleteChannelCascadeRows(tx, []int{99})
	}))
	var row Option
	require.NoError(t, db.Where("key = ?", UterRouteDiscountGroupOptionKey).First(&row).Error)
	assert.Equal(t, seed, row.Value)
}

func TestDeleteChannelCascadeToleratesMalformedOption(t *testing.T) {
	db := setupChannelCascadeTest(t)
	require.NoError(t, db.AutoMigrate(&Option{}))

	require.NoError(t, db.Create(&Option{Key: UterRouteDiscountGroupOptionKey, Value: `not-json`}).Error)
	// 配置内容损坏时绝不能让合法的渠道删除回滚。
	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		return deleteChannelCascadeRows(tx, []int{99})
	}))
	assert.Equal(t, 0, countRows(t, db, "SELECT count(*) FROM channel_model_pricing WHERE channel_id=99"))
}
