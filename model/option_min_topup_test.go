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
	"testing"

	"github.com/uter-ai/uter/setting/operation_setting"
)

// TestUpdateOptionMapMinTopUpAppliesCents 守住「最低充值允许两位小数」这条链路。
//
// 真实故障（2026-10-28）：运营在「支付网关」把最低充值填成 0.01，保存成功、
// 库里也是 0.01，但 /api/user/topup/info 一直下发 min_topup=0，钱包页因此
// 不设下限。根因是内存回填那一步按整数解析，小数被丢成 0 —— 库与内存分叉，
// 页面读的是内存。
//
// 这里直接打 updateOptionMap（内存回填的唯一入口，启动加载与运行时更新都走它），
// 不依赖数据库，因此能在没有 options 表的测试库里跑。
func TestUpdateOptionMapMinTopUpAppliesCents(t *testing.T) {
	previous := operation_setting.MinTopUp
	t.Cleanup(func() { operation_setting.MinTopUp = previous })

	cases := []struct {
		value string
		want  float64
	}{
		{value: "0.01", want: 0.01},
		{value: "0.5", want: 0.5},
		{value: "1", want: 1},
		{value: "2.35", want: 2.35},
	}
	for _, tc := range cases {
		t.Run(tc.value, func(t *testing.T) {
			operation_setting.MinTopUp = 0
			if err := updateOptionMap("MinTopUp", tc.value); err != nil {
				t.Fatalf("updateOptionMap(MinTopUp, %q) error: %v", tc.value, err)
			}
			if got := operation_setting.MinTopUp; got != tc.want {
				t.Fatalf("MinTopUp = %v, want %v", got, tc.want)
			}
		})
	}
}

// TestValidateMinTopUpRejectsSubCent 确保超过两位小数的配置在保存前被拒绝，
// 而不是静默四舍五入——金额精度一旦被悄悄改动，用户看到的价与实际扣款就永久对不上。
func TestValidateMinTopUpRejectsSubCent(t *testing.T) {
	if err := validateOptionValue("MinTopUp", "0.001"); err == nil {
		t.Fatal("expected 0.001 to be rejected, got nil")
	}
	if err := validateOptionValue("MinTopUp", "0.01"); err != nil {
		t.Fatalf("0.01 should be accepted, got %v", err)
	}
	if err := validateOptionValue("MinTopUp", "-1"); err == nil {
		t.Fatal("expected negative amount to be rejected, got nil")
	}
}
