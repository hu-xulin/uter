package model

import (
	"strconv"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

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
		IdempotencyKey: "test-refund-intent:" + strconv.Itoa(user.Id),
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

func TestValidateRefundIntentRejectsMalformedLedgerSnapshots(t *testing.T) {
	validWallet := RefundIntent{
		UserId: 1, IdempotencyKey: "valid-wallet", FundingSource: RefundSourceWallet,
		OrgResolved: true, WalletAmount: 10,
	}
	validSubscription := RefundIntent{
		UserId: 1, IdempotencyKey: "valid-subscription", FundingSource: RefundSourceSubscription,
		SubRequestId: "request-1", SubId: 2, SubExtra: 5,
	}
	tests := []struct {
		name   string
		intent RefundIntent
	}{
		{name: "negative wallet amount", intent: func() RefundIntent { v := validWallet; v.WalletAmount = -1; return v }()},
		{name: "unresolved wallet owner", intent: func() RefundIntent { v := validWallet; v.OrgResolved = false; return v }()},
		{name: "negative organization", intent: func() RefundIntent { v := validWallet; v.OrgId = -1; return v }()},
		{name: "wallet with subscription fields", intent: func() RefundIntent { v := validWallet; v.SubRequestId = "request-1"; return v }()},
		{name: "negative token amount", intent: func() RefundIntent { v := validWallet; v.TokenConsumed = -1; return v }()},
		{name: "token amount without token id", intent: func() RefundIntent { v := validWallet; v.TokenConsumed = 1; return v }()},
		{name: "subscription without idempotency key", intent: func() RefundIntent { v := validSubscription; v.SubRequestId = ""; return v }()},
		{name: "subscription extra without subscription id", intent: func() RefundIntent { v := validSubscription; v.SubId = 0; return v }()},
		{name: "subscription with wallet amount", intent: func() RefundIntent { v := validSubscription; v.WalletAmount = 1; return v }()},
		{name: "negative subscription extra", intent: func() RefundIntent { v := validSubscription; v.SubExtra = -1; return v }()},
		{name: "unknown funding source", intent: RefundIntent{UserId: 1, IdempotencyKey: "unknown", FundingSource: "unknown"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Error(t, validateRefundIntent(&tt.intent))
		})
	}
}

func TestCreateRefundIntentRejectsNonPendingStatus(t *testing.T) {
	intent := RefundIntent{
		UserId: 1, IdempotencyKey: "non-pending", FundingSource: RefundSourceWallet,
		OrgResolved: true, WalletAmount: 1, Status: RefundIntentDone,
	}
	require.Error(t, CreateRefundIntent(&intent))
}

func TestCreateRefundIntentReusesOnlyIdenticalIdempotencySnapshot(t *testing.T) {
	_, _, original := newRefundIntentFixture(t)

	replay := original
	replay.Id = 0
	replay.Status = ""
	require.NoError(t, CreateRefundIntent(&replay))
	assert.Equal(t, original.Id, replay.Id, "same logical refund must reuse its durable intent")

	collision := original
	collision.Id = 0
	collision.Status = ""
	collision.WalletAmount++
	require.Error(t, CreateRefundIntent(&collision), "same key with a different amount must fail closed")

	var rows int64
	require.NoError(t, DB.Model(&RefundIntent{}).Where("idempotency_key = ?", original.IdempotencyKey).Count(&rows).Error)
	assert.EqualValues(t, 1, rows, "one durable intent per logical refund")
}

func TestUsageAdjustmentHelpersReturnMissingLedgerRows(t *testing.T) {
	_, _, _ = newRefundIntentFixture(t)
	batchEnabled := common.BatchUpdateEnabled
	common.BatchUpdateEnabled = false
	defer func() { common.BatchUpdateEnabled = batchEnabled }()

	require.Error(t, UpdateUserUsedQuotaWithError(2147483000, -1))
	require.Error(t, UpdateChannelUsedQuotaWithError(2147483000, -1))
}

func TestApplyTaskRefundUsageAtomicallyDrainsBatchDeltas(t *testing.T) {
	user, _, _ := newRefundIntentFixture(t)
	channel := Channel{Key: "refund-usage-channel", Type: 1, Status: 1}
	require.NoError(t, DB.Create(&channel).Error)

	addNewRecord(BatchUpdateTypeUsedQuota, user.Id, 50)
	addNewRecord(BatchUpdateTypeChannelUsedQuota, channel.Id, 50)
	require.NoError(t, ApplyTaskRefundUsage(user.Id, channel.Id, 30))

	var storedUser User
	require.NoError(t, DB.Select("id", "used_quota").First(&storedUser, user.Id).Error)
	var storedChannel Channel
	require.NoError(t, DB.Select("id", "used_quota").First(&storedChannel, channel.Id).Error)
	assert.EqualValues(t, 20, storedUser.UsedQuota)
	assert.EqualValues(t, 20, storedChannel.UsedQuota)
	assert.NotContains(t, batchUpdateStores[BatchUpdateTypeUsedQuota], user.Id)
	assert.NotContains(t, batchUpdateStores[BatchUpdateTypeChannelUsedQuota], channel.Id)
}

func TestApplyTaskRefundUsageKeepsQueuedDeltasOnFailure(t *testing.T) {
	user, _, _ := newRefundIntentFixture(t)
	addNewRecord(BatchUpdateTypeUsedQuota, user.Id, 30)

	err := ApplyTaskRefundUsage(user.Id, 2147483000, 30)
	require.Error(t, err)
	assert.Equal(t, 30, batchUpdateStores[BatchUpdateTypeUsedQuota][user.Id])
	assert.Equal(t, 100, getUserQuotaFromDB(t, user.Id))
}

func TestApplyTaskBillingUsageDeltaFlushesQueueForZeroDelta(t *testing.T) {
	user, _, _ := newRefundIntentFixture(t)
	addNewRecord(BatchUpdateTypeUsedQuota, user.Id, 3000)
	require.NoError(t, ApplyTaskBillingUsageDelta(user.Id, 0, 0))

	var stored User
	require.NoError(t, DB.Select("id", "used_quota").First(&stored, user.Id).Error)
	assert.EqualValues(t, 3000, stored.UsedQuota)
	assert.NotContains(t, batchUpdateStores[BatchUpdateTypeUsedQuota], user.Id)
}

func TestAdjustUserUsedQuotaRejectsUnderflow(t *testing.T) {
	user, _, _ := newRefundIntentFixture(t)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Update("used_quota", 100).Error)

	require.Error(t, AdjustUserUsedQuota(user.Id, -101))
	var stored User
	require.NoError(t, DB.Select("id", "used_quota").First(&stored, user.Id).Error)
	assert.EqualValues(t, 100, stored.UsedQuota)

	require.NoError(t, AdjustUserUsedQuota(user.Id, -100))
	require.NoError(t, DB.Select("id", "used_quota").First(&stored, user.Id).Error)
	assert.Zero(t, stored.UsedQuota)
}


// TestSubscriptionRefundIntentRollsBackAllLegs verifies that the original
// subscription pre-consumption and its idempotency record roll back when a
// later Token ledger leg fails.
func TestSubscriptionRefundIntentRollsBackAllLegs(t *testing.T) {
	previousDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&UserSubscription{}, &SubscriptionPreConsumeRecord{}, &RefundIntent{}, &Token{}))
	DB = db
	t.Cleanup(func() {
		DB = previousDB
		_ = sqlDB.Close()
	})

	sub := UserSubscription{UserId: 7, PlanId: 3, AmountTotal: 100, AmountUsed: 40, Status: "active"}
	require.NoError(t, db.Create(&sub).Error)
	record := SubscriptionPreConsumeRecord{
		RequestId: "atomic-sub-refund", UserId: 7, UserSubscriptionId: sub.Id,
		PreConsumed: 20, Status: "consumed",
	}
	require.NoError(t, db.Create(&record).Error)
	intent := RefundIntent{
		UserId: 7, IdempotencyKey: "atomic-sub-refund-intent",
		FundingSource: RefundSourceSubscription, SubRequestId: record.RequestId,
		SubId: sub.Id, TokenId: 999999, TokenConsumed: 5,
	}
	require.NoError(t, CreateRefundIntent(&intent))

	require.Error(t, ExecuteRefundIntent(intent.Id), "missing Token must fail the complete refund transaction")
	var savedSub UserSubscription
	require.NoError(t, db.First(&savedSub, sub.Id).Error)
	require.EqualValues(t, 40, savedSub.AmountUsed, "subscription usage must roll back")
	var savedRecord SubscriptionPreConsumeRecord
	require.NoError(t, db.First(&savedRecord, record.Id).Error)
	require.Equal(t, "consumed", savedRecord.Status, "pre-consumption receipt must roll back")
	var savedIntent RefundIntent
	require.NoError(t, db.First(&savedIntent, intent.Id).Error)
	require.Equal(t, RefundIntentPending, savedIntent.Status, "intent remains retryable")
}

// TestSubscriptionRefundIntentCommitsOnce verifies the successful subscription
// path and replay behavior after the entire intent commits.
func TestSubscriptionRefundIntentCommitsOnce(t *testing.T) {
	previousDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&UserSubscription{}, &SubscriptionPreConsumeRecord{}, &RefundIntent{}, &Token{}))
	DB = db
	t.Cleanup(func() {
		DB = previousDB
		_ = sqlDB.Close()
	})

	sub := UserSubscription{UserId: 8, PlanId: 4, AmountTotal: 100, AmountUsed: 40, Status: "active"}
	require.NoError(t, db.Create(&sub).Error)
	record := SubscriptionPreConsumeRecord{
		RequestId: "atomic-sub-refund-success", UserId: 8, UserSubscriptionId: sub.Id,
		PreConsumed: 20, Status: "consumed",
	}
	require.NoError(t, db.Create(&record).Error)
	intent := RefundIntent{
		UserId: 8, IdempotencyKey: "atomic-sub-refund-success-intent",
		FundingSource: RefundSourceSubscription, SubRequestId: record.RequestId, SubId: sub.Id,
	}
	require.NoError(t, CreateRefundIntent(&intent))

	require.NoError(t, ExecuteRefundIntent(intent.Id))
	require.NoError(t, ExecuteRefundIntent(intent.Id), "replay must be a no-op")
	var savedSub UserSubscription
	require.NoError(t, db.First(&savedSub, sub.Id).Error)
	require.EqualValues(t, 20, savedSub.AmountUsed)
	var savedRecord SubscriptionPreConsumeRecord
	require.NoError(t, db.First(&savedRecord, record.Id).Error)
	require.Equal(t, "refunded", savedRecord.Status)
	var savedIntent RefundIntent
	require.NoError(t, db.First(&savedIntent, intent.Id).Error)
	require.Equal(t, RefundIntentDone, savedIntent.Status)
}
