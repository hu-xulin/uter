package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestMigrateLogIndexRedundancyDropsLegacyIndexes 守住「存量冗余索引会被删除」：
// 模拟旧版本建出来的两棵单列索引，迁移后必须消失，且复合索引仍然存在
// （否则查询会退化，删索引就成了反优化）。
func TestMigrateLogIndexRedundancyDropsLegacyIndexes(t *testing.T) {
	truncateTables(t)

	require.NoError(t, LOG_DB.Exec("CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id)").Error)
	require.NoError(t, LOG_DB.Exec("CREATE INDEX IF NOT EXISTS idx_logs_model_name ON logs(model_name)").Error)
	t.Cleanup(func() {
		LOG_DB.Exec("DROP INDEX IF EXISTS idx_logs_user_id")
		LOG_DB.Exec("DROP INDEX IF EXISTS idx_logs_model_name")
	})

	migrator := LOG_DB.Migrator()
	require.True(t, migrator.HasIndex(&Log{}, "idx_logs_user_id"), "前置条件：旧索引应已建出")
	require.True(t, migrator.HasIndex(&Log{}, "idx_logs_model_name"), "前置条件：旧索引应已建出")

	require.NoError(t, migrateLogIndexRedundancy(LOG_DB))

	assert.False(t, migrator.HasIndex(&Log{}, "idx_logs_user_id"), "被 idx_user_id_id 覆盖的单列索引应被删除")
	assert.False(t, migrator.HasIndex(&Log{}, "idx_logs_model_name"), "被 index_username_model_name 覆盖的单列索引应被删除")

	// 复合索引必须保留，否则删索引等于把查询打回全表扫描。
	assert.True(t, migrator.HasIndex(&Log{}, "idx_user_id_id"))
	assert.True(t, migrator.HasIndex(&Log{}, "index_username_model_name"))
}
