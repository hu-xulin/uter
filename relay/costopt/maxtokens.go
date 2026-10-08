package costopt

import (
	costoptcfg "github.com/uter-ai/uter/setting/costopt"

	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
)

// ClampMaxTokens 在调上游前，按 group / channel / global 上限对 max_tokens 封顶，
// 防止输出失控成本。仅当请求显式设置了 max_tokens 且超过上限时下调；
// 未设置（nil）不改（交由上游默认），避免影响依赖长输出的客户端。
func ClampMaxTokens(req *dto.GeneralOpenAIRequest, info *common.RelayInfo) {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.MaxTokensCapEnabled || req.MaxTokens == nil {
		return
	}
	capVal := resolveMaxTokensCap(cfg, info)
	if capVal <= 0 {
		return
	}
	if int(*req.MaxTokens) > capVal {
		v := uint(capVal)
		req.MaxTokens = &v
	}
}

// resolveMaxTokensCap 上限优先级：group > channel > global。
func resolveMaxTokensCap(cfg *costoptcfg.CostOptSetting, info *common.RelayInfo) int {
	if cfg.MaxTokensCapByGroup != nil {
		if v, ok := cfg.MaxTokensCapByGroup[info.UsingGroup]; ok && v > 0 {
			return v
		}
		if v, ok := cfg.MaxTokensCapByGroup[info.TokenGroup]; ok && v > 0 {
			return v
		}
	}
	if cfg.MaxTokensCapByChannel != nil {
		name := constant.GetChannelTypeName(info.ChannelType)
		if v, ok := cfg.MaxTokensCapByChannel[name]; ok && v > 0 {
			return v
		}
	}
	return cfg.MaxTokensCapGlobal
}
