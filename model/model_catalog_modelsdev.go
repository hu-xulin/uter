package model

import (
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/uter-ai/uter/common"
)

// models.dev 目录适配：把该站点的模型记录压成 MetadataValues，供同步链路与
// basellm 目录做字段级合并。
//
// 为什么需要第二个源：basellm 目录只提供描述/图标/标签/供应商/端点五项，
// 没有上下文窗口、最大输出、模态、知识截止、发布日期这些规格事实，而定价页
// 的模型详情卡片需要它们。models.dev 是免费、无需鉴权、按 provider 分组的
// 公开目录，覆盖 8000+ 模型，字段与定价页需要的五格一一对应。
//
// 两个源的职责不重叠，因此合并规则是「字段并集」而不是「整条记录替换」：
// 同一模型两边都有时，basellm 管文案（描述/图标/标签/供应商/端点），
// models.dev 管规格（五个规格字段），任何一边的非空值都不会被另一边的空值
// 清掉。

// modelsDevLimit 是 models.dev 声明的三个窗口上限。input 是「输入侧上限」，
// 多数记录与 context 相同或留空，本项目不展示，保留只为将来做输入输出拆分。
type modelsDevLimit struct {
	Context int `json:"context"`
	Output  int `json:"output"`
	Input   int `json:"input"`
}

// modelsDevModalities 是模态声明，取值 text/image/audio/video/pdf。
type modelsDevModalities struct {
	Input  []string `json:"input"`
	Output []string `json:"output"`
}

// modelsDevModel 只声明用得到的字段。models.dev 每条记录有 20+ 字段，其余
// 字段（cost、reasoning_options、interleaved 等）本项目目前不消费，按需再加，
// 避免为不存在的消费方维护结构体。
type modelsDevModel struct {
	ID          string              `json:"id"`
	Name        string              `json:"name"`
	Family      string              `json:"family"`
	ReleaseDate string              `json:"release_date"`
	Knowledge   string              `json:"knowledge"`
	Limit       modelsDevLimit      `json:"limit"`
	Modalities  modelsDevModalities `json:"modalities"`
}

// modelsDevProvider 是 models.dev 的顶层分组，键为 provider id。
type modelsDevProvider struct {
	ID     string                    `json:"id"`
	Name   string                    `json:"name"`
	Models map[string]modelsDevModel `json:"models"`
}

// ModelsDevCatalogIndex 把 models.dev 的全部模型按归一化名建索引。
//
// 同一个模型会在多个 provider 下重复出现（例如 openrouter 与 volcengine 都有
// volcengine/doubao-seed-1-6），且各家的 limit 填写完整度不同。合并时按
// 「字段填充数更高者胜出」挑选代表记录，避免先遍历到的稀疏记录盖掉完整记录。
type ModelsDevCatalogIndex struct {
	values map[string]MetadataValues
}

// NewModelsDevCatalogIndex 从 models.dev 的原始响应构建索引。
//
// 索引键包含两种形态，命中顺序由 Lookup 保证：
//   - 完整 id 归一化（"bytedance/seedream-4.0" -> "bytedance:seedream:4:0"）
//   - 末段名归一化（"seedream-4.0" -> "seedream:4:0"），用于跳过 provider 前缀
func NewModelsDevCatalogIndex(providers map[string]modelsDevProvider) *ModelsDevCatalogIndex {
	index := &ModelsDevCatalogIndex{values: make(map[string]MetadataValues, 1024)}
	for _, provider := range providers {
		for id, item := range provider.Models {
			values := valuesFromModelsDevModel(item)
			if values.ContextLength == 0 && values.MaxOutputTokens == 0 &&
				values.KnowledgeCutoff == "" && values.ReleaseDate == "" &&
				values.InputModalities == "" && values.OutputModalities == "" {
				// 规格全空的记录（视频/图像模型常见）不进索引：留下它只会让
				// 命中判定显示「已匹配」却填不出任何字段。
				continue
			}
			for _, key := range modelsDevIndexKeys(id) {
				if previous, exists := index.values[key]; exists && modelsDevFillScore(previous) >= modelsDevFillScore(values) {
					continue
				}
				index.values[key] = values
			}
		}
	}
	return index
}

// modelsDevIndexKeys 生成一个模型 id 的全部索引键：完整归一化名与末段归一化名。
func modelsDevIndexKeys(id string) []string {
	full := normalizeModelMatchName(id)
	if full == "" {
		return nil
	}
	keys := []string{full}
	if slash := strings.LastIndex(id, "/"); slash >= 0 && slash < len(id)-1 {
		if base := normalizeModelMatchName(id[slash+1:]); base != "" && base != full {
			keys = append(keys, base)
		}
	}
	return keys
}

// modelsDevFillScore 统计一条记录填了几个规格字段，用于在重复记录间择优。
func modelsDevFillScore(values MetadataValues) int {
	score := 0
	if values.ContextLength > 0 {
		score++
	}
	if values.MaxOutputTokens > 0 {
		score++
	}
	if values.KnowledgeCutoff != "" {
		score++
	}
	if values.ReleaseDate != "" {
		score++
	}
	if values.InputModalities != "" {
		score++
	}
	if values.OutputModalities != "" {
		score++
	}
	return score
}

// valuesFromModelsDevModel 把一条 models.dev 记录压成 MetadataValues。
//
// 只填规格字段：描述/图标/标签/供应商一律留空，那是 basellm 的职责，混进来会
// 让同步预览出现「同一字段两个源给出不同文案」的假冲突。
func valuesFromModelsDevModel(item modelsDevModel) MetadataValues {
	return MetadataValues{
		ContextLength:   item.Limit.Context,
		MaxOutputTokens: item.Limit.Output,
		ReleaseDate:     normalizeCatalogDate(item.ReleaseDate),
		KnowledgeCutoff: normalizeCatalogDate(item.Knowledge),
		// 模态排序后拼接，保证同一模型每次同步产生相同的字符串，
		// 否则上游数组顺序变化会被误判成字段变更。
		InputModalities:  joinModalities(item.Modalities.Input),
		OutputModalities: joinModalities(item.Modalities.Output),
	}
}

// catalogModalityAliases 把上游的模态词收敛到前端词表（text/image/audio/video/file）。
//
// models.dev 用 pdf 表示「可接收 PDF 文档」，而定价页的模态标签只有 file 一档。
// 不收敛的话前端会原样渲染出未翻译的 "pdf"，且 Modality 联合类型也表达不了它。
var catalogModalityAliases = map[string]string{
	"pdf":      "file",
	"document": "file",
	"texts":    "text",
}

// joinModalities 把模态切片规范化成固定顺序的逗号串。
func joinModalities(items []string) string {
	if len(items) == 0 {
		return ""
	}
	seen := make(map[string]bool, len(items))
	kept := make([]string, 0, len(items))
	for _, item := range items {
		normalized := strings.ToLower(strings.TrimSpace(item))
		if alias, ok := catalogModalityAliases[normalized]; ok {
			normalized = alias
		}
		if normalized == "" || seen[normalized] {
			continue
		}
		seen[normalized] = true
		kept = append(kept, normalized)
	}
	// 固定顺序：让「text,image」与「image,text」归一成同一串。
	order := []string{"text", "image", "audio", "video", "file"}
	sorted := make([]string, 0, len(kept))
	for _, canonical := range order {
		if seen[canonical] {
			sorted = append(sorted, canonical)
			delete(seen, canonical)
		}
	}
	// 未知模态按字典序补在后面，保持确定性。
	rest := make([]string, 0, len(seen))
	for item := range seen {
		rest = append(rest, item)
	}
	sort.Strings(rest)
	sorted = append(sorted, rest...)
	return strings.Join(sorted, ",")
}

// normalizeCatalogDate 把上游日期统一成 YYYY-MM，无法识别的格式原样保留。
//
// 两个源的粒度不同：知识截止常是 YYYY-MM-DD，而发布日期有时只有 YYYY-MM；
// 定价页只显示年月。若不做归一，同一天的不同写法会在同步预览里被当成变更，
// 每次同步都提示「知识截止有更新」。
func normalizeCatalogDate(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	// 只接受 YYYY-MM 与 YYYY-MM-DD 两种 ISO 前缀形式；其他格式（如 "2024"）
	// 原样保留，交由运营判断，不做猜测性改写。
	if len(trimmed) >= 7 && trimmed[4] == '-' && isASCIIDigit(trimmed[5]) && isASCIIDigit(trimmed[6]) {
		return trimmed[:7]
	}
	return trimmed
}

// isASCIIDigit 判断单字节是否为数字。这里不能用 unicode.IsDigit：
// 它会把全角数字也算进去，而模型名/日期里只可能出现 ASCII 数字。
func isASCIIDigit(c byte) bool {
	return c >= '0' && c <= '9'
}

// Lookup 解析一个站内模型名到 models.dev 记录。
//
// 解析顺序与 ModelNameMatchCatalog 一致（精确 → 双向前缀 → token 包含），
// 但额外支持「点号与横线等价」的归一化，因为 models.dev 用 seedream-4.0
// 而站内用 doubao-seedream-4-0。
func (c *ModelsDevCatalogIndex) Lookup(modelName string) (MetadataValues, bool) {
	if c == nil || len(c.values) == 0 {
		return MetadataValues{}, false
	}
	normalized := normalizeModelMatchName(modelName)
	if normalized == "" {
		return MetadataValues{}, false
	}
	if values, ok := c.values[normalized]; ok {
		return values, true
	}
	// 去掉渠道前缀后再试一次（groq-gpt-oss-120b -> gpt-oss-120b）。
	if stripped := stripCatalogVendorPrefix(normalized); stripped != normalized {
		if values, ok := c.values[stripped]; ok {
			return values, true
		}
		normalized = stripped
	}
	bestKey := ""
	bestLen := -1
	for key := range c.values {
		if strings.HasPrefix(normalized, key+modelNameMatchSeparator) ||
			strings.HasPrefix(key, normalized+modelNameMatchSeparator) ||
			strings.Contains(modelNameMatchSeparator+normalized+modelNameMatchSeparator,
				modelNameMatchSeparator+key+modelNameMatchSeparator) {
			if len(key) > bestLen {
				bestKey = key
				bestLen = len(key)
			}
		}
	}
	if bestKey != "" {
		return c.values[bestKey], true
	}
	return MetadataValues{}, false
}

// catalogVendorPrefixes 是站内渠道给模型名加的商业前缀。剥掉后才有机会
// 命中上游目录（站内 groq-gpt-oss-120b 对应上游 gpt-oss-120b）。
//
// 只收录确定是「渠道名」而非模型名一部分的前缀：比如 doubao 是火山引擎的
// 品牌名，但 seedream 系列在目录里就叫 seedream，故 doubao 也要剥。
var catalogVendorPrefixes = []string{
	"groq", "sf", "doubao", "volc", "azure", "vertex", "bedrock", "openrouter",
}

// stripCatalogVendorPrefix 剥掉一个已知渠道前缀，返回剩余部分。
func stripCatalogVendorPrefix(normalized string) string {
	for _, prefix := range catalogVendorPrefixes {
		marker := prefix + modelNameMatchSeparator
		if strings.HasPrefix(normalized, marker) {
			return strings.TrimPrefix(normalized, marker)
		}
	}
	return normalized
}

// splitCatalogModalities 把库里「逗号分隔的模态串」拆成数组下发。
//
// 仅用于对外响应。内部比较、去重、合并仍用字符串，因为同步预览是按字段
// 逐值比较新旧值的，切片无法用 == 比较，会在序列化后产生顺序不稳定的假差异。
func splitCatalogModalities(raw string) []string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}
	parts := strings.Split(trimmed, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		if item := strings.TrimSpace(part); item != "" {
			result = append(result, item)
		}
	}
	if len(result) == 0 {
		return nil
	}
	return result
}

// MergeCatalogMetadata 把两个源的同一模型记录合并成一条。
//
// 合并规则是字段级并集，primary 优先：
//   - primary（basellm）负责文案字段：描述、图标、标签、供应商、端点、匹配规则、可见性。
//   - supplement（models.dev）负责规格字段：上下文、最大输出、模态、知识截止、发布日期。
//   - supplement 的规格值非空即取胜，因为 primary 从不下发规格字段；
//     若将来 basellm 也提供规格，则 primary 已有值优先，supplement 只补空缺。
//
// 这条规则保证「同步一次就有完整卡片」，同时两个源各自演进时不会互相覆盖。
func MergeCatalogMetadata(primary, supplement MetadataValues) MetadataValues {
	merged := primary
	if merged.ContextLength == 0 {
		merged.ContextLength = supplement.ContextLength
	}
	if merged.MaxOutputTokens == 0 {
		merged.MaxOutputTokens = supplement.MaxOutputTokens
	}
	if merged.KnowledgeCutoff == "" {
		merged.KnowledgeCutoff = supplement.KnowledgeCutoff
	}
	if merged.ReleaseDate == "" {
		merged.ReleaseDate = supplement.ReleaseDate
	}
	if merged.InputModalities == "" {
		merged.InputModalities = supplement.InputModalities
	}
	if merged.OutputModalities == "" {
		merged.OutputModalities = supplement.OutputModalities
	}
	return merged
}

// Len 返回索引里已建键的条目数，仅供同步来源统计展示。
func (c *ModelsDevCatalogIndex) Len() int {
	if c == nil {
		return 0
	}
	return len(c.values)
}

// NewModelsDevCatalogIndexFromJSON 解析 models.dev 的 api.json 并建索引。
//
// 放在 model 包而不是 controller：modelsDevProvider 是包内类型，控制器不该为了
// 解一次 JSON 而依赖上游的内部结构形状。
func NewModelsDevCatalogIndexFromJSON(raw []byte) (*ModelsDevCatalogIndex, error) {
	if len(raw) == 0 {
		return nil, errors.New("empty models.dev payload")
	}
	var providers map[string]modelsDevProvider
	if err := common.Unmarshal(raw, &providers); err != nil {
		return nil, fmt.Errorf("decode models.dev payload: %w", err)
	}
	return NewModelsDevCatalogIndex(providers), nil
}

// MergeCatalogSpecsInto 把 models.dev 的规格字段并入一张按站内模型名索引的目录表。
//
// 两个源覆盖的模型集合不同（实测 basellm 只覆盖站内约六成模型），因此除了给
// basellm 已有的条目补规格，还要让「只有 models.dev 有」的站内模型也能参与同步。
// 后者的基准值必须取自本地库现状而不是零值：否则同步预览会把本地正确的
// 可见性与匹配规则显示成「上游为 0 / 精确匹配」，运营一旦勾选就会把模型改隐藏。
//
// 只在 models.dev 真正命中时才补基准条目。没命中的仍然留在 upstream 之外，
// 上游视图继续按 missing_upstream 展示，不会被伪装成「无变化」。
//
// 返回命中数，供同步来源展示「规格覆盖 X 个模型」。
func MergeCatalogSpecsInto(upstream map[string]MetadataValues, index *ModelsDevCatalogIndex) (int, error) {
	if index == nil || index.Len() == 0 {
		return 0, nil
	}
	locals, vendors, err := GetMetadataSyncState(DB)
	if err != nil {
		return 0, err
	}
	vendorNameByID := make(map[int]string, len(vendors))
	for _, vendor := range vendors {
		vendorNameByID[vendor.Id] = vendor.Name
	}
	matched := 0
	for name, base := range upstream {
		specs, ok := index.Lookup(name)
		if !ok {
			continue
		}
		upstream[name] = MergeCatalogMetadata(base, specs)
		matched++
	}
	for name, local := range locals {
		if _, exists := upstream[name]; exists {
			continue
		}
		specs, ok := index.Lookup(name)
		if !ok {
			continue
		}
		upstream[name] = MergeCatalogMetadata(MetadataValues{
			Description: local.Description,
			Icon:        local.Icon,
			Tags:        local.Tags,
			Vendor:      vendorNameByID[local.VendorID],
			Endpoints:   local.Endpoints,
			NameRule:    local.NameRule,
			Status:      local.Status,
		}, specs)
		matched++
	}
	return matched, nil
}
