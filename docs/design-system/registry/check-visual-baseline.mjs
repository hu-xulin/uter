/**
 * UDS 7.0 — 视觉基线校验（G19）
 *
 * 校验当前真实渲染是否仍与冻结视觉基线（VISUAL-BASELINE.json）一致：
 *   1) 基线完整性：VISUAL-BASELINE.json 存在、每场景冻结副本存在且 SHA256 吻合；
 *   2) 当前日志（visual-check.mjs + real-page-regression.mjs 最新一轮）必须为真实 PASS；
 *   3) 逐场景对比：当前截图与冻结副本字节一致 → PASS；
 *      字节不一致 → 用 Playwright canvas 做逐像素通道差（|Δ|>8 计入），
 *      差异比例 ≤ 该 kind 阈值（见 baseline.policy.pixelDiffThresholds）→ PASS，否则 FAIL。
 *
 * 退出码：0 全部一致；1 存在漂移；2 BLOCKED（基线 / 日志 / 截图缺失，绝不报 PASS）
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const DS = fileURLToPath(new URL('..', import.meta.url))
const REPO = join(DS, '..', '..')
const WEB = join(REPO, 'web')
const AUDIT = join(DS, 'audit')
const BASELINE = join(DS, 'VISUAL-BASELINE.json')
const SHOWCASE_LOG = join(WEB, 'visual-regression', 'uds7', 'run-log.json')
const REALPAGE_LOG = join(AUDIT, 'visual-regression.json')
const OUT = join(AUDIT, 'visual-baseline-check.json')
const PLAYWRIGHT = join(WEB, 'node_modules', 'playwright', 'index.mjs')

const sha = (buf) => createHash('sha256').update(buf).digest('hex')
const j = (p) => JSON.parse(readFileSync(p, 'utf8'))
const writeJson = (o) => { mkdirSync(AUDIT, { recursive: true }); writeFileSync(OUT, JSON.stringify(o, null, 2) + '\n') }
const finish = (code, verdict, payload) => {
  writeJson({ schema: 'UDS7-VISUAL-BASELINE-CHECK/1.0', generated_at: new Date().toISOString(), verdict, executed: code !== 2, ...payload })
  console.log('[UDS7-BASELINE-CHECK]', verdict, payload.summary ?? '')
  process.exit(code)
}

if (!existsSync(BASELINE)) finish(2, 'BLOCKED', { reason: 'VISUAL-BASELINE.json 缺失：先运行 registry/freeze-baseline.mjs' })
if (!existsSync(SHOWCASE_LOG) || !existsSync(REALPAGE_LOG)) finish(2, 'BLOCKED', { reason: '当前视觉日志缺失：先运行 visual-check.mjs 与 real-page-regression.mjs' })
if (!existsSync(PLAYWRIGHT)) finish(2, 'BLOCKED', { reason: 'Playwright 缺失，无法做像素差比对' })

const B = j(BASELINE)
const showcaseLog = j(SHOWCASE_LOG)
const realPageLog = j(REALPAGE_LOG)
if (B.status !== 'FROZEN') finish(2, 'BLOCKED', { reason: '基线 status != FROZEN' })
if (showcaseLog.verdict !== 'PASS' || realPageLog.verdict !== 'PASS' || realPageLog.executed !== true) {
  finish(1, 'FAIL', { reason: '当前日志非 PASS：showcase=' + showcaseLog.verdict + ' realPage=' + realPageLog.verdict, summary: '前置运行未通过' })
}

/* 基线完整性：冻结副本必须存在且字节与登记 SHA256 完全一致 */
for (const s of B.scenarios ?? []) {
  const p = join(REPO, s.frozenPath)
  if (!existsSync(p)) finish(2, 'BLOCKED', { reason: '冻结副本缺失：' + s.frozenPath })
  if (sha(readFileSync(p)) !== s.sha256) finish(2, 'BLOCKED', { reason: '冻结副本 SHA256 不符（基线被篡改或损坏）：' + s.frozenPath })
}

const { chromium } = await import(pathToFileURL(PLAYWRIGHT).href)
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 300, height: 300 } })

async function pixelDiff(bufA, bufB) {
  return page.evaluate(async ([a, b]) => {
    const load = (d) => new Promise((res, rej) => {
      const img = new Image()
      img.onload = () => res(img)
      img.onerror = rej
      img.src = 'data:image/png;base64,' + d
    })
    const [ia, ib] = await Promise.all([load(a), load(b)])
    if (ia.naturalWidth !== ib.naturalWidth || ia.naturalHeight !== ib.naturalHeight) {
      return { dimensionMismatch: true, a: [ia.naturalWidth, ia.naturalHeight], b: [ib.naturalWidth, ib.naturalHeight] }
    }
    const c = document.createElement('canvas')
    c.width = ia.naturalWidth; c.height = ia.naturalHeight
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(ia, 0, 0)
    const da = ctx.getImageData(0, 0, c.width, c.height).data
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.drawImage(ib, 0, 0)
    const db = ctx.getImageData(0, 0, c.width, c.height).data
    let diff = 0, sum = 0, n = 0
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]))
      sum += d
      if (d > 8) diff++
      n++
    }
    return { pixels: n, diffPixels: diff, diffRatio: n ? diff / n : 0, meanAbsDiff: n ? sum / n : 0, dimensionMismatch: false }
  }, [bufA.toString('base64'), bufB.toString('base64')])
}

const results = []
let failed = 0
for (const s of B.scenarios) {
  const currentAbs = join(REPO, s.originalPath)
  if (!existsSync(currentAbs)) {
    results.push({ id: s.id, verdict: 'FAIL', reason: '当前截图缺失：' + s.originalPath })
    failed++
    continue
  }
  const cur = readFileSync(currentAbs)
  const curSha = sha(cur)
  const entry = { id: s.id, kind: s.kind, frozenSha256: s.sha256, currentSha256: curSha, byteIdentical: curSha === s.sha256 }
  if (entry.byteIdentical) {
    entry.verdict = 'PASS'
  } else {
    const d = await pixelDiff(readFileSync(join(REPO, s.frozenPath)), cur)
    const threshold = B.policy?.pixelDiffThresholds?.[s.kind] ?? 0.02
    entry.pixelDiff = d
    entry.threshold = threshold
    entry.verdict = d.dimensionMismatch ? 'FAIL' : (d.diffRatio <= threshold ? 'PASS' : 'FAIL')
    entry.reason = d.dimensionMismatch
      ? `尺寸不一致 frozen=${d.a} current=${d.b}`
      : `字节不同；像素差 ${d.diffPixels}/${d.pixels} (${(d.diffRatio * 100).toFixed(3)}%) ${entry.verdict === 'PASS' ? '≤' : '>'} 阈值 ${(threshold * 100).toFixed(2)}%`
  }
  if (entry.verdict !== 'PASS') failed++
  results.push(entry)
}
await browser.close()

const summary = `${results.length} 场景：${results.filter((r) => r.verdict === 'PASS' && r.byteIdentical).length} 字节一致、${results.filter((r) => r.verdict === 'PASS' && !r.byteIdentical).length} 阈值内、${failed} FAIL`
finish(failed ? 1 : 0, failed ? 'FAIL' : 'PASS', { baselineVersion: B.version, frozenAt: B.frozen_at, scenarioCount: results.length, results, summary })
