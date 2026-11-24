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

	// bailianCatalogSource marks prices synced from Alibaba's Model Studio
	// channel catalog; these are supplier quotes, not vendor list prices.
	bailianCatalogSource = "bailian-channel"
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
	if strings.Contains(host, "dashscope-us.aliyuncs.com") {
		return "", BailianRegionUS, true
	}
	if strings.Contains(host, "dashscope-intl.aliyuncs.com") {
		return "", BailianRegionSingapore, true
	}
	if strings.Contains(host, "dashscope.aliyuncs.com") {
		return "", BailianRegionBeijing, true
	}
	return "", "", false
}

// BailianRegionOf returns the region a base URL belongs to. An unknown host
// stays UNKNOWN instead of silently becoming Beijing: a wrong region also picks
// the wrong currency and price identity.
func BailianRegionOf(baseURL string) BailianRegion {
	_, region, ok := ParseBailianWorkspace(baseURL)
	if ok && region != "" {
		return region
	}
	return BailianRegionUnspecified
}

// BailianReferencePrice is the normalized, reference-only view of one official
// price item. It never feeds ModelRatio or ModelPrice.
type BailianReferencePrice struct {
	Provider           string        `json:"provider"`
	Model              string        `json:"model"`
	Region             BailianRegion `json:"region,omitempty"`
	Currency           string        `json:"currency"`
	SourceCurrency     string        `json:"source_currency,omitempty"`
	NormalizedCurrency string        `json:"normalized_currency,omitempty"`
	CurrencyInferred   bool          `json:"currency_inferred"`
	PriceType          string        `json:"price_type"`
	PriceName          string        `json:"price_name,omitempty"`
	Price              string        `json:"price"`
	PriceValue         float64       `json:"price_value"`
	Unit               string        `json:"unit"`
	RawUnit            string        `json:"raw_unit"`
	RangeName          string        `json:"range_name"`
	TimeBand           string        `json:"time_band,omitempty"`
	Source             string        `json:"source"`
	FetchedAt          time.Time     `json:"fetched_at"`
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
				normalizedCurrency := ""
				if currency != "" {
					normalizedCurrency = "USD"
				}
				normalized := BailianReferencePrice{
					Provider:           item.InferenceProvider,
					Model:              item.Model,
					Region:             catalog.Region,
					Currency:           currency,
					SourceCurrency:     currency,
					NormalizedCurrency: normalizedCurrency,
					CurrencyInferred:   inferred,
					PriceType:          price.Type,
					PriceName:          price.PriceName,
					Price:              price.Price,
					Unit:               unit,
					RawUnit:            price.PriceUnit,
					RangeName:          priceRange.RangeName,
					TimeBand:           price.TimeBand,
					Source:             bailianCatalogSource,
					FetchedAt:          catalog.FetchedAt,
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
	case BailianRegionSingapore, BailianRegionJapan, BailianRegionGermany, BailianRegionUS:
		// The official response does not carry a currency field. International
		// regions are quoted in USD; flag the inference for operator review.
		return "USD", true
	default:
		// Unknown region: do not infer a currency.
		return "", false
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
	if catalog.Region == BailianRegionUnspecified {
		// Region controls both the price identity and the source currency.
		// Without it no formal price record can be produced.
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
			Provider:          "alibaba-bailian",
			ModelProvider:     firstNonEmpty(item.InferenceProvider, item.Provider, "aliyun-bailian"),
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
		if !overwrite && strings.TrimSpace(row.InternalPricing) != "" &&
			!model.ChannelInternalPricingIsAutoDerived(row.InternalPricing) {
			// Operator/batch prices are protected. A previous automatic price
			// is refreshed so the current default markup takes effect.
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
		if !applyDefaultSaleMarkup(&internal) {
			skipped++
			continue
		}
		if err := model.SetChannelInternalPricingFor(model.ChannelPricingIdentity{
			ChannelId: channelID, Provider: row.Provider, Region: row.Region,
			DeploymentId: row.DeploymentId, ModelName: row.ModelName,
		}, internal); err != nil {
			skipped++
			continue
		}
		seeded++
	}
	return seeded, skipped, nil
}

// BailianSeenChannelModels returns the channel's served model names that the
// latest complete catalog actually contains. Alias matches count as present;
// names absent from the catalog are left out so lifecycle tracking can age them.
func BailianSeenChannelModels(catalog *BailianCatalog, channelModels []string) []string {
	if catalog == nil || len(channelModels) == 0 {
		return nil
	}
	byName := make(map[string]BailianModel, len(catalog.Models))
	for _, item := range catalog.Models {
		byName[item.Model] = item
	}
	seen := make([]string, 0, len(channelModels))
	dedupe := make(map[string]bool, len(channelModels))
	for _, rawName := range channelModels {
		name := strings.TrimSpace(rawName)
		if name == "" || dedupe[name] {
			continue
		}
		if _, ok := byName[name]; ok {
			seen = append(seen, name)
			dedupe[name] = true
			continue
		}
		if _, ok := resolveBailianCatalogAlias(name, byName); ok {
			seen = append(seen, name)
			dedupe[name] = true
		}
	}
	return seen
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

// bailianOutputNotApplicable reports whether the published price types show a
// model without an output-token dimension, so a missing output price means N/A
// rather than an incomplete quote.
func bailianOutputNotApplicable(tier model.ChannelPricingTier) bool {
	for _, rawType := range tier.RawPriceTypes {
		lower := strings.ToLower(rawType)
		for _, marker := range []string{"tts", "audio", "voice", "embedding", "rerank", "image"} {
			if strings.Contains(lower, marker) {
				return true
			}
		}
	}
	return false
}

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
		case "multiple price ranges":
			// Representable as tiered context ranges; everything else means a
			// dimension cannot be distinguished and must stay review-only.
		default:
			return ""
		}
	}
	if expr := bailianImageTaskExpression(normalized.ComponentPrices); expr != "" {
		internal := model.ChannelInternalPricing{
			Mode: model.ChannelPricingModeTieredExpr, BillingExpr: expr,
			Source: bailianCatalogSource, UpdatedAt: normalized.FetchedAt,
		}
		encoded, err := common.Marshal(internal)
		if err != nil {
			return ""
		}
		return string(encoded)
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
	if len(tiers) == 1 && !bailianTierNeedsExpression(tiers[0]) {
		tier := tiers[0]
		internal := model.ChannelInternalPricing{Source: bailianCatalogSource, UpdatedAt: normalized.FetchedAt}
		switch tier.Unit {
		// The official values are normalized to USD per 1M tokens even when the
		// catalog quoted "每千tokens"; the unit label keeps the raw unit, so
		// both labels must be accepted here.
		case "per_1m_token", "per_1m_tokens", "per_1k_token", "per_1k_tokens":
			if tier.InputPerMillionUSD == nil || !tier.InputPerMillionUSD.Decimal().IsPositive() {
				return ""
			}
			internal.Mode = model.ChannelPricingModePerMillionTokens
			internal.InputUSDPerMillion = tier.InputPerMillionUSD
			if tier.OutputPerMillionUSD == nil {
				if !bailianOutputNotApplicable(tier) {
					// Missing output price is not free: without it the token
					// sale price is incomplete and must stay review-only.
					return ""
				}
				// Audio synthesis, embeddings and image models have no output
				// token dimension; zero here is N/A, not a missing price.
				zero := model.MoneyFromFloat(0)
				internal.OutputUSDPerMillion = &zero
			} else {
				internal.OutputUSDPerMillion = tier.OutputPerMillionUSD
			}
			internal.CacheUSDPerMillion = tier.CachePerMillionUSD
			if tier.CreateCachePerMillionUSD != nil && tier.CreateCachePerMillionUSD.Decimal().IsPositive() {
				internal.CreateCacheUSDPerMillion = tier.CreateCachePerMillionUSD
			}
			if tier.AudioInputPerMillionUSD != nil && tier.AudioInputPerMillionUSD.Decimal().IsPositive() {
				internal.AudioInputUSDPerMillion = tier.AudioInputPerMillionUSD
			}
			if tier.AudioOutputPerMillionUSD != nil && tier.AudioOutputPerMillionUSD.Decimal().IsPositive() {
				internal.AudioOutputUSDPerMillion = tier.AudioOutputPerMillionUSD
			}
		case "per_image", "per_call":
			if tier.PerUnitUSD == nil || !tier.PerUnitUSD.Decimal().IsPositive() {
				return ""
			}
			internal.Mode = model.ChannelPricingModePerCall
			internal.PerCallUSD = tier.PerUnitUSD
		case "per_second":
			if tier.PerUnitUSD == nil || !tier.PerUnitUSD.Decimal().IsPositive() {
				return ""
			}
			internal.Mode = model.ChannelPricingModePerSecond
			internal.PerSecondUSD = tier.PerUnitUSD
		case "per_minute":
			if tier.PerUnitUSD == nil || !tier.PerUnitUSD.Decimal().IsPositive() {
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
// bailianImageTaskExpression maps the image task plugins' declared usage facts
// to the official per-image prices. Qwen-Image3 reports output_image_type and
// input_image_count; Z-Image reports prompt_extend.
func bailianImageTaskExpression(components []model.ChannelPricingComponent) string {
	prices := make(map[string]model.Money, len(components))
	for _, component := range components {
		prices[strings.ToLower(component.Type)] = component.USD
	}
	if output1, ok1 := prices["qima_output_1k"]; ok1 {
		if output2, ok2 := prices["qima_output_2k"]; ok2 {
			output := fmt.Sprintf(`(u("output_image_type") == "qima_output_2k" ? %s : %s)`,
				formatExprNumber(output2), formatExprNumber(output1))
			terms := fmt.Sprintf(`u("image_count") * %s`, output)
			if input1, okInput1 := prices["qima_input_1k"]; okInput1 {
				if input2, okInput2 := prices["qima_input_2k"]; okInput2 {
					input := fmt.Sprintf(`(u("output_image_type") == "qima_output_2k" ? %s : %s)`,
						formatExprNumber(input2), formatExprNumber(input1))
					terms += fmt.Sprintf(` + u("input_image_count") * %s`, input)
				}
			}
			return fmt.Sprintf(`tier("qwen-image", %s)`, terms)
		}
	}
	if standard, okStandard := prices["image_standard"]; okStandard {
		if thinking, okThinking := prices["image_thinking"]; okThinking {
			return fmt.Sprintf(`tier("z-image", u("image_count") * (u("prompt_extend") ? %s : %s))`,
				formatExprNumber(thinking), formatExprNumber(standard))
		}
	}
	return ""
}

func bailianTierExpression(tiers []model.ChannelPricingTier) string {
	bands := make(map[string]bool, len(tiers))
	for _, tier := range tiers {
		bands[bailianTimeBand(tier.TimeBand)] = true
	}
	switch len(bands) {
	case 1:
		for band := range bands {
			return bailianBandExpression(tiers, band)
		}
		return ""
	case 2:
		if !bands["peak"] || !bands["offpeak"] {
			return ""
		}
		peak := bailianTiersForBand(tiers, "peak")
		offpeak := bailianTiersForBand(tiers, "offpeak")
		peakExpr := bailianBandExpression(peak, "peak")
		offpeakExpr := bailianBandExpression(offpeak, "offpeak")
		if peakExpr == "" || offpeakExpr == "" {
			return ""
		}
		// Bailian's off-peak window is 22:00-08:00 Asia/Shanghai; the rest is
		// peak. Use the request time, matching the upstream price schedule.
		return fmt.Sprintf(`(hour("Asia/Shanghai") >= 22 || hour("Asia/Shanghai") < 8 ? %s : %s)`,
			offpeakExpr, peakExpr)
	default:
		return ""
	}
}

func bailianTimeBand(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", "standard":
		return "standard"
	case "peak":
		return "peak"
	case "offpeak":
		return "offpeak"
	default:
		return strings.ToLower(strings.TrimSpace(raw))
	}
}

func bailianTiersForBand(tiers []model.ChannelPricingTier, band string) []model.ChannelPricingTier {
	out := make([]model.ChannelPricingTier, 0, len(tiers))
	for _, tier := range tiers {
		if bailianTimeBand(tier.TimeBand) == band {
			out = append(out, tier)
		}
	}
	return out
}

func bailianBandExpression(tiers []model.ChannelPricingTier, band string) string {
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
		if !exprMoneyPositive(tier.InputPerMillionUSD) {
			return ""
		}
		input := *tier.InputPerMillionUSD
		terms := []string{}
		if exprMoneyPositive(tier.ThinkingInputPerMillionUSD) &&
			!exprMoneyEqual(*tier.ThinkingInputPerMillionUSD, input) {
			terms = append(terms, fmt.Sprintf("p * (rt > 0 ? %s : %s)",
				formatExprNumber(*tier.ThinkingInputPerMillionUSD), formatExprNumber(input)))
		} else {
			terms = append(terms, fmt.Sprintf("p * %s", formatExprNumber(input)))
		}
		if exprMoneyPositive(tier.ImageInputPerMillionUSD) {
			image := *tier.ImageInputPerMillionUSD
			if exprMoneyPositive(tier.ThinkingImageInputPerMillionUSD) &&
				!exprMoneyEqual(*tier.ThinkingImageInputPerMillionUSD, image) {
				terms = append(terms, fmt.Sprintf("img * (rt > 0 ? %s : %s)",
					formatExprNumber(*tier.ThinkingImageInputPerMillionUSD), formatExprNumber(image)))
			} else {
				terms = append(terms, fmt.Sprintf("img * %s", formatExprNumber(image)))
			}
		}
		if exprMoneyPositive(tier.OutputPerMillionUSD) {
			output := *tier.OutputPerMillionUSD
			normalOutput := formatExprNumber(output)
			if exprMoneyPositive(tier.MultiInputOutputPerMillionUSD) &&
				!exprMoneyEqual(*tier.MultiInputOutputPerMillionUSD, output) {
				normalOutput = fmt.Sprintf("(img > 0 ? %s : %s)",
					formatExprNumber(*tier.MultiInputOutputPerMillionUSD), normalOutput)
			}
			if exprMoneyPositive(tier.ThinkingOutputPerMillionUSD) &&
				!exprMoneyEqual(*tier.ThinkingOutputPerMillionUSD, output) {
				thinkingOutput := formatExprNumber(*tier.ThinkingOutputPerMillionUSD)
				if exprMoneyPositive(tier.ThinkingMultiInputOutputPerMillionUSD) &&
					!exprMoneyEqual(*tier.ThinkingMultiInputOutputPerMillionUSD, *tier.ThinkingOutputPerMillionUSD) {
					thinkingOutput = fmt.Sprintf("(img > 0 ? %s : %s)",
						formatExprNumber(*tier.ThinkingMultiInputOutputPerMillionUSD), thinkingOutput)
				}
				terms = append(terms, fmt.Sprintf("c * (rt > 0 ? %s : %s)", thinkingOutput, normalOutput))
			} else {
				terms = append(terms, fmt.Sprintf("c * %s", normalOutput))
			}
		}
		if exprMoneyPositive(tier.CachePerMillionUSD) {
			cache := *tier.CachePerMillionUSD
			if exprMoneyPositive(tier.ThinkingCachePerMillionUSD) &&
				!exprMoneyEqual(*tier.ThinkingCachePerMillionUSD, cache) {
				terms = append(terms, fmt.Sprintf("cr * (rt > 0 ? %s : %s)",
					formatExprNumber(*tier.ThinkingCachePerMillionUSD), formatExprNumber(cache)))
			} else {
				terms = append(terms, fmt.Sprintf("cr * %s", formatExprNumber(cache)))
			}
		}
		if exprMoneyPositive(tier.CreateCachePerMillionUSD) {
			createCache := *tier.CreateCachePerMillionUSD
			if exprMoneyPositive(tier.ThinkingCreateCachePerMillionUSD) &&
				!exprMoneyEqual(*tier.ThinkingCreateCachePerMillionUSD, createCache) {
				terms = append(terms, fmt.Sprintf("cc * (rt > 0 ? %s : %s)",
					formatExprNumber(*tier.ThinkingCreateCachePerMillionUSD), formatExprNumber(createCache)))
			} else {
				terms = append(terms, fmt.Sprintf("cc * %s", formatExprNumber(createCache)))
			}
		}
		if exprMoneyPositive(tier.AudioInputPerMillionUSD) {
			terms = append(terms, fmt.Sprintf("ai * %s", formatExprNumber(*tier.AudioInputPerMillionUSD)))
		}
		if exprMoneyPositive(tier.AudioOutputPerMillionUSD) {
			terms = append(terms, fmt.Sprintf("ao * %s", formatExprNumber(*tier.AudioOutputPerMillionUSD)))
		}
		name := tier.RangeName
		if strings.TrimSpace(name) == "" {
			name = "tier"
		}
		if band == "peak" || band == "offpeak" {
			name = band + ":" + name
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

// formatExprNumber emits an exact decimal literal for the billing expression
// engine. It deliberately avoids float64 so a price parsed from the catalog is
// not rounded by a float round-trip before it enters the expression.
func formatExprNumber(value model.Money) string {
	d := value.Decimal()
	places := int32(0)
	if d.Exponent() < 0 {
		places = -d.Exponent()
	}
	return d.StringFixed(places)
}

func exprMoneyPositive(value *model.Money) bool {
	return value != nil && value.Decimal().IsPositive()
}

func exprMoneyEqual(value model.Money, other model.Money) bool {
	return value.Decimal().Equal(other.Decimal())
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
// The catalog is Alibaba's supplier quote, not the model vendor's official
// list price. Its tiers are therefore stored as ChannelPriceTiers while the
// official tier list stays empty. Multiple ranges/time bands remain separate
// and are flagged for review; they are never averaged into one number.
func bailianOfficialPricing(item BailianModel, region BailianRegion, rate float64, fetchedAt int64) model.ChannelOfficialPricing {
	// 百炼目录没有币种字段：这里只能按地域推断，必须把「推断」事实写进
	// 价格记录，并把原始币种与标准化金额币种分开保存。
	sourceCurrency, currencyInferred := bailianCurrencyForRegion(region)
	normalizedCurrency := ""
	if sourceCurrency != "" {
		normalizedCurrency = "USD"
	}
	result := model.ChannelOfficialPricing{
		Currency:           sourceCurrency,
		SourceCurrency:     sourceCurrency,
		NormalizedCurrency: normalizedCurrency,
		CurrencyInferred:   currencyInferred,
		Unit:               "per_1m_token",
		PriceKind:          "CHANNEL_QUOTE",
		Source:             bailianCatalogSource,
		FetchedAt:          fetchedAt,
	}
	if sourceCurrency == "CNY" {
		result.FXRateToUSD = rate
		result.FXSource = "system:USDExchangeRate"
		result.FXTimestamp = fetchedAt
		if rate <= 0 {
			result.NeedsReview = true
			result.ReviewReasons = append(result.ReviewReasons, "CNY quote has no valid USD exchange rate")
		}
	}
	if sourceCurrency == "" {
		result.NeedsReview = true
		result.ReviewReasons = append(result.ReviewReasons, "source currency cannot be confirmed")
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
		if result.SourceCurrency == "CNY" && rate > 0 {
			value /= rate
		}
		if unit == "per_1k_tokens" {
			value *= 1000
		}
		return value
	}
	setTokenPrice := func(target **model.Money, usd float64, label string) {
		if *target == nil {
			value := model.MoneyFromFloat(usd)
			*target = &value
			return
		}
		if !(*target).Decimal().Equal(model.MoneyFromFloat(usd).Decimal()) {
			result.ReviewReasons = append(result.ReviewReasons, "multiple "+label+" prices")
		}
	}
	addPerUnitPrice := func(tier *model.ChannelPricingTier, unit string, usd float64, price BailianPrice, priceType string) {
		if tier.PerUnitUSD == nil {
			value := model.MoneyFromFloat(usd)
			tier.PerUnitUSD = &value
			tier.Unit = unit
			result.Unit = unit
			componentByTier[tier] = model.ChannelPricingComponent{
				Name: price.PriceName, Type: priceType, Unit: unit, USD: model.MoneyFromFloat(usd),
			}
			return
		}
		if tier.PerUnitUSD.Float64() != usd {
			result.ReviewReasons = append(result.ReviewReasons, "multiple per-unit prices")
		}
	}
	for _, priceRange := range item.Prices {
		countRanges[priceRange.RangeName] = true
		for _, price := range priceRange.Prices {
			band := strings.TrimSpace(price.TimeBand)
			countBands[bailianTimeBand(band)] = true
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
			tier.RawComponents = append(tier.RawComponents, model.ChannelPricingRawComponent{
				Type: priceType, Name: price.PriceName,
				RawAmount: model.MoneyFromFloat(value), RawCurrency: sourceCurrency, RawUnit: price.PriceUnit,
				SourceCurrency: sourceCurrency, NormalizedCurrency: normalizedCurrency,
				NormalizedUSD: model.MoneyFromFloat(usd), FXRate: result.FXRateToUSD, FXSource: result.FXSource,
				FXTimestamp: result.FXTimestamp, CurrencyInferred: currencyInferred,
				PriceSource: bailianCatalogSource, EffectiveAt: fetchedAt,
			})
			// Batch endpoints publish their own discounted price. They are a
			// separate service, not the standard realtime price, so they must not
			// overwrite or block the primary price used by the relay.
			if strings.Contains(priceType, "_batch") {
				continue
			}
			tier.RawPriceTypes = append(tier.RawPriceTypes, priceType)
			switch {
			case strings.Contains(priceType, "cache") && strings.Contains(priceType, "creation"):
				if strings.Contains(priceType, "thinking") {
					setTokenPrice(&tier.ThinkingCreateCachePerMillionUSD, usd, "thinking cache creation")
				} else {
					setTokenPrice(&tier.CreateCachePerMillionUSD, usd, "cache creation")
				}
			case priceType == "input_token" || priceType == "input_tokens" || priceType == "text_input" ||
				priceType == "text_input_token" || priceType == "thinking_text_input_token" ||
				priceType == "mt_character_input_token" ||
				priceType == "embedding_token" || priceType == "translate_audio_input_token" ||
				priceType == "omni_no_audio_input_token" || priceType == "audio_text_input_token" ||
				priceType == "omni_input_token":
				setTokenPrice(&tier.InputPerMillionUSD, usd, "input token")
				result.Unit = "per_1m_token"
			case priceType == "output_token" || priceType == "output_tokens" || priceType == "text_output" ||
				priceType == "translate_multi_text_output_token" ||
				priceType == "omni_no_audio_output_token" || priceType == "audio_text_output_token" ||
				priceType == "omni_output_token" || priceType == "purein_text_output_token" ||
				priceType == "thinking_purein_text_output_token" ||
				priceType == "omni_text_output_token":
				setTokenPrice(&tier.OutputPerMillionUSD, usd, "output token")
				result.Unit = "per_1m_token"
			// Vision input is a separate token dimension and the relay reports
			// image_tokens, so it can be priced exactly with the `img` variable.
			case priceType == "vision_input_token" || priceType == "translate_vision_input_token" ||
				priceType == "mt_image_input_token":
				setTokenPrice(&tier.ImageInputPerMillionUSD, usd, "image input token")
			case priceType == "thinking_vision_input_token":
				setTokenPrice(&tier.ThinkingImageInputPerMillionUSD, usd, "thinking image input token")
			case priceType == "multiin_text_output_token":
				setTokenPrice(&tier.MultiInputOutputPerMillionUSD, usd, "multi-input output token")
			case priceType == "thinking_multiin_text_output_token":
				setTokenPrice(&tier.ThinkingMultiInputOutputPerMillionUSD, usd, "thinking multi-input output token")
			case priceType == "mt_audio_input_token":
				setTokenPrice(&tier.AudioInputPerMillionUSD, usd, "audio input token")
			case priceType == "mt_document_input_token" ||
				priceType == "vision_output_token" || priceType == "thinking_vision_output_token":
				// Document input and image output have no matching billing
				// variable; keep the model review-only instead of undercharging.
				unknownTypes[priceType] = true
			case priceType == "audio_input_token" || priceType == "omni_audio_input_token" ||
				priceType == "thinking_audio_input_token":
				setTokenPrice(&tier.AudioInputPerMillionUSD, usd, "audio input token")
				result.Unit = "per_1m_token"
			case priceType == "audio_output_token" || priceType == "omni_audio_output_token" ||
				priceType == "multi_output_token" || priceType == "translate_multi_output_token":
				setTokenPrice(&tier.AudioOutputPerMillionUSD, usd, "audio output token")
				result.Unit = "per_1m_token"
			case priceType == "thinking_input_token_cache" ||
				(priceType == "thinking_input_token_cache_read"):
				setTokenPrice(&tier.ThinkingCachePerMillionUSD, usd, "thinking cache read")
			case priceType == "input_token_cache" || priceType == "omni_input_token_cache" ||
				(strings.Contains(priceType, "cache") && strings.Contains(priceType, "read")):
				setTokenPrice(&tier.CachePerMillionUSD, usd, "cache read")
			// Reasoning-mode prices are a variant of the primary input/output price.
			// They stay visible as components only when they differ, so the standard
			// price remains the billable tier.
			case priceType == "thinking_input_token":
				setTokenPrice(&tier.ThinkingInputPerMillionUSD, usd, "thinking input token")
			case priceType == "thinking_output_token":
				setTokenPrice(&tier.ThinkingOutputPerMillionUSD, usd, "thinking output token")
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
				// Qwen-Image3's task plugin reports output_image_type and
				// input_image_count, so the tiered per-image prices are exact.
				result.ComponentPrices = append(result.ComponentPrices, model.ChannelPricingComponent{
					Name: price.PriceName, Type: priceType, Unit: "per_image", USD: model.MoneyFromFloat(usd),
				})
				result.Unit = "per_image"
			case priceType == "image_standard" || priceType == "image_thinking":
				// Z-Image's plugin reports prompt_extend, which selects between
				// the standard and thinking per-image price.
				result.ComponentPrices = append(result.ComponentPrices, model.ChannelPricingComponent{
					Name: price.PriceName, Type: priceType, Unit: "per_image", USD: model.MoneyFromFloat(usd),
				})
				result.Unit = "per_image"
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
	}
	// Context-length ranges are executable when every tier is a token tier;
	// the sale price then becomes one tiered expression. Mixed units or media
	// dimensions cannot be flattened and are named below.
	tokenTiersOnly := true
	for _, tier := range result.ChannelPriceTiers {
		if tier.Unit != "per_1m_token" && tier.Unit != "per_1m_tokens" {
			tokenTiersOnly = false
			break
		}
	}
	if len(countRanges) > 1 && !tokenTiersOnly {
		result.ReviewReasons = append(result.ReviewReasons, "multiple price ranges")
	}
	if len(countBands) > 1 {
		supportedBands := true
		for band := range countBands {
			if band != "standard" && band != "peak" && band != "offpeak" {
				result.ReviewReasons = append(result.ReviewReasons, "unsupported time band: "+band)
				supportedBands = false
			}
		}
		if supportedBands && !(len(countBands) == 2 && countBands["peak"] && countBands["offpeak"]) {
			result.ReviewReasons = append(result.ReviewReasons, "unsupported time band combination")
		}
	}
	// Multi-tier rows are only executable when every tier is a token tier.
	// Media dimensions mixed into several ranges cannot be flattened into one
	// expression, so name the reason instead of leaving a silent empty sale price.
	if len(result.ChannelPriceTiers) > 1 {
		for _, tier := range result.ChannelPriceTiers {
			if tier.Unit != "per_1m_token" && tier.Unit != "per_1m_tokens" {
				result.ReviewReasons = append(result.ReviewReasons, "mixed price units across tiers need manual pricing")
				break
			}
		}
	}
	multipleInputPrices := false
	for priceType := range unknownTypes {
		result.ReviewReasons = append(result.ReviewReasons, "unsupported price type: "+priceType)
		lower := strings.ToLower(priceType)
		if strings.Contains(lower, "input") &&
			!strings.Contains(lower, "batch") &&
			!strings.Contains(lower, "chat") &&
			!strings.Contains(lower, "thinking") {
			multipleInputPrices = true
		}
	}
	if multipleInputPrices {
		result.ReviewReasons = append(result.ReviewReasons, "multiple input token prices")
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
		tier.CachePerMillionUSD != nil || tier.CreateCachePerMillionUSD != nil ||
		tier.ImageInputPerMillionUSD != nil || tier.ThinkingInputPerMillionUSD != nil ||
		tier.ThinkingOutputPerMillionUSD != nil || tier.ThinkingCachePerMillionUSD != nil ||
		tier.ThinkingCreateCachePerMillionUSD != nil
}

func bailianTierNeedsExpression(tier model.ChannelPricingTier) bool {
	return tier.ImageInputPerMillionUSD != nil ||
		tier.ThinkingInputPerMillionUSD != nil ||
		tier.ThinkingOutputPerMillionUSD != nil ||
		tier.ThinkingCachePerMillionUSD != nil ||
		tier.ThinkingCreateCachePerMillionUSD != nil ||
		tier.MultiInputOutputPerMillionUSD != nil ||
		tier.ThinkingMultiInputOutputPerMillionUSD != nil ||
		tier.ThinkingImageInputPerMillionUSD != nil
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
	raw := strings.TrimSpace(common.GetOption(BailianSyncStatusKey))
	if raw == "" {
		return nil
	}
	var status BailianSyncStatus
	if err := common.Unmarshal([]byte(raw), &status); err != nil {
		return nil
	}
	return &status
}
