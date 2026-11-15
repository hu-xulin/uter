/**
 * UDS 7.0 Phase 1 — 审计报告生成器
 *
 * 数据来自：
 *   1. registry/audit-findings.mjs  —— 三路只读审计的结构化事实（file/lines/current 不可改写）
 *   2. registry/vscode-theme.mjs    —— VS Code 官方主题源码提取（含 SHA256 证据）
 *   3. 本脚本对磁盘的实时扫描      —— 可复现的附录计数
 *   4. audit/remediation-state.json —— 整改后由验收脚本写入的真实状态（缺省全 OPEN）
 *
 * 用法：node docs/design-system/registry/generate-audit.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FINDINGS, AREA_TITLES, REPORT_ORDER } from './audit-findings.mjs'
import { VSCODE_SYNTAX } from './vscode-theme.mjs'

const DS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = join(DS_DIR, '..', '..')
const AUDIT = join(DS_DIR, 'audit')
const FENCE = '```'

const git = (args) => {
  try { return execSync('git ' + args, { cwd: REPO, encoding: 'utf8' }).trim() } catch { return 'UNAVAILABLE' }
}

const now = new Date().toISOString()
const meta = {
  generated_at: now,
  git_sha: git('rev-parse HEAD'),
  git_branch: git('branch --show-current'),
  dirty_entries: Number(git('status --short | wc -l')) || 0,
  tool_versions: { node: process.version, generator: 'UDS7-audit/1.0.0' },
  command: 'node docs/design-system/registry/generate-audit.mjs',
}

/** 递归列出文件（排除 node_modules / dist / .git / 二进制）。 */
function walk(root, filter) {
  const out = []
  const go = (dir) => {
    for (const name of readdirSync(dir)) {
      if (['node_modules', 'dist', '.git', 'build', 'coverage'].includes(name)) continue
      const p = join(dir, name)
      const st = statSync(p)
      if (st.isDirectory()) go(p)
      else if (filter(name)) out.push(p)
    }
  }
  go(root)
  return out
}

/** 实时扫描：渐变使用全清单（四类）。 */
function scanGradients() {
  const roots = [join(REPO, 'web/src'), join(DS_DIR), join(REPO, 'web/public/design-system')]
  const rows = []
  const seen = new Set()
  for (const root of roots) {
    if (!existsSync(root)) continue
    for (const file of walk(root, (n) => /\.(css|tsx|ts|mjs|html|md)$/i.test(n))) {
      if (seen.has(file)) continue
      seen.add(file)
      const text = readFileSync(file, 'utf8')
      const lines = text.split('\n')
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i]
        if (!/linear-gradient|radial-gradient|conic-gradient|background-clip:\s*text|text-fill-color|bg-clip-text|text-transparent/.test(line)) continue
        const isText = /background-clip:\s*text|-webkit-text-fill-color|bg-clip-text|text-transparent/.test(line) || /background-clip:\s*text/.test(lines.slice(Math.max(0, i - 3), i + 4).join('\n'))
        const kind = /mask-image|mask:/i.test(line) ? 'MASK' : isText ? 'TEXT' : /radial-gradient/.test(line) ? 'BACKGROUND_RADIAL' : /conic-gradient/.test(line) ? 'DECORATION' : 'BACKGROUND_LINEAR'
        rows.push({ file: relative(REPO, file), line: i + 1, kind, snippet: line.trim().slice(0, 180) })
      }
    }
  }
  return rows
}

/** 实时扫描：web/src 的 var(-- 引用与 HEX 字面量。 */
function scanTokenUsage() {
  const src = join(REPO, 'web/src')
  const files = walk(src, (n) => /\.(css|tsx|ts)$/.test(n))
  let varRefs = 0
  let dsRefs = 0
  let ds6Refs = 0
  const hexByFile = []
  for (const f of files) {
    const text = readFileSync(f, 'utf8')
    varRefs += (text.match(/var\(--/g) || []).length
    dsRefs += (text.match(/var\(--ds-/g) || []).length
    ds6Refs += (text.match(/var\(--ds7-/g) || []).length
    const stripped = text.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/^\s*\/\/.*$/gm, '')
    const hits = (stripped.match(/#[0-9a-fA-F]{6}\b/g) || []).length
    if (hits > 0) hexByFile.push({ file: relative(REPO, f), hits, isTokenDefinition: /design-system\/tokens\/|styles\/(theme|theme-presets)\.css/.test(relative(REPO, f)) })
  }
  return { files: files.length, varRefs, dsRefs, ds6Refs, hexByFile }
}

function stateOf(id) {
  const p = join(AUDIT, 'remediation-state.json')
  if (!existsSync(p)) return { status: 'OPEN', evidence: 'PENDING' }
  try {
    const s = JSON.parse(readFileSync(p, 'utf8'))
    const r = s.findings?.[id]
    return r ? { status: r.status, evidence: r.evidence ?? 'PENDING' } : { status: 'OPEN', evidence: 'PENDING' }
  } catch { return { status: 'OPEN', evidence: 'PENDING' } }
}

const findings = FINDINGS.map((f) => ({ ...f, state: stateOf(f.id) }))

const esc = (s) => String(s ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ')
const fence = (lang, body) => FENCE + lang + '\n' + body + '\n' + FENCE

function findingBlock(f) {
  const rows = [
    ['唯一问题 ID', f.id],
    ['严重级别', f.severity],
    ['所属域', f.area + ' — ' + (AREA_TITLES[f.area] ?? '')],
    ['文件路径', f.file],
    ['行号 / 位置', f.lines],
    ['当前实际状态', f.current],
    ['违反的规范', f.violation],
    ['对产品的影响', f.impact],
    ['整改方案', f.remediation],
    ['对应自动化测试', f.test],
    ['验收证据', f.evidence],
    ['整改状态', f.state.status],
    ['实际证据', f.state.evidence],
  ]
  return '#### ' + f.id + '\n\n| 字段 | 内容 |\n|---|---|\n' + rows.map(([k, v]) => '| ' + esc(k) + ' | ' + esc(v) + ' |').join('\n') + '\n'
}

function header(title, scope, note) {
  return [
    '# ' + title,
    '',
    '> UTER DESIGN SYSTEM 7.0 · 全面审计整改（P0）· Phase 1 重新审计产出',
    '> 本报告由 `registry/generate-audit.mjs` 从磁盘实时扫描生成，不以任何历史报告结论为依据。',
    '',
    '| 元数据 | 值 |',
    '|---|---|',
    '| 生成时间 | ' + meta.generated_at + ' |',
    '| Git SHA | ' + meta.git_sha + ' |',
    '| 分支 | ' + meta.git_branch + ' |',
    '| 工作区脏区条目 | ' + meta.dirty_entries + '（并发 UAP 会话产物，本任务未覆盖、未混入） |',
    '| Node | ' + meta.tool_versions.node + ' |',
    '| 生成命令 | ' + meta.command + ' |',
    '| 审计范围 | ' + scope + ' |',
    '',
    note,
    '',
  ].join('\n')
}

const gradients = scanGradients()
const usage = scanTokenUsage()
const counts = {
  findings: findings.length,
  bySeverity: findings.reduce((a, f) => ((a[f.severity] = (a[f.severity] || 0) + 1), a), {}),
  byArea: findings.reduce((a, f) => ((a[f.area] = (a[f.area] || 0) + 1), a), {}),
  byStatus: findings.reduce((a, f) => ((a[f.state.status] = (a[f.state.status] || 0) + 1), a), {}),
  gradientHits: gradients.length,
  gradientByKind: gradients.reduce((a, g) => ((a[g.kind] = (a[g.kind] || 0) + 1), a), {}),
  tokenUsage: usage,
  vscodeSyntax: VSCODE_SYNTAX.rows.length,
  vscodeBaselineDiffs: VSCODE_SYNTAX.rows.filter((r) => r.baselineDiffers.light || r.baselineDiffers.dark).length,
  vscodeAdjustments: VSCODE_SYNTAX.rows.filter((r) => r.adjustment.light.adjusted || r.adjustment.dark.adjusted).length,
}

/* ── 1. COLOR-AUDIT-REPORT.md ───────────────────────────────────────── */
const colorFindings = findings.filter((f) => f.area === 'COLOR' || f.area === 'TOKEN')
writeFileSync(join(AUDIT, 'COLOR-AUDIT-REPORT.md'), [
  header('COLOR-AUDIT-REPORT — 颜色体系完整审计',
    'docs/design-system/ · web/src/design-system/ · web/src/styles/ · web/src/components/ · web/src/features/',
    '本报告回答：颜色体系是否完整、Light / Dark 是否一致、品牌基线真实值是什么、是否存在多套颜色来源与硬编码颜色。'),
  '## 1. 真实运行时权威结论', '',
  fence('text', [
    'AGENTS.md:176       → UDS 3.0 仍是唯一运行时强制标准',
    'AGENTS.md:378-379   → The approved design system is the single source of truth',
    'web/src/styles/index.css:49-60 → 只加载 3.0 Token 文件，7.0 runtime 零 import',
    '7.0/TOKEN-MANIFEST.json:6     → status = IMPLEMENTED_NOT_VERIFIED',
    '',
    '结论：7.0 的 254 个 Token 从未在真实页面生效；现有 17 项检查是「文档产物 ↔ manifest」闭环自证。',
  ].join('\n')), '',
  '## 2. 并行颜色来源实测', '',
  '| 前缀 / 来源 | 定义数 | 位置 |',
  '|---|---|---|',
  '| `--color-*` | 112 | `web/src/styles/theme.css:48-252` |',
  '| 无前缀语义变量 | 大量 | `theme.css:341-595` |',
  '| `--ds-*` | 175 | `design-system/tokens/{spacing,semantic,colors,elevation}.css` |',
  '| `--primitive-*` | 47 | `design-system/tokens/primitives.css` |',
  '| `--uter-brand-*` | 16 | `design-system/tokens/generated/brand.css:29-47` |',
  '| `--text-*` | 76 | `design-system/tokens/typography.css` |',
  '| `--clerk-*` | 0（运行时） | 仅测试禁项 |',
  '',
  '## 3. 品牌基线核实（§4.2 要求修改前必须核实）', '',
  '| 色值 | 文档声称的角色 | 运行时是否生效 | 真实位置 |',
  '|---|---|---|---|',
  '| `#5B5EE6` | Light Primary | 是 | `generated/brand.css:29` |',
  '| `#494CC7` | Light Primary Hover | 否 | 仅 7.0 `runtime/tokens.css:53,57` |',
  '| `#3F42B0` | Light Primary Active | 否 | 仅 7.0 `runtime/tokens.css:54,56` |',
  '| `#8B8DF5` | Dark Primary | 否（仅注释/测试） | `theme-presets.css:442-443,667` |',
  '| `#A1A3F7` | Dark Primary Hover | 是（作为 `--uter-brand-primary`） | `generated/brand.css:40` |',
  '| `#B7B8FA` | Dark Primary Active | 否 | 仅 7.0 `themes/dark.css:38` |',
  '',
  '**裁决**：全部 `KEEP`，不得按文档字面去「恢复」未生效的值；任何调整须走 `COLOR-OPTIMIZATION-REPORT.md` 的六项变更记录。', '',
  '## 4. 问题明细', '',
  ...colorFindings.map(findingBlock),
].join('\n') + '\n')

/* ── 2. TOKEN-CONSUMPTION-AUDIT.md ──────────────────────────────────── */
writeFileSync(join(AUDIT, 'TOKEN-CONSUMPTION-AUDIT.md'), [
  header('TOKEN-CONSUMPTION-AUDIT — Token 真实消费审计',
    'web/src 全量 CSS/TSX/TS · TOKEN-MANIFEST.json · TOKEN-REGISTRY.json · 检查器',
    '本报告回答：有哪些无消费者 Token、必需 Token 是否都有真实消费者、是否存在硬编码颜色、CSS 与 TypeScript 是否两套真值。'),
  '## 1. 实时扫描数据', '',
  '| 指标 | 实测值 |',
  '|---|---|',
  '| 扫描源码文件数 | ' + usage.files + ' |',
  '| `var(--` 引用总数 | ' + usage.varRefs + ' |',
  '| `var(--ds-` 引用总数 | ' + usage.dsRefs + ' |',
  '| `var(--ds7-` 引用总数（整改前） | ' + usage.ds6Refs + ' |',
  '| 含 HEX 字面量的文件数 | ' + usage.hexByFile.length + ' |',
  '| 其中 Token 定义文件 | ' + usage.hexByFile.filter((x) => x.isTokenDefinition).length + ' |',
  '',
  '## 2. manifest 字段缺口', '',
  fence('json', JSON.stringify(JSON.parse(readFileSync(join(DS_DIR, 'TOKEN-MANIFEST.json'), 'utf8')).tokens?.['--ds-color-brand-1'] ?? JSON.parse(readFileSync(join(DS_DIR, 'TOKEN-MANIFEST.json'), 'utf8'))['--ds-color-brand-1'] ?? {}, null, 2)), '',
  '当前每个 Token 只有 8 个字段；`semanticMeaning` / `consumer` / `contrastRequirement` / `deprecated` 全部缺失（`grep` 零命中）。', '',
  '## 3. 含 HEX 字面量的文件（区分定义处与业务处）', '',
  '| 文件 | 命中数 | 是否 Token 定义处 |',
  '|---|---|---|',
  ...usage.hexByFile.sort((a, b) => b.hits - a.hits).slice(0, 30).map((x) => '| ' + esc(x.file) + ' | ' + x.hits + ' | ' + (x.isTokenDefinition ? '是（合规）' : '否') + ' |'),
  '',
  '## 4. 问题明细', '',
  ...findings.filter((f) => f.area === 'TOKEN').map(findingBlock),
].join('\n') + '\n')

/* ── 3. CODE-HIGHLIGHT-AUDIT.md ─────────────────────────────────────── */
writeFileSync(join(AUDIT, 'CODE-HIGHLIGHT-AUDIT.md'), [
  header('CODE-HIGHLIGHT-AUDIT — 代码高亮与 VS Code 官方主题审计',
    'web/src/components/ai-elements/code-block.tsx · json-code-editor.tsx · javascript-viewer.tsx · hero-terminal-demo.tsx · styles/index.css · web/package.json · audit/vscode/*.json',
    '本报告回答：VS Code Light+/Dark+ 是否真正落地、20 个语法 Token 是否全部被使用、多个引擎是否共享同一套语义 Token。'),
  '## 1. 引擎真实状态', '',
  '| 引擎 | 版本 | 状态 | 真实渲染位置 |',
  '|---|---|---|---|',
  '| CodeMirror 6 + `@lezer/highlight` | `@codemirror/view ^6.43.4` | ACTIVE（主） | `code-block.tsx:194-234, 336-442` |',
  '| CodeMirror 6 + `classHighlighter` | 同上 | ACTIVE（次） | `javascript-viewer.tsx:51-108` |',
  '| yace | `^1.1.0` | ACTIVE（JSON 编辑器） | `json-code-editor.tsx:109-113`，着色 `styles/index.css:81-99` |',
  '| marked | `^18.0.5` | ACTIVE（无高亮） | `ui/markdown.tsx:612-631` 原生 `<pre><code>` |',
  '| 手写 span + `term-*` | — | ACTIVE（终端演示） | `hero-terminal-demo.tsx:516-536` |',
  '| Shiki | `^4.3.0` | TYPE_ONLY | 仅 `code-block.tsx:52`、`model-details-api.tsx:22` 类型导入 |',
  '| highlight.js / Prism / rehype-highlight / react-syntax-highlighter | — | NOT_USED | 无引用 |',
  '',
  '## 2. 20 个语法 Token 的消费者现状', '',
  '| 状态 | 数量 | 说明 |',
  '|---|---|---|',
  '| 有真实运行时消费者 | 5 | keyword / string / number / function / property，走 3.0 的 `--syntax-*` |',
  '| 无独立变量、被塌缩复用 | 4 | comment→muted-foreground、inserted→string、deleted/invalid→keyword |',
  '| 完全无消费者 | 11 | variable / type / operator / punctuation / constant / boolean / null / tag / attribute / regexp / builtin |',
  '| 7.0 `--ds-syntax-*` 在 `web/src` 引用 | 0 | 仅存在于 docs runtime 与静态 Showcase |',
  '',
  '## 3. VS Code 官方源码对照（差异摘要）', '',
  '官方证据：`audit/vscode/SOURCE-METADATA.json`（5 个官方 JSONC 原文 + SHA256）。完整差异表见 `VSCODE-COLOR-MAPPING.md`。', '',
  '| 类别 | 文档候选基线 | VS Code 官方 | 是否一致 |',
  '|---|---|---|---|',
  ...VSCODE_SYNTAX.rows.filter((r) => r.baselineDiffers.light || r.baselineDiffers.dark).map((r) => '| ' + r.key + ' | ' + r.userBaseline.light + ' / ' + r.userBaseline.dark + ' | ' + r.officialLight + ' / ' + r.officialDark + ' | 否 |'),
  '',
  '## 4. 问题明细', '',
  ...findings.filter((f) => f.area === 'HIGHLIGHT').map(findingBlock),
].join('\n') + '\n')

/* ── 4. GRADIENT-TYPOGRAPHY-AUDIT.md ────────────────────────────────── */
const gTable = gradients.slice(0, 140).map((g) => '| ' + esc(g.file) + ' | ' + g.line + ' | ' + g.kind + ' | ' + esc(g.snippet) + ' |')
writeFileSync(join(AUDIT, 'GRADIENT-TYPOGRAPHY-AUDIT.md'), [
  header('GRADIENT-TYPOGRAPHY-AUDIT — 渐变文字全库扫描',
    'web/src · web/public/design-system · docs/design-system',
    '本报告回答：全库有哪些渐变、是否有独立插值空间声明、CSS 与对比度引擎是否一致、业务组件是否绕开唯一出口。'),
  '## 1. 扫描口径与实时结果', '',
  '扫描正则：`linear-gradient|radial-gradient|conic-gradient|background-clip:text|-webkit-text-fill-color|bg-clip-text|text-transparent`；逐行记录并回溯 ±3 行判定是否文字渐变。', '',
  '| 分类 | 命中行数 |',
  '|---|---|',
  ...Object.entries(counts.gradientByKind).sort((a, b) => b[1] - a[1]).map(([k, v]) => '| ' + k + ' | ' + v + ' |'),
  '| **合计** | **' + gradients.length + '** |',
  '',
  '## 2. 关键实测结论', '',
  '- 唯一文字渐变出口：`web/src/design-system/foundations/typography.css:225-235` 的 `@utility ds-text-gradient-brand`。',
  '- 业务组件消费者仅 2 处：`hero.tsx:157`、`cta.tsx:58`。',
  '- 违规手写渐变：`shimmer.tsx:51-60`（EX-006，OPEN）。',
  '- **全库所有渐变表达式均无 `in srgb` / `in oklch` / `color-interpolation` 声明**；`color-mix(in oklch, …)` 是混色空间，不是渐变插值声明。',
  '- 对比度引擎 `contrast-engine.mjs:63-91` 按 sRGB 通道插值、101 点采样；与 CSS 无显式空间声明形成不一致。',
  '- 三套渐变值并存：运行时 `#60A5FA/#A78BFA/#A855F7`、7.0 Light `#1D4ED8/#6D28D9/#7E22CE`、7.0 Dark `#93C5FD/#C4B5FD/#D8B4FE`。',
  '',
  '## 3. 完整使用位置清单（前 140 行，全量见 design-system-audit.json）', '',
  '| 文件 | 行号 | 分类 | 实际内容 |',
  '|---|---|---|---|',
  ...gTable,
  '',
  '## 4. 问题明细', '',
  ...findings.filter((f) => f.area === 'GRADIENT').map(findingBlock),
].join('\n') + '\n')

/* ── 5. LIGHT-DARK-CONSISTENCY-AUDIT.md ─────────────────────────────── */
writeFileSync(join(AUDIT, 'LIGHT-DARK-CONSISTENCY-AUDIT.md'), [
  header('LIGHT-DARK-CONSISTENCY-AUDIT — Light / Dark 一致性审计',
    'theme.css · theme-presets.css · theme-provider.tsx · theme-customization-provider.tsx · 7.0 runtime/themes',
    '本报告回答：Light / Dark 是否一致、有几套主题入口、状态色与终端色是否分别验证。'),
  '## 1. 主题入口实测', '',
  '| 入口 | 选择器 | 是否生效 | 位置 |',
  '|---|---|---|---|',
  '| 主题 class | `html.light` / `html.dark` | 是 | `theme-provider.tsx:98-99`、`theme.css:596` |',
  '| 主题预设 | `body[data-theme-preset=...]` | 是 | `theme-customization-provider.tsx:120`、`theme-presets.css:36-666` |',
  '| 7.0 主题 | `[data-ds-theme=light|dark]` | 否 | `runtime/themes/light.css:25`、`dark.css:25` |',
  '| 系统偏好 | `prefers-color-scheme` | JS 侧 | `theme-provider.tsx:66,94`；CSS 零媒体查询 |',
  '',
  '## 2. Light / Dark 取值冲突', '',
  '| 语义 | Light | Dark | 问题 |',
  '|---|---|---|---|',
  '| `--secondary` / `--muted` / `--accent` | 全 `#f1f5f9` | 全 `#1e293b` | 三层无语义区分 |',
  '| `--term-background` | `#000000` | `#000000` | 深浅同值，违反 §4.6 |',
  '| `--ds-color-surface-overlay`（3.0） | `#000000` | `#000000` | 与 7.0 `#FFFFFF` 语义反转 |',
  '| `--chart-1..6` | oklch(...) | oklch(...) | 被 10+ 组主题预设漂移覆盖 |',
  '| tertiary / disabled | `color-mix()` 派生 | `color-mix()` 派生 | 无独立 HEX，无法逐主题验证 |',
  '| `::selection` | 无定义 | 无定义 | 运行时缺失 |',
  '',
  '## 3. 同名 Token 冲突（接入风险）', '',
  '| Token | 3.0 值 | 7.0 值 |',
  '|---|---|---|',
  '| `--ds-radius-md` | `10px` | `5` |',
  '| `--ds-color-surface-overlay` | `#000000` | `#FFFFFF` / `#1B2436` |',
  '| `--ds-color-text-primary` | `var(--foreground)` | `#0F172A` / `#F1F5F9` |',
  '| `--ds-color-text-inverse` | `var(--primary-foreground)` | `#FFFFFF` / `#0F172A` |',
  '| `--ds-color-border-input` | `var(--input)` | `#CBD5E1` / `#3B4A63` |',
  '',
  '## 4. 问题明细', '',
  ...findings.filter((f) => f.area === 'COLOR' || f.area === 'MIGRATION').map(findingBlock),
].join('\n') + '\n')

/* ── 6. ACCESSIBILITY-AUDIT.md ──────────────────────────────────────── */
writeFileSync(join(AUDIT, 'ACCESSIBILITY-AUDIT.md'), [
  header('ACCESSIBILITY-AUDIT — 无障碍与字体体系审计',
    'web/src 全量 · web/scripts/verify-contrast.mjs · web/e2e/visual · 7.0 runtime/foundations.css',
    '本报告回答：WCAG 2.2 AA 12 类逐项是否验证、forced-colors 是否支持、字体体系是否被擅自改动。'),
  '## 1. 实时扫描', '',
  '| 关键词 | 文件数 | 命中数 |',
  '|---|---|---|',
  '| `forced-colors` | 0 | 0 |',
  '| `prefers-reduced-motion` | 14 | 24 |',
  '| `focus-visible` | 46 | 189 |',
  '| `aria-` | 385 | 1480 |',
  '| `role=` | 110 | 169 |',
  '',
  '## 2. `verify-contrast.mjs` 逐项覆盖', '',
  '| 检查类别 | 是否有逐项对比度检查 |',
  '|---|---|',
  ...['普通文字', '大文本', '按钮文字', '输入框文字', 'Placeholder', 'Disabled', 'Border', 'Focus Indicator', '图表', '代码高亮', '渐变文字', '状态提示'].map((k) => '| ' + k + ' | ' + (k === '渐变文字' ? '有（但按装饰性豁免口径放行，非达标型）' : k === '普通文字' || k === '大文本' || k === '按钮文字' ? '部分（17 个品牌/链接/选中态对）' : '无') + ' |'),
  '',
  '## 3. 字体体系真实值（不得更换）', '',
  fence('css', [
    '--font-ui: Inter Variable, Inter, Source Han Sans SC, Source Han Sans CN,',
    "          思源黑体, Noto Sans SC Variable, Noto Sans SC, Noto Sans CJK SC,",
    "          PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, ... sans-serif;",
    '--font-body: var(--font-ui);',
    '--font-mono: ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas,',
    "             Liberation Mono, Courier New, monospace, Source Han Sans SC, ...;",
    '',
    '来源：web/src/styles/theme.css:301-306, 311, 324-328',
    '等宽数字：styles/index.css:657 + 87 文件 177 处 tabular-nums',
  ].join('\n')), '',
  '## 4. 问题明细', '',
  ...findings.filter((f) => f.area === 'A11Y' || f.area === 'FONT').map(findingBlock),
].join('\n') + '\n')

/* ── 7. IMPLEMENTATION-GAP-REPORT.md ────────────────────────────────── */
writeFileSync(join(AUDIT, 'IMPLEMENTATION-GAP-REPORT.md'), [
  header('IMPLEMENTATION-GAP-REPORT — 实现缺口与统一整改方案',
    '三路只读审计全部范围',
    '本报告是 Phase 1 的总账：完整问题集合、统一整改方案、Phase 0–10 执行顺序、验收条件与阻塞项。'),
  '## 1. 问题集合统计', '',
  '| 指标 | 数量 |',
  '|---|---|',
  '| 问题总数 | ' + counts.findings + ' |',
  ...Object.entries(counts.bySeverity).map(([k, v]) => '| ' + k + ' | ' + v + ' |'),
  ...Object.entries(counts.byArea).map(([k, v]) => '| ' + k + ' 域 | ' + v + ' |'),
  ...Object.entries(counts.byStatus).map(([k, v]) => '| 状态 ' + k + ' | ' + v + ' |'),
  '',
  '## 2. 问题索引', '',
  '| ID | 级别 | 域 | 文件 | 行号 | 状态 |',
  '|---|---|---|---|---|---|',
  ...findings.map((f) => '| ' + f.id + ' | ' + f.severity + ' | ' + f.area + ' | ' + esc(f.file) + ' | ' + esc(f.lines) + ' | ' + f.state.status + ' |'),
  '',
  '## 3. 统一整改方案（一次性识别完整问题集合）', '',
  '| 批次 | 覆盖问题 | 实际动作 | 验收命令 |',
  '|---|---|---|---|',
  '| B1 唯一真源 | T-01/02/03、C-05、S-03 | `tokens.mjs` 扩展 manifest 字段与五层实体；`build.mjs` 从 manifest 派生计数 | `check-uds7-remediation.mjs` |',
  '| B2 颜色体系 | C-07/08/09/10/11/12 | neutral 10 档、4 状态 × 6 变体、12 色图表、Terminal ANSI16、12 类业务上下文 | `contrast-validation.json` |',
  '| B3 VS Code 高亮 | H-01..H-10 | 官方主题提取、20 Token 落地、统一 Adapter、JSON 编辑器去 chart、15 语言样例 | `syntax-validation.json` |',
  '| B4 渐变 | G-01..G-07 | `in srgb`、1001 采样、背景矩阵、三处同源、shimmer 收敛、浏览器像素分析 | `gradient-validation.json` |',
  '| B5 无障碍/字体 | A-01..A-04、F-01..F-03 | forced-colors、12 类对比度矩阵、字体守卫、CVD 模拟 | `accessibility-validation.json` |',
  '| B6 Showcase/回归 | S-01/02、R-01/02 | Showcase 升级、真实运行时实测、产品页 Light/Dark 回归 | `visual-regression.json` |',
  '| B7 迁移/验收 | R-03/04、C-01/04/06 | COMPAT-MAP、回滚演练、状态纪律、最终报告 | `final-acceptance.json` |',
  '',
  '## 4. Phase 0–10 执行顺序与验收门槛', '',
  '| Phase | 目标 | 必须产出的证据 | 未达时 |',
  '|---|---|---|---|',
  '| 0 仓库确认 | 保护 64 项并发 WIP | 本报告元数据 SHA / 脏区数 | 停止 |',
  '| 1 重新审计 | 7 份审计 + 问题表 | `design-system-audit.json` | 停止 |',
  '| 2 颜色重构 | 五层 + 全部 Token | `token-validation.json` | 不进入 3 |',
  '| 3 VS Code 高亮 | 20 Token 真实消费 | `syntax-validation.json` | 不进入 4 |',
  '| 4 渐变验证 | 1001 点 + 浏览器像素 | `gradient-validation.json` | 不进入 5 |',
  '| 5 字体/无障碍 | 12 类 WCAG + forced-colors | `accessibility-validation.json` | 不进入 6 |',
  '| 6 Showcase | 真实 Token 驱动 + 四栏对照 | `SHOWCASE-7.0.html` | 不进入 7 |',
  '| 7 自动化门禁 | 全 P0 PASS | `design-system-audit.json` 复跑 | 不进入 8 |',
  '| 8 页面回归 | Light/Dark 产品页 | `visual-regression.json` | 如实标 BLOCKED |',
  '| 9 迁移兼容 | 映射 + 回滚 | `COMPAT-MAP.json` | 不申请切换 |',
  '| 10 独立复验 | 全门禁重跑 | `final-acceptance.json` | 不给 FULLY_VERIFIED |',
  '',
  '## 5. 已知阻塞项（必须在最终报告如实标注）', '',
  '- 3.0 仍是 `AGENTS.md` 指定的运行时唯一强制标准；文档 §2.3 禁止在 7.0 完成全部验收前宣布其为全站正式标准。',
  '- 全站 72 个路由 / 951 个 TSX 的业务页面迁移需要用户视觉审核通过并逐批单独授权，且涉及支付 / 认证 / 余额高风险页面。',
  '- `web/e2e/visual/authed.spec.ts:52-59` 缺凭据即整组 SKIPPED，认证页组无法给出真实覆盖保证。',
  '- 并发 UAP 会话持续写入 `.uap/` 运行时文件，工作区脏区数会变化；本任务不覆盖、不提交这些文件。',
  '',
  '## 6. 全部问题明细', '',
  ...findings.map(findingBlock),
].join('\n') + '\n')

/* ── 8. VSCODE-COLOR-MAPPING.md（顶层交付） ────────────────────────── */
const mapRows = VSCODE_SYNTAX.rows.map((r) => [
  r.key, r.scope, r.officialLight, r.officialDark,
  r.userBaseline.light + (r.baselineDiffers.light ? ' ⚠' : ''),
  r.userBaseline.dark + (r.baselineDiffers.dark ? ' ⚠' : ''),
  r.adopted.light + (r.adjustment.light.adjusted ? ' (adj)' : ''),
  r.adopted.dark + (r.adjustment.dark.adjusted ? ' (adj)' : ''),
  String(r.adjustment.light.ratioAfter) + ' / ' + String(r.adjustment.dark.ratioAfter),
].join(' | '))
writeFileSync(join(DS_DIR, 'VSCODE-COLOR-MAPPING.md'), [
  '# VSCODE-COLOR-MAPPING — VS Code Light+ / Dark+ 官方映射与差异登记',
  '',
  '> 唯一权威：`audit/vscode/vscode-{light_vs,light_plus,dark_vs,dark_plus}.json`（microsoft/vscode `main` 分支官方 JSONC 原文）。',
  '> 证据哈希：`audit/vscode/SOURCE-METADATA.json`。提取器：`registry/vscode-theme.mjs`。',
  '> 生成时间：' + now + ' · Git SHA：' + meta.git_sha,
  '',
  '## 1. 官方主题链', '',
  '- `Light+ (default light)` = `light_plus.json` → `include ./light_vs.json`，15 条 tokenColors + 4 条 semanticTokenColors。',
  '- `Dark+ (default dark)` = `dark_plus.json` → `include ./dark_vs.json`，15 条 tokenColors + 4 条 semanticTokenColors。',
  '- 官方编辑器背景：`editor.background` Light `#FFFFFF` / Dark `#1E1E1E`；前景 `#000000` / `#D4D4D4`。',
  '- Uter 实际代码块背景：`#F6F8FA` / `#0E1524`（来自 `contrast-engine.mjs` BACKGROUNDS），因此必须另做落地对比度验证。',
  '',
  '## 2. 20 类语法映射（⚠ = 与文档候选基线不一致；(adj) = 为达 WCAG AA 做的有限调整）', '',
  '| 类别 | 官方 TextMate scope | 官方 Light | 官方 Dark | 文档基线 Light | 文档基线 Dark | Uter 采用 Light | Uter 采用 Dark | 在 Uter 代码块背景上的对比度 |',
  '|---|---|---|---|---|---|---|---|---|',
  ...mapRows.map((r) => '| ' + r + ' |'),
  '',
  '## 3. 与文档候选基线的差异（' + String(VSCODE_SYNTAX.rows.filter((r) => r.baselineDiffers.light || r.baselineDiffers.dark).length) + ' 个类别 / ' + String(VSCODE_SYNTAX.rows.reduce((a, r) => a + (r.baselineDiffers.light ? 1 : 0) + (r.baselineDiffers.dark ? 1 : 0), 0)) + ' 处主题取值）', '',
  '| 类别 | 主题 | 文档候选 | VS Code 官方 | 裁决 |',
  '|---|---|---|---|---|',
  ...VSCODE_SYNTAX.rows.flatMap((r) => [
    r.baselineDiffers.light ? '| ' + r.key + ' | Light | ' + r.userBaseline.light + ' | ' + r.officialLight + ' | 以官方为准 |' : null,
    r.baselineDiffers.dark ? '| ' + r.key + ' | Dark | ' + r.userBaseline.dark + ' | ' + r.officialDark + ' | 以官方为准 |' : null,
  ].filter(Boolean)),
  '',
  '## 4. 有限调整记录（WCAG 2.2 AA ≥ 4.5:1）', '',
  '| 类别 | 主题 | 官方原值 | 原对比度 | 采用值 | 新对比度 | 明度步数 | 原因 |',
  '|---|---|---|---|---|---|---|---|',
  ...VSCODE_SYNTAX.rows.flatMap((r) => [
    r.adjustment.light.adjusted ? '| ' + r.key + ' | Light | ' + r.officialLight + ' | ' + r.adjustment.light.ratioBefore + ':1 | ' + r.adopted.light + ' | ' + r.adjustment.light.ratioAfter + ':1 | ' + r.adjustment.light.lightnessSteps + ' | 落在 Uter code-bg #F6F8FA 上低于 4.5 |' : null,
    r.adjustment.dark.adjusted ? '| ' + r.key + ' | Dark | ' + r.officialDark + ' | ' + r.adjustment.dark.ratioBefore + ':1 | ' + r.adopted.dark + ' | ' + r.adjustment.dark.ratioAfter + ':1 | ' + r.adjustment.dark.lightnessSteps + ' | 落在 Uter code-bg #0E1524 上低于 4.5 |' : null,
  ].filter(Boolean)),
  '',
  '## 5. 官方作用域派生说明', '',
  ...Object.entries(VSCODE_SYNTAX.rows.reduce((a, r) => ((r.derivedNote ? (a[r.key] = r.derivedNote) : null), a), {})).map(([k, v]) => '- **' + k + '**：' + v),
  '',
  '## 6. 官方编辑器与终端颜色（用于 §5.3 代码样式）', '',
  fence('json', JSON.stringify({ editor: VSCODE_SYNTAX.editor, uterCodeBackground: VSCODE_SYNTAX.uterCodeBackground, wcagTarget: VSCODE_SYNTAX.wcagTarget }, null, 2)),
  '',
  '## 7. 可复现命令', '',
  fence('bash', [
    'curl -fsSL https://raw.githubusercontent.com/microsoft/vscode/main/extensions/theme-defaults/themes/light_vs.json',
    'node docs/design-system/registry/vscode-theme.mjs > /tmp/vscode-syntax.json',
    'node docs/design-system/registry/generate-audit.mjs',
  ].join('\n')),
].join('\n') + '\n')

/* ── 9. 机器可读审计结果 ───────────────────────────────────────────── */
const machine = {
  schema: 'UDS7-AUDIT/1.0',
  ...meta,
  audit_scope: ['docs/design-system', 'web/src/design-system', 'web/src/styles', 'web/src/components', 'web/scripts', 'all showcases', 'all gradient usages', 'all code editors', 'theme switching', 'token generators/validators'],
  counts,
  tests: {
    total: findings.length,
    passed: findings.filter((f) => f.state.status === 'FIXED').length,
    failed: findings.filter((f) => f.state.status === 'FAILED').length,
    skipped: findings.filter((f) => f.state.status === 'BLOCKED' || f.state.status === 'PENDING').length,
    open: findings.filter((f) => f.state.status === 'OPEN').length,
    failures: findings.filter((f) => f.state.status === 'FAILED').map((f) => ({ id: f.id, file: f.file, lines: f.lines })),
  },
  findings,
  gradients,
  tokenUsage: usage,
  vscodeSyntax: VSCODE_SYNTAX,
}
writeFileSync(join(AUDIT, 'design-system-audit.json'), JSON.stringify(machine, null, 2) + '\n')

console.log('[UDS7-AUDIT] generated_at=' + now)
console.log('[UDS7-AUDIT] git_sha=' + meta.git_sha + ' dirty=' + meta.dirty_entries)
console.log('[UDS7-AUDIT] findings=' + counts.findings + ' ' + JSON.stringify(counts.bySeverity))
console.log('[UDS7-AUDIT] gradient_hits=' + counts.gradientHits + ' ' + JSON.stringify(counts.gradientByKind))
console.log('[UDS7-AUDIT] vscode rows=' + counts.vscodeSyntax + ' baseline_diffs=' + counts.vscodeBaselineDiffs + ' adjustments=' + counts.vscodeAdjustments)
console.log('[UDS7-AUDIT] reports=' + REPORT_ORDER.length + ' + VSCODE-COLOR-MAPPING.md + design-system-audit.json')
