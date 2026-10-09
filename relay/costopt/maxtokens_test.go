package costopt

import (
	"testing"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/constant"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
)

// withMaxTokensConfig 临时配置 max_tokens 上限，结束后还原。
func withMaxTokensConfig(t *testing.T, enabled bool, global int, byGroup map[string]int, byChannel map[string]int) {
	t.Helper()
	cfg := costoptcfg.GetCostOptSetting()
	prev := *cfg
	cfg.MaxTokensCapEnabled = enabled
	cfg.MaxTokensCapGlobal = global
	cfg.MaxTokensCapByGroup = byGroup
	cfg.MaxTokensCapByChannel = byChannel
	t.Cleanup(func() { *cfg = prev })
}

func reqWithMaxTokens(v uint) *dto.GeneralOpenAIRequest {
	return &dto.GeneralOpenAIRequest{Model: "gpt-4o", MaxTokens: &v}
}

func TestClampMaxTokens_DisabledAndNil(t *testing.T) {
	withMaxTokensConfig(t, false, 100, nil, nil)
	v := uint(99999)
	ClampMaxTokens(reqWithMaxTokens(v), &relaycommon.RelayInfo{})
	assert.Equal(t, uint(99999), v, "开关关闭时不应改动 max_tokens")

	// 未设置 max_tokens（nil）不应被改（交给上游默认，避免影响长输出客户端）
	withMaxTokensConfig(t, true, 100, nil, nil)
	req := &dto.GeneralOpenAIRequest{Model: "gpt-4o"}
	ClampMaxTokens(req, &relaycommon.RelayInfo{})
	assert.Nil(t, req.MaxTokens, "显式未设置时应保持 nil")
}

func TestClampMaxTokens_Global(t *testing.T) {
	withMaxTokensConfig(t, true, 8192, nil, nil)
	req := reqWithMaxTokens(100000)
	ClampMaxTokens(req, &relaycommon.RelayInfo{})
	require.NotNil(t, req.MaxTokens)
	assert.Equal(t, uint(8192), *req.MaxTokens, "超过全局上限应被封顶到 8192")

	// 未超过上限不改
	req2 := reqWithMaxTokens(100)
	ClampMaxTokens(req2, &relaycommon.RelayInfo{})
	require.NotNil(t, req2.MaxTokens)
	assert.Equal(t, uint(100), *req2.MaxTokens, "未超过上限应保持原值")
}

func TestClampMaxTokens_GroupPriority(t *testing.T) {
	withMaxTokensConfig(t, true, 8192, map[string]int{"vip": 2000}, nil)
	info := &relaycommon.RelayInfo{UsingGroup: "vip"}
	req := reqWithMaxTokens(100000)
	ClampMaxTokens(req, info)
	require.NotNil(t, req.MaxTokens)
	assert.Equal(t, uint(2000), *req.MaxTokens, "分组上限应优先生效（vip=2000 < global=8192）")

	// 非 vip 分组回落到全局
	info2 := &relaycommon.RelayInfo{UsingGroup: "default"}
	req2 := reqWithMaxTokens(100000)
	ClampMaxTokens(req2, info2)
	require.NotNil(t, req2.MaxTokens)
	assert.Equal(t, uint(8192), *req2.MaxTokens, "未命中分组上限时回落全局")
}

func TestClampMaxTokens_ChannelPriority(t *testing.T) {
	chName := constant.GetChannelTypeName(constant.ChannelTypeOpenAI)
	withMaxTokensConfig(t, true, 8192, nil, map[string]int{chName: 4000})
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeOpenAI}}
	req := reqWithMaxTokens(100000)
	ClampMaxTokens(req, info)
	require.NotNil(t, req.MaxTokens)
	require.Equal(t, uint(4000), *req.MaxTokens, "渠道上限应优先生效（OpenAI=4000 < global=8192）")
}
