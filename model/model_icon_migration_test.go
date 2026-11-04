package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

// newIconMigrationDB 建一个只含 models 表的内存库。
//
// 表前缀隔离同名表：model 包里多个用例共用 :memory:，不加前缀会互相串数据。
func newIconMigrationDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{TablePrefix: "icon_migration_test_"},
	})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { assert.NoError(t, sqlDB.Close()) })
	require.NoError(t, db.AutoMigrate(&Model{}))
	return db
}

// TestMigrateModelIconsBackfillsEmptyRows 锁定主修复：空 icon 的模型按名称推断回填。
func TestMigrateModelIconsBackfillsEmptyRows(t *testing.T) {
	db := newIconMigrationDB(t)
	require.NoError(t, db.Create(&Model{ModelName: "wan3.0-video", Icon: ""}).Error)
	require.NoError(t, db.Create(&Model{ModelName: "seedance-2.0", Icon: ""}).Error)

	require.NoError(t, migrateModelIcons(db))

	var wan Model
	require.NoError(t, db.Where("model_name = ?", "wan3.0-video").First(&wan).Error)
	assert.Equal(t, "Wan.Color", wan.Icon, "wan3.0-video 应回填 Wan.Color")

	var seedance Model
	require.NoError(t, db.Where("model_name = ?", "seedance-2.0").First(&seedance).Error)
	assert.Equal(t, "Doubao.Color", seedance.Icon, "seedance-2.0 应回填 Doubao.Color")
}

// TestMigrateModelIconsKeepsOperatorChoice 是最重要的一条：运营手工设置的图标
// 绝不能被迁移覆盖，哪怕它和推断结果不同。
func TestMigrateModelIconsKeepsOperatorChoice(t *testing.T) {
	db := newIconMigrationDB(t)
	require.NoError(t, db.Create(&Model{ModelName: "seedance-2.0", Icon: "Kling.Color"}).Error)
	require.NoError(t, db.Create(&Model{ModelName: "gpt-4o", Icon: "DeepSeek.Color"}).Error)

	require.NoError(t, migrateModelIcons(db))

	var seedance Model
	require.NoError(t, db.Where("model_name = ?", "seedance-2.0").First(&seedance).Error)
	assert.Equal(t, "Kling.Color", seedance.Icon, "非空图标必须原样保留")

	var gpt Model
	require.NoError(t, db.Where("model_name = ?", "gpt-4o").First(&gpt).Error)
	assert.Equal(t, "DeepSeek.Color", gpt.Icon, "非空图标必须原样保留")
}

// TestMigrateModelIconsCorrectsWanMisattribution 覆盖 wan 被误标成 Qwen 的存量数据。
func TestMigrateModelIconsCorrectsWanMisattribution(t *testing.T) {
	db := newIconMigrationDB(t)
	require.NoError(t, db.Create(&Model{ModelName: "wan2.7-image-pro", Icon: "Qwen.Color"}).Error)

	require.NoError(t, migrateModelIcons(db))

	var row Model
	require.NoError(t, db.Where("model_name = ?", "wan2.7-image-pro").First(&row).Error)
	assert.Equal(t, "Wan.Color", row.Icon, "wan 系列被误标为 Qwen 时应纠正为 Wan")
}

// TestMigrateModelIconsLeavesUnderivableRowsAlone 推断不出图标时保持原样（首字母占位）。
func TestMigrateModelIconsLeavesUnderivableRowsAlone(t *testing.T) {
	db := newIconMigrationDB(t)
	require.NoError(t, db.Create(&Model{ModelName: "some-unknown-model", Icon: ""}).Error)

	require.NoError(t, migrateModelIcons(db))

	var row Model
	require.NoError(t, db.Where("model_name = ?", "some-unknown-model").First(&row).Error)
	assert.Equal(t, "", row.Icon, "推断不出可渲染图标时应保持为空，交给运营指定")
}

// TestMigrateModelIconsIsIdempotent 重复执行不得产生变化。
func TestMigrateModelIconsIsIdempotent(t *testing.T) {
	db := newIconMigrationDB(t)
	require.NoError(t, db.Create(&Model{ModelName: "wan3.0-video", Icon: ""}).Error)

	require.NoError(t, migrateModelIcons(db))
	var first Model
	require.NoError(t, db.Where("model_name = ?", "wan3.0-video").First(&first).Error)

	require.NoError(t, migrateModelIcons(db))
	var second Model
	require.NoError(t, db.Where("model_name = ?", "wan3.0-video").First(&second).Error)

	assert.Equal(t, first.Icon, second.Icon, "重复迁移不应改变结果")
	assert.Equal(t, "Wan.Color", second.Icon)
}

// TestMigrateModelIconsSkipsSoftDeleted 软删除的行不参与回填。
func TestMigrateModelIconsSkipsSoftDeleted(t *testing.T) {
	db := newIconMigrationDB(t)
	deleted := &Model{ModelName: "wan3.0-video", Icon: ""}
	require.NoError(t, db.Create(deleted).Error)
	require.NoError(t, db.Delete(deleted).Error)

	require.NoError(t, migrateModelIcons(db))

	var row Model
	require.NoError(t, db.Unscoped().Where("id = ?", deleted.Id).First(&row).Error)
	assert.Equal(t, "", row.Icon, "软删除的行不应被回填")
}
