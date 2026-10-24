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
*/

package controller

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/operation_setting"
	"gorm.io/gorm"
)

// setupEpayTopUpTestEnv prepares an isolated environment for the Epay top-up
// handler: an in-memory database plus a configured (fake) Epay gateway. It
// returns the database and the user id so a test can control whether the local
// top_ups table exists.
func setupEpayTopUpTestEnv(t *testing.T) (*gorm.DB, int) {
	t.Helper()
	db := setupBillingTestDB(t)
	// setupBillingTestDB swaps the process-wide database; the dialect-quoted
	// column names have to follow, otherwise every query built from them is a
	// syntax error instead of a real result.
	model.InitColumnNames()
	t.Cleanup(model.InitColumnNames)

	prevAddress := operation_setting.PayAddress
	prevEpayId := operation_setting.EpayId
	prevEpayKey := operation_setting.EpayKey
	prevMethods := operation_setting.PayMethods
	prevMinTopup := operation_setting.MinTopUp
	ps := operation_setting.GetPaymentSetting()
	prevConfirmed := ps.ComplianceConfirmed
	prevVersion := ps.ComplianceTermsVersion

	operation_setting.PayAddress = "https://pay.example.com"
	operation_setting.EpayId = "10001"
	operation_setting.EpayKey = "epay-test-key"
	operation_setting.PayMethods = []map[string]string{{"type": "alipay"}}
	operation_setting.MinTopUp = 1
	ps.ComplianceConfirmed = true
	ps.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion

	t.Cleanup(func() {
		operation_setting.PayAddress = prevAddress
		operation_setting.EpayId = prevEpayId
		operation_setting.EpayKey = prevEpayKey
		operation_setting.PayMethods = prevMethods
		operation_setting.MinTopUp = prevMinTopup
		ps.ComplianceConfirmed = prevConfirmed
		ps.ComplianceTermsVersion = prevVersion
	})

	user := &model.User{
		Username:  "epay-order-user",
		Password:  "p",
		Status:    common.UserStatusEnabled,
		Group:     "default",
		Quota:     0,
		UsedQuota: 0,
	}
	require.NoError(t, db.Create(user).Error)
	return db, user.Id
}

// requestEpayTopUp calls the Epay top-up handler and returns the decoded
// response body.
func requestEpayTopUp(t *testing.T, userId int, amount int64, method string) map[string]any {
	t.Helper()
	body := `{"amount":` + strconv.FormatInt(amount, 10) + `,"payment_method":"` + method + `"}`
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/user/epay", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("id", userId)
	RequestEpay(c)

	var response map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	return response
}

// F-07: a payment URL must never reach the user unless the matching local
// pending order was persisted. Before the fix the URL was issued first, so a
// failing local insert left the user paying for an order the callback could
// never find — money received but never credited.
func TestEpayTopUpDoesNotIssuePaymentURLWhenLocalOrderCannotBeStored(t *testing.T) {
	db, userId := setupEpayTopUpTestEnv(t)
	// Simulate a local write failure: the orders table is gone.
	require.NoError(t, db.Migrator().DropTable(&model.TopUp{}))

	response := requestEpayTopUp(t, userId, 10, "alipay")

	assert.Equal(t, "error", response["message"])
	assert.NotContains(t, response, "url", "本地订单未落库时不得把支付链接发给用户")
	// 错误应答里的 data 是提示文案，不是给网关的支付参数。
	if data, ok := response["data"]; ok {
		assert.IsType(t, "", data, "错误应答不得包含支付参数")
	}
}

// F-07: on the happy path the local pending order exists and is bound to the
// very trade number the provider was asked to charge.
func TestEpayTopUpPersistsPendingOrderBeforeIssuingPaymentURL(t *testing.T) {
	db, userId := setupEpayTopUpTestEnv(t)
	require.NoError(t, db.AutoMigrate(&model.TopUp{}))

	response := requestEpayTopUp(t, userId, 10, "alipay")

	require.Equal(t, "success", response["message"])
	url, _ := response["url"].(string)
	assert.NotEmpty(t, url, "成功下单必须返回支付链接")

	params, ok := response["data"].(map[string]any)
	require.True(t, ok, "成功下单必须返回支付参数")
	outTradeNo, _ := params["out_trade_no"].(string)
	require.NotEmpty(t, outTradeNo)

	var stored model.TopUp
	require.NoError(t, db.Where("trade_no = ?", outTradeNo).First(&stored).Error)
	assert.Equal(t, common.TopUpStatusPending, stored.Status)
	assert.Equal(t, model.PaymentProviderEpay, stored.PaymentProvider)
	assert.Equal(t, userId, stored.UserId)
}
