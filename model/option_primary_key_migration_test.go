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

func TestMigrateOptionPrimaryKeyFailsClosedOnConflictingDuplicateValues(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.Exec("CREATE TABLE options (key TEXT, value TEXT)").Error)
	require.NoError(t, db.Exec(
		"INSERT INTO options (key, value) VALUES (?, ?), (?, ?)",
		"payment_gateway", "gateway-a", "payment_gateway", "gateway-b",
	).Error)

	err = migrateOptionPrimaryKey(db)
	require.ErrorContains(t, err, "conflicting values for duplicate options key")
	var rows []Option
	require.NoError(t, db.Order("rowid").Find(&rows).Error)
	require.Equal(t, []Option{
		{Key: "payment_gateway", Value: "gateway-a"},
		{Key: "payment_gateway", Value: "gateway-b"},
	}, rows, "migration must leave ambiguous source configuration untouched")

	assert.False(t, db.Migrator().HasTable(optionPrimaryKeyTmpTable), "migration must fail before creating a replacement table")
	var backups int64
	require.NoError(t, db.Raw(
		"SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name LIKE ?",
		optionLegacyTablePrefix+"%",
	).Scan(&backups).Error)
	assert.Zero(t, backups, "ambiguous data must not be moved to a backup as if migration succeeded")
}

func TestMigrateOptionPrimaryKeyRecoversFromStaleTemporaryTable(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.Exec("CREATE TABLE options (key TEXT, value TEXT)").Error)
	require.NoError(t, db.Exec("INSERT INTO options (key, value) VALUES (?, ?)", "payment", "alipay").Error)
	// Simulate a temporary table left behind by an interrupted earlier attempt.
	require.NoError(t, db.Exec("CREATE TABLE options_pk_tmp (stale TEXT)").Error)
	require.NoError(t, db.Exec("INSERT INTO options_pk_tmp (stale) VALUES (?)", "must-not-survive").Error)

	require.NoError(t, migrateOptionPrimaryKey(db))
	var active []Option
	require.NoError(t, db.Find(&active).Error)
	require.Equal(t, []Option{{Key: "payment", Value: "alipay"}}, active)
	require.False(t, db.Migrator().HasTable(optionPrimaryKeyTmpTable))
	unique, err := optionsKeyIsUnique(db)
	require.NoError(t, err)
	require.True(t, unique)
}

func TestMigrateOptionPrimaryKeyIsNoopWhenAlreadyUnique(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.Exec("CREATE TABLE options (key TEXT PRIMARY KEY, value TEXT)").Error)
	require.NoError(t, db.Exec("INSERT INTO options (key, value) VALUES (?, ?)", "existing", "keep").Error)

	require.NoError(t, migrateOptionPrimaryKey(db))
	var count int64
	require.NoError(t, db.Table("options").Count(&count).Error)
	require.EqualValues(t, 1, count)
	require.False(t, db.Migrator().HasTable(optionPrimaryKeyTmpTable))
	var backupCount int64
	require.NoError(t, db.Raw("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name LIKE ?", optionLegacyTablePrefix+"%").Scan(&backupCount).Error)
	require.Zero(t, backupCount, "a valid unique options table must not be rebuilt")
}

func TestMigrateOptionPrimaryKeyRejectsNilDatabase(t *testing.T) {
	require.ErrorContains(t, migrateOptionPrimaryKey(nil), "database is nil")
}


// TestMigrateDBAbortsStartupWhenOptionsPrimaryKeyCannotBeRebuilt protects
// payment/security configuration from ambiguous duplicate option values.
func TestMigrateDBAbortsStartupWhenOptionsPrimaryKeyCannotBeRebuilt(t *testing.T) {
	previousDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	DB = db
	t.Cleanup(func() {
		DB = previousDB
		_ = sqlDB.Close()
	})
	require.NoError(t, db.Exec("CREATE TABLE options (key TEXT, value TEXT)").Error)
	require.NoError(t, db.Exec(
		"INSERT INTO options (key, value) VALUES (?, ?), (?, ?)",
		"payment_gateway", "gateway-a", "payment_gateway", "gateway-b",
	).Error)

	err = migrateDB()
	require.ErrorContains(t, err, "failed to migrate options primary key")
	require.False(t, db.Migrator().HasTable(&Channel{}), "schema migration must stop before normal AutoMigrate")
	var rows int64
	require.NoError(t, db.Table("options").Count(&rows).Error)
	require.EqualValues(t, 2, rows, "ambiguous source configuration must remain untouched")
}
