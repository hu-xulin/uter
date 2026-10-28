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

You should have received a copy of the GNU Affero General License
along with this program. Not found? See <https://www.gnu.org/licenses/>.
*/

package controller

import (
	"testing"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
)

// TestProviderExpectedMinorUnitsPrefersSnapshot 锁死「回调比对基准是下单快照」。
//
// 支付宝 / 微信两条链路的回调金额校验都必须以 ProviderAmount（分）为准，
// 只有存量订单（快照为空）才回退到由 Money（元）换算。若某天有人把某一侧
// 改回「现场用 Money 再换算一次」，两套口径就会在取整规则变化时分叉：
// 网关按 A 扣款、本地判 B 不匹配，回调永久失败，用户付了钱拿不到额度。
func TestProviderExpectedMinorUnitsPrefersSnapshot(t *testing.T) {
	tests := []struct {
		name           string
		providerAmount int64
		money          float64
		want           int64
	}{
		{name: "snapshot wins over money", providerAmount: 688, money: 6.88, want: 688},
		{name: "snapshot wins even when money drifted", providerAmount: 688, money: 6.89, want: 688},
		{name: "legacy order falls back to money", providerAmount: 0, money: 6.88, want: 688},
		{name: "legacy order with one cent", providerAmount: 0, money: 0.01, want: 1},
		{name: "zero order yields zero", providerAmount: 0, money: 0, want: 0},
		{name: "large order keeps integer cents", providerAmount: 0, money: 12345.67, want: 1234567},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, providerExpectedMinorUnits(tc.providerAmount, tc.money))
		})
	}
}

// TestAlipayPaidAmountMatchesOrder 锁死支付宝回调的金额校验：
// 与下单快照差一分即拒绝，少付/零/负数一律拒绝，浮点尾数不误伤合法回调。
func TestAlipayPaidAmountMatchesOrder(t *testing.T) {
	tests := []struct {
		name           string
		paid           string
		providerAmount int64
		money          float64
		want           bool
	}{
		{name: "exact match against snapshot", paid: "6.88", providerAmount: 688, money: 6.88, want: true},
		{name: "trailing zero tolerated", paid: "6.880", providerAmount: 688, money: 6.88, want: true},
		{name: "float tail does not break the match", paid: "6.88", providerAmount: 0, money: 6.880000000000001, want: true},
		{name: "one cent underpaid rejected", paid: "6.87", providerAmount: 688, money: 6.88, want: false},
		{name: "one cent overpaid rejected", paid: "6.89", providerAmount: 688, money: 6.88, want: false},
		{name: "classic one cent exploit rejected", paid: "0.01", providerAmount: 688, money: 6.88, want: false},
		{name: "zero rejected", paid: "0", providerAmount: 688, money: 6.88, want: false},
		{name: "negative rejected", paid: "-6.88", providerAmount: 688, money: 6.88, want: false},
		{name: "order without any amount snapshot rejected", paid: "0", providerAmount: 0, money: 0, want: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			paid, err := decimal.NewFromString(tc.paid)
			assert.NoError(t, err)
			assert.Equal(t, tc.want, alipayPaidAmountMatchesOrder(paid, tc.providerAmount, tc.money))
		})
	}
}
