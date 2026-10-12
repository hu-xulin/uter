package model

import (
	"path/filepath"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// newSquareHiddenTestDB mirrors newLocalizedDescriptionTestDB: a file-backed
// SQLite database with the Option table migrated, because Model.Insert goes
// through metadataTransaction.
func newSquareHiddenTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	path := filepath.Join(t.TempDir(), "square-hidden-test.db")
	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Model{}, &Option{}))
	return db
}

// TestGetSquareHiddenModelNames pins the exclusion list used by the public
// rankings: only names matched by a disabled metadata record are hidden, and
// the same rule kinds the catalog honours must be honoured here.
func TestGetSquareHiddenModelNames(t *testing.T) {
	previous := DB
	DB = newSquareHiddenTestDB(t)
	t.Cleanup(func() { DB = previous })

	require.NoError(t, (&Model{ModelName: "rank-visible", NameRule: NameRuleExact, Status: 1}).Insert())
	require.NoError(t, (&Model{ModelName: "rank-hidden-exact", NameRule: NameRuleExact, Status: 0}).Insert())
	require.NoError(t, (&Model{ModelName: "rank-prefix-", NameRule: NameRulePrefix, Status: 0}).Insert())

	hidden, err := GetSquareHiddenModelNames([]string{
		"rank-visible",
		"rank-hidden-exact",
		"rank-prefix-snapshot",
		"rank-uncatalogued",
	})
	require.NoError(t, err)
	require.Len(t, hidden, 2)
	require.Contains(t, hidden, "rank-hidden-exact")
	require.Contains(t, hidden, "rank-prefix-snapshot")
	require.NotContains(t, hidden, "rank-visible")
	// A model with no metadata at all is "unavailable", never "hidden"; it must
	// keep its place on the rankings.
	require.NotContains(t, hidden, "rank-uncatalogued")

	empty, err := GetSquareHiddenModelNames(nil)
	require.NoError(t, err)
	require.Empty(t, empty)
}
