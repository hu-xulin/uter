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
 * i18n 键覆盖门禁：源码里用到的每一个静态 t() 键，都必须同时存在于全部语言包。
 *
 * 为什么必须有这个门禁（2026-10-07）：
 *   本仓 i18n 约定「key 即英文原文」，i18next 缺键时会**回落显示 key 本身**。
 *   而 `bun run i18n:sync`（sync-i18n.mjs）**不扫源码**——它只对已存在于 JSON 的键
 *   做并集/重排/补值，无法发现源码里新增的 t('...')。结果就是：新加的文案在中文界面
 *   直接漏出英文，而 sync 的「diff 为空」门禁完全抓不到。
 *   本脚本补上这一环，并已接入 package.json 的 `i18n:check`。
 *
 * 覆盖两种取键形式：
 *   1. t('literal') / t("literal")
 *   2. t(CONST)，其中 CONST 在同文件里由 ['a','b','c'].join('.') 定义
 *      （例：footer.tsx 的 footer.uter.projectAttributionSuffix）
 *
 * 已知不覆盖（会跳过，不误报）：模板字符串含插值的键、运行时拼接的键、
 * 由变量传入的键。这些无法静态解析，需要作者手工同步语言包。
 *
 * 用法：
 *   node scripts/check-i18n-keys.mjs            # 缺键则 exit 1
 *   node scripts/check-i18n-keys.mjs --quiet    # 只输出汇总
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')
const SRC_DIR = path.resolve('src')
const LOCALES = ['en', 'zh', 'zh-TW', 'fr', 'ru', 'ja', 'vi']

const SCAN_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs'])
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '__tests__',
])
// i18n 目录内是语言包与配置本身，不含需要翻译的 t() 调用。
const SKIP_DIRS_REL = new Set(['i18n'])

const QUIET = process.argv.includes('--quiet')
const SHOW_LIMIT = 40

// t( '...' ) | t( "..." ) | t( IDENT )
const CALL_RE =
  /\bt\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|([A-Za-z_$][\w$]*))/g
// const NAME = [ 'a', 'b' ].join('.')
const JOIN_CONST_RE =
  /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\[([\s\S]*?)\]\s*\.join\(\s*['"]\.['"]\s*\)/g
const QUOTED_RE = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g

function unescapeJs(raw) {
  return raw.replaceAll(/\\(.)/g, (_, ch) => {
    switch (ch) {
      case 'n':
        return '\n'
      case 't':
        return '\t'
      case 'r':
        return '\r'
      default:
        return ch
    }
  })
}

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    const rel = path.relative(SRC_DIR, full)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      if (SKIP_DIRS_REL.has(rel.split(path.sep)[0])) continue
      yield* walk(full)
      continue
    }
    if (!SCAN_EXT.has(path.extname(entry.name))) continue
    // 测试文件里的 t() 多为夹具字符串，不需要翻译。
    if (/\.(test|spec)\.[jt]sx?$/.test(entry.name)) continue
    if (entry.name.endsWith('.d.ts')) continue
    yield full
  }
}

/** 收集单文件里用到的静态键 -> 首次出现的行号。 */
function collectKeys(text) {
  const joinConsts = new Map()
  for (const m of text.matchAll(JOIN_CONST_RE)) {
    const parts = []
    for (const seg of m[2].matchAll(QUOTED_RE)) {
      parts.push(unescapeJs(seg[1] ?? seg[2] ?? ''))
    }
    if (parts.length > 0) joinConsts.set(m[1], parts.join('.'))
  }

  const found = new Map()
  for (const m of text.matchAll(CALL_RE)) {
    let key = null
    if (m[1] !== undefined) key = unescapeJs(m[1])
    else if (m[2] !== undefined) key = unescapeJs(m[2])
    else if (m[3] !== undefined) key = joinConsts.get(m[3]) ?? null
    if (!key) continue
    if (!found.has(key)) {
      found.set(key, text.slice(0, m.index).split('\n').length)
    }
  }
  return found
}

async function main() {
  const localeKeys = {}
  for (const locale of LOCALES) {
    const file = path.join(LOCALES_DIR, `${locale}.json`)
    try {
      const json = JSON.parse(await fs.readFile(file, 'utf8'))
      localeKeys[locale] = new Set(Object.keys(json?.translation ?? {}))
    } catch (err) {
      console.error(`i18n:check 无法读取语言包 ${locale}: ${err.message}`)
      process.exitCode = 1
      return
    }
  }

  /** locale -> Map(key -> "rel/file:line") */
  const missing = new Map(LOCALES.map((l) => [l, new Map()]))
  let usedKeyCount = 0

  for await (const file of walk(SRC_DIR)) {
    const text = await fs.readFile(file, 'utf8')
    const keys = collectKeys(text)
    usedKeyCount += keys.size
    const rel = path.relative(process.cwd(), file)
    for (const [key, line] of keys) {
      for (const locale of LOCALES) {
        if (!localeKeys[locale].has(key)) {
          missing.get(locale).set(key, `${rel}:${line}`)
        }
      }
    }
  }

  // src/i18n 被 SKIP_DIRS_REL 跳过，所以 static-keys.ts 里的键不会走到上面的
  // collectKeys（它也扫不到 `t(option.labelKey)` 这类变量形式的键）。这里显式
  // 补一道：登记在 STATIC_I18N_KEYS 的键必须同样在全部语言包里存在。
  const staticKeysFile = path.resolve('src/i18n/static-keys.ts')
  let staticKeyCount = 0
  try {
    const text = await fs.readFile(staticKeysFile, 'utf8')
    const block = text.match(/STATIC_I18N_KEYS\s*=\s*\[([\s\S]*?)\]\s*as\s+const/)
    if (block) {
      // 只保留「一整行就是一个完整字符串字面量」的条目。该数组里存在
      // 多行拼接（'…' +\n  '…'）与行尾注释，直接全局匹配引号会把注释文字
      // 和换行片段当成键。这些键已由 collectKeys 覆盖（它们是 t('...') 字面量），
      // 这里只补 collectKeys 扫不到的变量形式，故跳过拼接行是安全且正确的。
      const declared = new Set()
      for (const raw of block[1].split('\n')) {
        const line = raw.trim()
        const m = line.match(/^'((?:[^'\\]|\\.)*)',?$/)
        if (m) declared.add(unescapeJs(m[1]))
      }
      staticKeyCount = declared.size
      for (const key of declared) {
        for (const locale of LOCALES) {
          if (!localeKeys[locale].has(key)) {
            missing.get(locale).set(key, 'src/i18n/static-keys.ts')
          }
        }
      }
    }
  } catch (err) {
    console.error(`i18n:check 无法读取 static-keys.ts: ${err.message}`)
    process.exitCode = 1
    return
  }

  const totalMissing = [...missing.values()].reduce((n, m) => n + m.size, 0)
  const incomplete = LOCALES.filter((l) => missing.get(l).size > 0)

  if (totalMissing === 0) {
    console.log(
      `i18n:check 通过：${usedKeyCount} 个静态 t() 键 + ${staticKeyCount} 个登记键（static-keys.ts）在 ${LOCALES.length} 份语言包中全部存在。`
    )
    return
  }

  console.error(
    `i18n:check 失败：${usedKeyCount} 个静态 t() 键 + ${staticKeyCount} 个登记键中有缺失，涉及 ${incomplete.length}/${LOCALES.length} 份语言包。\n` +
      '注意：本仓 key 即英文原文，缺键时 i18next 会回落显示英文原文——中文界面会直接漏出英文。\n'
  )
  for (const locale of incomplete) {
    const entries = [...missing.get(locale).entries()]
    console.error(`  [${locale}] 缺 ${entries.length} 个键`)
    if (QUIET) continue
    for (const [key, at] of entries.slice(0, SHOW_LIMIT)) {
      console.error(`    - ${JSON.stringify(key)}  (${at})`)
    }
    if (entries.length > SHOW_LIMIT) {
      console.error(
        `    … 其余 ${entries.length - SHOW_LIMIT} 个省略（--quiet 可只看汇总）`
      )
    }
  }
  process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
