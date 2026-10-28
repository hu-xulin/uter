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
 * 控件与说明文字的**字号下限**守卫。
 *
 * 规范 `typography.md` 把 12px 限定给真 caption（说明、占位符、徽标、
 * 表格列名、时间戳），控件文字属于 `label` 档（14/500），说明性正文属于
 * `body-sm` 档（14/400）。这条界线靠肉眼守不住：`text-xs` 是合法类名，
 * `check-design-tokens.mjs` 的 T1–T7 都不会报它，于是密集的技术弹窗里
 * 控件一个个退回 12px，最后整页比个人资料页小一号。
 *
 * 这份测试就是那道闸：扫描**管理端**（`features/` 下 13 个后台功能目录），
 * 任何控件标签（Button / SelectTrigger / Input / 小写 button …）或段落
 * `<p>` 上出现 `text-xs` 都判失败。
 *
 * 刻意**不检查**以下场景（它们确实是 caption 或密集网格）：
 *   - `Badge` / `StatusBadge` / `AvatarFallback` 上的 12px；
 *   - `<span>` / `<div>` 里的徽标、时间戳、表格列名、单元格次级信息；
 *   - 装饰性的代码纹理（`overview-dashboard` 的 mask 图案）；
 *   - 日历/热力图的日期格子（`checkin-calendar-card` 一类），它们按网格
 *     宽度排布，14px 会把日期挤出格子。
 *
 * 范围只到管理端是有意的：这次规范化的对象是后台页面。前台营销页、定价页
 * 与个人资料页另有各自的排版节奏，需要时按同一标准单独处理，不能靠这份
 * 测试一次性推到全站。
 */

const ROOT = join(process.cwd(), 'src')

/** 管理端功能目录（与 `features/` 下的后台页面一一对应）。 */
const ADMIN_FEATURES = [
  'channels',
  'dashboard',
  'keys',
  'models',
  'organization',
  'redemption-codes',
  'subscriptions',
  'system-info',
  'system-settings',
  'task-plugins',
  'usage-logs',
  'users',
  'wallet',
]

const SCAN_DIRS = ADMIN_FEATURES.map((dir) => join(ROOT, 'features', dir))

/** 控件标签：文字属于 `label` 档，不得压到 12px。 */
const CONTROL_TAGS = new Set([
  'Button',
  'SelectTrigger',
  'Combobox',
  'Input',
  'Textarea',
  'NativeSelect',
  'ToggleGroupItem',
  'button',
])

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'node_modules') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walk(full, out)
    } else if (full.endsWith('.tsx')) {
      out.push(full)
    }
  }
  return out
}

type Violation = { file: string; line: number; tag: string }

function collectViolations(): Violation[] {
  const violations: Violation[] = []
  for (const dir of SCAN_DIRS) {
    for (const file of walk(dir)) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/\btext-xs\b/g)) {
        const start = match.index ?? 0
        // 最近的 `<` 就是承载这个类的标签；箭头函数里的 `=>` 不含 `<`，
        // 因此不会被误判成标签开头。
        const open = source.lastIndexOf('<', start)
        if (open < 0) continue
        const tag = /^<([A-Za-z][A-Za-z0-9.]*)/.exec(
          source.slice(open, open + 40)
        )
        const name = tag?.[1]
        if (name === undefined) continue
        if (!CONTROL_TAGS.has(name) && name !== 'p') continue
        violations.push({
          file: file
            .slice(ROOT.length + 1)
            .split('\\')
            .join('/'),
          line: source.slice(0, start).split('\n').length,
          tag: name,
        })
      }
    }
  }
  return violations
}

describe('control typography floor', () => {
  it('never shrinks control labels or prose paragraphs to 12px', () => {
    const violations = collectViolations()
    const summary = violations
      .slice(0, 20)
      .map((item) => `${item.file}:${item.line} <${item.tag}>`)
      .join('\n')
    expect(
      violations,
      `控件文字应为 14px（label 档），说明性正文应为 14px（body-sm 档）：\n${summary}`
    ).toEqual([])
  })
})

/**
 * 分组标题（页面层级第 4 层）的守卫。
 *
 * `h3`/`h4`/`h5` 是**标题**语义，视觉上必须落在 `group-title`（16/600/24）
 * 或更高档位。此前「个人资料页的通知方式」这类分组标题被写成 14/500，
 * 比正文还小，同一层级的其他页面却是 16px，于是每个管理页的字号都对不上。
 *
 * 两类刻意保留的例外（都在标题位上但**不是**分组标题）：
 *   - `uppercase` 的 eyebrow（表格列名、区块前置标签）—— 属于 caption，
 *     12–14px 是对的；
 *   - `font-mono` 的标识符标题（模型 ID 列表项）—— 等宽走 mono 三档。
 */
const GROUP_TITLE_SCAN = [...ADMIN_FEATURES, 'security', 'profile'].map((dir) =>
  join(ROOT, 'features', dir)
)

function collectShrunkHeadings(): Violation[] {
  const violations: Violation[] = []
  for (const dir of GROUP_TITLE_SCAN) {
    for (const file of walk(dir)) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/<h[345]\b[^>]*>/g)) {
        const tag = match[0]
        if (!/\btext-(xs|sm)\b/.test(tag)) continue
        if (/\buppercase\b/.test(tag) || /\bfont-mono\b/.test(tag)) continue
        violations.push({
          file: file
            .slice(ROOT.length + 1)
            .split('\\')
            .join('/'),
          line: source.slice(0, match.index ?? 0).split('\n').length,
          tag: /^<(h[345])/.exec(tag)?.[1] ?? tag,
        })
      }
    }
  }
  return violations
}

describe('group title floor', () => {
  it('never renders a group heading at 12–14px', () => {
    const violations = collectShrunkHeadings()
    const summary = violations
      .slice(0, 20)
      .map((item) => `${item.file}:${item.line} <${item.tag}>`)
      .join('\n')
    expect(
      violations,
      `分组标题应为 group-title（16/600/24），不要用 text-sm / text-xs：\n${summary}`
    ).toEqual([])
  })
})

/**
 * 设置页字段标签档位的守卫。
 *
 * 设置页是「名称 + 说明」成对出现的列表结构，标签必须明显高于说明
 * （16/600 vs 14/400）。层级靠 `FormLabelTierProvider` 在页面层声明一次、
 * 由上下文下发给全部后代，因此**调用点不需要也不应该写字号类**。
 *
 * 两类会静默破坏这套层级的写法，都在这里拦下：
 *
 * 1. `FormLabel` / `Label` 上硬写 `text-sm` / `text-xs` / `font-normal`——
 *    `cn()` 是 twMerge，后写的同名工具类胜出，于是 16/600 被压回 14/400，
 *    与下方的说明文字同号同重（`customer-service-section.tsx` 曾有三处）。
 * 2. 把字号写在容器上（`font-mono` 挂到 `FormItem` 之类）——preflight 的
 *    `input,textarea{font:inherit}` 会让输入框继承父级字形，标签也跟着变，
 *    正确做法是给控件传 `mono` prop。
 *
 * **显式声明 `tier` 的调用点不检查**：`tier='default'`（单选项/复选项文字、
 * 密集定价表格的列标签）与 `tier='group'`（更高一层）都是作者主动声明的意图，
 * 不是「不小心把上下文覆盖掉了」。反过来，这两类位置**必须**显式声明，
 * 否则会静默继承字段档位 —— 单选项文字变成 16px 加粗正是这么来的。
 */
const LABEL_SIZE_RE = /\btext-(xs|sm|base|lg|xl)\b/
const LABEL_WEIGHT_RE = /\bfont-(normal|medium|semibold|bold)\b/

function isTierOverrideSkipped(cls: string, attrs: string): boolean {
  if (/\btier=/.test(attrs)) return true
  // `cursor-pointer` / `sr-only` 这类纯行为类不涉及字号，直接放行。
  return !LABEL_SIZE_RE.test(cls) && !LABEL_WEIGHT_RE.test(cls)
}

function collectLabelOverrides(): Violation[] {
  const violations: Violation[] = []
  for (const file of walk(join(ROOT, 'features', 'system-settings'))) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(
      /<(FormLabel|Label)\b([^>]*?)\bclassName=\{?\s*['"`]([^'"`]*)['"`]/g
    )) {
      const attrs = match[2] ?? ''
      const cls = match[3] ?? ''
      if (isTierOverrideSkipped(cls, attrs)) continue
      violations.push({
        file: file
          .slice(ROOT.length + 1)
          .split('\\')
          .join('/'),
        line: source.slice(0, match.index ?? 0).split('\n').length,
        tag: match[1],
      })
    }
  }
  return violations
}

describe('settings label tier', () => {
  it('never overrides the injected field tier with a hardcoded size', () => {
    const violations = collectLabelOverrides()
    const summary = violations
      .slice(0, 20)
      .map((item) => `${item.file}:${item.line} <${item.tag}>`)
      .join('\n')
    expect(
      violations,
      `设置页字段标签的 16/600 由 FormLabelTierProvider 下发，调用点不要再写字号/字重：\n${summary}`
    ).toEqual([])
  })
})

/**
 * 说明性段落的全局下限（全站，不限管理端）。
 *
 * `typography.md` 把 caption 12px 限定为「单行 ≤20 字、不承载数值、不是阅读
 * 主体」的辅助小字；`<p>` 装的是需要读懂才能正确操作的信息，一律 `body-sm`
 * 14/400。此前 21 处价格说明、API 说明、认证提示停在 12px（前台页面不在
 * 上面的管理端扫描范围内，所以一直没被拦住）。
 *
 * 这里只认 `<p … text-xs>` 这种字面写法；`<p className={cn('text-xs')}>`
 * 这类动态拼接需要人眼判断，静态扫描不假装能覆盖。
 */
function collectParagraphCaption(): Violation[] {
  const violations: Violation[] = []
  for (const file of walk(ROOT)) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/<p\s[^>]*\btext-xs\b/g)) {
      violations.push({
        file: file
          .slice(ROOT.length + 1)
          .split('\\')
          .join('/'),
        line: source.slice(0, match.index ?? 0).split('\n').length,
        tag: 'p',
      })
    }
  }
  return violations
}

describe('paragraph caption floor', () => {
  it('never renders a descriptive paragraph at 12px', () => {
    const violations = collectParagraphCaption()
    const summary = violations
      .slice(0, 20)
      .map((item) => `${item.file}:${item.line} <${item.tag}>`)
      .join('\n')
    expect(
      violations,
      `说明性段落应为 14px（body-sm 档）；12px 只给单行 ≤20 字、不含数值的 caption：\n${summary}`
    ).toEqual([])
  })
})

/* ── 卡片标题旁的汇总值 ───────────────────────────────────────────────── */

/**
 * 「总计 / 合计 / 共 N 条」是**和标题同层级的补充信息**，不是说明文字，
 * 必须 14px（`body-sm`）。12px 是 caption 档，只给不含数值的短说明；
 * 汇总值里有金额和计数，压到 12px 就等于让用户凑近看数字。
 *
 * 判据是「同一个元素里既有 `text-xs` 又有 `Total:` / `总计`」——这正是
 * 汇总值被写成 caption 的样子。表格底部的分页合计不算（密集表格页脚，
 * 见 `components/data-table/`），它没有标题行。
 */
const SUMMARY_ALLOW = [
  {
    match: /^components\/data-table\//,
    reason: '表格分页页脚的合计（密集表格，无标题行）',
  },
]

function collectCardSummaryCaption(): Violation[] {
  const violations: Violation[] = []
  const dirs = [join(ROOT, 'features'), join(ROOT, 'components')]
  for (const dir of dirs) {
    for (const file of walk(dir)) {
      const rel = file
        .slice(ROOT.length + 1)
        .split('\\')
        .join('/')
      if (SUMMARY_ALLOW.some((a) => a.match.test(rel))) continue
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/\btext-xs\b/g)) {
        const start = match.index ?? 0
        // 从 `text-xs` 往后看同一元素的内容（到最近的 `</span>` 或 `</div>`），
        // 里面出现 `Total:` / `总计` 就说明这是被降档的汇总值。
        const tail = source.slice(start, start + 400)
        const close = tail.search(/<\/(?:span|div)>/)
        const inner = close > 0 ? tail.slice(0, close) : tail
        if (!/(?:Total:|总计|合计)/.test(inner)) continue
        const open = source.lastIndexOf('<', start)
        const tag = /^<([A-Za-z][A-Za-z0-9.]*)/.exec(
          source.slice(open, open + 40)
        )
        violations.push({
          file: rel,
          line: source.slice(0, start).split('\n').length,
          tag: tag?.[1] ?? '?',
        })
      }
    }
  }
  return violations
}

describe('card header summary', () => {
  it('keeps card header summaries at 14px', () => {
    const violations = collectCardSummaryCaption()
    const summary = violations
      .slice(0, 20)
      .map((item) => `${item.file}:${item.line} <${item.tag}>`)
      .join('\n')
    expect(
      violations,
      `卡片标题旁的汇总值（总计 / 合计）应为 14px（text-sm）；12px 只给不含数值的短说明：\n${summary}`
    ).toEqual([])
  })
})
