package controller

import (
	"errors"
	"github.com/uter-ai/uter/i18n"
	"net/http"
	"strconv"
	"strings"

	"github.com/uter-ai/uter/common"

	"github.com/uter-ai/uter/model"

	"github.com/gin-gonic/gin"
)

// GetAllVendors uses the same paged filters and counts as the search endpoint.
func GetAllVendors(c *gin.Context) { SearchVendors(c) }

func SearchVendors(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	keyword := c.Query("keyword")
	association := c.Query("association")
	var (
		vendors []*model.Vendor
		total   int64
		err     error
	)
	if c.Query("include_default") == "true" {
		vendors, total, err = model.SearchVendorsIncludingDefaults(keyword, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), association)
	} else {
		vendors, total, err = model.SearchVendors(keyword, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), association)
	}
	if err != nil {
		vendorAPIError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(vendors)
	common.ApiSuccess(c, pageInfo)
}

// GetVendorMeta 根据 ID 获取供应商
func GetVendorMeta(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		vendorAPIError(c, err)
		return
	}
	v, err := model.GetVendorByID(id)
	if err != nil {
		vendorAPIError(c, err)
		return
	}
	common.ApiSuccess(c, v)
}

// CreateVendorMeta 新建供应商
func CreateVendorMeta(c *gin.Context) {
	var v model.Vendor
	if err := c.ShouldBindJSON(&v); err != nil {
		vendorAPIError(c, err)
		return
	}
	// 名称命中历史合并规则：直接返回当时的合并目标，而不是新建一条会被规则
	// 立刻重定向走的孤儿记录（它会永远看不见，却占用名称并制造误解）。
	if targetID := model.ResolveVendorMergeTarget(v.Name); targetID > 0 {
		if target, err := model.GetVendorByID(targetID); err == nil {
			recordManageAudit(c, "vendor.metadata.save", map[string]any{
				"vendor_id": target.Id, "name": target.Name,
				"redirected_from": v.Name,
			})
			common.ApiSuccess(c, target)
			return
		}
	}
	if err := v.Insert(); err != nil {
		vendorAPIError(c, err)
		return
	}
	recordManageAudit(c, "vendor.metadata.save", map[string]any{"vendor_id": v.Id, "name": v.Name})
	common.ApiSuccess(c, &v)
}

// UpdateVendorMeta 更新供应商
func UpdateVendorMeta(c *gin.Context) {
	var v model.Vendor
	if err := c.ShouldBindJSON(&v); err != nil {
		vendorAPIError(c, err)
		return
	}
	if v.Id == 0 {
		common.ApiErrorI18n(c, i18n.MsgCommonMissing_vendor_id)
		return
	}
	// 负 ID 对应定价广场上的合成"默认品牌"供应商，没有持久化记录。
	// 将其提升为真实供应商，以便运营人员能够管理与编辑。
	if v.Id < 0 {
		created, err := model.PromoteDefaultVendor(v.Name, v.Description, v.Icon)
		if err != nil {
			vendorAPIError(c, err)
			return
		}
		recordManageAudit(c, "vendor.metadata.save", map[string]any{"vendor_id": created.Id, "name": created.Name})
		common.ApiSuccess(c, &created)
		return
	}
	// 改名指向一个已被合并的名称时同样归集到合并目标，保证「被合并的来源永不独立出现」。
	if v.Id > 0 {
		if targetID := model.ResolveVendorMergeTarget(v.Name); targetID > 0 && targetID != v.Id {
			if target, err := model.GetVendorByID(targetID); err == nil {
				recordManageAudit(c, "vendor.metadata.save", map[string]any{
					"vendor_id": target.Id, "name": target.Name,
					"redirected_from": v.Name,
				})
				common.ApiSuccess(c, target)
				return
			}
		}
	}
	if err := v.Update(); err != nil {
		vendorAPIError(c, err)
		return
	}
	recordManageAudit(c, "vendor.metadata.save", map[string]any{"vendor_id": v.Id, "name": v.Name})
	common.ApiSuccess(c, &v)
}

// DeleteVendorMeta 删除供应商
func DeleteVendorMeta(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		vendorAPIError(c, err)
		return
	}
	if id < 0 {
		// 负 ID 是定价广场上的合成"默认品牌"，没有持久化记录，只能合并不能直接删除。
		vendorAPIError(c, model.ErrVendorDefaultBrandNotDeletable)
		return
	}
	if err := model.DeleteVendors([]int{id}); err != nil {
		vendorAPIError(c, err)
		return
	}
	recordManageAudit(c, "vendor.metadata.delete", map[string]any{"vendor_id": id})
	common.ApiSuccess(c, nil)
}

func vendorAPIError(c *gin.Context, err error) {
	status := http.StatusBadRequest
	payload := gin.H{"success": false, "message": err.Error()}
	var references *model.VendorReferenceError
	if errors.Is(err, model.ErrVendorConflict) {
		status = http.StatusConflict
		payload["code"] = "VENDOR_CONFLICT"
	}
	if errors.As(err, &references) {
		status = http.StatusConflict
		payload["code"] = "VENDOR_REFERENCED"
		payload["reference_counts"] = references.Counts
	}
	c.JSON(status, payload)
}

func PreviewVendorOperation(c *gin.Context) {
	var request model.VendorOperation
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		vendorAPIError(c, err)
		return
	}
	preview, err := model.PreviewVendorOperation(request)
	if err != nil {
		vendorAPIError(c, err)
		return
	}
	common.ApiSuccess(c, preview)
}

func ApplyVendorOperation(c *gin.Context) {
	var request model.VendorOperation
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		vendorAPIError(c, err)
		return
	}
	result, err := model.ApplyVendorOperation(request)
	if err != nil {
		vendorAPIError(c, err)
		return
	}
	recordManageAudit(c, "vendor."+request.Action, map[string]any{"source_vendor_ids": request.VendorIDs, "target_vendor_id": request.TargetVendorID, "updated_model_ids": result.UpdatedModels, "deleted_vendor_ids": result.DeletedVendors})
	common.ApiSuccess(c, result)
}

// VendorMergeRuleView 是合并规则在前端的呈现形态，除规则本身外附带目标供应商名称，
// 让管理界面无需再额外查表即可展示「来源 -> 合并到谁」。
type VendorMergeRuleView struct {
	Id             int      `json:"id"`
	SourceName     string   `json:"source_name"`
	SourcePatterns []string `json:"source_patterns"`
	TargetVendorID int      `json:"target_vendor_id"`
	TargetName     string   `json:"target_vendor_name"`
	CreatedTime    int64    `json:"created_time"`
	UpdatedTime    int64    `json:"updated_time"`
}

// ListVendorMergeRules 返回全部生效中的「自动合并」规则，供管理员查看与撤销。
func ListVendorMergeRules(c *gin.Context) {
	rules, err := model.ListVendorMergeRules()
	if err != nil {
		vendorAPIError(c, err)
		return
	}
	targetIDs := make([]int, 0, len(rules))
	for _, rule := range rules {
		targetIDs = append(targetIDs, rule.TargetVendorID)
	}
	names := make(map[int]string, len(targetIDs))
	if len(targetIDs) > 0 {
		var targets []model.Vendor
		if err := model.DB.Where("id IN ?", targetIDs).Find(&targets).Error; err == nil {
			for _, v := range targets {
				names[v.Id] = v.Name
			}
		}
	}
	views := make([]VendorMergeRuleView, 0, len(rules))
	for _, rule := range rules {
		patterns := make([]string, 0)
		if rule.SourcePatterns != "" {
			for _, part := range splitVendorMergePatterns(rule.SourcePatterns) {
				patterns = append(patterns, part)
			}
		}
		views = append(views, VendorMergeRuleView{
			Id:             rule.Id,
			SourceName:     rule.SourceName,
			SourcePatterns: patterns,
			TargetVendorID: rule.TargetVendorID,
			TargetName:     names[rule.TargetVendorID],
			CreatedTime:    rule.CreatedTime,
			UpdatedTime:    rule.UpdatedTime,
		})
	}
	common.ApiSuccess(c, views)
}

// DeleteVendorMergeRule 撤销一条「自动合并」规则，使该来源恢复为独立供应商。
func DeleteVendorMergeRule(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		vendorAPIError(c, errors.New("invalid vendor merge rule"))
		return
	}
	if err := model.DeleteVendorMergeRule(id); err != nil {
		vendorAPIError(c, err)
		return
	}
	recordManageAudit(c, "vendor.merge-rule.delete", map[string]any{"merge_rule_id": id})
	common.ApiSuccess(c, nil)
}

// splitVendorMergePatterns 把 model 层逗号分隔的规则还原成列表（与 model 层一致）。
func splitVendorMergePatterns(encoded string) []string {
	parts := strings.Split(encoded, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
