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
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

// 已付款但异步回调没到达、用户也没从收银台回跳时，后台对账必须把订单补成
// 成功并加额度——这是「支付状态不同步」的最终兜底，不依赖浏览器是否回来。
func TestAlipayReconcileCreditsPaidPendingOrder(t *testing.T) {
	db := setupAlipayQueryEnv(t, func(outTradeNo string) string {
		return fmt.Sprintf(`{"code":"10000","msg":"Success","trade_status":"TRADE_SUCCESS","total_amount":"10.00","out_trade_no":%q}`, outTradeNo)
	})

	user := &model.User{Username: "alipay_reconcile_paid", AffCode: "arpaid", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(user).Error)
	alipayQueryOrder(t, db, user.Id, "ALIPAY-RECONCILE-PAID", 2, 10, 1000)

	credited := RunAlipayReconcileOnce(context.Background())
	require.Equal(t, 1, credited)

	var stored model.TopUp
	require.NoError(t, db.Where("trade_no = ?", "ALIPAY-RECONCILE-PAID").First(&stored).Error)
	assert.Equal(t, common.TopUpStatusSuccess, stored.Status)
	assert.NotZero(t, stored.CompleteTime)

	var reloaded model.User
	require.NoError(t, db.First(&reloaded, user.Id).Error)
	assert.Greater(t, reloaded.Quota, 0)
}

// 对账必须幂等：订单已入账后再次跑一轮，不能重复加额度。
func TestAlipayReconcileIsIdempotent(t *testing.T) {
	db := setupAlipayQueryEnv(t, func(outTradeNo string) string {
		return fmt.Sprintf(`{"code":"10000","msg":"Success","trade_status":"TRADE_SUCCESS","total_amount":"10.00","out_trade_no":%q}`, outTradeNo)
	})

	user := &model.User{Username: "alipay_reconcile_idem", AffCode: "aridem", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(user).Error)
	alipayQueryOrder(t, db, user.Id, "ALIPAY-RECONCILE-IDEM", 2, 10, 1000)

	require.Equal(t, 1, RunAlipayReconcileOnce(context.Background()))
	var afterFirst model.User
	require.NoError(t, db.First(&afterFirst, user.Id).Error)

	// 第二轮：订单已 success，不再出现在待对账集合里。
	assert.Zero(t, RunAlipayReconcileOnce(context.Background()))
	var afterSecond model.User
	require.NoError(t, db.First(&afterSecond, user.Id).Error)
	assert.Equal(t, afterFirst.Quota, afterSecond.Quota)
}

// 未付款订单不能被对账误入账，且必须保持 pending（用户仍可能用原链接付款）。
func TestAlipayReconcileLeavesUnpaidOrderPending(t *testing.T) {
	db := setupAlipayQueryEnv(t, func(outTradeNo string) string {
		return `{"code":"40004","msg":"Business Failed","sub_code":"ACQ.TRADE_NOT_EXIST","sub_msg":"交易不存在"}`
	})

	user := &model.User{Username: "alipay_reconcile_unpaid", AffCode: "arunp", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(user).Error)
	alipayQueryOrder(t, db, user.Id, "ALIPAY-RECONCILE-UNPAID", 2, 10, 1000)

	assert.Zero(t, RunAlipayReconcileOnce(context.Background()))

	var stored model.TopUp
	require.NoError(t, db.Where("trade_no = ?", "ALIPAY-RECONCILE-UNPAID").First(&stored).Error)
	assert.Equal(t, common.TopUpStatusPending, stored.Status)

	var reloaded model.User
	require.NoError(t, db.First(&reloaded, user.Id).Error)
	assert.Zero(t, reloaded.Quota)
}

// 网关金额与下单快照不符时必须拒绝入账，对账不能成为少付多充的旁路。
func TestAlipayReconcileRejectsAmountMismatch(t *testing.T) {
	db := setupAlipayQueryEnv(t, func(outTradeNo string) string {
		return fmt.Sprintf(`{"code":"10000","msg":"Success","trade_status":"TRADE_SUCCESS","total_amount":"0.01","out_trade_no":%q}`, outTradeNo)
	})

	user := &model.User{Username: "alipay_reconcile_mismatch", AffCode: "armis", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(user).Error)
	alipayQueryOrder(t, db, user.Id, "ALIPAY-RECONCILE-MISMATCH", 2, 10, 1000)

	assert.Zero(t, RunAlipayReconcileOnce(context.Background()))

	var stored model.TopUp
	require.NoError(t, db.Where("trade_no = ?", "ALIPAY-RECONCILE-MISMATCH").First(&stored).Error)
	assert.Equal(t, common.TopUpStatusPending, stored.Status)
}

// 窗口外的订单不再自动对账：否则历史 pending 订单会被每轮 tick 反复查单，
// 既浪费网关配额，也让日志永远有噪音。
func TestAlipayReconcileSkipsOrdersOutsideWindow(t *testing.T) {
	db := setupAlipayQueryEnv(t, func(outTradeNo string) string {
		return fmt.Sprintf(`{"code":"10000","msg":"Success","trade_status":"TRADE_SUCCESS","total_amount":"10.00","out_trade_no":%q}`, outTradeNo)
	})

	user := &model.User{Username: "alipay_reconcile_old", AffCode: "arold", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(user).Error)
	order := alipayQueryOrder(t, db, user.Id, "ALIPAY-RECONCILE-OLD", 2, 10, 1000)
	// 把创建时间推到窗口外（比窗口再早 1 小时）。
	oldCreateTime := time.Now().Add(-alipayReconcileWindow - time.Hour).Unix()
	require.NoError(t, db.Model(&model.TopUp{}).Where("id = ?", order.Id).
		Update("create_time", oldCreateTime).Error)

	assert.Zero(t, RunAlipayReconcileOnce(context.Background()))

	var stored model.TopUp
	require.NoError(t, db.Where("trade_no = ?", "ALIPAY-RECONCILE-OLD").First(&stored).Error)
	assert.Equal(t, common.TopUpStatusPending, stored.Status)
}

// callGetUserTopUps 以指定用户身份读取充值记录列表。
func callGetUserTopUps(t *testing.T, userId int) map[string]any {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodGet, "/api/user/topup/self?p=1&page_size=10", nil)
	c.Request = req
	c.Set("id", userId)
	GetUserTopUps(c)

	var payload map[string]any
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &payload))
	return payload
}

// firstTopUpStatus 取列表里第一条记录的状态。
func firstTopUpStatus(t *testing.T, payload map[string]any) string {
	t.Helper()
	data, ok := payload["data"].(map[string]any)
	require.Truef(t, ok, "expected data object, got %#v", payload["data"])
	items, ok := data["items"].([]any)
	require.Truef(t, ok, "expected items array, got %#v", data["items"])
	require.NotEmpty(t, items)
	first, ok := items[0].(map[string]any)
	require.Truef(t, ok, "expected item object, got %#v", items[0])
	status, _ := first["status"].(string)
	return status
}

// 用户打开充值记录时必须看到网关的真实状态，而不是「一分钟前的快照」：
// 读列表前先对近期 pending 的订单补一次查单，已付款的直接入账并显示成功。
func TestGetUserTopUpsReconcilesBeforeReturning(t *testing.T) {
	db := setupAlipayQueryEnv(t, func(outTradeNo string) string {
		return fmt.Sprintf(`{"code":"10000","msg":"Success","trade_status":"TRADE_SUCCESS","total_amount":"10.00","out_trade_no":%q}`, outTradeNo)
	})

	user := &model.User{Username: "alipay_list_reconcile", AffCode: "arlist", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(user).Error)
	alipayQueryOrder(t, db, user.Id, "ALIPAY-LIST-RECONCILE", 2, 10, 1000)

	payload := callGetUserTopUps(t, user.Id)
	assert.Equal(t, "success", firstTopUpStatus(t, payload))

	var stored model.TopUp
	require.NoError(t, db.Where("trade_no = ?", "ALIPAY-LIST-RECONCILE").First(&stored).Error)
	assert.Equal(t, common.TopUpStatusSuccess, stored.Status)

	var reloaded model.User
	require.NoError(t, db.First(&reloaded, user.Id).Error)
	assert.Greater(t, reloaded.Quota, 0)
}

// 网关查单失败不能拖垮列表：这次先按本地状态展示，后台任务稍后再补。
func TestGetUserTopUpsSurvivesGatewayFailure(t *testing.T) {
	db := setupAlipayQueryEnv(t, func(outTradeNo string) string {
		// code 非 10000 且不是 TRADE_NOT_EXIST → 视为查询故障。
		return `{"code":"20000","msg":"Service Currently Unavailable","sub_code":"isp.unknow-error"}`
	})

	user := &model.User{Username: "alipay_list_gateway_down", AffCode: "ardown", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(user).Error)
	alipayQueryOrder(t, db, user.Id, "ALIPAY-LIST-GATEWAY-DOWN", 2, 10, 1000)

	payload := callGetUserTopUps(t, user.Id)
	assert.Equal(t, "pending", firstTopUpStatus(t, payload))

	var reloaded model.User
	require.NoError(t, db.First(&reloaded, user.Id).Error)
	assert.Zero(t, reloaded.Quota)
}
