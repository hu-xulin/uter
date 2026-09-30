package service

import (
	"fmt"
	"testing"

	"github.com/Uter-AI/Uter/common"

	"github.com/Uter-AI/Uter/model"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// WalletFunding.consumed 必须是「累计」而不是「最后一次预扣额」
// ---------------------------------------------------------------------------
//
// 缺陷背景：图片请求会两次走到 PreConsume ——
//  1. BillingSession.preConsume 预扣 P（标准的预扣费入口）；
//  2. 提交前 PrepareImageBillingForRequest 走 Reserve 的 requireAvailableQuota
//     分支，再预扣增量 (Q − P)（图片数量在提交前已知，不允许赊账）。
//
// 原实现写的是 `w.consumed = amount`（赋值），第二次调用把第一次的 P 覆盖掉，
// 于是失败路径的 Refund 只退回 (Q − P)，用户永久损失 P；组织成员同理，
// 组织 used_quota 少回减 P。修复后改为累加。

// orgLedgerUsed 读取组织账本（organizations.used_quota）本身。
// 与 model.GetOrgUsedQuota 不同 —— 后者统计的是**成员** users.used_quota 之和，
// 而本文件的出资方是组织共享预算账本。
func orgLedgerUsed(t *testing.T, orgId int) int64 {
	t.Helper()
	var used int64
	require.NoError(t,
		model.DB.Model(&model.Organization{}).Where("id = ?", orgId).
			Pluck("used_quota", &used).Error)
	return used
}

func seedWalletUser(t *testing.T, id int, quota int) {
	t.Helper()
	user := &model.User{
		Id:       id,
		Username: fmt.Sprintf("wallet%d", id),
		Quota:    quota,
		Status:   common.UserStatusEnabled,
		AffCode:  fmt.Sprintf("waff%d", id),
	}
	require.NoError(t, model.DB.Create(user).Error)
}

func TestWalletFundingPreConsumeAccumulatesAcrossImageReserve(t *testing.T) {
	const (
		userId = 900_001
		open   = 1_000_000
		p      = 300_000 // 第一次预扣（preConsume）
		q      = 800_000 // 提交前补扣到总额度，增量 = q - p
	)
	seedWalletUser(t, userId, open)

	funding := &WalletFunding{userId: userId}
	require.NoError(t, funding.PreConsume(p))
	require.NoError(t, funding.PreConsume(q-p))

	// 累计口径：consumed 必须等于两次预扣之和，而不是最后一次的增量。
	require.Equal(t, q, funding.consumed, "consumed 必须累计，不能覆盖")

	quotaAfter, err := model.GetUserQuota(userId, false)
	require.NoError(t, err)
	require.Equal(t, open-q, quotaAfter, "钱包应被扣减两次预扣之和")

	require.NoError(t, funding.Refund())
	quotaFinal, err := model.GetUserQuota(userId, false)
	require.NoError(t, err)
	require.Equal(t, open, quotaFinal, "失败退款必须完整退回全部预扣额（含第一次的 P）")
}

func TestWalletFundingOrgMemberRefundReturnsFullPreConsumed(t *testing.T) {
	const (
		orgId  = 900_100
		userId = 900_101
		// 组织预算 0 表示不限量（model 语义），这里给一个具体值便于断言。
		budget  = int64(5_000_000)
		p       = 200_000
		q       = 700_000
		wallet  = 1_000_000
	)
	seedOrganization(t, orgId, budget)
	seedOrgMember(t, userId, orgId, model.OrgRoleMember, wallet, 0)

	funding := &WalletFunding{userId: userId}
	require.NoError(t, funding.PreConsume(p))
	require.NoError(t, funding.PreConsume(q-p))
	require.Equal(t, q, funding.consumed)

	require.Equal(t, int64(q), orgLedgerUsed(t, orgId), "组织账本应记录两次预扣之和")

	// 组织成员的个人钱包不参与出资，必须纹丝不动。
	personal, err := model.GetUserQuota(userId, false)
	require.NoError(t, err)
	require.Equal(t, wallet, personal)

	require.NoError(t, funding.Refund())
	require.Equal(t, int64(0), orgLedgerUsed(t, orgId), "组织账本必须完整回减（不能只退最后一次的增量）")
}

// ---------------------------------------------------------------------------
// 异步任务 / Midjourney 退款必须回到「出资方」账本
// ---------------------------------------------------------------------------
//
// 提交端按组织出资预扣（WalletFunding.PreConsume → ReserveOrgQuota），而退款端
// taskAdjustFunding 原先只有「订阅 / 个人钱包」两个分支，缺组织分支 —— 组织成员的
// 退款会退进个人钱包，组织 used_quota 永不回减：对账破裂且凭空加款。

func TestTaskAdjustFundingRefundsOrganizationLedger(t *testing.T) {
	const (
		orgId  = 900_200
		userId = 900_201
		budget = int64(5_000_000)
		quota  = 250_000
	)
	seedOrganization(t, orgId, budget)
	seedOrgMember(t, userId, orgId, model.OrgRoleMember, 1_000_000, 0)

	task := &model.Task{UserId: userId, TaskID: "task-org-refund", Platform: "suno"}

	// 先扣（正数）：走组织账本，个人钱包不动。
	require.NoError(t, taskAdjustFunding(task, quota))
	require.Equal(t, int64(quota), orgLedgerUsed(t, orgId))

	// 再退（负数）：必须回组织账本，而不是进个人钱包。
	require.NoError(t, taskAdjustFunding(task, -quota))
	require.Equal(t, int64(0), orgLedgerUsed(t, orgId))

	personal, err := model.GetUserQuota(userId, false)
	require.NoError(t, err)
	require.Equal(t, 1_000_000, personal, "组织成员的退款不得进个人钱包")
}

func TestTaskAdjustFundingUsesPersonalWalletForUnaffiliatedUser(t *testing.T) {
	const (
		userId = 900_301
		open   = 1_000_000
		quota  = 120_000
	)
	seedWalletUser(t, userId, open)

	task := &model.Task{UserId: userId, TaskID: "task-personal-refund", Platform: "suno"}
	require.NoError(t, taskAdjustFunding(task, quota))
	require.NoError(t, taskAdjustFunding(task, -quota))

	quotaFinal, err := model.GetUserQuota(userId, false)
	require.NoError(t, err)
	require.Equal(t, open, quotaFinal, "非组织用户仍应走个人钱包，行为不得改变")
}
