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
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// scannerFileName is skipped so the patterns below do not match this file.
const scannerFileName = "operator_db_reference_test.go"

func repositoryRoot(t *testing.T) string {
	t.Helper()
	_, thisFile, _, ok := runtime.Caller(0)
	require.True(t, ok, "locate the test source file")
	root, err := filepath.Abs(filepath.Join(filepath.Dir(thisFile), "..", ".."))
	require.NoError(t, err)
	return root
}

func isLiveDBAssignment(line string) bool {
	if strings.HasPrefix(strings.TrimSpace(line), "//") {
		return false
	}
	if !strings.Contains(line, "one-api.db") && !strings.Contains(line, "SQLITE_PATH") {
		return false
	}
	// Only assignments bind the shared database; a read (os.Getenv) does not.
	assignsPath := strings.Contains(line, "SQLitePath =") || strings.Contains(line, `Setenv("SQLITE_PATH"`)
	if !assignsPath {
		return false
	}
	// Sanctioned forms: an isolated copy helper, or a temporary directory.
	if strings.Contains(line, "LiveDBForTest(") || strings.Contains(line, "SnapshotIntoTemp(") {
		return false
	}
	if strings.Contains(line, "TempDir") || strings.Contains(line, "TempFile") {
		return false
	}
	return true
}

// TestNoTestTargetsTheOperatorDatabase keeps one-off inspection harnesses from
// re-pointing the shared model database at the operator's own SQLite file. Such
// a harness leaves every later fixture in the same package deleting real rows;
// the live development database lost its users, channels and logs that way.
func TestNoTestTargetsTheOperatorDatabase(t *testing.T) {
	root := repositoryRoot(t)
	prefixes := []string{"model", "service", "controller", "common", "router", "pkg", "relay", "middleware"}

	var offenders []string
	for _, prefix := range prefixes {
		directory := filepath.Join(root, prefix)
		err := filepath.WalkDir(directory, func(path string, entry fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if entry.IsDir() {
				switch entry.Name() {
				case "node_modules", "dist", ".git", ".quality", ".db-rescue", "vendor":
					return filepath.SkipDir
				}
				return nil
			}
			if !strings.HasSuffix(entry.Name(), "_test.go") || entry.Name() == scannerFileName {
				return nil
			}
			content, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			relative, err := filepath.Rel(root, path)
			require.NoError(t, err)
			for index, line := range strings.Split(string(content), "\n") {
				if isLiveDBAssignment(line) {
					offenders = append(offenders, fmt.Sprintf("%s:%d: %s", relative, index+1, strings.TrimSpace(line)))
				}
			}
			return nil
		})
		require.NoError(t, err, "walk %s", directory)
	}

	assert.Empty(t, offenders, "test files must not bind the shared database to an operator SQLite file;\n"+
		"use testdb.LiveDBForTest (isolated copy) or a path under t.TempDir(). Offenders:\n%s",
		strings.Join(offenders, "\n"))
}
