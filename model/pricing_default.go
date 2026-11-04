package model

import (
	"slices"
	"strings"
)

// 简化的供应商映射规则
//
// 品牌名一律使用英文，且必须与 vendors 表中真实供应商记录的 Name 逐字一致：
// getDisplayVendor 正是靠 EqualFold 把按规则合成的品牌落到那条真实记录上，
// 名称对不上就会退化成负 ID 的合成品牌，导致「定价页一个品牌、管理页另一个品牌」，
// 运营在管理页改图标/简介也反映不到定价页。中文名（百度/腾讯/阿里巴巴…）会让
// 命名体系一分为二，因此这里只认英文名。
var defaultVendorRules = map[string]string{
	"gpt":      "OpenAI",
	"dall-e":   "OpenAI",
	"whisper":  "OpenAI",
	"o1":       "OpenAI",
	"o3":       "OpenAI",
	"claude":   "Anthropic",
	"gemini":   "Google",
	"moonshot": "Moonshot",
	"kimi":     "Moonshot",
	"muse":     "Meta",
	"chatglm":  "Z.AI",
	"glm-":     "Z.AI",
	"qwen":     "Alibaba",
	"deepseek": "DeepSeek",
	"abab":     "MiniMax",
	"minimax":  "MiniMax",
	"ernie":    "Baidu",
	"spark":    "iFlytek",
	"hunyuan":  "Tencent",
	"command":  "Cohere",
	"@cf/":     "Cloudflare",
	"360":      "360",
	"yi":       "01.AI",
	"jina":     "Jina",
	"mistral":  "Mistral",
	"grok":     "xAI",
	"llama":    "Meta",
	"doubao":   "ByteDance",
	"kling":    "Kling",
	"jimeng":   "Jimeng",
	"vidu":     "Vidu",
}

// 供应商默认图标映射
//
// 值是**公司 logo** 的图标键（不是大模型/产品 logo）：Anthropic 供应商用
// Anthropic 公司的 logo，Google 供应商用 Google 公司的 logo，ByteDance 用
// 字节跳动的 logo，Alibaba 用阿里巴巴的 logo，Tencent 用腾讯的 logo。
// 大模型自己的产品 logo 由模型自身的 icon 字段承载，两者是不同的东西：
// 供应商列公司 logo（黑白），模型列产品 logo（彩色）。
//
// 两个消费方：
//   - 写入路径 defaultVendorIconForSync：新建供应商时直接存这个裸名；
//   - 展示路径 getDefaultVendorIcon：合成品牌与归因兜底时再彩色化
//     （经 NormalizeColorIconKey），彩色化只发生在展示层。
//
// 键名与 defaultVendorRules 的品牌名保持一致（同样只用英文名）。
//
// ⚠️ 这张表只用于「新建」供应商的初始图标与默认品牌展示，绝不用于改写已存在的
// 供应商记录——后者是运营在「模型-供应商」里设置的配置，只能由运营本人修改。
// 表值必须是该公司自身的图标键：映射错了会让供应商显示别家的 logo
// （如 Anthropic 误映射到 Claude、Meta 误映射到 Ollama）。
var defaultVendorIcons = map[string]string{
	"OpenAI":     "OpenAI",
	"Anthropic":  "Anthropic",
	"Google":     "Google",
	"Moonshot":   "Moonshot",
	"Z.AI":       "ZAI",
	"Alibaba":    "Alibaba",
	"DeepSeek":   "DeepSeek",
	"MiniMax":    "Minimax",
	"Baidu":      "Baidu",
	"iFlytek":    "Spark",
	"Tencent":    "Tencent",
	"Cohere":     "Cohere",
	"Cloudflare": "Cloudflare",
	"360":        "Ai360",
	"01.AI":      "Yi",
	"Jina":       "Jina",
	"Mistral":    "Mistral",
	"xAI":        "XAI",
	"Meta":       "Meta",
	"ByteDance":  "ByteDance",
	"Volcengine": "ByteDance",
	"Kling":      "Kling",
	"Jimeng":     "ByteDance",
	"LongCat":    "Tencent",
	"Vidu":       "Vidu",
	"微软":         "Microsoft",
	"Microsoft":  "Microsoft",
	"Azure":      "Microsoft",
}

// defaultVendorPatterns 名称匹配规则，按"长规则优先"排序：同一模型名可能命中多条规则时，
// 取最长的那条。排序结果必须与 initDefaultVendorMapping 的历史行为完全一致。
var defaultVendorPatterns = func() []string {
	patterns := make([]string, 0, len(defaultVendorRules))
	for pattern := range defaultVendorRules {
		patterns = append(patterns, pattern)
	}
	slices.SortFunc(patterns, func(a, b string) int {
		if len(a) != len(b) {
			return len(b) - len(a)
		}
		return strings.Compare(a, b)
	})
	return patterns
}()

// defaultVendorNameForModel 返回模型名按名称规则应归属的默认品牌名，未命中返回空串。
func defaultVendorNameForModel(model string) string {
	if model == "" {
		return ""
	}
	modelLower := strings.ToLower(model)
	for _, pattern := range defaultVendorPatterns {
		if strings.Contains(modelLower, pattern) {
			return defaultVendorRules[pattern]
		}
	}
	return ""
}

// initDefaultVendorMapping 简化的默认供应商映射
func initDefaultVendorMapping(metaMap map[string]*Model, vendorMap map[int]*Vendor, enableAbilities []AbilityWithChannel) {
	for _, ability := range enableAbilities {
		modelName := ability.Model
		if _, exists := metaMap[modelName]; exists {
			continue
		}

		// 匹配供应商
		vendorID := 0
		if vendorName := defaultVendorNameForModel(modelName); vendorName != "" {
			vendorID = getDisplayVendor(vendorName, vendorMap)
		}

		// 创建模型元数据
		metaMap[modelName] = &Model{
			ModelName: modelName,
			VendorID:  vendorID,
			Status:    1,
			NameRule:  NameRuleExact,
		}
	}
}

// defaultVendorNameToPatterns 反向映射：品牌名 -> 触发它的所有模型名前缀规则。
// 用于把"按名称规则生成的合成默认品牌"合并进真实供应商时，定位其名下的模型。
var defaultVendorNameToPatterns = func() map[string][]string {
	m := make(map[string][]string)
	for pattern, name := range defaultVendorRules {
		m[name] = append(m[name], pattern)
	}
	return m
}()

// defaultBrandPatterns 返回某个默认品牌名对应的所有模型名匹配规则（原始前缀，调用方自行小写化）。
func defaultBrandPatterns(name string) []string {
	return defaultVendorNameToPatterns[name]
}

// Default vendor entries are presentation data. Reading pricing must never
// recreate a deleted/merged database record.
//
// 键名与 defaultVendorRules 的品牌名一致（英文名）。负 ID 数值是稳定的对外契约，
// 品牌改名时**沿用原数值**（如 -1016 始终是 doubao 家族、-1019 始终是 ernie 家族），
// 以免外部按 ID 记住的引用失效。真实记录存在时 getDisplayVendor 会先按名称命中真实
// 供应商，负 ID 仅在该品牌还没有真实记录时兜底。
var defaultVendorDisplayIDs = map[string]int{
	"360":        -1001,
	"Anthropic":  -1002,
	"Cloudflare": -1003,
	"Cohere":     -1004,
	"DeepSeek":   -1005,
	"Google":     -1006,
	"Jina":       -1007,
	"Meta":       -1008,
	"MiniMax":    -1009,
	"Mistral":    -1010,
	"Moonshot":   -1011,
	"OpenAI":     -1012,
	"Vidu":       -1013,
	"xAI":        -1014,
	"Jimeng":     -1015,
	"ByteDance":  -1016,
	"Kling":      -1017,
	"Z.AI":       -1018,
	"Baidu":      -1019,
	"Tencent":    -1020,
	"iFlytek":    -1021,
	"Alibaba":    -1022,
	"01.AI":      -1023,
}

// getDisplayVendor 返回该品牌在定价侧展示时应使用的供应商 ID。
//
// 曾被合并过的品牌不再以独立身份出现：这里优先落到当时的合并目标（一条真实记录），
// 于是每一次定价刷新都不会再把被合并掉的合成品牌重新生成出来。
// 这正是「合并一次，后续同类来源自动跟进」在读路径上的落点。
func getDisplayVendor(vendorName string, vendorMap map[int]*Vendor) int {
	if targetID := VendorMergeTargetFor(vendorName, vendorMap); targetID > 0 {
		return targetID
	}
	for id, vendor := range vendorMap {
		if strings.EqualFold(vendor.Name, vendorName) {
			return id
		}
	}
	id := defaultVendorDisplayIDs[vendorName]
	if id == 0 {
		return 0
	}
	vendorMap[id] = &Vendor{Id: id, Name: vendorName, Status: 1, Icon: getDefaultVendorIcon(vendorName)}
	return id
}

// 获取供应商默认图标
func getDefaultVendorIcon(vendorName string) string {
	if icon, exists := defaultVendorIcons[vendorName]; exists {
		return NormalizeColorIconKey(icon)
	}
	return ""
}

// defaultVendorIconForSync 返回同步创建供应商时应持久化的图标。
//
// 已知品牌取品牌映射 defaultVendorIcons 里的品牌裸名（避免上游下发图标漂移，
// 例如 Google 供应商不能落到 Google.Color、Meta 供应商不能落到 Ollama）；
// 未知品牌则取上游下发图标并收敛为品牌裸名。
//
// 存裸名而不是彩色键：供应商图标是运营在「模型-供应商」里设置的配置，存储值
// 必须与运营选择一致，彩色化交给渲染层（前端 colorIconName）完成。
//
// 这个函数只决定**新建**供应商的初始图标——既有供应商的图标只有运营本人
// 在管理端保存才会改变，同步不会改写。
func defaultVendorIconForSync(vendorName, upstreamIcon string) string {
	if icon, exists := defaultVendorIcons[vendorName]; exists {
		return icon
	}
	return NormalizeVendorIconKey(upstreamIcon)
}

// defaultProductIcons 把模型名 token 映射到模型**自己的产品 logo**（@lobehub/icons
// 的品牌 id），与 defaultVendorIcons（供应商公司 logo）是两回事。
//
// 关键词归因的模型在官方目录里没有图标：如果不补产品 logo，卡片就显示首字母占位
// 甚至「不存在」的坏图标；而它们所属的品牌明明有自己的产品 logo（Claude、Gemini、
// Qwen、ChatGLM、Kimi、Doubao、Hunyuan、Aya……）。这张表让这类模型自动拿到正确的
// 彩色产品 logo。
//
// 值必须是模型**产品** logo，绝不能填供应商公司 logo：Anthropic 的产品是 Claude、
// Google 的产品是 Gemini、Z.AI 的产品是 ChatGLM、Moonshot 的产品是 Kimi、Baidu 的
// 产品是 Wenxin、ByteDance 的产品是 Doubao。凡是「产品 == 公司」的品牌（OpenAI、
// DeepSeek、Meta、Mistral、Cohere、MiniMax……）则直接填公司 logo（两者同一图标）。
//
// 未在此表登记、或登记了但 @lobehub/icons 没有对应可用变体的品牌，一律回落到空串
// （首字母占位），绝不把不可渲染的键写进 models.icon——这正是用户看到的
// 「logo 变成不存在」的根因之一。
var defaultProductIcons = map[string]string{
	"chatglm":  "ChatGLM",
	"glm":      "ChatGLM",
	"kimi":     "Kimi",
	"claude":   "Claude",
	"gemini":   "Gemini",
	"qwen":     "Qwen",
	"hunyuan":  "Hunyuan",
	"doubao":   "Doubao",
	"deepseek": "DeepSeek",
	"command":  "Cohere",
	"c4ai-aya": "Aya",
	"gpt":      "OpenAI",
	"dall-e":   "Dalle",
	"whisper":  "OpenAI",
	"o1":       "OpenAI",
	"o3":       "OpenAI",
	"ernie":    "Wenxin",
	"wenxin":   "Wenxin",
	"spark":    "Spark",
	"yi":       "Yi",
	"abab":     "Minimax",
	"minimax":  "Minimax",
	"llama":    "Meta",
	"mistral":  "Mistral",
	"grok":     "XAI",
	"moonshot": "Moonshot",
	// Muse 是 Meta 的产品，@lobehub/icons 没有独立的 Muse 图标，回落到 Meta 公司图标
	// （与 llama 系列同处理）。
	"muse": "Meta",
	// Seedance（字节视频生成模型）在 @lobehub/icons 无独立品牌图标，归属
	// 豆包大模型家族（火山引擎官方发布口径「豆包·视频生成模型」），与
	// doubao-* 模型共用 Doubao 产品 logo——否则 seedance-* 卡片回落首字母
	// 占位（2026-11-02 定价广场用户反馈）。
	"seedance": "Doubao",
	// 以下与 seedance 同类：videoModelKeywords / 渠道常见命名里的视频与
	// embedding 品牌，产品与公司同图标（Kling、Vidu、Sora、BAAI），
	// 提前登记避免新增同名前缀模型时再次回落首字母占位。
	"kling": "Kling",
	"vidu":  "Vidu",
	"sora":  "Sora",
	"bge":   "BAAI",
	// Wan（通义万相）：@lobehub/icons 没有 Wan 品牌，本仓库自带整枚彩色 SVG
	// （前端 CUSTOM_ICONS 的 IconWan，已同步登记到 customIconVariants）。
	// Wan（通义万相）：@lobehub/icons 没有 Wan 品牌，本仓库自带整枚彩色 SVG
	// （前端 CUSTOM_ICONS 的 IconWan，已同步登记到 customIconVariants）。
	// 刻意**不**登记在本表：三个字母的 "wan" 作为子串会误命中 taiwan-llm、
	// swan-2，改为在下方的 defaultProductIconPrefixes 里按前缀匹配。
}

// defaultProductIconPrefixes 按「模型名以该词开头」归因产品图标，与
// defaultProductIcons 的子串规则互补。
//
// 为什么不能只靠子串规则："wan" 只有三个字母，作为子串会命中 taiwan-llm、
// swan-2 这类完全无关的名字，把 Wan 的图标错安到别的模型上。前缀匹配把
// 判定收窄到真正的万相系列（wan3.0-video、wan2.7-image…），代价是要求品牌词
// 必须出现在模型名最前面——这正是渠道的实际命名方式。
//
// 只在首段精确命中失败后才查本表：带版本号的 "wan3.0" 首段命不中裸键 "wan"，
// 但 "wan" 是它的前缀，于是落到这里。若某模型名同时被 defaultProductIcons 的
// 首段命中（如 wan-t2v 的首段恰是 "wan"），走前一条路径，结果一致。
var defaultProductIconPrefixes = map[string]string{
	"wan": "Wan",
}

// defaultProductIconPrefixKeys 按长度降序，长前缀优先，避免短前缀抢先命中。
var defaultProductIconPrefixKeys = func() []string {
	keys := make([]string, 0, len(defaultProductIconPrefixes))
	for prefix := range defaultProductIconPrefixes {
		keys = append(keys, prefix)
	}
	slices.SortFunc(keys, func(a, b string) int {
		if len(a) != len(b) {
			return len(b) - len(a)
		}
		return strings.Compare(a, b)
	})
	return keys
}()

// defaultProductIconPatterns 与 defaultVendorPatterns 同样的「长规则优先」排序：
// 同一模型名可能命中多条规则时取最长那条。
var defaultProductIconPatterns = func() []string {
	patterns := make([]string, 0, len(defaultProductIcons))
	for pattern := range defaultProductIcons {
		patterns = append(patterns, pattern)
	}
	slices.SortFunc(patterns, func(a, b string) int {
		if len(a) != len(b) {
			return len(b) - len(a)
		}
		return strings.Compare(a, b)
	})
	return patterns
}()

// defaultProductIconForModel 返回关键词归因模型的「自己的产品 logo」。
//
// 只在图标键确实可渲染（isRenderableIconKey：上游品牌表或前端自定义图标表）
// 时才返回该键；否则返回空串，让卡片显示首字母占位而不是一个根本渲染不出来的
// 坏键。这个函数**绝不**返回供应商公司 logo：产品与公司同名的品牌（OpenAI、
// Meta……）填的是两者的同一图标，而 Anthropic/Google/Z.AI/Moonshot 等都映射到
// 各自的产品 logo，而非公司 logo。
//
// 匹配优先级：
//  1. 模型名**首段精确命中**（muse-spark 的首段是 muse，属于 Meta，不应被其中
//     的 spark 子串误判成 iFlytek 的 Spark）；
//  2. **前缀命中**（wan3.0-video 带版本号，首段 "wan3.0" 命不中裸键 "wan"）；
//  3. 最长子串规则（保留 c4ai-aya 这类非首段的精确匹配）。
//
// 前缀先于子串：多字母短词做子串容易误伤（"wan" 会命中 taiwan-llm），前缀
// 把这类品牌收窄到真正的系列命名，且不影响既有子串规则的覆盖范围。
func defaultProductIconForModel(modelName string) string {
	lower := strings.ToLower(strings.TrimSpace(modelName))
	if lower == "" {
		return ""
	}
	segments := strings.Split(lower, "-")
	if productKey, ok := defaultProductIcons[segments[0]]; ok {
		if isRenderableIconKey(productKey) {
			return productKey
		}
	}
	for _, prefix := range defaultProductIconPrefixKeys {
		if strings.HasPrefix(lower, prefix) {
			productKey := defaultProductIconPrefixes[prefix]
			if isRenderableIconKey(productKey) {
				return productKey
			}
			break
		}
	}
	for _, pattern := range defaultProductIconPatterns {
		if strings.Contains(lower, pattern) {
			productKey := defaultProductIcons[pattern]
			if isRenderableIconKey(productKey) {
				return productKey
			}
			return ""
		}
	}
	return ""
}

// defaultBrandVendors 返回定价广场按名称规则匹配、但没有持久化元数据的模型所对应
// 的"默认品牌"供应商。这些供应商使用保留的负 ID，不会写入数据库，仅用于展示。
// 管理后台的供应商列表会合并它们，以便运营人员将这些品牌提升为可管理的真实记录。
func defaultBrandVendors() []*Vendor {
	vendors := make([]*Vendor, 0, len(defaultVendorDisplayIDs))
	for name, id := range defaultVendorDisplayIDs {
		vendors = append(vendors, &Vendor{
			Id:     id,
			Name:   name,
			Icon:   getDefaultVendorIcon(name),
			Status: 1,
		})
	}
	return vendors
}

// getDefaultBrandVendor 按负 ID 返回对应的默认品牌供应商（用于只读展示与编辑提升）。
func getDefaultBrandVendor(id int) (*Vendor, bool) {
	for _, v := range defaultBrandVendors() {
		if v.Id == id {
			return v, true
		}
	}
	return nil, false
}
