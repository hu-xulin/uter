package model

import (
	"errors"
	"fmt"

	"gorm.io/gorm"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/logger"
)

// OrgRole 是用户在所属组织内的角色，与系统角色（common.Role*）正交。
// 平台直管用户（organization_id == 0）的 OrgRole 为空。
const (
	OrgRoleOwner           = "owner"            // 组织创建者/老板，拥有组织全部管理权
	OrgRoleAdmin           = "admin"            // 组织管理员，可管理本组织成员
	OrgRoleDepartmentAdmin = "department_admin" // 部门管理员，仅能管理本部门成员
	OrgRoleMember          = "member"           // 普通成员
)

// IsValidOrgRole 校验组织内角色字符串合法。
func IsValidOrgRole(role string) bool {
	switch role {
	case OrgRoleOwner, OrgRoleAdmin, OrgRoleDepartmentAdmin, OrgRoleMember:
		return true
	}
	return false
}

// 组织状态取值。与 common.UserStatus* 一样从 1 开始：0 是 int 的零值，必须能被区分出来，
// 否则「忘记赋值」会被静默当成一个合法状态。
const (
	// OrgStatusEnabled 组织正常可用。
	OrgStatusEnabled = 1
	// OrgStatusDisabled 组织已停用：成员不能再消耗额度，也不能再被加入。
	OrgStatusDisabled = 2
	// OrgStatusUnchanged 是 UpdateOrganization 的「不修改」哨兵。
	// 调用方不打算改动状态时必须显式传它，而不是传 0。
	OrgStatusUnchanged = -1
)

// IsValidOrgStatus 校验组织状态取值是否合法（仅 1/2）。
func IsValidOrgStatus(status int) bool {
	return status == OrgStatusEnabled || status == OrgStatusDisabled
}

// IsOrgSuspended 报告组织是否处于停用状态。nil 组织视为未停用（调用方应另有判空）。
func (org *Organization) IsOrgSuspended() bool {
	return org != nil && org.Status == OrgStatusDisabled
}

// Organization 表示一个公司/租户。Quota 为共享总钱包预算，UsedQuota 为已消耗。
type Organization struct {
	Id          int    `json:"id" gorm:"primaryKey"`
	Name        string `json:"name" gorm:"type:varchar(128);not null"`
	OwnerUserId int    `json:"owner_user_id" gorm:"index"`              // 老板用户 id
	Quota       int64  `json:"quota" gorm:"type:bigint;default:0"`      // 共享总钱包预算（额度单位）
	UsedQuota   int64  `json:"used_quota" gorm:"type:bigint;default:0"` // 已消耗额度
	MemberLimit int    `json:"member_limit" gorm:"type:int;default:0"`  // 成员上限，0=不限
	Status      int    `json:"status" gorm:"type:int;default:1"`        // 1=启用 2=禁用，见 OrgStatus*
	CreatedAt   int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt   int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

func (Organization) TableName() string { return "organizations" }

// SetOrganizationOwner 更新组织的负责人指针 owner_user_id。
//
// 该指针必须与 users.org_role 同步：它是 UpdateOrganization / RemoveOrganizationMember
// 判定「谁是负责人」的依据。只改 org_role 而不改指针会造成所有权漂移 —— 真正的新负责人
// 改不了组织元数据，而已经退出组织的旧负责人仍被当作负责人。
//
// 传 0 表示组织暂时没有负责人（仅超管可继续管理），不会误匹配任何真实用户 id
// （自增 id 从 1 开始），因此是 fail-closed 的。
func SetOrganizationOwner(id int, ownerUserId int) error {
	if id == 0 {
		return ErrOrgNotFound
	}
	return DB.Model(&Organization{}).Where("id = ?", id).
		Update("owner_user_id", ownerUserId).Error
}

// OrganizationMemberSummary 用于列表展示组织内成员的消耗概览。
type OrganizationMemberSummary struct {
	User
	SubQuotaUsed int64 `json:"sub_quota_used" gorm:"column:sub_quota_used"`
}

var (
	ErrOrgNotFound      = errors.New("organization not found")
	ErrOrgNameRequired  = errors.New("organization name is required")
	ErrOrgMemberLimit   = errors.New("organization member limit reached")
	ErrOrgAlreadyMember = errors.New("user already belongs to an organization")
	ErrOrgNotOwner      = errors.New("only the organization owner can perform this action")
	// ErrOrgBudgetExceeded 组织共享预算已被本次消费耗尽（准入失败，未发生扣减）。
	ErrOrgBudgetExceeded = errors.New("organization budget exceeded")
	// ErrOrgSubQuotaExceeded 成员子额度上限不足（准入失败，未发生扣减）。
	ErrOrgSubQuotaExceeded = errors.New("organization member sub-quota exceeded")
	// ErrOrgMemberForeign 目标用户已归属其它组织；加入组织不得跨租户搬迁账号。
	ErrOrgMemberForeign = errors.New("user already belongs to another organization")
	// ErrOrgMemberPrivileged 目标用户的系统角色高于普通用户（平台管理员/超管）。
	// 这类账号由平台直管、不属于任何组织，纳入组织会改写其组织归属并使其
	// 受组织预算约束，越出「组织只管自己租户」的边界。
	ErrOrgMemberPrivileged = errors.New("cannot add a privileged platform account to an organization")
	// ErrOrgSuspended 组织已被平台停用，其成员不得消耗额度、不得被加入。
	ErrOrgSuspended = errors.New("organization is suspended")
	// ErrOrgStatusCodeInvalid 状态取值非法（只接受 1/2；不修改请用 OrgStatusUnchanged）。
	ErrOrgStatusCodeInvalid = errors.New("invalid organization status code")
	// ErrOrgNoValidMember 批量加入组织时没有任何合法的用户 id（全部解析失败或为空）。
	ErrOrgNoValidMember = errors.New("no valid member to add")
	// ErrOrgMemberUnknown 目标用户不存在（含已被硬删除的账号）。批量纳新时按行返回，
	// 让调用方能区分「该行失败」与「其余行成功」，而不是整体静默成功。
	ErrOrgMemberUnknown = errors.New("user does not exist")
)

// OrgQuotaError 携带额度超限的具体数值。用户在界面上看到的是**本地化后的可读文案**，
// 而不是 `errors.New` 的英文技术串——这些错误会直接透出到 API 响应与游乐场提示里。
//
// 保留 `Is` 方法使 `errors.Is(err, ErrOrgSubQuotaExceeded/ErrOrgBudgetExceeded)`
// 的既有判定（含单测）完全不受影响，同时让上层能用 errors.As 取出数值做本地化。
type OrgQuotaError struct {
	// Kind 为 ErrOrgSubQuotaExceeded 或 ErrOrgBudgetExceeded。
	Kind     error
	Used     int64
	Limit    int64
	Required int64
}

func (e *OrgQuotaError) Error() string {
	if e.Required > 0 {
		return fmt.Sprintf("%s: used %s / limit %s, need %s", e.Kind.Error(),
			logger.FormatQuota(int(e.Used)), logger.FormatQuota(int(e.Limit)),
			logger.FormatQuota(int(e.Required)))
	}
	return fmt.Sprintf("%s: used %s / limit %s", e.Kind.Error(),
		logger.FormatQuota(int(e.Used)), logger.FormatQuota(int(e.Limit)))
}

// Is 让 errors.Is(err, ErrOrgSubQuotaExceeded) / ErrOrgBudgetExceeded 继续成立。
func (e *OrgQuotaError) Is(target error) bool { return errors.Is(e.Kind, target) }

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
		Status:      OrgStatusEnabled,
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
// 所有「不修改」维度都传负数哨兵（见 OrgStatusUnchanged）；status 只接受 1/2，
// 传入 0 或其它值一律拒绝 —— 0 是 int 零值，一旦写库就会得到一个既非启用也非停用的
// 幽灵状态，而 IsOrgSuspended 之类的读取点只认 OrgStatusDisabled，会静默放行。
func UpdateOrganization(id int, name string, quota int64, memberLimit int, status int) error {
	if status >= 0 && !IsValidOrgStatus(status) {
		return fmt.Errorf("%w: %d", ErrOrgStatusCodeInvalid, status)
	}
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

// OrgMemberAdd 描述一次「加入组织」请求中的单个成员及其专属子额度上限与部门。
// 同一批次里每个用户可以有不同的 sub_quota_limit 与 department_name，
// 满足「给不同成员单独设上限 / 单独归到不同部门」的需求。
type OrgMemberAdd struct {
	UserId         int
	SubQuotaLimit  int64
	DepartmentName string
}

// AddMembers 批量把用户加入组织，支持为每个成员单独指定子额度上限与部门。
// 已归属其它组织的账号一律拒绝：组织归属是租户边界，跨组织搬迁必须由平台超管
// 显式操作，否则任意组织管理员都能把别家客户/平台用户「拉」进自己的租户。
func (org *Organization) AddMembers(members []OrgMemberAdd) error {
	// 停用组织不得继续纳新：停用通常意味着欠费/合规问题，此时把新成员挂进来会立即
	// 得到一批「一上线就被拒绝」的账号。
	if org.IsOrgSuspended() {
		return ErrOrgSuspended
	}
	ids := make([]int, 0, len(members))
	quotaByID := make(map[int]int64, len(members))
	quotaByDept := make(map[int]string, len(members))
	for _, m := range members {
		if m.UserId <= 0 {
			continue
		}
		if _, seen := quotaByID[m.UserId]; !seen {
			ids = append(ids, m.UserId)
		}
		quotaByID[m.UserId] = m.SubQuotaLimit
		quotaByDept[m.UserId] = m.DepartmentName
	}
	if len(ids) == 0 {
		return ErrOrgNoValidMember
	}
	if org.MemberLimit > 0 {
		var count int64
		// 只把「本次真正新增」的人数计入上限：ids 中已属于本组织的用户
		// 属于更新场景（见下方 ErrOrgAlreadyMember），若一并计数会让他们
		// 既挡住重放、又在同一请求里把组织顶到超限。
		DB.Model(&User{}).Where("organization_id = ? AND deleted_at IS NULL", org.Id).
			Where("id NOT IN ?", ids).Count(&count)
		if int(count)+len(ids) > org.MemberLimit {
			return ErrOrgMemberLimit
		}
	}
	// 纳新与改属性必须在数据层分离：
	//  - 目标已属于其它组织：跨租户搬迁账号，不允许；
	//  - 目标已属于本组织：应走 UpdateOrganizationMember 携带角色合法性校验，
	//    若在此处放行会无条件覆写 org_role/sub_quota_limit，使组织管理员得以
	//    自我提权（清零自身子额度上限）并把 owner 降级为 member，而修复方
	//    （仅超管）反而无权改回，组织将失去唯一 owner；
	//  - 目标系统角色高于普通用户：平台直管的管理员/超管不属于任何组织，
	//    纳入会改写其组织归属，越出「组织只管自己租户」的边界。
	// 目标用户必须真实存在。不存在的 id 会同时躲过下面三个 Count（不匹配任何行），
	// 若不先拦下，最终 `UPDATE ... WHERE id IN ?` 只命中其余行而不报错，接口却返回
	// 成功——调用方无法察觉有人根本没被加进来（BE-ORG-006/007）。
	var unknown int64
	if err := DB.Model(&User{}).Where("id IN ?", ids).Count(&unknown).Error; err != nil {
		return err
	}
	if found := int64(len(ids)) - unknown; found != 0 {
		// 明确列出缺失的 id，便于逐行回执；软删除的账号同样视为不存在。
		missing := make([]int, 0, found)
		for _, id := range ids {
			var count int64
			if err := DB.Model(&User{}).Where("id = ?", id).Count(&count).Error; err != nil {
				return err
			}
			if count == 0 {
				missing = append(missing, id)
			}
		}
		return fmt.Errorf("%w: %v", ErrOrgMemberUnknown, missing)
	}
	var existing, foreign, privileged int64
	base := DB.Model(&User{}).Where("id IN ?", ids)
	if err := base.Session(&gorm.Session{}).Where("organization_id = ?", org.Id).
		Count(&existing).Error; err != nil {
		return err
	}
	if existing > 0 {
		return ErrOrgAlreadyMember
	}
	if err := base.Session(&gorm.Session{}).
		Where("organization_id <> 0").Count(&foreign).Error; err != nil {
		return err
	}
	if foreign > 0 {
		return ErrOrgMemberForeign
	}
	if err := base.Session(&gorm.Session{}).
		Where("role > ?", common.RoleCommonUser).Count(&privileged).Error; err != nil {
		return err
	}
	if privileged > 0 {
		return ErrOrgMemberPrivileged
	}
	// 每个成员可归属不同部门：先统一挂到组织并标记为基础成员，
	// 随后按成员逐个写入各自的 department_name 与 sub_quota_limit。
	// 上面的准入检查已保证此处全是「尚不属于任何组织」的账号，故本 UPDATE
	// 只会纳新，不会改写既有成员的属性。
	if err := DB.Model(&User{}).Where("id IN ?", ids).Updates(map[string]any{
		"organization_id": org.Id,
		"org_role":        OrgRoleMember,
	}).Error; err != nil {
		return err
	}
	for _, id := range ids {
		dept := quotaByDept[id]
		if err := DB.Model(&User{}).Where("id = ? AND organization_id = ?", id, org.Id).
			Update("department_name", dept).Error; err != nil {
			return err
		}
	}
	for _, id := range ids {
		if err := DB.Model(&User{}).Where("id = ? AND organization_id = ?", id, org.Id).
			Update("sub_quota_limit", quotaByID[id]).Error; err != nil {
			return err
		}
	}
	// 见 CreateOrganization 注释：成员加入后刷新各自认证缓存，使侧栏与后端鉴权立即生效。
	for _, id := range ids {
		_, _ = BumpUserAuthVersion(id)
	}
	return nil
}

// RemoveMember 把用户移出组织（变回平台直管普通用户）。
// 必须同时限定 organization_id，否则调用方只要拿到 uid 就能重置任意其他组织成员
// 的归属（跨租户破坏）。
func (org *Organization) RemoveMember(userId int) error {
	res := DB.Model(&User{}).Where("id = ? AND organization_id = ?", userId, org.Id).Updates(map[string]any{
		"organization_id": 0,
		"department_id":   0,
		"department_name": "",
		"org_role":        "",
		"sub_quota_limit": 0,
	})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrOrgNotFound
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
// 这是共享钱包的「只读闸门」：不动任何账本，只判断本次预扣额能否通过。真正的原子预扣
// 由 ReserveOrgQuota 完成（见 service.WalletFunding.PreConsume）。
//
// 停用组织（Status == OrgStatusDisabled）在此**一律拒绝**：这是 organizations.status 的
// 主要读取点，也是「停用」真正生效的地方 —— 否则该字段只是一个装饰。
// 注意这里与其它分支的取向相反：缓存/数据库抖动时我们会 fail-open（不误判越权），
// 但「组织已停用」是明确读到的业务事实，必须 fail-closed。
//
// 两处数值都取数据库权威值：
//   - 组织预算：读 organizations 行（缓存里根本没有组织账本）；
//   - 成员子额度：读 users.used_quota。**不能**用 GetUserCache 的 UsedQuota —— 该字段只在
//     整份哈希写入时刷新，Redis 下最长可陈旧一个 TTL（默认 60s），而 used_quota 的累加
//     路径只写数据库，会让子额度上限在一整个 TTL 内失去约束。
func EnforceOrgQuota(userId int, quota int64) error {
	if userId <= 0 || quota <= 0 {
		return nil
	}
	orgId, err := OrgIdOfUser(userId)
	if err != nil || orgId == 0 {
		// 取不到归属时按「非组织用户」放行：缓存/数据库抖动不应把成员误判成越权，
		// 真正落账时的 ReserveOrgQuota 仍会按数据库中的归属重新判定。
		return nil
	}
	org, err := GetOrganizationById(orgId)
	if err != nil {
		return nil
	}
	if org.IsOrgSuspended() {
		return fmt.Errorf("%w: org %d", ErrOrgSuspended, org.Id)
	}
	if !PreConsumeOrgQuota(org, quota) {
		return &OrgQuotaError{Kind: ErrOrgBudgetExceeded, Used: int64(org.UsedQuota), Limit: int64(org.Quota), Required: quota}
	}
	subQuotaLimit, usedQuota, err := GetOrgMemberSubQuotaState(orgId, userId)
	if err != nil {
		return nil
	}
	if subQuotaLimit > 0 && int64(usedQuota)+quota > subQuotaLimit {
		return &OrgQuotaError{Kind: ErrOrgSubQuotaExceeded, Used: int64(usedQuota), Limit: subQuotaLimit, Required: quota}
	}
	return nil
}

// GetOrgMemberSubQuotaState 读取成员在组织内的子额度上限与已用额度（数据库权威值）。
func GetOrgMemberSubQuotaState(orgId int, userId int) (subQuotaLimit int64, usedQuota int, err error) {
	var member struct {
		SubQuotaLimit int64
		UsedQuota     int
	}
	err = DB.Model(&User{}).
		Where("id = ? AND organization_id = ?", userId, orgId).
		Select("sub_quota_limit", "used_quota").
		Take(&member).Error
	if err != nil {
		return 0, 0, err
	}
	return member.SubQuotaLimit, member.UsedQuota, nil
}

// ReserveOrgQuota 在成员子额度账本与组织共享账本上原子预扣 amount：
//  1. 先用单条带条件的 UPDATE 原子预留成员子额度：闸门（used_quota+amount<=sub_quota_limit）
//     与记账（used_quota += amount）在同一条语句中完成，并发请求不可能同时通过检查后超扣。
//     这关闭了原先「EnforceOrgQuota 只读校验 + 结算点才写 used_quota」之间的 TOCTOU 窗口——
//     旧实现下同一成员的并发请求会全部通过只读校验，结算时集体突破子额度上限，成员可白嫖
//     远超其配额的共享钱包用量。
//  2. 再以单条带条件的 UPDATE 原子自增 organizations.used_quota，条件为
//     「预算未设置上限 或 已用+本次 <= 预算」且「组织未停用」。
//  3. 任一步骤失败都回滚已完成的步骤，保证账本不被留下半截痕迹。
//
// 子额度上限 sub_quota_limit<=0 表示不限量（组织未给该成员设上限），此时只校验组织预算；
// 组织预算 quota<=0 同理表示不限量。
func ReserveOrgQuota(orgId int, userId int, amount int64) error {
	if orgId <= 0 || amount <= 0 {
		return nil
	}
	// 1) 原子预留成员子额度：闸门与记账同一条条件 UPDATE。
	mres := DB.Model(&User{}).
		Where("id = ? AND organization_id = ? AND (sub_quota_limit <= 0 OR used_quota + ? <= sub_quota_limit)",
			userId, orgId, amount).
		Update("used_quota", gorm.Expr("used_quota + ?", amount))
	if mres.Error != nil {
		return mres.Error
	}
	if mres.RowsAffected == 0 {
		// 读回成员账本给出真实数值：条件 UPDATE 不命中既可能是子额度不足，
		// 也可能是成员已被移出组织，读权威值才能给出准确、可本地化的提示。
		limit, used, stateErr := GetOrgMemberSubQuotaState(orgId, userId)
		if stateErr != nil {
			return fmt.Errorf("%w: org %d member %d over sub-quota limit on reserve %d",
				ErrOrgSubQuotaExceeded, orgId, userId, amount)
		}
		return &OrgQuotaError{Kind: ErrOrgSubQuotaExceeded, Used: int64(used), Limit: limit, Required: amount}
	}
	// 2) 原子预留组织预算（与成员预留同口径）。
	ores := DB.Model(&Organization{}).
		Where("id = ? AND (quota <= 0 OR used_quota + ? <= quota) AND COALESCE(status, ?) <> ?",
			orgId, amount, OrgStatusEnabled, OrgStatusDisabled).
		Update("used_quota", gorm.Expr("used_quota + ?", amount))
	if ores.Error != nil {
		reserveOrgQuotaRollbackMember(orgId, userId, amount)
		return ores.Error
	}
	if ores.RowsAffected == 0 {
		reserveOrgQuotaRollbackMember(orgId, userId, amount)
		// 单条 UPDATE 未命中只可能是「预算不足」或「组织已停用」；读回原始行给出准确原因
		// （只有失败路径才付这次查询）。status 为 NULL 的历史行按未停用处理，与
		// IsOrgSuspended 只认 OrgStatusDisabled 的口径一致。
		org, err := GetOrganizationById(orgId)
		if err != nil {
			return ErrOrgBudgetExceeded
		}
		if org.IsOrgSuspended() {
			return fmt.Errorf("%w: org %d", ErrOrgSuspended, org.Id)
		}
		return fmt.Errorf("%w: used %s / budget %s", ErrOrgBudgetExceeded,
			logger.FormatQuota(int(org.UsedQuota)), logger.FormatQuota(int(org.Quota)))
	}
	return nil
}

// reserveOrgQuotaRollbackMember 撤销 ReserveOrgQuota 已记入成员子额度账本的预留，
// 仅用于组织预算预留失败时的回滚（钳制在 0，避免并发回滚把用量记成负数）。
func reserveOrgQuotaRollbackMember(orgId int, userId int, amount int64) {
	if err := DB.Model(&User{}).Where("id = ? AND organization_id = ?", userId, orgId).
		Update("used_quota", gorm.Expr("CASE WHEN used_quota - ? < 0 THEN 0 ELSE used_quota - ? END", amount, amount)).Error; err != nil {
		common.SysLog(fmt.Sprintf("reserveOrgQuota rollback member used_quota failed (org=%d, user=%d, amount=%d): %s",
			orgId, userId, amount, err.Error()))
	}
}

// OrgRemainingQuota 返回组织共享预算的剩余额度。unlimited 为 true 时表示未设上限
// （organizations.quota <= 0），此时 remaining 返回 0，调用方不得据此判定「已耗尽」。
//
// 超支（used_quota > quota，最后一次请求的实际消耗顶穿了预算）时钳制为 0：
// 「剩余额度」是面向用户展示的量，负值会泄漏到额度提醒与余额提示里。超支这件事
// 本身由 used_quota 与 quota 的差值显式暴露，并可由此告警。
func OrgRemainingQuota(orgId int) (remaining int64, unlimited bool, err error) {
	if orgId <= 0 {
		return 0, true, nil
	}
	org, err := GetOrganizationById(orgId)
	if err != nil {
		return 0, false, err
	}
	if org.Quota <= 0 {
		return 0, true, nil
	}
	if org.UsedQuota >= org.Quota {
		return 0, false, nil
	}
	return org.Quota - org.UsedQuota, false, nil
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
//
// 与 ReserveOrgQuota 采用同一预算口径：quota<=0 表示不限量（平台未给该组织设上限），
// 此时只累加、不卡上限。
//
// 设了预算时**仍然如实累加，不做截断**。这一点是刻意的，且与旧实现相反，原因如下：
//
// 组织预算的真正防线是**准入**（EnforceOrgQuota / ReserveOrgQuota），而不是事后的账本写入。
// 旧实现在这里用条件 UPDATE 把补扣「整笔丢弃」，看上去守住了上限，实际效果是灾难性的：
//
//   - 请求已经渲染完毕、上游成本已经发生，丢弃写入并不能把钱收回；
//   - 账本停在「预扣额」附近（远小于实际消耗），于是 used_quota 永远追不上 quota，
//     准入闸门永远放行 —— 组织预算形同虚设，成员可以无限次白嫖；
//   - 消费日志记的是真实消耗，账本记的是被截断的值，二者系统性脱节，
//     「初始余额 − 最终余额 == logs.Quota」这条计费不变量直接失效。
//
// 实测（预算 150000、单笔实耗 30000、10 笔并发）：日志记 300000，账本只收 123000。
//
// 改为如实累加后：账本与日志始终对账一致；超额部分以 used_quota > quota 的形式显式暴露，
// 可告警、可追责；而因为 used_quota 已经越过 quota，后续请求必然卡在准入闸门上，
// 超支被限制在「最后一次请求」这一次性、有界的范围内——与个人钱包允许欠费是同一风险量级，
// 且远优于旧实现的「无限白嫖」。
func IncrOrgUsedQuota(orgId int, amount int64) error {
	if orgId == 0 || amount == 0 {
		return nil
	}
	res := DB.Model(&Organization{}).Where("id = ?", orgId).
		Update("used_quota", gorm.Expr("used_quota + ?", amount))
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("organization %d not found when adjusting used quota (delta=%d)", orgId, amount)
	}
	if amount > 0 {
		common.SysLog(fmt.Sprintf(
			"organization %d budget overdraft: used_quota increased by %d (delta>0); "+
				"admission will reject further requests once used_quota reaches the budget", orgId, amount))
	}
	return nil
}

// GetOrgMembers 分页读取组织内成员。departmentName 非空时仅返回该部门；
// excludeRoles 用于按调用者权限隐藏特定角色（如组织管理员看不到所有者、部门管理员看不到所有者与管理员）。
func GetOrgMembers(orgId int, departmentName string, keyword string, startIdx int, num int, excludeRoles ...string) ([]*User, int64, error) {
	var users []*User
	var total int64
	query := DB.Model(&User{}).Where("organization_id = ? AND deleted_at IS NULL", orgId)
	if departmentName != "" {
		query = query.Where("department_name = ?", departmentName)
	}
	if len(excludeRoles) > 0 {
		query = query.Where("org_role NOT IN ?", excludeRoles)
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
// excludeRoles 非空时排除指定角色（如组织管理员视角排除所有者），实现「看不到某人数据」的可见性控制。
func GetOrgMemberUsernames(orgId int, excludeRoles ...string) ([]string, error) {
	query := DB.Model(&User{}).Where("organization_id = ? AND deleted_at IS NULL", orgId)
	if len(excludeRoles) > 0 {
		query = query.Where("org_role NOT IN ?", excludeRoles)
	}
	var names []string
	err := query.Pluck("username", &names).Error
	return names, err
}

// NoOrgMemberUsername 与 NoDepartmentFilter 是「不可能匹配」的哨兵值。
// 日志/统计/用户列表查询都把「空字符串 / 空列表」解释为「不施加该维度过滤」，
// 因此当调用者的范围实际为空（例如部门管理员未分配部门）时必须显式传入哨兵值，
// 否则范围查询会静默退化成「看全站」。
const (
	NoOrgMemberUsername = "\x00no-org-member"
	NoDepartmentFilter  = "\x00no-department"
	// NoOrgMemberId 是 user_id 维度上的「不可能匹配」哨兵。任务日志等查询以
	// `user_id IN (?)` 施加范围，空切片会被解释为「不施加过滤」，因此范围为空时
	// 必须显式传 -1（数据库自增 id 从 1 开始）而不是空切片。
	NoOrgMemberId = -1
)

// GetOrgMemberIds 返回组织内成员的 user id，供以 user_id 为过滤维度的查询使用。
// excludeRoles 非空时排除指定角色（如组织管理员视角排除所有者），与 orgLogUsernames 对称。
func GetOrgMemberIds(orgId int, excludeRoles ...string) ([]int, error) {
	query := DB.Model(&User{}).Where("organization_id = ? AND deleted_at IS NULL", orgId)
	if len(excludeRoles) > 0 {
		query = query.Where("org_role NOT IN ?", excludeRoles)
	}
	var ids []int
	err := query.Pluck("id", &ids).Error
	return ids, err
}

// GetOrgMemberIdsInDepartment 返回组织内指定部门成员的 user id（部门按名称匹配）。
// excludeRoles 非空时排除指定角色（如部门管理员视角排除所有者与管理员）。
func GetOrgMemberIdsInDepartment(orgId int, departmentName string, excludeRoles ...string) ([]int, error) {
	if departmentName == "" {
		return []int{NoOrgMemberId}, nil
	}
	query := DB.Model(&User{}).
		Where("organization_id = ? AND department_name = ? AND deleted_at IS NULL", orgId, departmentName)
	if len(excludeRoles) > 0 {
		query = query.Where("org_role NOT IN ?", excludeRoles)
	}
	var ids []int
	err := query.Pluck("id", &ids).Error
	return ids, err
}

// GetOrgMemberUsernamesInDepartment 返回组织内指定部门成员的 username。
// 部门按名称匹配（department_id 列已废弃，从不写入）。excludeRoles 非空时排除指定角色
// （如部门管理员视角排除所有者与管理员）。
func GetOrgMemberUsernamesInDepartment(orgId int, departmentName string, excludeRoles ...string) ([]string, error) {
	if departmentName == "" {
		return []string{NoOrgMemberUsername}, nil
	}
	query := DB.Model(&User{}).
		Where("organization_id = ? AND department_name = ? AND deleted_at IS NULL", orgId, departmentName)
	if len(excludeRoles) > 0 {
		query = query.Where("org_role NOT IN ?", excludeRoles)
	}
	var names []string
	err := query.Pluck("username", &names).Error
	return names, err
}
