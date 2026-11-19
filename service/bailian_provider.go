package service

import (
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/custom_pricing"
	"github.com/uter-ai/uter/setting/operation_setting"
)

// BailianRegion is one official Model Studio region. The regional host is what
// carries a workspace; the generic DashScope host is only a fallback for the
// catalog endpoint, never the channel's configured Base URL.
type BailianRegion string

const (
	BailianRegionBeijing     BailianRegion = "cn-beijing"
	BailianRegionSingapore   BailianRegion = "ap-southeast-1"
	BailianRegionHongKong    BailianRegion = "cn-hongkong"
	BailianRegionGermany     BailianRegion = "eu-central-1"
	BailianRegionJapan       BailianRegion = "ap-northeast-1"
	BailianRegionUS          BailianRegion = "us-east-1"
	BailianRegionUnspecified BailianRegion = ""
)

var bailianRegionHostSuffix = map[BailianRegion]string{
	BailianRegionBeijing:   "cn-beijing.maas.aliyuncs.com",
	BailianRegionSingapore: "ap-southeast-1.maas.aliyuncs.com",
	BailianRegionHongKong:  "cn-hongkong.maas.aliyuncs.com",
	BailianRegionGermany:   "eu-central-1.maas.aliyuncs.com",
	BailianRegionJapan:     "ap-northeast-1.maas.aliyuncs.com",
	BailianRegionUS:        "us-east-1.maas.aliyuncs.com",
}

// BailianRegions lists the regions in a stable order for the admin form and
// for validation.
func BailianRegions() []BailianRegion {
	return []BailianRegion{
		BailianRegionBeijing, BailianRegionSingapore, BailianRegionHongKong,
		BailianRegionGermany, BailianRegionJapan, BailianRegionUS,
	}
}

// BailianWorkspaceBaseURL builds the workspace-scoped Model Studio host. The
// compatible-mode Base URL adds /compatible-mode/v1; the catalog uses
// /api/v1/models on the same host.
func BailianWorkspaceBaseURL(region BailianRegion, workspaceID string) (string, error) {
	workspaceID = strings.TrimSpace(workspaceID)
	if workspaceID == "" {
		return "", fmt.Errorf("bailian workspace ID is empty")
	}
	suffix, ok := bailianRegionHostSuffix[region]
	if !ok {
		return "", fmt.Errorf("unsupported bailian region %q", region)
	}
	if strings.ContainsAny(workspaceID, "/ :?#&") {
		return "", fmt.Errorf("bailian workspace ID contains invalid characters")
	}
	return "https://" + workspaceID + "." + suffix, nil
}

// ParseBailianWorkspace reads the workspace ID and region back out of a
// workspace-scoped Base URL. Generic DashScope hosts are not workspace scope
// and return ok=false.
func ParseBailianWorkspace(baseURL string) (workspaceID string, region BailianRegion, ok bool) {
	parsed, err := url.Parse(normalizeBailianBaseURL(baseURL))
	if err != nil {
		return "", "", false
	}
	host := strings.ToLower(parsed.Hostname())
	for candidate, suffix := range bailianRegionHostSuffix {
		if strings.HasSuffix(host, "."+suffix) {
			prefix := strings.TrimSuffix(host, "."+suffix)
			if prefix != "" && !strings.Contains(prefix, ".") {
				return prefix, candidate, true
			}
		}
		if host == suffix {
			return "", candidate, true
		}
	}
	if strings.Contains(host, "dashscope-intl.aliyuncs.com") {
		return "", BailianRegionSingapore, true
	}
	if strings.Contains(host, "dashscope.aliyuncs.com") {
		return "", BailianRegionBeijing, true
	}
	return "", "", false
}

// BailianRegionOf returns the region a base URL belongs to, defaulting to
// Beijing for the generic DashScope host.
func BailianRegionOf(baseURL string) BailianRegion {
	_, region, ok := ParseBailianWorkspace(baseURL)
	if ok && region != "" {
		return region
	}
	return BailianRegionBeijing
}

// BailianReferencePrice is the normalized, reference-only view of one official
// price item. It never feeds ModelRatio or ModelPrice.
type BailianReferencePrice struct {
	Provider         string        `json:"provider"`
	Model            string        `json:"model"`
	Region           BailianRegion `json:"region,omitempty"`
	Currency         string        `json:"currency"`
	CurrencyInferred bool          `json:"currency_inferred"`
	PriceType        string        `json:"price_type"`
	PriceName        string        `json:"price_name,omitempty"`
	Price            string        `json:"price"`
	PriceValue       float64       `json:"price_value"`
	Unit             string        `json:"unit"`
	RawUnit          string        `json:"raw_unit"`
	RangeName        string        `json:"range_name"`
	TimeBand         string        `json:"time_band,omitempty"`
	Source           string        `json:"source"`
	FetchedAt        time.Time     `json:"fetched_at"`
}

// NormalizeBailianPrices flattens the official nested ranges into one stable
// reference list while keeping every raw field. Unknown units or unparsable
// numbers are preserved and marked instead of being dropped or guessed.
func NormalizeBailianPrices(catalog *BailianCatalog) []BailianReferencePrice {
	if catalog == nil {
		return nil
	}
	out := make([]BailianReferencePrice, 0, len(catalog.Models)*4)
	for _, item := range catalog.Models {
		for _, priceRange := range item.Prices {
			for _, price := range priceRange.Prices {
				unit, ok := normalizeBailianPriceUnit(price.PriceUnit)
				value, parseErr := strconv.ParseFloat(strings.TrimSpace(price.Price), 64)
				currency, inferred := bailianCurrencyForRegion(catalog.Region)
				if !ok {
					unit = strings.TrimSpace(price.PriceUnit)
				}
				normalized := BailianReferencePrice{
					Provider:         item.InferenceProvider,
					Model:            item.Model,
					Region:           catalog.Region,
					Currency:         currency,
					CurrencyInferred: inferred,
					PriceType:        price.Type,
					PriceName:        price.PriceName,
					Price:            price.Price,
					Unit:             unit,
					RawUnit:          price.PriceUnit,
					RangeName:        priceRange.RangeName,
					TimeBand:         price.TimeBand,
					Source:           "bailian-official",
					FetchedAt:        catalog.FetchedAt,
				}
				if parseErr == nil {
					normalized.PriceValue = value
				}
				out = append(out, normalized)
			}
		}
	}
	return out
}

func bailianCurrencyForRegion(region BailianRegion) (string, bool) {
	switch region {
	case BailianRegionBeijing, BailianRegionHongKong:
		return "CNY", true
	default:
		// The official response does not carry a currency field. International
		// regions are quoted in USD on Alibaba Cloud's price pages; flag the
		// inference so an operator can correct it before relying on the value.
		return "USD", true
	}
}

// normalizeBailianPriceUnit maps the Chinese unit strings the API returns onto
// stable machine-readable units. Unknown units return ok=false.
func normalizeBailianPriceUnit(raw string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "每百万tokens", "每百万 tokens", "per 1m tokens", "per million tokens":
		return "per_1m_tokens", true
	case "每千tokens", "每千 tokens", "per 1k tokens", "per thousand tokens":
		return "per_1k_tokens", true
	case "每张", "per image":
		return "per_image", true
	case "每秒", "per second":
		return "per_second", true
	case "每分钟", "per minute":
		return "per_minute", true
	default:
		return "", false
	}
}

// BailianMetadata maps one official record onto Uter's metadata vocabulary.
// Only facts the official record actually asserts are filled; the merge layer
// treats empty values as "unknown" and never overwrites local content.
func BailianMetadata(item BailianModel) model.MetadataValues {
	contextLength := intFromAny(item.ModelInfo["context_window"])
	maxOutput := intFromAny(item.ModelInfo["max_output_tokens"])
	inputModalities := bailianModalities(item.InferenceMetadata["request_modality"])
	outputModalities := bailianModalities(item.InferenceMetadata["response_modality"])
	tags := make([]string, 0, len(item.Capabilities)+len(item.Features))
	tags = append(tags, item.Capabilities...)
	tags = append(tags, item.Features...)
	tags = uniqueSortedStrings(tags)
	endpoints := "openai"
	if encoded, err := common.Marshal([]string{"openai"}); err == nil {
		endpoints = string(encoded)
	}
	return model.MetadataValues{
		Description:      strings.TrimSpace(item.Description),
		Vendor:           bailianVendorName(item),
		Endpoints:        endpoints,
		NameRule:         model.NameRuleExact,
		Status:           1,
		ContextLength:    contextLength,
		MaxOutputTokens:  maxOutput,
		ReleaseDate:      bailianReleaseDate(item.PublishedTime),
		InputModalities:  inputModalities,
		OutputModalities: outputModalities,
		Tags:             strings.Join(tags, ","),
	}
}

// BailianCatalogMetadata indexes the official catalog by model name.
func BailianCatalogMetadata(catalog *BailianCatalog) map[string]model.MetadataValues {
	out := make(map[string]model.MetadataValues)
	if catalog == nil {
		return out
	}
	for _, item := range catalog.Models {
		values := BailianMetadata(item)
		if err := model.ValidateMetadataValues(values); err != nil {
			values.Endpoints = ""
		}
		out[item.Model] = values
	}
	return out
}

func catalogModelCount(catalog *BailianCatalog) int {
	if catalog == nil {
		return 0
	}
	return len(catalog.Models)
}

// BailianCatalogVendors returns the vendor rows the catalog needs.
func BailianCatalogVendors(catalog *BailianCatalog) map[string]model.Vendor {
	out := make(map[string]model.Vendor)
	if catalog == nil {
		return out
	}
	for _, item := range catalog.Models {
		name := bailianVendorName(item)
		if name == "" {
			continue
		}
		out[name] = model.Vendor{Name: name, Description: "Alibaba Model Studio", Status: 1}
	}
	return out
}

// BailianApplyResult reports what applying the catalog changed. Reference
// prices are counted, never written into billing configuration.
type BailianApplyResult struct {
	ChannelModels    int                           `json:"channel_models"`
	CatalogModels    int                           `json:"catalog_models"`
	MatchedModels    int                           `json:"matched_models"`
	UnmatchedModels  []string                      `json:"unmatched_models"`
	Metadata         *model.AutoFillMetadataResult `json:"metadata"`
	ReferencePrices  int                           `json:"reference_prices"`
	ConflictedModels []string                      `json:"conflicted_models"`
}

// ApplyBailianCatalog fills metadata for the intersection of the channel's
// actual model list and the official catalog. Official models the channel does
// not serve are never added to the channel; blank fields only are filled.
func ApplyBailianCatalog(catalog *BailianCatalog, channelModels []string) (*BailianApplyResult, error) {
	result := &BailianApplyResult{
		ChannelModels:   len(channelModels),
		CatalogModels:   catalogModelCount(catalog),
		UnmatchedModels: []string{},
		ReferencePrices: len(NormalizeBailianPrices(catalog)),
	}
	metadata := BailianCatalogMetadata(catalog)
	matched := make([]string, 0, len(channelModels))
	for _, name := range channelModels {
		if _, ok := metadata[name]; ok {
			matched = append(matched, name)
		} else {
			result.UnmatchedModels = append(result.UnmatchedModels, name)
		}
	}
	sort.Strings(result.UnmatchedModels)
	sort.Strings(matched)
	result.MatchedModels = len(matched)
	if len(matched) == 0 {
		result.Metadata = &model.AutoFillMetadataResult{CreatedModels: []string{}, UpdatedModels: []string{}}
		return result, nil
	}
	fill, err := model.AutoFillOfficialMetadata(matched, metadata, BailianCatalogVendors(catalog))
	if err != nil {
		return result, err
	}
	result.Metadata = fill
	return result, nil
}

func bailianVendorName(item BailianModel) string {
	provider := strings.TrimSpace(item.Provider)
	if provider == "" {
		provider = strings.TrimSpace(item.InferenceProvider)
	}
	switch strings.ToLower(provider) {
	case "qwen":
		return "Qwen"
	case "deepseek":
		return "DeepSeek"
	case "zhipu", "glm":
		return "Zhipu"
	case "moonshot", "kimi":
		return "Moonshot"
	case "minimax":
		return "MiniMax"
	default:
		return provider
	}
}

func bailianReleaseDate(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	for _, layout := range []string{"2006-01-02 15:04:05", "2006-01-02", time.RFC3339} {
		if parsed, err := time.Parse(layout, raw); err == nil {
			return parsed.Format("2006-01-02")
		}
	}
	return ""
}

func bailianModalities(raw any) string {
	items, ok := raw.([]any)
	if !ok {
		if typed, okStrings := raw.([]string); okStrings {
			items = make([]any, len(typed))
			for i, item := range typed {
				items[i] = item
			}
		} else {
			return ""
		}
	}
	out := make([]string, 0, len(items))
	for _, item := range items {
		text, _ := item.(string)
		switch strings.ToLower(strings.TrimSpace(text)) {
		case "text":
			out = append(out, "text")
		case "image":
			out = append(out, "image")
		case "audio":
			out = append(out, "audio")
		case "video":
			out = append(out, "video")
		case "file", "pdf":
			out = append(out, "file")
		}
	}
	return strings.Join(uniqueSortedStrings(out), ",")
}

func intFromAny(value any) int {
	switch typed := value.(type) {
	case float64:
		return int(typed)
	case int:
		return typed
	case string:
		parsed, _ := strconv.Atoi(strings.TrimSpace(typed))
		return parsed
	default:
		return 0
	}
}

func uniqueSortedStrings(items []string) []string {
	seen := make(map[string]struct{}, len(items))
	out := make([]string, 0, len(items))
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		key := strings.ToLower(item)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, item)
	}
	sort.Strings(out)
	return out
}

// BailianSyncStatusKey stores the last per-step result of the automatic
// post-create synchronization. Each step is independent so a failed catalog
// pull never hides a successful model discovery (or the reverse).
const BailianSyncStatusKey = "BailianSyncStatus"

type BailianSyncStep struct {
	Status   string    `json:"status"`
	Message  string    `json:"message,omitempty"`
	Finished time.Time `json:"finished_at,omitempty"`
}

type BailianSyncStatus struct {
	ChannelID       int                        `json:"channel_id"`
	StartedAt       time.Time                  `json:"started_at"`
	FinishedAt      time.Time                  `json:"finished_at,omitempty"`
	ActualModels    int                        `json:"actual_models"`
	CatalogModels   int                        `json:"catalog_models"`
	MatchedModels   int                        `json:"matched_models"`
	ReferencePrices int                        `json:"reference_prices"`
	MetadataCreated int                        `json:"metadata_created"`
	MetadataUpdated int                        `json:"metadata_updated"`
	UnmatchedModels []string                   `json:"unmatched_models,omitempty"`
	Steps           map[string]BailianSyncStep `json:"steps"`
}

func SaveBailianSyncStatus(status *BailianSyncStatus) error {
	if status == nil {
		return nil
	}
	raw, err := common.Marshal(status)
	if err != nil {
		return err
	}
	return model.UpdateOption(BailianSyncStatusKey, string(raw))
}

func LoadBailianSyncStatus() *BailianSyncStatus {
	raw := strings.TrimSpace(common.OptionMap[BailianSyncStatusKey])
	if raw == "" {
		return nil
	}
	var status BailianSyncStatus
	if err := common.Unmarshal([]byte(raw), &status); err != nil {
		return nil
	}
	return &status
}

// BailianChannelQuotes converts the official reference prices into per-channel
// quotes. Quotes are channel-scoped: the same model on another channel keeps
// its own price. Only a single standard range is applied automatically; tiered
// or multi-time-band quotes are preserved as needs_review instead of being
// flattened into one wrong number.
func BailianChannelQuotes(catalog *BailianCatalog) (map[string]custom_pricing.ChannelQuote, int) {
	if catalog == nil {
		return map[string]custom_pricing.ChannelQuote{}, 0
	}
	rate := operation_setting.USDExchangeRate
	if rate <= 0 {
		rate = operation_setting.DefaultUSDExchangeRate
	}
	now := catalog.FetchedAt.Unix()
	quotes := make(map[string]custom_pricing.ChannelQuote)
	needsReview := 0
	for _, item := range catalog.Models {
		quote, ok, review := bailianQuoteForModel(item, catalog.Region, rate, now)
		if !ok {
			continue
		}
		if review {
			needsReview++
		}
		quotes[item.Model] = quote
	}
	return quotes, needsReview
}

func bailianQuoteForModel(item BailianModel, region BailianRegion, rate float64, now int64) (custom_pricing.ChannelQuote, bool, bool) {
	type priced struct {
		usd       float64
		band      string
		rangeName string
	}
	var inputs []priced
	var outputs []priced
	var caches []priced
	unit := "per_1m_token"
	for _, r := range item.Prices {
		for _, p := range r.Prices {
			value, err := strconv.ParseFloat(strings.TrimSpace(p.Price), 64)
			if err != nil || value < 0 {
				continue
			}
			if strings.Contains(strings.ToLower(p.PriceUnit), "每张") || strings.Contains(strings.ToLower(p.PriceUnit), "per image") {
				unit = "per_call"
			}
			if region == BailianRegionBeijing || region == BailianRegionHongKong {
				if rate > 0 {
					value = value / rate
				}
			}
			switch p.Type {
			case "input_token":
				inputs = append(inputs, priced{usd: value, band: p.TimeBand, rangeName: r.RangeName})
			case "output_token":
				outputs = append(outputs, priced{usd: value, band: p.TimeBand, rangeName: r.RangeName})
			case "input_token_cache", "input_token_cache_read":
				caches = append(caches, priced{usd: value, band: p.TimeBand, rangeName: r.RangeName})
			}
		}
	}
	pick := func(items []priced) (priced, bool, bool) {
		if len(items) == 0 {
			return priced{}, false, false
		}
		var standard []priced
		bands := make(map[string]struct{})
		ranges := make(map[string]struct{})
		for _, item := range items {
			bands[item.band] = struct{}{}
			ranges[item.rangeName] = struct{}{}
			if item.band == "" || item.band == "standard" {
				standard = append(standard, item)
			}
		}
		if len(ranges) > 1 || (len(bands) > 1 && len(standard) == 0) {
			return items[0], true, true
		}
		if len(standard) > 0 {
			return standard[0], true, false
		}
		return items[0], true, false
	}
	input, ok, review := pick(inputs)
	if !ok {
		return custom_pricing.ChannelQuote{}, false, false
	}
	quote := custom_pricing.ChannelQuote{
		OfficialPrice: &input.usd,
		ChannelPrice:  &input.usd,
		Unit:          unit,
		Status:        "",
		Source:        "bailian-official",
		Raw:           fmt.Sprintf("region=%s model=%s", region, item.Model),
		UpdatedAt:     now,
	}
	if output, hasOutput, outputReview := pick(outputs); hasOutput {
		ratio := output.usd / input.usd
		quote.CompletionRatio = &ratio
		review = review || outputReview
	}
	if cache, hasCache, cacheReview := pick(caches); hasCache {
		ratio := cache.usd / input.usd
		quote.CacheRatio = &ratio
		review = review || cacheReview
	}
	if review {
		quote.Status = custom_pricing.ChannelQuoteStatusNeedsReview
	}
	return quote, true, review
}
