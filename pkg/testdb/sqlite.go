/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
// Package testdb keeps automated tests away from operator databases.
//
// Destructive fixtures (whole-table DELETE in a cleanup) are correct only when
// the database under test is throwaway. The repository default SQLite path is
// relative ("one-api.db"), so a test that re-initialises the model database
// while the working directory happens to be the repository root silently
// targets the live development database. Every helper here exists to turn that
// silent case into a test failure before any rows are lost.
package testdb

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// LiveWritebackEnv opts a live test into writing through to the operator
// database instead of an isolated copy. It is deliberately explicit: the
// default for every live test is a temporary copy.
const LiveWritebackEnv = "UTER_LIVE_WRITEBACK"

// dsnPath splits a SQLite DSN into its file part and its query part.
func dsnPath(dsn string) (path string, query string) {
	var rest string
	path, rest, _ = strings.Cut(dsn, "?")
	path = strings.TrimPrefix(path, "file:")
	return path, rest
}

// DisposableProblem reports why dSN is not a throwaway test database, or nil
// when destructive fixtures may run against it. Classification is pure string
// logic so it is testable without touching the filesystem.
func DisposableProblem(dsn string) error {
	// An empty DSN, ":memory:" and "mode=memory" all mean a fresh in-process
	// database that disappears with the test binary.
	if dsn == "" {
		return nil
	}
	path, query := dsnPath(dsn)
	if path == "" || path == ":memory:" || strings.Contains(query, "mode=memory") {
		return nil
	}

	absolute, err := filepath.Abs(path)
	if err != nil {
		return fmt.Errorf("testdb: cannot resolve SQLite path %q: %w", path, err)
	}
	tempRoot := os.TempDir()
	if resolved, err := filepath.EvalSymlinks(tempRoot); err == nil {
		tempRoot = resolved
	}
	if resolved, err := filepath.EvalSymlinks(filepath.Dir(absolute)); err == nil {
		absolute = filepath.Join(resolved, filepath.Base(absolute))
	}
	if strings.HasPrefix(absolute, tempRoot+string(filepath.Separator)) {
		return nil
	}
	return fmt.Errorf(
		"testdb: refusing destructive test SQL against a persistent database %s; "+
			"point SQLITE_PATH at a copy under %s (testdb.SnapshotIntoTemp) before truncating",
		absolute, tempRoot,
	)
}

// SQLiteDSN returns the DSN of a SQLite-backed gorm connection, or "" when the
// connection uses another dialect (MySQL/PostgreSQL integration runs are out
// of scope for this guard).
func SQLiteDSN(db *gorm.DB) string {
	if db == nil {
		return ""
	}
	dialector, ok := db.Dialector.(*sqlite.Dialector)
	if !ok {
		return ""
	}
	return dialector.DSN
}

// RequireDisposable fails the test before it can truncate a persistent
// database. Call it at the top of every fixture that issues whole-table DELETE.
func RequireDisposable(t *testing.T, dbs ...*gorm.DB) {
	t.Helper()
	for _, db := range dbs {
		dsn := SQLiteDSN(db)
		if dsn == "" && db != nil {
			// Non-SQLite dialect: the three-database matrix owns its own
			// disposable schema, so this guard stays out of the way.
			continue
		}
		if err := DisposableProblem(dsn); err != nil {
			t.Fatalf("%v", err)
		}
	}
}

// SnapshotIntoTemp copies the SQLite database at source into the test's
// temporary directory with VACUUM INTO, which is safe while the source is in
// WAL mode and being written by the running instance. The copy is returned and
// is always accepted by DisposableProblem.
func SnapshotIntoTemp(t *testing.T, source string) string {
	t.Helper()
	if _, err := os.Stat(source); err != nil {
		t.Fatalf("testdb: live database %s is not readable: %v", source, err)
	}
	destination := filepath.Join(t.TempDir(), "one-api-copy.db")
	db, err := gorm.Open(sqlite.Open("file:"+source+"?mode=ro&_pragma=busy_timeout(30000)"), &gorm.Config{})
	if err != nil {
		t.Fatalf("testdb: open live database read-only: %v", err)
	}
	if err := db.Exec("VACUUM INTO ?", destination).Error; err != nil {
		if sqlDB, dbErr := db.DB(); dbErr == nil {
			_ = sqlDB.Close()
		}
		t.Fatalf("testdb: VACUUM INTO %s: %v", destination, err)
	}
	if sqlDB, dbErr := db.DB(); dbErr == nil {
		_ = sqlDB.Close()
	}
	if err := DisposableProblem(destination); err != nil {
		t.Fatalf("testdb: snapshot is not disposable: %v", err)
	}
	t.Cleanup(func() { _ = os.Remove(destination) })
	return destination
}

// LiveDBForTest gives a live-upstream test a database path to initialise.
// The default is an isolated copy of the operator database; only
// UTER_LIVE_WRITEBACK=1 keeps writing through to the original file, and that
// intent is reported so the run log records which mode was used.
func LiveDBForTest(t *testing.T, source string) string {
	t.Helper()
	if os.Getenv(LiveWritebackEnv) == "1" {
		t.Logf("testdb: %s=1, writing through to the operator database %s", LiveWritebackEnv, source)
		return source
	}
	t.Logf("testdb: using an isolated copy of %s (set %s=1 to write through)", source, LiveWritebackEnv)
	return SnapshotIntoTemp(t, source)
}
