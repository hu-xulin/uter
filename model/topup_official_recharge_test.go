/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not found? See <https://www.gnu.org/licenses/>.
*/

package model

import (
	"testing"

	"github.com/uter-ai/uter/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func createOfficialTestOrder(t *testing.T, userId int, tradeNo string, provider string, method string, amount float64, money float64) TopUp {
	t.Helper()
	order := TopUp{
		UserId:          userId,
		Amount:          amount,
		Money:           money,
		TradeNo:         tradeNo,
		PaymentMethod:   method,
		PaymentProvider: provider,
		Status:          common.TopUpStatusPending,
		CreateTime:      common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(&order).Error)
	return order
}

func useFixedQuotaPerUnitForOfficialTest(t *testing.T, value float64) {
	t.Helper()
	old := common.QuotaPerUnit
	common.QuotaPerUnit = value
	t.Cleanup(func() { common.QuotaPerUnit = old })
}

// createOfficialTestUser 显式指定唯一 aff_code：默认生成只有 4 位随机空间，
// 同一测试内创建多个用户时极易碰撞唯一约束。
func createOfficialTestUser(t *testing.T, id int, quota int, affCode string) *User {
	t.Helper()
	user := &User{
		Id:       id,
		Username: "official_pay_user_" + affCode,
		Status:   common.UserStatusEnabled,
		Quota:    quota,
		AffCode:  affCode,
	}
	require.NoError(t, DB.Create(user).Error)
	return user
}

// 官方直连（支付宝/微信）订单入账必须与易支付一样：一次且仅一次。
func TestRechargeOfficialCreditsQuotaExactlyOnce(t *testing.T) {
	for _, tc := range []struct {
		name     string
		provider string
		method   string
		recharge func(string, string, string) (bool, error)
	}{
		{
			name:     "alipay",
			provider: PaymentProviderAlipay,
			method:   PaymentMethodAlipay,
			recharge: RechargeAlipay,
		},
		{
			name:     "wechat",
			provider: PaymentProviderWechatPay,
			method:   PaymentMethodWechatPay,
			recharge: RechargeWechatPay,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			truncateTables(t)
			useFixedQuotaPerUnitForOfficialTest(t, 500000)

			user := insertUserForPaymentGuardTest(t, 601, 0)
			order := createOfficialTestOrder(t, user.Id, "OFFICIAL-"+tc.name, tc.provider, tc.method, 2, 10.0)

			alreadyDone, err := tc.recharge(order.TradeNo, tc.method, "127.0.0.1")
			require.NoError(t, err)
			assert.False(t, alreadyDone)
			assert.Equal(t, 2*500000, getUserQuotaForPaymentGuardTest(t, user.Id))

			reloaded := GetTopUpByTradeNo(order.TradeNo)
			require.NotNil(t, reloaded)
			assert.Equal(t, common.TopUpStatusSuccess, reloaded.Status)
			assert.NotZero(t, reloaded.CompleteTime)

			// 重复回调必须幂等：不再加额度。
			alreadyDone, err = tc.recharge(order.TradeNo, tc.method, "127.0.0.1")
			require.NoError(t, err)
			assert.True(t, alreadyDone)
			assert.Equal(t, 2*500000, getUserQuotaForPaymentGuardTest(t, user.Id))
		})
	}
}

// 跨网关串单必须被拒绝：微信回调不能给支付宝订单入账，反之亦然。
func TestRechargeOfficialRejectsCrossProviderOrders(t *testing.T) {
	truncateTables(t)
	useFixedQuotaPerUnitForOfficialTest(t, 500000)

	alipayUser := createOfficialTestUser(t, 602, 0, "OFFA")
	wechatUser := createOfficialTestUser(t, 603, 0, "OFFW")

	alipayOrder := createOfficialTestOrder(t, alipayUser.Id, "CROSS-ALIPAY", PaymentProviderAlipay, PaymentMethodAlipay, 2, 10.0)
	wechatOrder := createOfficialTestOrder(t, wechatUser.Id, "CROSS-WECHAT", PaymentProviderWechatPay, PaymentMethodWechatPay, 2, 10.0)

	_, err := RechargeWechatPay(alipayOrder.TradeNo, PaymentMethodWechatPay, "127.0.0.1")
	require.ErrorIs(t, err, ErrPaymentMethodMismatch)
	assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, alipayOrder.TradeNo))
	assert.Equal(t, 0, getUserQuotaForPaymentGuardTest(t, alipayUser.Id))

	_, err = RechargeAlipay(wechatOrder.TradeNo, PaymentMethodAlipay, "127.0.0.1")
	require.ErrorIs(t, err, ErrPaymentMethodMismatch)
	assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, wechatOrder.TradeNo))
	assert.Equal(t, 0, getUserQuotaForPaymentGuardTest(t, wechatUser.Id))
}

// 非 pending 状态与不存在订单必须被拒绝，且不产生任何额度变更。
func TestRechargeOfficialRejectsNonPendingAndMissingOrders(t *testing.T) {
	truncateTables(t)
	useFixedQuotaPerUnitForOfficialTest(t, 500000)

	user := insertUserForPaymentGuardTest(t, 604, 7)

	expired := createOfficialTestOrder(t, user.Id, "OFFICIAL-EXPIRED", PaymentProviderAlipay, PaymentMethodAlipay, 2, 10.0)
	require.NoError(t, DB.Model(&TopUp{}).Where("trade_no = ?", expired.TradeNo).
		Update("status", common.TopUpStatusExpired).Error)

	_, err := RechargeAlipay(expired.TradeNo, PaymentMethodAlipay, "127.0.0.1")
	require.ErrorIs(t, err, ErrTopUpStatusInvalid)
	assert.Equal(t, 7, getUserQuotaForPaymentGuardTest(t, user.Id))

	_, err = RechargeAlipay("OFFICIAL-DOES-NOT-EXIST", PaymentMethodAlipay, "127.0.0.1")
	require.ErrorIs(t, err, ErrTopUpNotFound)
	assert.Equal(t, 7, getUserQuotaForPaymentGuardTest(t, user.Id))
}

// 入账金额来自订单 Amount（换算后额度），与回调金额无关；
// 因此下单时写入的 Amount 必须决定到账额度，此处锁定该不变量。
func TestRechargeOfficialCreditsBasedOnOrderAmount(t *testing.T) {
	truncateTables(t)
	useFixedQuotaPerUnitForOfficialTest(t, 500000)

	user := insertUserForPaymentGuardTest(t, 605, 0)
	order := createOfficialTestOrder(t, user.Id, "OFFICIAL-AMOUNT", PaymentProviderWechatPay, PaymentMethodWechatPay, 7, 35.0)

	alreadyDone, err := RechargeWechatPay(order.TradeNo, PaymentMethodWechatPay, "127.0.0.1")
	require.NoError(t, err)
	assert.False(t, alreadyDone)
	assert.Equal(t, 7*500000, getUserQuotaForPaymentGuardTest(t, user.Id))
}

// 额度溢出必须在完成订单前被拒绝，订单保持 pending，用户余额不变。
func TestRechargeOfficialRejectsQuotaOverflowBeforeCompletingOrder(t *testing.T) {
	for _, tc := range []struct {
		name     string
		provider string
		method   string
		recharge func(string, string, string) (bool, error)
	}{
		{
			name:     "alipay",
			provider: PaymentProviderAlipay,
			method:   PaymentMethodAlipay,
			recharge: RechargeAlipay,
		},
		{
			name:     "wechat",
			provider: PaymentProviderWechatPay,
			method:   PaymentMethodWechatPay,
			recharge: RechargeWechatPay,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			truncateTables(t)
			useFixedQuotaPerUnitForOfficialTest(t, float64(common.MaxWalletQuota+1))

			user := insertUserForPaymentGuardTest(t, 606, 3)
			order := createOfficialTestOrder(t, user.Id, "OFFICIAL-OVERFLOW-"+tc.name, tc.provider, tc.method, 2, 10.0)

			_, err := tc.recharge(order.TradeNo, tc.method, "127.0.0.1")
			require.Error(t, err)
			assert.Equal(t, 3, getUserQuotaForPaymentGuardTest(t, user.Id))
			assert.Equal(t, common.TopUpStatusPending, getTopUpStatusForPaymentGuardTest(t, order.TradeNo))
		})
	}
}

// Redis 与数据库额度必须同步，避免缓存读到旧余额导致前端轮询误判。
func TestRechargeOfficialKeepsRedisAndDatabaseCreditInSync(t *testing.T) {
	truncateTables(t)
	useUserCacheMiniRedis(t)
	useFixedQuotaPerUnitForOfficialTest(t, 5)

	user := insertUserForPaymentGuardTest(t, 607, 7)
	require.NoError(t, populateUserCache(*user))
	order := createOfficialTestOrder(t, user.Id, "OFFICIAL-REDIS-SYNC", PaymentProviderWechatPay, PaymentMethodWechatPay, 2, 10.0)

	alreadyDone, err := RechargeWechatPay(order.TradeNo, PaymentMethodWechatPay, "127.0.0.1")
	require.NoError(t, err)
	assert.False(t, alreadyDone)
	assert.Equal(t, 17, getUserQuotaForPaymentGuardTest(t, user.Id))

	cached, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 17, cached.Quota)

	alreadyDone, err = RechargeWechatPay(order.TradeNo, PaymentMethodWechatPay, "127.0.0.1")
	require.NoError(t, err)
	assert.True(t, alreadyDone)

	cached, err = cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 17, cached.Quota)
}

func TestRechargeCreemCreditsQuotaExactlyOnce(t *testing.T) {
	truncateTables(t)
	useFixedQuotaPerUnitForOfficialTest(t, 500000)

	user := insertUserForPaymentGuardTest(t, 608, 0)
	order := createOfficialTestOrder(t, user.Id, "CREEM-IDEMPOTENT", PaymentProviderCreem, PaymentMethodCreem, 2, 10.0)

	// A valid payment webhook proves payment, not ownership of the billing email.
	// Do not silently bind that address to an account with no verified email.
	require.NoError(t, RechargeCreem(order.TradeNo, "victim@example.com", "Billing Name", "127.0.0.1"))
	assert.Equal(t, 2, getUserQuotaForPaymentGuardTest(t, user.Id))
	reloaded, err := GetUserById(user.Id, false)
	require.NoError(t, err)
	require.NotNil(t, reloaded)
	assert.Empty(t, reloaded.Email, "payment billing details must not become verified account identity")

	// A concurrent/duplicate webhook that observes the already-successful order
	// must be acknowledged without a second credit or another top-up log.
	require.NoError(t, RechargeCreem(order.TradeNo, "another@example.com", "Other Name", "127.0.0.1"))
	assert.Equal(t, 2, getUserQuotaForPaymentGuardTest(t, user.Id))
}

func TestRechargeStripeCreditsQuotaExactlyOnce(t *testing.T) {
	truncateTables(t)
	useFixedQuotaPerUnitForOfficialTest(t, 500000)

	user := insertUserForPaymentGuardTest(t, 609, 0)
	order := createOfficialTestOrder(t, user.Id, "STRIPE-IDEMPOTENT", PaymentProviderStripe, PaymentMethodStripe, 10, 10.0)

	require.NoError(t, Recharge(order.TradeNo, "cus_stripe_test", "127.0.0.1"))
	expectedQuota := 10 * 500000
	assert.Equal(t, expectedQuota, getUserQuotaForPaymentGuardTest(t, user.Id))

	require.NoError(t, Recharge(order.TradeNo, "cus_stripe_test", "127.0.0.1"))
	assert.Equal(t, expectedQuota, getUserQuotaForPaymentGuardTest(t, user.Id))
}

// countTopupLogsForUser counts audit logs of type LogTypeTopup for a user.
func countTopupLogsForUser(t *testing.T, userId int) int64 {
	t.Helper()
	var count int64
	require.NoError(t, DB.Model(&Log{}).Where("user_id = ? AND type = ?", userId, LogTypeTopup).Count(&count).Error)
	return count
}

// TestManualCompleteTopUpIdempotentSkipsZeroValueSideEffects covers F-06/F-19:
// a repeat call to ManualCompleteTopUp on an already-completed order must be a
// clean no-op. Previously the idempotent early-return left userId / quotaToAdd /
// payMoney at their zero values, so the post-transaction cache sync and audit
// log still ran against user 0 and emitted a false "completed" log.
func TestManualCompleteTopUpIdempotentSkipsZeroValueSideEffects(t *testing.T) {
	truncateTables(t)
	useFixedQuotaPerUnitForOfficialTest(t, 500000)

	user := insertUserForPaymentGuardTest(t, 707, 0)
	order := createOfficialTestOrder(t, user.Id, "MANUAL-F0619", PaymentProviderAlipay, PaymentMethodAlipay, 2, 10.0)

	first, err := ManualCompleteTopUp(order.TradeNo, "127.0.0.1")
	require.NoError(t, err)
	assert.True(t, first.Completed, "first completion must report Completed")
	assert.Equal(t, user.Id, first.UserId)
	assert.Equal(t, 2*500000, first.QuotaAdded)
	expectedQuota := 2 * 500000
	assert.Equal(t, expectedQuota, getUserQuotaForPaymentGuardTest(t, user.Id))
	assert.Equal(t, int64(1), countTopupLogsForUser(t, user.Id), "first completion writes one log for the real user")

	// The repeat call must not credit again and must not touch user 0.
	second, err := ManualCompleteTopUp(order.TradeNo, "127.0.0.1")
	require.NoError(t, err)
	assert.False(t, second.Completed, "repeat call must report that nothing was credited")
	assert.Zero(t, second.UserId, "repeat call must not report a credit target")
	assert.Zero(t, second.QuotaAdded)
	assert.Equal(t, expectedQuota, getUserQuotaForPaymentGuardTest(t, user.Id), "repeat call must not double-credit")
	assert.Equal(t, int64(0), countTopupLogsForUser(t, 0), "idempotent repeat must not write a false log for user 0")
}
