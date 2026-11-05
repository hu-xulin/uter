package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestMigrateOptionPrimaryKeyRebuildsAndPreservesLegacyRows(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	require.NoError(t, db.Exec("CREATE TABLE options (key TEXT, value TEXT)").Error)
	require.NoError(t, db.Exec(
		"INSERT INTO options (key, value) VALUES (?, ?), (?, ?), (?, ?), (?, ?)",
		"alpha", "one", "alpha", "one", "beta", "two", "", "empty",
	).Error)

	require.NoError(t, migrateOptionPrimaryKey(db))

	unique, err := optionsKeyIsUnique(db)
	require.NoError(t, err)
	assert.True(t, unique, "rebuilt options.key must be unique")

	var active []Option
	require.NoError(t, db.Order("key").Find(&active).Error)
	require.Equal(t, []Option{
		{Key: "alpha", Value: "one"},
		{Key: "beta", Value: "two"},
	}, active, "empty keys are intentionally excluded and duplicate keys are collapsed")

	require.Error(t, db.Create(&Option{Key: "alpha", Value: "duplicate"}).Error,
		"the rebuilt table must reject duplicate keys")

	var backupTables []string
	require.NoError(t, db.Raw(
		"SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE ?",
		optionLegacyTablePrefix+"%",
	).Scan(&backupTables).Error)
	require.Len(t, backupTables, 1, "the original table must remain available as a legacy backup")

	var backupRows int64
	require.NoError(t, db.Table(backupTables[0]).Count(&backupRows).Error)
	assert.EqualValues(t, 4, backupRows, "the backup must retain every original row, including skipped empty keys")
}
