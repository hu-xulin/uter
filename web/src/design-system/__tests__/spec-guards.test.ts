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
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * 规范硬规则的静态守卫（`_reports/uter-design-system-updated.md`）。
 *
 * `check-design-tokens.mjs` 守字号与投影，`control-typography.test.ts` 守字号
 * 下限与标题层级。剩下三条规则没有任何自动化兜底，靠人眼守不住，因此在这里
 * 补上：
 *
 *   1. **正文基准 14px**（§1.2）——16px 只给 `group-title`、设置页字段档、
 *      指标数值与长文本（`body-long`）。承载正文的 `<p>` 与卡片/弹窗容器
 *      不得写 `text-base`。
 *   2. **图标只允许 Lucide**（§2.2）——混用两套图标库会让同一界面出现两种
 *      线宽、两种圆角、两种视觉重心，且随依赖体积翻倍。
 *   3. **品牌色只有一个来源**（§1.1.1）——品牌色字面值只能出现在 Token 文件，
 *      组件里出现就意味着「改品牌色不生效」。
 *
 * 每条都带 allowlist，理由写在 `REASONS` 里。没有理由的例外等于没有规范。
 */

const ROOT = join(process.cwd(), 'src')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walk(full, out)
    } else if (/\.(ts|tsx|css)$/.test(full)) {
      out.push(full)
    }
  }
  return out
}

const FILES = walk(ROOT).map((abs) => ({
  rel: abs
    .slice(ROOT.length + 1)
    .split('\\')
    .join('/'),
  lines: readFileSync(abs, 'utf8').split('\n'),
}))

type Hit = { file: string; line: number; text: string }

/**
 * 按相对路径取文件内容；文件不存在直接抛错。
 * 用抛错而不是 `expect(...).toBeTruthy()` + `!`，是因为断言失败后
 * 后续 `!` 仍会执行，报错信息会变成 TypeError 而盖掉真正的原因。
 */
function fileBody(rel: string): string {
  const f = FILES.find((x) => x.rel === rel)
  if (!f) throw new Error(`${rel} 不存在（设计系统守卫扫描不到该文件）`)
  return f.lines.join('\n')
}

function scan(
  re: RegExp,
  { allow = [] }: { allow?: { match: RegExp; reason: string }[] } = {}
): Hit[] {
  const hits: Hit[] = []
  for (const f of FILES) {
    if (allow.some((a) => a.match.test(f.rel))) continue
    f.lines.forEach((line, i) => {
      // 注释行不参与守卫：JSDoc 里常写「主色是紫蓝 `#5B5EE6`」这类说明文字，
      // 它们是文档而不是代码，报出来只会制造噪音。
      if (/^\s*(?:\*|\/\/|\/\*)/.test(line)) return
      if (re.test(line)) {
        hits.push({
          file: f.rel,
          line: i + 1,
          text: line.trim().slice(0, 120),
        })
      }
    })
  }
  return hits
}

const fmt = (hits: Hit[]) =>
  hits
    .slice(0, 20)
    .map((h) => `${h.file}:${h.line}  ${h.text}`)
    .join('\n')

/* ── 1. 正文基准 14px ─────────────────────────────────────────────────── */

/**
 * 承载正文的容器：段落、卡片、弹窗/抽屉外壳。它们的默认字号必须是
 * `body` / `body-sm`（14/20）；16px 只能由显式的 `text-long`（长文本）
 * 或 `group-title`（分组标题）引入。
 */
const PROSE_TAGS = [
  '<p',
  '<Card',
  '<CardContent',
  '<CardHeader',
  '<DialogContent',
  '<DialogHeader',
  '<SheetContent',
  '<AlertDialogContent',
]

const PROSE_BASE_ALLOW = [
  {
    match: /^features\/security\/components\/account-action-card\.tsx$/,
    reason:
      'E22：用户按截图指定该行标题为 16/600，与 language-preferences-card 同档（见 exceptions.md E22）。',
  },
]

function collectProseBase(): Hit[] {
  const hits: Hit[] = []
  for (const f of FILES) {
    if (!f.rel.endsWith('.tsx')) continue
    if (PROSE_BASE_ALLOW.some((a) => a.match.test(f.rel))) continue
    f.lines.forEach((line, i) => {
      if (!/\btext-base\b/.test(line)) return
      if (!PROSE_TAGS.some((tag) => line.includes(tag))) return
      hits.push({ file: f.rel, line: i + 1, text: line.trim().slice(0, 120) })
    })
  }
  return hits
}

describe('body baseline', () => {
  it('never uses text-base (16px) on prose containers', () => {
    const hits = collectProseBase()
    expect(
      hits,
      `正文基准是 14px（body / body-sm）。16px 请用 text-long（长文本）或 Heading variant="group-title"（分组标题）：\n${fmt(hits)}`
    ).toEqual([])
  })
})

/* ── 1.1 卡片标题旁的汇总值恒为 14px ───────────────────────────────────── */

/**
 * 规范 §1.2 硬规则 4 的第 2 条：**12px 不承载数值**。
 *
 * 最常破防的位置是卡片标题右侧那个总量——`总计：$0.03`、`共 181 条`、
 * `Total: 181`。它是这张卡片唯一的总量口径，用户要先读到它；压到 12px
 * 会从「标题 → 总量」两级变成三档，中间那档空掉，读起来像脚注。
 *
 * 判定方式刻意写窄：同一行既出现 `text-xs` 又出现 `Total:` / `总计`
 * 才算违规。宽泛地禁止「12px + 数字」会把时间戳、列名、徽标一起误伤
 * （它们本来就是 caption 的合法场景）。
 */
const SUMMARY_VALUE = /(?:t\(\s*['"]Total:|Total:|总计)/

const SUMMARY_VALUE_ALLOW: { match: RegExp; reason: string }[] = [
  // 目前没有例外。真要加，必须写清「为什么这个总量可以比标题低两档」。
]

function collectSmallSummaryValues(): Hit[] {
  const hits: Hit[] = []
  for (const f of FILES) {
    if (!f.rel.endsWith('.tsx')) continue
    if (SUMMARY_VALUE_ALLOW.some((a) => a.match.test(f.rel))) continue
    f.lines.forEach((line, i) => {
      if (/^\s*(?:\*|\/\/|\/\*)/.test(line)) return
      if (!/\btext-xs\b/.test(line)) return
      if (!SUMMARY_VALUE.test(line)) return
      hits.push({ file: f.rel, line: i + 1, text: line.trim().slice(0, 120) })
    })
  }
  return hits
}

describe('card summary value', () => {
  it('keeps card summary values at 14px', () => {
    const hits = collectSmallSummaryValues()
    expect(
      hits,
      `规范 §1.2：卡片 / 区块标题同行的汇总值（总计、共 N 条）恒为 14px（body-sm），12px 只给不含数值的说明。用 text-sm 替代 text-xs：\n${fmt(hits)}`
    ).toEqual([])
  })
})

/* ── 2. 图标只允许 Lucide ─────────────────────────────────────────────── */

const ICON_LIB_ALLOW = [
  {
    match: /^components\/react-icon-by-name\.tsx$/,
    reason:
      '运营在后台「支付方式」里配置的图标名（ReactIconByName），名字运行时才确定，无法预先枚举。',
  },
]

describe('icon library', () => {
  it('imports icons from lucide-react only', () => {
    const hits = scan(
      /from\s+['"](@hugeicons\/[^'"]+|@heroicons\/[^'"]+|react-icons\/[^'"]+)['"]/,
      {
        allow: ICON_LIB_ALLOW,
      }
    )
    expect(
      hits,
      `规范 §2.2：图标一律 Lucide 线性图标（24px 画框、默认 18px、描边 2）。其他图标库请迁移到 lucide-react：\n${fmt(hits)}`
    ).toEqual([])
  })
})

/* ── 2.1 图标几何：尺寸档位 / 描边三档 / 跟随父级文字色 ────────────────── */

/**
 * 规范 §2.2 的图标契约（2026-10-28 13:24 版）：
 *
 *   - **尺寸档位**——16 / 18 / 24 / 32 / 48，逐场景固定。默认档 **18px**
 *     （按钮内前置后置、工具栏与卡片操作、**侧边栏**、主导航与 Tabs、
 *     提示与状态），紧凑型辅助 16px，强调型入口 24px，空状态 32px，
 *     整页级空状态 48px。档位外的值一律违规。
 *   - **描边单档**——2（画框单位），禁止 1 / 1.5 / 2.25 / 2.5。
 *     `strokeWidth` 的单位是画框单位，由 `IconProvider` 注入 2。
 *   - **颜色跟随父级文字色**——Lucide 内置 `stroke="currentColor"`，只要不写
 *     硬编码调色板色就自动成立。
 *
 * 三条都靠「解析 lucide-react 导入名单 → 定位 JSX 元素 → 读 className」
 * 实现，而不是按组件名后缀猜（Lucide 组件名没有 `Icon` 后缀，正则猜不出来）。
 */

type IconUse = {
  file: string
  line: number
  name: string
  cls: string
  /** className 里最大的尺寸档（px）；完全没写尺寸返回 null */
  px: number | null
  /** 元素片段（`<Name ...>`），用于读 `strokeWidth` */
  span: string
}

/** 从 `<Name` 起找到元素结束的 `>`，跳过字符串与 `{}` 内的 `>` */
function elementEnd(src: string, start: number): number {
  let i = start
  let brace = 0
  let quote: string | null = null
  while (i < src.length) {
    const c = src[i]
    if (quote) {
      if (c === '\\') {
        i += 2
        continue
      }
      if (c === quote) quote = null
      i++
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c
      i++
      continue
    }
    if (c === '{') {
      brace++
      i++
      continue
    }
    if (c === '}') {
      brace--
      i++
      continue
    }
    if (c === '>' && brace === 0) return i
    i++
  }
  return -1
}

function classSizePx(cls: string): number | null {
  const px: number[] = []
  for (const m of cls.matchAll(/\bsize-(\d+(?:\.\d+)?)\b/g)) {
    px.push(Number(m[1]) * 4)
  }
  for (const m of cls.matchAll(/\bsize-\[(\d+)px\]/g)) {
    px.push(Number(m[1]))
  }
  const h = cls.match(/\bh-(\d+(?:\.\d+)?)\b/)
  const w = cls.match(/\bw-(\d+(?:\.\d+)?)\b/)
  if (h && w) {
    px.push(Number(h[1]) * 4)
  }
  const ha = cls.match(/\bh-\[(\d+)px\]/)
  const wa = cls.match(/\bw-\[(\d+)px\]/)
  if (ha && wa) {
    px.push(Number(ha[1]))
  }
  return px.length ? Math.max(...px) : null
}

function collectLucideIcons(): IconUse[] {
  const out: IconUse[] = []
  for (const f of FILES) {
    if (!f.rel.endsWith('.tsx')) continue
    const src = f.lines.join('\n')
    const names = new Set<string>()
    for (const m of src.matchAll(
      /import\s*\{([^}]+)\}\s*from\s*'lucide-react'/g
    )) {
      for (const raw of m[1].split(',')) {
        const n = raw
          .trim()
          .split(/\s+as\s+/)
          .pop()
          ?.trim()
        if (n) names.add(n)
      }
    }
    if (!names.size) continue
    for (const m of src.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)) {
      if (!names.has(m[1])) continue
      const end = elementEnd(src, m.index)
      if (end < 0) continue
      const span = src.slice(m.index, end)
      const cm = span.match(
        /className=(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\}|\{'([^']*)'\})/
      )
      const cls = cm ? (cm[1] ?? cm[2] ?? cm[3] ?? cm[4] ?? '') : ''
      out.push({
        file: f.rel,
        line: src.slice(0, m.index).split('\n').length,
        name: m[1],
        cls,
        px: classSizePx(cls),
        span,
      })
    }
  }
  return out
}

const ICONS = collectLucideIcons()

/**
 * 规范 §2.2（2026-10-28 13:24 版）的尺寸表 —— 逐场景固定，不再给区间：
 *
 * | 场景 | px | 类名 |
 * | --- | --- | --- |
 * | 按钮内前置后置 / 工具栏与卡片操作 / **侧边栏** / 主导航与 Tabs / 提示与状态 | 18 | `size-4.5` |
 * | 紧凑型辅助（仅密集信息） | 16 | `size-4` |
 * | 强调型功能入口 | 24 | `size-6` |
 * | 空状态 | 32 | `size-8` |
 * | **整页级空状态** | 48 | `size-12` |
 *
 * **18px 是 13:24 版定的默认档**。这个值被改过三次：20（更早）→ 16（10:58）
 * → 20（11:41）→ **18（13:24）**；同时**侧边栏从 16 提到 18**，16 只剩
 * 「密集信息里的辅助图标」一个落点。改前先 `stat` 规范文件 mtime。
 *
 * 12 / 14（以及更小的 8 / 10）不在表里，只作为「容器物理放不下 16px」的例外
 * 存在（见 `SMALL_GLYPH_ALLOW`）。档位外的值（20、22、28、36、40…）一律违规。
 */
const ICON_SIZE_TIERS = new Set([16, 18, 24, 32, 48])

/** 容器约束档：只在 `SMALL_GLYPH_ALLOW` 命中的文件里合法。 */
const CONTAINER_GLYPH_TIERS = new Set([8, 10, 12, 14])

/**
 * 12 / 14px 只允许出现在「容器物理上放不下 16px」的位置。
 * 每一条都是容器约束，不是审美偏好 —— 换掉就会溢出或压字。
 */
const SMALL_GLYPH_ALLOW = [
  { match: /^components\/ui\/checkbox\.tsx$/, reason: '16px 方框内的对勾' },
  { match: /^components\/ui\/badge\.tsx$/, reason: '24px 徽章内图标' },
  { match: /^components\/ui\/avatar\.tsx$/, reason: '头像档位随容器缩放' },
  { match: /^components\/ui\/icon-badge\.tsx$/, reason: '徽章五档随容器缩放' },
  { match: /^components\/ui\/calendar\.tsx$/, reason: '日期格内与月份导航' },
  {
    match: /^components\/ui\/sidebar\.tsx$/,
    reason: '侧边栏分组标题（12px 文字档）',
  },
  {
    match: /^components\/tag-input\.tsx$/,
    reason: 'Badge 内（已被 [&>svg]:size-3! 强制）',
  },
  {
    match: /^components\/command-menu\.tsx$/,
    reason: '16px 容器内的 12px 装饰箭头',
  },
  {
    match: /^components\/json-code-editor\.tsx$/,
    reason: '密集代码编辑器视口（E2）',
  },
  {
    match: /^features\/channels\/components\/numeric-spinner-input\.tsx$/,
    reason: '24px 步进按钮内的加减号',
  },
  {
    match: /^features\/profile\/components\/checkin-calendar-card\.tsx$/,
    reason: '12px 装饰星标',
  },
  {
    match: /^features\/channels\/components\/channel-priority-demo\.tsx$/,
    reason: '演示组件',
  },
]

describe('icon geometry', () => {
  it('only uses the spec size tiers (16/18/24/32/48)', () => {
    const hits = ICONS.filter((i) => i.px !== null && i.px < 16).filter(
      (i) => !SMALL_GLYPH_ALLOW.some((a) => a.match.test(i.file))
    )
    expect(
      hits.map((h) => ({
        file: h.file,
        line: h.line,
        text: `<${h.name} className="${h.cls}">`,
      })),
      `规范 §2.2：16px 是图标的最小档。12/14（含更小的 8/10）只允许出现在固定尺寸容器里（见 SMALL_GLYPH_ALLOW）：\n${fmt(
        hits.map((h) => ({
          file: h.file,
          line: h.line,
          text: `<${h.name} className="${h.cls}">`,
        }))
      )}`
    ).toEqual([])

    // 容器约束档只在白名单文件里成立；其余文件必须落在 16/20/24/32/48 五档。
    const offTier = ICONS.filter((i) => {
      if (i.px === null) return false
      if (ICON_SIZE_TIERS.has(i.px)) return false
      const containerOk =
        CONTAINER_GLYPH_TIERS.has(i.px) &&
        SMALL_GLYPH_ALLOW.some((a) => a.match.test(i.file))
      return !containerOk
    })
    expect(
      offTier.map((h) => ({
        file: h.file,
        line: h.line,
        text: `<${h.name} className="${h.cls}"> → ${h.px}px`,
      })),
      `规范 §2.2：图标尺寸只有 16 / 18 / 24 / 32 / 48 五档（按钮内、工具栏、侧边栏、主导航与 Tabs、提示与状态 18；紧凑型辅助 16；强调型入口 24；空状态 32；整页级空状态 48）。20 / 22 / 28 / 36 / 40 都不在表里：\n${fmt(
        offTier.map((h) => ({
          file: h.file,
          line: h.line,
          text: `<${h.name} className="${h.cls}"> → ${h.px}px`,
        }))
      )}`
    ).toEqual([])
  })

  /**
   * 尺寸只能用 `className='size-*'` 表达，不能用 lucide 的 `size={16}` 数值属性。
   *
   * 回归背景（2026-10-28）：`playground-input-tools.tsx` 的附件/联网/参数/清空
   * 四个按钮写的是 `<PaperclipIcon size={16} />`，但 `Button` 带
   * `[&_svg:not([class*='size-'])]:size-4.5` 兜底 —— 这个选择器**恰好匹配**
   * 「没有 size- 类」的 svg，CSS 的 width/height 又压过 HTML 属性，于是
   * 声明 16px 实际渲染 18px，肉眼只会觉得「图标偏大」，代码读起来却完全正常。
   *
   * 上一版守卫只解析 className（`classSizePx`），数值属性对它不可见，所以
   * 这类错漏能一路跑到线上截图里。这里补一条：lucide 元素上禁止出现数值尺寸属性。
   */
  it('sizes icons with a size-* class, never the numeric size prop', () => {
    const hits = ICONS.filter((i) => /\ssize=\{?\s*["']?\d/.test(i.span))
    expect(
      hits.map((h) => ({
        file: h.file,
        line: h.line,
        text: h.span.split('\n')[0].trim(),
      })),
      `规范 §2.2：图标尺寸必须写成 className='size-*'。lucide 的 size={N} 会被父级 Button 的 [&_svg:not([class*='size-'])]:size-* 兜底覆盖（CSS 压过 HTML 属性），声明值与实际渲染不一致：\n${fmt(
        hits.map((h) => ({
          file: h.file,
          line: h.line,
          text: h.span.split('\n')[0].trim(),
        }))
      )}`
    ).toEqual([])
  })

  it('declares the 18px default on the components that own it', () => {
    // 大多数图标在调用点不写尺寸，落到组件级兜底
    // （`[&_svg:not([class*='size-'])]:size-*`）。兜底写错就等于全站默认档
    // 写错，而这类错误没有任何类型报错 —— 单独锁一次。
    const OWNERS: { file: string; expect: RegExp; why: string }[] = [
      {
        file: 'components/ui/button.tsx',
        expect: /\[&_svg:not\(\[class\*='size-'\]\)\]:size-4\.5/,
        why: '按钮内前置/后置图标 = 18px（§2.2）',
      },
      {
        file: 'components/ui/tabs.tsx',
        expect: /\[&_svg:not\(\[class\*='size-'\]\)\]:size-4\.5/,
        why: '主导航与 Tabs = 18px（§2.2）',
      },
      {
        file: 'components/ui/alert.tsx',
        expect: /\*:\[svg:not\(\[class\*='size-'\]\)\]:size-4\.5/,
        why: '提示与状态图标 = 18px（§2.2）',
      },
      {
        file: 'components/ui/sidebar.tsx',
        expect: /\[&_svg\]:size-4\.5/,
        why: '侧边栏 = 18px（§2.2，本版从 16 提到 18）',
      },
    ]
    const missing = OWNERS.filter((o) => {
      const f = FILES.find((x) => x.rel === o.file)
      if (!f) return true
      return !o.expect.test(f.lines.join('\n'))
    }).map((o) => ({
      file: o.file,
      line: 0,
      text: `${o.why}（期望匹配 ${String(o.expect)}）`,
    }))
    expect(
      missing,
      `规范 §2.2（13:24 版）：18px 是默认档（含侧边栏）。以下组件没有声明对应的兜底：\n${fmt(
        missing
      )}`
    ).toEqual([])
  })

  it('keeps the sidebar at the 18px navigation tier', () => {
    // 13:24 版把侧边栏从 16px 提到 18px，与主导航 / Tabs 同档。回归风险有两个
    // 方向：顺手批量升到 20（size-5，会把侧边栏顶宽）或退回 16（size-4，
    // 与规范表格不符）。两端都锁死。
    const body = fileBody('components/ui/sidebar.tsx')
    expect(
      /\[&_svg\]:size-4\.5/.test(body),
      '规范 §2.2：侧边栏图标是 18px（size-4.5），13:24 版已从 16 提到 18'
    ).toBe(true)
    expect(
      /\[&_svg\]:size-5/.test(body),
      '规范 §2.2：侧边栏图标是 18px（size-4.5），不要升到 size-5（20px 已不在档位表里）'
    ).toBe(false)
    expect(
      /\[&_svg\]:size-4(?![.\d])/.test(body),
      '规范 §2.2：侧边栏图标是 18px（size-4.5），不要退回 size-4（16px 只剩紧凑型辅助）'
    ).toBe(false)
  })

  it('uses the single stroke-width value the spec now prescribes (2)', () => {
    // 规范 §2.2（2026-10-28 10:00 版）：尺寸表每一行的 Stroke Width 都是 2px，
    // 三个 `--icon-stroke-width*` Token 也全是 2px —— 不再按尺寸分三档粗细。
    // strokeWidth 的单位是 24 画框单位，由 IconProvider 注入 2。
    // 写 1 / 1.5（更早的「1px 视觉线宽」口径）、2.25 / 2.5（上一版的三档）
    // 都会被这条拦下。
    const ALLOWED = new Set([2])
    const hits = ICONS.filter((i) => {
      const m = i.span.match(
        /strokeWidth=(?:\{\s*([\d.]+)\s*\}|["']([\d.]+)["'])/
      )
      if (!m) return false
      return !ALLOWED.has(Number(m[1] ?? m[2]))
    })
    expect(
      hits.map((h) => ({
        file: h.file,
        line: h.line,
        text: `<${h.name}> ${h.span.slice(0, 80)}`,
      })),
      `规范 §2.2：描边只有 2 一个值（尺寸表每行都是 2px，三个 Token 也都是 2px）。1 / 1.5（更早的 1px 视觉线宽口径）、2.25 / 2.5（上一版三档）都要改掉：\n${fmt(
        hits.map((h) => ({
          file: h.file,
          line: h.line,
          text: `<${h.name}> ${h.span.slice(0, 80)}`,
        }))
      )}`
    ).toEqual([])
  })

  it('injects the 18px default from the icon provider', () => {
    // 兜底有两层：LucideProvider 的 size/strokeWidth（React 层）与
    // icons.css 的 `svg.lucide`（CSS 层）。两层同源，值必须都是默认档 18。
    const body = fileBody('context/icon-provider.tsx')
    expect(body, 'IconProvider 的默认尺寸应为 18（规范 §2.2 默认档）').toMatch(
      /const ICON_SIZE = 18\b/
    )
    expect(body, 'IconProvider 的描边应为 2（规范 §2.2）').toMatch(
      /const ICON_STROKE_WIDTH = 2\b/
    )
    expect(fileBody('design-system/foundations/icons.css')).toMatch(
      /width: var\(--ds-icon-size/
    )
  })

  /**
   * 管理端「右侧操作区」= `SectionPageLayout.Actions` / `PageHeader.actions`
   * 里渲染的那一排按钮，实现都落在 `features/<域>/components/*-primary-buttons.tsx`。
   *
   * 2026-10-28 口径：这一排按钮一律走紧凑档 —— 文字按钮 `sm`（32px）、
   * 纯图标按钮 `icon-sm`（32px 方形），图标 16px。此前它们是 default 档
   * （36px）+ 18px 图标，和同排的下拉、开关组混在一起时高度参差 4px，
   * 图标也比下拉里的 16px 大一圈。
   *
   * 这里只锁「高度档位」这条可静态判定的规则。图标 16px 由「图标 + 文字」
   * 组合决定，而静态解析 JSX 子节点并不可靠（按钮里常混着 `{t(...)}`、
   * 条件渲染与 `<span className='sm:hidden'>`），强行正则化只会制造误报，
   * 因此那一条靠人工核对与截图验收。
   */
  it('keeps the admin action-area buttons on the compact tier', () => {
    const COMPACT = [
      "size='sm'",
      'size="sm"',
      "size='icon-sm'",
      'size="icon-sm"',
    ]
    const hits: Hit[] = []
    for (const f of FILES) {
      if (!f.rel.endsWith('-primary-buttons.tsx')) continue
      const src = f.lines.join('\n')
      for (const m of src.matchAll(/<Button\b/g)) {
        const end = elementEnd(src, m.index)
        if (end < 0) continue
        const tag = src.slice(m.index, end + 1)
        if (COMPACT.some((c) => tag.includes(c))) continue
        hits.push({
          file: f.rel,
          line: src.slice(0, m.index).split('\n').length,
          text: tag.replaceAll(/\s+/g, ' ').slice(0, 120),
        })
      }
    }
    expect(
      hits,
      `管理端右侧操作区（*-primary-buttons.tsx）的按钮只走紧凑档：文字按钮 size='sm'（32px）、纯图标按钮 size='icon-sm'（32px 方形），配套图标 16px（size-4）。default 档的 36px 会让这一排高度参差：\n${fmt(
        hits
      )}`
    ).toEqual([])
  })

  it('lets the icon color follow the parent text color', () => {
    const PALETTE =
      /\btext-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}\b/
    const hits = ICONS.filter((i) => PALETTE.test(i.cls))
    expect(
      hits.map((h) => ({
        file: h.file,
        line: h.line,
        text: `<${h.name} className="${h.cls}">`,
      })),
      `规范 §2.2：图标颜色跟随父级文字色。请用语义色（text-muted-foreground / text-success / text-warning / text-destructive / text-primary），不要用调色板色：\n${fmt(
        hits.map((h) => ({
          file: h.file,
          line: h.line,
          text: `<${h.name} className="${h.cls}">`,
        }))
      )}`
    ).toEqual([])
  })
})

/* ── 3. 品牌色只有一个来源 ───────────────────────────────────────────── */

/**
 * 品牌色（浅色 + 深色主题的全部档位）只能声明在 Token 文件里。组件里出现
 * 字面值就意味着「改品牌色不生效」——历史上 `--color-primary` 曾被写死成
 * `#6467f0`，与 `--primary` 完全脱钩，改主题色对任何 `bg-primary` 都无效。
 */
const BRAND_HEX =
  /#(?:5B5EE6|8B8DF5|494CC7|3F42B0|A1A3F7|B7B8FA|F0F0FF|C7C8FF|25264A|5558DC|6467f0)/i

const BRAND_HEX_ALLOW = [
  {
    match: /^styles\//,
    reason: 'Token 定义处（theme.css / theme-presets.css）——品牌色唯一的来源。',
  },
  {
    match: /^design-system\/tokens\//,
    reason: 'Layer 2 语义 Token 定义处。',
  },
]

describe('brand color source', () => {
  it('declares brand colors only in token files', () => {
    const hits = scan(BRAND_HEX, { allow: BRAND_HEX_ALLOW })
    expect(
      hits,
      `品牌色字面值只能出现在 Token 文件。组件里请用 bg-primary / text-fg-link / var(--primary) 等语义出口：\n${fmt(hits)}`
    ).toEqual([])
  })
})

/* ── 1.2 内容排版（Markdown prose）阶梯 ──────────────────────────────── */

/**
 * 规范 §1.2「内容排版（Markdown prose）」：Markdown 的标题自成一套，比界面
 * 层级（30 / 24 / 18 / 16）低一到两档 —— h1 24/32、h2 18/28、h3 16/24、
 * h4 14/20。规范点名了此前的错误：把 Markdown 的 h1 抬到界面 30px，会让回答
 * 里的标题比它所在卡片的标题（18px）还大，「页面层级当场塌掉」。
 *
 * `components/ui/markdown.tsx` 正是踩过这条的渲染器（`RichContent` 的
 * markdown 分支、协议正文），2026-10-28 才从界面阶梯改回本表。
 */
describe('markdown prose ladder', () => {
  const LADDER: { expect: RegExp; why: string }[] = [
    { expect: /\[&_h1\]:text-2xl/, why: 'Markdown h1 = 24/32（text-2xl）' },
    { expect: /\[&_h2\]:text-lg/, why: 'Markdown h2 = 18/28（text-lg）' },
    { expect: /\[&_h3\]:text-base/, why: 'Markdown h3 = 16/24（text-base）' },
    { expect: /\[&_h4\]:text-sm/, why: 'Markdown h4 = 14/20（text-sm）' },
  ]

  it('keeps markdown headings one or two tiers below the UI ladder', () => {
    const body = fileBody('components/ui/markdown.tsx')
    const missing = LADDER.filter((l) => !l.expect.test(body)).map((l) => ({
      file: 'components/ui/markdown.tsx',
      line: 0,
      text: `${l.why}（期望匹配 ${String(l.expect)}）`,
    }))
    expect(
      missing,
      `规范 §1.2：Markdown 标题比界面低一到两档。以下档位缺失或被改动：\n${fmt(
        missing
      )}`
    ).toEqual([])
  })

  it('never puts a markdown h1 at the UI h1 size (30px)', () => {
    const body = fileBody('components/ui/markdown.tsx')
    expect(
      /\[&_h1\]:text-3xl/.test(body),
      '规范 §1.2：Markdown 的 h1 不得用 30px —— 那是界面 h1 的档位，会让正文标题与页面标题同号'
    ).toBe(false)
  })
})

describe('focus indicator', () => {
  /**
   * 规范 §1.4 `stroke-focus`（Outside 1px）+ §1.7：**全站只有一种焦点指示器**
   * —— 1px 环、`ring` 满色、贴着元素边框外沿（`outline-offset: 0`）。
   *
   * 回归背景（2026-10-28）：规范把「输入框外侧焦点环」写清之后，代码里仍有
   * 四种各自的版本 —— playground 输入舱 `ring-primary/15`（1px 半透明）、
   * API Key 分组下拉 `ring-[3px]` + `ring-ring/20`、数字输入框编辑态在容器上
   * 再叠一圈 `ring-primary/30 ring-1`（同一屏两套）、滑块 `ring-ring/50`
   * （宽度对、颜色半透明）。它们单看都「有个焦点效果」，合起来就是五种焦点
   * 语言。这条守卫把宽度、颜色、offset 三件事一起钉住。
   *
   * 宽度口径变更（2026-10-29）：此前是「表单控件 1px、其余 2px」两档，规范
   * 已改为全站 1px。两档并存的代价是同一次 Tab 序列里焦点环粗细会跳（按钮
   * 2px → 输入框 1px → 按钮 2px），而且 2px 环压在 1px 描边的卡片上会被读成
   * 双线框。现在只有 1px 一种，2px / 3px / 4px 在任何位置都红。
   *
   * 允许的例外：
   * - `ring-0`：容器包裹输入框时，内层控件把环让给容器（InputGroup 体系）；
   * - `ring-destructive/*`、`ring-warning/*`：状态语义色，环跟随元素自身的
   *   状态边框，不是另造一套焦点色；
   * - `aria-invalid:ring-2`：校验失败时的状态描边，不是焦点指示器（规范把
   *   错误态与焦点态定义为两件事），宽度跟随 stroke-destructive 的 2px 强调档。
   */
  const SEMANTIC_RING_COLORS = /^focus-visible:ring-(?:destructive|warning)\//

  it('keeps every focus ring at 1px', () => {
    const hits: Hit[] = []
    for (const file of FILES) {
      file.lines.forEach((text, index) => {
        const match = text.match(/focus-visible:ring-(?:\[([\d.]+)px\]|(\d+))/)
        if (!match) return
        const px = Number(match[1] ?? match[2])
        // 0 = 把环让给容器；1 = 规范值。
        if (px === 0 || px === 1) return
        hits.push({ file: file.rel, line: index + 1, text: text.trim() })
      })
    }
    expect(
      hits,
      `规范 §1.4 / §1.7：焦点环恒 1px（把环让给容器时用 ring-0）。2px / 3px / 4px 会让同一屏出现两种粗细的焦点语言，且 2px 环压在 1px 描边上会被读成双线框：\n${fmt(hits)}`
    ).toEqual([])
  })

  it('never tints the shared focus ring with an alpha color', () => {
    const hits: Hit[] = []
    for (const file of FILES) {
      file.lines.forEach((text, index) => {
        // `ring-ring/50`、`ring-primary/15` 这类：宽度可能对，颜色是半透明。
        // 它们把 `--tw-ring-color` 改成带 alpha 的值，`focus-visible:ring-1`
        // 继承的就是这个颜色 —— 等于第二套焦点色。
        for (const token of text.match(/focus-visible:ring-[a-z-]+\/\d+/g) ??
          []) {
          if (SEMANTIC_RING_COLORS.test(token)) continue
          hits.push({
            file: file.rel,
            line: index + 1,
            text: `${token} ← ${text.trim()}`,
          })
        }
      })
    }
    expect(
      hits,
      `规范 §1.7：焦点环必须是 \`ring\` 满色，不得用 alpha 稀释。状态语义环（destructive / warning）除外：\n${fmt(hits)}`
    ).toEqual([])
  })

  it('keeps the focus ring flush against the element edge', () => {
    const hits: Hit[] = []
    for (const file of FILES) {
      file.lines.forEach((text, index) => {
        // 负 offset 把环画到内侧，`ring-offset-2` 在环与元素之间留缝，
        // 两者都与「贴着元素边框外沿」相反。
        if (/focus-visible:-outline-offset/.test(text)) {
          hits.push({
            file: file.rel,
            line: index + 1,
            text: `focus-visible:-outline-offset ← ${text.trim()}`,
          })
        }
        if (/focus-visible:ring-offset-[1-9]/.test(text)) {
          hits.push({
            file: file.rel,
            line: index + 1,
            text: `focus-visible:ring-offset-* ← ${text.trim()}`,
          })
        }
      })
    }
    expect(
      hits,
      `规范 §1.7：焦点环贴边（outline-offset: 0 / ring 无 offset）。内缩或留缝都会让焦点环看起来「浮在元素外面」，与全站几何不一致：\n${fmt(hits)}`
    ).toEqual([])
  })

  it('keeps the base focus ring at 2px with no offset', () => {
    const css = fileBody('design-system/foundations/accessibility.css')
    expect(
      css,
      '规范 §1.7：原生元素的焦点环由基座兜底，必须引用 --ds-focus-ring-* 两个 Token'
    ).toContain(
      'outline: var(--ds-focus-ring-width) solid var(--ds-focus-ring-color)'
    )
    expect(
      css,
      '规范 §1.7：基座 outline-offset 必须是 0，否则与组件的 ring 几何对不上'
    ).toContain('outline-offset: 0')

    const semantic = fileBody('design-system/tokens/semantic.css')
    expect(semantic, '规范 §1.4 / §1.7：焦点环宽度 Token 唯一来源是语义层').toContain(
      '--ds-focus-ring-width: 1px'
    )
  })

  it('keeps every form control on the shared 1px focus ring', () => {
    for (const rel of [
      'components/ui/input.tsx',
      'components/ui/textarea.tsx',
      'components/ui/select.tsx',
    ]) {
      const body = fileBody(rel)
      // 规范 2.1：Input / Textarea / Select 写的是「1px Brand/ring 外侧焦点环」。
      // 2px 会与控件自身的 1px 边框叠成双线框（2026-10-28 实测后收敛），
      // 2026-10-29 起这已是全站口径，不再只是表单控件的例外。
      expect(
        body,
        `规范 §1.4 / §2.1：${rel} 的焦点环必须是 1px（与自身 1px 边框同宽）`
      ).toContain('focus-visible:ring-1')
      expect(
        body,
        `规范 §1.4 / §2.1：${rel} 的焦点环颜色必须是 ring`
      ).toContain('focus-visible:ring-ring')
      expect(
        body,
        `规范 §1.7：${rel} 不得用 ring-offset 在环与边框之间留缝`
      ).not.toContain('ring-offset')
    }
  })

  it('keeps the playground composer on the shared focus ring', () => {
    const body = fileBody(
      'features/playground/components/input/playground-input.tsx'
    )
    // 舱体本身不可聚焦，只能靠 `focus-within` 把内层 textarea 的焦点传上来；
    // 但宽度和颜色仍必须是全站那一套。
    expect(
      body,
      '规范 §1.4 / §1.7：输入舱聚焦态必须是 1px 的 ring 满色环（曾用 ring-primary/15 的 1px 半透明环）'
    ).toContain('focus-within:ring-ring')
    expect(
      body,
      '规范 §1.4 / §1.7：输入舱的占位环必须与聚焦环同宽（1px），否则过渡时盒子会跳'
    ).toContain('ring-1 ring-transparent')
    expect(body, '规范 §1.7：输入舱不得再出现半透明品牌焦点环').not.toContain(
      'focus-within:ring-primary/'
    )
  })
})
