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
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/expr-lang/expr/ast"
	"github.com/expr-lang/expr/parser"

	"github.com/uter-ai/uter/pkg/billingexpr"
	"github.com/uter-ai/uter/pkg/jsplugin"
)

// 上游 billing_expr 的官方目录价解析。
//
// 背景：创梦对「分层计费」模型（billing_expr 非空）不在 /api/pricing 里给
// 折后价，只给一条表达式，例如
//
//	tier("base", p * 5 + c * 30 + cr * 0.5 + cc * 2)
//
// 其中 p / c / cr / cc 分别是「每 1M 输入 token / 输出 token / 缓存命中 /
// 缓存写入」的**官方目录价（美元）**，表达式本身只描述计费结构，不含用户组
// 折扣——折扣由 group_group_ratio 在渲染时乘上去。
//
// 历史实现把 16 个 tiered 模型的页面折后价抄成 dreamRouterTieredBaselines
// 常量表，再用组倍率线性缩放。那条路有两个必然失效点：
//
//  1. 上游新增 tiered 模型时表里没有 → 整条跳过，价格永远不更新；
//  2. 上游调价后表里的基线过期 → 算出来的价格与上游持续偏离。
//
// 现在直接从表达式里取官方单价：公式与 A 类（按量计费）完全同构
// （uter = 官方价 × (r + 加价幅度)），既不需要抓页面，也不需要人工维护表。

// dreamRouterUnitPrices 是表达式里解出的官方目录价，单位美元 / 1M tokens。
type dreamRouterUnitPrices struct {
	Input       float64
	Output      float64
	Cache       float64
	CreateCache float64
}

// dreamRouterExprTerm 匹配表达式里 `<标识符> * <数字>` 形式的计价项。
//
// 标识符只允许小写字母与下划线：这样 `cc1h * 0.2`（1 小时缓存写入）不会被
// 误认成 `cc`，只会匹配到尾部独立的 `h`（不在取值范围内，直接忽略）。
var dreamRouterExprTerm = regexp.MustCompile(`([a-z_]+)\s*\*\s*([0-9]+(?:\.[0-9]+)?)`)

// dreamRouterOfficialUnitPrices 从 billing_expr 中解出官方目录价。
//
// 同一标识符可能出现在多个分层（如 standard / long_context）里，取**首次
// 出现**的值：表达式按「基准层在前、加价层在后」书写，首次出现即基准层，
// 也正是定价页主价格展示的那一档。
//
// 返回 ok=false 表示表达式里没有可用的输入单价——调用方据此跳过该模型并告警，
// 绝不套用猜测值。
func dreamRouterOfficialUnitPrices(expr string) (dreamRouterUnitPrices, bool) {
	var prices dreamRouterUnitPrices
	seen := make(map[string]struct{}, 4)
	for _, match := range dreamRouterExprTerm.FindAllStringSubmatch(expr, -1) {
		identifier := match[1]
		if _, duplicate := seen[identifier]; duplicate {
			continue
		}
		value, err := strconv.ParseFloat(match[2], 64)
		if err != nil {
			continue
		}
		seen[identifier] = struct{}{}
		switch identifier {
		case "p":
			prices.Input = value
		case "c":
			prices.Output = value
		case "cr":
			prices.Cache = value
		case "cc":
			prices.CreateCache = value
		}
	}
	return prices, prices.Input > 0
}

// dreamRouterExprUnitTermScaled 匹配表达式里 `<标识符> * <数字>` 的计价项，
// 并保留标识符，供缩放时整体替换。
//
// 与 dreamRouterExprTerm 的区别：允许标识符里出现数字（`cc1h`、`img_o` 之外
// 还有上游自定义的 `img2` 之类），否则 `cc1h * 0.2` 会被截成 `h * 0.2`，
// 缩放后仍然"看起来对"，但标识符已经不是原变量了。
//
// 只匹配「标识符 × 数字」，因此时段条件里的裸系数（`... ? 0.5 : 1`）与
// 阈值（`len <= 272000`）都不会被改动——这是缩放能安全落地的前提。
var dreamRouterExprUnitTermScaled = regexp.MustCompile(`\b([A-Za-z_][A-Za-z0-9_]*)\s*\*\s*([0-9]+(?:\.[0-9]+)?)`)

// dreamRouterExprDurationTerm 匹配「按秒计费」的视频模型计价项：
//
//	tier("720p", (duration > 0 ? duration : 5) * 0.0895522)
//	tier("768p", duration * 0.0746268657)
//
// 即 `(…duration…) * <每秒单价>` 或裸 `duration * <每秒单价>`。上游（创梦）
// 的视频模型用这种表达式描述「分辨率档 × 视频时长」计费：ternary 链按请求
// 参数选分辨率档，每一档的单价是美元/秒 × duration（缺省 5 秒）。这类表达式
// 没有 p/c token 系数，dreamRouterOfficialUnitPrices 解不出来，历史上被标记
// tiered_unparsable 跳过——模型价格永远停在「未配置」。
//
// 2026-11 起上游把括号省略成裸 `duration * 0.1194029851`，因此两种写法都要
// 支持；否则 MiniMax-H3 一类模型会再次被判为无价格。
var dreamRouterExprDurationTerm = regexp.MustCompile(`(?:\(([^()]*\bduration\b[^()]*)\)|\bduration\b)\s*\*\s*([0-9]+(?:\.[0-9]+)?)`)

// dreamRouterDurationUnitPrices 从按秒计费的表达式里解出官方单价（美元/秒）。
//
// 一条表达式可能有多档（1080p/720p/480p）。ternary 链的书写顺序是
// 「高优先档在前、兜底档在后」：所有条件都不命中时走最后一支 tier，
// 那正是上游定价页的默认分辨率档。这里取**最后一次出现**的系数作为
// 官方基准单价（美元/秒），与 token 表达式「首次出现即基准层」的约定
// 相反——两种口径各自对齐上游页面的主价格展示。
//
// Output/Cache/CreateCache 恒为 0：视频模型没有输出 token 与缓存计价。
// 返回 ok=false 表示表达式里没有 duration 计价项——调用方继续走原有的
// tiered_unparsable 告警路径，绝不套用猜测值。
func dreamRouterDurationUnitPrices(expr string) (dreamRouterUnitPrices, bool) {
	var prices dreamRouterUnitPrices
	matches := dreamRouterExprDurationTerm.FindAllStringSubmatch(expr, -1)
	if len(matches) == 0 {
		return prices, false
	}
	value, err := strconv.ParseFloat(matches[len(matches)-1][2], 64)
	if err != nil || value <= 0 {
		return dreamRouterUnitPrices{}, false
	}
	prices.Input = value
	return prices, true
}

// dreamRouterScaleExpr 把表达式里所有单价系数乘以 factor，返回新表达式。
//
// 为什么必须改表达式而不是只改 ModelRatio：分层计费模型在运行时与定价页
// 都**只读 billing_expr**，ModelRatio 对它们不参与计价。历史同步只写
// ModelRatio，于是这些模型的售价与卡片上的"官方价"永远是同一组数字——
// 既没有按规则加价，也永远不显示折扣。
//
// 两类计价项都要缩放：
//  1. `<标识符> * <数字>`（token 单价，p/c/cr/cc 及 cc1h/img_o 等变体）；
//  2. `(…duration…) * <数字>`（视频按秒单价）。
//
// 返回 ok=false 表示没有可缩放的计价项（空表达式或两类计价项都不存在），
// 调用方据此保留原值并告警，绝不写入一条未经确认的表达式。
func dreamRouterScaleExpr(expr string, factor float64) (string, bool) {
	if factor <= 0 || strings.TrimSpace(expr) == "" {
		return "", false
	}
	scaled := false
	// 第一遍：按秒计费项 `(…duration…) * <数字>` 与裸 `duration * <数字>`。
	result := dreamRouterExprDurationTerm.ReplaceAllStringFunc(expr, func(term string) string {
		match := dreamRouterExprDurationTerm.FindStringSubmatch(term)
		value, err := strconv.ParseFloat(match[2], 64)
		if err != nil {
			return term
		}
		scaled = true
		scaledValue := strconv.FormatFloat(roundRatioValue(value*factor), 'f', -1, 64)
		if match[1] == "" {
			return "duration * " + scaledValue
		}
		return "(" + match[1] + ") * " + scaledValue
	})
	// 第二遍：标识符计价项 `p * <数字>`。duration 已由第一遍处理，这里必须
	// 跳过，否则裸 duration 会被缩放两次。
	result = dreamRouterExprUnitTermScaled.ReplaceAllStringFunc(result, func(term string) string {
		match := dreamRouterExprUnitTermScaled.FindStringSubmatch(term)
		if match[1] == "duration" {
			return term
		}
		value, err := strconv.ParseFloat(match[2], 64)
		if err != nil {
			return term
		}
		scaled = true
		// 'f' 而不是默认的 'g'：billing_expr 的语法不接受 `1e-05` 这种指数
		// 写法，小系数会被编译失败。
		return match[1] + " * " + strconv.FormatFloat(roundRatioValue(value*factor), 'f', -1, 64)
	})
	if !scaled {
		return "", false
	}
	return result, true
}

// dreamRouterExprTimeDiscount 匹配时段条件函数调用。
var dreamRouterExprTimeDiscount = regexp.MustCompile(`\b(?:weekday|hour)\s*\(`)

// dreamRouterExprHasTimeDiscount 判断表达式是否带时段折扣（weekday/hour 条件）。
//
// 这类模型（如 deepseek-v4-1-flash）在夜间与周末半价，uter 的倍率字段无法
// 表达随时间浮动的价格：同步按**基准价**写入，即与上游白天同价，并记录告警
// 提示运营「上游时段折扣未映射」。绝不按折后价写死，否则白天会亏卖。
func dreamRouterExprHasTimeDiscount(expr string) bool {
	return dreamRouterExprTimeDiscount.MatchString(expr)
}

// ---------------------------------------------------------------------------
// 任务表达式的请求探测改写
// ---------------------------------------------------------------------------

// dreamRouterTaskProbeFunctions 是「读请求参数」的辅助函数。
//
// 任务计费与聊天计费在这一点上不同：聊天请求的 Body 会随 RequestInput 一起
// 传到表达式里（relay/helper.ResolveIncomingBillingExprRequestInput），所以
// `param("enable_thinking")` 能求值；任务结算只带用量事实（
// relay_task / task_polling 都只传 Usage），`param()` 恒为 nil、`duration`
// 也不再需要探请求——它由插件汇报的秒数绑定。
//
// 于是上游同步下来的任务表达式如果按请求参数选档，落库后**永远走兜底档**：
// wan3.0-video 的 1080P 请求会被按 720p 计费。这不是展示问题，是收入侧少收。
var dreamRouterTaskProbeFunctions = map[string]struct{}{
	"param": {},
	"lower": {},
	"upper": {},
	"has":   {},
}

// dreamRouterTaskRequestAccessors 是「结算时读不到值」的请求访问器全集：
// 探测函数之外还包括 header()。header 无法用用量事实等价表达，所以它的
// 存在只用于判定「这条条件必须处理」，不参与改写白名单。
var dreamRouterTaskRequestAccessors = map[string]struct{}{
	"param":  {},
	"header": {},
	"lower":  {},
	"upper":  {},
	"has":    {},
}

// dreamRouterTaskProbeRewrite 把一个「按请求参数选档」的任务表达式改写为
// 「按用量事实选档」的等价表达式。
//
// 改写规则只有一条，但要求条件里给出的证据自洽：
//
//	<仅由 param/has/lower/upper 与字面量构成的条件>
//	  → u("<枚举字段>") == "<枚举值>"
//
// 判定方式是把条件里的字符串字面量（排除 param/header 的键名）逐个拿去和
// 用量 schema 的枚举值比对（忽略大小写，允许 "1080" 与 "1080P" 这种前缀
// 关系）。**所有字面量必须指向同一个枚举值**，否则视为证据不唯一、放弃改写。
// 这条约束把「猜错档位」挡在落库之前：宁可这次不写价，也不能写一条会把
// 1080P 判成 720p 的表达式。
//
// 返回 ok=false 表示存在无法改写的请求探测条件（含 header 探测、证据不唯一、
// 或改写后仍引用未声明的用量字段）。调用方据此**放弃写入该表达式**。
func dreamRouterTaskProbeRewrite(expr string, schema map[string]jsplugin.UsageFieldSchema) (string, bool) {
	if strings.TrimSpace(expr) == "" || len(schema) == 0 {
		return "", false
	}
	// 表达式可能带 `v1:` 版本前缀：expr 的 parser 不认它，先剥掉再按原样加回，
	// 否则带前缀的表达式会被误判成「无法解析」而整条不写。
	prefix, body := splitDreamRouterExprVersion(expr)
	tree, err := parser.Parse(body)
	if err != nil {
		return "", false
	}

	failed := false
	seen := make(map[string]struct{}, 4)
	rewriter := &dreamRouterProbeRewriter{schema: schema, seen: seen, failed: &failed}
	ast.Walk(&tree.Node, rewriter)
	if failed {
		return "", false
	}
	if !rewriter.changed {
		// 没有请求探测条件：原表达式已经是用量事实形态，无需改写。
		return expr, true
	}

	rewritten := tree.Node.String()
	if _, err := parser.Parse(rewritten); err != nil {
		return "", false
	}
	// 改写后引用的每个 u("k") 都必须是 schema 声明过的字段，否则运行时
	// 拿不到值，等于换了一种方式走兜底档。
	for _, key := range dreamRouterUsageKeys(rewritten) {
		if _, declared := schema[key]; !declared {
			return "", false
		}
	}
	return prefix + rewritten, true
}

// splitDreamRouterExprVersion 拆出 `vN:` 版本前缀与其后的表达式正文。
func splitDreamRouterExprVersion(expr string) (prefix, body string) {
	trimmed := strings.TrimSpace(expr)
	if len(trimmed) > 3 && trimmed[0] == 'v' && trimmed[2] == ':' &&
		trimmed[1] >= '0' && trimmed[1] <= '9' {
		return trimmed[:3], trimmed[3:]
	}
	return "", expr
}

type dreamRouterProbeRewriter struct {
	schema  map[string]jsplugin.UsageFieldSchema
	seen    map[string]struct{}
	changed bool
	failed  *bool
}

func (r *dreamRouterProbeRewriter) Visit(node *ast.Node) {
	conditional, ok := (*node).(*ast.ConditionalNode)
	if !ok || !conditional.Ternary {
		return
	}
	condition := conditional.Cond
	// 只有「读请求参数」的条件才需要处理。时间函数（hour/weekday）不读
	// 请求，按原样保留。
	if !dreamRouterContainsRequestAccessor(condition) {
		return
	}
	// 一旦条件里出现了请求参数访问器，就必须成功改写：header() 这类无法
	// 用用量事实等价表达，含裸变量（duration 等）的条件也不是纯探测。
	// 放过它们等于让表达式带着「结算时恒为 nil 的判断」上线，结果就是
	// 静默走兜底档。这里一律判失败，由调用方放弃写这条表达式。
	if !dreamRouterIsRequestProbe(condition) {
		*r.failed = true
		return
	}
	field, value, ok := dreamRouterMatchEnumValue(condition, r.schema)
	if !ok {
		*r.failed = true
		return
	}
	// 两个不同的档位映射到同一个枚举值，说明证据不足以区分档位。
	if _, duplicate := r.seen[field+"="+value]; duplicate {
		*r.failed = true
		return
	}
	r.seen[field+"="+value] = struct{}{}

	replacement, err := parser.Parse(`u("` + field + `") == "` + value + `"`)
	if err != nil {
		*r.failed = true
		return
	}
	ast.Patch(&conditional.Cond, replacement.Node)
	r.changed = true
}

// dreamRouterContainsRequestAccessor 判断条件里是否调用了请求参数访问器。
//
// 只要出现过一次，这条条件在任务结算时就读不到值，必须改写或拒绝——
// 即使它同时混了 header() 或裸变量，也不能当成「无需处理」放过。
func dreamRouterContainsRequestAccessor(node ast.Node) bool {
	return ast.Find(node, func(part ast.Node) bool {
		switch typed := part.(type) {
		case *ast.CallNode:
			callee, ok := typed.Callee.(*ast.IdentifierNode)
			if !ok {
				return false
			}
			_, found := dreamRouterTaskRequestAccessors[callee.Value]
			return found
		case *ast.BuiltinNode:
			_, found := dreamRouterTaskRequestAccessors[typed.Name]
			return found
		default:
			return false
		}
	}) != nil
}

// dreamRouterIsRequestProbe 判断条件是否「只由请求探测与字面量构成」。
//
// 含 duration 等裸标识符的条件不算：它读的是表达式变量，不是请求参数。
// 含 header() 的条件也不算改写目标——头信息在任务结算里同样拿不到，无法
// 用枚举事实等价表达，只能判失败让调用方跳过。
//
// 这里手写递归而不是 ast.Find：后者会把 call 的 callee 当成普通
// IdentifierNode 访问，那样每个 `param(...)` 都会被误判成裸变量。另外
// lower/upper 是 expr 的内建函数，解析出来是 BuiltinNode 而不是 CallNode，
// 两种调用形态都要认。
func dreamRouterIsRequestProbe(node ast.Node) bool {
	probe := false
	var walk func(ast.Node) bool
	walk = func(part ast.Node) bool {
		switch typed := part.(type) {
		case *ast.CallNode:
			callee, ok := typed.Callee.(*ast.IdentifierNode)
			if !ok {
				return false
			}
			if _, known := dreamRouterTaskProbeFunctions[callee.Value]; !known {
				return false
			}
			probe = true
			for _, argument := range typed.Arguments {
				if !walk(argument) {
					return false
				}
			}
			return true
		case *ast.BuiltinNode:
			if _, known := dreamRouterTaskProbeFunctions[typed.Name]; !known {
				return false
			}
			probe = true
			for _, argument := range typed.Arguments {
				if !walk(argument) {
					return false
				}
			}
			return true
		case *ast.StringNode, *ast.IntegerNode, *ast.FloatNode, *ast.BoolNode, *ast.NilNode:
			return true
		case *ast.BinaryNode:
			return walk(typed.Left) && walk(typed.Right)
		case *ast.UnaryNode:
			return walk(typed.Node)
		default:
			// 裸标识符（duration 等）、成员访问、嵌套三元都不属于请求探测。
			return false
		}
	}
	return walk(node) && probe
}

// dreamRouterMatchEnumValue 从条件的字面量里反解出唯一的 (字段, 枚举值)。
func dreamRouterMatchEnumValue(node ast.Node, schema map[string]jsplugin.UsageFieldSchema) (string, string, bool) {
	literals := dreamRouterProbeLiterals(node)
	if len(literals) == 0 {
		return "", "", false
	}
	var matchedField, matchedValue string
	for _, literal := range literals {
		field, value, ok := dreamRouterEnumValueFor(literal, schema)
		if !ok {
			return "", "", false
		}
		if matchedField == "" && matchedValue == "" {
			matchedField, matchedValue = field, value
			continue
		}
		if field != matchedField || value != matchedValue {
			return "", "", false
		}
	}
	return matchedField, matchedValue, true
}

// dreamRouterProbeLiterals 收集条件里的字符串字面量，跳过 param/header 的键名。
//
// 键名是字段路径（"size"、"metadata.resolution"），不是档位取值，拿它去比对
// 枚举只会命中不相干的值。
func dreamRouterProbeLiterals(node ast.Node) []string {
	skipped := make(map[string]struct{}, 4)
	ast.Find(node, func(part ast.Node) bool {
		call, ok := part.(*ast.CallNode)
		if !ok {
			return false
		}
		callee, ok := call.Callee.(*ast.IdentifierNode)
		if !ok || (callee.Value != "param" && callee.Value != "header") {
			return false
		}
		if len(call.Arguments) == 1 {
			if key, ok := call.Arguments[0].(*ast.StringNode); ok {
				skipped[key.Value] = struct{}{}
			}
		}
		return false
	})
	var values []string
	ast.Find(node, func(part ast.Node) bool {
		literal, ok := part.(*ast.StringNode)
		if !ok {
			return false
		}
		if _, skip := skipped[literal.Value]; skip {
			return false
		}
		values = append(values, literal.Value)
		return false
	})
	return values
}

// dreamRouterEnumValueFor 把一个探测字面量对到 (枚举字段, 枚举值)。
//
// 命中要求唯一：同一个字面量命中两个不同字段的枚举，说明它无法区分档位，
// 按未命中处理。比较忽略大小写，并接受 "1080" 与 "1080P" 这种一方是另一方
// 前缀的情形——上游用 `has(lower(param("size")), "1080")` 描述 1080P 档，
// 而插件 schema 里的枚举值是 "1080P"。
func dreamRouterEnumValueFor(literal string, schema map[string]jsplugin.UsageFieldSchema) (string, string, bool) {
	needle := strings.ToLower(strings.TrimSpace(literal))
	if needle == "" {
		return "", "", false
	}
	var field, value string
	hits := 0
	// 字段名排序后遍历，保证同一份 schema 每次得到同一个结果。
	names := make([]string, 0, len(schema))
	for name := range schema {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		for _, candidate := range schema[name].Enum {
			if !dreamRouterEnumTokenMatches(needle, strings.ToLower(candidate)) {
				continue
			}
			hits++
			field, value = name, candidate
		}
	}
	if hits != 1 {
		return "", "", false
	}
	return field, value, true
}

// dreamRouterEnumTokenMatches 判断探测值能否代表一个枚举值。
//
// 规则刻意保守：只接受「完全相等」或「一方是另一方的整段数字前缀」。
// "1080" vs "1080p" 命中；"1080" vs "1080p30" 不命中（后者的数字前缀与
// 前者相同但语义不同），因此还要求短的一方以数字结尾。
func dreamRouterEnumTokenMatches(needle, candidate string) bool {
	if needle == candidate {
		return true
	}
	shorter, longer := needle, candidate
	if len(shorter) > len(longer) {
		shorter, longer = longer, shorter
	}
	if !strings.HasPrefix(longer, shorter) {
		return false
	}
	if shorter == "" {
		return false
	}
	last := shorter[len(shorter)-1]
	return last >= '0' && last <= '9'
}

// dreamRouterUsageKeys 列出表达式里引用的 u("k") 字段名。
func dreamRouterUsageKeys(expr string) []string {
	keys := make([]string, 0, 4)
	for key := range billingexpr.UsedUsageKeys(expr) {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

// dreamRouterTaskUsageSchema 返回模型所属任务插件声明的用量事实 schema。
//
// 改写请求探测条件需要知道「哪些枚举值是可计费档位」：这只有插件自己声明。
// 模型没绑定任何任务插件（聊天/纯 token 计费模型）时返回 nil——这类模型
// 不属于任务计费，`param()` 走的是聊天请求的 Body，本来就能求值，无需改写。
//
// 先按精确名查，再用规范名回退：同步拿到的是**上游**模型名，插件的声明
// 可能与它只差大小写或连字符。查不到就如实返回 nil，让调用方 fail-closed
// （不改价 + 告警），绝不猜 schema。
func dreamRouterTaskUsageSchema(model string) map[string]jsplugin.UsageFieldSchema {
	generation := jsplugin.DefaultRegistry.Generation()
	candidates := []string{model}
	if canonical, ok := generation.CanonicalModel(model); ok && canonical != model {
		candidates = append(candidates, canonical)
	}
	for _, candidate := range candidates {
		plugin, ok := generation.GetByModel(candidate)
		if !ok || plugin == nil {
			continue
		}
		if schema, _ := plugin.Meta.UsageForModel(candidate); len(schema) > 0 {
			return schema
		}
	}
	return nil
}

// dreamRouterAdaptTaskExpr 把「已缩放的表达式」调整成可安全落库的形态。
//
// 两类模型必须区别对待，判据是「它是不是任务插件模型」：
//
//   - 任务插件模型：结算只带用量事实，`param()` 恒为 nil。表达式里的请求
//     探测条件必须改写成用量事实条件；改不动就返回 ok=false，让调用方放弃
//     写这条表达式（宁可本轮不改价，也不写一条会算错钱的表达式）。
//   - 其它模型（聊天/按量计费）：`param()` 走的是聊天请求写入的 Body，
//     运行时能求值，原样保留——改写它们反而会破坏正常的按请求参数计价。
func dreamRouterAdaptTaskExpr(expr, model string) (string, bool) {
	schema := dreamRouterTaskUsageSchema(model)
	if len(schema) == 0 {
		// 不是任务插件模型：不做任何改写。
		return expr, true
	}
	return dreamRouterTaskProbeRewrite(expr, schema)
}
