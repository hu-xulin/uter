package model

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func createMidjourneyRefundFixture(t *testing.T, tokenApplied bool) (*User, *Token, *Channel, *Midjourney) {
	t.Helper()
	truncateTables(t)
	resetBatchUpdateTestState(t)
	require.NoError(t, DB.AutoMigrate(&Midjourney{}, &MidjourneyRefundOperation{}, &MidjourneyRefundOutbox{}))

	user := createReserveTestUser(t, 100)
	channel := Channel{Name: "mj-refund-transaction", Key: "mj-refund-transaction-key", Status: 1, UsedQuota: 40}
	require.NoError(t, DB.Create(&channel).Error)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Update("used_quota", 40).Error)

	var token *Token
	tokenID := 0
	if tokenApplied {
		token = createReserveTestToken(t, 60)
		tokenID = token.Id
		require.NoError(t, DB.Model(&Token{}).Where("id = ?", token.Id).Updates(map[string]any{
			"remain_quota": 60,
			"used_quota":   40,
		}).Error)
	}

	task := &Midjourney{
		UserId:               user.Id,
		MjId:                 "mj-refund-fixture",
		Quota:                40,
		TokenId:              tokenID,
		ChannelId:            channel.Id,
		BillingChannelId:     channel.Id,
		BillingVersion:       1,
		BillingStatus:        "applied",
		BillingWalletApplied: true,
		BillingTokenApplied:  tokenApplied,
	}
	if !tokenApplied {
		task.BillingStatus = "partial"
	}
	require.NoError(t, task.Insert())
	return user, token, &channel, task
}

func TestRefundMidjourneyTaskBillingIsAtomicAndIdempotent(t *testing.T) {
	user, token, channel, task := createMidjourneyRefundFixture(t, true)

	require.NoError(t, RefundMidjourneyTaskBilling(task.Id, "upstream task failed"))
	require.NoError(t, RefundMidjourneyTaskBilling(task.Id, "duplicate retry"))

	assert.Equal(t, 140, getUserQuotaFromDB(t, user.Id))
	storedToken := getTokenFromDB(t, token.Id)
	assert.Equal(t, 100, storedToken.RemainQuota)
	assert.Zero(t, storedToken.UsedQuota)

	var storedUser User
	require.NoError(t, DB.Select("used_quota").First(&storedUser, user.Id).Error)
	assert.Zero(t, storedUser.UsedQuota)
	var storedChannel Channel
	require.NoError(t, DB.Select("used_quota").First(&storedChannel, channel.Id).Error)
	assert.Zero(t, storedChannel.UsedQuota)

	var storedTask Midjourney
	require.NoError(t, DB.First(&storedTask, task.Id).Error)
	assert.Zero(t, storedTask.Quota)
	assert.Equal(t, "refunded", storedTask.BillingStatus)

	var op MidjourneyRefundOperation
	require.NoError(t, DB.Where("midjourney_task_id = ?", task.Id).First(&op).Error)
	assert.Equal(t, MidjourneyRefundCompleted, op.Status)
	var event MidjourneyRefundOutbox
	require.NoError(t, DB.Where("refund_operation_id = ?", op.ID).First(&event).Error)
	assert.Equal(t, MidjourneyRefundOutboxPending, event.Status)
}

func TestRefundMidjourneyTaskBillingSupportsWalletOnlyPartialCharge(t *testing.T) {
	user, _, channel, task := createMidjourneyRefundFixture(t, false)

	require.NoError(t, RefundMidjourneyTaskBilling(task.Id, "token deduction failed"))
	assert.Equal(t, 140, getUserQuotaFromDB(t, user.Id))

	var storedUser User
	require.NoError(t, DB.Select("used_quota").First(&storedUser, user.Id).Error)
	assert.Zero(t, storedUser.UsedQuota)
	var storedChannel Channel
	require.NoError(t, DB.Select("used_quota").First(&storedChannel, channel.Id).Error)
	assert.Zero(t, storedChannel.UsedQuota)
}

func TestRefundMidjourneyTaskBillingQuarantinesLegacyAmbiguousTask(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)
	require.NoError(t, DB.AutoMigrate(&Midjourney{}, &MidjourneyRefundOperation{}, &MidjourneyRefundOutbox{}))
	user := createReserveTestUser(t, 100)
	channel := Channel{Name: "mj-refund-legacy", Key: "mj-refund-legacy-key", Status: 1, UsedQuota: 40}
	require.NoError(t, DB.Create(&channel).Error)
	task := &Midjourney{UserId:    user.Id, MjId: "mj-legacy-ambiguous", Quota: 40, ChannelId: channel.Id}
	require.NoError(t, task.Insert())

	err := RefundMidjourneyTaskBilling(task.Id, "legacy task")
	require.ErrorIs(t, err, ErrMidjourneyRefundReconciliationRequired)
	assert.Equal(t, 100, getUserQuotaFromDB(t, user.Id))

	var op MidjourneyRefundOperation
	require.NoError(t, DB.Where("midjourney_task_id = ?", task.Id).First(&op).Error)
	assert.Equal(t, MidjourneyRefundReconciliationRequired, op.Status)
	err = RefundMidjourneyTaskBilling(task.Id, "retry")
	require.ErrorIs(t, err, ErrMidjourneyRefundReconciliationRequired)
}

func TestRefundMidjourneyTaskBillingRollsBackOnUsageUnderflow(t *testing.T) {
	user, token, channel, task := createMidjourneyRefundFixture(t, true)
	require.NoError(t, DB.Model(&Channel{}).Where("id = ?", channel.Id).Update("used_quota", 1).Error)

	err := RefundMidjourneyTaskBilling(task.Id, "usage ledger underflow")
	require.ErrorIs(t, err, ErrMidjourneyRefundReconciliationRequired)
	assert.Equal(t, 100, getUserQuotaFromDB(t, user.Id))
	storedToken := getTokenFromDB(t, token.Id)
	assert.Equal(t, 60, storedToken.RemainQuota)
	assert.Equal(t, 40, storedToken.UsedQuota)
	var storedTask Midjourney
	require.NoError(t, DB.First(&storedTask, task.Id).Error)
	assert.Equal(t, 40, storedTask.Quota)
	assert.Equal(t, "reconciliation_required", storedTask.BillingStatus)
	var op MidjourneyRefundOperation
	require.NoError(t, DB.Where("midjourney_task_id = ?", task.Id).First(&op).Error)
	assert.Equal(t, MidjourneyRefundReconciliationRequired, op.Status)
}

func TestFindPendingMidjourneyRefundTaskIDsStopsAfterRefundOrReconciliation(t *testing.T) {
	user, token, channel, task := createMidjourneyRefundFixture(t, true)
	require.NoError(t, DB.Model(&Midjourney{}).Where("id = ?", task.Id).Update("status", "FAILURE").Error)

	taskIDs, err := FindPendingMidjourneyRefundTaskIDs(10)
	require.NoError(t, err)
	assert.Equal(t, []int{task.Id}, taskIDs)

	require.NoError(t, RefundMidjourneyTaskBilling(task.Id, "terminal task failure"))
	taskIDs, err = FindPendingMidjourneyRefundTaskIDs(10)
	require.NoError(t, err)
	assert.Empty(t, taskIDs)

	// A second failed task with no durable billing snapshot is quarantined,
	// then excluded from automatic retry until an operator reconciles it.
	legacy := &Midjourney{
		UserId:    user.Id,
		MjId:      "mj-refund-legacy-sweep",
		Quota:     5,
		ChannelId: channel.Id,
		Status:    "FAILURE",
	}
	require.NoError(t, legacy.Insert())
	taskIDs, err = FindPendingMidjourneyRefundTaskIDs(10)
	require.NoError(t, err)
	assert.Equal(t, []int{legacy.Id}, taskIDs)
	err = RefundMidjourneyTaskBilling(legacy.Id, "legacy task")
	require.ErrorIs(t, err, ErrMidjourneyRefundReconciliationRequired)
	taskIDs, err = FindPendingMidjourneyRefundTaskIDs(10)
	require.NoError(t, err)
	assert.Empty(t, taskIDs)

	// Ensure the first task's financial state was not touched a second time.
	assert.Equal(t, 140, getUserQuotaFromDB(t, user.Id))
	storedToken := getTokenFromDB(t, token.Id)
	assert.Equal(t, 100, storedToken.RemainQuota)
}
