package common

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

func GetEnvOrDefault(env string, defaultValue int) int {
	if env == "" || os.Getenv(env) == "" {
		return defaultValue
	}
	num, err := strconv.Atoi(os.Getenv(env))
	if err != nil {
		SysError(fmt.Sprintf("failed to parse %s: %s, using default value: %d", env, err.Error(), defaultValue))
		return defaultValue
	}
	return num
}

func GetEnvOrDefaultString(env string, defaultValue string) string {
	if env == "" || os.Getenv(env) == "" {
		return defaultValue
	}
	return os.Getenv(env)
}

func GetEnvOrDefaultBool(env string, defaultValue bool) bool {
	if env == "" || os.Getenv(env) == "" {
		return defaultValue
	}
	b, err := strconv.ParseBool(os.Getenv(env))
	if err != nil {
		SysError(fmt.Sprintf("failed to parse %s: %s, using default value: %t", env, err.Error(), defaultValue))
		return defaultValue
	}
	return b
}

// GetEnvOrDefaultIntList 解析形如 "1,2,3" 的整数列表环境变量。
//
// 与其它 GetEnv* 辅助函数不同，单项解析失败只跳过该项并记日志，不会整体回退到默认值：
// 列表类配置（如组织白名单）里单个笔误不应让其余正确条目一并失效。
func GetEnvOrDefaultIntList(env string, defaultValue []int) []int {
	raw := strings.TrimSpace(os.Getenv(env))
	if env == "" || raw == "" {
		return defaultValue
	}
	parts := strings.Split(raw, ",")
	values := make([]int, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimSpace(part)
		if item == "" {
			continue
		}
		value, err := strconv.Atoi(item)
		if err != nil {
			SysError(fmt.Sprintf("failed to parse %s item %q: %s (item skipped)", env, item, err.Error()))
			continue
		}
		values = append(values, value)
	}
	if len(values) == 0 {
		return defaultValue
	}
	return values
}

// GetCustomerServiceURL 返回智能客服（uter-cs）挂件后端的对外地址，由环境变量
// CUSTOMER_SERVICE_URL 指定，通过 /api/status 下发给前端。
//
// 智能客服是**独立仓库、独立部署**的 Node 服务，前端组件直接跨域访问它，
// 因此这里下发的是完整基地址（如 https://cs.uter.ai），前端在其后拼接
// /api/deploy/widget-config 与 /api/qa/public-chat。
//
// 为空字符串（默认）表示不启用挂件，前端不渲染智能客服入口。
//
// 🔑 为什么是函数而不是包级变量：.env 是由 main() 里的 godotenv.Load(".env")
// 加载的，而**包级变量的初始化早于 main()**——写成
// `var CustomerServiceURL = os.Getenv(...)` 会永远读到空（godotenv 事后加载
// 不会重新求值已初始化的变量），表现为「未配置智能客服地址
// （CUSTOMER_SERVICE_URL），无法拉取配置」，且 .env 里明明配了值。
// 改为**每次调用时实时读取**，彻底消除这个初始化时序陷阱。
func GetCustomerServiceURL() string {
	return strings.TrimSpace(os.Getenv("CUSTOMER_SERVICE_URL"))
}

// CustomerServiceEnabled 是智能客服挂件入口的总开关（可在「站点与品牌 → 智能客服」
// 里切换）。与 GetCustomerServiceURL() 是**两个独立的门**：URL 决定「挂到哪」，本开关决定
// 「要不要挂」。两者都为真才渲染入口，因此运营可以先关掉入口、保留服务与配置。
//
// 默认为 true：保持既有行为——只要配了 URL 就显示入口；升级后不会突然少一个入口。
// 注意它只影响**入口显示**，不会停止也不影响独立运行的智能客服服务本身。
var CustomerServiceEnabled = true

// 智能客服入口的页面分组键。每个键对应站点上一类页面，挂件按当前路由判定是否渲染。
//
// 这些键是**前后端与配置界面之间的稳定契约**：前端按同一套 key 做路由匹配，后端按
// 同一套 key 做白名单过滤，改动需三处同步（common/env.go、web 侧 PageKey 类型、
// 配置界面选项）。
const (
	// CustomerServicePageHome 首页（/）
	CustomerServicePageHome = "home"
	// CustomerServicePageDashboard 登录后的控制台（/dashboard 及其子路由）
	CustomerServicePageDashboard = "dashboard"
	// CustomerServicePagePricing 定价页（/pricing）
	CustomerServicePagePricing = "pricing"
	// CustomerServicePageRankings 排行页（/rankings）
	CustomerServicePageRankings = "rankings"
	// CustomerServicePageDocs 文档站（/docs）
	CustomerServicePageDocs = "docs"
	// CustomerServicePageAbout 关于页（/about）
	CustomerServicePageAbout = "about"
)

// CustomerServicePagesAllOff 是「全部页面都关」的显式哨兵值。
//
// 页面级开关以逗号分隔的页面键存储，空串被保留为「未配置 = 全部页面都开」
// （见下方 NormalizeCustomerServicePages 的向后兼容说明）。但运营有时需要
// 「一个页面都不开」，而空串已被「全开」占用、无法再表达「全关」。于是约定
// 一个显式哨兵：界面上把六个开关全关掉时，前端写回 "none"，后端据此下发空数组，
// 挂件即在所有页面都不渲染。
const CustomerServicePagesAllOff = "none"

// CustomerServicePageKeys 是全部合法页面键，顺序即配置界面的展示顺序。
//
// 用于过滤配置里出现的未知键：运营手改 option 或旧版本残留脏数据时，不应让
// 未知键静默生效（否则「配了一个不存在的页面」看起来像开关已开）。
var CustomerServicePageKeys = []string{
	CustomerServicePageHome,
	CustomerServicePageDashboard,
	CustomerServicePagePricing,
	CustomerServicePageRankings,
	CustomerServicePageDocs,
	CustomerServicePageAbout,
}

// customerServicePageKeySet 是 CustomerServicePageKeys 的集合形式，供 O(1) 过滤。
var customerServicePageKeySet = func() map[string]struct{} {
	set := make(map[string]struct{}, len(CustomerServicePageKeys))
	for _, key := range CustomerServicePageKeys {
		set[key] = struct{}{}
	}
	return set
}()

// NormalizeCustomerServicePages 把配置值规整成合法页面键列表（去空白、去重、去未知键、
// 按 CustomerServicePageKeys 的固定顺序排序）。
//
// 三种输入语义：
//   - ""（未配置）：返回**全部页面键**——这是向后兼容的关键：升级前只有总开关、默认
//     全开，若把「未配置」解释成「一个页面都不开」，升级瞬间所有页面的客服入口都会消失；
//   - "none"（显式哨兵）：返回**空切片**，表示运营在界面把所有页面开关都关掉；
//   - 具体列表：返回其中合法的页面键（按固定顺序）。
func NormalizeCustomerServicePages(value string) []string {
	// 显式哨兵「全部关闭」：只有 TrimSpace 后恰好等于哨兵才算，避免把
	// "none,home" 之类误判成全关。后端/前端约定该值只单独出现。
	if strings.TrimSpace(value) == CustomerServicePagesAllOff {
		return []string{}
	}
	seen := make(map[string]struct{}, len(CustomerServicePageKeys))
	for _, part := range strings.Split(value, ",") {
		key := strings.ToLower(strings.TrimSpace(part))
		if key == "" {
			continue
		}
		if _, ok := customerServicePageKeySet[key]; !ok {
			continue
		}
		seen[key] = struct{}{}
	}
	if len(seen) == 0 {
		// 未配置 = 不限制页面，沿用总开关的全开行为。
		return append([]string(nil), CustomerServicePageKeys...)
	}
	pages := make([]string, 0, len(seen))
	for _, key := range CustomerServicePageKeys {
		if _, ok := seen[key]; ok {
			pages = append(pages, key)
		}
	}
	return pages
}

// CustomerServicePages 是智能客服入口的**页面级**开关（可在「站点与品牌 → 智能客服」
// 里逐页切换），以逗号分隔的页面键存储，例如 "home,pricing,docs"。
//
// 与 CustomerServiceEnabled 是**递进**关系而非并列：总开关关闭时本项不生效；总开关
// 开启时，只有命中本列表的页面才渲染入口。两种特殊值：
//   - ""（默认/未配置）= 不限制 = 全部页面都开（向后兼容）；
//   - "none" = 显式全部关闭，对应界面上六个开关全关。
var CustomerServicePages = ""

// CustomerServiceAdminToken 是 Uter 后端调用智能客服（uter-cs）**管理端** API 时
// 携带的 Bearer token（由运营在「站点与品牌 → 智能客服」里粘贴 uter-cs 的 admin
// 令牌）。它是 Uter 与 uter-cs 之间的**透传凭证**：Uter 不解析、不签发，只原样
// 转发给 uter-cs 的 /api/deploy/* 管理接口（读 /api/deploy/config、写
// /api/deploy/section/llm 等）。
//
// 仅作内存镜像；真正的持久化在 options 表（model/option.go 注册
// "CustomerServiceAdminToken"）。默认空串 = 未配置，此时任何需要它代理的端点都
// 返回 400，而不是带着空 token 去打 uter-cs（那会稳定 401）。
//
// ⚠️ 安全边界：这是 uter-cs 的**管理员**凭证，等价于 uter-cs 的完全控制权。
// 它只保存在 Uter 的 options 表（与系统其它密钥同等级别），绝不出现在 /api/status
// 等对外下发接口，前端只读「是否已配置」、不回显明文。
var CustomerServiceAdminToken = ""

// CustomerServiceLLMConfig 缓存 uter-cs 最近一次成功读取/保存的大模型配置（llm 段，
// JSON 字符串）。用途：① 即使本次未携带令牌，也能直接展示「目前已经配置好的参数」；
// ② 实时拉取 uter-cs 临时失败时回退展示，避免页面把上游错误当 500 砸出来。
// 仅作内存镜像（含 api_key 等敏感字段），不写任何对外接口；落地持久化由
// CustomerServiceAdminToken 同在 options 表托管（重启后令牌仍在，GET 会重新实时拉取）。
// 批量选项接口 GetOptions 已将其排除，不会在 /api/option/ 泄露。
var CustomerServiceLLMConfig = ""
