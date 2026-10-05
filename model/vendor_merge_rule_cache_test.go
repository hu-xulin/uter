package model

import (
	"errors"
	"testing"

	"github.com/Uter-AI/Uter/common"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// errRollback is a sentinel used to abort a test transaction on purpose.
var errRollback = errors.New("rollback")

// setupVendorMergeTestDB installs an in-memory database seeded with the tables
// the merge-rule code touches.
func setupVendorMergeTestDB(t *testing.T) {
	t.Helper()
	originalDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open in-memory db: %v", err)
	}
	if err := db.AutoMigrate(&Vendor{}, &VendorMergeRule{}, &Option{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	DB = db
	t.Cleanup(func() {
		DB = originalDB
		InvalidateVendorMergeCache()
	})
	InvalidateVendorMergeCache()
}

// createVendor inserts a vendor and returns its id.
func createVendor(t *testing.T, name string) int {
	t.Helper()
	vendor := Vendor{Name: name, Status: 1, CreatedTime: common.GetTimestamp(), UpdatedTime: common.GetTimestamp()}
	if err := DB.Create(&vendor).Error; err != nil {
		t.Fatalf("create vendor %q: %v", name, err)
	}
	return vendor.Id
}

// TestVendorMergeIndexSeesRuleAfterCommit locks the cache-coherency invariant
// for the auto-merge rules: once the merge transaction commits, the next read
// must observe the new rule.
//
// RecordVendorMergeRule runs inside the caller's transaction, so it must not
// publish the cache drop on its own — a concurrent reader can then rebuild the
// index from the pre-commit snapshot, and because the index has no TTL it stays
// stale forever: the merged brand silently comes back on every pricing refresh.
// Invalidating after the commit closes that window.
func TestVendorMergeIndexSeesRuleAfterCommit(t *testing.T) {
	setupVendorMergeTestDB(t)
	target := createVendor(t, "Target Vendor")

	// Prime the index so a stale snapshot would be observable.
	if got := ResolveVendorMergeTarget("Merged Brand"); got != 0 {
		t.Fatalf("expected no rule before the merge, got %d", got)
	}

	// Apply the merge inside a transaction, mirroring applyVendorOperation.
	if err := DB.Transaction(func(tx *gorm.DB) error {
		return RecordVendorMergeRule(tx, "Merged Brand", []string{"merged-"}, target)
	}); err != nil {
		t.Fatalf("record merge rule: %v", err)
	}
	InvalidateVendorMergeCache()

	if got := ResolveVendorMergeTarget("Merged Brand"); got != target {
		t.Fatalf("merge rule not visible after commit: got %d, want %d", got, target)
	}
}

// TestVendorMergeIndexSkipsRollback guards the inverse: a transaction that
// rolls back must not leave the rule visible, because no invalidation is
// published for it.
func TestVendorMergeIndexSkipsRollback(t *testing.T) {
	setupVendorMergeTestDB(t)
	target := createVendor(t, "Target Vendor")

	rollback := errRollback
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := RecordVendorMergeRule(tx, "Rolled Back Brand", []string{"rolled-"}, target); err != nil {
			return err
		}
		return rollback
	})
	if err != rollback {
		t.Fatalf("expected the transaction to roll back, got %v", err)
	}

	if got := ResolveVendorMergeTarget("Rolled Back Brand"); got != 0 {
		t.Fatalf("rolled-back rule must not resolve, got %d", got)
	}
}

// TestVendorMergeIndexDropsStaleEntryOnCommit reproduces the race directly: a
// reader that populated the index before the commit must not keep serving the
// pre-commit snapshot once the merge lands.
func TestVendorMergeIndexDropsStaleEntryOnCommit(t *testing.T) {
	setupVendorMergeTestDB(t)
	target := createVendor(t, "Target Vendor")

	// Snapshot the index as it looks before any rule exists.
	stale := loadVendorMergeIndex()
	if _, ok := stale.byKey[VendorMergeKey("Merged Brand")]; ok {
		t.Fatal("precondition failed: unexpected pre-existing rule")
	}

	if err := DB.Transaction(func(tx *gorm.DB) error {
		return RecordVendorMergeRule(tx, "Merged Brand", nil, target)
	}); err != nil {
		t.Fatalf("record merge rule: %v", err)
	}
	InvalidateVendorMergeCache()

	fresh := loadVendorMergeIndex()
	if got := fresh.byKey[VendorMergeKey("Merged Brand")]; got != target {
		t.Fatalf("stale index survived the commit: got %d, want %d", got, target)
	}
}

// TestVendorMergeIndexNotStaleByConcurrentReader reproduces the write/read race
// deterministically. The ordering below is the one that loses data:
//
//  1. the merge transaction writes the rule and drops the cache;
//  2. a concurrent pricing refresh repopulates the cache — still uncommitted, so
//     it observes "no rule" and caches that snapshot;
//  3. the transaction commits.
//
// Because the index has no TTL, step 2's snapshot is served forever and the
// merged brand reappears on every subsequent pricing refresh, which is exactly
// the behaviour the merge rule exists to prevent. Dropping the cache after the
// commit (rather than from inside the transaction) makes step 3 the last write,
// so the stale snapshot can never outlive it.
func TestVendorMergeIndexNotStaleByConcurrentReader(t *testing.T) {
	setupVendorMergeTestDB(t)
	target := createVendor(t, "Target Vendor")

	if err := DB.Transaction(func(tx *gorm.DB) error {
		if err := RecordVendorMergeRule(tx, "Merged Brand", nil, target); err != nil {
			return err
		}
		// Step 2: a concurrent reader repopulates the index from the
		// not-yet-committed snapshot. loadVendorMergeIndex reads through DB, not
		// tx, so it cannot see the pending insert.
		interleaved := loadVendorMergeIndex()
		if _, ok := interleaved.byKey[VendorMergeKey("Merged Brand")]; ok {
			t.Fatal("precondition failed: uncommitted rule must not be visible yet")
		}
		return nil
	}); err != nil {
		t.Fatalf("record merge rule: %v", err)
	}

	// Step 3: the caller invalidates right after the transaction returns, so the
	// commit is the last write and the stale snapshot can never outlive it.
	InvalidateVendorMergeCache()

	if got := ResolveVendorMergeTarget("Merged Brand"); got != target {
		t.Fatalf("index went stale across the commit window: got %d, want %d", got, target)
	}
}
