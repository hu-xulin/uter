package controller

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"sync"
	"time"

	"github.com/Uter-AI/Uter/common"
	"github.com/Uter-AI/Uter/model"

	"github.com/gin-gonic/gin"
)

// officialDataFillLocale is the language used for automatically fetched
// official metadata. Channel synchronization runs unattended, so it uses a
// single fixed locale rather than a user-selected one: an admin-triggered sync
// in one language would otherwise leave the catalog descriptions in that
// language for every channel.
const officialDataFillLocale = "en"

// officialDataFillLimit caps how many models one fill pass considers. A single
// sync can introduce hundreds of new names, and the fill is opportunistic: the
// next scheduled pass picks up whatever the cap left behind, so bounding the
// work keeps one channel from monopolizing the sync.
const officialDataFillLimit = 500

// AutoFillSummary is the operator-visible outcome of one automatic fill pass.
type AutoFillSummary struct {
	Metadata *model.AutoFillMetadataResult `json:"metadata"`
	Pricing  *model.AutoFillPricingResult  `json:"pricing"`
}

// autoFillOfficialData fills in whatever the official catalog and the official
// price preset can supply for the given model names: metadata for models that
// have none (or only blank fields), and the official reference price for models
// that have no price saved at all.
//
// It is called after a channel synchronization changes the served model list,
// which is the moment new names start showing up as unset in the admin table
// and as unpriced on the pricing page.
//
// Every step is fail-soft. The channel sync that triggered this has already
// persisted its own changes, so an unreachable catalog, an unparsable payload
// or a rejected price must never turn a successful sync into a failed request;
// each failure is logged and the pass returns what it managed to do. The fill
// only ever writes blank fields and never prices a model that is already
// priced, so re-running it is safe and converges.
func autoFillOfficialData(ctx context.Context, modelNames []string) AutoFillSummary {
	summary := AutoFillSummary{}
	names := limitModelNames(modelNames, officialDataFillLimit)
	if len(names) == 0 {
		summary.Metadata = &model.AutoFillMetadataResult{CreatedModels: []string{}, UpdatedModels: []string{}}
		summary.Pricing = &model.AutoFillPricingResult{FilledModels: []string{}}
		return summary
	}

	if result, err := autoFillOfficialMetadata(ctx, names); err != nil {
		common.SysLog(fmt.Sprintf("auto fill official metadata failed: %v", err))
	} else if result != nil {
		summary.Metadata = result
	}

	if result, err := autoFillOfficialPricing(ctx, names); err != nil {
		common.SysLog(fmt.Sprintf("auto fill official pricing failed: %v", err))
	} else if result != nil {
		summary.Pricing = result
	}

	if summary.Metadata != nil || summary.Pricing != nil {
		metadata, pricing := summary.Metadata, summary.Pricing
		common.SysLog(fmt.Sprintf(
			"official data auto fill: metadata created=%d updated=%d (opt-out=%d unknown=%d), pricing filled=%d (already priced=%d opt-out=%d unknown=%d)",
			metadataCreated(metadata), metadataUpdated(metadata),
			metadataOptOut(metadata), metadataUnknown(metadata),
			pricingFilled(pricing), pricingPriced(pricing),
			pricingOptOut(pricing), pricingUnknown(pricing),
		))
	}
	return summary
}

// The accessors below tolerate a nil result so the log line needs no guards
// when one half of the fill could not run.
func metadataCreated(r *model.AutoFillMetadataResult) int {
	if r == nil {
		return 0
	}
	return len(r.CreatedModels)
}

func metadataUpdated(r *model.AutoFillMetadataResult) int {
	if r == nil {
		return 0
	}
	return len(r.UpdatedModels)
}

func metadataOptOut(r *model.AutoFillMetadataResult) int {
	if r == nil {
		return 0
	}
	return r.SkippedOptOut
}

func metadataUnknown(r *model.AutoFillMetadataResult) int {
	if r == nil {
		return 0
	}
	return r.SkippedUpstream
}

func pricingFilled(r *model.AutoFillPricingResult) int {
	if r == nil {
		return 0
	}
	return len(r.FilledModels)
}

func pricingPriced(r *model.AutoFillPricingResult) int {
	if r == nil {
		return 0
	}
	return r.SkippedPriced
}

func pricingOptOut(r *model.AutoFillPricingResult) int {
	if r == nil {
		return 0
	}
	return r.SkippedOptOut
}

func pricingUnknown(r *model.AutoFillPricingResult) int {
	if r == nil {
		return 0
	}
	return r.SkippedUpstream
}

// autoFillOfficialMetadata fetches the official catalog once and fills every
// missing metadata row for the given names.
//
// The unattended fill can run once per channel in a scheduled batch, so the
// catalog is memoized briefly: it changes on the order of days, and re-fetching
// a multi-megabyte payload per channel would make each batch far slower without
// filling anything new. The interactive sync wizard keeps its own always-fresh
// path and is unaffected.
func autoFillOfficialMetadata(ctx context.Context, names []string) (*model.AutoFillMetadataResult, error) {
	catalog, vendors, err := officialCatalogForFill(ctx)
	if err != nil {
		return nil, err
	}
	if len(catalog) == 0 {
		return nil, nil
	}
	return model.AutoFillOfficialMetadata(names, catalog, vendors)
}

type officialCatalogCacheEntry struct {
	catalog   map[string]model.MetadataValues
	vendors   map[string]model.Vendor
	fetchedAt time.Time
}

var (
	officialCatalogMu       sync.Mutex
	officialCatalogCache    *officialCatalogCacheEntry
	officialCatalogCacheTTL = 30 * time.Minute
)

func officialCatalogForFill(ctx context.Context) (map[string]model.MetadataValues, map[string]model.Vendor, error) {
	officialCatalogMu.Lock()
	if entry := officialCatalogCache; entry != nil && time.Since(entry.fetchedAt) < officialCatalogCacheTTL {
		officialCatalogMu.Unlock()
		return entry.catalog, entry.vendors, nil
	}
	officialCatalogMu.Unlock()

	_, catalog, vendors, err := fetchMetadataCatalogContext(ctx, officialDataFillLocale)
	if err != nil {
		// Do not cache failures: the next channel should retry rather than
		// inherit this outage for the whole TTL.
		return nil, nil, err
	}

	officialCatalogMu.Lock()
	officialCatalogCache = &officialCatalogCacheEntry{catalog: catalog, vendors: vendors, fetchedAt: time.Now()}
	officialCatalogMu.Unlock()
	return catalog, vendors, nil
}

// autoFillOfficialPricing fills reference prices from the configured official
// preset, falling back to the other preset for models the first one does not
// price. This mirrors the pricing page's own gap filling so a model that shows
// an official price there also gets it persisted here.
//
// GetPresetModelRatios hands out a private copy of the cached preset, so filling
// the gaps below cannot corrupt the shared cache that also serves the plaza and
// the admin preset editor.
func autoFillOfficialPricing(ctx context.Context, names []string) (*model.AutoFillPricingResult, error) {
	primary, fallback := officialPricingPresetIDs()
	prices := GetPresetModelRatios(primary)
	for name, ratios := range GetPresetModelRatios(fallback) {
		if _, ok := prices[name]; !ok {
			prices[name] = ratios
		}
	}
	if len(prices) == 0 {
		return nil, nil
	}
	return model.AutoFillOfficialPricing(names, prices)
}

// officialPricingPresetIDs returns the configured official preset and the
// fallback preset used for models the primary one does not price.
func officialPricingPresetIDs() (primary int, fallback int) {
	if common.OptionMap["PricingSource"] == "models.dev" {
		return modelsDevPresetID, officialRatioPresetID
	}
	return officialRatioPresetID, modelsDevPresetID
}

// AutoFillChannelOfficialData fills official metadata and prices for every
// model the site's enabled channels currently serve, without waiting for the
// model list to change. It backs the "fill missing data" action an operator
// runs after importing channels, and is safe to repeat.
//
// POST /api/models/sync_upstream/auto_fill
func AutoFillChannelOfficialData(c *gin.Context) {
	names := model.GetEnabledModels()
	if len(names) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "No enabled models to fill"})
		return
	}
	summary := autoFillOfficialData(c.Request.Context(), names)
	common.ApiSuccess(c, summary)
}

func limitModelNames(names []string, limit int) []string {
	cleaned := make([]string, 0, len(names))
	seen := make(map[string]bool, len(names))
	for _, name := range names {
		if name == "" || seen[name] {
			continue
		}
		seen[name] = true
		cleaned = append(cleaned, name)
	}
	sort.Strings(cleaned)
	if limit > 0 && len(cleaned) > limit {
		cleaned = cleaned[:limit]
	}
	return cleaned
}
