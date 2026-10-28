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
	"testing"

	"github.com/uter-ai/uter/pkg/billingexpr"
)

// TestDreamRouterScaleExpr 锁定「表达式系数 × 价格规则系数」的改写结果。
//
// 这是分层计费模型价格同步的核心：模型的实际售价由 billing_expr 决定，
// 只写 ModelRatio 不会改变计价，卡片上的「优特」与「官方」两行会永远相同。
func TestDreamRouterScaleExpr(t *testing.T) {
	cases := []struct {
		name   string
		expr   string
		factor float64
		want   string
		ok     bool
	}{
		{
			name:   "单层按量",
			expr:   `tier("base", p * 5 + c * 30 + cr * 0.5)`,
			factor: 0.7,
			want:   `tier("base", p * 3.5 + c * 21 + cr * 0.35)`,
			ok:     true,
		},
		{
			name:   "分层阈值不动、两层一起缩放",
			expr:   `len <= 272000 ? tier("standard", p * 10 + c * 50) : tier("long_context", p * 20 + c * 75)`,
			factor: 0.7,
			want:   `len <= 272000 ? tier("standard", p * 7 + c * 35) : tier("long_context", p * 14 + c * 52.5)`,
			ok:     true,
		},
		{
			name:   "时段折扣的裸系数保持原样",
			expr:   `(tier("base", p * 0.3 + c * 1.2)) * (weekday("Asia/Shanghai") == 0 ? 0.5 : 1)`,
			factor: 0.7,
			want:   `(tier("base", p * 0.21 + c * 0.84)) * (weekday("Asia/Shanghai") == 0 ? 0.5 : 1)`,
			ok:     true,
		},
		{
			name:   "带数字的标识符整体保留",
			expr:   `tier("base", p * 2 + cc1h * 6 + img_o * 30)`,
			factor: 0.5,
			want:   `tier("base", p * 1 + cc1h * 3 + img_o * 15)`,
			ok:     true,
		},
		{
			name:   "小系数不写成指数形式",
			expr:   `tier("base", cr * 0.00002)`,
			factor: 0.5,
			want:   `tier("base", cr * 0.00001)`,
			ok:     true,
		},
		{
			name:   "没有计价项时拒绝改写",
			expr:   `tier("base", fixed(0.02))`,
			factor: 0.7,
			ok:     false,
		},
		{
			name:   "空表达式拒绝改写",
			expr:   "   ",
			factor: 0.7,
			ok:     false,
		},
		{
			name:   "非正系数拒绝改写",
			expr:   `tier("base", p * 2)`,
			factor: 0,
			ok:     false,
		},
	}

	for _, c := range cases {
		got, ok := dreamRouterScaleExpr(c.expr, c.factor)
		if ok != c.ok {
			t.Errorf("%s: ok = %v, want %v（got %q）", c.name, ok, c.ok, got)
			continue
		}
		if !c.ok {
			continue
		}
		if got != c.want {
			t.Errorf("%s:\n got  %s\n want %s", c.name, got, c.want)
		}
	}
}

// TestDreamRouterScaledExprCompiles 确保改写后的表达式仍然可编译。
//
// 缩放是纯文本替换，一旦产出语法上不成立的表达式，写库后该模型会在计费
// 时抛错——这比价格不对齐更严重，所以每条真实形态的表达式都要过一遍编译。
func TestDreamRouterScaledExprCompiles(t *testing.T) {
	exprs := []string{
		`tier("base", p * 5 + c * 30 + cr * 0.5)`,
		`len <= 272000 ? tier("standard", p * 10 + c * 50 + cr * 1 + cc * 12.5) : tier("long_context", p * 20 + c * 75 + cr * 2 + cc * 25)`,
		`(tier("base", p * 0.3 + c * 1.2 + cr * 0.02)) * (weekday("Asia/Shanghai") == 0 ? 0.5 : 1)`,
		`tier("base", p * 5 + c * 0 + cr * 1.25 + img * 8 + img_o * 30)`,
		`tier("base", p * 0.5 + c * 0.75 + cr * 0.5 + cc * 0.75 + img_o * 120)`,
	}
	for _, expr := range exprs {
		scaled, ok := dreamRouterScaleExpr(expr, 0.7)
		if !ok {
			t.Fatalf("scale %q: ok = false", expr)
		}
		if _, err := billingexpr.CompileFromCache(scaled); err != nil {
			t.Errorf("scaled expression does not compile: %q: %v", scaled, err)
		}
	}
}

// TestDreamRouterScaledExprKeepsUnitPriceRatio 验证缩放后的单价正好等于
// 官方单价 × 系数——这是「与上游完全对齐」的数学定义。
func TestDreamRouterScaledExprKeepsUnitPriceRatio(t *testing.T) {
	expr := `len <= 200000 ? tier("standard", p * 1.25 + c * 10 + cr * 0.13) : tier("long_context", p * 2.5 + c * 15 + cr * 0.25)`
	official, ok := dreamRouterOfficialUnitPrices(expr)
	if !ok {
		t.Fatal("official unit prices not parsed")
	}
	for _, factor := range []float64{0.7, 0.55, 1.0} {
		scaled, ok := dreamRouterScaleExpr(expr, factor)
		if !ok {
			t.Fatalf("scale factor %v: ok = false", factor)
		}
		got, ok := dreamRouterOfficialUnitPrices(scaled)
		if !ok {
			t.Fatalf("factor %v: scaled unit prices not parsed", factor)
		}
		for _, pair := range []struct {
			field     string
			want, got float64
		}{
			{"input", official.Input * factor, got.Input},
			{"output", official.Output * factor, got.Output},
			{"cache", official.Cache * factor, got.Cache},
		} {
			if !nearlyEqualSync(pair.got, pair.want) {
				t.Errorf("factor %v %s: got %v, want %v", factor, pair.field, pair.got, pair.want)
			}
		}
	}
}
