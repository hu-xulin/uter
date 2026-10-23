package common

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"math/big"
	"os"
	"strings"
	"unicode/utf8"

	"golang.org/x/crypto/argon2"
)

const (
	MinAccountPasswordLength = 8
	MaxAccountPasswordLength = 128
	accountPasswordMemory    = 19 * 1024
	accountPasswordTime      = 2
	accountPasswordSaltBytes = 16
	accountPasswordKeyBytes  = 32
)

var (
	ErrAccountPasswordLength = errors.New("Password must contain between 8 and 128 characters.")
	ErrAccountPasswordSame   = errors.New("New password must be different from current password")
	ErrPasswordLegacyLimit   = errors.New("Long passwords are unavailable until the password storage upgrade is complete.")
)

// ValidateNewAccountPassword applies only when a user chooses a new password.
// Authentication must continue to accept historical passwords without applying
// the new policy. Do not normalize passwords, including surrounding whitespace.
func ValidateNewAccountPassword(password string) error {
	if !utf8.ValidString(password) || utf8.RuneCountInString(password) < MinAccountPasswordLength || utf8.RuneCountInString(password) > MaxAccountPasswordLength {
		return ErrAccountPasswordLength
	}
	return nil
}

// passwordClasses are disjoint character sets. Drawing each position from a
// different class guarantees character variety, which is the composition rule
// the policy enforces; the ambiguous glyphs (0/O, 1/l/I) are left out so a
// generated credential can be typed without guessing.
var passwordClasses = []string{
	"abcdefghijkmnopqrstuvwxyz",
	"ABCDEFGHIJKLMNPQRSTUVWXYZ",
	"23456789",
	"!@#$%^&*-_=+",
}

// GenerateAccountPassword returns a random password that satisfies the account
// password policy. It draws each character from a disjoint class so the result
// always has character variety, and re-rolls when the policy still rejects it
// (an ascending digit run is rare but possible).
func GenerateAccountPassword(length int) string {
	if length < len(passwordClasses) {
		length = len(passwordClasses)
	}
	classes := passwordClasses
	var builder strings.Builder
	for index := 0; index < length; index++ {
		class := classes[index%len(classes)]
		position, err := rand.Int(rand.Reader, big.NewInt(int64(len(class))))
		if err != nil {
			// crypto/rand only fails when the OS entropy source is broken; fall
			// back to a fixed alphabet so the caller still gets a usable value.
			builder.WriteByte(class[index%len(class)])
			continue
		}
		builder.WriteByte(class[position.Int64()])
	}
	for attempt := 0; attempt < 8; attempt++ {
		password := builder.String()
		if ValidatePasswordStrength(password, "", "") == PasswordOK {
			return password
		}
		// Fisher-Yates with crypto/rand: rotation alone would keep the class
		// pattern aligned with the positions the policy dislikes.
		runes := []rune(password)
		for index := len(runes) - 1; index > 0; index-- {
			position, err := rand.Int(rand.Reader, big.NewInt(int64(index+1)))
			if err != nil {
				break
			}
			swap := int(position.Int64())
			runes[index], runes[swap] = runes[swap], runes[index]
		}
		builder.Reset()
		builder.WriteString(string(runes))
	}
	return builder.String()
}

// HashAccountPassword is for account passwords, not MFA backup codes. The
// temporary bcrypt mode permits rolling out dual-format readers to all nodes
// before enabling Argon2id writes. Existing hashes are never rewritten in bulk.
func HashAccountPassword(password string) (string, error) {
	if err := ValidateNewAccountPassword(password); err != nil {
		return "", err
	}
	switch os.Getenv("ACCOUNT_PASSWORD_HASH_ALGORITHM") {
	case "bcrypt":
		if len(password) > 72 {
			return "", ErrPasswordLegacyLimit
		}
		return Password2Hash(password)
	case "", "argon2id":
	default:
		return "", errors.New("Unsupported account password hashing configuration.")
	}
	salt := make([]byte, accountPasswordSaltBytes)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("generate account password salt: %w", err)
	}
	key := argon2.IDKey([]byte(password), salt, accountPasswordTime, accountPasswordMemory, 1, accountPasswordKeyBytes)
	return fmt.Sprintf("$argon2id$v=19$m=19456,t=2,p=1$%s$%s", base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(key)), nil
}

func validateArgon2AccountPassword(password, encoded string) bool {
	// Bound both plaintext and parameters before invoking a memory-hard KDF.
	// Only the version/parameters emitted by this application are accepted.
	if len(password) > MaxAccountPasswordLength*utf8.UTFMax || len(encoded) > 256 {
		return false
	}
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[0] != "" || parts[1] != "argon2id" || parts[2] != "v=19" || parts[3] != "m=19456,t=2,p=1" {
		return false
	}
	salt, err := base64.RawStdEncoding.Strict().DecodeString(parts[4])
	if err != nil || len(salt) != accountPasswordSaltBytes {
		return false
	}
	expected, err := base64.RawStdEncoding.Strict().DecodeString(parts[5])
	if err != nil || len(expected) != accountPasswordKeyBytes {
		return false
	}
	actual := argon2.IDKey([]byte(password), salt, accountPasswordTime, accountPasswordMemory, 1, accountPasswordKeyBytes)
	return subtle.ConstantTimeCompare(actual, expected) == 1
}
