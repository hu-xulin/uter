package costopt

import (
	"context"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"
)

// BatchEmbedEnabled 是否启用批量 Embedding（端点已配置）。
func BatchEmbedEnabled() bool {
	cfg := costoptcfg.GetCostOptSetting()
	return cfg.BatchEmbedEnabled && cfg.BatchEmbedBaseURL != "" && cfg.BatchEmbedAPIKey != "" && cfg.BatchEmbedModel != ""
}

// BatchEmbed 一次提交多个文本到 embedding 端点（吞吐更高、单价更优）。
func BatchEmbed(ctx context.Context, texts []string) ([][]float32, error) {
	if !BatchEmbedEnabled() {
		return nil, errMissingEndpoint
	}
	cfg := costoptcfg.GetCostOptSetting()
	return openAIEmbed(ctx, cfg.BatchEmbedBaseURL, cfg.BatchEmbedAPIKey, cfg.BatchEmbedModel, texts)
}
