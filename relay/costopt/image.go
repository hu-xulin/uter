package costopt

import (
	"net/url"
	"strconv"
	"strings"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"

	"github.com/uter-ai/uter/relaykit/dto"
)

// ApplyImageResize 把消息中的远程图片 URL 改写为经图像代理下采样的 URL，降低视觉 token。
// 纯字符串变换，不引入图像解码依赖；仅改写 http(s) 远程图，base64 data URI 跳过。
func ApplyImageResize(req *dto.GeneralOpenAIRequest) bool {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.ImageResizeEnabled || cfg.ImageResizeProxyTemplate == "" || len(req.Messages) == 0 {
		return false
	}
	template := strings.ReplaceAll(cfg.ImageResizeProxyTemplate, "{max}", itoa(maxEdge(cfg)))
	rewritten := false
	for i := range req.Messages {
		content := req.Messages[i].ParseContent()
		if len(content) == 0 {
			continue
		}
		changed := false
		for j := range content {
			if content[j].Type != dto.ContentTypeImageURL {
				continue
			}
			img := content[j].GetImageMedia()
			if img == nil || img.Url == "" || !strings.HasPrefix(img.Url, "http") {
				continue // 跳过空图与 base64
			}
			proxyURL := strings.ReplaceAll(template, "{url}", url.QueryEscape(img.Url))
			content[j].ImageUrl = &dto.MessageImageUrl{Url: proxyURL, Detail: img.Detail, MimeType: img.MimeType}
			changed = true
		}
		if changed {
			req.Messages[i].SetMediaContent(content)
			rewritten = true
		}
	}
	return rewritten
}

func maxEdge(cfg *costoptcfg.CostOptSetting) int {
	if cfg.ImageResizeMaxEdge <= 0 {
		return 1024
	}
	return cfg.ImageResizeMaxEdge
}

func itoa(n int) string {
	return strconv.Itoa(n)
}
