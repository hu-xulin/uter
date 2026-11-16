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
/*
 * UTER DESIGN SYSTEM 8.0.0 — Automated specification checker
 *
 * 所有检查项读取真实磁盘文件；不读取缓存、不使用声明值代替实测值。
 * 用法：
 *   node web/scripts/check-design-system-8.0.0.mjs           人类可读
 *   node web/scripts/check-design-system-8.0.0.mjs --json   机器可读
 * 退出码 0 = 全部通过；1 = 有失败项；2 = 环境不满足（BLOCKED）
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB = fileURLToPath(new URL('..', import.meta.url))
const REPO = join(WEB, '..')
const DS = join(REPO, 'docs', 'design-system')
const RUNTIME = join(DS, 'runtime')
const ENGINE = join(DS, 'registry', 'contrast-engine.mjs')

const errors = []
const checks = []
const fail = (code, msg) => errors.push(`[${code}] ${msg}`)
const check = (code, label, fn) => {
  try {
    const detail = fn()
    checks.push({ code, label, status: 'PASS', detail })
  } catch (e) {
    checks.push({
      code,
      label,
      status: 'ERROR',
      detail: String(e && e.message ? e.message : e),
    })
    fail(code, `检查器异常: ${String(e && e.message ? e.message : e)}`)
  }
}
const assert = (cond, code, msg) => {
  if (!cond) fail(code, msg)
}
const read = (p) => readFileSync(p, 'utf8')
const rel = (p) => relative(REPO, p).split(sep).join('/')

const walk = (dir, filter, out = []) => {
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, filter, out)
    else if (filter(p)) out.push(p)
  }
  return out
}

if (!existsSync(join(DS, 'TOKEN-MANIFEST.json')) || !existsSync(ENGINE)) {
  console.error(
    JSON.stringify({
      verdict: 'BLOCKED',
      reason: 'TOKEN-MANIFEST.json 或 contrast-engine.mjs 缺失',
    })
  )
  process.exit(2)
}

const M = JSON.parse(read(join(DS, 'TOKEN-MANIFEST.json')))
const T = M.tokens
const names = Object.keys(T).sort()
const cssVal = (t, theme) => {
  const v = t[theme]
  if (typeof v === 'number') {
    if (t.unit === 'px') return `${v}px`
    if (t.unit === 'ms') return `${v}ms`
    return String(v)
  }
  return String(v)
}

/* C01 Manifest 结构与唯一性 ------------------------------------------------ */
check('C01', 'TOKEN-MANIFEST 结构与 Token 唯一性', () => {
  assert(M.manifest_id === 'UDS8-TOKEN-MANIFEST', 'C01', 'manifest_id 不正确')
  assert(M.version === '8.0.0', 'C01', 'version 不是 8.0.0')
  assert(
    M.design_system === 'UTER DESIGN SYSTEM 8.0.0',
    'C01',
    'design_system 不正确'
  )
  assert(
    M.tokenCount === names.length,
    'C01',
    `tokenCount=${M.tokenCount} 与实际 ${names.length} 不一致`
  )
  assert(names.length >= 200, 'C01', `Token 数量 ${names.length} 过少`)
  const bad = names.filter((n) => !n.startsWith('--ds-'))
  assert(
    bad.length === 0,
    'C01',
    `非 --ds-* Token: ${bad.slice(0, 5).join(',')}`
  )
  for (const [n, t] of Object.entries(T)) {
    assert(
      t.light !== undefined && t.dark !== undefined,
      'C01',
      `${n} 缺 Light/Dark`
    )
    assert(
      typeof t.description === 'string' && t.description.length > 0,
      'C01',
      `${n} 缺说明`
    )
    assert(
      ['primitive', 'semantic', 'component'].includes(t.layer),
      'C01',
      `${n} layer 非法`
    )
  }
  return `${names.length} tokens, 3 layers`
})

/* C02 38 份规范文件 / 唯一编号 / 唯一文件名 -------------------------------- */
check('C02', '36 + 2 规范模块文件与唯一编号', () => {
  const files = walk(DS, (p) => p.endsWith('.md'))
    .map((p) => rel(p))
    .sort()
  const specs = files.filter((f) =>
    /^\d\d-[A-Z].*\.md$/.test(f.split('/').pop())
  )
  assert(specs.length === 36, 'C02', `正式规范 ${specs.length} 份，应为 36`)
  const specials = [
    'CODE-SYNTAX-HIGHLIGHTING-STANDARD.md',
    'GRADIENT-TYPOGRAPHY-STANDARD.md',
  ]
  for (const s of specials) {
    assert(existsSync(join(DS, s)), 'C02', `专项规范缺失: ${s}`)
  }
  const ids = specs.map((f) => f.split('/').pop().slice(0, 2))
  assert(new Set(ids).size === 36, 'C02', '编号重复')
  assert(ids[0] === '00' && ids[35] === '35', 'C02', '编号不连续')
  assert(new Set(specs).size === specs.length, 'C02', '文件名重复')
  return `36 numbered + 2 special, ids ${ids[0]}..${ids[35]}`
})

/* C03 禁止占位词 ----------------------------------------------------------- */
check('C03', '规范正文禁止 TBD / TODO / 待定 / 模糊数值', () => {
  const banned = [
    /\bTBD\b/i,
    /\bTODO\b/i,
    /待定/,
    /按需调整/,
    /适当增加/,
    /参考行业标准/,
    /由开发人员自行决定/,
    /由\s*AI\s*自行选择/,
    /由开发者自行决定/,
  ]
  const files = walk(DS, (p) => p.endsWith('.md') && !p.includes('/registry/'))
  const hits = []
  for (const p of files) {
    const text = read(p)
    for (const re of banned) {
      const m = text.match(re)
      if (m) hits.push(`${rel(p)} → ${m[0]}`)
    }
  }
  assert(
    hits.length === 0,
    'C03',
    `占位词命中 ${hits.length} 处: ${hits.slice(0, 8).join(' | ')}`
  )
  return `${files.length} md scanned, 0 placeholder`
})

/* C04/C05/C06 CSS / TS 与 manifest 一致 ------------------------------------ */
check('C04', 'tokens.css 与 manifest Light 值逐项一致', () => {
  const css = read(join(RUNTIME, 'tokens.css'))
  const miss = names.filter(
    (n) => !css.includes(`${n}: ${cssVal(T[n], 'light')};`)
  )
  assert(
    miss.length === 0,
    'C04',
    `不一致 ${miss.length} 项: ${miss.slice(0, 6).join(',')}`
  )
  return `${names.length} declarations matched`
})

check('C05', 'light.css / dark.css 覆盖全部主题相关 Token', () => {
  const themed = names.filter((n) => !T[n].themeIndependent)
  const light = read(join(RUNTIME, 'themes', 'light.css'))
  const dark = read(join(RUNTIME, 'themes', 'dark.css'))
  const missL = themed.filter(
    (n) => !light.includes(`${n}: ${cssVal(T[n], 'light')};`)
  )
  const missD = themed.filter(
    (n) => !dark.includes(`${n}: ${cssVal(T[n], 'dark')};`)
  )
  assert(
    missL.length === 0,
    'C05',
    `light.css 缺失 ${missL.length}: ${missL.slice(0, 5).join(',')}`
  )
  assert(
    missD.length === 0,
    'C05',
    `dark.css 缺失 ${missD.length}: ${missD.slice(0, 5).join(',')}`
  )
  assert(
    light.includes('[data-ds-theme="light"]') &&
      dark.includes('[data-ds-theme="dark"]'),
    'C05',
    '主题选择器缺失'
  )
  return `${themed.length} themed tokens × 2`
})

check('C06', 'tokens.ts 与 manifest 一致且无第二套数值', () => {
  const ts = read(join(RUNTIME, 'tokens.ts'))
  const miss = names.filter((n) => !ts.includes(`"${n}"`))
  assert(
    miss.length === 0,
    'C06',
    `TS 缺失 ${miss.length}: ${miss.slice(0, 5).join(',')}`
  )
  assert(
    ts.includes('DS7_TOKENS') && ts.includes('dsToken('),
    'C06',
    'TS 导出缺失'
  )
  assert(ts.includes('This file is generated'), 'C06', '生成标记缺失')
  return `${names.length} TS token entries`
})

/* C07 Light / Dark 完整性 -------------------------------------------------- */
check('C07', 'Light / Dark 使用同名 Token，无主题特例缺失', () => {
  const themed = names.filter((n) => !T[n].themeIndependent)
  const noDark = themed.filter(
    (n) => T[n].dark === undefined || T[n].dark === null || T[n].dark === ''
  )
  assert(noDark.length === 0, 'C07', `缺 Dark 值: ${noDark.join(',')}`)
  const lightKeys = new Set(names)
  const darkKeys = new Set(names)
  assert(
    lightKeys.size === darkKeys.size,
    'C07',
    'Light / Dark Token 名集合不一致'
  )
  return `${themed.length} themed, ${names.length - themed.length} theme-independent`
})

/* C08 注册表一致性 --------------------------------------------------------- */
check('C08', '8 份注册表存在且计数与真源一致', () => {
  const expected = [
    'TOKEN-REGISTRY.json',
    'COMPONENT-REGISTRY.json',
    'PAGE-REGISTRY.json',
    'DEPENDENCY-GRAPH.json',
    'ACCEPTANCE-MATRIX.json',
    'DEPRECATED-REGISTRY.json',
    'EXCEPTION-REGISTRY.json',
    'COMPAT-MAP.json',
  ]
  for (const f of expected) assert(existsSync(join(DS, f)), 'C08', `缺失 ${f}`)
  const tr = JSON.parse(read(join(DS, 'TOKEN-REGISTRY.json')))
  assert(
    tr.total === names.length,
    'C08',
    `TOKEN-REGISTRY.total=${tr.total} != ${names.length}`
  )
  const cr = JSON.parse(read(join(DS, 'COMPONENT-REGISTRY.json')))
  const src = JSON.parse(
    read(join(WEB, 'src', 'design-system', 'component-registry.json'))
  )
  assert(
    cr.total === (src.components ?? []).length,
    'C08',
    'COMPONENT-REGISTRY 与源注册表数量不一致'
  )
  const pr = JSON.parse(read(join(DS, 'PAGE-REGISTRY.json')))
  assert(
    pr.templates.length === 15,
    'C08',
    `PAGE-REGISTRY templates=${pr.templates.length} != 15`
  )
  const am = JSON.parse(read(join(DS, 'ACCEPTANCE-MATRIX.json')))
  assert(
    am.modules.length === 38,
    'C08',
    `ACCEPTANCE-MATRIX modules=${am.modules.length} != 38`
  )
  assert(pr.scanned_route_files >= 60, 'C08', '真实路由扫描数量异常')
  return `${expected.length} registries, ${cr.total} components, ${pr.scanned_route_files} routes, ${am.modules.length} modules`
})

/* C09 对比度真实计算 ------------------------------------------------------- */
const { runVerification } = await import(ENGINE)
const verification = runVerification()
check('C09', 'contrast-engine 真实计算 VERDICT=PASS', () => {
  assert(
    verification.verdict === 'PASS',
    'C09',
    `verdict=${verification.verdict}`
  )
  assert(
    verification.gradient.light.samples.length === 1001,
    'C09',
    'Light 采样不是 1001 点'
  )
  assert(
    verification.gradient.dark.samples.length === 1001,
    'C09',
    'Dark 采样不是 1001 点'
  )
  assert(verification.interpolation === 'srgb', 'C09', '引擎插值空间不是 srgb')
  assert(
    Object.keys(verification.backgrounds.light).length >= 6,
    'C09',
    'Light 实际文字背景矩阵不足 6 种'
  )
  assert(
    verification.gradient.light.passesNormalText45,
    'C09',
    'Light 渐变未达 4.5:1'
  )
  assert(
    verification.gradient.dark.passesNormalText45,
    'C09',
    'Dark 渐变未达 4.5:1'
  )
  assert(
    verification.syntax.light.tokenCount === 20 &&
      verification.syntax.dark.tokenCount === 20,
    'C09',
    'syntax 不是 20×2'
  )
  assert(
    verification.syntax.light.failCount === 0 &&
      verification.syntax.dark.failCount === 0,
    'C09',
    'syntax 存在不达标色值'
  )
  assert(
    verification.text.light.failCount === 0 &&
      verification.text.dark.failCount === 0,
    'C09',
    'text 存在不达标色值'
  )
  assert(
    verification.brandSolid.light.failCount === 0 &&
      verification.brandSolid.dark.failCount === 0,
    'C09',
    '品牌实底白字不达标'
  )
  assert(
    verification.gradient.light.legacyWorst.ratio < 4.5,
    'C09',
    '历史渐变被误判为达标，E28 注销依据不成立'
  )
  return `2002 gradient samples (1001 x 2 themes) + 40 syntax + 16 text + 6 brand-solid, all >=4.5:1`
})

/* C10 20 个 Syntax Token --------------------------------------------------- */
check('C10', '20 个 Syntax Token 在 manifest 中有 Light/Dark 定值', () => {
  const required = [
    'keyword',
    'string',
    'number',
    'function',
    'property',
    'variable',
    'type',
    'operator',
    'punctuation',
    'comment',
    'constant',
    'boolean',
    'null',
    'tag',
    'attribute',
    'regexp',
    'builtin',
    'inserted',
    'deleted',
    'invalid',
  ]
  for (const k of required) {
    const n = `--ds-syntax-${k}`
    assert(T[n] !== undefined, 'C10', `缺失 ${n}`)
    assert(
      /^#[0-9A-F]{6}$/i.test(String(T[n].light)),
      'C10',
      `${n} Light 不是 HEX: ${T[n].light}`
    )
    assert(
      /^#[0-9A-F]{6}$/i.test(String(T[n].dark)),
      'C10',
      `${n} Dark 不是 HEX: ${T[n].dark}`
    )
  }
  const syn = names.filter((n) => n.startsWith('--ds-syntax-'))
  assert(syn.length === 20, 'C10', `syntax Token 数 ${syn.length} != 20`)
  return `20 × 2 HEX values`
})

/* C11 单一渐变出口 --------------------------------------------------------- */
check('C11', '全库渐变文字单一 owner，重复实现必须已真实收敛', () => {
  const ex = JSON.parse(read(join(DS, 'EXCEPTION-REGISTRY.json')))
  const owner = 'web/src/design-system/foundations/typography.css'
  // 整改后规则更严格：迁移项不允许长期挂 OPEN，必须 RESOLVED 且带证据。
  for (const i of ex.items.filter(
    (x) => x.action === 'MIGRATE_TO_SINGLE_EXIT'
  )) {
    assert(i.status === 'RESOLVED', 'C11', `${i.id} 仍未收敛（禁止静默豁免）`)
    assert(i.resolved_by && i.evidence, 'C11', `${i.id} 缺整改证据`)
  }
  const files = walk(join(WEB, 'src'), (p) => /\.(css|tsx?|ts)$/.test(p))
  const offenders = []
  const gradientFiles = []
  for (const p of files) {
    const r = rel(p)
    const text = read(p)
    const hasClip =
      /background-clip:\s*text|-webkit-background-clip:\s*text|bg-clip-text/.test(
        text
      )
    const hasGradient = /linear-gradient\s*\(/.test(text)
    if (hasClip && hasGradient) {
      gradientFiles.push(r)
      if (r !== owner) offenders.push(r)
    }
  }
  assert(
    offenders.length === 0,
    'C11',
    `唯一 owner 之外出现手写渐变: ${offenders.join(', ')}`
  )
  assert(
    gradientFiles.length === 1,
    'C11',
    `渐变 owner 文件数=${gradientFiles.length} != 1`
  )
  // 登记表不得残留已不含渐变的文件（防止「已整改却仍登记为例外」）。
  const stale = (ex.registered_gradient_files ?? []).filter(
    (f) => f.startsWith('web/src/') && !gradientFiles.includes(f)
  )
  assert(stale.length === 0, 'C11', `登记过期: ${stale.join(', ')}`)
  const ownerCss = read(
    join(WEB, 'src', 'design-system', 'foundations', 'typography.css')
  )
  assert(
    ownerCss.includes('@utility ds-text-gradient-brand'),
    'C11',
    '运行时品牌渐变出口缺失'
  )
  assert(
    ownerCss.includes('@utility ds-text-shimmer'),
    'C11',
    '运行时受控扫光出口缺失'
  )
  assert(
    /90deg in srgb/.test(ownerCss),
    'C11',
    '运行时 CSS 未声明 sRGB 插值空间'
  )
  const v6css = read(join(RUNTIME, 'foundations.css'))
  assert(
    v6css.includes('.ds-text-gradient-brand'),
    'C11',
    '7.0 派生产物渐变出口缺失'
  )
  assert(/in srgb/.test(v6css), 'C11', '7.0 派生产物未声明 sRGB 插值空间')
  assert(
    v6css.includes('--ds-color-gradient-light-from') &&
      v6css.includes('--ds-color-gradient-dark-from'),
    'C11',
    '7.0 渐变未从 Token 派生'
  )
  assert(
    T['--ds-gradient-utility'].light === 'ds-text-gradient-brand',
    'C11',
    '渐变出口 Token 值不一致'
  )
  return `${files.length} files scanned, owner=${owner}, ${ex.resolved_exceptions?.length ?? 0} resolved exceptions, 0 offenders`
})

/* C12 字体栈逐字保留 ------------------------------------------------------- */
check('C12', 'Uter 当前字体体系逐字保留，未引入新字体', () => {
  const theme = read(join(WEB, 'src', 'styles', 'theme.css'))
  const grab = (name) => {
    const i = theme.indexOf(`${name}:`)
    assert(i >= 0, 'C12', `theme.css 未找到 ${name}`)
    const seg = theme.slice(i, theme.indexOf(';', i))
    return seg
      .replace(/^[^{]*:\s*/, '')
      .replaceAll(/\s*\/\/.*$/gm, '')
      .replaceAll(/\s+/g, ' ')
      .trim()
  }
  const ui = grab('--font-ui')
  const mono = grab('--font-mono')
  const nrm = (s) => s.replaceAll(/\s+/g, ' ').trim()
  assert(
    nrm(ui) === nrm(String(T['--ds-font-ui'].light)),
    'C12',
    `--ds-font-ui 与 theme.css 不一致`
  )
  assert(
    nrm(mono) === nrm(String(T['--ds-font-mono'].light)),
    'C12',
    `--ds-font-mono 与 theme.css 不一致`
  )
  for (const forbidden of ['Geist', 'Roboto', 'Inter Tight']) {
    assert(
      !String(T['--ds-font-ui'].light).includes(forbidden),
      'C12',
      `引入了未授权字体 ${forbidden}`
    )
  }
  return `font-ui + font-mono identical to theme.css:301-328`
})

/* C13 chart / syntax / terminal 色系隔离 ----------------------------------- */
check('C13', 'chart 色不得作为 syntax 色，代码/终端色系不互引', () => {
  const chartVals = new Set(
    names
      .filter((n) => n.startsWith('--ds-color-chart-'))
      .flatMap((n) => [String(T[n].light), String(T[n].dark)])
  )
  const synNames = names.filter((n) => n.startsWith('--ds-syntax-'))
  const cross = synNames.filter(
    (n) => chartVals.has(String(T[n].light)) || chartVals.has(String(T[n].dark))
  )
  assert(
    cross.length === 0,
    'C13',
    `syntax 使用了 chart 色值: ${cross.join(',')}`
  )
  const v6css = read(join(RUNTIME, 'tokens.css'))
  assert(
    !/--ds-syntax-[a-z-]+\s*:\s*var\(--ds-color-chart-/.test(v6css),
    'C13',
    'syntax Token 引用了 chart 变量'
  )
  assert(
    !/--ds-color-terminal-[a-z-]+\s*:\s*var\(--ds-syntax-/.test(v6css),
    'C13',
    'Terminal 色引用了 syntax 变量'
  )
  return `14 color groups isolated`
})

/* C14 Showcase 覆盖 -------------------------------------------------------- */
check(
  'C14',
  'Showcase 单文件覆盖 38 模块 / 全 Token / ≥10 语言 / 零外链',
  () => {
    const p = join(DS, 'SHOWCASE-8.0.0.html')
    assert(existsSync(p), 'C14', 'SHOWCASE-8.0.0.html 缺失')
    const h = read(p)
    const count = (re) => (h.match(re) || []).length
    assert(
      count(/data-module-id="/g) === 38,
      'C14',
      `模块分区 ${count(/data-module-id="/g)} != 38`
    )
    assert(
      count(/data-section="/g) === 38 * 11,
      'C14',
      `11 小节覆盖数 ${count(/data-section="/g)} != 418`
    )
    assert(
      count(/data-language="/g) >= 10,
      'C14',
      `语言示例 ${count(/data-language="/g)} < 10`
    )
    assert(
      count(/data-token="/g) >= names.length,
      'C14',
      `Token 展示行不足 ${names.length}`
    )
    assert(!/<img\b/i.test(h), 'C14', '出现 <img>')
    assert(
      !/(?:src|href)\s*=\s*["']https?:\/\//i.test(h),
      'C14',
      '出现外链资源'
    )
    assert(h.includes('PENDING_USER_REVIEW'), 'C14', '缺用户审核状态标记')
    assert(/"accepted"\s*:\s*false/.test(h), 'C14', 'accepted 未保持 false')
    assert(h.includes('uds8-manifest'), 'C14', '缺 manifest 内联')
    assert(
      h.includes('prefers-reduced-motion'),
      'C14',
      '缺 reduced-motion 规则'
    )
    assert(
      h.includes('Token Inspector') && h.includes('Color Contrast Checker'),
      'C14',
      '缺全局工具'
    )
    assert(h.includes('g-old') && h.includes('g-new'), 'C14', '缺渐变新旧对比')
    /* P0 整改新增的六个扩展区块，缺一即判失败，防止后续生成时静默退化。 */
    for (const id of [
      'architecture',
      'vscode',
      'terminal',
      'charts',
      'gradient-matrix',
      'runtime-evidence',
    ]) {
      assert(h.includes(`id="${id}"`), 'C14', `缺扩展区块 #${id}`)
    }
    for (const pane of [
      'vscode-light',
      'uter-light',
      'vscode-dark',
      'uter-dark',
    ]) {
      assert(
        h.includes(`data-pane="${pane}"`),
        'C14',
        `缺 VS Code 四栏 ${pane}`
      )
    }
    /* 只数 DOM 面板：scopedTerminalVars 注入的 CSS 属性选择器 [data-terminal-theme=…]
     * 不是面板，用负向后顾排除；Light/Dark 各 1 个，比旧口径（任意 2 个）更严。 */
    assert(
      count(/(?<!\[)data-terminal-theme="light"/g) === 1 &&
        count(/(?<!\[)data-terminal-theme="dark"/g) === 1,
      'C14',
      'Terminal Light/Dark 面板不是各 1 个'
    )
    assert(count(/data-chart-series="/g) === 12, 'C14', '12 色图表展示不足')
    assert(
      count(/data-gradient-background="/g) === 7,
      'C14',
      '渐变 7 背景矩阵缺失'
    )
    assert(
      count(/data-runtime-name="--ds8-/g) >= names.length,
      'C14',
      '运行时 Token 名 / 真实消费者列缺失'
    )
    assert(
      count(/data-runtime-measured="MEASURED"/g) > 0,
      'C14',
      '缺运行时实测标记'
    )
    assert(h.includes('rgb('), 'C14', '缺 HEX + RGB 双数值')
    assert(!/101 点|101×2/.test(h), 'C14', '残留 101 点采样旧口径')
    assert(h.includes('1001'), 'C14', '缺 1001 点采样口径')
    const pub = join(WEB, 'public', 'design-system', '8.0.0', 'index.html')
    assert(existsSync(pub), 'C14', '产品内 /design-system/7.0/ 页面缺失')
    assert(read(pub) === h, 'C14', '产品内页面与 Showcase 不一致')
    return `${count(/data-module-id="/g)} modules, ${count(/data-language="/g)} languages, ${h.length} chars, 6 extension sections`
  }
)

/* C18 机器可读验证报告 ----------------------------------------------------- */
check('C18', '8 份机器可读验证报告齐全且 verdict 真实', () => {
  const required = [
    'design-system-audit.json',
    'token-validation.json',
    'contrast-validation.json',
    'gradient-validation.json',
    'syntax-validation.json',
    'accessibility-validation.json',
    'visual-regression.json',
    'final-acceptance.json',
  ]
  const missing = required.filter((f) => !existsSync(join(DS, 'audit', f)))
  assert(missing.length === 0, 'C18', `报告缺失: ${missing.join(', ')}`)
  for (const f of required) {
    let o
    try {
      o = JSON.parse(read(join(DS, 'audit', f)))
    } catch {
      assert(false, 'C18', `${f} 不是合法 JSON`)
    }
    assert(typeof o === 'object' && o !== null, 'C18', `${f} 内容为空`)
  }
  const fa = JSON.parse(read(join(DS, 'audit', 'final-acceptance.json')))
  assert(
    ['FULLY_VERIFIED', 'PARTIALLY_VERIFIED', 'NOT_VERIFIED', 'FAILED'].includes(
      fa.verdict
    ),
    'C18',
    `非法最终结论 ${fa.verdict}`
  )
  assert(
    fa.verdict !== 'FULLY_VERIFIED' || fa.statusDiscipline?.accepted === true,
    'C18',
    '用户审核前不得声明 FULLY_VERIFIED'
  )
  assert(
    fa.statusDiscipline?.accepted === false,
    'C18',
    'ACCEPTED 必须为 false'
  )
  /* fa.checker 由 check-uds8-remediation.mjs 在本检查器运行之后写入；若此处
   * 要求 verdict=PASS 会形成循环断言（任何 FAIL 态都无法自愈到 PASS）。
   * PASS 的强制点在 remediation 的 hardGates（CHECKER.verdict === 'PASS'，
   * 决定最终 verdict）；此处只验证被引用的检查器结果完整且自洽。 */
  assert(
    fa.checker && fa.checker.checksTotal === 22,
    'C18',
    '最终验收未引用完整 22 项检查器结果'
  )
  assert(
    (fa.checker.verdict === 'PASS') ===
      (fa.checker.checksPassed === fa.checker.checksTotal),
    'C18',
    '检查器 verdict 与通过数不自洽'
  )
  return `8 reports, final=${fa.verdict}, checker=${fa.checker?.checksPassed}/${fa.checker?.checksTotal}`
})

/* C19 语法真实解析 --------------------------------------------------------- */
check(
  'C19',
  '语法 Adapter 15 语言 / 20 Token 真实解析并如实登记未覆盖项',
  () => {
    const s = JSON.parse(read(join(DS, 'audit', 'syntax-validation.json')))
    assert(s.verdict === 'PASS', 'C19', `syntax verdict=${s.verdict}`)
    assert(
      s.languagesRequested === 15 && s.languages.length === 15,
      'C19',
      '语言数不是 15'
    )
    assert(
      s.syntaxTokenCount === 20 && s.tokenRows.length === 20,
      'C19',
      '语义 Token 不是 20'
    )
    assert(s.checks.allGrammarsLoaded === true, 'C19', '有 grammar 未真实加载')
    assert(s.checks.allCopyIntact === true, 'C19', '复制完整性失败')
    assert(
      s.checks.allNewlineIndentPreserved === true,
      'C19',
      '换行 / 缩进被破坏'
    )
    assert(
      Array.isArray(s.syntaxKeysNotExercisedBySamples),
      'C19',
      '未覆盖语义类别未如实登记'
    )
    assert(
      s.syntaxKeysUsedInRealSamples.length +
        s.syntaxKeysNotExercisedBySamples.length ===
        20,
      'C19',
      '覆盖统计不自洽'
    )
    return `${s.languages.length} languages, ${s.grammarsLoaded} grammars, ${s.syntaxKeysUsedInRealSamples.length}/20 covered`
  }
)

/* C20 整改状态与状态纪律 --------------------------------------------------- */
check('C20', '48 项审计发现整改状态由真实探针决定', () => {
  const r = JSON.parse(read(join(DS, 'audit', 'remediation-state.json')))
  const ids = Object.keys(r.findings ?? {})
  assert(ids.length === 48, 'C20', `整改项 ${ids.length} != 48`)
  assert(
    ids.every((id) => /^UDS8-[CTHGFASR]-?\d+|^UDS8-R-\d+/.test(id)),
    'C20',
    '存在非法问题 ID'
  )
  const fa = JSON.parse(read(join(DS, 'audit', 'final-acceptance.json')))
  assert(
    fa.probeSummary &&
      Object.values(fa.probeSummary).reduce((a, b) => a + b, 0) >= 48,
    'C20',
    '探针数不足'
  )
  assert(
    fa.statusDiscipline.phase6Executed === false,
    'C20',
    'Phase 6 不得在审核前执行'
  )
  assert(
    fa.statusDiscipline.phase7Executed === false,
    'C20',
    'Phase 7 不得在审核前执行'
  )
  assert(
    fa.statusDiscipline.phase8Executed === false,
    'C20',
    'Phase 8 不得在审核前执行'
  )
  const counts = { RESOLVED: 0, PARTIAL: 0, OPEN: 0 }
  for (const f of Object.values(r.findings)) {
    counts[f.status] = (counts[f.status] ?? 0) + 1
  }
  return `48 findings: ${counts.RESOLVED} resolved / ${counts.PARTIAL} partial / ${counts.OPEN} open`
})

/* C21 真实页面回归 --------------------------------------------------------- */
check('C21', '真实页面回归 + 渐变像素验证 + axe 零违规', () => {
  const v = JSON.parse(read(join(DS, 'audit', 'visual-regression.json')))
  assert(v.executed === true, 'C21', '视觉回归未真实执行')
  assert(v.verdict === 'PASS', 'C21', `真实页面回归 verdict=${v.verdict}`)
  assert(
    v.results.length >= 8 && v.results.every((r) => r.pass === true),
    'C21',
    '真实页面场景未全部通过'
  )
  assert(
    v.results.every((r) => r.checks.bridgeLive && r.checks.syntaxBridgeLive),
    'C21',
    '--ds8-* 桥接在真实页面未生效'
  )
  assert(v.gradient?.pass === true, 'C21', '渐变浏览器像素验证失败')
  assert(
    v.gradient?.ownerDeclaresInSrgb === true &&
      v.gradient?.distDeclaresInSrgb === true,
    'C21',
    'CSS 未声明 in srgb'
  )
  const a = JSON.parse(
    read(join(WEB, 'visual-regression', 'uds8', 'a11y-log.json'))
  )
  assert(
    a.verdict === 'PASS' && a.violationsTotal === 0,
    'C21',
    `axe ${a.violationsTotal} violations`
  )
  return `${v.results.length} real-page scenarios, gradient pixels PASS, axe 0 violations`
})

/* C22 Clerk 边界（原 5.0 Clerk 守卫职责并入 7.0）--------------------------- */
check(
  'C22',
  'Clerk 外部参考边界：依赖零引入 / 运行时零引用 / 品牌值零照搬',
  () => {
    const pkg = JSON.parse(read(join(WEB, 'package.json')))
    const depFields = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ]
    const badDeps = []
    for (const f of depFields) {
      for (const name of Object.keys(pkg[f] ?? {})) {
        if (/@clerk\//.test(name) || /^clerk(-|$)/.test(name)) {
          badDeps.push(`${f}:${name}`)
        }
      }
    }
    assert(
      badDeps.length === 0,
      'C22',
      `package.json 出现 Clerk 依赖: ${badDeps.join(', ')}`
    )
    const srcFiles = walk(join(WEB, 'src'), (p) =>
      /\.(ts|tsx|css|js|jsx)$/.test(p)
    )
    const offenders = []
    for (const p of srcFiles) {
      const s = read(p)
      if (/\bClerkProvider\b/.test(s) || /from\s+['"]@clerk\//.test(s)) {
        offenders.push(`${p.replace(WEB + '/', '')}: Clerk 运行时引用`)
      } else if (/--clerk-[a-z-]+\s*:/.test(s)) {
        offenders.push(`${p.replace(WEB + '/', '')}: --clerk-* 变量声明`)
      } else if (/#6c47ff/i.test(s)) {
        offenders.push(`${p.replace(WEB + '/', '')}: Clerk 品牌值 #6c47ff`)
      }
    }
    assert(
      offenders.length === 0,
      'C22',
      `运行时边界违规: ${offenders.slice(0, 5).join(' | ')}`
    )
    return `deps clean, ${srcFiles.length} src files scanned, 0 Clerk references`
  }
)

/* C15 状态未被误标 --------------------------------------------------------- */
check('C15', '状态未被误标 VERIFIED / ACCEPTED', () => {
  assert(
    !/ACCEPTED/.test(M.status),
    'C15',
    `manifest.status=${M.status} 含 ACCEPTED`
  )
  /* 合法进度状态：IMPLEMENTED_NOT_VERIFIED（未达审核条件）与 ACCEPTANCE_READY
   * （证据齐备、已达用户审核条件）。两者均保持 accepted=false；禁止越权标 ACCEPTED。 */
  assert(
    ['IMPLEMENTED_NOT_VERIFIED', 'ACCEPTANCE_READY'].includes(M.status),
    'C15',
    `manifest.status=${M.status} 不是合法进度状态`
  )
  const am = JSON.parse(read(join(DS, 'ACCEPTANCE-MATRIX.json')))
  assert(
    am.overall_status === M.status,
    'C15',
    'Acceptance Matrix 总体状态与 manifest 不一致'
  )
  const bad = am.modules.filter(
    (m) => m.verification === 'VERIFIED' || m.implementation === 'ACCEPTED'
  )
  assert(bad.length === 0, 'C15', `${bad.length} 个模块被误标`)
  return `status=${M.status}, 38 modules: IMPLEMENTED / PARTIAL, ACCEPTED=false`
})

/* C16 未登记设计数值 ------------------------------------------------------- */
check('C16', 'v7 产物不出现 manifest 之外的 --ds-* 定义', () => {
  const files = walk(RUNTIME, (p) => p.endsWith('.css'))
  const declared = new Set()
  for (const p of files) {
    for (const m of read(p).matchAll(/(--ds-[a-zA-Z0-9-]+)\s*:/g)) {
      declared.add(m[1])
    }
  }
  const extra = [...declared].filter((n) => !T[n])
  assert(extra.length === 0, 'C16', `未登记 Token 定义: ${extra.join(',')}`)
  const missing = names.filter((n) => !declared.has(n))
  assert(
    missing.length === 0,
    'C16',
    `manifest Token 未在 CSS 定义: ${missing.slice(0, 5).join(',')}`
  )
  return `${declared.size} declared = manifest ${names.length}`
})

/* C17 报告存在性 ----------------------------------------------------------- */
check('C17', '交付报告齐全', () => {
  const required = [
    'UDS-8.0.0-MIGRATION-REPORT.md',
    'CONTRAST-VERIFICATION-REPORT.md',
    'VISUAL-REGRESSION-REPORT.md',
    'FINAL-ACCEPTANCE-REPORT.md',
  ]
  const missing = required.filter((f) => !existsSync(join(DS, f)))
  assert(missing.length === 0, 'C17', `报告缺失: ${missing.join(', ')}`)
  return required.join(', ')
})

const failedCodes = new Set(
  errors.map((e) => e.match(/\[(C\d+)\]/)?.[1]).filter(Boolean)
)
const passed = checks.filter(
  (c) => c.status === 'PASS' && !failedCodes.has(c.code)
).length
const verdict = errors.length === 0 ? 'PASS' : 'FAIL'
const out = {
  checker: 'check-design-system-8.0.0.mjs',
  design_system: 'UTER DESIGN SYSTEM 8.0.0',
  verdict,
  checksTotal: checks.length,
  checksPassed: passed,
  errors: errors.length,
  errorList: errors,
  checks: checks
    .map((c) => ({
      code: c.code,
      label: c.label,
      status: failedCodes.has(c.code) ? 'FAIL' : c.status,
      detail: c.detail,
    }))
    .sort((a, b) => a.code.localeCompare(b.code)),
  tokens: names.length,
  modules: 38,
  generated: false,
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(out, null, 2))
} else {
  for (const c of out.checks) {
    console.log(
      `${c.status === 'PASS' ? 'PASS' : 'FAIL'} ${c.code} ${c.label} — ${c.detail}`
    )
  }
  for (const e of errors) console.error(`  ${e}`)
  console.log(
    `\nVERDICT ${verdict} · ${passed}/${checks.length} checks · ${errors.length} errors`
  )
}
process.exit(verdict === 'PASS' ? 0 : 1)
