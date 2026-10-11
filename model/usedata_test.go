package model

import (
	"strings"
	"testing"

	"github.com/uter-ai/uter/common"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// withQuotaDataDB 起一个内存 SQLite 并装好 quota_data 表。
//
// withUniqueIndex=false 时只建表不建唯一索引，用于构造「存量库已有重复行」
// 这个去重要处理的真实历史状态 —— 此时唯一索引必须缺席，否则测试根本插不进
// 重复行，也就测不到去重逻辑。
func withQuotaDataDB(t *testing.T, withUniqueIndex bool) {
	t.Helper()
	previousDB := DB
	previousIsMaster := common.IsMasterNode

	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := database.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)

	if withUniqueIndex {
		require.NoError(t, database.AutoMigrate(&QuotaData{}))
	} else {
		// 只建列，不建索引：模拟升级前的旧表。
		require.NoError(t, database.Table("quota_data").AutoMigrate(&QuotaData{}))
		require.NoError(t, database.Migrator().DropIndex(&QuotaData{}, "idx_qdt_agg_unique"))
	}

	DB = database
	common.IsMasterNode = true
	// CacheQuotaData 是包级全局，测试之间必须隔离，否则前一个用例的残留数据
	// 会被下一个用例的 SaveQuotaDataCache 一起写进它自己的库。
	CacheQuotaDataLock.Lock()
	previousCache := CacheQuotaData
	CacheQuotaData = make(map[string]*QuotaData)
	CacheQuotaDataLock.Unlock()
	t.Cleanup(func() {
		DB = previousDB
		common.IsMasterNode = previousIsMaster
		CacheQuotaDataLock.Lock()
		CacheQuotaData = previousCache
		CacheQuotaDataLock.Unlock()
		require.NoError(t, sqlDB.Close())
	})
}

// TestQuotaDataUniqueIndexColumnsAreComplete 锁住唯一索引必须覆盖全部八列聚合键。
//
// 实测踩坑：GORM 的复合索引 tag 写成「同列多次 index:NAME,priority:N」时，
// 漏掉某列的 priority 会被【静默丢弃】而非报错——曾经username 不在索引里，
// 结果 SaveQuotaDataCache 的 ON CONFLICT 八列对不上七列索引，直接报
// "ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE constraint"。
func TestQuotaDataUniqueIndexColumnsAreComplete(t *testing.T) {
	withQuotaDataDB(t, true)

	var indexSQL []string
	require.NoError(t, DB.Raw(
		"SELECT sql FROM sqlite_master WHERE type='index' AND name = 'idx_qdt_agg_unique'",
	).Scan(&indexSQL).Error)
	require.Len(t, indexSQL, 1, "唯一索引必须存在")
	assert.Contains(t, strings.ToUpper(indexSQL[0]), "CREATE UNIQUE INDEX",
		"必须是 UNIQUE 索引：普通 CREATE INDEX 会让 ON CONFLICT 找不到唯一约束")

	for _, column := range quotaDataAggregateColumns {
		assert.Contains(t, indexSQL[0], "`"+column+"`",
			"唯一索引缺列 %q：漏写priority 会被 GORM 静默丢弃，导致 ON CONFLICT 失配", column)
	}
}

func newQuotaDataRow(userID int, modelName string, createdAt int64, count, quota, tokenUsed int) *QuotaData {
	return &QuotaData{
		UserID:    userID,
		Username:  "u",
		ModelName: modelName,
		CreatedAt: createdAt,
		UseGroup:  "default",
		TokenID:   1,
		ChannelID: 2,
		NodeName:  "n",
		Count:     count,
		Quota:     quota,
		TokenUsed: tokenUsed,
	}
}

// 存量库若已有同一聚合键的重复行，AutoMigrate 建唯一索引会失败并卡死启动。
// 去重必须把统计量累加保留，且不丢任何一行数据。
func TestDedupeQuotaDataAggregatesOnceMergesDuplicates(t *testing.T) {
	withQuotaDataDB(t, false)

	// 同一聚合键三行 + 另一个聚合键两行。
	for i := range 3 {
		require.NoError(t, DB.Create(newQuotaDataRow(1, "gpt-4", 1000, i+1, 10*(i+1), 100*(i+1))).Error)
	}
	for i := range 2 {
		require.NoError(t, DB.Create(newQuotaDataRow(2, "claude", 2000, i+1, 5*(i+1), 50*(i+1))).Error)
	}
	// 唯一的一行不应被动。
	require.NoError(t, DB.Create(newQuotaDataRow(3, "solo", 3000, 1, 7, 70)).Error)

	dedupeQuotaDataAggregatesOnce()

	var rows []*QuotaData
	require.NoError(t, DB.Order("user_id").Find(&rows).Error)
	require.Len(t, rows, 3, "重复行应合并成一行：2 个重复组 + 1 个独有组")

	// 统计量必须累加：1+2+3=6, 10+20+30=60, 100+200+300=600。
	assert.Equal(t, 6, rows[0].Count)
	assert.Equal(t, 60, rows[0].Quota)
	assert.Equal(t, 600, rows[0].TokenUsed)

	// 1+2=3, 5+10=15, 50+100=150。
	assert.Equal(t, 3, rows[1].Count)
	assert.Equal(t, 15, rows[1].Quota)
	assert.Equal(t, 150, rows[1].TokenUsed)

	assert.Equal(t, 1, rows[2].Count)
	assert.Equal(t, 7, rows[2].Quota)
	assert.Equal(t, 70, rows[2].TokenUsed)
}

// 没有重复时不得有任何写入，且必须保持幂等（重复调用安全）。
func TestDedupeQuotaDataAggregatesOnceIsIdempotentWithoutDuplicates(t *testing.T) {
	withQuotaDataDB(t, false)

	require.NoError(t, DB.Create(newQuotaDataRow(1, "gpt-4", 1000, 1, 10, 100)).Error)
	dedupeQuotaDataAggregatesOnce()
	dedupeQuotaDataAggregatesOnce()

	var rows []*QuotaData
	require.NoError(t, DB.Find(&rows).Error)
	require.Len(t, rows, 1)
	assert.Equal(t, 1, rows[0].Count)
	assert.Equal(t, 10, rows[0].Quota)
	assert.Equal(t, 100, rows[0].TokenUsed)
}

// 去重之后，AutoMigrate 必须能成功建出 idx_qdt_agg_unique 唯一索引
// —— 这正是去重存在的唯一理由。
func TestQuotaDataUniqueIndexBuildsAfterDedupe(t *testing.T) {
	withQuotaDataDB(t, false)

	for i := range 3 {
		require.NoError(t, DB.Create(newQuotaDataRow(1, "gpt-4", 1000, i+1, 10, 100)).Error)
	}
	dedupeQuotaDataAggregatesOnce()

	// 若去重失败，这一步会因约束冲突报错。
	require.NoError(t, DB.AutoMigrate(&QuotaData{}), "去重后唯一索引必须能建出来")

	assert.True(t, DB.Migrator().HasIndex(&QuotaData{}, "idx_qdt_agg_unique"))

	// 索引生效后，同一聚合键的第二次插入必须被拒绝（而不是写出重复行）。
	err := DB.Create(newQuotaDataRow(1, "gpt-4", 1000, 1, 1, 1)).Error
	assert.Error(t, err, "唯一索引生效后不得写出重复聚合键")
}

// 刷盘必须是批量 upsert：同一聚合键连续两次落库应累加成一行，而不是两行。
func TestSaveQuotaDataCacheUpsertsAggregate(t *testing.T) {
	// 唯一索引必须存在，upsert 依赖它做冲突判定。
	withQuotaDataDB(t, true)

	// 第一轮：count=2, quota=20
	LogQuotaData(QuotaDataLogParams{
		UserID: 1, Username: "u", ModelName: "gpt-4", Quota: 20,
		CreatedAt: 1000, TokenUsed: 200, UseGroup: "default", TokenID: 1, ChannelID: 2, NodeName: "n",
	})
	LogQuotaData(QuotaDataLogParams{
		UserID: 1, Username: "u", ModelName: "gpt-4", Quota: 20,
		CreatedAt: 1000, TokenUsed: 200, UseGroup: "default", TokenID: 1, ChannelID: 2, NodeName: "n",
	})
	SaveQuotaDataCache()

	// 第二轮：同样聚合键再来一次
	LogQuotaData(QuotaDataLogParams{
		UserID: 1, Username: "u", ModelName: "gpt-4", Quota: 5,
		CreatedAt: 1000, TokenUsed: 50, UseGroup: "default", TokenID: 1, ChannelID: 2, NodeName: "n",
	})
	SaveQuotaDataCache()

	var rows []*QuotaData
	require.NoError(t, DB.Find(&rows).Error)
	require.Len(t, rows, 1, "同一聚合键只能有一行")
	assert.Equal(t, 3, rows[0].Count, "count 必须累加：2+1")
	assert.Equal(t, 45, rows[0].Quota, "quota 必须累加：20+20+5")
	assert.Equal(t, 450, rows[0].TokenUsed, "token_used 必须累加：200+200+50")
}

// 刷盘后缓存必须被清空，且刷盘期间新写入的数据不得丢失。
func TestSaveQuotaDataCacheClearsCacheWithoutBlockingNewWrites(t *testing.T) {
	withQuotaDataDB(t, true)

	LogQuotaData(QuotaDataLogParams{
		UserID: 1, Username: "u", ModelName: "gpt-4", Quota: 10,
		CreatedAt: 1000, TokenUsed: 100, UseGroup: "default", TokenID: 1, ChannelID: 2, NodeName: "n",
	})
	assert.Len(t, CacheQuotaData, 1)

	SaveQuotaDataCache()

	CacheQuotaDataLock.Lock()
	remaining := len(CacheQuotaData)
	CacheQuotaDataLock.Unlock()
	assert.Zero(t, remaining, "刷盘后缓存必须清空")
}
