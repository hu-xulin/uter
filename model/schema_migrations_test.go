package model

import (
	"errors"
	"path/filepath"
	"testing"

	"github.com/uter-ai/uter/common"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// schemaTestDB creates a fresh, file-backed SQLite DB in t.TempDir() using the
// shared production DSN helper. It runs ONLY AutoMigrate (no versioned
// migrations), so tests can observe the pre-migration state and apply
// MigrateSchemaUp/Down themselves. The pool is closed via t.Cleanup.
func schemaTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	path := filepath.Join(t.TempDir(), "schema-migrations.db")
	db, err := gorm.Open(sqlite.Open(common.SQLiteForeignKeysEnabledDSN(path)), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		if sqlDB, e := db.DB(); e == nil {
			_ = sqlDB.Close()
		}
	})
	require.NoError(t, db.AutoMigrate(&User{}, &TopUp{}))
	return db
}

func schemaCountLedger(t *testing.T, db *gorm.DB) int64 {
	t.Helper()
	var n int64
	require.NoError(t, db.Raw("SELECT COUNT(*) FROM "+schemaMigrationsTable).Scan(&n).Error)
	return n
}

// Upgrade applies V1: a real FK appears on top_ups and business rows survive.
func TestSchemaMigrationUpgradeAppliesV1(t *testing.T) {
	db := schemaTestDB(t)

	version, err := SchemaVersion(db)
	require.NoError(t, err)
	require.Equal(t, 0, version, "no version recorded before upgrade")
	present, err := topUpUserFKPresent(db)
	require.NoError(t, err)
	require.False(t, present, "no FK before upgrade")

	// Legal business data that must survive the table rebuild.
	user := User{Username: "schema-up-user", Password: "EXAMPLE", AffCode: "AFF-schema-up"}
	require.NoError(t, db.Create(&user).Error)
	order := TopUp{TradeNo: "SCHEMA-UP-1", UserId: user.Id, Money: MoneyFromFloat(1), Amount: MoneyFromFloat(1), Status: common.TopUpStatusPending}
	require.NoError(t, db.Create(&order).Error)

	require.NoError(t, MigrateSchemaUp(db))

	version, err = SchemaVersion(db)
	require.NoError(t, err)
	require.Equal(t, LatestSchemaVersion(), version)
	present, err = topUpUserFKPresent(db)
	require.NoError(t, err)
	require.True(t, present, "V1 must add a real top_ups.user_id -> users.id FK")
	require.Equal(t, int64(LatestSchemaVersion()), schemaCountLedger(t, db), "one ledger row per version")

	var count int64
	require.NoError(t, db.Model(&TopUp{}).Where("trade_no = ?", "SCHEMA-UP-1").Count(&count).Error)
	require.Equal(t, int64(1), count, "business rows survive the upgrade")
}

// Re-running MigrateSchemaUp is a no-op: no re-applied DDL, no rewritten
// applied_at/checksum, no duplicate ledger rows.
func TestSchemaMigrationUpIsIdempotent(t *testing.T) {
	db := schemaTestDB(t)
	require.NoError(t, MigrateSchemaUp(db))
	before, err := MigrationInventory(db)
	require.NoError(t, err)

	require.NoError(t, MigrateSchemaUp(db))

	after, err := MigrationInventory(db)
	require.NoError(t, err)
	require.Len(t, after, len(before))
	for i := range before {
		require.Equal(t, before[i].Applied, after[i].Applied)
		require.Equal(t, before[i].AppliedAt, after[i].AppliedAt,
			"re-run must not rewrite applied_at (no re-application)")
		require.Equal(t, before[i].RecordedChecksum, after[i].RecordedChecksum)
	}
	require.Equal(t, int64(LatestSchemaVersion()), schemaCountLedger(t, db),
		"idempotent re-run must not create duplicate version rows")
	require.NoError(t, VerifySchemaVersionConsistency(db))
}

// The version record matches the actual schema state.
func TestSchemaMigrationVersionMatchesSchema(t *testing.T) {
	db := schemaTestDB(t)
	require.NoError(t, MigrateSchemaUp(db))
	require.NoError(t, VerifySchemaVersionConsistency(db))

	inventory, err := MigrationInventory(db)
	require.NoError(t, err)
	require.Len(t, inventory, LatestSchemaVersion())
	for _, s := range inventory {
		require.True(t, s.Applied, "V%d should be applied", s.Version)
		require.Equal(t, s.Checksum, s.RecordedChecksum,
			"V%d recorded checksum must match the registry", s.Version)
	}
}

// A mid-migration failure rolls back its DDL AND does not record the version.
// A deliberately failing Up is injected via a test-only registry COPY — the
// real schemaRegistry is never mutated.
func TestSchemaMigrationFailureRollsBackDDL(t *testing.T) {
	db := schemaTestDB(t)
	injected := errors.New("injected migration failure")
	failRegistry := []SchemaMigration{
		{
			Version:    1,
			Name:       "failing_test_migration",
			Checksum:   "test-only-checksum",
			Reversible: true,
			Down:       func(_ *gorm.DB) error { return nil },
			Up: func(tx *gorm.DB) error {
				if err := tx.Exec("CREATE TABLE schema_fail_should_vanish (id INTEGER)").Error; err != nil {
					return err
				}
				return injected // fail AFTER a DDL step
			},
		},
	}

	err := migrateSchemaUp(db, failRegistry)
	require.ErrorIs(t, err, injected)
	require.False(t, db.Migrator().HasTable("schema_fail_should_vanish"),
		"DDL from a failed migration must be rolled back inside its transaction")
	require.Equal(t, int64(0), schemaCountLedger(t, db),
		"a failed migration must NOT record its version")
	// The real registry is untouched by the injected copy.
	require.Equal(t, "add_top_ups_user_fk", schemaRegistry[0].Name)
	require.NotEmpty(t, schemaRegistry[0].Checksum)
}

// A real Down restores the pre-migration schema, and an irreversible V1
// refuses to be rolled back past (fail closed, no partial rollback).
func TestSchemaMigrationRollbackRestoresSchema(t *testing.T) {
	db := schemaTestDB(t)
	require.NoError(t, MigrateSchemaUp(db))
	idxBefore, err := topUpStatusIndexPresent(db)
	require.NoError(t, err)
	require.True(t, idxBefore, "V2 index present after upgrade")

	require.NoError(t, MigrateSchemaDown(db, 1))
	idxAfter, err := topUpStatusIndexPresent(db)
	require.NoError(t, err)
	require.False(t, idxAfter, "V2 Down must drop the index")
	version, err := SchemaVersion(db)
	require.NoError(t, err)
	require.Equal(t, 1, version, "V2 version record removed")
	fkPresent, err := topUpUserFKPresent(db)
	require.NoError(t, err)
	require.True(t, fkPresent, "V1 FK remains after rolling back only V2")
	require.NoError(t, VerifySchemaVersionConsistency(db))

	err = MigrateSchemaDown(db, 0)
	require.Error(t, err)
	require.Contains(t, err.Error(), "irreversible")
	version, err = SchemaVersion(db)
	require.NoError(t, err)
	require.Equal(t, 1, version, "irreversible refusal changed nothing")
	require.NoError(t, VerifySchemaVersionConsistency(db))
}

// Business rows survive a full upgrade + rollback cycle.
func TestSchemaMigrationBusinessRowsSurviveUpgradeRollback(t *testing.T) {
	db := schemaTestDB(t)
	user := User{Username: "survive-user", Password: "EXAMPLE", AffCode: "AFF-survive", Quota: 777}
	require.NoError(t, db.Create(&user).Error)
	order := TopUp{TradeNo: "SURVIVE-1", UserId: user.Id, Money: MoneyFromFloat(10), Amount: MoneyFromFloat(10), Status: common.TopUpStatusPending}
	require.NoError(t, db.Create(&order).Error)

	require.NoError(t, MigrateSchemaUp(db))
	require.NoError(t, MigrateSchemaDown(db, 1))

	var orders int64
	require.NoError(t, db.Model(&TopUp{}).Where("trade_no = ?", "SURVIVE-1").Count(&orders).Error)
	require.Equal(t, int64(1), orders, "order row survives upgrade+rollback")
	var quota int
	require.NoError(t, db.Model(&User{}).Where("id = ?", user.Id).Select("quota").Scan(&quota).Error)
	require.Equal(t, 777, quota, "balance survives upgrade+rollback")
}

// VerifySchemaVersionConsistency detects a tampered checksum and a missing
// version record instead of silently passing.
func TestSchemaMigrationVerifyDetectsTampering(t *testing.T) {
	db := schemaTestDB(t)
	require.NoError(t, MigrateSchemaUp(db))
	require.NoError(t, VerifySchemaVersionConsistency(db))

	// Tampered checksum.
	require.NoError(t, db.Exec("UPDATE "+schemaMigrationsTable+" SET checksum = 'TAMPERED' WHERE version = 1").Error)
	err := VerifySchemaVersionConsistency(db)
	require.Error(t, err)
	require.Contains(t, err.Error(), "checksum")

	// Restore, then delete the V1 record entirely while the physical FK is
	// still present -> schema drift must be detected.
	require.NoError(t, db.Exec("UPDATE "+schemaMigrationsTable+" SET checksum = ? WHERE version = 1", schemaRegistry[0].Checksum).Error)
	require.NoError(t, VerifySchemaVersionConsistency(db))
	require.NoError(t, db.Exec("DELETE FROM "+schemaMigrationsTable+" WHERE version = 1").Error)
	err = VerifySchemaVersionConsistency(db)
	require.Error(t, err, "a missing V1 record must be detected")
}
