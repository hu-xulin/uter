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
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
package model

import "testing"

// Vendor icons default to the monochrome (non ".Color") variant so they follow
// currentColor and stay legible on both themes.
func TestNormalizeIconKeyStripsColorVariant(t *testing.T) {
	cases := map[string]string{
		"Claude.Color":                    "Claude",
		"Gemini.Color":                    "Gemini",
		"  Qwen.Color ":                   "Qwen",
		"OpenAI":                          "OpenAI",
		"":                                "",
		"   ":                             "",
		"Claude.Avatar.type={'platform'}": "Claude.Avatar.type={'platform'}",
		"Claude.Color.Avatar":             "Claude.Color.Avatar",
	}
	for in, want := range cases {
		if got := NormalizeIconKey(in); got != want {
			t.Errorf("NormalizeIconKey(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestDefaultVendorIconsAreMonochrome(t *testing.T) {
	for name, icon := range defaultVendorIcons {
		if icon == "" {
			t.Errorf("vendor %q has an empty default icon", name)
			continue
		}
		if got := NormalizeIconKey(icon); got != icon {
			t.Errorf("vendor %q default icon %q is not monochrome (normalizes to %q)", name, icon, got)
		}
	}
	if got := getDefaultVendorIcon("字节跳动"); got != "Doubao" {
		t.Errorf(`getDefaultVendorIcon("字节跳动") = %q, want "Doubao"`, got)
	}
}
