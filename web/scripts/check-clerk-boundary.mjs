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
 * Clerk 外部参考边界守卫（`UDS5-S21` §8 / §10）。
 *
 * Clerk 仅是 UTER DESIGN SYSTEM 5.0 的外部设计参考，不是依赖、不是运行时组件、
 * 不是验收基准。本脚本把 §3 的 P1–P5 禁止事项落成可执行的静态门禁：
 *
 *   C1 依赖零引入      —— package.json 四组依赖中不得出现 @clerk/* / clerk / clerk-*
 *   C2 运行时零引用    —— 生产源码不得出现 ClerkProvider、@clerk/* import、
 *                         cl-* 稳定类、Clerk 品牌背书文案
 *   C3 品牌值零照搬    —— 不得出现 #6c47ff 或 --clerk-* 变量声明
 *   C4 能力归属一致性  —— S21 §2.2 的 11 类通用能力必须逐条标注「官方否」，
 *                         防止后续把 Uter 自有能力误写成 Clerk 官方能力
 *   C5 业务红线零改动  —— S21 §3 P3 行必须显式登记零改动符号清单且前端不得
 *                         耦合后端业务函数（EnforceOrgQuota / ReserveOrgQuota /
 *                         IncrOrgUsedQuota），防止认证 / 资金 / 授权逻辑被改写
 *
 * 纯静态只读：默认模式不写任何文件；退出码 0 = PASS，1 = FAIL。
 * `--root` / `--docs` 仅供回归测试注入沙箱使用，不改变默认扫描目标。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const DEFAULT_WEB_ROOT = resolve(SCRIPT_DIR, '..')

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.json', '.mjs', '.js'])
const SKIP_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  '__tests__',
  'coverage',
  '.git',
  '.rsbuild',
])

/** C1：禁止的 npm 包名形态。 */
const FORBIDDEN_DEPENDENCY = /^(?:@clerk\/|clerk$|clerk[-@])/i

/** C2 / C3：禁止出现在生产源码中的模式。 */
const SOURCE_RULES = [
  { code: 'C2', label: 'ClerkProvider', pattern: /\bClerkProvider\b/ },
  {
    code: 'C2',
    label: '@clerk/* import',
    pattern: /(?:from|import\()\s*['"]@clerk\//,
  },
  {
    code: 'C2',
    label: 'cl-* 稳定类',
    pattern: /(?:^|[\s'"=:`{])cl-[A-Za-z][A-Za-z0-9-]*/,
  },
  {
    code: 'C2',
    label: 'Clerk 品牌背书文案',
    pattern: /Secured by Clerk|Powered by Clerk/i,
  },
  { code: 'C3', label: 'Clerk 品牌色 #6c47ff', pattern: /#6c47ff/i },
  { code: 'C3', label: '--clerk-* 变量声明', pattern: /--clerk-[a-z-]+\s*:/i },
]

/**
 * C4：S21 §2.2 中「Clerk 官方未提供」的 11 类通用能力。
 * 每一类都必须在表格行里出现，且该行的「官方是否提供」列为「否」。
 */
const UTER_OWNED_CAPABILITIES = [
  'Data Table',
  'Charts',
  'DatePicker',
  'FileUpload',
  'Toast',
  'Image',
  'Drawer',
  'Timeline',
  'Z-index',
  'WCAG 2.2 AA',
  'HarmonyOS',
]

/**
 * C5：业务红线零改动（`UDS5-S21` §3 P3）。
 * 两项静态约束：
 *  (a) 文档一致性——S21 §3 的 P3 行必须存在且显式登记零改动符号清单
 *      （org_role / sub_quota_limit / EnforceOrgQuota / ReserveOrgQuota /
 *       IncrOrgUsedQuota），防止该红线被静默删除或弱化；
 *  (b) 源码耦合防护——web/ 生产源码不得出现后端业务函数名
 *      （EnforceOrgQuota / ReserveOrgQuota / IncrOrgUsedQuota），
 *      它们是 Go 后端配额 / 权限逻辑函数，前端出现即表示越界耦合，
 *      违反「认证 / 资金 / 授权逻辑零改动」。
 * 注意：`org_role` 与 `sub_quota_limit` 是前端合法使用的 API 字段名，
 *      不从源码侧禁止，仅由文档一致性 (a) 守住登记。
 */
const BUSINESS_REDLINE_DOC_SYMBOLS = [
  'org_role',
  'sub_quota_limit',
  'EnforceOrgQuota',
  'ReserveOrgQuota',
  'IncrOrgUsedQuota',
]
const BUSINESS_REDLINE_SOURCE_SYMBOLS = [
  'EnforceOrgQuota',
  'ReserveOrgQuota',
  'IncrOrgUsedQuota',
]

function parseArgs(argv) {
  const options = {
    root: DEFAULT_WEB_ROOT,
    docs: null,
    json: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--root' && argv[i + 1]) {
      options.root = resolve(argv[(i += 1)])
    } else if (arg === '--docs' && argv[i + 1]) {
      options.docs = resolve(argv[(i += 1)])
    } else if (arg === '--json') {
      options.json = true
    }
  }
  if (options.docs === null) {
    options.docs = resolve(
      options.root,
      '..',
      'docs/design-system/uter-design-system-5.0'
    )
  }
  return options
}

function readText(file) {
  return readFileSync(file, 'utf8')
}

function walk(dir, root, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRECTORIES.has(entry)) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walk(full, root, out)
    } else if (
      SOURCE_EXTENSIONS.has(full.slice(full.lastIndexOf('.'))) &&
      !/(\.test\.|\.spec\.|\.gen\.)/.test(entry)
    ) {
      out.push({ abs: full, rel: relative(root, full) })
    }
  }
  return out
}

/** C1：四组依赖字段中不得出现 Clerk 包。 */
function checkDependencies(root, errors) {
  const pkgPath = join(root, 'package.json')
  if (!existsSync(pkgPath)) {
    errors.push({ code: 'C1', file: 'package.json', detail: '文件不存在' })
    return { scanned: 0 }
  }
  let pkg
  try {
    pkg = JSON.parse(readText(pkgPath))
  } catch {
    errors.push({ code: 'C1', file: 'package.json', detail: 'JSON 解析失败' })
    return { scanned: 0 }
  }
  const groups = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]
  let scanned = 0
  for (const group of groups) {
    for (const name of Object.keys(pkg[group] ?? {})) {
      scanned += 1
      if (FORBIDDEN_DEPENDENCY.test(name)) {
        errors.push({
          code: 'C1',
          file: `package.json:${group}`,
          detail: `禁止引入 Clerk 依赖 ${name}`,
        })
      }
    }
  }
  return { scanned }
}

/** C2 / C3：生产源码静态扫描。 */
function checkSource(root, errors) {
  const srcDir = join(root, 'src')
  const files = walk(srcDir, root)
  for (const { abs, rel } of files) {
    const lines = readText(abs).split('\n')
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      for (const rule of SOURCE_RULES) {
        rule.pattern.lastIndex = 0
        if (!rule.pattern.test(line)) continue
        errors.push({
          code: rule.code,
          file: `${rel}:${index + 1}`,
          detail: rule.label,
        })
      }
    }
  }
  return { scanned: files.length }
}

/**
 * C4：S21 §2.2 能力归属表。
 * 逐条要求关键词出现在某行，且该行含「| 否 |」；否则视为归属被改写或清单被删。
 */
function checkCapabilityAttribution(docsDir, errors) {
  const s21 = join(docsDir, 'CLERK-DESIGN-REFERENCE-STANDARD.md')
  if (!existsSync(s21)) {
    errors.push({
      code: 'C4',
      file: 'CLERK-DESIGN-REFERENCE-STANDARD.md',
      detail: '文件不存在，能力归属清单无法校验',
    })
    return { scanned: 0 }
  }
  const text = readText(s21)
  const tableStart = text.indexOf('## 2.2')
  const tableEnd = text.indexOf('> 说明', tableStart)
  const table =
    tableStart >= 0
      ? text.slice(tableStart, tableEnd > tableStart ? tableEnd : text.length)
      : text
  const rows = table.split('\n').filter((line) => line.trim().startsWith('|'))

  for (const capability of UTER_OWNED_CAPABILITIES) {
    const row = rows.find((r) => r.includes(capability))
    if (!row) {
      errors.push({
        code: 'C4',
        file: 'CLERK-DESIGN-REFERENCE-STANDARD.md §2.2',
        detail: `能力归属清单缺少「${capability}」`,
      })
      continue
    }
    if (!/\|\s*否\s*\|/.test(row)) {
      errors.push({
        code: 'C4',
        file: 'CLERK-DESIGN-REFERENCE-STANDARD.md §2.2',
        detail: `「${capability}」的官方是否提供列必须为「否」`,
      })
    }
  }
  return { scanned: UTER_OWNED_CAPABILITIES.length }
}

/**
 * C5：业务红线零改动（`UDS5-S21` §3 P3）。
 *  (a) 文档一致性：S21 §3 的 P3 行必须存在且登记全部零改动符号，防止红线被静默删除；
 *  (b) 源码耦合防护：web/ 生产源码（排除 __tests__）不得出现后端业务函数名，
 *      这些 Go 函数名若出现于前端，即表示越界耦合后端配额 / 权限逻辑。
 */
function checkBusinessRedline(root, docsDir, errors) {
  // (a) 文档一致性
  const s21 = join(docsDir, 'CLERK-DESIGN-REFERENCE-STANDARD.md')
  let docScanned = 0
  if (!existsSync(s21)) {
    errors.push({
      code: 'C5',
      file: 'CLERK-DESIGN-REFERENCE-STANDARD.md',
      detail: '文件不存在，业务红线登记无法校验',
    })
  } else {
    const text = readText(s21)
    const secStart = text.indexOf('## 3.')
    const secEnd = text.indexOf('\n## 4.', secStart)
    const section =
      secStart >= 0
        ? text.slice(secStart, secEnd > secStart ? secEnd : text.length)
        : text
    const p3 = section
      .split('\n')
      .find((line) => /^\|\s*P3\s*\|/.test(line.trim()))
    if (!p3) {
      errors.push({
        code: 'C5',
        file: 'CLERK-DESIGN-REFERENCE-STANDARD.md §3',
        detail: '缺少 P3 行（业务红线零改动登记）',
      })
    } else {
      docScanned = 1
      for (const symbol of BUSINESS_REDLINE_DOC_SYMBOLS) {
        if (!p3.includes(symbol)) {
          errors.push({
            code: 'C5',
            file: 'CLERK-DESIGN-REFERENCE-STANDARD.md §3 P3',
            detail: `业务红线零改动符号「${symbol}」未在 P3 行登记`,
          })
        }
      }
    }
  }

  // (b) 源码耦合防护
  const srcDir = join(root, 'src')
  const files = walk(srcDir, root)
  const sourcePattern = new RegExp(
    `\\b(?:${BUSINESS_REDLINE_SOURCE_SYMBOLS.join('|')})\\b`
  )
  for (const { abs, rel } of files) {
    const lines = readText(abs).split('\n')
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      sourcePattern.lastIndex = 0
      if (!sourcePattern.test(line)) continue
      errors.push({
        code: 'C5',
        file: `${rel}:${index + 1}`,
        detail: '前端越界耦合后端业务函数（违反业务红线零改动）',
      })
    }
  }

  return { scanned: docScanned + files.length }
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const errors = []

  const deps = checkDependencies(options.root, errors)
  const source = checkSource(options.root, errors)
  const docs = checkCapabilityAttribution(options.docs, errors)
  const redline = checkBusinessRedline(options.root, options.docs, errors)

  const checks = [
    { id: 'C1', name: '依赖零引入', passed: !errors.some((e) => e.code === 'C1') },
    {
      id: 'C2',
      name: '运行时零引用',
      passed: !errors.some((e) => e.code === 'C2'),
    },
    {
      id: 'C3',
      name: '品牌值零照搬',
      passed: !errors.some((e) => e.code === 'C3'),
    },
    {
      id: 'C4',
      name: '能力归属一致性',
      passed: !errors.some((e) => e.code === 'C4'),
    },
    {
      id: 'C5',
      name: '业务红线零改动',
      passed: !errors.some((e) => e.code === 'C5'),
    },
  ]

  const verdict = errors.length === 0 ? 'PASS' : 'FAIL'
  const result = {
    verdict,
    mode: 'default',
    generated: false,
    root: options.root,
    docs: options.docs,
    checks: checks.length,
    checksPassed: checks.filter((c) => c.passed).length,
    checkDetails: checks,
    scanned: {
      dependencies: deps.scanned,
      sourceFiles: source.scanned,
      capabilities: docs.scanned,
      businessRedline: redline.scanned,
    },
    errors: errors.length,
    violations: errors,
  }

  if (!options.json) {
    console.log(`[clerk-boundary] ${verdict}`)
    for (const check of checks) {
      console.log(
        `  ${check.passed ? 'PASS' : 'FAIL'} ${check.id} ${check.name}`
      )
    }
    console.log(
      `  scanned: ${deps.scanned} deps / ${source.scanned} source files / ${docs.scanned} capabilities / ${redline.scanned} business-redline`
    )
    for (const error of errors.slice(0, 20)) {
      console.log(`  VIOLATION [${error.code}] ${error.file} — ${error.detail}`)
    }
    if (errors.length > 20) console.log(`  ... ${errors.length - 20} more`)
    console.log()
  }
  console.log(JSON.stringify(result, null, 2))
  process.exit(errors.length === 0 ? 0 : 1)
}

main()
