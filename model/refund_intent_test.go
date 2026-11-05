package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
)

// newRefundIntentFixture 建一个余额 100 的用户与一枚 remain=50 的令牌，
// 返回一个「个人钱包 30 + 令牌 20」的 pending 退款意图。
func newRefundIntentFixture(t *testing.T) (User, Token, RefundIntent) {
	t.Helper()
	truncateTables(t)
	resetBatchUpdateTestState(t)

	user := User{
		Username: "refund-intent-user",
		Quota:    100,
		Status:   common.UserStatusEnabled,
	}
	// 直接 Create：User.Insert 会把 Quota 重置为新用户配额。
	require.NoError(t, DB.Create(&user).Error)
	token := createReserveTestToken(t, 50)
	// The fixture represents a real pre-consumption: 20 quota was deducted
	// from the Token, so a refund must restore it without driving used_quota
	// below zero.
	require.NoError(t, DB.Model(&Token{}).Where("id = ?", token.Id).
		Update("used_quota", 20).Error)

	intent := RefundIntent{
		UserId:        user.Id,
		FundingSource: RefundSourceWallet,
		OrgResolved:   true,
		OrgId:         0,
		WalletAmount:  30,
		TokenId:       token.Id,
		TokenConsumed: 20,
	}
	require.NoError(t, CreateRefundIntent(&intent))
	return user, token, intent
}

// TestRefundIntentExecuteAppliesRefundOnce 核心不变量：退款原语与完成标记
// 同事务提交——执行后各账本精确回退；重复执行（崩溃后重放）绝不二次入账。
func TestRefundIntentExecuteAppliesRefundOnce(t *testing.T) {
	user, token, intent := newRefundIntentFixture(t)

	require.NoError(t, ExecuteRefundIntent(intent.Id))
	assert.Equal(t, 130, getUserQuotaFromDB(t, user.Id), "wallet refund applied exactly once")
	reloaded := getTokenFromDB(t, token.Id)
	assert.Equal(t, 70, reloaded.RemainQuota)
	assert.Equal(t, 0, reloaded.UsedQuota)

	var done RefundIntent
	require.NoError(t, DB.First(&done, intent.Id).Error)
	assert.Equal(t, RefundIntentDone, done.Status)

	// 崩溃后重放语义：再次执行必须是无操作。
	require.NoError(t, ExecuteRefundIntent(intent.Id))
	assert.Equal(t, 130, getUserQuotaFromDB(t, user.Id), "replay must not double-refund")
	reloaded = getTokenFromDB(t, token.Id)
	assert.Equal(t, 70, reloaded.RemainQuota)
}

// TestRefundIntentWalletCapBlocksIntent 继承 increaseUserQuota 的上限语义：
// 钱包回退在 MaxWalletQuota 上限附近失败时，整个事务（含令牌退回）回滚，
// 凭证保持 pending 等待重试——不允许出现「令牌退了、钱包没退」的半笔退款。
func TestRefundIntentWalletCapBlocksIntent(t *testing.T) {
	user, token, intent := newRefundIntentFixture(t)
	// 把用户余额推到只剩 (MaxWalletQuota - WalletAmount) 的空间之下。
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).
		Update("quota", common.MaxWalletQuota-10).Error)

	err := ExecuteRefundIntent(intent.Id)
	require.Error(t, err)

	assert.Equal(t, common.MaxWalletQuota-10, getUserQuotaFromDB(t, user.Id), "wallet untouched on failure")
	reloaded := getTokenFromDB(t, token.Id)
	assert.Equal(t, 50, reloaded.RemainQuota, "token refund must roll back with the wallet")
	var pending RefundIntent
	require.NoError(t, DB.First(&pending, intent.Id).Error)
	assert.Equal(t, RefundIntentPending, pending.Status)
}

// TestSweepPendingRefundIntentsSurfacesExecutionFailure ensures a stale intent
// that cannot be safely refunded remains pending and makes the recovery pass fail.
func TestSweepPendingRefundIntentsSurfacesExecutionFailure(t *testing.T) {
	user, _, intent := newRefundIntentFixture(t)
	require.NoError(t, DB.Model(&RefundIntent{}).Where("id = ?", intent.Id).
		Updates(map[string]any{"org_resolved": false, "update_time": common.GetTimestamp() - 3600}).Error)

	n, err := SweepPendingRefundIntents(120, 200)
	require.Error(t, err)
	assert.Equal(t, 0, n)
	assert.Equal(t, 100, getUserQuotaFromDB(t, user.Id))

	var pending RefundIntent
	require.NoError(t, DB.First(&pending, intent.Id).Error)
	assert.Equal(t, RefundIntentPending, pending.Status)
}

// TestSweepPendingRefundIntents 扫描只重放滞留（超过 stale 阈值）的 pending
// 凭证，执行成功后收口；新鲜凭证与 done 凭证不受影响。
func TestSweepPendingRefundIntents(t *testing.T) {
	user, _, intent := newRefundIntentFixture(t)

	// 新鲜凭证：不应被扫描触碰。
	n, err := SweepPendingRefundIntents(120, 200)
	require.NoError(t, err)
	assert.Equal(t, 0, n)
	assert.Equal(t, 100, getUserQuotaFromDB(t, user.Id))

	// 人为把凭证做旧 → 扫描重放成功。
	require.NoError(t, DB.Model(&RefundIntent{}).Where("id = ?", intent.Id).
		Update("update_time", common.GetTimestamp()-3600).Error)
	n, err = SweepPendingRefundIntents(120, 200)
	require.NoError(t, err)
	assert.Equal(t, 1, n)
	assert.Equal(t, 130, getUserQuotaFromDB(t, user.Id))

	// 已收口凭证：再次扫描不产生任何动作。
	n, err = SweepPendingRefundIntents(120, 200)
	require.NoError(t, err)
	assert.Equal(t, 0, n)
	assert.Equal(t, 130, getUserQuotaFromDB(t, user.Id))
}

// TestRefundIntentUnresolvedOrgRefusesExecution 组织归属未解析的凭证必须拒绝
// 执行（防止把组织预扣退成个人余额），且保持 pending 可人工介入。
func TestRefundIntentUnresolvedOrgRefusesExecution(t *testing.T) {
	_, _, intent := newRefundIntentFixture(t)
	require.NoError(t, DB.Model(&RefundIntent{}).Where("id = ?", intent.Id).
		Update("org_resolved", false).Error)

	require.Error(t, ExecuteRefundIntent(intent.Id))
	var pending RefundIntent
	require.NoError(t, DB.First(&pending, intent.Id).Error)
	assert.Equal(t, RefundIntentPending, pending.Status)
}

// TestSweepPendingRefundIntentsSurfacesExecutionFailure ensures a stale intent
// that cannot be safely refunded remains pending and makes the recovery pass fail.
func TestSweepPendingRefundIntentsSurfacesExecutionFailure(t *testing.T) {
	user, _, intent := newRefundIntentFixture(t)
	require.NoError(t, DB.Model(&RefundIntent{}).Where("id = ?", intent.Id).
		Updates(map[string]any{"org_resolved": false, "update_time": common.GetTimestamp() - 3600}).Error)

	n, err := SweepPendingRefundIntents(120, 200)
	require.Error(t, err)
	assert.Equal(t, 0, n)
	assert.Equal(t, 100, getUserQuotaFromDB(t, user.Id))

	var pending RefundIntent
	require.NoError(t, DB.First(&pending, intent.Id).Error)
	assert.Equal(t, RefundIntentPending, pending.Status)
}

