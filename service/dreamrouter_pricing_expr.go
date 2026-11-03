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
	"strconv"
	"strings"
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
//
// 即 `(…duration…) * <每秒单价>`。上游（创梦）的视频模型（wan3.0-video 等，
// supported_endpoint_types = ["ali-video"]）用这种表达式描述「分辨率档 ×
// 视频时长」计费：ternary 链按请求参数选分辨率档，每一档的单价是
// 美元/秒 × duration（缺省 5 秒）。这类表达式没有 p/c token 系数，
// dreamRouterOfficialUnitPrices 解不出来，历史上被标记 tiered_unparsable
// 跳过——模型价格永远停在「未配置」。
//
// 与 dreamRouterExprTerm 的区别：系数前面不是标识符而是右括号，因此
// 两个正则互不重叠；分组内容必须含 `duration` 标识符，token 表达式
// 不会误中。
var dreamRouterExprDurationTerm = regexp.MustCompile(`\(([^()]*\bduration\b[^()]*)\)\s*\*\s*([0-9]+(?:\.[0-9]+)?)`)

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
	result := dreamRouterExprUnitTermScaled.ReplaceAllStringFunc(expr, func(term string) string {
		match := dreamRouterExprUnitTermScaled.FindStringSubmatch(term)
		value, err := strconv.ParseFloat(match[2], 64)
		if err != nil {
			return term
		}
		scaled = true
		// 'f' 而不是默认的 'g'：billing_expr 的语法不接受 `1e-05` 这种指数
		// 写法，小系数会被编译失败。
		return match[1] + " * " + strconv.FormatFloat(roundRatioValue(value*factor), 'f', -1, 64)
	})
	// 第二遍：按秒计费项 `(…duration…) * <数字>`。必须在标识符遍之后跑：
	// 两类模式的计价项互不重叠（一个系数前是标识符，一个是右括号），
	// 先后顺序不影响结果，但都成功时 scaled 必须为 true。
	result = dreamRouterExprDurationTerm.ReplaceAllStringFunc(result, func(term string) string {
		match := dreamRouterExprDurationTerm.FindStringSubmatch(term)
		value, err := strconv.ParseFloat(match[2], 64)
		if err != nil {
			return term
		}
		scaled = true
		return "(" + match[1] + ") * " + strconv.FormatFloat(roundRatioValue(value*factor), 'f', -1, 64)
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
