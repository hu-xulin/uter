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
package service

import (
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/model"
	relaycommon "github.com/uter-ai/uter/relay/common"
)

// ---------------------------------------------------------------------------
// BE-BIL-022 — 结算失败时用量日志不得虚报「全额已扣」
// ---------------------------------------------------------------------------

// settleFailingFunding 的资金来源 Settle 恒定失败，模拟「差额落库失败」
// （DB 写入异常）：预扣已经落地，超出预扣的部分没有真正扣到。
type settleFailingFunding struct {
	preConsumed int
}

func (f *settleFailingFunding) Source() string       { return BillingSourceWallet }
func (f *settleFailingFunding) PreConsume(int) error { return nil }
func (f *settleFailingFunding) Refund() error        { return nil }
func (f *settleFailingFunding) Settle(delta int) error {
	return errors.New("simulated db write failure")
}

// settleOKFunding 的资金来源 Settle 恒定成功，用于对照。
type settleOKFunding struct{}

func (f *settleOKFunding) Source() string         { return BillingSourceWallet }
func (f *settleOKFunding) PreConsume(int) error   { return nil }
func (f *settleOKFunding) Refund() error          { return nil }
func (f *settleOKFunding) Settle(delta int) error { return nil }

// newSettleTestContext 构造一个可直接交给 SettleBillingForLog 的最小请求上下文。
//
// 令牌账本调整通过 IsPlayground 旁路（结算单元不关心令牌额度），额度通知通过
// 高余额旁路，因此这两个用例不需要真实数据库。
func newSettleTestContext(t *testing.T, funding FundingSource, preConsumed int) (*gin.Context, *relaycommon.RelayInfo) {
	t.Helper()
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)

	relayInfo := &relaycommon.RelayInfo{
		UserId:       99001,
		TokenId:      0,
		IsPlayground: true,
		UserQuota:    100_000_000,
	}
	relayInfo.Billing = &BillingSession{
		relayInfo:        relayInfo,
		funding:          funding,
		preConsumedQuota: preConsumed,
	}
	relayInfo.FinalPreConsumedQuota = preConsumed
	return c, relayInfo
}

// 结算成功时日志记结算额本身，且不打 settle_error。
func TestSettleBillingForLogSuccessRecordsActualQuota(t *testing.T) {
	const preConsumed = 1000
	const actual = 5000
	c, relayInfo := newSettleTestContext(t, &settleOKFunding{}, preConsumed)

	logged, failed := SettleBillingForLog(c, relayInfo, actual)

	assert.False(t, failed)
	assert.Equal(t, actual, logged, "结算成功时日志记全额结算额")
}

// 核心回归：资金来源 Settle 失败时，日志额度必须收敛到已经落地的预扣额，
// 而不是结算前的全额。
//
// 全额（5000）写入日志会宣称「已扣 5000」，但用户余额只少了预扣的 1000——
// 「初始余额 − 最终余额 == logs.Quota」这条 P0 不变量被打破，账单出现虚假已扣。
func TestSettleBillingForLogFailureNeverLogsFullAmount(t *testing.T) {
	const preConsumed = 1000
	const actual = 5000
	c, relayInfo := newSettleTestContext(t, &settleFailingFunding{}, preConsumed)

	logged, failed := SettleBillingForLog(c, relayInfo, actual)

	require.True(t, failed, "资金来源 Settle 失败必须上报给调用方")
	assert.Equal(t, preConsumed, logged,
		"日志只能记已经落地的预扣额，绝不能是结算前的全额 %d", actual)
	assert.Less(t, logged, actual, "写入日志的额度必须小于未落地的全额")
}

// 结算失败必须在日志 other 上留 settle_error 标记，供对账方挑出人工核对。
func TestMarkSettleErrorFlagsTheLog(t *testing.T) {
	other := model.NewLogOther()

	markSettleError(other, false)
	assert.NotContains(t, other.JSONString(), LogOtherSettleErrorKey,
		"结算成功不得打结算失败标记")

	markSettleError(other, true)
	assert.Contains(t, other.JSONString(), LogOtherSettleErrorKey,
		"结算失败必须在用量日志上留 settle_error 标记")

	// nil other 不得 panic：结算失败发生在日志 other 构造完成之前时也会走这条路径。
	assert.NotPanics(t, func() { markSettleError(nil, true) })
}
