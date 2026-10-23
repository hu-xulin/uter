package common

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The policy must reject the values DEF-4 found being accepted: a bare common
// word and a single-character-class password.
func TestValidateNewAccountPasswordStrengthRejectsWeakPasswords(t *testing.T) {
	for _, password := range []string{"password", "abcdefgh", "12345678", "aaaaaaaa", "qwertyui", "aaaaaaaaaa"} {
		assert.Error(t, ValidateNewAccountPasswordStrength(password, "user", "user@example.com"),
			"password %q must be rejected", password)
	}
}

func TestValidateNewAccountPasswordStrengthAcceptsStrongPasswords(t *testing.T) {
	for _, password := range []string{"Str0ng-Pass!", "correct-horse-9", "Tiger&Lamp42"} {
		assert.NoError(t, ValidateNewAccountPasswordStrength(password, "user", "user@example.com"),
			"password %q must be accepted", password)
	}
}

// Long passphrases are better than short ones and Argon2id has no truncation
// limit, so the policy must not cap them at 18 characters.
func TestValidateNewAccountPasswordStrengthAllowsLongPassphrases(t *testing.T) {
	long := "Violet-Otter-42-Quota!"
	assert.NoError(t, ValidateNewAccountPasswordStrength(long, "user", "user@example.com"))
}

func TestValidateNewAccountPasswordStrengthRejectsAccountIdentifiers(t *testing.T) {
	assert.Error(t, ValidateNewAccountPasswordStrength("Str0ng-Pass!", "strong", ""))
	assert.Error(t, ValidateNewAccountPasswordStrength("Alice2024!x", "", "alice@example.com"))
}

func TestPasswordPolicyViolationErrorCoversEveryViolation(t *testing.T) {
	for _, violation := range []PasswordPolicyViolation{
		PasswordTooShort, PasswordTooLong, PasswordTooSimple, PasswordTooCommon, PasswordContainsAccount,
	} {
		assert.Error(t, PasswordPolicyViolationError(violation))
	}
	assert.NoError(t, PasswordPolicyViolationError(PasswordOK))
}

// The reset flow emails a generated credential, so the generator has to satisfy
// the same policy a user-chosen password does.
func TestGenerateAccountPasswordSatisfiesPolicy(t *testing.T) {
	for length := 8; length <= 24; length += 4 {
		password := GenerateAccountPassword(length)
		require.Len(t, []rune(password), length)
		assert.Equal(t, PasswordOK, ValidatePasswordStrength(password, "", ""),
			"generated password %q must satisfy the policy", password)
	}
}

func TestGenerateAccountPasswordUsesEveryCharacterClass(t *testing.T) {
	password := GenerateAccountPassword(12)
	assert.True(t, strings.ContainsAny(password, "abcdefghijkmnopqrstuvwxyz"))
	assert.True(t, strings.ContainsAny(password, "ABCDEFGHIJKLMNPQRSTUVWXYZ"))
	assert.True(t, strings.ContainsAny(password, "23456789"))
	assert.True(t, strings.ContainsAny(password, "!@#$%^&*-_=+"))
}

func TestGenerateAccountPasswordDoesNotRepeatWithinARun(t *testing.T) {
	seen := make(map[string]struct{})
	for i := 0; i < 50; i++ {
		seen[GenerateAccountPassword(16)] = struct{}{}
	}
	assert.Greater(t, len(seen), 45, "generated passwords must not collide")
}
