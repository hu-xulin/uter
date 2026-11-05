package service

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/model"
	"gorm.io/gorm"
)

// ===========================================================================
// 清单第七章：对账任务与部分失败恢复
//
// 覆盖三类不变量：
//  1. 抢占后进程崩溃（中间态残留）→ 只能转人工，绝不能自动重试；
//  2. 进程内失败已释放（pending + 失败原因）→ 可按原参数重试，且只动一次账；
//  3. 资金已动但后续步骤失败 → 先补偿再判失败；补不回去 → 转人工。
// ===========================================================================

// failTableUpdates 让指定表的 UPDATE 全部失败，用于精确复现「某一步动账失败」。
// 返回注销函数；测试必须 defer 调用，否则会把同一进程里后续用例全部带崩。
func failTableUpdates(t *testing.T, table string, injected error) func() {
	t.Helper()
	const callbackName = "inject_update_failure_for_test"
	require.NoError(t, model.DB.Callback().Update().Before("gorm:update").
		Register(callbackName, func(tx *gorm.DB) {
			if tx.Statement.Table == table {
				tx.AddError(injected)
			}
		}))
	return func() {
		model.DB.Callback().Update().Remove(callbackName)
	}
}

// backdateBillingUpdate 把计费更新时间拨到退避窗口之前。
//
// 对账任务靠 billing_updated_at 区分「卡死」与「在途」：刚释放的行会被当成
// 仍在处理而放过。要验证重试逻辑，必须显式把行拨旧。
func backdateBillingUpdate(t *testing.T, taskID string) {
	t.Helper()
	require.NoError(t, model.DB.Model(&model.Task{}).Where("task_id = ?", taskID).
		Update("billing_updated_at", time.Now().Unix()-taskBillingStuckGraceSeconds-1).Error)
}

// setTaskTerminal 把任务置为终态并落库（对账任务只处理终态任务）。
func setTaskTerminal(t *testing.T, task *model.Task, status model.TaskStatus) {
	t.Helper()
	task.Status = status
	require.NoError(t, model.DB.Model(task).Update("status", status).Error)
}

// TestReconcileStuckTaskBillingRetriesReleasedRefund 覆盖「进程内退款失败后，
// 对账任务按原参数重试且只退一次」。
func TestReconcileStuckTaskBillingRetriesReleasedRefund(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 41, 41, 141
	const initQuota, preConsumed = 10000, 3000
	const tokenRemain = 5000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-reconcile-refund", tokenRemain)
	seedChannel(t, channelID)
	seedChargedAccounting(t, userID, channelID, tokenID, preConsumed, 1)

	// 出资组织指向不存在的组织：第一次退款必然失败并被释放回 pending。
	missingOrg := 999999
	task := makeTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.PrivateData.OrganizationId = &missingOrg
	require.NoError(t, model.DB.Model(task).Update("private_data", task.PrivateData).Error)
	setTaskTerminal(t, task, model.TaskStatusFailure)

	require.False(t, RefundTaskQuota(ctx, task, "task failed"), "资金调整失败时退款不得判成功")

	failed, err := model.LoadTaskBillingSnapshot(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, model.TaskBillingPending, failed.BillingState, "失败后必须留在可重试状态")
	assert.Equal(t, preConsumed, failed.Quota, "失败后不得清零任务额度")
	assert.NotEmpty(t, failed.BillingLastError, "失败原因必须落库")
	assert.Equal(t, initQuota, getUserQuota(t, userID), "失败后钱包不得被改动")

	// 故障恢复 + 把行拨旧（模拟失败已发生很久，越过退避窗口）。
	// 注意：OrganizationId 置 nil 表示「没有快照」而不是「平台直管」——那是
	// fail-closed 的语义，结算端会拒绝动账。恢复必须显式指回平台直管（0）。
	platformOrg := 0
	task.PrivateData.OrganizationId = &platformOrg
	require.NoError(t, model.DB.Model(task).Update("private_data", task.PrivateData).Error)
	backdateBillingUpdate(t, task.TaskID)

	ReconcileStuckTaskBilling(ctx)

	assert.Equal(t, initQuota+preConsumed, getUserQuota(t, userID), "对账重试应恰好退款一次")
	assert.Equal(t, tokenRemain+preConsumed, getTokenRemainQuota(t, tokenID), "令牌额度也应恰好退还一次")

	recovered, err := model.LoadTaskBillingSnapshot(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, model.TaskBillingRefunded, recovered.BillingState)
	assert.Zero(t, recovered.Quota)

	// 再跑一轮对账：已收口的行不得被再次处理（幂等）。
	ReconcileStuckTaskBilling(ctx)
	assert.Equal(t, initQuota+preConsumed, getUserQuota(t, userID), "已收口的退款不得重复执行")
}

// TestReconcileStuckTaskBillingReplaysSettlementTarget 覆盖「结算失败后用抢占时
// 固化的目标额度重放，且只补扣一次差额」。
func TestReconcileStuckTaskBillingReplaysSettlementTarget(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 42, 42, 142
	const initQuota, preConsumed, actualQuota = 10000, 2000, 3000
	const tokenRemain = 5000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-reconcile-settle", tokenRemain)
	seedChannel(t, channelID)
	seedChargedAccounting(t, userID, channelID, tokenID, preConsumed, 1)

	missingOrg := 999999
	task := makeTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.PrivateData.OrganizationId = &missingOrg
	require.NoError(t, model.DB.Model(task).Update("private_data", task.PrivateData).Error)
	setTaskTerminal(t, task, model.TaskStatusSuccess)

	RecalculateTaskQuota(ctx, task, actualQuota, newTestMessage("adaptor adjustment"))

	failed, err := model.LoadTaskBillingSnapshot(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, model.TaskBillingPending, failed.BillingState, "结算失败必须回到可重试状态")
	assert.Equal(t, preConsumed, failed.Quota, "结算失败不得推进任务额度")
	assert.Equal(t, actualQuota, failed.BillingTargetQuota, "目标额度必须被固化下来供重试")
	assert.NotEmpty(t, failed.BillingLastError)

	// 故障恢复 + 拨旧行。指回平台直管（0）：置 nil 是「没有快照」的 fail-closed
	// 语义，结算端会直接拒绝动账。
	platformOrg := 0
	task.PrivateData.OrganizationId = &platformOrg
	require.NoError(t, model.DB.Model(task).Update("private_data", task.PrivateData).Error)
	backdateBillingUpdate(t, task.TaskID)

	ReconcileStuckTaskBilling(ctx)

	assert.Equal(t, initQuota-(actualQuota-preConsumed), getUserQuota(t, userID), "重试应只补扣一次差额")
	assert.Equal(t, tokenRemain-(actualQuota-preConsumed), getTokenRemainQuota(t, tokenID))

	recovered, err := model.LoadTaskBillingSnapshot(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, model.TaskBillingSettled, recovered.BillingState)
	assert.Equal(t, actualQuota, recovered.Quota)
}

// TestReconcileStuckTaskBillingEscalatesStuckClaims 覆盖「抢占后进程崩溃」：
// 中间态残留只能转人工核对，自动重试会二次动账。
func TestReconcileStuckTaskBillingEscalatesStuckClaims(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 43, 43, 143
	const initQuota, preConsumed = 10000, 3000
	const tokenRemain = 5000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-reconcile-stuck", tokenRemain)
	seedChannel(t, channelID)
	seedChargedAccounting(t, userID, channelID, tokenID, preConsumed, 1)

	task := makeTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	setTaskTerminal(t, task, model.TaskStatusFailure)

	// 模拟崩溃：抢占退款执行权后进程死掉，既没有动账也没有收口。
	fromQuota := preConsumed
	toQuota := 0
	won, err := model.TransitionTaskBilling(task.TaskID, model.TaskBillingTransition{
		FromState: model.TaskBillingPending,
		ToState:   model.TaskBillingRefundPending,
		FromQuota: &fromQuota,
		ToQuota:   &toQuota,
	})
	require.NoError(t, err)
	require.True(t, won)
	backdateBillingUpdate(t, task.TaskID)

	ReconcileStuckTaskBilling(ctx)

	// 资金一本都不能动：是否已退无从得知，重试就是赌博。
	assert.Equal(t, initQuota, getUserQuota(t, userID), "中间态残留不得自动重试退款")
	assert.Equal(t, tokenRemain, getTokenRemainQuota(t, tokenID), "令牌额度不得被改动")

	stored, err := model.LoadTaskBillingSnapshot(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, model.TaskBillingReconciliationRequired, stored.BillingState, "必须转人工核对")
	assert.Contains(t, stored.BillingLastError, "manual reconciliation")

	listed, err := model.ListTasksRequiringReconciliation(10)
	require.NoError(t, err)
	require.Len(t, listed, 1)
	assert.Equal(t, task.TaskID, listed[0].TaskID)

	// 再跑一轮：已在人工队列里的行不得被重复处理。
	ReconcileStuckTaskBilling(ctx)
	assert.Equal(t, initQuota, getUserQuota(t, userID))
}

// TestReconcileStuckTaskBillingExhaustsRetryBudget 覆盖「重试预算用尽即转人工」。
func TestReconcileStuckTaskBillingExhaustsRetryBudget(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 44, 44, 144
	const initQuota, preConsumed = 10000, 3000
	const tokenRemain = 5000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-reconcile-budget", tokenRemain)
	seedChannel(t, channelID)
	seedChargedAccounting(t, userID, channelID, tokenID, preConsumed, 1)

	missingOrg := 999999
	task := makeTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.PrivateData.OrganizationId = &missingOrg
	require.NoError(t, model.DB.Model(task).Update("private_data", task.PrivateData).Error)
	setTaskTerminal(t, task, model.TaskStatusFailure)
	require.NoError(t, model.DB.Model(&model.Task{}).Where("task_id = ?", task.TaskID).
		Update("billing_retry_count", taskBillingMaxAutoAttempts).Error)
	backdateBillingUpdate(t, task.TaskID)

	ReconcileStuckTaskBilling(ctx)

	assert.Equal(t, initQuota, getUserQuota(t, userID), "预算用尽后不得再尝试动账")

	stored, err := model.LoadTaskBillingSnapshot(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, model.TaskBillingReconciliationRequired, stored.BillingState)
	assert.Contains(t, stored.BillingLastError, "retry budget")
	assert.Equal(t, taskBillingMaxAutoAttempts, stored.BillingRetryCount, "转人工本身不得再消耗重试预算")
}

// TestReconcileStuckTaskBillingIgnoresInProgressTasks 覆盖 fail-closed：进行中的
// 任务同样是 pending + quota != 0，对账任务绝不能碰它。
func TestReconcileStuckTaskBillingIgnoresInProgressTasks(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 45, 45, 145
	const initQuota, preConsumed = 10000, 3000
	const tokenRemain = 5000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-reconcile-inprogress", tokenRemain)
	seedChannel(t, channelID)
	seedChargedAccounting(t, userID, channelID, tokenID, preConsumed, 1)

	// 不置终态：这是一个正在执行中的任务，预扣额度是正常状态。
	task := makeTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	backdateBillingUpdate(t, task.TaskID)

	ReconcileStuckTaskBilling(ctx)

	assert.Equal(t, initQuota, getUserQuota(t, userID), "进行中的任务不得被退款")
	assert.Equal(t, tokenRemain, getTokenRemainQuota(t, tokenID), "进行中的任务额度不得被改动")
	stored, err := model.LoadTaskBillingSnapshot(task.TaskID)
	require.NoError(t, err)
	assert.Empty(t, stored.BillingState, "进行中的任务必须保持原状（计费状态仍未初始化）")
	assert.NotEqual(t, model.TaskBillingReconciliationRequired, stored.BillingState, "不得把在途任务转人工")
}

// TestRefundTokenQuotaFailureIsCompensatedAndRetryable 覆盖「资金已退、令牌额度
// 调整失败」：必须先补偿资金再判失败，重试才能安全地从头再来。
func TestRefundTokenQuotaFailureIsCompensatedAndRetryable(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 46, 46, 146
	const initQuota, preConsumed = 10000, 3000
	const tokenRemain = 5000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-token-fail", tokenRemain)
	seedChannel(t, channelID)
	seedChargedAccounting(t, userID, channelID, tokenID, preConsumed, 1)

	task := makeTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	setTaskTerminal(t, task, model.TaskStatusFailure)

	restore := failTableUpdates(t, "tokens", errors.New("injected token quota failure"))
	require.False(t, RefundTaskQuota(ctx, task, "task failed"), "令牌额度调整失败时退款不得判成功")
	restore()

	// 资金必须被补偿回未执行状态，否则重试会二次退款。
	assert.Equal(t, initQuota, getUserQuota(t, userID), "资金必须被补偿回原值")
	assert.Equal(t, tokenRemain, getTokenRemainQuota(t, tokenID), "令牌额度本就未动")

	stored, err := model.LoadTaskBillingSnapshot(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, model.TaskBillingPending, stored.BillingState, "必须留在可重试状态")
	assert.Equal(t, preConsumed, stored.Quota, "任务额度必须恢复成待退值")
	assert.Contains(t, stored.BillingLastError, "token quota")

	// 故障恢复后重试：整笔退款恰好执行一次。
	require.True(t, RefundTaskQuota(ctx, task, "task failed"))
	assert.Equal(t, initQuota+preConsumed, getUserQuota(t, userID), "重试应恰好退款一次")
	assert.Equal(t, tokenRemain+preConsumed, getTokenRemainQuota(t, tokenID))

	final, err := model.LoadTaskBillingSnapshot(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, model.TaskBillingRefunded, final.BillingState)
}

// TestSettlementTokenQuotaFailureCompensatesFunding 覆盖结算路径上的同一不变量：
// 资金已补扣、令牌额度调整失败 → 补偿资金 → 可重试 → 最终只扣一次差额。
func TestSettlementTokenQuotaFailureCompensatesFunding(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 47, 47, 147
	const initQuota, preConsumed, actualQuota = 10000, 2000, 3000
	const tokenRemain = 5000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-settle-token-fail", tokenRemain)
	seedChannel(t, channelID)
	seedChargedAccounting(t, userID, channelID, tokenID, preConsumed, 1)

	task := makeTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	setTaskTerminal(t, task, model.TaskStatusSuccess)

	restore := failTableUpdates(t, "tokens", errors.New("injected token quota failure"))
	RecalculateTaskQuota(ctx, task, actualQuota, newTestMessage("adaptor adjustment"))
	restore()

	assert.Equal(t, initQuota, getUserQuota(t, userID), "补扣必须被补偿回原值")
	assert.Equal(t, tokenRemain, getTokenRemainQuota(t, tokenID), "令牌额度本就未动")

	stored, err := model.LoadTaskBillingSnapshot(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, model.TaskBillingPending, stored.BillingState, "必须回到可重试状态")
	assert.Equal(t, preConsumed, stored.Quota, "任务额度必须恢复成预扣值")
	assert.Equal(t, actualQuota, stored.BillingTargetQuota, "目标额度必须仍然可用于重试")
	assert.NotEmpty(t, stored.BillingLastError)

	// 故障恢复后重试：恰好补扣一次差额。
	RecalculateTaskQuota(ctx, task, actualQuota, newTestMessage("adaptor adjustment"))
	assert.Equal(t, initQuota-(actualQuota-preConsumed), getUserQuota(t, userID))
	assert.Equal(t, tokenRemain-(actualQuota-preConsumed), getTokenRemainQuota(t, tokenID))

	final, err := model.LoadTaskBillingSnapshot(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, model.TaskBillingSettled, final.BillingState)
	assert.Equal(t, actualQuota, final.Quota)
}

// TestRefundUncompensatableFailureGoesToReconciliation 覆盖「资金已退且补不回
// 去」：既不能重试（会二次退款）也不能判成功，只能转人工核对。
func TestRefundUncompensatableFailureGoesToReconciliation(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 48, 48, 148
	const initQuota, preConsumed = 10000, 3000
	const tokenRemain = 5000

	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-no-compensation", tokenRemain)
	seedChannel(t, channelID)
	seedChargedAccounting(t, userID, channelID, tokenID, preConsumed, 1)

	task := makeTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	setTaskTerminal(t, task, model.TaskStatusFailure)

	// 令牌额度调整失败，且随后的资金补偿也失败。
	// 用户的 UPDATE 必须放过第一次（退款本身要成功），从第二次起失败——那正是
	// 补偿动作。用计数器而不是无条件失败，否则退款在第一步就返回了，根本走不到
	// 需要补偿的分支。
	restoreTokens := failTableUpdates(t, "tokens", errors.New("injected token quota failure"))
	var fundingUpdates atomic.Int32
	const callbackName = "fail_funding_compensation"
	require.NoError(t, model.DB.Callback().Update().Before("gorm:update").
		Register(callbackName, func(tx *gorm.DB) {
			if tx.Statement.Table == "users" && fundingUpdates.Add(1) >= 2 {
				tx.AddError(errors.New("injected funding compensation failure"))
			}
		}))
	require.False(t, RefundTaskQuota(ctx, task, "task failed"), "无法补偿的半成品不得判成功")
	restoreTokens()
	model.DB.Callback().Update().Remove(callbackName)

	stored, err := model.LoadTaskBillingSnapshot(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, model.TaskBillingReconciliationRequired, stored.BillingState, "必须转人工核对")
	assert.Contains(t, stored.BillingLastError, "compensation")
	assert.Contains(t, stored.BillingLastError, "token quota")

	listed, err := model.ListTasksRequiringReconciliation(10)
	require.NoError(t, err)
	require.Len(t, listed, 1)
	assert.Equal(t, task.TaskID, listed[0].TaskID)
}


func TestRunTaskPollingOnceReconcilesBillingWithoutAnyAdapter(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID = 55, 55, 155
	const initQuota, preConsumed = 10000, 3000
	const tokenRemain = 5000
	seedUser(t, userID, initQuota)
	seedToken(t, tokenID, userID, "sk-no-poll-adapter", tokenRemain)
	seedChannel(t, channelID)
	seedChargedAccounting(t, userID, channelID, tokenID, preConsumed, 1)

	task := makeTask(t, userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	setTaskTerminal(t, task, model.TaskStatusFailure)
	backdateBillingUpdate(t, task.TaskID)

	previousAdaptor := GetTaskAdaptorFunc
	GetTaskAdaptorFunc = nil
	t.Cleanup(func() { GetTaskAdaptorFunc = previousAdaptor })

	summary := RunTaskPollingOnce(ctx, nil)
	assert.Zero(t, summary.PlatformsScanned, "upstream polling should be skipped when no adapter registry exists")
	assert.Equal(t, initQuota+preConsumed, getUserQuota(t, userID), "billing reconciliation must still refund terminal failed tasks")
	assert.Equal(t, tokenRemain+preConsumed, getTokenRemainQuota(t, tokenID), "billing reconciliation must still restore Token quota")

	stored, err := model.LoadTaskBillingSnapshot(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, model.TaskBillingRefunded, stored.BillingState)
	assert.Zero(t, stored.Quota)
}
