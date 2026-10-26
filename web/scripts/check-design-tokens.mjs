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
 * 设计系统静态扫描。
 *
 * 规范只靠文档和自觉是守不住的 —— 任何人都能随手写 `text-[15px]`、
 * `style={{ fontSize: 13 }}`，而且 Code Review 未必看得见。这个脚本
 * 负责把违规找出来。
 *
 * 用法：
 *   node scripts/check-design-tokens.mjs           报告模式（退出码 0）
 *   node scripts/check-design-tokens.mjs --strict  阻断模式（有违规即 1）
 *
 * 规则：
 *   T1  字号阶梯重复声明   `--text-*` 只允许出现在唯一来源
 *   T2  任意字号工具类     `text-[15px]`
 *   T3  任意行高工具类     `leading-[26px]`
 *   T4  内联字号数值       `style={{ fontSize: 13 }}`
 *   T5  CSS 硬编码字号     `font-size: 15px`
 *   T6  非浮层投影         `shadow-sm` / `shadow-[…]`（弹窗与浮层除外）
 *
 * 扫描不把硬编码一律判死：图表 canvas 的 `fontSize` 必须是数字、
 * 第三方控件的行内样式改不动、弹窗浮层本来就该有投影。这些进 ALLOWLIST，
 * 每条都必须写明理由 —— 没有理由的例外等于没有规范。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')
const STRICT = process.argv.includes('--strict')

/** 唯一允许声明字号阶梯的文件（相对 src）。 */
const LADDER_OWNER = 'design-system/tokens/typography.css'

/**
 * 允许投影的位置（相对 src）。规范 1.5：投影只留给弹窗、抽屉与浮层，
 * 其余界面靠 1px 描边和表面色差表达层级。`shadow-none` 不计违规 ——
 * 它是在**取消**投影。
 */
const OVERLAY_ALLOWLIST = [
  /^components\/ui\/(alert-dialog|calendar|chart|combobox|combobox-input|context-menu|dialog|drawer|dropdown-menu|hover-card|input-otp|menubar|navigation-menu|popover|select|sheet|sidebar|sonner|toast|tooltip)\.tsx$/,
  /^components\/floating-window\.tsx$/,
  /^components\/config-drawer\.tsx$/,
  // 移动端固定底部操作条：脱离文档流的浮起面。
  /^components\/layout\/constants\.ts$/,
  // fixed 浮动批量操作条：同上。
  /^components\/data-table\/toolbar\/bulk-actions\.tsx$/,
  // 只出现 shadow-none / !shadow-none（在取消投影）。
  /^components\/model-group-selector\.tsx$/,
  // 悬浮输入舱与它的浮层面板。
  /^features\/playground\/components\/input\/playground-input\.tsx$/,
  /^features\/keys\/components\/api-key-group-combobox\.tsx$/,
  // 渠道优先级拖拽的浮层落点提示。
  /^features\/channels\/components\/channel-priority-drop-hint\.tsx$/,
  // 投影 Token 的定义本身。
  /^design-system\/tokens\/elevation\.css$/,
]

/**
 * 已登记的例外。`match` 命中文件路径（相对 src，统一用 `/`），
 * `rules` 限定豁免哪几条规则，`reason` 必填。
 */
const ALLOWLIST = [
  {
    match: /^features\/.*\/lib\/(charts|flow)\.ts$/,
    rules: ['T4'],
    reason:
      'VChart 走 canvas 绘制，轴标签字号必须是数字，无法使用 CSS Token；取值须等于图表轴标签 12px。',
  },
  {
    match: /^features\/dashboard\/components\/.*\.tsx$/,
    rules: ['T4'],
    reason: '同上：VChart option 里的 fontSize 是 canvas 配置，不是 DOM 样式。',
  },
  {
    match: /^features\/rankings\/components\/.*\.tsx$/,
    rules: ['T4'],
    reason: '同上：VChart option 里的 fontSize 是 canvas 配置，不是 DOM 样式。',
  },
  {
    match: /^features\/pricing\/components\/model-details-charts\.tsx$/,
    rules: ['T4'],
    reason: '同上：VChart option 里的 fontSize 是 canvas 配置，不是 DOM 样式。',
  },
  {
    match: /^features\/customer-service\/CustomerServiceWidget\.tsx$/,
    rules: ['T4'],
    reason: '第三方客服挂件，样式由其自身注入，无法接入本项目 Token。',
  },
  {
    match: /^features\/errors\/.*\.tsx$/,
    rules: ['T2'],
    reason:
      '错误页的巨型状态码数字（7rem）是纯装饰性图形，不属于内容层级，不参与九档字号阶梯。',
  },
  {
    match: /^features\/channels\/components\/channel-priority-demo\.tsx$/,
    rules: ['T6'],
    reason:
      '拖拽中的瞬时浮起态，卡片离开文档流、z-index 提升，性质等同浮层（见 exceptions.md E9）。',
  },
  {
    match: /^features\/home\/components\/hero-terminal-demo\.tsx$/,
    rules: ['T6'],
    reason:
      '卡片主体投影（light shadow-[0_20px_50px_-25px_…] / dark shadow-[0_20px_60px_-25px_…]）+「200 ok」live 状态点彩色辉光 shadow-[0_0_8px_…]。投影为有意加的产品决策，让 hero 终端从页面背景中浮起（见 exceptions.md E10）。',
  },
  {
    match: /^styles\/theme-presets\.css$/,
    rules: ['T1'],
    reason:
      '「Simple Large-font」预设本身就是无障碍大字模式，用户在主题选择里主动开启，字号变化是该预设的显式契约而非副作用（见 exceptions.md E11）。',
  },
  // ── T7 调色板直用 ────────────────────────────────────────────────
  // 规范 §1.1「所有颜色均按语义变量使用，不直接写死色值」。这里只登记
  // **确实无法语义化**的三类：分类色、语法高亮、营销装饰色。
  // 状态色（成功/警告/危险）**不在此列**——它们有 success/warning/
  // destructive Token，出现在报告里就是待迁移项。
  {
    // 用户可选的分类色板：这个 Map 的存在意义就是把原始调色板暴露出来，
    // 与 status 语义无关（avatarColorMap 已经走 Token，是正确样板）。
    match: /^lib\/colors\.ts$/,
    rules: ['T7'],
    reason:
      'colorToBgClass 是「用户自选分类色 → Tailwind 类」的查找表，语义就是原始调色板；同文件的 avatarColorMap 已改用语义 Token。',
  },
  {
    // 插件图标的分类 tint：按插件类别区分，不表达成功/警告/危险。
    match: /^features\/task-plugins\/lib\/plugin-icon\.ts$/,
    rules: ['T7'],
    reason: '插件类别的分类色，与状态语义无关，同 lib/colors.ts 的分类色板。',
  },
  {
    // 代码高亮：token 颜色由语言语法决定，无法用界面语义色表达
    // （与 T4 对 VChart canvas 字号的豁免同一理由）。
    match:
      /^features\/task-plugins\/components\/(source-diff|javascript-viewer)\.tsx$/,
    rules: ['T7'],
    reason: '代码高亮配色由语言语法决定，无法接入界面语义 Token。',
  },
  {
    match: /^components\/json-code-editor\.tsx$/,
    rules: ['T7'],
    reason: '代码编辑器配色，同上。',
  },
  {
    // GitHub 风格 markdown 警报（> [!NOTE]/[!WARNING]/[!DANGER]）的
    // 配色对齐 GitHub 官方规范，改语义 Token 会破坏与源文档的一致性。
    match: /^components\/ai-elements\/response-renderer-alert\.tsx$/,
    rules: ['T7'],
    reason:
      'GitHub 风格 markdown 警报配色须与 GitHub 官方一致，不用界面语义色。',
  },
  {
    // 多序列图表：序列之间必须可区分，语义 Token 只有四组状态色，不够分。
    match:
      /^features\/pricing\/components\/(dynamic-pricing-breakdown|model-details-uptime-sparkline)\.tsx$/,
    rules: ['T7'],
    reason:
      '多序列图表的区分色，语义状态 Token 数量不足；同 VChart canvas 的豁免理由。',
  },
  {
    match: /^features\/channels\/components\/channel-priority-demo\.tsx$/,
    rules: ['T7'],
    reason: '拖拽演示的分类色，仅用于示意，不进入生产界面。',
  },
  {
    // 营销页装饰强调色。规范 §4 要求主色只有黑白两档、彩色只出现在
    // 危险/成功与一处荧光绿强调——首页的蓝紫渐变属于待决的视觉改造
    // （不在本次范围内），先登记测量，不静默放过。
    match:
      /^features\/home\/components\/(sections\/(hero|features|cta)\.tsx|hero-terminal-demo\.tsx)$/,
    rules: ['T7'],
    reason:
      '营销页装饰强调色。规范 §4 要求单色系，改造属视觉决策（本次范围外），先登记测量。',
  },
  {
    match: /^features\/rankings\/components\/.*\.tsx$/,
    rules: ['T7'],
    reason: '榜单营销页的装饰强调色，同 features/home 的处理。',
  },
]

const RULES = {
  T1: '字号阶梯重复声明（--text-* 只能出现在唯一来源）',
  T2: '任意字号工具类（text-[…px]）',
  T3: '任意行高工具类（leading-[…px]）',
  T4: '内联字号数值（fontSize: N）',
  T5: 'CSS 硬编码字号（font-size: Npx）',
  T6: '非浮层投影（shadow-…，弹窗与浮层除外）',
  T7: '调色板直用颜色（bg/text/border-{slate|emerald|…}-{shade}，未走语义 Token）',
}

/**
 * T7 的目标调色板。`chart-*` 不在内——它们是 `--color-chart-N` 语义 Token，
 * 已经是正确写法。`white` / `black` 也不在内：二者是无彩色极值，
 * 规范 §1.1 的 Surface 组本身就用 #FFFFFF / #020617。
 */
const PALETTE_NAMES =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'

/** 颜色类的前缀（Tailwind 里能接颜色的工具类）。 */
const COLOR_UTILITY_PREFIXES =
  'bg|text|border|ring|from|to|via|fill|stroke|decoration|shadow|outline|caret|accent|divide|placeholder'

/**
 * 匹配一个完整的颜色类，含变体前缀与不透明度修饰：
 *   dark:bg-emerald-950/15 · hover:text-amber-600 · !text-red-600
 * 逐 token 匹配（而不是整行正则）是为了报告里能显示完整的类名。
 */
const PALETTE_CLASS_RE = new RegExp(
  `(?:(?:dark|hover|focus|active|group-hover|focus-visible|aria-pressed|data-\\[[^\\]]*\\]):)*` +
    `!?(?:${COLOR_UTILITY_PREFIXES})-(?:${PALETTE_NAMES})-\\d{2,3}(?:/\\d+)?\\b`,
  'g'
)

const SCAN_EXT = new Set(['.ts', '.tsx', '.css'])

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__') continue
      walk(full, out)
    } else if (SCAN_EXT.has(entry.slice(entry.lastIndexOf('.')))) {
      out.push(full)
    }
  }
  return out
}

function isAllowed(rel, rule) {
  if (rule === 'T6' && OVERLAY_ALLOWLIST.some((re) => re.test(rel))) return true
  return ALLOWLIST.some(
    (entry) => entry.rules.includes(rule) && entry.match.test(rel)
  )
}

const findings = []

function report(rule, file, line, text) {
  findings.push({ rule, file, line, text: text.trim().slice(0, 120) })
}

for (const abs of walk(SRC)) {
  const rel = relative(SRC, abs).split(sep).join('/')
  const source = readFileSync(abs, 'utf8')
  const lines = source.split('\n')

  lines.forEach((raw, index) => {
    const line = index + 1

    // 注释里经常出现反例说明（例如「不要写 text-[15px]」），跳过整行
    // 注释，否则规范文档自己会被判成违规。
    const trimmed = raw.trim()
    if (
      trimmed.startsWith('*') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('*/')
    ) {
      return
    }

    // T1：--text-* 的声明位置
    if (/^\s*--text-[a-z0-9]+(-{2}line-height)?:/.test(raw)) {
      if (rel !== LADDER_OWNER) {
        report('T1', rel, line, raw)
      }
    }

    // T2：任意字号
    //
    // 匹配一切 `text-[…]`，但放行颜色与 CSS 变量：
    //   · text-[color-mix(...)] / text-[CanvasText] / text-[#hex] 是颜色
    //   · text-[var(--text-sm)] 是引用 Token，属于正确写法
    // clamp() 不算颜色 —— 营销页常用 `text-[clamp(2rem,5vw,3.5rem)]`
    // 把标题顶到规范之外的字号，正是要拦的。
    for (const hit of raw.match(/text-\[[^\]]*\]/g) ?? []) {
      const inner = hit.slice('text-['.length, -1).trim()
      if (
        inner.startsWith('var(') ||
        inner.startsWith('#') ||
        /^(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color|color-mix)\(/.test(
          inner
        ) ||
        inner === 'Canvas' ||
        inner === 'CanvasText'
      ) {
        continue
      }
      report('T2', rel, line, raw)
      break
    }

    // T3：任意行高
    if (/leading-\[[0-9.]+(px|rem)\]/.test(raw)) {
      report('T3', rel, line, raw)
    }

    // T4：内联字号（图表 option 里的 fontSize 走 ALLOWLIST）
    if (/fontSize:\s*[0-9]/.test(raw)) {
      report('T4', rel, line, raw)
    }

    // T5：CSS 硬编码字号
    if (/font-size:\s*[0-9.]+px/.test(raw)) {
      report('T5', rel, line, raw)
    }

    // T6：非浮层投影。`shadow-none` / `!shadow-none` 是在取消投影，放行。
    if (/[a-z-]*shadow-(?:xs|sm|md|lg|xl|2xl|inner|\[[^\]]*\])/.test(raw)) {
      report('T6', rel, line, raw)
    }

    // T7：调色板直用颜色。`chart-*` 是语义 Token，不在匹配范围内。
    for (const hit of raw.match(PALETTE_CLASS_RE) ?? []) {
      report('T7', rel, line, hit)
    }
  })
}

const violations = findings.filter((f) => !isAllowed(f.file, f.rule))

const grouped = new Map()
for (const item of violations) {
  if (!grouped.has(item.rule)) grouped.set(item.rule, [])
  grouped.get(item.rule).push(item)
}

const totalFiles = new Set(violations.map((v) => v.file)).size

if (violations.length === 0) {
  console.log(
    `design-tokens: 通过。扫描 ${walk(SRC).length} 个文件，未发现违规字号。`
  )
} else {
  console.log(
    `design-tokens: 发现 ${violations.length} 处违规，分布在 ${totalFiles} 个文件。\n`
  )
  for (const [rule, items] of [...grouped.entries()].sort()) {
    console.log(`  ${rule}  ${RULES[rule]}  ×${items.length}`)
    for (const item of items.slice(0, 12)) {
      console.log(`        ${item.file}:${item.line}  ${item.text}`)
    }
    if (items.length > 12) {
      console.log(`        …还有 ${items.length - 12} 处`)
    }
    console.log('')
  }
  console.log(
    '修复方式：字号用标准阶梯（text-xs/sm/base/lg/2xl/3xl）或 <Text> / <Heading>；\n' +
      '确实无法接入 Token 的场景，在 scripts/check-design-tokens.mjs 的 ALLOWLIST 登记并写明理由。'
  )
}

const allowed = findings.length - violations.length
if (allowed > 0) {
  console.log(`\n已登记例外（不计入违规）：${allowed} 处`)
}

if (STRICT && violations.length > 0) {
  process.exit(1)
}
