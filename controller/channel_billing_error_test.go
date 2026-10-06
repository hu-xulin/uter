package controller

import (
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// A bare "status code: 404" gave the reader nothing to act on. These tests pin
// the two things that matter: the message says *which* request failed, and it
// never leaks the channel key that an advanced-custom route may have put in the
// query string.
func TestAdvancedCustomBalanceStatusErrorNamesTheRequest(t *testing.T) {
	tests := []struct {
		name       string
		status     int
		wantSubstr []string
	}{
		{
			name:       "404 means the provider has no such endpoint",
			status:     http.StatusNotFound,
			wantSubstr: []string{"404", "credit_grants", "does not expose that endpoint"},
		},
		{
			name:       "405 is treated the same as 404",
			status:     http.StatusMethodNotAllowed,
			wantSubstr: []string{"405", "does not expose that endpoint"},
		},
		{
			name:       "401 points at the key rather than the path",
			status:     http.StatusUnauthorized,
			wantSubstr: []string{"401", "key was rejected"},
		},
		{
			name:       "403 points at the key too",
			status:     http.StatusForbidden,
			wantSubstr: []string{"403", "key was rejected"},
		},
		{
			name:       "other statuses stay generic but keep the URL",
			status:     http.StatusBadGateway,
			wantSubstr: []string{"502", "credit_grants"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp := &http.Response{StatusCode: tc.status}
			requestURL := "https://api.example.com/v1/dashboard/billing/credit_grants"

			err := advancedCustomBalanceStatusError(resp, requestURL)
			require.Error(t, err)

			for _, want := range tc.wantSubstr {
				assert.Contains(t, err.Error(), want)
			}
		})
	}
}

// The channel key can be carried in a non-standard query parameter. The message
// goes straight back to the browser, so nothing secret may survive in it.
func TestAdvancedCustomBalanceStatusErrorRedactsSecretsInURL(t *testing.T) {
	resp := &http.Response{StatusCode: http.StatusNotFound}
	requestURL := "https://api.example.com/v1/dashboard/billing/credit_grants?api_key=sk-super-secret&token=sk-other"

	err := advancedCustomBalanceStatusError(resp, requestURL)
	require.Error(t, err)

	assert.NotContains(t, err.Error(), "sk-super-secret")
	assert.NotContains(t, err.Error(), "sk-other")
	assert.NotContains(t, err.Error(), "api_key")
	// The path itself is safe and stays, so the reader still knows what was called.
	assert.Contains(t, err.Error(), "/v1/dashboard/billing/credit_grants")
}

// Userinfo credentials are stripped for the same reason.
func TestAdvancedCustomBalanceStatusErrorStripsUserinfo(t *testing.T) {
	resp := &http.Response{StatusCode: http.StatusUnauthorized}
	parsed, err := url.Parse("https://user:sk-pass@api.example.com/v1/dashboard/billing/credit_grants")
	require.NoError(t, err)

	msg := advancedCustomBalanceStatusError(resp, parsed.String()).Error()

	assert.NotContains(t, msg, "sk-pass")
	assert.NotContains(t, msg, "user:")
	assert.Contains(t, msg, "api.example.com")
}

// The original symptom was the literal string "status code: 404"; make sure
// that phrasing is gone for good so it can't regress.
func TestAdvancedCustomBalanceStatusErrorDropsBareStatusPhrase(t *testing.T) {
	for _, status := range []int{http.StatusNotFound, http.StatusUnauthorized, http.StatusBadGateway} {
		err := advancedCustomBalanceStatusError(
			&http.Response{StatusCode: status},
			"https://api.example.com/v1/dashboard/billing/credit_grants",
		)
		require.Error(t, err)
		assert.False(t, strings.HasPrefix(err.Error(), "status code:"),
			"bare %q prefix regressed for status %d", "status code:", status)
	}
}
