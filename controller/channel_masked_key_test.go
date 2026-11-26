package controller

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMaskedChannelKey(t *testing.T) {
	t.Run("empty key stays empty", func(t *testing.T) {
		assert.Equal(t, "", maskedChannelKey(""))
	})

	t.Run("single key is redacted with head and tail kept", func(t *testing.T) {
		masked := maskedChannelKey("sk-abcdefghijklmnopqrstuvwxyz")
		assert.Equal(t, "sk-a************wxyz", masked)
		assert.NotContains(t, masked, "abcdefghijklmnopqrstuvwxyz")
	})

	t.Run("short key follows the shared mask rule", func(t *testing.T) {
		// MaskSecretValue keeps the 4-char prefix when 4 < len <= 8.
		assert.Equal(t, "****", maskedChannelKey("abcd"))
		assert.Equal(t, "abcd*", maskedChannelKey("abcde"))
	})

	t.Run("multi-key channel redacts each line independently", func(t *testing.T) {
		masked := maskedChannelKey("sk-aaaa1111\n\n  sk-bbbb2222  \nsk-cccc3333")
		lines := strings.Split(masked, "\n")
		require.Len(t, lines, 3)
		assert.Equal(t, "sk-a***1111", lines[0])
		assert.Equal(t, "sk-b***2222", lines[1])
		assert.Equal(t, "sk-c***3333", lines[2])
		assert.NotContains(t, masked, "aaaa1111")
		assert.NotContains(t, masked, "bbbb2222")
		assert.NotContains(t, masked, "cccc3333")
	})

	t.Run("masked value never contains a verbatim long plaintext", func(t *testing.T) {
		secret := "sk-" + strings.Repeat("X", 40) + "tail"
		masked := maskedChannelKey(secret)
		assert.NotContains(t, masked, secret)
		assert.True(t, strings.HasPrefix(masked, "sk-"))
		assert.True(t, strings.HasSuffix(masked, "tail"))
	})
}
