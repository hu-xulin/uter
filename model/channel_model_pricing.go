package model

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/uter-ai/uter/common"
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

const (
	ChannelPricingModePerMillionTokens = "per_1m_token"
	ChannelPricingModePerCall          = "per_call"
	ChannelPricingModePerSecond        = "per_second"
	ChannelPricingModeTieredExpr       = "tiered_expr"
	ChannelPricingModePerMinute        = "per_minute"
)

// ChannelModelPricing is one channel's independent price record for one model.
// The unique key is the full upstream identity (channel, provider, region,
// deployment, model): the same model served by another channel, region or
// deployment is a different row and cannot be overwritten by a sync.
type ChannelModelPricing struct {
	Id                int64  `gorm:"primaryKey;autoIncrement"`
	ChannelId         int    `gorm:"uniqueIndex:idx_channel_model_pricing_identity,priority:1;index:idx_channel_model_lookup,priority:1"`
	Provider          string `gorm:"size:64;uniqueIndex:idx_channel_model_pricing_identity,priority:2"`
	ModelName         string `gorm:"size:255;uniqueIndex:idx_channel_model_pricing_identity,priority:5;index:idx_channel_model_lookup,priority:2"`
	Region            string `gorm:"size:64;uniqueIndex:idx_channel_model_pricing_identity,priority:3"`
	DeploymentId      string `gorm:"size:128;uniqueIndex:idx_channel_model_pricing_identity,priority:4"`
	Currency          string `gorm:"size:16"`
	OfficialPricing   string `gorm:"type:text"`
	NormalizedPricing string `gorm:"type:text"`
	InternalPricing   string `gorm:"type:text"`
	PricingSource     string `gorm:"size:64"`
	PricingStatus     string `gorm:"size:32;index"`
	PricingVersion    string `gorm:"size:64"`
	FetchedAt         int64
	UpdatedAt         int64
}

func (ChannelModelPricing) TableName() string { return "channel_model_pricing" }

// ChannelPricingTier is one official price band. Amounts are USD per unit so
// comparisons never depend on the source currency or unit.
type ChannelPricingTier struct {
	RangeName                string   `json:"range_name"`
	TimeBand                 string   `json:"time_band,omitempty"`
	MinInputTokens           int64    `json:"min_input_tokens,omitempty"`
	MaxInputTokens           int64    `json:"max_input_tokens,omitempty"`
	InputPerMillionUSD       *float64 `json:"input_per_million_usd,omitempty"`
	OutputPerMillionUSD      *float64 `json:"output_per_million_usd,omitempty"`
	CachePerMillionUSD       *float64 `json:"cache_per_million_usd,omitempty"`
	CreateCachePerMillionUSD *float64 `json:"create_cache_per_million_usd,omitempty"`
	AudioInputPerMillionUSD  *float64 `json:"audio_input_per_million_usd,omitempty"`
	AudioOutputPerMillionUSD *float64 `json:"audio_output_per_million_usd,omitempty"`
	PerUnitUSD               *float64 `json:"per_unit_usd,omitempty"`
	Unit                     string   `json:"unit"`
	RawPriceTypes            []string `json:"raw_price_types,omitempty"`
}

// ChannelPricingComponent is an additional billable service the catalog
// publishes for the same model, stored so both prices stay visible without
// forcing a second billing dimension.
type ChannelPricingComponent struct {
	Name string  `json:"name,omitempty"`
	Type string  `json:"type,omitempty"`
	Unit string  `json:"unit"`
	USD  float64 `json:"usd"`
}

// ChannelOfficialPricing is the normalized official view for one channel
// model. The untouched source payload is kept in ChannelModelPricing.
type ChannelOfficialPricing struct {
	Currency    string               `json:"currency"`
	FXRateToUSD float64              `json:"fx_rate_to_usd,omitempty"`
	Unit        string               `json:"unit"`
	Tiers       []ChannelPricingTier `json:"tiers"`
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
	NeedsReview        bool                      `json:"needs_review,omitempty"`
	ReviewReasons      []string                  `json:"review_reasons,omitempty"`
}

// ChannelInternalPricing is the operator's flat sale price for one channel
// model. Tiered official prices are never flattened into this structure.
type ChannelInternalPricing struct {
	Mode                 string   `json:"mode"`
	InputUSDPerMillion   *float64 `json:"input_per_million_usd,omitempty"`
	OutputUSDPerMillion  *float64 `json:"output_per_million_usd,omitempty"`
	CacheUSDPerMillion   *float64 `json:"cache_per_million_usd,omitempty"`
	AudioRatio           *float64 `json:"audio_ratio,omitempty"`
	AudioCompletionRatio *float64 `json:"audio_completion_ratio,omitempty"`
	// CreateCacheUSDPerMillion is the cache-write price. When omitted the
	// global create-cache ratio remains in force.
	CreateCacheUSDPerMillion *float64 `json:"create_cache_per_million_usd,omitempty"`
	PerCallUSD               *float64 `json:"per_call_usd,omitempty"`
	PerSecondUSD             *float64 `json:"per_second_usd,omitempty"`
	PerMinuteUSD             *float64 `json:"per_minute_usd,omitempty"`
	BillingExpr              string   `json:"billing_expr,omitempty"`
	Note                     string   `json:"note,omitempty"`
	// Source records who last wrote the internal price. Automatic syncs tag
	// their writes so a later sync may refresh them, while an operator-saved
	// price is never overwritten.
	Source             string  `json:"source,omitempty"`
	DiscountGroup      string  `json:"discount_group,omitempty"`
	DiscountModelGroup string  `json:"discount_model_group,omitempty"`
	DiscountRatio      float64 `json:"discount_ratio,omitempty"`
	UpdatedAt          int64   `json:"updated_at"`
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
}

// ChannelOfficialPricingRecord is one upsert input for an official sync.
type ChannelOfficialPricingRecord struct {
	ChannelId         int
	Provider          string
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
	pricing   *ChannelBillingPricing
	status    string
	exists    bool
	expiresAt time.Time
}

const channelPricingCacheTTL = 30 * time.Second

func channelPricingCacheKey(channelId int, modelName string) string {
	return fmt.Sprintf("%d\x00%s", channelId, modelName)
}

func invalidateChannelPricingCache(channelId int, modelName string) {
	channelPricingCacheMu.Lock()
	delete(channelPricingCache, channelPricingCacheKey(channelId, modelName))
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
		row.NormalizedPricing, row.InternalPricing, row.PricingSource,
	})
	return fmt.Sprintf("%x", sha256.Sum256(encoded))
}

func validPricePointer(value *float64) error {
	if value == nil {
		return nil
	}
	if math.IsNaN(*value) || math.IsInf(*value, 0) || *value < 0 {
		return errors.New("price must be finite and non-negative")
	}
	return nil
}

// NormalizeChannelInternalPricing validates an operator-saved flat price and
// returns the multiplier form used by billing.
func NormalizeChannelInternalPricing(pricing *ChannelInternalPricing) (*ChannelBillingPricing, error) {
	if pricing == nil {
		return nil, errors.New("internal pricing is required")
	}
	for _, value := range []*float64{
		pricing.InputUSDPerMillion, pricing.OutputUSDPerMillion,
		pricing.CacheUSDPerMillion, pricing.CreateCacheUSDPerMillion,
		pricing.PerCallUSD, pricing.PerSecondUSD, pricing.PerMinuteUSD,
	} {
		if err := validPricePointer(value); err != nil {
			return nil, err
		}
	}
	switch pricing.Mode {
	case ChannelPricingModePerMillionTokens:
		if pricing.InputUSDPerMillion == nil || *pricing.InputUSDPerMillion <= 0 {
			return nil, errors.New("input price per 1M tokens is required")
		}
		if pricing.OutputUSDPerMillion == nil {
			return nil, errors.New("output price per 1M tokens is required")
		}
		input := *pricing.InputUSDPerMillion
		result := &ChannelBillingPricing{
			Mode: ChannelPricingModePerMillionTokens,
			// USD/1M = ratio * (1_000_000 / QuotaPerUnit) = ratio * 2.
			ModelRatio: input / 2,
		}
		completion := *pricing.OutputUSDPerMillion / input
		result.CompletionRatio = &completion
		if pricing.CacheUSDPerMillion != nil {
			cache := *pricing.CacheUSDPerMillion / input
			result.CacheRatio = &cache
		}
		if pricing.CreateCacheUSDPerMillion != nil {
			createCache := *pricing.CreateCacheUSDPerMillion / input
			result.CreateCacheRatio = &createCache
		}
		result.AudioRatio = pricing.AudioRatio
		result.AudioCompletionRatio = pricing.AudioCompletionRatio
		return result, nil
	case ChannelPricingModePerCall:
		if pricing.PerCallUSD == nil || *pricing.PerCallUSD < 0 {
			return nil, errors.New("per-call price is required")
		}
		return &ChannelBillingPricing{Mode: ChannelPricingModePerCall, UsePrice: true, ModelPrice: *pricing.PerCallUSD}, nil
	case ChannelPricingModeTieredExpr:
		if strings.TrimSpace(pricing.BillingExpr) == "" {
			return nil, errors.New("tiered billing expression is required")
		}
		return &ChannelBillingPricing{Mode: ChannelPricingModeTieredExpr, BillingExpr: pricing.BillingExpr}, nil
	case ChannelPricingModePerSecond:
		// Per-second prices bill through the task usage expression. A billing
		// form is still returned so the price can be stored; token/per-call
		// paths must reject UsePerSecond instead of treating it as free.
		if pricing.PerSecondUSD == nil || *pricing.PerSecondUSD <= 0 {
			return nil, errors.New("per-second price is required")
		}
		return &ChannelBillingPricing{Mode: ChannelPricingModePerSecond, UsePerSecond: true, PerSecondPrice: *pricing.PerSecondUSD}, nil
	case ChannelPricingModePerMinute:
		// Seconds are the task usage unit. A per-minute quote is normalized to
		// its per-second equivalent so the same duration billing path applies.
		if pricing.PerMinuteUSD == nil || *pricing.PerMinuteUSD <= 0 {
			return nil, errors.New("per-minute price is required")
		}
		return &ChannelBillingPricing{
			Mode: ChannelPricingModePerMinute, UsePerSecond: true, PerSecondPrice: *pricing.PerMinuteUSD / 60,
		}, nil
	default:
		return nil, errors.New("unsupported internal pricing mode")
	}
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
	return strings.HasPrefix(pricing.Source, "dreamrouter-") || strings.HasPrefix(pricing.Source, "bailian-")
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
				row := ChannelModelPricing{
					ChannelId:         record.ChannelId,
					Provider:          record.Provider,
					ModelName:         record.ModelName,
					Region:            record.Region,
					DeploymentId:      record.DeploymentId,
					Currency:          record.Currency,
					OfficialPricing:   record.OfficialPricing,
					NormalizedPricing: record.NormalizedPricing,
					InternalPricing:   record.InternalPricing,
					PricingSource:     record.Source,
					PricingStatus:     ChannelPricingStatusOfficialOnly,
					FetchedAt:         record.FetchedAt,
					UpdatedAt:         now,
				}
				if row.InternalPricing != "" {
					row.PricingStatus = ChannelPricingStatusConfigured
				} else if officialPricingNeedsReview(record.NormalizedPricing) {
					row.PricingStatus = ChannelPricingStatusNeedsReview
				}
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
			existing.Region = record.Region
			existing.DeploymentId = record.DeploymentId
			existing.Currency = record.Currency
			existing.OfficialPricing = record.OfficialPricing
			existing.NormalizedPricing = record.NormalizedPricing
			existing.PricingSource = record.Source
			existing.FetchedAt = record.FetchedAt
			existing.UpdatedAt = now
			if record.InternalPricing != "" && internalPricingReplaceable(existing.InternalPricing) {
				existing.InternalPricing = record.InternalPricing
				existing.PricingStatus = ChannelPricingStatusConfigured
			}
			// Official catalog syncs no longer derive a sale price. A row whose
			// previous internal price was auto-derived by the same provider
			// returns to official_only instead of silently staying billable.
			if record.InternalPricing == "" && strings.HasPrefix(record.Source, "bailian-") &&
				strings.HasPrefix(internalPricingSource(existing.InternalPricing), "bailian-") {
				existing.InternalPricing = ""
				existing.PricingStatus = ChannelPricingStatusOfficialOnly
			}
			if existing.InternalPricing == "" && existing.PricingStatus != ChannelPricingStatusConfigured {
				if officialPricingNeedsReview(existing.NormalizedPricing) {
					existing.PricingStatus = ChannelPricingStatusNeedsReview
				} else {
					existing.PricingStatus = ChannelPricingStatusOfficialOnly
				}
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
		if !strings.HasPrefix(internalPricingSource(row.InternalPricing), sourcePrefix) {
			continue
		}
		row.InternalPricing = ""
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

// SetChannelInternalPricing stores an operator price for one channel model.
// Official data must have been synced first so the row is auditable.
func SetChannelInternalPricing(channelId int, modelName string, pricing ChannelInternalPricing) error {
	modelName = strings.TrimSpace(modelName)
	if channelId <= 0 || modelName == "" {
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
	var row ChannelModelPricing
	if err := DB.Where("channel_id = ? AND model_name = ?", channelId, modelName).
		Order("CASE WHEN pricing_status = 'configured' THEN 0 ELSE 1 END").
		Order("fetched_at DESC").Order("updated_at DESC").Order("id DESC").
		First(&row).Error; err != nil {
		return fmt.Errorf("channel pricing record not found: %w", err)
	}
	row.InternalPricing = string(encoded)
	row.PricingStatus = ChannelPricingStatusConfigured
	row.UpdatedAt = pricing.UpdatedAt
	row.PricingVersion = channelPricingVersion(row)
	if err := DB.Save(&row).Error; err != nil {
		return err
	}
	invalidateChannelPricingCache(channelId, modelName)
	InvalidatePricingCache()
	return nil
}

// ErrChannelPricingVersionConflict marks a batch apply whose price inputs
// changed after the preview that produced them.
var ErrChannelPricingVersionConflict = errors.New("channel pricing changed since preview")

// SetChannelInternalPricingIfVersion stores an operator price only while the
// row still carries expectedVersion. An empty expectedVersion keeps the
// unconditional behaviour. The row is read and written under one transaction
// so a concurrent sync or batch cannot slip between the check and the write.
func SetChannelInternalPricingIfVersion(
	channelId int,
	modelName string,
	pricing ChannelInternalPricing,
	expectedVersion string,
) error {
	if expectedVersion == "" {
		return SetChannelInternalPricing(channelId, modelName, pricing)
	}
	modelName = strings.TrimSpace(modelName)
	if channelId <= 0 || modelName == "" {
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
		var row ChannelModelPricing
		if err := lockForUpdate(tx).
			Where("channel_id = ? AND model_name = ?", channelId, modelName).
			Order("CASE WHEN pricing_status = 'configured' THEN 0 ELSE 1 END").
			Order("fetched_at DESC").Order("updated_at DESC").Order("id DESC").
			First(&row).Error; err != nil {
			return fmt.Errorf("channel pricing record not found: %w", err)
		}
		if row.PricingVersion != expectedVersion {
			return ErrChannelPricingVersionConflict
		}
		row.InternalPricing = string(encoded)
		row.PricingStatus = ChannelPricingStatusConfigured
		row.UpdatedAt = pricing.UpdatedAt
		row.PricingVersion = channelPricingVersion(row)
		return tx.Save(&row).Error
	})
	if err != nil {
		return err
	}
	invalidateChannelPricingCache(channelId, modelName)
	InvalidatePricingCache()
	return nil
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

// ListChannelModelPricing returns a channel's records ordered by model name.
func ListChannelModelPricing(channelId int) ([]ChannelModelPricing, error) {
	var rows []ChannelModelPricing
	err := DB.Where("channel_id = ?", channelId).Order("model_name").Find(&rows).Error
	return rows, err
}

// loadChannelPricing reads and caches one channel/model record. A missing row
// is cached too so hot billing paths do not query the database repeatedly.
func loadChannelPricing(channelId int, modelName string) (*ChannelBillingPricing, string, bool) {
	modelName = strings.TrimSpace(modelName)
	if DB == nil || channelId <= 0 || modelName == "" {
		return nil, "", false
	}
	key := channelPricingCacheKey(channelId, modelName)
	channelPricingCacheMu.RLock()
	if entry, ok := channelPricingCache[key]; ok && time.Now().Before(entry.expiresAt) {
		channelPricingCacheMu.RUnlock()
		return entry.pricing, entry.status, entry.exists
	}
	channelPricingCacheMu.RUnlock()

	row, err := GetChannelModelPricing(channelId, modelName)
	if err != nil {
		channelPricingCacheMu.Lock()
		channelPricingCache[key] = channelPricingCacheEntry{expiresAt: time.Now().Add(channelPricingCacheTTL)}
		channelPricingCacheMu.Unlock()
		return nil, "", false
	}
	entry := channelPricingCacheEntry{
		status:    row.PricingStatus,
		exists:    true,
		expiresAt: time.Now().Add(channelPricingCacheTTL),
	}
	if row.PricingStatus == ChannelPricingStatusConfigured && row.InternalPricing != "" {
		var internal ChannelInternalPricing
		if err := common.UnmarshalJsonStr(row.InternalPricing, &internal); err != nil {
			common.SysError("invalid channel internal pricing: " + err.Error())
		} else if pricing, err := NormalizeChannelInternalPricing(&internal); err != nil {
			common.SysError("invalid channel internal pricing: " + err.Error())
		} else {
			pricing.Version = row.PricingVersion
			pricing.Source = row.PricingSource
			entry.pricing = pricing
		}
	}
	channelPricingCacheMu.Lock()
	channelPricingCache[key] = entry
	channelPricingCacheMu.Unlock()
	return entry.pricing, entry.status, entry.exists
}

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
}

// ResolveEffectiveChannelPricing is the one authoritative entry point for
// channel-scoped pricing. All billing paths (token, per-call, task settlement)
// must read through it. requestContext/region/deployment dimensions will be
// threaded in when the multimodal price schema lands (P2); today the durable
// key is exactly (channel_id, model_name).
func ResolveEffectiveChannelPricing(channelId int, modelName string) EffectiveChannelPricing {
	pricing, status, exists := loadChannelPricing(channelId, modelName)
	return EffectiveChannelPricing{
		Pricing:  pricing,
		Status:   status,
		Exists:   exists,
		Billable: exists && status == ChannelPricingStatusConfigured && pricing != nil,
	}
}

// ResolveChannelUsageDiscount returns the channel-vs-official ratio for task
// usage billing (per-second, per-image or per-call tasks). Token prices are
// handled by ResolveChannelBillingPricing and always return 1 here so a task
// discount is never applied twice.
func ResolveChannelUsageDiscount(channelId int, modelName string) float64 {
	if DB == nil || channelId <= 0 || strings.TrimSpace(modelName) == "" {
		return 1
	}
	row, err := GetChannelModelPricing(channelId, modelName)
	if err != nil || row == nil {
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
	if official.Unit != channel.Unit || official.PerUnitUSD == nil ||
		channel.PerUnitUSD == nil || *official.PerUnitUSD <= 0 {
		return 1
	}
	switch official.Unit {
	case "per_second", "per_image", "per_call", "per_minute":
	default:
		return 1
	}
	ratio := *channel.PerUnitUSD / *official.PerUnitUSD
	if math.IsNaN(ratio) || math.IsInf(ratio, 0) || ratio <= 0 || ratio > 100 {
		common.SysError(fmt.Sprintf(
			"ignored invalid channel usage discount %.4f for channel %d model %s",
			ratio, channelId, modelName,
		))
		return 1
	}
	return ratio
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
