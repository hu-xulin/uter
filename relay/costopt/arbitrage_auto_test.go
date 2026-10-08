package costopt

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/relaykit/dto"
	costoptcfg "github.com/uter-ai/uter/setting/costopt"
)

// 三态模式（auto 默认 | manual | off）判定：
// auto 必须生效且算自动；manual 生效但不算自动；off 全关；
// mode 为空时回退遗留 enabled 开关，保证老部署升级后行为不变。
func TestArbitrageModeTriState(t *testing.T) {
	cfg := costoptcfg.GetCostOptSetting()
	oldMode, oldEnabled := cfg.ArbitrageMode, cfg.ArbitrageEnabled
	defer func() {
		cfg.ArbitrageMode, cfg.ArbitrageEnabled = oldMode, oldEnabled
	}()

	cfg.ArbitrageMode, cfg.ArbitrageEnabled = "auto", false
	require.True(t, cfg.ArbitrageActive(), "auto 应生效，不受遗留 enabled=false 影响")
	require.True(t, cfg.ArbitrageAuto(), "auto 应判定为自动模式")

	cfg.ArbitrageMode = "off"
	require.False(t, cfg.ArbitrageActive(), "off 应关闭")
	require.False(t, cfg.ArbitrageAuto())

	cfg.ArbitrageMode, cfg.ArbitrageEnabled = "manual", false
	require.True(t, cfg.ArbitrageActive(), "manual 应生效")
	require.False(t, cfg.ArbitrageAuto(), "manual 不应算自动模式")

	cfg.ArbitrageMode, cfg.ArbitrageEnabled = "", true
	require.True(t, cfg.ArbitrageActive(), "mode 为空时回退 enabled=true")

	cfg.ArbitrageEnabled = false
	require.False(t, cfg.ArbitrageActive(), "mode 为空且 enabled=false 应关闭（兼容老部署）")
}

// #4/#5/#6/#7 任一处于 auto 即应按有效单价择优；全部 off 时不应开启。
func TestAutoPriceFirstFollowsModes(t *testing.T) {
	cfg := costoptcfg.GetCostOptSetting()
	old := []string{cfg.ArbitrageMode, cfg.ValueTierMode, cfg.TierSplitMode}
	defer func() {
		cfg.ArbitrageMode, cfg.ValueTierMode, cfg.TierSplitMode = old[0], old[1], old[2]
	}()

	cfg.ArbitrageMode, cfg.ValueTierMode, cfg.TierSplitMode = "off", "off", "off"
	require.False(t, cfg.AutoPriceFirst(), "全部 off 不应开启自动择优")
	require.False(t, AutoPriceFirst())

	cfg.TierSplitMode = "auto"
	require.True(t, cfg.AutoPriceFirst(), "任一 auto 即开启自动择优")
	require.True(t, AutoPriceFirst())
}

// 等价模型组：人工定义组、自动挑组内最便宜者；未配置时应返回空（不擅自换模型）。
func TestCheapestEquivalentPicksWithinGroup(t *testing.T) {
	cfg := costoptcfg.GetCostOptSetting()
	old := cfg.ValueTierModelEquivalents
	defer func() { cfg.ValueTierModelEquivalents = old }()

	cfg.ValueTierModelEquivalents = nil
	require.Equal(t, "", cheapestEquivalent("gpt-4o"), "未配置等价组时不应替换模型")

	cfg.ValueTierModelEquivalents = map[string][]string{
		"gpt-4o": {"llama-3.3-70b", "qwen2.5-72b"},
	}
	got := cheapestEquivalent("gpt-4o")
	if got != "" {
		require.Contains(t, []string{"llama-3.3-70b", "qwen2.5-72b"}, got,
			"下沉目标必须来自人工定义的等价组，绝不能凭空造模型名")
	}
	require.NotEqual(t, "gpt-4o", got, "不应把自己当成下沉目标")
}

// 后台流量自动识别：显式请求头 / 模型后缀命中即算；普通交互请求不算；
// 非流式默认不算后台（避免把交互式请求判为后台而掉质量）。
func TestIsBackgroundRequestAutoDetect(t *testing.T) {
	cfg := costoptcfg.GetCostOptSetting()
	oldMode, oldTags, oldAuto, oldNonStream := cfg.TierSplitMode, cfg.TierSplitBackgroundTags,
		cfg.TierSplitAutoDetect, cfg.TierSplitNonStreamAsBackground
	defer func() {
		cfg.TierSplitMode, cfg.TierSplitBackgroundTags = oldMode, oldTags
		cfg.TierSplitAutoDetect, cfg.TierSplitNonStreamAsBackground = oldAuto, oldNonStream
	}()

	cfg.TierSplitMode = "auto"
	cfg.TierSplitAutoDetect = true
	cfg.TierSplitBackgroundTags = nil
	cfg.TierSplitNonStreamAsBackground = false

	noStream := false
	require.True(t, IsBackgroundRequest(&dto.GeneralOpenAIRequest{Model: "gpt-4o"},
		map[string]string{"X-Uter-Background": "true"}), "显式后台请求头应判为后台")
	require.True(t, IsBackgroundRequest(&dto.GeneralOpenAIRequest{Model: "gpt-4o-batch"}, nil),
		"模型 -batch 后缀应判为后台")
	require.False(t, IsBackgroundRequest(&dto.GeneralOpenAIRequest{Model: "gpt-4o"},
		map[string]string{"Authorization": "Bearer sk-x"}), "普通交互请求不应判为后台")
	require.False(t, IsBackgroundRequest(&dto.GeneralOpenAIRequest{Model: "gpt-4o", Stream: &noStream}, nil),
		"非流式默认不应判为后台")

	cfg.TierSplitNonStreamAsBackground = true
	require.True(t, IsBackgroundRequest(&dto.GeneralOpenAIRequest{Model: "gpt-4o", Stream: &noStream}, nil),
		"开启后非流式应判为后台")
}

// A-tier 下沉：后台 + 不在用户可见白名单 → 替换为便宜模型；
// 用户可见白名单内的模型必须原样保留。
func TestApplyTierSplitKeepsVisibleModels(t *testing.T) {
	cfg := costoptcfg.GetCostOptSetting()
	oldMode, oldVisible, oldBg := cfg.TierSplitMode, cfg.TierSplitVisibleModels, cfg.TierSplitBackgroundModel
	defer func() {
		cfg.TierSplitMode, cfg.TierSplitVisibleModels = oldMode, oldVisible
		cfg.TierSplitBackgroundModel = oldBg
	}()

	req := &dto.GeneralOpenAIRequest{Model: "gpt-4o"}
	cfg.TierSplitVisibleModels = []string{"gpt-4o"}
	cfg.TierSplitBackgroundModel = "gpt-4o-mini"
	cfg.TierSplitMode = "auto"
	require.False(t, ApplyTierSplit(req, true), "用户可见白名单内的模型不应下沉")
	require.Equal(t, "gpt-4o", req.Model)

	cfg.TierSplitVisibleModels = nil
	require.True(t, ApplyTierSplit(req, true), "非白名单的后台流量应下沉")
	require.Equal(t, "gpt-4o-mini", req.Model)

	req2 := &dto.GeneralOpenAIRequest{Model: "gpt-4o"}
	require.False(t, ApplyTierSplit(req2, false), "非后台流量不应改模型")
	require.Equal(t, "gpt-4o", req2.Model)
}
