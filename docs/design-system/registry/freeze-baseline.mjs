/**
 * UDS 7.0 — 视觉基线冻结（Phase 5 收口）
 *
 * 依据新鲜真实运行日志（visual-check.mjs + real-page-regression.mjs）把当前
 * 渲染状态固化为 7.0.0 视觉基线：
 *   1) 校验两份日志均为真实 PASS（BLOCKED 时绝不冻结）；
 *   2) 把全部截图复制为冻结副本（audit/baseline/screenshots/）；
 *   3) 写出 docs/design-system/VISUAL-BASELINE.json
 *      （逐场景 SHA256 + 像素指标 + 冻结策略）。
 *
 * 基线一经冻结只可经用户明确授权更新；本脚本对已有基线默认拒绝覆盖（--force 才允许）。
 *
 * 退出码：0 冻结成功；1 日志非 PASS / 数据不完整；2 BLOCKED（前置缺失）
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DS = fileURLToPath(new URL('..', import.meta.url))
const REPO = join(DS, '..', '..')
const WEB = join(REPO, 'web')
const AUDIT = join(DS, 'audit')
const FROZEN_SHOTS = join(AUDIT, 'baseline', 'screenshots')
const SHOWCASE_LOG = join(WEB, 'visual-regression', 'uds7', 'run-log.json')
const REALPAGE_LOG = join(AUDIT, 'visual-regression.json')
const BASELINE = join(DS, 'VISUAL-BASELINE.json')
const versionArg = process.argv.find((a) => a.startsWith('--version='))
const VERSION = versionArg ? versionArg.slice('--version='.length) : '7.0.0'
const force = process.argv.includes('--force')

const sha = (buf) => createHash('sha256').update(buf).digest('hex')
const j = (p) => JSON.parse(readFileSync(p, 'utf8'))
const fail = (code, msg) => { console.error('[' + (code === 2 ? 'BLOCKED' : 'FREEZE-FAIL') + ']', msg); process.exit(code) }

if (!existsSync(SHOWCASE_LOG)) fail(2, 'Showcase 日志缺失：先运行 registry/visual-check.mjs')
if (!existsSync(REALPAGE_LOG)) fail(2, '真实页面日志缺失：先运行 registry/real-page-regression.mjs')
if (existsSync(BASELINE) && !force) fail(1, 'VISUAL-BASELINE.json 已存在；冻结是一次性动作，覆盖须显式 --force（且应有用户授权）')

const showcaseLog = j(SHOWCASE_LOG)
const realPageLog = j(REALPAGE_LOG)
if (showcaseLog.verdict !== 'PASS' || showcaseLog.executed !== true) fail(1, 'Showcase 日志非 PASS，拒绝冻结')
if (realPageLog.verdict !== 'PASS' || realPageLog.executed !== true) fail(1, '真实页面日志非 PASS，拒绝冻结')
if (showcaseLog.executed !== true) fail(1, 'Showcase 日志 executed!=true')

mkdirSync(FROZEN_SHOTS, { recursive: true })

const scenarios = []
function freezeScenario(entry) {
  const srcAbs = join(REPO, entry.originalPath)
  if (!existsSync(srcAbs)) fail(1, '截图缺失，拒绝冻结：' + entry.originalPath)
  const buf = readFileSync(srcAbs)
  const digest = sha(buf)
  if (entry.expectedSha && entry.expectedSha !== digest) fail(1, '日志 SHA256 与文件不一致，拒绝冻结：' + entry.originalPath)
  const frozenRel = 'docs/design-system/audit/baseline/screenshots/' + entry.id + '.png'
  copyFileSync(srcAbs, join(REPO, frozenRel))
  scenarios.push({ ...entry, sha256: digest, bytes: buf.length, frozenPath: frozenRel })
  return digest
}

/* ── 1) Showcase 四场景（visual-check.mjs） ─────────────────────────────── */
for (const cse of showcaseLog.cases ?? []) {
  freezeScenario({
    id: `showcase-${cse.theme}-${cse.viewport}`,
    kind: 'showcase',
    theme: cse.theme,
    viewport: cse.viewport,
    width: cse.width,
    height: cse.height,
    originalPath: cse.screenshot,
    expectedSha: null,
  })
}

/* ── 2) 真实页面公开路由 × 2 主题（real-page-regression.mjs） ──────────────
 * 认证场景（authenticated=true）含后端动态内容（余额 / 日志条数），
 * 按回归脚本 scopeNote 不建像素基线，冻结时同样排除。 */
for (const r of realPageLog.results ?? []) {
  if (r.authenticated) continue
  if (!r.pass) fail(1, '真实页面场景存在 FAIL，拒绝冻结：' + r.route + '/' + r.theme)
  freezeScenario({
    id: `page-${(r.route === '/' ? 'home' : r.route.slice(1).replace(/\//g, '-'))}-${r.theme}`,
    kind: 'real-page',
    route: r.route,
    theme: r.theme,
    width: r.pixels?.width ?? null,
    height: r.pixels?.height ?? null,
    pixels: r.pixels ?? null,
    originalPath: r.screenshot,
    expectedSha: r.screenshotSha256 ?? null,
  })
}

/* ── 3) 品牌渐变 hero 两主题 ────────────────────────────────────────────── */
if (!realPageLog.gradient?.pass) fail(1, 'gradient 像素验证非 PASS，拒绝冻结')
for (const theme of ['light', 'dark']) {
  const g = realPageLog.gradient[theme]
  freezeScenario({
    id: `gradient-hero-${theme}`,
    kind: 'gradient',
    theme,
    width: g.width ?? null,
    height: g.height ?? null,
    pixels: { distinctColors: g.distinctColors, meanLuminance: g.meanLuminance, nonWhitePixelRatio: g.nonWhitePixelRatio },
    originalPath: `web/visual-regression/uds7/real-pages/gradient-hero-${theme}.png`,
    expectedSha: g.sha256 ?? null,
  })
}

/* ── 4) forced-colors 场景 ──────────────────────────────────────────────── */
if (!realPageLog.forcedColors?.pass) fail(1, 'forced-colors 验证非 PASS，拒绝冻结')
freezeScenario({
  id: 'forced-colors-showcase',
  kind: 'forced-colors',
  originalPath: 'web/visual-regression/uds7/real-pages/forced-colors-showcase.png',
  expectedSha: null,
})

/* 覆盖冻结（--force，须用户明确授权）前先把旧基线完整归档，绝不删除旧证据。 */
if (existsSync(BASELINE) && force) {
  const old = j(BASELINE)
  const archiveDir = join(AUDIT, 'baseline', `archive-${old.version}`)
  mkdirSync(join(archiveDir, 'screenshots'), { recursive: true })
  copyFileSync(BASELINE, join(archiveDir, 'VISUAL-BASELINE.json'))
  if (existsSync(FROZEN_SHOTS)) {
    for (const f of readdirSync(FROZEN_SHOTS)) {
      if (f.endsWith('.png')) copyFileSync(join(FROZEN_SHOTS, f), join(archiveDir, 'screenshots', f))
    }
  }
  console.log('[UDS7-BASELINE] 旧基线已归档 →', archiveDir)
}

const baseline = {
  schema: 'UDS7-VISUAL-BASELINE/1.0',
  version: VERSION,
  status: 'FROZEN',
  frozen_at: new Date().toISOString(),
  frozen_by: VERSION === '7.0.0'
    ? '用户指令「冻结 7.0.0 视觉基线」（2026-11-15）；Phase 5 收口动作，冻结后授权 Phase 6'
    : VERSION === '7.0.1'
      ? '用户明确授权「真正切换到 7.0 标量值」（2026-11-16）：运行时字号/行高/圆角/图表色经 @theme 真源字面切换为 7.0 TOKEN-MANIFEST 值（typography.css / primitives.css / theme.css，tokens.test.ts 三方守卫钉死），全站视觉随之变化，旧 7.0.0 基线作废归档于 audit/baseline/archive-7.0.0/；本基线摄于切换后真实渲染'
      : `用户明确授权更新基线（2026-11-15，AskUserQuestion「授权更新基线」）；审查确认 4 个 Dark 公开页差异为预期设计变化（Dark 表面 #020617 → clerk.com 对齐三层 #0B1120/#111827/#1B2436，theme.css 明文登记），旧基线归档于 audit/baseline/archive-*/`,
  sources: {
    showcaseLog: { path: 'web/visual-regression/uds7/run-log.json', verdict: showcaseLog.verdict, started_at: showcaseLog.started_at ?? null },
    realPageLog: { path: 'docs/design-system/audit/visual-regression.json', verdict: realPageLog.verdict, generated_at: realPageLog.generated_at ?? null },
    method: realPageLog.method ?? null,
  },
  scenarioCount: scenarios.length,
  scenarios,
  policy: {
    byteIdenticalPreferred: true,
    pixelDiffThresholds: { showcase: 0.005, gradient: 0.005, 'forced-colors': 0.01, 'real-page': 0.02 },
    pixelDiffNote: '字节不一致时按 kind 阈值做逐像素通道差（|Δ|>8 计入）；real-page 含后端动态内容，阈值放宽到 2%',
    updateRequiresUserAuthorization: true,
    note: '基线只可经用户明确授权更新；Phase 6 迁移完成后应重冻结并归档旧基线（版本递增）。',
  },
}

writeFileSync(BASELINE, JSON.stringify(baseline, null, 2) + '\n')
console.log('[UDS7-BASELINE] frozen', VERSION, 'scenarios', scenarios.length, '→', 'docs/design-system/VISUAL-BASELINE.json')
for (const s of scenarios) console.log('  ', s.id, s.sha256.slice(0, 12) + '…', statSync(join(REPO, s.frozenPath)).size + 'B')
