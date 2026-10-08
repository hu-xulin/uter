package model

import (
	"errors"
	"strings"
	"sync"

	"github.com/uter-ai/uter/common"

	"gorm.io/gorm"
)

// VendorMergeRule 持久化一次「合并供应商」的决策，使后续同名或同一族的供应商
// 自动归集到当时的目标供应商，管理员无需重复手工合并。
//
// 之所以需要显式存储，是因为「合成默认品牌」并不是一条数据库记录：定价广场按
// 模型名规则实时生成它们，合并操作只是把现有模型迁走。若不记住这次决策，后续
// 任何命中同一规则的新模型都会再次生成同一个合成品牌，管理员就得一而再地重合并。
//
// SourceKey 存放归一化后的名称（去空白 + 小写），用于跨数据库做确定性的精确查表；
// SourcePatterns 记录合并当时该来源对应的模型名匹配规则，供「同族」兜底识别。
type VendorMergeRule struct {
	Id             int            `json:"id"`
	SourceName     string         `json:"source_name" gorm:"size:128;not null"`
	SourceKey      string         `json:"-" gorm:"size:128;not null;uniqueIndex:uk_vmrule_source_delete_at,priority:1"`
	SourcePatterns string         `json:"source_patterns" gorm:"type:text"`
	TargetVendorID int            `json:"target_vendor_id" gorm:"not null"`
	CreatedTime    int64          `json:"created_time"`
	UpdatedTime    int64          `json:"updated_time"`
	DeletedAt      gorm.DeletedAt `json:"-" gorm:"index;uniqueIndex:uk_vmrule_source_delete_at,priority:2"`
}

// VendorMergeKey 归一化供应商名称，作为规则查表的键。
// 全平台的供应商名称校验是大小写不敏感的，这里必须同步，否则「OpenAI」与
// 「openai」会落成两条互不相干的规则。
func VendorMergeKey(name string) string {
	return strings.ToLower(strings.TrimSpace(name))
}

// EncodeVendorMergePatterns 把模型名匹配规则序列化进单列存储。
// 规则本身只含小写字母/数字与少量符号，用逗号分隔足以安全还原。
func EncodeVendorMergePatterns(patterns []string) string {
	if len(patterns) == 0 {
		return ""
	}
	return strings.Join(patterns, ",")
}

func decodeVendorMergePatterns(encoded string) []string {
	if strings.TrimSpace(encoded) == "" {
		return nil
	}
	parts := strings.Split(encoded, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

// RecordVendorMergeRule 记录（或更新）一条「来源 -> 目标」的合并决策。
//
// 幂等：同一来源重复合并到同一目标只会更新，不会堆积规则行。这与
// PromoteDefaultVendor 的去重策略一致，避免反复操作产出孤儿记录。
// 目标供应商必须真实存在，否则规则会把模型指到一条不存在的记录上。
//
// 注意：本函数运行在调用方的事务内，因此**不会**自行失效规则索引缓存。
// 索引没有 TTL，如果在事务提交前就把缓存清掉，一个并发的定价刷新会在事务
// 尚未提交时用「看不到规则」的快照重新填充缓存，该快照将永久生效——合并掉的
// 品牌会在之后每次定价刷新时复活，正是本规则要消除的行为。提交后由调用方
// 调用 InvalidateVendorMergeCache 完成失效，使提交成为最后一步。
func RecordVendorMergeRule(tx *gorm.DB, sourceName string, sourcePatterns []string, targetVendorID int) error {
	sourceName = strings.TrimSpace(sourceName)
	if sourceName == "" || targetVendorID <= 0 {
		return nil
	}
	// 目标本身不能被规则吞掉：把规则压到已不存在的目标上会让模型静默失去归属。
	var exists int64
	if err := tx.Model(&Vendor{}).Where("id = ?", targetVendorID).Count(&exists).Error; err != nil {
		return err
	}
	if exists == 0 {
		return nil
	}
	key := VendorMergeKey(sourceName)
	if key == VendorMergeKey(targetVendorName(tx, targetVendorID)) {
		// 目标是自己：无需规则
		return nil
	}
	patterns := EncodeVendorMergePatterns(sourcePatterns)

	var active VendorMergeRule
	if err := tx.Where("source_key = ?", key).First(&active).Error; err == nil {
		return updateVendorMergeRule(tx, &active, sourceName, patterns, targetVendorID)
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	// 软删除的旧规则：复活后复用同一行，避免同名人反复合并堆积孤儿规则。
	var removed VendorMergeRule
	if err := tx.Unscoped().
		Where("source_key = ? AND deleted_at IS NOT NULL", key).
		Order("id").First(&removed).Error; err == nil {
		now := common.GetTimestamp()
		return tx.Unscoped().Model(&VendorMergeRule{}).Where("id = ?", removed.Id).Updates(map[string]any{
			"source_name":      sourceName,
			"source_patterns":  patterns,
			"target_vendor_id": targetVendorID,
			"updated_time":     now,
			"deleted_at":       nil,
		}).Error
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	now := common.GetTimestamp()
	return tx.Create(&VendorMergeRule{
		SourceName:     sourceName,
		SourceKey:      key,
		SourcePatterns: patterns,
		TargetVendorID: targetVendorID,
		CreatedTime:    now,
		UpdatedTime:    now,
	}).Error
}

func updateVendorMergeRule(tx *gorm.DB, rule *VendorMergeRule, sourceName, patterns string, targetVendorID int) error {
	if rule.SourceName == sourceName && rule.SourcePatterns == patterns && rule.TargetVendorID == targetVendorID {
		return nil
	}
	now := common.GetTimestamp()
	return tx.Model(&VendorMergeRule{}).Where("id = ?", rule.Id).Updates(map[string]any{
		"source_name":      sourceName,
		"source_patterns":  patterns,
		"target_vendor_id": targetVendorID,
		"updated_time":     now,
	}).Error
}

// targetVendorName 返回供应商名称，用于判断「来源就是目标」这类无效规则。
func targetVendorName(tx *gorm.DB, id int) string {
	var vendor Vendor
	if err := tx.Select("name").Where("id = ?", id).First(&vendor).Error; err != nil {
		return ""
	}
	return vendor.Name
}

// 规则索引在进程内缓存：它被定价刷新热路径逐模型调用，而规则本身极少变更
// （只有合并与撤销触发），由 InvalidateVendorMergeCache 显式失效。
var (
	vendorMergeIndexMu   sync.RWMutex
	vendorMergeIndexData *vendorMergeIndex
)

type vendorMergePatternRule struct {
	patterns []string
	targetID int
}

type vendorMergeIndex struct {
	byKey    map[string]int
	patterns []vendorMergePatternRule
}

// InvalidateVendorMergeCache 让下一次读取重新加载规则索引。
//
// 任何写入/删除规则的路径都必须在**事务提交之后**调用，否则并发读取可能在提交
// 之前用旧快照重新填充缓存，而索引没有 TTL 可供自愈。被合并掉的品牌会在之后
// 每次定价刷新时复活。
func InvalidateVendorMergeCache() {
	vendorMergeIndexMu.Lock()
	vendorMergeIndexData = nil
	vendorMergeIndexMu.Unlock()
}

func loadVendorMergeIndex() *vendorMergeIndex {
	vendorMergeIndexMu.RLock()
	current := vendorMergeIndexData
	vendorMergeIndexMu.RUnlock()
	if current != nil {
		return current
	}
	vendorMergeIndexMu.Lock()
	defer vendorMergeIndexMu.Unlock()
	if vendorMergeIndexData != nil {
		return vendorMergeIndexData
	}
	loaded := &vendorMergeIndex{byKey: make(map[string]int)}
	if DB != nil {
		var rules []VendorMergeRule
		if err := DB.Select("source_key", "source_patterns", "target_vendor_id").Find(&rules).Error; err == nil {
			for _, rule := range rules {
				if rule.TargetVendorID <= 0 {
					continue
				}
				loaded.byKey[rule.SourceKey] = rule.TargetVendorID
				if decoded := decodeVendorMergePatterns(rule.SourcePatterns); len(decoded) > 0 {
					loaded.patterns = append(loaded.patterns, vendorMergePatternRule{patterns: decoded, targetID: rule.TargetVendorID})
				}
			}
		}
	}
	vendorMergeIndexData = loaded
	return loaded
}

// ResolveVendorMergeTarget 返回该供应商名称应当重定向到的目标供应商 ID，0 表示无规则。
//
// 判定分两级：
//  1. 名称精确匹配（归一化后）——最直接、可预测，覆盖「合并后又重新出现」的来源；
//  2. 模型名规则兜底——当该名称本身是一个按规则生成的合成品牌时，若它的某条匹配
//     规则已被合并过，则视为同一族（同厂不同写法），一并归到同一目标。
//
// 命中后仍会校验目标是否真实存在；目标若已被删除，规则视为失效并返回 0，
// 宁可让来源重新出现，也不能把模型指到空引用上。
func ResolveVendorMergeTarget(name string) int {
	index := loadVendorMergeIndex()
	if targetID, ok := index.byKey[VendorMergeKey(name)]; ok {
		if vendorExists(targetID) {
			return targetID
		}
		return 0
	}
	patterns := defaultBrandPatterns(name)
	if len(patterns) == 0 {
		return 0
	}
	for _, rule := range index.patterns {
		if !vendorExists(rule.targetID) {
			continue
		}
		if patternsOverlap(patterns, rule.patterns) {
			return rule.targetID
		}
	}
	return 0
}

// VendorMergeTargetFor 与 ResolveVendorMergeTarget 同语义，但只用调用方已加载的
// 供应商集合校验目标是否存在，不产生任何数据库查询。
//
// 这是定价刷新热路径必需的形态：它对每个未匹配元数据的模型都会调用一次，
// 逐模型连库会让刷新退化成一车 round-trip。调用方持有的 vendorMap 已包含全部
// 真实供应商，因此这里足以判断目标是否还在。
func VendorMergeTargetFor(name string, vendors map[int]*Vendor) int {
	if len(vendors) == 0 {
		return 0
	}
	index := loadVendorMergeIndex()
	if targetID, ok := index.byKey[VendorMergeKey(name)]; ok {
		if vendors[targetID] != nil {
			return targetID
		}
		return 0
	}
	patterns := defaultBrandPatterns(name)
	if len(patterns) == 0 {
		return 0
	}
	for _, rule := range index.patterns {
		if vendors[rule.targetID] == nil {
			continue
		}
		if patternsOverlap(patterns, rule.patterns) {
			return rule.targetID
		}
	}
	return 0
}

func vendorExists(id int) bool {
	if id <= 0 {
		return false
	}
	var count int64
	if err := DB.Model(&Vendor{}).Where("id = ?", id).Count(&count).Error; err != nil {
		return false
	}
	return count > 0
}

func patternsOverlap(left, right []string) bool {
	for _, pattern := range left {
		for _, other := range right {
			if strings.EqualFold(pattern, other) {
				return true
			}
		}
	}
	return false
}

// resolveMergedVendor 在给定事务/会话内把「已被合并过的供应商名称」解析为其合并目标。
//
// 供写入路径（上游元数据同步等）复用：这些地方手上有事务连接，应当读同一份数据，
// 而不是另开非事务查询，否则会读到尚未提交的快照。
func resolveMergedVendor(tx *gorm.DB, name string) (*Vendor, bool) {
	targetID := ResolveVendorMergeTarget(name)
	if targetID <= 0 {
		return nil, false
	}
	var target Vendor
	if err := tx.Where("id = ?", targetID).First(&target).Error; err != nil {
		return nil, false
	}
	merged := target
	return &merged, true
}

// ListVendorMergeRules 返回全部生效中的合并规则，按创建顺序排列，供管理展示与审计。
func ListVendorMergeRules() ([]*VendorMergeRule, error) {
	var rules []*VendorMergeRule
	if err := DB.Order("id").Find(&rules).Error; err != nil {
		return nil, err
	}
	return rules, nil
}

// DeleteVendorMergeRule 撤销一条合并规则，使该来源恢复为独立供应商。
func DeleteVendorMergeRule(id int) error {
	if id <= 0 {
		return errors.New("invalid vendor merge rule")
	}
	if err := DB.Where("id = ?", id).Delete(&VendorMergeRule{}).Error; err != nil {
		return err
	}
	InvalidateVendorMergeCache()
	RefreshPricing()
	return nil
}
