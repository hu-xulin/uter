package model

import (
	"errors"
	"fmt"
	"sort"
	"strings"
)

// AutoFillMetadataResult reports what an automatic official-metadata fill
// changed. Every counter is a subset of the names that were considered, so a
// caller can log a single line describing the effect of a channel sync.
type AutoFillMetadataResult struct {
	// Considered is the number of channel models examined.
	Considered int `json:"considered"`
	// CreatedModels are the models that had no metadata row at all and now
	// have one, filled from the official catalog.
	CreatedModels []string `json:"created_models"`
	// UpdatedModels are the models whose empty metadata fields were filled.
	// A field is only ever written when it is currently blank, so local edits
	// and `sync_official = 0` opt-outs are never overwritten.
	UpdatedModels []string `json:"updated_models"`
	// SkippedOptOut counts models that have `sync_official = 0`.
	SkippedOptOut int `json:"skipped_opt_out"`
	// SkippedUpstream counts models the official catalog does not know.
	SkippedUpstream int `json:"skipped_upstream"`
}

// metadataFillCandidate is one model queued for an automatic metadata fill.
type metadataFillCandidate struct {
	name   string
	update MetadataSyncUpdate
}

// PlanOfficialMetadataFill decides, for the given channel model names, which
// ones can be filled from the official catalog without overwriting anything an
// administrator has already curated.
//
// It is exported separately from the apply step so the decision can be unit
// tested and reused by a preview endpoint. The rules are deliberately
// conservative:
//
//   - Models the catalog does not know are skipped (SkippedUpstream).
//   - Models with `sync_official = 0` are skipped entirely, mirroring
//     ApplyMetadataSync's guard so the opt-out keeps working for the
//     automatic path too (SkippedOptOut).
//   - Models whose name is already covered by a prefix/suffix/contains rule
//     are skipped: an explicit record would shadow the curated pattern and
//     change how every matching model is attributed.
//   - A model with no row is created with the full official field set.
//   - A model that already has a row only receives the fields that are
//     currently blank, so descriptions, icons, tags, endpoints and vendor
//     that are already set are left untouched.
//
// The returned candidates carry the record version observed while planning, so
// ApplyMetadataSync still performs its optimistic-concurrency check.
func PlanOfficialMetadataFill(
	names []string,
	locals map[string]*Model,
	vendors map[string]*Vendor,
	upstream map[string]MetadataValues,
	upstreamVendors map[string]Vendor,
) (*AutoFillMetadataResult, []MetadataSyncUpdate) {
	result := &AutoFillMetadataResult{
		Considered:      len(names),
		CreatedModels:   []string{},
		UpdatedModels:   []string{},
		SkippedOptOut:   0,
		SkippedUpstream: 0,
	}
	vendorByID := make(map[int]*Vendor, len(vendors))
	for _, vendor := range vendors {
		vendorByID[vendor.Id] = vendor
	}

	// A pattern record (prefix/suffix/contains) already governs the models it
	// matches, so filling an explicit row for a matched name would override an
	// administrator's deliberate catch-all.
	patterns := make([]*Model, 0, len(locals))
	for _, local := range locals {
		if local.NameRule != NameRuleExact {
			patterns = append(patterns, local)
		}
	}

	candidates := make([]metadataFillCandidate, 0, len(names))
	for _, name := range names {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		values, known := upstream[name]
		derived := false
		if !known {
			// The catalog has no entry for this model. Rather than leaving the
			// row permanently blank, derive what the name and the catalog's own
			// relatives assert. A name that yields nothing stays skipped.
			resolved, ok := DeriveMetadataValuesFromCatalog(name, upstream)
			if !ok {
				result.SkippedUpstream++
				continue
			}
			values, derived = resolved, true
		}
		local := locals[name]
		if local != nil && local.SyncOfficial == 0 {
			result.SkippedOptOut++
			continue
		}
		if local == nil {
			covered := false
			for _, pattern := range patterns {
				if pattern.MatchesName(name) {
					covered = true
					break
				}
			}
			if covered {
				continue
			}
		}
		var localVendor *Vendor
		if local != nil {
			localVendor = vendorByID[local.VendorID]
		}
		if derived {
			// A keyword-derived brand name has to resolve to a vendor the site
			// manages before it can be attached. When the official catalog does
			// not know the name either, the model is left for an operator
			// rather than guessed at, and the rest of the batch continues.
			if !derivedVendorResolvable(values.Vendor, vendors) {
				if _, known := upstreamVendors[values.Vendor]; !known {
					result.SkippedUpstream++
					continue
				}
			}
		}
		fields := metadataFieldsToFill(local, localVendor, values, upstreamVendors)
		create := local == nil
		if create {
			// A new row takes the whole official field set.
			fields = slicesClone(MetadataSyncFields)
			result.CreatedModels = append(result.CreatedModels, name)
		} else {
			if len(fields) == 0 {
				continue
			}
			result.UpdatedModels = append(result.UpdatedModels, name)
		}
		candidates = append(candidates, metadataFillCandidate{
			name: name,
			update: MetadataSyncUpdate{
				MetadataSyncSelection: MetadataSyncSelection{
					ModelName:     name,
					RecordVersion: MetadataRecordVersion(local, localVendor, FindMetadataVendor(vendors, values.Vendor)),
					Create:        create,
					Fields:        fields,
				},
				Values: values,
			},
		})
	}
	sort.Strings(result.CreatedModels)
	sort.Strings(result.UpdatedModels)
	updates := make([]MetadataSyncUpdate, 0, len(candidates))
	for _, candidate := range candidates {
		updates = append(updates, candidate.update)
	}
	return result, updates
}

// metadataFieldsToFill returns the metadata fields that are blank locally and
// carry a value upstream. `local == nil` means the row will be created, in
// which case the caller replaces the field list with the full set.
func metadataFieldsToFill(local *Model, localVendor *Vendor, upstream MetadataValues, upstreamVendors map[string]Vendor) []string {
	if local == nil {
		return nil
	}
	fields := make([]string, 0, len(MetadataSyncFields))
	for _, field := range MetadataSyncFields {
		switch field {
		case "description":
			if strings.TrimSpace(local.Description) == "" && strings.TrimSpace(upstream.Description) != "" {
				fields = append(fields, field)
			}
		case "icon":
			if strings.TrimSpace(local.Icon) == "" && strings.TrimSpace(upstream.Icon) != "" {
				fields = append(fields, field)
			}
		case "tags":
			if strings.TrimSpace(local.Tags) == "" && strings.TrimSpace(upstream.Tags) != "" {
				fields = append(fields, field)
			}
		case "endpoints":
			if strings.TrimSpace(local.Endpoints) == "" && strings.TrimSpace(upstream.Endpoints) != "" {
				fields = append(fields, field)
			}
		case "vendor":
			// VendorID 0 means unassigned. An existing vendor is never replaced,
			// so a merged or renamed vendor is not undone by the fill.
			if local.VendorID == 0 && strings.TrimSpace(upstream.Vendor) != "" {
				if _, known := upstreamVendors[upstream.Vendor]; known {
					fields = append(fields, field)
				}
			}
		case "name_rule":
			// NameRule is a structural key, not descriptive metadata: changing
			// it would re-attribute every model the record matches.
		case "status":
			// Visibility is an administrator's publication decision.
		}
	}
	return fields
}

func slicesClone(values []string) []string {
	result := make([]string, len(values))
	copy(result, values)
	return result
}

// derivedVendorResolvable reports whether a keyword-derived brand name can be
// attached to a model row.
//
// The name rules produce short brand names (ByteDance, Moonshot) while the
// official vendor catalog files the same companies under their product names
// ("Volcengine Ark", "Moonshot AI"). A brand the site already manages under the
// derived name is directly attachable; anything else has to go through the
// normal upstream lookup, which may not know that name at all.
func derivedVendorResolvable(name string, vendors map[string]*Vendor) bool {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return false
	}
	return FindMetadataVendor(vendors, trimmed) != nil
}

// AutoFillOfficialMetadata fills missing model metadata from the official
// catalog. It is the automatic counterpart of the manual sync wizard: no
// preview and no per-field selection, so it only ever writes blank fields and
// never touches a model whose `sync_official` is 0.
//
// A failure to reach the official catalog is reported to the caller; the
// channel sync that triggered it must still succeed.
func AutoFillOfficialMetadata(
	names []string,
	upstream map[string]MetadataValues,
	upstreamVendors map[string]Vendor,
) (*AutoFillMetadataResult, error) {
	if len(names) == 0 || len(upstream) == 0 {
		return &AutoFillMetadataResult{CreatedModels: []string{}, UpdatedModels: []string{}}, nil
	}
	locals, vendors, err := GetMetadataSyncState(DB)
	if err != nil {
		return nil, err
	}
	result, updates := PlanOfficialMetadataFill(names, locals, vendors, upstream, upstreamVendors)
	if len(updates) == 0 {
		return result, nil
	}
	if _, err := ApplyMetadataSync(updates, upstreamVendors); err != nil {
		// A concurrent admin edit invalidates the optimistic version. The fill
		// is opportunistic, so report the plan and let the next sync retry
		// rather than failing the caller's channel sync.
		if errors.Is(err, ErrMetadataSyncConflict) {
			return result, nil
		}
		return result, fmt.Errorf("fill official metadata: %w", err)
	}
	return result, nil
}
