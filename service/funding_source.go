package service

import (
	"errors"
	"fmt"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
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
	// orgId 是构造时已解析的组织归属（0 表示平台直管用户）。
	//
	// 一次请求里PreConsume/Settle/Refund 都会问同一个问题「这人是不是组织
	// 成员」，而 OrgIdOfUser 在 Redis 关闭时每次都回落为一条
	// SELECT * FROM users。BillingSession 在 tryWallet 里已经解析过一次，
	// 构造时一并带下来，这里便不必重复查库。
	orgId int
	// orgIdResolved 区分「解析出0（平台直管用户）」与「尚未解析」。
	//
	// 只靠 orgId > 0 判断会让直管用户在 PreConsume/Settle/Refund 每次都回查，
	// 等于没优化；组织归属在一次请求内不会变，查一次即可定型。
	orgIdResolved bool
	// consumed 是该资金来源**累计**预扣的额度，Refund 按它整体回退。
	//
	// 必须是累加而不是赋值：一次请求里 PreConsume 会被调用多次——先由
	// BillingSession.preConsume 预扣 P，图片请求再经 Reserve 的
	// requireAvailableQuota 分支补扣 (Q−P)。若这里写成赋值，后一次会把前一次的
	// P 覆盖掉，失败时 Refund 只退 (Q−P)，用户永久损失 P。
	consumed int
}

func (w *WalletFunding) Source() string { return BillingSourceWallet }

// resolveOrgId 返回该资金来源对应的组织归属。构造时已解析的结果优先，
// 只有未解析时才回查（构造点未覆盖的路径），并就地定型供后续调用复用。
//
// 解析失败必须上抛，不能回落为「0 = 平台直管用户」：那会把组织成员的资金来源
// 静默改判成个人钱包，一次查询抖动就足以让组织账本与个人账本同时错位。
// 计费路径宁可拒绝请求，也不能猜错出资方。
func (w *WalletFunding) resolveOrgId() (int, error) {
	if w.orgIdResolved {
		return w.orgId, nil
	}
	orgId, err := model.OrgIdOfUser(w.userId)
	if err != nil {
		return 0, fmt.Errorf("%w: cannot resolve organization of user %d: %v",
			model.ErrOrgQuotaUnverifiable, w.userId, err)
	}
	w.orgId = orgId
	w.orgIdResolved = true
	return orgId, nil
}

// OrgFunded 报告本会话是否由组织共享预算出资。
func (w *WalletFunding) OrgFunded() bool {
	orgId, err := w.resolveOrgId()
	return err == nil && orgId > 0
}

func (w *WalletFunding) PreConsume(amount int) error {
	orgId, err := w.resolveOrgId()
	if err != nil {
		return err
	}
	// 组织成员由组织共享预算出资：在【预扣点】就把额度记到组织账本上，与个人钱包
	// 路径（TryReserveUserQuota 立刻扣减）保持同一时序。否则预扣额度从未落账，
	// 结算时只补 delta = actual − preConsumed，组织被系统性少收一整笔预扣额。
	// ReserveOrgQuota 内部以单条条件 UPDATE 同时完成预算上限与成员子额度校验。
	//
	// 零预估请求同样预留：amount<=0 时抬到 OrgAdmissionReserveAmount 的最小准入额，
	// 让「预算已耗尽」在准入点就一律拒绝。若在这里直接 return nil（旧行为），
	// ReserveOrgQuota 的原子闸门根本不执行，唯一的约束退化成只读校验，
	// 并发突发会全员通过——组织预算形同虚设。
	//
	// 预留额与 BillingSession.preConsume 里的 effectiveQuota 必须用同一个函数算出，
	// 否则会出现「记了 1 却没进 preConsumedQuota」的永久残留。
	if orgId > 0 {
		reserved := int(model.OrgAdmissionReserveAmount(int64(amount)))
		if err := model.ReserveOrgQuota(orgId, w.userId, int64(reserved)); err != nil {
			return err
		}
		w.consumed += reserved
		return nil
	}
	if amount <= 0 {
		return nil
	}
	reserved, err := model.TryReserveUserQuota(w.userId, amount)
	if err != nil {
		return err
	}
	if !reserved {
		return ErrInsufficientWalletQuota
	}
	// 发送前补扣会再次预扣，累加后退款才能退回全部预扣。
	w.consumed += amount
	return nil
}

func (w *WalletFunding) Settle(delta int) error {
	if delta == 0 {
		return nil
	}
	orgId, err := w.resolveOrgId()
	if err != nil {
		return err
	}
	if orgId > 0 {
		// 组织账本与成员子额度账本必须原子 true-up，不能先提交一边再调整另一边。
		return model.AdjustOrgAndMemberUsedQuota(orgId, w.userId, int64(delta))
	}
	if delta > 0 {
		return model.DecreaseUserQuota(w.userId, delta, true)
	}
	return model.IncreaseUserQuota(w.userId, -delta, true)
}

func (w *WalletFunding) Refund() error {
	if w.consumed <= 0 {
		return nil
	}
	// 组织成员：预扣同时记在组织预算账本与成员子额度账本上，按 consumed 一并回减。
	// 归属解析失败时**不得**回退到个人钱包（那会把组织预扣退成个人余额，两本账
	// 同时错位且不可逆），必须上抛让调用方重试或转人工对账。
	orgId, err := w.resolveOrgId()
	if err != nil {
		return err
	}
	if orgId > 0 {
		if err := model.AdjustOrgAndMemberUsedQuota(orgId, w.userId, -int64(w.consumed)); err != nil {
			return fmt.Errorf("roll back organization/member reserve (org=%d user=%d amount=%d): %w", orgId, w.userId, w.consumed, err)
		}
		w.consumed = 0
		return nil
	}
	// IncreaseUserQuota 是 quota += N 的非幂等操作，不能重试，否则会多退额度。
	// 订阅的 RefundSubscriptionPreConsume 有 requestId 幂等保护所以可以重试。
	// 成功后将 consumed 归零，使本对象的二次 Refund（如 defer + 显式调用并存）成为空操作，
	// 与 BillingSession.refunded 标志形成双重幂等保护。
	if err := model.IncreaseUserQuota(w.userId, w.consumed, true); err != nil {
		return err
	}
	w.consumed = 0
	return nil
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
	if err := model.PostConsumeUserSubscriptionDeltaCappedWithWallet(s.subscriptionId, s.userId, int64(delta)); err != nil {
		return fmt.Errorf("subscription settlement (including wallet overflow) failed atomically (userId=%d, subscriptionId=%d, delta=%d): %w",
			s.userId, s.subscriptionId, delta, err)
	}
	return nil
}

func (s *SubscriptionFunding) Refund() error {
	if s.preConsumed <= 0 {
		return nil
	}
	// RefundSubscriptionPreConsume keys off requestId, so retrying is safe —
	// unlike the wallet's non-idempotent quota += N. Zeroing the counter then
	// makes any second Refund on this object a no-op, mirroring WalletFunding
	// and giving the caller belt-and-braces idempotency.
	if err := refundWithRetry(func() error {
		return model.RefundSubscriptionPreConsume(s.requestId)
	}); err != nil {
		return err
	}
	s.preConsumed = 0
	return nil
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
