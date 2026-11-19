package model

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
)

// 定价页「渠道」筛选依赖 pricing.channels：它是承载该模型的启用渠道展示名
// （管理-渠道的 name），空名渠道、禁用渠道都不应出现，且顺序必须稳定。
func TestPricingIncludesServingChannelNames(t *testing.T) {
	resetPricingEndpointTestTables(t)

	insertChannelWithModels := func(id int, name string, status int, channelType int, models ...string) {
		require.NoError(t, DB.Create(&Channel{
			Id:     id,
			Type:   channelType,
			Key:    fmt.Sprintf("key-%d", id),
			Status: status,
			Name:   name,
		}).Error)
		for _, modelName := range models {
			insertPricingEndpointAbility(t, id, modelName)
		}
	}

	insertChannelWithModels(201, "优特渠道", common.ChannelStatusEnabled, constant.ChannelTypeAdvancedCustom, "gpt-4o", "claude-3")
	insertChannelWithModels(202, "聚合渠道", common.ChannelStatusEnabled, constant.ChannelTypeUter, "gpt-4o")
	insertChannelWithModels(203, "", common.ChannelStatusEnabled, constant.ChannelTypeOpenAI, "gpt-4o")
	insertChannelWithModels(204, "禁用渠道", common.ChannelStatusManuallyDisabled, constant.ChannelTypeOpenAI, "gpt-4o")

	channelsByModel := make(map[string][]string)
	for _, pricing := range GetPricing() {
		channelsByModel[pricing.ModelName] = pricing.Channels
	}

	assert.Equal(t, []string{"优特渠道", "聚合渠道"}, channelsByModel["gpt-4o"])
	assert.Equal(t, []string{"优特渠道"}, channelsByModel["claude-3"])

	channelTypes := make(map[string]int)
	for _, channel := range GetPricingChannels() {
		channelTypes[channel.Name] = channel.Type
	}
	assert.Equal(t, map[string]int{
		"优特渠道": constant.ChannelTypeAdvancedCustom,
		"聚合渠道": constant.ChannelTypeUter,
	}, channelTypes)
}
