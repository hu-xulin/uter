package service

import (
	"fmt"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
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

	// bailianCatalogSource marks prices synced from the official Model Studio
	// catalog; every auto-derived row carries it so a schema change is detected.
	bailianCatalogSource = "bailian-official"
)

var bailianRegionHostSuffix = map[BailianRegion]string{
	BailianRegionBeijing:   "cn-beijing.maas.aliyuncs.com",
	BailianRegionSingapore: "ap-southeast-1.maas.aliyuncs.com",
	BailianRegionHongKong:  "cn-hongkong.maas.aliyuncs.com",
	BailianRegionGermany:   "eu-central-1.maas.aliyuncs.com",
	BailianRegionJapan:     "ap-northeast-1.maas.aliyuncs.com",
	BailianRegionUS:        "us-east-1.maas.aliyuncs.com",
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
					Source:           bailianCatalogSource,
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
	case "每次", "per call", "per request":
		return "per_call", true
	case "每万字符", "per 10k characters", "per 10k chars":
		return "per_10k_chars", true
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

// BailianPricingRecords builds one channel-scoped catalog quote for every
// requested model. Bailian publishes the channel price, not the vendor list. Only models the channel actually serves are written;
// the untouched official payload is preserved on the row.
func BailianPricingRecords(catalog *BailianCatalog, channelModels []string) []model.ChannelOfficialPricingRecord {
	if catalog == nil || len(channelModels) == 0 {
		return nil
	}
	byName := make(map[string]BailianModel, len(catalog.Models))
	for _, item := range catalog.Models {
		byName[item.Model] = item
	}
	rate := operation_setting.USDExchangeRate
	if rate <= 0 {
		rate = operation_setting.DefaultUSDExchangeRate
	}
	records := make([]model.ChannelOfficialPricingRecord, 0, len(channelModels))
	seen := make(map[string]bool, len(channelModels))
	for _, rawName := range channelModels {
		name := strings.TrimSpace(rawName)
		if name == "" || seen[name] {
			continue
		}
		seen[name] = true
		item, ok := byName[name]
		if !ok {
			item, ok = resolveBailianCatalogAlias(name, byName)
			if !ok {
				continue
			}
		}
		raw, err := common.Marshal(item)
		if err != nil {
			continue
		}
		normalized := bailianOfficialPricing(item, catalog.Region, rate, catalog.FetchedAt.Unix())
		encoded, err := common.Marshal(normalized)
		if err != nil {
			continue
		}
		records = append(records, model.ChannelOfficialPricingRecord{
			ChannelId:         catalog.ChannelID,
			Provider:          firstNonEmpty(item.InferenceProvider, item.Provider, "aliyun-bailian"),
			Region:            string(catalog.Region),
			ModelName:         name,
			Currency:          normalized.Currency,
			OfficialPricing:   string(raw),
			NormalizedPricing: string(encoded),
			Source:            bailianCatalogSource,
			FetchedAt:         catalog.FetchedAt.Unix(),
		})
	}
	return records
}

// SeedBailianInternalPricing adopts synced catalog prices as explicit sale
// prices for models that have exactly one unambiguous price. It runs
// automatically after every catalog sync; operator, batch and scheduled prices
// are preserved unless overwrite is set.
func SeedBailianInternalPricing(channelID int, models []string, overwrite bool) (int, int, error) {
	rows, err := model.ListChannelModelPricing(channelID)
	if err != nil {
		return 0, 0, err
	}
	wanted := make(map[string]bool, len(models))
	for _, name := range models {
		if trimmed := strings.TrimSpace(name); trimmed != "" {
			wanted[trimmed] = true
		}
	}
	seeded, skipped := 0, 0
	for _, row := range rows {
		if len(wanted) > 0 && !wanted[row.ModelName] {
			continue
		}
		if !overwrite && strings.TrimSpace(row.InternalPricing) != "" {
			skipped++
			continue
		}
		var view model.ChannelOfficialPricing
		if err := common.UnmarshalJsonStr(row.NormalizedPricing, &view); err != nil {
			skipped++
			continue
		}
		encoded := bailianInternalPricing(view)
		if encoded == "" {
			skipped++
			continue
		}
		var internal model.ChannelInternalPricing
		if err := common.UnmarshalJsonStr(encoded, &internal); err != nil {
			skipped++
			continue
		}
		if err := model.SetChannelInternalPricing(channelID, row.ModelName, internal); err != nil {
			skipped++
			continue
		}
		seeded++
	}
	return seeded, skipped, nil
}

// resolveBailianCatalogAlias matches channel model names that differ from the
// catalog only by a known envelope: the `cmaas-` prefix, a vendor scope before
// `/`, or a trailing date. It never guesses by substring.
func resolveBailianCatalogAlias(name string, byName map[string]BailianModel) (BailianModel, bool) {
	candidates := []string{name}
	if strings.HasPrefix(name, "cmaas-") {
		candidates = append(candidates, strings.TrimPrefix(name, "cmaas-"))
	}
	if index := strings.LastIndex(name, "/"); index >= 0 && index+1 < len(name) {
		candidates = append(candidates, name[index+1:])
	}
	if match := bailianVersionSuffixPattern.FindStringSubmatch(name); len(match) == 2 {
		candidates = append(candidates, match[1])
	}
	for _, candidate := range candidates[1:] {
		if item, ok := byName[candidate]; ok {
			return item, true
		}
	}
	return BailianModel{}, false
}

var bailianVersionSuffixPattern = regexp.MustCompile(`^(.+?)-\d{4}(?:-\d{2}){0,2}$`)

// bailianInternalPricing builds the channel's default sale price from the
// Bailian official catalog price. A single executable tier becomes a flat
// price; multiple token tiers become a tiered billing expression so
// context-length pricing is preserved instead of being flattened. Per-character
// TTS prices are already normalized to per-1M-token. Shapes that cannot be
// represented (separate audio dimensions, conflicting per-call prices, multiple
// time bands) return "" and stay review-only.
func bailianInternalPricing(normalized model.ChannelOfficialPricing) string {
	// Context-length ranges are preservable through a tiered expression. The
	// implicit cache-hit price is the default for cache tokens because implicit
	// caching applies automatically; the explicit cache-hit price stays visible
	// in the official view for operators whose traffic marks cache_control
	// explicitly. The 5-minute cache-creation price is the default when the
	// catalog also publishes a 1-hour price. Every other review reason means at
	// least one dimension (time band, thinking/vision modality, conflicting
	// unit, missing price) cannot be represented by one executable price.
	for _, reason := range normalized.ReviewReasons {
		switch reason {
		case "multiple price ranges", "multiple cache read prices", "multiple cache creation prices":
		default:
			return ""
		}
	}
	tiers := normalized.ChannelPriceTiers
	if len(tiers) == 0 && normalized.ChannelPrice != nil {
		tiers = []model.ChannelPricingTier{*normalized.ChannelPrice}
	}
	if len(tiers) == 0 {
		tiers = normalized.Tiers
	}
	if len(tiers) == 0 {
		return ""
	}
	if len(tiers) == 1 {
		tier := tiers[0]
		internal := model.ChannelInternalPricing{Source: bailianCatalogSource, UpdatedAt: normalized.FetchedAt}
		switch tier.Unit {
		case "per_1m_token", "per_1m_tokens":
			if tier.InputPerMillionUSD == nil || *tier.InputPerMillionUSD <= 0 {
				return ""
			}
			internal.Mode = model.ChannelPricingModePerMillionTokens
			internal.InputUSDPerMillion = tier.InputPerMillionUSD
			if tier.OutputPerMillionUSD != nil {
				internal.OutputUSDPerMillion = tier.OutputPerMillionUSD
			} else {
				zero := 0.0
				internal.OutputUSDPerMillion = &zero
			}
			internal.CacheUSDPerMillion = tier.CachePerMillionUSD
			if tier.CreateCachePerMillionUSD != nil && *tier.CreateCachePerMillionUSD > 0 {
				internal.CreateCacheUSDPerMillion = tier.CreateCachePerMillionUSD
			}
			if tier.AudioInputPerMillionUSD != nil && *tier.AudioInputPerMillionUSD > 0 {
				ratio := *tier.AudioInputPerMillionUSD / *tier.InputPerMillionUSD
				internal.AudioRatio = &ratio
			}
			if tier.AudioOutputPerMillionUSD != nil && tier.OutputPerMillionUSD != nil &&
				*tier.AudioOutputPerMillionUSD > 0 && *tier.OutputPerMillionUSD > 0 {
				ratio := *tier.AudioOutputPerMillionUSD / *tier.OutputPerMillionUSD
				internal.AudioCompletionRatio = &ratio
			}
		case "per_image", "per_call":
			if tier.PerUnitUSD == nil || *tier.PerUnitUSD <= 0 {
				return ""
			}
			internal.Mode = model.ChannelPricingModePerCall
			internal.PerCallUSD = tier.PerUnitUSD
		case "per_second":
			if tier.PerUnitUSD == nil || *tier.PerUnitUSD <= 0 {
				return ""
			}
			internal.Mode = model.ChannelPricingModePerSecond
			internal.PerSecondUSD = tier.PerUnitUSD
		case "per_minute":
			if tier.PerUnitUSD == nil || *tier.PerUnitUSD <= 0 {
				return ""
			}
			internal.Mode = model.ChannelPricingModePerMinute
			internal.PerMinuteUSD = tier.PerUnitUSD
		default:
			return ""
		}
		encoded, err := common.Marshal(internal)
		if err != nil {
			return ""
		}
		return string(encoded)
	}
	if expr := bailianTierExpression(tiers); expr != "" {
		internal := model.ChannelInternalPricing{
			Mode:        model.ChannelPricingModeTieredExpr,
			BillingExpr: expr,
			Source:      bailianCatalogSource,
			UpdatedAt:   normalized.FetchedAt,
		}
		encoded, err := common.Marshal(internal)
		if err != nil {
			return ""
		}
		return string(encoded)
	}
	return ""
}

// bailianTierExpression converts context-length tiers into the expression
// language used by the billing engine. Coefficients are USD per 1M tokens; the
// engine multiplies them by token counts and converts to quota.
func bailianTierExpression(tiers []model.ChannelPricingTier) string {
	sorted := append([]model.ChannelPricingTier(nil), tiers...)
	// The billing expression has no time-of-day condition. A tiered expression
	// can only be generated when every context range belongs to one time band.
	band := ""
	for _, tier := range sorted {
		current := strings.TrimSpace(tier.TimeBand)
		if band == "" {
			band = current
			continue
		}
		if current != band {
			return ""
		}
	}
	sort.Slice(sorted, func(i, j int) bool {
		mi, mj := sorted[i].MaxInputTokens, sorted[j].MaxInputTokens
		if mi == 0 {
			return false
		}
		if mj == 0 {
			return true
		}
		return mi < mj
	})
	parts := make([]string, 0, len(sorted))
	for _, tier := range sorted {
		if tier.Unit != "per_1m_token" && tier.Unit != "per_1m_tokens" {
			return ""
		}
		if tier.InputPerMillionUSD == nil || *tier.InputPerMillionUSD <= 0 {
			return ""
		}
		terms := []string{fmt.Sprintf("p * %s", formatExprNumber(*tier.InputPerMillionUSD))}
		if tier.OutputPerMillionUSD != nil && *tier.OutputPerMillionUSD > 0 {
			terms = append(terms, fmt.Sprintf("c * %s", formatExprNumber(*tier.OutputPerMillionUSD)))
		}
		if tier.CachePerMillionUSD != nil && *tier.CachePerMillionUSD > 0 {
			terms = append(terms, fmt.Sprintf("cr * %s", formatExprNumber(*tier.CachePerMillionUSD)))
		}
		if tier.CreateCachePerMillionUSD != nil && *tier.CreateCachePerMillionUSD > 0 {
			terms = append(terms, fmt.Sprintf("cc * %s", formatExprNumber(*tier.CreateCachePerMillionUSD)))
		}
		if tier.AudioInputPerMillionUSD != nil || tier.AudioOutputPerMillionUSD != nil {
			return ""
		}
		name := tier.RangeName
		if strings.TrimSpace(name) == "" {
			name = "tier"
		}
		parts = append(parts, fmt.Sprintf(`tier("%s", %s)`, strings.ReplaceAll(name, `"`, ""), strings.Join(terms, " + ")))
	}
	expr := parts[len(parts)-1]
	for i := len(parts) - 2; i >= 0; i-- {
		limit := sorted[i].MaxInputTokens
		condition := "true"
		if limit > 0 {
			condition = fmt.Sprintf("len <= %d", limit)
		}
		expr = fmt.Sprintf("%s ? %s : %s", condition, parts[i], expr)
	}
	return expr
}

func formatExprNumber(value float64) string {
	return strconv.FormatFloat(value, 'f', -1, 64)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

// bailianOfficialPricing groups the Bailian catalog price items into ranges.
// The catalog is Alibaba's official price document, so its tiers are stored as
// official prices and mirrored into the channel quote (Bailian publishes one
// price, there is no separate discounted channel quote). Multiple ranges/time
// bands remain separate and are flagged for review; they are never averaged
// into one number.
func bailianOfficialPricing(item BailianModel, region BailianRegion, rate float64, fetchedAt int64) model.ChannelOfficialPricing {
	result := model.ChannelOfficialPricing{
		Currency:  "USD",
		Unit:      "per_1m_token",
		Source:    bailianCatalogSource,
		FetchedAt: fetchedAt,
	}
	if region == BailianRegionBeijing || region == BailianRegionHongKong {
		result.Currency = "CNY"
		result.FXRateToUSD = rate
	}
	tiers := make(map[string]*model.ChannelPricingTier)
	order := make([]string, 0, len(item.Prices))
	countRanges := make(map[string]bool)
	countBands := make(map[string]bool)
	unknownTypes := make(map[string]bool)
	unknownUnits := make(map[string]bool)
	componentByTier := make(map[*model.ChannelPricingTier]model.ChannelPricingComponent)
	audioASR := false
	for _, capability := range item.Capabilities {
		lower := strings.ToLower(strings.TrimSpace(capability))
		if strings.Contains(lower, "asr") || strings.Contains(lower, "speech_recognition") {
			audioASR = true
			break
		}
	}

	toUSD := func(value float64, unit string) float64 {
		if result.Currency == "CNY" && rate > 0 {
			value /= rate
		}
		if unit == "per_1k_tokens" {
			value *= 1000
		}
		return value
	}
	setTokenPrice := func(target **float64, usd float64, label string) {
		if *target == nil {
			value := usd
			*target = &value
			return
		}
		if **target != usd {
			result.ReviewReasons = append(result.ReviewReasons, "multiple "+label+" prices")
		}
	}
	addPerUnitPrice := func(tier *model.ChannelPricingTier, unit string, usd float64, price BailianPrice, priceType string) {
		if tier.PerUnitUSD == nil {
			value := usd
			tier.PerUnitUSD = &value
			tier.Unit = unit
			result.Unit = unit
			componentByTier[tier] = model.ChannelPricingComponent{
				Name: price.PriceName, Type: priceType, Unit: unit, USD: usd,
			}
			return
		}
		if *tier.PerUnitUSD != usd {
			result.ReviewReasons = append(result.ReviewReasons, "multiple per-unit prices")
		}
	}
	for _, priceRange := range item.Prices {
		countRanges[priceRange.RangeName] = true
		for _, price := range priceRange.Prices {
			band := strings.TrimSpace(price.TimeBand)
			countBands[band] = true
			key := priceRange.RangeName + "\x00" + band
			tier, ok := tiers[key]
			if !ok {
				unit, unitOK := normalizeBailianPriceUnit(price.PriceUnit)
				if !unitOK {
					unknownUnits[price.PriceUnit] = true
					unit = strings.TrimSpace(price.PriceUnit)
				}
				minTokens, maxTokens := parseBailianTokenRange(priceRange.RangeName)
				tier = &model.ChannelPricingTier{
					RangeName:      priceRange.RangeName,
					TimeBand:       band,
					MinInputTokens: minTokens,
					MaxInputTokens: maxTokens,
					Unit:           unit,
				}
				tiers[key] = tier
				order = append(order, key)
			}
			value, err := strconv.ParseFloat(strings.TrimSpace(price.Price), 64)
			if err != nil || value < 0 {
				continue
			}
			normalizedUnit, _ := normalizeBailianPriceUnit(price.PriceUnit)
			usd := toUSD(value, normalizedUnit)
			priceType := strings.ToLower(strings.TrimSpace(price.Type))
			// Batch endpoints publish their own discounted price. They are a
			// separate service, not the standard realtime price, so they must not
			// overwrite or block the primary price used by the relay.
			if strings.Contains(priceType, "_batch") {
				continue
			}
			tier.RawPriceTypes = append(tier.RawPriceTypes, priceType)
			switch {
			case strings.Contains(priceType, "cache") && strings.Contains(priceType, "creation"):
				setTokenPrice(&tier.CreateCachePerMillionUSD, usd, "cache creation")
			case priceType == "input_token" || priceType == "input_tokens" || priceType == "text_input" ||
				priceType == "text_input_token" || priceType == "thinking_text_input_token" ||
				priceType == "mt_character_input_token" ||
				priceType == "embedding_token" || priceType == "translate_audio_input_token" ||
				priceType == "omni_no_audio_input_token" || priceType == "audio_text_input_token" ||
				priceType == "omni_input_token" || priceType == "thinking_input_token" ||
				priceType == "vision_input_token" || priceType == "thinking_vision_input_token" ||
				priceType == "translate_vision_input_token" ||
				priceType == "mt_image_input_token" || priceType == "mt_document_input_token" ||
				priceType == "mt_audio_input_token":
				setTokenPrice(&tier.InputPerMillionUSD, usd, "input token")
				result.Unit = "per_1m_token"
			case priceType == "output_token" || priceType == "output_tokens" || priceType == "text_output" ||
				priceType == "translate_multi_text_output_token" || priceType == "translate_multi_output_token" ||
				priceType == "omni_no_audio_output_token" || priceType == "audio_text_output_token" ||
				priceType == "omni_output_token" || priceType == "purein_text_output_token" ||
				priceType == "thinking_purein_text_output_token" ||
				priceType == "omni_text_output_token" || priceType == "thinking_output_token" ||
				priceType == "multiin_text_output_token" ||
				priceType == "thinking_multiin_text_output_token" ||
				priceType == "vision_output_token" || priceType == "thinking_vision_output_token":
				setTokenPrice(&tier.OutputPerMillionUSD, usd, "output token")
				result.Unit = "per_1m_token"
			case priceType == "audio_input_token" || priceType == "omni_audio_input_token" ||
				priceType == "thinking_audio_input_token":
				setTokenPrice(&tier.AudioInputPerMillionUSD, usd, "audio input token")
				result.Unit = "per_1m_token"
			case priceType == "audio_output_token" || priceType == "omni_audio_output_token" || priceType == "multi_output_token":
				setTokenPrice(&tier.AudioOutputPerMillionUSD, usd, "audio output token")
				result.Unit = "per_1m_token"
			case priceType == "input_token_cache" || priceType == "thinking_input_token_cache" ||
				priceType == "omni_input_token_cache" ||
				(strings.Contains(priceType, "cache") && strings.Contains(priceType, "read")):
				setTokenPrice(&tier.CachePerMillionUSD, usd, "cache read")
			// TTS models publish one price per synthesis call or per ten thousand
			// characters. The relay bills TTS usage as tokens where one character
			// is one token (the usage_characters convention), so a per-10k-character
			// price becomes a per-1M-token price. Two different per-call prices on
			// one model stay review-only instead of silently picking one.
			case priceType == "cosy_tts_number" || priceType == "tts_vc_model":
				switch normalizedUnit {
				case "per_call":
					addPerUnitPrice(tier, "per_call", usd, price, priceType)
				case "per_10k_chars":
					perMillion := usd * 100
					setTokenPrice(&tier.InputPerMillionUSD, perMillion, "input token")
					tier.Unit = "per_1m_tokens"
					result.Unit = "per_1m_token"
				default:
					unknownTypes[priceType] = true
				}
			case strings.HasPrefix(priceType, "qima_"):
				// Qwen-Image publishes separate input/output prices per output
				// resolution. Collapsing them into one per-image price would
				// misprice every request, so keep the whole model review-only.
				unknownTypes[priceType] = true
			case normalizedUnit == "per_image" || normalizedUnit == "per_second" ||
				normalizedUnit == "per_minute" || normalizedUnit == "per_call":
				addPerUnitPrice(tier, normalizedUnit, usd, price, priceType)
			default:
				unknownTypes[priceType] = true
			}
			// Synchronous ASR is billed by audio duration, but the relay's
			// audio-transcription path has no duration-based settlement. Only the
			// async task path supports per-second prices, so auto-configuring an
			// ASR model would produce a billable row that every request rejects.
			if audioASR && (normalizedUnit == "per_second" || normalizedUnit == "per_minute") {
				result.ReviewReasons = append(result.ReviewReasons, "duration-based audio requires task billing")
			}
		}
	}
	for _, key := range order {
		tier := tiers[key]
		// One model has one billable primary price. When the catalog also lists a
		// per-call service next to token prices (voice cloning next to speech
		// synthesis), the token tier stays primary and the call price is kept as a
		// visible component instead of blocking the whole model.
		if component, ok := componentByTier[tier]; ok && tierHasTokenPrice(tier) {
			result.ComponentPrices = append(result.ComponentPrices, component)
			tier.PerUnitUSD = nil
			tier.Unit = "per_1m_tokens"
			result.Unit = "per_1m_token"
		}
		result.ChannelPriceTiers = append(result.ChannelPriceTiers, *tier)
	}
	if len(result.ChannelPriceTiers) > 0 {
		first := result.ChannelPriceTiers[0]
		result.ChannelPrice = &first
		result.Tiers = append([]model.ChannelPricingTier(nil), result.ChannelPriceTiers...)
	}
	if len(countRanges) > 1 {
		result.ReviewReasons = append(result.ReviewReasons, "multiple price ranges")
	}
	if len(countBands) > 1 {
		result.ReviewReasons = append(result.ReviewReasons, "multiple time bands")
	}
	for priceType := range unknownTypes {
		result.ReviewReasons = append(result.ReviewReasons, "unsupported price type: "+priceType)
	}
	for unit := range unknownUnits {
		result.ReviewReasons = append(result.ReviewReasons, "unsupported price unit: "+unit)
	}
	if len(item.Prices) == 0 {
		result.ReviewReasons = append(result.ReviewReasons, "catalog lists no price")
	}
	result.ReviewReasons = uniqueSortedStrings(result.ReviewReasons)
	result.NeedsReview = len(result.ReviewReasons) > 0
	return result
}

func tierHasTokenPrice(tier *model.ChannelPricingTier) bool {
	return tier.InputPerMillionUSD != nil || tier.OutputPerMillionUSD != nil ||
		tier.AudioInputPerMillionUSD != nil || tier.AudioOutputPerMillionUSD != nil ||
		tier.CachePerMillionUSD != nil || tier.CreateCachePerMillionUSD != nil
}

var (
	bailianTokenRangePattern = regexp.MustCompile(`(?i)(\d+(?:\.\d+)?)\s*([km]?)\s*[-~至]\s*(\d+(?:\.\d+)?)\s*([km]?)`)
	// "32k<输入<=128k"
	bailianBoundedRangePattern = regexp.MustCompile(`(?i)^\s*(\d+(?:\.\d+)?)\s*([km]?)\s*<\s*(?:输入|tokens?)?\s*<=?\s*(\d+(?:\.\d+)?)\s*([km]?)\s*$`)
	// "输入<=128k"
	bailianUpperRangePattern = regexp.MustCompile(`(?i)^\s*(?:输入|tokens?)?\s*<=?\s*(\d+(?:\.\d+)?)\s*([km]?)\s*$`)
)

func parseBailianTokenRange(name string) (int64, int64) {
	parse := func(raw, suffix string) int64 {
		value, err := strconv.ParseFloat(raw, 64)
		if err != nil {
			return 0
		}
		switch strings.ToLower(suffix) {
		case "k":
			value *= 1024
		case "m":
			value *= 1024 * 1024
		}
		return int64(value)
	}
	if match := bailianBoundedRangePattern.FindStringSubmatch(name); len(match) == 5 {
		return parse(match[1], match[2]), parse(match[3], match[4])
	}
	if match := bailianUpperRangePattern.FindStringSubmatch(name); len(match) == 3 {
		return 0, parse(match[1], match[2])
	}
	if match := bailianTokenRangePattern.FindStringSubmatch(name); len(match) == 5 {
		return parse(match[1], match[2]), parse(match[3], match[4])
	}
	return 0, 0
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
	PricingRecords  int                        `json:"pricing_records"`
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
