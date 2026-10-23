package common

import (
	"errors"
	"strings"
	"unicode"
)

// Password length bounds. These mirror web/src/lib/password-policy.ts so the
// client can reject weak passwords before spending a round trip; the server
// stays the authority because a browser-side check is trivially bypassable.
// The upper bound matches MaxAccountPasswordLength: account passwords are hashed
// with Argon2id, which has no bcrypt-style 72-byte truncation, so capping at 18
// would reject passphrases that are strictly better than what we accept.
const (
	PasswordMinLength = MinAccountPasswordLength
	PasswordMaxLength = MaxAccountPasswordLength
)

// PasswordPolicyViolation identifies which rule a password breaks, so callers
// can surface an actionable i18n message instead of a generic failure.
type PasswordPolicyViolation int

const (
	// PasswordOK means the password satisfies the policy.
	PasswordOK PasswordPolicyViolation = iota
	// PasswordTooShort means fewer than PasswordMinLength characters.
	PasswordTooShort
	// PasswordTooLong means more than PasswordMaxLength characters.
	PasswordTooLong
	// PasswordTooSimple means it lacks character variety (e.g. all digits).
	PasswordTooSimple
	// PasswordTooCommon means it matches a known-breached or obvious pattern.
	PasswordTooCommon
	// PasswordContainsAccount means it embeds the username or email local part.
	PasswordContainsAccount
)

// ValidatePasswordStrength reports the first policy rule the password breaks,
// or PasswordOK. username and email are optional; when non-empty they must not
// appear inside the password (NIST SP 800-63B forbids such composition rules
// being satisfiable with the subscriber's own identifier).
//
// This is the account password policy. It is the server-side counterpart of
// web/src/lib/password-policy.ts, and every path that stores a new password
// must call it: the client-side copy only saves a round trip.
func ValidatePasswordStrength(password, username, email string) PasswordPolicyViolation {
	length := len([]rune(password))
	if length < PasswordMinLength {
		return PasswordTooShort
	}
	if length > PasswordMaxLength {
		return PasswordTooLong
	}
	if containsAccountIdentifier(password, username) ||
		containsAccountIdentifier(password, emailLocalPart(email)) {
		return PasswordContainsAccount
	}
	if !hasCharacterVariety(password) {
		return PasswordTooSimple
	}
	if isWeakPattern(password) {
		return PasswordTooCommon
	}
	return PasswordOK
}

// ErrPasswordPolicyViolations maps each violation onto the message the API
// returns, so callers do not have to re-derive the mapping and the client can
// show an actionable hint instead of a generic failure.
var ErrPasswordPolicyViolations = map[PasswordPolicyViolation]error{
	PasswordTooShort:        errors.New("Use at least 8 characters for your password."),
	PasswordTooLong:         errors.New("Keep your password within 128 characters."),
	PasswordTooSimple:       errors.New("Your password needs at least two of these: letters, numbers, symbols."),
	PasswordTooCommon:       errors.New("That password is too common or easy to guess. Please choose a different one."),
	PasswordContainsAccount: errors.New("Your password can't contain your username or email."),
}

// PasswordPolicyViolationError converts a violation into the error a caller
// should surface. PasswordOK has no error.
func PasswordPolicyViolationError(violation PasswordPolicyViolation) error {
	if err, ok := ErrPasswordPolicyViolations[violation]; ok {
		return err
	}
	return nil
}

// ValidateNewAccountPasswordStrength is the single entry point for every path
// that stores a new account password. It applies the full policy (length,
// account identifiers, composition, common patterns) and reports the first
// problem, or nil when the password is acceptable.
//
// username and email are optional; supply them when known so a password cannot
// embed the account's own identifier.
func ValidateNewAccountPasswordStrength(password, username, email string) error {
	if err := ValidateNewAccountPassword(password); err != nil {
		return err
	}
	return PasswordPolicyViolationError(ValidatePasswordStrength(password, username, email))
}

// hasCharacterVariety requires at least two of the three classes: letters
// (including non-Latin scripts), digits, and anything else (symbols, spaces).
// Requiring all three classes pushes users toward predictable substitutions;
// requiring two blocks the classic "only digits" / "only lowercase" failures.
func hasCharacterVariety(password string) bool {
	var hasLetter, hasDigit, hasOther bool
	for _, r := range password {
		switch {
		case unicode.IsLetter(r):
			hasLetter = true
		case unicode.IsDigit(r):
			hasDigit = true
		default:
			hasOther = true
		}
	}
	classes := 0
	for _, present := range []bool{hasLetter, hasDigit, hasOther} {
		if present {
			classes++
		}
	}
	return classes >= 2
}

// symbolSubstitutions maps punctuation onto the letters it commonly replaces,
// so "P@ssw0rd" collapses onto "passw0rd" before blocklist matching. Digits are
// deliberately excluded here: collapsing them would also mutate every word that
// legitimately contains digits ("password1" -> "passwordl") and let those well
// known values slip past the blocklist.
// Separators (-, _, .) are intentionally absent: they should be dropped rather
// than rewritten into letters, otherwise "correct-horse" would become nonsense
// and real word patterns could hide.
var symbolSubstitutions = map[rune]rune{
	'@': 'a',
	'$': 's',
	'!': 'i',
	'+': 't',
	'(': 'c',
}

// digitSubstitutions maps digits onto the letters they replace. It is only
// applied when comparing a password against an account identifier, where the
// goal is to catch variants such as "strong" hiding in "Str0ng!Pass".
var digitSubstitutions = map[rune]rune{
	'0': 'o',
	'1': 'l',
	'3': 'e',
	'4': 'a',
	'5': 's',
	'6': 'g',
	'7': 't',
	'8': 'b',
	'9': 'g',
}

// weakPasswords is a small set of values that dominate real-world breach
// corpora. Entries shorter than 6 characters are only matched exactly, because
// substring matching on short fragments causes false positives.
var weakPasswords = []string{
	"111111", "000000", "11111111", "88888888",
	"123123", "123321", "654321", "123456", "234567", "345678",
	"1234567", "12345678", "123456789", "1234567890", "0123456789",
	"password", "passwd", "password1", "password123", "passw0rd",
	"abc123", "abcd1234", "abc12345", "aa123456",
	"qwerty", "qwertyuiop", "qwerty123", "asdfgh", "asdfghjkl", "zxcvbnm",
	"iloveyou", "letmein", "admin123", "administrator", "welcome",
	"changeme", "secret", "sunshine", "princess", "football", "baseball",
	"dragon", "monkey", "master", "shadow", "superman", "trustno1",
	"whatever", "internet", "woaini1314", "wang1234", "5201314",
}

// weakFragments are >= 6 characters so they can safely be substring matched:
// this catches derived variants such as "qwerty2024" or "iloveyouforever".
var weakFragments = []string{
	"123456", "abcdef", "password", "letmein", "iloveyou", "qwerty",
	"qwertyuiop", "asdfghjkl", "zxcvbnm", "woaini", "changeme", "administrator",
}

// combinedSubstitutions applies both maps at once, so a password can also be
// compared after a full "de-leet". This is the only form that catches mixed
// evasions such as "P@ssw0rd123" -> "passwordl2e" -> contains "password",
// which neither single normalisation sees.
var combinedSubstitutions = mergeSubstitutionMaps(symbolSubstitutions, digitSubstitutions)

func mergeSubstitutionMaps(maps ...map[rune]rune) map[rune]rune {
	merged := make(map[rune]rune)
	for _, m := range maps {
		for from, to := range m {
			merged[from] = to
		}
	}
	return merged
}

// isWeakPattern reports whether the password is a known-breached value or an
// obvious construction that brute force tries first.
func isWeakPattern(password string) bool {
	// Several normalisations are compared because none alone catches every
	// evasion style: rewriting symbols into letters finds intentional leet
	// ("P@ssw0rd" -> "passw0rd"), dropping them finds punctuation used as
	// decoration ("Trustno1!" -> "trustno1"), and rewriting symbols *and*
	// digits finds mixtures such as "P@ssw0rd123".
	for _, substitutions := range []map[rune]rune{
		symbolSubstitutions, nil, combinedSubstitutions,
	} {
		skeleton := normalizePassword(password, substitutions)
		if skeleton == "" || matchesWeakPattern(skeleton) {
			return true
		}
	}
	return false
}

func matchesWeakPattern(skeleton string) bool {
	if StringsContains(weakPasswords, skeleton) {
		return true
	}
	for _, fragment := range weakFragments {
		if len(fragment) >= 6 && strings.Contains(skeleton, fragment) {
			return true
		}
	}

	// Runs of ascending or descending code points (abcd…, 4321…).
	if hasSequentialRun(skeleton, 4) {
		return true
	}
	// Nothing but one repeating character, or a two-character cycle.
	return len(trimRepeated(skeleton)) <= 2
}

// trimRepeated removes consecutively duplicated characters, collapsing input
// such as "aaaaaaaa" down to "a" and "abababab" down to "ab".
func trimRepeated(value string) string {
	runes := []rune(value)
	var builder strings.Builder
	for index, r := range runes {
		if index > 0 && runes[index-1] == r {
			continue
		}
		builder.WriteRune(r)
	}
	return builder.String()
}

// hasSequentialRun reports whether value contains minLen consecutive runes that
// each step by exactly one code point in the same direction.
func hasSequentialRun(value string, minLen int) bool {
	runes := []rune(value)
	if len(runes) < minLen {
		return false
	}
	ascending, descending := 1, 1
	for index := 1; index < len(runes); index++ {
		step := runes[index] - runes[index-1]
		if step == 1 {
			ascending++
			descending = 1
		} else if step == -1 {
			descending++
			ascending = 1
		} else {
			ascending, descending = 1, 1
		}
		if ascending >= minLen || descending >= minLen {
			return true
		}
	}
	return false
}

// containsAccountIdentifier rejects passwords embedding an account identifier,
// including leet variants ("strong" inside "Str0ng!Pass"). Identifiers shorter
// than 4 characters are ignored to avoid false positives on coincidental
// substring matches.
func containsAccountIdentifier(password, identifier string) bool {
	identifier = strings.ToLower(strings.TrimSpace(identifier))
	if len(identifier) < 4 {
		return false
	}
	if strings.Contains(strings.ToLower(password), identifier) {
		return true
	}
	return strings.Contains(normalizePassword(password, digitSubstitutions), identifier)
}

// normalizePassword lowercases the password and keeps only letters and digits,
// applying the given substitution map first. Separators and symbols are dropped
// so that "pass-word" and "pass word" cannot evade comparisons.
func normalizePassword(password string, substitutions map[rune]rune) string {
	var builder strings.Builder
	for _, r := range strings.ToLower(password) {
		if mapped, ok := substitutions[r]; ok {
			builder.WriteRune(mapped)
			continue
		}
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			builder.WriteRune(r)
		}
	}
	return builder.String()
}

// emailLocalPart returns the portion of an address before "@".
func emailLocalPart(email string) string {
	local, _, ok := strings.Cut(email, "@")
	if !ok {
		return ""
	}
	return local
}
