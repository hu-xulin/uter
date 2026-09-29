package model

import (
	"testing"

	"github.com/Uter-AI/Uter/common"
)

// ---------------------------------------------------------------------------
// PreConsumeOrgQuota — the shared-wallet budget gate (pure, no DB).
// ---------------------------------------------------------------------------

func TestPreConsumeOrgQuota(t *testing.T) {
	cases := []struct {
		name   string
		quota  int64
		used   int64
		amount int64
		wantOK bool
	}{
		{"zero budget always passes", 0, 0, 1000, true},
		{"within budget", 1000, 0, 500, true},
		{"exact remaining budget allowed", 1000, 0, 1000, true},
		{"one over budget rejected", 1000, 0, 1001, false},
		{"partially used within remaining", 1000, 500, 500, true},
		{"partially used over remaining", 1000, 500, 501, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			org := &Organization{Quota: c.quota, UsedQuota: c.used}
			if got := PreConsumeOrgQuota(org, c.amount); got != c.wantOK {
				t.Errorf("PreConsumeOrgQuota(quota=%d, used=%d, amount=%d) = %v, want %v",
					c.quota, c.used, c.amount, got, c.wantOK)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// OrgRole constants — guard against accidental renaming that would break the
// middleware/org gate string comparisons.
// ---------------------------------------------------------------------------

func TestOrgRoleConstants(t *testing.T) {
	if OrgRoleOwner != "owner" || OrgRoleAdmin != "admin" ||
		OrgRoleDepartmentAdmin != "department_admin" || OrgRoleMember != "member" {
		t.Errorf("org role constants drifted: %s/%s/%s/%s",
			OrgRoleOwner, OrgRoleAdmin, OrgRoleDepartmentAdmin, OrgRoleMember)
	}
}

// ---------------------------------------------------------------------------
// EnforceOrgQuota — exercised against a real DB in integration runs; here we
// assert the org-less fast path never blocks a platform user. This keeps the
// unit suite dependency-free (no sqlite driver in the module graph).
// ---------------------------------------------------------------------------

func TestEnforceOrgQuotaNonOrgUserPasses(t *testing.T) {
	// A user with no organization must never be blocked by the org gate,
	// regardless of amount. EnforceOrgQuota short-circuits on orgId==0.
	if err := EnforceOrgQuota(0, 999999); err != nil {
		t.Errorf("EnforceOrgQuota(0, ...) should pass, got %v", err)
	}
	_ = common.RoleRootUser // ensure common import is used
}
