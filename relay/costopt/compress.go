package costopt

import (
	"context"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
)

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
	modified := false
	for i := range req.Messages {
		if req.Messages[i].Role == "system" {
			continue
		}
		txt := req.Messages[i].StringContent()
		runes := []rune(txt)
		if len(runes) < 200 {
			continue
		}
		compressed, err := cfgChat(context.Background(), cfg, cfg.PromptCompressionAPIBaseURL, cfg.PromptCompressionAPIKey,
			cfg.PromptCompressionModel,
			"请把下面的对话片段压缩为保留全部关键事实与待办的精简版本，直接输出压缩后的文本，不要任何解释或前缀。",
			txt, int(float64(len(runes))*maxRatio)+20)
		if err == nil && compressed != "" {
			req.Messages[i].Content = compressed
			modified = true
		}
	}
	return modified
}
