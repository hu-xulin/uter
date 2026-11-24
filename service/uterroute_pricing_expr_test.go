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
	"github.com/uter-ai/uter/pkg/jsplugin"

	_ "github.com/uter-ai/uter/plugins"
)

// TestUterRouteScaleExpr 锁定「表达式系数 × 价格规则系数」的改写结果。
//
// 这是分层计费模型价格同步的核心：模型的实际售价由 billing_expr 决定，
// 只写 ModelRatio 不会改变计价，卡片上的「优特」与「官方」两行会永远相同。
func TestUterRouteScaleExpr(t *testing.T) {
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
		got, ok := uterRouteScaleExpr(c.expr, c.factor)
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

// TestUterRouteScaledExprCompiles 确保改写后的表达式仍然可编译。
//
// 缩放是纯文本替换，一旦产出语法上不成立的表达式，写库后该模型会在计费
// 时抛错——这比价格不对齐更严重，所以每条真实形态的表达式都要过一遍编译。
func TestUterRouteScaledExprCompiles(t *testing.T) {
	exprs := []string{
		`tier("base", p * 5 + c * 30 + cr * 0.5)`,
		`len <= 272000 ? tier("standard", p * 10 + c * 50 + cr * 1 + cc * 12.5) : tier("long_context", p * 20 + c * 75 + cr * 2 + cc * 25)`,
		`(tier("base", p * 0.3 + c * 1.2 + cr * 0.02)) * (weekday("Asia/Shanghai") == 0 ? 0.5 : 1)`,
		`tier("base", p * 5 + c * 0 + cr * 1.25 + img * 8 + img_o * 30)`,
		`tier("base", p * 0.5 + c * 0.75 + cr * 0.5 + cc * 0.75 + img_o * 120)`,
	}
	for _, expr := range exprs {
		scaled, ok := uterRouteScaleExpr(expr, 0.7)
		if !ok {
			t.Fatalf("scale %q: ok = false", expr)
		}
		if _, err := billingexpr.CompileFromCache(scaled); err != nil {
			t.Errorf("scaled expression does not compile: %q: %v", scaled, err)
		}
	}
}

// TestUterRouteScaledExprKeepsUnitPriceRatio 验证缩放后的单价正好等于
// 官方单价 × 系数——这是「与上游完全对齐」的数学定义。
func TestUterRouteOfficialUnitPricesPreservesExplicitZeroOutput(t *testing.T) {
	units, ok := uterRouteOfficialUnitPrices(`tier("base", p * 5 + c * 0 + cr * 1.25 + img * 8 + img_o * 30)`)
	if !ok {
		t.Fatal("official unit prices not parsed")
	}
	if !units.OutputPresent {
		t.Fatal("explicit c * 0 must preserve the output dimension")
	}
	if units.Output != 0 {
		t.Fatalf("output = %v, want 0", units.Output)
	}
	if !units.CachePresent || units.Cache != 1.25 {
		t.Fatalf("cache present/value = %v/%v, want true/1.25", units.CachePresent, units.Cache)
	}
}

func TestUterRouteScaledExprKeepsUnitPriceRatio(t *testing.T) {
	expr := `len <= 200000 ? tier("standard", p * 1.25 + c * 10 + cr * 0.13) : tier("long_context", p * 2.5 + c * 15 + cr * 0.25)`
	official, ok := uterRouteOfficialUnitPrices(expr)
	if !ok {
		t.Fatal("official unit prices not parsed")
	}
	for _, factor := range []float64{0.7, 0.55, 1.0} {
		scaled, ok := uterRouteScaleExpr(expr, factor)
		if !ok {
			t.Fatalf("scale factor %v: ok = false", factor)
		}
		got, ok := uterRouteOfficialUnitPrices(scaled)
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

// TestUterRouteDurationUnitPrices 锁定按秒计费视频模型的官方单价解析。
//
// 表达式取自上游 /api/pricing 的真实记录（2026-11-03，
// wan3.0-video）：ternary 链按请求参数选分辨率档，每档单价 = 美元/秒 ×
// duration（缺省 5 秒）。兜底档（最后一支，720p）是上游定价页的默认档。
func TestUterRouteDurationUnitPrices(t *testing.T) {
	const wan3Video = `has(lower(param("size")), "1080") || has(lower(param("metadata.size")), "1080") || lower(param("metadata.resolution")) == "1080p" || lower(param("parameters.resolution")) == "1080p" || has(lower(param("parameters.size")), "1080")
  ? tier("1080p", (duration > 0 ? duration : 5) * 0.1791045)
  : has(lower(param("size")), "480") || has(lower(param("metadata.size")), "480") || lower(param("metadata.resolution")) == "480p" || lower(param("parameters.resolution")) == "480p" || has(lower(param("parameters.size")), "480")
  ? tier("480p", (duration > 0 ? duration : 5) * 0.0447761)
  : tier("720p", (duration > 0 ? duration : 5) * 0.0895522)`

	prices, ok := uterRouteDurationUnitPrices(wan3Video)
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

	// 2026-11 起上游省略了 duration 的括号（MiniMax-H3 真实记录），裸
	// `duration * <单价>` 必须解析出兜底档，不能再次被判为无价格。
	const miniMaxH3 = `has(lower(param("metadata.parameters.resolution")), "2k") || has(lower(param("metadata.resolution")), "2k")
  ? tier("2k", duration * 0.1194029851)
  : tier("768p", duration * 0.0746268657)`
	barePrices, ok := uterRouteDurationUnitPrices(miniMaxH3)
	if !ok {
		t.Fatal("bare duration term not parsed")
	}
	if !nearlyEqualSync(barePrices.Input, 0.0746268657) {
		t.Errorf("bare duration input = %v, want 0.0746268657", barePrices.Input)
	}

	// token 表达式没有 duration 计价项，解不出来。
	if _, ok := uterRouteDurationUnitPrices(`tier("base", p * 5 + c * 30)`); ok {
		t.Error("token expression should not parse as duration-priced")
	}

	// 非 duration 的括号乘法不误中。
	if _, ok := uterRouteDurationUnitPrices(`(tier("base", p * 2)) * (weekday("Asia/Shanghai") == 0 ? 0.5 : 1)`); ok {
		t.Error("time-discount parenthesis should not parse as duration-priced")
	}
}

// TestUterRouteScaleExprDuration 验证按秒计费项随规则系数缩放，且缩放后
// 的表达式仍可编译、解出的单价正好等于官方单价 × 系数。
func TestUterRouteScaleExprDuration(t *testing.T) {
	const wan3Video = `has(lower(param("size")), "1080")
  ? tier("1080p", (duration > 0 ? duration : 5) * 0.1791045)
  : tier("720p", (duration > 0 ? duration : 5) * 0.0895522)`

	scaled, ok := uterRouteScaleExpr(wan3Video, 1.1)
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
	official, _ := uterRouteDurationUnitPrices(wan3Video)
	got, ok := uterRouteDurationUnitPrices(scaled)
	if !ok {
		t.Fatal("scaled expression not duration-parsable")
	}
	if !nearlyEqualSync(got.Input, official.Input*1.1) {
		t.Errorf("input = %v, want %v", got.Input, official.Input*1.1)
	}

	// 裸 duration 形式也要缩放，否则同步规则对 MiniMax-H3 无效。
	const bareVideo = `tier("2k", duration * 0.1194029851)`
	scaledBare, ok := uterRouteScaleExpr(bareVideo, 2)
	if !ok {
		t.Fatal("bare scale: ok = false")
	}
	if !strings.Contains(scaledBare, "0.2388059702") {
		t.Errorf("bare scaled expression missing doubled coefficient: %s", scaledBare)
	}
	if _, err := billingexpr.CompileFromCache(scaledBare); err != nil {
		t.Errorf("bare scaled expression does not compile: %v", err)
	}
}

// ---------------------------------------------------------------------------
// 请求探测改写（任务表达式）
// ---------------------------------------------------------------------------

// wan3VideoProbeExpr 是上游 wan3.0-video 的真实表达式形态：按请求参数
// （size / metadata.size / *.resolution）选分辨率档，每档 `(duration > 0 ?
// duration : 5) * 美元每秒`。
const wan3VideoProbeExpr = `has(lower(param("size")), "1080") || has(lower(param("metadata.size")), "1080") || lower(param("metadata.resolution")) == "1080p" || lower(param("parameters.resolution")) == "1080p" || has(lower(param("parameters.size")), "1080")
  ? tier("1080p", (duration > 0 ? duration : 5) * 0.12537315)
  : has(lower(param("size")), "480") || has(lower(param("metadata.size")), "480") || lower(param("metadata.resolution")) == "480p" || lower(param("parameters.resolution")) == "480p" || has(lower(param("parameters.size")), "480")
  ? tier("480p", (duration > 0 ? duration : 5) * 0.03134327)
  : tier("720p", (duration > 0 ? duration : 5) * 0.06268654)`

// wan3VideoUsageSchema 是 alibaba 插件为 wan3.0-video 声明的用量事实。
func wan3VideoUsageSchema() map[string]jsplugin.UsageFieldSchema {
	return map[string]jsplugin.UsageFieldSchema{
		"seconds":    {Type: "number", Unit: "second"},
		"resolution": {Enum: []string{"480P", "720P", "1080P"}},
	}
}

// TestUterRouteTaskProbeRewrite 锁定「请求参数选档 → 用量事实选档」的改写。
//
// 为什么必须改：任务结算只把用量事实传给表达式（relay_task / task_polling
// 都只传 Usage），`param()` 恒为 nil。上游表达式原样落库的结果是每个请求
// 都命中兜底档——1080P 按 720p 收钱，不报错、也不体现在任何告警里。
func TestUterRouteTaskProbeRewrite(t *testing.T) {
	schema := wan3VideoUsageSchema()
	rewritten, ok := uterRouteTaskProbeRewrite(wan3VideoProbeExpr, schema)
	if !ok {
		t.Fatal("rewrite failed on the wan3.0-video expression")
	}
	if strings.Contains(rewritten, "param(") {
		t.Errorf("rewritten expression still probes the request: %s", rewritten)
	}
	if !strings.Contains(rewritten, `u("resolution") == "1080P"`) {
		t.Errorf("1080P tier condition was not rewritten: %s", rewritten)
	}
	if !strings.Contains(rewritten, `u("resolution") == "480P"`) {
		t.Errorf("480P tier condition was not rewritten: %s", rewritten)
	}
	// 兜底档不带条件，必须原样保留（它是默认分辨率档）。
	if !strings.Contains(rewritten, `tier("720p"`) {
		t.Errorf("fallback tier was dropped: %s", rewritten)
	}

	cases := []struct {
		name     string
		usage    map[string]any
		wantCost float64
		wantTier string
	}{
		{"1080P ten seconds", map[string]any{"seconds": float64(10), "resolution": "1080P"}, 1.2537315, "1080p"},
		{"480P ten seconds", map[string]any{"seconds": float64(10), "resolution": "480P"}, 0.3134327, "480p"},
		{"720P ten seconds", map[string]any{"seconds": float64(10), "resolution": "720P"}, 0.6268654, "720p"},
		// 没有分辨率事实时落到兜底档（与上游「什么都没给就是默认档」一致）。
		{"no resolution fact", map[string]any{"seconds": float64(10)}, 0.6268654, "720p"},
	}
	for _, tc := range cases {
		cost, trace, err := billingexpr.RunExprWithRequest(rewritten, billingexpr.TokenParams{}, billingexpr.RequestInputForUsage(tc.usage))
		if err != nil {
			t.Fatalf("%s: run failed: %v", tc.name, err)
		}
		if trace.MatchedTier != tc.wantTier {
			t.Errorf("%s: tier = %q, want %q", tc.name, trace.MatchedTier, tc.wantTier)
		}
		if !nearlyEqualSync(cost, tc.wantCost) {
			t.Errorf("%s: cost = %v, want %v", tc.name, cost, tc.wantCost)
		}
	}

	// 上游原样表达式现在也能从任务用量事实里读到分辨率（param() 回退到
	// RequestInput.Usage），因此高分辨率不再被按默认档少收。
	original, trace, err := billingexpr.RunExprWithRequest(wan3VideoProbeExpr, billingexpr.TokenParams{}, billingexpr.RequestInputForUsage(cases[0].usage))
	if err != nil {
		t.Fatalf("original expression should still run: %v", err)
	}
	if trace.MatchedTier != "1080p" || !nearlyEqualSync(original, 1.2537315) {
		t.Fatalf("usage-fact fallback regressed: original gives cost=%v tier=%q", original, trace.MatchedTier)
	}
}

// TestUterRouteTaskProbeRewriteRejectsAmbiguous 锁定「证据不唯一就不改写」。
//
// 这些情况都会让改写结果无法确定档位，或者改写后引用了运行时拿不到的字段。
// 一律返回 ok=false，由调用方放弃写这条表达式——宁可本轮不改价，也不能写
// 一条会把请求判错档的表达式。
func TestUterRouteTaskProbeRewriteRejectsAmbiguous(t *testing.T) {
	schema := wan3VideoUsageSchema()

	cases := []struct {
		name string
		expr string
	}{
		{
			// header 探测在任务结算里同样拿不到，无法用枚举事实等价表达。
			name: "header probe",
			expr: `header("X-Resolution") == "1080P" ? tier("1080p", (duration > 0 ? duration : 5) * 0.1) : tier("720p", (duration > 0 ? duration : 5) * 0.05)`,
		},
		{
			// 条件里的字面量指向不同枚举值，无法判断该映射到哪一档。
			name: "conflicting literals",
			expr: `lower(param("resolution")) == "1080p" && lower(param("size")) == "720p" ? tier("a", duration * 0.1) : tier("b", duration * 0.05)`,
		},
		{
			// 两个档位映射到同一个枚举值，兜底档位永远不可达。
			name: "duplicate tier mapping",
			expr: `lower(param("resolution")) == "1080p" ? tier("1080p", duration * 0.1) : (lower(param("size")) == "1080P" ? tier("x", duration * 0.1) : tier("720p", duration * 0.05))`,
		},
		{
			// 字面量对不上任何枚举值（例如上游用了一个插件没声明的档位名）。
			name: "unknown enum value",
			expr: `lower(param("resolution")) == "4k" ? tier("4k", duration * 0.4) : tier("720p", duration * 0.05)`,
		},
	}
	for _, tc := range cases {
		if rewritten, ok := uterRouteTaskProbeRewrite(tc.expr, schema); ok {
			t.Errorf("%s: rewrite should have failed, got %s", tc.name, rewritten)
		}
	}

	// 没有 schema 就无法判断枚举值，同样不改写。
	if _, ok := uterRouteTaskProbeRewrite(wan3VideoProbeExpr, nil); ok {
		t.Error("rewrite without a usage schema should fail")
	}
}

// TestUterRouteTaskProbeRewriteKeepsFactExpressions 锁定「已经是用量事实
// 形态的表达式不被无谓改动」。
func TestUterRouteTaskProbeRewriteKeepsFactExpressions(t *testing.T) {
	const factExpr = `u("resolution") == "1080P" ? tier("1080p", (duration > 0 ? duration : 5) * 0.12537315) : tier("720p", (duration > 0 ? duration : 5) * 0.06268654)`
	rewritten, ok := uterRouteTaskProbeRewrite(factExpr, wan3VideoUsageSchema())
	if !ok {
		t.Fatal("fact-shaped expression should pass through")
	}
	if rewritten != factExpr {
		t.Errorf("fact-shaped expression was modified:\n got %s\nwant %s", rewritten, factExpr)
	}

	// token 表达式没有任何探测条件，也不该被拒绝。
	const tokenExpr = `tier("base", p * 0.4 + cr * 0.08 + cc * 0.5 + c * 1.2)`
	rewritten, ok = uterRouteTaskProbeRewrite(tokenExpr, wan3VideoUsageSchema())
	if !ok || rewritten != tokenExpr {
		t.Errorf("token expression should pass through unchanged, got (%q, %v)", rewritten, ok)
	}
}

// TestUterRouteTaskProbeRewriteKeepsVersionPrefix 锁定 `v1:` 版本前缀在
// 改写后仍然保留：丢了前缀，表达式会被按默认版本解释，计费口径整个变化。
func TestUterRouteTaskProbeRewriteKeepsVersionPrefix(t *testing.T) {
	rewritten, ok := uterRouteTaskProbeRewrite("v1:"+wan3VideoProbeExpr, wan3VideoUsageSchema())
	if !ok {
		t.Fatal("rewrite failed on a version-prefixed expression")
	}
	if !strings.HasPrefix(rewritten, "v1:") {
		t.Errorf("version prefix was dropped: %s", rewritten)
	}
	if strings.Contains(rewritten, "param(") {
		t.Errorf("rewritten expression still probes the request: %s", rewritten)
	}
	if _, err := billingexpr.CompileFromCache(rewritten); err != nil {
		t.Errorf("rewritten expression does not compile: %v", err)
	}
}

// ---------------------------------------------------------------------------
// 适配分派：只有任务插件模型才改写
// ---------------------------------------------------------------------------

// chatProbeExpr 是聊天模型常见的按请求参数计价形态。它与任务表达式的
// 区别不在写法，而在**运行时能不能求值**：聊天结算会把请求 Body 一起
// 传给表达式（relay/helper + tiered_settle 都走 BillingRequestInput），
// `param()` 有值。
const chatProbeExpr = `param("enable_thinking") == true ? tier("thinking", input * 3 + output * 15) : tier("standard", input * 1 + output * 8)`

// TestUterRouteAdaptTaskExprLeavesChatModelsAlone 锁定「改写只针对任务
// 插件模型」这条边界。
//
// 判据不能用「表达式里有没有 param()」：聊天模型的 param() 是**有效**的，
// 统一改写会把它换成一个永远读不到的 `u()` 字段（聊天结算的用量里没有
// 这个 key），结果是把「开了思考就多收」变成「永远按标准档收」——静默
// 少收，且没有任何告警。分派必须按「模型是否绑定任务插件」来判。
func TestUterRouteAdaptTaskExprLeavesChatModelsAlone(t *testing.T) {
	for _, model := range []string{"qwen-plus", "gpt-4o", "deepseek-chat"} {
		if schema := uterRouteTaskUsageSchema(model); len(schema) != 0 {
			t.Fatalf("%s unexpectedly declares a task usage schema: %v", model, schema)
		}
		adapted, ok := uterRouteAdaptTaskExpr(chatProbeExpr, model)
		if !ok {
			t.Errorf("%s: adapt rejected a chat expression it should leave alone", model)
			continue
		}
		if adapted != chatProbeExpr {
			t.Errorf("%s: chat expression was rewritten:\n got: %s\nwant: %s", model, adapted, chatProbeExpr)
		}
	}
}

// TestUterRouteAdaptTaskExprRewritesTaskModels 是上一条的反面：任务插件
// 模型的探测条件必须被改写，且改写结果能编译。
func TestUterRouteAdaptTaskExprRewritesTaskModels(t *testing.T) {
	adapted, ok := uterRouteAdaptTaskExpr(wan3VideoProbeExpr, "wan3.0-video")
	if !ok {
		t.Fatal("adapt failed on the wan3.0-video expression")
	}
	if strings.Contains(adapted, "param(") {
		t.Errorf("task expression still probes the request: %s", adapted)
	}
	if !strings.Contains(adapted, `u("resolution") == "1080P"`) {
		t.Errorf("task expression was not rewritten to facts: %s", adapted)
	}
	if _, err := billingexpr.CompileFromCache(adapted); err != nil {
		t.Errorf("adapted expression does not compile: %v", err)
	}
}

// TestUterRouteAdaptTaskExprFailsClosedOnTaskModels 覆盖「是任务模型但
// 改不动」：必须 ok=false，让同步侧放弃写这条表达式，而不是把改不动的
// 原文落库（那会让每个请求都命中兜底档）。
func TestUterRouteAdaptTaskExprFailsClosedOnTaskModels(t *testing.T) {
	headerProbe := `header("X-Res") == "1080P" ? tier("1080p", (duration > 0 ? duration : 5) * 0.12537315) : tier("720p", (duration > 0 ? duration : 5) * 0.06268654)`
	if _, ok := uterRouteAdaptTaskExpr(headerProbe, "wan3.0-video"); ok {
		t.Error("header-probing task expression should not be adapted")
	}
	// 同一表达式在聊天模型上不受影响：聊天结算带 Headers，header() 能求值。
	adapted, ok := uterRouteAdaptTaskExpr(headerProbe, "qwen-plus")
	if !ok || adapted != headerProbe {
		t.Errorf("header probe should pass through untouched for chat models (ok=%v): %s", ok, adapted)
	}
}
