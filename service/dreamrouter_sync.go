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
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/http/cookiejar"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/billing_setting"
	"github.com/uter-ai/uter/setting/ratio_setting"
)

// DreamRouter（创梦渠道，https://dreamrouter.ai）价格同步。
//
// 背景：uter 的聚合渠道（默认渠道 id=20）上游即 DreamRouter，其定价页
// （https://dreamrouter.ai/pricing）对每个模型展示一个折扣徽标（如 -40%），
// 语义是「相对官方基准价，该用户组享受的折扣」。
//
// 定价结构（2026-10-24 经其 /api/pricing 全量数据 + 页面渲染逐项核对，
// 2026-10-26 改为全部从接口数据推导，不再依赖页面抓取值）：
//
//	官方基准价   = /api/pricing 记录的 model_ratio / completion_ratio /
//	               cache_ratio / create_cache_ratio / model_price（$/1M tokens 或 $/次）；
//	               billing_expr 非空的记录改从表达式的 p/c/cr/cc 系数取
//	               （见 dreamrouter_pricing_expr.go）
//	用户组倍率 r = min{ 组倍率 : 组 ∈ 该模型 enable_groups }
//	               组倍率优先取 group_group_ratio["default"][组]，
//	               缺失回退 group_ratio[组]
//	默认组售价 C = 官方基准价 × r            （页面显示的折后价）
//	折扣徽标 -N% = 1 - r                     （r=0.6 → -40%）
//
// uter 目标价（业务规则）：在创梦默认组售价基础上「+1 折」——
// 创梦打 r 折，uter 打 (r+step) 折，step 默认 0.1。
// 例：创梦 claude-opus-4-5 -40%（6 折）→ uter 7 折，即官方价的 0.7 倍。
//
//	uter = C × (1 + step/r) = 官方基准价 × (r + step)
//
// 展开到 uter 的倍率字段（$/1M = ModelRatio × 2，与上游同构）：
//
//	A 类 按量计费且无 billing_expr：
//	    ModelRatio      = model_ratio × (r + step)
//	    CompletionRatio = completion_ratio（比值，加成系数约掉）
//	    CacheRatio      = cache_ratio
//	    CreateCacheRatio= create_cache_ratio
//	B 类 按次计费且无 billing_expr（图片/视频类）：
//	    ModelPrice      = model_price × (r + step)   （单位：美元/次）
//	C 类 带 billing_expr 分层计费：
//	    官方单价取自表达式系数（p/c/cr/cc = $/1M），与 A 类同构：
//	    ModelRatio      = p系数 / 2 × (r + step)
//	    CompletionRatio = c系数 / p系数
//	    表达式不可解析时标记 tiered_unparsable 并告警，不猜价。
//	C2 类 按秒计费的视频模型（wan3.0-video 等，表达式含 duration 计价项）：
//	    官方单价 = 兜底档（默认分辨率）的 $/秒，表达式按规则系数缩放后
//	    原样落库（uter 运行时支持 duration/tier/param）；倍率取上游名义值
//	    × 系数做兜底。
const (
	dreamRouterBaseURL      = "https://dreamrouter.ai"
	dreamRouterLoginPath    = "/api/user/login"
	dreamRouterPricingPath  = "/api/pricing"
	dreamRouterDefaultGroup = "default"

	dreamRouterSyncEnabledKey    = "DreamRouterSyncEnabled"
	dreamRouterSyncChannelIDKey  = "DreamRouterSyncChannelID"
	dreamRouterSyncUsernameKey   = "DreamRouterSyncUsername"
	dreamRouterSyncPasswordKey   = "DreamRouterSyncPassword"
	dreamRouterSyncStepKey       = "DreamRouterSyncStep"
	dreamRouterSyncLastRunAtKey  = "DreamRouterSyncLastRunAt"
	dreamRouterSyncLastResultKey = "DreamRouterSyncLastResult"
	dreamRouterSyncLastErrorKey  = "DreamRouterSyncLastError"
	// dreamRouterSyncSnapshotKey 保存最近一次成功同步的逐模型价格快照
	// （上游官方基准价、上游折扣、uter 售价、对齐结论）。
	//
	// 它有两个不可替代的用途：
	//  1. 定价页的「官方价格 / 折扣徽标」以它为参照。公开定价页此前只能拿
	//     basellm / models.dev 两个外部预设当官方价参照，而上游模型清单里
	//     相当一部分模型（新发布、渠道私有命名）在两个预设里都不存在，
	//     结果是卡片既没有划线原价也没有折扣徽标——「折扣没获取到」的真正
	//     原因。快照里的官方价直接来自上游定价接口，覆盖 100% 的同步模型。
	//  2. 管理端「渠道登录与同步」页的上游 / uter 逐模型对照表。
	dreamRouterSyncSnapshotKey = "DreamRouterSyncSnapshot"

	// ── 渠道登录与同步（前端「系统设置 → 模型 → 渠道登录与同步」）──────
	//
	// 上游渠道：目前仅创梦（DreamRouter）一种实现。新增渠道时在此登记
	// provider id，并在下方 switch 里接上对应实现。
	dreamRouterSyncProviderKey = "DreamRouterSyncProvider"
	// 🔴 同步频率已固定为每 10 分钟一次（2026-10-30），原「每天几点」配置
	// DreamRouterSyncHour 废弃：不再读取，库中残留值无害。
	// 价格规则：方向（increase=加价 / decrease=降价）与幅度（折数，0-1）。
	// 缺省 increase + 0.1，与历史 DreamRouterSyncStep=0.1 行为一致。
	dreamRouterSyncRuleDirectionKey = "DreamRouterSyncRuleDirection"
	dreamRouterSyncRuleAmountKey    = "DreamRouterSyncRuleAmount"

	dreamRouterDefaultChannelID = 20
	dreamRouterDefaultStep      = 0.1
	dreamRouterHTTPTimeout      = 30 * time.Second
)

// 上游渠道标识。目前只有创梦一种；前端下拉框据此渲染。
const (
	// DreamRouterProviderDreamRouter 创梦渠道。
	DreamRouterProviderDreamRouter = "dreamrouter"
)

// 价格规则的方向。
const (
	// DreamRouterRuleDirectionIncrease 在上游折后价基础上加价（uter 卖得更贵）。
	DreamRouterRuleDirectionIncrease = "increase"
	// DreamRouterRuleDirectionDecrease 在上游折后价基础上降价（uter 卖得更便宜）。
	DreamRouterRuleDirectionDecrease = "decrease"
)

// 上游账号的默认用户名。该账号仅对 https://dreamrouter.ai/pricing 有只读
// 定价数据访问权限；option 中配置了同名键时以 option 为准，部署方可在
// 「系统设置 → 选项」中覆盖。
//
// 🔴 **口令不在源码里留明文兜底**（此前是 `dreamRouterDefaultPassword` 常量）。
// 密钥写进仓库等于公开：任何拿到源码/镜像的人都能用它登录上游渠道账号。
// 现在口令只从 option `DreamRouterSyncPassword` 读——该键已登记为 secret
// （见 common/secret_option_keys.go），读时掩码、写时掩码串不落库，真值只存
// 在数据库与进程内存里。未配置时同步任务直接报错，不做明文兜底。
//
// 首次配置方式：在「系统设置 → 选项」里新增 `DreamRouterSyncPassword`
// （值为上游 DreamRouter 账号口令）。同理 `DreamRouterSyncUsername`。
const (
	dreamRouterDefaultUsername = "Uter.ai"
)

// dreamRouterRecord 对应 /api/pricing 的 data[] 单条记录。
type dreamRouterRecord struct {
	ModelName         string   `json:"model_name"`
	VendorID          int      `json:"vendor_id"`
	QuotaType         int      `json:"quota_type"`
	ModelRatio        float64  `json:"model_ratio"`
	ModelPrice        float64  `json:"model_price"`
	CompletionRatio   float64  `json:"completion_ratio"`
	CacheRatio        float64  `json:"cache_ratio"`
	CreateCacheRatio  float64  `json:"create_cache_ratio"`
	EnableGroups      []string `json:"enable_groups"`
	SupportedEndpoint []string `json:"supported_endpoint_types"`
	BillingMode       string   `json:"billing_mode"`
	BillingExpr       string   `json:"billing_expr"`
	PricingVersion    string   `json:"pricing_version"`
}

// dreamRouterVendor 对应 /api/pricing 的 vendors[] 单条记录。
//
// 它只决定**上游定价页把模型归到哪个供应商分组下**，不决定模型在不在售：
// 实测（2026-10-28）上游有一条模型（MiniMax-M2.5）没有 vendor_id，
// 定价页照常展示它、标着 -5% 折扣、也照常可调用。把 vendor 当在售判据会
// 让这类模型每次同步都被跳过（见 dreamRouterOfferedReason）。
type dreamRouterVendor struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Icon string `json:"icon"`
}

// dreamRouterPayload 是 /api/pricing 的响应结构（只取同步所需字段）。
type dreamRouterPayload struct {
	Success         bool                          `json:"success"`
	Data            []dreamRouterRecord           `json:"data"`
	GroupRatio      map[string]float64            `json:"group_ratio"`
	GroupGroupRatio map[string]map[string]float64 `json:"group_group_ratio"`
	AutoGroups      []string                      `json:"auto_groups"`
	UsableGroup     map[string]string             `json:"usable_group"`
	Vendors         []dreamRouterVendor           `json:"vendors"`
	PricingVersion  string                        `json:"pricing_version"`
}

// DreamRouterSyncOptions 控制一次同步的行为。
type DreamRouterSyncOptions struct {
	DryRun bool // 只计算不落库
}

// DreamRouterPriceLine 是同一口径下的一组价格，单位：
//   - 按量/分层计费：美元 / 1M tokens
//   - 按次计费：美元 / 次
//
// 上游、uter 两侧都用这个结构，才能在同一行里逐维度对照（输入/输出/缓存…），
// 而不是只比一个标量。
type DreamRouterPriceLine struct {
	Input       float64 `json:"input"`
	Output      float64 `json:"output"`
	Cache       float64 `json:"cache"`
	CreateCache float64 `json:"create_cache"`
}

// DreamRouterModelChange 描述单个模型的目标值。
type DreamRouterModelChange struct {
	Name             string  `json:"name"`
	VendorName       string  `json:"vendor_name,omitempty"`
	GroupRatio       float64 `json:"group_ratio"`     // 创梦 default 组倍率 r
	BillingClass     string  `json:"billing_class"`   // per_token / per_call / tiered / tiered_unparsable
	OldModelRatio    float64 `json:"old_model_ratio"` // 0 表示此前未配置
	NewModelRatio    float64 `json:"new_model_ratio"`
	OldModelPrice    float64 `json:"old_model_price"` // 0 表示此前未配置
	NewModelPrice    float64 `json:"new_model_price"`
	CompletionRatio  float64 `json:"completion_ratio"`   // 目标 CompletionRatio
	CacheRatio       float64 `json:"cache_ratio"`        // 目标 CacheRatio
	CreateCacheRatio float64 `json:"create_cache_ratio"` // 目标 CreateCacheRatio
	RatioChanged     bool    `json:"ratio_changed"`
	PriceChanged     bool    `json:"price_changed"`
	// NewBillingExpr 是分层计费模型要写入 billing_expr 的目标表达式
	// （上游官方表达式 × 价格规则系数）。空表示本次不改表达式。
	NewBillingExpr string `json:"new_billing_expr,omitempty"`
	// BillingExprChanged 表示目标表达式与库中现值不同。
	BillingExprChanged bool `json:"billing_expr_changed"`
	// ClearBillingExpr 表示上游不是表达式计费、而本地残留了表达式覆盖，
	// 本次会删掉该覆盖，让模型回到倍率计费（否则残留表达式会一直压过倍率）。
	ClearBillingExpr bool `json:"clear_billing_expr,omitempty"`
	// Official 是上游的官方基准价（未打折的目录价），Upstream 是上游按用户组
	// 折扣后的售价（官方 × r）。两者都按本次同步的上游数据计算，供定价页
	// 参照与对照表使用。
	Official DreamRouterPriceLine `json:"official"`
	Upstream DreamRouterPriceLine `json:"upstream"`
	// Factor 是价格规则作用后的系数（increase: r+amount / decrease: r-amount），
	// uter 目标价 = Official × Factor。
	Factor float64 `json:"factor"`
}

// DreamRouterModelRow 是管理端对照表的一行：上游与 uter 的同一模型。
//
// Uter 侧价格读的是**落库后的现值**（而不是本次计算的目标值），因此这一行
// 既是「卖多少钱」的展示，也是「有没有真的写进去」的运行时证据。
type DreamRouterModelRow struct {
	UpstreamName string `json:"upstream_name"`
	// LocalName 是渠道 model_mapping 把上游名映射成的 uter 模型名；
	// 未配置映射时与上游同名。
	LocalName    string `json:"local_name"`
	BillingClass string `json:"billing_class"`
	QuotaType    int    `json:"quota_type"`
	// GroupRatio 是上游该模型所属用户组的折扣倍率 r。
	GroupRatio float64 `json:"group_ratio"`
	// Official / Upstream / Uter 三个价格行同口径，便于逐维度对照。
	Official DreamRouterPriceLine `json:"official"`
	Upstream DreamRouterPriceLine `json:"upstream"`
	Uter     DreamRouterPriceLine `json:"uter"`
	// 折扣比率：1 - 售价/官方价，单位百分比（-40 表示 -40%）。
	UpstreamDiscountPercent float64 `json:"upstream_discount_percent"`
	UterDiscountPercent     float64 `json:"uter_discount_percent"`
	// 折数：0.6 → 6 折（中文界面展示用）。
	UpstreamZhe float64 `json:"upstream_zhe"`
	UterZhe     float64 `json:"uter_zhe"`
	// Aligned 表示 uter 现值与「官方价 × 规则系数」一致（容差 1e-9 相对误差）。
	Aligned bool `json:"aligned"`
	// Note 记录无法比对的维度（例如 billing_expr 解析失败、上游时段折扣）。
	Note string `json:"note,omitempty"`
}

// DreamRouterSnapshot 是最近一次成功同步的完整价格快照。
type DreamRouterSnapshot struct {
	PricingVersion string                `json:"pricing_version"`
	SyncedAt       time.Time             `json:"synced_at"`
	RuleDirection  string                `json:"rule_direction"`
	RuleAmount     float64               `json:"rule_amount"`
	ChannelID      int                   `json:"channel_id"`
	Models         []DreamRouterModelRow `json:"models"`
}

// DreamRouterSkippedModel 记录「上游 /api/pricing 有记录、但不是上游在售模型」
// 而被同步排除的条目。
//
// 在售判据是**分组可售性**（`enable_groups` 与上游 `usable_group` 有交集），
// 不是「有没有挂供应商」：上游存在没有 vendor_id 却照常在定价页展示、照常
// 可调用的模型（实测 2026-10-28：MiniMax-M2.5），按 vendor 排除会把它连同
// 价格一起永久挡在同步之外。
type DreamRouterSkippedModel struct {
	Name   string `json:"name"`
	Reason string `json:"reason"`
}

// DreamRouterSyncResult 汇总一次同步的结果。
type DreamRouterSyncResult struct {
	StartedAt     time.Time `json:"started_at"`
	FinishedAt    time.Time `json:"finished_at"`
	DryRun        bool      `json:"dry_run"`
	PricingVer    string    `json:"pricing_version"`
	UpstreamCount int       `json:"upstream_count"`
	// OfferedCount 是上游**在售**模型数（data[] 里挂了可售分组、能写进渠道的
	// 记录）。它与 UpstreamCount 的差额就是 SkippedModels 的条数：上游 data[]
	// 里混着一些挂不到任何可售分组的记录，定价页不展示、也无法调用，
	// 绝不能同步进渠道。**「没有 vendor_id」不是排除理由**——上游确实有
	// 这类模型在卖（见 dreamRouterOfferedReason）。
	OfferedCount  int                      `json:"offered_count"`
	Changes       []DreamRouterModelChange `json:"changes"`
	AddedModels   []string                 `json:"added_models"`   // 上游有、渠道 models 缺
	RemovedModels []string                 `json:"removed_models"` // 渠道 models 多、上游无
	// SkippedModels 是上游 data[] 里存在、但未被视为在售模型的记录（孤儿
	// vendor 记录）。它们既不会进渠道模型清单，也不会写价格。
	SkippedModels []DreamRouterSkippedModel `json:"skipped_models,omitempty"`
	Applied       bool                      `json:"applied"`
	Warnings      []string                  `json:"warnings"`
	// Verified 是落库后复核通过的模型数（目标值与库中现值逐项一致），
	// Misaligned 列出复核不一致的模型（含期望值与实际值）。
	// 两者共同构成「与上游完全对齐」的运行时证据：Verified == VerifiableCount
	// 且 Misaligned 为空，才算本轮完全对齐。
	Verified int `json:"verified"`
	// VerifiableCount 是参与复核的模型数。它是复核的分母，而不是
	// UpstreamCount——上游 data[] 里的孤儿记录不会同步，tiered_unparsable
	// 的模型没有可写单价，两者都不该算作「未对齐」。
	VerifiableCount int      `json:"verifiable_count"`
	Misaligned      []string `json:"misaligned,omitempty"`
}

// DreamRouterSyncConfig 是同步任务的运行配置（来自 option）。
type DreamRouterSyncConfig struct {
	Enabled   bool
	ChannelID int
	Username  string
	Password  string
	Step      float64
	// Provider 上游渠道标识（目前仅创梦 dreamrouter）。
	Provider string
	// RuleDirection 价格规则方向：increase 加价 / decrease 降价。
	RuleDirection string
	// RuleAmount 价格规则幅度（折数，0-1）。0 表示不加不减。
	RuleAmount float64
}

// LoadDreamRouterSyncConfig 从 option 读取配置，未配置时用内置默认值。
//
// 口令（DreamRouterSyncPassword）**没有明文兜底**：未配置时返回空串，由
// SyncDreamRouterPricing 报错提示去后台配置，绝不在此处回退到硬编码密钥。
func LoadDreamRouterSyncConfig() DreamRouterSyncConfig {
	cfg := DreamRouterSyncConfig{
		Enabled:       true,
		ChannelID:     dreamRouterDefaultChannelID,
		Username:      dreamRouterDefaultUsername,
		Password:      "",
		Step:          dreamRouterDefaultStep,
		Provider:      DreamRouterProviderDreamRouter,
		RuleDirection: DreamRouterRuleDirectionIncrease,
		RuleAmount:    dreamRouterDefaultStep,
	}
	if v := strings.TrimSpace(common.OptionMap[dreamRouterSyncEnabledKey]); v != "" {
		cfg.Enabled = v == "true"
	}
	if v := strings.TrimSpace(common.OptionMap[dreamRouterSyncChannelIDKey]); v != "" {
		if id, err := strconv.Atoi(v); err == nil && id > 0 {
			cfg.ChannelID = id
		}
	}
	if v := strings.TrimSpace(common.OptionMap[dreamRouterSyncUsernameKey]); v != "" {
		cfg.Username = v
	}
	if v := strings.TrimSpace(common.OptionMap[dreamRouterSyncPasswordKey]); v != "" {
		cfg.Password = v
	}
	if v := strings.TrimSpace(common.OptionMap[dreamRouterSyncStepKey]); v != "" {
		if step, err := strconv.ParseFloat(v, 64); err == nil && step > 0 && step < 1 {
			cfg.Step = step
		}
	}
	// ── 渠道登录与同步：以下几项由前端设置区写入 ──
	if v := strings.TrimSpace(common.OptionMap[dreamRouterSyncProviderKey]); v != "" {
		cfg.Provider = v
	}
	if v := strings.TrimSpace(common.OptionMap[dreamRouterSyncRuleDirectionKey]); v != "" {
		switch v {
		case DreamRouterRuleDirectionIncrease, DreamRouterRuleDirectionDecrease:
			cfg.RuleDirection = v
		}
	}
	if v := strings.TrimSpace(common.OptionMap[dreamRouterSyncRuleAmountKey]); v != "" {
		if amount, err := strconv.ParseFloat(v, 64); err == nil && amount >= 0 && amount < 1 {
			cfg.RuleAmount = amount
		}
	}
	// 向后兼容：历史部署只配了 DreamRouterSyncStep（固定加价 0.1），没有配
	// 新的规则方向/幅度。此时沿用 step 作为加价幅度，保持既有价格不变——
	// 否则升级即改价，运营会在毫无感知的情况下被重新定价。
	if strings.TrimSpace(common.OptionMap[dreamRouterSyncRuleAmountKey]) == "" {
		cfg.RuleAmount = cfg.Step
	}
	return cfg
}

// dreamRouterRuleFactor 返回价格规则作用在「上游折后价倍率 r」上的系数。
//
//	increase（加价）：uter = 官方基准 × (r + amount)
//	decrease（降价）：uter = 官方基准 × (r - amount)
//
// 降价时 r - amount 必须仍为正——若上游折扣已很浅（r 接近 amount），
// 结果会 ≤ 0，价格无意义。此时返回 0 并由调用方跳过该模型（宁可不改价，
// 也不写成负价或零价）。
func dreamRouterRuleFactor(r, amount float64, direction string) float64 {
	if direction == DreamRouterRuleDirectionDecrease {
		factor := r - amount
		if factor <= 0 {
			return 0
		}
		return factor
	}
	return r + amount
}

// dreamRouterGroupRatio 复算 default 组对某模型的实际倍率 r。
// 规则已用 63/63 个模型的页面折扣徽标逐一验证：
//
//	r = min{ 组倍率 : 组 ∈ enableGroups }
//	组倍率优先取 userGroupRatio[组]（group_group_ratio["default"]），
//	缺失回退 groupRatio[组]；全缺失时 r = 1（不打折）。
func dreamRouterGroupRatio(enableGroups []string, userGroupRatio, groupRatio map[string]float64) float64 {
	r := 1.0
	found := false
	for _, g := range enableGroups {
		v, ok := userGroupRatio[g]
		if !ok {
			v, ok = groupRatio[g]
		}
		if !ok {
			continue
		}
		if !found || v < r {
			r = v
			found = true
		}
	}
	return r
}

// dreamRouterVendorIndex 把上游 vendors[] 整理成 vendor_id → 名称。
//
// 上游 /api/pricing 的 data[] 里，vendor_id 可能缺失（字段不存在）或指向
// 一个已从 vendors[] 删除的供应商。这类记录在上游定价页无法归组，也就不会
// 展示；同步必须按同一口径判定「上游有没有这个模型」，否则会凭空多出模型。
func dreamRouterVendorIndex(vendors []dreamRouterVendor) map[int]string {
	index := make(map[int]string, len(vendors))
	for _, vendor := range vendors {
		if vendor.ID <= 0 {
			continue
		}
		index[vendor.ID] = vendor.Name
	}
	return index
}

// dreamRouterOfferedReason 判断一条上游记录是否属于「上游在售模型」。
//
// 判据是**能不能买到**，不是「有没有挂供应商」：
//
//   - `enable_groups` 为空 → 没有任何用户组能调用它，上游页也不会展示；
//   - `enable_groups` 与上游 `usable_group` 无交集 → 它挂的分组已下线；
//   - 其余一律视为在售。
//
// `usable_group` 缺失时一律放行：那是上游响应结构变化，不是「全部下架」，
// 宁可沿用旧口径，也不能把整张价格表清空。
//
// 🔴 **vendor 不参与判定**。历史实现要求 `vendor_id` 必须出现在 `vendors[]`
// 里，理由是「没有 vendor 的记录上游定价页不展示」——这条理由是错的。实测
// 2026-10-28：MiniMax-M2.5 是唯一一条没有 vendor_id 的记录，而上游定价页
// 照常展示它（-5%，输入 $0.285/1M、输出 $1.14/1M），也照常可调用。按 vendor
// 判定会让它每次同步都被跳过：价格冻结在某个历史值，快照与后台对照表里
// 永远少一条，运营看到的就是「这个模型和它的价格信息一直没同步过来」。
//
// 返回 ok=false 时 reason 说明排除原因，调用方据此写进同步结果供审计。
func dreamRouterOfferedReason(rec dreamRouterRecord, usableGroups map[string]string) (bool, string) {
	if len(rec.EnableGroups) == 0 {
		return false, "上游记录没有 enable_groups：没有任何用户组能调用该模型"
	}
	if len(usableGroups) == 0 {
		return true, ""
	}
	for _, group := range rec.EnableGroups {
		if _, ok := usableGroups[group]; ok {
			return true, ""
		}
	}
	return false, fmt.Sprintf("上游记录的 enable_groups %v 与 usable_group 无交集：该模型挂的分组已下线",
		rec.EnableGroups)
}

// dreamRouterComputeTarget 按计费类别计算 uter 目标值。
//
// factor 是价格规则作用后的倍率系数（见 dreamRouterRuleFactor）：
// 加价 = r + amount，降价 = r - amount。它替代了历史的固定 (r + step)。
func dreamRouterComputeTarget(rec dreamRouterRecord, r, factor float64) DreamRouterModelChange {
	change := DreamRouterModelChange{
		Name:       rec.ModelName,
		GroupRatio: r,
		Factor:     factor,
	}
	switch {
	case rec.BillingExpr != "":
		// C 类：分层计费。官方单价直接取自表达式里的 p/c/cr/cc 系数，
		// 不再依赖页面抓取基线（见 dreamrouter_pricing_expr.go）。
		change.BillingClass = "tiered"
		prices, ok := dreamRouterOfficialUnitPrices(rec.BillingExpr)
		if !ok {
			// C2 类：按秒计费的视频模型（wan3.0-video 等，ali-video 端点）。
			// 表达式形如 tier("720p", (duration > 0 ? duration : 5) * 0.0895522)，
			// 官方单价 = 兜底档（默认分辨率）的美元/秒。uter 的 billingexpr
			// 运行时完整支持 duration/tier/param，上游表达式缩放后可原样落库。
			perSec, durOK := dreamRouterDurationUnitPrices(rec.BillingExpr)
			if !durOK {
				// 表达式结构无法解析：宁可不改价，也不套错公式。
				change.BillingClass = "tiered_unparsable"
				return change
			}
			// 倍率只做兜底与展示：上游给了名义 model_ratio，随规则系数
			// 同步缩放，保证表达式落库失败时仍有与上游一致的兜底价。
			change.NewModelRatio = roundRatioValue(rec.ModelRatio * factor)
			// 官方单价行只填 Input（美元/秒），对照表与对齐复核都以它为基准：
			// 本地落库后的表达式解出的同档系数 ≈ 上游系数 × factor 即对齐。
			change.Official = DreamRouterPriceLine{Input: perSec.Input}
			// 表达式才是这类模型的真实计价来源（见下方 token 分支的说明）。
			if scaled, scaledOK := dreamRouterScaleExpr(rec.BillingExpr, factor); scaledOK {
				change.NewBillingExpr = scaled
			}
			change.Upstream = scaleDreamRouterPriceLine(change.Official, r)
			return change
		}
		change.NewModelRatio = roundRatioValue(prices.Input / 2 * factor)
		if prices.Output > 0 {
			change.CompletionRatio = prices.Output / prices.Input
		}
		// 缓存倍率优先取上游记录里的比值（与定价页展示同口径），
		// 记录未给出时按表达式里的 cr/cc 相对输入价换算。
		change.CacheRatio = rec.CacheRatio
		if change.CacheRatio <= 0 && prices.Cache > 0 {
			change.CacheRatio = prices.Cache / prices.Input
		}
		change.CreateCacheRatio = rec.CreateCacheRatio
		if change.CreateCacheRatio <= 0 && prices.CreateCache > 0 {
			change.CreateCacheRatio = prices.CreateCache / prices.Input
		}
		change.Official = DreamRouterPriceLine{
			Input:       prices.Input,
			Output:      prices.Output,
			Cache:       prices.Cache,
			CreateCache: prices.CreateCache,
		}
		if change.Official.Cache <= 0 {
			change.Official.Cache = prices.Input * change.CacheRatio
		}
		if change.Official.CreateCache <= 0 {
			change.Official.CreateCache = prices.Input * change.CreateCacheRatio
		}
		// 表达式才是这类模型的真实计价来源：把上游官方表达式按同一个价格
		// 规则系数缩放后写回 billing_expr。只写 ModelRatio 的话，运行时与
		// 定价页读到的仍然是上游目录价——「价格没同步、折扣不显示」的根因。
		if scaled, scaledOK := dreamRouterScaleExpr(rec.BillingExpr, factor); scaledOK {
			change.NewBillingExpr = scaled
		}
	case rec.QuotaType != 0:
		// B 类：按次计费（美元/次）。
		change.BillingClass = "per_call"
		change.NewModelPrice = roundRatioValue(rec.ModelPrice * factor)
		change.Official = DreamRouterPriceLine{Input: rec.ModelPrice}
	default:
		// A 类：按量计费。
		change.BillingClass = "per_token"
		change.NewModelRatio = roundRatioValue(rec.ModelRatio * factor)
		change.CompletionRatio = rec.CompletionRatio
		change.CacheRatio = rec.CacheRatio
		change.CreateCacheRatio = rec.CreateCacheRatio
		change.Official = DreamRouterPriceLine{
			Input:       rec.ModelRatio * 2,
			Output:      rec.ModelRatio * 2 * rec.CompletionRatio,
			Cache:       rec.ModelRatio * 2 * rec.CacheRatio,
			CreateCache: rec.ModelRatio * 2 * rec.CreateCacheRatio,
		}
	}
	change.Upstream = scaleDreamRouterPriceLine(change.Official, r)
	return change
}

// scaleDreamRouterPriceLine 按倍率缩放一组价格（官方价 → 折后价）。
func scaleDreamRouterPriceLine(line DreamRouterPriceLine, factor float64) DreamRouterPriceLine {
	return DreamRouterPriceLine{
		Input:       roundRatioValue(line.Input * factor),
		Output:      roundRatioValue(line.Output * factor),
		Cache:       roundRatioValue(line.Cache * factor),
		CreateCache: roundRatioValue(line.CreateCache * factor),
	}
}

// roundRatioValue 统一倍率精度，避免 JSON 里出现 1e-17 之类的浮点噪声。
func roundRatioValue(v float64) float64 {
	if v == 0 || math.IsNaN(v) || math.IsInf(v, 0) {
		return v
	}
	return math.Round(v*1e10) / 1e10
}

// dreamRouterLogin 用账号密码登录上游，返回带 session cookie 的客户端。
func dreamRouterLogin(ctx context.Context, username, password string) (*http.Client, error) {
	jar, err := cookiejar.New(nil)
	if err != nil {
		return nil, err
	}
	client := &http.Client{Jar: jar, Timeout: dreamRouterHTTPTimeout}

	body, _ := json.Marshal(map[string]string{"username": username, "password": password})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, dreamRouterBaseURL+dreamRouterLoginPath, strings.NewReader(string(body)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("login dreamrouter: %w", err)
	}
	defer resp.Body.Close()

	var loginResp struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&loginResp); err != nil {
		return nil, fmt.Errorf("decode dreamrouter login response: %w", err)
	}
	if !loginResp.Success {
		return nil, fmt.Errorf("dreamrouter login rejected: %s", loginResp.Message)
	}
	return client, nil
}

// dreamRouterFetchPricing 拉取上游全量定价数据。
func dreamRouterFetchPricing(ctx context.Context, client *http.Client) (*dreamRouterPayload, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, dreamRouterBaseURL+dreamRouterPricingPath, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch dreamrouter pricing: %w", err)
	}
	defer resp.Body.Close()

	var payload dreamRouterPayload
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("decode dreamrouter pricing: %w", err)
	}
	if !payload.Success {
		return nil, fmt.Errorf("dreamrouter pricing responded success=false")
	}
	if len(payload.Data) == 0 {
		return nil, fmt.Errorf("dreamrouter pricing returned no models")
	}
	return &payload, nil
}

// dreamRouterSyncMu 进程内互斥：同步全程是「读内存 ratio option → 合并 →
// 整包写回」的读-改-写序列，无锁时手动触发（管理员按钮）可与定时 tick 并发，
// 后写者会把先写者的价格改动整个覆盖（Last-Writer-Wins）。用 TryLock 而非
// Lock：管理员手动触发撞上正在进行的同步时应立刻得到明确报错，而不是挂住
// HTTP 请求等上游登录+全量拉取结束。
var dreamRouterSyncMu sync.Mutex

// SyncDreamRouterPricing 执行一次同步：登录上游、拉取定价、按「+1 折」
// 规则重算 uter 侧倍率，并让聚合渠道的模型清单与上游保持一致。
//
// DryRun 模式下只计算差异，不写 option、不动渠道。
func SyncDreamRouterPricing(ctx context.Context, opts DreamRouterSyncOptions) (*DreamRouterSyncResult, error) {
	if !dreamRouterSyncMu.TryLock() {
		return nil, fmt.Errorf("dreamrouter sync is already in progress; wait for the running sync to finish")
	}
	defer dreamRouterSyncMu.Unlock()

	cfg := LoadDreamRouterSyncConfig()
	if !cfg.Enabled {
		return nil, fmt.Errorf("dreamrouter sync is disabled (option %s=false)", dreamRouterSyncEnabledKey)
	}
	// 口令必须由部署方在后台配置（option DreamRouterSyncPassword，secret 键）。
	// 源码里不再保留明文兜底，因此这里显式拦一次：否则会拿空口令去打上游
	// 登录接口，得到一个含义不明的「login rejected」，排查方向会被带偏。
	if strings.TrimSpace(cfg.Password) == "" {
		return nil, fmt.Errorf("dreamrouter sync is not configured: option %s is empty; set it in system settings (secret option, never committed to source)", dreamRouterSyncPasswordKey)
	}

	result := &DreamRouterSyncResult{
		StartedAt: time.Now(),
		DryRun:    opts.DryRun,
	}

	client, err := dreamRouterLogin(ctx, cfg.Username, cfg.Password)
	if err != nil {
		return nil, err
	}
	payload, err := dreamRouterFetchPricing(ctx, client)
	if err != nil {
		return nil, err
	}

	result.PricingVer = payload.PricingVersion
	result.UpstreamCount = len(payload.Data)

	userGroupRatio := payload.GroupGroupRatio[dreamRouterDefaultGroup]
	if userGroupRatio == nil {
		return nil, fmt.Errorf("dreamrouter pricing has no group mapping for %q", dreamRouterDefaultGroup)
	}

	// 1) 逐模型计算目标值，并与 uter 现值对比。
	upstreamNames := make(map[string]struct{}, len(payload.Data))
	upstreamVendor := make(map[string]string, len(payload.Data))
	vendorNames := dreamRouterVendorIndex(payload.Vendors)
	modelRatio := ratio_setting.GetModelRatioCopy()
	modelPrice := ratio_setting.GetModelPriceCopy()
	// CompletionRatio/CacheRatio 是比值，「+1 折」加成系数会约掉，
	// 无需与现值对比——目标值直接取上游基准（见 dreamRouterComputeTarget）。

	// 单条记录的 pricing_version 与顶层不一致只作为信息记录，**不再跳过该模型**。
	//
	// 历史实现在这里 continue，理由是「上游数据可能正在写入」。实测（2026-10-26）
	// 69 条记录里 68 条根本不带 pricing_version、1 条带的是旧版本号，于是那条
	// 记录每次同步都被跳过——价格永久停在某个历史值，运营看到的现象就是
	// 「这个模型的折扣一直没同步过来」。记录级的版本号在上游是「最后修改版本」
	// 语义，不代表该条数据不完整，跳过它只会造成永久不对齐。
	var staleVersionNames []string
	// 上游没挂供应商的在售模型（不影响可售性，只记告警）。
	var missingVendorModels []string

	for i := range payload.Data {
		rec := payload.Data[i]
		// 上游 data[] ≠ 在售模型清单：判据是「有没有可调用的分组」，
		// 不是「有没有挂供应商」（见 dreamRouterOfferedReason）。
		if offered, reason := dreamRouterOfferedReason(rec, payload.UsableGroup); !offered {
			result.SkippedModels = append(result.SkippedModels, DreamRouterSkippedModel{
				Name:   rec.ModelName,
				Reason: reason,
			})
			continue
		}
		upstreamNames[rec.ModelName] = struct{}{}
		vendorName := vendorNames[rec.VendorID]
		if vendorName != "" {
			upstreamVendor[rec.ModelName] = vendorName
		} else if len(vendorNames) > 0 {
			// 上游没给这个模型挂供应商（vendor_id 缺失或悬空）。它不影响
			// 可售性与价格，只影响上游页的分组展示；记一条告警供运营核对，
			// 但**不能**因此跳过——跳过就等于价格永久冻结。
			missingVendorModels = append(missingVendorModels, rec.ModelName)
		}
		if rec.PricingVersion != "" && rec.PricingVersion != payload.PricingVersion {
			staleVersionNames = append(staleVersionNames, rec.ModelName)
		}
		r := dreamRouterGroupRatio(rec.EnableGroups, userGroupRatio, payload.GroupRatio)
		// 价格规则：加价 = r + amount，降价 = r - amount。
		factor := dreamRouterRuleFactor(r, cfg.RuleAmount, cfg.RuleDirection)
		if factor <= 0 {
			// 降价幅度超过上游折扣本身，算出的价格无意义（≤0）。
			// 宁可不改这个模型的价，也不写入负价/零价。
			result.Warnings = append(result.Warnings,
				fmt.Sprintf("模型 %s 的降价规则结果非正（上游折扣 %.4f，降价幅度 %.4f），已跳过不改价",
					rec.ModelName, r, cfg.RuleAmount))
			continue
		}
		change := dreamRouterComputeTarget(rec, r, factor)
		change.VendorName = vendorNames[rec.VendorID]
		change.OldModelRatio = modelRatio[rec.ModelName]
		change.OldModelPrice = modelPrice[rec.ModelName]

		if change.BillingClass == "tiered_unparsable" {
			result.Warnings = append(result.Warnings,
				fmt.Sprintf("模型 %s 的 billing_expr 无法解析出官方单价，已跳过不改价：%s",
					rec.ModelName, truncateExprForLog(rec.BillingExpr)))
		}
		if rec.BillingExpr != "" && dreamRouterExprHasTimeDiscount(rec.BillingExpr) {
			result.Warnings = append(result.Warnings,
				fmt.Sprintf("模型 %s 上游含时段折扣（夜间/周末浮动），uter 倍率按基准价写入，不随上游时段浮动",
					rec.ModelName))
		}

		// 分层计费模型的真实价格在 billing_expr 里：这里把目标表达式与库中
		// 现值比对，并记录「上游不是表达式计费、本地却残留了覆盖」的反向情况。
		currentExpr, hasConfiguredExpr := billing_setting.ConfiguredBillingExpr(rec.ModelName)
		switch change.BillingClass {
		case "tiered":
			if change.NewBillingExpr == "" {
				result.Warnings = append(result.Warnings,
					fmt.Sprintf("模型 %s 的上游 billing_expr 没有可缩放的计价项，已跳过不改表达式：%s",
						rec.ModelName, truncateExprForLog(rec.BillingExpr)))
				break
			}
			change.BillingExprChanged = !hasConfiguredExpr ||
				strings.TrimSpace(currentExpr) != strings.TrimSpace(change.NewBillingExpr) ||
				billing_setting.GetBillingMode(rec.ModelName) != billing_setting.BillingModeTieredExpr
		case "per_token", "per_call":
			// 上游按倍率/按次计费，本地却留着表达式覆盖 → 表达式会一直压过
			// 倍率，价格永远对不上上游。本次清掉这条覆盖。
			if hasConfiguredExpr || billing_setting.ConfiguredBillingMode(rec.ModelName) == billing_setting.BillingModeTieredExpr {
				change.ClearBillingExpr = true
			}
		}

		if change.BillingClass == "per_token" || change.BillingClass == "tiered" {
			if change.NewModelRatio > 0 {
				change.RatioChanged = !nearlyEqualSync(change.OldModelRatio, change.NewModelRatio)
			}
		}
		if change.BillingClass == "per_call" {
			if change.NewModelPrice > 0 {
				change.PriceChanged = !nearlyEqualSync(change.OldModelPrice, change.NewModelPrice)
			}
		}
		result.Changes = append(result.Changes, change)
	}
	result.OfferedCount = len(result.Changes)

	// 规则系数 > 1 意味着 uter 售价高于上游的**官方目录价**：这不是对齐
	// 失败（公式就是这么算的），而是「加价幅度 > 上游折扣幅度」导致的定价
	// 事实——卡片上不会出现折扣徽标，因为确实没有折扣。列出来供运营决策，
	// 绝不在这里静默改价。
	if above := dreamRouterModelsPricedAboveOfficial(result.Changes); len(above) > 0 {
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("以下模型按当前规则（%s %.2f）算出的售价高于上游官方目录价，定价页不会显示折扣，请确认是否调整加价幅度：%s",
				cfg.RuleDirection, cfg.RuleAmount, strings.Join(above, ", ")))
	}

	if len(staleVersionNames) > 0 {
		sort.Strings(staleVersionNames)
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("以下模型记录的 pricing_version 与顶层不一致，已按记录现值同步（不再跳过）：%s",
				strings.Join(staleVersionNames, ", ")))
	}

	if len(missingVendorModels) > 0 {
		sort.Strings(missingVendorModels)
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("以下模型在上游 vendors[] 中没有供应商归属（vendor_id 缺失或指向已删除供应商），已按分组可售性正常同步价格；它们在站内的供应商归属以模型元数据为准：%s",
				strings.Join(missingVendorModels, ", ")))
	}

	// 2) 渠道模型清单 diff（增删）。
	channel, err := model.GetChannelById(cfg.ChannelID, true)
	if err != nil {
		return nil, fmt.Errorf("load channel %d: %w", cfg.ChannelID, err)
	}
	if channel == nil {
		return nil, fmt.Errorf("channel %d not found", cfg.ChannelID)
	}
	existing := map[string]struct{}{}
	for _, name := range channel.GetModels() {
		existing[name] = struct{}{}
	}
	for name := range upstreamNames {
		if _, ok := existing[name]; !ok {
			result.AddedModels = append(result.AddedModels, name)
		}
	}
	for name := range existing {
		if _, ok := upstreamNames[name]; !ok {
			result.RemovedModels = append(result.RemovedModels, name)
		}
	}
	sort.Strings(result.AddedModels)
	sort.Strings(result.RemovedModels)

	result.FinishedAt = time.Now()

	if opts.DryRun {
		return result, nil
	}

	// 3) 落库：倍率 option（内存 Map 合并后整体写回）。
	newModelRatio := map[string]float64{}
	newModelPrice := map[string]float64{}
	newCompletionRatio := map[string]float64{}
	newCacheRatio := map[string]float64{}
	newCreateCacheRatio := map[string]float64{}
	// C 类（tiered）模型在创梦侧由 billing_expr 动态计费，uter 侧用
	// 官方单价折算的倍率表达。历史上按 1:1 直卖写入的 ModelPrice（如
	// gpt-image-2 的 0.211）会遮蔽新倍率——GetModelPrice 键存在即
	// usePrice=true，且写 0 会触发「免费模型」逻辑，必须整键删除。
	stalePriceNames := map[string]struct{}{}

	for _, change := range result.Changes {
		switch change.BillingClass {
		case "per_token", "tiered":
			if change.NewModelRatio > 0 {
				newModelRatio[change.Name] = change.NewModelRatio
			}
			if change.CompletionRatio > 0 {
				newCompletionRatio[change.Name] = change.CompletionRatio
			}
			if change.CacheRatio > 0 {
				newCacheRatio[change.Name] = change.CacheRatio
			}
			if change.CreateCacheRatio > 0 {
				newCreateCacheRatio[change.Name] = change.CreateCacheRatio
			}
			if change.BillingClass == "tiered" {
				stalePriceNames[change.Name] = struct{}{}
			}
		case "per_call":
			if change.NewModelPrice > 0 {
				newModelPrice[change.Name] = change.NewModelPrice
			}
		}
	}

	if err := applyRatioOptions(newModelRatio, newModelPrice, newCompletionRatio, newCacheRatio, newCreateCacheRatio, stalePriceNames); err != nil {
		return nil, err
	}
	// 3b) 落库：分层计费模型的 billing_expr / billing_mode。
	//     必须单独一次写：它带表达式编译校验，失败时只影响这些模型，
	//     不会把上一步已经提交的倍率一起回滚（倍率是这些模型的兜底价）。
	if err := applyBillingExprOptions(result); err != nil {
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("写入 billing_expr 失败，分层计费模型仍按原表达式计价：%v", err))
	}

	// 4) 渠道 models 对齐上游；清掉已不在上游的 mapping 条目。
	if err := applyChannelModels(channel, upstreamNames); err != nil {
		return nil, err
	}

	result.Applied = true
	// 5) 落库后复核：把库里的现值与本次目标值逐项比对，作为「与上游完全
	//    对齐」的证据随结果返回（Verified == VerifiableCount 即全对齐）。
	verifyDreamRouterAlignment(result)
	saveDreamRouterSyncStatus(result, "")

	// 6) 逐模型价格快照：定价页的「官方价格 / 折扣徽标」与后台对照表都以它
	//    为唯一参照，因此必须在倍率落库之后写（Uter 侧取的是库中现值）。
	saveDreamRouterSnapshot(buildDreamRouterSnapshot(result, cfg, channel))

	// 7) 通知外部（模型元数据 + 多语描述补齐）。价格同步只管钱，
	//    模型卡片上的描述与图标由 controller 注册的钩子负责，避免
	//    service 反向依赖 controller。
	runPricingPostSyncHook(upstreamModels(upstreamNames, upstreamVendor))
	return result, nil
}

// upstreamModels 把上游模型名与供应商名整理成后置钩子的输入。
func upstreamModels(names map[string]struct{}, vendors map[string]string) []SyncedModelMeta {
	models := make([]SyncedModelMeta, 0, len(names))
	for name := range names {
		models = append(models, SyncedModelMeta{Name: name, VendorName: vendors[name]})
	}
	sort.Slice(models, func(i, j int) bool { return models[i].Name < models[j].Name })
	return models
}

// applyBillingExprOptions 把分层计费模型的目标表达式写回 billing_expr，
// 并清掉「上游已不是表达式计费」的残留覆盖。
//
// 为什么必须写表达式：分层计费模型的运行时计价与定价页展示都只读
// billing_expr，ModelRatio 对它们不参与计价。历史同步只写倍率，于是这些
// 模型（gemini-2.5-pro、gpt-6-astra、gpt-5.6-* …）的售价永远停在上游目录价，
// 卡片上「优特」与「官方」两行数字相同、折扣徽标也不出现。
func applyBillingExprOptions(result *DreamRouterSyncResult) error {
	exprs := billing_setting.GetConfiguredBillingExprSnapshot()
	modes := billing_setting.GetConfiguredBillingModeSnapshot()

	changed := false
	for _, change := range result.Changes {
		switch {
		case change.BillingClass == "tiered" && change.BillingExprChanged && change.NewBillingExpr != "":
			exprs[change.Name] = change.NewBillingExpr
			modes[change.Name] = billing_setting.BillingModeTieredExpr
			changed = true
		case change.ClearBillingExpr:
			if _, ok := exprs[change.Name]; ok {
				delete(exprs, change.Name)
				changed = true
			}
			if modes[change.Name] == billing_setting.BillingModeTieredExpr {
				delete(modes, change.Name)
				changed = true
			}
		}
	}
	if !changed {
		return nil
	}

	updates := map[string]string{}
	encodedExpr, err := common.Marshal(exprs)
	if err != nil {
		return fmt.Errorf("marshal billing_expr: %w", err)
	}
	updates["billing_setting.billing_expr"] = string(encodedExpr)
	encodedMode, err := common.Marshal(modes)
	if err != nil {
		return fmt.Errorf("marshal billing_mode: %w", err)
	}
	updates["billing_setting.billing_mode"] = string(encodedMode)
	return model.UpdateModelPricingOptions(updates)
}

// buildDreamRouterSnapshot 把本次同步结果整理成逐模型对照快照。
//
// Uter 侧价格读的是**落库后的现值**（ratio_setting 内存表已在
// UpdateModelPricingOptions 中刷新），因此 Aligned 既能发现「公式算错」，
// 也能发现「算对了但没写进去」。
func buildDreamRouterSnapshot(result *DreamRouterSyncResult, cfg DreamRouterSyncConfig, channel *model.Channel) DreamRouterSnapshot {
	snapshot := DreamRouterSnapshot{
		PricingVersion: result.PricingVer,
		SyncedAt:       result.FinishedAt,
		RuleDirection:  cfg.RuleDirection,
		RuleAmount:     cfg.RuleAmount,
		ChannelID:      cfg.ChannelID,
		Models:         make([]DreamRouterModelRow, 0, len(result.Changes)),
	}
	localNames := channelModelMapping(channel)
	modelRatio := ratio_setting.GetModelRatioCopy()
	modelPrice := ratio_setting.GetModelPriceCopy()
	completionRatio := ratio_setting.GetCompletionRatioCopy()
	cacheRatio := ratio_setting.GetCacheRatioMap()
	createCacheRatio := ratio_setting.GetCreateCacheRatioCopy()

	for _, change := range result.Changes {
		row := DreamRouterModelRow{
			UpstreamName: change.Name,
			LocalName:    change.Name,
			BillingClass: change.BillingClass,
			GroupRatio:   change.GroupRatio,
			Official:     change.Official,
			Upstream:     change.Upstream,
		}
		if local, ok := localNames[change.Name]; ok && local != "" {
			row.LocalName = local
		}
		if change.BillingClass == "per_call" {
			row.QuotaType = 1
			row.Uter = DreamRouterPriceLine{Input: modelPrice[change.Name]}
		} else if change.BillingClass == "tiered" {
			// 分层计费模型的真实售价在 billing_expr 里，倍率只是兜底。
			// 对照表必须展示**实际计价**的那组数字，否则运营会看到一行
			// 「倍率算出来的价」和一行「上游官方价」，误以为已经对齐。
			if prices, ok := dreamRouterConfiguredUnitPrices(change.Name); ok {
				row.Uter = DreamRouterPriceLine{
					Input:       prices.Input,
					Output:      prices.Output,
					Cache:       prices.Cache,
					CreateCache: prices.CreateCache,
				}
			}
		}
		if row.Uter.Input <= 0 {
			ratio := modelRatio[change.Name]
			row.Uter = DreamRouterPriceLine{
				Input:       ratio * 2,
				Output:      ratio * 2 * completionRatio[change.Name],
				Cache:       ratio * 2 * cacheRatio[change.Name],
				CreateCache: ratio * 2 * createCacheRatio[change.Name],
			}
		}
		row.UpstreamDiscountPercent = discountPercent(row.Official.Input, row.Upstream.Input)
		row.UterDiscountPercent = discountPercent(row.Official.Input, row.Uter.Input)
		row.UpstreamZhe = zheOf(row.Upstream.Input, row.Official.Input)
		row.UterZhe = zheOf(row.Uter.Input, row.Official.Input)
		row.Aligned = dreamRouterRowAligned(change, row)
		if change.BillingClass == "tiered_unparsable" {
			row.Note = "billing_expr 无法解析出官方单价，未改价"
		}
		snapshot.Models = append(snapshot.Models, row)
	}
	sort.Slice(snapshot.Models, func(i, j int) bool {
		return snapshot.Models[i].UpstreamName < snapshot.Models[j].UpstreamName
	})
	return snapshot
}

// dreamRouterRowAligned 判定一行是否与「官方价 × 规则系数」一致。
//
// 只有参与改价的模型才可能对齐：表达式解析失败（tiered_unparsable）与
// 降价规则算出非正价格的模型本次没有写入，Uter 侧保持原值，一律标记为
// 未对齐，避免把「没动」误报成「已对齐」。
func dreamRouterRowAligned(change DreamRouterModelChange, row DreamRouterModelRow) bool {
	if change.BillingClass == "tiered_unparsable" || change.Factor <= 0 {
		return false
	}
	expected := change.Official.Input * change.Factor
	if expected <= 0 {
		return false
	}
	return nearlyEqualSync(row.Uter.Input, expected)
}

// dreamRouterConfiguredUnitPrices 读取模型当前生效的 billing_expr，并解出
// 其中的单价（美元 / 1M tokens、/ 次或按秒计费模型的 / 秒）。
// 没有表达式或解析不出单价时返回 ok=false。
func dreamRouterConfiguredUnitPrices(name string) (dreamRouterUnitPrices, bool) {
	expr, ok := billing_setting.GetBillingExpr(name)
	if !ok || strings.TrimSpace(expr) == "" {
		return dreamRouterUnitPrices{}, false
	}
	if prices, ok := dreamRouterOfficialUnitPrices(expr); ok {
		return prices, true
	}
	// 按秒计费的视频模型（wan3.0-video 等）：token 系数解不出来，
	// 兜底走 duration 计价项。
	return dreamRouterDurationUnitPrices(expr)
}

// discountPercent 返回售价相对官方价的折扣百分比（6 折 → 40）。
func discountPercent(official, actual float64) float64 {
	if official <= 0 || actual <= 0 || actual >= official {
		return 0
	}
	return roundRatioValue((1 - actual/official) * 100)
}

// zheOf 返回「折数」：0.6 → 6，0.75 → 7.5。official 缺失时按 10 折（不打折）。
func zheOf(actual, official float64) float64 {
	if official <= 0 || actual <= 0 {
		return 10
	}
	return roundRatioValue(actual / official * 10)
}

// channelModelMapping 解析渠道的 model_mapping（上游名 → 本地名）。
// 解析失败按「无映射」处理：对照表退化为上下游同名，不影响价格。
func channelModelMapping(channel *model.Channel) map[string]string {
	if channel == nil || channel.ModelMapping == nil || strings.TrimSpace(*channel.ModelMapping) == "" {
		return nil
	}
	var mapping map[string]string
	if err := common.UnmarshalJsonStr(*channel.ModelMapping, &mapping); err != nil {
		return nil
	}
	return mapping
}

// saveDreamRouterSnapshot 把快照写入 option。失败只记日志：快照是展示与
// 参照数据，写不进去不该让已经落库的价格同步变成失败。
func saveDreamRouterSnapshot(snapshot DreamRouterSnapshot) {
	raw, err := common.Marshal(snapshot)
	if err != nil {
		common.SysLog(fmt.Sprintf("marshal dreamrouter snapshot failed: %v", err))
		return
	}
	if err := model.UpdateOption(dreamRouterSyncSnapshotKey, string(raw)); err != nil {
		common.SysLog(fmt.Sprintf("persist dreamrouter snapshot failed: %v", err))
	}
}

// dreamRouterSnapshotCache 缓存最近一次解析成功的快照，避免公开定价页每次
// 请求都反序列化整份 JSON（67+ 行 × 数个字段）。key 是 option 原文，
// 原文变化即失效，无需显式清理。
var (
	dreamRouterSnapshotMu    sync.Mutex
	dreamRouterSnapshotRaw   string
	dreamRouterSnapshotValue *DreamRouterSnapshot
)

// LoadDreamRouterSnapshot 返回最近一次成功同步的快照（未同步过时返回 nil）。
func LoadDreamRouterSnapshot() *DreamRouterSnapshot {
	raw := strings.TrimSpace(common.OptionMap[dreamRouterSyncSnapshotKey])
	if raw == "" {
		return nil
	}
	dreamRouterSnapshotMu.Lock()
	defer dreamRouterSnapshotMu.Unlock()
	if raw == dreamRouterSnapshotRaw && dreamRouterSnapshotValue != nil {
		return dreamRouterSnapshotValue
	}
	var snapshot DreamRouterSnapshot
	if err := common.Unmarshal([]byte(raw), &snapshot); err != nil {
		return nil
	}
	dreamRouterSnapshotRaw = raw
	dreamRouterSnapshotValue = &snapshot
	return &snapshot
}

// LoadDreamRouterOfficialReference 把快照里的官方基准价换算成「倍率空间」
// （与 ratio 表同构：model_ratio 1 = $2 / 1M tokens），供定价页当官方价参照。
//
// 为什么由上游数据而不是外部预设来当参照：公开定价页的折扣徽标需要
// 「官方目录价」，而 basellm / models.dev 两个预设只覆盖公开模型。上游渠道
// 的私有/新发布模型在预设里查不到 → 卡片没有划线原价、也没有折扣徽标，
// 表现为「折扣没获取到」。快照里的官方价是上游自己的目录价，覆盖全部同步
// 模型，语义也最准。
func LoadDreamRouterOfficialReference() map[string]map[string]float64 {
	snapshot := LoadDreamRouterSnapshot()
	if snapshot == nil || len(snapshot.Models) == 0 {
		return nil
	}
	reference := make(map[string]map[string]float64, len(snapshot.Models))
	for _, row := range snapshot.Models {
		if row.Official.Input <= 0 {
			continue
		}
		entry := map[string]float64{}
		if row.QuotaType == 1 || row.BillingClass == "per_call" {
			// 按次计费：官方价就是 model_price（美元/次）。
			entry["model_price"] = row.Official.Input
			reference[row.LocalName] = entry
			if row.LocalName != row.UpstreamName {
				reference[row.UpstreamName] = entry
			}
			continue
		}
		entry["model_ratio"] = row.Official.Input / 2
		if row.Official.Output > 0 {
			entry["completion_ratio"] = row.Official.Output / row.Official.Input
		}
		if row.Official.Cache > 0 {
			entry["cache_ratio"] = row.Official.Cache / row.Official.Input
		}
		if row.Official.CreateCache > 0 {
			entry["create_cache_ratio"] = row.Official.CreateCache / row.Official.Input
		}
		reference[row.LocalName] = entry
		if row.LocalName != row.UpstreamName {
			reference[row.UpstreamName] = entry
		}
	}
	return reference
}

// applyRatioOptions 把目标倍率合并进现有 option 并写回。
// 走 model.UpdateModelPricingOptions（倍率类 option 的唯一写入路径：
// 单事务落库 + 刷新 option 内存 + RefreshPricing + 失效暴露缓存）。
// 只覆盖本次同步涉及的键，其他模型的既有配置原样保留。
// stalePriceNames 中的模型（C 类 tiered）会从 ModelPrice 整键删除，
// 避免遗留的按次价格遮蔽倍率；删键而非置 0，因为 GetModelPrice
// 键存在即返回 usePrice=true，置 0 会命中「免费模型」逻辑。
func applyRatioOptions(modelRatio, modelPrice, completionRatio, cacheRatio, createCacheRatio map[string]float64, stalePriceNames map[string]struct{}) error {
	updates := make(map[string]string, 5)
	put := func(key string, override map[string]float64, current map[string]float64) error {
		if len(override) == 0 {
			return nil
		}
		raw, err := common.Marshal(mergeFloatMaps(current, override))
		if err != nil {
			return fmt.Errorf("marshal %s: %w", key, err)
		}
		updates[key] = string(raw)
		return nil
	}
	putRemoved := func(key string, remove map[string]struct{}, override map[string]float64, current map[string]float64) error {
		if len(remove) == 0 {
			return nil
		}
		merged, changed := mergeFloatMapsRemoving(current, override, remove)
		if !changed {
			return nil
		}
		raw, err := common.Marshal(merged)
		if err != nil {
			return fmt.Errorf("marshal %s: %w", key, err)
		}
		updates[key] = string(raw)
		return nil
	}
	if err := put("ModelRatio", modelRatio, ratio_setting.GetModelRatioCopy()); err != nil {
		return err
	}
	if err := put("ModelPrice", modelPrice, ratio_setting.GetModelPriceCopy()); err != nil {
		return err
	}
	if err := putRemoved("ModelPrice", stalePriceNames, modelPrice, ratio_setting.GetModelPriceCopy()); err != nil {
		return err
	}
	if err := put("CompletionRatio", completionRatio, ratio_setting.GetCompletionRatioCopy()); err != nil {
		return err
	}
	if err := put("CacheRatio", cacheRatio, ratio_setting.GetCacheRatioMap()); err != nil {
		return err
	}
	if err := put("CreateCacheRatio", createCacheRatio, ratio_setting.GetCreateCacheRatioCopy()); err != nil {
		return err
	}
	if len(updates) == 0 {
		return nil
	}
	return model.UpdateModelPricingOptions(updates)
}

// dreamRouterModelsPricedAboveOfficial 找出规则系数 > 1 的模型（售价高于
// 上游官方目录价）。返回按名字排序的清单。
func dreamRouterModelsPricedAboveOfficial(changes []DreamRouterModelChange) []string {
	names := make([]string, 0)
	for _, change := range changes {
		if change.Factor > 1+1e-9 {
			names = append(names, change.Name)
		}
	}
	sort.Strings(names)
	return names
}

// verifyDreamRouterAlignment 复核落库结果：把库里的现值与本次目标值逐项比对。
//
// 这是「与上游完全对齐」的可验证证据，而不是再算一遍公式——它读的是
// ratio_setting 的现值（UpdateModelPricingOptions 已在同事务里刷新内存），
// 因此能捕捉「算对了但没写进去」这类失败（例如键被并发改写、option 校验
// 拒写）。目标值 ≤ 0 的维度表示本次不写该维度，不参与比对。
func verifyDreamRouterAlignment(result *DreamRouterSyncResult) {
	modelRatio := ratio_setting.GetModelRatioCopy()
	modelPrice := ratio_setting.GetModelPriceCopy()
	completionRatio := ratio_setting.GetCompletionRatioCopy()
	cacheRatio := ratio_setting.GetCacheRatioMap()
	createCacheRatio := ratio_setting.GetCreateCacheRatioCopy()

	for _, change := range result.Changes {
		if change.BillingClass == "tiered_unparsable" {
			continue
		}
		result.VerifiableCount++
		var issues []string
		compare := func(field string, expected, actual float64) {
			if expected <= 0 || nearlyEqualSync(expected, actual) {
				return
			}
			issues = append(issues, fmt.Sprintf("%s 期望 %g 实际 %g", field, expected, actual))
		}
		if change.BillingClass == "per_call" {
			compare("ModelPrice", change.NewModelPrice, modelPrice[change.Name])
		} else {
			compare("ModelRatio", change.NewModelRatio, modelRatio[change.Name])
			compare("CompletionRatio", change.CompletionRatio, completionRatio[change.Name])
			compare("CacheRatio", change.CacheRatio, cacheRatio[change.Name])
			compare("CreateCacheRatio", change.CreateCacheRatio, createCacheRatio[change.Name])
		}
		// 分层计费模型的实际售价由表达式决定：倍率写对了但表达式没写，
		// 计费仍然按旧价走。这里必须把表达式里的单价一起复核。
		if change.BillingClass == "tiered" {
			prices, ok := dreamRouterConfiguredUnitPrices(change.Name)
			if !ok {
				issues = append(issues, "billing_expr 缺失或无法解析出单价")
			} else {
				expected := change.Official.Input * change.Factor
				compare("BillingExpr 输入单价", expected, prices.Input)
			}
		}
		if len(issues) == 0 {
			result.Verified++
			continue
		}
		result.Misaligned = append(result.Misaligned,
			fmt.Sprintf("%s：%s", change.Name, strings.Join(issues, "；")))
	}
}

// truncateExprForLog 截断过长的 billing_expr，避免告警里塞进整条表达式。
func truncateExprForLog(expr string) string {
	expr = strings.TrimSpace(expr)
	if len(expr) <= 120 {
		return expr
	}
	return expr[:120] + "..."
}

func mergeFloatMaps(base, override map[string]float64) map[string]float64 {
	merged := make(map[string]float64, len(base)+len(override))
	for k, v := range base {
		merged[k] = v
	}
	for k, v := range override {
		merged[k] = v
	}
	return merged
}

// mergeFloatMapsRemoving 先按 override 覆盖 base，再整键删除 remove 中的
// 模型，返回合并结果与「是否真的删掉了键」。override 优先于删除：同一
// 模型不会既写新值又被删（调用方按互拆的计费类别分组，不会触发）。
func mergeFloatMapsRemoving(base, override map[string]float64, remove map[string]struct{}) (map[string]float64, bool) {
	merged := mergeFloatMaps(base, override)
	changed := false
	for name := range remove {
		if _, ok := merged[name]; ok {
			delete(merged, name)
			changed = true
		}
	}
	return merged, changed
}

// applyChannelModels 让渠道 models 与上游清单一致，并清理失效的
// model_mapping 条目（上游名已不存在时，映射不会再被路由使用）。
func applyChannelModels(channel *model.Channel, upstreamNames map[string]struct{}) error {
	names := make([]string, 0, len(upstreamNames))
	for name := range upstreamNames {
		names = append(names, name)
	}
	sort.Strings(names)
	newModels := strings.Join(names, ",")

	changed := false
	if channel.Models != newModels {
		channel.Models = newModels
		changed = true
	}

	if channel.ModelMapping != nil && strings.TrimSpace(*channel.ModelMapping) != "" {
		var mapping map[string]string
		if err := common.UnmarshalJsonStr(*channel.ModelMapping, &mapping); err == nil && len(mapping) > 0 {
			pruned := make(map[string]string, len(mapping))
			for upstream, local := range mapping {
				if _, ok := upstreamNames[upstream]; ok {
					pruned[upstream] = local
				}
			}
			if len(pruned) != len(mapping) {
				if len(pruned) == 0 {
					empty := ""
					channel.ModelMapping = &empty
				} else {
					raw, err := common.Marshal(pruned)
					if err != nil {
						return fmt.Errorf("marshal model_mapping: %w", err)
					}
					encoded := string(raw)
					channel.ModelMapping = &encoded
				}
				changed = true
			}
		}
	}

	if !changed {
		return nil
	}
	if err := channel.Update(); err != nil {
		return fmt.Errorf("update channel %d: %w", channel.Id, err)
	}
	model.CacheUpdateChannel(channel)
	return nil
}

// nearlyEqualSync 与 controller/ratio_sync.go 的 nearlyEqual 同口径，
// 避免重复实现两套浮点比较。
func nearlyEqualSync(a, b float64) bool {
	const epsilon = 1e-9
	if a == b {
		return true
	}
	diff := math.Abs(a - b)
	if diff < epsilon {
		return true
	}
	max := math.Max(math.Abs(a), math.Abs(b))
	return diff <= epsilon*max
}

// saveDreamRouterSyncStatus 记录最近一次运行状态到 option。
func saveDreamRouterSyncStatus(result *DreamRouterSyncResult, errMsg string) {
	now := time.Now().Format(time.RFC3339)
	_ = model.UpdateOption(dreamRouterSyncLastRunAtKey, now)
	if errMsg != "" {
		_ = model.UpdateOption(dreamRouterSyncLastErrorKey, errMsg)
	} else {
		_ = model.UpdateOption(dreamRouterSyncLastErrorKey, "")
	}
	summary := map[string]any{
		"finished_at":      result.FinishedAt.Format(time.RFC3339),
		"dry_run":          result.DryRun,
		"pricing_version":  result.PricingVer,
		"upstream_count":   result.UpstreamCount,
		"offered_count":    result.OfferedCount,
		"applied":          result.Applied,
		"ratio_updated":    countChanges(result, func(c DreamRouterModelChange) bool { return c.RatioChanged || c.PriceChanged }),
		"expr_updated":     countChanges(result, func(c DreamRouterModelChange) bool { return c.BillingExprChanged || c.ClearBillingExpr }),
		"verified":         result.Verified,
		"verifiable_count": result.VerifiableCount,
		"misaligned":       result.Misaligned,
		"added_models":     result.AddedModels,
		"removed_models":   result.RemovedModels,
		"skipped_models":   result.SkippedModels,
		"warnings":         result.Warnings,
	}
	raw, err := common.Marshal(summary)
	if err == nil {
		_ = model.UpdateOption(dreamRouterSyncLastResultKey, string(raw))
	}
}

func countChanges(result *DreamRouterSyncResult, pred func(DreamRouterModelChange) bool) int {
	n := 0
	for _, c := range result.Changes {
		if pred(c) {
			n++
		}
	}
	return n
}
