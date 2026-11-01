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
 *   T7  调色板直用颜色     `bg-emerald-500`（未走语义 Token）
 *   T8  裸色值             `'#6366f1'` / `rgba(15,23,42,…)`（未走 Token）
 *   T9  行高覆盖           `leading-*`（行高由字号 Token 自带，不再单独覆盖）
 *   T10 任意圆角           `rounded-[3px]`（圆角阶梯只有 xs/sm/md/lg/xl/2xl）
 *   T11 未登记动效节奏     `duration-300` / `ease-[cubic-bezier(…)]`（§1.6 只有五组）
 *   T12 字距类             `tracking-*`（统一移除，`tracking-normal` 放行）
 *   T13 透明度冒充文字层级 `text-foreground/60`（§11.3 禁止，改 `text-fg-secondary`）
 *   T14 透明度凑悬停       `hover:bg-primary/90`（§11.2 禁止，改用 `*-hover` Token）
 *   T15 透明度凑浅底       `bg-warning/10`（§11.2 禁止，改用 `*-soft` / `*-subtle`）
 *   T16 低于最小字号       `text-[11px]` / `font-size: 10px`（§12.15 全站下限 12px）
 *
 * 扫描不把硬编码一律判死：图表 canvas 的 `fontSize` 必须是数字、
 * 第三方控件的行内样式改不动、弹窗浮层本来就该有投影。这些进 ALLOWLIST，
 * 每条都必须写明理由 —— 没有理由的例外等于没有规范。
 */

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')
const STRICT = process.argv.includes('--strict')

// 基线模式（规范 §24「基线机制」）：把存量违规与本次新增区分开。
//   --baseline        只对比基线里没有的条目；有新增即退出码 1（给 CI 用）
//   --write-baseline  把当前违规写进快照；条数只允许下降（"基线只减不增"）
//   --force-baseline  配合上一条，确需扩容时显式声明（必须写清理由）
const BASELINE_PATH = join(ROOT, 'design-tokens.baseline.json')
const BASELINE_MODE = process.argv.includes('--baseline')
const WRITE_BASELINE = process.argv.includes('--write-baseline')
const FORCE_BASELINE = process.argv.includes('--force-baseline')

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
 * 例外清单：**当前为空**。
 *
 * 2026-10-27 全量整改后，原先 300 处登记例外已全部改为合规写法：
 *   · T1 主题预设的字号覆盖   → 并入 `design-system/tokens/typography.css`
 *   · T2 错误页 7rem 状态码   → 改用 display 档（`text-4xl`）
 *   · T4 图表 canvas 字号     → 收敛到 `design-system/tokens/chart-typography.ts`
 *   · T6 营销页/拖拽投影      → 删除（规范 §1.5：非浮层不投影）
 *   · T7 调色板直用颜色       → 新增 `syntax-*` Token + 改走 `chart-*` /
 *                              `*-soft` / 品牌色 / 状态色语义
 *
 * 需要新增例外时，必须同时满足：① 写明 `reason`；② 在
 * `docs/design-system/design-system.md` 登记编号与影响范围；③ 说明为什么
 * 无法用 Token 表达。没有理由的例外等于没有规范。
 */
/**
 * 逐条登记的真例外。每条必须：① `reason` 写明为什么无法用 Token 表达；
 * ② 在 `docs/design-system/design-system.md` 登记编号与影响范围。
 */
/**
 * 例外清单：**当前为空**（2026-10-30）。
 *
 * 原先的 E25 / E26 / E27 三条都是首屏代码卡与品牌渐变，理由是「须与上游
 * new-api 逐类一致，无法用 Token 表达」。**这个理由不成立**：要求从来只是
 * 「渲染效果与上游一致」，不是「类名逐字照抄」。把效果定档成 Token
 * （`term-*` 语义组 + `ds-text-gradient-brand`），效果一分不变，写法却变成
 * 可被机器校验的形式 —— 于是三条例外全部注销，见规范 §26。
 *
 * 这条判断写在这里，是为了阻止下一个 AI 再犯同样的错：
 *
 *   ❌ 「上游是这么写的，所以这里必须写成一样的形式」→ 登记例外
 *   ✅ 「要和上游长得一样」→ 把**效果**落成 Token / 条款，代码改用 Token
 *
 * 只有当某个效果**确实**无法被 Token 表达时，才允许在这里加条目 —— 并且必须
 * 同时满足上述三条，还要写清退出条件。
 */
const ALLOWLIST = []

const RULES = {
  T1: '字号阶梯重复声明（--text-* 只能出现在唯一来源）',
  T2: '任意字号工具类（text-[…px]）',
  T3: '任意行高工具类（leading-[…px]）',
  T4: '内联字号数值（fontSize: N）',
  T5: 'CSS 硬编码字号（font-size: Npx）',
  T6: '非浮层投影（shadow-…，弹窗与浮层除外）',
  T7: '调色板直用颜色（bg/text/border-{slate|emerald|…}-{shade}，未走语义 Token）',
  T8: '裸色值（#hex / rgba()，未走 Token）',
  T9: '行高覆盖（leading-…，行高应由字号 Token 决定）',
  T10: '任意圆角（rounded-[…]，圆角阶梯只有 xs/sm/md/lg/xl/2xl）',
  T11: '未登记动效节奏（duration-N / ease-[cubic-bezier(…)]，§1.6 只有五组时长）',
  T12: '字距类（tracking-*，规范统一移除，字距由字号 Token 自带）',
  T13: '透明度冒充文字层级（text-foreground/NN，改用 text-fg-secondary / text-fg-tertiary）',
  T14: '透明度凑悬停（hover:bg-{primary|secondary|destructive|success}/NN，改用 *-hover Token）',
  T15: '透明度凑浅底（bg-{success|warning|info}/NN → *-soft；bg-{primary|destructive}/NN → *-subtle）',
  T16: '低于最小字号（规范 §12.15：全站可见文本下限 12px，布局不够用改布局不许缩字号）',
}

/**
 * 允许出现裸色值的位置（相对 src）。
 *
 * 这两类**不是例外，而是颜色的所有者**——它们本身就是 Token 的定义处：
 *   · `design-system/tokens/brand-colors.ts`
 *       第三方商标配色（支付宝蓝、微信绿、OpenAI 青绿）与多序列分类调色板。
 *       前者改成 `--primary` 等于改人家 logo；后者一屏要区分十几个实体，
 *       语义层只有 `chart-1…5` 五个槽位，不够用。集中声明，禁止散落。
 *   · `assets/**` 里的 SVG 图标 / 插画
 *       图形本身就是色彩，`fill='#fff'` 是画出来的形状，不是界面配色。
 */
const RAW_COLOR_OWNERS = [
  /^design-system\/tokens\/brand-colors\.ts$/,
  /^assets\//,
  // Token 定义文件本身就是颜色的落点：调色板、语义层、主题预设、语法色。
  /^design-system\/tokens\/[a-z-]+\.css$/,
  /^styles\/(theme|theme-presets|globals)\.css$/,
]

/** 裸色值：`#rgb` / `#rrggbb` / `#rrggbbaa`、`rgb()` / `rgba()` 字面量。 */
const RAW_COLOR_RE = /#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*\d/g
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

/**
 * T13–T15：禁止用透明度 `/NN` 凑层级、凑悬停、凑浅底。
 *
 * 规范 §11.2 / §11.3 / §25 把这三类列为禁止项并给出了替代 Token —— 理由是
 * 透明度会**随底下的颜色漂移**：`hover:bg-primary/90` 在深色底上发灰、在浅色
 * 底上泛白；`text-foreground/60` 冒充次要文字时，浅色主题可能刚好，深色主题
 * 就掉到对比度线以下（§11.5 要求每次改透明度都重算对比度，靠 opacity 根本
 * 没法验证）。所以替代品是**主题无关的语义 Token**：
 *
 *   text-foreground/NN   → text-fg-secondary / text-fg-tertiary
 *   hover:bg-primary/90  → hover:bg-primary-hover
 *   bg-warning/10        → bg-warning-soft（success / info 同理）
 *   bg-primary/10        → bg-primary-subtle（destructive 同理）
 *
 * 只拦**已有替代 Token** 的写法。`border-warning/20`、`ring-primary/15` 这类
 * 目前没有对应 Token，拦了也无处可改 —— 那属于「待补 Token」而不是欠债，
 * 统一记在规范 §25，不在这里误报。
 */
const VARIANT_TOKEN =
  '(?:[a-zA-Z][a-zA-Z0-9-]*(?:\\[[^\\]]*\\])?|\\[[^\\]]*\\]):'
const VARIANT_PREFIX_RE = `(?:${VARIANT_TOKEN})*!?`

/** 浅底 Token 的归属：`bg-<name>/NN` 该换成 `-soft` 还是 `-subtle`。 */
const SUBTLE_BACKGROUNDS = {
  success: 'soft',
  warning: 'soft',
  info: 'soft',
  primary: 'subtle',
  destructive: 'subtle',
}

/** 组建一条 T13–T15 的规则：工具类主体 + 可选的不透明度数值。 */
function opacityUtilityRe(body, percent = '\\d{1,3}') {
  return new RegExp(`${VARIANT_PREFIX_RE}${body}/${percent}\\b`, 'g')
}

const T13_RE = opacityUtilityRe('text-foreground')
const T14_RE = opacityUtilityRe(
  'hover:bg-(?:primary|secondary|destructive|success)'
)
// T15 只管**浅底**（≤20%）。`/70`、`/90` 那类高透明度是有意的半透明实心填充，
// 换成 `-soft` 会直接改变观感 —— 那不是欠债，别误报。
const T15_RE = opacityUtilityRe(
  `bg-(?:${Object.keys(SUBTLE_BACKGROUNDS).join('|')})`,
  '(?:[0-9]|1[0-9]|20)'
)

/**
 * 规范 §1.5 允许的全部投影 / 辉光 Token（2026-10-28 定档）。
 *
 * 四档投影按「元素是否离开文档流」分工，一档辉光表达状态语义：
 *   none       静止的页面内元素
 *   popover    下拉面板 / 气泡 / 悬浮提示
 *   overlay    弹窗 / 抽屉 / 浮层
 *   raised     拖拽中的元素（瞬时离开文档流）
 *   marketing  营销展示卡片（脱离页面平面）
 *   glow-online 在线状态点
 *
 * 新增档位必须先改 `design-system/tokens/elevation.css` 与规范 §1.5，
 * 再往这个集合里加 —— 只改一边会被门禁拦下。
 */
const ELEVATION_TOKENS = new Set([
  'shadow-(--ds-elevation-none)',
  'shadow-(--ds-elevation-popover)',
  'shadow-(--ds-elevation-overlay)',
  'shadow-(--ds-elevation-raised)',
  'shadow-(--ds-elevation-marketing)',
  'shadow-(--ds-glow-online)',
])

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
  if (rule === 'T8' && RAW_COLOR_OWNERS.some((re) => re.test(rel))) return true
  // T8 只查界面代码。`*.test.ts(x)` 里的色值是断言用的夹具
  // （例如验证 `resolveCssColor` 能把 `#abc` 解析成 rgba），不是界面配色。
  if (rule === 'T8' && /\.test\.tsx?$/.test(rel)) return true
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
  // 注释里经常出现反例说明（「不要写 `text-[15px]`」「此前是 rounded-[2px]」），
  // 逐行 `startsWith('*')` 只能盖住单行注释，盖不住 JSX 的 `{/* … */}` 与
  // 跨行块注释。这里先把块注释内容整体抹成空格（换行保留，行号不变），
  // 再逐行扫描 —— 否则规范文档自己会被判成违规。
  const scannable = source.replaceAll(/\/\*[\s\S]*?\*\//g, (block) =>
    block.replaceAll(/[^\n]/g, ' ')
  )
  const lines = scannable.split('\n')
  const rawLines = source.split('\n')

  lines.forEach((raw, index) => {
    const line = index + 1
    // 报错时给出**原始行**（抹过注释的行只剩空格，读不出问题）
    const rawText = rawLines[index] ?? raw

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
        report('T1', rel, line, rawText)
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
      report('T2', rel, line, rawText)
      break
    }

    // T3：任意行高
    if (/leading-\[[0-9.]+(px|rem)\]/.test(raw)) {
      report('T3', rel, line, rawText)
    }

    // T4：内联字号（图表 option 里的 fontSize 走 ALLOWLIST）
    if (/fontSize:\s*[0-9]/.test(raw)) {
      report('T4', rel, line, rawText)
    }

    // T5：CSS 硬编码字号
    if (/font-size:\s*[0-9.]+px/.test(raw)) {
      report('T5', rel, line, rawText)
    }

    // T16：低于最小字号（规范 §12.15「Typography Minimum Size Rule」）。
    //
    // T2/T4/T5 拦的是「写法」（任意值/内联/CSS 硬编码），这条拦的是**数值**：
    // 哪怕写法走的是允许形式，只要换算成 px 后 < 12 一律违规。扫描面：
    //   · `text-[11px]` / `text-[0.6875rem]` 任意字号值
    //   · `font-size: 10px` / `font-size: 0.625rem` CSS 声明
    //   · `fontSize: 11` / `fontSize: '10px'` 内联与 canvas 配置
    //   · `--text-*: 0.6875rem` 阶梯 Token 本身（下限在阶梯里钉死）
    // 布局空间不足时按规范调整容器、间距、换行或滚动，不允许缩字号。
    {
      const candidates = []
      for (const hit of raw.match(/text-\[([0-9.]+)(px|rem)\]/g) ?? []) {
        candidates.push(hit.slice('text-['.length, -1))
      }
      for (const m of raw.matchAll(/font-size:\s*([0-9.]+)(px|rem)/g)) {
        candidates.push(m[1] + m[2])
      }
      for (const m of raw.matchAll(
        /fontSize:\s*['"]?([0-9.]+)(px|rem)?['"]?/g
      )) {
        candidates.push(m[1] + (m[2] ?? 'px'))
      }
      for (const m of raw.matchAll(/--text-[a-z0-9]+:\s*([0-9.]+)(px|rem)/g)) {
        candidates.push(m[1] + m[2])
      }
      const below = candidates.find((value) => {
        const num = Number.parseFloat(value)
        return value.endsWith('rem') ? num * 16 < 12 : num < 12
      })
      if (below !== undefined) {
        report('T16', rel, line, rawText)
      }
    }

    // T6：非浮层投影。`shadow-none` / `!shadow-none` 是在取消投影，放行。
    //
    // 规范 §1.5 只认四档投影 + 一档状态辉光，写法必须是
    // `shadow-(--ds-elevation-{none|popover|overlay|raised|marketing})`
    // 或 `shadow-(--ds-glow-online)`。引用不存在的档位（例如自造
    // `--ds-elevation-card`）同样是违规 —— 否则「只许四档」就形同虚设。
    if (/[a-z-]*shadow-(?:xs|sm|md|lg|xl|2xl|inner|\[[^\]]*\])/.test(raw)) {
      report('T6', rel, line, rawText)
    } else {
      for (const hit of raw.match(
        /shadow-\(--ds-(?:elevation|glow)-[a-z-]+\)/g
      ) ?? []) {
        if (ELEVATION_TOKENS.has(hit)) continue
        report('T6', rel, line, rawText)
        break
      }
    }

    // T7：调色板直用颜色。`chart-*` 是语义 Token，不在匹配范围内。
    for (const hit of raw.match(PALETTE_CLASS_RE) ?? []) {
      report('T7', rel, line, hit)
    }

    // T8：裸色值
    //
    // 先剥掉 Tailwind 的任意变体选择器 `[&_…]`：recharts 的样式覆盖写的是
    // `[&_.recharts-grid_line[stroke='#ccc']]:stroke-border` —— 那是**匹配**
    // recharts 自己画的颜色再改掉，不是我们用了这个颜色，误报会淹没真问题。
    const withoutSelectors = raw.replaceAll(/\[&_[^\]]*\]/g, '')
    if (RAW_COLOR_RE.test(withoutSelectors)) {
      report('T8', rel, line, rawText)
    }

    // T9：行高覆盖
    //
    // 规范里行高是**字号 Token 的一部分**（14/20、16/26、12/16…），
    // `leading-tight` / `leading-6` 这类工具类会把它从阶梯上拽下来：
    // `text-sm leading-relaxed` 实际是 14/22.75，`text-xs leading-5` 是
    // 12/20 —— 都不在任何一档里。要松一点的行距就换 `text-long`（16/26）。
    //
    // `leading-[var(--ds-line-…)]` 放行：那是**引用 Token**，属于正确写法
    // （等宽代码容器需要固定高度，只能显式锁行高）。
    for (const hit of raw.match(/\bleading-(?:\[[^\]]*\]|[a-z0-9-]+)/g) ?? []) {
      if (hit.startsWith('leading-[var(--')) continue
      report('T9', rel, line, rawText)
      break
    }

    // T10：任意圆角
    //
    // 圆角阶梯是 4/6/8/10/12/16/9999（见 tokens/radius）。`rounded-[3px]`
    // 这类自造档位会让同一层级的控件圆角不一致。
    // 放行 `rounded-[inherit]`：滚动区视口必须继承外层圆角，没有对应工具类；
    // 放行 `rounded-[var(--radius-…)]`：引用 Token 是正确写法。
    for (const hit of raw.match(/\brounded-\[[^\]]*\]/g) ?? []) {
      if (hit === 'rounded-[inherit]' || hit.startsWith('rounded-[var(--')) {
        continue
      }
      report('T10', rel, line, rawText)
      break
    }

    // T11：未登记的动效节奏
    //
    // 规范 §1.6 把时长分成五组，写法只有两种：`ds-motion-*` 工具类
    // （时长与缓动一起下发），或 keyframes 里的 `var(--ds-motion-*)`。
    // `duration-300` / `duration-[0.35s]` / `ease-[cubic-bezier(…)]` 都是
    // 在阶梯外自造节奏 —— 单看一处「只是慢了一点」，全站叠起来就是
    // 每个页面各有一套呼吸频率。
    //
    // 例外：`animate-*` 的 `duration-*`（tw-animate 用它设 animation-duration）
    // 不在此列 —— 那类写法必须和 `animate-in` / `animate-out` 同时出现。
    if (
      /\bduration-(?:\[[^\]]*\]|[0-9]+)\b/.test(raw) &&
      !/\banimate-(in|out)\b/.test(raw)
    ) {
      report('T11', rel, line, rawText)
    } else if (/\bease-\[cubic-bezier\(/.test(raw)) {
      report('T11', rel, line, rawText)
    }

    // T12：字距类。规范统一移除 tracking-*（字距由字号 Token 自带，手动加
    // tracking-* 会破坏阶梯的视觉间距约定）。`tracking-normal` 是「取消字距」，
    // 放行。
    for (const hit of raw.match(/\btracking-[a-z0-9-]+/g) ?? []) {
      if (hit === 'tracking-normal') continue
      report('T12', rel, line, rawText)
      break
    }

    // T13：透明度冒充文字层级。`text-foreground/40` 是在用不透明度伪造
    // 「次级文字」—— 二级/三级文字已有 `fg-secondary` / `fg-tertiary` 两档
    // 语义 Token，且各自在深浅两套主题下都做过对比度实测（§11.5）。
    for (const _ of raw.match(T13_RE) ?? []) {
      report('T13', rel, line, rawText)
      break
    }

    // T14：透明度凑悬停。md:hover:bg-destructive/30 这类写法在两个主题下的
    // 实际观感不同（深底发灰、浅底泛白），已有 `destructive-hover` 等 Token。
    for (const _ of raw.match(T14_RE) ?? []) {
      report('T14', rel, line, rawText)
      break
    }

    // T15：透明度凑浅底。`hover:` 的那部分已由 T14 报过，这里跳过避免重复计数。
    for (const hit of raw.match(T15_RE) ?? []) {
      if (hit.includes('hover:')) continue
      report('T15', rel, line, rawText)
      break
    }
  })
}

const violations = findings.filter((f) => !isAllowed(f.file, f.rule))

// ---------------------------------------------------------------------------
// 基线模式：先把这条路径处理完，再看是否需要走常规输出。
//
// 为什么这么做：一次全量清理之前，存量违规会一直卡住开发，于是大家要么绕过
// 门禁、要么在赶工时把几十处一起改坏。基线让「历史遗留」与「本次引入」分开
// 计价 —— 新增必须为零，存量排期清理，清理完条数只许下降（规范 §24）。
//
// 条目的身份是 **规则 + 文件 + 证据串**，刻意不含行号：无关 commit 挪动一行就
// 会让整份基线作废，那是给未来制造噪音。行号仍写进快照，只为人工定位用。
// ---------------------------------------------------------------------------
function baselineKey(item) {
  return `${item.rule}|${item.file}|${item.text.replaceAll(/\s+/g, ' ').trim()}`
}

function readBaseline() {
  if (!existsSync(BASELINE_PATH)) return null
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  } catch (error) {
    console.error(`无法解析基线文件 ${BASELINE_PATH}：${error.message}`)
    process.exit(2)
  }
}

if (WRITE_BASELINE) {
  const previous = readBaseline()
  const previousCount = previous?.entries?.length ?? 0
  const entries = violations
    .map((v) => ({
      rule: v.rule,
      file: v.file,
      line: v.line,
      text: v.text,
      key: baselineKey(v),
    }))
    .sort((a, b) => a.key.localeCompare(b.key))

  if (entries.length > previousCount && !FORCE_BASELINE) {
    console.error(
      `✗ 基线不允许变多：快照 ${previousCount} 条 → 现在 ${entries.length} 条。\n` +
        `  规范 §24 要求「基线只减不增」。先修掉多出来的 ${entries.length - previousCount} 处，\n` +
        `  确属必须扩容时用 --force-baseline 并在提交说明里写明理由。`
    )
    process.exit(2)
  }

  writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify(
      {
        说明:
          '存量设计令牌违规快照。身份 = 规则 + 文件 + 证据串（不含行号）。' +
          'CI 只对比基线里没有的条目；条数只减不增。真正的例外走 ALLOWLIST，不进这里。',
        updatedAt: new Date().toISOString(),
        entries,
      },
      null,
      2
    )}\n`
  )
  console.log(
    `design-tokens: 基线已写入 ${relative(ROOT, BASELINE_PATH)}，共 ${entries.length} 条` +
      (previousCount
        ? `（此前 ${previousCount} 条，减少 ${previousCount - entries.length} 条）`
        : '')
  )
  process.exit(0)
}

if (BASELINE_MODE) {
  const baseline = readBaseline()
  const known = new Set((baseline?.entries ?? []).map((e) => e.key))
  const fresh = violations.filter((v) => !known.has(baselineKey(v)))
  const cleared = [...known].filter(
    (key) => !violations.some((v) => baselineKey(v) === key)
  )

  if (fresh.length === 0) {
    console.log(
      `design-tokens: 无新增违规（基线内存量 ${known.size} 条${
        cleared.length ? `，其中 ${cleared.length} 条已修复待更新快照` : ''
      }）。`
    )
    process.exit(0)
  }

  console.log(`design-tokens: 发现 ${fresh.length} 处**新增**违规：\n`)
  for (const item of fresh) {
    console.log(`  ${item.rule}  ${item.file}:${item.line}  ${item.text}`)
  }
  console.log(
    '\n基线记的是存量欠债，不是许可证：修掉上面的写法，或在确实无法接入 Token 时\n' +
      '把理由写进 scripts/check-design-tokens.mjs 的 ALLOWLIST 并登记 §26。'
  )
  process.exit(1)
}

const grouped = new Map()
for (const item of violations) {
  if (!grouped.has(item.rule)) grouped.set(item.rule, [])
  grouped.get(item.rule).push(item)
}

const totalFiles = new Set(violations.map((v) => v.file)).size

if (violations.length === 0) {
  console.log(
    `design-tokens: 通过。扫描 ${walk(SRC).length} 个文件，字号 / 行高 / 圆角 / 投影 / 颜色均符合规范。`
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
      '行高由字号自带（不要写 leading-*）；颜色走语义 Token（text-foreground / bg-success-soft /\n' +
      'chart-N / syntax-*）；第三方商标色与多序列分类色从 design-system/tokens/brand-colors 取；\n' +
      '动效用 ds-motion-* 工具类或 var(--ds-motion-*)，不要写 duration-N / ease-[cubic-bezier(…)]。\n' +
      '字距由字号 Token 自带，不要写 tracking-*（移除即可）。\n' +
      '不要用透明度凑层级/悬停/浅底：text-foreground/NN 改 text-fg-secondary（或 tertiary）；\n' +
      'hover:bg-primary/NN 改 hover:bg-primary-hover；bg-warning/NN 改 bg-warning-soft；\n' +
      'bg-primary/NN、bg-destructive/NN 改对应的 -subtle。\n' +
      '确实无法接入 Token 的场景，在 scripts/check-design-tokens.mjs 的 ALLOWLIST 登记并写明理由。'
  )
}

const allowed = findings.length - violations.length
if (allowed > 0) {
  // 这些**都不是例外**，分开报数是为了避免误读：
  //   · 浮层投影    规范 §1.5 明确规定「投影只留给弹窗与浮层」，是合规写法
  //   · 颜色所有者  Token 定义处本身就该写色值（调色板、品牌色、SVG 图形）
  //   · 已登记例外  ALLOWLIST 里逐条写了理由的真例外
  const allowedFindings = findings.filter((f) => !violations.includes(f))
  const overlayCount = allowedFindings.filter(
    (f) => f.rule === 'T6' && OVERLAY_ALLOWLIST.some((re) => re.test(f.file))
  ).length
  const ownerCount = allowedFindings.filter(
    (f) =>
      f.rule === 'T8' &&
      (RAW_COLOR_OWNERS.some((re) => re.test(f.file)) ||
        /\.test\.tsx?$/.test(f.file))
  ).length
  const exceptionCount = allowed - overlayCount - ownerCount
  if (overlayCount > 0) {
    console.log(`\n浮层投影（规范 §1.5 允许，不计入违规）：${overlayCount} 处`)
  }
  if (ownerCount > 0) {
    console.log(`Token 定义处色值（颜色的落点，不计入违规）：${ownerCount} 处`)
  }
  if (exceptionCount > 0) {
    console.log(`已登记例外（不计入违规）：${exceptionCount} 处`)
  }
}

if (STRICT && violations.length > 0) {
  process.exit(1)
}
