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

// 特殊渠道名 groq-gpt-oss-120b / sf-qwen3-8b 必须按「模型家族」归因：
// gpt-oss → OpenAI，qwen3 → Alibaba。groq / sf 是路由前缀，不改变家族。
// 关键词位于名称最前 / 中间 / 最后都要能识别。
func TestSpecialModelNamesFamilyAttributionAllPositions(t *testing.T) {
	cases := []struct {
		name string
		want string
	}{
		// OpenAI / gpt-oss 家族
		{"gpt-oss-120b", "OpenAI"},
		{"groq-gpt-oss-120b", "OpenAI"},
		{"router-gpt-oss-120b", "OpenAI"},
		{"gpt-oss-120b-groq", "OpenAI"},
		// Alibaba / qwen3 家族
		{"qwen3-8b", "Alibaba"},
		{"sf-qwen3-8b", "Alibaba"},
		{"router-qwen3-8b", "Alibaba"},
		{"qwen3-8b-sf", "Alibaba"},
	}
	for _, c := range cases {
		if got := defaultVendorNameForModel(c.name); got != c.want {
			t.Errorf("defaultVendorNameForModel(%q) = %q, want %q", c.name, got, c.want)
		}
	}
}

// 家族关键词必须显式登记，不能只靠 gpt- / qwen 宽泛词碰巧命中。
func TestSpecialModelFamilyKeywordsRegistered(t *testing.T) {
	if got := defaultVendorRules["gpt-oss"]; got != "OpenAI" {
		t.Errorf("defaultVendorRules[gpt-oss] = %q, want OpenAI", got)
	}
	if got := defaultVendorRules["qwen3"]; got != "Alibaba" {
		t.Errorf("defaultVendorRules[qwen3] = %q, want Alibaba", got)
	}
}

// 路由前缀 groq / sf 不应改变家族归属。
func TestRoutingPrefixesDoNotChangeFamily(t *testing.T) {
	if a, b := defaultVendorNameForModel("groq-gpt-oss-120b"), defaultVendorNameForModel("gpt-oss-120b"); a != b {
		t.Errorf("groq 前缀改变归因: %q vs %q", a, b)
	}
	if a, b := defaultVendorNameForModel("sf-qwen3-8b"), defaultVendorNameForModel("qwen3-8b"); a != b {
		t.Errorf("sf 前缀改变归因: %q vs %q", a, b)
	}
}
