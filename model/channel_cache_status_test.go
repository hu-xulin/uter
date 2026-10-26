package model

import (
	"testing"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupRuntimeStatusChannel 建一个仅含单个启用渠道 + ability 的内存缓存环境，
// 返回渠道 id。调用方负责 t.Cleanup 恢复 MemoryCacheEnabled。
func setupRuntimeStatusChannel(t *testing.T, channelID int) {
	t.Helper()
	truncateTables(t)
	priority := int64(0)
	weight := uint(1)
	channel := Channel{
		Id:       channelID,
		Type:     constant.ChannelTypeOpenAI,
		Status:   common.ChannelStatusEnabled,
		Name:     "solo",
		Models:   "gpt-4",
		Group:    "default",
		Priority: &priority,
		Weight:   &weight,
	}
	require.NoError(t, channel.Insert())
	// channel.Insert() → AddAbilities 已按 Models 建好 ability 行
	InitChannelCache()
}

// TestRuntimeStatusChangeUpdatesCandidatePool 覆盖选路候选集与运行期状态改动的同步：
// group2model2channels 只在全量同步时重建，而 UpdateChannelStatus（relay 报错自动禁用、
// 管理端启停、多 key 单键启停）不走全量同步。若不同步候选集，被禁用的渠道会继续被加权随机
// 选中（最坏持续一个 SYNC_FREQUENCY），恢复启用的渠道则选不到。
func TestRuntimeStatusChangeUpdatesCandidatePool(t *testing.T) {
	truncateTables(t)
	originalMemoryCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() { common.MemoryCacheEnabled = originalMemoryCache; InitChannelCache() })

	setupRuntimeStatusChannel(t, 930001)

	selected, err := GetRandomSatisfiedChannel("default", "gpt-4", 0, nil)
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, "solo", selected.Name)

	// 运行期禁用（relay 报错自动禁用走的就是这条路径）
	require.True(t, UpdateChannelStatus(930001, "", common.ChannelStatusAutoDisabled, "test_disable"))
	selected, err = GetRandomSatisfiedChannel("default", "gpt-4", 0, nil)
	require.NoError(t, err)
	assert.Nil(t, selected, "禁用的渠道必须立刻离开候选集")

	// 重新启用后必须立刻可被选到
	require.True(t, UpdateChannelStatus(930001, "", common.ChannelStatusEnabled, "test_enable"))
	selected, err = GetRandomSatisfiedChannel("default", "gpt-4", 0, nil)
	require.NoError(t, err)
	require.NotNil(t, selected, "重新启用的渠道必须立刻可被选到")
	assert.Equal(t, "solo", selected.Name)
}

// TestFilterEnabledCandidateIDsNeverMutatesCachedSlice 保证兜底过滤不会就地改写
// 候选池切片（filterCandidateIDs 在无过滤条件时会原样返回池内切片）。
func TestFilterEnabledCandidateIDsNeverMutatesCachedSlice(t *testing.T) {
	truncateTables(t)
	originalMemoryCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() { common.MemoryCacheEnabled = originalMemoryCache; InitChannelCache() })

	setupRuntimeStatusChannel(t, 930002)
	second := Channel{
		Id:     930003,
		Type:   constant.ChannelTypeOpenAI,
		Status: common.ChannelStatusEnabled,
		Name:   "second",
		Models: "gpt-4",
		Group:  "default",
	}
	require.NoError(t, second.Insert())
	InitChannelCache()

	channelSyncLock.RLock()
	pooled := group2model2channels["default"]["gpt-4"]
	var kept []int
	require.Len(t, pooled, 2)
	assert.Equal(t, pooled, filterEnabledCandidateIDs(pooled), "全部启用时应原样返回")
	channelSyncLock.RUnlock()

	// 直接改 channelsIDM 里的状态，模拟「候选池尚未同步」的陈旧快照
	channelSyncLock.Lock()
	require.Len(t, group2model2channels["default"]["gpt-4"], 2)
	channelsIDM[930003].Status = common.ChannelStatusManuallyDisabled
	pooled = group2model2channels["default"]["gpt-4"]
	kept = filterEnabledCandidateIDs(pooled)
	channelSyncLock.Unlock()

	assert.Equal(t, []int{930002}, kept, "禁用渠道必须被过滤掉")
	assert.Equal(t, []int{930002, 930003}, pooled, "过滤不得就地改写候选池切片")
}

// TestRuntimeDisablePrunesStaleCandidatePool 覆盖兜底过滤的真实场景：
// 候选池里还留着已禁用渠道（全量同步尚未追上）时，选路必须选不到它。
func TestRuntimeDisablePrunesStaleCandidatePool(t *testing.T) {
	truncateTables(t)
	originalMemoryCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() { common.MemoryCacheEnabled = originalMemoryCache; InitChannelCache() })

	setupRuntimeStatusChannel(t, 930004)

	// 构造陈旧候选池：DB 与 channelsIDM 都还是启用，但池里混入一个已禁用渠道
	stale := Channel{
		Id:     930005,
		Type:   constant.ChannelTypeOpenAI,
		Status: common.ChannelStatusEnabled,
		Name:   "stale",
		Models: "gpt-4",
		Group:  "default",
	}
	require.NoError(t, stale.Insert())
	InitChannelCache()
	require.True(t, UpdateChannelStatus(930005, "", common.ChannelStatusAutoDisabled, "test_disable"))

	// 手动把禁用渠道塞回候选池，模拟同步尚未追上的窗口
	channelSyncLock.Lock()
	group2model2channels["default"]["gpt-4"] = append(group2model2channels["default"]["gpt-4"], 930005)
	channelSyncLock.Unlock()

	selected, err := GetRandomSatisfiedChannel("default", "gpt-4", 0, nil)
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, "solo", selected.Name, "陈旧候选池里的禁用渠道不得被选中")
}
