package model

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/shopspring/decimal"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/pkg/billingexpr"
	"github.com/uter-ai/uter/relaykit/dto"
	"gorm.io/gorm"
)

// Channel pricing status. Official data and the operator's internal sale price
// are deliberately separate: a synced official price alone never becomes a
// billable price.
const (
	ChannelPricingStatusOfficialOnly = "official_only"
	ChannelPricingStatusConfigured   = "configured"
	ChannelPricingStatusNeedsReview  = "needs_review"
)

// PricingOwner records who owns a sale price. Unlike the legacy Source string,
// these four values are the authoritative answer to "may a sync overwrite it".
const (
	ChannelPricingOwnerAuto     = "AUTO"
	ChannelPricingOwnerOperator = "OPERATOR"
	ChannelPricingOwnerBatch    = "BATCH"
	ChannelPricingOwnerApproved = "APPROVED"
)

// Upstream model lifecycle. Lifecycle is independent from the price status:
// a DISABLED model keeps its historical prices but can no longer bill.
const (
	ChannelModelLifecycleActive     = "ACTIVE"
	ChannelModelLifecycleUpdated    = "UPDATED"
	ChannelModelLifecycleDeprecated = "DEPRECATED"
	ChannelModelLifecycleDisabled   = "DISABLED"
	ChannelModelLifecycleNotFound   = "NOT_FOUND"
	ChannelModelLifecycleSyncFailed = "SYNC_FAILED"
)

const ChannelModelMissingDisableThreshold = 2

const (
	ChannelPricingModePerMillionTokens = "per_1m_token"
	ChannelPricingModePerCall          = "per_call"
	ChannelPricingModePerSecond        = "per_second"
	ChannelPricingModeTieredExpr       = "tiered_expr"
	ChannelPricingModePerMinute        = "per_minute"
	ChannelPricingModeTieredTable      = "tiered_table"
)

// ChannelModelPricing is one channel's independent price record for one model.
// The unique key is the full upstream identity (channel, provider, region,
// deployment, model): the same model served by another channel, region or
// deployment is a different row and cannot be overwritten by a sync.
type ChannelModelPricing struct {
	Id                int64  `gorm:"primaryKey;autoIncrement"`
	ChannelId         int    `gorm:"uniqueIndex:idx_channel_model_pricing_identity,priority:1;index:idx_channel_model_lookup,priority:1"`
	Provider          string `gorm:"size:64;uniqueIndex:idx_channel_model_pricing_identity,priority:2"`
	ModelProvider     string `gorm:"size:64;index"`
	ModelName         string `gorm:"size:255;uniqueIndex:idx_channel_model_pricing_identity,priority:5;index:idx_channel_model_lookup,priority:2"`
	Region            string `gorm:"size:64;uniqueIndex:idx_channel_model_pricing_identity,priority:3"`
	DeploymentId      string `gorm:"size:128;uniqueIndex:idx_channel_model_pricing_identity,priority:4"`
	Currency          string `gorm:"size:16"`
	OfficialPricing   string `gorm:"type:text"`
	NormalizedPricing string `gorm:"type:text"`
	InternalPricing   string `gorm:"type:text"`
	// PurchasePricing stores the operator-confirmed contract cost separately
	// from the upstream public quote, so a sync cannot overwrite it and margin
	// can distinguish verified cost from an estimate.
	PurchasePricing string `gorm:"type:text"`
	PricingSource   string `gorm:"size:64"`
	// PricingOwner 是价格所有权；空值表示尚未打标签的历史行，由 Source 兜底判定。
	PricingOwner   string `gorm:"size:16;index"`
	PricingStatus  string `gorm:"size:32;index"`
	PricingVersion string `gorm:"size:64"`
	FetchedAt      int64
	UpdatedAt      int64
	// LifecycleStatus is the upstream catalog state. Empty is treated as
	// ACTIVE for rows created before lifecycle tracking existed.
	LifecycleStatus    string `gorm:"size:32;index"`
	LifecycleReason    string `gorm:"size:255"`
	LastSeenAt         int64
	MissingSyncCount   int
	LifecycleUpdatedAt int64
}

func (ChannelModelPricing) TableName() string { return "channel_model_pricing" }

// ChannelPricingTier is one official price band. Amounts are USD per unit so
// comparisons never depend on the source currency or unit.
type ChannelPricingRawComponent struct {
	Type        string `json:"type"`
	Name        string `json:"name,omitempty"`
	RawAmount   Money  `json:"raw_amount"`
	RawCurrency string `json:"raw_currency"`
	RawUnit     string `json:"raw_unit"`
	// SourceCurrency 是上游原始币种；NormalizedCurrency 是换算后金额的币种。
	// RawCurrency 保留旧字段名以便历史记录继续可读。
	SourceCurrency     string  `json:"source_currency,omitempty"`
	NormalizedCurrency string  `json:"normalized_currency,omitempty"`
	NormalizedUSD      Money   `json:"normalized_usd"`
	FXRate             float64 `json:"fx_rate,omitempty"`
	FXSource           string  `json:"fx_source,omitempty"`
	FXTimestamp        int64   `json:"fx_timestamp,omitempty"`
	CurrencyInferred   bool    `json:"currency_inferred"`
	PriceSource        string  `json:"price_source"`
	EffectiveAt        int64   `json:"effective_at,omitempty"`
}

type ChannelPricingTier struct {
	RangeName                             string                       `json:"range_name"`
	TimeBand                              string                       `json:"time_band,omitempty"`
	MinInputTokens                        int64                        `json:"min_input_tokens,omitempty"`
	MaxInputTokens                        int64                        `json:"max_input_tokens,omitempty"`
	InputPerMillionUSD                    *Money                       `json:"input_per_million_usd,omitempty"`
	OutputPerMillionUSD                   *Money                       `json:"output_per_million_usd,omitempty"`
	CachePerMillionUSD                    *Money                       `json:"cache_per_million_usd,omitempty"`
	CreateCachePerMillionUSD              *Money                       `json:"create_cache_per_million_usd,omitempty"`
	ImageInputPerMillionUSD               *Money                       `json:"image_input_per_million_usd,omitempty"`
	ThinkingInputPerMillionUSD            *Money                       `json:"thinking_input_per_million_usd,omitempty"`
	ThinkingOutputPerMillionUSD           *Money                       `json:"thinking_output_per_million_usd,omitempty"`
	ThinkingCachePerMillionUSD            *Money                       `json:"thinking_cache_per_million_usd,omitempty"`
	ThinkingCreateCachePerMillionUSD      *Money                       `json:"thinking_create_cache_per_million_usd,omitempty"`
	ThinkingImageInputPerMillionUSD       *Money                       `json:"thinking_image_input_per_million_usd,omitempty"`
	MultiInputOutputPerMillionUSD         *Money                       `json:"multi_input_output_per_million_usd,omitempty"`
	ThinkingMultiInputOutputPerMillionUSD *Money                       `json:"thinking_multi_input_output_per_million_usd,omitempty"`
	AudioInputPerMillionUSD               *Money                       `json:"audio_input_per_million_usd,omitempty"`
	AudioOutputPerMillionUSD              *Money                       `json:"audio_output_per_million_usd,omitempty"`
	PerUnitUSD                            *Money                       `json:"per_unit_usd,omitempty"`
	Unit                                  string                       `json:"unit"`
	RawPriceTypes                         []string                     `json:"raw_price_types,omitempty"`
	RawComponents                         []ChannelPricingRawComponent `json:"raw_components,omitempty"`
}

// ChannelPricingComponent is an additional billable service the catalog
// publishes for the same model, stored so both prices stay visible without
// forcing a second billing dimension.
type ChannelPricingComponent struct {
	Name string `json:"name,omitempty"`
	Type string `json:"type,omitempty"`
	Unit string `json:"unit"`
	USD  Money  `json:"usd"`
}

// ChannelRatioBasis documents a ratio-to-absolute conversion. The basis is the
// USD value of one ratio unit per million tokens; Uter's New API convention is
// 2.0. FormulaVersion changes whenever that convention or the formula changes.
type ChannelRatioBasis struct {
	RawRatio           float64 `json:"raw_ratio"`
	RawCompletionRatio float64 `json:"raw_completion_ratio,omitempty"`
	BasisUSDPerMillion Money   `json:"basis_usd_per_million"`
	Formula            string  `json:"formula"`
	FormulaVersion     string  `json:"formula_version"`
	ResultInputUSD     Money   `json:"result_input_usd_per_million"`
	ResultOutputUSD    Money   `json:"result_output_usd_per_million,omitempty"`
}

// ChannelOfficialPricing is the normalized official view for one channel
// model. The untouched source payload is kept in ChannelModelPricing.
type ChannelOfficialPricing struct {
	// Currency 保留为原始币种以兼容历史记录；金额的标准化币种必须以
	// NormalizedCurrency 为准，不得从 Currency 推断。
	Currency string `json:"currency"`
	// SourceCurrency 是上游返回的原始币种；空值表示上游未提供且无法确认。
	SourceCurrency string `json:"source_currency,omitempty"`
	// NormalizedCurrency 是 NormalizedUSD / Tier USD 金额的币种，通常为 USD。
	NormalizedCurrency string               `json:"normalized_currency,omitempty"`
	CurrencyInferred   bool                 `json:"currency_inferred,omitempty"`
	FXRateToUSD        float64              `json:"fx_rate_to_usd,omitempty"`
	FXSource           string               `json:"fx_source,omitempty"`
	FXTimestamp        int64                `json:"fx_timestamp,omitempty"`
	Unit               string               `json:"unit"`
	Tiers              []ChannelPricingTier `json:"tiers"`
	// PriceKind classifies where the amounts came from. A ratio converted with
	// an assumed basis is not an official absolute price and must not be
	// presented as one.
	PriceKind string `json:"price_kind,omitempty"`
	// RatioBasis records how a ratio became an absolute amount: the raw ratio,
	// the USD-per-million-token basis, the formula and its version.
	RatioBasis *ChannelRatioBasis `json:"ratio_basis,omitempty"`
	// ChannelPrice is the upstream channel price after applying the provider's
	// discount for the selected billing group. It is separate from Tiers so the
	// official list price stays auditable.
	ChannelPrice      *ChannelPricingTier  `json:"channel_price,omitempty"`
	ChannelPriceTiers []ChannelPricingTier `json:"channel_price_tiers,omitempty"`
	// ComponentPrices lists additional billable services the catalog publishes
	// for the same model (for example voice cloning per call next to
	// per-character synthesis). The token tier stays the billable primary price.
	ComponentPrices    []ChannelPricingComponent `json:"component_prices,omitempty"`
	DiscountGroup      string                    `json:"discount_group,omitempty"`
	DiscountModelGroup string                    `json:"discount_model_group,omitempty"`
	DiscountRatio      *float64                  `json:"discount_ratio,omitempty"`
	Source             string                    `json:"source"`
	FetchedAt          int64                     `json:"fetched_at"`
	// BillingExpr is the upstream's complete executable rule, preserved
	// verbatim. ExpressionHash makes a rule change auditable without comparing
	// formatted text. Status is EXECUTABLE only after Uter's engine compiles it.
	BillingMode      string   `json:"billing_mode,omitempty"`
	BillingExpr      string   `json:"billing_expr,omitempty"`
	ExpressionHash   string   `json:"expression_hash,omitempty"`
	ExpressionStatus string   `json:"expression_status,omitempty"`
	ExpressionError  string   `json:"expression_error,omitempty"`
	NeedsReview      bool     `json:"needs_review,omitempty"`
	ReviewReasons    []string `json:"review_reasons,omitempty"`
}

// ChannelInternalPricing is the operator's flat sale price for one channel
// model. Tiered official prices are never flattened into this structure.
// ChannelInternalPricingTier is one operator sale-price band. Ranges are
// context-length bands on input tokens; the billing expression selects the band
// at request time so tiered pricing is executable instead of display-only.
type ChannelInternalPricingTier struct {
	RangeName                string `json:"range_name"`
	TimeBand                 string `json:"time_band,omitempty"`
	MinInputTokens           int64  `json:"min_input_tokens,omitempty"`
	MaxInputTokens           int64  `json:"max_input_tokens,omitempty"`
	InputUSDPerMillion       *Money `json:"input_per_million_usd,omitempty"`
	OutputUSDPerMillion      *Money `json:"output_per_million_usd,omitempty"`
	CacheUSDPerMillion       *Money `json:"cache_per_million_usd,omitempty"`
	CreateCacheUSDPerMillion *Money `json:"create_cache_per_million_usd,omitempty"`
	AudioInputUSDPerMillion  *Money `json:"audio_input_per_million_usd,omitempty"`
	AudioOutputUSDPerMillion *Money `json:"audio_output_per_million_usd,omitempty"`
	// Modality and reasoning dimensions bill through the same expression
	// engine as the official tiers. Null means the model has no separate
	// price for that dimension; it is never defaulted to the text price.
	ImageInputUSDPerMillion               *Money `json:"image_input_per_million_usd,omitempty"`
	ThinkingInputUSDPerMillion            *Money `json:"thinking_input_per_million_usd,omitempty"`
	ThinkingOutputUSDPerMillion           *Money `json:"thinking_output_per_million_usd,omitempty"`
	ThinkingCacheUSDPerMillion            *Money `json:"thinking_cache_per_million_usd,omitempty"`
	ThinkingCreateCacheUSDPerMillion      *Money `json:"thinking_create_cache_per_million_usd,omitempty"`
	ThinkingImageInputUSDPerMillion       *Money `json:"thinking_image_input_per_million_usd,omitempty"`
	MultiInputOutputUSDPerMillion         *Money `json:"multi_input_output_per_million_usd,omitempty"`
	ThinkingMultiInputOutputUSDPerMillion *Money `json:"thinking_multi_input_output_per_million_usd,omitempty"`
	PerUnitUSD                            *Money `json:"per_unit_usd,omitempty"`
	Unit                                  string `json:"unit"`
}

type ChannelInternalPricing struct {
	Mode                string `json:"mode"`
	InputUSDPerMillion  *Money `json:"input_per_million_usd,omitempty"`
	OutputUSDPerMillion *Money `json:"output_per_million_usd,omitempty"`
	CacheUSDPerMillion  *Money `json:"cache_per_million_usd,omitempty"`
	// Audio absolute prices for token models. AudioRatio and
	// AudioCompletionRatio are derived from them when set, so billing keeps
	// using the ratio fields while the operator edits absolute prices.
	AudioInputUSDPerMillion  *Money   `json:"audio_input_per_million_usd,omitempty"`
	AudioOutputUSDPerMillion *Money   `json:"audio_output_per_million_usd,omitempty"`
	AudioRatio               *float64 `json:"audio_ratio,omitempty"`
	AudioCompletionRatio     *float64 `json:"audio_completion_ratio,omitempty"`
	// CreateCacheUSDPerMillion is the cache-write price. When omitted the
	// global create-cache ratio remains in force.
	CreateCacheUSDPerMillion *Money `json:"create_cache_per_million_usd,omitempty"`
	// Separate modality/reasoning sale prices. When any is set, the normalized
	// billing form is a per-token expression so image, thinking and multimodal
	// usage cannot be charged at the text price.
	ImageInputUSDPerMillion               *Money `json:"image_input_per_million_usd,omitempty"`
	ThinkingInputUSDPerMillion            *Money `json:"thinking_input_per_million_usd,omitempty"`
	ThinkingOutputUSDPerMillion           *Money `json:"thinking_output_per_million_usd,omitempty"`
	ThinkingCacheUSDPerMillion            *Money `json:"thinking_cache_per_million_usd,omitempty"`
	ThinkingCreateCacheUSDPerMillion      *Money `json:"thinking_create_cache_per_million_usd,omitempty"`
	ThinkingImageInputUSDPerMillion       *Money `json:"thinking_image_input_per_million_usd,omitempty"`
	MultiInputOutputUSDPerMillion         *Money `json:"multi_input_output_per_million_usd,omitempty"`
	ThinkingMultiInputOutputUSDPerMillion *Money `json:"thinking_multi_input_output_per_million_usd,omitempty"`
	PerCallUSD                            *Money `json:"per_call_usd,omitempty"`
	PerSecondUSD                          *Money `json:"per_second_usd,omitempty"`
	PerMinuteUSD                          *Money `json:"per_minute_usd,omitempty"`
	// Tiers holds per-range sale prices for tiered_table mode. The normalized
	// billing form is generated from them as a billing expression.
	Tiers       []ChannelInternalPricingTier `json:"tiers,omitempty"`
	BillingExpr string                       `json:"billing_expr,omitempty"`
	Note        string                       `json:"note,omitempty"`
	// Source records who last wrote the internal price. Automatic syncs tag
	// their writes so a later sync may refresh them, while an operator-saved
	// price is never overwritten.
	Source             string  `json:"source,omitempty"`
	DiscountGroup      string  `json:"discount_group,omitempty"`
	DiscountModelGroup string  `json:"discount_model_group,omitempty"`
	DiscountRatio      float64 `json:"discount_ratio,omitempty"`
	UpdatedAt          int64   `json:"updated_at"`
}

// ChannelPurchaseCost is the operator-confirmed contract cost for one channel
// model. It uses the same price shape as the sale price so every dimension can
// be compared, but it is stored separately: upstream syncs never touch it and
// the public quote is not promoted into it.
type ChannelPurchaseCost struct {
	Pricing   ChannelInternalPricing `json:"pricing"`
	Verified  bool                   `json:"verified"`
	Source    string                 `json:"source,omitempty"`
	Note      string                 `json:"note,omitempty"`
	UpdatedAt int64                  `json:"updated_at,omitempty"`
}

// ParseChannelPurchaseCost decodes a stored contract cost. An empty or invalid
// record returns nil rather than falling back to the public quote.
func ParseChannelPurchaseCost(raw string) *ChannelPurchaseCost {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	var cost ChannelPurchaseCost
	if err := common.UnmarshalJsonStr(raw, &cost); err != nil {
		return nil
	}
	return &cost
}

// PurchaseCostPrimaryUSD returns the contract cost on the primary sale
// dimension, used for the consume-log snapshot and the preview comparison.
func PurchaseCostPrimaryUSD(raw string) *Money {
	cost := ParseChannelPurchaseCost(raw)
	if cost == nil {
		return nil
	}
	switch cost.Pricing.Mode {
	case ChannelPricingModePerMillionTokens:
		if len(cost.Pricing.Tiers) > 0 {
			return cost.Pricing.Tiers[0].InputUSDPerMillion
		}
		return cost.Pricing.InputUSDPerMillion
	case ChannelPricingModePerCall:
		return cost.Pricing.PerCallUSD
	case ChannelPricingModePerSecond:
		return cost.Pricing.PerSecondUSD
	case ChannelPricingModePerMinute:
		return cost.Pricing.PerMinuteUSD
	}
	return nil
}

// validatePurchaseCost checks the contract cost without requiring every sale
// dimension: an operator may know only the input cost.
func validatePurchaseCost(pricing *ChannelInternalPricing) error {
	if pricing == nil {
		return errors.New("purchase pricing is required")
	}
	for _, value := range []*Money{
		pricing.InputUSDPerMillion, pricing.OutputUSDPerMillion,
		pricing.CacheUSDPerMillion, pricing.CreateCacheUSDPerMillion,
		pricing.AudioInputUSDPerMillion, pricing.AudioOutputUSDPerMillion,
		pricing.ImageInputUSDPerMillion, pricing.ThinkingInputUSDPerMillion,
		pricing.ThinkingOutputUSDPerMillion, pricing.ThinkingCacheUSDPerMillion,
		pricing.ThinkingCreateCacheUSDPerMillion, pricing.ThinkingImageInputUSDPerMillion,
		pricing.MultiInputOutputUSDPerMillion, pricing.ThinkingMultiInputOutputUSDPerMillion,
		pricing.PerCallUSD, pricing.PerSecondUSD, pricing.PerMinuteUSD,
	} {
		if err := validPricePointer(value); err != nil {
			return err
		}
	}
	for _, tier := range pricing.Tiers {
		if err := validPricePointer(tier.InputUSDPerMillion); err != nil {
			return err
		}
		if err := validPricePointer(tier.OutputUSDPerMillion); err != nil {
			return err
		}
	}
	switch pricing.Mode {
	case ChannelPricingModePerMillionTokens:
		if !moneyPositive(pricing.InputUSDPerMillion) {
			return errors.New("token contract cost requires a positive input price")
		}
	case ChannelPricingModePerCall:
		if !moneyPositive(pricing.PerCallUSD) {
			return errors.New("per-call contract cost is required")
		}
	case ChannelPricingModePerSecond:
		if !moneyPositive(pricing.PerSecondUSD) {
			return errors.New("per-second contract cost is required")
		}
	case ChannelPricingModePerMinute:
		if !moneyPositive(pricing.PerMinuteUSD) {
			return errors.New("per-minute contract cost is required")
		}
	case ChannelPricingModeTieredTable:
		if len(pricing.Tiers) == 0 {
			return errors.New("tiered contract cost requires at least one tier")
		}
	case ChannelPricingModeTieredExpr:
		if strings.TrimSpace(pricing.BillingExpr) == "" {
			return errors.New("expression contract cost requires a billing expression")
		}
	default:
		return errors.New("unsupported purchase pricing mode")
	}
	return nil
}

// SetChannelPurchaseCostFor stores the contract cost on one identity. The
// purchase payload is validated with the same rules as the sale price.
func SetChannelPurchaseCostFor(identity ChannelPricingIdentity, cost ChannelPurchaseCost) error {
	identity = normalizePricingIdentity(identity)
	row, err := GetChannelModelPricingFor(identity)
	if err != nil {
		return err
	}
	if err := validatePurchaseCost(&cost.Pricing); err != nil {
		return fmt.Errorf("invalid purchase cost: %w", err)
	}
	cost.UpdatedAt = time.Now().Unix()
	encoded, err := common.Marshal(cost)
	if err != nil {
		return err
	}
	row.PurchasePricing = string(encoded)
	row.UpdatedAt = cost.UpdatedAt
	row.PricingVersion = channelPricingVersion(*row)
	if err := DB.Model(row).Updates(map[string]any{
		"purchase_pricing": row.PurchasePricing,
		"pricing_version":  row.PricingVersion,
		"updated_at":       row.UpdatedAt,
	}).Error; err != nil {
		return err
	}
	invalidateChannelPricingCache(row.ChannelId, row.ModelName)
	InvalidatePricingCache()
	return nil
}

// ClearChannelPurchaseCostFor removes the stored contract cost. The public
// quote is not promoted in its place, so margin returns to "unverified".
func ClearChannelPurchaseCostFor(identity ChannelPricingIdentity) error {
	identity = normalizePricingIdentity(identity)
	row, err := GetChannelModelPricingFor(identity)
	if err != nil {
		return err
	}
	row.PurchasePricing = ""
	row.UpdatedAt = time.Now().Unix()
	row.PricingVersion = channelPricingVersion(*row)
	if err := DB.Model(row).Updates(map[string]any{
		"purchase_pricing": "",
		"pricing_version":  row.PricingVersion,
		"updated_at":       row.UpdatedAt,
	}).Error; err != nil {
		return err
	}
	invalidateChannelPricingCache(row.ChannelId, row.ModelName)
	InvalidatePricingCache()
	return nil
}

// ChannelBillingPricing is the resolved multiplier form used by the relay.
// CompletionRatio/CacheRatio are nil when the operator did not set an output
// or cache price, in which case the global ratio remains in force.
type ChannelBillingPricing struct {
	Mode                 string
	ModelRatio           float64
	CompletionRatio      *float64
	CacheRatio           *float64
	CreateCacheRatio     *float64
	AudioRatio           *float64
	AudioCompletionRatio *float64
	ModelPrice           float64
	BillingExpr          string
	UsePrice             bool
	UsePerSecond         bool
	PerSecondPrice       float64
	Version              string
	Source               string
	// PurchaseUSD is the upstream channel quote for the primary dimension at
	// resolution time, so the consume log can snapshot procurement next to the
	// sale price.
	PurchaseUSD *float64
	// PurchaseVerified is true only when the cost came from a stored contract
	// cost marked verified; an upstream public quote stays false.
	PurchaseVerified bool
	PurchaseSource   string
	// PurchaseVersion hashes the stored contract cost so a bill can be tied to
	// the exact cost record, not only the sale price version.
	PurchaseVersion string
	// PurchaseContract is the raw per-dimension contract cost. Billing freezes
	// it verbatim so settlement prices every dimension from the submitted
	// contract instead of whatever the channel row says later.
	PurchaseContract string
	// Currency and FXRate snapshot the official source currency and the rate
	// used to convert it, so a historical bill can be reproduced.
	Currency string
	FXRate   float64
}

// ChannelOfficialPricingRecord is one upsert input for an official sync.
type ChannelOfficialPricingRecord struct {
	ChannelId         int
	Provider          string
	ModelProvider     string
	Region            string
	DeploymentId      string
	ModelName         string
	Currency          string
	OfficialPricing   string
	NormalizedPricing string
	// InternalPricing is an optional automatically derived channel price. It is
	// only written when the row has no operator price, or when the existing
	// internal price was itself derived by a previous sync.
	InternalPricing string
	Source          string
	FetchedAt       int64
}

var (
	channelPricingCacheMu sync.RWMutex
	channelPricingCache   = map[string]channelPricingCacheEntry{}
)

type channelPricingCacheEntry struct {
	pricing        *ChannelBillingPricing
	status         string
	lifecycle      string
	reason         string
	billableReason string
	exists         bool
	expiresAt      time.Time
}

const channelPricingCacheTTL = 30 * time.Second

// ChannelPricingIdentity is the full upstream identity a request is billed
// under. Provider, Region and Deployment select the price row; a request that
// cannot be matched must not fall back to another identity's price.
type ChannelPricingIdentity struct {
	ChannelId    int
	Provider     string
	Region       string
	DeploymentId string
	ModelName    string
}

// Identity resolution outcomes that are not a plain "row missing".
const (
	ChannelPricingReasonIdentityMissing   = "identity_missing"
	ChannelPricingReasonIdentityAmbiguous = "identity_ambiguous"
)

// channelPurchasePrimaryUSD returns the channel quote for the primary
// dimension (input per 1M, or the per-call/second/minute amount). Nil means the
// provider published no purchase quote.
func channelPurchasePrimaryUSD(raw string) *float64 {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	var view ChannelOfficialPricing
	if err := common.UnmarshalJsonStr(raw, &view); err != nil {
		return nil
	}
	quote := view.ChannelPrice
	if quote == nil && len(view.ChannelPriceTiers) > 0 {
		quote = &view.ChannelPriceTiers[0]
	}
	if quote == nil {
		return nil
	}
	if quote.InputPerMillionUSD != nil {
		value := quote.InputPerMillionUSD.Float64()
		return &value
	}
	if quote.PerUnitUSD != nil {
		value := quote.PerUnitUSD.Float64()
		return &value
	}
	return nil
}

func normalizePricingIdentity(identity ChannelPricingIdentity) ChannelPricingIdentity {
	identity.Provider = strings.TrimSpace(identity.Provider)
	identity.Region = strings.TrimSpace(identity.Region)
	identity.DeploymentId = strings.TrimSpace(identity.DeploymentId)
	identity.ModelName = strings.TrimSpace(identity.ModelName)
	return identity
}

func channelPricingCacheKey(identity ChannelPricingIdentity) string {
	identity = normalizePricingIdentity(identity)
	return fmt.Sprintf("%d\x00%s\x00%s\x00%s\x00%s",
		identity.ChannelId, identity.Provider, identity.Region, identity.DeploymentId, identity.ModelName)
}

// invalidateChannelPricingCache drops every identity cached for this model, so
// a write to one region cannot leave another region's price stale.
func invalidateChannelPricingCache(channelId int, modelName string) {
	prefix := fmt.Sprintf("%d\x00", channelId)
	suffix := "\x00" + strings.TrimSpace(modelName)
	channelPricingCacheMu.Lock()
	for key := range channelPricingCache {
		if strings.HasPrefix(key, prefix) && strings.HasSuffix(key, suffix) {
			delete(channelPricingCache, key)
		}
	}
	channelPricingCacheMu.Unlock()
}

// InvalidateChannelPricingCache clears every cached price after a bulk update.
func InvalidateChannelPricingCache() {
	channelPricingCacheMu.Lock()
	channelPricingCache = map[string]channelPricingCacheEntry{}
	channelPricingCacheMu.Unlock()
}

func officialPricingNeedsReview(raw string) bool {
	if strings.TrimSpace(raw) == "" {
		return false
	}
	var view ChannelOfficialPricing
	if err := common.UnmarshalJsonStr(raw, &view); err != nil {
		return false
	}
	return view.NeedsReview
}

func channelPricingVersion(row ChannelModelPricing) string {
	encoded, _ := common.Marshal([]any{
		row.ChannelId, row.Provider, row.Region, row.DeploymentId,
		row.ModelName, row.Currency, row.OfficialPricing,
		row.NormalizedPricing, row.InternalPricing, row.PurchasePricing, row.PricingSource,
	})
	return fmt.Sprintf("%x", sha256.Sum256(encoded))
}

func validPricePointer(value *Money) error {
	if value == nil {
		return nil
	}
	if value.Decimal().IsNegative() {
		return errors.New("price must be finite and non-negative")
	}
	return nil
}

func moneyPositive(value *Money) bool {
	return value != nil && value.Decimal().IsPositive()
}

// NormalizeChannelInternalPricing validates an operator-saved flat price and
// returns the multiplier form used by billing.
func NormalizeChannelInternalPricing(pricing *ChannelInternalPricing) (*ChannelBillingPricing, error) {
	if pricing == nil {
		return nil, errors.New("internal pricing is required")
	}
	for _, value := range []*Money{
		pricing.InputUSDPerMillion, pricing.OutputUSDPerMillion,
		pricing.CacheUSDPerMillion, pricing.CreateCacheUSDPerMillion,
		pricing.AudioInputUSDPerMillion, pricing.AudioOutputUSDPerMillion,
		pricing.ImageInputUSDPerMillion, pricing.ThinkingInputUSDPerMillion,
		pricing.ThinkingOutputUSDPerMillion, pricing.ThinkingCacheUSDPerMillion,
		pricing.ThinkingCreateCacheUSDPerMillion, pricing.ThinkingImageInputUSDPerMillion,
		pricing.MultiInputOutputUSDPerMillion, pricing.ThinkingMultiInputOutputUSDPerMillion,
		pricing.PerCallUSD, pricing.PerSecondUSD, pricing.PerMinuteUSD,
	} {
		if err := validPricePointer(value); err != nil {
			return nil, err
		}
	}
	switch pricing.Mode {
	case ChannelPricingModePerMillionTokens:
		if !moneyPositive(pricing.InputUSDPerMillion) {
			return nil, errors.New("input price per 1M tokens is required")
		}
		if pricing.OutputUSDPerMillion == nil {
			return nil, errors.New("output price per 1M tokens is required")
		}
		inputDecimal := pricing.InputUSDPerMillion.Decimal()
		ratioToInput := func(value *Money) float64 {
			if value == nil {
				return 0
			}
			return value.Decimal().Div(inputDecimal).InexactFloat64()
		}
		result := &ChannelBillingPricing{
			Mode: ChannelPricingModePerMillionTokens,
			// USD/1M = ratio * (1_000_000 / QuotaPerUnit) = ratio * 2.
			ModelRatio: inputDecimal.Div(decimal.NewFromInt(2)).InexactFloat64(),
		}
		completion := ratioToInput(pricing.OutputUSDPerMillion)
		result.CompletionRatio = &completion
		if pricing.CacheUSDPerMillion != nil {
			cache := ratioToInput(pricing.CacheUSDPerMillion)
			result.CacheRatio = &cache
		}
		if pricing.CreateCacheUSDPerMillion != nil {
			createCache := ratioToInput(pricing.CreateCacheUSDPerMillion)
			result.CreateCacheRatio = &createCache
		}
		if moneyPositive(pricing.AudioInputUSDPerMillion) {
			ratio := ratioToInput(pricing.AudioInputUSDPerMillion)
			result.AudioRatio = &ratio
		} else {
			result.AudioRatio = pricing.AudioRatio
		}
		if moneyPositive(pricing.AudioOutputUSDPerMillion) && moneyPositive(pricing.OutputUSDPerMillion) {
			ratio := pricing.AudioOutputUSDPerMillion.Decimal().
				Div(pricing.OutputUSDPerMillion.Decimal()).InexactFloat64()
			result.AudioCompletionRatio = &ratio
		} else {
			result.AudioCompletionRatio = pricing.AudioCompletionRatio
		}
		if internalPricingHasModalityPrices(pricing) {
			expr, err := buildFlatInternalExpression(ChannelInternalPricingTier{
				InputUSDPerMillion: pricing.InputUSDPerMillion, OutputUSDPerMillion: pricing.OutputUSDPerMillion,
				CacheUSDPerMillion: pricing.CacheUSDPerMillion, CreateCacheUSDPerMillion: pricing.CreateCacheUSDPerMillion,
				AudioInputUSDPerMillion: pricing.AudioInputUSDPerMillion, AudioOutputUSDPerMillion: pricing.AudioOutputUSDPerMillion,
				ImageInputUSDPerMillion: pricing.ImageInputUSDPerMillion, ThinkingInputUSDPerMillion: pricing.ThinkingInputUSDPerMillion,
				ThinkingOutputUSDPerMillion: pricing.ThinkingOutputUSDPerMillion, ThinkingCacheUSDPerMillion: pricing.ThinkingCacheUSDPerMillion,
				ThinkingCreateCacheUSDPerMillion:      pricing.ThinkingCreateCacheUSDPerMillion,
				ThinkingImageInputUSDPerMillion:       pricing.ThinkingImageInputUSDPerMillion,
				MultiInputOutputUSDPerMillion:         pricing.MultiInputOutputUSDPerMillion,
				ThinkingMultiInputOutputUSDPerMillion: pricing.ThinkingMultiInputOutputUSDPerMillion,
				Unit:                                  ChannelPricingModePerMillionTokens,
			})
			if err != nil {
				return nil, err
			}
			result.BillingExpr = expr
		}
		return result, nil
	case ChannelPricingModePerCall:
		if pricing.PerCallUSD == nil || pricing.PerCallUSD.Decimal().IsNegative() {
			return nil, errors.New("per-call price is required")
		}
		return &ChannelBillingPricing{Mode: ChannelPricingModePerCall, UsePrice: true, ModelPrice: pricing.PerCallUSD.Float64()}, nil
	case ChannelPricingModeTieredExpr:
		if strings.TrimSpace(pricing.BillingExpr) == "" {
			return nil, errors.New("tiered billing expression is required")
		}
		if _, err := billingexpr.CompileFromCache(pricing.BillingExpr); err != nil {
			return nil, fmt.Errorf("invalid billing expression: %w", err)
		}
		return &ChannelBillingPricing{Mode: ChannelPricingModeTieredExpr, BillingExpr: pricing.BillingExpr}, nil
	case ChannelPricingModePerSecond:
		// Per-second prices bill through the task usage expression. A billing
		// form is still returned so the price can be stored; token/per-call
		// paths must reject UsePerSecond instead of treating it as free.
		if !moneyPositive(pricing.PerSecondUSD) {
			return nil, errors.New("per-second price is required")
		}
		return &ChannelBillingPricing{Mode: ChannelPricingModePerSecond, UsePerSecond: true, PerSecondPrice: pricing.PerSecondUSD.Float64()}, nil
	case ChannelPricingModeTieredTable:
		expr, err := buildInternalTierExpression(pricing.Tiers)
		if err != nil {
			return nil, err
		}
		return &ChannelBillingPricing{Mode: ChannelPricingModeTieredTable, BillingExpr: expr}, nil
	case ChannelPricingModePerMinute:
		// Seconds are the task usage unit. A per-minute quote is normalized to
		// its per-second equivalent so the same duration billing path applies.
		if !moneyPositive(pricing.PerMinuteUSD) {
			return nil, errors.New("per-minute price is required")
		}
		return &ChannelBillingPricing{
			Mode: ChannelPricingModePerMinute, UsePerSecond: true, PerSecondPrice: pricing.PerMinuteUSD.Decimal().Div(decimal.NewFromInt(60)).InexactFloat64(),
		}, nil
	default:
		return nil, errors.New("unsupported internal pricing mode")
	}
}

// internalPricingHasModalityPrices reports whether the operator set a price
// that the ratio form cannot express. Those prices require the expression
// engine so image, reasoning and multimodal tokens are not billed as text.
func internalPricingHasModalityPrices(pricing *ChannelInternalPricing) bool {
	return pricing.ImageInputUSDPerMillion != nil ||
		pricing.ThinkingInputUSDPerMillion != nil ||
		pricing.ThinkingOutputUSDPerMillion != nil ||
		pricing.ThinkingCacheUSDPerMillion != nil ||
		pricing.ThinkingCreateCacheUSDPerMillion != nil ||
		pricing.ThinkingImageInputUSDPerMillion != nil ||
		pricing.MultiInputOutputUSDPerMillion != nil ||
		pricing.ThinkingMultiInputOutputUSDPerMillion != nil
}

// buildFlatInternalExpression renders one per-token sale price set as a billing
// expression. Dimension terms appear only when the operator priced them; the
// engine then charges that usage at its own price instead of the text price.
func buildFlatInternalExpression(tier ChannelInternalPricingTier) (string, error) {
	terms := tierTokenExpressionTerms(tier)
	if len(terms) == 0 {
		return "", errors.New("token price expression has no billable term")
	}
	expr := strings.Join(terms, " + ")
	if _, err := billingexpr.CompileFromCache(expr); err != nil {
		return "", fmt.Errorf("token price expression is invalid: %w", err)
	}
	return expr, nil
}

// tierTokenExpressionTerms builds the priced terms for one token tier. The
// engine variables are p (text input), img (image input), c (output), cr
// (cache read), cc (cache write), ai/ao (audio), rt (reasoning tokens).
func tierTokenExpressionTerms(tier ChannelInternalPricingTier) []string {
	if !moneyPositive(tier.InputUSDPerMillion) {
		return nil
	}
	input := *tier.InputUSDPerMillion
	terms := []string{}
	if moneyPositive(tier.ThinkingInputUSDPerMillion) &&
		!tier.ThinkingInputUSDPerMillion.Decimal().Equal(input.Decimal()) {
		terms = append(terms, fmt.Sprintf("p * (rt > 0 ? %s : %s)",
			formatInternalPrice(*tier.ThinkingInputUSDPerMillion), formatInternalPrice(input)))
	} else {
		terms = append(terms, "p * "+formatInternalPrice(input))
	}
	if moneyPositive(tier.ImageInputUSDPerMillion) {
		image := *tier.ImageInputUSDPerMillion
		if moneyPositive(tier.ThinkingImageInputUSDPerMillion) &&
			!tier.ThinkingImageInputUSDPerMillion.Decimal().Equal(image.Decimal()) {
			terms = append(terms, fmt.Sprintf("img * (rt > 0 ? %s : %s)",
				formatInternalPrice(*tier.ThinkingImageInputUSDPerMillion), formatInternalPrice(image)))
		} else {
			terms = append(terms, "img * "+formatInternalPrice(image))
		}
	}
	if moneyPositive(tier.OutputUSDPerMillion) {
		output := *tier.OutputUSDPerMillion
		normalOutput := formatInternalPrice(output)
		if moneyPositive(tier.MultiInputOutputUSDPerMillion) &&
			!tier.MultiInputOutputUSDPerMillion.Decimal().Equal(output.Decimal()) {
			normalOutput = fmt.Sprintf("(img > 0 ? %s : %s)",
				formatInternalPrice(*tier.MultiInputOutputUSDPerMillion), normalOutput)
		}
		if moneyPositive(tier.ThinkingOutputUSDPerMillion) &&
			!tier.ThinkingOutputUSDPerMillion.Decimal().Equal(output.Decimal()) {
			thinkingOutput := formatInternalPrice(*tier.ThinkingOutputUSDPerMillion)
			if moneyPositive(tier.ThinkingMultiInputOutputUSDPerMillion) &&
				!tier.ThinkingMultiInputOutputUSDPerMillion.Decimal().Equal(tier.ThinkingOutputUSDPerMillion.Decimal()) {
				thinkingOutput = fmt.Sprintf("(img > 0 ? %s : %s)",
					formatInternalPrice(*tier.ThinkingMultiInputOutputUSDPerMillion), thinkingOutput)
			}
			terms = append(terms, fmt.Sprintf("c * (rt > 0 ? %s : %s)", thinkingOutput, normalOutput))
		} else {
			terms = append(terms, "c * "+normalOutput)
		}
	}
	if moneyPositive(tier.CacheUSDPerMillion) {
		cache := *tier.CacheUSDPerMillion
		if moneyPositive(tier.ThinkingCacheUSDPerMillion) &&
			!tier.ThinkingCacheUSDPerMillion.Decimal().Equal(cache.Decimal()) {
			terms = append(terms, fmt.Sprintf("cr * (rt > 0 ? %s : %s)",
				formatInternalPrice(*tier.ThinkingCacheUSDPerMillion), formatInternalPrice(cache)))
		} else {
			terms = append(terms, "cr * "+formatInternalPrice(cache))
		}
	}
	if moneyPositive(tier.CreateCacheUSDPerMillion) {
		createCache := *tier.CreateCacheUSDPerMillion
		if moneyPositive(tier.ThinkingCreateCacheUSDPerMillion) &&
			!tier.ThinkingCreateCacheUSDPerMillion.Decimal().Equal(createCache.Decimal()) {
			terms = append(terms, fmt.Sprintf("cc * (rt > 0 ? %s : %s)",
				formatInternalPrice(*tier.ThinkingCreateCacheUSDPerMillion), formatInternalPrice(createCache)))
		} else {
			terms = append(terms, "cc * "+formatInternalPrice(createCache))
		}
	}
	if moneyPositive(tier.AudioInputUSDPerMillion) {
		terms = append(terms, "ai * "+formatInternalPrice(*tier.AudioInputUSDPerMillion))
	}
	if moneyPositive(tier.AudioOutputUSDPerMillion) {
		terms = append(terms, "ao * "+formatInternalPrice(*tier.AudioOutputUSDPerMillion))
	}
	return terms
}

// buildInternalTierExpression compiles operator tier prices into the billing
// expression language. Only token tiers in one time band are executable: a
// time-of-day price cannot be selected from the request body, so it is rejected
// instead of being charged at the wrong band.
func buildInternalTierExpression(tiers []ChannelInternalPricingTier) (string, error) {
	if len(tiers) == 0 {
		return "", errors.New("tiered pricing requires at least one tier")
	}
	sorted := append([]ChannelInternalPricingTier(nil), tiers...)
	bands := make(map[string]bool)
	hasEmptyBand := false
	for i := range sorted {
		tier := &sorted[i]
		band := strings.TrimSpace(tier.TimeBand)
		if band == "" {
			hasEmptyBand = true
		} else {
			bands[band] = true
		}
		if tier.Unit != "" && tier.Unit != ChannelPricingModePerMillionTokens && tier.Unit != "per_1m_tokens" {
			return "", fmt.Errorf("tier %q unit %q is not executable", tier.RangeName, tier.Unit)
		}
		if !moneyPositive(tier.InputUSDPerMillion) {
			return "", fmt.Errorf("tier %q requires a positive input price", tier.RangeName)
		}
		if tier.OutputUSDPerMillion != nil && tier.OutputUSDPerMillion.Decimal().IsNegative() {
			return "", fmt.Errorf("tier %q output price must be non-negative", tier.RangeName)
		}
		if tier.CacheUSDPerMillion != nil && tier.CacheUSDPerMillion.Decimal().IsNegative() {
			return "", fmt.Errorf("tier %q cache price must be non-negative", tier.RangeName)
		}
		if tier.CreateCacheUSDPerMillion != nil && tier.CreateCacheUSDPerMillion.Decimal().IsNegative() {
			return "", fmt.Errorf("tier %q cache write price must be non-negative", tier.RangeName)
		}
		for _, value := range []*Money{
			tier.ImageInputUSDPerMillion, tier.ThinkingInputUSDPerMillion,
			tier.ThinkingOutputUSDPerMillion, tier.ThinkingCacheUSDPerMillion,
			tier.ThinkingCreateCacheUSDPerMillion, tier.ThinkingImageInputUSDPerMillion,
			tier.MultiInputOutputUSDPerMillion, tier.ThinkingMultiInputOutputUSDPerMillion,
			tier.AudioInputUSDPerMillion, tier.AudioOutputUSDPerMillion,
		} {
			if value != nil && value.Decimal().IsNegative() {
				return "", fmt.Errorf("tier %q has a negative dimension price", tier.RangeName)
			}
		}
	}
	if len(bands) > 1 || (len(bands) == 1 && hasEmptyBand) {
		return "", errors.New("tiered sale prices cannot mix time bands")
	}
	sort.SliceStable(sorted, func(i, j int) bool {
		mi, mj := sorted[i].MaxInputTokens, sorted[j].MaxInputTokens
		if mi == 0 {
			return false
		}
		if mj == 0 {
			return true
		}
		return mi < mj
	})
	names := make(map[string]int, len(sorted))
	parts := make([]string, 0, len(sorted))
	for i, tier := range sorted {
		name := strings.TrimSpace(tier.RangeName)
		name = strings.ReplaceAll(name, `"`, "")
		if name == "" {
			name = fmt.Sprintf("tier-%d", i+1)
		}
		names[name]++
		if names[name] > 1 {
			name = fmt.Sprintf("%s-%d", name, names[name])
		}
		terms := tierTokenExpressionTerms(ChannelInternalPricingTier{
			InputUSDPerMillion: tier.InputUSDPerMillion, OutputUSDPerMillion: tier.OutputUSDPerMillion,
			CacheUSDPerMillion: tier.CacheUSDPerMillion, CreateCacheUSDPerMillion: tier.CreateCacheUSDPerMillion,
			AudioInputUSDPerMillion: tier.AudioInputUSDPerMillion, AudioOutputUSDPerMillion: tier.AudioOutputUSDPerMillion,
			ImageInputUSDPerMillion: tier.ImageInputUSDPerMillion, ThinkingInputUSDPerMillion: tier.ThinkingInputUSDPerMillion,
			ThinkingOutputUSDPerMillion: tier.ThinkingOutputUSDPerMillion, ThinkingCacheUSDPerMillion: tier.ThinkingCacheUSDPerMillion,
			ThinkingCreateCacheUSDPerMillion:      tier.ThinkingCreateCacheUSDPerMillion,
			ThinkingImageInputUSDPerMillion:       tier.ThinkingImageInputUSDPerMillion,
			MultiInputOutputUSDPerMillion:         tier.MultiInputOutputUSDPerMillion,
			ThinkingMultiInputOutputUSDPerMillion: tier.ThinkingMultiInputOutputUSDPerMillion,
		})
		if len(terms) == 0 {
			return "", fmt.Errorf("tier %q has no billable term", tier.RangeName)
		}
		parts = append(parts, fmt.Sprintf(`tier("%s", %s)`, name, strings.Join(terms, " + ")))
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
	if _, err := billingexpr.CompileFromCache(expr); err != nil {
		return "", fmt.Errorf("tiered sale expression is invalid: %w", err)
	}
	return expr, nil
}

func formatInternalPrice(value Money) string {
	return value.String()
}

// IsAutoDerivedPricingSource reports whether a sale price was written by an
// upstream sync or another automatic rule. Only these may be replaced or
// cleared automatically; operator, batch and approved prices are never touched.
// Every subsystem that decides "is this price automatic?" must use this list,
// otherwise one of them treats a synced price as manual and silently refuses to
// act on it.
func IsAutoDerivedPricingSource(source string) bool {
	source = strings.ToLower(strings.TrimSpace(source))
	for _, prefix := range []string{
		"uterroute-", "bailian-", "newapi-", "newapi:",
		"generic-", "generic:", "uterapi-", "apiko-",
	} {
		if strings.HasPrefix(source, prefix) {
			return true
		}
	}
	return false
}

func autoDerivedInternalSource(source string) bool {
	return IsAutoDerivedPricingSource(source)
}

// internalPricingReplaceable reports whether a sync may rewrite the stored
// internal price. An empty row and a previously sync-derived price are
// replaceable; anything an operator saved is preserved.
func internalPricingSource(raw string) string {
	if strings.TrimSpace(raw) == "" {
		return ""
	}
	var pricing ChannelInternalPricing
	if err := common.UnmarshalJsonStr(raw, &pricing); err != nil {
		return ""
	}
	return pricing.Source
}

func internalPricingReplaceable(raw string) bool {
	if strings.TrimSpace(raw) == "" {
		return true
	}
	var pricing ChannelInternalPricing
	if err := common.UnmarshalJsonStr(raw, &pricing); err != nil {
		return false
	}
	return autoDerivedInternalSource(pricing.Source)
}

// IncomingChannelPricingStatus classifies a freshly fetched price row exactly
// as the persistence layer does. Read-only previews use the same helper so the
// creation wizard can never report a model as billable when the authoritative
// sync would keep it in review.
func IncomingChannelPricingStatus(record ChannelOfficialPricingRecord) string {
	reviewOnly := officialPricingNeedsReview(record.NormalizedPricing)
	autoInternal := record.InternalPricing != "" &&
		autoDerivedInternalSource(internalPricingSource(record.InternalPricing))
	if reviewOnly && (record.InternalPricing == "" || autoInternal) {
		return ChannelPricingStatusNeedsReview
	}
	if record.InternalPricing != "" {
		return ChannelPricingStatusConfigured
	}
	return ChannelPricingStatusOfficialOnly
}

// PricingOwnerForSource maps the historical Source label onto the explicit
// ownership contract. Unknown sources are treated as operator-entered so a
// sync can never guess that a price is replaceable.
func PricingOwnerForSource(source string) string {
	source = strings.ToLower(strings.TrimSpace(source))
	switch {
	case source == "":
		return ""
	case IsAutoDerivedPricingSource(source):
		return ChannelPricingOwnerAuto
	case source == "review-approved":
		return ChannelPricingOwnerApproved
	case source == "batch":
		return ChannelPricingOwnerBatch
	default:
		return ChannelPricingOwnerOperator
	}
}

// pricingReplaceableByOwner is the single authority for sync overwrite rules.
// Legacy rows without an owner fall back to their Source label.
func pricingReplaceableByOwner(owner, raw string) bool {
	bySource := internalPricingReplaceable(raw)
	if strings.TrimSpace(owner) == "" {
		return bySource
	}
	// An explicit non-AUTO owner is authoritative. An AUTO owner still needs
	// the stored source to look automatic: a raw/import write can leave a stale
	// owner behind, and that must never make an operator price replaceable.
	return owner == ChannelPricingOwnerAuto && bySource
}

// IsAutoDerivedPricingRowFor is the owner-aware variant used when changing a
// row's provider identity; manual, batch and approved rows are never removed.
func IsAutoDerivedPricingRowFor(owner, source, internalPricing string) bool {
	bySource := IsAutoDerivedPricingRow(source, internalPricing)
	if strings.TrimSpace(owner) == "" {
		return bySource
	}
	return owner == ChannelPricingOwnerAuto && bySource
}

// IsAutoDerivedPricingRow reports whether a whole pricing row was produced by an
// upstream sync, judged by the record source or the sale-price source. Used when
// a channel has to drop rows written under a provider identity it no longer
// speaks; operator and batch rows must survive that cleanup.
func IsAutoDerivedPricingRow(source, internalPricing string) bool {
	return IsAutoDerivedPricingSource(source) ||
		IsAutoDerivedPricingSource(internalPricingSource(internalPricing))
}

// DeleteAutoDerivedPricingForOtherProvider removes the pricing rows of one
// channel that belong to a different provider identity and were written
// automatically. Operator and batch rows are never removed; kept reports how
// many such rows were left for manual review.
func DeleteAutoDerivedPricingForOtherProvider(channelID int, keepProvider string) (removed int, kept int, err error) {
	if channelID <= 0 {
		return 0, 0, nil
	}
	var rows []ChannelModelPricing
	if err := DB.Where("channel_id = ? AND provider <> ?", channelID, keepProvider).Find(&rows).Error; err != nil {
		return 0, 0, err
	}
	ids := make([]int64, 0, len(rows))
	for _, row := range rows {
		if !IsAutoDerivedPricingRowFor(row.PricingOwner, row.PricingSource, row.InternalPricing) {
			kept++
			continue
		}
		ids = append(ids, row.Id)
	}
	if len(ids) == 0 {
		return 0, kept, nil
	}
	if err := DB.Where("id IN ?", ids).Delete(&ChannelModelPricing{}).Error; err != nil {
		return 0, kept, err
	}
	InvalidateChannelPricingCache()
	return len(ids), kept, nil
}

// UpsertChannelOfficialPricing writes official data without touching the
// operator's internal price or status. Existing configured prices survive a
// re-sync; a model that has only official data stays official_only.
func UpsertChannelOfficialPricing(records []ChannelOfficialPricingRecord) (int, error) {
	if len(records) == 0 {
		return 0, nil
	}
	written := 0
	err := DB.Transaction(func(tx *gorm.DB) error {
		for _, record := range records {
			record.ModelName = strings.TrimSpace(record.ModelName)
			if record.ChannelId <= 0 || record.ModelName == "" {
				continue
			}
			now := time.Now().Unix()
			var existing ChannelModelPricing
			err := tx.Where(
				"channel_id = ? AND provider = ? AND region = ? AND deployment_id = ? AND model_name = ?",
				record.ChannelId, record.Provider, record.Region, record.DeploymentId, record.ModelName,
			).First(&existing).Error
			if errors.Is(err, gorm.ErrRecordNotFound) && record.ModelProvider != "" {
				// Pre-split Bailian rows stored the model vendor (qwen, ...) in
				// Provider. Match that legacy identity once and rewrite it.
				err = tx.Where(
					"channel_id = ? AND provider = ? AND region = ? AND deployment_id = ? AND model_name = ?",
					record.ChannelId, record.ModelProvider, record.Region, record.DeploymentId, record.ModelName,
				).First(&existing).Error
			}
			if errors.Is(err, gorm.ErrRecordNotFound) {
				// Rows written before identity scoping have an empty provider,
				// region and deployment. Adopt that row instead of creating a
				// duplicate for the same model.
				err = tx.Where(
					"channel_id = ? AND provider = ? AND region = ? AND deployment_id = ? AND model_name = ?",
					record.ChannelId, "", "", "", record.ModelName,
				).First(&existing).Error
			}
			if errors.Is(err, gorm.ErrRecordNotFound) {
				// Last-resort legacy match: a row with a stale provider label is
				// adopted and rewritten. Unlike the scoped lookups above, this
				// query cannot constrain provider, so MULTIPLE candidate rows may
				// match (e.g. an empty-provider row and an old-provider row for
				// the same model). Silently taking First() would merge two
				// distinct price identities and could apply one channel's cost
				// to another. Fail closed on ambiguity instead.
				var candidates []ChannelModelPricing
				if findErr := tx.Where(
					"channel_id = ? AND region = ? AND deployment_id = ? AND model_name = ?",
					record.ChannelId, record.Region, record.DeploymentId, record.ModelName,
				).Find(&candidates).Error; findErr != nil {
					return findErr
				}
				switch len(candidates) {
				case 0:
					err = gorm.ErrRecordNotFound
				case 1:
					existing = candidates[0]
					err = nil
				default:
					return fmt.Errorf(
						"ambiguous channel pricing identity for channel %d model %s: %d rows match with no provider constraint; refusing to merge",
						record.ChannelId, record.ModelName, len(candidates),
					)
				}
			}
			if errors.Is(err, gorm.ErrRecordNotFound) {
				row := ChannelModelPricing{
					ChannelId:          record.ChannelId,
					Provider:           record.Provider,
					ModelProvider:      record.ModelProvider,
					ModelName:          record.ModelName,
					Region:             record.Region,
					DeploymentId:       record.DeploymentId,
					Currency:           record.Currency,
					OfficialPricing:    record.OfficialPricing,
					NormalizedPricing:  record.NormalizedPricing,
					InternalPricing:    record.InternalPricing,
					PricingSource:      record.Source,
					PricingOwner:       PricingOwnerForSource(internalPricingSource(record.InternalPricing)),
					PricingStatus:      ChannelPricingStatusOfficialOnly,
					FetchedAt:          record.FetchedAt,
					UpdatedAt:          now,
					LifecycleStatus:    ChannelModelLifecycleActive,
					LastSeenAt:         record.FetchedAt,
					LifecycleUpdatedAt: now,
				}
				status := IncomingChannelPricingStatus(record)
				if status == ChannelPricingStatusNeedsReview {
					// A review-only official record must never auto-enable billing.
					// An operator/batch price is an explicit decision and stays.
					row.InternalPricing = ""
				}
				row.PricingStatus = status
				row.PricingVersion = channelPricingVersion(row)
				if err := tx.Create(&row).Error; err != nil {
					return err
				}
				written++
				continue
			}
			if err != nil {
				return err
			}
			existing.Provider = record.Provider
			existing.ModelProvider = record.ModelProvider
			existing.Region = record.Region
			existing.DeploymentId = record.DeploymentId
			existing.Currency = record.Currency
			existing.OfficialPricing = record.OfficialPricing
			existing.NormalizedPricing = record.NormalizedPricing
			existing.PricingSource = record.Source
			existing.FetchedAt = record.FetchedAt
			existing.UpdatedAt = now
			reviewOnly := officialPricingNeedsReview(record.NormalizedPricing)
			incomingOwner := PricingOwnerForSource(internalPricingSource(record.InternalPricing))
			incomingAuto := record.InternalPricing != "" && incomingOwner == ChannelPricingOwnerAuto
			replaceable := pricingReplaceableByOwner(existing.PricingOwner, existing.InternalPricing)
			if record.InternalPricing != "" && replaceable && (!reviewOnly || !incomingAuto) {
				existing.InternalPricing = record.InternalPricing
				existing.PricingOwner = incomingOwner
				existing.PricingStatus = ChannelPricingStatusConfigured
			}
			// Official catalog syncs no longer derive a sale price. A row whose
			// previous internal price was auto-derived by the same provider
			// returns to official_only instead of silently staying billable.
			if record.InternalPricing == "" && replaceable {
				existing.InternalPricing = ""
				existing.PricingOwner = ""
				existing.PricingStatus = ChannelPricingStatusOfficialOnly
			}
			if reviewOnly && pricingReplaceableByOwner(existing.PricingOwner, existing.InternalPricing) {
				// A stale automatic sale price cannot survive a review flag.
				// Operator, batch and approved prices are explicit and stay.
				existing.InternalPricing = ""
				existing.PricingOwner = ""
				existing.PricingStatus = ChannelPricingStatusNeedsReview
			} else if reviewOnly && existing.InternalPricing == "" {
				existing.PricingStatus = ChannelPricingStatusNeedsReview
			} else if existing.InternalPricing == "" && existing.PricingStatus != ChannelPricingStatusConfigured {
				existing.PricingStatus = ChannelPricingStatusOfficialOnly
			}
			if existing.PricingStatus == "" {
				existing.PricingStatus = ChannelPricingStatusOfficialOnly
			}
			existing.PricingVersion = channelPricingVersion(existing)
			if err := tx.Save(&existing).Error; err != nil {
				return err
			}
			written++
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	for _, record := range records {
		InvalidateChannelPricingPresence(record.ChannelId)
	}
	InvalidateChannelPricingCache()
	InvalidatePricingCache()
	return written, nil
}

// ClearAutoDerivedChannelPricing removes internal prices that a previous
// provider sync derived automatically. Operator, batch and scheduled prices are
// preserved. Returns the number of rows returned to official_only.
func ClearAutoDerivedChannelPricing(channelId int, sourcePrefix string) (int, error) {
	if DB == nil || channelId <= 0 || strings.TrimSpace(sourcePrefix) == "" {
		return 0, nil
	}
	var rows []ChannelModelPricing
	if err := DB.Where("channel_id = ? AND pricing_status = ?", channelId, ChannelPricingStatusConfigured).
		Find(&rows).Error; err != nil {
		return 0, err
	}
	cleared := 0
	for i := range rows {
		row := &rows[i]
		if !pricingReplaceableByOwner(row.PricingOwner, row.InternalPricing) ||
			!strings.HasPrefix(internalPricingSource(row.InternalPricing), sourcePrefix) {
			continue
		}
		row.InternalPricing = ""
		row.PricingOwner = ""
		row.PricingStatus = ChannelPricingStatusOfficialOnly
		row.UpdatedAt = time.Now().Unix()
		row.PricingVersion = channelPricingVersion(*row)
		if err := DB.Save(row).Error; err != nil {
			return cleared, err
		}
		cleared++
	}
	if cleared > 0 {
		InvalidateChannelPricingCache()
		InvalidatePricingCache()
	}
	return cleared, nil
}

// ErrChannelPricingIdentityRequired marks a write whose channel/model has more
// than one region or deployment identity. The caller must state which identity
// it edits instead of letting "configured first" pick one.
var ErrChannelPricingIdentityRequired = errors.New("channel has multiple region or deployment prices; specify the pricing identity")

// SetChannelInternalPricingFor stores an operator price on the exact identity
// row. It never edits another region's or deployment's price.
func SetChannelInternalPricingFor(identity ChannelPricingIdentity, pricing ChannelInternalPricing) error {
	identity = normalizePricingIdentity(identity)
	if identity.ChannelId <= 0 || identity.ModelName == "" {
		return errors.New("channel and model are required")
	}
	if _, err := NormalizeChannelInternalPricing(&pricing); err != nil {
		return err
	}
	pricing.UpdatedAt = time.Now().Unix()
	encoded, err := common.Marshal(pricing)
	if err != nil {
		return err
	}
	rows, err := loadChannelPricingRows(identity.ChannelId, identity.ModelName)
	if err != nil {
		return err
	}
	row, reason := selectChannelPricingRow(rows, identity)
	if row == nil {
		if reason != "" {
			return ErrChannelPricingIdentityRequired
		}
		return fmt.Errorf("channel pricing record not found: %w", gorm.ErrRecordNotFound)
	}
	row.InternalPricing = string(encoded)
	row.PricingOwner = PricingOwnerForSource(pricing.Source)
	row.PricingStatus = ChannelPricingStatusConfigured
	reactivateManualLifecycle(row, pricing)
	row.UpdatedAt = pricing.UpdatedAt
	row.PricingVersion = channelPricingVersion(*row)
	if err := DB.Save(row).Error; err != nil {
		return err
	}
	invalidateChannelPricingCache(identity.ChannelId, identity.ModelName)
	InvalidateChannelPricingPresence(identity.ChannelId)
	InvalidatePricingCache()
	return nil
}

// SetChannelInternalPricing is the legacy identity-free variant.
func SetChannelInternalPricing(channelId int, modelName string, pricing ChannelInternalPricing) error {
	return SetChannelInternalPricingFor(ChannelPricingIdentity{ChannelId: channelId, ModelName: modelName}, pricing)
}

// SetChannelInternalPricingWithAudit updates one identity row and appends its
// audit history in one transaction: if the audit write fails, the price change
// is rolled back. expectedVersion "" skips the version check; otherwise a
// changed row returns ErrChannelPricingVersionConflict without a history row.
func SetChannelInternalPricingWithAudit(
	identity ChannelPricingIdentity,
	pricing ChannelInternalPricing,
	expectedVersion string,
	history ChannelPricingHistory,
) error {
	identity = normalizePricingIdentity(identity)
	if identity.ChannelId <= 0 || identity.ModelName == "" {
		return errors.New("channel and model are required")
	}
	if _, err := NormalizeChannelInternalPricing(&pricing); err != nil {
		return err
	}
	pricing.UpdatedAt = time.Now().Unix()
	encoded, err := common.Marshal(pricing)
	if err != nil {
		return err
	}
	err = DB.Transaction(func(tx *gorm.DB) error {
		var rows []ChannelModelPricing
		if err := lockForUpdate(tx).
			Where("channel_id = ? AND model_name = ?", identity.ChannelId, identity.ModelName).
			Order("id").Find(&rows).Error; err != nil {
			return err
		}
		row, reason := selectChannelPricingRow(rows, identity)
		if row == nil {
			if reason != "" {
				return ErrChannelPricingIdentityRequired
			}
			return fmt.Errorf("channel pricing record not found: %w", gorm.ErrRecordNotFound)
		}
		if expectedVersion != "" && row.PricingVersion != expectedVersion {
			return ErrChannelPricingVersionConflict
		}
		row.InternalPricing = string(encoded)
		row.PricingOwner = PricingOwnerForSource(pricing.Source)
		row.PricingStatus = ChannelPricingStatusConfigured
		reactivateManualLifecycle(row, pricing)
		row.UpdatedAt = pricing.UpdatedAt
		row.PricingVersion = channelPricingVersion(*row)
		if err := tx.Save(row).Error; err != nil {
			return err
		}
		history.ChannelID = identity.ChannelId
		history.ModelName = identity.ModelName
		history.Provider = row.Provider
		history.Region = row.Region
		history.DeploymentId = row.DeploymentId
		if history.ChangedAt == 0 {
			history.ChangedAt = pricing.UpdatedAt
		}
		return tx.Create(&history).Error
	})
	if err != nil {
		return err
	}
	invalidateChannelPricingCache(identity.ChannelId, identity.ModelName)
	InvalidatePricingCache()
	return nil
}

// ErrChannelPricingVersionConflict marks a batch apply whose price inputs
// changed after the preview that produced them.
var ErrChannelPricingVersionConflict = errors.New("channel pricing changed since preview")

// SetChannelInternalPricingIfVersionFor stores an operator price on the exact
// identity row only while it still carries expectedVersion.
func SetChannelInternalPricingIfVersionFor(
	identity ChannelPricingIdentity,
	pricing ChannelInternalPricing,
	expectedVersion string,
) error {
	if expectedVersion == "" {
		return SetChannelInternalPricingFor(identity, pricing)
	}
	identity = normalizePricingIdentity(identity)
	if identity.ChannelId <= 0 || identity.ModelName == "" {
		return errors.New("channel and model are required")
	}
	if _, err := NormalizeChannelInternalPricing(&pricing); err != nil {
		return err
	}
	pricing.UpdatedAt = time.Now().Unix()
	encoded, err := common.Marshal(pricing)
	if err != nil {
		return err
	}
	err = DB.Transaction(func(tx *gorm.DB) error {
		var rows []ChannelModelPricing
		if err := lockForUpdate(tx).
			Where("channel_id = ? AND model_name = ?", identity.ChannelId, identity.ModelName).
			Order("id").Find(&rows).Error; err != nil {
			return err
		}
		row, reason := selectChannelPricingRow(rows, identity)
		if row == nil {
			if reason != "" {
				return ErrChannelPricingIdentityRequired
			}
			return fmt.Errorf("channel pricing record not found: %w", gorm.ErrRecordNotFound)
		}
		if row.PricingVersion != expectedVersion {
			return ErrChannelPricingVersionConflict
		}
		row.InternalPricing = string(encoded)
		row.PricingOwner = PricingOwnerForSource(pricing.Source)
		row.PricingStatus = ChannelPricingStatusConfigured
		row.UpdatedAt = pricing.UpdatedAt
		row.PricingVersion = channelPricingVersion(*row)
		return tx.Save(row).Error
	})
	if err != nil {
		return err
	}
	invalidateChannelPricingCache(identity.ChannelId, identity.ModelName)
	InvalidatePricingCache()
	return nil
}

// SetChannelInternalPricingIfVersion is the legacy identity-free variant.
func SetChannelInternalPricingIfVersion(
	channelId int,
	modelName string,
	pricing ChannelInternalPricing,
	expectedVersion string,
) error {
	return SetChannelInternalPricingIfVersionFor(
		ChannelPricingIdentity{ChannelId: channelId, ModelName: modelName}, pricing, expectedVersion,
	)
}

// GetChannelModelPricing returns one channel's price record. Several upstream
// identities may share (channel, model), for example after the channel moved
// to another region; a configured internal price wins, then the most recently
// synced identity.
func GetChannelModelPricing(channelId int, modelName string) (*ChannelModelPricing, error) {
	var row ChannelModelPricing
	err := DB.Where("channel_id = ? AND model_name = ?", channelId, strings.TrimSpace(modelName)).
		Order("CASE WHEN pricing_status = 'configured' THEN 0 ELSE 1 END").
		Order("fetched_at DESC").Order("updated_at DESC").Order("id DESC").
		First(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

// GetChannelModelPricingFor returns the row for an exact identity. When several
// identities exist and this one cannot be matched, it returns
// ErrChannelPricingIdentityRequired instead of another region's row.
func GetChannelModelPricingFor(identity ChannelPricingIdentity) (*ChannelModelPricing, error) {
	identity = normalizePricingIdentity(identity)
	rows, err := loadChannelPricingRows(identity.ChannelId, identity.ModelName)
	if err != nil {
		return nil, err
	}
	row, reason := selectChannelPricingRow(rows, identity)
	if row == nil {
		if reason != "" {
			return nil, ErrChannelPricingIdentityRequired
		}
		return nil, gorm.ErrRecordNotFound
	}
	return row, nil
}

// ListChannelModelPricing returns a channel's records ordered by model name.
func ListChannelModelPricing(channelId int) ([]ChannelModelPricing, error) {
	var rows []ChannelModelPricing
	err := DB.Where("channel_id = ?", channelId).Order("model_name").Find(&rows).Error
	return rows, err
}

// ClearAutoDerivedInternalForModels clears a provider's automatic sale price
// for the named models, leaving operator/batch prices untouched. Used when the
// upstream catalogue no longer publishes a price for a model.
func ClearAutoDerivedInternalForModels(channelId int, provider string, modelNames []string, sourcePrefix string) (int, error) {
	if DB == nil || channelId <= 0 || len(modelNames) == 0 || strings.TrimSpace(sourcePrefix) == "" {
		return 0, nil
	}
	var rows []ChannelModelPricing
	err := DB.Where("channel_id = ? AND provider = ? AND model_name IN ?", channelId, provider, modelNames).
		Find(&rows).Error
	if err != nil {
		return 0, err
	}
	cleared := 0
	for i := range rows {
		row := &rows[i]
		if !pricingReplaceableByOwner(row.PricingOwner, row.InternalPricing) ||
			!strings.HasPrefix(internalPricingSource(row.InternalPricing), sourcePrefix) {
			continue
		}
		row.InternalPricing = ""
		row.PricingOwner = ""
		row.PricingStatus = ChannelPricingStatusOfficialOnly
		row.UpdatedAt = time.Now().Unix()
		row.PricingVersion = channelPricingVersion(*row)
		if err := DB.Model(row).Updates(map[string]any{
			"internal_pricing": "",
			"pricing_owner":    "",
			"pricing_status":   row.PricingStatus,
			"pricing_version":  row.PricingVersion,
			"updated_at":       row.UpdatedAt,
		}).Error; err != nil {
			return cleared, err
		}
		cleared++
	}
	if cleared > 0 {
		invalidateChannelPricingCache(channelId, "")
		InvalidatePricingCache()
	}
	return cleared, nil
}

// EnforcePricingReviewGate clears automatic sale prices whose official record
// is marked for review and pauses their billing. Operator, batch and approved
// prices are explicit decisions and are left billable.
func EnforcePricingReviewGate() (cleared int, err error) {
	if DB == nil {
		return 0, nil
	}
	var rows []ChannelModelPricing
	if err := DB.Where("pricing_status = ?", ChannelPricingStatusConfigured).Find(&rows).Error; err != nil {
		return 0, err
	}
	for i := range rows {
		row := &rows[i]
		if !officialPricingNeedsReview(row.NormalizedPricing) {
			continue
		}
		if !pricingReplaceableByOwner(row.PricingOwner, row.InternalPricing) {
			continue
		}
		row.InternalPricing = ""
		row.PricingOwner = ""
		row.PricingStatus = ChannelPricingStatusNeedsReview
		row.UpdatedAt = time.Now().Unix()
		row.PricingVersion = channelPricingVersion(*row)
		if err := DB.Model(row).Updates(map[string]any{
			"internal_pricing": "",
			"pricing_owner":    "",
			"pricing_status":   row.PricingStatus,
			"pricing_version":  row.PricingVersion,
			"updated_at":       row.UpdatedAt,
		}).Error; err != nil {
			return cleared, err
		}
		cleared++
	}
	if cleared > 0 {
		InvalidateChannelPricingCache()
		InvalidatePricingCache()
	}
	return cleared, nil
}

// ClearAutoDerivedInternalExcept clears a provider's automatic sale prices for
// channel models that are no longer in the current catalogue, leaving operator
// and batch prices untouched. Historical official rows and prices stay.
func ClearAutoDerivedInternalExcept(channelId int, provider string, keepModels []string, sourcePrefix string) (int, error) {
	if DB == nil || channelId <= 0 || strings.TrimSpace(sourcePrefix) == "" {
		return 0, nil
	}
	keep := make(map[string]bool, len(keepModels))
	for _, name := range keepModels {
		keep[strings.TrimSpace(name)] = true
	}
	var rows []ChannelModelPricing
	if err := DB.Where("channel_id = ? AND provider = ?", channelId, provider).Find(&rows).Error; err != nil {
		return 0, err
	}
	cleared := 0
	for i := range rows {
		row := &rows[i]
		if keep[row.ModelName] || !pricingReplaceableByOwner(row.PricingOwner, row.InternalPricing) ||
			!strings.HasPrefix(internalPricingSource(row.InternalPricing), sourcePrefix) {
			continue
		}
		row.InternalPricing = ""
		row.PricingOwner = ""
		row.PricingStatus = ChannelPricingStatusOfficialOnly
		row.UpdatedAt = time.Now().Unix()
		row.PricingVersion = channelPricingVersion(*row)
		if err := DB.Model(row).Updates(map[string]any{
			"internal_pricing": "",
			"pricing_owner":    "",
			"pricing_status":   row.PricingStatus,
			"pricing_version":  row.PricingVersion,
			"updated_at":       row.UpdatedAt,
		}).Error; err != nil {
			return cleared, err
		}
		cleared++
	}
	if cleared > 0 {
		invalidateChannelPricingCache(channelId, "")
		InvalidatePricingCache()
	}
	return cleared, nil
}

// DeleteUnpricedChannelModelPricing removes review-only rows for models the
// upstream no longer prices. Rows that carry an operator price or contract cost
// are never touched, so price history survives catalogue churn.
func DeleteUnpricedChannelModelPricing(channelId int, modelNames []string) error {
	if channelId <= 0 || len(modelNames) == 0 {
		return nil
	}
	return DB.Where(
		"channel_id = ? AND model_name IN ? AND (internal_pricing IS NULL OR internal_pricing = '')",
		channelId, modelNames,
	).Delete(&ChannelModelPricing{}).Error
}

// DeleteChannelModelPricingForModels removes pricing rows for models an
// upstream explicitly hides from its own pricing page, so Uter matches that
// visible catalogue instead of keeping orphan rows.
func DeleteChannelModelPricingForModels(channelId int, modelNames []string) error {
	if channelId <= 0 || len(modelNames) == 0 {
		return nil
	}
	return DB.Where("channel_id = ? AND model_name IN ?", channelId, modelNames).
		Delete(&ChannelModelPricing{}).Error
}

// selectChannelPricingRow picks the row for one request identity. It never
// resolves an ambiguity by "configured first" or "newest": when several rows
// exist and the identity cannot be matched, the caller must fail the charge.
func selectChannelPricingRow(rows []ChannelModelPricing, identity ChannelPricingIdentity) (*ChannelModelPricing, string) {
	if len(rows) == 0 {
		return nil, ""
	}
	identity = normalizePricingIdentity(identity)
	var exact []ChannelModelPricing
	for _, row := range rows {
		if row.Provider == identity.Provider && row.Region == identity.Region && row.DeploymentId == identity.DeploymentId {
			exact = append(exact, row)
		}
	}
	if len(exact) == 1 {
		return &exact[0], ""
	}
	if len(exact) > 1 {
		return nil, ChannelPricingReasonIdentityAmbiguous
	}
	// Bailian stores the model's inference provider on the row rather than the
	// channel vendor, so the request cannot know it. A single row matching the
	// same region and deployment is still unambiguous.
	var geo []ChannelModelPricing
	for _, row := range rows {
		if row.Region == identity.Region && row.DeploymentId == identity.DeploymentId {
			geo = append(geo, row)
		}
	}
	if len(geo) == 1 {
		return &geo[0], ""
	}
	if len(geo) > 1 {
		return nil, ChannelPricingReasonIdentityAmbiguous
	}
	// Legacy single-row channel or an admin lookup without a region: only safe
	// when there is exactly one identity to choose from.
	if identity.Region == "" && identity.DeploymentId == "" && len(rows) == 1 {
		return &rows[0], ""
	}
	return nil, ChannelPricingReasonIdentityMissing
}

func loadChannelPricingRows(channelId int, modelName string) ([]ChannelModelPricing, error) {
	var rows []ChannelModelPricing
	err := DB.Where("channel_id = ? AND model_name = ?", channelId, strings.TrimSpace(modelName)).
		Order("id").Find(&rows).Error
	return rows, err
}

// loadChannelPricingFor resolves one identity and caches the decision. A
// missing row and an unmatched identity are cached too, so hot billing paths
// do not query the database repeatedly while the configuration stays broken.
func loadChannelPricingFor(identity ChannelPricingIdentity) (*ChannelBillingPricing, string, string, bool, string, string) {
	identity = normalizePricingIdentity(identity)
	if DB == nil || identity.ChannelId <= 0 || identity.ModelName == "" {
		return nil, "", "", false, "", ""
	}
	key := channelPricingCacheKey(identity)
	channelPricingCacheMu.RLock()
	if entry, ok := channelPricingCache[key]; ok && time.Now().Before(entry.expiresAt) {
		channelPricingCacheMu.RUnlock()
		return entry.pricing, entry.status, entry.lifecycle, entry.exists, entry.reason, entry.billableReason
	}
	channelPricingCacheMu.RUnlock()

	rows, err := loadChannelPricingRows(identity.ChannelId, identity.ModelName)
	if err != nil {
		return nil, "", "", false, "", ""
	}
	if len(rows) == 0 {
		channelPricingCacheMu.Lock()
		channelPricingCache[key] = channelPricingCacheEntry{expiresAt: time.Now().Add(channelPricingCacheTTL)}
		channelPricingCacheMu.Unlock()
		return nil, "", "", false, "", ""
	}
	row, reason := selectChannelPricingRow(rows, identity)
	entry := channelPricingCacheEntry{
		exists:    true,
		reason:    reason,
		expiresAt: time.Now().Add(channelPricingCacheTTL),
	}
	if row == nil {
		channelPricingCacheMu.Lock()
		channelPricingCache[key] = entry
		channelPricingCacheMu.Unlock()
		return nil, "", "", true, reason, ""
	}
	// Compute eligibility through the same shared gate the audit page uses,
	// from the raw row. The channel's explicit pricing mode is enforced at the
	// call boundary (ChannelScopedPricingRequired); here the row-level gate
	// covers status, lifecycle, parseability and freshness.
	entry.billableReason = ChannelPricingBillableReason(*row, "", time.Now())
	entry.status = row.PricingStatus
	entry.lifecycle = row.LifecycleStatus
	if row.PricingStatus == ChannelPricingStatusConfigured && row.InternalPricing != "" {
		var internal ChannelInternalPricing
		if err := common.UnmarshalJsonStr(row.InternalPricing, &internal); err != nil {
			common.SysError("invalid channel internal pricing: " + err.Error())
		} else if pricing, err := NormalizeChannelInternalPricing(&internal); err != nil {
			common.SysError("invalid channel internal pricing: " + err.Error())
		} else {
			pricing.Version = row.PricingVersion
			pricing.Source = row.PricingSource
			pricing.PurchaseUSD = channelPurchasePrimaryUSD(row.NormalizedPricing)
			if cost := ParseChannelPurchaseCost(row.PurchasePricing); cost != nil {
				if primary := PurchaseCostPrimaryUSD(row.PurchasePricing); primary != nil {
					primaryFloat := primary.Float64()
					pricing.PurchaseUSD = &primaryFloat
				}
				pricing.PurchaseVerified = cost.Verified
				pricing.PurchaseSource = cost.Source
				pricing.PurchaseVersion = fmt.Sprintf("%x", sha256.Sum256([]byte(strings.TrimSpace(row.PurchasePricing))))
				pricing.PurchaseContract = strings.TrimSpace(row.PurchasePricing)
			}
			if strings.TrimSpace(row.NormalizedPricing) != "" {
				var view ChannelOfficialPricing
				if err := common.UnmarshalJsonStr(row.NormalizedPricing, &view); err == nil {
					pricing.Currency = view.Currency
					pricing.FXRate = view.FXRateToUSD
				}
			}
			entry.pricing = pricing
		}
	}
	channelPricingCacheMu.Lock()
	channelPricingCache[key] = entry
	channelPricingCacheMu.Unlock()
	return entry.pricing, entry.status, entry.lifecycle, entry.exists, entry.reason, entry.billableReason
}

// ApplyChannelLifecycleSnapshot marks the models visible in a complete upstream
// catalog snapshot as ACTIVE and ages the rest toward DISABLED. Missing rows
// keep their prices and history; only billing eligibility changes.
func ApplyChannelLifecycleSnapshot(channelId int, seenModels []string, now int64, threshold int) (active int, missing int, disabled int, err error) {
	if channelId <= 0 || len(seenModels) == 0 {
		return 0, 0, 0, errors.New("complete catalog snapshot is required")
	}
	if threshold <= 0 {
		threshold = ChannelModelMissingDisableThreshold
	}
	seen := make(map[string]bool, len(seenModels))
	for _, name := range seenModels {
		name = strings.TrimSpace(name)
		if name != "" {
			seen[name] = true
		}
	}
	if len(seen) == 0 {
		return 0, 0, 0, errors.New("complete catalog snapshot is empty")
	}
	err = DB.Transaction(func(tx *gorm.DB) error {
		var rows []ChannelModelPricing
		if err := tx.Where("channel_id = ?", channelId).Find(&rows).Error; err != nil {
			return err
		}
		for i := range rows {
			row := &rows[i]
			lifecycle := row.LifecycleStatus
			reason := row.LifecycleReason
			lastSeen := row.LastSeenAt
			if seen[row.ModelName] {
				lifecycle = ChannelModelLifecycleActive
				reason = ""
				lastSeen = now
				row.MissingSyncCount = 0
				active++
			} else if manualPricingRetained(*row) {
				// A private/contract model may legitimately be absent from the
				// public catalog. An operator-entered price must not be disabled
				// by catalog discovery alone.
				lifecycle = ChannelModelLifecycleActive
				reason = "manual or contract price retained; model is absent from the public catalog"
				row.MissingSyncCount = 0
				active++
			} else {
				row.MissingSyncCount++
				missing++
				reason = "not returned by the latest complete upstream catalog snapshot"
				if row.MissingSyncCount >= threshold {
					lifecycle = ChannelModelLifecycleDisabled
					disabled++
				} else {
					lifecycle = ChannelModelLifecycleNotFound
				}
			}
			if lifecycle == row.LifecycleStatus && reason == row.LifecycleReason && lastSeen == row.LastSeenAt {
				continue
			}
			row.LifecycleStatus = lifecycle
			row.LifecycleReason = reason
			row.LastSeenAt = lastSeen
			row.LifecycleUpdatedAt = now
			if err := tx.Model(row).Updates(map[string]any{
				"lifecycle_status":     row.LifecycleStatus,
				"lifecycle_reason":     row.LifecycleReason,
				"last_seen_at":         row.LastSeenAt,
				"missing_sync_count":   row.MissingSyncCount,
				"lifecycle_updated_at": row.LifecycleUpdatedAt,
			}).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return 0, 0, 0, err
	}
	InvalidateChannelPricingCache()
	InvalidatePricingCache()
	return active, missing, disabled, nil
}

func reactivateManualLifecycle(row *ChannelModelPricing, pricing ChannelInternalPricing) {
	switch strings.TrimSpace(pricing.Source) {
	case "manual", "import", "review-approved":
		row.LifecycleStatus = ChannelModelLifecycleActive
		row.LifecycleReason = "operator price configured; model reactivated"
		row.MissingSyncCount = 0
		row.LastSeenAt = time.Now().Unix()
		row.LifecycleUpdatedAt = row.LastSeenAt
	}
}

func manualPricingRetained(row ChannelModelPricing) bool {
	if row.PricingStatus != ChannelPricingStatusConfigured || strings.TrimSpace(row.InternalPricing) == "" {
		return false
	}
	owner := strings.TrimSpace(row.PricingOwner)
	if owner == "" {
		source := internalPricingSource(row.InternalPricing)
		switch source {
		case "", "manual", "batch", "review-approved":
			return true
		default:
			return false
		}
	}
	return owner != ChannelPricingOwnerAuto
}

func channelLifecycleBillable(lifecycle string) bool {
	switch strings.ToUpper(strings.TrimSpace(lifecycle)) {
	case "", ChannelModelLifecycleActive, ChannelModelLifecycleUpdated, ChannelModelLifecycleDeprecated:
		return true
	default:
		return false
	}
}

// ChannelPricingBillableReason is the shared, DB-free billing-eligibility gate.
// It mirrors ResolveEffectiveChannelPricingFor's decision for one stored row so
// the admin audit page and the Relay billing path cannot disagree: both call
// this function. It returns "" only when the row would actually be charged.
//
// The reason codes are stable and auditable:
//   - PENDING_MODE / GLOBAL_LEGACY_MODE: explicit channel pricing mode
//   - STATUS_NOT_CONFIGURED: official-only / needs-review rows never bill
//   - LIFECYCLE_NOT_BILLABLE: disabled / not-found / sync-failed models
//   - INTERNAL_PRICING_INVALID: JSON or expression cannot be normalized
//   - PRICE_EXPIRED: an auto-derived price's fetched_at is older than the
//     freshness window. Operator, batch and approved prices are explicit
//     decisions and do not expire when the upstream catalog goes stale.
func ChannelPricingBillableReason(row ChannelModelPricing, pricingMode string, now time.Time) string {
	switch strings.ToUpper(strings.TrimSpace(pricingMode)) {
	case dto.ChannelPricingModeScopedPending:
		return "PENDING_MODE"
	case dto.ChannelPricingModeGlobalLegacy:
		return "GLOBAL_LEGACY_MODE"
	}
	if row.PricingStatus != ChannelPricingStatusConfigured {
		return "STATUS_NOT_CONFIGURED"
	}
	if !channelLifecycleBillable(row.LifecycleStatus) {
		return "LIFECYCLE_NOT_BILLABLE"
	}
	if strings.TrimSpace(row.InternalPricing) == "" {
		return "INTERNAL_PRICING_INVALID"
	}
	var internal ChannelInternalPricing
	if err := common.UnmarshalJsonStr(row.InternalPricing, &internal); err != nil {
		return "INTERNAL_PRICING_INVALID"
	}
	if _, err := NormalizeChannelInternalPricing(&internal); err != nil {
		return "INTERNAL_PRICING_INVALID"
	}
	autoDerived := IsAutoDerivedPricingRowFor(row.PricingOwner, row.PricingSource, row.InternalPricing)
	if autoDerived && row.FetchedAt > 0 && now.Sub(time.Unix(row.FetchedAt, 0)) > upstreamPricingFreshnessWindow {
		return "PRICE_EXPIRED"
	}
	return ""
}

// upstreamPricingFreshnessWindow matches the parity audit's freshness window,
// keeping "stale" semantics identical between the audit page and billing.
const upstreamPricingFreshnessWindow = 48 * time.Hour

// EffectiveChannelPricing is the single authoritative resolution of one
// (channel, model) billing price. It collapses the two lookups that billing
// used to perform separately (ResolveChannelBillingPricing + ChannelPricingState)
// into one cache-consistent decision, so every billing path reads the same
// source with the same semantics.
//
// Billable is true only when a durable row exists, its status is configured,
// and the normalized internal price is present. An official_only or
// needs_review row sets Exists=true but Billable=false; callers must treat that
// as "not configured" and must not fall back to a free price.
type EffectiveChannelPricing struct {
	Pricing  *ChannelBillingPricing
	Status   string
	Exists   bool
	Billable bool
	// Reason is set when rows exist but this request identity cannot select one
	// (identity_missing / identity_ambiguous). Callers must block the charge.
	Reason string
}

// ResolveEffectiveChannelPricing is the one authoritative entry point for
// channel-scoped pricing. All billing paths (token, per-call, task settlement)
// must read through it. requestContext/region/deployment dimensions will be
// threaded in when the multimodal price schema lands (P2); today the durable
// key is exactly (channel_id, model_name).
func ResolveEffectiveChannelPricingFor(identity ChannelPricingIdentity) EffectiveChannelPricing {
	pricing, status, _, exists, reason, billableReason := loadChannelPricingFor(identity)
	// Billing eligibility is decided by the same shared gate the audit page
	// uses (ChannelPricingBillableReason), computed inside loadChannelPricingFor
	// from the raw row. Identity ambiguity (reason) remains an additional
	// runtime-only hard block.
	billable := exists && reason == "" && billableReason == "" && pricing != nil
	return EffectiveChannelPricing{
		Pricing:  pricing,
		Status:   status,
		Exists:   exists,
		Reason:   reason,
		Billable: billable,
	}
}

// ResolveEffectiveChannelPricing is the legacy identity-free entry point. It is
// only safe when the channel has a single identity; multiple identities make it
// return Exists=true, Billable=false with a Reason instead of guessing.
func ResolveEffectiveChannelPricing(channelId int, modelName string) EffectiveChannelPricing {
	return ResolveEffectiveChannelPricingFor(ChannelPricingIdentity{ChannelId: channelId, ModelName: modelName})
}

// ResolveChannelUsageDiscount returns the channel-vs-official ratio for task
// usage billing (per-second, per-image or per-call tasks). Token prices are
// handled by ResolveChannelBillingPricing and always return 1 here so a task
// discount is never applied twice.
func ResolveChannelUsageDiscountFor(identity ChannelPricingIdentity) float64 {
	identity = normalizePricingIdentity(identity)
	if DB == nil || identity.ChannelId <= 0 || identity.ModelName == "" {
		return 1
	}
	rows, err := loadChannelPricingRows(identity.ChannelId, identity.ModelName)
	if err != nil {
		return 1
	}
	row, reason := selectChannelPricingRow(rows, identity)
	if row == nil || reason != "" {
		return 1
	}
	var view ChannelOfficialPricing
	if err := common.UnmarshalJsonStr(row.NormalizedPricing, &view); err != nil {
		return 1
	}
	if view.ChannelPrice == nil || len(view.Tiers) != 1 {
		return 1
	}
	official := view.Tiers[0]
	channel := *view.ChannelPrice
	if official.Unit != channel.Unit || !moneyPositive(official.PerUnitUSD) ||
		!moneyPositive(channel.PerUnitUSD) {
		return 1
	}
	switch official.Unit {
	case "per_second", "per_image", "per_call", "per_minute":
	default:
		return 1
	}
	ratio := channel.PerUnitUSD.Decimal().Div(official.PerUnitUSD.Decimal()).InexactFloat64()
	if math.IsNaN(ratio) || math.IsInf(ratio, 0) || ratio <= 0 || ratio > 100 {
		common.SysError(fmt.Sprintf(
			"ignored invalid channel usage discount %.4f for channel %d model %s",
			ratio, identity.ChannelId, identity.ModelName,
		))
		return 1
	}
	return ratio
}

// ResolveChannelUsageDiscount is the legacy identity-free variant.
func ResolveChannelUsageDiscount(channelId int, modelName string) float64 {
	return ResolveChannelUsageDiscountFor(ChannelPricingIdentity{ChannelId: channelId, ModelName: modelName})
}

// ResolveChannelBillingPricing returns the configured internal price for the
// actual channel that will serve the request. Official-only rows are not
// billable and return ok=false. It delegates to ResolveEffectiveChannelPricing
// so there is a single decision function.
func ResolveChannelBillingPricing(channelId int, modelName string) (*ChannelBillingPricing, bool) {
	effective := ResolveEffectiveChannelPricing(channelId, modelName)
	if effective.Pricing != nil && effective.Pricing.UsePerSecond {
		// The token/per-call accessor must not expose a per-second price.
		return nil, false
	}
	return effective.Pricing, effective.Billable
}

// ChannelPricingState reports whether a channel has an isolated record and its
// current status. Callers use it to stop an official-only row from silently
// falling back to the global price. It delegates to ResolveEffectiveChannelPricing.
func ChannelPricingState(channelId int, modelName string) (string, bool) {
	effective := ResolveEffectiveChannelPricing(channelId, modelName)
	return effective.Status, effective.Exists
}

type channelPricingPresence struct {
	has       bool
	expiresAt time.Time
}

var channelPricingPresenceCache sync.Map

// ChannelUsesScopedPricing reports whether a channel has any channel-scoped
// pricing rows. Such a channel is managed by ChannelModelPricing, so a missing
// row means "not synced / not priced" and must not fall back to another
// channel's or the global price. Channels with no rows keep the legacy global
// pricing path.
func ChannelUsesScopedPricing(channelId int) bool {
	if DB == nil || channelId <= 0 {
		return false
	}
	if cached, ok := channelPricingPresenceCache.Load(channelId); ok {
		entry := cached.(channelPricingPresence)
		if time.Now().Before(entry.expiresAt) {
			return entry.has
		}
	}
	var count int64
	err := DB.Model(&ChannelModelPricing{}).
		Where("channel_id = ?", channelId).
		Limit(1).
		Count(&count).Error
	has := err == nil && count > 0
	channelPricingPresenceCache.Store(channelId, channelPricingPresence{
		has: has, expiresAt: time.Now().Add(channelPricingCacheTTL),
	})
	return has
}

// ChannelScopedPricingRequired is the authoritative pricing-mode gate. An
// explicit mode on the channel always wins: PENDING blocks every charge while
// prices are being configured, ACTIVE requires a billable row on this channel,
// and GLOBAL_LEGACY deliberately keeps the pre-isolation behaviour. Only an
// untagged legacy channel falls back to the row-presence heuristic.
func ChannelScopedPricingRequired(channelId int, mode string) bool {
	switch strings.ToUpper(strings.TrimSpace(mode)) {
	case dto.ChannelPricingModeScopedPending, dto.ChannelPricingModeScopedActive:
		return true
	case dto.ChannelPricingModeGlobalLegacy:
		return false
	default:
		return ChannelUsesScopedPricing(channelId)
	}
}

// InvalidateChannelPricingPresence clears the scoped-pricing presence cache so
// the first row written by a sync takes effect immediately.
func InvalidateChannelPricingPresence(channelId int) {
	channelPricingPresenceCache.Delete(channelId)
}

// ChannelPricedModelNames returns every model that has a channel-scoped
// official price. Global preset autofill must skip these names so one
// channel's official quote never becomes another channel's price.
func ChannelPricedModelNames() (map[string]bool, error) {
	if DB == nil || !DB.Migrator().HasTable(&ChannelModelPricing{}) {
		return map[string]bool{}, nil
	}
	var names []string
	if err := DB.Model(&ChannelModelPricing{}).Distinct("model_name").Pluck("model_name", &names).Error; err != nil {
		return nil, err
	}
	out := make(map[string]bool, len(names))
	for _, name := range names {
		out[name] = true
	}
	return out, nil
}

// UpdateChannelOfficialPricingView rewrites only the normalized official view
// (including the separate upstream channel-price block). Internal sale price,
// status and official raw payload are preserved.
func UpdateChannelOfficialPricingView(channelId int, modelName string, view ChannelOfficialPricing) error {
	modelName = strings.TrimSpace(modelName)
	if channelId <= 0 || modelName == "" {
		return errors.New("channel id and model name are required")
	}
	normalized, err := common.Marshal(view)
	if err != nil {
		return err
	}
	now := time.Now().Unix()
	row, err := GetChannelModelPricing(channelId, modelName)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		legacy := ChannelModelPricing{
			ChannelId: channelId, Provider: "legacy", ModelName: modelName,
			Currency: view.Currency, OfficialPricing: "{}",
			NormalizedPricing: string(normalized),
			PricingSource:     "legacy:ChannelPriceSetting",
			PricingStatus:     ChannelPricingStatusOfficialOnly,
			FetchedAt:         now, UpdatedAt: now,
		}
		legacy.PricingVersion = channelPricingVersion(legacy)
		if err := DB.Create(&legacy).Error; err != nil {
			return err
		}
		invalidateChannelPricingCache(channelId, modelName)
		return nil
	}
	if err != nil {
		return err
	}
	row.NormalizedPricing = string(normalized)
	row.UpdatedAt = now
	row.PricingVersion = channelPricingVersion(*row)
	if err := DB.Save(row).Error; err != nil {
		return err
	}
	invalidateChannelPricingCache(channelId, modelName)
	return nil
}

// ChannelPricingOrphan groups pricing rows whose channel no longer exists.
// Orphans are audit-visible but never billable and must not be deleted
// automatically during a production audit.
type ChannelPricingOrphan struct {
	ChannelId int   `json:"channel_id"`
	Count     int64 `json:"count"`
}

// ListOrphanChannelPricing returns pricing rows left behind by deleted
// channels, grouped by channel id.
func ListOrphanChannelPricing() ([]ChannelPricingOrphan, error) {
	if DB == nil || !DB.Migrator().HasTable(&ChannelModelPricing{}) {
		return nil, nil
	}
	var rows []ChannelPricingOrphan
	err := DB.Table("channel_model_pricing AS cmp").
		Joins("LEFT JOIN channels AS c ON c.id = cmp.channel_id").
		Where("c.id IS NULL").
		Select("cmp.channel_id AS channel_id, COUNT(*) AS count").
		Group("cmp.channel_id").
		Order("cmp.channel_id").
		Scan(&rows).Error
	return rows, err
}

// ListOrphanChannelPricingRows returns the full orphan rows for backup and
// migration preview. It is read-only.
func ListOrphanChannelPricingRows() ([]ChannelModelPricing, error) {
	if DB == nil || !DB.Migrator().HasTable(&ChannelModelPricing{}) {
		return nil, nil
	}
	var rows []ChannelModelPricing
	err := DB.Table("channel_model_pricing AS cmp").
		Joins("LEFT JOIN channels AS c ON c.id = cmp.channel_id").
		Where("c.id IS NULL").
		Order("cmp.channel_id, cmp.model_name").
		Select("cmp.*").
		Scan(&rows).Error
	return rows, err
}

// ChannelInternalPricingIsAutoDerived reports whether a stored sale price was
// written by an upstream sync and may therefore be refreshed.
func ChannelInternalPricingIsAutoDerived(raw string) bool {
	return autoDerivedInternalSource(internalPricingSource(raw))
}
