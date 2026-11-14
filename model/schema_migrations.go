// Package model — versioned, reversible schema migrations.
//
// This file is the single source of truth for structural schema changes that
// GORM AutoMigrate cannot express (notably real FOREIGN KEY constraints). It
// replaces the ad-hoc model/*_migration.go helpers with an explicit registry,
// a durable schema_migrations ledger, up/down execution and a consistency
// verifier that ties the recorded version to the ACTUAL physical schema.
//
// Design rules:
//   - Every migration runs inside its own transaction; the version row is
//     written only after Up succeeds, so a failed migration rolls back its DDL
//     and leaves no version record.
//   - Up is idempotent (only pending versions are applied, ascending).
//   - Down refuses irreversible migrations BEFORE doing any work (fail closed,
//     no partial rollback).
//   - VerifySchemaVersionConsistency never silently passes: it checks the
//     ledger checksums AND the real schema (PRAGMA foreign_key_list, indexes).
//
// See MIGRATION-INVENTORY.md for the human-facing inventory and policies.
package model

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"

	"github.com/uter-ai/uter/common"
	"gorm.io/gorm"
)

const (
	schemaMigrationsTable = "schema_migrations"

	// fkTopUpsUser is the constraint name used for top_ups.user_id -> users.id.
	// SQLite does not persist constraint names (foreign_key_list has no name
	// column), but MySQL/PostgreSQL do, so the name is kept for those dialects.
	fkTopUpsUser = "fk_top_ups_user_id"

	// V2TopUpUserStatusIndex is the reversible demo index created by V2. It is
	// exported so integration tests can assert on its presence/absence.
	V2TopUpUserStatusIndex = "idx_topups_user_status"
)

// SchemaMigration describes one versioned, ordered structural change.
// Fingerprint is the immutable definition of what the migration does; it is
// hashed into Checksum. Changing a migration's behaviour REQUIRES changing its
// Fingerprint, otherwise VerifySchemaVersionConsistency cannot detect that a
// recorded version no longer matches the code (this mirrors how Flyway hashes
// a migration script's content).
type SchemaMigration struct {
	Version     int
	Name        string
	Checksum    string // sha256 of Fingerprint, filled in init()
	Fingerprint string
	Rationale   string
	Reversible  bool
	Up          func(db *gorm.DB) error
	Down        func(db *gorm.DB) error // nil when Reversible == false
}

// SchemaMigrationStatus is one registry entry annotated with its applied state
// read from the schema_migrations ledger. Returned by MigrationInventory.
type SchemaMigrationStatus struct {
	SchemaMigration
	Applied          bool
	AppliedAt        int64
	RecordedChecksum string
}

// schemaRegistry is the ordered, immutable-migration registry. The only
// deliberate irreversible entry is V1: dropping a data-integrity FK
// automatically would silently re-allow orphan rows, so a downgrade past V1
// must be an explicit, manual decision. V2 is a genuinely reversible index.
var schemaRegistry = []SchemaMigration{
	{
		Version:     1,
		Name:        "add_top_ups_user_fk",
		Fingerprint: "v1:top_ups.user_id -> users(id) ON DELETE RESTRICT ON UPDATE CASCADE; sqlite table rebuild / mysql+postgres ALTER TABLE ADD CONSTRAINT " + fkTopUpsUser,
		Rationale: "Enforce the real business relation top_ups.user_id -> users.id. " +
			"Users are soft-deleted (gorm.DeletedAt), so ON DELETE RESTRICT is safe: " +
			"the parent row is never physically removed. Orphan rows fail the " +
			"migration (fail closed) instead of being deleted.",
		Reversible: false,
		Up:         migrateV1AddTopUpUserFK,
		Down:       nil,
	},
	{
		Version:     2,
		Name:        "add_top_ups_user_status_index",
		Fingerprint: "v2:CREATE INDEX " + V2TopUpUserStatusIndex + " ON top_ups(user_id,status); down DROP INDEX",
		Rationale: "Reversible, idempotent index for the hot per-user order queries " +
			"(GetUserTopUps filters user_id, ListPendingTopUpsForReconcile filters " +
			"user_id+status). Serves as a real, safe Down path for the framework.",
		Reversible: true,
		Up:         migrateV2CreateIndex,
		Down:       migrateV2DropIndex,
	},
}

func init() {
	for i := range schemaRegistry {
		schemaRegistry[i].Checksum = schemaChecksum(schemaRegistry[i])
	}
}

func schemaChecksum(m SchemaMigration) string {
	sum := sha256.Sum256([]byte(fmt.Sprintf("%d|%s|%s|%t|%s",
		m.Version, m.Name, m.Fingerprint, m.Reversible, m.Rationale)))
	return hex.EncodeToString(sum[:])
}

// dialectName returns a lower-cased dialector name used for dialect-aware DDL.
func dialectName(db *gorm.DB) string {
	if db == nil || db.Dialector == nil {
		return ""
	}
	return strings.ToLower(db.Dialector.Name())
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// MigrateSchemaUp applies every pending registered migration in ascending
// order. It is idempotent: re-running it is a no-op and never damages data.
// Wired into migrateDB() after AutoMigrate.
func MigrateSchemaUp(db *gorm.DB) error {
	return migrateSchemaUp(db, schemaRegistry)
}

// MigrateSchemaDown rolls back applied migrations in descending order until the
// schema is at targetVersion. It refuses (before touching anything) if any
// migration that would be rolled back is irreversible.
func MigrateSchemaDown(db *gorm.DB, targetVersion int) error {
	return migrateSchemaDown(db, targetVersion, schemaRegistry)
}

// SchemaVersion returns the highest applied version (0 when none applied).
func SchemaVersion(db *gorm.DB) (int, error) {
	applied, err := appliedVersions(db)
	if err != nil {
		return 0, err
	}
	max := 0
	for v := range applied {
		if v > max {
			max = v
		}
	}
	return max, nil
}

// MigrationInventory returns the registry annotated with applied state read
// from the ledger.
func MigrationInventory(db *gorm.DB) ([]SchemaMigrationStatus, error) {
	applied, err := appliedVersions(db)
	if err != nil {
		return nil, err
	}
	sorted := sortedMigrations(schemaRegistry)
	out := make([]SchemaMigrationStatus, 0, len(sorted))
	for _, m := range sorted {
		status := SchemaMigrationStatus{SchemaMigration: m}
		if rec, ok := applied[m.Version]; ok {
			status.Applied = true
			status.AppliedAt = rec.appliedAt
			status.RecordedChecksum = rec.checksum
		}
		out = append(out, status)
	}
	return out, nil
}

// VerifySchemaVersionConsistency ties the ledger to reality. It returns a
// non-nil error (never a silent pass) when:
//   - the schema_migrations table is missing / no version is recorded,
//   - a recorded version is not in the registry,
//   - a recorded name or checksum no longer matches the registry (tampering),
//   - applied versions are not a contiguous prefix of the registry,
//   - the ACTUAL physical schema disagrees with the ledger (e.g. the
//     top_ups.user_id FK is present but V1 is not recorded, or missing while
//     V1 is recorded, or the V2 index state does not match the V2 record).
func VerifySchemaVersionConsistency(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("schema consistency: nil db")
	}
	if !hasSchemaMigrationsTable(db) {
		return fmt.Errorf("schema consistency: %s table missing — no migration applied; run MigrateSchemaUp", schemaMigrationsTable)
	}
	records, err := appliedVersions(db)
	if err != nil {
		return fmt.Errorf("schema consistency: read ledger: %w", err)
	}
	sorted := sortedMigrations(schemaRegistry)

	// 1) every recorded version must exist in the registry with matching name +
	//    checksum (tamper detection).
	for v, rec := range records {
		m := findMigration(sorted, v)
		if m == nil {
			return fmt.Errorf("schema consistency: recorded V%d is not in the registry", v)
		}
		if rec.name != m.Name {
			return fmt.Errorf("schema consistency: V%d recorded name %q != registry %q", v, rec.name, m.Name)
		}
		if rec.checksum != m.Checksum {
			return fmt.Errorf("schema consistency: V%d checksum mismatch (recorded %q, registry %q)", v, rec.checksum, m.Checksum)
		}
	}
	// 2) applied versions must be a contiguous prefix {1..k}.
	k := len(records)
	if k > len(sorted) {
		return fmt.Errorf("schema consistency: %d versions recorded but registry only has %d", k, len(sorted))
	}
	for v := 1; v <= k; v++ {
		if _, ok := records[v]; !ok {
			return fmt.Errorf("schema consistency: gap — V%d missing while V%d is recorded", v, k)
		}
	}

	// 3) ACTUAL physical schema must match the ledger.
	fkPresent, err := topUpUserFKPresent(db)
	if err != nil {
		return fmt.Errorf("schema consistency: inspect top_ups FK: %w", err)
	}
	_, v1Recorded := records[1]
	if v1Recorded != fkPresent {
		if v1Recorded {
			return fmt.Errorf("schema consistency: V1 is recorded but top_ups.user_id -> users.id FK is MISSING from the physical schema")
		}
		return fmt.Errorf("schema consistency: top_ups.user_id FK exists physically but V1 is NOT recorded (schema drift)")
	}

	idxPresent, err := topUpStatusIndexPresent(db)
	if err != nil {
		return fmt.Errorf("schema consistency: inspect V2 index: %w", err)
	}
	_, v2Recorded := records[2]
	if v2Recorded != idxPresent {
		if v2Recorded {
			return fmt.Errorf("schema consistency: V2 is recorded but index %s is MISSING", V2TopUpUserStatusIndex)
		}
		return fmt.Errorf("schema consistency: index %s exists but V2 is NOT recorded (schema drift)", V2TopUpUserStatusIndex)
	}
	return nil
}

// ---------------------------------------------------------------------------
// Migration engine (registry parameterised so tests can inject a failing Up
// without corrupting the real registry).
// ---------------------------------------------------------------------------

func migrateSchemaUp(db *gorm.DB, registry []SchemaMigration) error {
	if db == nil {
		return fmt.Errorf("schema migration up: nil db")
	}
	if err := validateRegistry(registry); err != nil {
		return err
	}
	if err := ensureSchemaMigrationsTable(db); err != nil {
		return fmt.Errorf("schema migration up: ensure ledger: %w", err)
	}
	applied, err := appliedVersions(db)
	if err != nil {
		return err
	}
	for _, m := range sortedMigrations(registry) {
		if _, ok := applied[m.Version]; ok {
			continue // already applied — idempotent
		}
		err := db.Transaction(func(tx *gorm.DB) error {
			if err := m.Up(tx); err != nil {
				return err
			}
			// Record ONLY after a successful Up, in the same transaction.
			return tx.Exec(
				fmt.Sprintf("INSERT INTO %s (version, name, applied_at, checksum) VALUES (?, ?, ?, ?)", schemaMigrationsTable),
				m.Version, m.Name, common.GetTimestamp(), m.Checksum).Error
		})
		if err != nil {
			return fmt.Errorf("schema migration V%d (%s) failed and was rolled back: %w", m.Version, m.Name, err)
		}
	}
	return nil
}

func migrateSchemaDown(db *gorm.DB, targetVersion int, registry []SchemaMigration) error {
	if db == nil {
		return fmt.Errorf("schema migration down: nil db")
	}
	if targetVersion < 0 {
		return fmt.Errorf("schema migration down: invalid target version %d", targetVersion)
	}
	if err := validateRegistry(registry); err != nil {
		return err
	}
	if err := ensureSchemaMigrationsTable(db); err != nil {
		return err
	}
	applied, err := appliedVersions(db)
	if err != nil {
		return err
	}
	sorted := sortedMigrations(registry)

	// Collect the versions to roll back (descending), then PRE-CHECK for any
	// irreversible migration so we never perform a partial rollback.
	var toRollback []SchemaMigration
	for i := len(sorted) - 1; i >= 0; i-- {
		m := sorted[i]
		if m.Version <= targetVersion {
			break
		}
		if _, ok := applied[m.Version]; !ok {
			continue
		}
		toRollback = append(toRollback, m)
	}
	for _, m := range toRollback {
		if !m.Reversible || m.Down == nil {
			return fmt.Errorf("schema migration V%d (%s) is irreversible; refusing to roll back to %d (no changes applied)", m.Version, m.Name, targetVersion)
		}
	}
	for _, m := range toRollback {
		err := db.Transaction(func(tx *gorm.DB) error {
			if err := m.Down(tx); err != nil {
				return err
			}
			return tx.Exec(
				fmt.Sprintf("DELETE FROM %s WHERE version = ?", schemaMigrationsTable),
				m.Version).Error
		})
		if err != nil {
			return fmt.Errorf("schema migration down V%d (%s) failed and was rolled back: %w", m.Version, m.Name, err)
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// Ledger helpers
// ---------------------------------------------------------------------------

type appliedMigration struct {
	name      string
	checksum  string
	appliedAt int64
}

func ensureSchemaMigrationsTable(db *gorm.DB) error {
	return db.Exec(fmt.Sprintf(
		"CREATE TABLE IF NOT EXISTS %s (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL, checksum TEXT NOT NULL)",
		schemaMigrationsTable)).Error
}

func hasSchemaMigrationsTable(db *gorm.DB) bool {
	return db.Migrator().HasTable(schemaMigrationsTable)
}

func appliedVersions(db *gorm.DB) (map[int]appliedMigration, error) {
	out := make(map[int]appliedMigration)
	if db == nil || !hasSchemaMigrationsTable(db) {
		return out, nil
	}
	var rows []struct {
		Version   int    `gorm:"column:version"`
		Name      string `gorm:"column:name"`
		AppliedAt int64  `gorm:"column:applied_at"`
		Checksum  string `gorm:"column:checksum"`
	}
	if err := db.Raw(fmt.Sprintf("SELECT version, name, applied_at, checksum FROM %s", schemaMigrationsTable)).Scan(&rows).Error; err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.Version] = appliedMigration{name: r.Name, checksum: r.Checksum, appliedAt: r.AppliedAt}
	}
	return out, nil
}

func sortedMigrations(registry []SchemaMigration) []SchemaMigration {
	out := append([]SchemaMigration(nil), registry...)
	sort.Slice(out, func(i, j int) bool { return out[i].Version < out[j].Version })
	return out
}

func findMigration(sorted []SchemaMigration, version int) *SchemaMigration {
	for i := range sorted {
		if sorted[i].Version == version {
			return &sorted[i]
		}
	}
	return nil
}

func validateRegistry(registry []SchemaMigration) error {
	sorted := sortedMigrations(registry)
	for i, m := range sorted {
		if m.Version != i+1 {
			return fmt.Errorf("invalid migration registry: expected contiguous V%d at position %d, got V%d", i+1, i+1, m.Version)
		}
		if m.Checksum == "" {
			return fmt.Errorf("invalid migration registry: V%d has an empty checksum", m.Version)
		}
		if m.Up == nil {
			return fmt.Errorf("invalid migration registry: V%d has a nil Up", m.Version)
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// Physical-schema probes (dialect aware, fail closed on unknown dialects)
// ---------------------------------------------------------------------------

// topUpUserFKPresent reports whether top_ups has a real FK from user_id to
// users.id.
func topUpUserFKPresent(db *gorm.DB) (bool, error) {
	switch n := dialectName(db); n {
	case "sqlite":
		var fks []struct {
			Table string `gorm:"column:table"`
			From  string `gorm:"column:from"`
			To    string `gorm:"column:to"`
		}
		if err := db.Raw("PRAGMA foreign_key_list(top_ups)").Scan(&fks).Error; err != nil {
			return false, err
		}
		for _, f := range fks {
			if strings.EqualFold(f.Table, "users") && strings.EqualFold(f.From, "user_id") {
				return true, nil
			}
		}
		return false, nil
	case "mysql":
		var count int64
		err := db.Raw("SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'top_ups' AND CONSTRAINT_NAME = ?", fkTopUpsUser).Scan(&count).Error
		return count > 0, err
	case "postgres":
		var count int64
		err := db.Raw("SELECT COUNT(*) FROM pg_constraint WHERE conname = ? AND conrelid = 'top_ups'::regclass", fkTopUpsUser).Scan(&count).Error
		return count > 0, err
	default:
		return false, fmt.Errorf("unsupported dialect %q for FK inspection (fail closed)", n)
	}
}

func topUpStatusIndexPresent(db *gorm.DB) (bool, error) {
	switch n := dialectName(db); n {
	case "sqlite":
		var count int64
		err := db.Raw("SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = ?", V2TopUpUserStatusIndex).Scan(&count).Error
		return count > 0, err
	case "mysql":
		var count int64
		err := db.Raw("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'top_ups' AND INDEX_NAME = ?", V2TopUpUserStatusIndex).Scan(&count).Error
		return count > 0, err
	case "postgres":
		var count int64
		err := db.Raw("SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'top_ups' AND indexname = ?", V2TopUpUserStatusIndex).Scan(&count).Error
		return count > 0, err
	default:
		return false, fmt.Errorf("unsupported dialect %q for index inspection (fail closed)", n)
	}
}

// ---------------------------------------------------------------------------
// V1 — real FK: top_ups.user_id -> users.id
// ON DELETE RESTRICT (users are soft-deleted), ON UPDATE CASCADE.
// ---------------------------------------------------------------------------

func migrateV1AddTopUpUserFK(db *gorm.DB) error {
	switch n := dialectName(db); n {
	case "sqlite":
		return addTopUpUserFKSQLite(db)
	case "mysql", "postgres":
		if !db.Migrator().HasTable("top_ups") || !db.Migrator().HasTable("users") {
			return fmt.Errorf("V1: top_ups and users must exist before adding an FK")
		}
		return db.Exec(
			"ALTER TABLE top_ups ADD CONSTRAINT " + fkTopUpsUser +
				" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE").Error
	default:
		return fmt.Errorf("V1: unsupported dialect %q; refusing to silently skip the foreign-key migration (fail closed)", n)
	}
}

// addTopUpUserFKSQLite rebuilds top_ups with the FK constraint. SQLite cannot
// ALTER TABLE ADD CONSTRAINT, so the standard transactional rebuild is used:
// back up rows, drop the old table, recreate it with the FK, copy rows back,
// recreate indexes. Pre-existing orphan rows are REPORTED and cause a FAIL
// CLOSED error — no user data is ever deleted to make the migration "pass".
func addTopUpUserFKSQLite(tx *gorm.DB) error {
	if !tx.Migrator().HasTable("top_ups") || !tx.Migrator().HasTable("users") {
		return fmt.Errorf("V1(SQLite): top_ups and users must exist before adding an FK")
	}
	// Idempotent guard: never rebuild twice.
	present, err := topUpUserFKPresent(tx)
	if err != nil {
		return err
	}
	if present {
		return nil
	}

	// Report orphan rows and fail closed. The LEFT JOIN catches user_id values
	// with no parent users row; a soft-deleted user still has a physical row, so
	// it is correctly NOT considered an orphan.
	var orphanCount int64
	if err := tx.Raw(
		"SELECT COUNT(*) FROM top_ups t LEFT JOIN users u ON t.user_id = u.id WHERE u.id IS NULL").
		Scan(&orphanCount).Error; err != nil {
		return fmt.Errorf("V1(SQLite): orphan scan failed: %w", err)
	}
	if orphanCount > 0 {
		var sample []int
		_ = tx.Raw(
			"SELECT DISTINCT t.user_id FROM top_ups t LEFT JOIN users u ON t.user_id = u.id WHERE u.id IS NULL LIMIT 5").
			Scan(&sample).Error
		return fmt.Errorf("V1(SQLite): FAIL CLOSED — %d top_up row(s) reference a non-existent users.id (sample user_id=%v); "+
			"refusing to rebuild so no data is deleted. Repair/quarantine these rows manually, then retry", orphanCount, sample)
	}

	// Capture the exact table DDL and explicit indexes before dropping.
	var createSQL string
	if err := tx.Raw("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'top_ups'").Scan(&createSQL).Error; err != nil {
		return err
	}
	if strings.TrimSpace(createSQL) == "" {
		return fmt.Errorf("V1(SQLite): could not read top_ups DDL")
	}
	var indexSQLs []string
	if err := tx.Raw("SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'top_ups' AND sql IS NOT NULL").Scan(&indexSQLs).Error; err != nil {
		return err
	}

	// Inject the FK as a table-level constraint before the closing parenthesis,
	// keeping every original column/primary key/type/default verbatim.
	closeIdx := strings.LastIndex(createSQL, ")")
	if closeIdx < 0 {
		return fmt.Errorf("V1(SQLite): malformed top_ups DDL (no closing parenthesis)")
	}
	fkClause := ", CONSTRAINT " + fkTopUpsUser +
		" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE"
	newCreateSQL := createSQL[:closeIdx] + fkClause + createSQL[closeIdx:]

	const backupTable = "top_ups__v1_backup"
	if err := tx.Exec("CREATE TABLE `" + backupTable + "` AS SELECT * FROM `top_ups`").Error; err != nil {
		return fmt.Errorf("V1(SQLite): backing up rows failed: %w", err)
	}
	if err := tx.Exec("DROP TABLE `top_ups`").Error; err != nil {
		return fmt.Errorf("V1(SQLite): dropping old top_ups failed: %w", err)
	}
	if err := tx.Exec(newCreateSQL).Error; err != nil {
		return fmt.Errorf("V1(SQLite): recreating top_ups with FK failed: %w", err)
	}
	// With foreign_keys=ON on the connection this INSERT also re-validates every
	// row against users.id — a second, engine-level fail-closed barrier.
	if err := tx.Exec("INSERT INTO `top_ups` SELECT * FROM `" + backupTable + "`").Error; err != nil {
		return fmt.Errorf("V1(SQLite): restoring rows failed (an orphan user_id would be rejected here): %w", err)
	}
	if err := tx.Exec("DROP TABLE `" + backupTable + "`").Error; err != nil {
		return err
	}
	// The saved index DDL references the table name `top_ups`, which exists again.
	for _, idx := range indexSQLs {
		if err := tx.Exec(idx).Error; err != nil {
			return fmt.Errorf("V1(SQLite): recreating index failed: %w", err)
		}
	}
	// Final engine-level integrity check on the rebuilt table.
	var violations []struct {
		Table string `gorm:"column:table"`
	}
	if err := tx.Raw("PRAGMA foreign_key_check(top_ups)").Scan(&violations).Error; err != nil {
		return fmt.Errorf("V1(SQLite): foreign_key_check failed: %w", err)
	}
	if len(violations) > 0 {
		return fmt.Errorf("V1(SQLite): foreign_key_check reported %d violation(s) after rebuild", len(violations))
	}
	return nil
}

// ---------------------------------------------------------------------------
// V2 — genuinely reversible, idempotent index upgrade
// ---------------------------------------------------------------------------

func migrateV2CreateIndex(db *gorm.DB) error {
	switch n := dialectName(db); n {
	case "sqlite", "postgres":
		return db.Exec("CREATE INDEX IF NOT EXISTS " + V2TopUpUserStatusIndex + " ON top_ups(user_id, status)").Error
	case "mysql":
		var count int64
		if err := db.Raw("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'top_ups' AND INDEX_NAME = ?", V2TopUpUserStatusIndex).Scan(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return nil
		}
		return db.Exec("CREATE INDEX " + V2TopUpUserStatusIndex + " ON top_ups(user_id, status)").Error
	default:
		return fmt.Errorf("V2: unsupported dialect %q (fail closed)", n)
	}
}

func migrateV2DropIndex(db *gorm.DB) error {
	switch n := dialectName(db); n {
	case "sqlite", "postgres":
		return db.Exec("DROP INDEX IF EXISTS " + V2TopUpUserStatusIndex).Error
	case "mysql":
		var count int64
		if err := db.Raw("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'top_ups' AND INDEX_NAME = ?", V2TopUpUserStatusIndex).Scan(&count).Error; err != nil {
			return err
		}
		if count == 0 {
			return nil
		}
		return db.Exec("DROP INDEX " + V2TopUpUserStatusIndex + " ON top_ups").Error
	default:
		return fmt.Errorf("V2 down: unsupported dialect %q (fail closed)", n)
	}
}

// LatestSchemaVersion is the highest version in the registry. Exported for
// callers/tests that need to assert "everything is applied" without importing
// the private registry.
func LatestSchemaVersion() int {
	return len(schemaRegistry)
}
