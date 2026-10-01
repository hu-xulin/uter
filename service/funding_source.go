package service

import (
	"errors"
	"time"

	"github.com/Uter-AI/Uter/common"
	"github.com/Uter-AI/Uter/model"
)

// ---------------------------------------------------------------------------
// FundingSource — 资金来源接口（钱包 or 订阅）
// ---------------------------------------------------------------------------

// FundingSource 抽象了预扣费的资金来源。
type FundingSource interface {
	// Source 返回资金来源标识："wallet" 或 "subscription"
	Source() string
	// PreConsume 从该资金来源预扣 amount 额度
	PreConsume(amount int) error
	// Settle 根据差额调整资金来源（正数补扣，负数退还）
	Settle(delta int) error
	// Refund 退还所有预扣费
	Refund() error
}

// ---------------------------------------------------------------------------
// WalletFunding — 钱包资金来源实现
// ---------------------------------------------------------------------------

// ErrInsufficientWalletQuota 钱包原子预扣失败（余额不足），未发生任何扣减。
// BillingSession 据此映射为 ErrorCodeInsufficientUserQuota，
// 使 wallet_first 等计费偏好可以回退到订阅。
var ErrInsufficientWalletQuota = errors.New("wallet quota insufficient")

type WalletFunding struct {
	userId int
	// consumed 是该资金来源**累计**预扣的额度，Refund 按它整体回退。
	//
	// 必须是累加而不是赋值：一次请求里 PreConsume 会被调用多次——先由
	// BillingSession.preConsume 预扣 P，图片请求再经 Reserve 的
	// requireAvailableQuota 分支补扣 (Q−P)。若这里写成赋值，后一次会把前一次的
	// P 覆盖掉，失败时 Refund 只退 (Q−P)，用户永久损失 P。
	consumed int
}

func (w *WalletFunding) Source() string { return BillingSourceWallet }

func (w *WalletFunding) PreConsume(amount int) error {
	if amount <= 0 {
		return nil
	}
	// 组织成员由组织共享预算出资：在【预扣点】就把额度记到组织账本上，与个人钱包
	// 路径（TryReserveUserQuota 立刻扣减）保持同一时序。否则预扣额度从未落账，
	// 结算时只补 delta = actual − preConsumed，组织被系统性少收一整笔预扣额。
	// ReserveOrgQuota 内部以单条条件 UPDATE 同时完成预算上限与成员子额度校验。
	if orgId, err := model.OrgIdOfUser(w.userId); err == nil && orgId > 0 {
		if err := model.ReserveOrgQuota(orgId, w.userId, int64(amount)); err != nil {
			return err
		}
		w.consumed += amount
		return nil
	}
	reserved, err := model.TryReserveUserQuota(w.userId, amount)
	if err != nil {
		return err
	}
	if !reserved {
		return ErrInsufficientWalletQuota
	}
	w.consumed += amount
	return nil
}

func (w *WalletFunding) Settle(delta int) error {
	if delta == 0 {
		return nil
	}
	if orgId, err := model.OrgIdOfUser(w.userId); err == nil && orgId > 0 {
		// 组织账本按差额 true-up（受 IncrOrgUsedQuota 的预算硬上限约束，见 F1 修复）。
		if err := model.IncrOrgUsedQuota(orgId, int64(delta)); err != nil {
			return err
		}
		// 成员子额度已在预扣点由 ReserveOrgQuota 原子记入 used_quota（闸门+记账合一）。
		// 这里把「实际 - 预扣」差额并入，使 used_quota 最终等于实际消耗，且不会与预扣点的
		// 预留重复计账（净效果 = 预扣额 + 差额 = 实际消耗）。钳制在 0 以防差额为负时记成负数。
		return model.IncrUserUsedQuotaClamped(w.userId, delta)
	}
	if delta > 0 {
		return model.DecreaseUserQuota(w.userId, delta, false)
	}
	return model.IncreaseUserQuota(w.userId, -delta, false)
}

func (w *WalletFunding) Refund() error {
	if w.consumed <= 0 {
		return nil
	}
	// 组织成员：预扣同时记在组织预算账本与成员子额度账本上，按 consumed 一并回减。
	if orgId, err := model.OrgIdOfUser(w.userId); err == nil && orgId > 0 {
		if err := model.IncrOrgUsedQuota(orgId, -int64(w.consumed)); err != nil {
			common.SysLog("error rolling back organization funding reserve: " + err.Error())
		}
		// 撤销预扣点在 members.used_quota 上的原子预留，避免成员用量被永久多记。
		if err := model.IncrUserUsedQuotaClamped(w.userId, -w.consumed); err != nil {
			common.SysLog("error rolling back member sub-quota reserve: " + err.Error())
		}
		return nil
	}
	// IncreaseUserQuota 是 quota += N 的非幂等操作，不能重试，否则会多退额度。
	// 订阅的 RefundSubscriptionPreConsume 有 requestId 幂等保护所以可以重试。
	return model.IncreaseUserQuota(w.userId, w.consumed, false)
}

// ---------------------------------------------------------------------------
// SubscriptionFunding — 订阅资金来源实现
// ---------------------------------------------------------------------------

type SubscriptionFunding struct {
	requestId      string
	userId         int
	modelName      string
	amount         int64 // 预扣的订阅额度（subConsume）
	subscriptionId int
	preConsumed    int64
	// 以下字段在 PreConsume 成功后填充，供 RelayInfo 同步使用
	AmountTotal     int64
	AmountUsedAfter int64
	PlanId          int
	PlanTitle       string
}

func (s *SubscriptionFunding) Source() string { return BillingSourceSubscription }

func (s *SubscriptionFunding) PreConsume(_ int) error {
	// amount 参数被忽略，使用内部 s.amount（已在构造时根据 preConsumedQuota 计算）
	res, err := model.PreConsumeUserSubscription(s.requestId, s.userId, s.modelName, 0, s.amount)
	if err != nil {
		return err
	}
	s.subscriptionId = res.UserSubscriptionId
	s.preConsumed = res.PreConsumed
	s.AmountTotal = res.AmountTotal
	s.AmountUsedAfter = res.AmountUsedAfter
	// 获取订阅计划信息
	if planInfo, err := model.GetSubscriptionPlanInfoByUserSubscriptionId(res.UserSubscriptionId); err == nil && planInfo != nil {
		s.PlanId = planInfo.PlanId
		s.PlanTitle = planInfo.PlanTitle
	}
	return nil
}

func (s *SubscriptionFunding) Settle(delta int) error {
	if delta == 0 {
		return nil
	}
	return model.PostConsumeUserSubscriptionDelta(s.subscriptionId, int64(delta))
}

func (s *SubscriptionFunding) Refund() error {
	if s.preConsumed <= 0 {
		return nil
	}
	return refundWithRetry(func() error {
		return model.RefundSubscriptionPreConsume(s.requestId)
	})
}

// refundWithRetry 尝试多次执行退款操作以提高成功率，只能用于基于事务的退款函数！！！！！！
// try to refund with retries, only for refund functions based on transactions!!!
func refundWithRetry(fn func() error) error {
	if fn == nil {
		return nil
	}
	const maxAttempts = 3
	var lastErr error
	for i := range maxAttempts {
		if err := fn(); err == nil {
			return nil
		} else {
			lastErr = err
		}
		if i < maxAttempts-1 {
			time.Sleep(time.Duration(200*(i+1)) * time.Millisecond)
		}
	}
	return lastErr
}
