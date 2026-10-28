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

import "strings"

// 上游模型的采样参数兼容表。
//
// 背景：创梦（DreamRouter，渠道 #20）对一批新模型的采样参数做了硬校验，请求体里
// 只要带上就直接 400，且**三种报错文案各说各话**：
//
//	`top_p` is deprecated for this model.                              (Claude 5 代)
//	Unsupported parameter: 'top_p' is not supported with this model.    (gpt-5.5 / 5.6)
//	temperature must be omitted or set to the default value 1 for ...   (claude-opus-5)
//
// 站内调试台（/pg/chat/completions）默认就带 temperature=0.7 与 top_p=1，
// 于是这些模型在调试台里 100% 失败，客户侧 SDK 只要带上 top_p 也一样。
//
// 实测口径（2026-10-28）：用渠道 #20 的上游密钥对 51 个文本模型逐个发 1-token
// 请求，每个参数单独带一次（max_tokens=16，避开 gpt-5.x 的最小输出长度校验），
// 结论是：
//   - top_p：13 个模型拒绝，其余 38 个接受；
//   - temperature：claude-opus-5 / claude-opus-5-5 只接受 1（等价于省略），
//     gpt-5.5 / gpt-5.6-* 完全不接受；
//   - frequency_penalty / presence_penalty / seed：全部模型都接受，故不在此表。
//
// 处理方式与 OpenRouter / LiteLLM 一致：**转发前剔除上游不接受的参数**，而不是
// 把 400 抛给客户。语义上不会偷改客户意图——top_p=1 本就是「不做核采样」，
// 省略与 1 等价；temperature 被省略后上游按默认 1 处理，也正是上游唯一接受的值。
//
// ⚠️ 维护提醒：上游新增模型时这张表会过期，表现为「新模型又报 top_p 不支持」。
// 更新方法见上面的实测口径，改完同步更新 sampling_param_compat_test.go 的用例。
type SamplingParamCompat struct {
	DropTopP        bool
	DropTemperature bool
}

type samplingParamRule struct {
	ModelPrefix string
	Compat      SamplingParamCompat
}

// upstreamSamplingParamRules 按上游模型名前缀匹配。用前缀而不是全名，
// 是因为上游的版本尾巴会变（claude-opus-5 → claude-opus-5-5、
// gpt-5.6 → gpt-5.6-luna/sol/terra），同一代模型的能力是一致的。
//
// 前缀匹配会连带覆盖派生名（如 claude-opus-4-7-thinking）。这是有意为之：
// 派生名今天可能恰好落在另一条上游通道上「能用」，但能力判定按模型代际收敛，
// 避免同一代模型在重试换通道时行为突变。
var upstreamSamplingParamRules = []samplingParamRule{
	{ModelPrefix: "claude-fable-5", Compat: SamplingParamCompat{DropTopP: true}},
	{ModelPrefix: "claude-opus-4-7", Compat: SamplingParamCompat{DropTopP: true}},
	{ModelPrefix: "claude-opus-4-8", Compat: SamplingParamCompat{DropTopP: true}},
	{ModelPrefix: "claude-opus-5", Compat: SamplingParamCompat{DropTopP: true, DropTemperature: true}},
	{ModelPrefix: "claude-sonnet-5", Compat: SamplingParamCompat{DropTopP: true}},
	{ModelPrefix: "claude-haiku-5-5", Compat: SamplingParamCompat{DropTopP: true}},
	{ModelPrefix: "gpt-5.5", Compat: SamplingParamCompat{DropTopP: true, DropTemperature: true}},
	{ModelPrefix: "gpt-5.6", Compat: SamplingParamCompat{DropTopP: true, DropTemperature: true}},
}

// ResolveSamplingParamCompat 返回该上游模型需要剔除的采样参数。
//
// model 必须是**上游模型名**（经过 model_mapping / 推理后缀处理之后的
// request.Model），不是客户请求里写的名字——映射前后可能是两个不同代的模型。
func ResolveSamplingParamCompat(model string) SamplingParamCompat {
	name := strings.ToLower(strings.TrimSpace(model))
	if name == "" {
		return SamplingParamCompat{}
	}
	for _, rule := range upstreamSamplingParamRules {
		if strings.HasPrefix(name, rule.ModelPrefix) {
			return rule.Compat
		}
	}
	return SamplingParamCompat{}
}

// ApplySamplingParamCompat 按上游模型能力就地剔除会被 400 拒绝的采样参数。
//
// topP / temperature 传调用方字段的地址（**float64）：命中规则时把字段置为 nil，
// 即「这个参数不发给上游」。返回实际剔除的参数名，供调用方记录审计日志。
func ApplySamplingParamCompat(model string, topP, temperature **float64) []string {
	compat := ResolveSamplingParamCompat(model)
	if !compat.DropTopP && !compat.DropTemperature {
		return nil
	}
	dropped := make([]string, 0, 2)
	if compat.DropTopP && topP != nil && *topP != nil {
		*topP = nil
		dropped = append(dropped, "top_p")
	}
	if compat.DropTemperature && temperature != nil && *temperature != nil {
		*temperature = nil
		dropped = append(dropped, "temperature")
	}
	return dropped
}
