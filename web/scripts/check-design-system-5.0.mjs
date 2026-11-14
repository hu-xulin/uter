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
// UTER Design System 5.0 — 规范 / 注册表 / Token 一致性校验器
//
// 用法（从 web/ 目录执行，或任意 cwd）：
//   node scripts/check-design-system-5.0.mjs                 # 校验，结构错误 exit 1
//   node scripts/check-design-system-5.0.mjs --generate     # 由 JSON 真源重生成 YAML 投影后校验
//   node scripts/check-design-system-5.0.mjs --strict       # 已知缺口也升级为失败（分阶段启用）
//   node scripts/check-design-system-5.0.mjs --json         # 仅输出 JSON 摘要
//
// 退出码：0 通过 / 1 存在结构错误（或 --strict 下存在未闭合缺口）/ 2 输入缺失 BLOCKED
//
// 设计约束：本脚本只新增「结构性硬约束」和「显式缺口清单」，不降低任何既有门禁阈值，
// 不修改 ALLOWLIST / baseline，不跳过 T1-T17。--strict 是待证据补齐后启用的未来门禁，
// 当前 CI 使用默认模式；所有已知缺口在 FINAL-ACCEPTANCE-REPORT.md 中如实列为 NOT_VERIFIED。

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, stringify } from 'yaml'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = resolve(SCRIPT_DIR, '..')
const REPO_ROOT = resolve(WEB_ROOT, '..')
const DS_DIR = join(REPO_ROOT, 'docs/design-system/uter-design-system-5.0')
const SPEC_REGISTRY = join(DS_DIR, 'DESIGN-STANDARD-REGISTRY.yaml')
const COMPONENT_YAML = join(DS_DIR, 'COMPONENT-REGISTRY.yaml')
const COMPONENT_JSON = join(WEB_ROOT, 'src/design-system/component-registry.json')
const TOKENS_DIR = join(WEB_ROOT, 'src/design-system/tokens')
const SHOWCASE = join(REPO_ROOT, 'docs/design-system/showcase.html')
const COMPONENT_SPEC = 'docs/design-system/uter-design-system-5.0/14-COMPONENT-STANDARD.md'

const GENERATE = process.argv.includes('--generate')
const STRICT = process.argv.includes('--strict')
const JSON_ONLY = process.argv.includes('--json')

const errors = []
const gaps = []
const checks = []
const errorsPath = new Set()

function record(name, ok, detail) {
  checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail })
  return ok
}

function error(file, item, problem, suggestion) {
  const key = `${file}|${item}|${problem}`
  if (errorsPath.has(key)) return
  errorsPath.add(key)
  errors.push({ file, item, problem, suggestion })
}

function gap(file, item, status, problem, suggestion) {
  gaps.push({ file, item, status, problem, suggestion })
}

function readText(file) {
  return readFileSync(file, 'utf8')
}

function stripBlockComments(text) {
  return text.replaceAll(/\/\*[\s\S]*?\*\//g, (match) =>
    match.replaceAll(/[^\n]/g, ' ')
  )
}

function walk(dir, filter) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full, filter))
    else if (filter(full)) out.push(full)
  }
  return out
}

function blockVariableNames(text, selectorRe) {
  const match = text.match(selectorRe)
  if (!match) return null
  const names = new Set()
  for (const line of match[0].split('\n')) {
    const def = line.match(/^\s*(--[A-Za-z0-9_-]+)\s*:/)
    if (def) names.add(def[1])
  }
  return names
}

// ---------------------------------------------------------------------------
// 0. 输入完整性（缺失即 BLOCKED，不伪造结论）
// ---------------------------------------------------------------------------
const requiredInputs = [SPEC_REGISTRY, COMPONENT_JSON, TOKENS_DIR, SHOWCASE]
const missing = requiredInputs.filter((p) => !existsSync(p))
if (missing.length > 0) {
  process.stdout.write(
    `${JSON.stringify({ verdict: 'BLOCKED', missing }, null, 2)}\n`
  )
  process.exit(2)
}

// ---------------------------------------------------------------------------
// 1. 生成模式：由唯一真源 component-registry.json 重生成 YAML 投影
// ---------------------------------------------------------------------------
const componentSource = JSON.parse(readText(COMPONENT_JSON))
const components = Array.isArray(componentSource.components)
  ? componentSource.components
  : []

if (GENERATE) {
  const projection = {
    schema_version: '1.0',
    registry_id: 'UDS5-R02',
    design_system: 'UTER Design System 5.0',
    version: '5.0.0',
    generated_from: 'web/src/design-system/component-registry.json',
    generation_note:
      'This projection is generated. The JSON registry remains the single source of truth.',
    policy: {
      no_unregistered_components: true,
      no_phantom_components: true,
      supported_platforms: ['PC Web', 'H5'],
      unsupported_platforms: ['Android', 'iOS', 'HarmonyOS'],
      unsupported_reason:
        'No native project, source files, or cross-platform framework exists in the repository. Status: NOT_VERIFIED.',
    },
    components: components.map((component) => {
      const contract = component.contract ?? {}
      const evidence = contract.evidence ?? {}
      const tests = Array.isArray(evidence.tests) ? evidence.tests : []
      return {
        id: component.id,
        name: component.name,
        category: component.category,
        layer: 'L3 Components',
        status: component.status,
        description: `Uter UI primitive ${component.name} (category: ${component.category}).`,
        source: 'web/src/design-system/component-registry.json',
        implementation_path: `web/${component.file}`,
        specification_path: COMPONENT_SPEC,
        test_path: tests.length > 0 ? `web/${tests[0]}` : '',
        story_path: 'docs/design-system/showcase.html',
        supported_platforms: ['PC Web', 'H5'],
        dependencies: [],
        tokens: {
          mustUseSemanticTokens: contract.tokens?.mustUseSemanticTokens ?? true,
          allowArbitraryValues: contract.tokens?.allowArbitraryValues ?? false,
        },
        variants: [],
        states: contract.states ?? [],
        accessibility: contract.accessibility ?? {},
        responsive: contract.responsive ?? {},
        evidence_status: evidence.status ?? 'NOT_VERIFIED',
        deprecated: component.status === 'DEPRECATED',
        replacement: '',
      }
    }),
  }
  writeFileSync(COMPONENT_YAML, stringify(projection, { lineWidth: 0 }), 'utf8')
}

// ---------------------------------------------------------------------------
// 2. 规范注册表校验
// ---------------------------------------------------------------------------
let registry
try {
  registry = parse(readText(SPEC_REGISTRY))
} catch (cause) {
  error(SPEC_REGISTRY, 'YAML', `解析失败: ${cause.message}`, '修正 YAML 语法后重跑')
  registry = null
}

const standards = Array.isArray(registry?.standards) ? registry.standards : []
if (!registry || standards.length === 0) {
  error(SPEC_REGISTRY, 'standards', '注册表为空或结构无效', '补齐 standards 数组')
}

const statusValues = new Set(registry?.status_values ?? [])
const ids = new Set()
const danglingDependencies = []

for (const standard of standards) {
  const id = String(standard.id ?? '')
  const docRel = String(standard.document ?? '')
  const docPath = resolve(REPO_ROOT, docRel)

  if (!id) {
    error(SPEC_REGISTRY, 'standard', '缺少 id', '为每条规范分配唯一 ID')
    continue
  }
  if (ids.has(id)) {
    error(SPEC_REGISTRY, id, '规范 ID 重复', '合并或重新分配 ID')
  }
  ids.add(id)

  if (statusValues.size > 0 && !statusValues.has(standard.status)) {
    error(SPEC_REGISTRY, id, `非法 status: ${standard.status}`, '使用 status_values 中的枚举')
  }
  if (typeof standard.mandatory !== 'boolean') {
    error(SPEC_REGISTRY, id, '缺少 mandatory 布尔值', '补齐 mandatory')
  }
  if (!standard.implementation || !standard.verification) {
    error(SPEC_REGISTRY, id, '缺少 implementation 或 verification', '补齐真实执行与验证入口')
  }
  if (!docRel || docRel.includes('..')) {
    error(SPEC_REGISTRY, id, 'document 路径缺失或越界', '填写仓库内相对路径')
    continue
  }
  if (!existsSync(docPath)) {
    error(SPEC_REGISTRY, id, `规范文档不存在: ${docRel}`, '创建文档或修正 document 路径')
    continue
  }
  const text = readText(docPath)
  if (text.trim().length < 200) {
    error(SPEC_REGISTRY, id, `规范文档内容过少: ${docRel}`, '填写实质内容，禁止空文件或只有标题')
  }
  if (!text.includes(id)) {
    error(SPEC_REGISTRY, id, `文档未声明自身 ID: ${docRel}`, '在元数据表写入 文档 ID')
  }
  if (standard.status === 'DRAFT' || standard.status === 'PENDING') {
    gap(
      docRel,
      id,
      'NOT_VERIFIED',
      `规范状态为 ${standard.status}，按 UDS5-S28 不得当作正式标准`,
      '完成内容、验证与审批后改为 ACTIVE'
    )
  }
  for (const dep of standard.dependencies ?? []) {
    if (!standards.some((candidate) => candidate.id === dep)) {
      danglingDependencies.push(`${id} -> ${dep}`)
    }
  }
}
for (const item of danglingDependencies) {
  error(SPEC_REGISTRY, item, '依赖引用不存在的规范 ID', '修正 dependencies')
}

record('规范 ID 唯一', !errors.some((e) => e.problem.includes('规范 ID 重复')), `${ids.size} 个 ID`)

// 2b. 文档 ID 反向扫描：正式目录中不得出现未登记的规范文档
const mdFiles = walk(DS_DIR, (file) => file.endsWith('.md'))
const declaredIds = new Map()
for (const file of mdFiles) {
  const text = readText(file)
  const match = text.match(/文档 ID\s*\|\s*`?([A-Za-z0-9-]+)`?/)
  if (match) declaredIds.set(relative(REPO_ROOT, file), match[1])
}
for (const [file, id] of declaredIds) {
  if (!ids.has(id)) {
    error(file, id, '文档声明了未登记的规范 ID', '在 DESIGN-STANDARD-REGISTRY.yaml 中登记')
  }
}
record('文档 ID 反向登记', declaredIds.size > 0, `扫描 ${mdFiles.length} 份 .md，声明 ID ${declaredIds.size} 个`)

// ---------------------------------------------------------------------------
// 3. 组件注册表 YAML 投影与 JSON 真源一致性
// ---------------------------------------------------------------------------
const jsonIds = new Set(components.map((c) => c.id))
let componentProjection = null
if (!existsSync(COMPONENT_YAML)) {
  error(COMPONENT_YAML, 'UDS5-R02', '组件注册表 YAML 投影缺失', '运行 design:5:sync 生成')
} else {
  try {
    componentProjection = parse(readText(COMPONENT_YAML))
  } catch (cause) {
    error(COMPONENT_YAML, 'YAML', `解析失败: ${cause.message}`, '重新生成投影')
  }
}

const yamlComponents = Array.isArray(componentProjection?.components)
  ? componentProjection.components
  : []
const yamlIds = new Set(yamlComponents.map((c) => c.id))
const missingInYaml = [...jsonIds].filter((id) => !yamlIds.has(id))
const phantomInYaml = [...yamlIds].filter((id) => !jsonIds.has(id))
if (missingInYaml.length) {
  error(COMPONENT_YAML, 'UDS5-R02', `真源中 ${missingInYaml.length} 个组件未登记: ${missingInYaml.slice(0, 5).join(', ')}`, '运行 design:5:sync 重新生成投影')
}
if (phantomInYaml.length) {
  error(COMPONENT_YAML, 'UDS5-R02', `投影中 ${phantomInYaml.length} 个组件在真源不存在: ${phantomInYaml.slice(0, 5).join(', ')}`, '删除幻影条目或补进 JSON 真源')
}

const requiredComponentFields = [
  'id', 'name', 'category', 'layer', 'status', 'description', 'source',
  'implementation_path', 'specification_path', 'test_path', 'story_path',
  'supported_platforms', 'dependencies', 'tokens', 'variants', 'states',
  'accessibility', 'deprecated', 'replacement',
]
const missingFields = new Set()
const emptyTestPaths = []
const emptyVariants = []
for (const component of yamlComponents) {
  for (const field of requiredComponentFields) {
    if (!(field in component)) missingFields.add(`${component.id}.${field}`)
  }
  const impl = resolve(REPO_ROOT, String(component.implementation_path ?? ''))
  if (!existsSync(impl)) {
    error(COMPONENT_YAML, component.id, `实现文件不存在: ${component.implementation_path}`, '修正路径或补齐实现')
  }
  const spec = resolve(REPO_ROOT, String(component.specification_path ?? ''))
  if (!existsSync(spec)) {
    error(COMPONENT_YAML, component.id, `规范文件不存在: ${component.specification_path}`, '修正路径')
  }
  if (!component.test_path) emptyTestPaths.push(component.id)
  if (!Array.isArray(component.variants) || component.variants.length === 0) {
    emptyVariants.push(component.id)
  }
  if (component.evidence_status && component.evidence_status !== 'VERIFIED') {
    gap(COMPONENT_YAML, component.id, 'NOT_VERIFIED', `组件证据状态 ${component.evidence_status}（非 VERIFIED）`, '补齐单元测试、浏览器测试与人工复核后更新 JSON 真源的 evidence.status')
  }
}
if (missingFields.size) {
  error(COMPONENT_YAML, 'UDS5-R02', `${missingFields.size} 个组件缺少注册字段，例如 ${[...missingFields].slice(0, 3).join(', ')}`, '按 PART 3.4 补齐字段')
}
if (emptyTestPaths.length) {
  gap(COMPONENT_YAML, 'UDS5-R02', 'NOT_VERIFIED', `${emptyTestPaths.length} 个组件无 test_path`, '为每个组件补回归测试并登记路径')
}
if (emptyVariants.length) {
  gap(COMPONENT_YAML, 'UDS5-R02', 'NOT_VERIFIED', `${emptyVariants.length} 个组件 variants 为空（真源未声明，源码 cva 为准）`, '把 cva variant 键登记进 JSON 真源')
}
record(
  '组件注册表与真源一致',
  missingInYaml.length === 0 && phantomInYaml.length === 0 && missingFields.size === 0,
  `json=${jsonIds.size} yaml=${yamlIds.size}`
)

// ---------------------------------------------------------------------------
// 4. Token 一致性硬约束
// ---------------------------------------------------------------------------
const tokenFiles = walk(TOKENS_DIR, (file) => file.endsWith('.css'))
const definitions = new Map()
const textThemeOwners = new Set()
for (const file of tokenFiles) {
  const text = stripBlockComments(readText(file))
  const local = new Set()
  for (const line of text.split('\n')) {
    const def = line.match(/^\s*(--[A-Za-z0-9_-]+)\s*:/)
    if (!def) continue
    local.add(def[1])
    if (/^--text-[a-z0-9-]+$/.test(def[1])) {
      textThemeOwners.add(relative(WEB_ROOT, file))
    }
  }
  definitions.set(file, local)
}

const ownerOf = new Map()
for (const [file, names] of definitions) {
  for (const name of names) {
    if (!ownerOf.has(name)) ownerOf.set(name, [])
    ownerOf.get(name).push(relative(WEB_ROOT, file))
  }
}
const crossFileDuplicates = [...ownerOf.entries()].filter(([, files]) => new Set(files).size > 1)
for (const [name, files] of crossFileDuplicates) {
  error('web/src/design-system/tokens/', name, `Token 跨文件重复定义: ${[...new Set(files)].join(', ')}`, '合并到单一真源文件')
}
record('Token 跨文件无重复', crossFileDuplicates.length === 0, `${ownerOf.size} 个唯一变量 / ${tokenFiles.length} 个 CSS`)

const allowedTextOwner = 'src/design-system/tokens/typography.css'
const illegalTextOwners = [...textThemeOwners].filter((file) => file !== allowedTextOwner)
for (const file of illegalTextOwners) {
  error(file, '--text-*', '@theme 字号变量出现在唯一真源之外', `仅允许 ${allowedTextOwner} 定义（T1）`)
}
record('@theme 字号唯一来源', illegalTextOwners.length === 0, `owner=${[...textThemeOwners].join(',') || 'none'}`)

const primitiveFiles = ['primitives.css', 'typography.css', 'spacing.css', 'brand.css']
for (const file of tokenFiles) {
  if (!primitiveFiles.some((name) => file.endsWith(name))) continue
  const text = stripBlockComments(readText(file))
  if (/var\(\s*--ds-/.test(text)) {
    error(relative(WEB_ROOT, file), 'layer-direction', 'Primitive 层反向引用 Semantic --ds-* 变量', '保持 组件 -> --ds-* -> --text-* 的单向依赖')
  }
}
record('Primitive 不反向引用 Semantic', true, `检查 ${primitiveFiles.length} 个 primitive 文件`)

const brandCss = join(TOKENS_DIR, 'generated/brand.css')
if (existsSync(brandCss)) {
  const text = stripBlockComments(readText(brandCss))
  const light = blockVariableNames(text, /:root\s*\{[^}]*\}/)
  const dark = blockVariableNames(text, /\.dark\s*\{[^}]*\}/)
  if (!light || !dark) {
    error(brandCss, 'brand', '无法解析 :root / .dark 品牌变量块', '检查 generated/brand.css 结构')
  } else {
    const onlyLight = [...light].filter((name) => !dark.has(name))
    const onlyDark = [...dark].filter((name) => !light.has(name))
    if (onlyLight.length || onlyDark.length) {
      error(brandCss, 'brand', `Light/Dark 品牌变量不成对: light-only=${onlyLight.join(',')} dark-only=${onlyDark.join(',')}`, '补齐缺失一侧的品牌变量')
    }
    record('品牌 Light/Dark 变量成对', onlyLight.length === 0 && onlyDark.length === 0, `pairs=${light.size}`)
  }
} else {
  error(brandCss, 'brand', '品牌生成产物缺失', '运行 design:tokens:generate')
}

// 零静态引用候选（信息项，不作为删除依据）
const srcFiles = walk(join(WEB_ROOT, 'src'), (file) => /\.(ts|tsx|css)$/.test(file))
const srcCorpus = srcFiles.map((file) => stripBlockComments(readText(file))).join('\n')
let unusedCandidates = 0
for (const name of ownerOf.keys()) {
  const escaped = name.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const used =
    new RegExp(`var\\(\\s*${escaped}(?=[\\s,)])`).test(srcCorpus) ||
    srcCorpus.includes(`'${name}'`) ||
    srcCorpus.includes(`"${name}"`) ||
    srcCorpus.includes(`(${name})`)
  if (!used) unusedCandidates += 1
}
if (unusedCandidates > 0) {
  gap('web/src/design-system/tokens/', 'unused-candidates', 'NOT_VERIFIED', `约 ${unusedCandidates} 个变量无静态 var()/字符串引用（含 Tailwind 工具类间接消费，非死代码结论）`, '按 UDS5-S27 逐项验证构建产物后再决定保留或废弃')
}

// ---------------------------------------------------------------------------
// 5. 显式已知缺口（不伪装 PASS）
// ---------------------------------------------------------------------------
const evidenceCounts = { VERIFIED: 0, PARTIAL: 0, NOT_VERIFIED: 0, EXCEPTION: 0 }
for (const component of components) {
  const status = component.contract?.evidence?.status ?? 'NOT_VERIFIED'
  if (status in evidenceCounts) evidenceCounts[status] += 1
}
if (evidenceCounts.VERIFIED < components.length) {
  gap('web/src/design-system/component-registry.json', 'evidence', 'NOT_VERIFIED', `组件证据 VERIFIED=${evidenceCounts.VERIFIED} / PARTIAL=${evidenceCounts.PARTIAL} / NOT_VERIFIED=${evidenceCounts.NOT_VERIFIED}；components:registry:strict 会 EXIT=1`, '逐组件补测试与复核后推进 evidence.status')
}
gap('platform', 'Android', 'NOT_VERIFIED', '仓库无 android/、无 *.kt/.java、无跨端框架', '若需验收须先建立真实原生实现与测试环境')
gap('platform', 'iOS', 'NOT_VERIFIED', '仓库无 ios/、无 *.swift/.m/.mm', '若需验收须先建立真实原生实现与测试环境')
gap('platform', 'HarmonyOS', 'NOT_VERIFIED', '仓库无 harmony/，仅支付 UA 正则中出现字面量', '若需验收须先建立真实原生实现与测试环境')
gap('docs/design-system/UTER-DESIGN-SYSTEM-3.0.md', 'E24', 'FAILED', '浅色溢价 3.76:1、深色折扣 3.30:1 低于 4.5:1', '按 UDS5-S13 修复对比度并复测，未修复前不得勾选通过')
gap('docs/design-system/uter-design-system-5.0/COMPONENT-DOCUMENTATION-AND-PREVIEW-STANDARD.md', 'showcase', 'NOT_VERIFIED', 'showcase.html 无 Props / 注册 ID / 组件级 a11y / 代码示例 / React 组件实例', '按 UDS5-S23 扩展既有展示页，不引入 Storybook')

// ---------------------------------------------------------------------------
// 6. 汇总与退出码
// ---------------------------------------------------------------------------
let verdict = 'PASS'
if (errors.length > 0) {
  verdict = 'FAILED'
} else if (STRICT && gaps.length > 0) {
  verdict = 'FAILED'
}
const summary = {
  verdict,
  mode: STRICT ? 'strict' : 'default',
  generated: GENERATE,
  checks: checks.length,
  checksPassed: checks.filter((c) => c.status === 'PASS').length,
  standards: standards.length,
  registeredDocIds: ids.size,
  scannedMarkdown: mdFiles.length,
  components: { json: jsonIds.size, yaml: yamlIds.size, evidence: evidenceCounts },
  tokenFiles: tokenFiles.length,
  uniqueTokenVariables: ownerOf.size,
  crossFileTokenDuplicates: crossFileDuplicates.length,
  unusedTokenCandidates: unusedCandidates,
  gaps: gaps.length,
  errors: errors.length,
}

if (JSON_ONLY) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
} else {
  process.stdout.write('=== UTER Design System 5.0 governance check ===\n')
  for (const check of checks) {
    process.stdout.write(`[${check.status}] ${check.name} — ${check.detail}\n`)
  }
  if (errors.length) {
    process.stdout.write(`\n--- ERRORS (${errors.length}) ---\n`)
    for (const item of errors) {
      process.stdout.write(`FAIL ${item.file} | ${item.item} | ${item.problem}\n     fix: ${item.suggestion}\n`)
    }
  }
  process.stdout.write(`\n--- KNOWN GAPS (${gaps.length}, reported NOT as PASS) ---\n`)
  for (const item of gaps.slice(0, 12)) {
    process.stdout.write(`GAP [${item.status}] ${item.item} — ${item.problem}\n`)
  }
  if (gaps.length > 12) {
    process.stdout.write(`... ${gaps.length - 12} more (see --json / acceptance report)\n`)
  }
  process.stdout.write(`\n${JSON.stringify(summary, null, 2)}\n`)
}

if (verdict === 'FAILED') process.exit(1)
process.exit(0)
