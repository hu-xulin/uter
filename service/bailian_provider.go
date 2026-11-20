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
					Source:           "bailian-channel",
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
			Source:            "bailian-channel",
			FetchedAt:         catalog.FetchedAt.Unix(),
		})
	}
	return records
}

// SeedBailianInternalPricing adopts synced channel catalog prices as explicit sale
// prices. Catalog sync itself never makes an official row billable.
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
// Bailian channel catalog quote. A single
// executable tier becomes a flat price; multiple token tiers become a tiered
// billing expression so context-length pricing is preserved instead of being
// flattened. Shapes that cannot be represented (audio dimensions, per-character
// units, multiple time bands) return "" and stay review-only.
func bailianInternalPricing(normalized model.ChannelOfficialPricing) string {
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
		internal := model.ChannelInternalPricing{Source: "bailian-channel", UpdatedAt: normalized.FetchedAt}
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
			Source:      "bailian-channel",
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
// Bailian publishes the supplier/channel quote, not the model vendor's own
// list price, so these tiers are stored in ChannelPriceTiers and the official
// tier list stays empty. Multiple ranges/time bands remain separate and are
// flagged for review; they are never averaged into one number.
func bailianOfficialPricing(item BailianModel, region BailianRegion, rate float64, fetchedAt int64) model.ChannelOfficialPricing {
	result := model.ChannelOfficialPricing{
		Currency:  "USD",
		Unit:      "per_1m_token",
		Source:    "bailian-channel",
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

	toUSD := func(value float64, unit string) float64 {
		if result.Currency == "CNY" && rate > 0 {
			value /= rate
		}
		if unit == "per_1k_tokens" {
			value *= 1000
		}
		return value
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
			tier.RawPriceTypes = append(tier.RawPriceTypes, priceType)
			switch {
			case priceType == "input_token" || priceType == "input_tokens" || priceType == "text_input" ||
				priceType == "embedding_token" || priceType == "translate_audio_input_token" ||
				priceType == "omni_no_audio_input_token" || priceType == "audio_text_input_token" ||
				priceType == "omni_input_token":
				tier.InputPerMillionUSD = &usd
				result.Unit = "per_1m_token"
			case priceType == "output_token" || priceType == "output_tokens" || priceType == "text_output" ||
				priceType == "translate_multi_text_output_token" || priceType == "translate_multi_output_token" ||
				priceType == "omni_no_audio_output_token" || priceType == "audio_text_output_token" ||
				priceType == "omni_output_token" || priceType == "purein_text_output_token" ||
				priceType == "omni_text_output_token":
				tier.OutputPerMillionUSD = &usd
				result.Unit = "per_1m_token"
			case priceType == "audio_input_token" || priceType == "omni_audio_input_token":
				tier.AudioInputPerMillionUSD = &usd
				result.Unit = "per_1m_token"
			case priceType == "audio_output_token" || priceType == "omni_audio_output_token" || priceType == "multi_output_token":
				tier.AudioOutputPerMillionUSD = &usd
				result.Unit = "per_1m_token"
			case priceType == "omni_input_token_cache":
				tier.CachePerMillionUSD = &usd
			case strings.Contains(priceType, "cache") && strings.Contains(priceType, "read"):
				tier.CachePerMillionUSD = &usd
			case normalizedUnit == "per_image" || normalizedUnit == "per_second" || normalizedUnit == "per_minute":
				tier.PerUnitUSD = &usd
				result.Unit = normalizedUnit
			default:
				unknownTypes[priceType] = true
			}
		}
	}
	for _, key := range order {
		result.ChannelPriceTiers = append(result.ChannelPriceTiers, *tiers[key])
	}
	if len(result.ChannelPriceTiers) > 0 {
		first := result.ChannelPriceTiers[0]
		result.ChannelPrice = &first
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
	result.NeedsReview = len(result.ReviewReasons) > 0
	sort.Strings(result.ReviewReasons)
	return result
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
