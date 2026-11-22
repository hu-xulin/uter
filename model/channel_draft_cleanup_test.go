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

func TestPreserveDraftSettingKeepsDraftOnUpdate(t *testing.T) {
	origin := Channel{OtherSettings: `{"draft":true}`}
	updated := Channel{OtherSettings: `{"vertex_key_type":"api_key"}`}
	updated.PreserveDraftSetting(&origin, true)
	if !updated.GetOtherSettings().Draft {
		t.Fatal("draft marker was cleared by an ordinary settings update")
	}
	if updated.GetOtherSettings().VertexKeyType != "api_key" {
		t.Fatal("the update's own settings were lost")
	}
}

func TestPreserveDraftSettingIgnoresPublishedChannels(t *testing.T) {
	origin := Channel{OtherSettings: `{}`}
	updated := Channel{OtherSettings: `{"vertex_key_type":"api_key"}`}
	updated.PreserveDraftSetting(&origin, true)
	if updated.GetOtherSettings().Draft {
		t.Fatal("a published channel must not be marked as a draft")
	}
}

func TestPreserveDraftSettingLeavesOmittedSettingsAlone(t *testing.T) {
	origin := Channel{OtherSettings: `{"draft":true}`}
	updated := Channel{}
	updated.PreserveDraftSetting(&origin, false)
	if updated.OtherSettings != "" {
		t.Fatalf("omitted settings must stay untouched, got %q", updated.OtherSettings)
	}
}

func TestIsExpiredDraftChannel(t *testing.T) {
	const cutoff = int64(1_000_000)
	cases := []struct {
		name    string
		channel Channel
		want    bool
	}{
		{
			name:    "old draft",
			channel: Channel{Status: 0, CreatedTime: cutoff - 1, OtherSettings: `{"draft":true}`},
			want:    true,
		},
		{
			name:    "fresh draft",
			channel: Channel{Status: 0, CreatedTime: cutoff + 1, OtherSettings: `{"draft":true}`},
			want:    false,
		},
		{
			name:    "ordinary disabled channel",
			channel: Channel{Status: 0, CreatedTime: cutoff - 1, OtherSettings: `{}`},
			want:    false,
		},
		{
			name:    "enabled draft flag",
			channel: Channel{Status: 1, CreatedTime: cutoff - 1, OtherSettings: `{"draft":true}`},
			want:    false,
		},
		{
			name:    "missing creation time",
			channel: Channel{Status: 0, OtherSettings: `{"draft":true}`},
			want:    false,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := IsExpiredDraftChannel(tc.channel, cutoff); got != tc.want {
				t.Fatalf("IsExpiredDraftChannel() = %v, want %v", got, tc.want)
			}
		})
	}
}
