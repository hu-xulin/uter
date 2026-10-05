package model

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/Uter-AI/Uter/common"

	"gorm.io/gorm"
)

var ErrVendorConflict = errors.New("vendor data changed; preview again before applying")

// ErrVendorDefaultBrandNotDeletable 表示试图删除定价广场上合成的"默认品牌"供应商。
// 这类供应商没有持久化记录，只能通过合并进真实供应商来让其消失。
var ErrVendorDefaultBrandNotDeletable = errors.New("default brands from the pricing plaza have no vendor record to delete; merge them into an existing vendor instead")

// VendorReferenceError reports every referenced vendor in a rejected delete.
type VendorReferenceError struct {
	Counts map[int]int64 `json:"reference_counts"`
}

func (e *VendorReferenceError) Error() string {
	return "vendors are still referenced by models; transfer or clear their assignments first"
}

func FindMetadataVendor(vendors map[string]*Vendor, name string) *Vendor {
	for _, vendor := range vendors {
		if strings.EqualFold(strings.TrimSpace(vendor.Name), strings.TrimSpace(name)) {
			return vendor
		}
	}
	return nil
}

func validateModelVendor(tx *gorm.DB, id int) error {
	if id == 0 {
		return nil
	}
	if id < 0 {
		return errors.New("select a saved vendor")
	}
	var count int64
	if err := tx.Model(&Vendor{}).Where("id = ?", id).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return errors.New("vendor does not exist")
	}
	return nil
}

func validateVendorMetadata(tx *gorm.DB, vendor *Vendor) error {
	vendor.Name = strings.TrimSpace(vendor.Name)
	vendor.Icon = strings.TrimSpace(vendor.Icon)
	if vendor.Name == "" {
		return errors.New("vendor name is required")
	}
	if utf8.RuneCountInString(vendor.Name) > 128 || utf8.RuneCountInString(vendor.Icon) > 128 {
		return errors.New("vendor name and icon must not exceed 128 characters")
	}
	var others []Vendor
	if err := tx.Select("id", "name").Where("id <> ?", vendor.Id).Find(&others).Error; err != nil {
		return err
	}
	for _, other := range others {
		if strings.EqualFold(strings.TrimSpace(other.Name), vendor.Name) {
			return errors.New("vendor name already exists")
		}
	}
	return nil
}

func VendorRecordVersion(v *Vendor) string {
	encoded, _ := common.Marshal([]any{v.Id, v.Name, v.Description, v.Icon, v.Status, v.CreatedTime, v.UpdatedTime})
	return fmt.Sprintf("%x", sha256.Sum256(encoded))
}

// VendorOperation uses explicit selections for both preview and application.
type VendorOperation struct {
	Action          string `json:"action"`
	VendorIDs       []int  `json:"vendor_ids"`
	ModelIDs        []int  `json:"model_ids"`
	TargetVendorID  int    `json:"target_vendor_id"`
	ExpectedVersion string `json:"expected_version,omitempty"`
}

type VendorAssignmentModel struct {
	ID          int    `json:"id"`
	ModelName   string `json:"model_name"`
	NameRule    int    `json:"name_rule"`
	VendorID    int    `json:"vendor_id"`
	VendorName  string `json:"vendor_name"`
	UpdatedTime int64  `json:"updated_time"`
}

type VendorOperationPreview struct {
	Action  string                  `json:"action"`
	Sources []Vendor                `json:"sources"`
	Target  *Vendor                 `json:"target"`
	Models  []VendorAssignmentModel `json:"models"`
	Version string                  `json:"version"`
}

type VendorOperationResult struct {
	UpdatedModels  []int `json:"updated_models"`
	DeletedVendors []int `json:"deleted_vendors"`
}

func buildVendorOperationPreview(db *gorm.DB, operation VendorOperation) (*VendorOperationPreview, error) {
	if operation.Action != "assign" && operation.Action != "merge" && operation.Action != "delete" {
		return nil, errors.New("unsupported vendor operation")
	}
	ids := append([]int{}, operation.VendorIDs...)
	if operation.Action == "assign" {
		ids = append([]int{}, operation.ModelIDs...)
	}
	if len(ids) == 0 || len(ids) > 1000 {
		return nil, errors.New("select between 1 and 1000 records")
	}
	slices.Sort(ids)
	for i, id := range ids {
		// 0 表示"未选择供应商"，无效；同一来源重复选择同样无效。
		// 负 ID 是定价广场的合成"默认品牌"，允许作为合并来源（下面单独处理）。
		if id == 0 || i > 0 && ids[i-1] == id {
			return nil, errors.New("invalid or duplicate selection")
		}
	}
	preview := &VendorOperationPreview{Action: operation.Action, Sources: []Vendor{}, Models: []VendorAssignmentModel{}}
	var vendors []Vendor
	if err := db.Session(&gorm.Session{}).Order("id").Find(&vendors).Error; err != nil {
		return nil, err
	}
	byID := make(map[int]*Vendor, len(vendors))
	for i := range vendors {
		byID[vendors[i].Id] = &vendors[i]
	}
	// 解析所有负 ID 的合成默认品牌（管理列表里已被并入，但无持久化行）。
	syntheticBrands := make(map[int]*Vendor)
	for _, id := range ids {
		if id < 0 {
			if brand, ok := getDefaultBrandVendor(id); ok {
				syntheticBrands[id] = brand
			}
		}
	}
	// 合成"默认品牌"没有持久化行可删除，删除它只会静默空操作。它只能被
	// 合并到某个真实供应商（其名下模型会随之迁移），或先保存为真实记录后再管理。
	if operation.Action == "delete" && len(syntheticBrands) > 0 {
		return nil, ErrVendorDefaultBrandNotDeletable
	}
	if operation.Action != "delete" {
		if operation.TargetVendorID < 0 || operation.Action == "merge" && operation.TargetVendorID == 0 {
			return nil, errors.New("select a saved target vendor")
		}
		if operation.TargetVendorID != 0 {
			preview.Target = byID[operation.TargetVendorID]
			if preview.Target == nil {
				return nil, fmt.Errorf("%w: target vendor does not exist", ErrVendorConflict)
			}
		}
	}
	var models []Model
	query := db.Session(&gorm.Session{}).Model(&Model{}).Order("id")
	if operation.Action == "assign" {
		query = query.Where("id IN ?", ids)
	} else {
		for _, id := range ids {
			if id < 0 {
				brand, ok := syntheticBrands[id]
				if !ok {
					return nil, fmt.Errorf("%w: source vendor does not exist", ErrVendorConflict)
				}
				preview.Sources = append(preview.Sources, *brand)
				continue
			}
			vendor := byID[id]
			if vendor == nil {
				return nil, fmt.Errorf("%w: source vendor does not exist", ErrVendorConflict)
			}
			if operation.Action == "merge" && id == operation.TargetVendorID {
				return nil, errors.New("target vendor cannot also be a source")
			}
			preview.Sources = append(preview.Sources, *vendor)
		}
		query = query.Where("vendor_id IN ?", ids)
	}
	if err := query.Find(&models).Error; err != nil {
		return nil, err
	}
	// 合并合成默认品牌时，把其名下（按模型名规则匹配、且尚未归属供应商）的模型一并计入，
	// 以便预览与应用时把它们迁移到目标供应商，从而让该合成品牌自然消失。
	if operation.Action == "merge" {
		for id, brand := range syntheticBrands {
			patterns := defaultBrandPatterns(brand.Name)
			if len(patterns) == 0 {
				continue
			}
			conds := make([]string, 0, len(patterns))
			args := make([]any, 0, len(patterns))
			for _, p := range patterns {
				conds = append(conds, "LOWER(model_name) LIKE ?")
				args = append(args, "%"+strings.ToLower(p)+"%")
			}
			var brandModels []Model
			if err := db.Session(&gorm.Session{}).Model(&Model{}).
				Where("vendor_id = 0 AND ("+strings.Join(conds, " OR ")+")", args...).
				Find(&brandModels).Error; err != nil {
				return nil, err
			}
			for i := range brandModels {
				brandModels[i].VendorID = id // 归因到该合成来源，供预览展示与应用迁移
				models = append(models, brandModels[i])
			}
		}
	}
	if operation.Action == "assign" && len(models) != len(ids) {
		return nil, fmt.Errorf("%w: a selected model no longer exists", ErrVendorConflict)
	}
	seen := make(map[int]bool)
	modelVersions := make([]string, 0, len(models))
	counts := make(map[int]int64)
	for _, item := range models {
		modelVersions = append(modelVersions, MetadataRecordVersion(&item, nil, nil))
		row := VendorAssignmentModel{ID: item.Id, ModelName: item.ModelName, NameRule: item.NameRule, VendorID: item.VendorID, UpdatedTime: item.UpdatedTime}
		if vendor, ok := byID[item.VendorID]; ok {
			row.VendorName = vendor.Name
		} else if brand, ok := syntheticBrands[item.VendorID]; ok {
			row.VendorName = brand.Name
		}
		if operation.Action == "assign" {
			if vendor, ok := byID[item.VendorID]; ok && !seen[vendor.Id] {
				preview.Sources = append(preview.Sources, *vendor)
				seen[vendor.Id] = true
			}
		}
		preview.Models = append(preview.Models, row)
		counts[item.VendorID]++
	}
	if operation.Action == "delete" && len(models) > 0 {
		return nil, &VendorReferenceError{Counts: counts}
	}
	slices.SortFunc(preview.Sources, func(a, b Vendor) int { return a.Id - b.Id })
	encoded, err := common.Marshal([]any{preview, modelVersions})
	if err != nil {
		return nil, err
	}
	preview.Version = fmt.Sprintf("%x", sha256.Sum256(encoded))
	return preview, nil
}

func PreviewVendorOperation(operation VendorOperation) (*VendorOperationPreview, error) {
	return buildVendorOperationPreview(DB, operation)
}

func ApplyVendorOperation(operation VendorOperation) (*VendorOperationResult, error) {
	if operation.ExpectedVersion == "" {
		return nil, ErrVendorConflict
	}
	return applyVendorOperation(operation)
}

func DeleteVendors(ids []int) error {
	_, err := applyVendorOperation(VendorOperation{Action: "delete", VendorIDs: ids})
	return err
}

func applyVendorOperation(operation VendorOperation) (*VendorOperationResult, error) {
	result := &VendorOperationResult{UpdatedModels: []int{}, DeletedVendors: []int{}}
	err := metadataTransaction(func(tx *gorm.DB) error {
		preview, err := buildVendorOperationPreview(lockForUpdate(tx), operation)
		if err != nil {
			return err
		}
		if operation.ExpectedVersion != "" && operation.ExpectedVersion != preview.Version {
			return ErrVendorConflict
		}
		for _, item := range preview.Models {
			if item.VendorID != operation.TargetVendorID {
				result.UpdatedModels = append(result.UpdatedModels, item.ID)
			}
		}
		if len(result.UpdatedModels) > 0 {
			if err := tx.Model(&Model{}).Where("id IN ?", result.UpdatedModels).Updates(map[string]any{"vendor_id": operation.TargetVendorID, "updated_time": common.GetTimestamp()}).Error; err != nil {
				return err
			}
		}
		if operation.Action == "merge" || operation.Action == "delete" {
			realDeleted := make([]int, 0)
			for _, vendor := range preview.Sources {
				if vendor.Id > 0 {
					realDeleted = append(realDeleted, vendor.Id)
				}
			}
			// 合并合成默认品牌：它没有持久化行，但其模型已被迁移到目标供应商；
			// 这里再清掉任何仍挂着该品牌名（且不是目标本身）的真实供应商记录，
			// 使该合成品牌在管理页与定价页都不再出现。
			if operation.Action == "merge" {
				for _, vendor := range preview.Sources {
					if vendor.Id < 0 {
						if err := tx.Where("name = ? AND id <> ?", vendor.Name, operation.TargetVendorID).
							Delete(&Vendor{}).Error; err != nil {
							return err
						}
					}
				}
			}
			if len(realDeleted) > 0 {
				if err := tx.Where("id IN ?", realDeleted).Delete(&Vendor{}).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	RefreshPricing()
	return result, nil
}
