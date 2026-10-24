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
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
)

/*
 * F-17：每个支付渠道的**订单状态矩阵**。
 *
 * 报告要求「为每个渠道建立订单状态矩阵，每个状态都应有明确的自动恢复、重试或
 * 人工处理路径」。这里把「矩阵」落成可执行断言：对 7 个渠道 × 4 种初始状态
 * （pending / success / failed / expired）+ 1 种跨渠道订单，逐个跑真实入账函数，
 * 断言「该入账的一次、不该入账的零次」。
 *
 * 之所以按渠道展开而不是只测一个渠道：入账函数虽然共用 creditTopUpQuota，
 * 但状态判定、额度来源（Amount vs Money）和幂等分支都是各自实现的。某个渠道
 * 通过不代表另一个渠道安全。
 */

type rechargeChannel struct {
	name     string
	provider string
	// quotaPerOrder 是该渠道「Amount=2 / Money=10」的订单应入账的额度，
	// 用来同时锁住「额度取自哪个字段」这一契约。
	quotaPerOrder int
	recharge      func(tradeNo string) error
}

func rechargeChannels() []rechargeChannel {
	return []rechargeChannel{
		{
			name:     "epay",
			provider: PaymentProviderEpay,
			// Amount(2) * QuotaPerUnit(500000)
			quotaPerOrder: 1000000,
			recharge: func(tradeNo string) error {
				_, err := RechargeEpay(tradeNo, "alipay", "127.0.0.1")
				return err
			},
		},
		{
			name:          "alipay",
			provider:      PaymentProviderAlipay,
			quotaPerOrder: 1000000,
			recharge: func(tradeNo string) error {
				_, err := RechargeAlipay(tradeNo, "alipay", "127.0.0.1")
				return err
			},
		},
		{
			name:          "wechat",
			provider:      PaymentProviderWechatPay,
			quotaPerOrder: 1000000,
			recharge: func(tradeNo string) error {
				_, err := RechargeWechatPay(tradeNo, "wxpay", "127.0.0.1")
				return err
			},
		},
		{
			name:     "stripe",
			provider: PaymentProviderStripe,
			// Stripe 的额度取自 Money(10) 而不是 Amount：Money 已经过分组倍率换算。
			quotaPerOrder: 5000000,
			recharge: func(tradeNo string) error {
				return Recharge(tradeNo, "cus_test", "127.0.0.1")
			},
		},
		{
			name:     "creem",
			provider: PaymentProviderCreem,
			// Creem 直接把 Amount 当作额度（整数，不再乘 QuotaPerUnit）。
			quotaPerOrder: 2,
			recharge: func(tradeNo string) error {
				return RechargeCreem(tradeNo, "", "", "127.0.0.1")
			},
		},
		{
			name:          "waffo",
			provider:      PaymentProviderWaffo,
			quotaPerOrder: 1000000,
			recharge: func(tradeNo string) error {
				return RechargeWaffo(tradeNo, "127.0.0.1")
			},
		},
		{
			name:          "waffo-pancake",
			provider:      PaymentProviderWaffoPancake,
			quotaPerOrder: 1000000,
			recharge: func(tradeNo string) error {
				return RechargeWaffoPancake(tradeNo)
			},
		},
	}
}

func createMatrixTestOrder(t *testing.T, userId int, tradeNo string, provider string, status string) {
	t.Helper()
	order := &TopUp{
		UserId:          userId,
		Amount:          2,
		Money:           10,
		TradeNo:         tradeNo,
		PaymentMethod:   "test",
		PaymentProvider: provider,
		CreateTime:      common.GetTimestamp(),
		Status:          status,
	}
	require.NoError(t, DB.Create(order).Error)
}

func TestTopUpOrderStateMatrix(t *testing.T) {
	truncateTables(t)
	useFixedQuotaPerUnitForOfficialTest(t, 500000)

	userSeq := 900
	for _, channel := range rechargeChannels() {
		channel := channel
		t.Run(channel.name, func(t *testing.T) {
			// 每个渠道一个独立用户，避免额度断言互相干扰。
			userSeq++
			user := createOfficialTestUser(t, userSeq, 0, fmt.Sprintf("mtx%s", channel.name))
			quota := func() int { return getUserQuotaForPaymentGuardTest(t, user.Id) }

			t.Run("pending is credited exactly once", func(t *testing.T) {
				tradeNo := "MTX-" + channel.name + "-PENDING"
				createMatrixTestOrder(t, user.Id, tradeNo, channel.provider, common.TopUpStatusPending)

				require.NoError(t, channel.recharge(tradeNo))
				assert.Equal(t, channel.quotaPerOrder, quota(), "pending 订单应按该渠道的额度来源入账")

				reloaded := GetTopUpByTradeNo(tradeNo)
				require.NotNil(t, reloaded)
				assert.Equal(t, common.TopUpStatusSuccess, reloaded.Status)

				// 重复回调（供应商重试）：不得二次入账。
				require.NoError(t, channel.recharge(tradeNo))
				assert.Equal(t, channel.quotaPerOrder, quota(), "重复回调不得二次入账")
			})

			t.Run("failed is not resurrected", func(t *testing.T) {
				tradeNo := "MTX-" + channel.name + "-FAILED"
				createMatrixTestOrder(t, user.Id, tradeNo, channel.provider, common.TopUpStatusFailed)
				before := quota()

				require.Error(t, channel.recharge(tradeNo), "已失败订单不得被回调复活")
				assert.Equal(t, before, quota())

				reloaded := GetTopUpByTradeNo(tradeNo)
				require.NotNil(t, reloaded)
				assert.Equal(t, common.TopUpStatusFailed, reloaded.Status, "失败状态不得被改写")
			})

			t.Run("expired is not resurrected", func(t *testing.T) {
				tradeNo := "MTX-" + channel.name + "-EXPIRED"
				createMatrixTestOrder(t, user.Id, tradeNo, channel.provider, common.TopUpStatusExpired)
				before := quota()

				require.Error(t, channel.recharge(tradeNo), "已过期订单不得被回调复活")
				assert.Equal(t, before, quota())
			})

			t.Run("cross channel order is rejected", func(t *testing.T) {
				tradeNo := "MTX-" + channel.name + "-CROSS"
				// 订单属于另一个渠道：回调不得跨渠道入账。
				otherProvider := PaymentProviderEpay
				if channel.provider == PaymentProviderEpay {
					otherProvider = PaymentProviderStripe
				}
				createMatrixTestOrder(t, user.Id, tradeNo, otherProvider, common.TopUpStatusPending)
				before := quota()

				require.Error(t, channel.recharge(tradeNo), "跨渠道订单必须被拒绝")
				assert.Equal(t, before, quota())

				reloaded := GetTopUpByTradeNo(tradeNo)
				require.NotNil(t, reloaded)
				assert.Equal(t, common.TopUpStatusPending, reloaded.Status, "被拒的订单必须保持 pending")
			})

			t.Run("unknown order is rejected", func(t *testing.T) {
				before := quota()
				require.Error(t, channel.recharge("MTX-"+channel.name+"-MISSING"))
				assert.Equal(t, before, quota())
			})
		})
	}
}
