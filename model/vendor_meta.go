package model

import (
	"errors"
	"strings"

	"github.com/Uter-AI/Uter/common"

	"gorm.io/gorm"
)

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
			v.ModelCount = 0
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
	if err := DB.Model(&Model{}).Where("vendor_id = ?", id).Count(&v.ModelCount).Error; err != nil {
		return nil, err
	}
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
	if len(association) > 0 {
		references := DB.Model(&Model{}).Select("1").Where("models.vendor_id = vendors.id")
		switch association[0] {
		case "linked":
			db = db.Where("EXISTS (?)", references)
		case "unlinked":
			db = db.Where("NOT EXISTS (?)", references)
		}
	}
	var vendors []*Vendor
	if err := db.Order("id DESC").Find(&vendors).Error; err != nil {
		return nil, 0, err
	}

	if includeDefault && (len(association) == 0 || association[0] != "linked") {
		realNames := make(map[string]struct{}, len(vendors))
		for _, v := range vendors {
			realNames[strings.ToLower(v.Name)] = struct{}{}
		}
		keywordLower := strings.ToLower(keyword)
		for _, v := range defaultBrandVendors() {
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

	counts, err := GetVendorModelCounts()
	if err != nil {
		return nil, 0, err
	}
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
// 可持久化管理的供应商记录。若同名下已存在真实供应商，则直接返回该记录以避免重复创建。
func PromoteDefaultVendor(name, description, icon string) (*Vendor, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("vendor name is required")
	}
	var existing Vendor
	if err := DB.Where("LOWER(name) = LOWER(?)", name).First(&existing).Error; err == nil {
		return &existing, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	v := &Vendor{Name: name, Description: description, Icon: icon}
	if err := v.Insert(); err != nil {
		return nil, err
	}
	return v, nil
}
