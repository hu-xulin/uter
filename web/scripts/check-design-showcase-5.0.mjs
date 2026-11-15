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
 * UTER DESIGN SYSTEM 5.0 全量 Showcase 静态校验器（`UDS5-S23` §11）。
 *
 * 纯静态只读：默认模式不写任何文件（generated: false）。它把「Showcase 必须
 * 覆盖 5.0 全部组件和元素」落成可执行的门禁：
 *
 *   S1 规范覆盖   —— data-spec-id 必须逐一覆盖 DESIGN-STANDARD-REGISTRY.yaml 全部条目
 *   S2 组件覆盖   —— data-component-id 必须逐一覆盖 COMPONENT-REGISTRY.yaml 全部组件
 *   S3 元素覆盖   —— data-element 必须覆盖 20 类基础元素 / 模式 / 业务域分区
 *   S4 真实 DOM   —— 禁止 <img> 静态截图冒充组件展示
 *   S5 单文件     —— 禁止 https?:// 外部资源，保证 file:// 可直接打开
 *   S6 可交互     —— theme / density / variant / size / state 五个切换控件齐备
 *   S7 计数自洽   —— 内联 manifest 的计数必须与真实 DOM 一致
 *   S8 无障碍     —— lang / aria-label / prefers-reduced-motion 齐备
 *   S9 上游对齐   —— G1 唯一规范主色 #6c47ff 必须出现，且不得引入 Clerk SDK
 *   S10 变量零遗漏 —— data-token-name / data-token-value 全量且与 manifest 自洽
 *   S11 字体零遗漏 —— @theme 字号档 / 字体族 / 字重逐一真实渲染
 *   S12 组件零遗漏 —— 每个组件的 data-component-id 都配一个真实视觉样本
 *   S13 唯一规范值 —— G1 / G2 基线表齐备且不与 manifest 漂移
 *
 * 2026-11-15 裁决：5.0 规范值以上游 clerk.com 为准，旧 S9「禁止 #6c47ff」已废止；
 * C3 运行时源码边界仍由 check-clerk-boundary.mjs 单独守护（本页是派生展示物）。
 *
 * 用法（任意 cwd）：
 *   node scripts/check-design-showcase-5.0.mjs [--json]
 *   node scripts/check-design-showcase-5.0.mjs --html <path>   # 测试沙箱注入
 *   node scripts/check-design-showcase-5.0.mjs --spec <path> --components <path>
 *
 * 退出码：0 PASS / 1 FAIL / 2 BLOCKED（输入缺失）
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = resolve(SCRIPT_DIR, '..')
const REPO_ROOT = resolve(WEB_ROOT, '..')
const DS_DIR = join(REPO_ROOT, 'docs/design-system/uter-design-system-5.0')

function option(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 && process.argv[index + 1]
    ? resolve(process.argv[index + 1])
    : fallback
}

const HTML_PATH = option('--html', join(DS_DIR, 'SHOWCASE-5.0.html'))
const SPEC_PATH = option('--spec', join(DS_DIR, 'DESIGN-STANDARD-REGISTRY.yaml'))
const COMPONENTS_PATH = option('--components', join(DS_DIR, 'COMPONENT-REGISTRY.yaml'))

const REQUIRED_ELEMENTS = [
  'color',
  'typography',
  'spacing',
  'radius',
  'elevation',
  'border',
  'iconography',
  'motion',
  'theme',
  'layout',
  'responsive',
  'accessibility',
  'form',
  'data-display',
  'notification',
  'interaction',
  'page-template',
  'business-domain',
  'component-api',
  'token-layers',
]
const REQUIRED_CONTROLS = ['theme', 'density', 'variant', 'size', 'state']

const missingInputs = [HTML_PATH, SPEC_PATH, COMPONENTS_PATH].filter(
  (p) => !existsSync(p)
)
if (missingInputs.length > 0) {
  process.stdout.write(
    `${JSON.stringify({ verdict: 'BLOCKED', missing: missingInputs, generated: false }, null, 2)}\n`
  )
  process.exit(2)
}

const html = readFileSync(HTML_PATH, 'utf8')
const specRegistry = parse(readFileSync(SPEC_PATH, 'utf8'))
const componentRegistry = parse(readFileSync(COMPONENTS_PATH, 'utf8'))

const expectedSpecIds = (specRegistry.standards ?? []).map((s) => s.id)
const expectedComponentIds = (componentRegistry.components ?? []).map((c) => c.id)

/** 提取某个 data-* 属性的全部取值（保留顺序、去重由调用方处理）。 */
function collect(attribute) {
  const pattern = new RegExp(`${attribute}="([^"]+)"`, 'g')
  const values = []
  let match
  while ((match = pattern.exec(html)) !== null) values.push(match[1])
  return values
}

const specIds = [...new Set(collect('data-spec-id'))]
const componentIds = [...new Set(collect('data-component-id'))]
const elementIds = [...new Set(collect('data-element'))]
const controlIds = [...new Set(collect('data-control'))]

const errors = []
const fail = (code, detail) =>
  errors.push(`[UDS5-SHOWCASE][${code}][BLOCK] ${detail}`)

// S1 规范覆盖
const missingSpecs = expectedSpecIds.filter((id) => !specIds.includes(id))
const unknownSpecs = specIds.filter((id) => !expectedSpecIds.includes(id))
if (missingSpecs.length > 0)
  {fail('S1', `规范分册覆盖缺失: ${missingSpecs.join(', ')}`)}
if (unknownSpecs.length > 0)
  {fail('S1', `出现未注册的规范 ID: ${unknownSpecs.join(', ')}`)}
if (specIds.length !== expectedSpecIds.length)
  {fail('S1', `规范分区数 ${specIds.length} != 注册条目 ${expectedSpecIds.length}`)}

// S2 组件覆盖
const missingComponents = expectedComponentIds.filter(
  (id) => !componentIds.includes(id)
)
const unknownComponents = componentIds.filter(
  (id) => !expectedComponentIds.includes(id)
)
if (missingComponents.length > 0)
  {fail('S2', `组件覆盖缺失: ${missingComponents.join(', ')}`)}
if (unknownComponents.length > 0)
  {fail('S2', `出现未注册的组件 ID: ${unknownComponents.join(', ')}`)}
if (componentIds.length !== expectedComponentIds.length)
  {fail('S2', `组件卡片数 ${componentIds.length} != 注册组件 ${expectedComponentIds.length}`)}

// S3 元素覆盖
const missingElements = REQUIRED_ELEMENTS.filter((id) => !elementIds.includes(id))
if (missingElements.length > 0)
  {fail('S3', `元素分区缺失: ${missingElements.join(', ')}`)}

// S4 真实 DOM，禁止静态截图冒充
if (/<img\b/i.test(html)) fail('S4', '出现 <img>：禁止用静态截图冒充组件展示')

// S5 单文件、零外部资源
if (/(?:src|href)\s*=\s*["']https?:\/\//i.test(html))
  {fail('S5', '出现 external 资源引用：file:// 打开必须零外链')}

// S6 交互控件
const missingControls = REQUIRED_CONTROLS.filter((id) => !controlIds.includes(id))
if (missingControls.length > 0)
  {fail('S6', `缺少 data-control 切换控件: ${missingControls.join(', ')}`)}

// S7 内联 manifest 计数自洽
const manifestMatch = html.match(
  /<script[^>]*id="uds5-manifest"[^>]*>([\s\S]*?)<\/script>/i
)
let manifest = null
if (!manifestMatch) {
  fail('S7', '缺少内联 manifest（id="uds5-manifest"）')
} else {
  try {
    manifest = JSON.parse(manifestMatch[1])
  } catch (cause) {
    fail('S7', `manifest 不是合法 JSON: ${cause.message}`)
  }
  if (manifest) {
    if (manifest.specIds !== specIds.length)
      {fail('S7', `manifest.specIds=${manifest.specIds} 与 DOM ${specIds.length} 不一致`)}
    if (manifest.componentIds !== componentIds.length)
      {fail('S7', `manifest.componentIds=${manifest.componentIds} 与 DOM ${componentIds.length} 不一致`)}
    if (manifest.elements !== elementIds.length)
      {fail('S7', `manifest.elements=${manifest.elements} 与 DOM ${elementIds.length} 不一致`)}
    if (manifest.normativeBrand !== '#6c47ff')
      {fail('S7', `manifest.normativeBrand=${manifest.normativeBrand} 与 G1 唯一规范主色 #6c47ff 不一致`)}
  }
}

const tokenNames = [...new Set(collect('data-token-name'))]
const tokenValueRows = collect('data-token-value')
const typeStepNames = [...new Set(collect('data-type-step'))]
const typeStepRows = collect('data-type-step')
const fontTokens = [...new Set(collect('data-font-token'))]
const fontWeights = [...new Set(collect('data-font-weight'))]
const componentSamples = [...new Set(collect('data-component-sample'))]
const externalColors = [...new Set(collect('data-external-color'))]
const normativeKeys = [...new Set(collect('data-normative-key'))]
const normativeBrand = [...new Set(collect('data-normative-brand'))]

// S8 无障碍基线
if (!/<html[^>]*\blang="[^"]+"/i.test(html)) fail('S8', '缺少 html lang 属性')
const ariaCount = (html.match(/\baria-label=/g) ?? []).length
if (ariaCount < 5) fail('S8', `aria-label 仅 ${ariaCount} 处，要求 >= 5`)
if (!/prefers-reduced-motion/.test(html))
  {fail('S8', '缺少 prefers-reduced-motion 降级规则')}

// S9 上游对齐：G1 唯一规范主色必须出现；仍不得引入 Clerk SDK / 运行时依赖
if (!/#6c47ff/i.test(html)) fail('S9', '缺少 G1 唯一规范主色 #6c47ff（UDS5-S01 §4.2）')
if (!normativeBrand.includes('#6c47ff'))
  {fail('S9', '缺少 data-normative-brand="#6c47ff" 唯一规范主色标记')}
if (/@clerk\//i.test(html)) fail('S9', '出现 Clerk 依赖标识（规范对齐 ≠ 引入 SDK）')

// S10 变量零遗漏：所有 CSS 变量的每一个取值都在 DOM 中逐项列出
if (tokenNames.length === 0) fail('S10', '未渲染任何运行时 CSS 变量')
if (manifest && manifest.tokenNames !== tokenNames.length)
  {fail('S10', `变量数 ${tokenNames.length} != manifest.tokenNames ${manifest.tokenNames}`)}
if (manifest && manifest.colorTokens + manifest.otherTokens !== tokenNames.length)
  {fail('S10', '颜色类 + 其它变量数不等于变量总数')}
if (manifest && manifest.tokenValues !== tokenValueRows.length)
  {fail('S10', `取值行数 ${tokenValueRows.length} != manifest.tokenValues ${manifest.tokenValues}`)}
if (manifest && manifest.externalColors !== externalColors.length)
  {fail('S10', `外部依赖色值 ${externalColors.length} != manifest.externalColors ${manifest.externalColors}`)}

// S11 字体零遗漏：@theme 字号档 / 字体族 / 字重逐一真实渲染
if (typeStepNames.length < 18) fail('S11', `@theme 字号档仅 ${typeStepNames.length} 档，要求 >= 18`)
if (manifest && manifest.typeSteps !== typeStepNames.length)
  {fail('S11', `字号档 ${typeStepNames.length} != manifest.typeSteps ${manifest.typeSteps}`)}
const registeredSteps = tokenNames.filter(
  (n) => n.startsWith('--text-') && !n.includes('--line-height')
)
const missingTypeSteps = registeredSteps.filter((n) => !typeStepNames.includes(n))
const extraTypeSteps = typeStepNames.filter((n) => !registeredSteps.includes(n))
if (missingTypeSteps.length > 0)
  {fail('S11', `字号档未在字体分区真实渲染: ${missingTypeSteps.join(', ')}`)}
if (extraTypeSteps.length > 0)
  {fail('S11', `出现未注册的字号档: ${extraTypeSteps.join(', ')}`)}
if (typeStepRows.length < typeStepNames.length)
  {fail('S11', '字号档渲染行数少于档位数（放大档取值遗漏）')}
if (manifest && manifest.fontFamilies !== fontTokens.length)
  {fail('S11', `字体族 ${fontTokens.length} != manifest.fontFamilies ${manifest.fontFamilies}`)}
if (manifest && manifest.fontWeights !== fontWeights.length)
  {fail('S11', `字重 ${fontWeights.length} != manifest.fontWeights ${manifest.fontWeights}`)}

// S12 组件零遗漏：ID 集合与视觉样本集合必须完全一致
const missingSamples = componentIds.filter((id) => !componentSamples.includes(id))
const unknownSamples = componentSamples.filter((id) => !componentIds.includes(id))
if (missingSamples.length > 0)
  {fail('S12', `缺少组件视觉样本: ${missingSamples.join(', ')}`)}
if (unknownSamples.length > 0)
  {fail('S12', `出现未注册的组件视觉样本: ${unknownSamples.join(', ')}`)}
if (manifest && manifest.componentSamples !== componentSamples.length)
  {fail('S12', `样本数 ${componentSamples.length} != manifest.componentSamples ${manifest.componentSamples}`)}

// S13 唯一规范值基线表（G1 / G2）
if (manifest && normativeKeys.length !== manifest.normativeG1 + manifest.normativeG2)
  {fail('S13', `基线表条目 ${normativeKeys.length} != G1+G2 ${manifest.normativeG1 + manifest.normativeG2}`)}
if (normativeKeys.length < 20) fail('S13', '唯一规范值基线表条目不足 20 项')

const verdict = errors.length === 0 ? 'PASS' : 'FAIL'
const checksPassed = 13 - new Set(errors.map((e) => e.match(/\[(S\d+)\]/)?.[1])).size
process.stdout.write(
  `${JSON.stringify(
    {
      verdict,
      errors: errors.length,
      errorList: errors,
      checksPassed,
      specIds: specIds.length,
      componentIds: componentIds.length,
      elements: elementIds.length,
      controls: controlIds.length,
      tokenNames: tokenNames.length,
      tokenValues: tokenValueRows.length,
      colorTokens: manifest?.colorTokens ?? null,
      externalColors: externalColors.length,
      typeSteps: typeStepNames.length,
      componentSamples: componentSamples.length,
      normativeKeys: normativeKeys.length,
      generated: false,
      sources: {
        html: HTML_PATH,
        specRegistry: SPEC_PATH,
        componentRegistry: COMPONENTS_PATH,
      },
    },
    null,
    2
  )}\n`
)
process.exit(verdict === 'PASS' ? 0 : 1)
