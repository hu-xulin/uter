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

package costopt

import (
	"strings"
	"testing"
)

// TestNormalizeBaseURLStripsVersionSegment 锁定 base 归一化规则。
//
// 背景：管理员按上游文档填「带版本段」的 base（如
// https://api.siliconflow.cn/v1），后端再拼 "/v1/embeddings"。
// 若归一化不到位，就会请求 /v1/v1/embeddings 而 404/401。
func TestNormalizeBaseURLStripsVersionSegment(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"plain host", "https://api.siliconflow.cn", "https://api.siliconflow.cn"},
		{
			"trailing v1 is stripped",
			"https://api.siliconflow.cn/v1",
			"https://api.siliconflow.cn",
		},
		{
			"trailing slash then v1",
			"https://api.siliconflow.cn/v1/",
			"https://api.siliconflow.cn",
		},
		{
			"uppercase V1 treated as version segment",
			"https://api.siliconflow.cn/V1",
			"https://api.siliconflow.cn",
		},
		{
			"repeated version segments are all stripped",
			"https://api.siliconflow.cn/v1/v1",
			"https://api.siliconflow.cn",
		},
		{"v2 is stripped", "https://example.com/v2", "https://example.com"},
		{
			"business path segment is preserved",
			"https://api.groq.com/openai/v1beta",
			"https://api.groq.com/openai/v1beta",
		},
		{
			"non-numeric segment is preserved",
			"https://example.com/vision",
			"https://example.com/vision",
		},
		{"whitespace trimmed", "  https://example.com/v1  ", "https://example.com"},
		{"empty stays empty", "", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := normalizeBaseURL(tc.in); got != tc.want {
				t.Fatalf("normalizeBaseURL(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

// TestJoinBaseWithPathNeverDuplicatesVersionSegment 验证最终请求 URL
// 不会出现重复的 /v1/v1。这是本次改动的核心回归点。
func TestJoinBaseWithPathNeverDuplicatesVersionSegment(t *testing.T) {
	paths := []string{
		"/v1/embeddings",
		"/v1/chat/completions",
		"/v1/files",
		"/v1/batches",
		"/v1/batches/{id}",
	}
	bases := []string{
		"https://api.siliconflow.cn",
		"https://api.siliconflow.cn/v1",
		"https://api.siliconflow.cn/v1/",
		" https://api.siliconflow.cn/v1 ",
	}
	for _, base := range bases {
		for _, path := range paths {
			got := normalizeBaseURL(base) + path
			if strings.Contains(got, "/v1/v1") {
				t.Errorf("base=%q path=%q produced duplicated version segment: %s",
					base, path, got)
			}
			if !strings.HasSuffix(got, path) {
				t.Errorf("base=%q path=%q lost path suffix: %s", base, path, got)
			}
		}
	}
}

// TestNormalizeBaseURLKeepsSiliconFlowShape 固定目标供应商的最终地址形态。
func TestNormalizeBaseURLKeepsSiliconFlowShape(t *testing.T) {
	got := normalizeBaseURL("https://api.siliconflow.cn/v1") + "/v1/embeddings"
	const want = "https://api.siliconflow.cn/v1/embeddings"
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}
