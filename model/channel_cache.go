package model

import (
	"errors"
	"fmt"
	"math"
	"math/rand"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/uter-ai/uter/common"

	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/dto"
	"github.com/uter-ai/uter/logger"
	kitdto "github.com/uter-ai/uter/relaykit/dto"
	"github.com/uter-ai/uter/setting/channel_weight"
	costoptcfg "github.com/uter-ai/uter/setting/costopt"
	"github.com/uter-ai/uter/setting/ratio_setting"
)

var group2model2channels map[string]map[string][]int // enabled channel
var channelsIDM map[int]*Channel                     // all channels include disabled
// channel2advancedCustomConfig caches parsed Advanced Custom (type 58) configs so
// path-aware selection avoids re-parsing JSON per request. Refreshed on full sync.
var channel2advancedCustomConfig map[int]*kitdto.AdvancedCustomConfig
var channelSyncLock sync.RWMutex

func InitChannelCache() {
	if !common.MemoryCacheEnabled {
		InvalidatePricingCache()
		rebuildTaskAliasView()
		return
	}
	newChannelId2channel := make(map[int]*Channel)
	newChannel2advancedCustomConfig := make(map[int]*kitdto.AdvancedCustomConfig)
	var channels []*Channel
	DB.Find(&channels)
	for _, channel := range channels {
		newChannelId2channel[channel.Id] = channel
		if constant.IsAdvancedCustomChannelType(channel.Type) {
			if config := channel.GetOtherSettings().AdvancedCustom; config != nil {
				newChannel2advancedCustomConfig[channel.Id] = config
			}
		}
	}
	var abilities []*Ability
	DB.Find(&abilities)
	groups := make(map[string]bool)
	for _, ability := range abilities {
		groups[ability.Group] = true
	}
	newGroup2model2channels := make(map[string]map[string][]int)
	for group := range groups {
		newGroup2model2channels[group] = make(map[string][]int)
	}
	for _, channel := range channels {
		if channel.Status != common.ChannelStatusEnabled {
			continue // skip disabled channels
		}
		groups := strings.SplitSeq(channel.Group, ",")
		for group := range groups {
			models := channel.GetModels()
			for _, model := range models {
				if _, ok := newGroup2model2channels[group][model]; !ok {
					newGroup2model2channels[group][model] = make([]int, 0)
				}
				newGroup2model2channels[group][model] = append(newGroup2model2channels[group][model], channel.Id)
			}
		}
	}

	// sort by priority
	for group, model2channels := range newGroup2model2channels {
		for model, channels := range model2channels {
			sort.Slice(channels, func(i, j int) bool {
				return newChannelId2channel[channels[i]].GetPriority() > newChannelId2channel[channels[j]].GetPriority()
			})
			newGroup2model2channels[group][model] = channels
		}
	}

	channelSyncLock.Lock()
	group2model2channels = newGroup2model2channels
	//channelsIDM = newChannelId2channel
	for i, channel := range newChannelId2channel {
		if channel.ChannelInfo.IsMultiKey {
			channel.Keys = channel.GetKeys()
			if channel.ChannelInfo.MultiKeyMode == constant.MultiKeyModePolling {
				if oldChannel, ok := channelsIDM[i]; ok {
					// 存在旧的渠道，如果是多key且轮询，保留轮询索引信息
					if oldChannel.ChannelInfo.IsMultiKey && oldChannel.ChannelInfo.MultiKeyMode == constant.MultiKeyModePolling {
						channel.ChannelInfo.MultiKeyPollingIndex = oldChannel.ChannelInfo.MultiKeyPollingIndex
					}
				}
			}
		}
	}
	channelsIDM = newChannelId2channel
	channel2advancedCustomConfig = newChannel2advancedCustomConfig
	channelSyncLock.Unlock()
	// Lock ordering: InvalidatePricingCache acquires updatePricingLock, and
	// GetPricing (holding updatePricingLock) nests channelSyncLock.RLock via
	// loadPricingAdvancedCustomConfigs. channelSyncLock MUST be released before
	// invalidating the pricing cache, otherwise the reversed order deadlocks.
	InvalidatePricingCache()
	rebuildTaskAliasView()
	common.SysLog(common.LogText("channels synced from database"))
}

func SyncChannelCache(frequency int) {
	for {
		time.Sleep(time.Duration(frequency) * time.Second)
		common.SysLog(common.LogText("syncing channels from database"))
		InitChannelCache()
		// 回收已删除渠道遗留的轮询锁。GetChannelPollingLock 只增不减，
		// 渠道被删后它的 *sync.Mutex 会永久留在 map 里；长期运行 + 频繁增删渠道
		// （自动化/渠道供应商对接场景很常见）会让这张表无界增长。
		// 挂在每轮同步之后，代价是一轮全表 id 的轻量查询。
		CleanupChannelPollingLocks()
	}
}

// ChannelSelectOption 选路附加偏好（向后兼容：变参可选）。
type ChannelSelectOption struct {
	// PreferChannelType 强烈偏好的渠道类型名（constant.GetChannelTypeName）。
	// 非空时匹配渠道权重放大 100×，用于地理/区域比价等场景把流量导到特定区域渠道。
	PreferChannelType string
	// PriceFirst 按「渠道对该模型的有效单价」择优（多供应商套利 / 同模型跨通道比价 /
	// Serverless 价值层 / A-tier 分层的自动模式）。仅在同一优先级档内生效，
	// 不改变优先级档位划分，也不改变计费口径。
	PriceFirst bool
}

// PriceFirstChannel 构造一个"按有效单价择优"的选路选项。
func PriceFirstChannel() ChannelSelectOption {
	return ChannelSelectOption{PriceFirst: true}
}

// PreferChannelType 构造一个"偏好某渠道类型"的选路选项。
func PreferChannelType(t string) ChannelSelectOption {
	return ChannelSelectOption{PreferChannelType: t}
}

func GetRandomSatisfiedChannel(
	group string,
	model string,
	retry int,
	filters []dto.ChannelFilter,
	opts ...ChannelSelectOption,
) (*Channel, error) {
	// if memory cache is disabled, get channel directly from database
	if !common.MemoryCacheEnabled {
		return GetChannel(group, model, retry, filters)
	}

	// 地理/区域比价：从变参选项中取出强偏好渠道类型（默认空）。
	var preferCT string
	var priceFirst bool
	for _, o := range opts {
		if o.PreferChannelType != "" {
			preferCT = o.PreferChannelType
		}
		if o.PriceFirst {
			priceFirst = true
		}
	}

	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()

	// First, try to find channels with the exact model name.
	channels, _ := filterCandidateIDs(group2model2channels[group][model], model, filters)
	channels = filterEnabledCandidateIDs(channels)

	// If no channels found, try to find channels with the normalized model name.
	if len(channels) == 0 {
		normalizedModel := ratio_setting.RoutingMatchModelName(model)
		channels, _ = filterCandidateIDs(group2model2channels[group][normalizedModel], model, filters)
		channels = filterEnabledCandidateIDs(channels)
	}

	if len(channels) == 0 {
		return nil, nil
	}

	if len(channels) == 1 {
		if channel, ok := channelsIDM[channels[0]]; ok {
			return channel, nil
		}
		return nil, fmt.Errorf("database consistency error: channel #%d does not exist, please contact the administrator", channels[0])
	}

	effPriority := func(ch *Channel) int64 {
		if p, ok := channel_weight.GetChannelModelPriority(ch.Id, model); ok {
			return p
		}
		return ch.GetPriority()
	}
	effWeight := func(ch *Channel) int {
		if w, ok := channel_weight.GetChannelModelWeight(ch.Id, model); ok {
			return w
		}
		w := ch.GetWeight()
		// 成本感知路由（多供应商自动择优）：运营可通过 CostAwareChannelTypeWeight
		// 给更便宜的供应商类型加权重倍数，把流量导向低价渠道。仅当开关开启且倍数>1 时生效，
		// 不影响未配置的渠道，也不改变优先级档位（仅在同档内加权随机）。
		if costoptcfg.GetCostOptSetting().CostAwareRoutingEnabled {
			if mult, ok := costoptcfg.GetCostOptSetting().CostAwareChannelTypeWeight[constant.GetChannelTypeName(ch.Type)]; ok && mult > 1 {
				w *= mult
			}
		}
		// 地理/区域比价：强偏好某区域渠道类型时，权重放大，把流量导到低价区端点。
		if preferCT != "" && constant.GetChannelTypeName(ch.Type) == preferCT {
			w *= 100
		}
		return w
	}

	uniquePriorities := make(map[int]bool)
	for _, channelId := range channels {
		if channel, ok := channelsIDM[channelId]; ok {
			uniquePriorities[int(effPriority(channel))] = true
		} else {
			return nil, fmt.Errorf("database consistency error: channel #%d does not exist, please contact the administrator", channelId)
		}
	}
	var sortedUniquePriorities []int
	for priority := range uniquePriorities {
		sortedUniquePriorities = append(sortedUniquePriorities, priority)
	}
	sort.Sort(sort.Reverse(sort.IntSlice(sortedUniquePriorities)))

	if retry >= len(uniquePriorities) {
		retry = len(uniquePriorities) - 1
	}
	targetPriority := int64(sortedUniquePriorities[retry])

	// get the priority for the given retry number
	var sumWeight = 0
	var targetChannels []*Channel
	for _, channelId := range channels {
		if channel, ok := channelsIDM[channelId]; ok {
			if effPriority(channel) == targetPriority {
				sumWeight += effWeight(channel)
				targetChannels = append(targetChannels, channel)
			}
		} else {
			return nil, fmt.Errorf("database consistency error: channel #%d does not exist, please contact the administrator", channelId)
		}
	}

	if len(targetChannels) == 0 {
		return nil, errors.New(fmt.Sprintf("no channel found, group: %s, model: %s, priority: %d", group, model, targetPriority))
	}

	// 自动择优（#4 多供应商套利 / #5 同模型跨通道比价 / #6 Serverless 价值层）：
	// 在同一优先级档内按有效单价挑最便宜的渠道。取不到任何有效单价时回退加权随机，
	// 保证「没有定价信息」不会导致选不出渠道。
	if priceFirst && len(targetChannels) > 1 {
		if picked := cheapestChannelByPrice(targetChannels, model); picked != nil {
			return picked, nil
		}
	}

	// smoothing factor and adjustment
	smoothingFactor := 1
	smoothingAdjustment := 0

	if sumWeight == 0 {
		// when all channels have weight 0, set sumWeight to the number of channels and set smoothing adjustment to 100
		// each channel's effective weight = 100
		sumWeight = len(targetChannels) * 100
		smoothingAdjustment = 100
	} else if sumWeight/len(targetChannels) < 10 {
		// when the average weight is less than 10, set smoothing factor to 100
		smoothingFactor = 100
	}

	// Calculate the total weight of all channels up to endIdx
	totalWeight := sumWeight * smoothingFactor

	// Generate a random value in the range [0, totalWeight)
	randomWeight := rand.Intn(totalWeight)

	// Find a channel based on its weight
	for _, channel := range targetChannels {
		randomWeight -= effWeight(channel)*smoothingFactor + smoothingAdjustment
		if randomWeight < 0 {
			return channel, nil
		}
	}
	// return null if no channel is not found
	return nil, errors.New("channel not found")
}

// ===== 有效单价：自动择优的定价来源 =====

// channelUpstreamModel 解析渠道 model_mapping 后，该模型实际发往上游的模型名。
// 这是「同模型跨通道比价」的关键：同一请求模型在不同渠道可能映射到不同上游模型，
// 上游模型不同则定价不同，价差即套利空间（如 direct 与 Bedrock/Azure 的 Claude）。
func channelUpstreamModel(ch *Channel, modelName string) string {
	raw := ch.GetModelMapping()
	if raw == "" {
		return modelName
	}
	var mapping map[string]string
	if err := common.UnmarshalJsonStr(raw, &mapping); err != nil || len(mapping) == 0 {
		return modelName
	}
	upstream, cycle := followChannelModelMapping(mapping, modelName)
	if cycle || upstream == "" {
		return modelName
	}
	return upstream
}

// channelEffectiveUnitPrice 渠道对该模型的有效单价，归一到「每 1M token 美元」。
// 返回 0 表示拿不到有效定价（该渠道不参与自动择优，但不被排除）。
//
// 🔑 取价以**系统定价表自动推算为主**（ratio_config）：解析渠道 model_mapping 得到
// 上游模型名，直接查平台定价（ModelRatio / ModelPrice），无需人工维护任何价目表。
// 手填价目表（ArbitrageModelPrices）降级为**可选覆盖**，仅用于自动推算拿不到定价
// 或定价明显有误的个别场景——手工价目表会随上游调价而失效，绝不能作为主来源。
func channelEffectiveUnitPrice(ch *Channel, modelName string) float64 {
	if ch == nil || modelName == "" {
		return 0
	}
	cfg := costoptcfg.GetCostOptSetting()
	// 统一口径：比价描述的是「上游模型」的价格，故先解析渠道映射后的上游模型名，
	// 手工覆盖与自动推算都用同一个名字取价，避免两套口径对不上。
	upstream := channelUpstreamModel(ch, modelName)

	// 1) 自动推算（主路径）：渠道映射后的上游模型定价，来自平台统一价目表。
	//    即使下面有手填覆盖，也先取自动价作为兜底，覆盖缺失时不会退化成「无定价」。
	auto := 0.0
	if v, usePrice, exists := ratio_setting.GetModelRatioOrPrice(upstream); exists && v > 0 {
		if usePrice {
			auto = v
		} else {
			// ratio 口径是「每 token 的 quota」，换算为每 1M token 美元：
			// 美元 = quota / QuotaPerUnit，故单价 = ratio * 1e6 / QuotaPerUnit。
			auto = v * 1e6 / common.QuotaPerUnit
		}
	}

	// 2) 手填价目表覆盖（可选）：仅当显式提供且 auto 模式未关闭时才生效。
	if cfg.ArbitrageActive() && cfg.ArbitragePriceSource == "manual" && len(cfg.ArbitrageModelPrices) > 0 {
		ctName := constant.GetChannelTypeName(ch.Type)
		for _, key := range []string{ctName + "/" + upstream, upstream, ctName + "/" + modelName, modelName} {
			if p, ok := cfg.ArbitrageModelPrices[key]; ok && p > 0 {
				return p
			}
		}
	}
	return auto
}

// cheapestChannelByPrice 在同一优先级档的候选渠道中按有效单价挑最便宜的。
// 价差容忍 >1 时在容忍范围内保持按权重随机，避免把全部流量压到单一渠道；
// 所有候选均取不到有效单价时返回 nil，由调用方回退到原加权随机。
func cheapestChannelByPrice(channels []*Channel, modelName string) *Channel {
	type priced struct {
		ch    *Channel
		price float64
	}
	var known []priced
	min := math.MaxFloat64
	for _, ch := range channels {
		p := channelEffectiveUnitPrice(ch, modelName)
		if p <= 0 {
			continue
		}
		known = append(known, priced{ch: ch, price: p})
		if p < min {
			min = p
		}
	}
	if len(known) == 0 {
		return nil
	}
	tol := costoptcfg.GetCostOptSetting().ArbitrageTolerance()
	if tol < 1 {
		tol = 1
	}
	limit := min * tol
	var within []*Channel
	for _, k := range known {
		if k.price <= limit {
			within = append(within, k.ch)
		}
	}
	if len(within) == 1 {
		return within[0]
	}
	// 容忍范围内多个候选：按渠道权重随机，兼顾成本与负载分散。
	sum := 0
	for _, ch := range within {
		w := ch.GetWeight()
		if w <= 0 {
			w = 1
		}
		sum += w
	}
	if sum == 0 {
		return within[0]
	}
	r := rand.Intn(sum)
	for _, ch := range within {
		w := ch.GetWeight()
		if w <= 0 {
			w = 1
		}
		r -= w
		if r < 0 {
			return ch
		}
	}
	return within[len(within)-1]
}

func CacheGetChannel(id int) (*Channel, error) {
	if !common.MemoryCacheEnabled {
		return GetChannelById(id, true)
	}
	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()

	c, ok := channelsIDM[id]
	if !ok {
		return nil, fmt.Errorf("channel #%d no longer exists", id)
	}
	return c, nil
}

func CacheGetChannelInfo(id int) (*ChannelInfo, error) {
	if !common.MemoryCacheEnabled {
		channel, err := GetChannelById(id, true)
		if err != nil {
			return nil, err
		}
		return &channel.ChannelInfo, nil
	}
	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()

	c, ok := channelsIDM[id]
	if !ok {
		return nil, fmt.Errorf("channel #%d no longer exists", id)
	}
	return &c.ChannelInfo, nil
}

// syncChannelPoolMembership mirrors a channel's new status into the
// (group, model) candidate pool.
//
// The pool is otherwise only rebuilt by InitChannelCache (every
// SYNC_FREQUENCY seconds), so a runtime status change would stay invisible to
// channel selection for up to a full sync interval: a channel auto-disabled
// after relay errors keeps being picked by the weighted random selector, and a
// channel re-enabled after a successful test stays unreachable — traffic is
// routed to a channel that is down, or a healthy one returns 503.
//
// Caller must hold channelSyncLock.
func syncChannelPoolMembership(channel *Channel) {
	if group2model2channels == nil || channel == nil {
		return
	}
	for group := range strings.SplitSeq(channel.Group, ",") {
		group = strings.TrimSpace(group)
		if group == "" {
			continue
		}
		model2channels, ok := group2model2channels[group]
		if !ok {
			if channel.Status != common.ChannelStatusEnabled {
				continue
			}
			// InitChannelCache pre-creates a map per group found in the ability
			// table; a channel whose group has no ability row yet would panic on
			// a nil-map write, so create it here instead.
			model2channels = make(map[string][]int)
			group2model2channels[group] = model2channels
		}
		for _, modelName := range channel.GetModels() {
			if channel.Status == common.ChannelStatusEnabled {
				if isChannelIDInList(model2channels[modelName], channel.Id) {
					continue
				}
				model2channels[modelName] = append(model2channels[modelName], channel.Id)
				continue
			}
			model2channels[modelName] = removeChannelID(model2channels[modelName], channel.Id)
		}
	}
}

// removeChannelID returns ids without the first occurrence of id. The input
// slice is never mutated: it may alias the cached candidate list.
func removeChannelID(ids []int, id int) []int {
	index := slices.Index(ids, id)
	if index < 0 {
		return ids
	}
	updated := make([]int, 0, len(ids)-1)
	updated = append(updated, ids[:index]...)
	return append(updated, ids[index+1:]...)
}

// filterEnabledCandidateIDs drops candidates whose cached channel is no longer
// enabled.
//
// The candidate pool is a snapshot rebuilt only by a full sync, so it can still
// list a channel that was disabled after the last rebuild. Selection must not
// hand such a channel to the relay: the request would fail and, because the
// entry survives, the next request would pick it again until the sync catches
// up. This is the belt to syncChannelPoolMembership's braces — it also covers
// any future writer that changes a status without going through the pool sync.
//
// Caller must hold channelSyncLock. The input slice is never mutated: when
// nothing is dropped the original slice is returned as-is, keeping the hot path
// allocation-free.
func filterEnabledCandidateIDs(ids []int) []int {
	if len(ids) == 0 {
		return ids
	}
	kept := ids
	copied := false
	for i, id := range ids {
		channel, exists := channelsIDM[id]
		if exists && channel.Status == common.ChannelStatusEnabled {
			if copied {
				kept = append(kept, id)
			}
			continue
		}
		if !copied {
			// First drop: copy the surviving prefix so the cached slice is
			// never mutated, and so survivors before this index are kept.
			kept = make([]int, 0, len(ids)-1)
			kept = append(kept, ids[:i]...)
			copied = true
		}
	}
	return kept
}

func CacheUpdateChannel(channel *Channel) {
	if !common.MemoryCacheEnabled {
		return
	}
	channelSyncLock.Lock()
	if channel == nil {
		channelSyncLock.Unlock()
		return
	}

	if channelsIDM == nil {
		channelsIDM = make(map[int]*Channel)
	}
	oldChannel, existed := channelsIDM[channel.Id]
	if existed {
		logger.LogDebug(nil, "CacheUpdateChannel before: id=%d, name=%s, status=%d, polling_index=%d", channel.Id, channel.Name, channel.Status, oldChannel.ChannelInfo.MultiKeyPollingIndex)
		// Preserve the live multi-key polling cursor. It is advanced in memory
		// during relay selection and not always persisted, so the channel loaded
		// from the database can carry a stale index. Mirrors InitChannelCache.
		if channel.ChannelInfo.IsMultiKey && channel.ChannelInfo.MultiKeyMode == constant.MultiKeyModePolling &&
			oldChannel.ChannelInfo.IsMultiKey && oldChannel.ChannelInfo.MultiKeyMode == constant.MultiKeyModePolling {
			channel.ChannelInfo.MultiKeyPollingIndex = oldChannel.ChannelInfo.MultiKeyPollingIndex
		}
	}
	channelsIDM[channel.Id] = channel
	// A runtime status change must move the channel in the candidate pool too.
	// UpdateChannelStatus is the only writer that flips a status without a full
	// InitChannelCache rebuild, and it is the path the relay error handler uses
	// to auto-disable a channel.
	if existed && oldChannel.Status != channel.Status {
		syncChannelPoolMembership(channel)
	}
	if channel2advancedCustomConfig == nil {
		channel2advancedCustomConfig = make(map[int]*kitdto.AdvancedCustomConfig)
	}
	delete(channel2advancedCustomConfig, channel.Id)
	if constant.IsAdvancedCustomChannelType(channel.Type) {
		if config := channel.GetOtherSettings().AdvancedCustom; config != nil {
			channel2advancedCustomConfig[channel.Id] = config
		}
	}
	logger.LogDebug(nil, "CacheUpdateChannel after: id=%d, name=%s, status=%d, polling_index=%d", channel.Id, channel.Name, channel.Status, channel.ChannelInfo.MultiKeyPollingIndex)
	// Lock ordering: do NOT hold channelSyncLock while calling
	// InvalidatePricingCache. GetPricing acquires updatePricingLock first and then
	// channelSyncLock.RLock (via loadPricingAdvancedCustomConfigs); acquiring
	// updatePricingLock while holding channelSyncLock would be an AB-BA deadlock.
	channelSyncLock.Unlock()
	InvalidatePricingCache()
}
