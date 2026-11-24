package model

import (
	"errors"
	"maps"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/pkg/jsplugin"
	"github.com/uter-ai/uter/relaykit/dto"
	"github.com/uter-ai/uter/setting/billing_setting"
	"github.com/uter-ai/uter/setting/ratio_setting"
	"github.com/uter-ai/uter/types"
)

type PricingPluginVariant struct {
	PluginKey            string                               `json:"plugin_key"`
	PluginName           string                               `json:"plugin_name"`
	Icon                 string                               `json:"icon,omitempty"`
	BillingExpr          string                               `json:"billing_expr"`
	BillingMode          string                               `json:"billing_mode"`
	BillingUsageSchema   map[string]jsplugin.UsageFieldSchema `json:"billing_usage_schema"`
	BillingUsageExamples []jsplugin.UsageExample              `json:"billing_usage_examples,omitempty"`
}

type Pricing struct {
	BillingPluginVariants []PricingPluginVariant `json:"billing_plugin_variants,omitempty"`
	ModelName             string                 `json:"model_name"`
	Description           string                 `json:"description,omitempty"`
	// Descriptions 是该模型描述的全语种副本，供前端在切换语言时本地切换，
	// 无需为每种语言重新请求。Description 始终是按访客语言解析后的结果，
	// 因此只关心单一语言的既有调用方不受影响。
	Descriptions         map[string]string `json:"descriptions,omitempty"`
	Icon                 string            `json:"icon,omitempty"`
	Tags                 string            `json:"tags,omitempty"`
	VendorID             int               `json:"vendor_id,omitempty"`
	QuotaType            int               `json:"quota_type"`
	ModelRatio           float64           `json:"model_ratio"`
	ModelPrice           float64           `json:"model_price"`
	OwnerBy              string            `json:"owner_by"`
	CompletionRatio      float64           `json:"completion_ratio"`
	CacheRatio           *float64          `json:"cache_ratio,omitempty"`
	CreateCacheRatio     *float64          `json:"create_cache_ratio,omitempty"`
	ImageRatio           *float64          `json:"image_ratio,omitempty"`
	AudioRatio           *float64          `json:"audio_ratio,omitempty"`
	AudioCompletionRatio *float64          `json:"audio_completion_ratio,omitempty"`
	EnableGroup          []string          `json:"enable_groups"`
	// Channels 是承载该模型的启用渠道展示名（管理-渠道的 name），定价页
	// 「渠道」筛选直接消费它；空名渠道不会出现在这里。
	Channels               []string                             `json:"channels,omitempty"`
	SupportedEndpointTypes []constant.EndpointType              `json:"supported_endpoint_types"`
	BillingMode            string                               `json:"billing_mode,omitempty"`
	BillingExpr            string                               `json:"billing_expr,omitempty"`
	BillingUsageSchema     map[string]jsplugin.UsageFieldSchema `json:"billing_usage_schema,omitempty"`
	BillingUsageExamples   []jsplugin.UsageExample              `json:"billing_usage_examples,omitempty"`
	PricingVersion         string                               `json:"pricing_version,omitempty"`
	// ChannelPriceName is the enabled channel whose configured sale price is
	// shown on the plaza. Empty means the global price is displayed.
	ChannelPriceName string `json:"channel_price_name,omitempty"`
	// ChannelOfficial* describes the same channel's official list price. The
	// plaza compares Uter's channel-derived price against this basis, not
	// against an unrelated catalogue price.
	ChannelOfficialModelRatio       float64 `json:"channel_official_model_ratio,omitempty"`
	ChannelOfficialCompletionRatio  float64 `json:"channel_official_completion_ratio,omitempty"`
	ChannelOfficialCacheRatio       float64 `json:"channel_official_cache_ratio,omitempty"`
	ChannelOfficialCreateCacheRatio float64 `json:"channel_official_create_cache_ratio,omitempty"`
	ChannelOfficialModelPrice       float64 `json:"channel_official_model_price,omitempty"`
	ChannelOfficialPerSecondUSD     float64 `json:"channel_official_per_second_usd,omitempty"`
	// ChannelInternalPerSecondUSD is the channel's configured sale price for a
	// per-second media model. The card shows it as the Uter price instead of
	// the global usage expression.
	ChannelInternalPerSecondUSD float64 `json:"channel_internal_per_second_usd,omitempty"`
	// ChannelPrices keeps every enabled channel's configured sale price, keyed
	// by channel display name. The plaza picks the selected channel's entry.
	ChannelPrices               map[string]PricingChannelPrice `json:"channel_prices,omitempty"`
	ChannelInternalPerMinuteUSD float64                        `json:"channel_internal_per_minute_usd,omitempty"`
	ChannelPricingTiered        bool                           `json:"channel_pricing_tiered,omitempty"`
	ChannelPricingStatus        string                         `json:"channel_pricing_status,omitempty"`

	// 目录规格：定价页模型详情的「上下文 / 最大输出 / 知识截止 / 发布于 / 模态」
	// 五格直接消费这五个字段。
	//
	// 全部 omitempty：0 与空串代表「上游没有这条事实」，前端按存在性判断是否
	// 渲染该格。若不加 omitempty，未同步的模型会下发一堆 0，前端不得不为
	// 「0 是真值还是缺省」写额外判断。
	ContextLength    int      `json:"context_length,omitempty"`
	MaxOutputTokens  int      `json:"max_output_tokens,omitempty"`
	KnowledgeCutoff  string   `json:"knowledge_cutoff,omitempty"`
	ReleaseDate      string   `json:"release_date,omitempty"`
	InputModalities  []string `json:"input_modalities,omitempty"`
	OutputModalities []string `json:"output_modalities,omitempty"`
}

// PricingChannelPrice is one channel's configured sale price for a model. The
// plaza uses the selected channel's entry when a channel filter is active, so
// the same model can show a different price per channel.
type PricingChannelPrice struct {
	Name                     string  `json:"name"`
	ModelRatio               float64 `json:"model_ratio,omitempty"`
	CompletionRatio          float64 `json:"completion_ratio,omitempty"`
	ModelPrice               float64 `json:"model_price,omitempty"`
	PerSecondUSD             float64 `json:"per_second_usd,omitempty"`
	PerMinuteUSD             float64 `json:"per_minute_usd,omitempty"`
	OfficialModelRatio       float64 `json:"official_model_ratio,omitempty"`
	OfficialCompletionRatio  float64 `json:"official_completion_ratio,omitempty"`
	OfficialCacheRatio       float64 `json:"official_cache_ratio,omitempty"`
	OfficialCreateCacheRatio float64 `json:"official_create_cache_ratio,omitempty"`
	OfficialModelPrice       float64 `json:"official_model_price,omitempty"`
	OfficialPerSecondUSD     float64 `json:"official_per_second_usd,omitempty"`
	BillingMode              string  `json:"billing_mode,omitempty"`
	BillingExpr              string  `json:"billing_expr,omitempty"`
	CacheRatio               float64 `json:"cache_ratio,omitempty"`
	CreateCacheRatio         float64 `json:"create_cache_ratio,omitempty"`
	AudioRatio               float64 `json:"audio_ratio,omitempty"`
	AudioCompletionRatio     float64 `json:"audio_completion_ratio,omitempty"`
	Status                   string  `json:"status,omitempty"`
	QuotaType                int     `json:"quota_type"`
}

type PricingVendor struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Icon        string `json:"icon,omitempty"`
}

// PricingChannel is the pricing page's channel filter metadata. Type is the
// channel type number, so the console renders the same ChannelTypeLogo used by
// channel creation instead of guessing from the models that channel serves.
type PricingChannel struct {
	Name string `json:"name"`
	Type int    `json:"type"`
}

var (
	pricingMap           []Pricing
	pricingChannelsList  []PricingChannel
	vendorsList          []PricingVendor
	supportedEndpointMap map[string]common.EndpointInfo
	lastGetPricingTime   time.Time
	updatePricingLock    sync.Mutex

	// 缓存映射：模型名 -> 启用分组 / 计费类型
	modelEnableGroups     = make(map[string][]string)
	modelQuotaTypeMap     = make(map[string]int)
	modelEnableGroupsLock = sync.RWMutex{}
)

var (
	modelSupportEndpointTypes = make(map[string][]constant.EndpointType)
	modelSupportEndpointsLock = sync.RWMutex{}
)

func GetPricing() []Pricing {
	if time.Since(lastGetPricingTime) > time.Minute*1 || len(pricingMap) == 0 {
		updatePricingLock.Lock()
		defer updatePricingLock.Unlock()
		// Double check after acquiring the lock
		if time.Since(lastGetPricingTime) > time.Minute*1 || len(pricingMap) == 0 {
			modelSupportEndpointsLock.Lock()
			defer modelSupportEndpointsLock.Unlock()
			updatePricing()
		}
	}
	return pricingMap
}

func InvalidatePricingCache() {
	updatePricingLock.Lock()
	defer updatePricingLock.Unlock()

	pricingMap = nil
	pricingChannelsList = nil
	vendorsList = nil
	lastGetPricingTime = time.Time{}
}

// GetVendors 返回当前定价接口使用到的供应商信息
func GetVendors() []PricingVendor {
	if time.Since(lastGetPricingTime) > time.Minute*1 || len(pricingMap) == 0 {
		// 保证先刷新一次
		GetPricing()
	}
	return vendorsList
}

// GetPricingChannels returns the channel filter metadata for the same cache
// generation as GetPricing.
func GetPricingChannels() []PricingChannel {
	if time.Since(lastGetPricingTime) > time.Minute*1 || len(pricingMap) == 0 {
		GetPricing()
	}
	return append([]PricingChannel(nil), pricingChannelsList...)
}

func GetModelSupportEndpointTypes(model string) []constant.EndpointType {
	if model == "" {
		return make([]constant.EndpointType, 0)
	}
	modelSupportEndpointsLock.RLock()
	defer modelSupportEndpointsLock.RUnlock()
	if endpoints, ok := modelSupportEndpointTypes[model]; ok {
		return endpoints
	}
	return make([]constant.EndpointType, 0)
}

func getPricingEndpointTypesForAbility(ability AbilityWithChannel, advancedCustomConfigs map[int]*dto.AdvancedCustomConfig) []constant.EndpointType {
	if ability.ChannelType != constant.ChannelTypeAdvancedCustom {
		return common.GetEndpointTypesByChannelType(ability.ChannelType, ability.Model)
	}
	if config := advancedCustomConfigs[ability.ChannelId]; config != nil {
		return config.SupportedEndpointTypesForModel(ability.Model)
	}
	return common.GetEndpointTypesByChannelType(ability.ChannelType, ability.Model)
}

// loadPricingAdvancedCustomConfigs runs inside updatePricing while
// updatePricingLock is held, and nests channelSyncLock.RLock. This defines the
// global lock order updatePricingLock -> channelSyncLock: any code path holding
// channelSyncLock must release it before touching the pricing cache (see
// InitChannelCache / CacheUpdateChannel), otherwise it deadlocks.
// The returned configs are pointers shared with the channel cache; they are
// replaced wholesale on update and never mutated in place, so reading them after
// RUnlock is safe.
func loadPricingAdvancedCustomConfigs(enableAbilities []AbilityWithChannel) map[int]*dto.AdvancedCustomConfig {
	channelIDs := make([]int, 0)
	seen := make(map[int]struct{})
	for _, ability := range enableAbilities {
		if ability.ChannelType != constant.ChannelTypeAdvancedCustom {
			continue
		}
		if _, exists := seen[ability.ChannelId]; exists {
			continue
		}
		seen[ability.ChannelId] = struct{}{}
		channelIDs = append(channelIDs, ability.ChannelId)
	}
	if len(channelIDs) == 0 {
		return nil
	}

	configs := make(map[int]*dto.AdvancedCustomConfig, len(channelIDs))
	if common.MemoryCacheEnabled {
		channelSyncLock.RLock()
		defer channelSyncLock.RUnlock()
		for _, channelID := range channelIDs {
			if config := channel2advancedCustomConfig[channelID]; config != nil {
				configs[channelID] = config
			}
		}
		return configs
	}

	for _, channelID := range channelIDs {
		channel, err := CacheGetChannel(channelID)
		if err != nil {
			common.SysLog(common.LogText("load advanced custom channel settings error: channel_id=%d, error=%v", channelID, err))
			continue
		}
		if channel.Type != constant.ChannelTypeAdvancedCustom {
			continue
		}
		if config := channel.GetOtherSettings().AdvancedCustom; config != nil {
			configs[channelID] = config
		}
	}
	return configs
}

func appendPricingEndpoint(endpoints []string, endpoint string) []string {
	if endpoint == "" || common.StringsContains(endpoints, endpoint) {
		return endpoints
	}
	return append(endpoints, endpoint)
}

// channelInternalPrice is one enabled channel's configured sale price, used
// only to display the model square's price and discount. Billing resolves the
// same row per request, so the plaza and the invoice agree.
type channelInternalPrice struct {
	channelName      string
	pricing          ChannelInternalPricing
	quotaType        int
	modelRatio       float64
	completionRatio  float64
	modelPrice       float64
	inputUSD         float64
	officialTier     *ChannelPricingTier
	officialUnit     string
	perSecondUSD     float64
	perMinuteUSD     float64
	billingExpr      string
	audioRatio       float64
	audioCompletion  float64
	cacheRatio       float64
	createCacheRatio float64
	status           string
}

type channelOfficialView struct {
	tier *ChannelPricingTier
	unit string
}

func channelPricingOfficialView(raw string) (channelOfficialView, error) {
	if strings.TrimSpace(raw) == "" {
		return channelOfficialView{}, errors.New("normalized pricing is empty")
	}
	var view ChannelOfficialPricing
	if err := common.UnmarshalJsonStr(raw, &view); err != nil {
		return channelOfficialView{}, err
	}
	if len(view.Tiers) == 0 {
		return channelOfficialView{}, errors.New("normalized pricing has no tier")
	}
	tier := view.Tiers[0]
	return channelOfficialView{tier: &tier, unit: tier.Unit}, nil
}

// loadChannelInternalPrices returns the lowest configured channel price per
// model. Channels that are disabled or unnamed are ignored.
func loadChannelInternalPrices(abilities []AbilityWithChannel) (map[string]channelInternalPrice, map[string]map[string]channelInternalPrice) {
	channelNames := make(map[int]string)
	for _, ability := range abilities {
		name := strings.TrimSpace(ability.ChannelName)
		if name == "" || ability.ChannelStatus != common.ChannelStatusEnabled {
			continue
		}
		if _, exists := channelNames[ability.ChannelId]; !exists {
			channelNames[ability.ChannelId] = name
		}
	}
	if len(channelNames) == 0 {
		return nil, nil
	}
	var rows []ChannelModelPricing
	if err := DB.Find(&rows).Error; err != nil {
		common.SysLog(common.LogText("load channel internal prices failed: %v", err))
		return nil, nil
	}
	best := make(map[string]channelInternalPrice)
	byChannel := make(map[string]map[string]channelInternalPrice)
	for _, row := range rows {
		channelName, enabled := channelNames[row.ChannelId]
		if !enabled {
			continue
		}
		if strings.TrimSpace(row.InternalPricing) == "" {
			if row.PricingStatus == ChannelPricingStatusConfigured {
				continue
			}
			entry := channelInternalPrice{
				channelName: channelName, quotaType: -1, status: row.PricingStatus,
			}
			if view, viewErr := channelPricingOfficialView(row.NormalizedPricing); viewErr == nil {
				entry.officialTier = view.tier
				entry.officialUnit = view.unit
			}
			if byChannel[row.ModelName] == nil {
				byChannel[row.ModelName] = map[string]channelInternalPrice{}
			}
			byChannel[row.ModelName][channelName] = entry
			continue
		}
		var internal ChannelInternalPricing
		if err := common.UnmarshalJsonStr(row.InternalPricing, &internal); err != nil {
			continue
		}
		candidate := channelInternalPrice{channelName: channelName, pricing: internal, status: row.PricingStatus}
		if view, err := channelPricingOfficialView(row.NormalizedPricing); err == nil {
			candidate.officialTier = view.tier
			candidate.officialUnit = view.unit
		}
		switch internal.Mode {
		case ChannelPricingModePerMillionTokens:
			if !moneyPositive(internal.InputUSDPerMillion) || internal.OutputUSDPerMillion == nil {
				continue
			}
			candidate.quotaType = 0
			candidate.inputUSD = internal.InputUSDPerMillion.Float64()
			candidate.modelRatio = candidate.inputUSD / 2
			candidate.completionRatio = internal.OutputUSDPerMillion.Float64() / candidate.inputUSD
			if moneyPositive(internal.CacheUSDPerMillion) && candidate.inputUSD > 0 {
				candidate.cacheRatio = internal.CacheUSDPerMillion.Float64() / candidate.inputUSD
			}
			if moneyPositive(internal.CreateCacheUSDPerMillion) && candidate.inputUSD > 0 {
				candidate.createCacheRatio = internal.CreateCacheUSDPerMillion.Float64() / candidate.inputUSD
			}
			if internal.AudioRatio != nil {
				candidate.audioRatio = *internal.AudioRatio
			}
			if internal.AudioCompletionRatio != nil {
				candidate.audioCompletion = *internal.AudioCompletionRatio
			}
		case ChannelPricingModePerCall:
			if internal.PerCallUSD == nil || internal.PerCallUSD.Decimal().IsNegative() {
				continue
			}
			candidate.quotaType = 1
			candidate.modelPrice = internal.PerCallUSD.Float64()
			candidate.inputUSD = candidate.modelPrice
		case ChannelPricingModePerSecond:
			if !moneyPositive(internal.PerSecondUSD) {
				continue
			}
			candidate.quotaType = 2
			candidate.perSecondUSD = internal.PerSecondUSD.Float64()
			candidate.inputUSD = candidate.perSecondUSD
		case ChannelPricingModeTieredExpr:
			if strings.TrimSpace(internal.BillingExpr) == "" {
				continue
			}
			candidate.quotaType = 4
			candidate.billingExpr = internal.BillingExpr
			candidate.inputUSD = 1
		case ChannelPricingModePerMinute:
			if !moneyPositive(internal.PerMinuteUSD) {
				continue
			}
			candidate.quotaType = 3
			candidate.perMinuteUSD = internal.PerMinuteUSD.Float64()
			candidate.inputUSD = candidate.perMinuteUSD
		default:
			// Per-second media prices are billed through usage expressions and
			// have no single card price.
			continue
		}
		if byChannel[row.ModelName] == nil {
			byChannel[row.ModelName] = map[string]channelInternalPrice{}
		}
		if previous, exists := byChannel[row.ModelName][channelName]; !exists || channelPricePreferred(candidate, previous) {
			byChannel[row.ModelName][channelName] = candidate
		}
		current, exists := best[row.ModelName]
		if !exists || channelPricePreferred(candidate, current) {
			best[row.ModelName] = candidate
		}
	}
	return best, byChannel
}

// channelPricePreferred decides which configured row represents a model on the
// pricing page. An expression row carries no single amount: its inputUSD is a
// placeholder, so it must never win a "lowest price" comparison against a row
// with a real absolute price. Between two absolute rows the lower price wins;
// between two expression rows the incumbent stays.
func channelPricePreferred(candidate, previous channelInternalPrice) bool {
	candidateExpr := candidate.quotaType == 4
	previousExpr := previous.quotaType == 4
	if candidateExpr != previousExpr {
		return !candidateExpr
	}
	return candidate.inputUSD < previous.inputUSD
}

// channelPriceDisplayView is the single display contract for one configured
// channel price. Both the top-level "all channels" card and the channel-filtered
// card are built from this function, so they can never disagree about the
// expression, official basis, cache/audio ratios or review status.
//
// A tiered expression stays QuotaType 0 on the wire (the plaza's token bucket)
// and carries BillingMode/BillingExpr explicitly. The raw internal mode 4 is an
// implementation detail and must not leak into the display contract.
func channelPriceDisplayView(name string, price channelInternalPrice) PricingChannelPrice {
	entry := PricingChannelPrice{Name: name, Status: price.status}
	switch price.quotaType {
	case 0:
		entry.QuotaType = 0
		entry.ModelRatio = price.modelRatio
		entry.CompletionRatio = price.completionRatio
		entry.CacheRatio = price.cacheRatio
		entry.CreateCacheRatio = price.createCacheRatio
		entry.AudioRatio = price.audioRatio
		entry.AudioCompletionRatio = price.audioCompletion
	case 1:
		entry.QuotaType = 1
		entry.ModelPrice = price.modelPrice
	case 2:
		entry.QuotaType = 2
		entry.PerSecondUSD = price.perSecondUSD
	case 3:
		entry.QuotaType = 3
		entry.PerMinuteUSD = price.perMinuteUSD
	case 4:
		entry.QuotaType = 0
		entry.BillingMode = billing_setting.BillingModeTieredExpr
		entry.BillingExpr = price.billingExpr
	default:
		// official_only / needs_review rows carry no billable price.
		entry.QuotaType = -1
	}
	if tier := price.officialTier; tier != nil {
		switch price.officialUnit {
		case "per_call", "per_image", "per_minute":
			if tier.PerUnitUSD != nil {
				entry.OfficialModelPrice = tier.PerUnitUSD.Float64()
			}
		case "per_second":
			if tier.PerUnitUSD != nil {
				entry.OfficialPerSecondUSD = tier.PerUnitUSD.Float64()
			}
		default:
			if moneyPositive(tier.InputPerMillionUSD) {
				input := tier.InputPerMillionUSD.Float64()
				entry.OfficialModelRatio = input / 2
				if tier.OutputPerMillionUSD != nil {
					entry.OfficialCompletionRatio = tier.OutputPerMillionUSD.Float64() / input
				}
				if tier.CachePerMillionUSD != nil {
					entry.OfficialCacheRatio = tier.CachePerMillionUSD.Float64() / input
				}
				if tier.CreateCachePerMillionUSD != nil {
					entry.OfficialCreateCacheRatio = tier.CreateCachePerMillionUSD.Float64() / input
				}
			}
		}
	}
	return entry
}

// applyChannelPriceDisplay writes one canonical channel price into the
// top-level Pricing view. It returns true only when the row is billable; global
// ratio/billing-expression settings must not override a billable channel price.
func applyChannelPriceDisplay(pricing *Pricing, entry PricingChannelPrice) bool {
	pricing.ChannelPriceName = entry.Name
	pricing.ChannelPricingStatus = entry.Status
	pricing.ChannelPricingTiered = entry.BillingMode == billing_setting.BillingModeTieredExpr
	pricing.ChannelOfficialModelRatio = entry.OfficialModelRatio
	pricing.ChannelOfficialCompletionRatio = entry.OfficialCompletionRatio
	pricing.ChannelOfficialCacheRatio = entry.OfficialCacheRatio
	pricing.ChannelOfficialCreateCacheRatio = entry.OfficialCreateCacheRatio
	pricing.ChannelOfficialModelPrice = entry.OfficialModelPrice
	pricing.ChannelOfficialPerSecondUSD = entry.OfficialPerSecondUSD

	if entry.QuotaType < 0 {
		return false
	}
	if entry.BillingMode == billing_setting.BillingModeTieredExpr {
		pricing.BillingMode = entry.BillingMode
		pricing.BillingExpr = entry.BillingExpr
		pricing.QuotaType = 0
		pricing.ModelRatio = 0
		pricing.CompletionRatio = 0
		pricing.ModelPrice = 0
		pricing.ChannelInternalPerSecondUSD = 0
		pricing.ChannelInternalPerMinuteUSD = 0
		return true
	}
	switch entry.QuotaType {
	case 0:
		pricing.QuotaType = 0
		pricing.ModelRatio = entry.ModelRatio
		pricing.CompletionRatio = entry.CompletionRatio
		pricing.ModelPrice = 0
		if entry.CacheRatio > 0 {
			cacheRatio := entry.CacheRatio
			pricing.CacheRatio = &cacheRatio
		}
		if entry.CreateCacheRatio > 0 {
			createCacheRatio := entry.CreateCacheRatio
			pricing.CreateCacheRatio = &createCacheRatio
		}
		if entry.AudioRatio > 0 {
			audioRatio := entry.AudioRatio
			pricing.AudioRatio = &audioRatio
		}
		if entry.AudioCompletionRatio > 0 {
			audioCompletionRatio := entry.AudioCompletionRatio
			pricing.AudioCompletionRatio = &audioCompletionRatio
		}
		pricing.BillingMode = ""
		pricing.BillingExpr = ""
	case 1:
		pricing.QuotaType = 1
		pricing.ModelPrice = entry.ModelPrice
		pricing.ModelRatio = 0
		pricing.CompletionRatio = 0
		pricing.BillingMode = ""
		pricing.BillingExpr = ""
	case 2:
		pricing.QuotaType = 2
		pricing.ChannelInternalPerSecondUSD = entry.PerSecondUSD
		pricing.ModelRatio = 0
		pricing.ModelPrice = 0
		pricing.BillingMode = ""
		pricing.BillingExpr = ""
	case 3:
		pricing.QuotaType = 3
		pricing.ChannelInternalPerMinuteUSD = entry.PerMinuteUSD
		pricing.ModelRatio = 0
		pricing.ModelPrice = 0
		pricing.BillingMode = ""
		pricing.BillingExpr = ""
	}
	return true
}

// canonicalModelTag classifies a model into the catalog's six model
// categories. The catalog shows one primary category per model so the tag
// filter stays stable instead of exposing arbitrary provider tags.
func canonicalModelTag(name string, meta *Model, endpoints []constant.EndpointType) string {
	parts := []string{strings.ToLower(strings.TrimSpace(name))}
	for _, endpoint := range endpoints {
		parts = append(parts, strings.ToLower(string(endpoint)))
	}
	if meta != nil {
		parts = append(parts,
			strings.ToLower(meta.InputModalities),
			strings.ToLower(meta.OutputModalities),
			strings.ToLower(meta.Tags),
		)
	}
	haystack := strings.Join(parts, " ")

	has := func(words ...string) bool {
		for _, word := range words {
			if strings.Contains(haystack, word) {
				return true
			}
		}
		return false
	}
	switch {
	case has("omni", "realtime", "s2s", "speech-to-speech"):
		return "Omni"
	case has("embedding", "embeddings", "rerank", "vector"):
		return "Embedding"
	case has("video", "sora", "veo", "kling", "seedance"):
		return "Video"
	case has("tts", "asr", "audio", "speech", "transcription", "voice"):
		return "Audio"
	case has("image", "dall-e", "dalle", "flux", "stable-diffusion", "seedream", "wanx"):
		return "Image"
	default:
		return "Text"
	}
}

func updatePricing() {
	//modelRatios := common.GetModelRatios()
	enableAbilities, err := GetAllEnableAbilityWithChannels()
	if err != nil {
		common.SysLog(common.LogText("GetAllEnableAbilityWithChannels error: %v", err))
		return
	}
	// 预加载模型元数据与供应商一次，避免循环查询
	var allMeta []Model
	_ = DB.Find(&allMeta).Error
	names := make([]string, 0, len(enableAbilities))
	for _, ability := range enableAbilities {
		names = append(names, ability.Model)
	}
	metaMap := resolveModelMetadata(allMeta, names)

	// 预加载供应商
	var vendors []Vendor
	_ = DB.Find(&vendors).Error
	vendorMap := make(map[int]*Vendor)
	for i := range vendors {
		vendorMap[vendors[i].Id] = &vendors[i]
	}

	// 初始化默认供应商映射
	initDefaultVendorMapping(metaMap, vendorMap, enableAbilities)

	// 构建对前端友好的供应商列表
	vendorsList = make([]PricingVendor, 0, len(vendorMap))
	for _, v := range vendorMap {
		vendorsList = append(vendorsList, PricingVendor{
			ID:          v.Id,
			Name:        v.Name,
			Description: v.Description,
			Icon:        v.Icon,
		})
	}

	modelGroupsMap := make(map[string]*types.Set[string])
	modelChannelsMap := make(map[string]*types.Set[string])
	channelTypeByName := make(map[string]int)

	for _, ability := range enableAbilities {
		groups, ok := modelGroupsMap[ability.Model]
		if !ok {
			groups = types.NewSet[string]()
			modelGroupsMap[ability.Model] = groups
		}
		groups.Add(ability.Group)

		channelName := strings.TrimSpace(ability.ChannelName)
		if channelName == "" || ability.ChannelStatus != common.ChannelStatusEnabled {
			continue
		}
		channels, ok := modelChannelsMap[ability.Model]
		if !ok {
			channels = types.NewSet[string]()
			modelChannelsMap[ability.Model] = channels
		}
		channels.Add(channelName)
		if existing, ok := channelTypeByName[channelName]; !ok || ability.ChannelType < existing {
			channelTypeByName[channelName] = ability.ChannelType
		}
	}

	pricingChannelsList = make([]PricingChannel, 0, len(channelTypeByName))
	channelNames := make([]string, 0, len(channelTypeByName))
	for name := range channelTypeByName {
		channelNames = append(channelNames, name)
	}
	slices.Sort(channelNames)
	for _, name := range channelNames {
		pricingChannelsList = append(pricingChannelsList, PricingChannel{Name: name, Type: channelTypeByName[name]})
	}

	//这里使用切片而不是Set，因为一个模型可能支持多个端点类型，并且第一个端点是优先使用端点
	modelSupportEndpointsStr := make(map[string][]string)
	advancedCustomConfigs := loadPricingAdvancedCustomConfigs(enableAbilities)

	// 先根据已有能力填充原生端点
	for _, ability := range enableAbilities {
		endpoints := modelSupportEndpointsStr[ability.Model]
		channelTypes := getPricingEndpointTypesForAbility(ability, advancedCustomConfigs)
		for _, channelType := range channelTypes {
			if !common.StringsContains(endpoints, string(channelType)) {
				endpoints = append(endpoints, string(channelType))
			}
		}
		modelSupportEndpointsStr[ability.Model] = endpoints
	}

	// 再补充模型自定义端点：若配置有效则追加到已有推断，不再裁剪渠道真实能力
	for modelName, meta := range metaMap {
		if strings.TrimSpace(meta.Endpoints) == "" {
			continue
		}
		var raw map[string]any
		if err := common.Unmarshal([]byte(meta.Endpoints), &raw); err == nil {
			endpoints := modelSupportEndpointsStr[modelName]
			for k, v := range raw {
				switch v.(type) {
				case string, map[string]any:
					endpoints = appendPricingEndpoint(endpoints, k)
				}
			}
			if len(endpoints) > 0 {
				modelSupportEndpointsStr[modelName] = endpoints
			}
		}
	}

	modelSupportEndpointTypes = make(map[string][]constant.EndpointType)
	for model, endpoints := range modelSupportEndpointsStr {
		supportedEndpoints := make([]constant.EndpointType, 0)
		for _, endpointStr := range endpoints {
			endpointType := constant.EndpointType(endpointStr)
			supportedEndpoints = append(supportedEndpoints, endpointType)
		}
		modelSupportEndpointTypes[model] = supportedEndpoints
	}

	// 构建全局 supportedEndpointMap（默认 + 自定义覆盖）
	supportedEndpointMap = make(map[string]common.EndpointInfo)
	// 1. 默认端点
	for _, endpoints := range modelSupportEndpointTypes {
		for _, et := range endpoints {
			if info, ok := common.GetDefaultEndpointInfo(et); ok {
				if _, exists := supportedEndpointMap[string(et)]; !exists {
					supportedEndpointMap[string(et)] = info
				}
			}
		}
	}
	// 2. 自定义端点（models 表）覆盖默认
	for _, meta := range metaMap {
		if strings.TrimSpace(meta.Endpoints) == "" {
			continue
		}
		var raw map[string]any
		if err := common.Unmarshal([]byte(meta.Endpoints), &raw); err == nil {
			for k, v := range raw {
				switch val := v.(type) {
				case string:
					supportedEndpointMap[k] = common.EndpointInfo{Path: val, Method: "POST"}
				case map[string]any:
					ep := common.EndpointInfo{Method: "POST"}
					if p, ok := val["path"].(string); ok {
						ep.Path = p
					}
					if m, ok := val["method"].(string); ok {
						ep.Method = strings.ToUpper(m)
					}
					supportedEndpointMap[k] = ep
				default:
					// ignore unsupported types
				}
			}
		}
	}

	channelPrices, channelPricesByChannel := loadChannelInternalPrices(enableAbilities)
	pricingMap = make([]Pricing, 0)
	pluginGeneration := jsplugin.DefaultRegistry.Generation()
	for model, groups := range modelGroupsMap {
		pricing := Pricing{
			ModelName:              model,
			EnableGroup:            groups.Items(),
			SupportedEndpointTypes: modelSupportEndpointTypes[model],
		}
		if channelSet, ok := modelChannelsMap[model]; ok {
			channels := channelSet.Items()
			slices.Sort(channels)
			pricing.Channels = channels
		}

		// 补充模型元数据（描述、标签、供应商、状态）
		if meta, ok := metaMap[model]; ok {
			// 若模型被禁用(status!=1)，则直接跳过，不返回给前端
			if meta.Status != 1 {
				continue
			}
			pricing.Description = meta.Description
			// 多语副本必须随定价一起下发：前端靠它在切换界面语言时本地重绘，
			// 拿不到就只能一直显示 Description 这一种语言。
			//
			// 这里刻意复制一份而不是直接引用：pricingMap 是跨请求共享的缓存，
			// 共享 meta.Descriptions 会让任何下游（如 controller 的按语言解析）
			// 的原地修改污染缓存里的其他语种。
			if len(meta.Descriptions) > 0 {
				pricing.Descriptions = make(map[string]string, len(meta.Descriptions))
				maps.Copy(pricing.Descriptions, meta.Descriptions)
			}
			pricing.Tags = canonicalModelTag(model, meta, modelSupportEndpointTypes[model])
			pricing.VendorID = meta.VendorID
			// 目录规格直接下发给定价页。这些字段由「同步资料」从 models.dev 与
			// basellm 双源合并写入 models 表，未同步时为 0 / 空，前端据此隐藏对应格子。
			//
			// 模态在库里是逗号分隔串，这里拆成数组再下发：前端要做成标签列表，
			// 让它对字符串再 split 一次等于把解析责任推给两端，格式一改就两边不同步。
			pricing.ContextLength = meta.ContextLength
			pricing.MaxOutputTokens = meta.MaxOutputTokens
			pricing.KnowledgeCutoff = meta.KnowledgeCutoff
			pricing.ReleaseDate = meta.ReleaseDate
			pricing.InputModalities = splitCatalogModalities(meta.InputModalities)
			pricing.OutputModalities = splitCatalogModalities(meta.OutputModalities)
			// 入库模型若图标为空，按名称归因到自己的产品 logo，
			// 与同家族模型保持一致，避免卡片回落到首字母占位。
			if meta.Icon != "" {
				pricing.Icon = meta.Icon
			} else if icon := defaultProductIconForModel(model); icon != "" {
				pricing.Icon = icon
			}
		} else {
			pricing.Tags = canonicalModelTag(model, nil, modelSupportEndpointTypes[model])
			// 未入库（无元数据）的模型：按模型名归因到自己的产品 logo，
			// 与同家族已入库模型保持一致。否则卡片会回落到首字母占位，
			// 即用户看到的「logo 变成不存在」。defaultProductIconForModel
			// 只在 @lobehub/icons 存在可渲染变体时才返回，否则回落空串。
			if icon := defaultProductIconForModel(model); icon != "" {
				pricing.Icon = icon
			}
		}
		modelPrice, findPrice := ratio_setting.GetModelPrice(model, false)
		if findPrice {
			pricing.ModelPrice = modelPrice
			pricing.QuotaType = 1
		} else {
			modelRatio, _, _ := ratio_setting.GetModelRatio(model)
			pricing.ModelRatio = modelRatio
			pricing.CompletionRatio = ratio_setting.GetCompletionRatio(model)
			pricing.QuotaType = 0
		}
		if cacheRatio, ok := ratio_setting.GetCacheRatio(model); ok {
			pricing.CacheRatio = &cacheRatio
		}
		if createCacheRatio, ok := ratio_setting.GetCreateCacheRatio(model); ok {
			pricing.CreateCacheRatio = &createCacheRatio
		}
		if imageRatio, ok := ratio_setting.GetImageRatio(model); ok {
			pricing.ImageRatio = &imageRatio
		}
		channelPriceApplied := false
		if channelPrice, ok := channelPrices[model]; ok {
			channelPriceApplied = applyChannelPriceDisplay(&pricing, channelPriceDisplayView(channelPrice.channelName, channelPrice))
		}
		if perChannel := channelPricesByChannel[model]; len(perChannel) > 0 {
			entries := make(map[string]PricingChannelPrice, len(perChannel))
			for name, candidate := range perChannel {
				entries[name] = channelPriceDisplayView(name, candidate)
			}
			pricing.ChannelPrices = entries
		}
		if ratio_setting.ContainsAudioRatio(model) {
			audioRatio := ratio_setting.GetAudioRatio(model)
			pricing.AudioRatio = &audioRatio
		}
		if ratio_setting.ContainsAudioCompletionRatio(model) {
			audioCompletionRatio := ratio_setting.GetAudioCompletionRatio(model)
			pricing.AudioCompletionRatio = &audioCompletionRatio
		}
		if channelPrice, ok := channelPrices[model]; ok {
			if channelPrice.audioRatio > 0 {
				audioRatio := channelPrice.audioRatio
				pricing.AudioRatio = &audioRatio
			}
			if channelPrice.audioCompletion > 0 {
				audioCompletion := channelPrice.audioCompletion
				pricing.AudioCompletionRatio = &audioCompletion
			}
		}
		if !channelPriceApplied {
			if billingMode := billing_setting.GetBillingMode(model); billingMode == "tiered_expr" {
				if expr, ok := billing_setting.GetBillingExpr(model); ok && strings.TrimSpace(expr) != "" {
					pricing.BillingMode = billingMode
					pricing.BillingExpr = expr
				}
			} else if target, resolved := ResolveTaskModelAlias(pluginGeneration, model); resolved && target.Declared != "" {
				if tailMode := billing_setting.GetBillingMode(target.Declared); tailMode == "tiered_expr" {
					if expr, ok := billing_setting.GetBillingExpr(target.Declared); ok && strings.TrimSpace(expr) != "" {
						pricing.BillingMode = tailMode
						pricing.BillingExpr = expr
					}
				}
			}
		}
		usageModel := model
		plugin, ok := pluginGeneration.GetByModel(model)
		if !ok {
			if target, resolved := ResolveTaskModelAlias(pluginGeneration, model); resolved {
				plugin, ok = pluginGeneration.Get(target.PluginKey)
				usageModel = target.Declared
			}
		}
		if ok && plugin != nil {
			usageSchema, usageExamples := plugin.Meta.UsageForModel(usageModel)
			pricing.BillingUsageSchema = jsplugin.CloneUsageSchema(usageSchema)
			pricing.BillingUsageExamples = jsplugin.CloneUsageExamples(usageExamples)
		}
		providers := pluginGeneration.PluginsByModel(model)
		hasProviderOverride := false
		for _, provider := range providers {
			if _, configured := billing_setting.GetPluginBillingExpr(provider.Meta.Key, model); configured {
				hasProviderOverride = true
				break
			}
		}
		if !channelPriceApplied && (hasProviderOverride || (len(providers) >= 2 && pricing.BillingMode == billing_setting.BillingModeTieredExpr)) {
			for _, provider := range providers {
				schema, examples := provider.Meta.UsageForModel(model)
				if schema == nil {
					schema = map[string]jsplugin.UsageFieldSchema{}
				}
				expression, hasExpression := billing_setting.ResolveTaskBillingExpr(provider.Meta.Key, model, "")
				mode := billing_setting.BillingModeRatio
				if hasExpression || billing_setting.GetBillingMode(model) == billing_setting.BillingModeTieredExpr {
					mode = billing_setting.BillingModeTieredExpr
				}
				if mode == billing_setting.BillingModeTieredExpr && !billing_setting.TaskExprCompatible(expression, schema) {
					expression = ""
				}
				pricing.BillingPluginVariants = append(pricing.BillingPluginVariants, PricingPluginVariant{
					PluginKey: provider.Meta.Key, PluginName: provider.Meta.Name, Icon: provider.Meta.Icon,
					BillingExpr: expression, BillingMode: mode,
					BillingUsageSchema: jsplugin.CloneUsageSchema(schema), BillingUsageExamples: jsplugin.CloneUsageExamples(examples),
				})
			}
		}
		pricingMap = append(pricingMap, pricing)
	}

	// 防止大更新后数据不通用
	if len(pricingMap) > 0 {
		pricingMap[0].PricingVersion = "5a90f2b86c08bd983a9a2e6d66c255f4eaef9c4bc934386d2b6ae84ef0ff1f1f"
	}

	// 刷新缓存映射，供高并发快速查询
	modelEnableGroupsLock.Lock()
	modelEnableGroups = make(map[string][]string)
	modelQuotaTypeMap = make(map[string]int)
	for _, p := range pricingMap {
		modelEnableGroups[p.ModelName] = p.EnableGroup
		modelQuotaTypeMap[p.ModelName] = p.QuotaType
	}
	modelEnableGroupsLock.Unlock()

	lastGetPricingTime = time.Now()
}

// GetSupportedEndpointMap 返回全局端点到路径的映射
func GetSupportedEndpointMap() map[string]common.EndpointInfo {
	return supportedEndpointMap
}
