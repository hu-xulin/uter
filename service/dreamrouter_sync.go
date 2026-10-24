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
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/ratio_setting"
)

// DreamRouter（创梦渠道，https://dreamrouter.ai）价格同步。
//
// 背景：uter 的聚合渠道（默认渠道 id=20）上游即 DreamRouter，其定价页
// （https://dreamrouter.ai/pricing）对每个模型展示一个折扣徽标（如 -40%），
// 语义是「相对官方基准价，该用户组享受的折扣」。
//
// 定价结构（2026-10-24 经其 /api/pricing 全量数据 + 页面渲染逐项核对）：
//
//	官方基准价   = /api/pricing 记录的 model_ratio / completion_ratio /
//	               cache_ratio / model_price（$/1M tokens 或 $/次）
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
//	A 类 按量计费且无 billing_expr（39/63）：
//	    ModelRatio      = model_ratio × (r + step)
//	    CompletionRatio = completion_ratio（比值，加成系数约掉）
//	    CacheRatio      = cache_ratio
//	B 类 按次计费且无 billing_expr（8/63，图片/视频类）：
//	    ModelPrice      = model_price × (r + step)   （单位：美元/次）
//	C 类 带 billing_expr 分层计费（16/63，如 gpt-5.5 / claude-haiku-5-5）：
//	    表达式求值在前端完成，/api/pricing 不给折后价，改用「页面抓取
//	    基线 + 组倍率缩放」：C 对 r 线性，故
//	    ModelRatio = 基线 in 价 / 2 × (r + step) / r0
//	    （基线见 dreamRouterTieredBaselines；pricing_version 变化即
//	    表达式或基准价变更，同步任务会记录告警并不再盲改。）
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

	dreamRouterDefaultChannelID = 20
	dreamRouterDefaultStep      = 0.1
	dreamRouterHTTPTimeout      = 30 * time.Second
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

// dreamRouterTieredBaseline 是 C 类（billing_expr 分层计费）模型的
// 页面抓取基线：抓取日期 2026-10-24，取登录态 default 组在
// https://dreamrouter.ai/pricing 卡片上显示的折后价（$1M tokens）。
// R0 为抓取当日按 enable_groups 复算出的组倍率；组倍率变化时售价按
// 比例缩放（C 对 r 线性齐次）。
type dreamRouterTieredBaseline struct {
	In  float64 // 输入价 $/1M tokens
	Out float64 // 输出价 $/1M tokens
	R0  float64 // 抓取时的组倍率
}

var dreamRouterTieredBaselines = map[string]dreamRouterTieredBaseline{
	"claude-haiku-5-5":       {In: 0.06, Out: 0.3, R0: 0.6},
	"gemini-nano-banana-2.1": {In: 0.6, Out: 3.0, R0: 0.4},
	"gemini-2.5-pro":         {In: 0.75, Out: 6.0, R0: 0.6},
	"gemini-3.1-flash-image": {In: 0.2, Out: 0.3, R0: 0.4},
	"gemini-3.1-pro-preview": {In: 1.2, Out: 7.2, R0: 0.6},
	"gpt-5.5":                {In: 3.0, Out: 18.0, R0: 0.6},
	"gpt-5.6-luna":           {In: 0.12, Out: 0.72, R0: 0.6},
	"gpt-5.6-sol":            {In: 2.4, Out: 12.0, R0: 0.6},
	"gpt-5.6-terra":          {In: 1.2, Out: 7.2, R0: 0.6},
	"gpt-6-astra":            {In: 6.0, Out: 30.0, R0: 0.6},
	"gpt-6-luna":             {In: 0.06, Out: 0.3, R0: 0.6},
	"gpt-6-sol":              {In: 1.2, Out: 6.0, R0: 0.6},
	"gpt-image-2":            {In: 3.75, Out: 7.5, R0: 0.75},
	"gpt-image-2.5-flare":    {In: 3.75, Out: 0, R0: 0.75},
	"gpt-image-2.5-sunburst": {In: 3.75, Out: 0, R0: 0.75},
	"qwen3.6-flash":          {In: 0.243, Out: 1.449, R0: 0.9},
}

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

// dreamRouterPayload 是 /api/pricing 的响应结构（只取同步所需字段）。
type dreamRouterPayload struct {
	Success         bool                          `json:"success"`
	Data            []dreamRouterRecord           `json:"data"`
	GroupRatio      map[string]float64            `json:"group_ratio"`
	GroupGroupRatio map[string]map[string]float64 `json:"group_group_ratio"`
	AutoGroups      []string                      `json:"auto_groups"`
	UsableGroup     map[string]string             `json:"usable_group"`
	PricingVersion  string                        `json:"pricing_version"`
}

// DreamRouterSyncOptions 控制一次同步的行为。
type DreamRouterSyncOptions struct {
	DryRun bool // 只计算不落库
}

// DreamRouterModelChange 描述单个模型的目标值。
type DreamRouterModelChange struct {
	Name            string  `json:"name"`
	GroupRatio      float64 `json:"group_ratio"`     // 创梦 default 组倍率 r
	BillingClass    string  `json:"billing_class"`   // per_token / per_call / tiered
	OldModelRatio   float64 `json:"old_model_ratio"` // 0 表示此前未配置
	NewModelRatio   float64 `json:"new_model_ratio"`
	OldModelPrice   float64 `json:"old_model_price"` // 0 表示此前未配置
	NewModelPrice   float64 `json:"new_model_price"`
	CompletionRatio float64 `json:"completion_ratio"` // 目标 CompletionRatio
	CacheRatio      float64 `json:"cache_ratio"`      // 目标 CacheRatio
	RatioChanged    bool    `json:"ratio_changed"`
	PriceChanged    bool    `json:"price_changed"`
}

// DreamRouterSyncResult 汇总一次同步的结果。
type DreamRouterSyncResult struct {
	StartedAt     time.Time                `json:"started_at"`
	FinishedAt    time.Time                `json:"finished_at"`
	DryRun        bool                     `json:"dry_run"`
	PricingVer    string                   `json:"pricing_version"`
	UpstreamCount int                      `json:"upstream_count"`
	Changes       []DreamRouterModelChange `json:"changes"`
	AddedModels   []string                 `json:"added_models"`   // 上游有、渠道 models 缺
	RemovedModels []string                 `json:"removed_models"` // 渠道 models 多、上游无
	Applied       bool                     `json:"applied"`
	Warnings      []string                 `json:"warnings"`
}

// DreamRouterSyncConfig 是同步任务的运行配置（来自 option）。
type DreamRouterSyncConfig struct {
	Enabled   bool
	ChannelID int
	Username  string
	Password  string
	Step      float64
}

// LoadDreamRouterSyncConfig 从 option 读取配置，未配置时用内置默认值。
//
// 口令（DreamRouterSyncPassword）**没有明文兜底**：未配置时返回空串，由
// SyncDreamRouterPricing 报错提示去后台配置，绝不在此处回退到硬编码密钥。
func LoadDreamRouterSyncConfig() DreamRouterSyncConfig {
	cfg := DreamRouterSyncConfig{
		Enabled:   true,
		ChannelID: dreamRouterDefaultChannelID,
		Username:  dreamRouterDefaultUsername,
		Password:  "",
		Step:      dreamRouterDefaultStep,
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
	return cfg
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

// dreamRouterComputeTarget 按计费类别计算 uter 目标值。
func dreamRouterComputeTarget(rec dreamRouterRecord, r, step float64) DreamRouterModelChange {
	change := DreamRouterModelChange{
		Name:       rec.ModelName,
		GroupRatio: r,
	}
	switch {
	case rec.BillingExpr != "":
		// C 类：分层计费，用页面抓取基线 + 组倍率缩放。
		change.BillingClass = "tiered"
		baseline, ok := dreamRouterTieredBaselines[rec.ModelName]
		if !ok {
			// 上游新增了未登记的 tiered 模型：宁可不改价，也不套错公式。
			change.BillingClass = "tiered_unregistered"
			return change
		}
		change.NewModelRatio = roundRatioValue(baseline.In / 2 * (r + step) / baseline.R0)
		if baseline.Out > 0 && baseline.In > 0 {
			change.CompletionRatio = baseline.Out / baseline.In
		}
		if rec.CacheRatio > 0 {
			change.CacheRatio = rec.CacheRatio
		}
	case rec.QuotaType != 0:
		// B 类：按次计费（美元/次）。
		change.BillingClass = "per_call"
		change.NewModelPrice = roundRatioValue(rec.ModelPrice * (r + step))
	default:
		// A 类：按量计费。
		change.BillingClass = "per_token"
		change.NewModelRatio = roundRatioValue(rec.ModelRatio * (r + step))
		change.CompletionRatio = rec.CompletionRatio
		change.CacheRatio = rec.CacheRatio
	}
	return change
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

// SyncDreamRouterPricing 执行一次同步：登录上游、拉取定价、按「+1 折」
// 规则重算 uter 侧倍率，并让聚合渠道的模型清单与上游保持一致。
//
// DryRun 模式下只计算差异，不写 option、不动渠道。
func SyncDreamRouterPricing(ctx context.Context, opts DreamRouterSyncOptions) (*DreamRouterSyncResult, error) {
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
	modelRatio := ratio_setting.GetModelRatioCopy()
	modelPrice := ratio_setting.GetModelPriceCopy()
	// CompletionRatio/CacheRatio 是比值，「+1 折」加成系数会约掉，
	// 无需与现值对比——目标值直接取上游基准（见 dreamRouterComputeTarget）。

	updatedPricingVersion := false

	for i := range payload.Data {
		rec := payload.Data[i]
		upstreamNames[rec.ModelName] = struct{}{}
		if rec.PricingVersion != "" && rec.PricingVersion != payload.PricingVersion {
			// 单条记录的版本与顶层不一致：数据仍在写入中，本次跳过更安全。
			updatedPricingVersion = true
			continue
		}
		r := dreamRouterGroupRatio(rec.EnableGroups, userGroupRatio, payload.GroupRatio)
		change := dreamRouterComputeTarget(rec, r, cfg.Step)
		change.OldModelRatio = modelRatio[rec.ModelName]
		change.OldModelPrice = modelPrice[rec.ModelName]

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

	if updatedPricingVersion {
		result.Warnings = append(result.Warnings,
			"部分模型记录的 pricing_version 与顶层不一致（上游数据可能在写入中），已跳过这些模型")
	}

	// tiered 基线对应的 pricing_version 需要关注：expr 变更时页面价会变，
	// 基线表可能过期。这里记录警告提醒人工复核，不自动改价。
	for name := range dreamRouterTieredBaselines {
		if _, ok := upstreamNames[name]; !ok {
			result.Warnings = append(result.Warnings,
				fmt.Sprintf("基线模型 %s 已不在上游清单中，请复核基线表", name))
		}
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
	// C 类（tiered）模型在创梦侧由 billing_expr 动态计费，uter 侧用基线
	// 倍率近似。历史上按 1:1 直卖写入的 ModelPrice（如 gpt-image-2 的
	// 0.211）会遮蔽新倍率——GetModelPrice 键存在即 usePrice=true，
	// 且写 0 会触发「免费模型」逻辑，必须整键删除。
	stalePriceNames := map[string]struct{}{}

	appliedRatio := false
	for _, change := range result.Changes {
		switch change.BillingClass {
		case "per_token", "tiered":
			if change.NewModelRatio > 0 {
				newModelRatio[change.Name] = change.NewModelRatio
				appliedRatio = true
			}
			if change.CompletionRatio > 0 {
				newCompletionRatio[change.Name] = change.CompletionRatio
			}
			if change.CacheRatio > 0 {
				newCacheRatio[change.Name] = change.CacheRatio
			}
			if change.BillingClass == "tiered" {
				stalePriceNames[change.Name] = struct{}{}
			}
		case "per_call":
			if change.NewModelPrice > 0 {
				newModelPrice[change.Name] = change.NewModelPrice
				appliedRatio = true
			}
		}
	}
	_ = appliedRatio

	if err := applyRatioOptions(newModelRatio, newModelPrice, newCompletionRatio, newCacheRatio, stalePriceNames); err != nil {
		return nil, err
	}

	// 4) 渠道 models 对齐上游；清掉已不在上游的 mapping 条目。
	if err := applyChannelModels(channel, upstreamNames); err != nil {
		return nil, err
	}

	result.Applied = true
	saveDreamRouterSyncStatus(result, "")
	return result, nil
}

// applyRatioOptions 把目标倍率合并进现有 option 并写回。
// 走 model.UpdateModelPricingOptions（倍率类 option 的唯一写入路径：
// 单事务落库 + 刷新 option 内存 + RefreshPricing + 失效暴露缓存）。
// 只覆盖本次同步涉及的键，其他模型的既有配置原样保留。
// stalePriceNames 中的模型（C 类 tiered）会从 ModelPrice 整键删除，
// 避免遗留的按次价格遮蔽基线倍率；删键而非置 0，因为 GetModelPrice
// 键存在即返回 usePrice=true，置 0 会命中「免费模型」逻辑。
func applyRatioOptions(modelRatio, modelPrice, completionRatio, cacheRatio map[string]float64, stalePriceNames map[string]struct{}) error {
	updates := make(map[string]string, 4)
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
	if len(updates) == 0 {
		return nil
	}
	return model.UpdateModelPricingOptions(updates)
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
		"finished_at":     result.FinishedAt.Format(time.RFC3339),
		"dry_run":         result.DryRun,
		"pricing_version": result.PricingVer,
		"upstream_count":  result.UpstreamCount,
		"applied":         result.Applied,
		"ratio_updated":   countChanges(result, func(c DreamRouterModelChange) bool { return c.RatioChanged || c.PriceChanged }),
		"added_models":    result.AddedModels,
		"removed_models":  result.RemovedModels,
		"warnings":        result.Warnings,
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
