package service

import (
	"testing"

	"github.com/Uter-AI/Uter/common"
)

// The email policy has two independent switches, and each must produce its own
// actionable message: a rejected domain and a rejected alias are different
// problems with different fixes, so sharing one message is a UX bug.
func TestValidateAccountEmailDistinguishesDomainAndAlias(t *testing.T) {
	originalDomain, originalAlias := common.EmailDomainRestrictionEnabled, common.EmailAliasRestrictionEnabled
	t.Cleanup(func() {
		common.EmailDomainRestrictionEnabled, common.EmailAliasRestrictionEnabled = originalDomain, originalAlias
	})

	cases := []struct {
		name    string
		email   string
		domain  bool
		alias   bool
		wantErr error
	}{
		{
			name:  "both off accepts an alias",
			email: "user+tag@gmail.com",
		},
		{
			name:    "both off still rejects a malformed address",
			email:   "not-an-email",
			wantErr: ErrAccountEmailInvalid,
		},
		{
			name:    "domain restriction rejects an unlisted domain",
			email:   "user@blocked.example",
			domain:  true,
			wantErr: ErrAccountEmailDomainRestricted,
		},
		{
			name:   "domain restriction accepts a listed domain",
			email:  "user@allowed.example",
			domain: true,
		},
		{
			name:    "alias restriction rejects a plus alias",
			email:   "user+tag@allowed.example",
			alias:   true,
			wantErr: ErrAccountEmailAliasRestricted,
		},
		{
			name:    "alias restriction rejects a dotted local part",
			email:   "first.last@allowed.example",
			alias:   true,
			wantErr: ErrAccountEmailAliasRestricted,
		},
		{
			name:   "alias restriction accepts a plain local part",
			email:  "firstlast@allowed.example",
			alias:  true,
		},
		{
			name:    "both on reports the domain problem first",
			email:   "first.last@blocked.example",
			domain:  true,
			alias:   true,
			wantErr: ErrAccountEmailDomainRestricted,
		},
		{
			name:    "both on reports the alias problem for a listed domain",
			email:   "first.last@allowed.example",
			domain:  true,
			alias:   true,
			wantErr: ErrAccountEmailAliasRestricted,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			common.EmailDomainRestrictionEnabled = tc.domain
			common.EmailAliasRestrictionEnabled = tc.alias
			if tc.domain {
				common.EmailDomainWhitelist = []string{"allowed.example"}
			} else {
				common.EmailDomainWhitelist = nil
			}

			got, err := ValidateAccountEmail(tc.email)
			switch {
			case tc.wantErr == nil && err != nil:
				t.Fatalf("expected %q to be accepted, got %v", tc.email, err)
			case tc.wantErr != nil && err == nil:
				t.Fatalf("expected %q to be rejected with %v, but it was accepted", tc.email, tc.wantErr)
			case tc.wantErr != nil && err != tc.wantErr:
				t.Fatalf("expected %v, got %v", tc.wantErr, err)
			}
			if err == nil && got != tc.email {
				t.Fatalf("expected normalized %q, got %q", tc.email, got)
			}
		})
	}
}

// The two messages must stay distinct, otherwise splitting the sentinel errors
// would be pointless and the frontend could not translate them separately.
func TestEmailPolicyErrorsAreDistinctAndActionable(t *testing.T) {
	if ErrAccountEmailDomainRestricted == ErrAccountEmailAliasRestricted {
		t.Fatal("domain and alias rejections must be distinguishable errors")
	}
	for _, err := range []error{ErrAccountEmailDomainRestricted, ErrAccountEmailAliasRestricted, ErrAccountEmailInvalid} {
		if err.Error() == "" {
			t.Fatal("policy error messages must not be empty; they double as i18next keys")
		}
	}
	if ErrAccountEmailAliasRestricted.Error() == ErrAccountEmailInvalid.Error() {
		t.Fatal("alias rejection must not reuse the generic invalid-address message")
	}
}
