package model

import (
	"errors"
	"fmt"

	"github.com/uter-ai/uter/common"

	"gorm.io/gorm"
)

// 异步任务的计费状态机。
//
// 之所以需要它：任务从「提交」到「钱货两讫」要经过预扣、结算/退款、任务记录
// 写回多个步骤，任何一步失败都会让账本与任务记录脱节。旧实现只把失败写进
// 日志，于是出现三类不可自行恢复的残局：
//
//   - 资金已动、任务 quota 没写回 → 重试时按旧 quota 再算一次差额，重复扣费；
//   - 退款已执行、任务 quota 没清零 → 轮询再次退款，重复退款；
//   - 任务已进终态但结算从未发生 → 用户被按预扣额多扣，且没有任何记录
//     提示这里需要人工介入。
//
// 状态机把「已经请求处理」与「账本确已完成」区分开：只有资金账本与任务记录
// 都一致时，才允许进入 settled / refunded 这类终态。
const (
	// TaskBillingPending 已创建但尚未预留资金。
	TaskBillingPending = "pending"
	// TaskBillingReserved 资金已预留（预扣），等待最终用量。
	TaskBillingReserved = "reserved"
	// TaskBillingSettlementPending 正在结算：已抢占执行权，资金未必已动。
	TaskBillingSettlementPending = "settlement_pending"
	// TaskBillingSettled 结算完成，账本与任务记录一致。
	TaskBillingSettled = "settled"
	// TaskBillingRefundPending 正在退款：已抢占执行权，资金未必已退。
	TaskBillingRefundPending = "refund_pending"
	// TaskBillingRefunded 退款完成，账本与任务记录一致。
	TaskBillingRefunded = "refunded"
	// TaskBillingReconciliationRequired 重试耗尽或无法自动恢复，转人工核对。
	TaskBillingReconciliationRequired = "reconciliation_required"
)

// 结算/退款操作名，同时用作幂等标识的一部分。
const (
	TaskBillingOperationSettle = "settle"
	TaskBillingOperationRefund = "refund"
)

// ErrTaskBillingStateConflict 表示本次迁移没有命中：当前状态或 quota 已被
// 其他请求推进。调用方应把它理解为「已经有人处理过了」，直接返回即可，
// 绝不能继续动账——那正是重复扣费/重复退款的成因。
var ErrTaskBillingStateConflict = errors.New("task billing state does not match the expected transition")

// TaskBillingTransition 描述一次原子的计费状态迁移。
//
// FromQuota 为 nil 表示不校验当前 quota；非 nil 时必须与库里的值相等才会命中。
// 把「状态」和「quota」放在同一条 UPDATE 里，是为了让抢占本身成为幂等屏障：
// 只有第一个把 (state, quota) 从旧值改到新值的请求能继续动账。
type TaskBillingTransition struct {
	// FromState / ToState 是迁移的起止状态。
	FromState string
	ToState   string
	// FromQuota / ToQuota 是迁移前后的任务 quota；ToQuota 为 nil 表示不改写。
	FromQuota *int
	ToQuota   *int
	// TargetQuota 是本次结算意图达到的最终额度（仅结算用），落库供对账任务
	// 在失败重试时按原参数重放。抢占本身就会把 quota 推进到目标值，失败释放
	// 时又会改回预扣值，因此目标额度必须单独留存，否则重试无从谈起。
	TargetQuota *int
	// IdempotencyKey 是本次操作的幂等标识，落库便于审计与去重排查。
	IdempotencyKey string
	// LastError 记录上一次失败原因，转人工时尤其重要。
	LastError string
	// RetryCountIncrement 为 true 时把重试计数加一。
	RetryCountIncrement bool
}

// TransitionTaskBilling 原子地推进任务的计费状态（CAS）。
//
// 返回 true 表示本次调用赢得了推进权，可以继续动账；返回 false 表示状态或
// quota 已被其他请求改掉，调用方必须停止，不得继续操作资金。
func TransitionTaskBilling(taskID string, transition TaskBillingTransition) (bool, error) {
	if taskID == "" {
		return false, errors.New("task ID is empty")
	}
	if transition.FromState == "" || transition.ToState == "" {
		return false, errors.New("billing transition requires both from and to states")
	}

	updates := map[string]any{
		"billing_state":      transition.ToState,
		"billing_updated_at": common.GetTimestamp(),
	}
	if transition.ToQuota != nil {
		updates["quota"] = *transition.ToQuota
	}
	if transition.TargetQuota != nil {
		updates["billing_target_quota"] = *transition.TargetQuota
	}
	if transition.IdempotencyKey != "" {
		updates["billing_idempotency_key"] = transition.IdempotencyKey
	}
	if transition.LastError != "" {
		updates["billing_last_error"] = transition.LastError
	} else if transition.ToState == TaskBillingSettled || transition.ToState == TaskBillingRefunded {
		// 进入终态时清掉历史错误，避免对账页面长期显示一条已解决的失败。
		updates["billing_last_error"] = ""
	}

	query := DB.Model(&Task{}).
		Where("task_id = ?", taskID)
	if transition.FromState == TaskBillingPending {
		// pending 是唯一允许「未初始化」的起点：历史任务的 billing_state 是
		// 空串，把它们也算进来才能被状态机接管。若只匹配字面 'pending'，
		// 所有存量任务都会永远卡在起点状态不匹配，既不能结算也不能退款。
		query = query.Where("billing_state IN ?", []string{"", TaskBillingPending})
	} else {
		query = query.Where("billing_state = ?", transition.FromState)
	}
	if transition.FromQuota != nil {
		query = query.Where("quota = ?", *transition.FromQuota)
	}
	if transition.RetryCountIncrement {
		// Retry accounting must be part of the same conditional UPDATE as the
		// state/quota transition. A separate UPDATE lets two contenders both
		// increment the retry counter before either one wins the CAS.
		updates["billing_retry_count"] = gorm.Expr("billing_retry_count + 1")
	}

	result := query.Updates(updates)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

// TaskBillingIdempotencyKey 生成一次结算/退款操作的幂等标识。
//
// 关键是把目标额度编进键：同一任务对同一目标额度只会有一个标识，重复的轮询
// 或人工重试因此不会产生第二笔动账；而额度确实变化时会得到新标识，不会被
// 误判成「已执行过」。
func TaskBillingIdempotencyKey(taskID string, operation string, targetQuota int) string {
	return fmt.Sprintf("%s:%s:%d", taskID, operation, targetQuota)
}

// LoadTaskBillingSnapshot 读取任务的计费状态快照，供对账任务使用。
func LoadTaskBillingSnapshot(taskID string) (*Task, error) {
	if taskID == "" {
		return nil, errors.New("task ID is empty")
	}
	var task Task
	err := DB.Where("task_id = ?", taskID).First(&task).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

// ListTasksAwaitingBillingFinality 返回「已抢占但未收口」的任务。
//
// 这类任务是账本与任务记录脱节的高危区：资金可能已动而任务记录没推进，
// 也可能任务已进终态而结算从未发生。olderThan 是截止时间戳——只有最后更新
// 早于它的行才会被返回，从而给在途请求留出完成时间，避免对账任务把正在
// 正常处理的结算当成卡死任务反复捞起。
//
// 对账任务按更新时间排序分批处理，避免一次载入全表。
func ListTasksAwaitingBillingFinality(limit int, olderThan int64) ([]Task, error) {
	if limit <= 0 {
		limit = 100
	}
	var tasks []Task
	err := DB.Where("billing_state IN ? AND billing_updated_at < ?",
		[]string{TaskBillingSettlementPending, TaskBillingRefundPending}, olderThan).
		Order("billing_updated_at ASC").
		Limit(limit).
		Find(&tasks).Error
	if err != nil {
		return nil, err
	}
	return tasks, nil
}

// ListTasksRequiringReconciliation 返回已转入人工核对队列的任务。
func ListTasksRequiringReconciliation(limit int) ([]Task, error) {
	if limit <= 0 {
		limit = 100
	}
	var tasks []Task
	err := DB.Where("billing_state = ?", TaskBillingReconciliationRequired).
		Order("billing_updated_at DESC").
		Limit(limit).
		Find(&tasks).Error
	if err != nil {
		return nil, err
	}
	return tasks, nil
}

// ListTasksWithUnfinishedBilling 返回「任务已终态、计费未收口」的任务。
//
// 终态任务的结算/退款如果在进程内失败，抢占会被释放回 pending（quota 恢复成
// 预扣值、失败原因落库），这类行不会出现在 ListTasksAwaitingBillingFinality
// 里——那个只捞中间态。但它们同样意味着用户被多扣或少退，必须由对账任务重试。
//
// 两个过滤条件缺一不可：
//   - status 必须是终态：进行中的任务同样是 pending + quota != 0，那是正常
//     的「已预扣、等结果」状态，碰它就会在任务还在跑时就退款；
//   - billing_state 只能是未初始化/pending：中间态（settlement_pending /
//     refund_pending）表示资金可能已动，自动重试会二次动账，只能转人工。
func ListTasksWithUnfinishedBilling(limit int, olderThan int64) ([]Task, error) {
	if limit <= 0 {
		limit = 100
	}
	var tasks []Task
	err := DB.Where("status IN ? AND billing_state IN ? AND billing_updated_at < ?",
		[]string{TaskStatusSuccess, TaskStatusFailure},
		[]string{"", TaskBillingPending, TaskBillingReserved}, olderThan).
		Order("billing_updated_at ASC").
		Limit(limit).
		Find(&tasks).Error
	if err != nil {
		return nil, err
	}
	return tasks, nil
}

// MarkTaskBillingForReconciliation 把任务转入人工核对队列，并记录原因。
// 幂等：重复标记不会叠加重试计数之外的任何副作用。
func MarkTaskBillingForReconciliation(taskID string, reason string) error {
	if taskID == "" {
		return errors.New("task ID is empty")
	}
	allowedStates := []string{
		"", TaskBillingPending, TaskBillingReserved,
		TaskBillingSettlementPending, TaskBillingRefundPending,
	}
	result := DB.Model(&Task{}).
		Where("task_id = ? AND billing_state IN ?", taskID, allowedStates).
		Updates(map[string]any{
			"billing_state":      TaskBillingReconciliationRequired,
			"billing_last_error": reason,
			"billing_updated_at": common.GetTimestamp(),
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 1 {
		return nil
	}

	var current Task
	if err := DB.Select("task_id", "billing_state").Where("task_id = ?", taskID).First(&current).Error; err != nil {
		return err
	}
	if current.BillingState == TaskBillingReconciliationRequired {
		return nil
	}
	return fmt.Errorf("%w: refusing to overwrite task %s billing state %q", ErrTaskBillingStateConflict, taskID, current.BillingState)
}
