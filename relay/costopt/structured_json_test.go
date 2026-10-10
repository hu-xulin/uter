package costopt

import (
	"testing"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"

	"github.com/uter-ai/uter/relaykit/dto"
)

// 🔑 回归背景：structured_output 钩子的 Go 默认模式是 "json_object"，而
// `LoadFromDB` 只覆盖 Options 表里已存在的键 —— 前端没暴露该配置项时，
// 实际生效模式就是 json_object。
//
// 上游（Claude / Gemini / Groq 等 OpenAI 兼容实现）对 json_object 有硬约束：
// messages 里必须出现 "json" 字样，否则整请求 400：
//
//	messages must contain the word 'json' in some form,
//	to use 'response_format' of type 'json_object'
//
// 原实现无条件注入 response_format，导致**所有普通问答请求全部400**
// （实测 claude-haiku-4-5-20251001 的 "1+1等于几" 直接失败）。
// 下面钉死「不提及 json 就不注入」这一行为。

// newReq 构造请求（messages 一律 user 角色，Content 走最常见的 string 形态）。
func newReq(contents ...string) *dto.GeneralOpenAIRequest {
	req := &dto.GeneralOpenAIRequest{Model: "claude-haiku-4-5-20251001"}
	for _, c := range contents {
		req.Messages = append(req.Messages, dto.Message{Role: "user", Content: c})
	}
	return req
}

// withStructuredConfig 临时把 structured_output 设成「启用 + json_object」，
// 返回还原函数。复现线上真实组合：前端未暴露该配置项时，LoadFromDB 不覆盖，
// 生效的就是 Go 默认的 json_object 模式。
func withStructuredConfig(t *testing.T) func() {
	t.Helper()
	cfg := costoptcfg.GetCostOptSetting()
	oldEnabled, oldMode, oldStops := cfg.StructuredOutputEnabled, cfg.StructuredOutputMode, cfg.StructuredOutputStopSequences
	cfg.StructuredOutputEnabled = true
	cfg.StructuredOutputMode = "json_object"
	cfg.StructuredOutputStopSequences = nil
	return func() {
		cfg.StructuredOutputEnabled = oldEnabled
		cfg.StructuredOutputMode = oldMode
		cfg.StructuredOutputStopSequences = oldStops
	}
}

func TestApplyStructuredOutput_NoInjectionWithoutJSONIntent(t *testing.T) {
	defer withStructuredConfig(t)()

	cases := []struct {
		name string
		req  *dto.GeneralOpenAIRequest
	}{
		{"纯问答", newReq("1+1等于几？只回数字")},
		{"长文本但无 json", newReq("请总结以下内容：分组倍率如何设置")},
		{"含 jargon 不应误判", newReq("jargon 这个词怎么理解")},
		{"含 jsonld 不应误判", newReq("jsonld 是什么格式")},
		{"system 消息无 json", newReq(
			"你是一个助手",
			"今天天气如何",
		)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := tc.req
			ApplyStructuredOutput(req)
			if req.ResponseFormat != nil && req.ResponseFormat.Type != "" {
				t.Fatalf("不提及 JSON 时不应注入 response_format，实际注入 %q", req.ResponseFormat.Type)
			}
		})
	}
}

func TestApplyStructuredOutput_InjectsWhenJSONMentioned(t *testing.T) {
	defer withStructuredConfig(t)()

	cases := []struct {
		name string
		req  *dto.GeneralOpenAIRequest
	}{
		{"user 提及 JSON", newReq("请用 json 格式返回结果")},
		{"小写 json", newReq("输出 json")},
		{"大小写混合 Json", newReq("用 Json 格式")},
		{"system 提及", newReq(
			"所有回答必须是合法 JSON",
			"列举三个分组",
		)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := tc.req
			ApplyStructuredOutput(req)
			if req.ResponseFormat == nil || req.ResponseFormat.Type != "json_object" {
				t.Fatalf("提及 JSON 时应注入 json_object，实际 %+v", req.ResponseFormat)
			}
		})
	}
}

func TestApplyStructuredOutput_ClientFormatNotOverridden(t *testing.T) {
	defer withStructuredConfig(t)()

	req := newReq("随便说点什么")
	req.ResponseFormat = &dto.ResponseFormat{Type: "json_schema"}

	if ApplyStructuredOutput(req) {
		t.Fatalf("客户端已设 json_schema 时不应改写")
	}
	if req.ResponseFormat.Type != "json_schema" {
		t.Fatalf("客户端契约被破坏：%q", req.ResponseFormat.Type)
	}
}

func TestContainsJSONWord(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"json", true},
		{"JSON", true},
		{"Json", true},
		{"用 json 格式", true},
		{"no json here", true},
		// 上游只认messages 里有没有 "json" **字样**；纯 JSON 内容（{"a":1}）
		// 不含该词，反而会 400，所以这里必须判false——宁可漏判也不误判。
		{"{\"a\":1}", false},
		{"jargon", false},
		{"jsonld", false},
		{"jsonify", false},
		{"", false},
		{"javascript", false},
	}
	for _, tc := range cases {
		if got := containsJSONWord(tc.in); got != tc.want {
			t.Errorf("containsJSONWord(%q) = %v, want %v", tc.in, got, tc.want)
		}
	}
}
