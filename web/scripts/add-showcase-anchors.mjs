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
 * 在 design-system.md 的关键章节插入「可视核查」提示块。
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
const DOC = path.resolve(__dirname, '../docs/design-system/design-system.md')

/** 每条：章节标题前缀 → 提示块内容 */
const ANCHORS = [
  {
    heading: '## 6. 颜色',
    block: `> **👁 可视核查** → 核查页 [§5 表面与描边](#5-表面与描边)、[§6 品牌色阶](#6-品牌色阶)、
> [§7 状态色](#7-状态色)、[§8 图表分类色](#8-图表分类色)、[§9 语法高亮色](#9-语法高亮色)
>
> 切换核查页顶部的「深色模式」，逐个确认每个色档在明暗两种主题下的实际观感。`,
  },
  {
    heading: '### 6.3 文字层级：`--fg-*` 七档',
    block: `> **👁 可视核查** → 核查页 [§4 文字色七档](#4-文字色七档)
>
> 色卡里每档都渲染了真实文字（「优特 Ag」）。重点看 tertiary 与 disabled 两档在
> 正文旁边的实际区分度 —— 这是最容易在实际页面里"用错"的两档。`,
  },
  {
    heading: '### 6.2 品牌色阶：6 条语义出口，一个来源',
    block: `> **👁 可视核查** → 核查页 [§6 品牌色阶](#6-品牌色阶)
>
> 重点看 hover / active 两档是否**肉眼可区分**（同色相加深 12% / 24%）。若在
> 1440px 屏幕上分不出来，说明加深幅度需要调整。`,
  },
  {
    heading: '### 7.1 十档字号表',
    block: `> **👁 可视核查** → 核查页 [§1 字号十档](#1-字号十档)、[§3 页面层级四层](#3-页面层级四层)
>
> 每档都渲染了同一句中文「优特智能大模型服务平台」，可以直接看出：
> ① 30px 与 24px 的层级差是否够明显；② 14px 正文在真实文案下是否偏小；
> ③ 12px caption 是否已经小到看不清。`,
  },
  {
    heading: '### 7.4 mono 三档',
    block: `> **👁 可视核查** → 核查页 [§2 mono 三档](#2-mono-三档)
>
> 重点确认 13px \`mono-code\` 与 14px \`mono\` 并排时是否显得"降级"—— 这是
> 13px 只给固定高度代码容器用的原因。`,
  },
  {
    heading: '## 8. 间距、形状、描边、投影、动效',
    block: `> **👁 可视核查** → 核查页 [§10 圆角七档](#10-圆角七档)、[§11 间距](#11-间距)、
> [§12 密度 Token](#12-密度-token)、[§13 投影六档](#13-投影六档)、[§14 动效](#14-动效)
>
> 用顶部「密度 sm / xl」按钮切换，直接观察"密度只改留白、不改字号"是否成立。`,
  },
  {
    heading: '### 8.4 圆角',
    block: `> **👁 可视核查** → 核查页 [§10 圆角七档](#10-圆角七档)
>
> 每个档位都画了实心方块，看实际弧度 —— 8px（控件）与 10px（卡片/弹窗）的
> 差别在真实页面里是否需要同时存在。`,
  },
  {
    heading: '## 10. 组件尺寸与 Token 对应',
    block: `> **👁 可视核查** → 核查页 [§16 控件尺寸](#16-控件尺寸)、[§18 组件示范](#18-组件示范)
>
> 组件示范区把 Button / Badge / Input / Card / Dialog / Table / Toast / Empty
> 全部渲染成真实组件，可逐个核对字号、字重、圆角、内边距。`,
  },
  {
    heading: '## 11. Button 的九个尺寸档',
    block: `> **👁 可视核查** → 核查页 [§15 Button 九档](#15-button-九档)
>
> 九档尺寸 + 六种变体并排展示，可直接判断高度差是否够用、圆角是否合理。
> 切换密度按钮，观察高度是否跟随 Token 收缩。`,
  },
  {
    heading: '## 12. 导航选中态',
    block: `> **👁 可视核查** → 核查页 [§19 导航选中态](#19-导航选中态)
>
> 附实测对比度表：专用 Token 4.93:1（AA ✅）与误用 \`text-primary\` 4.44:1（❌）。
> 切换深色模式可核对深色下的 4.97:1。`,
  },
  {
    heading: '## 13. 图标',
    block: `> **👁 可视核查** → 核查页 [§17 图标五档](#17-图标五档)
>
> 五档图标按真实像素渲染，可确认 18px 默认档与 16px 紧凑档是否需要并存。`,
  },
  {
    heading: '## 17. 触控目标与焦点环',
    block: `> **👁 可视核查** → 核查页 [§20 焦点环与触控目标](#20-焦点环与触控目标)
>
> 左侧演示 1px 焦点环的实际观感，右侧对比「视觉 16px + 命中区 24px」与
> 「视觉 24px」两种做法。`,
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
console.log(`✅ 插入 ${inserted} 个可视核查块，跳过 ${skipped} 个（已存在或未找到）`)
