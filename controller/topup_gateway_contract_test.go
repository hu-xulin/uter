package controller

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// 本文件固化支付网关回调的**三件套**门禁：
//
//	1. 验签（signature verification）      —— 拒绝伪造回调
//	2. 幂等（idempotency）                  —— 拒绝重复入账
//	3. 实付金额比对（paid amount match）    —— 拒绝少付多充
//
// 历史教训：支付宝 / Stripe / Waffo / WaffoPancake / 微信五家都做了金额比对，
// **epay 与 Creem 漏了**—— 回调签名合法即按本地订单金额入账，网关侧金额被篡改
// （配置错误、上游被中间人代理）时平台直接资损。两个网关「有验签有幂等」这件事
// 很容易让人以为整套防护到位，说明「三项齐备」必须是**可执行的断言**而非口头约定。
//
// 本门禁用源码结构解析检查关键调用是否出现在「入账之前」。新增支付网关时，
// 只要漏掉任何一项（或压根没登记），这个测试立刻红并指出缺哪项。
//
// ⚠️ 能力边界（务必知悉，不要高估它）：
// 静态特征匹配只能证明「这段代码里有这个调用」，**无法证明它没被旁路**。
// 实测把 epay 的判定改成 `if false && (...)` 门禁依然通过。因此它防的是
// 「新网关漏写」「误删整段」这类结构性缺失，不防「故意短路」—— 后者由
// TestPaidAmountMatchesOrder / TestCreemPaidCoversOrder 这类**运行期**用例
// 兜底（它们真的构造少付金额并断言入账被拒）。两者互补，缺一不可。

// gatewayCallback 描述一个支付网关的回调入口及其三项防护的特征。
type gatewayCallback struct {
	// handler 是 gin 回调处理函数名（路由上挂的那个）。
	handler string
	// worker 是真正干活（校验金额 + 入账）的函数。留空表示与 handler 同一个。
	//
	// 两段式结构确实存在：CreemWebhook 只做验签与事件解析，随后派发给
	// handleCheckoutCompleted 做订单状态判定、金额比对与入账。三项防护必须
	// 相对 **worker** 判定先后顺序，否则两段式回调会被误判为缺防护。
	worker string
	// file 是该回调所在的源文件（相对 controller 包目录）。
	file string

	// verifySign 是必须出现的验签调用。取子串匹配，允许
	// `service.AlipayVerifySign(...)`、`wh.VerifySignature(...)` 等多种写法。
	verifySign []string
	// idempotency 是幂等防护的特征：重复回调必须被识别并跳过。
	// 两种等价形态 —— 进程内互斥锁（LockOrder）或数据库状态校验
	// （入账函数返回 alreadyDone / 先查 TopUpStatusPending）。
	idempotency []string
	// paidAmountMatch 是实付金额比对特征。
	paidAmountMatch []string
	// rechargeCall 是真正的入账调用，门禁断言三项防护都在它之前出现。
	rechargeCall string
}

// workerFunc 返回真正干活的函数名。
func (g gatewayCallback) workerFunc() string {
	if g.worker != "" {
		return g.worker
	}
	return g.handler
}

// requiredGatewayCallbacks 是受门禁约束的全部支付网关回调。
//
// 新增支付网关时往这里加一条 —— 这是「必须显式表态」的设计：新网关不会因为
// 没登记而静默漏检，必须先想清楚三项防护怎么做。
var requiredGatewayCallbacks = []gatewayCallback{
	{
		handler:     "EpayNotify",
		file:        "topup.go",
		verifySign:  []string{"client.Verify(", "verifyInfo.VerifyStatus"},
		idempotency: []string{"LockOrder(", "alreadyDone"},
		// go-epay 的 VerifyRes.Money 是签名保护的实付金额，此前从未被读取。
		// 特征必须是真正的判定调用，不能只写 "verifyInfo.Money"（那只是取值，
		// 删掉整段校验后取值语句也可能残留，会让门禁假通过）。
		paidAmountMatch: []string{"paidAmountMatchesOrder("},
		rechargeCall:    "model.RechargeEpay(",
	},
	{
		handler:         "AlipayNotify",
		file:            "topup_alipay.go",
		verifySign:      []string{"service.AlipayVerifySign("},
		idempotency:     []string{"LockOrder(", "alreadyDone"},
		paidAmountMatch: []string{"total_amount", "金额校验"},
		rechargeCall:    "model.RechargeAlipay(",
	},
	{
		// 主动查单不是网关回调，但它同样会入账，因此同样受三件套约束：
		// 响应验签在 service.AlipayQueryOrder 内部完成（AlipayVerifyResponse），
		// 这里以「调用该查单函数」作为验签已发生的特征。
		//
		// 三件套里的「幂等 + 金额比对 + 入账」已抽到 applyAlipayQueryResult：
		// 用户回跳后的主动查单、后台对账任务、以及打开充值记录时的读时对账
		// 都走这一个函数，防护只可能同时生效或同时失效，不会出现「接口校验了、
		// 后台任务没校验」的分叉。故 worker 指向该共用函数。
		handler:         "QueryAlipayOrder",
		worker:          "applyAlipayQueryResult",
		file:            "topup_alipay.go",
		verifySign:      []string{"service.AlipayQueryOrder("},
		idempotency:     []string{"LockOrder(", "alreadyDone"},
		paidAmountMatch: []string{"alipayPaidAmountMatchesOrder("},
		rechargeCall:    "model.RechargeAlipay(",
	},
	{
		// 微信主动查单与支付宝同理：验签在 service.WechatQueryOrder 内部完成，
		// 「幂等 + 金额比对 + 入账」收敛在 applyWechatQueryResult（用户回跳、
		// 后台对账、读时对账共用），防护只会同时生效或同时失效。
		handler:         "QueryWechatOrder",
		worker:          "applyWechatQueryResult",
		file:            "topup_wechat.go",
		verifySign:      []string{"service.WechatQueryOrder("},
		idempotency:     []string{"LockOrder(", "alreadyDone"},
		paidAmountMatch: []string{"providerExpectedMinorUnits(", "WechatReconcileAmountMismatch"},
		rechargeCall:    "model.RechargeWechatPay(",
	},
	{
		handler:         "WechatPayNotify",
		file:            "topup_wechat.go",
		verifySign:      []string{"service.WechatPayVerifyNotify("},
		idempotency:     []string{"LockOrder(", "alreadyDone"},
		paidAmountMatch: []string{"expectedCents", "金额校验"},
		rechargeCall:    "model.RechargeWechatPay(",
	},
	{
		handler:    "StripeWebhook",
		worker:     "fulfillOrder",
		file:       "topup_stripe.go",
		verifySign: []string{"webhook.ConstructEventWithOptions("},
		// 幂等锁在 handler 层（LockOrder/UnlockOrder 包住派发），worker 内不再重复加锁。
		// 故幂等特征允许出现在 handler 或 worker 任一层，只要在入账之前。
		idempotency: []string{"LockOrder(", "alreadyDone"},
		// Stripe 的 amount_total 不能与 topUp.Money 比较（后者经分组倍率换算），
		// 必须走 Price 单价换算，故特征是 expectedCents 而非通用 helper。
		paidAmountMatch: []string{"expectedCents", "amount_total"},
		rechargeCall:    "model.Recharge(",
	},
	{
		handler:         "WaffoWebhook",
		worker:          "handleWaffoPayment",
		file:            "topup_waffo.go",
		verifySign:      []string{"wh.VerifySignature("},
		idempotency:     []string{"LockOrder("},
		paidAmountMatch: []string{"金额校验", "orderAmount"},
		rechargeCall:    "model.RechargeWaffo(",
	},
	{
		handler:         "WaffoPancakeWebhook",
		file:            "topup_waffo_pancake.go",
		verifySign:      []string{"service.VerifyConfiguredWaffoPancakeWebhook("},
		idempotency:     []string{"LockOrder("},
		paidAmountMatch: []string{"金额校验"},
		rechargeCall:    "model.RechargeWaffoPancake(",
	},
	{
		handler:     "CreemWebhook",
		worker:      "handleCheckoutCompleted",
		file:        "topup_creem.go",
		verifySign:  []string{"verifyCreemSignature("},
		idempotency: []string{"TopUpStatusPending", "model.RechargeCreem("},
		// Creem 以最小货币单位（分）下发，必须用分单位的专用判定。
		paidAmountMatch: []string{"creemPaidCoversOrder(", "AmountPaid"},
		rechargeCall:    "model.RechargeCreem(",
	},
}

// TestPaymentGatewayCallbacksVerifySignBeforeRecharge 断言每个网关在入账**之前**
// 完成验签。验签检查入口函数（handler），入账位置检查 worker —— 入口负责验签、
// worker 负责入账，两段式结构下这是唯一正确的比较基准。
func TestPaymentGatewayCallbacksVerifySignBeforeRecharge(t *testing.T) {
	for _, gateway := range requiredGatewayCallbacks {
		t.Run(gateway.handler, func(t *testing.T) {
			_, rechargeAt := offsetsWithinCallback(t, gateway, gateway.workerFunc())
			for _, marker := range gateway.verifySign {
				at := findOffset(t, gateway, gateway.handler, marker)
				require.GreaterOrEqualf(t, at, 0,
					"%s: 找不到验签调用 %q —— 回调必须在入账前验签", gateway.handler, marker)
				require.Lessf(t, at, rechargeAt,
					"%s: 验签(%q) 出现在入账之后 —— 伪造回调会先入账再验签", gateway.handler, marker)
			}
		})
	}
}

// TestPaymentGatewayCallbacksAreIdempotent 断言每个网关都有幂等防护。
//
// 幂等防护允许出现在 handler（入口加锁）或 worker（干活函数内再校验）任一层，
// 只要它包住 / 先于入账。两段式结构下分工很常见：Stripe 在 handler 层加锁后
// 派发，worker 不重复加锁。
func TestPaymentGatewayCallbacksAreIdempotent(t *testing.T) {
	for _, gateway := range requiredGatewayCallbacks {
		t.Run(gateway.handler, func(t *testing.T) {
			rechargeAt := findOffset(t, gateway, gateway.workerFunc(), gateway.rechargeCall)
			require.GreaterOrEqualf(t, rechargeAt, 0,
				"%s: 找不到入账调用 %s", gateway.handler, gateway.rechargeCall)
			// 幂等防护允许出现在 handler（入口加锁）或 worker（干活函数内再校验）
			// 任一层，只要它包住 / 先于入账。任一特征命中即算具备。
			matched := ""
			for _, marker := range gateway.idempotency {
				at := minOffset(
					findOffset(t, gateway, gateway.workerFunc(), marker),
					findOffset(t, gateway, gateway.handler, marker),
				)
				if at >= 0 && at < rechargeAt {
					matched = marker
					break
				}
			}
			require.NotEmptyf(t, matched,
				"%s: 入账前必须具备幂等防护（期望特征 %v，入账点 %s）。"+
					"重复回调会重复入账，直接资损。",
				gateway.handler, gateway.idempotency, gateway.rechargeCall)
		})
	}
}

func minOffset(a, b int) int {
	if a < 0 {
		return b
	}
	if b < 0 {
		return a
	}
	if a < b {
		return a
	}
	return b
}

// TestPaymentGatewayCallbacksMatchPaidAmount 断言每个网关在入账**之前**
// 比对实付金额。这是最容易漏、后果最直接的一项。
func TestPaymentGatewayCallbacksMatchPaidAmount(t *testing.T) {
	for _, gateway := range requiredGatewayCallbacks {
		t.Run(gateway.handler, func(t *testing.T) {
			rechargeAt := findOffset(t, gateway, gateway.workerFunc(), gateway.rechargeCall)
			require.GreaterOrEqualf(t, rechargeAt, 0,
				"%s: 找不到入账调用 %s", gateway.handler, gateway.rechargeCall)

			// 至少一个金额比对特征必须出现在入账之前。
			matched := ""
			for _, marker := range gateway.paidAmountMatch {
				at := findOffset(t, gateway, gateway.workerFunc(), marker)
				if at >= 0 && at < rechargeAt {
					matched = marker
					break
				}
			}
			require.NotEmptyf(t, matched,
				"%s: 入账前必须比对实付金额（期望特征 %v，入账点 %s）。"+
					"签名合法即按本地订单金额入账，网关侧金额被篡改时会直接资损。",
				gateway.handler, gateway.paidAmountMatch, gateway.rechargeCall)
		})
	}
}

// TestGatewayCallbackRegistryCoversAllRechargePaths 防止新增网关漏登记：
// 扫描 controller 包内所有调用 model.Recharge* 的函数，每个都必须出现在
// requiredGatewayCallbacks 里（含作为 worker 的函数）。
func TestGatewayCallbackRegistryCoversAllRechargePaths(t *testing.T) {
	registered := map[string]bool{}
	for _, gateway := range requiredGatewayCallbacks {
		registered[gateway.handler] = true
		registered[gateway.workerFunc()] = true
	}

	found, err := rechargeCallingFunctions()
	require.NoError(t, err)
	require.NotEmpty(t, found, "scanner found no model.Recharge* call sites at all")

	for _, fn := range found {
		require.Truef(t, registered[fn.name],
			"函数 %s（%s）调用了 %s，但未登记到 requiredGatewayCallbacks。"+
				"新增支付网关必须在此登记三件套特征，否则金额比对可能被静默漏掉。",
			fn.name, fn.file, fn.call)
	}
}

// TestGatewayRechargeAmountAlwaysComesFromLocalOrder 固化「入账金额恒取本地订单」。
//
// 任何直接用网关回传金额充值账户的写法都是资损（少付多充）。这里检查每个
// Recharge* 调用传入的金额参数来自订单对象而非回调载荷。
func TestGatewayRechargeAmountAlwaysComesFromLocalOrder(t *testing.T) {
	for _, gateway := range requiredGatewayCallbacks {
		t.Run(gateway.handler, func(t *testing.T) {
			src := readSource(t, gateway.file)
			idx := strings.Index(src, gateway.rechargeCall)
			require.GreaterOrEqualf(t, idx, 0, "找不到入账调用 %s", gateway.rechargeCall)
			call := src[idx:minInt(idx+200, len(src))]
			require.NotContainsf(t, call, ".Money)",
				"%s: 入账不得直接使用回调回传金额（%s 的实参含 .Money）",
				gateway.handler, gateway.rechargeCall)
		})
	}
}

// ---------------------------------------------------------------------------
// AST 辅助
// ---------------------------------------------------------------------------

type callSite struct {
	name string
	file string
	call string
}

// rechargeCallingFunctions 找出 controller 包内所有调用 model.Recharge* 的函数。
func rechargeCallingFunctions() ([]callSite, error) {
	fset := token.NewFileSet()
	entries, err := os.ReadDir(".")
	if err != nil {
		return nil, err
	}
	var out []callSite
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".go") || strings.HasSuffix(entry.Name(), "_test.go") {
			continue
		}
		file, err := parser.ParseFile(fset, filepath.Join(".", entry.Name()), nil, 0)
		if err != nil {
			return nil, err
		}
		for _, decl := range file.Decls {
			fn, ok := decl.(*ast.FuncDecl)
			if !ok || fn.Body == nil {
				continue
			}
			ast.Inspect(fn.Body, func(n ast.Node) bool {
				call, ok := n.(*ast.CallExpr)
				if !ok {
					return true
				}
				sel, ok := call.Fun.(*ast.SelectorExpr)
				if !ok {
					return true
				}
				pkg, ok := sel.X.(*ast.Ident)
				if !ok || pkg.Name != "model" || !strings.HasPrefix(sel.Sel.Name, "Recharge") {
					return true
				}
				out = append(out, callSite{name: fn.Name.Name, file: entry.Name(), call: "model." + sel.Sel.Name})
				return true
			})
		}
	}
	return out, nil
}

// offsetsWithinCallback 返回指定函数在文件中的起止偏移。
func offsetsWithinCallback(t *testing.T, gateway gatewayCallback, fn string) (int, int) {
	t.Helper()
	src := readSource(t, gateway.file)
	start := strings.Index(src, "func "+fn+"(")
	require.GreaterOrEqualf(t, start, 0, "找不到函数 %s（应在 %s）", fn, gateway.file)

	// 从 func 声明起做花括号配平，得到函数体范围。
	open := strings.Index(src[start:], "{")
	require.GreaterOrEqual(t, open, 0)
	depth, end := 0, -1
	for i := start + open; i < len(src); i++ {
		switch src[i] {
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				end = i
			}
		}
		if end > 0 {
			break
		}
	}
	require.Greater(t, end, 0, "无法确定 %s 的函数体范围", fn)
	return start, end
}

// findOffset 返回特征串在指定函数体**内**的绝对偏移；不在则返回 -1。
func findOffset(t *testing.T, gateway gatewayCallback, fn, marker string) int {
	t.Helper()
	src := readSource(t, gateway.file)
	start, end := offsetsWithinCallback(t, gateway, fn)
	if idx := strings.Index(src[start:end+1], marker); idx >= 0 {
		return start + idx
	}
	return -1
}

func readSource(t *testing.T, name string) string {
	t.Helper()
	src, err := os.ReadFile(filepath.Join(".", name))
	require.NoErrorf(t, err, "failed to read %s", name)
	return string(src)
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
