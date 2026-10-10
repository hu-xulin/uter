package costopt

import (
	"encoding/json"
	"strings"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"

	"github.com/uter-ai/uter/relaykit/dto"
)

// ===== 24. 结构化输出约束（中转层强制策略） =====
//
// 现状缺口（V2 标记为 🟡）：JSON / stop sequence 只是按参数透传，没有中转层强制策略，
// 模型容易"啰嗦输出"导致输出 token 浪费（输出通常比输入贵 2–5×）。
// V2.2 补齐：按模式强制 response_format 或追加 stop 序列。
//
// 保守策略：客户端已显式设置 response_format 时不覆盖，避免破坏其既定契约。

// ApplyStructuredOutput 按配置强制结构化输出，返回是否发生改写。
func ApplyStructuredOutput(req *dto.GeneralOpenAIRequest) bool {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.StructuredOutputEnabled || req == nil {
		return false
	}

	changed := false
	switch strings.ToLower(strings.TrimSpace(cfg.StructuredOutputMode)) {
	case "json_object":
		// 🔑 OpenAI 兼容上游（Claude / Gemini / Groq 等）的硬约束：一旦带
		//    response_format=json_object，**messages 里必须出现 "json" 字样**
		//    （部分实现大小写不敏感），否则整请求 400：
		//      "messages must contain the word 'json' in some form,
		//       to use 'response_format' of type 'json_object'"
		//    早期实现无条件注入，把所有普通问答请求全部打成 400（实测 haiku
		//    的 "1+1等于几" 直接失败）。故这里必须先判定意图。
		//
		//    仅在「客户端已显式要求 JSON」或「用户确实想要 JSON」时才注入：
		//      1) 客户端已设置 response_format → 本就不该覆盖，但也别再叠加；
		//      2) 文本里显式提到 json / JSON 格式 → 注入有意义；
		//      3) 有 json_schema → 保留（schema 本身就表明意图）。
		//    都不满足则不注入——省掉一次无意义的失败重试，比强制约束更划算。
		if req.ResponseFormat == nil || req.ResponseFormat.Type == "" {
			if messagesMentionJSON(req) {
				req.ResponseFormat = &dto.ResponseFormat{Type: "json_object"}
				changed = true
			}
		}
	case "json_schema":
		if req.ResponseFormat == nil || req.ResponseFormat.Type != "json_schema" {
			// 未提供 schema 时退化为 json_object，保证结构化约束仍然生效。
			// 同样受"必须提及 json"的硬约束限制，否则注入即400。
			if req.ResponseFormat == nil || req.ResponseFormat.Type == "" {
				if messagesMentionJSON(req) {
					req.ResponseFormat = &dto.ResponseFormat{Type: "json_object"}
					changed = true
				}
			}
		}
	case "stop", "":
		// stop 模式不设置 response_format，仅追加停止序列。
	default:
		// 未知模式：退化为追加 stop 序列。
	}

	if changed2 := appendStopSequences(req, cfg.StructuredOutputStopSequences); changed2 {
		changed = true
	}
	return changed
}

// messagesMentionJSON 判断请求内容是否显式表达了 JSON 意图。
//
// 覆盖范围刻意保守：宁可漏判（不注入、走普通文本响应），也不误判（注入后被上游
// 400）。因此只看用户/系统消息与工具定义里的 json 字样，不做「问题看起来像要
// 结构化输出」的语义猜测——那种猜测会把普通问答也拖进 400。
func messagesMentionJSON(req *dto.GeneralOpenAIRequest) bool {
	// 工具定义里出现 json 说明调用方本就在走结构化链路
	if len(req.Tools) > 0 {
		if toolsMentionJSON(req.Tools) {
			return true
		}
	}
	for _, m := range req.Messages {
		if messageMentionsJSON(m) {
			return true
		}
	}
	return false
}

// messageMentionsJSON 从单条消息里提取文本并判定 json 字样。
// dto.Message.Content 是 any：可能是 string，也可能是多模态内容数组。
func messageMentionsJSON(m dto.Message) bool {
	switch content := m.Content.(type) {
	case string:
		return containsJSONWord(content)
	case []byte:
		// 某些反序列化路径下内容以 []byte 落在这里
		return containsJSONWord(string(content))
	case []any:
		return contentArrayMentionsJSON(content)
	case map[string]any:
		if txt, ok := content["text"].(string); ok {
			return containsJSONWord(txt)
		}
	}
	return false
}

func contentArrayMentionsJSON(segs []any) bool {
	for _, seg := range segs {
		switch s := seg.(type) {
		case map[string]any:
			if txt, ok := s["text"].(string); ok && containsJSONWord(txt) {
				return true
			}
		case string:
			if containsJSONWord(s) {
				return true
			}
		}
	}
	return false
}

// containsJSONWord 用词边界匹配 "json"，避免命中 "jargon"/"jsonld" 之类。
func containsJSONWord(s string) bool {
	lower := strings.ToLower(s)
	for idx := 0; ; {
		i := strings.Index(lower[idx:], "json")
		if i < 0 {
			return false
		}
		i += idx
		beforeOK := i == 0 || !isWordByte(lower[i-1])
		afterOK := i+4 >= len(lower) || !isWordByte(lower[i+4])
		if beforeOK && afterOK {
			return true
		}
		idx = i + 4
	}
}

// toolsMentionJSON 检查工具定义（转 JSON 字符串后）是否含 json 字样。
func toolsMentionJSON(tools []dto.ToolCallRequest) bool {
	for i := range tools {
		b, err := json.Marshal(tools[i])
		if err != nil {
			continue
		}
		if containsJSONWord(string(b)) {
			return true
		}
	}
	return false
}

// isWordByte 判断是否属于标识符字符（用于 "json" 的词边界匹配）。
func isWordByte(c byte) bool {
	return c == '_' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')
}

// appendStopSequences 把配置的停止序列合并进请求（去重，保留客户端原有序列）。
func appendStopSequences(req *dto.GeneralOpenAIRequest, seqs []string) bool {
	if len(seqs) == 0 {
		return false
	}
	existing := map[string]bool{}
	var out []string

	// 归一化客户端已有的 stop（可能是 string 或 []string）。
	switch v := req.Stop.(type) {
	case string:
		if v != "" {
			existing[v] = true
			out = append(out, v)
		}
	case []string:
		for _, s := range v {
			if s != "" && !existing[s] {
				existing[s] = true
				out = append(out, s)
			}
		}
	case []any:
		for _, it := range v {
			if s, ok := it.(string); ok && s != "" && !existing[s] {
				existing[s] = true
				out = append(out, s)
			}
		}
	}

	added := false
	for _, s := range seqs {
		if s == "" || existing[s] {
			continue
		}
		existing[s] = true
		out = append(out, s)
		added = true
	}
	if !added {
		return false
	}
	req.Stop = out
	return true
}

// StructuredOutputMaxRetries 结构校验失败后的最大重发次数（供调用方做重试上限）。
func StructuredOutputMaxRetries() int {
	n := costoptcfg.GetCostOptSetting().StructuredOutputMaxRetries
	if n < 0 {
		return 0
	}
	return n
}
