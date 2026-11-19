package controller

import (
	"context"
	"sync"
	"time"

	"github.com/uter-ai/uter/model"
)

// officialDataFillLocale is the language used for automatically fetched
// official metadata. Channel synchronization runs unattended, so it uses a
// single fixed locale rather than a user-selected one: an admin-triggered sync
// in one language would otherwise leave the catalog descriptions in that
// language for every channel.
const officialDataFillLocale = "en"

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
