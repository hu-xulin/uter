#!/usr/bin/env node
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
/**
 * 在设计规范文档的关键章节插入「可视核查」提示块。
 *
 * ⚠ 2026-11-03 起目标文档为 UTER-DESIGN-SYSTEM-3.0.md，且默认目标文件
 * 已变更；旧 design-system.md 已废止删除。本脚本按章节标题匹配插入，
 * 运行前先确认目标文档的章节标题仍与 ANCHORS 定义匹配，不匹配则
 * 不会插入（静默跳过）。
 *
 * 提示块一律指向 §18.1 的数据驱动核查页 showcase.html（可单文件离线打开），
 * 不再指向仅作像素基线的 showcase-3.0.html。
 *
 * 提示块的作用是把该章节与核查页的对应分区绑定：读者读到某一节，可以立刻
 * 知道「这一节的实体样本长什么样、在核查页的哪个位置」。纯文字表格看不出
 * 30px 和 24px 的实际差别，色值也看不出对比度差多少 —— 必须能看见。
 *
 * 幂等：重复运行不会重复插入。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DOC = path.resolve(
  __dirname,
  '../../docs/design-system/UTER-DESIGN-SYSTEM-3.0.md'
)

/** 每条：章节标题前缀 → 提示块内容 */
const ANCHORS = [
  {
    heading: '## 1.2 字号 Token',
    block: `
> **👁 可视核查** → [核查页区域 1 · 字号 11 主档 + 7 配套档](showcase.html#typography)
>
> 每档都渲染了同一句中文「优特智能大模型服务平台」，可以直接看出：
> ① 30px 与 24px 的层级差是否够明显；② 14px 正文（text-sm）在真实文案下
> 是否偏小；③ text-base（16px）与正文的区分度 —— 它是行标题档，不是正文。`,
  },
  {
    heading: '## 1.5 Mono 字号',
    block: `
> **👁 可视核查** → [核查页区域 2 · Mono 四档](showcase.html#mono)
>
> 重点确认 13px text-mono-code 与 14px text-mono-base 并排时是否显得
> 「降级」—— 这是 13px 只给固定高度代码容器用的原因。`,
  },
  {
    heading: '# 3. Page Hierarchy 页面层级',
    block: `
> **👁 可视核查** → [核查页区域 3 · 页面层级四层](showcase.html#hierarchy)
>
> L1 页面标题 → L2 区块标题 → L3 卡片标题 → L4 分组标题，同级标题跨页面保持
> 一致；层级不能只靠颜色区分，不得跳级制造错误的视觉关系。`,
  },
  {
    heading: '## 2.2 品牌色',
    block: `
> **👁 可视核查** → [核查页区域 6 · 品牌色阶](showcase.html#brand)
>
> 重点看 hover / active 两档是否**肉眼可区分**。若在 1440px 屏幕上分不出来，
> 说明加深幅度需要调整。色值以 brand.tokens.json / 生成 brand.css 为
> 事实来源（§17.6）。`,
  },
  {
    heading: '## 2.4 文字颜色',
    block: `
> **👁 可视核查** → [核查页区域 4 · 文字色七档](showcase.html#text-colors)
>
> 色卡里每档都渲染了真实文字（「优特 Ag」）。重点看 tertiary 与 disabled 两档在
> 正文旁边的实际区分度 —— 这是最容易在实际页面里用错的两档。`,
  },
  {
    heading: '## 2.5 页面表面颜色',
    block: `
> **👁 可视核查** → [核查页区域 5 · 表面与描边](showcase.html#surfaces)
>
> 层级优先通过表面差异和 1px 边框表达；普通卡片默认不加投影（§4.1 / §8.3）。`,
  },
  {
    heading: '## 2.7 语义状态色',
    block: `
> **👁 可视核查** → [核查页区域 7 · 状态色](showcase.html#status)
>
> 成功 / 警告 / 危险 / 信息四族状态色在明暗两套主题下的实际观感与对比度。`,
  },
  {
    heading: '## 2.8 图表颜色',
    block: `
> **👁 可视核查** → [核查页区域 8 · 图表分类色](showcase.html#chart)
>
> chart-1…5 分类色槽位在深浅主题下的可辨性；分类色不得带成败含义（§2.8）。`,
  },
  {
    heading: '## 2.9 Syntax 高亮色',
    block: `
> **👁 可视核查** → [核查页区域 9 · 语法高亮色](showcase.html#syntax)
>
> 代码高亮色板在明暗两套主题下的实际渲染。`,
  },
  {
    heading: '## 2.10 Terminal 色彩',
    block: `
> **👁 可视核查** → [核查页区域 10 · Terminal 演示 Token](showcase.html#terminal)
>
> Terminal ANSI palette 与首屏演示卡的 term-* 语义 Token（§17.5）。`,
  },
  {
    heading: '# 5. Radius 圆角系统',
    block: `
> **👁 可视核查** → [核查页区域 11 · 圆角九档](showcase.html#radius)
>
> 每个档位都画了实心方块，看实际弧度 —— 10px（控件）与 12px（卡片/弹窗）的
> 差别在真实页面里是否需要同时存在。`,
  },
  {
    heading: '# 6. Spacing 间距系统',
    block: `
> **👁 可视核查** → [核查页区域 12 · 间距](showcase.html#spacing)
>
> 4px 网格与语义间距档的实际留白观感。`,
  },
  {
    heading: '# 7. Density 密度系统',
    block: `
> **👁 可视核查** → [核查页区域 13 · 密度 Token](showcase.html#density)
>
> 用核查页顶部的「密度 sm / xl」按钮切换，直接观察「密度只改留白、不改字号」
> 是否成立（§7.2）。`,
  },
  {
    heading: '# 8. Shadow 与 Elevation 投影系统',
    block: `
> **👁 可视核查** → [核查页区域 14 · 五档 Elevation Shadow + Brand Glow](showcase.html#shadow)
>
> 五档投影只给浮层使用（§8.3）；普通卡片默认不加投影。`,
  },
  {
    heading: '# 9. Motion 动效系统',
    block: `
> **👁 可视核查** → [核查页区域 15 · 动效](showcase.html#motion)
>
> duration / easing Token 的实际节奏；裸 transition-* 默认值见 §9.5。`,
  },
  {
    heading: '# 10. Button 按钮系统',
    block: `
> **👁 可视核查** → [核查页区域 16 · Button 九档尺寸 + 六变体](showcase.html#button)
>
> 九档尺寸 + 六种变体并排展示，可直接判断高度差是否够用、圆角是否合理
> （普通 10px / 图标 12px，§10.2）。切换密度按钮，观察高度是否跟随 Token 收缩。`,
  },
  {
    heading: '# 11. Control 表单及基础控件',
    block: `
> **👁 可视核查** → [核查页区域 17 · 控件尺寸](showcase.html#control)
>
> Input / Select / Switch 等控件的真实高度与状态。`,
  },
  {
    heading: '# 12. Icon 图标系统',
    block: `
> **👁 可视核查** → [核查页区域 18 · 图标五档](showcase.html#icon)
>
> 五档图标按真实像素渲染，可确认 18px 默认档与 16px 紧凑档是否需要并存。`,
  },
  {
    heading: '# 13. Component 组件规范',
    block: `
> **👁 可视核查** → [核查页区域 19 · 组件示范](showcase.html#components)
>
> 组件示范区把 Button / Badge / Input / Card / Dialog / Table / Toast / Empty
> 全部渲染成真实组件，可逐个核对字号、字重、圆角、内边距（§13.3 对应表）。`,
  },
  {
    heading: '# 14. Navigation 导航系统',
    block: `
> **👁 可视核查** → [核查页区域 20 · 导航选中态](showcase.html#navigation)
>
> 附实测对比度表：专用 Token 与误用 text-primary 的差别（§14.3 不得用
> text-primary）。切换深色模式可核对深色对比度。`,
  },
  {
    heading: '## 15.1 Focus Ring',
    block: `
> **👁 可视核查** → [核查页区域 21 · 焦点环与触控目标](showcase.html#focus)
>
> 焦点环恒 2px、贴边；右侧对比「视觉 16px + 命中区 24px」
> 与「视觉 24px」两种触控做法。`,
  },
  {
    heading: '## 17.5 营销首屏的效果锚定（背景装饰层与品牌渐变）',
    block: `
> **👁 可视核查** → [核查页区域 22 · 品牌渐变与首屏演示](showcase.html#brand-gradient)
>
> ds-text-gradient-brand 单一出口、三档停靠站实测色值与对比度，以及
> §26.2 E28 登记例外的说明。`,
  },
]

let src = fs.readFileSync(DOC, 'utf8')
let inserted = 0
let skipped = 0

for (const { heading, block } of ANCHORS) {
  const idx = src.indexOf(heading + '\n')
  if (idx < 0) {
    console.warn(`⚠️  未找到章节：${heading}`)
    skipped++
    continue
  }
  // 幂等检查：该章节后 200 字符内是否已有提示块
  const after = src.slice(idx, idx + 400)
  if (after.includes('👁 可视核查')) {
    skipped++
    continue
  }
  // 找到标题行结束（下一个空行）后的位置插入
  const insertAt = src.indexOf('\n', idx + heading.length) + 1
  src = src.slice(0, insertAt) + '\n' + block + '\n' + src.slice(insertAt)
  inserted++
}

fs.writeFileSync(DOC, src, 'utf8')
console.log(
  `✅ 插入 ${inserted} 个可视核查块，跳过 ${skipped} 个（已存在或未找到）`
)
