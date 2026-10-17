package controller

import (
	"errors"
	"testing"

	"github.com/uter-ai/uter/model"
)

type testOrgLogScope struct {
	platform      bool
	usernames     []string
	userIDs       []int
	usernamesErr  error
	userIDsErr    error
}

func (s testOrgLogScope) IsPlatformScope() bool         { return s.platform }
func (s testOrgLogScope) Usernames() ([]string, error)   { return s.usernames, s.usernamesErr }
func (s testOrgLogScope) UserIDs() ([]int, error)        { return s.userIDs, s.userIDsErr }

func TestApplyOrgLogScopeFailsClosedOnMembershipLookupErrors(t *testing.T) {
	tests := []struct {
		name  string
		scope testOrgLogScope
	}{
		{name: "usernames lookup fails", scope: testOrgLogScope{usernamesErr: errors.New("database unavailable")}},
		{name: "user IDs lookup fails", scope: testOrgLogScope{usernames: []string{"org-user"}, userIDsErr: errors.New("database unavailable")}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			filter := model.LogFilter{}
			if err := applyOrgLogScope(&filter, tc.scope); err == nil {
				t.Fatal("expected scope lookup error")
			}
			if filter.ScopedUsernames != nil || filter.ScopedUserIds != nil {
				t.Fatalf("scope filter must not be partially applied after error: %+v", filter)
			}
		})
	}
}

func TestApplyOrgLogScopeSetsBothRestrictions(t *testing.T) {
	filter := model.LogFilter{}
	scope := testOrgLogScope{
		usernames: []string{"member-a", "member-b"},
		userIDs:   []int{10, 11},
	}
	if err := applyOrgLogScope(&filter, scope); err != nil {
		t.Fatalf("applyOrgLogScope() error = %v", err)
	}
	if len(filter.ScopedUsernames) != 2 || len(filter.ScopedUserIds) != 2 {
		t.Fatalf("expected both restrictions, got usernames=%v userIDs=%v", filter.ScopedUsernames, filter.ScopedUserIds)
	}
}

func TestApplyOrgLogScopeLeavesPlatformScopeUnfiltered(t *testing.T) {
	filter := model.LogFilter{}
	scope := testOrgLogScope{platform: true, usernamesErr: errors.New("must not be called"), userIDsErr: errors.New("must not be called")}
	if err := applyOrgLogScope(&filter, scope); err != nil {
		t.Fatalf("platform scope should not query membership: %v", err)
	}
	if filter.ScopedUsernames != nil || filter.ScopedUserIds != nil {
		t.Fatalf("platform scope should remain unfiltered, got %+v", filter)
	}
}

func TestResolveOrgLogStatScopeFailsClosedOnLookupErrors(t *testing.T) {
	tests := []struct {
		name  string
		scope testOrgLogScope
	}{
		{name: "username lookup fails", scope: testOrgLogScope{usernamesErr: errors.New("database unavailable")}},
		{name: "user ID lookup fails", scope: testOrgLogScope{usernames: []string{"member-a"}, userIDsErr: errors.New("database unavailable")}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			usernames, userIDs, err := resolveOrgLogStatScope(tc.scope)
			if err == nil {
				t.Fatal("expected scope lookup error")
			}
			if usernames != nil || userIDs != nil {
				t.Fatalf("must not return partial/unfiltered scope after error: usernames=%v userIDs=%v", usernames, userIDs)
			}
		})
	}
}

func TestResolveOrgLogStatScopeReturnsBothTenantFilters(t *testing.T) {
	usernames, userIDs, err := resolveOrgLogStatScope(testOrgLogScope{
		usernames: []string{"member-a", "member-b"},
		userIDs:   []int{10, 11},
	})
	if err != nil {
		t.Fatalf("resolveOrgLogStatScope() error = %v", err)
	}
	if len(usernames) != 2 || len(userIDs) != 2 {
		t.Fatalf("expected both tenant filters, got usernames=%v userIDs=%v", usernames, userIDs)
	}
}

func TestResolveOrgLogStatScopeLeavesPlatformUnfiltered(t *testing.T) {
	usernames, userIDs, err := resolveOrgLogStatScope(testOrgLogScope{
		platform: true, usernamesErr: errors.New("must not be called"), userIDsErr: errors.New("must not be called"),
	})
	if err != nil {
		t.Fatalf("platform scope should not query members: %v", err)
	}
	if usernames != nil || userIDs != nil {
		t.Fatalf("platform scope must remain unfiltered, got usernames=%v userIDs=%v", usernames, userIDs)
	}
}
