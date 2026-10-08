package costopt

import (
	"strings"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"

	"github.com/uter-ai/uter/relaykit/dto"
)

// ===== 30. 共享系统前缀 / 模板化 =====
//
// 现状缺口（V2 标记为 🟡）：仅由 Prompt Caching 间接覆盖，没有中转层主动把
// 稳定前缀置顶，缓存命中率依赖客户端自觉。
// V2.2 补齐：按模型（或通配 "*"）取模板前缀，稳定地置顶到 system 消息最前面，
// 让上游的 prefix caching 能稳定命中，从而间接省输入 token。

// ApplySharedPrefix 把配置的稳定前缀置顶到 system 消息最前，返回是否发生改写。
// 幂等：前缀已存在时不重复插入。
func ApplySharedPrefix(req *dto.GeneralOpenAIRequest) bool {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.SharedPrefixEnabled || req == nil || len(cfg.SharedPrefixTemplates) == 0 {
		return false
	}

	prefix := cfg.SharedPrefixTemplates[req.Model]
	if prefix == "" {
		prefix = cfg.SharedPrefixTemplates["*"]
	}
	prefix = strings.TrimSpace(prefix)
	if prefix == "" {
		return false
	}
	if maxChars := cfg.SharedPrefixMaxChars; maxChars > 0 && len([]rune(prefix)) > maxChars {
		prefix = string([]rune(prefix)[:maxChars])
	}

	// 已有 system 则前插（幂等检查），否则新建置顶 system。
	for i := range req.Messages {
		if req.Messages[i].Role != "system" {
			continue
		}
		if i == 0 {
			cur := req.Messages[i].StringContent()
			if strings.Contains(cur, prefix) {
				return false // 已置顶，避免重复插入
			}
			req.Messages[i].SetStringContent(prefix + "\n\n" + cur)
			return true
		}
		// system 不在首位：把它提到首位并前插前缀，保证前缀位于最前（缓存前提）。
		sys := req.Messages[i]
		rest := append([]dto.Message{}, req.Messages[:i]...)
		rest = append(rest, req.Messages[i+1:]...)
		sys.SetStringContent(prefix + "\n\n" + sys.StringContent())
		req.Messages = append([]dto.Message{sys}, rest...)
		return true
	}

	req.Messages = append([]dto.Message{{Role: "system", Content: prefix}}, req.Messages...)
	return true
}
