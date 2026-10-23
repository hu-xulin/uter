package service

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/logger"
	"github.com/uter-ai/uter/model"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/types"
)

const (
	BillingSourceWallet       = "wallet"
	BillingSourceSubscription = "subscription"
)

// PreConsumeBilling 根据用户计费偏好创建 BillingSession 并执行预扣费。
// 会话存储在 relayInfo.Billing 上，供后续 Settle / Refund 使用。
// 会话已存在时（任务重试换到另一个渠道）把预扣补到 preConsumedQuota，
// 和首次预扣一样必须由余额覆盖。
func PreConsumeBilling(c *gin.Context, preConsumedQuota int, relayInfo *relaycommon.RelayInfo) *types.NewAPIError {
	if relayInfo != nil && relayInfo.QuotaClamp != nil {
		return types.NewErrorWithStatusCode(
			relayInfo.QuotaClamp,
			types.ErrorCodeModelPriceError,
			http.StatusBadRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}
	if preConsumedQuota < 0 {
		return types.NewErrorWithStatusCode(
			fmt.Errorf("pre-consume quota cannot be negative: %d", preConsumedQuota),
			types.ErrorCodeModelPriceError,
			http.StatusBadRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}
	if relayInfo != nil && relayInfo.Billing != nil {
		if err := relayInfo.Billing.ReserveBeforeSubmit(preConsumedQuota); err != nil {
			var apiErr *types.NewAPIError
			if errors.As(err, &apiErr) {
				return apiErr
			}
			return types.NewErrorWithStatusCode(err, types.ErrorCodeInsufficientUserQuota, http.StatusForbidden, types.ErrOptionWithSkipRetry())
		}
		return nil
	}
	session, apiErr := NewBillingSession(c, relayInfo, preConsumedQuota)
	if apiErr != nil {
		return apiErr
	}
	relayInfo.Billing = session
	return nil
}

// ---------------------------------------------------------------------------
// SettleBilling — 后结算辅助函数
// ---------------------------------------------------------------------------

// SettleBilling 执行计费结算。如果 RelayInfo 上有 BillingSession 则通过 session 结算，
// 否则回退到旧的 PostConsumeQuota 路径（兼容按次计费等场景）。
func SettleBilling(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, actualQuota int) error {
	if relayInfo.Billing != nil {
		preConsumed := relayInfo.Billing.GetPreConsumedQuota()
		delta := actualQuota - preConsumed

		if delta > 0 {
			logger.LogInfo(ctx, common.LogText("charging the difference after pre-consume: %s (actual %s, pre-consumed %s)",
				logger.FormatQuota(delta),
				logger.FormatQuota(actualQuota),
				logger.FormatQuota(preConsumed),
			))
		} else if delta < 0 {
			logger.LogInfo(ctx, common.LogText("refunding the difference after pre-consume: %s (actual %s, pre-consumed %s)",
				logger.FormatQuota(-delta),
				logger.FormatQuota(actualQuota),
				logger.FormatQuota(preConsumed),
			))
		} else {
			logger.LogInfo(ctx, common.LogText("pre-consumed quota matches the actual quota, no adjustment: %s (per-request billing)",
				logger.FormatQuota(actualQuota),
			))
		}

		if err := relayInfo.Billing.Settle(actualQuota); err != nil {
			return err
		}

		// DEF-6：触发计费上限截断时，上面那条「charging the difference」是按
		// 截断前的 actualQuota 写的，与实际扣减不符；补一条告警把真实生效额
		// 暴露出来，便于对账方识别「上游花了但只收到上限额」的会话。
		if reporter, ok := relayInfo.Billing.(settledQuotaReporter); ok {
			if effective, clamped := reporter.SettledQuota(); clamped {
				logger.LogWarn(ctx, common.LogText(
					"wallet billing ceiling clamped settlement: actual %s, billed %s, pre-consumed %s (userId=%d)",
					logger.FormatQuota(actualQuota), logger.FormatQuota(effective), logger.FormatQuota(preConsumed), relayInfo.UserId))
			}
		}

		// 发送额度通知（订阅计费使用订阅剩余额度）
		if actualQuota != 0 {
			if relayInfo.BillingSource == BillingSourceSubscription {
				checkAndSendSubscriptionQuotaNotify(relayInfo)
			} else {
				checkAndSendQuotaNotify(relayInfo, actualQuota-preConsumed, preConsumed)
			}
		}
		return nil
	}

	// 回退：无 BillingSession 时使用旧路径
	quotaDelta := actualQuota - relayInfo.FinalPreConsumedQuota
	if quotaDelta != 0 {
		return PostConsumeQuota(relayInfo, quotaDelta, relayInfo.FinalPreConsumedQuota, true)
	}
	return nil
}

// LogOtherSettleErrorKey 是结算失败写在用量日志 other 上的标记键。
//
// 对账方据此把「结算未落地」的请求挑出来人工核对，而不是把日志里的额度当成
// 已经扣干净的事实。
const LogOtherSettleErrorKey = "settle_error"

// SettleBillingForLog 执行结算，并返回**应当写入用量日志的额度**与是否发生了
// 结算失败。
//
// BE-BIL-022：SettleBilling 只在「资金来源未提交」时返回错误——此时超出预扣的
// 那部分并没有真正扣到用户账上（见 BillingSession.Settle 的分两步提交与
// FundingSettled 的契约说明）。若仍按结算前的全额写日志，日志会宣称「全额已扣」
// 而余额只少了预扣额，「初始余额 − 最终余额 == logs.Quota」这条 P0 不变量被
// 打破，账单出现虚假已扣——用户看到的消费记录比实际扣款多。
//
// 这里收敛到**已经落地的预扣额**而不是写 0：预扣本身就是一次真实扣减，写 0 同样
// 与余额对不上，只是把偏差翻到另一个方向。两者都不会虚报全额，但只有记预扣额能
// 同时守住不变量与「绝不虚报已扣」。调用方拿到 settleFailed 后应在 other 上打
// LogOtherSettleErrorKey 标记。
//
// DEF-6：会话触发计费上限截断（BillingSession.SettledQuota 的 clamped）时，
// 落到账上的只有截断后的额度，日志必须记同一个数——否则日志宣称「全额已扣」
// 而余额只少了一部分，正是本条不变量要防的假账。
func SettleBillingForLog(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, actualQuota int) (loggedQuota int, settleFailed bool) {
	if err := SettleBilling(ctx, relayInfo, actualQuota); err != nil {
		logger.LogError(ctx, common.LogText("error settling billing: %s", err.Error()))
		if relayInfo == nil {
			return 0, true
		}
		return relayInfo.FinalPreConsumedQuota, true
	}
	if relayInfo != nil {
		if reporter, ok := relayInfo.Billing.(settledQuotaReporter); ok {
			if effective, clamped := reporter.SettledQuota(); clamped {
				return effective, false
			}
		}
	}
	return actualQuota, false
}

// settledQuotaReporter 是 BillingSession 实现的可选接口：结算被计费上限
// 截断时，用量日志需要拿到真正扣到账上的额度（见 SettleBillingForLog）。
// 单列为可选接口而非加进 relaycommon.BillingSettler：其余实现（含测试替身）
// 没有截断概念，不该被迫回答这个问题。
type settledQuotaReporter interface {
	SettledQuota() (quota int, clamped bool)
}

// markSettleError 把结算失败标记写进用量日志的 other。
func markSettleError(other *model.LogOther, settleFailed bool) {
	if !settleFailed || other == nil {
		return
	}
	other.SetPublic(LogOtherSettleErrorKey, true)
}

// recordMemberUsage 在结算点记录成员用量。组织成员的实际 used_quota 已由 WalletFunding.Settle
// 按「实际 - 预扣」差额并入（与预扣点的原子预留对账），这里只负责请求计数；其余情况
// （非组织成员、或走旧路径无 BillingSession）仍按原逻辑累加 used_quota + request_count。
//
// 注意：不可在组织分支里再调 UpdateUserUsedQuotaAndRequestCount(userId, quota)，否则会与
// WalletFunding.Settle 的差额并入重复计账（used_quota 会变成 actual + delta）。
func recordMemberUsage(relayInfo *relaycommon.RelayInfo, quota int) {
	if relayInfo != nil && relayInfo.Billing != nil {
		if orgId, err := resolveOrgIdForBilling(relayInfo); err == nil && orgId > 0 {
			model.UpdateUserRequestCount(relayInfo.UserId)
			return
		}
	}
	model.UpdateUserUsedQuotaAndRequestCount(relayInfo.UserId, quota)
}
