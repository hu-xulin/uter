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

	// Channel model names frequently append irregular suffixes (dates, versions,
	// regions) to the canonical model name. Index the catalog so a channel name
	// like "gpt-4o-2024-05-13" still recovers the catalog's "gpt-4o" entry
	// instead of being treated as an unknown model.
	upstreamKeys := make([]string, 0, len(upstream))
	for name := range upstream {
		upstreamKeys = append(upstreamKeys, name)
	}
	matcher := NewModelNameMatchCatalog(upstreamKeys)

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
			// The catalog has no exact entry. Try a robust fuzzy match before
			// falling back to keyword derivation: the base model name is a
			// prefix of the channel name with a suffix.
			if matched, ok := matcher.Match(name); ok {
				values, known = upstream[matched], true
			}
		}
		if !known {
			// The catalog has no entry for this model. Rather than leaving the
			// row permanently blank, derive what the name and the catalog's own
			// relatives assert. A name that yields nothing stays skipped.
			// 派生行绝不携带供应商公司 logo 作为模型图标（见
			// deriveMetadataValuesFromKeywords 的图标策略）。
			resolved, ok := deriveMetadataValuesFromCatalog(name, upstream)
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
// EnsureModelRows 为「已在上游渠道售卖、但本地还没有元数据行」的模型补一行
// 最小元数据（只有名称与供应商归属），返回新建的模型名。
//
// 与 AutoFillOfficialMetadata 的分工：后者依赖官方目录（basellm / models.dev），
// 目录不认识的模型会被跳过，于是渠道私有命名的模型（seedance-* 等）永远没有
// 行 → 定价页拿不到 vendor_id → 按供应商筛选时整条模型不可见，用户看到的是
// 「这个模型漏了」。
//
// 三条硬约束：
//  1. 只建行，不改行：已存在的行一个字段都不动（运营手填的图标、名称、简介
//     属于运营配置数据，任何自动流程都不得回写）。
//  2. 只认「已存在的供应商名」：绝不为上游的新名字自动建供应商——供应商
//     名称与图标同样是运营配置数据。匹配不到时先按同组模型的既有归属反推
//     （见 inferUpstreamVendorIDs），仍推不出来就留空，模型仍会以首字母
//     占位正常展示。
//  3. 尊重名称规则：已被前缀/后缀/包含规则覆盖的模型不建显式行，否则会
//     遮蔽运营设置的 catch-all 规则。
func EnsureModelRows(vendorNameByModel map[string]string) ([]string, error) {
	if len(vendorNameByModel) == 0 {
		return nil, nil
	}
	locals, vendors, err := GetMetadataSyncState(DB)
	if err != nil {
		return nil, err
	}
	vendorIDByName := make(map[string]int, len(vendors))
	for name, vendor := range vendors {
		vendorIDByName[name] = vendor.Id
	}
	aliases := inferUpstreamVendorIDs(locals, vendorNameByModel, vendorIDByName)
	patterns := make([]*Model, 0, len(locals))
	for _, local := range locals {
		if local.NameRule != NameRuleExact {
			patterns = append(patterns, local)
		}
	}

	names := make([]string, 0, len(vendorNameByModel))
	for name := range vendorNameByModel {
		names = append(names, name)
	}
	sort.Strings(names)

	created := make([]string, 0)
	for _, name := range names {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		if _, exists := locals[name]; exists {
			continue
		}
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
		record := &Model{ModelName: name, Status: 1, SyncOfficial: 1}
		vendorName := strings.TrimSpace(vendorNameByModel[name])
		if vendorID, ok := vendorIDByName[vendorName]; ok {
			record.VendorID = vendorID
		} else if vendorID, ok := aliases[vendorName]; ok {
			record.VendorID = vendorID
		}
		// 单个模型失败（例如并发插入撞唯一索引）不中断整批：下一轮同步会重试。
		if err := record.Insert(); err != nil {
			continue
		}
		created = append(created, name)
	}
	return created, nil
}

// inferUpstreamVendorIDs 反推「上游供应商名 → 本地供应商 ID」。
//
// 上游与本地不是同一套写法：创梦的 vendors[] 用中文名（字节跳动 / 阿里巴巴 /
// 智谱 / 讯飞 / 快手 / 零一万物），本地 vendors 用英文名（ByteDance / Alibaba /
// Z.AI …），而运营还会合并或删除重名供应商（本地 46 条里 21 条是软删除）。
// 硬编码一张别名表既维护不过来，也会在运营改名后立刻失效。
//
// 这里用数据自身说话：同一上游供应商下，已经有本地元数据行且归属明确的模型
// 就是证据——取出现次数最多的本地供应商作为该上游供应商的归属。反推只接受
// **仍然启用**的本地供应商，绝不为上游名字新建供应商。
func inferUpstreamVendorIDs(
	locals map[string]*Model,
	vendorNameByModel map[string]string,
	vendorIDByName map[string]int,
) map[string]int {
	activeVendorIDs := make(map[int]struct{}, len(vendorIDByName))
	for _, id := range vendorIDByName {
		activeVendorIDs[id] = struct{}{}
	}
	votes := make(map[string]map[int]int)
	for modelName, upstreamVendor := range vendorNameByModel {
		upstreamVendor = strings.TrimSpace(upstreamVendor)
		if upstreamVendor == "" {
			continue
		}
		// 名字能直接命中就不用反推，避免把清晰的归属覆盖成投票结果。
		if _, ok := vendorIDByName[upstreamVendor]; ok {
			continue
		}
		local, ok := locals[modelName]
		if !ok || local.VendorID == 0 {
			continue
		}
		if _, ok := activeVendorIDs[local.VendorID]; !ok {
			continue
		}
		if votes[upstreamVendor] == nil {
			votes[upstreamVendor] = make(map[int]int)
		}
		votes[upstreamVendor][local.VendorID]++
	}

	aliases := make(map[string]int, len(votes))
	for upstreamVendor, counts := range votes {
		bestID, bestCount := 0, 0
		for id, count := range counts {
			// 票数相同取较小的 ID，保证同一份数据每次得出同一个结论。
			if count > bestCount || (count == bestCount && bestID != 0 && id < bestID) {
				bestID, bestCount = id, count
			}
		}
		if bestID != 0 {
			aliases[upstreamVendor] = bestID
		}
	}
	return aliases
}

// AutoFillOfficialMetadata 用官方目录补齐渠道模型的元数据。
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
