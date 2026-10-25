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
 *   T1  字号阶梯重复声明   `--text-*` 只允许出现在唯一来源与预设缩放里
 *   T2  任意字号工具类     `text-[15px]`
 *   T3  任意行高工具类     `leading-[26px]`
 *   T4  内联字号数值       `style={{ fontSize: 13 }}`
 *   T5  CSS 硬编码字号     `font-size: 15px`
 *
 * 扫描不把硬编码一律判死：图表 canvas 的 `fontSize` 必须是数字、
 * 第三方控件的行内样式改不动、移动端输入框需要 `font-size: 16px`
 * 防 iOS 自动缩放。这些进 ALLOWLIST，每条都必须写明理由 ——
 * 没有理由的例外等于没有规范。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')
const STRICT = process.argv.includes('--strict')

/** 唯一允许声明字号阶梯的文件（相对 src）。 */
const LADDER_OWNER = 'design-system/tokens/typography.css'
/** 允许按档位缩放既有阶梯的文件 —— 只许缩放，不许发明新档位。 */
const LADDER_SCALERS = new Set(['styles/theme-presets.css'])

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
    match: /^styles\/index\.css$/,
    rules: ['T5'],
    reason:
      '移动端 input/select/textarea 强制 16px，防止 iOS Safari 聚焦时自动放大页面（例外 E1）。',
  },
]

const RULES = {
  T1: '字号阶梯重复声明（--text-* 只能出现在唯一来源）',
  T2: '任意字号工具类（text-[…px]）',
  T3: '任意行高工具类（leading-[…px]）',
  T4: '内联字号数值（fontSize: N）',
  T5: 'CSS 硬编码字号（font-size: Npx）',
}

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
      if (rel !== LADDER_OWNER && !LADDER_SCALERS.has(rel)) {
        report('T1', rel, line, raw)
      }
    }

    // T2：任意字号
    if (/text-\[[0-9.]+(px|rem|em)\]/.test(raw)) {
      report('T2', rel, line, raw)
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
