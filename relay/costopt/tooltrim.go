package costopt

import (
	"github.com/uter-ai/uter/relaykit/dto"
	costoptcfg "github.com/uter-ai/uter/setting/costopt"
)

// ApplyToolDefTrim 发送前裁剪 tools schema，降低每请求的工具定义 token。
// 可选剥离 description 与 examples（parameters 压成最小对象）。
func ApplyToolDefTrim(req *dto.GeneralOpenAIRequest) bool {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.ToolDefTrimEnabled || len(req.Tools) == 0 {
		return false
	}
	modified := false
	for i := range req.Tools {
		if cfg.ToolDefTrimStripDescription && req.Tools[i].Function.Description != "" {
			req.Tools[i].Function.Description = ""
			modified = true
		}
		if cfg.ToolDefTrimStripExamples {
			req.Tools[i].Function.Parameters = map[string]any{"type": "object", "properties": map[string]any{}}
			modified = true
		}
	}
	return modified
}
