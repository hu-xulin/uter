package common

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGenerateNumericCodeOnlyEmitsDigits(t *testing.T) {
	for attempt := 0; attempt < 200; attempt++ {
		code, err := GenerateNumericCode(6)
		require.NoError(t, err)
		require.Len(t, code, 6, "code must never be shorter than the requested length")
		for _, r := range code {
			require.True(t, r >= '0' && r <= '9', "unexpected non-digit %q in %q", r, code)
		}
	}
}

func TestGenerateNumericCodeVariesBetweenCalls(t *testing.T) {
	const draws = 64
	seen := make(map[string]struct{}, draws)
	for attempt := 0; attempt < draws; attempt++ {
		code, err := GenerateNumericCode(6)
		require.NoError(t, err)
		seen[code] = struct{}{}
	}
	// Birthday collisions over 64 draws from 1e6 are vanishingly unlikely, so a
	// small spread proves the generator is actually random rather than static.
	require.Greater(t, len(seen), draws-2, "numeric codes look suspiciously repetitive")
}

func TestGenerateNumericCodeRejectsInvalidLength(t *testing.T) {
	code, err := GenerateNumericCode(0)
	require.Error(t, err)
	require.Empty(t, code, "a failed draw must never fall back to a blank code")

	code, err = GenerateNumericCode(-1)
	require.Error(t, err)
	require.Empty(t, code)
}

func TestGenerateNumericCodeSupportsRequestedLength(t *testing.T) {
	code, err := GenerateNumericCode(1)
	require.NoError(t, err)
	require.Len(t, code, 1)

	// Lengths beyond int64 do not panic; they are simply not used today.
	code, err = GenerateNumericCode(20)
	require.NoError(t, err)
	require.Len(t, code, 20)
}

// GenerateVerificationCode intentionally keeps its UUID-derived alphabet for
// non-user-facing values: password-reset tokens must stay unguessable way past
// six hex characters, and "length == 0" must still return the whole UUID.
func TestGenerateVerificationCodeRemainsOpaque(t *testing.T) {
	full := GenerateVerificationCode(0)
	require.Len(t, full, 32)
	require.NotContains(t, full, "-")
	require.NotEqual(t, full, GenerateVerificationCode(0), "tokens must not repeat")

	six := GenerateVerificationCode(6)
	require.Len(t, six, 6)
	require.True(t, strings.ContainsAny(six, "0123456789abcdef"))
}
