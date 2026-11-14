package common

import (
	"strings"
	"testing"
)

// The default DSN and any SQLITE_PATH override must both retain the three
// parameters that make concurrent payment/balance writes correct AND keep
// referential integrity enforced on every pooled connection:
// `_txlock=immediate` (BEGIN IMMEDIATE), `_pragma=busy_timeout(...)` and
// `_pragma=foreign_keys(1)`. See common/database.go.
func TestEnsureSQLiteConcurrencyPragmas(t *testing.T) {
	cases := []struct {
		name         string
		in           string
		wantUpgraded bool
		wantContains []string
		wantAbsent   []string
	}{
		{
			name:         "default DSN is already complete and unchanged",
			in:           "one-api.db?_pragma=busy_timeout(30000)&_pragma=journal_mode(WAL)&_txlock=immediate&_pragma=foreign_keys(1)",
			wantUpgraded: false,
			wantContains: []string{"_txlock=immediate", "_pragma=busy_timeout(30000)", "_pragma=journal_mode(WAL)", "_pragma=foreign_keys(1)"},
		},
		{
			name:         "bare path gets all mandatory pragmas (incl FK)",
			in:           "/var/lib/uter/one-api.db",
			wantUpgraded: true,
			wantContains: []string{"/var/lib/uter/one-api.db?", "_txlock=immediate", "_pragma=busy_timeout(30000)", "_pragma=foreign_keys(1)"},
		},
		{
			name:         "custom pragmas preserved, missing busy timeout and FK added",
			in:           "one-api.db?_pragma=journal_mode(WAL)&_txlock=immediate",
			wantUpgraded: true,
			wantContains: []string{"_pragma=journal_mode(WAL)", "_txlock=immediate", "_pragma=busy_timeout(30000)", "_pragma=foreign_keys(1)"},
		},
		{
			name:         "explicit deferred txlock is upgraded to immediate",
			in:           "one-api.db?_pragma=busy_timeout(30000)&_txlock=deferred",
			wantUpgraded: true,
			wantContains: []string{"_txlock=immediate", "_pragma=busy_timeout(30000)", "_pragma=foreign_keys(1)"},
			wantAbsent:   []string{"_txlock=deferred"},
		},
		{
			name:         "operator's custom busy timeout and FK value are kept",
			in:           "one-api.db?_pragma=busy_timeout(60000)&_txlock=immediate&_pragma=foreign_keys(1)",
			wantUpgraded: false,
			wantContains: []string{"_pragma=busy_timeout(60000)", "_txlock=immediate", "_pragma=foreign_keys(1)"},
		},
		{
			name:         "empty query still normalized",
			in:           "one-api.db?",
			wantUpgraded: true,
			wantContains: []string{"_txlock=immediate", "_pragma=busy_timeout(30000)", "_pragma=foreign_keys(1)"},
		},
		{
			name:         "bare path (no query) always gets foreign_keys(1)",
			in:           "custom.db",
			wantUpgraded: true,
			wantContains: []string{"custom.db?", "_pragma=foreign_keys(1)"},
		},
		{
			name:         "operator's explicit foreign_keys(0) is preserved, not silently overridden",
			in:           "one-api.db?_pragma=busy_timeout(30000)&_txlock=immediate&_pragma=journal_mode(WAL)&_pragma=foreign_keys(0)",
			wantUpgraded: false,
			wantContains: []string{"_pragma=foreign_keys(0)", "_txlock=immediate", "_pragma=busy_timeout(30000)", "_pragma=journal_mode(WAL)"},
			wantAbsent:   []string{"_pragma=foreign_keys(1)"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, upgraded := ensureSQLiteConcurrencyPragmas(tc.in)
			if upgraded != tc.wantUpgraded {
				t.Errorf("upgraded = %v, want %v (got %q)", upgraded, tc.wantUpgraded, got)
			}
			for _, want := range tc.wantContains {
				if !strings.Contains(got, want) {
					t.Errorf("normalized DSN %q missing %q", got, want)
				}
			}
			for _, absent := range tc.wantAbsent {
				if strings.Contains(got, absent) {
					t.Errorf("normalized DSN %q still contains weaker setting %q", got, absent)
				}
			}
			// Exactly one of each mandatory parameter, never duplicated.
			if strings.Count(got, "_txlock=") != 1 {
				t.Errorf("expected exactly one _txlock parameter, got %q", got)
			}
			if strings.Count(got, "_pragma=busy_timeout") != 1 {
				t.Errorf("expected exactly one busy_timeout pragma, got %q", got)
			}
			if strings.Count(got, "_pragma=foreign_keys") != 1 {
				t.Errorf("expected exactly one foreign_keys pragma (operator value kept or default added), got %q", got)
			}
		})
	}
}

func TestDefaultSQLiteDSNIsConcurrencySafe(t *testing.T) {
	if !strings.Contains(SQLitePath, "_txlock=immediate") {
		t.Fatalf("default SQLitePath lost BEGIN IMMEDIATE: %q", SQLitePath)
	}
	if !strings.Contains(SQLitePath, "_pragma=busy_timeout(30000)") {
		t.Fatalf("default SQLitePath lost busy timeout: %q", SQLitePath)
	}
	if !strings.Contains(SQLitePath, "_pragma=foreign_keys(1)") {
		t.Fatalf("default SQLitePath lost foreign-key enforcement: %q", SQLitePath)
	}
}

// SQLiteForeignKeysEnabledDSN is the exported helper tests use to build a DSN
// that mirrors the real connection-init path. It must carry the full canonical
// parameter set (including WAL, which it inherits from SQLitePath) and never
// duplicate or silently overwrite an explicit operator value.
func TestSQLiteForeignKeysEnabledDSN(t *testing.T) {
	t.Run("bare path mirrors the production parameter set", func(t *testing.T) {
		got := SQLiteForeignKeysEnabledDSN("/tmp/uter-fk-test.db")
		for _, want := range []string{
			"/tmp/uter-fk-test.db?",
			"_txlock=immediate",
			"_pragma=busy_timeout(30000)",
			"_pragma=journal_mode(WAL)",
			"_pragma=foreign_keys(1)",
		} {
			if !strings.Contains(got, want) {
				t.Errorf("helper DSN %q missing %q", got, want)
			}
		}
		if strings.Count(got, "_pragma=foreign_keys") != 1 {
			t.Errorf("helper DSN must carry exactly one foreign_keys pragma, got %q", got)
		}
	})

	t.Run("explicit FK value in a full DSN is preserved", func(t *testing.T) {
		got := SQLiteForeignKeysEnabledDSN(
			"/tmp/uter-fk-test.db?_pragma=busy_timeout(1000)&_txlock=immediate&_pragma=foreign_keys(0)")
		if !strings.Contains(got, "_pragma=foreign_keys(0)") {
			t.Errorf("helper must preserve an explicit foreign_keys(0), got %q", got)
		}
		if strings.Contains(got, "_pragma=foreign_keys(1)") {
			t.Errorf("helper must not inject a default FK when one is explicit, got %q", got)
		}
	})
}
