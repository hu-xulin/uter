package model

import (
	"errors"
	"fmt"

	"gorm.io/gorm"

	"github.com/Uter-AI/Uter/common"
	"github.com/Uter-AI/Uter/logger"
)

// OrgRole 是用户在所属组织内的角色，与系统角色（common.Role*）正交。
// 平台直管用户（organization_id == 0）的 OrgRole 为空。
const (
	OrgRoleOwner          = "owner"           // 组织创建者/老板，拥有组织全部管理权
	OrgRoleAdmin          = "admin"           // 组织管理员，可管理本组织成员
	OrgRoleDepartmentAdmin = "department_admin" // 部门管理员，仅能管理本部门成员
	OrgRoleMember         = "member"          // 普通成员
)

// IsValidOrgRole 校验组织内角色字符串合法。
func IsValidOrgRole(role string) bool {
	switch role {
	case OrgRoleOwner, OrgRoleAdmin, OrgRoleDepartmentAdmin, OrgRoleMember:
		return true
	}
	return false
}

// Organization 表示一个公司/租户。Quota 为共享总钱包预算，UsedQuota 为已消耗。
type Organization struct {
	Id          int    `json:"id" gorm:"primaryKey"`
	Name        string `json:"name" gorm:"type:varchar(128);not null"`
	OwnerUserId int    `json:"owner_user_id" gorm:"index"` // 老板用户 id
	Quota       int64  `json:"quota" gorm:"type:bigint;default:0"`      // 共享总钱包预算（额度单位）
	UsedQuota   int64  `json:"used_quota" gorm:"type:bigint;default:0"` // 已消耗额度
	MemberLimit int    `json:"member_limit" gorm:"type:int;default:0"`  // 成员上限，0=不限
	Status      int    `json:"status" gorm:"type:int;default:1"`        // 1=启用 2=禁用
	CreatedAt   int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt   int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

func (Organization) TableName() string { return "organizations" }

// OrganizationMemberSummary 用于列表展示组织内成员的消耗概览。
type OrganizationMemberSummary struct {
	User
	SubQuotaUsed int64 `json:"sub_quota_used" gorm:"column:sub_quota_used"`
}

var (
	ErrOrgNotFound       = errors.New("organization not found")
	ErrOrgNameRequired   = errors.New("organization name is required")
	ErrOrgMemberLimit    = errors.New("organization member limit reached")
	ErrOrgAlreadyMember  = errors.New("user already belongs to an organization")
	ErrOrgNotOwner       = errors.New("only the organization owner can perform this action")
)

// CreateOrganization 创建组织并把创建者设为 owner。
func CreateOrganization(name string, ownerUserId int, quota int64) (*Organization, error) {
	if name == "" {
		return nil, ErrOrgNameRequired
	}
	org := &Organization{
		Name:        name,
		OwnerUserId: ownerUserId,
		Quota:       quota,
		UsedQuota:   0,
		MemberLimit: 0,
		Status:      1,
	}
	if err := DB.Create(org).Error; err != nil {
		return nil, err
	}
	// 把创建者挂到组织并标记 owner，但【不】晋升全局 Admin 角色。
	// 组织归属与系统角色（common.Role*）正交：组织内权限由 org_role + OrgAdminAuth 中间件约束，
	// 这样公司负责人只能访问组织范围接口，无法触及平台级 Admin 接口（如删除任意用户）。
	if err := DB.Model(&User{}).Where("id = ?", ownerUserId).Updates(map[string]any{
		"organization_id": org.Id,
		"org_role":        OrgRoleOwner,
		"department_id":   0,
	}).Error; err != nil {
		return nil, err
	}
	// 组织归属/角色变更必须刷新 Redis 用户认证缓存：登录会话与后端 OrgAdminAuth
	// 都从缓存读 organization_id，若不失效则仍读旧值 0 —— 侧栏组织模块不显示、组织接口 403。
	_, _ = BumpUserAuthVersion(ownerUserId)
	return org, nil
}

// GetOrganizationById 读取组织（含已软删）。
func GetOrganizationById(id int) (*Organization, error) {
	if id == 0 {
		return nil, ErrOrgNotFound
	}
	var org Organization
	if err := DB.First(&org, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrOrgNotFound
		}
		return nil, err
	}
	return &org, nil
}

// GetOrganizationByOwner 读取某用户作为 owner 的组织。
func GetOrganizationByOwner(ownerUserId int) (*Organization, error) {
	var org Organization
	if err := DB.First(&org, "owner_user_id = ?", ownerUserId).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrOrgNotFound
		}
		return nil, err
	}
	return &org, nil
}

// UpdateOrganization 更新组织元数据与预算。
func UpdateOrganization(id int, name string, quota int64, memberLimit int, status int) error {
	updates := map[string]any{}
	if name != "" {
		updates["name"] = name
	}
	if quota >= 0 {
		updates["quota"] = quota
	}
	if memberLimit >= 0 {
		updates["member_limit"] = memberLimit
	}
	if status >= 0 {
		updates["status"] = status
	}
	if len(updates) == 0 {
		return nil
	}
	return DB.Model(&Organization{}).Where("id = ?", id).Updates(updates).Error
}

// AddMember 把用户加入组织，可指定部门名称与子额度上限。
func (org *Organization) AddMember(userIds []int, departmentName string, subQuotaLimit int64) error {
	if org.MemberLimit > 0 {
		var count int64
		DB.Model(&User{}).Where("organization_id = ? AND deleted_at IS NULL", org.Id).Count(&count)
		if int(count)+len(userIds) > org.MemberLimit {
			return ErrOrgMemberLimit
		}
	}
	if err := DB.Model(&User{}).Where("id IN ?", userIds).Updates(map[string]any{
		"organization_id":  org.Id,
		"department_name":  departmentName,
		"org_role":         OrgRoleMember,
		"sub_quota_limit":  subQuotaLimit,
	}).Error; err != nil {
		return err
	}
	// 见 CreateOrganization 注释：成员加入后刷新各自认证缓存，使侧栏与后端鉴权立即生效。
	for _, uid := range userIds {
		_, _ = BumpUserAuthVersion(uid)
	}
	return nil
}

// RemoveMember 把用户移出组织（变回平台直管普通用户）。
func (org *Organization) RemoveMember(userId int) error {
	if err := DB.Model(&User{}).Where("id = ?", userId).Updates(map[string]any{
		"organization_id": 0,
		"department_id":   0,
		"department_name": "",
		"org_role":        "",
		"sub_quota_limit": 0,
	}).Error; err != nil {
		return err
	}
	// 移出组织后刷新缓存，避免旧 organization_id 残留导致侧栏/接口仍按组织成员放行。
	_, _ = BumpUserAuthVersion(userId)
	return nil
}

// SetMemberSubQuotaLimit 设置成员子额度上限（0=不限，跟随组织总池）。
func (org *Organization) SetMemberSubQuotaLimit(userId int, subQuotaLimit int64) error {
	return DB.Model(&User{}).Where("id = ? AND organization_id = ?", userId, org.Id).
		Update("sub_quota_limit", subQuotaLimit).Error
}

// IncrUsedQuota 在消费成功后累加组织已用额度，并返回是否超出预算。
// 调用方需保证 amount 已通过 PreConsumeOrgQuota 的前置校验。
func (org *Organization) IncrUsedQuota(amount int64) error {
	return DB.Model(&Organization{}).Where("id = ?", org.Id).
		Update("used_quota", gorm.Expr("used_quota + ?", amount)).Error
}

// PreConsumeOrgQuota 在扣费前校验组织预算是否足够。
// 仅当 user 属于某组织且 org.Quota>0 时校验；返回是否通过。
func PreConsumeOrgQuota(org *Organization, amount int64) bool {
	if org == nil || org.Quota <= 0 {
		return true
	}
	// used_quota 与 quota 均为额度单位；若已用+本次 > 预算则拒绝
	if org.UsedQuota+amount > org.Quota {
		return false
	}
	return true
}

// EnforceOrgQuota 在扣费前校验用户所属组织的预算与员工子额度上限。
// 仅对 organization_id>0 的用户生效，普通用户直接放行；校验失败返回错误以拒绝请求。
// 这是共享钱包的「硬闸门」：不动现有用户钱包引擎，只在组织层叠加预算/子额度约束。
func EnforceOrgQuota(userId int, quota int64) error {
	if userId <= 0 || quota <= 0 {
		return nil
	}
	cache, err := GetUserCache(userId)
	if err != nil {
		// 缓存缺失不阻断普通请求；若确属组织用户，后续钱包扣费会自然失败
		return nil
	}
	if cache.OrganizationId == 0 {
		return nil
	}
	org, err := GetOrganizationById(cache.OrganizationId)
	if err != nil {
		return nil
	}
	if !PreConsumeOrgQuota(org, quota) {
		return fmt.Errorf("organization budget exceeded: used %s / budget %s", logger.FormatQuota(int(org.UsedQuota)), logger.FormatQuota(int(org.Quota)))
	}
	if cache.SubQuotaLimit > 0 && int64(cache.UsedQuota)+quota > cache.SubQuotaLimit {
		return fmt.Errorf("employee sub-quota limit exceeded: used %s / limit %s", logger.FormatQuota(int(cache.UsedQuota)), logger.FormatQuota(int(cache.SubQuotaLimit)))
	}
	return nil
}

// OrgIdOfUser 返回用户所属组织 id（0=平台直管）。优先读缓存，缺失回退 DB。
// 用于计费时判断「是否由组织钱包出资」。
func OrgIdOfUser(userId int) (int, error) {
	if userId <= 0 {
		return 0, nil
	}
	if common.RedisEnabled {
		if c, err := GetUserCache(userId); err == nil && c != nil {
			return c.OrganizationId, nil
		}
	}
	u, err := GetUserById(userId, false)
	if err != nil {
		return 0, err
	}
	return u.OrganizationId, nil
}

// IncrOrgUsedQuota 在扣费成功后累加组织已用额度（原子自增）。
func IncrOrgUsedQuota(orgId int, amount int64) error {
	if orgId == 0 || amount == 0 {
		return nil
	}
	return DB.Model(&Organization{}).Where("id = ?", orgId).Update("used_quota", gorm.Expr("used_quota + ?", amount)).Error
}

// GetOrgMembers 分页读取组织内成员。departmentName 非空时仅返回该部门。
func GetOrgMembers(orgId int, departmentName string, keyword string, startIdx int, num int) ([]*User, int64, error) {
	var users []*User
	var total int64
	query := DB.Model(&User{}).Where("organization_id = ? AND deleted_at IS NULL", orgId)
	if departmentName != "" {
		query = query.Where("department_name = ?", departmentName)
	}
	if keyword != "" {
		query = query.Where("username LIKE ? OR email LIKE ? OR display_name LIKE ?",
			"%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := query.Omit("password", "access_token").Limit(num).Offset(startIdx).Find(&users).Error; err != nil {
		return nil, 0, err
	}
	return users, total, nil
}

// GetOrgUsedQuota 统计组织内成员的总已用额度（来自 users.used_quota）。
func GetOrgUsedQuota(orgId int) (int64, error) {
	var sum int64
	err := DB.Model(&User{}).Where("organization_id = ? AND deleted_at IS NULL", orgId).
		Select("COALESCE(SUM(used_quota),0)").Scan(&sum).Error
	return sum, err
}

// GetOrgMemberUsernames 返回组织内全部成员的 username，供日志/额度范围过滤使用。
func GetOrgMemberUsernames(orgId int) ([]string, error) {
	var names []string
	err := DB.Model(&User{}).Where("organization_id = ? AND deleted_at IS NULL", orgId).
		Pluck("username", &names).Error
	return names, err
}
