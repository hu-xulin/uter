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
const ALLOWLIST = [
  {
    rules: ['T7'],
    match: /^features\/home\/components\/sections\/hero\.tsx$/,
    reason:
      '首屏品牌渐变标题「直达全球大模型」须与上游 new-api 逐类一致' +
      '（from-blue-400 via-violet-400 to-purple-500）。chart-* 会随主题预设漂移，' +
      '无法保证跨主题恒定与上游一致。',
  },
  {
    rules: ['T6', 'T7'],
    match: /^features\/home\/components\/hero-terminal-demo\.tsx$/,
    reason:
      '首屏 hero 代码卡（终端 demo）须逐类对齐上游 new-api 的多色配色、勿回退' +
      '（2026-10-29 决案）：curl=emerald、flag=blue、JSON key=sky、字符串=amber、' +
      '数字=violet、标点=foreground，状态点辉光 shadow-[0_0_8px_rgba(16,185,129,…)]。' +
      '全部改走语义 Token（success/info/warning 等）会因主题预设漂移而与上游渲染' +
      '不一致，无法用 Token 表达，故整体登记为受保护特例。',
  },
  {
    rules: ['T7'],
    match: /^features\/home\/components\/sections\/cta\.tsx$/,
    reason:
      '首屏 CTA 副标题「your AI integration?」须与上游 new-api 逐类一致' +
      '（from-blue-400 via-violet-400 to-purple-500），与 hero.tsx 的 E25 同一套上游渐变。' +
      '品牌 primary-* Token 与 chart-* 都会随主题预设漂移，无法保证与上游渲染一致，故登记 T7 例外。',
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
  T8: '裸色值（#hex / rgba()，未走 Token）',
  T9: '行高覆盖（leading-…，行高应由字号 Token 决定）',
  T10: '任意圆角（rounded-[…]，圆角阶梯只有 xs/sm/md/lg/xl/2xl）',
  T11: '未登记动效节奏（duration-N / ease-[cubic-bezier(…)]，§1.6 只有五组时长）',
  T12: '字距类（tracking-*，规范统一移除，字距由字号 Token 自带）',
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
