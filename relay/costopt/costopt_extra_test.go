package costopt

import (
	"context"
	"net/url"
	"strings"
	"testing"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"

	"github.com/stretchr/testify/require"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
)

// withConfig 临时改写降本配置，结束后整体还原（含切片/映射头）。
func withConfig(t *testing.T, mutate func(*costoptcfg.CostOptSetting)) {
	t.Helper()
	cfg := costoptcfg.GetCostOptSetting()
	prev := *cfg
	mutate(cfg)
	t.Cleanup(func() { *cfg = prev })
}

// ----- 轻量复杂度路由 -----

func TestApplyComplexityRouting_SimpleRewritten(t *testing.T) {
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.ComplexityRoutingEnabled = true
		c.ComplexityRoutingCheapModel = "gpt-4o-mini"
	})
	// 模型保真：复杂度路由已停用，简单短文本也不得被换模型。
	req := &dto.GeneralOpenAIRequest{Model: "gpt-4o", Messages: []dto.Message{{Role: "user", Content: "你好"}}}
	ok := ApplyComplexityRouting(req, &relaycommon.RelayInfo{})
	require.False(t, ok, "模型保真：复杂度路由已停用")
	require.Equal(t, "gpt-4o", req.Model, "客户选择的模型必须保持不变")
}

func TestApplyComplexityRouting_ComplexNotRewritten(t *testing.T) {
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.ComplexityRoutingEnabled = true
		c.ComplexityRoutingCheapModel = "gpt-4o-mini"
	})
	req := &dto.GeneralOpenAIRequest{Model: "gpt-4o", Messages: []dto.Message{{Role: "user", Content: "帮我写一个快速排序的代码"}}}
	ok := ApplyComplexityRouting(req, &relaycommon.RelayInfo{})
	require.False(t, ok, "含复杂度信号的请求不应被降级")
	require.Equal(t, "gpt-4o", req.Model)
}

func TestApplyComplexityRouting_Disabled(t *testing.T) {
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.ComplexityRoutingEnabled = false
		c.ComplexityRoutingCheapModel = "gpt-4o-mini"
	})
	req := &dto.GeneralOpenAIRequest{Model: "gpt-4o", Messages: []dto.Message{{Role: "user", Content: "你好"}}}
	ok := ApplyComplexityRouting(req, &relaycommon.RelayInfo{})
	require.False(t, ok)
	require.Equal(t, "gpt-4o", req.Model)
}

func TestApplyComplexityRouting_FromModelsFilter(t *testing.T) {
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.ComplexityRoutingEnabled = true
		c.ComplexityRoutingCheapModel = "gpt-4o-mini"
		c.ComplexityRoutingFromModels = []string{"gpt-4o"}
	})
	// 不在 FromModels 列表 -> 不降级
	req := &dto.GeneralOpenAIRequest{Model: "claude-3", Messages: []dto.Message{{Role: "user", Content: "你好"}}}
	require.False(t, ApplyComplexityRouting(req, &relaycommon.RelayInfo{}))
	require.Equal(t, "claude-3", req.Model)
	// 命中 FromModels 也**不得**降级（模型保真：复杂度路由已整体停用）。
	req2 := &dto.GeneralOpenAIRequest{Model: "gpt-4o", Messages: []dto.Message{{Role: "user", Content: "你好"}}}
	require.False(t, ApplyComplexityRouting(req2, &relaycommon.RelayInfo{}))
	require.Equal(t, "gpt-4o", req2.Model, "即使命中来源白名单，客户选择的模型也必须保持不变")
}

// ----- 图像下采样代理 -----

func TestApplyImageResize_RewritesRemoteSkipsBase64(t *testing.T) {
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.ImageResizeEnabled = true
		c.ImageResizeMaxEdge = 512
		c.ImageResizeProxyTemplate = "https://imgproxy.example/?url={url}&w={max}"
	})
	remote := "https://cdn.example.com/pic.png"
	base64img := "data:image/png;base64,iVBORw0KGgo="
	req := &dto.GeneralOpenAIRequest{Model: "gpt-4o", Messages: []dto.Message{{Role: "user", Content: "看这张图"}}}
	req.Messages[0].SetMediaContent([]dto.MediaContent{
		{Type: dto.ContentTypeImageURL, ImageUrl: &dto.MessageImageUrl{Url: remote}},
		{Type: dto.ContentTypeImageURL, ImageUrl: &dto.MessageImageUrl{Url: base64img}},
	})

	ok := ApplyImageResize(req)
	require.True(t, ok)

	content := req.Messages[0].ParseContent()
	var remoteFound, base64Found bool
	for _, mc := range content {
		im := mc.GetImageMedia()
		if im == nil {
			continue
		}
		switch {
		case strings.Contains(im.Url, "imgproxy.example"):
			remoteFound = true
			require.Contains(t, im.Url, url.QueryEscape(remote), "远程图 URL 应被转义后塞入模板")
			require.Contains(t, im.Url, "w=512", "模板 {max} 应被最大边长替换")
		case strings.HasPrefix(im.Url, "data:image"):
			base64Found = true
		}
	}
	require.True(t, remoteFound, "远程图应被改写")
	require.True(t, base64Found, "base64 图应被原样跳过")
}

func TestApplyImageResize_Disabled(t *testing.T) {
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.ImageResizeEnabled = false
		c.ImageResizeProxyTemplate = "https://imgproxy.example/?url={url}&w={max}"
	})
	remote := "https://cdn.example.com/pic.png"
	req := &dto.GeneralOpenAIRequest{Model: "gpt-4o", Messages: []dto.Message{{Role: "user", Content: "图"}}}
	req.Messages[0].SetMediaContent([]dto.MediaContent{
		{Type: dto.ContentTypeImageURL, ImageUrl: &dto.MessageImageUrl{Url: remote}},
	})
	require.False(t, ApplyImageResize(req))
}

// ----- 上下文滑动窗口 / 摘要 -----

func TestApplyContextWindow_DropsOverflow(t *testing.T) {
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.ContextWindowEnabled = true
		c.ContextWindowMaxMessages = 3
		c.ContextWindowSummaryEnabled = false
	})
	req := &dto.GeneralOpenAIRequest{Model: "gpt-4o", Messages: []dto.Message{
		{Role: "user", Content: "m1"},
		{Role: "assistant", Content: "a1"},
		{Role: "user", Content: "m2"},
		{Role: "assistant", Content: "a2"},
		{Role: "user", Content: "m3"},
	}}
	ok := ApplyContextWindow(req, &relaycommon.RelayInfo{})
	require.True(t, ok)
	require.Len(t, req.Messages, 3, "应仅保留最近 3 条")
	require.Equal(t, "m3", req.Messages[2].StringContent())
}

func TestApplyContextWindow_PreservesSystem(t *testing.T) {
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.ContextWindowEnabled = true
		c.ContextWindowMaxMessages = 3
		c.ContextWindowSummaryEnabled = false
	})
	req := &dto.GeneralOpenAIRequest{Model: "gpt-4o", Messages: []dto.Message{
		{Role: "system", Content: "sys"},
		{Role: "user", Content: "m1"},
		{Role: "assistant", Content: "a1"},
		{Role: "user", Content: "m2"},
		{Role: "assistant", Content: "a2"},
	}}
	ok := ApplyContextWindow(req, &relaycommon.RelayInfo{})
	require.True(t, ok)
	// system(1) + keepOthers(3-1=2) => 3 条
	require.Len(t, req.Messages, 3)
	require.Equal(t, "sys", req.Messages[0].StringContent())
	require.Equal(t, "m2", req.Messages[1].StringContent())
	require.Equal(t, "a2", req.Messages[2].StringContent())
}

// ----- 负缓存 -----

func TestNegativeCache_StoreAndCheck(t *testing.T) {
	useCostOptMiniRedis(t)
	ctx := context.Background()
	key := "uter:neg_cache:unit-neg"

	hit, code := CheckNegative(ctx, key)
	require.False(t, hit, "未写入时不应命中")

	StoreNegative(ctx, key, 401)
	hit, code = CheckNegative(ctx, key)
	require.True(t, hit, "写入后应命中")
	require.Equal(t, 401, code, "应回放原状态码")

	// 确定性客户端错误判定
	require.True(t, IsDeterministicClientError(400))
	require.True(t, IsDeterministicClientError(401))
	require.True(t, IsDeterministicClientError(403))
	require.False(t, IsDeterministicClientError(429), "限流是瞬时的，不应负缓存")
	require.False(t, IsDeterministicClientError(500), "5xx 是瞬时的，不应负缓存")
	require.False(t, IsDeterministicClientError(200))
}

// ----- 突增 / 尖峰告警 -----

func TestRecordAndCheckSpike_BelowThenAbove(t *testing.T) {
	useCostOptMiniRedis(t)
	withConfig(t, func(c *costoptcfg.CostOptSetting) {
		c.SpikeAlertEnabled = true
		c.SpikeAlertTokensPerMin = 1000
	})
	ctx := context.Background()
	info := &relaycommon.RelayInfo{UserId: 7}

	require.False(t, RecordAndCheckSpike(ctx, info, 500), "500 < 1000 不应告警")
	require.True(t, RecordAndCheckSpike(ctx, info, 600), "累计 1100 > 1000 应告警")
}
