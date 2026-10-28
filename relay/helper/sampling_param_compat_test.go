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

package helper

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// 用例里的模型名与期望值，全部来自 2026-10-28 对上游（渠道 #20）的逐个实测：
// 带 top_p / temperature 各发一次 1-token 请求，400 的记为「不接受」。
func TestResolveSamplingParamCompat(t *testing.T) {
	tests := []struct {
		model string
		want  SamplingParamCompat
	}{
		// ── 只拒绝 top_p（Claude 5 代）──
		{model: "claude-fable-5", want: SamplingParamCompat{DropTopP: true}},
		{model: "claude-fable-5-1", want: SamplingParamCompat{DropTopP: true}},
		{model: "claude-opus-4-7", want: SamplingParamCompat{DropTopP: true}},
		{model: "claude-opus-4-8", want: SamplingParamCompat{DropTopP: true}},
		{model: "claude-sonnet-5", want: SamplingParamCompat{DropTopP: true}},
		{model: "claude-sonnet-5-5", want: SamplingParamCompat{DropTopP: true}},
		{model: "claude-haiku-5-5", want: SamplingParamCompat{DropTopP: true}},

		// ── top_p 与 temperature 都拒绝 ──
		{model: "claude-opus-5", want: SamplingParamCompat{DropTopP: true, DropTemperature: true}},
		{model: "claude-opus-5-5", want: SamplingParamCompat{DropTopP: true, DropTemperature: true}},
		{model: "gpt-5.5", want: SamplingParamCompat{DropTopP: true, DropTemperature: true}},
		{model: "gpt-5.6-luna", want: SamplingParamCompat{DropTopP: true, DropTemperature: true}},
		{model: "gpt-5.6-sol", want: SamplingParamCompat{DropTopP: true, DropTemperature: true}},
		{model: "gpt-5.6-terra", want: SamplingParamCompat{DropTopP: true, DropTemperature: true}},

		// ── 实测接受两个参数的模型，不能被误伤 ──
		{model: "claude-opus-4-5", want: SamplingParamCompat{}},
		{model: "claude-opus-4-5-20251101", want: SamplingParamCompat{}},
		{model: "claude-opus-4-6", want: SamplingParamCompat{}},
		{model: "claude-sonnet-4-6", want: SamplingParamCompat{}},
		{model: "claude-haiku-4-5-20251001", want: SamplingParamCompat{}},
		{model: "gpt-6-astra", want: SamplingParamCompat{}},
		{model: "gpt-6.1-sol", want: SamplingParamCompat{}},
		{model: "gemini-3.5-flash", want: SamplingParamCompat{}},
		{model: "gemini-2.5-pro", want: SamplingParamCompat{}},
		{model: "kimi-k2.5", want: SamplingParamCompat{}},
		{model: "deepseek-v4-pro", want: SamplingParamCompat{}},
		{model: "MiniMax-M2.5", want: SamplingParamCompat{}},

		// ── 边界 ──
		{model: "", want: SamplingParamCompat{}},
		{model: "   ", want: SamplingParamCompat{}},
		{model: "  Claude-Opus-5  ", want: SamplingParamCompat{DropTopP: true, DropTemperature: true}},
	}

	for _, tt := range tests {
		t.Run(tt.model, func(t *testing.T) {
			assert.Equal(t, tt.want, ResolveSamplingParamCompat(tt.model))
		})
	}
}

// 前缀匹配的边界：上一代模型不能被下一代的前缀吃掉（gpt-5.6 的规则不能命中
// gpt-5 / gpt-5.4，claude-opus-5 的规则不能命中 claude-opus-4-5）。
func TestResolveSamplingParamCompatPrefixBoundary(t *testing.T) {
	assert.Equal(t, SamplingParamCompat{}, ResolveSamplingParamCompat("gpt-5"))
	assert.Equal(t, SamplingParamCompat{}, ResolveSamplingParamCompat("gpt-5.4"))
	assert.Equal(t, SamplingParamCompat{}, ResolveSamplingParamCompat("claude-opus-4-5-20251101"))
	assert.Equal(t, SamplingParamCompat{}, ResolveSamplingParamCompat("claude-sonnet-4-5-20250929"))
}

// ApplySamplingParamCompat 是真正被 relay 调用的入口：断言字段被置空（不再发给
// 上游），未被规则命中的模型原样保留。
func TestApplySamplingParamCompat(t *testing.T) {
	floatPtr := func(v float64) *float64 { return &v }

	t.Run("both dropped for claude-opus-5", func(t *testing.T) {
		topP, temperature := floatPtr(1), floatPtr(0.7)
		dropped := ApplySamplingParamCompat("claude-opus-5", &topP, &temperature)
		assert.Nil(t, topP)
		assert.Nil(t, temperature)
		assert.Equal(t, []string{"top_p", "temperature"}, dropped)
	})

	t.Run("only top_p dropped for claude-sonnet-5", func(t *testing.T) {
		topP, temperature := floatPtr(0.9), floatPtr(0.7)
		dropped := ApplySamplingParamCompat("claude-sonnet-5", &topP, &temperature)
		assert.Nil(t, topP)
		assert.NotNil(t, temperature)
		assert.InDelta(t, 0.7, *temperature, 1e-9)
		assert.Equal(t, []string{"top_p"}, dropped)
	})

	t.Run("untouched model keeps both", func(t *testing.T) {
		topP, temperature := floatPtr(0.9), floatPtr(0.7)
		dropped := ApplySamplingParamCompat("claude-opus-4-5", &topP, &temperature)
		assert.NotNil(t, topP)
		assert.NotNil(t, temperature)
		assert.Empty(t, dropped)
	})

	t.Run("already omitted params are not reported", func(t *testing.T) {
		var topP, temperature *float64
		dropped := ApplySamplingParamCompat("gpt-5.6-sol", &topP, &temperature)
		assert.Nil(t, topP)
		assert.Nil(t, temperature)
		assert.Empty(t, dropped)
	})

	t.Run("nil field addresses are tolerated", func(t *testing.T) {
		assert.NotPanics(t, func() {
			// 没有字段可置空时不报告剔除，但仍不能 panic。
			assert.Empty(t, ApplySamplingParamCompat("claude-opus-5", nil, nil))
		})
	})
}
