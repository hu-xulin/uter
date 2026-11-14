package common

import "strings"

type DatabaseType string

const (
	DatabaseTypeMySQL      DatabaseType = "mysql"
	DatabaseTypeSQLite     DatabaseType = "sqlite"
	DatabaseTypePostgreSQL DatabaseType = "postgres"
	DatabaseTypeClickHouse DatabaseType = "clickhouse"
)

var mainDatabaseType = DatabaseTypeSQLite
var logDatabaseType = DatabaseTypeSQLite

func MainDatabaseType() DatabaseType {
	return mainDatabaseType
}

func LogDatabaseType() DatabaseType {
	return logDatabaseType
}

func SetMainDatabaseType(databaseType DatabaseType) {
	mainDatabaseType = databaseType
}

func SetLogDatabaseType(databaseType DatabaseType) {
	logDatabaseType = databaseType
}

func SetDatabaseTypes(mainType DatabaseType, logType DatabaseType) {
	mainDatabaseType = mainType
	logDatabaseType = logType
}

func UsingMainDatabase(databaseType DatabaseType) bool {
	return mainDatabaseType == databaseType
}

func UsingLogDatabase(databaseType DatabaseType) bool {
	return logDatabaseType == databaseType
}

// SQLitePath is the DSN for the default SQLite database. It uses WAL journal
// mode so readers are never blocked by the single writer, plus a 30s busy
// timeout for writers to queue.
//
// Three details are non-obvious and all are required for correct behaviour:
//
//  1. The busy timeout must be passed as a `_pragma=busy_timeout(30000)` DSN
//     parameter. The pure-Go driver (modernc.org/sqlite, used through
//     github.com/glebarez/sqlite) silently ignores the plain `_busy_timeout=`
//     form, so without this the effective timeout stays at SQLite's 5s default
//     and concurrent writes surface as "database is locked" (see #6805).
//
//  2. `_txlock=immediate` (BEGIN IMMEDIATE) must be enabled. Without it, a
//     transaction that first SELECTs (establishing a read snapshot) and then
//     writes can hit SQLITE_BUSY_SNAPSHOT when another connection commits in
//     between; the busy handler does not cover that case, so the write fails
//     instantly no matter the timeout. BEGIN IMMEDIATE takes the write lock up
//     front, so writers serialize through the busy timeout instead of dying on
//     a stale snapshot. Autocommit SELECTs stay concurrent because WAL keeps
//     readers unlocked.
//
//  3. `_pragma=foreign_keys(1)` enables foreign-key enforcement on EVERY
//     pooled connection. modernc.org/sqlite applies `_pragma` each time it
//     opens a connection, whereas a one-off `PRAGMA foreign_keys=ON` would be
//     lost as soon as the pool hands out a different connection. Without this
//     parameter a child row (e.g. a top-up order) can reference a
//     non-existent parent user and be silently persisted. The versioned V1
//     migration (model/schema_migrations.go) adds the real FK constraint;
//     this DSN parameter is what makes the engine actually enforce it. See
//     model/MIGRATION-INVENTORY.md.
var SQLitePath = "one-api.db?_pragma=busy_timeout(30000)&_pragma=journal_mode(WAL)&_txlock=immediate&_pragma=foreign_keys(1)"

// SQLiteForeignKeysEnabledDSN returns a DSN for an arbitrary file path that
// mirrors the production connection-init path: WAL, busy timeout, BEGIN
// IMMEDIATE and per-connection foreign-key enforcement. It is the single
// source of truth for tests that must exercise the same connection semantics
// as production without duplicating the pragma literal or ever touching the
// repository database file.
//
// A path that already carries a query string is normalized in place; a bare
// path inherits the canonical parameter set from SQLitePath.
func SQLiteForeignKeysEnabledDSN(path string) string {
	if !strings.Contains(path, "?") {
		_, query, _ := strings.Cut(SQLitePath, "?")
		path = path + "?" + query
	}
	normalized, _ := normalizeSQLiteDSN(path)
	return normalized
}

// normalizeSQLiteDSN is the shared DSN normalizer used by both the
// SQLITE_PATH override (see init.go) and SQLiteForeignKeysEnabledDSN.
//
// It preserves operator intent (custom file path, extra pragmas and an
// explicit `_pragma=foreign_keys(...)` value are kept verbatim) while
// guaranteeing the parameters that must never be weakened by omission:
// `_txlock=immediate`, a busy timeout, and foreign-key enforcement. A weaker
// `_txlock=deferred` is upgraded to `immediate`.
//
// Returns (normalizedDSN, upgraded); upgraded reports whether any parameter
// was added or corrected, for a startup warning.
func normalizeSQLiteDSN(dsn string) (string, bool) {
	base, query, found := strings.Cut(dsn, "?")
	params := make([]string, 0, 6)
	if found && query != "" {
		params = append(params, strings.Split(query, "&")...)
	}
	hasTxLock, hasBusyTimeout, hasForeignKeys := false, false, false
	for i, p := range params {
		switch key := strings.SplitN(p, "=", 2)[0]; {
		case key == "_txlock":
			// Never honour a weaker transaction lock mode.
			if p != "_txlock=immediate" {
				params[i] = "_txlock=immediate"
			}
			hasTxLock = true
		case key == "_pragma" && strings.HasPrefix(p, "_pragma=busy_timeout"):
			hasBusyTimeout = true
		case key == "_pragma" && strings.HasPrefix(p, "_pragma=foreign_keys"):
			// Preserve an operator's explicit choice (even foreign_keys(0));
			// only supply the safe default when the parameter is missing.
			hasForeignKeys = true
		}
	}
	if !hasTxLock {
		params = append(params, "_txlock=immediate")
	}
	if !hasBusyTimeout {
		params = append(params, "_pragma=busy_timeout(30000)")
	}
	if !hasForeignKeys {
		params = append(params, "_pragma=foreign_keys(1)")
	}
	normalized := base + "?" + strings.Join(params, "&")
	return normalized, normalized != dsn
}
