package model

// customIconVariants 登记前端 CUSTOM_ICONS 里的自定义图标，作为 lobeIconVariants
// （由 @lobehub/icons 生成）之外的第二来源。
//
// 为什么需要这张表：前端 `web/src/lib/lobe-icon.tsx` 的 CUSTOM_ICONS 注册了若干
// @lobehub/icons 没有的品牌（Wan、SGLang、Sub2API、Uter 系列），这些键在前端
// 能正常渲染，但后端 lobeIconVariants 里没有它们。而 defaultProductIconForModel
// 与 NormalizeColorIconKey 都以「键是否登记在 lobeIconVariants」作为可渲染判据，
// 于是这些品牌会被静默判定为不可渲染：
//
//   - defaultProductIconForModel 返回空串 → 模型卡片回落首字母占位；
//   - NormalizeColorIconKey 原样返回 → 裸品牌名不会被升级到彩色变体。
//
// 结果就是 wan3.0-video 这类模型明明有专属图标却显示首字母 "w"。
//
// 独立成文件、不改 lobeIconVariants：后者由 `web/scripts/gen-lobe-icon-variants.cjs`
// 从 toc.json 生成（标了 DO NOT EDIT），重新生成会清掉手写条目。这里登记的是
// 「前端自定义图标」，与上游品牌清单本就是两个来源，分开维护才不会互相覆盖。
//
// 新增前端自定义图标时**必须**同步登记到这里，否则后端推断链会把它当不可渲染：
// 前端加 Icon、这里加一行，两步缺一不可。两者的一致性由
// TestCustomIconVariantsMatchFrontend 守护。
//
// 值统一为 {hasColor: true, hasAvatar: false}：自定义图标是整枚彩色 SVG，
// 没有独立的彩色/头像变体之分，声明 hasColor 让 colorIconName / NormalizeColorIconKey
// 把它升级成 "<Brand>.Color"，渲染时前端按 baseKey 命中 CUSTOM_ICONS 忽略后缀，
// 走的就是那张整枚 SVG。
var customIconVariants = map[string]lobeIconVariant{
	"Wan":           {hasColor: true},
	"SGLang":        {hasColor: true},
	"Sub2API":       {hasColor: true},
	"Uter":          {hasColor: true},
	"UterShared":    {hasColor: true},
	"UterAggregate": {hasColor: true},
	"UterProxy":     {hasColor: true},
}

// isRenderableIconKey 判断某个图标键能否真正渲染出来。
//
// 两个来源任一命中即算可渲染：上游 @lobehub/icons 的品牌表，以及上面的前端
// 自定义图标表。所有「写进 models.icon 前先确认渲染得出来」的判断都必须走
// 这里，不要直接查 lobeIconVariants——那会漏掉自定义图标。
func isRenderableIconKey(key string) bool {
	if key == "" {
		return false
	}
	if _, ok := customIconVariants[key]; ok {
		return true
	}
	_, ok := lobeIconVariants[key]
	return ok
}

// iconVariantOf 返回某个图标键的可用变体与登记来源。
//
// 自定义图标先于上游表查询：两者理论上不该重名，真撞了以自定义为准——前端
// CUSTOM_ICONS 的查找顺序也是先看自定义表。
func iconVariantOf(key string) (lobeIconVariant, bool) {
	if variant, ok := customIconVariants[key]; ok {
		return variant, true
	}
	variant, ok := lobeIconVariants[key]
	return variant, ok
}
