package controller

import (
	"encoding/json"
	"errors"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
)

// This file wires the SECONDARY console-login discovery path into channels.
// The console credentials are stored inside channel.settings as an
// upstream_console object. Only an ENCRYPTED password envelope is persisted;
// the plaintext input field is never written to the database or returned.

const upstreamConsoleKey = "upstream_console"

type upstreamConsoleEnvelope struct {
	LoginURL          string `json:"login_url,omitempty"`
	Username          string `json:"username,omitempty"`
	Password          string `json:"password,omitempty"`           // transient input only
	PasswordEncrypted string `json:"password_encrypted,omitempty"` // persisted
}

// normalizeUpstreamConsoleOnSave converts a plaintext console password into an
// encrypted envelope and preserves the stored password when the edit form
// leaves the password box empty ("leave empty to keep existing").
//
// origin may be nil (create flow), in which case there is nothing to preserve.
func normalizeUpstreamConsoleOnSave(channel *model.Channel, origin *model.Channel) error {
	if channel == nil {
		return nil
	}
	settings := parseSettingsMap(channel.OtherSettings)
	raw, exists := settings[upstreamConsoleKey]
	if !exists || raw == nil {
		// No console block in this payload. On an update, keep the origin's.
		if origin != nil {
			preserveConsoleFromOrigin(settings, origin.OtherSettings)
			channel.OtherSettings = marshalSettingsMap(settings)
		}
		return nil
	}

	var console upstreamConsoleEnvelope
	switch typed := raw.(type) {
	case map[string]any:
		console.LoginURL = stringValue(typed["login_url"])
		console.Username = stringValue(typed["username"])
		console.Password = stringValue(typed["password"])
		console.PasswordEncrypted = stringValue(typed["password_encrypted"])
	case string:
		if typed == "" {
			delete(settings, upstreamConsoleKey)
			channel.OtherSettings = marshalSettingsMap(settings)
			return nil
		}
		if err := json.Unmarshal([]byte(typed), &console); err != nil {
			return errors.New("invalid upstream console settings")
		}
	default:
		return errors.New("invalid upstream console settings")
	}

	// A blank password on edit means "keep the stored one".
	if strings.TrimSpace(console.Password) == "" {
		if origin != nil {
			existing := consoleFromSettingsString(origin.OtherSettings)
			console.PasswordEncrypted = existing.PasswordEncrypted
		}
	} else {
		encrypted, err := common.EncryptSecret(console.Password)
		if err != nil {
			return errors.New("failed to secure console password")
		}
		console.PasswordEncrypted = encrypted
	}
	// Plaintext is never persisted.
	console.Password = ""

	// Drop an entirely empty block so unchanged channels keep equivalent JSON.
	if strings.TrimSpace(console.LoginURL) == "" && strings.TrimSpace(console.Username) == "" && console.PasswordEncrypted == "" {
		delete(settings, upstreamConsoleKey)
	} else {
		settings[upstreamConsoleKey] = console
	}
	channel.OtherSettings = marshalSettingsMap(settings)
	return nil
}

// redactUpstreamConsole clears all console secret material before a channel is
// serialized to any client. Called from clearChannelInfo, the single response
// sanitizer used by list/detail handlers.
func redactUpstreamConsole(channel *model.Channel) {
	if channel == nil || strings.TrimSpace(channel.OtherSettings) == "" {
		return
	}
	settings := parseSettingsMap(channel.OtherSettings)
	raw, exists := settings[upstreamConsoleKey]
	if !exists || raw == nil {
		return
	}
	var console map[string]any
	switch typed := raw.(type) {
	case map[string]any:
		console = typed
	case string:
		if err := json.Unmarshal([]byte(typed), &console); err != nil {
			return
		}
	default:
		return
	}
	// Report the real state before removing secret material so clients can show
	// "stored password" without ever receiving the password itself.
	hasPassword := strings.TrimSpace(stringValue(console["password"])) != "" ||
		strings.TrimSpace(stringValue(console["password_encrypted"])) != ""
	delete(console, "password")
	delete(console, "password_encrypted")
	console["has_password"] = hasPassword
	settings[upstreamConsoleKey] = console
	channel.OtherSettings = marshalSettingsMap(settings)
}

// FetchChannelUpstreamCatalog logs into the upstream console (secondary path)
// and returns the discovered models/prices for cross-checking with the primary
// API Key + base_url path. It is read-only and never changes channel pricing.
// GET /api/channel/:id/upstream_console/catalog
func FetchChannelUpstreamCatalog(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	channel, err := model.GetChannelById(id, false)
	if err != nil || channel == nil {
		common.ApiErrorT(c, "Channel not found")
		return
	}

	console := consoleFromSettingsString(channel.OtherSettings)
	if !console.HasLogin() {
		// Not configured: return a clean fallback result, not an error.
		common.ApiSuccess(c, gin.H{
			"status":           service.ConsoleStatusNotConfigured,
			"login_succeeded":  false,
			"models":           []string{},
			"prices":           []service.UpstreamConsolePrice{},
			"fallback_primary": true,
		})
		return
	}

	password, err := common.DecryptSecret(console.PasswordEncrypted)
	if err != nil {
		// A rotated/invalid key must fail closed to the primary path.
		common.ApiSuccess(c, gin.H{
			"status":           service.ConsoleStatusLoginFailed,
			"login_succeeded":  false,
			"models":           []string{},
			"prices":           []service.UpstreamConsolePrice{},
			"fallback_primary": true,
		})
		return
	}

	result, fetchErr := service.FetchUpstreamConsoleCatalog(
		c.Request.Context(), console.LoginURL, console.Username, password)
	if fetchErr != nil && result.Status == service.ConsoleStatusNotConfigured {
		result.Status = service.ConsoleStatusLoginFailed
	}
	result.FallbackPrimary = result.Status != service.ConsoleStatusSuccess
	common.ApiSuccess(c, result)
}

// HasLogin mirrors dto.UpstreamConsoleCredentials.HasLogin without importing
// relaykit here, keeping this controller's dependencies small.
func (c *upstreamConsoleEnvelope) HasLogin() bool {
	return c != nil && strings.TrimSpace(c.LoginURL) != "" &&
		strings.TrimSpace(c.Username) != "" && strings.TrimSpace(c.PasswordEncrypted) != ""
}

func consoleFromSettingsString(raw string) *upstreamConsoleEnvelope {
	settings := parseSettingsMap(raw)
	value, exists := settings[upstreamConsoleKey]
	if !exists || value == nil {
		return nil
	}
	var console upstreamConsoleEnvelope
	switch typed := value.(type) {
	case map[string]any:
		console.LoginURL = stringValue(typed["login_url"])
		console.Username = stringValue(typed["username"])
		console.PasswordEncrypted = stringValue(typed["password_encrypted"])
	case string:
		if err := json.Unmarshal([]byte(typed), &console); err != nil {
			return nil
		}
	default:
		return nil
	}
	return &console
}

func preserveConsoleFromOrigin(settings map[string]any, originRaw string) {
	existing := consoleFromSettingsString(originRaw)
	if existing == nil || !existing.HasLogin() {
		return
	}
	settings[upstreamConsoleKey] = map[string]any{
		"login_url":          existing.LoginURL,
		"username":           existing.Username,
		"password_encrypted": existing.PasswordEncrypted,
		"has_password":       true,
	}
}

func parseSettingsMap(raw string) map[string]any {
	settings := map[string]any{}
	if strings.TrimSpace(raw) == "" {
		return settings
	}
	if err := json.Unmarshal([]byte(raw), &settings); err != nil || settings == nil {
		return map[string]any{}
	}
	return settings
}

func marshalSettingsMap(settings map[string]any) string {
	data, err := json.Marshal(settings)
	if err != nil {
		return "{}"
	}
	return string(data)
}

func stringValue(value any) string {
	if str, ok := value.(string); ok {
		return str
	}
	return ""
}
