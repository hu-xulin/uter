package model

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/relaykit/dto"
)

// 定价页渠道筛选元数据只放行 branding 白名单字段。渠道 settings 里还含有
// 上游控制台凭据（UpstreamConsole.PasswordEncrypted）等敏感信息，绝不能随
// 公开的 /api/pricing 响应外泄。同时验证同名渠道按「type 最小胜出」取 branding，
// 以及坏 JSON 不会被本读取路径改写（GetOtherSettings 的 Save 副作用被绕开）。
func TestPricingChannelsExposeOnlyBrandingWhitelist(t *testing.T) {
	resetPricingEndpointTestTables(t)

	writeChannel := func(id int, name string, channelType int, settings dto.ChannelOtherSettings, rawSettings string) {
		t.Helper()
		channel := &Channel{
			Id:     id,
			Type:   channelType,
			Key:    fmt.Sprintf("key-%d", id),
			Status: common.ChannelStatusEnabled,
			Name:   name,
		}
		if rawSettings != "" {
			channel.OtherSettings = rawSettings
		} else {
			channel.SetOtherSettings(settings)
		}
		require.NoError(t, DB.Create(channel).Error)
		insertPricingEndpointAbility(t, id, "branding-model")
	}

	// 1270：配置了 light/dark logo + display_name，并夹带敏感字段。
	writeChannel(1270, "Claude-Basic", constant.ChannelTypeOpenAI, dto.ChannelOtherSettings{
		Branding: &dto.ChannelBranding{
			DisplayName: "  Claude 基础版  ",
			Logo:        "  data:image/png;base64,AAAA  ",
			LogoDark:    "  https://cdn.example.com/logo-dark.svg  ",
		},
		UpstreamConsole: &dto.UpstreamConsoleCredentials{
			LoginURL:          "https://upstream.example.com",
			PasswordEncrypted: "SUPER_SECRET_DO_NOT_LEAK",
		},
	}, "")
	// 同名渠道：type 更大（100），其 branding 不应胜出。
	writeChannel(1271, "Claude-Basic", constant.ChannelTypeOpenAIMax, dto.ChannelOtherSettings{
		Branding: &dto.ChannelBranding{
			DisplayName: "WRONG-SAME-NAME",
			Logo:        "data:image/png;base64,WRONG",
		},
	}, "")
	// 坏 JSON 渠道：读取不应触发写回（settings 保持原样），也不应 panic。
	badSettings := `{"branding":`
	writeChannel(1272, "bad-json-channel", constant.ChannelTypeOpenAI, dto.ChannelOtherSettings{}, badSettings)

	InitChannelCache()
	InvalidatePricingCache()

	byName := make(map[string]PricingChannel)
	for _, channel := range GetPricingChannels() {
		byName[channel.Name] = channel
	}

	basic, ok := byName["Claude-Basic"]
	require.True(t, ok, "Claude-Basic 应出现在定价渠道元数据中")
	assert.Equal(t, constant.ChannelTypeOpenAI, basic.Type)
	assert.Equal(t, "Claude 基础版", basic.DisplayName)
	assert.Equal(t, "data:image/png;base64,AAAA", basic.Logo)
	assert.Equal(t, "https://cdn.example.com/logo-dark.svg", basic.LogoDark)

	// 白名单之外：序列化结果不含敏感值。
	serialized := fmt.Sprintf("%+v", byName)
	assert.NotContains(t, serialized, "SUPER_SECRET_DO_NOT_LEAK")
	assert.NotContains(t, serialized, "PasswordEncrypted")
	assert.NotContains(t, serialized, "WRONG-SAME-NAME")

	// 坏 JSON 不污染：该渠道存在但无 branding 字段。
	bad, ok := byName["bad-json-channel"]
	require.True(t, ok)
	assert.Empty(t, bad.Logo)
	assert.Empty(t, bad.DisplayName)

	// 读取路径没有把坏 JSON 渠道的 settings 重写成 "{}"。
	var stored string
	require.NoError(t, DB.Model(&Channel{}).Where("id = ?", 1272).Select("settings").Scan(&stored).Error)
	assert.Equal(t, badSettings, stored, "坏 JSON 不应被定价读取路径改写")
}
