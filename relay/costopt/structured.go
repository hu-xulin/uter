package costopt

import (
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
		if req.ResponseFormat == nil || req.ResponseFormat.Type == "" {
			req.ResponseFormat = &dto.ResponseFormat{Type: "json_object"}
			changed = true
		}
	case "json_schema":
		if req.ResponseFormat == nil || req.ResponseFormat.Type != "json_schema" {
			// 未提供 schema 时退化为 json_object，保证结构化约束仍然生效。
			req.ResponseFormat = &dto.ResponseFormat{Type: "json_object"}
			changed = true
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
