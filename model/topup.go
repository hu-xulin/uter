package model

import (
	"errors"
	"fmt"
	"maps"
	"strings"

	"github.com/uter-ai/uter/common"

	"github.com/uter-ai/uter/logger"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type TopUp struct {
	Id              int     `json:"id"`
	UserId          int     `json:"user_id" gorm:"index"`
	Amount          int64   `json:"amount"`
	Money           float64 `json:"money"`
	TradeNo         string  `json:"trade_no" gorm:"unique;type:varchar(255);index"`
	PaymentMethod   string  `json:"payment_method" gorm:"type:varchar(50)"`
	PaymentProvider string  `json:"payment_provider" gorm:"type:varchar(50);default:''"`
	// ProviderAmount/Currency store the payment provider's checkout pricing snapshot,
	// independently from the local quota-calculation Money field.
	ProviderAmount   int64  `json:"-" gorm:"not null;default:0"`
	ProviderCurrency string `json:"-" gorm:"type:varchar(3);not null;default:''"`
	// FailReason records why a top-up order was marked failed. F-07: the reason
	// has to be persisted, not only written to the log, otherwise a reconciliation
	// pass cannot tell an order the provider rejected apart from one whose
	// checkout never completed.
	FailReason   string `json:"fail_reason" gorm:"type:varchar(255);not null;default:''"`
	CreateTime   int64  `json:"create_time"`
	CompleteTime int64  `json:"complete_time"`
	Status       string `json:"status"`
}

const (
	PaymentMethodStripe       = "stripe"
	PaymentMethodCreem        = "creem"
	PaymentMethodWaffo        = "waffo"
	PaymentMethodWaffoPancake = "waffo_pancake"
	PaymentMethodBalance      = "balance"
	// 网站支付（Web 收银台）：PC 跳转支付宝/微信支付页面收银台，移动端跳转支付方 App / H5 收银台。
	// 这是面向 Web 站点的主通道——支付发生在浏览器中，不受 Apple IAP 约束，费率约 0.6%。
	// 微信侧形态为 Native 扫码（PC）与 H5 支付（移动端）；小程序支付已移除。
	PaymentMethodAlipay    = "alipay_web"
	PaymentMethodWechatPay = "wechat_web"
)

const (
	PaymentProviderEpay         = "epay"
	PaymentProviderStripe       = "stripe"
	PaymentProviderCreem        = "creem"
	PaymentProviderWaffo        = "waffo"
	PaymentProviderWaffoPancake = "waffo_pancake"
	PaymentProviderBalance      = "balance"
	PaymentProviderAlipay       = "alipay_official"
	PaymentProviderWechatPay    = "wechat_pay_official"
)

var (
	ErrPaymentMethodMismatch = errors.New("payment method mismatch")
	ErrTopUpNotFound         = errors.New("topup not found")
	ErrTopUpStatusInvalid    = errors.New("topup status invalid")
	// The quota errors reach the web console, so they carry message keys.
	ErrInvalidTopUpQuota        error = common.NewMessage("Invalid top-up quota")
	ErrTopUpQuotaLimitExceeded  error = common.NewMessage("Top-up quota limit exceeded")
	ErrWalletQuotaLimitExceeded error = common.NewMessage("Wallet quota limit exceeded")
)

func (topUp *TopUp) Insert() error {
	var err error
	err = DB.Create(topUp).Error
	return err
}

func topUpQuotaMaxCurrent(creditedQuota int) (int, error) {
	if creditedQuota <= 0 || creditedQuota > common.MaxWalletQuota {
		return 0, ErrInvalidTopUpQuota
	}
	return common.MaxWalletQuota - creditedQuota, nil
}

// ValidateTopUpQuotaCapacity performs the user-facing pre-payment check. The
// settlement path repeats the same invariant with an atomic conditional
// update, because the wallet balance can change after checkout creation.
func ValidateTopUpQuotaCapacity(userId int, creditedQuota int) error {
	maxCurrentQuota, err := topUpQuotaMaxCurrent(creditedQuota)
	if err != nil {
		return err
	}

	var user User
	if err := DB.Select("quota").Where("id = ?", userId).First(&user).Error; err != nil {
		return err
	}
	if user.Quota > maxCurrentQuota {
		return ErrTopUpQuotaLimitExceeded
	}
	return nil
}

// creditTopUpQuota atomically enforces the wallet ceiling while adding quota.
// Keeping the predicate and increment in one UPDATE prevents two
// concurrent callbacks from both passing a separate read/check.
func creditTopUpQuota(tx *gorm.DB, userId int, creditedQuota int, updates map[string]any) error {
	maxCurrentQuota, err := topUpQuotaMaxCurrent(creditedQuota)
	if err != nil {
		return err
	}

	updateFields := make(map[string]any, len(updates)+1)
	maps.Copy(updateFields, updates)
	updateFields["quota"] = gorm.Expr("quota + ?", creditedQuota)

	result := tx.Model(&User{}).
		Where("id = ? AND quota <= ?", userId, maxCurrentQuota).
		Updates(updateFields)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 1 {
		return nil
	}

	var count int64
	if err := tx.Model(&User{}).Where("id = ?", userId).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return gorm.ErrRecordNotFound
	}
	return ErrTopUpQuotaLimitExceeded
}

func (topUp *TopUp) Update() error {
	var err error
	err = DB.Save(topUp).Error
	return err
}

// topUpRefColumn returns the quoted `trade_no` column name for the active
// dialect. Kept in one place so every money transition quotes it the same way.
func topUpRefColumn() string {
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		return `"trade_no"`
	}
	return "`trade_no`"
}

// claimPendingTopUp moves a pending order to success with a single conditional
// UPDATE and reports whether this transaction won the transition.
//
// F-12: every recharge path used to rely on `SELECT ... FOR UPDATE` plus an
// in-memory status check. That is correct on MySQL/PostgreSQL, but
// `lockForUpdate` deliberately degrades to a plain SELECT on SQLite, where two
// concurrent callbacks (provider retry + admin manual completion, or two
// instances behind the same webhook URL) can both read `pending` and both
// credit the wallet. The `status = 'pending'` predicate makes the transition
// decided by the database itself: only one statement can move the row, on every
// backend, so only the winner credits quota.
//
// Returns:
//   - (true, nil)  — this call owns the transition; the caller must credit the
//     wallet inside the same transaction;
//   - (false, nil) — the order was already completed by a concurrent
//     transaction; the caller must treat it as an idempotent repeat;
//   - (false, err) — the row is in some other state (expired/failed) or the
//     database failed; the caller must abort.
func claimPendingTopUp(tx *gorm.DB, tradeNo string, extra map[string]any) (bool, error) {
	refCol := topUpRefColumn()

	updates := make(map[string]any, len(extra)+2)
	maps.Copy(updates, extra)
	updates["status"] = common.TopUpStatusSuccess
	updates["complete_time"] = common.GetTimestamp()

	result := tx.Model(&TopUp{}).
		Where(refCol+" = ? AND status = ?", tradeNo, common.TopUpStatusPending).
		Updates(updates)
	if result.Error != nil {
		return false, result.Error
	}
	if result.RowsAffected == 1 {
		return true, nil
	}

	// Nothing moved: find out whether a concurrent transaction already
	// completed the order (idempotent repeat) or the order is simply not
	// completable anymore (expired / failed / refunded).
	var status string
	if err := tx.Model(&TopUp{}).Where(refCol+" = ?", tradeNo).Pluck("status", &status).Error; err != nil {
		return false, err
	}
	if status == common.TopUpStatusSuccess {
		return false, nil
	}
	return false, ErrTopUpStatusInvalid
}

// maxFailReasonLength matches the fail_reason column width.
const maxFailReasonLength = 255

// MarkFailed marks the order as failed and stores the reason next to it.
//
// F-07: the transition is conditional on the order still being pending, so a
// callback that completed the order concurrently is never downgraded to
// failed (which would hide real money from the user). The reason is persisted
// in the same statement as the status, so a reconciliation pass can tell why a
// checkout never completed instead of guessing from the logs.
func (topUp *TopUp) MarkFailed(reason string) error {
	reason = strings.TrimSpace(reason)
	if len(reason) > maxFailReasonLength {
		reason = reason[:maxFailReasonLength]
	}

	refCol := "`trade_no`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		refCol = `"trade_no"`
	}

	result := DB.Model(&TopUp{}).
		Where(refCol+" = ? AND status = ?", topUp.TradeNo, common.TopUpStatusPending).
		Updates(map[string]any{
			"status":      common.TopUpStatusFailed,
			"fail_reason": reason,
		})
	if result.Error != nil {
		return result.Error
	}
	// Only mirror the transition when the row was actually moved. A concurrent
	// callback may have completed the order first; in that case the order keeps
	// its success state and the in-memory copy must not pretend otherwise.
	if result.RowsAffected > 0 {
		topUp.Status = common.TopUpStatusFailed
		topUp.FailReason = reason
	}
	return nil
}

func GetTopUpById(id int) *TopUp {
	var topUp *TopUp
	var err error
	err = DB.Where("id = ?", id).First(&topUp).Error
	if err != nil {
		return nil
	}
	return topUp
}

func GetTopUpByTradeNo(tradeNo string) *TopUp {
	var topUp *TopUp
	var err error
	err = DB.Where("trade_no = ?", tradeNo).First(&topUp).Error
	if err != nil {
		return nil
	}
	return topUp
}

func UpdatePendingTopUpStatus(tradeNo string, expectedPaymentProvider string, targetStatus string) error {
	if tradeNo == "" {
		return errors.New("payment order number not provided")
	}

	refCol := "`trade_no`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		refCol = `"trade_no"`
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		topUp := &TopUp{}
		if err := lockForUpdate(tx).Where(refCol+" = ?", tradeNo).First(topUp).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrTopUpNotFound
			}
			// Do not turn a transient database failure into a permanent
			// "order not found" result. Webhook handlers use that sentinel to
			// decide whether the provider should retry delivery.
			return err
		}
		if expectedPaymentProvider != "" && topUp.PaymentProvider != expectedPaymentProvider {
			return ErrPaymentMethodMismatch
		}
		if topUp.Status != common.TopUpStatusPending {
			return ErrTopUpStatusInvalid
		}

		topUp.Status = targetStatus
		return tx.Save(topUp).Error
	})
}

// RechargeEpay 原子完成易支付订单：订单行锁、状态校验、成功更新与用户额度增加
// 在同一个事务内完成，因此同一订单的并发/重复回调（包括多实例部署下）最多充值一次。
// alreadyDone=true 表示订单此前已完成，本次为幂等重复回调。
// 进程内的 LockOrder 只是优化，正确性由本函数的数据库行锁保证。
func RechargeEpay(tradeNo string, actualPaymentMethod string, callerIp string) (alreadyDone bool, err error) {
	if tradeNo == "" {
		return false, errors.New("未提供支付单号")
	}

	refCol := "`trade_no`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		refCol = `"trade_no"`
	}

	var quotaToAdd int
	topUp := &TopUp{}
	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).Where(refCol+" = ?", tradeNo).First(topUp).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrTopUpNotFound
			}
			// Keep transient database/query failures distinct so webhook handlers
			// can request a provider retry instead of acknowledging a missing order.
			return err
		}
		if topUp.PaymentProvider != PaymentProviderEpay {
			return ErrPaymentMethodMismatch
		}
		if topUp.Status == common.TopUpStatusSuccess {
			alreadyDone = true
			return nil
		}
		if topUp.Status != common.TopUpStatusPending {
			return ErrTopUpStatusInvalid
		}
		// The provider reports the method the user actually paid with, which may
		// differ from the one chosen before redirect. Persist it together with
		// the status so both land in one statement.
		claimUpdates := map[string]any{}
		if actualPaymentMethod != "" && topUp.PaymentMethod != actualPaymentMethod {
			topUp.PaymentMethod = actualPaymentMethod
			claimUpdates["payment_method"] = actualPaymentMethod
		}
		var quotaErr error
		quotaToAdd, quotaErr = common.WalletQuotaFromDecimalStrict(
			decimal.NewFromInt(topUp.Amount).Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
		)
		if quotaErr != nil || quotaToAdd <= 0 {
			return ErrInvalidTopUpQuota
		}
		claimed, claimErr := claimPendingTopUp(tx, tradeNo, claimUpdates)
		if claimErr != nil {
			return claimErr
		}
		if !claimed {
			// 并发回调已抢先完成该订单：本次按幂等重复处理，绝不二次入账。
			alreadyDone = true
			return nil
		}
		topUp.CompleteTime = common.GetTimestamp()
		topUp.Status = common.TopUpStatusSuccess
		return creditTopUpQuota(tx, topUp.UserId, quotaToAdd, nil)
	})
	if err != nil {
		if !errors.Is(err, ErrTopUpNotFound) && !errors.Is(err, ErrPaymentMethodMismatch) && !errors.Is(err, ErrTopUpStatusInvalid) {
			common.SysError("epay topup failed: " + err.Error())
		}
		return false, err
	}
	if alreadyDone {
		return true, nil
	}
	syncCreditUserQuotaCache(topUp.UserId, quotaToAdd, "epay topup")

	common.SysLog(fmt.Sprintf("易支付充值成功 trade_no=%s user_id=%d quota_to_add=%d money=%.2f", topUp.TradeNo, topUp.UserId, quotaToAdd, topUp.Money))
	RecordTopupLog(topUp.UserId, common.NewMessage("Online top-up succeeded, amount added: {{quota}}, payment amount: {{amount}}", map[string]any{"quota": logger.LogQuota(quotaToAdd), "amount": fmt.Sprintf("%f", topUp.Money)}), callerIp, topUp.PaymentMethod, PaymentProviderEpay)
	return false, nil
}

// rechargeOfficial 原子完成官方直连支付网关（支付宝/微信）订单的充值入账。
// 逻辑与 RechargeEpay 完全一致：订单行锁 + 状态校验 + 成功更新 + 用户额度增加，
// 同一订单的并发/重复回调（含多实例部署）最多充值一次。
func rechargeOfficial(tradeNo string, provider string, actualMethod string, callerIp string) (alreadyDone bool, err error) {
	if tradeNo == "" {
		return false, errors.New("未提供支付单号")
	}

	refCol := "`trade_no`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		refCol = `"trade_no"`
	}

	var quotaToAdd int
	topUp := &TopUp{}
	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).Where(refCol+" = ?", tradeNo).First(topUp).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrTopUpNotFound
			}
			// Keep transient database/query failures distinct so webhook handlers
			// can request a provider retry instead of acknowledging a missing order.
			return err
		}
		if topUp.PaymentProvider != provider {
			return ErrPaymentMethodMismatch
		}
		if topUp.Status == common.TopUpStatusSuccess {
			alreadyDone = true
			return nil
		}
		if topUp.Status != common.TopUpStatusPending {
			return ErrTopUpStatusInvalid
		}
		// The provider reports the method the user actually paid with, which may
		// differ from the one chosen before redirect. Persist it together with
		// the status so both land in one statement.
		claimUpdates := map[string]any{}
		if actualMethod != "" && topUp.PaymentMethod != actualMethod {
			topUp.PaymentMethod = actualMethod
			claimUpdates["payment_method"] = actualMethod
		}
		var quotaErr error
		quotaToAdd, quotaErr = common.WalletQuotaFromDecimalStrict(
			decimal.NewFromInt(topUp.Amount).Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
		)
		if quotaErr != nil || quotaToAdd <= 0 {
			return ErrInvalidTopUpQuota
		}
		claimed, claimErr := claimPendingTopUp(tx, tradeNo, claimUpdates)
		if claimErr != nil {
			return claimErr
		}
		if !claimed {
			// 并发回调已抢先完成该订单：本次按幂等重复处理，绝不二次入账。
			alreadyDone = true
			return nil
		}
		topUp.CompleteTime = common.GetTimestamp()
		topUp.Status = common.TopUpStatusSuccess
		return creditTopUpQuota(tx, topUp.UserId, quotaToAdd, nil)
	})
	if err != nil {
		if !errors.Is(err, ErrTopUpNotFound) && !errors.Is(err, ErrPaymentMethodMismatch) && !errors.Is(err, ErrTopUpStatusInvalid) {
			common.SysError(fmt.Sprintf("%s topup failed: %s", provider, err.Error()))
		}
		return false, err
	}
	if alreadyDone {
		return true, nil
	}
	syncCreditUserQuotaCache(topUp.UserId, quotaToAdd, provider+" topup")

	common.SysLog(fmt.Sprintf("%s 充值成功 trade_no=%s user_id=%d quota_to_add=%d money=%.2f", provider, topUp.TradeNo, topUp.UserId, quotaToAdd, topUp.Money))
	RecordTopupLog(topUp.UserId, common.NewMessage("Online top-up succeeded, amount added: {{quota}}, payment amount: {{amount}}", map[string]any{"quota": logger.LogQuota(quotaToAdd), "amount": fmt.Sprintf("%f", topUp.Money)}), callerIp, topUp.PaymentMethod, provider)
	return false, nil
}

// RechargeAlipay 完成一笔支付宝网站支付（电脑/手机网站支付）订单的充值入账。
func RechargeAlipay(tradeNo string, actualPaymentMethod string, callerIp string) (alreadyDone bool, err error) {
	return rechargeOfficial(tradeNo, PaymentProviderAlipay, actualPaymentMethod, callerIp)
}

// RechargeWechatPay 完成一笔微信支付订单的充值入账。
func RechargeWechatPay(tradeNo string, actualPaymentMethod string, callerIp string) (alreadyDone bool, err error) {
	return rechargeOfficial(tradeNo, PaymentProviderWechatPay, actualPaymentMethod, callerIp)
}

func Recharge(referenceId string, customerId string, callerIp string) (err error) {
	if referenceId == "" {
		return errors.New("payment order number not provided")
	}

	var quota int
	alreadyDone := false
	topUp := &TopUp{}

	refCol := "`trade_no`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		refCol = `"trade_no"`
	}

	err = DB.Transaction(func(tx *gorm.DB) error {
		err := lockForUpdate(tx).Where(refCol+" = ?", referenceId).First(topUp).Error
		if err != nil {
			return errors.New("充值订单不存在")
		}

		if topUp.PaymentProvider != PaymentProviderStripe {
			return ErrPaymentMethodMismatch
		}

		if topUp.Status == common.TopUpStatusSuccess {
			alreadyDone = true
			return nil
		}
		if topUp.Status != common.TopUpStatusPending {
			return errors.New("充值订单状态错误")
		}

		quota, err = common.WalletQuotaFromDecimalStrict(
			decimal.NewFromFloat(topUp.Money).Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
		)
		if err != nil || quota <= 0 {
			return ErrInvalidTopUpQuota
		}
		claimed, claimErr := claimPendingTopUp(tx, referenceId, nil)
		if claimErr != nil {
			return claimErr
		}
		if !claimed {
			// 并发回调已抢先完成该订单：本次按幂等重复处理，绝不二次入账。
			alreadyDone = true
			return nil
		}
		topUp.CompleteTime = common.GetTimestamp()
		topUp.Status = common.TopUpStatusSuccess
		return creditTopUpQuota(tx, topUp.UserId, quota, map[string]any{
			"stripe_customer": customerId,
		})
	})

	if err != nil {
		common.SysError("topup failed: " + err.Error())
		return errors.New("充值失败，请稍后重试")
	}
	if alreadyDone {
		return nil
	}
	syncCreditUserQuotaCache(topUp.UserId, quota, "stripe topup")

	RecordTopupLog(topUp.UserId, common.NewMessage("Online top-up succeeded, amount added: {{quota}}, payment amount: {{amount}}", map[string]any{"quota": logger.FormatQuota(quota), "amount": topUp.Amount}), callerIp, topUp.PaymentMethod, PaymentMethodStripe)

	return nil
}

// topUpQueryWindowSeconds 限制充值记录查询的时间窗口（秒）。
const topUpQueryWindowSeconds int64 = 30 * 24 * 60 * 60

// topUpQueryCutoff 返回允许查询的最早 create_time（秒级 Unix 时间戳）。
func topUpQueryCutoff() int64 {
	return common.GetTimestamp() - topUpQueryWindowSeconds
}

func GetUserTopUps(userId int, pageInfo *common.PageInfo) (topups []*TopUp, total int64, err error) {
	// 只读列表查询不开事务：没有写操作需要原子性，省掉两个往返与一段连接占用。
	cutoff := topUpQueryCutoff()

	err = DB.Model(&TopUp{}).Where("user_id = ? AND create_time >= ?", userId, cutoff).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = DB.Where("user_id = ? AND create_time >= ?", userId, cutoff).Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topups).Error
	if err != nil {
		return nil, 0, err
	}

	return topups, total, nil
}

// GetAllTopUps 获取充值记录（管理员使用，不限制时间窗口）。
// userIds 非空时仅返回归属这些用户的订单：平台管理员传 nil 看全平台；组织 / 部门
// 管理员经 middleware.RequestOrgScope 拿到范围内成员 id（空范围时传 NoOrgMemberId
// 哨兵），从而把只读接口收敛到本租户，杜绝跨租户泄露（对应审计项 P2-3）。
func GetAllTopUps(pageInfo *common.PageInfo, userIds []int) (topups []*TopUp, total int64, err error) {
	// 只读列表查询不开事务。
	query := DB.Model(&TopUp{})
	if len(userIds) > 0 {
		query = query.Where("user_id IN ?", userIds)
	}

	if err = query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err = query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topups).Error; err != nil {
		return nil, 0, err
	}

	return topups, total, nil
}

// searchTopUpCountHardLimit 搜索充值记录时 COUNT 的安全上限，
// 防止对超大表执行无界 COUNT 触发 DoS。
const searchTopUpCountHardLimit = 10000

// SearchUserTopUps 按订单号搜索某用户的充值记录
func SearchUserTopUps(userId int, keyword string, pageInfo *common.PageInfo) (topups []*TopUp, total int64, err error) {
	// 只读搜索不开事务。
	query := DB.Model(&TopUp{}).Where("user_id = ? AND create_time >= ?", userId, topUpQueryCutoff())
	if keyword != "" {
		pattern, perr := sanitizeLikePattern(keyword)
		if perr != nil {
			return nil, 0, perr
		}
		query = query.Where("trade_no LIKE ? ESCAPE '!'", pattern)
	}

	if err = query.Limit(searchTopUpCountHardLimit).Count(&total).Error; err != nil {
		common.SysError("failed to count search topups: " + err.Error())
		return nil, 0, errors.New("搜索充值记录失败")
	}

	if err = query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topups).Error; err != nil {
		common.SysError("failed to search topups: " + err.Error())
		return nil, 0, errors.New("搜索充值记录失败")
	}
	return topups, total, nil
}

// SearchAllTopUps 按订单号搜索充值记录（管理员使用，不限制时间窗口）。
// userIds 非空时仅搜索归属这些用户的订单，语义与 GetAllTopUps 一致（对应审计项 P2-3）。
func SearchAllTopUps(keyword string, pageInfo *common.PageInfo, userIds []int) (topups []*TopUp, total int64, err error) {
	// 只读搜索不开事务。
	query := DB.Model(&TopUp{})
	if len(userIds) > 0 {
		query = query.Where("user_id IN ?", userIds)
	}
	if keyword != "" {
		pattern, perr := sanitizeLikePattern(keyword)
		if perr != nil {
			return nil, 0, perr
		}
		query = query.Where("trade_no LIKE ? ESCAPE '!'", pattern)
	}

	if err = query.Limit(searchTopUpCountHardLimit).Count(&total).Error; err != nil {
		common.SysError("failed to count search topups: " + err.Error())
		return nil, 0, errors.New("搜索充值记录失败")
	}

	if err = query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topups).Error; err != nil {
		common.SysError("failed to search topups: " + err.Error())
		return nil, 0, errors.New("搜索充值记录失败")
	}
	return topups, total, nil
}

// GetTopUpUserIDByTradeNo 返回指定订单归属的用户 id，供 controller 层对补单接口做
// 组织范围门禁（组织管理员只能补本组织成员的订单）。对应审计项 P2-3。
func GetTopUpUserIDByTradeNo(tradeNo string) (int, error) {
	if tradeNo == "" {
		return 0, errors.New("未提供订单号")
	}
	var userId int
	if err := DB.Model(&TopUp{}).Where("trade_no = ?", tradeNo).Pluck("user_id", &userId).Error; err != nil {
		return 0, err
	}
	if userId == 0 {
		return 0, ErrTopUpNotFound
	}
	return userId, nil
}

// ManualTopUpOutcome reports what a manual completion actually did.
//
// F-19: the admin UI used to get a bare `nil` for both "I just credited the
// order" and "the order was already credited before". That makes a double click
// (or two admins working the same queue) look identical to a real completion,
// so the operator cannot tell whether the money moved now or earlier.
type ManualTopUpOutcome struct {
	// Completed is true only when this call transitioned the order from pending
	// to success and credited the quota.
	Completed bool
	// UserId / QuotaAdded describe the credit applied by this call; both are
	// zero on the already-completed path.
	UserId     int
	QuotaAdded int
}

// ManualCompleteTopUp 管理员手动完成订单并给用户充值
func ManualCompleteTopUp(tradeNo string, callerIp string) (ManualTopUpOutcome, error) {
	var outcome ManualTopUpOutcome
	if tradeNo == "" {
		return outcome, errors.New("未提供订单号")
	}

	refCol := "`trade_no`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		refCol = `"trade_no"`
	}

	var userId int
	var quotaToAdd int
	var payMoney float64
	var paymentMethod string
	// F-06/F-19: track whether this invocation actually completed the order. On
	// the idempotent path (order already succeeded) the post-transaction cache
	// sync and audit log must be skipped, otherwise they run with the zero-value
	// locals (userId 0, quota 0) captured above and corrupt the wrong user's
	// cache or emit a misleading completion log.
	alreadyCompleted := false

	err := DB.Transaction(func(tx *gorm.DB) error {
		topUp := &TopUp{}
		// 行级锁，避免并发补单
		if err := lockForUpdate(tx).Where(refCol+" = ?", tradeNo).First(topUp).Error; err != nil {
			return errors.New("充值订单不存在")
		}

		// 幂等处理：已成功直接返回
		if topUp.Status == common.TopUpStatusSuccess {
			alreadyCompleted = true
			return nil
		}

		if topUp.Status != common.TopUpStatusPending {
			return errors.New("订单状态不是待支付，无法补单")
		}

		// 计算应充值额度：
		// - Stripe 订单：Money 代表经分组倍率换算后的美元数量，直接 * QuotaPerUnit
		// - 其他订单（如易支付）：Amount 为美元数量，* QuotaPerUnit
		var quotaErr error
		if topUp.PaymentProvider == PaymentProviderStripe {
			quotaToAdd, quotaErr = common.WalletQuotaFromDecimalStrict(
				decimal.NewFromFloat(topUp.Money).Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
			)
		} else {
			quotaToAdd, quotaErr = common.WalletQuotaFromDecimalStrict(
				decimal.NewFromInt(topUp.Amount).Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
			)
		}
		if quotaErr != nil || quotaToAdd <= 0 {
			return ErrInvalidTopUpQuota
		}

		// 标记完成：条件更新 pending -> success，由数据库决定归属，避免
		// SQLite 上并发的「回调 + 人工补单」同时读到 pending 而重复入账。
		claimed, claimErr := claimPendingTopUp(tx, tradeNo, nil)
		if claimErr != nil {
			return claimErr
		}
		if !claimed {
			alreadyCompleted = true
			return nil
		}
		topUp.CompleteTime = common.GetTimestamp()
		topUp.Status = common.TopUpStatusSuccess

		// 增加用户额度（立即写库，保持一致性）
		if err := creditTopUpQuota(tx, topUp.UserId, quotaToAdd, nil); err != nil {
			return err
		}

		userId = topUp.UserId
		payMoney = topUp.Money
		paymentMethod = topUp.PaymentMethod
		return nil
	})

	if err != nil {
		return outcome, err
	}

	// F-06/F-19: on the idempotent repeat call the order was already completed in
	// a previous invocation, so the transaction never populated userId /
	// quotaToAdd / payMoney / paymentMethod. Skipping the cache sync and audit
	// log here avoids touching user 0's cache and writing a false completion.
	if alreadyCompleted {
		return outcome, nil
	}

	// 事务外记录日志，避免阻塞
	syncCreditUserQuotaCache(userId, quotaToAdd, "manual topup")
	RecordTopupLog(userId, common.NewMessage("Administrator completed the order, amount added: {{quota}}, payment amount: {{amount}}", map[string]any{"quota": logger.FormatQuota(quotaToAdd), "amount": fmt.Sprintf("%f", payMoney)}), callerIp, paymentMethod, "admin")
	return ManualTopUpOutcome{Completed: true, UserId: userId, QuotaAdded: quotaToAdd}, nil
}

// RechargeCreem credits the order without treating payment-provider billing details
// as verified account identity. customer/billing email ownership is not established
// by a signed payment webhook, so this function must not bind it to the user account.
func RechargeCreem(referenceId string, _ string, _ string, callerIp string) (err error) {
	if referenceId == "" {
		return errors.New("payment order number not provided")
	}

	var quota int
	alreadyDone := false
	topUp := &TopUp{}

	refCol := "`trade_no`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		refCol = `"trade_no"`
	}

	err = DB.Transaction(func(tx *gorm.DB) error {
		err := lockForUpdate(tx).Where(refCol+" = ?", referenceId).First(topUp).Error
		if err != nil {
			return errors.New("充值订单不存在")
		}

		if topUp.PaymentProvider != PaymentProviderCreem {
			return ErrPaymentMethodMismatch
		}

		if topUp.Status == common.TopUpStatusSuccess {
			alreadyDone = true
			return nil
		}
		if topUp.Status != common.TopUpStatusPending {
			return errors.New("充值订单状态错误")
		}

		// Creem 直接使用 Amount 作为充值额度（整数）
		quota, err = common.WalletQuotaFromDecimalStrict(decimal.NewFromInt(topUp.Amount))
		if err != nil || quota <= 0 {
			return ErrInvalidTopUpQuota
		}

		claimed, claimErr := claimPendingTopUp(tx, referenceId, nil)
		if claimErr != nil {
			return claimErr
		}
		if !claimed {
			// 并发回调已抢先完成该订单：本次按幂等重复处理，绝不二次入账。
			alreadyDone = true
			return nil
		}
		topUp.CompleteTime = common.GetTimestamp()
		topUp.Status = common.TopUpStatusSuccess

		// Billing email/name from the provider are not identity-verification signals.
		// Account email changes must go through the explicit email-binding flow.
		return creditTopUpQuota(tx, topUp.UserId, quota, nil)
	})

	if err != nil {
		common.SysError("creem topup failed: " + err.Error())
		return errors.New("充值失败，请稍后重试")
	}
	if alreadyDone {
		return nil
	}
	syncCreditUserQuotaCache(topUp.UserId, quota, "creem topup")

	RecordTopupLog(topUp.UserId, common.NewMessage("{{provider}} top-up succeeded, amount added: {{quota}}, payment amount: {{amount}}", map[string]any{"provider": "Creem", "quota": quota, "amount": fmt.Sprintf("%.2f", topUp.Money)}), callerIp, topUp.PaymentMethod, PaymentMethodCreem)

	return nil
}

func RechargeWaffo(tradeNo string, callerIp string) (err error) {
	if tradeNo == "" {
		return errors.New("payment order number not provided")
	}

	var quotaToAdd int
	alreadyDone := false
	topUp := &TopUp{}

	refCol := "`trade_no`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		refCol = `"trade_no"`
	}

	err = DB.Transaction(func(tx *gorm.DB) error {
		err := lockForUpdate(tx).Where(refCol+" = ?", tradeNo).First(topUp).Error
		if err != nil {
			return errors.New("充值订单不存在")
		}

		if topUp.PaymentProvider != PaymentProviderWaffo {
			return ErrPaymentMethodMismatch
		}

		if topUp.Status == common.TopUpStatusSuccess {
			alreadyDone = true
			return nil // 幂等：已成功直接返回
		}

		if topUp.Status != common.TopUpStatusPending {
			return errors.New("充值订单状态错误")
		}

		quotaToAdd, err = common.WalletQuotaFromDecimalStrict(
			decimal.NewFromInt(topUp.Amount).Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
		)
		if err != nil || quotaToAdd <= 0 {
			return ErrInvalidTopUpQuota
		}

		claimed, claimErr := claimPendingTopUp(tx, tradeNo, nil)
		if claimErr != nil {
			return claimErr
		}
		if !claimed {
			// 并发回调已抢先完成该订单：本次按幂等重复处理，绝不二次入账。
			alreadyDone = true
			return nil
		}
		topUp.CompleteTime = common.GetTimestamp()
		topUp.Status = common.TopUpStatusSuccess

		return creditTopUpQuota(tx, topUp.UserId, quotaToAdd, nil)
	})

	if err != nil {
		common.SysError("waffo topup failed: " + err.Error())
		return errors.New("充值失败，请稍后重试")
	}
	if alreadyDone {
		return nil
	}
	syncCreditUserQuotaCache(topUp.UserId, quotaToAdd, "waffo topup")

	if quotaToAdd > 0 {
		RecordTopupLog(topUp.UserId, common.NewMessage("{{provider}} top-up succeeded, amount added: {{quota}}, payment amount: {{amount}}", map[string]any{"provider": "Waffo", "quota": logger.FormatQuota(quotaToAdd), "amount": fmt.Sprintf("%.2f", topUp.Money)}), callerIp, topUp.PaymentMethod, PaymentMethodWaffo)
	}

	return nil
}

func RechargeWaffoPancake(tradeNo string) (err error) {
	if tradeNo == "" {
		return errors.New("payment order number not provided")
	}

	var quotaToAdd int
	alreadyDone := false
	topUp := &TopUp{}

	refCol := "`trade_no`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		refCol = `"trade_no"`
	}

	err = DB.Transaction(func(tx *gorm.DB) error {
		err := lockForUpdate(tx).Where(refCol+" = ?", tradeNo).First(topUp).Error
		if err != nil {
			return errors.New("充值订单不存在")
		}

		if topUp.PaymentProvider != PaymentProviderWaffoPancake {
			return ErrPaymentMethodMismatch
		}

		if topUp.Status == common.TopUpStatusSuccess {
			alreadyDone = true
			return nil
		}

		if topUp.Status != common.TopUpStatusPending {
			return errors.New("充值订单状态错误")
		}

		quotaToAdd, err = common.WalletQuotaFromDecimalStrict(
			decimal.NewFromInt(topUp.Amount).Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
		)
		if err != nil || quotaToAdd <= 0 {
			return ErrInvalidTopUpQuota
		}

		claimed, claimErr := claimPendingTopUp(tx, tradeNo, nil)
		if claimErr != nil {
			return claimErr
		}
		if !claimed {
			// 并发回调已抢先完成该订单：本次按幂等重复处理，绝不二次入账。
			alreadyDone = true
			return nil
		}
		topUp.CompleteTime = common.GetTimestamp()
		topUp.Status = common.TopUpStatusSuccess

		return creditTopUpQuota(tx, topUp.UserId, quotaToAdd, nil)
	})

	if err != nil {
		common.SysError("waffo pancake topup failed: " + err.Error())
		return errors.New("充值失败，请稍后重试")
	}
	if alreadyDone {
		return nil
	}
	syncCreditUserQuotaCache(topUp.UserId, quotaToAdd, "waffo pancake topup")

	if quotaToAdd > 0 {
		RecordLog(topUp.UserId, LogTypeTopup, common.NewMessage("{{provider}} top-up succeeded, amount added: {{quota}}, payment amount: {{amount}}", map[string]any{"provider": "Waffo Pancake", "quota": logger.FormatQuota(quotaToAdd), "amount": fmt.Sprintf("%.2f", topUp.Money)}))
	}

	return nil
}
