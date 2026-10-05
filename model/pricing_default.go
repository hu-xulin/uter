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
// 统一使用非彩色（单色）图标：不带 ".Color" 后缀的 @lobehub/icons 变体跟随
// currentColor，能自适应深浅色主题；彩色变体在深色底上容易糊、且颜色无法统一。
// 键名与 defaultVendorRules 的品牌名保持一致（同样只用英文名）。
var defaultVendorIcons = map[string]string{
	"OpenAI":     "OpenAI",
	"Anthropic":  "Claude",
	"Google":     "Gemini",
	"Moonshot":   "Moonshot",
	"Z.AI":       "ZAI",
	"Alibaba":    "Qwen",
	"DeepSeek":   "DeepSeek",
	"MiniMax":    "Minimax",
	"Baidu":      "Wenxin",
	"iFlytek":    "Spark",
	"Tencent":    "Hunyuan",
	"Cohere":     "Cohere",
	"Cloudflare": "Cloudflare",
	"360":        "Ai360",
	"01.AI":      "Yi",
	"Jina":       "Jina",
	"Mistral":    "Mistral",
	"xAI":        "XAI",
	"Meta":       "Ollama",
	"ByteDance":  "Doubao",
	"Kling":      "Kling",
	"Jimeng":     "Jimeng",
	"Vidu":       "Vidu",
	"微软":         "AzureAI",
	"Microsoft":  "AzureAI",
	"Azure":      "AzureAI",
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
		return NormalizeIconKey(icon)
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
