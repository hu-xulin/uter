package model

import (
	"path/filepath"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/uter-ai/uter/common"
)

// newCacheTokenStatTestDB 建一个临时文件型 SQLite 库并迁移 logs 表。
//
// 用文件库而非 :memory:：与 model_description_fill_test.go 同源的理由——
// 内存库在事务/连接路径上与生产的文件库不同，GORM 行为会漂移。
func newCacheTokenStatTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	path := filepath.Join(t.TempDir(), "cache-stat-test.db")
	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Log{}))
	return db
}

// TestSumUsedQuotaAggregatesCacheTokens 钉住「统计接口能聚合缓存用量」。
//
// 这是本次修复的核心不变量：缓存写入/读取此前只存在于 other 的 JSON 文本里，
// SQL 无法跨库聚合，导致所有统计接口都拿不到缓存维度。提升为独立列后，
// SumUsedQuota 必须能把它们 SUM 出来。
func TestSumUsedQuotaAggregatesCacheTokens(t *testing.T) {
	previous := LOG_DB
	db := newCacheTokenStatTestDB(t)
	LOG_DB = db
	t.Cleanup(func() { LOG_DB = previous })

	require.NoError(t, db.Create(&Log{
		Type:             LogTypeConsume,
		UserId:           1,
		Username:         "alice",
		ModelName:        "claude-haiku-4-5-20251001",
		PromptTokens:     100,
		CompletionTokens: 10,
		Quota:            500,
		CreatedAt:        1700000000,
		CacheReadTokens:  4000,
		CacheWriteTokens: 9000,
	}).Error)
	require.NoError(t, db.Create(&Log{
		Type:             LogTypeConsume,
		UserId:           1,
		Username:         "alice",
		ModelName:        "claude-haiku-4-5-20251001",
		PromptTokens:     200,
		CompletionTokens: 20,
		Quota:            700,
		CreatedAt:        1700000100,
		CacheReadTokens:  500,
		CacheWriteTokens: 1000,
	}).Error)
	// 非消费类日志不得计入（与既有 quota 聚合口径一致）
	require.NoError(t, db.Create(&Log{
		Type:             LogTypeError,
		UserId:           1,
		Username:         "alice",
		ModelName:        "claude-haiku-4-5-20251001",
		CreatedAt:        1700000200,
		CacheWriteTokens: 99999,
	}).Error)

	stat, err := SumUsedQuota(LogTypeConsume, 0, 0, "", "", "", 0, "", nil)
	require.NoError(t, err)
	require.Equal(t, 1200, stat.Quota)
	require.Equal(t, 4500, stat.CacheReadTokens)
	require.Equal(t, 10000, stat.CacheWriteTokens)
}

// TestRecordConsumeLogPersistsCacheTokenColumns 验证落库路径真的把缓存量写进独立列，
// 而不是只留在 other 的 JSON 里。
func TestRecordConsumeLogPersistsCacheTokenColumns(t *testing.T) {
	previous := LOG_DB
	db := newCacheTokenStatTestDB(t)
	LOG_DB = db
	t.Cleanup(func() { LOG_DB = previous })

	other := NewLogOther()
	other.SetPublic("cache_tokens", 1234)
	other.SetPublic("cache_creation_tokens", 5678)

	log := &Log{
		UserId:           1,
		Username:         "alice",
		CreatedAt:        common.GetTimestamp(),
		Type:             LogTypeConsume,
		ModelName:        "claude-haiku-4-5-20251001",
		PromptTokens:     100,
		CompletionTokens: 10,
		Quota:            500,
		Other:            other.JSONString(),
		CacheReadTokens:  1234,
		CacheWriteTokens: 5678,
	}
	require.NoError(t, createLog(log))

	var stored Log
	require.NoError(t, db.Where("username = ?", "alice").First(&stored).Error)
	require.Equal(t, 1234, stored.CacheReadTokens)
	require.Equal(t, 5678, stored.CacheWriteTokens)
}

// TestLogCacheTokenBackfillMarker 验证回填标记能读回。
//
// 这个标记是必需的：回填不能用「列是否刚建出来」来判断要不要跑——SQLite 下
// DB 与 LOG_DB 共用连接，而 migrateDB() 的 AutoMigrate 列表已包含 &Log{}，
// 列在 migrateLOGDB 之前就建好了，HasColumn 判据会让回填永远不执行
// （实测升级后历史缓存量全为 0）。
func TestLogCacheTokenBackfillMarker(t *testing.T) {
	previous := DB
	db := newCacheTokenStatTestDB(t)
	require.NoError(t, db.AutoMigrate(&Option{}))
	DB = db
	t.Cleanup(func() { DB = previous })

	require.False(t, logCacheTokenBackfillDone())
	markLogCacheTokenBackfillDone()
	require.True(t, logCacheTokenBackfillDone())
	// 重复写入不得产生重复行
	markLogCacheTokenBackfillDone()
	var count int64
	require.NoError(t, db.Table("options").Where("key = ?", logCacheTokensBackfillKey).Count(&count).Error)
	require.Equal(t, int64(1), count)
}

// TestBackfillLogCacheTokenColumns 验证历史行的回填：从 other 的 JSON 里把
// 缓存量提升为独立列，且幂等（已回填过的行不被改写）。
func TestBackfillLogCacheTokenColumns(t *testing.T) {
	previous := LOG_DB
	previousType := common.LogDatabaseType()
	db := newCacheTokenStatTestDB(t)
	LOG_DB = db
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		LOG_DB = previous
		common.SetLogDatabaseType(previousType)
	})

	// 只有 cache_write_tokens（归一化后的总量）
	require.NoError(t, db.Create(&Log{
		Type: LogTypeConsume, UserId: 1, Username: "alice", CreatedAt: 1,
		Other: `{"cache_tokens":11,"cache_write_tokens":22}`,
	}).Error)
	// 只有 cache_creation_tokens（无 5m/1h 拆分时的旧形状）
	require.NoError(t, db.Create(&Log{
		Type: LogTypeConsume, UserId: 1, Username: "bob", CreatedAt: 2,
		Other: `{"cache_tokens":33,"cache_creation_tokens":44}`,
	}).Error)
	// 无任何缓存字段
	require.NoError(t, db.Create(&Log{
		Type: LogTypeConsume, UserId: 1, Username: "carol", CreatedAt: 3,
		Other: `{"model_ratio":0.5}`,
	}).Error)
	// other 为空：MySQL/PostgreSQL 上对非法 JSON 会报错，必须被 WHERE 挡掉
	require.NoError(t, db.Create(&Log{
		Type: LogTypeConsume, UserId: 1, Username: "dave", CreatedAt: 4,
		Other: ``,
	}).Error)

	backfillLogCacheTokenColumns()

	byUser := map[string]Log{}
	var logs []Log
	require.NoError(t, db.Find(&logs).Error)
	for _, l := range logs {
		byUser[l.Username] = l
	}
	require.Equal(t, 11, byUser["alice"].CacheReadTokens)
	require.Equal(t, 22, byUser["alice"].CacheWriteTokens)
	require.Equal(t, 33, byUser["bob"].CacheReadTokens)
	require.Equal(t, 44, byUser["bob"].CacheWriteTokens)
	require.Equal(t, 0, byUser["carol"].CacheReadTokens)
	require.Equal(t, 0, byUser["dave"].CacheWriteTokens)

	// 幂等：再跑一次不得改变结果（已回填的行两列都非 0，会被 WHERE 排除）
	backfillLogCacheTokenColumns()
	var after []Log
	require.NoError(t, db.Find(&after).Error)
	for _, l := range after {
		require.Equal(t, byUser[l.Username].CacheReadTokens, l.CacheReadTokens)
		require.Equal(t, byUser[l.Username].CacheWriteTokens, l.CacheWriteTokens)
	}
}
