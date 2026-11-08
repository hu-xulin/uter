package common

import (
	"strings"
	"testing"
)

// The default DSN and any SQLITE_PATH override must both retain the two
// parameters that make concurrent payment/balance writes correct:
// `_txlock=immediate` (BEGIN IMMEDIATE) and `_pragma=busy_timeout(...)`.
// See common/database.go and docs/ai-specs/DATABASE-STANDARD.md §15.5.
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
			in:           "one-api.db?_pragma=busy_timeout(30000)&_pragma=journal_mode(WAL)&_txlock=immediate",
			wantUpgraded: false,
			wantContains: []string{"_txlock=immediate", "_pragma=busy_timeout(30000)", "_pragma=journal_mode(WAL)"},
		},
		{
			name:         "bare path gets both pragmas",
			in:           "/var/lib/uter/one-api.db",
			wantUpgraded: true,
			wantContains: []string{"/var/lib/uter/one-api.db?", "_txlock=immediate", "_pragma=busy_timeout(30000)"},
		},
		{
			name:         "custom pragmas preserved, missing busy timeout added",
			in:           "one-api.db?_pragma=journal_mode(WAL)&_txlock=immediate",
			wantUpgraded: true,
			wantContains: []string{"_pragma=journal_mode(WAL)", "_txlock=immediate", "_pragma=busy_timeout(30000)"},
		},
		{
			name:         "explicit deferred txlock is upgraded to immediate",
			in:           "one-api.db?_pragma=busy_timeout(30000)&_txlock=deferred",
			wantUpgraded: true,
			wantContains: []string{"_txlock=immediate", "_pragma=busy_timeout(30000)"},
			wantAbsent:   []string{"_txlock=deferred"},
		},
		{
			name:         "operator's custom busy timeout is kept",
			in:           "one-api.db?_pragma=busy_timeout(60000)&_txlock=immediate",
			wantUpgraded: false,
			wantContains: []string{"_pragma=busy_timeout(60000)", "_txlock=immediate"},
		},
		{
			name:         "empty query still normalized",
			in:           "one-api.db?",
			wantUpgraded: true,
			wantContains: []string{"_txlock=immediate", "_pragma=busy_timeout(30000)"},
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
}
