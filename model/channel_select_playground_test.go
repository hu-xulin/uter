package model

import (
	"testing"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/dto"
	kitdto "github.com/uter-ai/uter/relaykit/dto"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 复现线上 503：「分组「VIP0」下模型「claude-opus-5-5」没有可用渠道」。
//
// 场景：渠道是高级自定义类型（含品牌聚合渠道 601），advanced_routes 只登记了
// 上游路径 /v1/chat/completions；用户在站内调试台发起请求，进来的是
// /pg/chat/completions。若选路阶段不做站内别名归一化，path 过滤器会把唯一的
// 候选渠道判成「不支持该端点」，候选集被清空 → 503。
func TestGetRandomSatisfiedChannelSelectsAdvancedCustomForPlaygroundPath(t *testing.T) {
	truncateTables(t)
	originalMemoryCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() { common.MemoryCacheEnabled = originalMemoryCache; InitChannelCache() })

	priority := int64(0)
	weight := uint(1)
	channel := Channel{
		Id:       940001,
		Type:     constant.ChannelTypeBrandedAggregate,
		Status:   common.ChannelStatusEnabled,
		Name:     "aggregate",
		Models:   "claude-opus-5-5",
		Group:    "VIP0",
		Priority: &priority,
		Weight:   &weight,
	}
	channel.SetOtherSettings(kitdto.ChannelOtherSettings{
		AdvancedCustom: &kitdto.AdvancedCustomConfig{
			Routes: []kitdto.AdvancedCustomRoute{{
				IncomingPath: "/v1/chat/completions",
				UpstreamPath: "/v1/chat/completions",
				Converter:    "none",
			}},
		},
	})
	require.NoError(t, channel.Insert())
	InitChannelCache()

	pathFilters := []dto.ChannelFilter{{Kind: dto.FilterRequestPath, RequestPath: "/pg/chat/completions"}}
	selected, err := GetRandomSatisfiedChannel("VIP0", "claude-opus-5-5", 0, pathFilters)
	require.NoError(t, err)
	require.NotNil(t, selected, "调试台路径必须能选中按上游路径登记的渠道")
	assert.Equal(t, 940001, selected.Id)
}

// 归一化不得让真实的路由不匹配蒙混过关：只登记 /v1/responses 的渠道，在调试台
// 发起 chat completions 时仍必须选不到。
func TestGetRandomSatisfiedChannelRejectsWrongRouteFromPlaygroundPath(t *testing.T) {
	truncateTables(t)
	originalMemoryCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() { common.MemoryCacheEnabled = originalMemoryCache; InitChannelCache() })

	channel := Channel{
		Id:     940002,
		Type:   constant.ChannelTypeBrandedAggregate,
		Status: common.ChannelStatusEnabled,
		Name:   "responses-only",
		Models: "claude-opus-5-5",
		Group:  "VIP0",
	}
	channel.SetOtherSettings(kitdto.ChannelOtherSettings{
		AdvancedCustom: &kitdto.AdvancedCustomConfig{
			Routes: []kitdto.AdvancedCustomRoute{{
				IncomingPath: "/v1/responses",
				UpstreamPath: "/v1/responses",
				Converter:    "none",
			}},
		},
	})
	require.NoError(t, channel.Insert())
	InitChannelCache()

	pathFilters := []dto.ChannelFilter{{Kind: dto.FilterRequestPath, RequestPath: "/pg/chat/completions"}}
	selected, err := GetRandomSatisfiedChannel("VIP0", "claude-opus-5-5", 0, pathFilters)
	require.NoError(t, err)
	assert.Nil(t, selected, "只登记 responses 路由的渠道不得服务 chat completions")
}

// 内存缓存关闭时选路改走数据库（GetChannel + filterAbilitiesByConstraints），
// 这条分支同样必须做站内别名归一化，否则关缓存部署会重现同一个 503。
func TestGetChannelFromDatabaseNormalizesPlaygroundPath(t *testing.T) {
	truncateTables(t)
	channel := Channel{
		Id:     940003,
		Type:   constant.ChannelTypeBrandedAggregate,
		Status: common.ChannelStatusEnabled,
		Name:   "aggregate-db",
		Models: "claude-opus-5-5",
		Group:  "VIP0",
	}
	channel.SetOtherSettings(kitdto.ChannelOtherSettings{
		AdvancedCustom: &kitdto.AdvancedCustomConfig{
			Routes: []kitdto.AdvancedCustomRoute{{
				IncomingPath: "/v1/chat/completions",
				UpstreamPath: "/v1/chat/completions",
				Converter:    "none",
			}},
		},
	})
	require.NoError(t, channel.Insert())

	pathFilters := []dto.ChannelFilter{{Kind: dto.FilterRequestPath, RequestPath: "/pg/chat/completions"}}
	selected, err := GetChannel("VIP0", "claude-opus-5-5", 0, pathFilters)
	require.NoError(t, err)
	require.NotNil(t, selected, "数据库选路同样必须识别调试台路径")
	assert.Equal(t, 940003, selected.Id)
}
