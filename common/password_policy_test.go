package common

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidatePasswordStrengthAcceptsStrongPasswords(t *testing.T) {
	accepted := []string{
		"Aa1!Aa1!",          // letters + digits + symbols, no pattern
		"c0rrect-h0rse!42",  // passphrase with mixed classes
		"Tr0ub4dor&3xK",     // classic xkcd-style password
		"密码ABC123ab",        // CJK counts towards length and the letter class
		"x7#kLpQ2",          // exactly the minimum length
		"mY-v3ry-L0ng!pass", // comfortably inside the length bounds
	}
	for _, password := range accepted {
		require.Equal(
			t,
			PasswordOK,
			ValidatePasswordStrength(password, "", ""),
			"password %q should satisfy the policy",
			password,
		)
	}
}

func TestValidatePasswordStrengthRejectsBadLength(t *testing.T) {
	cases := []struct {
		name     string
		password string
		want     PasswordPolicyViolation
	}{
		{"empty", "", PasswordTooShort},
		{"seven characters", "Ab1!Ab1", PasswordTooShort},
		{"eight identical runes below minimum", "秘密秘密", PasswordTooShort},
		{"too long", strings.Repeat("Aa1!", 33), PasswordTooLong},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			require.Equal(t, test.want, ValidatePasswordStrength(test.password, "", ""))
		})
	}
}

func TestValidatePasswordStrengthRequiresCharacterVariety(t *testing.T) {
	cases := []string{
		"12345678",  // digits only
		"abcdefgh",  // lowercase only
		"ABCDEFGH",  // uppercase only
		"!!!!!!!!",  // symbols only
		"123456789", // digits only, long enough to look plausible
	}
	for _, password := range cases {
		require.Equal(
			t,
			PasswordTooSimple,
			ValidatePasswordStrength(password, "", ""),
			"password %q lacks character variety",
			password,
		)
	}
}

func TestValidatePasswordStrengthRejectsCommonPatterns(t *testing.T) {
	cases := []string{
		"password1",
		"P@ssw0rd",    // leet substitution collapses onto "password"
		"P@ssw0rd123", // mixed symbol + digit leet collapses onto "password…"
		"pass-word!",  // separators are stripped before matching
		"qwerty123",
		"qwerty2024",
		"Abcd1234",
		"iloveyou2024", // derived from a blocklisted fragment
		"Administrator1",
		"Trustno1!",
		"Woaini1314!",
	}
	for _, password := range cases {
		require.Equal(
			t,
			PasswordTooCommon,
			ValidatePasswordStrength(password, "", ""),
			"password %q is a known weak pattern",
			password,
		)
	}
}

func TestValidatePasswordStrengthRejectsSequentialAndRepeatingRuns(t *testing.T) {
	cases := []string{
		"Abcd5678!",  // ascending run embedded in a mixed-class password
		"Xyzyx9876!", // descending run
		"Qqqqqqq1!",  // a single dominant repeated character
	}
	for _, password := range cases {
		require.Equal(
			t,
			PasswordTooCommon,
			ValidatePasswordStrength(password, "", ""),
			"password %q follows an obvious pattern",
			password,
		)
	}
}

func TestValidatePasswordStrengthRejectsAccountIdentifiers(t *testing.T) {
	require.Equal(
		t,
		PasswordContainsAccount,
		ValidatePasswordStrength("Str0ng-Pass!", "strong", ""),
	)
	require.Equal(
		t,
		PasswordContainsAccount,
		ValidatePasswordStrength("Alice2024!x", "", "alice@example.com"),
	)
	// Short identifiers are ignored: substring matching them would reject far
	// too many legitimate passwords.
	require.Equal(
		t,
		PasswordOK,
		ValidatePasswordStrength("Strong-Pass!42", "abc", ""),
	)
}

// The rules must mirror web/src/lib/password-policy.ts exactly; these bounds are
// the contract both sides compile against.
func TestValidatePasswordStrengthBoundsMatchFrontend(t *testing.T) {
	require.Equal(t, 8, PasswordMinLength)
	require.Equal(t, 18, PasswordMaxLength)
}
