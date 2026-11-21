package controller

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/pkg/billingexpr"
	"github.com/uter-ai/uter/service"
	"github.com/uter-ai/uter/setting/billing_setting"
)

// APIKO 的控制面与公开目录接口。
//
// APIKO 的中转域名 api.apiko.app 只暴露 OpenAI/Anthropic 兼容的 /v1/*
// 路径，没有 new-api 的 /api/pricing；模型目录与价格由控制面公开提供，
// 不需要 API Key：
//
//	GET https://apiko.app/api/public/models?billing=all
//
// 返回的 pricing 是 APIKO 的售价（USD/百万 token 或每次调用），正是本渠道
// 应同步给 Uter 的默认价。
// apikoControlPlaneBase is the control-plane origin; a variable so tests can
// point it at a local server. Production always uses the constant below.
var apikoControlPlaneBase = apikoControlPlaneURL

const (
	apikoControlPlaneURL   = "https://apiko.app"
	apikoPublicModelsPath  = "/api/public/models?billing=all"
	apikoMaxCatalogBytes   = 8 << 20
	apikoCatalogTimeoutSec = 20
)

type apikoContextTier struct {
	UpTo        *float64 `json:"upTo"`
	InputPer1M  *float64 `json:"inputPer1M"`
	OutputPer1M *float64 `json:"outputPer1M"`
	CachePer1M  *float64 `json:"cachePer1M"`
}

type apikoPricing struct {
	InputPer1M     *float64           `json:"inputPer1M"`
	OutputPer1M    *float64           `json:"outputPer1M"`
	CachePer1M     *float64           `json:"cachePer1M"`
	PerCall        *float64           `json:"perCall"`
	Tiers          []jsonTier         `json:"tiers"`
	ContextTiers   []apikoContextTier `json:"contextTiers"`
	PerSecondTiers []jsonTier         `json:"perSecondTiers"`
	TokenImage     *apikoTokenImage   `json:"tokenImage"`
	Currency       string             `json:"currency"`
}

// apikoTokenImage prices an image model by tokens, which is resolution
// independent and matches Uter's image billing variables.
type apikoTokenImage struct {
	TextInputPer1M  *float64 `json:"textInputPer1M"`
	ImageInputPer1M *float64 `json:"imageInputPer1M"`
	OutputPer1M     *float64 `json:"outputPer1M"`
}

type jsonTier struct {
	Name      string   `json:"name"`
	PerCall   *float64 `json:"perCall"`
	PerSecond *float64 `json:"perSecond"`
}

type apikoModel struct {
	ID           string       `json:"id"`
	Provider     string       `json:"provider"`
	Capabilities []string     `json:"capabilities"`
	Pricing      apikoPricing `json:"pricing"`
}

// apikoSkippedModel is one catalogue row the sync cannot price faithfully.
// Reason is a stable code the console translates; see the frontend mapping.
type apikoSkippedModel struct {
	Model  string
	Reason string
}

type apikoCatalog struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    struct {
		Models []apikoModel `json:"models"`
		Total  int          `json:"total"`
	} `json:"data"`
}

// apikoControlPlaneFor reports the control-plane origin that serves the public
// catalogue for an upstream base URL, when the upstream is APIKO.
func apikoControlPlaneFor(rawBaseURL string) (string, bool) {
	raw := strings.TrimSpace(rawBaseURL)
	if raw == "" {
		return "", false
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" {
		parsed, err = url.Parse("https://" + raw)
		if err != nil || parsed.Host == "" {
			return "", false
		}
	}
	host := strings.ToLower(parsed.Hostname())
	if host == "apiko.app" || host == "api.apiko.app" || strings.HasSuffix(host, ".apiko.app") {
		return apikoControlPlaneBase, true
	}
	return "", false
}

// fetchApikoPricingData turns APIKO's public catalogue into the pricing-sync
// shape: a billing expression per model, in USD/1M tokens (or per request).
// Models whose pricing cannot be expressed faithfully are skipped.
func fetchApikoPricingData(ctx context.Context, controlPlane string) (map[string]any, []apikoSkippedModel, error) {
	models, err := fetchApikoCatalog(ctx, controlPlane)
	if err != nil {
		return nil, nil, err
	}
	return apikoModelsToPricingSyncData(models)
}

// fetchApikoCatalog reads the public control-plane catalogue. It is the
// authoritative model list and price source; the relay host only serves
// OpenAI/Anthropic compatible endpoints and may not expose /v1/models.
func fetchApikoCatalog(ctx context.Context, controlPlane string) ([]apikoModel, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, controlPlane+apikoPublicModelsPath, nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("User-Agent", "uter-price-sync")

	response, err := (&http.Client{Timeout: apikoCatalogTimeoutSec * time.Second}).Do(request)
	if err != nil {
		return nil, fmt.Errorf("apiko catalogue request failed: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("apiko catalogue returned %s", response.Status)
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, apikoMaxCatalogBytes))
	if err != nil {
		return nil, err
	}
	var catalog apikoCatalog
	if err := common.Unmarshal(body, &catalog); err != nil {
		return nil, fmt.Errorf("apiko catalogue is not valid JSON: %w", err)
	}
	if catalog.Code != 0 {
		return nil, fmt.Errorf("apiko catalogue error: %s", catalog.Message)
	}
	return catalog.Data.Models, nil
}

// apikoFetchModelsResponse is a seam so tests can exercise the authenticated
// list without the process-wide HTTP client other tests configure.
var apikoFetchModelsResponse = getFetchModelsResponseBody

// fetchApikoModelIDs returns the models a channel can actually call. With a
// key it asks the authenticated /v1/models endpoint; without one (or when that
// call fails) it falls back to the public catalogue, which still lists every
// public model.
func fetchApikoModelIDs(channel *model.Channel) ([]string, error) {
	// The public catalogue is the full upstream model list. The relay's
	// /v1/models is key-scoped and only returns the subset enabled for that
	// key, so it must not define what the channel can serve.
	ids, catalogueErr := fetchApikoCatalogueModelIDs("")
	if catalogueErr == nil {
		return ids, nil
	}
	baseURL := strings.TrimRight(strings.TrimSpace(channel.GetBaseURL()), "/")
	if key, _, apiErr := channel.GetNextEnabledKey(); apiErr == nil && strings.TrimSpace(key) != "" && baseURL != "" {
		headers, headerErr := buildFetchModelsHeaders(channel, strings.TrimSpace(key))
		if headerErr == nil {
			if body, err := apikoFetchModelsResponse(http.MethodGet, baseURL+"/v1/models", channel, headers); err == nil {
				var result OpenAIModelsResponse
				if common.Unmarshal(body, &result) == nil {
					fallback := make([]string, 0, len(result.Data))
					seen := make(map[string]bool, len(result.Data))
					for _, item := range result.Data {
						id := strings.TrimSpace(item.ID)
						if id == "" || seen[id] {
							continue
						}
						seen[id] = true
						fallback = append(fallback, id)
					}
					if len(fallback) > 0 {
						sort.Strings(fallback)
						return fallback, nil
					}
				}
			}
		}
	}
	return nil, catalogueErr
}

// fetchApikoCatalogueModelIDs returns the catalogue model IDs for the model
// sync action. A blank base URL falls back to the production control plane so
// a channel created with the default address still syncs.
func fetchApikoCatalogueModelIDs(baseURL string) ([]string, error) {
	controlPlane := apikoControlPlaneBase
	if strings.TrimSpace(baseURL) != "" {
		origin, ok := apikoControlPlaneFor(baseURL)
		if !ok {
			return nil, fmt.Errorf("channel base URL is not an Apiko address")
		}
		controlPlane = origin
	}
	ctx, cancel := context.WithTimeout(context.Background(), apikoCatalogTimeoutSec*time.Second)
	defer cancel()
	models, err := fetchApikoCatalog(ctx, controlPlane)
	if err != nil {
		return nil, err
	}
	seen := make(map[string]bool, len(models))
	ids := make([]string, 0, len(models))
	for _, model := range models {
		id := strings.TrimSpace(model.ID)
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return nil, fmt.Errorf("apiko catalogue has no models")
	}
	sort.Strings(ids)
	return ids, nil
}

func apikoModelsToPricingSyncData(models []apikoModel) (map[string]any, []apikoSkippedModel, error) {
	modes := make(map[string]any, len(models))
	expressions := make(map[string]any, len(models))
	skipped := make([]apikoSkippedModel, 0)
	for _, model := range models {
		if strings.TrimSpace(model.ID) == "" {
			continue
		}
		expr, ok := apikoPriceExpression(model)
		if !ok {
			skipped = append(skipped, apikoSkippedModel{Model: model.ID, Reason: apikoSkipReason(model)})
			continue
		}
		if _, err := billingexpr.CompileFromCache(expr); err != nil {
			skipped = append(skipped, apikoSkippedModel{Model: model.ID, Reason: "invalid_expression"})
			continue
		}
		modes[model.ID] = billing_setting.BillingModeTieredExpr
		expressions[model.ID] = expr
	}
	if len(expressions) == 0 {
		return nil, skipped, fmt.Errorf("apiko catalogue has no pricing this sync can represent")
	}
	return map[string]any{
		billing_setting.BillingModeField: modes,
		billing_setting.BillingExprField: expressions,
	}, skipped, nil
}

// apikoSkipReason names why a row was not priced, as a stable code the console
// turns into copy. It never inspects request content, only the catalogue shape.
func apikoSkipReason(model apikoModel) string {
	pricing := model.Pricing
	if len(pricing.PerSecondTiers) > 0 {
		return "duration_tiered"
	}
	if len(pricing.Tiers) > 0 && apikoHasCapability(model.Capabilities, "image") {
		return "resolution_tiered"
	}
	return "no_direct_price"
}

// apikoPriceExpression compiles one catalogue row into a billing expression.
// Only token-priced models (chat/audio) and flat per-request prices are
// represented; resolution- or duration-tiered media prices need request
// parameters the expression cannot see, so they are skipped rather than
// guessed.
func apikoPriceExpression(model apikoModel) (string, bool) {
	pricing := model.Pricing
	if len(pricing.ContextTiers) > 0 {
		expr, ok := apikoContextTiersExpression(pricing.ContextTiers)
		return expr, ok
	}
	if pricing.TokenImage != nil {
		terms := apikoImageTokenTerms(pricing.TokenImage)
		if terms == "" {
			return "", false
		}
		return `tier("base", ` + terms + `)`, true
	}
	if pricing.InputPer1M != nil || pricing.OutputPer1M != nil {
		terms := apikoTokenTerms(
			apikoValue(pricing.InputPer1M),
			apikoValue(pricing.OutputPer1M),
			apikoValue(pricing.CachePer1M),
		)
		if terms == "" {
			return "", false
		}
		return `tier("base", ` + terms + `)`, true
	}
	// 分辨率分档图片：档位价格在 tiers 里，模型级 perCall 可能为空。
	if len(pricing.Tiers) > 0 {
		if len(pricing.PerSecondTiers) > 0 || !apikoHasCapability(model.Capabilities, "image") {
			return "", false
		}
		// 按产品映射把 size/resolution 编译为条件，未知参数回退最高档。
		return apikoImageTierExpression(model)
	}
	if pricing.PerCall != nil && *pricing.PerCall > 0 {
		if len(pricing.PerSecondTiers) > 0 {
			return "", false
		}
		price := apikoNumber(*pricing.PerCall)
		// 图片按次计价必须乘上实际张数，否则 n>1 只收一张的钱。
		if apikoHasCapability(model.Capabilities, "image") {
			return `tier("image", fixed(` + price + `)) * image_count`, true
		}
		return `tier("request", fixed(` + price + `))`, true
	}
	return "", false
}

func apikoImageTokenTerms(tokenImage *apikoTokenImage) string {
	terms := make([]string, 0, 3)
	if value := apikoValue(tokenImage.TextInputPer1M); value > 0 {
		terms = append(terms, "p * "+apikoNumber(value))
	}
	if value := apikoValue(tokenImage.ImageInputPer1M); value > 0 {
		terms = append(terms, "img * "+apikoNumber(value))
	}
	if value := apikoValue(tokenImage.OutputPer1M); value > 0 {
		terms = append(terms, "c * "+apikoNumber(value))
	}
	return strings.Join(terms, " + ")
}

func apikoHasCapability(capabilities []string, want string) bool {
	for _, capability := range capabilities {
		if strings.EqualFold(capability, want) {
			return true
		}
	}
	return false
}

func apikoContextTiersExpression(tiers []apikoContextTier) (string, bool) {
	if len(tiers) == 0 {
		return "", false
	}
	expr := ""
	for index := len(tiers) - 1; index >= 0; index-- {
		tier := tiers[index]
		terms := apikoTokenTerms(
			apikoValue(tier.InputPer1M),
			apikoValue(tier.OutputPer1M),
			apikoValue(tier.CachePer1M),
		)
		if terms == "" {
			return "", false
		}
		current := fmt.Sprintf(`tier("tier_%d", %s)`, index+1, terms)
		if tier.UpTo == nil {
			expr = current
			continue
		}
		if expr == "" {
			continue
		}
		expr = fmt.Sprintf("len <= %s ? %s : %s", apikoNumber(*tier.UpTo), current, expr)
	}
	return expr, expr != ""
}

func apikoTokenTerms(inputPer1M, outputPer1M, cachePer1M float64) string {
	terms := make([]string, 0, 3)
	if inputPer1M > 0 {
		terms = append(terms, "p * "+apikoNumber(inputPer1M))
	}
	if outputPer1M > 0 {
		terms = append(terms, "c * "+apikoNumber(outputPer1M))
	}
	if cachePer1M > 0 {
		terms = append(terms, "cr * "+apikoNumber(cachePer1M))
	}
	return strings.Join(terms, " + ")
}

func apikoValue(value *float64) float64 {
	if value == nil || math.IsNaN(*value) || math.IsInf(*value, 0) || *value < 0 {
		return 0
	}
	return *value
}

func apikoNumber(value float64) string {
	if value == math.Trunc(value) {
		return strconv.FormatInt(int64(value), 10)
	}
	return strconv.FormatFloat(value, 'f', -1, 64)
}

// SyncApikoChannelModels adds every model the public Apiko catalogue lists to
// an existing channel's model list. Models that a previous complete snapshot
// listed but the current catalogue no longer contains are removed from the
// active list while their pricing history stays in channel_model_pricing.
func SyncApikoChannelModels(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	channel, err := model.GetChannelById(channelID, true)
	if err != nil || channel == nil {
		common.ApiErrorT(c, "Channel not found")
		return
	}
	if channel.Type != constant.ChannelTypeApiko {
		common.ApiErrorMsg(c, "This channel is not an Apiko channel")
		return
	}
	ids, err := fetchApikoModelIDs(channel)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	previous := loadApikoCatalogSnapshot(channelID)
	removed := apikoRemovedModels(previous, ids)
	existing := channel.GetModels()
	kept := filterApikoModels(existing, removed)
	merged, added := mergeApikoModelIDs(kept, ids)
	if added > 0 || len(removed) > 0 {
		channel.Models = strings.Join(merged, ",")
		if err := model.DB.Model(channel).Update("models", channel.Models).Error; err != nil {
			common.ApiError(c, err)
			return
		}
		if err := channel.UpdateAbilities(nil); err != nil {
			common.SysError(common.LogText("apiko channel abilities update failed: channel_id=%d, error=%v", channelID, err))
		}
		model.BumpSyncTopic(model.SyncTopicChannels)
		refreshChannelRuntimeCache()
	}
	pricingCount, pricingErr := applyApikoChannelPricing(channel, ids)
	saveApikoCatalogSnapshot(channelID, ids)
	if len(ids) > 0 {
		if _, _, _, lifecycleErr := model.ApplyChannelLifecycleSnapshot(
			channelID, ids, time.Now().Unix(), model.ChannelModelMissingDisableThreshold,
		); lifecycleErr != nil {
			common.SysError(common.LogText("apiko lifecycle update failed: channel_id=%d, error=%v", channelID, lifecycleErr))
		}
	}
	response := gin.H{
		"channel_id":      channelID,
		"fetched":         len(ids),
		"total":           len(merged),
		"added":           added,
		"removed":         len(removed),
		"pricing_records": pricingCount,
		"models":          merged,
	}
	if pricingErr != nil {
		response["pricing_error"] = pricingErr.Error()
	}
	common.ApiSuccess(c, response)
}

// mergeApikoModelIDs keeps the operator's order and appends missing catalogue
// IDs once, so repeated syncs are idempotent.
func mergeApikoModelIDs(existing, fetched []string) ([]string, int) {
	seen := make(map[string]bool, len(existing)+len(fetched))
	merged := make([]string, 0, len(existing)+len(fetched))
	for _, name := range existing {
		name = strings.TrimSpace(name)
		if name == "" || seen[name] {
			continue
		}
		seen[name] = true
		merged = append(merged, name)
	}
	added := 0
	for _, name := range fetched {
		name = strings.TrimSpace(name)
		if name == "" || seen[name] {
			continue
		}
		seen[name] = true
		merged = append(merged, name)
		added++
	}
	return merged, added
}

const apikoCatalogSnapshotPrefix = "ApikoCatalogSnapshot:"

func loadApikoCatalogSnapshot(channelID int) []string {
	raw := strings.TrimSpace(common.GetOption(apikoCatalogSnapshotPrefix + strconv.Itoa(channelID)))
	if raw == "" {
		return nil
	}
	var models []string
	if err := common.UnmarshalJsonStr(raw, &models); err != nil {
		return nil
	}
	return models
}

func saveApikoCatalogSnapshot(channelID int, models []string) {
	encoded, err := common.Marshal(models)
	if err != nil {
		return
	}
	if err := model.UpdateOption(apikoCatalogSnapshotPrefix+strconv.Itoa(channelID), string(encoded)); err != nil {
		common.SysError(common.LogText("persist apiko catalog snapshot failed: channel_id=%d, error=%v", channelID, err))
	}
}

func apikoRemovedModels(previous, current []string) map[string]bool {
	currentSet := make(map[string]bool, len(current))
	for _, name := range current {
		currentSet[strings.TrimSpace(name)] = true
	}
	removed := make(map[string]bool)
	for _, name := range previous {
		name = strings.TrimSpace(name)
		if name != "" && !currentSet[name] {
			removed[name] = true
		}
	}
	return removed
}

func filterApikoModels(models []string, removed map[string]bool) []string {
	if len(removed) == 0 {
		return models
	}
	out := make([]string, 0, len(models))
	for _, name := range models {
		if !removed[strings.TrimSpace(name)] {
			out = append(out, name)
		}
	}
	return out
}

type apikoChannelPricing struct {
	records   []model.ChannelOfficialPricingRecord
	internals map[string]model.ChannelInternalPricing
	skipped   []apikoSkippedModel
}

// buildApikoChannelPricing converts the public catalogue into channel-scoped
// official rows and, where the shape is executable, an initial sale price.
// Unsupported resolution/duration tiers are recorded with a review reason
// instead of being priced from the first tier.
func buildApikoChannelPricing(models []apikoModel, channelID int, now time.Time) apikoChannelPricing {
	result := apikoChannelPricing{
		records:   make([]model.ChannelOfficialPricingRecord, 0, len(models)),
		internals: make(map[string]model.ChannelInternalPricing, len(models)),
		skipped:   make([]apikoSkippedModel, 0),
	}
	for _, item := range models {
		id := strings.TrimSpace(item.ID)
		if id == "" {
			continue
		}
		official := model.ChannelOfficialPricing{
			Currency: "USD", Unit: "per_1m_token", Source: "apiko-official", FetchedAt: now.Unix(),
		}
		var internal *model.ChannelInternalPricing
		review := func(reason string) {
			official.ReviewReasons = append(official.ReviewReasons, reason)
			result.skipped = append(result.skipped, apikoSkippedModel{Model: id, Reason: reason})
		}
		switch {
		case len(item.Pricing.ContextTiers) > 0:
			tiers, reason := apikoContextTiers(item.Pricing.ContextTiers)
			if reason != "" {
				review(reason)
				break
			}
			official.Tiers = tiers
			converted := make([]model.ChannelInternalPricingTier, 0, len(tiers))
			for _, tier := range tiers {
				converted = append(converted, model.ChannelInternalPricingTier{
					RangeName: tier.RangeName, MinInputTokens: tier.MinInputTokens, MaxInputTokens: tier.MaxInputTokens,
					InputUSDPerMillion: tier.InputPerMillionUSD, OutputUSDPerMillion: tier.OutputPerMillionUSD,
					CacheUSDPerMillion: tier.CachePerMillionUSD, Unit: "per_1m_token",
				})
			}
			internal = &model.ChannelInternalPricing{Mode: model.ChannelPricingModeTieredTable, Tiers: converted, Source: "apiko-official", UpdatedAt: now.Unix()}
		case item.Pricing.InputPer1M != nil || item.Pricing.OutputPer1M != nil:
			if len(item.Pricing.Tiers) > 0 {
				review("resolution-tiered pricing requires request parameters")
				official.Tiers = apikoFlatTokenTier(item.Pricing)
				break
			}
			if len(item.Pricing.PerSecondTiers) > 0 {
				review("duration-tiered pricing requires request parameters")
				official.Tiers = apikoFlatTokenTier(item.Pricing)
				break
			}
			tiers := apikoFlatTokenTier(item.Pricing)
			if len(tiers) == 0 || tiers[0].InputPerMillionUSD == nil {
				review("catalog token price is incomplete")
				break
			}
			official.Tiers = tiers
			internal = &model.ChannelInternalPricing{
				Mode:                model.ChannelPricingModePerMillionTokens,
				InputUSDPerMillion:  tiers[0].InputPerMillionUSD,
				OutputUSDPerMillion: tiers[0].OutputPerMillionUSD,
				CacheUSDPerMillion:  tiers[0].CachePerMillionUSD,
				Source:              "apiko-official", UpdatedAt: now.Unix(),
			}
		case item.Pricing.PerCall != nil && len(item.Pricing.Tiers) == 0 && len(item.Pricing.PerSecondTiers) == 0:
			tiers := apikoFlatTokenTier(item.Pricing)
			official.Tiers = tiers
			internal = &model.ChannelInternalPricing{
				Mode: model.ChannelPricingModePerCall, PerCallUSD: item.Pricing.PerCall,
				Source: "apiko-official", UpdatedAt: now.Unix(),
			}
		case len(item.Pricing.Tiers) > 0:
			review("resolution-tiered pricing requires request parameters")
		case len(item.Pricing.PerSecondTiers) > 0:
			review("duration-tiered pricing requires request parameters")
		default:
			review("catalog lists no price")
		}
		if len(official.Tiers) > 0 && official.Unit == "per_1m_token" && official.Tiers[0].InputPerMillionUSD == nil &&
			official.Tiers[0].PerUnitUSD == nil {
			review("catalog token price is incomplete")
			internal = nil
		}
		official.NeedsReview = len(official.ReviewReasons) > 0
		sort.Strings(official.ReviewReasons)
		raw, _ := common.Marshal(item)
		normalized, _ := common.Marshal(official)
		result.records = append(result.records, model.ChannelOfficialPricingRecord{
			ChannelId: channelID, Provider: "apiko", ModelProvider: item.Provider, ModelName: id,
			Currency: "USD", OfficialPricing: string(raw), NormalizedPricing: string(normalized),
			Source: "apiko-official", FetchedAt: now.Unix(),
		})
		if internal != nil && !official.NeedsReview {
			result.internals[id] = *internal
		}
	}
	return result
}

// apikoFlatTokenTier keeps the requested flat USD/1M prices. Per-call prices
// are represented as a per-call tier so the purchase quote stays visible.
func apikoFlatTokenTier(pricing apikoPricing) []model.ChannelPricingTier {
	if pricing.InputPer1M != nil || pricing.OutputPer1M != nil || pricing.CachePer1M != nil {
		tier := model.ChannelPricingTier{RangeName: "Default", Unit: "per_1m_token"}
		if pricing.InputPer1M != nil && *pricing.InputPer1M > 0 {
			tier.InputPerMillionUSD = pricing.InputPer1M
		}
		if pricing.OutputPer1M != nil && *pricing.OutputPer1M > 0 {
			tier.OutputPerMillionUSD = pricing.OutputPer1M
		}
		if pricing.CachePer1M != nil && *pricing.CachePer1M > 0 {
			tier.CachePerMillionUSD = pricing.CachePer1M
		}
		return []model.ChannelPricingTier{tier}
	}
	if pricing.PerCall != nil && *pricing.PerCall > 0 {
		return []model.ChannelPricingTier{{RangeName: "Default", Unit: "per_call", PerUnitUSD: pricing.PerCall}}
	}
	return nil
}

// apikoContextTiers converts ascending upTo bands into explicit ranges.
func apikoContextTiers(tiers []apikoContextTier) ([]model.ChannelPricingTier, string) {
	converted := make([]model.ChannelPricingTier, 0, len(tiers))
	previous := int64(0)
	for index, tier := range tiers {
		if tier.InputPer1M == nil || *tier.InputPer1M <= 0 {
			return nil, "context tier has no input price"
		}
		maxInput := int64(0)
		if tier.UpTo != nil && *tier.UpTo > 0 {
			maxInput = int64(*tier.UpTo)
		}
		name := fmt.Sprintf("tier_%d", index+1)
		if maxInput > 0 {
			name = fmt.Sprintf("%d-%d", previous, maxInput)
		}
		item := model.ChannelPricingTier{
			RangeName: name, MinInputTokens: previous, MaxInputTokens: maxInput,
			Unit: "per_1m_token", InputPerMillionUSD: tier.InputPer1M,
		}
		if tier.OutputPer1M != nil && *tier.OutputPer1M > 0 {
			item.OutputPerMillionUSD = tier.OutputPer1M
		}
		if tier.CachePer1M != nil && *tier.CachePer1M > 0 {
			item.CachePerMillionUSD = tier.CachePer1M
		}
		converted = append(converted, item)
		if maxInput > 0 {
			previous = maxInput
		}
	}
	return converted, ""
}

// SyncApikoChannelPricing writes Apiko catalogue prices into this channel's
// isolated pricing table. Official prices, the operator's later edits and other
// channels stay independent.
func SyncApikoChannelPricing(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelID <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	channel, err := model.GetChannelById(channelID, true)
	if err != nil || channel == nil {
		common.ApiErrorT(c, "Channel not found")
		return
	}
	if channel.Type != constant.ChannelTypeApiko {
		common.ApiErrorMsg(c, "This channel is not an Apiko channel")
		return
	}
	result, err := syncApikoChannelPricing(channel)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, gin.H{
		"channel_id": channelID,
		"fetched":    result.Fetched,
		"recorded":   result.Recorded,
		"seeded":     result.Seeded,
		"skipped":    result.Skipped,
	})
}

type apikoPricingSyncResult struct {
	Fetched  int
	Recorded int
	Seeded   int
	Skipped  []apikoSkippedModel
}

var apikoPricingSyncMu sync.Mutex

// syncApikoChannelPricing fetches the public catalogue and writes this
// channel's price view. Automatic and manual syncs share it so both produce the
// same records and the same operator-price protection.
func syncApikoChannelPricing(channel *model.Channel) (apikoPricingSyncResult, error) {
	var result apikoPricingSyncResult
	apikoPricingSyncMu.Lock()
	defer apikoPricingSyncMu.Unlock()

	controlPlane, ok := apikoControlPlaneFor(channel.GetBaseURL())
	if !ok {
		controlPlane = apikoControlPlaneBase
	}
	ctx, cancel := context.WithTimeout(context.Background(), apikoCatalogTimeoutSec*time.Second)
	defer cancel()
	models, err := fetchApikoCatalog(ctx, controlPlane)
	if err != nil {
		return result, err
	}
	built := buildApikoChannelPricing(models, channel.Id, time.Now().UTC())
	if len(built.records) == 0 {
		return result, errors.New("apiko catalogue has no models")
	}
	written, err := model.UpsertChannelOfficialPricing(built.records)
	if err != nil {
		return result, err
	}
	seeded := 0
	for name, internal := range built.internals {
		identity := model.ChannelPricingIdentity{ChannelId: channel.Id, Provider: "apiko", ModelName: name}
		row, rowErr := model.GetChannelModelPricingFor(identity)
		if rowErr == nil && strings.TrimSpace(row.InternalPricing) != "" {
			var existing model.ChannelInternalPricing
			if common.UnmarshalJsonStr(row.InternalPricing, &existing) == nil &&
				!strings.HasPrefix(existing.Source, "apiko-official") {
				continue
			}
		}
		if err := model.SetChannelInternalPricingFor(identity, internal); err != nil {
			continue
		}
		seeded++
	}
	model.InvalidateChannelPricingCache()
	model.InvalidatePricingCache()
	return apikoPricingSyncResult{
		Fetched: len(models), Recorded: written, Seeded: seeded, Skipped: built.skipped,
	}, nil
}

const apikoUpstreamSyncStateKey = "ApikoUpstreamSyncState"

// ApikoUpstreamSyncTask refreshes Apiko channels on their configured channel
// price cadence. Apiko has no New API /api/pricing endpoint, so it cannot use
// the generic upstream task.
func ApikoUpstreamSyncTask() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		runApikoUpstreamSync(false)
	}
}

func runApikoUpstreamSync(force bool) {
	channels, err := model.GetAllChannels(0, -1, true, true)
	if err != nil {
		return
	}
	now := time.Now().UTC()
	for _, channel := range channels {
		if channel.Type != constant.ChannelTypeApiko {
			continue
		}
		schedule, _ := service.GetChannelPricingSchedule(channel.Id)
		if !schedule.Enabled && !force {
			continue
		}
		_, officialInterval, _ := schedule.EffectiveIntervals()
		if !force && now.Unix()-apikoSyncStateFor(channel.Id) < int64(officialInterval)*60 {
			continue
		}
		if _, err := syncApikoChannelPricing(channel); err != nil {
			common.SysError(common.LogText("apiko pricing sync failed for channel %d: %s", channel.Id, err.Error()))
			continue
		}
		setApikoSyncState(channel.Id, now.Unix())
	}
}

func apikoSyncStateFor(channelID int) int64 {
	raw := strings.TrimSpace(common.GetOption(apikoUpstreamSyncStateKey))
	if raw == "" {
		return 0
	}
	var state map[string]int64
	if err := common.UnmarshalJsonStr(raw, &state); err != nil {
		return 0
	}
	return state[strconv.Itoa(channelID)]
}

func setApikoSyncState(channelID int, at int64) {
	state := map[string]int64{}
	if raw := strings.TrimSpace(common.GetOption(apikoUpstreamSyncStateKey)); raw != "" {
		_ = common.UnmarshalJsonStr(raw, &state)
	}
	state[strconv.Itoa(channelID)] = at
	raw, err := common.Marshal(state)
	if err == nil {
		_ = model.UpdateOption(apikoUpstreamSyncStateKey, string(raw))
	}
}

// applyApikoChannelPricing writes Apiko's public quote and executable
// expression into this channel's isolated pricing rows. Apiko publishes the
// channel price, so the flat tier goes to ChannelPriceTiers and the official
// vendor tier list stays empty.
func applyApikoChannelPricing(channel *model.Channel, ids []string) (int, error) {
	controlPlane, ok := apikoControlPlaneFor(channel.GetBaseURL())
	if !ok {
		controlPlane = apikoControlPlaneBase
	}
	ctx, cancel := context.WithTimeout(context.Background(), apikoCatalogTimeoutSec*time.Second)
	defer cancel()
	models, err := fetchApikoCatalog(ctx, controlPlane)
	if err != nil {
		return 0, err
	}
	return model.UpsertChannelOfficialPricing(apikoChannelPricingRecords(channel.Id, ids, models, time.Now().UTC()))
}

func apikoChannelPricingRecords(channelID int, ids []string, models []apikoModel, now time.Time) []model.ChannelOfficialPricingRecord {
	byID := make(map[string]apikoModel, len(models))
	for _, item := range models {
		byID[item.ID] = item
	}
	records := make([]model.ChannelOfficialPricingRecord, 0, len(ids))
	for _, id := range ids {
		item, exists := byID[id]
		if !exists {
			continue
		}
		expr, priced := apikoPriceExpression(item)
		if !priced {
			continue
		}
		exprInfo := service.NormalizeUpstreamExpression(expr)
		if !exprInfo.Executable {
			continue
		}
		official := model.ChannelOfficialPricing{
			Currency: "USD", Unit: "expression", Source: "apiko-public-catalog",
			FetchedAt: now.Unix(), BillingMode: "tiered_expr",
			BillingExpr: exprInfo.Raw, ExpressionHash: exprInfo.Hash,
			ExpressionStatus: exprInfo.Status,
		}
		if tiers := apikoFlatTokenTier(item.Pricing); len(tiers) > 0 {
			official.ChannelPriceTiers = tiers
			first := tiers[0]
			official.ChannelPrice = &first
		}
		internal := model.ChannelInternalPricing{
			Mode: model.ChannelPricingModeTieredExpr, BillingExpr: exprInfo.Raw,
			Source: "apiko-expression", UpdatedAt: now.Unix(),
		}
		raw, rawErr := common.Marshal(item)
		normalized, normErr := common.Marshal(official)
		internalRaw, internalErr := common.Marshal(internal)
		if rawErr != nil || normErr != nil || internalErr != nil {
			continue
		}
		records = append(records, model.ChannelOfficialPricingRecord{
			ChannelId: channelID, Provider: "apiko", ModelProvider: item.Provider, ModelName: id,
			Currency: "USD", OfficialPricing: string(raw),
			NormalizedPricing: string(normalized), InternalPricing: string(internalRaw),
			Source: "apiko-public-catalog", FetchedAt: now.Unix(),
		})
	}
	return records
}
