package service

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

// ===========================================================================
// 清单第七章：异步任务结算/退款的可靠失败恢复
//
// 覆盖四类不变量：
//  1. 幂等：重复结算、重复退款不得二次动账；
//  2. 部分失败可恢复：资金动账成功但任务记录写回失败时，重试不能重复扣费；
//  3. 状态可观测：失败原因、重试次数、幂等标识都落库可查；
//  4. 对账：任务已终态但计费未收口的行能被捞出来。
// ===========================================================================

// TestTaskBillingTransitionClaimsExactlyOnce 验证 CAS 抢占只放行一个请求。
func TestTaskBillingTransitionClaimsExactlyOnce(t *testing.T) {
	truncate(t)
	task := makeTask(t, 1, 1, 5000, 1, BillingSourceWallet, 0)

	fromQuota := 5000
	toQuota := 3000
	won, err := model.TransitionTaskBilling(task.TaskID, model.TaskBillingTransition{
		FromState: model.TaskBillingPending,
		ToState:   model.TaskBillingSettlementPending,
		FromQuota: &fromQuota,
		ToQuota:   &toQuota,
	})
	require.NoError(t, err)
	assert.True(t, won, "第一个请求应当赢得抢占")

	// 同一个起止状态再抢一次：不得命中。
	won, err = model.TransitionTaskBilling(task.TaskID, model.TaskBillingTransition{
		FromState: model.TaskBillingPending,
		ToState:   model.TaskBillingSettlementPending,
		FromQuota: &fromQuota,
		ToQuota:   &toQuota,
	})
	require.NoError(t, err)
	assert.False(t, won, "第二个请求不得再次抢占")

	// quota 也参与 CAS：拿着过期快照（旧 quota）抢不动。
	staleQuota := 5000
	won, err = model.TransitionTaskBilling(task.TaskID, model.TaskBillingTransition{
		FromState: model.TaskBillingSettlementPending,
		ToState:   model.TaskBillingSettled,
		FromQuota: &staleQuota,
	})
	require.NoError(t, err)
	assert.False(t, won, "quota 已变，过期快照不得命中")

	// 用正确的新 quota 才能收口。
	require.NoError(t, err)
	won, err = model.TransitionTaskBilling(task.TaskID, model.TaskBillingTransition{
		FromState: model.TaskBillingSettlementPending,
		ToState:   model.TaskBillingSettled,
		FromQuota: &toQuota,
	})
	require.NoError(t, err)
	assert.True(t, won)

	stored, err := model.LoadTaskBillingSnapshot(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, model.TaskBillingSettled, stored.BillingState)
	assert.Equal(t, 3000, stored.Quota)
}

// TestTaskBillingIdempotencyKeyDistinguishesTargets 验证幂等标识把目标额度编进去。
func TestTaskBillingIdempotencyKeyDistinguishesTargets(t *testing.T) {
	keyA := model.TaskBillingIdempotencyKey("task-1", model.TaskBillingOperationSettle, 3000)
	keyB := model.TaskBillingIdempotencyKey("task-1", model.TaskBillingOperationSettle, 4000)
	keyC := model.TaskBillingIdempotencyKey("task-1", model.TaskBillingOperationRefund, 3000)
	keyD := model.TaskBillingIdempotencyKey("task-2", model.TaskBillingOperationSettle, 3000)

	assert.NotEqual(t, keyA, keyB, "同一任务的不同目标额度必须是不同标识")
	assert.NotEqual(t, keyA, keyC, "同一任务的不同操作必须是不同标识")
	assert.NotEqual(t, keyA, keyD, "不同任务必须是不同标识")
	assert.Equal(t, keyA, model.TaskBillingIdempotencyKey("task-1", model.TaskBillingOperationSettle, 3000),
		"相同输入必须得到相同标识")
}

// TestRefundTaskQuotaIsIdempotent 覆盖「人工重试时发生重复退款」：第二次退款
// 必须被幂等屏障挡下，资金只退一次。
func TestRefundTaskQuotaIsIdempotent(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 31, 31, 131
	const initQuota, preConsumed = 10000, 3000
	const tokenRemain = 5000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-idem-refund", tokenRemain)
	seedChannel(t, channelID)
	seedChargedAccounting(t, userID, channelID, tokenID, preConsumed, 1)

	task := makeTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)

	require.True(t, RefundTaskQuota(ctx, task, "task failed: upstream error"))
	assert.Equal(t, initQuota+preConsumed, getUserQuota(t, userID), "第一次退款应到账")

	// 模拟人工重试 / 轮询重复触发：任务记录的 quota 已归零，屏障必须挡住。
	require.True(t, RefundTaskQuota(ctx, task, "retry after refund"))
	assert.Equal(t, initQuota+preConsumed, getUserQuota(t, userID), "不得二次退款")

	stored, err := model.LoadTaskBillingSnapshot(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, model.TaskBillingRefunded, stored.BillingState)
	assert.Zero(t, stored.Quota)
	assert.NotEmpty(t, stored.BillingIdempotencyKey, "幂等标识必须落库可查")
}

// TestRecalculateTaskQuotaIsIdempotent 覆盖「重复结算不得二次扣费」。
func TestRecalculateTaskQuotaIsIdempotent(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 32, 32, 132
	const initQuota, preConsumed, actualQuota = 10000, 2000, 3000
	const tokenRemain = 5000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-idem-settle", tokenRemain)
	seedChannel(t, channelID)
	seedChargedAccounting(t, userID, channelID, tokenID, preConsumed, 1)

	task := makeTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)

	RecalculateTaskQuota(ctx, task, actualQuota, newTestMessage("adaptor adjustment"))
	afterFirst := getUserQuota(t, userID)
	assert.Equal(t, initQuota-(actualQuota-preConsumed), afterFirst)
	assert.Equal(t, actualQuota, task.Quota)

	// 用同一个任务对象再结算一次（模拟轮询重复触发）。
	RecalculateTaskQuota(ctx, task, actualQuota, newTestMessage("adaptor adjustment"))
	assert.Equal(t, afterFirst, getUserQuota(t, userID), "不得二次扣费")
	assert.Equal(t, actualQuota, task.Quota)

	stored, err := model.LoadTaskBillingSnapshot(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, model.TaskBillingSettled, stored.BillingState)
	assert.Equal(t, actualQuota, stored.Quota)
}

// TestRecalculateTaskQuotaFundingFailureKeepsTaskReservable 覆盖「结算失败时
// 保留可重试记录」：资金调整失败后，任务必须回到可重试状态且 quota 未被推进，
// 否则重试会按错误基数再算一次差额。
func TestRecalculateTaskQuotaFundingFailureKeepsTaskReservable(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 33, 33, 133
	const initQuota, preConsumed, actualQuota = 10000, 2000, 3000
	const tokenRemain = 5000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-settle-fail", tokenRemain)
	seedChannel(t, channelID)
	seedChargedAccounting(t, userID, channelID, tokenID, preConsumed, 1)

	// 出资组织指向一个不存在的组织：IncrOrgUsedQuota 会因「组织不存在」报错，
	// 于是一次差额补扣就足以触发资金调整失败。
	// （不能靠删用户行制造失败——个人钱包扣款默认走缓存累加，不立刻读库。）
	missingOrg := 999999
	task := makeTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.PrivateData.OrganizationId = &missingOrg
	require.NoError(t, model.DB.Model(task).Update("private_data", task.PrivateData).Error)

	RecalculateTaskQuota(ctx, task, actualQuota, newTestMessage("adaptor adjustment"))

	// 任务记录的 quota 必须仍等于预扣值，不能被推进到 actualQuota。
	stored, err := model.LoadTaskBillingSnapshot(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, preConsumed, stored.Quota, "结算失败不得推进任务 quota")
	assert.NotEqual(t, model.TaskBillingSettled, stored.BillingState, "结算失败不得进入终态")
	assert.Positive(t, stored.BillingRetryCount, "重试次数必须被记录")
	assert.NotEmpty(t, stored.BillingLastError, "失败原因必须落库")
	assert.Contains(t, stored.BillingLastError, "organization")

	// 资金一侧也不得被扣：补扣从未发生。
	assert.Equal(t, initQuota, getUserQuota(t, userID), "结算失败不得扣动用户钱包")

	// 故障恢复后重试同一笔结算：把出资组织改回平台直管，应当成功且只补扣一次。
	platformOrg := 0
	task.PrivateData.OrganizationId = &platformOrg
	require.NoError(t, model.DB.Model(task).Update("private_data", task.PrivateData).Error)
	RecalculateTaskQuota(ctx, task, actualQuota, newTestMessage("adaptor adjustment"))
	assert.Equal(t, initQuota-(actualQuota-preConsumed), getUserQuota(t, userID),
		"恢复后应只补扣一次差额")
	assert.Equal(t, actualQuota, task.Quota)

	recovered, err := model.LoadTaskBillingSnapshot(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, model.TaskBillingSettled, recovered.BillingState)
}

// TestListTasksAwaitingBillingFinalityFindsStuckTasks 覆盖对账任务的取数逻辑。
func TestListTasksAwaitingBillingFinalityFindsStuckTasks(t *testing.T) {
	truncate(t)

	stuck := makeTask(t, 1, 1, 1000, 1, BillingSourceWallet, 0)
	fromQuota := 1000
	toQuota := 0
	_, err := model.TransitionTaskBilling(stuck.TaskID, model.TaskBillingTransition{
		FromState: model.TaskBillingPending,
		ToState:   model.TaskBillingRefundPending,
		FromQuota: &fromQuota,
		ToQuota:   &toQuota,
	})
	require.NoError(t, err)

	settled := makeTask(t, 1, 1, 2000, 1, BillingSourceWallet, 0)
	fromQuota2 := 2000
	_, err = model.TransitionTaskBilling(settled.TaskID, model.TaskBillingTransition{
		FromState: model.TaskBillingPending,
		ToState:   model.TaskBillingSettled,
		FromQuota: &fromQuota2,
		ToQuota:   &fromQuota2,
	})
	require.NoError(t, err)

	// 截止时间取未来：olderThan 是「最后更新早于该时间」的截止线，用来给在途
	// 请求留出完成时间，因此测试要显式给一个足够大的值才能把刚卡住的行捞出。
	tasks, err := model.ListTasksAwaitingBillingFinality(100, time.Now().Unix()+60)
	require.NoError(t, err)
	require.Len(t, tasks, 1, "只有卡在中间态的任务应被捞出")
	assert.Equal(t, stuck.TaskID, tasks[0].TaskID)

	// 截止时间取过去：刚更新的行应当被放过（它可能正在正常处理中）。
	tasks, err = model.ListTasksAwaitingBillingFinality(100, time.Now().Unix()-60)
	require.NoError(t, err)
	assert.Empty(t, tasks, "刚更新的任务不应被判为卡死")

	// 已收口的任务不应出现在待处理列表里。
	reconciled, err := model.ListTasksRequiringReconciliation(100)
	require.NoError(t, err)
	assert.Empty(t, reconciled)
}

// TestMarkTaskBillingForReconciliationRecordsReason 覆盖「明确转入人工处理
// 队列」：原因必须落库，且重复标记不会叠加重试计数之外的副作用。
func TestMarkTaskBillingForReconciliationRecordsReason(t *testing.T) {
	truncate(t)
	task := makeTask(t, 1, 1, 1000, 1, BillingSourceWallet, 0)

	require.NoError(t, model.MarkTaskBillingForReconciliation(task.TaskID, "funding source unresolvable"))

	stored, err := model.LoadTaskBillingSnapshot(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, model.TaskBillingReconciliationRequired, stored.BillingState)
	assert.Contains(t, stored.BillingLastError, "unresolvable")

	listed, err := model.ListTasksRequiringReconciliation(100)
	require.NoError(t, err)
	require.Len(t, listed, 1)
	assert.Equal(t, task.TaskID, listed[0].TaskID)

	// 重复标记是幂等的。
	require.NoError(t, model.MarkTaskBillingForReconciliation(task.TaskID, "second attempt"))
	listed, err = model.ListTasksRequiringReconciliation(100)
	require.NoError(t, err)
	require.Len(t, listed, 1)
}

// TestRefundTaskQuotaWithoutFundingSnapshotGoesToReconciliation 覆盖「资金来源
// 无法可靠确定」的任务：既不能猜组织也不能猜个人钱包，必须转人工核对，
// 且不能动任何一本账。
func TestRefundTaskQuotaWithoutFundingSnapshotGoesToReconciliation(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 34, 34, 134
	const initQuota, preConsumed = 10000, 3000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-no-snapshot", 5000)
	seedChannel(t, channelID)

	// 历史任务：没有任何组织快照。
	task := &model.Task{
		TaskID:    "legacy-no-snapshot",
		UserId:    userID,
		ChannelId: channelID,
		Quota:     preConsumed,
		Status:    model.TaskStatusFailure,
		Group:     "default",
		Data:      []byte(`{}`),
		PrivateData: model.TaskPrivateData{
			BillingSource: BillingSourceWallet,
			TokenId:       tokenID,
		},
	}
	require.NoError(t, model.DB.Create(task).Error)

	assert.False(t, RefundTaskQuota(ctx, task, "task failed"), "无快照的任务不得被退款")

	// 两本账都不能动。
	assert.Equal(t, initQuota, getUserQuota(t, userID), "个人钱包不得被改动")
	assert.Equal(t, 5000, getTokenRemainQuota(t, tokenID), "令牌额度不得被改动")

	// 任务必须留在可重试状态，等待转人工。
	stored, err := model.LoadTaskBillingSnapshot(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, preConsumed, stored.Quota, "退款失败不得清零任务额度")
	assert.NotEqual(t, model.TaskBillingRefunded, stored.BillingState)
}

// TestTaskBillingStateMachineRejectsUnknownSource 覆盖 fail-closed：状态机
// 不认识的目标状态必须报错，不能静默写成任意值。
func TestTaskBillingStateMachineRejectsInvalidTransition(t *testing.T) {
	truncate(t)
	task := makeTask(t, 1, 1, 1000, 1, BillingSourceWallet, 0)

	_, err := model.TransitionTaskBilling("", model.TaskBillingTransition{
		FromState: model.TaskBillingPending,
		ToState:   model.TaskBillingSettled,
	})
	assert.Error(t, err, "空任务 ID 必须报错")

	_, err = model.TransitionTaskBilling(task.TaskID, model.TaskBillingTransition{
		FromState: "",
		ToState:   model.TaskBillingSettled,
	})
	assert.Error(t, err, "缺失起始状态必须报错")
}

// newTestMessage 构造一个结算原因消息。
func newTestMessage(text string) *common.Message {
	return common.NewMessage(text)
}


func TestTaskBillingRetryCountIncrementsOnlyWithSuccessfulCAS(t *testing.T) {
	truncate(t)
	task := makeTask(t, 51, 151, 5000, 0, BillingSourceWallet, 0)
	fromQuota, toQuota := 5000, 3000
	transition := model.TaskBillingTransition{
		FromState: model.TaskBillingPending,
		ToState: model.TaskBillingSettlementPending,
		FromQuota: &fromQuota,
		ToQuota: &toQuota,
		RetryCountIncrement: true,
	}
	won, err := model.TransitionTaskBilling(task.TaskID, transition)
	require.NoError(t, err)
	require.True(t, won)
	won, err = model.TransitionTaskBilling(task.TaskID, transition)
	require.NoError(t, err)
	require.False(t, won)

	stored, err := model.LoadTaskBillingSnapshot(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, 1, stored.BillingRetryCount, "one successful CAS must increment the retry counter exactly once")
}

func TestMarkTaskBillingForReconciliationDoesNotOverwriteTerminalState(t *testing.T) {
	truncate(t)
	task := makeTask(t, 52, 152, 5000, 0, BillingSourceWallet, 0)
	fromQuota := 5000
	won, err := model.TransitionTaskBilling(task.TaskID, model.TaskBillingTransition{
		FromState: model.TaskBillingPending,
		ToState: model.TaskBillingSettled,
		FromQuota: &fromQuota,
	})
	require.NoError(t, err)
	require.True(t, won)

	err = model.MarkTaskBillingForReconciliation(task.TaskID, "late stale reconciliation request")
	require.ErrorIs(t, err, model.ErrTaskBillingStateConflict)
	stored, err := model.LoadTaskBillingSnapshot(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, model.TaskBillingSettled, stored.BillingState)
}

func TestRefundTaskQuotaLostClaimIsNotReportedAsSuccess(t *testing.T) {
	truncate(t)
	ctx := context.Background()
	task := makeTask(t, 53, 153, 5000, 0, BillingSourceWallet, 0)
	fromQuota, toQuota := 5000, 0
	won, err := model.TransitionTaskBilling(task.TaskID, model.TaskBillingTransition{
		FromState: model.TaskBillingPending,
		ToState: model.TaskBillingRefundPending,
		FromQuota: &fromQuota,
		ToQuota: &toQuota,
	})
	require.NoError(t, err)
	require.True(t, won)

	require.False(t, RefundTaskQuota(ctx, task, "duplicate request"), "refund_pending is not proof of a completed refund")
	assert.Equal(t, 0, task.Quota)
	assert.Equal(t, model.TaskBillingRefundPending, task.BillingState)
}

func TestRefundTaskQuotaReturnsFalseWhenLostClaimCannotRefreshSnapshot(t *testing.T) {
	truncate(t)
	ctx := context.Background()
	task := makeTask(t, 54, 154, 5000, 0, BillingSourceWallet, 0)
	require.NoError(t, model.DB.Delete(&model.Task{}, "task_id = ?", task.TaskID).Error)
	require.False(t, RefundTaskQuota(ctx, task, "stale task snapshot"), "a failed snapshot refresh must never be reported as a successful refund")
}
