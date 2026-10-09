package costopt

import (
	"context"
	"fmt"
	"strings"

	"github.com/uter-ai/uter/common"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
	costoptcfg "github.com/uter-ai/uter/setting/costopt"
)

// isReasoningModel 粗判压缩模型是否为 reasoning 类型（思考 token 与输出共用 max_tokens 预算）。
// 命中后需为思考预留预算，否则思考吃掉全部预算、content 返回空、压缩静默失效。
func isReasoningModel(name string) bool {
	if name == "" {
		return false
	}
	lower := strings.ToLower(name)
	for _, sig := range []string{"gpt-oss", "o1", "o3", "o4", "-r1", "qwq", "deepseek-reasoner", "thinking", "reasoning"} {
		if strings.Contains(lower, sig) {
			return true
		}
	}
	return false
}

// compressionBudget 计算压缩调用的输出 token 预算（纯函数，便于单测）。
//   - contentBudget：期望压缩后的内容 token 数（= 字符数 × maxRatio + 20）。
//   - reasoning：压缩模型为 reasoning 类型时，思考与输出共用预算，按 reserve 倍放大，避免空输出。
//   - maxTotalTokens：输入估算 + 输出预算的硬上限（>0 时生效），用于规避上游 TPM 限制（如 Groq 免费档 8000）。
//     inChars 为待压缩文本字符数，用于估算输入 token（≈ inChars/3）。
func compressionBudget(contentBudget, inChars int, reasoning bool, reserve float64, maxTotalTokens int) int {
	outBudget := contentBudget
	if reasoning {
		outBudget = int(float64(contentBudget) * reserve)
	}
	if maxTotalTokens > 0 {
		inEst := inChars/3 + 8
		if inEst+outBudget > maxTotalTokens {
			outBudget = maxTotalTokens - inEst
			if outBudget < 64 {
				outBudget = 64
			}
		}
	}
	return outBudget
}

// ApplyPromptCompression 用便宜压缩模型压短非 system 消息文本，降低输入 token。
// best-effort：任何错误/空结果都不修改请求（不阻塞正常请求）。
func ApplyPromptCompression(req *dto.GeneralOpenAIRequest, info *relaycommon.RelayInfo) bool {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.PromptCompressionEnabled || len(req.Messages) == 0 {
		return false
	}
	if cfg.PromptCompressionAPIBaseURL == "" || cfg.PromptCompressionAPIKey == "" || cfg.PromptCompressionModel == "" {
		return false
	}
	maxRatio := cfg.PromptCompressionMaxRatio
	if maxRatio <= 0 || maxRatio >= 1 {
		maxRatio = 0.5
	}
	reserve := cfg.PromptCompressionReasoningReserve
	if reserve <= 0 {
		reserve = 3.0
	}
	reasoning := isReasoningModel(cfg.PromptCompressionModel)

	IncCompressionRequest()
	modified := false
	hadEmpty := false
	for i := range req.Messages {
		if req.Messages[i].Role == "system" {
			continue
		}
		txt := req.Messages[i].StringContent()
		runes := []rune(txt)
		if len(runes) < 200 {
			continue
		}
		// 内容预算：期望压缩后的 token 数（字符数 ≈ token 数）。
		contentBudget := int(float64(len(runes))*maxRatio) + 20
		outBudget := compressionBudget(contentBudget, len(runes), reasoning, reserve, cfg.PromptCompressionMaxTotalTokens)
		compressed, err := cfgChat(context.Background(), cfg, cfg.PromptCompressionAPIBaseURL, cfg.PromptCompressionAPIKey,
			cfg.PromptCompressionModel,
			"请把下面的对话片段压缩为保留全部关键事实与待办的精简版本，直接输出压缩后的文本，不要任何解释或前缀。",
			txt, outBudget)
		if err == nil && compressed != "" {
			req.Messages[i].Content = compressed
			modified = true
		} else if err == nil && compressed == "" {
			// 压缩返回空内容：通常是 reasoning 模型思考吃光预算，best-effort 跳过，但必须告警，
			// 否则"压缩已开启"的假象掩盖了实际空转（实测因此误判压缩生效）。
			hadEmpty = true
		}
	}
	if hadEmpty {
		IncCompressionEmpty()
		common.SysError(fmt.Sprintf(
			"[costopt][WARN] Prompt 压缩模型 %s 返回空内容（疑似 reasoning 模型思考吃光 max_tokens 预算，或上游无输出），相关片段已跳过压缩。"+
				"建议调大 prompt_compression_reasoning_reserve 或改用非 reasoning 模型；若上游 TPM 受限请设置 prompt_compression_max_total_tokens。",
			cfg.PromptCompressionModel))
	}
	if modified {
		IncCompressionHit()
	}
	return modified
}
