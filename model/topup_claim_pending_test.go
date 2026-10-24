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
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
package model

import (
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/uter-ai/uter/common"
)

/*
 * F-12：资金状态转换必须由数据库本身保证幂等，而不是靠进程内锁或
 * `SELECT ... FOR UPDATE`。后者在 SQLite 上被 lockForUpdate 降级成普通
 * SELECT，两个并发回调（网关重试 + 管理员补单，或多实例共用同一 webhook）
 * 都可能读到 pending 并各自入账。以下用例锁定「条件更新」这一保障：
 * 无论调用方读到什么，只有把行从 pending 改成 success 的那一次能入账。
 */

func claimPendingTopUpInTx(t *testing.T, tradeNo string, extra map[string]any) (bool, error) {
	t.Helper()
	var claimed bool
	err := DB.Transaction(func(tx *gorm.DB) error {
		var claimErr error
		claimed, claimErr = claimPendingTopUp(tx, tradeNo, extra)
		return claimErr
	})
	return claimed, err
}

func TestClaimPendingTopUpOnlyWinsOnce(t *testing.T) {
	truncateTables(t)
	insertUserForPaymentGuardTest(t, 801, 0)
	order := createEpayTestOrder(t, 801, "CLAIM-ONCE", PaymentProviderEpay, common.TopUpStatusPending)

	claimed, err := claimPendingTopUpInTx(t, order.TradeNo, nil)
	require.NoError(t, err)
	assert.True(t, claimed, "first caller owns the pending -> success transition")

	// 第二次调用代表并发的重复回调：状态已不是 pending，条件更新影响 0 行。
	claimed, err = claimPendingTopUpInTx(t, order.TradeNo, nil)
	require.NoError(t, err)
	assert.False(t, claimed, "repeat caller must not win the transition again")

	reloaded := GetTopUpByTradeNo(order.TradeNo)
	require.NotNil(t, reloaded)
	assert.Equal(t, common.TopUpStatusSuccess, reloaded.Status)
	assert.NotZero(t, reloaded.CompleteTime, "winning transition records the completion time")
}

func TestClaimPendingTopUpRejectsNonPendingOrder(t *testing.T) {
	truncateTables(t)
	insertUserForPaymentGuardTest(t, 802, 0)
	order := createEpayTestOrder(t, 802, "CLAIM-EXPIRED", PaymentProviderEpay, common.TopUpStatusExpired)

	claimed, err := claimPendingTopUpInTx(t, order.TradeNo, nil)
	require.ErrorIs(t, err, ErrTopUpStatusInvalid)
	assert.False(t, claimed)

	reloaded := GetTopUpByTradeNo(order.TradeNo)
	require.NotNil(t, reloaded)
	assert.Equal(t, common.TopUpStatusExpired, reloaded.Status, "a non-pending order must not be revived")
}

func TestClaimPendingTopUpWritesExtraColumnsAtomically(t *testing.T) {
	truncateTables(t)
	insertUserForPaymentGuardTest(t, 803, 0)
	order := createEpayTestOrder(t, 803, "CLAIM-EXTRA", PaymentProviderEpay, common.TopUpStatusPending)

	claimed, err := claimPendingTopUpInTx(t, order.TradeNo, map[string]any{"payment_method": "wxpay"})
	require.NoError(t, err)
	require.True(t, claimed)

	reloaded := GetTopUpByTradeNo(order.TradeNo)
	require.NotNil(t, reloaded)
	assert.Equal(t, common.TopUpStatusSuccess, reloaded.Status)
	assert.Equal(t, "wxpay", reloaded.PaymentMethod, "extra columns land in the same statement as the status")
}

// TestRechargeEpayConcurrentCallbacksCreditOnce 让多个 goroutine 同时回调同一订单。
// 无论内部如何调度（SQLite 单连接会串行化，MySQL/PG 会用行锁），最终额度只能增加一次。
func TestRechargeEpayConcurrentCallbacksCreditOnce(t *testing.T) {
	truncateTables(t)
	useFixedQuotaPerUnitForOfficialTest(t, 500000)

	user := insertUserForPaymentGuardTest(t, 804, 0)
	order := createEpayTestOrder(t, user.Id, "CLAIM-CONCURRENT", PaymentProviderEpay, common.TopUpStatusPending)

	const callbacks = 4
	var wg sync.WaitGroup
	results := make([]bool, callbacks)
	errs := make([]error, callbacks)
	for i := 0; i < callbacks; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			results[idx], errs[idx] = RechargeEpay(order.TradeNo, "alipay", "127.0.0.1")
		}(i)
	}
	wg.Wait()

	winners := 0
	for i := 0; i < callbacks; i++ {
		// 并发的重复回调要么被识别为幂等重复（alreadyDone），要么因并发写冲突
		// 返回错误；两者都不允许再入账一次。
		if errs[i] == nil && !results[i] {
			winners++
		}
	}
	assert.Equal(t, 1, winners, "exactly one callback may credit the order")
	assert.Equal(t, 2*500000, getUserQuotaForPaymentGuardTest(t, user.Id), "quota is credited exactly once")

	reloaded := GetTopUpByTradeNo(order.TradeNo)
	require.NotNil(t, reloaded)
	assert.Equal(t, common.TopUpStatusSuccess, reloaded.Status)
}

// TestManualCompleteTopUpRejectsFailedOrder 确认人工补单不能把已失败订单「复活」，
// 否则一个已被判失败的订单仍可能被补单入账，形成重复资金。
func TestManualCompleteTopUpRejectsFailedOrder(t *testing.T) {
	truncateTables(t)
	useFixedQuotaPerUnitForOfficialTest(t, 500000)

	user := insertUserForPaymentGuardTest(t, 805, 0)
	order := createEpayTestOrder(t, user.Id, "CLAIM-FAILED", PaymentProviderEpay, common.TopUpStatusPending)

	stored := GetTopUpByTradeNo(order.TradeNo)
	require.NotNil(t, stored)
	require.NoError(t, stored.MarkFailed("checkout never completed"))

	outcome, err := ManualCompleteTopUp(order.TradeNo, "127.0.0.1")
	require.Error(t, err)
	assert.False(t, outcome.Completed)
	assert.Equal(t, 0, getUserQuotaForPaymentGuardTest(t, user.Id), "a failed order must not be credited")

	reloaded := GetTopUpByTradeNo(order.TradeNo)
	require.NotNil(t, reloaded)
	assert.Equal(t, common.TopUpStatusFailed, reloaded.Status)
}
