package service

import (
	"math"
	"strings"
	"sync"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/setting/billing_setting"
)

// uterRouteSyncSnapshotKey is the legacy full-sync snapshot. It is no longer
// written; it remains readable as a fallback for models the live public
// pricing document cannot price (media/tiered entries missing from a sync).
const uterRouteSyncSnapshotKey = "UterRouteSyncSnapshot"

// officialPerSecondField is the key for an official price expressed in USD per
// second. It is not a ratio and must be compared only with another per-second
// price.
const officialPerSecondField = "official_price_per_second"

// UterRoutePriceLine is one price line. Token models use USD per 1M tokens,
// per-call models use USD per call, and per-second media models use USD per
// second.
type UterRoutePriceLine struct {
	Input       float64 `json:"input"`
	Output      float64 `json:"output"`
	Cache       float64 `json:"cache"`
	CreateCache float64 `json:"create_cache"`
}

// UterRouteModelRow is one model in the legacy full-sync snapshot.
type UterRouteModelRow struct {
	UpstreamName            string             `json:"upstream_name"`
	LocalName               string             `json:"local_name"`
	BillingClass            string             `json:"billing_class"`
	QuotaType               int                `json:"quota_type"`
	GroupRatio              float64            `json:"group_ratio"`
	Official                UterRoutePriceLine `json:"official"`
	Upstream                UterRoutePriceLine `json:"upstream"`
	Uter                    UterRoutePriceLine `json:"uter"`
	UpstreamDiscountPercent float64            `json:"upstream_discount_percent"`
	UterDiscountPercent     float64            `json:"uter_discount_percent"`
	UpstreamZhe             float64            `json:"upstream_zhe"`
	UterZhe                 float64            `json:"uter_zhe"`
	PerSecond               bool               `json:"per_second,omitempty"`
	Aligned                 bool               `json:"aligned"`
	Note                    string             `json:"note,omitempty"`
}

// UterRouteSnapshot is the last legacy full-sync snapshot.
type UterRouteSnapshot struct {
	PricingVersion string              `json:"pricing_version"`
	SyncedAt       time.Time           `json:"synced_at"`
	RuleDirection  string              `json:"rule_direction"`
	RuleAmount     float64             `json:"rule_amount"`
	ChannelID      int                 `json:"channel_id"`
	Models         []UterRouteModelRow `json:"models"`
}

var (
	uterRouteSnapshotMu    sync.Mutex
	uterRouteSnapshotRaw   string
	uterRouteSnapshotValue *UterRouteSnapshot
)

// LoadUterRouteSnapshot returns the last legacy full-sync snapshot.
func LoadUterRouteSnapshot() *UterRouteSnapshot {
	raw := strings.TrimSpace(common.GetOption(uterRouteSyncSnapshotKey))
	if raw == "" {
		return nil
	}
	uterRouteSnapshotMu.Lock()
	defer uterRouteSnapshotMu.Unlock()
	if raw == uterRouteSnapshotRaw && uterRouteSnapshotValue != nil {
		return uterRouteSnapshotValue
	}
	var snapshot UterRouteSnapshot
	if err := common.Unmarshal([]byte(raw), &snapshot); err != nil {
		return nil
	}
	uterRouteSnapshotRaw = raw
	uterRouteSnapshotValue = &snapshot
	return &snapshot
}

// uterRouteRowBillsPerSecond reports whether a legacy row is priced per
// second. New snapshots carry the flag; older rows fall back to the local
// billing expression shape.
func uterRouteRowBillsPerSecond(row UterRouteModelRow) bool {
	if row.PerSecond {
		return true
	}
	if row.BillingClass != "tiered" {
		return false
	}
	expr, ok := billing_setting.GetBillingExpr(row.LocalName)
	if !ok || strings.TrimSpace(expr) == "" {
		expr, ok = billing_setting.GetBillingExpr(row.UpstreamName)
	}
	if !ok || strings.TrimSpace(expr) == "" {
		return false
	}
	_, perSecond := uterRouteDurationUnitPrices(expr)
	return perSecond
}

// LoadUterRouteOfficialReference returns the plaza's official reference
// prices. The live isolated snapshot wins; the legacy snapshot only fills gaps
// so old data cannot override a current list price.
func LoadUterRouteOfficialReference() map[string]map[string]float64 {
	legacy := loadLegacyUterRouteOfficialReference()
	live := LoadUterRouteUpstreamOfficialReference()
	if len(live) == 0 {
		return legacy
	}
	if legacy == nil {
		return live
	}
	for name, entry := range live {
		legacy[name] = entry
	}
	return legacy
}

func loadLegacyUterRouteOfficialReference() map[string]map[string]float64 {
	snapshot := LoadUterRouteSnapshot()
	if snapshot == nil || len(snapshot.Models) == 0 {
		return nil
	}
	reference := make(map[string]map[string]float64, len(snapshot.Models))
	for _, row := range snapshot.Models {
		if row.Official.Input <= 0 {
			continue
		}
		if uterRouteRowBillsPerSecond(row) {
			entry := map[string]float64{officialPerSecondField: row.Official.Input}
			reference[row.LocalName] = entry
			if row.LocalName != row.UpstreamName {
				reference[row.UpstreamName] = entry
			}
			continue
		}
		entry := map[string]float64{}
		if row.QuotaType == 1 || row.BillingClass == "per_call" {
			entry["model_price"] = row.Official.Input
			reference[row.LocalName] = entry
			if row.LocalName != row.UpstreamName {
				reference[row.UpstreamName] = entry
			}
			continue
		}
		entry["model_ratio"] = row.Official.Input / 2
		if row.Official.Output > 0 {
			entry["completion_ratio"] = row.Official.Output / row.Official.Input
		}
		if row.Official.Cache > 0 {
			entry["cache_ratio"] = row.Official.Cache / row.Official.Input
		}
		if row.Official.CreateCache > 0 {
			entry["create_cache_ratio"] = row.Official.CreateCache / row.Official.Input
		}
		reference[row.LocalName] = entry
		if row.LocalName != row.UpstreamName {
			reference[row.UpstreamName] = entry
		}
	}
	return reference
}

func nearlyEqualSync(a, b float64) bool {
	const epsilon = 1e-9
	if a == b {
		return true
	}
	diff := math.Abs(a - b)
	if diff < epsilon {
		return true
	}
	max := math.Max(math.Abs(a), math.Abs(b))
	return diff <= epsilon*max
}
func roundRatioValue(v float64) float64 {
	if v == 0 || math.IsNaN(v) || math.IsInf(v, 0) {
		return v
	}
	return math.Round(v*1e10) / 1e10
}
