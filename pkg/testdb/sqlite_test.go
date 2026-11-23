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
package testdb

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestDisposableProblemAcceptsThrowawayDSNs(t *testing.T) {
	tempFile := filepath.Join(t.TempDir(), "one-api.db")

	for _, dsn := range []string{
		"",
		":memory:",
		"file::memory:?cache=shared",
		"file:setup-e2e?mode=memory&cache=shared",
		tempFile,
		tempFile + "?_pragma=busy_timeout(30000)&_pragma=journal_mode(WAL)",
	} {
		assert.NoError(t, DisposableProblem(dsn), "dsn %q must be disposable", dsn)
	}
}

func TestDisposableProblemRefusesPersistentDatabases(t *testing.T) {
	// The package working directory is never under the system temp dir, so a
	// database file there is a persistent, operator-visible file.
	workingDirectory, err := os.Getwd()
	require.NoError(t, err)

	for _, dsn := range []string{
		"one-api.db",
		"one-api.db?_pragma=busy_timeout(30000)&_pragma=journal_mode(WAL)&_txlock=immediate",
		filepath.Join(workingDirectory, "one-api.db"),
	} {
		err := DisposableProblem(dsn)
		require.Error(t, err, "dsn %q must be refused", dsn)
		assert.Contains(t, err.Error(), "one-api.db")
		assert.Contains(t, err.Error(), "destructive test SQL")
	}
}

func TestSQLiteDSNOnlyReportsSQLiteDialectors(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "guard.db")), &gorm.Config{})
	require.NoError(t, err)
	assert.Contains(t, SQLiteDSN(db), "guard.db")

	// A nil handle must not be misread as a SQLite connection.
	assert.Empty(t, SQLiteDSN(nil))
}

func TestRequireDisposableRejectsRepositoryDatabase(t *testing.T) {
	// Classification is pure string logic, so the real operator file is named
	// without ever being opened.
	err := DisposableProblem(filepath.Join(repositoryRoot(t), "one-api.db"))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "destructive test SQL")
	assert.Contains(t, err.Error(), "one-api.db")
}

func TestRequireDisposablePassesForInMemoryHandle(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	RequireDisposable(t, db)
}

func TestSnapshotIntoTempCopiesRowsAndStaysDisposable(t *testing.T) {
	source := filepath.Join(t.TempDir(), "live.db")
	live, err := gorm.Open(sqlite.Open(source), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, live.Exec("CREATE TABLE channels (id integer primary key, name text)").Error)
	require.NoError(t, live.Exec("INSERT INTO channels (id, name) VALUES (22, 'inner')").Error)
	sqlDB, err := live.DB()
	require.NoError(t, err)
	require.NoError(t, sqlDB.Close())

	copyPath := SnapshotIntoTemp(t, source)
	assert.NoError(t, DisposableProblem(copyPath))

	readOnly, err := gorm.Open(sqlite.Open(copyPath), &gorm.Config{})
	require.NoError(t, err)
	t.Cleanup(func() {
		if pooled, err := readOnly.DB(); err == nil {
			_ = pooled.Close()
		}
	})
	var name string
	require.NoError(t, readOnly.Raw("SELECT name FROM channels WHERE id = 22").Scan(&name).Error)
	assert.Equal(t, "inner", name)
}

func TestLiveDBForTestIsolatesByDefaultAndWritesBackOnRequest(t *testing.T) {
	source := filepath.Join(t.TempDir(), "live.db")
	live, err := gorm.Open(sqlite.Open(source), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, live.Exec("CREATE TABLE users (id integer primary key)").Error)
	sqlDB, err := live.DB()
	require.NoError(t, err)
	require.NoError(t, sqlDB.Close())

	t.Setenv(LiveWritebackEnv, "")
	isolated := LiveDBForTest(t, source)
	assert.NotEqual(t, source, isolated)
	assert.NoError(t, DisposableProblem(isolated))

	t.Setenv(LiveWritebackEnv, "1")
	assert.Equal(t, source, LiveDBForTest(t, source))
}
