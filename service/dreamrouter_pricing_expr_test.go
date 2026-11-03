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
	"strings"
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

// TestDreamRouterDurationUnitPrices 锁定按秒计费视频模型的官方单价解析。
//
// 表达式取自上游 dreamrouter.ai /api/pricing 的真实记录（2026-11-03，
// wan3.0-video）：ternary 链按请求参数选分辨率档，每档单价 = 美元/秒 ×
// duration（缺省 5 秒）。兜底档（最后一支，720p）是上游定价页的默认档。
func TestDreamRouterDurationUnitPrices(t *testing.T) {
	const wan3Video = `has(lower(param("size")), "1080") || has(lower(param("metadata.size")), "1080") || lower(param("metadata.resolution")) == "1080p" || lower(param("parameters.resolution")) == "1080p" || has(lower(param("parameters.size")), "1080")
  ? tier("1080p", (duration > 0 ? duration : 5) * 0.1791045)
  : has(lower(param("size")), "480") || has(lower(param("metadata.size")), "480") || lower(param("metadata.resolution")) == "480p" || lower(param("parameters.resolution")) == "480p" || has(lower(param("parameters.size")), "480")
  ? tier("480p", (duration > 0 ? duration : 5) * 0.0447761)
  : tier("720p", (duration > 0 ? duration : 5) * 0.0895522)`

	prices, ok := dreamRouterDurationUnitPrices(wan3Video)
	if !ok {
		t.Fatal("duration unit prices not parsed")
	}
	// 基准价取兜底档（最后一支 = 720p），不是首档（1080p）。
	if !nearlyEqualSync(prices.Input, 0.0895522) {
		t.Errorf("input = %v, want 0.0895522 (fallback tier)", prices.Input)
	}
	if prices.Output != 0 || prices.Cache != 0 || prices.CreateCache != 0 {
		t.Errorf("video models have no output/cache pricing: %+v", prices)
	}

	// token 表达式没有 duration 计价项，解不出来。
	if _, ok := dreamRouterDurationUnitPrices(`tier("base", p * 5 + c * 30)`); ok {
		t.Error("token expression should not parse as duration-priced")
	}

	// 非 duration 的括号乘法不误中。
	if _, ok := dreamRouterDurationUnitPrices(`(tier("base", p * 2)) * (weekday("Asia/Shanghai") == 0 ? 0.5 : 1)`); ok {
		t.Error("time-discount parenthesis should not parse as duration-priced")
	}
}

// TestDreamRouterScaleExprDuration 验证按秒计费项随规则系数缩放，且缩放后
// 的表达式仍可编译、解出的单价正好等于官方单价 × 系数。
func TestDreamRouterScaleExprDuration(t *testing.T) {
	const wan3Video = `has(lower(param("size")), "1080")
  ? tier("1080p", (duration > 0 ? duration : 5) * 0.1791045)
  : tier("720p", (duration > 0 ? duration : 5) * 0.0895522)`

	scaled, ok := dreamRouterScaleExpr(wan3Video, 1.1)
	if !ok {
		t.Fatal("scale: ok = false")
	}
	for _, coef := range []string{"0.19701495", "0.09850742"} {
		if !strings.Contains(scaled, coef) {
			t.Errorf("scaled expression missing coefficient %s: %s", coef, scaled)
		}
	}
	// 原系数不得残留（否则重复同步会二次缩放）。
	if strings.Contains(scaled, "0.1791045") || strings.Contains(scaled, "0.0895522") {
		t.Errorf("scaled expression still contains original coefficients: %s", scaled)
	}
	if _, err := billingexpr.CompileFromCache(scaled); err != nil {
		t.Errorf("scaled expression does not compile: %v", err)
	}

	// 缩放后的单价 = 官方单价 × factor（对齐复核的数学定义）。
	official, _ := dreamRouterDurationUnitPrices(wan3Video)
	got, ok := dreamRouterDurationUnitPrices(scaled)
	if !ok {
		t.Fatal("scaled expression not duration-parsable")
	}
	if !nearlyEqualSync(got.Input, official.Input*1.1) {
		t.Errorf("input = %v, want %v", got.Input, official.Input*1.1)
	}
}

// TestDreamRouterComputeTargetDurationVideo 锁定 wan3.0-video 的同步目标计算：
// 从「tiered_unparsable 跳过」变为「tiered + 缩放表达式落库」。
func TestDreamRouterComputeTargetDurationVideo(t *testing.T) {
	const wan3Video = `has(lower(param("size")), "1080") || lower(param("metadata.resolution")) == "1080p"
  ? tier("1080p", (duration > 0 ? duration : 5) * 0.1791045)
  : tier("720p", (duration > 0 ? duration : 5) * 0.0895522)`
	rec := dreamRouterRecord{
		ModelName:       "wan3.0-video",
		QuotaType:       0,
		ModelRatio:      37.5,
		CompletionRatio: 1,
		EnableGroups:    []string{"wan3"},
		BillingMode:     "tiered_expr",
		BillingExpr:     wan3Video,
	}
	change := dreamRouterComputeTarget(rec, 0.9, 1.0)
	if change.BillingClass != "tiered" {
		t.Fatalf("billing class = %q, want tiered", change.BillingClass)
	}
	if !nearlyEqualSync(change.Official.Input, 0.0895522) {
		t.Errorf("official input = %v, want 0.0895522", change.Official.Input)
	}
	if !nearlyEqualSync(change.NewModelRatio, 37.5) {
		t.Errorf("model ratio = %v, want 37.5 (upstream nominal × factor)", change.NewModelRatio)
	}
	if change.NewBillingExpr == "" {
		t.Fatal("NewBillingExpr is empty")
	}
	if _, ok := dreamRouterDurationUnitPrices(change.NewBillingExpr); !ok {
		t.Errorf("NewBillingExpr not duration-parsable: %s", change.NewBillingExpr)
	}
	// Upstream 行 = 官方价 × 上游组折扣。
	if !nearlyEqualSync(change.Upstream.Input, 0.0895522*0.9) {
		t.Errorf("upstream input = %v, want %v", change.Upstream.Input, 0.0895522*0.9)
	}

	// 既没有 token 系数也没有 duration 计价项 → 仍然 tiered_unparsable。
	change = dreamRouterComputeTarget(dreamRouterRecord{
		ModelName:   "mystery",
		BillingExpr: `tier("base", fixed(0.02))`,
	}, 0.9, 1.0)
	if change.BillingClass != "tiered_unparsable" {
		t.Errorf("billing class = %q, want tiered_unparsable", change.BillingClass)
	}
}
