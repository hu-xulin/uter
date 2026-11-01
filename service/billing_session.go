package service

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"strings"
	"sync"

	"github.com/uter-ai/uter/common"

	"github.com/uter-ai/uter/logger"
	"github.com/uter-ai/uter/model"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
	"github.com/uter-ai/uter/relaykit/types"
	"github.com/uter-ai/uter/setting/operation_setting"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

// ---------------------------------------------------------------------------
// BillingSession — 统一计费会话
// ---------------------------------------------------------------------------

// BillingSession 封装单次请求的预扣费/结算/退款生命周期。
// 实现 relaycommon.BillingSettler 接口。
type BillingSession struct {
	relayInfo        *relaycommon.RelayInfo
	funding          FundingSource
	preConsumedQuota int  // 实际预扣额度（信任用户可能为 0）
	tokenConsumed    int  // 令牌额度实际扣减量
	extraReserved    int  // 发送前补充预扣的额度（订阅退款时需要单独回滚）
	trusted          bool // 是否命中信任额度旁路
	fundingSettled   bool // funding.Settle 已成功，资金来源已提交
	settled          bool // Settle 全部完成（资金 + 令牌）
	refunded         bool // Refund 已调用
	refundDone       chan struct{}
	mu               sync.Mutex

	// billingCeiling 是本会话向个人钱包计费的上限：准入时读到的余额减去
	// 配置的债务下限（WALLET_DEBT_FLOOR_QUOTA）。ceilingSet 为真时才生效，
	// 且仅在「平台直管用户 + 钱包出资」的准入分支设置——组织成员的出资方是
	// 组织共享预算，其透支由 ReserveOrgQuota 的原子闸门负责，按设计不在
	// 结算点截断（见 funding_source.go 中组织 true-up 的说明）。
	//
	// 为什么需要它（DEF-6）：准入只能按「预扣估算额」校验余额，而请求的
	// 真实成本在结算时才可知——无 max_tokens 的流式请求尤其没有上界。
	// 信任旁路（shouldTrust）连估算额都不扣，结算时的补扣于是可以把钱包
	// 打到任意深度（实测余额 100、实扣 10000 → -9900）。把准入时的余额
	// 口径延续成会话级上限后，「实扣上限 ≤ 可用额度 + 债务下限」成为硬不变量。
	billingCeiling int
	ceilingSet     bool

	// settledQuota / settledQuotaClamped 记录结算最终实际生效的额度：
	// 触发计费上限截断时它小于调用方传入的 actualQuota。用量日志必须记这个
	// 值而不是原始 actualQuota，否则「初始余额 − 最终余额 == logs.Quota」
	// 这条 P0 不变量会在被截断的会话上破裂（日志宣称全额已扣，余额只少了一部分）。
	settledQuota        int
	settledQuotaClamped bool
}

// SettledQuota 返回结算最终生效的额度，以及是否发生了计费上限截断。
// 实现供 SettleBillingForLog 使用的可选接口（settledQuotaReporter）。
func (s *BillingSession) SettledQuota() (int, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.settledQuota, s.settledQuotaClamped
}

// Settle 根据实际消耗额度进行结算。
// 资金来源和令牌额度分两步提交：若资金来源已提交但令牌调整失败，
// 会标记 fundingSettled 防止 Refund 对已提交的资金来源执行退款。
func (s *BillingSession) Settle(actualQuota int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.settled {
		return nil
	}
	// DEF-6 硬闸门：钱包出资的会话，实际计费额不得突破准入时确定的余额上限
	// （可用额度 + 债务下限）。截断只可能发生在「真实成本远超估算」的请求上
	// ——信任旁路下预扣为 0、无 max_tokens 的流式请求是典型。被截断时令牌
	// 账本与资金来源按同一生效额调整，用量日志记生效额（见 SettledQuota），
	// 三条账本始终一致。
	effectiveQuota := actualQuota
	if s.ceilingSet && s.funding.Source() == BillingSourceWallet && effectiveQuota > s.billingCeiling {
		effectiveQuota = s.billingCeiling
		s.settledQuotaClamped = true
	}
	s.settledQuota = effectiveQuota
	delta := effectiveQuota - s.preConsumedQuota
	if delta == 0 {
		s.settled = true
		return nil
	}
	// 1) 调整资金来源（仅在尚未提交时执行，防止重复调用）
	if !s.fundingSettled {
		if err := s.funding.Settle(delta); err != nil {
			return err
		}
		s.fundingSettled = true
	}
	// 2) 调整令牌额度
	if !s.relayInfo.IsPlayground {
		tokenFn := func() error {
			if delta > 0 {
				return model.DecreaseTokenQuota(s.relayInfo.TokenId, s.relayInfo.TokenKey, delta)
			}
			return model.IncreaseTokenQuota(s.relayInfo.TokenId, s.relayInfo.TokenKey, -delta)
		}
		// 资金来源已提交，令牌账本失败不可重试整个 Settle（否则会重复结算资金）。
		// 但令牌额度本身必须尽量对齐：对令牌调整做有限次重试；仍失败则上报为
		// 需人工对账的告警事件（SysError 而非 SysLog），而非静默丢弃导致账本漂移。
		const maxTokenAdjustRetries = 3
		for attempt := 0; attempt < maxTokenAdjustRetries; attempt++ {
			if tokenErr := tokenFn(); tokenErr == nil {
				break
			} else if attempt == maxTokenAdjustRetries-1 {
				// 末次尝试仍失败：资金已经落地，只剩令牌账本漂移。
				// 这不是「扣费没落库」，所以不能作为 Settle 的错误返回给上层
				// （上层见到错误会把 logs.Quota 记 0，与真实扣掉的额度矛盾，
				// 破坏「初始余额 − 最终余额 == logs.Quota」不变量）。
				common.SysError(fmt.Sprintf("token quota adjust permanently failed after %d attempts, ledger drift risk (userId=%d, tokenId=%d, delta=%d): %s",
					maxTokenAdjustRetries, s.relayInfo.UserId, s.relayInfo.TokenId, delta, tokenErr.Error()))
			} else {
				common.SysLog(fmt.Sprintf("token quota adjust attempt %d failed (userId=%d, tokenId=%d, delta=%d): %s",
					attempt+1, s.relayInfo.UserId, s.relayInfo.TokenId, delta, tokenErr.Error()))
			}
		}
	}
	// 3) 更新 relayInfo 上的订阅 PostDelta（用于日志）
	if s.funding.Source() == BillingSourceSubscription {
		s.relayInfo.SubscriptionPostDelta += int64(delta)
	}
	s.settled = true
	// 只有「资金未提交」才是结算失败，资金已落地时一律返回 nil：
	// 令牌漂移已由上面的 SysError 上报，需要人工对账，但不能污染用量日志。
	return nil
}

// FundingSettled 报告资金来源是否已提交结算差额。
//
// Settle 分两步提交（资金来源 → 令牌额度）：资金来源失败时超出预扣的部分并没有
// 真正扣到，此时日志只能记已经落地的预扣额；令牌失败则资金已扣、仅令牌账本漂移。
// Settle 只在前者返回错误，后者的漂移已由 SysError 单独告警，不再作为错误上抛，
// 因此调用方不会把「已扣全额」误记成 0。此方法供需要区分两者的调用方使用。
func (s *BillingSession) FundingSettled() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.fundingSettled
}

// Refund 退还所有预扣费，幂等安全，异步执行。
func (s *BillingSession) Refund(c *gin.Context) {
	s.mu.Lock()
	if s.settled || s.refunded || !s.needsRefundLocked() {
		s.mu.Unlock()
		return
	}
	s.refunded = true
	// 退款仍在后台执行（不拖慢失败请求的响应），但必须给调用方一个可等待的
	// 完成信号：违规扣费同样要写 users.quota，两者必须串行，否则退款与扣费
	// 在缓存层的异步刷新无序，且退款可能在 MaxWalletQuota 上限附近整笔失败。
	refundDone := make(chan struct{})
	s.refundDone = refundDone
	s.mu.Unlock()

	logger.LogInfo(c, fmt.Sprintf("用户 %d 请求失败, 返还预扣费（token_quota=%s, funding=%s）",
		s.relayInfo.UserId,
		logger.FormatQuota(s.tokenConsumed),
		s.funding.Source(),
	))

	// 复制需要的值到闭包中
	tokenId := s.relayInfo.TokenId
	tokenKey := s.relayInfo.TokenKey
	isPlayground := s.relayInfo.IsPlayground
	tokenConsumed := s.tokenConsumed
	extraReserved := s.extraReserved
	subscriptionId := s.relayInfo.SubscriptionId
	funding := s.funding
	userId := s.relayInfo.UserId

	// 持久化退款意图：异步执行前先落凭证。退款原语与完成标记在
	// ExecuteRefundIntent 内同事务提交，进程在执行窗口内崩溃时凭证保持
	// pending，由 SweepPendingRefundIntents 安全重放（不会多退）。落库失败
	// 时回退旧的进程内路径，行为与历史版本一致（尽力而为 + SysError 告警）。
	intentId, intentErr := buildRefundIntent(funding, userId, tokenId, tokenConsumed, !isPlayground, extraReserved)
	if intentErr != nil {
		common.SysLog(fmt.Sprintf("refund intent persist failed, falling back to in-process refund (userId=%d): %s",
			userId, intentErr.Error()))
	}

	gopool.Go(func() {
		defer close(refundDone)
		if intentId > 0 {
			if err := model.ExecuteRefundIntent(intentId); err != nil {
				common.SysError(fmt.Sprintf("refund intent %d execution failed (userId=%d), stays pending for sweep: %s",
					intentId, userId, err.Error()))
			}
			return
		}
		// 1) 退还资金来源
		if err := funding.Refund(); err != nil {
			common.SysLog("error refunding billing source: " + err.Error())
		}
		if extraReserved > 0 && funding.Source() == BillingSourceSubscription && subscriptionId > 0 {
			if err := model.PostConsumeUserSubscriptionDelta(subscriptionId, -int64(extraReserved)); err != nil {
				common.SysLog("error refunding subscription extra reserved quota: " + err.Error())
			}
		}
		// 2) 退还令牌额度
		if tokenConsumed > 0 && !isPlayground {
			if err := model.IncreaseTokenQuota(tokenId, tokenKey, tokenConsumed); err != nil {
				common.SysLog("error refunding token quota: " + err.Error())
			}
		}
	})
}

// buildRefundIntent 把本次退款快照落为持久化凭证，返回凭证 id（0 表示没有
// 需要持久化的退款内容）。钱包出资的归属解析失败必须上抛——宁可回退旧路径
// 告警，也不能把组织预扣猜成个人钱包退掉。
func buildRefundIntent(funding FundingSource, userId, tokenId, tokenConsumed int, refundToken bool, extraReserved int) (int, error) {
	intent := &model.RefundIntent{
		UserId:        userId,
		FundingSource: funding.Source(),
	}
	switch f := funding.(type) {
	case *WalletFunding:
		orgId, err := f.resolveOrgId()
		if err != nil {
			return 0, fmt.Errorf("resolve funding org of user %d: %w", userId, err)
		}
		intent.OrgResolved = true
		intent.OrgId = orgId
		intent.WalletAmount = f.consumed
	case *SubscriptionFunding:
		intent.SubRequestId = f.requestId
		intent.SubId = f.subscriptionId
		intent.SubExtra = int64(extraReserved)
	default:
		return 0, fmt.Errorf("unsupported funding source %q for refund intent", funding.Source())
	}
	if refundToken && tokenConsumed > 0 {
		intent.TokenId = tokenId
		intent.TokenConsumed = tokenConsumed
	}
	if intent.WalletAmount <= 0 && intent.SubExtra <= 0 && intent.TokenConsumed <= 0 {
		return 0, nil
	}
	if err := model.CreateRefundIntent(intent); err != nil {
		return 0, err
	}
	return intent.Id, nil
}

// NeedsRefund 返回是否存在需要退还的预扣状态。
func (s *BillingSession) NeedsRefund() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.needsRefundLocked()
}

// WaitRefundDone 等待 Refund 后台任务真正结束；未发起过退款时立即返回。
//
// 用于必须排在退款之后的写操作（例如违规扣费）：两者都会
// UPDATE users SET quota = quota ∓ N，各自 DB 层原子但缓存层异步刷新无序，
// 且 IncreaseUserQuota 带 MaxWalletQuota 上限条件，退款与扣费并发时退款可能
// 整笔失败——用户被吞一笔预扣的同时又被扣违规费。
func (s *BillingSession) WaitRefundDone() {
	s.mu.Lock()
	done := s.refundDone
	s.mu.Unlock()
	if done == nil {
		return
	}
	<-done
}

func (s *BillingSession) needsRefundLocked() bool {
	if s.settled || s.refunded || s.fundingSettled {
		// fundingSettled 时资金来源已提交结算，不能再退预扣费
		return false
	}
	if s.tokenConsumed > 0 {
		return true
	}
	// 订阅可能在 tokenConsumed=0 时仍预扣了额度
	if sub, ok := s.funding.(*SubscriptionFunding); ok && sub.preConsumed > 0 {
		return true
	}
	return false
}

// GetPreConsumedQuota 返回实际预扣的额度。
//
// 必须持锁读取：preConsumedQuota 由 Reserve / preConsume 在 s.mu 下写入，而本方法
// 常由 relay 侧的日志/补扣路径并发调用，无锁读会构成数据竞争（-race 可复现）。
func (s *BillingSession) GetPreConsumedQuota() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.preConsumedQuota
}

func (s *BillingSession) Reserve(targetQuota int) error {
	return s.reserve(targetQuota, false)
}

// ReserveBeforeSubmit 在发起上游请求前补扣，钱包余额必须覆盖差额。
func (s *BillingSession) ReserveBeforeSubmit(targetQuota int) error {
	return s.reserve(targetQuota, true)
}

func (s *BillingSession) reserve(targetQuota int, requireAvailableQuota bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.relayInfo != nil {
		_, imageRequest := s.relayInfo.Request.(*dto.ImageRequest)
		requireAvailableQuota = requireAvailableQuota || imageRequest || s.relayInfo.ImageRequestCount > 0
	}
	if s.settled || s.refunded || s.trusted && !requireAvailableQuota || targetQuota <= s.preConsumedQuota {
		return nil
	}

	delta := targetQuota - s.preConsumedQuota
	if delta <= 0 {
		return nil
	}

	if err := s.reserveFunding(delta, requireAvailableQuota); err != nil {
		return err
	}
	if err := s.reserveToken(delta); err != nil {
		s.rollbackFundingReserve(delta)
		return err
	}

	s.preConsumedQuota += delta
	s.tokenConsumed += delta
	s.extraReserved += delta
	if requireAvailableQuota {
		s.trusted = false
	}
	s.syncRelayInfo()
	return nil
}

// ---------------------------------------------------------------------------
// PreConsume — 统一预扣费入口（含信任额度旁路）
// ---------------------------------------------------------------------------

// preConsume 执行预扣费：信任检查 -> 令牌预扣 -> 资金来源预扣。
// 任一步骤失败时原子回滚已完成的步骤。
func (s *BillingSession) preConsume(c *gin.Context, quota int) *types.UterError {
	effectiveQuota := quota

	// ---- 信任额度旁路 ----
	if s.shouldTrust(c) {
		s.trusted = true
		effectiveQuota = 0
		logger.LogInfo(c, fmt.Sprintf("用户 %d 额度充足, 信任且不需要预扣费 (funding=%s)", s.relayInfo.UserId, s.funding.Source()))
	} else {
		// 组织成员：把「校验额」与「实际预留额」统一到同一个口径上。
		//
		// 旧实现在 NewBillingSession 里用 max(preConsumedQuota,1) 做只读预检查，
		// 实际预扣却仍用原始 preConsumedQuota（可能是 0）——校验完就把闸门绕过去了：
		// 零预估请求既不触发 ReserveOrgQuota，也留下了「已经检查过」的假象，
		// 并发突发下全员通过。现在校验与预留共用 OrgAdmissionReserveAmount：
		// effectiveQuota 同时决定令牌预扣、组织原子预留和 preConsumedQuota，
		// 三者恒等，因此不存在「预留了却没记账」的残留。
		if wf, ok := s.funding.(*WalletFunding); ok && wf.OrgFunded() {
			effectiveQuota = int(model.OrgAdmissionReserveAmount(int64(effectiveQuota)))
		}
		if effectiveQuota > 0 {
			logger.LogInfo(c, fmt.Sprintf("用户 %d 需要预扣费 %s (funding=%s)", s.relayInfo.UserId, logger.FormatQuota(effectiveQuota), s.funding.Source()))
		}
	}

	// ---- 1) 预扣令牌额度 ----
	if effectiveQuota > 0 {
		if err := PreConsumeTokenQuota(s.relayInfo, effectiveQuota); err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodePreConsumeTokenQuotaFailed, http.StatusForbidden, types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
		}
		s.tokenConsumed = effectiveQuota
	}

	// ---- 2) 预扣资金来源 ----
	if err := s.funding.PreConsume(effectiveQuota); err != nil {
		// 预扣费失败，回滚令牌额度
		if s.tokenConsumed > 0 && !s.relayInfo.IsPlayground {
			if rollbackErr := model.IncreaseTokenQuota(s.relayInfo.TokenId, s.relayInfo.TokenKey, s.tokenConsumed); rollbackErr != nil {
				common.SysLog(fmt.Sprintf("error rolling back token quota (userId=%d, tokenId=%d, amount=%d, fundingErr=%s): %s",
					s.relayInfo.UserId, s.relayInfo.TokenId, s.tokenConsumed, err.Error(), rollbackErr.Error()))
			}
			s.tokenConsumed = 0
		}
		// TODO: model 层应定义哨兵错误（如 ErrNoActiveSubscription），用 errors.Is 替代字符串匹配
		if errors.Is(err, ErrInsufficientWalletQuota) {
			userQuota, quotaErr := model.GetUserQuota(s.relayInfo.UserId, false)
			if quotaErr != nil {
				userQuota = 0
			}
			return types.NewErrorWithStatusCode(
				fmt.Errorf("用户额度不足, 剩余额度: %s", logger.FormatQuota(userQuota)),
				types.ErrorCodeInsufficientUserQuota, http.StatusForbidden,
				types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
		}
		// 组织预算/子额度不足或组织已停用：ReserveOrgQuota 是唯一的原子闸门，
		// 其错误必须映射成「额度不足」而不是通用数据错误，否则客户端只会看到
		// 500 级别的模糊失败，也无法按计费偏好做有意义的回退判断。
		if orgErr := model.AsOrgQuotaError(err); orgErr != nil {
			return types.NewErrorWithStatusCode(orgErr, types.ErrorCodeInsufficientUserQuota, http.StatusForbidden,
				types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
		}
		errMsg := err.Error()
		if strings.Contains(errMsg, "no active subscription") || strings.Contains(errMsg, "subscription quota insufficient") {
			return types.NewErrorWithStatusCode(fmt.Errorf("订阅额度不足或未配置订阅: %s", errMsg), types.ErrorCodeInsufficientUserQuota, http.StatusForbidden, types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
		}
		return types.NewError(err, types.ErrorCodeUpdateDataError, types.ErrOptionWithSkipRetry())
	}

	s.preConsumedQuota = effectiveQuota

	// ---- 同步 RelayInfo 兼容字段 ----
	s.syncRelayInfo()

	return nil
}

func (s *BillingSession) reserveFunding(delta int, requireAvailableQuota bool) error {
	switch funding := s.funding.(type) {
	case *WalletFunding:
		// 组织成员的组织预算是一道硬闸门，必须恒走 ReserveOrgQuota 的原子预留，
		// 不能因请求类型而退化到软分支。软分支用的 IncrOrgUsedQuota 是裸
		// `used_quota = used_quota + ?`（无 WHERE 条件），并发预留时组织预算
		// 可被任意击穿；且它不写成员 users.used_quota，后续 EnforceOrgQuota
		// 读到偏低的成员已用量，会持续放行，子额度形同虚设。
		//
		// 注意这里的顺序：组织判断放在 requireAvailableQuota 之前，因为
		// requireAvailableQuota 只反映「图片请求」，而组织成员可能发的是文本
		// 或 Realtime 请求。
		orgId, orgErr := funding.resolveOrgId()
		if orgErr != nil {
			return types.NewError(orgErr, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
		}
		if orgId > 0 {
			if err := model.ReserveOrgQuota(orgId, funding.userId, int64(delta)); err != nil {
				return types.NewErrorWithStatusCode(err, types.ErrorCodeInsufficientUserQuota, http.StatusForbidden, types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
			}
			// ReserveOrgQuota 已同时写组织账本与成员子额度账本，与 rollback
			// /Refund 的两笔回减严格对称。
			funding.consumed += delta
			return nil
		}
		if requireAvailableQuota {
			// Image quantities and task retry prices are known before
			// submission. Reserve atomically instead of admitting wallet debt.
			if err := funding.PreConsume(delta); err != nil {
				if errors.Is(err, ErrInsufficientWalletQuota) {
					return types.NewErrorWithStatusCode(err, types.ErrorCodeInsufficientUserQuota, http.StatusForbidden, types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
				}
				return types.NewError(err, types.ErrorCodeUpdateDataError, types.ErrOptionWithSkipRetry())
			}
			return nil
		}
		// 与结算补扣（SettleBilling 正差额 → WalletFunding.Settle）语义一致：
		// 全额无条件扣减，余额不足的部分记为欠费（余额可为负），不中断请求，
		// 保证日志记录的预扣额度与用户余额的实际变动始终对账一致。
		// DecreaseUserQuota 仅在数据库错误时失败。
		if err := model.DecreaseUserQuota(funding.userId, delta, false); err != nil {
			return types.NewError(err, types.ErrorCodeUpdateDataError, types.ErrOptionWithSkipRetry())
		}
		funding.consumed += delta
		return nil
	case *SubscriptionFunding:
		if err := model.PostConsumeUserSubscriptionDelta(funding.subscriptionId, int64(delta)); err != nil {
			return types.NewErrorWithStatusCode(
				fmt.Errorf("订阅额度不足或未配置订阅: %s", err.Error()),
				types.ErrorCodeInsufficientUserQuota,
				http.StatusForbidden,
				types.ErrOptionWithSkipRetry(),
				types.ErrOptionWithNoRecordErrorLog(),
			)
		}
		return nil
	default:
		return types.NewError(fmt.Errorf("unsupported funding source: %s", s.funding.Source()), types.ErrorCodeUpdateDataError, types.ErrOptionWithSkipRetry())
	}
}

func (s *BillingSession) rollbackFundingReserve(delta int) {
	switch funding := s.funding.(type) {
	case *WalletFunding:
		// 组织成员的预扣记在组织账本上，回滚必须回到同一本账；
		// IncreaseUserQuota 会把额度错记到个人钱包（并永久虚增余额）。
		// 两笔回减与 reserveFunding 里的 ReserveOrgQuota 严格对称：正向用
		// 一次原子预留同时写 organizations.used_quota 与 members.used_quota，
		// 故这里也必须两笔都减。只减其一会让两本账永久错位。
		//
		// 归属解析失败时**不得**退化成「退到个人钱包」：那会把组织的预扣额
		// 变成个人余额，两本账同时错位。此时直接上抛，让调用方保留
		// funding.consumed 并重试（见 BillingSession.Refund 的错误上报）。
		orgId, orgErr := funding.resolveOrgId()
		if orgErr != nil {
			common.SysError(fmt.Sprintf("cannot roll back organization funding reserve (userId=%d, amount=%d): %s",
				funding.userId, delta, orgErr.Error()))
			return
		}
		if orgId > 0 {
			if err := model.IncrOrgUsedQuota(orgId, -int64(delta)); err != nil {
				common.SysLog("error rolling back organization funding reserve: " + err.Error())
			} else {
				funding.consumed -= delta
			}
			// 撤销预扣点在成员子额度账本上的原子预留，与组织账本回滚保持一致。
			if err := model.IncrUserUsedQuotaClamped(funding.userId, -delta); err != nil {
				common.SysLog("error rolling back member sub-quota reserve: " + err.Error())
			}
			return
		}
		if err := model.IncreaseUserQuota(funding.userId, delta, false); err != nil {
			common.SysLog("error rolling back wallet funding reserve: " + err.Error())
		} else {
			funding.consumed -= delta
		}
	case *SubscriptionFunding:
		if err := model.PostConsumeUserSubscriptionDelta(funding.subscriptionId, -int64(delta)); err != nil {
			common.SysLog("error rolling back subscription funding reserve: " + err.Error())
		}
	}
}

func (s *BillingSession) reserveToken(delta int) error {
	if delta <= 0 || s.relayInfo.IsPlayground {
		return nil
	}
	if err := PreConsumeTokenQuota(s.relayInfo, delta); err != nil {
		return types.NewErrorWithStatusCode(err, types.ErrorCodePreConsumeTokenQuotaFailed, http.StatusForbidden, types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
	}
	return nil
}

// resolveOrgIdForBilling 解析本次请求的计费出资组织，优先复用
// relayInfo.OrganizationId（其契约就是「创建计费会话时解析一次并缓存于此」）。
//
// 计费热路径上组织归属会被反复查询：准入（NewBillingSession 外层 + tryWallet
// 内层）、shouldTrust、WalletFunding.PreConsume / Settle / Refund、
// reserveFunding、recordMemberUsage。Redis 关闭时每次 OrgIdOfUser 都会回落为
// 一条 SELECT * FROM users，单个组织成员请求最多 7 次全行查询，其中外层与
// tryWallet 内层是紧邻的重复。这里把已解析的结果复用掉。
func resolveOrgIdForBilling(relayInfo *relaycommon.RelayInfo) (int, error) {
	if relayInfo.OrganizationId > 0 {
		return relayInfo.OrganizationId, nil
	}
	return model.OrgIdOfUser(relayInfo.UserId)
}

// shouldTrust 统一信任额度检查，适用于钱包和订阅。
func (s *BillingSession) shouldTrust(c *gin.Context) bool {
	// 异步任务（ForcePreConsume=true）必须预扣全额，不允许信任旁路
	if s.relayInfo.ForcePreConsume {
		return false
	}

	// 组织成员不享信任旁路。信任旁路会把 effectiveQuota 归零，从而跳过
	// PreConsumeTokenQuota 里的 EnforceOrgQuota —— 组织预算上限与成员子额度上限
	// 会同时失守（余额越大的成员反而越不受约束，方向恰好相反）。
	//
	// 归属解析失败同样返回 false（fail-closed）：无法确认是不是组织成员时
	// 授予信任旁路，等于把「查询抖动」变成「免预扣通行证」。
	if orgId, err := resolveOrgIdForBilling(s.relayInfo); err != nil || orgId > 0 {
		return false
	}

	// 门槛取管理员配置的 quota_setting.trust_quota_usd（美元），换算成 quota 单位。
	// 这里必须读配置而不是常量：管理员调低门槛是为了让小钱包也免预扣，写死默认值
	// 会让这个开关完全失效。NaN/Inf 同样按「禁用」处理，坏配置不得放宽预扣。
	trustQuota := operation_setting.GetQuotaSetting().TrustQuotaUSD * common.QuotaPerUnit
	if trustQuota <= 0 || math.IsNaN(trustQuota) || math.IsInf(trustQuota, 0) {
		return false
	}

	// 检查令牌是否充足
	tokenTrusted := s.relayInfo.TokenUnlimited
	if !tokenTrusted {
		tokenQuota := c.GetInt("token_quota")
		tokenTrusted = float64(tokenQuota) > trustQuota
	}
	if !tokenTrusted {
		return false
	}

	switch s.funding.Source() {
	case BillingSourceWallet:
		return float64(s.relayInfo.UserQuota) > trustQuota
	case BillingSourceSubscription:
		// 订阅不能启用信任旁路。原因：
		// 1. PreConsumeUserSubscription 要求 amount>0 来创建预扣记录并锁定订阅
		// 2. SubscriptionFunding.PreConsume 忽略参数，始终用 s.amount 预扣
		// 3. 若信任旁路将 effectiveQuota 设为 0，会导致 preConsumedQuota 与实际订阅预扣不一致
		return false
	default:
		return false
	}
}

// syncRelayInfo 将 BillingSession 的状态同步到 RelayInfo 的兼容字段上。
func (s *BillingSession) syncRelayInfo() {
	info := s.relayInfo
	info.FinalPreConsumedQuota = s.preConsumedQuota
	info.BillingSource = s.funding.Source()

	if sub, ok := s.funding.(*SubscriptionFunding); ok {
		info.SubscriptionId = sub.subscriptionId
		info.SubscriptionPreConsumed = sub.preConsumed + int64(s.extraReserved)
		info.SubscriptionPostDelta = 0
		info.SubscriptionAmountTotal = sub.AmountTotal
		info.SubscriptionAmountUsedAfterPreConsume = sub.AmountUsedAfter + int64(s.extraReserved)
		info.SubscriptionPlanId = sub.PlanId
		info.SubscriptionPlanTitle = sub.PlanTitle
	} else {
		info.SubscriptionId = 0
		info.SubscriptionPreConsumed = 0
	}
}

// ---------------------------------------------------------------------------
// NewBillingSession 工厂 — 根据计费偏好创建会话并处理回退
// ---------------------------------------------------------------------------

// NewBillingSession 根据用户计费偏好创建 BillingSession，处理 subscription_first / wallet_first 的回退。
func NewBillingSession(c *gin.Context, relayInfo *relaycommon.RelayInfo, preConsumedQuota int) (*BillingSession, *types.UterError) {
	if relayInfo == nil {
		return nil, types.NewError(fmt.Errorf("relayInfo is nil"), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	pref := common.NormalizeBillingPreference(relayInfo.UserSetting.BillingPreference)

	// 钱包路径需要先检查用户额度
	tryWallet := func() (*BillingSession, *types.UterError) {
		// 组织成员：出资方是组织共享预算，个人钱包余额不参与扣费。准入必须以
		// 「组织剩余预算 + 成员子额度」为准。
		// 用个人钱包做闸门会造成两种相反的错误：额度为 0 的成员被全面拒绝，
		// 余额充足的成员则因为余额永不被扣减而变成事实上的无限额度。
		// 优先复用外层已解析的组织归属（NewBillingSession 开头已解析过一次），
		// 避免紧邻的重复查库。
		orgId, orgErr := resolveOrgIdForBilling(relayInfo)
		if orgErr != nil {
			// 归属无法确认时**不得**退回个人钱包：那等于把组织成员的资金来源
			// 静默改判，组织账本与个人账本会同时错位。安全策略是拒绝。
			return nil, types.NewErrorWithStatusCode(
				fmt.Errorf("%w: %v", model.ErrOrgQuotaUnverifiable, orgErr),
				types.ErrorCodeQueryDataError, http.StatusServiceUnavailable,
				types.ErrOptionWithSkipRetry())
		}
		if orgId > 0 {
			// 缓存出资组织，供请求路径后续判断复用（尤其是后台 goroutine ——
			// 那里不得再访问数据库，见 RelayInfo.OrganizationId 的说明）。
			relayInfo.OrganizationId = orgId
			if remaining, unlimited, remainingErr := model.OrgRemainingQuota(orgId); remainingErr == nil && !unlimited {
				// 让额度提醒/日志反映真正的出资方余额（展示用途，不承担闸门职责）。
				relayInfo.UserQuota = int(remaining)
			}
			session := &BillingSession{
				relayInfo: relayInfo,
				funding:   &WalletFunding{userId: relayInfo.UserId, orgId: orgId, orgIdResolved: true},
			}
			// 组织预算与成员子额度的闸门只有一处：preConsume → WalletFunding.PreConsume
			// → ReserveOrgQuota 的单条条件 UPDATE（校验与记账原子完成）。
			//
			// 旧实现先在这里跑一遍只读的 EnforceOrgQuota，且用 max(preConsumedQuota,1)
			// 当校验额，而实际预扣用的是原始 preConsumedQuota（零预估请求为 0）：
			//   - 校验额与实际预留额口径不一致；
			//   - 只读校验与后续写入之间存在 TOCTOU 窗口，并发请求会同时通过；
			//   - 零预估请求根本不触发 ReserveOrgQuota，闸门完全没执行。
			// 现在只保留原子预留这一道闸门，预检查不再单独存在，因此不可能出现
			// 「检查过 1、实际预留 0」的错位。
			if apiErr := session.preConsume(c, preConsumedQuota); apiErr != nil {
				return nil, apiErr
			}
			return session, nil
		}

		// Settlement deducts without a lower bound (a failed request still
		// consumed upstream tokens, and the consume log must match the balance),
		// so admission is the only place the overdraw can be bounded. The read
		// is the one that re-checks the database inside the at-risk band —
		// a plain cached read would let a concurrent burst through before any
		// of those requests had settled.
		userQuota, err := model.GetUserQuotaForAdmission(relayInfo.UserId)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
		}
		if userQuota <= common.GetWalletDebtFloorQuota() {
			return nil, types.NewErrorWithStatusCode(
				fmt.Errorf("用户额度不足, 剩余额度: %s", logger.FormatQuota(userQuota)),
				types.ErrorCodeInsufficientUserQuota, http.StatusForbidden,
				types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
		}
		if userQuota-preConsumedQuota < 0 {
			return nil, types.NewErrorWithStatusCode(
				fmt.Errorf("预扣费额度失败, 用户剩余额度: %s, 需要预扣费额度: %s", logger.FormatQuota(userQuota), logger.FormatQuota(preConsumedQuota)),
				types.ErrorCodeInsufficientUserQuota, http.StatusForbidden,
				types.ErrOptionWithSkipRetry(), types.ErrOptionWithNoRecordErrorLog())
		}
		relayInfo.UserQuota = userQuota

		session := &BillingSession{
			relayInfo: relayInfo,
			funding:   &WalletFunding{userId: relayInfo.UserId},
			// DEF-6：把准入余额延续为会话级计费上限。准入只按估算额校验过
			// 一次，真实成本结算时才可知；没有这条上限，信任旁路 + 无
			// max_tokens 的组合可以把钱包打到任意深度。
			billingCeiling: userQuota - common.GetWalletDebtFloorQuota(),
			ceilingSet:     true,
		}
		if apiErr := session.preConsume(c, preConsumedQuota); apiErr != nil {
			return nil, apiErr
		}
		return session, nil
	}

	trySubscription := func() (*BillingSession, *types.UterError) {
		subConsume := int64(preConsumedQuota)
		if subConsume <= 0 {
			subConsume = 1
		}
		session := &BillingSession{
			relayInfo: relayInfo,
			funding: &SubscriptionFunding{
				requestId: relayInfo.RequestId,
				userId:    relayInfo.UserId,
				modelName: relayInfo.GetBillingModelName(),
				amount:    subConsume,
			},
		}
		// 必须传 subConsume 而非 preConsumedQuota，保证 SubscriptionFunding.amount、
		// preConsume 参数和 FinalPreConsumedQuota 三者一致，避免订阅多扣费。
		if apiErr := session.preConsume(c, int(subConsume)); apiErr != nil {
			return nil, apiErr
		}
		return session, nil
	}

	// 组织成员的出资方恒为组织共享预算：个人钱包与订阅都不参与扣费，
	// 因此计费偏好（subscription_first / wallet_first …）对成员不适用，
	// 直接走组织钱包路径，避免「组织成员却先扣订阅/个人钱包」的口径分裂。
	//
	// 归属解析失败必须拒绝，不能落到下面的计费偏好分支：那会让组织成员按
	// 订阅/个人钱包计费，组织账本少收一笔、个人账本多扣一笔，且两者都不可逆。
	orgId, orgErr := resolveOrgIdForBilling(relayInfo)
	if orgErr != nil {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("%w: %v", model.ErrOrgQuotaUnverifiable, orgErr),
			types.ErrorCodeQueryDataError, http.StatusServiceUnavailable,
			types.ErrOptionWithSkipRetry())
	}
	if orgId > 0 {
		// 缓存出资组织：tryWallet 内的组织分支、shouldTrust、recordMemberUsage
		// 都复用这一结果，不必再查一次库。
		relayInfo.OrganizationId = orgId
		return tryWallet()
	}

	switch pref {
	case "subscription_only":
		return trySubscription()
	case "wallet_only":
		return tryWallet()
	case "wallet_first":
		session, err := tryWallet()
		if err != nil {
			if err.GetErrorCode() == types.ErrorCodeInsufficientUserQuota {
				return trySubscription()
			}
			return nil, err
		}
		return session, nil
	case "subscription_first":
		fallthrough
	default:
		hasSub, subCheckErr := model.HasActiveUserSubscription(relayInfo.UserId)
		if subCheckErr != nil {
			return nil, types.NewError(subCheckErr, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
		}
		if !hasSub {
			return tryWallet()
		}
		session, apiErr := trySubscription()
		if apiErr != nil {
			if apiErr.GetErrorCode() == types.ErrorCodeInsufficientUserQuota {
				// 仅当用户的活跃订阅允许钱包回退时才回退到钱包，否则返回订阅额度不足错误
				allowOverflow, overflowErr := model.UserActiveSubscriptionsAllowWalletOverflow(relayInfo.UserId)
				if overflowErr != nil {
					return nil, types.NewError(overflowErr, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
				}
				if allowOverflow {
					return tryWallet()
				}
				return nil, apiErr
			}
			return nil, apiErr
		}
		return session, nil
	}
}
