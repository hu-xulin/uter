/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not see <https://www.gnu.org/licenses/>.
*/
package passkey

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Uter-AI/Uter/setting/system_setting"
)

func newLoopbackRequest(t *testing.T) *http.Request {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "http://localhost:3000/", nil)
	return req
}

func TestIsLoopbackOrigin(t *testing.T) {
	cases := map[string]bool{
		"http://localhost":      true,
		"http://localhost:3000": true,
		"https://localhost":     true,
		"http://127.0.0.1":      true,
		"http://127.0.0.1:8080": true,
		"https://example.com":   false,
		"http://example.com":    false,
		"http://192.168.1.10":   false,
		"not-a-url":             false,
	}
	for origin, want := range cases {
		if got := isLoopbackOrigin(origin); got != want {
			t.Errorf("isLoopbackOrigin(%q) = %v, want %v", origin, got, want)
		}
	}
}

func TestResolveOriginsLoopbackAllowedWithoutInsecureFlag(t *testing.T) {
	req := newLoopbackRequest(t)
	settings := &system_setting.PasskeySettings{
		Origins:             "http://localhost:3000",
		AllowInsecureOrigin: false,
	}
	origins, err := resolveOrigins(req, settings)
	if err != nil {
		t.Fatalf("expected loopback origin to be allowed, got error: %v", err)
	}
	if len(origins) != 1 || origins[0] != "http://localhost:3000" {
		t.Fatalf("unexpected origins: %#v", origins)
	}
}

func TestResolveOriginsNonLoopbackRejectedWithoutInsecureFlag(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "http://localhost:3000/", nil)
	settings := &system_setting.PasskeySettings{
		Origins:             "http://example.com",
		AllowInsecureOrigin: false,
	}
	if _, err := resolveOrigins(req, settings); err == nil {
		t.Fatal("expected non-loopback http origin to be rejected when AllowInsecureOrigin is false")
	}
}

func TestResolveOriginsNonLoopbackAllowedWithInsecureFlag(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "http://localhost:3000/", nil)
	settings := &system_setting.PasskeySettings{
		Origins:             "http://example.com",
		AllowInsecureOrigin: true,
	}
	if _, err := resolveOrigins(req, settings); err != nil {
		t.Fatalf("expected non-loopback http origin to be allowed when AllowInsecureOrigin is true, got: %v", err)
	}
}

func TestResolveOriginsAutoDetectLoopbackAllowed(t *testing.T) {
	req := newLoopbackRequest(t)
	settings := &system_setting.PasskeySettings{AllowInsecureOrigin: false}
	origins, err := resolveOrigins(req, settings)
	if err != nil {
		t.Fatalf("expected auto-detected loopback origin to be allowed, got error: %v", err)
	}
	if len(origins) != 1 || origins[0] != "http://localhost:3000" {
		t.Fatalf("unexpected origins: %#v", origins)
	}
}
