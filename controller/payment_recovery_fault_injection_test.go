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

package controller

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
)

// ============================================================================
// P13-PAY-001 故障注入：网关已报「已支付」，但本地订单记录缺失（持久化丢失）。
//
// 不变量（红线）：
//  1. 本地不存在订单记录时绝不入账——对账不能成为「凭空给任意 trade_no 加额度」
//     的旁路（缺失记录意味着没有金额快照、没有用户归属，入账无法被审计）。
//  2. 该故障不得让对账 worker 崩溃或卡死，后续轮次必须继续工作。
//  3. 记录恢复（模拟主从复制追平）后，恢复流程仍能恰好入账一次。
//
// ============================================================================
func TestAlipayReconcileDoesNotCreditMissingOrderRecord(t *testing.T) {
	db := setupAlipayQueryEnv(t, func(outTradeNo string) string {
		return fmt.Sprintf(`{"code":"10000","msg":"Success","trade_status":"TRADE_SUCCESS","total_amount":"10.00","out_trade_no":%q}`, outTradeNo)
	})

	user := &model.User{Username: "alipay_fault_missing_row", AffCode: "afmiss", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(user).Error)
	order := alipayQueryOrder(t, db, user.Id, "ALIPAY-FAULT-MISSING", 2, 10, 1000)

	// 故障注入：订单记录在对账列出之后、入账之前从本地库消失
	// （等价于「网关见过这笔单、本地持久化丢失」的复制分裂窗口）。
	require.NoError(t, db.Where("id = ?", order.Id).Delete(&model.TopUp{}).Error)

	paidResult := &service.AlipayQueryResult{
		TradeStatus: "TRADE_SUCCESS",
		TotalAmount: "10.00",
		OutTradeNo:  order.TradeNo,
	}
	status := applyAlipayQueryResult(context.Background(), order, paidResult, "fault-injection")

	// 红线 1：缺失记录绝不能被计为成功入账。
	assert.NotEqual(t, AlipayReconcileSuccess, status,
		"a paid gateway result must never be credited without a local order record")

	// 红线 2：账户零入账。
	var reloaded model.User
	require.NoError(t, db.First(&reloaded, user.Id).Error)
	assert.Zero(t, reloaded.Quota, "missing local record must not credit any quota")

	// 恢复段：本地记录恢复后（复制追平），下一轮对账必须恰好入账一次。
	restored := alipayQueryOrder(t, db, user.Id, order.TradeNo, 2, 10, 1000)
	require.Equal(t, order.TradeNo, restored.TradeNo)

	require.Equal(t, 1, RunAlipayReconcileOnce(context.Background()))

	var recovered model.TopUp
	require.NoError(t, db.Where("trade_no = ?", order.TradeNo).First(&recovered).Error)
	assert.Equal(t, common.TopUpStatusSuccess, recovered.Status)
	assert.NotZero(t, recovered.CompleteTime)

	var credited model.User
	require.NoError(t, db.First(&credited, user.Id).Error)
	assert.Greater(t, credited.Quota, 0)

	// 再跑一轮：幂等，不二次入账。
	assert.Zero(t, RunAlipayReconcileOnce(context.Background()))
	var finalUser model.User
	require.NoError(t, db.First(&finalUser, user.Id).Error)
	assert.Equal(t, credited.Quota, finalUser.Quota)
}

// ============================================================================
// P13-PAY-010 故障注入（A）：恢复 worker 第一轮查单失败（网关故障），第二轮自动重试。
//
// 不变量：
//  1. 查单失败轮次零入账、订单保持 pending、worker 不崩溃。
//  2. 网关恢复后下一轮自动补账，且只入账一次。
//
// ============================================================================
func TestAlipayReconcileRetriesAfterGatewayFailureRound(t *testing.T) {
	var callCount atomic.Int32
	db := setupAlipayQueryEnv(t, func(outTradeNo string) string {
		// 第一次查单返回网关故障；之后恢复正常返回 TRADE_SUCCESS。
		if callCount.Add(1) <= 1 {
			return `{"code":"20000","msg":"Service Currently Unavailable","sub_code":"isp.unknow-error"}`
		}
		return fmt.Sprintf(`{"code":"10000","msg":"Success","trade_status":"TRADE_SUCCESS","total_amount":"10.00","out_trade_no":%q}`, outTradeNo)
	})

	user := &model.User{Username: "alipay_fault_retry", AffCode: "afretry", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(user).Error)
	alipayQueryOrder(t, db, user.Id, "ALIPAY-FAULT-RETRY", 2, 10, 1000)

	// 第一轮：网关故障 → 零入账、保持 pending。
	assert.Zero(t, RunAlipayReconcileOnce(context.Background()))
	var afterFailure model.TopUp
	require.NoError(t, db.Where("trade_no = ?", "ALIPAY-FAULT-RETRY").First(&afterFailure).Error)
	assert.Equal(t, common.TopUpStatusPending, afterFailure.Status)

	var afterFailureUser model.User
	require.NoError(t, db.First(&afterFailureUser, user.Id).Error)
	assert.Zero(t, afterFailureUser.Quota)

	// 第二轮：网关恢复 → 自动重试成功，恰好一次入账。
	require.Equal(t, 1, RunAlipayReconcileOnce(context.Background()))
	var afterRetry model.TopUp
	require.NoError(t, db.Where("trade_no = ?", "ALIPAY-FAULT-RETRY").First(&afterRetry).Error)
	assert.Equal(t, common.TopUpStatusSuccess, afterRetry.Status)

	var afterRetryUser model.User
	require.NoError(t, db.First(&afterRetryUser, user.Id).Error)
	assert.Greater(t, afterRetryUser.Quota, int(0))
}

// ============================================================================
// P13-PAY-010 故障注入（B）：恢复 worker 并发触发（单飞保护 + 精确一次入账）。
//
// 不变量：多个并发 tick 同时触发 worker 时，单飞保护保证同一时刻只有一轮在跑；
// 最终额度恰好等于一笔订单的额度，绝不重复入账。
// ============================================================================
func TestAlipayReconcileWorkerSingleFlightExactOnceCredit(t *testing.T) {
	db := setupAlipayQueryEnv(t, func(outTradeNo string) string {
		return fmt.Sprintf(`{"code":"10000","msg":"Success","trade_status":"TRADE_SUCCESS","total_amount":"10.00","out_trade_no":%q}`, outTradeNo)
	})

	user := &model.User{Username: "alipay_fault_singleflight", AffCode: "afsf", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(user).Error)
	alipayQueryOrder(t, db, user.Id, "ALIPAY-FAULT-SF", 2, 10, 1000)

	const workers = 8
	var wg sync.WaitGroup
	totalCredited := make([]int, workers)
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			totalCredited[idx] = RunAlipayReconcileOnce(context.Background())
		}(i)
	}
	wg.Wait()

	sum := 0
	for _, c := range totalCredited {
		sum += c
	}
	assert.Equal(t, 1, sum,
		"concurrent reconcile workers must credit the paid order exactly once in total")

	var finalUser model.User
	require.NoError(t, db.First(&finalUser, user.Id).Error)
	assert.Equal(t, int(2*common.QuotaPerUnit), finalUser.Quota)

	var stored model.TopUp
	require.NoError(t, db.Where("trade_no = ?", "ALIPAY-FAULT-SF").First(&stored).Error)
	assert.Equal(t, common.TopUpStatusSuccess, stored.Status)
}
