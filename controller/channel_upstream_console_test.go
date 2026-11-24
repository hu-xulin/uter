package controller

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

func initConsoleTestSecrets(t *testing.T) {
	t.Helper()
	original := common.CryptoSecret
	common.CryptoSecret = "test-crypto-secret-for-console-envelope"
	t.Cleanup(func() { common.CryptoSecret = original })
}

func settingsWithConsole(t *testing.T, console map[string]any) string {
	t.Helper()
	data, err := json.Marshal(map[string]any{"upstream_console": console, "proxy": "keep-me"})
	require.NoError(t, err)
	return string(data)
}

func TestNormalizeUpstreamConsoleOnSaveEncryptsPassword(t *testing.T) {
	initConsoleTestSecrets(t)
	channel := &model.Channel{
		OtherSettings: settingsWithConsole(t, map[string]any{
			"login_url": "https://console.example.com",
			"username":  "admin",
			"password":  "super-secret",
		}),
	}

	err := normalizeUpstreamConsoleOnSave(channel, nil)
	require.NoError(t, err)

	var settings map[string]any
	require.NoError(t, json.Unmarshal([]byte(channel.OtherSettings), &settings))
	require.Equal(t, "keep-me", settings["proxy"], "unrelated settings must be preserved")
	console := settings["upstream_console"].(map[string]any)
	require.Equal(t, "https://console.example.com", console["login_url"])
	require.Equal(t, "admin", console["username"])
	require.NotContains(t, console, "password", "plaintext password must never be persisted")
	require.NotEmpty(t, console["password_encrypted"])

	// Stored value is an encrypted envelope that decrypts back to the password.
	plain, err := common.DecryptSecret(console["password_encrypted"].(string))
	require.NoError(t, err)
	require.Equal(t, "super-secret", plain)
}

func TestNormalizeUpstreamConsoleOnSavePreservesPasswordWhenBlank(t *testing.T) {
	initConsoleTestSecrets(t)
	origin := &model.Channel{
		OtherSettings: settingsWithConsole(t, map[string]any{
			"login_url": "https://console.example.com",
			"username":  "admin",
			"password":  "original-secret",
		}),
	}
	require.NoError(t, normalizeUpstreamConsoleOnSave(origin, nil))
	storedEnvelope := consoleFromSettingsString(origin.OtherSettings).PasswordEncrypted
	require.NotEmpty(t, storedEnvelope)

	// Editing without a new password: blank password keeps the stored envelope.
	edited := &model.Channel{
		OtherSettings: settingsWithConsole(t, map[string]any{
			"login_url": "https://console.example.com",
			"username":  "admin",
			"password":  "",
		}),
	}
	require.NoError(t, normalizeUpstreamConsoleOnSave(edited, origin))
	require.Equal(t, storedEnvelope, consoleFromSettingsString(edited.OtherSettings).PasswordEncrypted)
}

func TestRedactUpstreamConsoleRemovesSecrets(t *testing.T) {
	console := map[string]any{
		"login_url":          "https://console.example.com",
		"username":           "admin",
		"password":           "plain",
		"password_encrypted": "envelope",
	}
	channel := &model.Channel{OtherSettings: settingsWithConsole(t, console)}

	redactUpstreamConsole(channel)

	var settings map[string]any
	require.NoError(t, json.Unmarshal([]byte(channel.OtherSettings), &settings))
	require.Equal(t, "keep-me", settings["proxy"])
	out := settings["upstream_console"].(map[string]any)
	require.Equal(t, "https://console.example.com", out["login_url"])
	require.Equal(t, "admin", out["username"])
	require.NotContains(t, out, "password")
	require.NotContains(t, out, "password_encrypted")
	require.Equal(t, true, out["has_password"], "redaction must report the real stored-password state")
}

func TestRedactUpstreamConsoleReportsNoPasswordHonestly(t *testing.T) {
	channel := &model.Channel{OtherSettings: settingsWithConsole(t, map[string]any{
		"login_url": "https://console.example.com",
		"username":  "admin",
	})}

	redactUpstreamConsole(channel)

	var settings map[string]any
	require.NoError(t, json.Unmarshal([]byte(channel.OtherSettings), &settings))
	out := settings["upstream_console"].(map[string]any)
	require.NotContains(t, out, "password_encrypted")
	require.Equal(t, false, out["has_password"])
}

func TestRedactUpstreamConsoleNoOpWithoutBlock(t *testing.T) {
	channel := &model.Channel{OtherSettings: `{"proxy":"keep-me"}`}
	before := channel.OtherSettings
	redactUpstreamConsole(channel)
	require.Equal(t, before, channel.OtherSettings)
}

func TestConsoleHasLogin(t *testing.T) {
	require.False(t, (*upstreamConsoleEnvelope)(nil).HasLogin())
	require.False(t, (&upstreamConsoleEnvelope{LoginURL: "https://x", Username: "u"}).HasLogin())
	require.True(t, (&upstreamConsoleEnvelope{
		LoginURL: "https://x", Username: "u", PasswordEncrypted: "env",
	}).HasLogin())
}
