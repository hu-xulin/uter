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
)

// ChannelModelPricing is one channel's independent price record for one model.
// The unique key is (channel_id, model_name): the same model served by another
// channel is a different row and cannot be overwritten by a sync.
type ChannelModelPricing struct {
	Id                int64  `gorm:"primaryKey;autoIncrement"`
	ChannelId         int    `gorm:"uniqueIndex:idx_channel_model_pricing,priority:1;index"`
	Provider          string `gorm:"size:64;index"`
	ModelName         string `gorm:"size:255;uniqueIndex:idx_channel_model_pricing,priority:2"`
	Region            string `gorm:"size:64"`
	DeploymentId      string `gorm:"size:128"`
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
	RangeName           string   `json:"range_name"`
	TimeBand            string   `json:"time_band,omitempty"`
	MinInputTokens      int64    `json:"min_input_tokens,omitempty"`
	MaxInputTokens      int64    `json:"max_input_tokens,omitempty"`
	InputPerMillionUSD  *float64 `json:"input_per_million_usd,omitempty"`
	OutputPerMillionUSD *float64 `json:"output_per_million_usd,omitempty"`
	CachePerMillionUSD  *float64 `json:"cache_per_million_usd,omitempty"`
	PerUnitUSD          *float64 `json:"per_unit_usd,omitempty"`
	Unit                string   `json:"unit"`
	RawPriceTypes       []string `json:"raw_price_types,omitempty"`
}

// ChannelOfficialPricing is the normalized official view for one channel
// model. The untouched source payload is kept in ChannelModelPricing.
type ChannelOfficialPricing struct {
	Currency      string               `json:"currency"`
	FXRateToUSD   float64              `json:"fx_rate_to_usd,omitempty"`
	Unit          string               `json:"unit"`
	Tiers         []ChannelPricingTier `json:"tiers"`
	Source        string               `json:"source"`
	FetchedAt     int64                `json:"fetched_at"`
	NeedsReview   bool                 `json:"needs_review,omitempty"`
	ReviewReasons []string             `json:"review_reasons,omitempty"`
}

// ChannelInternalPricing is the operator's flat sale price for one channel
// model. Tiered official prices are never flattened into this structure.
type ChannelInternalPricing struct {
	Mode                string   `json:"mode"`
	InputUSDPerMillion  *float64 `json:"input_per_million_usd,omitempty"`
	OutputUSDPerMillion *float64 `json:"output_per_million_usd,omitempty"`
	CacheUSDPerMillion  *float64 `json:"cache_per_million_usd,omitempty"`
	PerCallUSD          *float64 `json:"per_call_usd,omitempty"`
	Note                string   `json:"note,omitempty"`
	UpdatedAt           int64    `json:"updated_at"`
}

// ChannelBillingPricing is the resolved multiplier form used by the relay.
// CompletionRatio/CacheRatio are nil when the operator did not set an output
// or cache price, in which case the global ratio remains in force.
type ChannelBillingPricing struct {
	ModelRatio      float64
	CompletionRatio *float64
	CacheRatio      *float64
	ModelPrice      float64
	UsePrice        bool
	Version         string
	Source          string
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
	Source            string
	FetchedAt         int64
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
		pricing.CacheUSDPerMillion, pricing.PerCallUSD,
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
			// USD/1M = ratio * (1_000_000 / QuotaPerUnit) = ratio * 2.
			ModelRatio: input / 2,
		}
		completion := *pricing.OutputUSDPerMillion / input
		result.CompletionRatio = &completion
		if pricing.CacheUSDPerMillion != nil {
			cache := *pricing.CacheUSDPerMillion / input
			result.CacheRatio = &cache
		}
		return result, nil
	case ChannelPricingModePerCall:
		if pricing.PerCallUSD == nil || *pricing.PerCallUSD < 0 {
			return nil, errors.New("per-call price is required")
		}
		return &ChannelBillingPricing{UsePrice: true, ModelPrice: *pricing.PerCallUSD}, nil
	default:
		return nil, errors.New("unsupported internal pricing mode")
	}
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
			err := tx.Where("channel_id = ? AND model_name = ?", record.ChannelId, record.ModelName).
				First(&existing).Error
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
					PricingSource:     record.Source,
					PricingStatus:     ChannelPricingStatusOfficialOnly,
					FetchedAt:         record.FetchedAt,
					UpdatedAt:         now,
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
	return written, nil
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
	if err := DB.Where("channel_id = ? AND model_name = ?", channelId, modelName).First(&row).Error; err != nil {
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
	return nil
}

// GetChannelModelPricing returns one channel's price record.
func GetChannelModelPricing(channelId int, modelName string) (*ChannelModelPricing, error) {
	var row ChannelModelPricing
	err := DB.Where("channel_id = ? AND model_name = ?", channelId, strings.TrimSpace(modelName)).
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

// ResolveChannelBillingPricing returns the configured internal price for the
// actual channel that will serve the request. Official-only rows are not
// billable and return ok=false.
func ResolveChannelBillingPricing(channelId int, modelName string) (*ChannelBillingPricing, bool) {
	pricing, status, exists := loadChannelPricing(channelId, modelName)
	return pricing, exists && status == ChannelPricingStatusConfigured && pricing != nil
}

// ChannelPricingState reports whether a channel has an isolated record and its
// current status. Callers use it to stop an official-only row from silently
// falling back to the global price.
func ChannelPricingState(channelId int, modelName string) (string, bool) {
	_, status, exists := loadChannelPricing(channelId, modelName)
	return status, exists
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
