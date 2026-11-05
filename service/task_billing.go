package service

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"maps"
	"math"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/logger"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/pkg/billingexpr"
	"github.com/uter-ai/uter/pkg/jsplugin"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
	"github.com/uter-ai/uter/setting/ratio_setting"
	"github.com/uter-ai/uter/types"
	"gorm.io/gorm"
)

// LogTaskConsumption 记录任务消费日志和统计信息（仅记录，不涉及实际扣费）。
// 实际扣费已由 BillingSession（PreConsumeBilling + SettleBilling）完成。
func LogTaskConsumption(c *gin.Context, info *relaycommon.RelayInfo, task *model.Task) {
	tokenName := c.GetString("token_name")
	logContent := []*common.Message{common.NewMessage("Action {{action}}", map[string]any{"action": info.Action})}
	// 支持任务仅按次计费
	if common.StringsContains(constant.TaskPricePatches, info.OriginModelName) {
		logContent = append(logContent, common.NewMessage("Billed per request"))
	} else {
		var contents []string
		if otherRatios := info.PriceData.OtherRatios(); len(otherRatios) > 0 {
			for key, ra := range otherRatios {
				if 1.0 != ra {
					contents = append(contents, fmt.Sprintf("%s: %.2f", key, ra))
				}
			}
		}
		if snap := info.TieredBillingSnapshot; snap != nil {
			for key, value := range snap.UsageFacts {
				contents = append(contents, fmt.Sprintf("%s: %v", key, value))
			}
		}
		if len(contents) > 0 {
			logContent = append(logContent, common.NewMessage("Billing parameters: {{params}}", map[string]any{"params": strings.Join(contents, ", ")}))
		}
	}
	other := model.NewLogOther()
	other.SetPublic("is_task", true)
	other.SetPublic("request_path", c.Request.URL.Path)
	if taskDeliveredInline(c, task) {
		other.SetPublic("task_sync", true)
	}
	other.SetPublic("model_price", info.PriceData.ModelPrice)
	if info.PriceData.ModelRatio > 0 {
		other.SetPublic("model_ratio", info.PriceData.ModelRatio)
	}
	other.SetPublic("group_ratio", info.PriceData.GroupRatioInfo.GroupRatio)
	if info.PriceData.GroupRatioInfo.HasSpecialRatio {
		other.SetPublic("user_group_ratio", info.PriceData.GroupRatioInfo.GroupSpecialRatio)
	}
	if info.IsModelMapped {
		other.SetPublic("is_model_mapped", true)
		other.SetPublic("upstream_model_name", info.UpstreamModelName)
	}
	if snap := info.TieredBillingSnapshot; snap != nil {
		other.SetPublic("billing_mode", "tiered_expr")
		other.SetPublic("expr_b64", base64.StdEncoding.EncodeToString([]byte(snap.ExprString)))
		other.SetPublic("matched_tier", snap.EstimatedTier)
		if len(snap.UsageFacts) > 0 {
			other.SetPublic("usage_facts", snap.UsageFacts)
		}
		setTaskImageCount(other, snap.UsageFacts["image_count"])
	} else {
		setTaskImageCount(other, info.PriceData.OtherRatios()["image_count"])
	}
	appendTaskLogInfo(task, other)
	attachQuotaSaturation(c, info, other)
	model.RecordConsumeLog(c, info.UserId, model.RecordConsumeLogParams{
		ChannelId: info.ChannelId,
		ModelName: info.OriginModelName,
		TokenName: tokenName,
		Quota:     info.PriceData.Quota,
		Content:   logContent,
		TokenId:   info.TokenId,
		Group:     info.UsingGroup,
		Other:     other,
	})
	model.UpdateUserUsedQuotaAndRequestCount(info.UserId, info.PriceData.Quota)
	model.UpdateChannelUsedQuota(info.ChannelId, info.PriceData.Quota)
}

// ---------------------------------------------------------------------------
// 异步任务计费辅助函数
// ---------------------------------------------------------------------------

// resolveTokenKey 通过 TokenId 运行时获取令牌 Key（用于 Redis 缓存操作）。
// 如果令牌已被删除或查询失败，返回空字符串。
//
// 区分两种「拿不到 key」：令牌已被删除时它的额度随行一起消失，没有可调整的
// 对象，调用方应当跳过；查询本身失败（数据库抖动）时必须让调用方知道，不能
// 当成「无需调整」——那会把一次资金动作悄悄吞掉。
func resolveTokenKey(ctx context.Context, tokenId int, taskID string) (string, error) {
	token, err := model.GetTokenById(tokenId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			logger.LogInfo(ctx, common.LogText("token %d of task %s no longer exists; its quota moved with the row", tokenId, taskID))
			return "", nil
		}
		logger.LogWarn(ctx, common.LogText("failed to get token key (tokenId=%d, task=%s): %s", tokenId, taskID, err.Error()))
		return "", err
	}
	return token.Key, nil
}

// taskIsSubscription 判断任务是否通过订阅计费。
func taskIsSubscription(task *model.Task) bool {
	return task.PrivateData.BillingSource == BillingSourceSubscription && task.PrivateData.SubscriptionId > 0
}

// ErrTaskFundingSourceUnresolved 任务的出资组织无法可靠确定。
//
// 只在「任务提交时没有留下组织快照」的历史数据上出现。此时既不能猜成组织账本，
// 也不能猜成个人钱包：猜错的后果是两本账同时错位且不可逆。调用方必须把它当作
// 需要人工核对的信号，而不是继续扣另一个账户。
var ErrTaskFundingSourceUnresolved = errors.New("task funding source cannot be resolved without a submit-time organization snapshot")

// taskFundingOrgId 返回任务**提交时**固化的出资组织。
//
// 全生命周期（提交、预留、结算、退款）都必须用这一份快照，不得在结算时重新解析
// 用户当前的组织关系——那正是「资金来源漂移」的成因：用户在任务执行期间被移出
// 组织后，结算会改走个人钱包，组织账本永远收不到这笔钱，个人钱包却被凭空扣一笔。
func taskFundingOrgId(task *model.Task) (int, error) {
	if task.PrivateData.OrganizationId != nil {
		return *task.PrivateData.OrganizationId, nil
	}
	return 0, fmt.Errorf("%w: task %s user %d", ErrTaskFundingSourceUnresolved, task.TaskID, task.UserId)
}

// taskAdjustFunding 调整任务的资金来源（钱包或订阅），delta > 0 表示扣费，delta < 0 表示退还。
func taskAdjustFunding(task *model.Task, delta int) error {
	if taskIsSubscription(task) {
		return model.PostConsumeUserSubscriptionDelta(task.PrivateData.SubscriptionId, int64(delta))
	}
	// 组织成员的资金来源是组织共享预算：提交端按组织出资预扣，这里的退款/差额结算
	// 必须对称地回到同一本账。退到个人钱包会让组织 used_quota 永不回减，对账破裂。
	orgId, err := taskFundingOrgId(task)
	if err != nil {
		return err
	}
	if orgId > 0 {
		return model.IncrOrgUsedQuota(orgId, int64(delta))
	}
	if delta > 0 {
		return model.DecreaseUserQuota(task.UserId, delta, false)
	}
	return model.IncreaseUserQuota(task.UserId, -delta, false)
}

// taskAdjustTokenQuota 调整任务的令牌额度，delta > 0 表示扣费，delta < 0 表示退还。
// 需要通过 resolveTokenKey 运行时获取 key（不从 PrivateData 中读取）。
//
// 返回 error 而不是只记日志：令牌额度是一本独立的账。旧实现在这里只写一条告警
// 就返回，于是「资金已退、令牌额度没退」的半成品会被上层当成退款成功——用户
// 看到余额恢复，令牌额度却永久少一块，且没有任何重试入口。失败必须向上传播，
// 由调用方决定补偿还是转人工核对。
func taskAdjustTokenQuota(ctx context.Context, task *model.Task, delta int) error {
	if task.PrivateData.TokenId <= 0 || delta == 0 {
		return nil
	}
	tokenKey, err := resolveTokenKey(ctx, task.PrivateData.TokenId, task.TaskID)
	if err != nil {
		return err
	}
	if tokenKey == "" {
		// 令牌已被删除：额度随行消失，没有可调整的对象。
		return nil
	}
	if delta > 0 {
		return model.DecreaseTokenQuota(task.PrivateData.TokenId, tokenKey, delta)
	}
	return model.IncreaseTokenQuota(task.PrivateData.TokenId, tokenKey, -delta)
}

// taskBillingOther 从 task 的 BillingContext 构建日志 Other 字段。
func taskBillingOther(task *model.Task) *model.LogOther {
	other := model.NewLogOther()
	// 前端列表按 is_task 选择任务档位渲染分支,缺失会把差额/退款日志误判成普通 relay 动态计费
	other.SetPublic("is_task", true)
	if bc := task.PrivateData.BillingContext; bc != nil {
		other.SetPublic("model_price", bc.ModelPrice)
		if bc.ModelRatio > 0 {
			other.SetPublic("model_ratio", bc.ModelRatio)
		}
		other.SetPublic("group_ratio", bc.GroupRatio)
		if priceData := taskBillingContextPriceData(bc); priceData != nil {
			for k, v := range priceData.OtherRatios() {
				if !other.SetPublic(k, v) {
					common.SysError(common.LogText("task billing other ratio key rejected: %s", k))
				}
			}
		}
		if snap := bc.TieredSnapshot; snap != nil {
			other.SetPublic("billing_mode", "tiered_expr")
			other.SetPublic("expr_b64", base64.StdEncoding.EncodeToString([]byte(snap.ExprString)))
			other.SetPublic("matched_tier", snap.EstimatedTier)
			if len(snap.UsageFacts) > 0 {
				other.SetPublic("usage_facts", snap.UsageFacts)
			}
			setTaskImageCount(other, snap.UsageFacts["image_count"])
		} else if priceData := taskBillingContextPriceData(bc); priceData != nil {
			setTaskImageCount(other, priceData.OtherRatios()["image_count"])
		}
	}
	props := task.Properties
	if props.UpstreamModelName != "" && props.UpstreamModelName != props.OriginModelName {
		other.SetPublic("is_model_mapped", true)
		other.SetPublic("upstream_model_name", props.UpstreamModelName)
	}
	appendTaskLogInfo(task, other)
	return other
}

// setTaskImageCount publishes the billed image quantity of an image task as
// other.image_count, the same field the HTTP image relay writes, so the log
// detail shows one "billable image count" regardless of the serving path. The
// value is a host-validated count fact (at most dto.MaxImageN), never a quota.
func setTaskImageCount(other *model.LogOther, value any) {
	count, ok := value.(float64)
	if !ok || count < 0 || count > float64(dto.MaxImageN) {
		return
	}
	other.SetPublic("image_count", common.QuotaRound(count))
}

// taskDeliveredInline reports whether the submitting HTTP request itself
// returns the task deliverable: the upstream completed immediately, or the
// request came through the synchronous OpenAI Images protocol, where the host
// waits for an asynchronous upstream task before answering. The usage log
// presents such requests as synchronous instead of as asynchronous jobs.
func taskDeliveredInline(c *gin.Context, task *model.Task) bool {
	if task != nil && (task.Status == model.TaskStatusSuccess || task.Status == model.TaskStatusFailure) {
		return true
	}
	pinnedValue, exists := c.Get(jsplugin.ContextKeyPinnedEndpoint)
	if !exists {
		return false
	}
	pinned, ok := pinnedValue.(jsplugin.PinnedEndpoint)
	return ok && pinned.Protocol == jsplugin.ProtocolOpenAIImage
}

func appendTaskLogInfo(task *model.Task, other *model.LogOther) {
	if task == nil || other == nil {
		return
	}
	if task.TaskID != "" {
		other.SetPublic("task_id", task.TaskID)
	}
	if task.PrivateData.ResultDiscarded {
		// The result was delivered inline and the upstream snapshot was not
		// persisted, so no artifact can be retrieved for this task.
		other.SetPublic("result_discarded", true)
	}
	if task.PrivateData.Execution != nil {
		AppendTaskPluginAuditInfo(other, task.PrivateData.Execution.TaskPlugin)
	}
	if task.PrivateData.UpstreamTaskID == "" && task.PrivateData.NodeName == "" {
		return
	}
	if task.PrivateData.UpstreamTaskID != "" {
		other.SetRoot("upstream_task_id", task.PrivateData.UpstreamTaskID)
	}
	if task.PrivateData.NodeName != "" {
		other.SetRoot("node_name", task.PrivateData.NodeName)
	}
}

func taskBillingContextPriceData(bc *model.TaskBillingContext) *types.PriceData {
	if bc == nil || len(bc.OtherRatios) == 0 {
		return nil
	}
	priceData := &types.PriceData{}
	if !priceData.ReplaceOtherRatios(bc.OtherRatios) {
		return nil
	}
	return priceData
}

// taskModelName 从 BillingContext 或 Properties 中获取模型名称。
func taskModelName(task *model.Task) string {
	if bc := task.PrivateData.BillingContext; bc != nil && bc.OriginModelName != "" {
		return bc.OriginModelName
	}
	return task.Properties.OriginModelName
}

// ErrTaskBillingPartialFailure 表示资金已经动过，但后续步骤失败且无法补偿。
//
// 这种半成品绝不能重试——那会二次动账；也绝不能当成成功——那会把账实不符
// 永久固化。唯一安全的出路是转人工核对，由运维决定怎么平账。
var ErrTaskBillingPartialFailure = errors.New("task billing partially applied and cannot be compensated automatically")

// RefundTaskQuota 统一的任务失败退款逻辑。
// 当异步任务失败时，退还资金与令牌额度，并回减用户和渠道用量。
// 返回资金来源是否已成功退还；失败时保留 quota，供显式重试或人工对账。
//
// 幂等屏障：先用 TransitionTaskBilling 抢占 refund_pending。抢占失败说明已有
// 请求（或上一轮重试）在处理同一笔退款，直接返回，绝不第二次动账——那正是
// 「人工重试时发生重复退款」的成因。
func RefundTaskQuota(ctx context.Context, task *model.Task, reason string) bool {
	if ctx == nil {
		ctx = context.Background()
	}
	if task == nil {
		logger.LogError(ctx, "cannot refund a nil task")
		return false
	}
	quota := task.Quota
	if quota == 0 {
		// A zero quota is a successful no-op only when the durable billing
		// state is not an in-flight or quarantined operation. A claimed refund
		// also sets quota to zero before the ledger work is complete.
		if task.TaskID == "" {
			return false
		}
		if err := syncTaskBillingView(task); err != nil {
			logger.LogError(ctx, common.LogText("failed to refresh zero-quota task %s billing state: %s", task.TaskID, err.Error()))
			return false
		}
		switch task.BillingState {
		case "", model.TaskBillingPending, model.TaskBillingReserved, model.TaskBillingSettled, model.TaskBillingRefunded:
			return true
		default:
			return false
		}
	}

	// 抢占退款执行权。quota 条件一并纳入 CAS：只有任务记录的待退额度仍等于
	// 我们看到的这个值时才放行，避免用过期快照退第二笔。
	fromQuota := task.Quota
	toQuota := 0
	idempotencyKey := model.TaskBillingIdempotencyKey(task.TaskID, model.TaskBillingOperationRefund, quota)
	won, err := model.TransitionTaskBilling(task.TaskID, model.TaskBillingTransition{
		FromState:           currentTaskBillingState(task),
		ToState:             model.TaskBillingRefundPending,
		FromQuota:           &fromQuota,
		ToQuota:             &toQuota,
		IdempotencyKey:      idempotencyKey,
		LastError:           "",
		RetryCountIncrement: true,
	})
	if err != nil {
		logger.LogError(ctx, common.LogText("failed to claim the refund for task %s: %s", task.TaskID, err.Error()))
		return false
	}
	if !won {
		// A lost CAS is not proof that the refund completed. Refresh the durable
		// state and report success only when another worker has reached refunded.
		if err := syncTaskBillingView(task); err != nil {
			logger.LogError(ctx, common.LogText("failed to refresh task %s billing state after losing refund claim: %s", task.TaskID, err.Error()))
			return false
		}
		if task.BillingState == model.TaskBillingRefunded {
			return true
		}
		logger.LogInfo(ctx, common.LogText("task %s refund is already claimed or requires reconciliation; skipping duplicate refund", task.TaskID))
		return false
	}

	// 抢占已把任务 quota 归零（CAS 的一部分）：释放抢占时要拿这个「库里当前值」
	// 作为 FromQuota，否则与实际值不匹配，释放会静默失败。
	claimedQuota := toQuota

	switch err := applyTaskRefund(ctx, task, quota, reason); {
	case err == nil:
		// 资金已退且任务记录已归零：进入终态。
		if _, serr := model.TransitionTaskBilling(task.TaskID, model.TaskBillingTransition{
			FromState: model.TaskBillingRefundPending,
			ToState:   model.TaskBillingRefunded,
		}); serr != nil {
			logger.LogError(ctx, common.LogText("refund succeeded but the final state could not be recorded, task %s: %s", task.TaskID, serr.Error()))
		}
		return true
	case errors.Is(err, ErrTaskBillingPartialFailure):
		// 资金已动且补不回去：转人工核对。任务 quota 保持抢占时写入的 0
		// （资金那一半确实已经退了），失败原因落库供运维平账。
		logger.LogError(ctx, common.LogText("task %s needs manual billing reconciliation: %s", task.TaskID, err.Error()))
		if merr := model.MarkTaskBillingForReconciliation(task.TaskID, err.Error()); merr != nil {
			logger.LogError(ctx, common.LogText("failed to mark task %s for reconciliation: %s", task.TaskID, merr.Error()))
		}
		task.Quota = claimedQuota
		return false
	default:
		// 退款未完成（资金未动，或已补偿回未执行状态）：把 quota 改回原值并
		// 留在可重试状态，等待下一次重试或转人工。绝不能把任务标记成已退款
		// ——那会让轮询再也不来修复。
		if !releaseTaskRefundClaim(ctx, task, claimedQuota, fromQuota, err) {
			// 释放也失败：状态已被其他请求改写，是否重复动账无从得知。
			if merr := model.MarkTaskBillingForReconciliation(task.TaskID,
				fmt.Sprintf("refund claim could not be released after a failed attempt: %v", err)); merr != nil {
				logger.LogError(ctx, common.LogText("failed to mark task %s for reconciliation: %s", task.TaskID, merr.Error()))
			}
		}
		return false
	}
}

// currentTaskBillingState 返回任务当前的计费状态；未初始化时按 pending 处理。
//
// 历史任务没有这个字段（空串），把它们一律当成 pending 才能被状态机接管，
// 否则会永远卡在「起点状态不匹配」而无法结算或退款。
func currentTaskBillingState(task *model.Task) string {
	if task.BillingState == "" {
		return model.TaskBillingPending
	}
	return task.BillingState
}

// syncTaskBillingView 用库里的真实值刷新内存视图。
//
// 抢占失败时必须这样做：调用方接下来还会用 task.Quota / task.BillingState
// 做判断（例如是否还要退款、按什么额度结算），拿过期快照继续算就会二次动账。
func syncTaskBillingView(task *model.Task) error {
	if task == nil {
		return errors.New("task is nil")
	}
	stored, err := model.LoadTaskBillingSnapshot(task.TaskID)
	if err != nil {
		return err
	}
	task.Quota = stored.Quota
	task.BillingState = stored.BillingState
	return nil
}

// applyTaskRefund 执行一次退款的实际资金动作。
//
// 返回值语义：
//   - nil：全部成功；
//   - ErrTaskBillingPartialFailure：资金已动且无法回退，必须转人工；
//   - 其他错误：资金未动（或已补偿回未执行状态），可以安全重试。
func applyTaskRefund(ctx context.Context, task *model.Task, quota int, reason string) error {
	// 1. 退还资金来源（钱包或订阅）
	if err := taskAdjustFunding(task, -quota); err != nil {
		logger.LogWarn(ctx, common.LogText("failed to refund the funding source, task %s: %s", task.TaskID, err.Error()))
		return fmt.Errorf("refund the funding source: %w", err)
	}

	// 2. 退还令牌额度。令牌额度也是一本账：这里失败绝不能当成退款成功，
	//    否则「钱包已退、令牌没退」的半成品没有任何重试入口。
	if err := taskAdjustTokenQuota(ctx, task, -quota); err != nil {
		logger.LogError(ctx, common.LogText("failed to refund the token quota, task %s: %s", task.TaskID, err.Error()))
		// 资金已退：先补回去，让整笔退款回到未执行状态，重试才能安全地从头再来。
		if cerr := taskAdjustFunding(task, quota); cerr != nil {
			return fmt.Errorf("%w: the token quota refund failed (%v) and the funding compensation failed (%v)",
				ErrTaskBillingPartialFailure, err, cerr)
		}
		return fmt.Errorf("refund the token quota (funding already compensated): %w", err)
	}

	// 3. 回减预扣时累计的用户和渠道用量，请求次数保持不变
	model.UpdateUserUsedQuota(task.UserId, -quota)
	model.UpdateChannelUsedQuota(task.ChannelId, -quota)

	// 4. 记录日志
	other := taskBillingOther(task)
	other.SetPublic("task_id", task.TaskID)
	other.SetPublic("reason", reason)
	model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
		UserId:    task.UserId,
		LogType:   model.LogTypeRefund,
		ChannelId: task.ChannelId,
		ModelName: taskModelName(task),
		Quota:     quota,
		TokenId:   task.PrivateData.TokenId,
		Group:     task.Group,
		Other:     other,
	})

	// 5. 任务记录的 quota 已由调用方的 CAS 一并归零，这里只需同步内存视图。
	task.Quota = 0
	return nil
}

// releaseTaskRefundClaim 退款失败时释放抢占：把任务 quota 改回待退值并回到
// 可重试状态。
//
// 返回 false 表示释放失败（状态已被其他请求改写）。此时不能继续重试——重复
// 动账的风险无从排除，调用方必须转人工核对。
func releaseTaskRefundClaim(ctx context.Context, task *model.Task, claimedQuota, refundableQuota int, cause error) bool {
	won, err := model.TransitionTaskBilling(task.TaskID, model.TaskBillingTransition{
		FromState: model.TaskBillingRefundPending,
		ToState:   currentTaskBillingState(task),
		FromQuota: &claimedQuota,
		ToQuota:   &refundableQuota,
		LastError: cause.Error(),
	})
	if err != nil {
		logger.LogError(ctx, common.LogText("failed to release the refund claim for task %s: %s", task.TaskID, err.Error()))
		return false
	}
	if !won {
		logger.LogError(ctx, common.LogText("the refund claim for task %s was already advanced by another attempt; manual reconciliation is required", task.TaskID))
		return false
	}
	task.Quota = refundableQuota
	return true
}

// RecalculateTaskQuota 通用的异步差额结算。
// actualQuota 是任务完成后的实际应扣额度，与预扣额度 (task.Quota) 做差额结算。
// reason 写入日志内容（例如按 token 重算或 adaptor 调整）。
// clamps 可选：若计算 actualQuota 时发生额度饱和，将其记入日志 admin_info（仅管理员可见）。
//
// 幂等屏障：先用 TransitionTaskBilling 抢占 settlement_pending，并把
// fromQuota/toQuota 一并纳入 CAS。抢占失败说明已有请求在处理同一笔结算，
// 直接返回，不重复动账。
func RecalculateTaskQuota(ctx context.Context, task *model.Task, actualQuota int, reason *common.Message, clamps ...*common.QuotaClamp) {
	if ctx == nil {
		ctx = context.Background()
	}
	if task == nil || actualQuota < 0 {
		return
	}
	preConsumedQuota := task.Quota
	quotaDelta := actualQuota - preConsumedQuota

	if quotaDelta == 0 {
		logger.LogInfo(ctx, common.LogText("task %s pre-consumed quota matches the actual quota (%s, %s)",
			task.TaskID, logger.LogQuota(actualQuota), reason.Error()))
		// 差额为零也要收口：否则任务会永远停在非终态，被对账任务反复捞起。
		if _, err := model.TransitionTaskBilling(task.TaskID, model.TaskBillingTransition{
			FromState: currentTaskBillingState(task),
			ToState:   model.TaskBillingSettled,
			FromQuota: &preConsumedQuota,
			ToQuota:   &preConsumedQuota,
		}); err != nil {
			logger.LogWarn(ctx, common.LogText("failed to finalize the billing state for task %s: %s", task.TaskID, err.Error()))
		}
		return
	}

	logger.LogInfo(ctx, common.LogText("task %s settles the difference: delta=%s (actual %s, pre-consumed %s, %s)",
		task.TaskID,
		logger.LogQuota(quotaDelta),
		logger.LogQuota(actualQuota),
		logger.LogQuota(preConsumedQuota),
		reason.Error(),
	))

	// 抢占结算执行权。quota 也进 CAS：只有任务记录的预扣额度仍等于我们看到的
	// 这个值时才放行，避免用过期快照重复结算。目标额度一并固化，供失败重试
	// 按原参数重放——上游用量结果此时已经拿不到了。
	idempotencyKey := model.TaskBillingIdempotencyKey(task.TaskID, model.TaskBillingOperationSettle, actualQuota)
	won, err := model.TransitionTaskBilling(task.TaskID, model.TaskBillingTransition{
		FromState:           currentTaskBillingState(task),
		ToState:             model.TaskBillingSettlementPending,
		FromQuota:           &preConsumedQuota,
		ToQuota:             &actualQuota,
		TargetQuota:         &actualQuota,
		IdempotencyKey:      idempotencyKey,
		RetryCountIncrement: true,
	})
	if err != nil {
		logger.LogError(ctx, common.LogText("failed to claim the settlement for task %s: %s", task.TaskID, err.Error()))
		return
	}
	if !won {
		// 已有人抢占：以库里的真实状态刷新内存视图，避免调用方拿过期快照继续判断。
		if err := syncTaskBillingView(task); err != nil {
			logger.LogError(ctx, common.LogText("failed to refresh task %s billing state after losing settlement claim: %s", task.TaskID, err.Error()))
			return
		}
		logger.LogInfo(ctx, common.LogText("task %s settlement was already claimed by another attempt; skipping duplicate settlement", task.TaskID))
		return
	}

	// 抢占已把任务 quota 推进到 actualQuota（CAS 的一部分）。资金调整失败时
	// 释放必须拿这个「库里当前值」作为 FromQuota，否则与实际值不匹配、释放会
	// 静默失败：任务永远卡在 settlement_pending 且带着被推进过的 quota，
	// 对账与重试全部失效。
	claimedQuota := actualQuota

	if err := taskAdjustFunding(task, quotaDelta); err != nil {
		logger.LogError(ctx, common.LogText("failed to adjust funding for the difference, task %s: %s", task.TaskID, err.Error()))
		if !releaseTaskSettlementClaim(ctx, task, claimedQuota, preConsumedQuota, err) {
			markTaskSettlementUnrecoverable(ctx, task, fmt.Sprintf("settlement claim could not be released after a failed attempt: %v", err))
		}
		return
	}

	// 令牌额度调整失败：资金已动，必须先把资金补回去再让整笔结算判失败，
	// 否则重试会二次扣费；补不回去就只能转人工核对。
	if err := taskAdjustTokenQuota(ctx, task, quotaDelta); err != nil {
		logger.LogError(ctx, common.LogText("failed to adjust the token quota for the difference, task %s: %s", task.TaskID, err.Error()))
		if cerr := taskAdjustFunding(task, -quotaDelta); cerr != nil {
			logger.LogError(ctx, common.LogText("failed to compensate the funding after the token quota failure, task %s: %s", task.TaskID, cerr.Error()))
			markTaskSettlementUnrecoverable(ctx, task,
				fmt.Sprintf("token quota adjustment failed (%v) and funding compensation failed (%v)", err, cerr))
			task.Quota = claimedQuota
			return
		}
		if !releaseTaskSettlementClaim(ctx, task, claimedQuota, preConsumedQuota, err) {
			markTaskSettlementUnrecoverable(ctx, task,
				fmt.Sprintf("settlement claim could not be released after a token quota failure: %v", err))
		}
		return
	}

	task.Quota = actualQuota

	// 提交阶段已经累计过一次请求；结算阶段只调整最终用量。
	model.UpdateUserUsedQuota(task.UserId, quotaDelta)
	model.UpdateChannelUsedQuota(task.ChannelId, quotaDelta)

	var logType int
	var logQuota int
	if quotaDelta > 0 {
		logType = model.LogTypeConsume
		logQuota = quotaDelta
	} else {
		logType = model.LogTypeRefund
		logQuota = -quotaDelta
	}
	other := taskBillingOther(task)
	other.SetPublic("task_id", task.TaskID)
	other.SetPublic("pre_consumed_quota", preConsumedQuota)
	other.SetPublic("actual_quota", actualQuota)
	for _, clamp := range clamps {
		attachQuotaSaturationToOther(other, clamp)
	}
	model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
		UserId:    task.UserId,
		LogType:   logType,
		Content:   []*common.Message{reason},
		ChannelId: task.ChannelId,
		ModelName: taskModelName(task),
		Quota:     logQuota,
		TokenId:   task.PrivateData.TokenId,
		Group:     task.Group,
		Other:     other,
		NodeName:  task.PrivateData.NodeName,
	})

	// 资金已动且任务记录已推进到 actualQuota：进入终态。
	if _, serr := model.TransitionTaskBilling(task.TaskID, model.TaskBillingTransition{
		FromState: model.TaskBillingSettlementPending,
		ToState:   model.TaskBillingSettled,
	}); serr != nil {
		logger.LogError(ctx, common.LogText("settlement succeeded but the final state could not be recorded, task %s: %s", task.TaskID, serr.Error()))
	}
}

// releaseTaskSettlementClaim 结算失败时释放抢占：把任务 quota 改回预扣值并
// 回到可重试状态。
//
// claimedQuota 是抢占时写进库里的当前 quota（即结算目标额度）。关键是不能拿
// 内存里的旧值当 FromQuota——抢占已经把它推进过，用旧值做条件 UPDATE 一条都
// 命中不了，释放会静默失败：任务永远卡在 settlement_pending 且带着被推进过的
// quota，对账任务反复捞起、每次重试都按错误的基数算差额。
//
// 返回 false 表示释放失败（状态已被其他请求改写），调用方必须转人工核对。
func releaseTaskSettlementClaim(ctx context.Context, task *model.Task, claimedQuota, preConsumedQuota int, cause error) bool {
	won, err := model.TransitionTaskBilling(task.TaskID, model.TaskBillingTransition{
		FromState: model.TaskBillingSettlementPending,
		ToState:   currentTaskBillingState(task),
		FromQuota: &claimedQuota,
		ToQuota:   &preConsumedQuota,
		LastError: cause.Error(),
	})
	if err != nil {
		logger.LogError(ctx, common.LogText("failed to release the settlement claim for task %s: %s", task.TaskID, err.Error()))
		return false
	}
	if !won {
		logger.LogError(ctx, common.LogText("the settlement claim for task %s was already advanced by another attempt; manual reconciliation is required", task.TaskID))
		return false
	}
	task.Quota = preConsumedQuota
	return true
}

// markTaskSettlementUnrecoverable 把无法自动恢复的结算残局转人工核对。
func markTaskSettlementUnrecoverable(ctx context.Context, task *model.Task, reason string) {
	logger.LogError(ctx, common.LogText("task %s needs manual billing reconciliation: %s", task.TaskID, reason))
	if err := model.MarkTaskBillingForReconciliation(task.TaskID, reason); err != nil {
		logger.LogError(ctx, common.LogText("failed to mark task %s for reconciliation: %s", task.TaskID, err.Error()))
	}
}

// RecalculateTaskQuotaByTokens 根据实际 token 消耗重新计费（异步差额结算）。
// 当任务成功且返回了 totalTokens 时，根据模型倍率和分组倍率重新计算实际扣费额度，
// 与预扣费的差额进行补扣或退还。支持钱包和订阅计费来源。
func RecalculateTaskQuotaByTokens(ctx context.Context, task *model.Task, totalTokens int) bool {
	if totalTokens <= 0 {
		return false
	}

	modelName := taskModelName(task)

	// 获取模型价格和倍率
	modelRatio, hasRatioSetting, _ := ratio_setting.GetModelRatio(modelName)
	// 只有配置了倍率(非固定价格)时才按 token 重新计费
	if !hasRatioSetting || modelRatio <= 0 {
		return false
	}

	// 获取用户和组的倍率信息
	// 资金口径只用提交时快照：task.Group 为空（存量数据缺快照）时不回查
	// 用户「当前」分组——用户可能在任务执行期间被改组，按新组倍率重算会
	// 让计费口径漂移。此时保持预扣额度不重算，并记录告警供人工核对。
	group := task.Group
	if group == "" {
		logger.LogWarn(ctx, common.LogText(
			"task %s has no group snapshot; keep pre-deducted quota without token recalculation",
			task.TaskID))
		return false
	}
	if group == "" {
		return false
	}

	groupRatio := ratio_setting.GetGroupRatio(group)
	userGroupRatio, hasUserGroupRatio := ratio_setting.GetGroupGroupRatio(group, group)

	var finalGroupRatio float64
	if hasUserGroupRatio {
		finalGroupRatio = userGroupRatio
	} else {
		finalGroupRatio = groupRatio
	}

	// 计算 OtherRatios 乘积（视频折扣、时长等）
	otherMultiplier := 1.0
	if priceData := taskBillingContextPriceData(task.PrivateData.BillingContext); priceData != nil {
		otherMultiplier = priceData.OtherRatioMultiplier()
	}

	// 计算实际应扣费额度: totalTokens * modelRatio * groupRatio * otherMultiplier（饱和转换，防止溢出成负数）
	actualQuota, clamp := common.QuotaFromFloatChecked(float64(totalTokens) * modelRatio * finalGroupRatio * otherMultiplier)

	reason := common.NewMessage("Recalculated from tokens: tokens {{tokens}}, model ratio {{model_ratio}}, group ratio {{group_ratio}}, other multiplier {{other_multiplier}}", map[string]any{
		"tokens":           totalTokens,
		"model_ratio":      fmt.Sprintf("%.2f", modelRatio),
		"group_ratio":      fmt.Sprintf("%.2f", finalGroupRatio),
		"other_multiplier": fmt.Sprintf("%.4f", otherMultiplier),
	})
	RecalculateTaskQuota(ctx, task, actualQuota, reason, clamp)
	return true
}

// EvaluateTaskCompletionUsage evaluates actual facts against the frozen task
// expression. It neither mutates the snapshot nor moves funds: synchronous
// submission and polling have different persistence and settlement barriers.
func EvaluateTaskCompletionUsage(snap *billingexpr.BillingSnapshot, facts map[string]any) (billingexpr.TieredResult, map[string]any, error) {
	if snap == nil {
		return billingexpr.TieredResult{}, nil, fmt.Errorf("task billing snapshot is missing")
	}
	usage := make(map[string]any, len(snap.UsageFacts)+len(facts))
	maps.Copy(usage, snap.UsageFacts)
	maps.Copy(usage, facts)
	result, err := billingexpr.ComputeTieredQuotaWithRequest(snap, billingexpr.TokenParams{}, billingexpr.RequestInput{Usage: usage})
	if err == nil && (result.ActualQuotaBeforeGroup < 0 || math.IsNaN(result.ActualQuotaBeforeGroup)) {
		err = fmt.Errorf("task completion expression produced an invalid cost")
	}
	return result, usage, err
}

// ---------------------------------------------------------------------------
// 计费对账任务
// ---------------------------------------------------------------------------

// 对账任务的节奏参数。
const (
	// taskBillingReconcileBatch 单轮处理的任务数，剩余的下轮继续，避免一次载入全表。
	taskBillingReconcileBatch = 100
	// taskBillingStuckGraceSeconds 退避窗口：最后更新落在这个窗口内的行可能
	// 仍在正常处理中，对账任务不能把它当成卡死任务反复捞起。
	taskBillingStuckGraceSeconds = 300
	// taskBillingMaxAutoAttempts 自动重试预算。每抢占一次记一次，用尽即转人工。
	taskBillingMaxAutoAttempts = 5
)

// ReconcileStuckTaskBilling 对账：把「终态已定但计费未收口」的任务恢复或升级。
//
// 分两类处理，区别在于资金是否已经动过：
//
//   - 中间态（settlement_pending / refund_pending）：执行权已被某个请求抢占，
//     而进程可能在抢占与动账之间崩溃，资金是否已动无从得知。盲目重试会二次
//     扣费或二次退款，因此超过退避窗口后一律转人工核对；
//   - 已释放回 pending 的终态任务：动账在进程内失败、抢占已释放，资金确定未动
//     （或已补偿回未执行状态），可以按原参数重试；重试预算用尽、或缺少重放
//     参数（结算目标额度）时转人工核对。
//
// 有限退避 + 最大重试 + 无法可靠恢复时转 reconciliation_required，三者共同保证
// 没有一笔计费会永远停在一半，也没有一笔计费会被自动重试重复执行。
func ReconcileStuckTaskBilling(ctx context.Context) {
	if ctx == nil {
		ctx = context.Background()
	}
	deadline := time.Now().Unix() - taskBillingStuckGraceSeconds

	reconcileClaimedTaskBilling(ctx, deadline)
	reconcileUnfinishedTaskBilling(ctx, deadline)
}

// reconcileClaimedTaskBilling 处理「抢占后未能收口」的中间态任务。
func reconcileClaimedTaskBilling(ctx context.Context, olderThan int64) {
	tasks, err := model.ListTasksAwaitingBillingFinality(taskBillingReconcileBatch, olderThan)
	if err != nil {
		logger.LogError(ctx, common.LogText("failed to list tasks stuck in a billing claim: %s", err.Error()))
		return
	}
	for i := range tasks {
		task := &tasks[i]
		reason := fmt.Sprintf("billing claim %s was never completed; the funding side may or may not have moved, manual reconciliation is required", task.BillingState)
		if err := model.MarkTaskBillingForReconciliation(task.TaskID, reason); err != nil {
			logger.LogError(ctx, common.LogText("failed to mark task %s for billing reconciliation: %s", task.TaskID, err.Error()))
			continue
		}
		logger.LogWarn(ctx, common.LogText("task %s was stuck in billing state %s and has been marked for reconciliation", task.TaskID, task.BillingState))
	}
}

// reconcileUnfinishedTaskBilling 重试或升级「终态已定、计费未收口」的任务。
func reconcileUnfinishedTaskBilling(ctx context.Context, olderThan int64) {
	tasks, err := model.ListTasksWithUnfinishedBilling(taskBillingReconcileBatch, olderThan)
	if err != nil {
		logger.LogError(ctx, common.LogText("failed to list terminal tasks with unfinished billing: %s", err.Error()))
		return
	}
	for i := range tasks {
		task := &tasks[i]
		switch {
		case task.Quota == 0:
			// 没有待结算的额度：直接收口，避免终态任务永远停在非终态。
			RecalculateTaskQuota(ctx, task, 0, common.NewMessage("No quota left to settle; finalized by the billing reconciliation"))
		case task.Status == model.TaskStatusFailure:
			// 失败任务的退款是确定性的：退当前 quota，不需要重新求值。
			if task.BillingRetryCount >= taskBillingMaxAutoAttempts {
				markTaskBillingForReconciliation(ctx, task, "the refund retry budget is exhausted")
				continue
			}
			if !RefundTaskQuota(ctx, task, task.FailReason) {
				logger.LogWarn(ctx, common.LogText("billing reconciliation could not refund task %s yet; it stays retryable", task.TaskID))
			}
		case task.BillingTargetQuota > 0 && task.BillingRetryCount < taskBillingMaxAutoAttempts:
			// 结算重试：用抢占时固化的目标额度重放。上游用量结果此时已经拿不到，
			// 重新求值会得到一个不同的数，因此只认固化的目标。
			RecalculateTaskQuota(ctx, task, task.BillingTargetQuota, common.NewMessage("Settled by the billing reconciliation retry"))
		default:
			// 没有固化的结算目标（或重试预算用尽）：无法可靠恢复。
			markTaskBillingForReconciliation(ctx, task, "the settlement target quota is unknown or the retry budget is exhausted")
		}
	}
}

// markTaskBillingForReconciliation 把任务转入人工核对队列并记录原因。
func markTaskBillingForReconciliation(ctx context.Context, task *model.Task, reason string) {
	full := fmt.Sprintf("%s (task %s, status %s, quota %d, attempts %d)",
		reason, task.TaskID, task.Status, task.Quota, task.BillingRetryCount)
	if err := model.MarkTaskBillingForReconciliation(task.TaskID, full); err != nil {
		logger.LogError(ctx, common.LogText("failed to mark task %s for billing reconciliation: %s", task.TaskID, err.Error()))
		return
	}
	logger.LogWarn(ctx, common.LogText("task %s needs manual billing reconciliation: %s", task.TaskID, reason))
}
