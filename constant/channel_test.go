package constant

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetChannelBaseURLIsBoundsSafe(t *testing.T) {
	assert.Empty(t, GetChannelBaseURL(ChannelTypeTaskPlugin))
	assert.Empty(t, GetChannelBaseURL(9999))
}

func TestChannelTypeNumbersAreUnique(t *testing.T) {
	all := []int{
		ChannelTypeUnknown,
		ChannelTypeOpenAI,
		ChannelTypeMidjourney,
		ChannelTypeAzure,
		ChannelTypeOllama,
		ChannelTypeMidjourneyPlus,
		ChannelTypeOpenAIMax,
		ChannelTypeOhMyGPT,
		ChannelTypeAILS,
		ChannelTypeAIProxy,
		ChannelTypePaLM,
		ChannelTypeAPI2GPT,
		ChannelTypeAIGC2D,
		ChannelTypeAnthropic,
		ChannelTypeBaidu,
		ChannelTypeZhipu,
		ChannelTypeAli,
		ChannelTypeXunfei,
		ChannelType360,
		ChannelTypeOpenRouter,
		ChannelTypeAIProxyLibrary,
		ChannelTypeFastGPT,
		ChannelTypeTencent,
		ChannelTypeGemini,
		ChannelTypeMoonshot,
		ChannelTypeZhipu_v4,
		ChannelTypePerplexity,
		ChannelTypeLingYiWanWu,
		ChannelTypeAws,
		ChannelTypeCohere,
		ChannelTypeMiniMax,
		ChannelTypeSunoAPI,
		ChannelTypeDify,
		ChannelTypeJina,
		ChannelCloudflare,
		ChannelTypeSiliconFlow,
		ChannelTypeVertexAi,
		ChannelTypeMistral,
		ChannelTypeDeepSeek,
		ChannelTypeMokaAI,
		ChannelTypeVolcEngine,
		ChannelTypeBaiduV2,
		ChannelTypeXinference,
		ChannelTypeXai,
		ChannelTypeCoze,
		ChannelTypeKling,
		ChannelTypeJimeng,
		ChannelTypeVidu,
		ChannelTypeSubmodel,
		ChannelTypeDoubaoVideo,
		ChannelTypeSora,
		ChannelTypeReplicate,
		ChannelTypeCodex,
		ChannelTypeAdvancedCustom,
		ChannelTypeSub2API,
		ChannelTypeUter,
		ChannelTypeTaskPlugin,
		ChannelTypeVLLM,
		ChannelTypeSGLang,
		ChannelTypeUterAPI,
		ChannelTypeUterRoute,
	}

	seen := make(map[int]string, len(all))
	maxType := 0
	for _, channelType := range all {
		if channelType > maxType {
			maxType = channelType
		}
	}
	for _, channelType := range all {
		name := GetChannelTypeName(channelType)
		previous, duplicate := seen[channelType]
		require.False(t, duplicate, "channel types %q and %q share number %d", previous, name, channelType)
		seen[channelType] = name
	}
	assert.Equal(t, 60, ChannelTypeUter)
	assert.Equal(t, 64, ChannelTypeUterAPI)
	assert.Equal(t, maxType, ChannelTypeDummy)
	require.Greater(t, len(ChannelBaseURLs), maxType)
	assert.Equal(t, "Uter", GetChannelTypeName(ChannelTypeUter))
	assert.Equal(t, "Uter.api", GetChannelTypeName(ChannelTypeUterAPI))
}

func TestNewAPICompatibleChannelTypes(t *testing.T) {
	assert.True(t, IsNewAPICompatibleChannelType(ChannelTypeUter))
	assert.True(t, IsNewAPICompatibleChannelType(ChannelTypeUterAPI))
	assert.True(t, IsNewAPICompatibleChannelType(ChannelTypeUterRoute))
	assert.False(t, IsNewAPICompatibleChannelType(ChannelTypeAdvancedCustom))
	assert.False(t, IsNewAPICompatibleChannelType(ChannelTypeTaskPlugin))
}
