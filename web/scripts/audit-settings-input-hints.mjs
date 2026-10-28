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
 * 审计「系统设置」里所有输入控件是否具备**默认值或填写示例**。
 *
 * 背景：配置项的输入框如果既没有默认值、也没有 placeholder 示例，管理员只能
 * 靠猜。填错时又常常**静默生效**（URL、密钥、ID、额度这类字段不会报错），
 * 事后极难定位。本脚本把缺示例的控件列出来，作为补齐前的清单与补齐后的门禁。
 *
 * 判定「有示例」：控件自身带 placeholder，或带 title / aria-label 中任一可读提示。
 * Select 类只要有 title 即可（选项本身就是示例）。
 *
 * 用法：
 *   node scripts/audit-settings-input-hints.mjs            # 列出全部缺失项
 *   node scripts/audit-settings-input-hints.mjs --summary  # 只看统计
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'src/features/system-settings'
const CONTROLS = ['Input', 'Textarea', 'NativeSelect', 'InputNumber']
const SUMMARY = process.argv.includes('--summary')

/** 取某控件元素内的原始文本片段（用于就近找 FormLabel）。 */
function sliceElement(src, startIdx) {
  // startIdx 指向 '<'；扫描到该元素的闭合 '>'（跳过嵌套花括号与字符串）。
  let i = startIdx
  const depth = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch
      i++
      while (i < src.length && src[i] !== q) {
        if (src[i] === '\\') i++
        i++
      }
    } else if (ch === '{') {
      let d = 1
      i++
      while (i < src.length && d > 0) {
        if (src[i] === '{') d++
        else if (src[i] === '}') d--
        i++
      }
      continue
    } else if (ch === '>') {
      return src.slice(startIdx, i + 1)
    } else if (ch === '/' && src[i + 1] === '>') {
      return src.slice(startIdx, i + 2)
    }
    i++
  }
  return src.slice(startIdx)
}

function lineOf(src, idx) {
  return src.slice(0, idx).split('\n').length
}

/** 就近向上找最近的 <FormLabel> / <Label> 文案，作为该控件的人类可读名。 */
function nearbyLabel(before) {
  const labels = [
    ...before.matchAll(/<FormLabel[^>]*>([\s\S]{0,120}?)<\/FormLabel>/g),
    ...before.matchAll(/<Label[^>]*>([\s\S]{0,120}?)<\/Label>/g),
  ]
  const last = labels.at(-1)
  if (!last) return ''
  return (
    last[1]
      // 把 `{t('文案')}` 里的引号文案取出来，而不是连同表达式一起删掉
      // （早先直接剥 `{...}` 会把文案本身也抹掉，导致清单里看不到字段名）。
      .replaceAll(/\{[^{}]*\}/g, (_, inner) => {
        const m = /'([^']*)'|"([^"]*)"/.exec(inner)
        return m ? (m[1] ?? m[2] ?? '') : ''
      })
      .replaceAll(/\s+/g, ' ')
      .trim()
  )
}

const files = []
;(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full)
    else if (e.name.endsWith('.tsx')) files.push(full)
  }
})(ROOT)

const missing = []
let total = 0
let totalSkipped = 0

for (const file of files.sort()) {
  const src = fs.readFileSync(file, 'utf8')
  for (const name of CONTROLS) {
    const re = new RegExp(`<${name}\\b`, 'g')
    for (const m of src.matchAll(re)) {
      // 跳过组件定义处（`function Xxx(`）与类型位置，只看 JSX 用法。
      const el = sliceElement(src, m.index)
      if (!el.includes('/>') && !el.includes(`</${name}>`)) continue
      total++
      // disabled / readOnly 的控件无法被输入，示例没有意义（值由后端或逻辑给定），
      // 不计入缺失项，否则清单会混进根本不需要填的字段。
      if (/\bdisabled\b/.test(el) || /\breadOnly\b/.test(el)) {
        totalSkipped++
        continue
      }
      // 口令类（type=password）不加placeholder：输入被遮蔽，示例看不见，
      // 而且这类字段旁边基本都已有 FormDescription 说明格式。
      if (/type=['"]password['"]/.test(el)) {
        totalSkipped++
        continue
      }
      // 共享输入原语（把 {...props} 透传给 Input 的包装组件）：placeholder 由调用方
      // 按场景传入，组件自己不该写死一个与业务无关的示例。
      if (/\{\.\.\.props\}/.test(el)) {
        totalSkipped++
        continue
      }
      const hasHint =
        /\bplaceholder=/.test(el) ||
        /\btitle=/.test(el) ||
        /\baria-label=/.test(el)
      if (hasHint) continue
      missing.push({
        file: path.relative('src', file),
        line: lineOf(src, m.index),
        control: name,
        label: nearbyLabel(src.slice(0, m.index)),
      })
    }
  }
}

if (SUMMARY) {
  console.log(
    `输入控件总数: ${total - totalSkipped}（另有${totalSkipped} 个 disabled/readOnly 不可输入，已跳过）；缺示例: ${missing.length}`
  )
  process.exit(missing.length > 0 ? 1 : 0)
}

if (missing.length === 0) {
  console.log(
    `✅ ${total - totalSkipped} 个可输入控件全部具备默认值或填写示例（另有 ${totalSkipped} 个 disabled/readOnly 已跳过）。`
  )
} else {
  console.log(
    `共 ${total - totalSkipped} 个可输入控件，其中 ${missing.length} 个缺示例（另有 ${totalSkipped} 个 disabled/readOnly 已跳过）：\n`
  )
  const byFile = new Map()
  for (const it of missing) {
    if (!byFile.has(it.file)) byFile.set(it.file, [])
    byFile.get(it.file).push(it)
  }
  for (const [f, items] of [...byFile].sort(
    (a, b) => b[1].length - a[1].length
  )) {
    console.log(`${f}  (${items.length})`)
    for (const it of items) {
      const name = it.label ? `  ← ${it.label}` : ''
      console.log(`    L${String(it.line).padEnd(4)} <${it.control}>${name}`)
    }
  }
  console.log(`\n合计待补: ${missing.length}`)
}
process.exitCode = missing.length > 0 ? 1 : 0
