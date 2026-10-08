package model

import (
	"errors"
	"sort"
	"strings"

	"github.com/uter-ai/uter/common"

	"gorm.io/gorm"
)

// NormalizeIconKey 把 @lobehub/icons 的图标名统一收敛到非彩色（单色）变体。
//
// 单色变体跟随 currentColor，能自适应深浅色主题；彩色变体（"X.Color"）在深色
// 底上容易糊、且无法统一色调。平台侧提供的默认值（默认供应商图标、官方元数据
// 同步下发的图标）一律走这里，保证"默认全部非彩色"。
//
// 只剥离结尾的 .Color 段，其余链式属性（如 "Claude.Avatar.type={'platform'}"）
// 原样保留，避免破坏高级写法。
func NormalizeIconKey(icon string) string {
	trimmed := strings.TrimSpace(icon)
	if trimmed == "" {
		return ""
	}
	base, suffix, found := strings.Cut(trimmed, ".")
	if !found {
		return trimmed
	}
	if !strings.EqualFold(suffix, "Color") {
		return trimmed
	}
	return strings.TrimSpace(base)
}

// Vendor 用于存储供应商信息，供模型引用
// Name 唯一，用于在模型中关联
// Icon 采用 @lobehub/icons 的图标名，前端可直接渲染
// Status 预留字段，1 表示启用
// 本表同样遵循 3NF 设计范式

type Vendor struct {
	ModelCount  int64          `json:"model_count" gorm:"-"`
	Version     string         `json:"version,omitempty" gorm:"-"`
	Id          int            `json:"id"`
	Name        string         `json:"name" gorm:"size:128;not null;uniqueIndex:uk_vendor_name_delete_at,priority:1"`
	Description string         `json:"description,omitempty" gorm:"type:text"`
	Icon        string         `json:"icon,omitempty" gorm:"type:varchar(128)"`
	Status      int            `json:"status" gorm:"default:1"`
	CreatedTime int64          `json:"created_time" gorm:"bigint"`
	UpdatedTime int64          `json:"updated_time" gorm:"bigint"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index;uniqueIndex:uk_vendor_name_delete_at,priority:2"`
}

// Insert 创建新的供应商记录
func (v *Vendor) Insert() error {
	v.Id = 0
	err := metadataTransaction(func(tx *gorm.DB) error {
		if err := validateVendorMetadata(tx, v); err != nil {
			return err
		}
		now := common.GetTimestamp()
		v.CreatedTime, v.UpdatedTime, v.Status = now, now, 1
		return tx.Create(v).Error
	})
	if err == nil {
		v.Version = VendorRecordVersion(v)
		RefreshPricing()
	}
	return err
}

// IsVendorNameDuplicated 检查供应商名称是否重复（排除自身 ID）
func IsVendorNameDuplicated(id int, name string) (bool, error) {
	if name == "" {
		return false, nil
	}
	var cnt int64
	err := DB.Model(&Vendor{}).Where("name = ? AND id <> ?", name, id).Count(&cnt).Error
	return cnt > 0, err
}

// Update 更新供应商记录
func (v *Vendor) Update() error {
	err := metadataTransaction(func(tx *gorm.DB) error {
		var saved Vendor
		if err := tx.First(&saved, v.Id).Error; err != nil {
			return err
		}
		if v.Version != "" && v.Version != VendorRecordVersion(&saved) {
			return ErrVendorConflict
		}
		if err := validateVendorMetadata(tx, v); err != nil {
			return err
		}
		v.CreatedTime, v.Status, v.UpdatedTime = saved.CreatedTime, saved.Status, common.GetTimestamp()
		return tx.Model(&Vendor{}).Where("id = ?", v.Id).Updates(map[string]any{"name": v.Name, "description": v.Description, "icon": v.Icon, "updated_time": v.UpdatedTime}).Error
	})
	if err == nil {
		v.Version = VendorRecordVersion(v)
		RefreshPricing()
	}
	return err
}

// Delete rejects referenced vendors rather than leaving orphaned model records.
func (v *Vendor) Delete() error { return DeleteVendors([]int{v.Id}) }

// GetVendorByID 根据 ID 获取供应商
func GetVendorByID(id int) (*Vendor, error) {
	// 负 ID 对应定价广场上的合成"默认品牌"供应商，没有持久化记录，返回只读展示数据。
	if id < 0 {
		if v, ok := getDefaultBrandVendor(id); ok {
			// 该合成品牌已被合并过：直接返回合并目标，避免管理端打开一条
			// 「看起来存在、实际没有记录」的合成条目。
			if targetID := ResolveVendorMergeTarget(v.Name); targetID > 0 {
				return GetVendorByID(targetID)
			}
			// 合成品牌自身没有 models 行，但定价页会把它名下的模型归到它/同名真实记录上，
			// 这里沿用同一口径给出关联模型数。
			counts, err := GetEffectiveVendorModelCounts()
			if err != nil {
				return nil, err
			}
			v.ModelCount = counts[int64(id)]
			v.Version = VendorRecordVersion(v)
			return v, nil
		}
		return nil, gorm.ErrRecordNotFound
	}
	var v Vendor
	err := DB.First(&v, id).Error
	if err != nil {
		return nil, err
	}
	counts, err := GetEffectiveVendorModelCounts()
	if err != nil {
		return nil, err
	}
	v.ModelCount = counts[int64(id)]
	v.Version = VendorRecordVersion(&v)
	return &v, nil
}

// GetAllVendors 获取全部供应商（分页）
func GetAllVendors(offset int, limit int) ([]*Vendor, error) {
	vendors, _, err := SearchVendors("", offset, limit)
	return vendors, err
}

// SearchVendors filters persisted vendor records and counts actual model assignments.
func SearchVendors(keyword string, offset, limit int, association ...string) ([]*Vendor, int64, error) {
	return searchVendorsCore(keyword, offset, limit, false, association...)
}

// SearchVendorsIncludingDefaults behaves like SearchVendors but also surfaces the
// synthetic "default brand" vendors that the pricing plaza shows for models matched by
// name pattern without persisted metadata. This lets operators manage brands that
// otherwise appear only on the pricing page. Synthetic vendors are never persisted and
// always report zero linked models, so they are excluded from the "linked" filter and
// skipped when a real vendor with the same name already exists.
func SearchVendorsIncludingDefaults(keyword string, offset, limit int, association ...string) ([]*Vendor, int64, error) {
	return searchVendorsCore(keyword, offset, limit, true, association...)
}

func searchVendorsCore(keyword string, offset, limit int, includeDefault bool, association ...string) ([]*Vendor, int64, error) {
	db := DB.Model(&Vendor{})
	if keyword != "" {
		like := "%" + keyword + "%"
		db = db.Where("name LIKE ? OR description LIKE ?", like, like)
	}
	var vendors []*Vendor
	if err := db.Order("id DESC").Find(&vendors).Error; err != nil {
		return nil, 0, err
	}

	if includeDefault {
		realNames := make(map[string]struct{}, len(vendors))
		realByID := make(map[int]*Vendor, len(vendors))
		for _, v := range vendors {
			realNames[strings.ToLower(v.Name)] = struct{}{}
			realByID[v.Id] = v
		}
		keywordLower := strings.ToLower(keyword)
		for _, v := range defaultBrandVendors() {
			// 已被合并过的品牌有了明确归宿，不再作为可管理的独立条目出现——
			// 这正是「合并一次，后续同类自动跟进」在管理列表上的体现。
			if VendorMergeTargetFor(v.Name, realByID) > 0 {
				continue
			}
			if _, exists := realNames[strings.ToLower(v.Name)]; exists {
				continue
			}
			if keyword != "" &&
				!strings.Contains(strings.ToLower(v.Name), keywordLower) &&
				!strings.Contains(strings.ToLower(v.Description), keywordLower) {
				continue
			}
			vendors = append(vendors, v)
		}
	}

	// 关联模型数必须与定价广场的归因口径一致（models 表 + 靠名称规则归因的默认品牌），
	// 否则会出现"定价页品牌下有一堆模型、管理页显示 0"。
	counts, err := GetEffectiveVendorModelCounts()
	if err != nil {
		return nil, 0, err
	}
	// 是否已关联模型同样以该口径判断，避免合成品牌被误判为"未关联"。
	if len(association) > 0 && (association[0] == "linked" || association[0] == "unlinked") {
		filtered := vendors[:0]
		for _, v := range vendors {
			linked := counts[int64(v.Id)] > 0
			if linked == (association[0] == "linked") {
				filtered = append(filtered, v)
			}
		}
		vendors = filtered
	}
	// 按关联模型数降序默认排序（名字升序兜底），方便与管理页（同样口径的
	// 模型数）一一对应核对。ModelCount 是 gorm:"-"，无法下推到 SQL，故在内存排序。
	sort.SliceStable(vendors, func(i, j int) bool {
		if vendors[i].ModelCount != vendors[j].ModelCount {
			return vendors[i].ModelCount > vendors[j].ModelCount
		}
		return strings.ToLower(vendors[i].Name) < strings.ToLower(vendors[j].Name)
	})

	// 在内存中对合并后的完整列表分页，以保证合成供应商稳定排在持久化记录之后。
	total := int64(len(vendors))
	end := offset + limit
	if end > len(vendors) {
		end = len(vendors)
	}
	page := vendors[offset:end]
	for _, vendor := range page {
		vendor.ModelCount = counts[int64(vendor.Id)]
		vendor.Version = VendorRecordVersion(vendor)
	}
	return page, total, nil
}

// PromoteDefaultVendor 将一个定价广场上的合成"默认品牌"供应商（负 ID）提升为真实的、
// 可持久化管理的供应商记录。
//
// 为保证定价页与管理页始终指向同一条真实记录，这里按"名称"做去重与对账：
//  1. 若已存在同名（未删除）的真实供应商，则在其上应用本次提交的字段并返回；
//  2. 否则若存在同名但被软删除的供应商，则将其复活并应用字段（避免反复编辑时堆积孤儿记录）；
//  3. 否则才新建一条真实记录。
//
// 这样无论定价广场生成过多少次合成品牌，最终都收敛为唯一一条可被管理与编辑的真实供应商，
// 定价页也会随之反映用户的修改。
func PromoteDefaultVendor(name, description, icon string) (*Vendor, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("vendor name is required")
	}
	// 该品牌已被合并过：直接返回合并目标。否则「保存/提升」会重新造出一条
	// 立即被合并规则隐藏的记录，运营会看到「改完不见」。
	if targetID := ResolveVendorMergeTarget(name); targetID > 0 {
		if target, err := GetVendorByID(targetID); err == nil {
			target.Version = VendorRecordVersion(target)
			return target, nil
		}
	}
	// 1. 同名且未删除：直接在其上应用本次提交的字段（幂等，绝不新建第二条）。
	var active Vendor
	if err := DB.Where("LOWER(name) = LOWER(?)", name).First(&active).Error; err == nil {
		return applyPromotedVendorFields(&active, name, description, icon)
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	// 2. 同名但被软删除：复活该行并应用字段，避免反复编辑堆积孤儿记录。
	var deleted Vendor
	if err := DB.Unscoped().
		Where("LOWER(name) = LOWER(?) AND deleted_at IS NOT NULL", name).
		Order("id").First(&deleted).Error; err == nil {
		now := common.GetTimestamp()
		if err := DB.Unscoped().Model(&Vendor{}).Where("id = ?", deleted.Id).Updates(map[string]any{
			"name":         name,
			"description":  description,
			"icon":         icon,
			"status":       1,
			"updated_time": now,
			"deleted_at":   nil,
		}).Error; err != nil {
			return nil, err
		}
		restored := &Vendor{Id: deleted.Id, Name: name, Description: description, Icon: icon, Status: 1, CreatedTime: deleted.CreatedTime, UpdatedTime: now}
		restored.Version = VendorRecordVersion(restored)
		RefreshPricing()
		return restored, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	// 3. 真正的新品牌：新建一条真实记录。
	v := &Vendor{Name: name, Description: description, Icon: icon}
	if err := v.Insert(); err != nil {
		return nil, err
	}
	return v, nil
}

// applyPromotedVendorFields 在已存在的供应商上应用管理端提交的字段。
// 语义与真实记录的 Vendor.Update 保持一致（整字段覆盖），这样管理端清空图标/简介也能生效，
// 且"第一次保存（提升）"与"后续保存（更新）"行为不会割裂。
func applyPromotedVendorFields(v *Vendor, name, description, icon string) (*Vendor, error) {
	now := common.GetTimestamp()
	if err := DB.Model(&Vendor{}).Where("id = ?", v.Id).Updates(map[string]any{
		"name":         name,
		"description":  description,
		"icon":         icon,
		"status":       v.Status,
		"updated_time": now,
	}).Error; err != nil {
		return nil, err
	}
	v.Name, v.Description, v.Icon, v.UpdatedTime = name, description, icon, now
	v.Version = VendorRecordVersion(v)
	RefreshPricing()
	return v, nil
}
