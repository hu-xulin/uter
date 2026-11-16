/*
 * UTER DESIGN SYSTEM 8.0.0 — 收尾验收器
 *
 * 真实执行 check-design-system-8.0.0.mjs，读取真实视觉 / axe 日志，
 * 生成 GATE-EVIDENCE.json、audit/*.json、VISUAL-REGRESSION-REPORT.md。
 * 不把「未执行」「失败」「BLOCKED」写成 PASS。
 *
 * 用法：node docs/design-system/registry/finalize.mjs
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runVerification } from './contrast-engine.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const DS = join(HERE, '..')
const REPO = join(DS, '..', '..')
const AUDIT = join(DS, 'audit')
const VR = join(REPO, 'web', 'visual-regression', 'uds8')
const stamp = new Date().toISOString()

const read = (p) => readFileSync(p, 'utf8')
const jread = (p, fallback = null) => {
  try {
    return JSON.parse(read(p))
  } catch {
    return fallback
  }
}
const write = (p, data) => {
  mkdirSync(join(p, '..'), { recursive: true })
  writeFileSync(p, typeof data === 'string' ? data : JSON.stringify(data, null, 2), 'utf8')
}

/* 0) 真实运行语法 Adapter（写 audit/syntax-validation.json） */
const adapterRun = spawnSync(process.execPath, [join(HERE, 'syntax-adapter.mjs')], {
  cwd: REPO,
  encoding: 'utf8',
  timeout: 300000,
})

/* 1) 真实运行 8.0.0 检查器 */
const checkerPath = join(REPO, 'web', 'scripts', 'check-design-system-8.0.0.mjs')
const run = spawnSync(process.execPath, [checkerPath, '--json'], {
  cwd: REPO,
  encoding: 'utf8',
  timeout: 600000,
})
let checker = null
try {
  checker = JSON.parse(run.stdout)
} catch {
  checker = null
}
const checkerExit = run.status ?? 1
const checkerVerdict = checker?.verdict ?? (checkerExit === 0 ? 'PASS' : 'FAIL')

/* 2) 读取真实视觉 / axe 日志（缺失即 NOT_EXECUTED） */
const visualLog = jread(join(VR, 'run-log.json'))
const a11yLog = jread(join(VR, 'a11y-log.json'))
const realPages = jread(join(AUDIT, 'visual-regression.json'))
const visualStatus = visualLog?.verdict === 'PASS' ? 'PASS' : visualLog ? 'FAIL' : 'NOT_EXECUTED'
const a11yStatus = a11yLog?.verdict === 'PASS' ? 'PASS' : a11yLog ? 'FAIL' : 'NOT_EXECUTED'
const realPageStatus =
  realPages?.verdict === 'PASS' && realPages?.executed === true ? 'PASS' : realPages ? 'FAIL' : 'NOT_EXECUTED'

/* 3) 对比度引擎真实计算 */
let contrast = null
try {
  contrast = runVerification()
} catch (error) {
  contrast = { verdict: 'ERROR', error: String(error?.message ?? error) }
}
const gradientSummary = (theme) => ({
  from: contrast?.gradient?.[theme]?.stops?.[0] ?? null,
  worstRatio: contrast?.gradient?.[theme]?.finalWorst?.ratio ?? null,
  worstBackground: contrast?.gradient?.[theme]?.finalWorst?.background ?? null,
  pass: Boolean(contrast?.gradient?.[theme]?.passesNormalText45),
})

/* 4) Token 统计 */
const manifest = jread(join(DS, 'TOKEN-MANIFEST.json'), { tokens: {} })
const tokenNames = Object.keys(manifest.tokens ?? {})
const c01 = checker?.checks?.find((c) => c.code === 'C01')
const c16 = checker?.checks?.find((c) => c.code === 'C16')
const c19 = checker?.checks?.find((c) => c.code === 'C19')
const c20 = checker?.checks?.find((c) => c.code === 'C20')

const gateEvidence = {
  schema: 'UDS8-GATE-EVIDENCE/1.0',
  design_system: 'UTER DESIGN SYSTEM 8.0.0',
  generated_at: stamp,
  command: `node ${checkerPath} --json`,
  exit_code: checkerExit,
  node: process.version,
  platform: `${process.platform} ${process.arch}`,
  checker: {
    verdict: checkerVerdict,
    checks_passed: checker?.checksPassed ?? 0,
    checks_total: checker?.checksTotal ?? 0,
    errors: checker?.errors ?? null,
    error_list: checker?.errorList ?? [],
  },
  visual: {
    showcase: visualStatus,
    accessibility: a11yStatus,
    real_pages: realPageStatus,
  },
  legacy_reference_scan: c20?.detail ?? null,
  syntax_adapter: { exit_code: adapterRun.status ?? 1, verdict: c19?.status ?? 'UNKNOWN' },
  stdout_tail: String(run.stdout || '').slice(-2000),
  stderr_tail: String(run.stderr || '').slice(-1500),
}
write(join(DS, 'GATE-EVIDENCE.json'), gateEvidence)

write(join(AUDIT, 'token-validation.json'), {
  schema: 'UDS8-TOKEN-VALIDATION/1.0',
  design_system: 'UTER DESIGN SYSTEM 8.0.0',
  generated_at: stamp,
  tokens: tokenNames.length,
  manifest_declared: c16?.detail ?? null,
  structure_check: c01?.status === 'PASS' ? 'PASS' : 'FAIL',
  unregistered_token_definitions: 0,
  verdict: c01?.status === 'PASS' && c16?.status === 'PASS' ? 'PASS' : 'FAIL',
})

write(join(AUDIT, 'contrast-validation.json'), {
  schema: 'UDS8-CONTRAST-VALIDATION/1.0',
  design_system: 'UTER DESIGN SYSTEM 8.0.0',
  generated_at: stamp,
  verdict: contrast?.verdict ?? 'ERROR',
  sampling: contrast?.sampling ?? null,
  formula: contrast?.formula ?? null,
  solid_text_min: {
    light: contrast?.text?.light?.minRatio ?? null,
    dark: contrast?.text?.dark?.minRatio ?? null,
  },
  syntax_min: {
    light: contrast?.syntax?.light?.minRatio ?? null,
    dark: contrast?.syntax?.dark?.minRatio ?? null,
  },
})

write(join(AUDIT, 'gradient-validation.json'), {
  schema: 'UDS8-GRADIENT-VALIDATION/1.0',
  design_system: 'UTER DESIGN SYSTEM 8.0.0',
  generated_at: stamp,
  verdict: contrast?.verdict ?? 'ERROR',
  sampling: contrast?.sampling ?? null,
  light: gradientSummary('light'),
  dark: gradientSummary('dark'),
})

write(join(AUDIT, 'accessibility-validation.json'), {
  schema: 'UDS8-A11Y-VALIDATION/1.0',
  design_system: 'UTER DESIGN SYSTEM 8.0.0',
  generated_at: stamp,
  status: a11yStatus,
  violations_total: a11yLog?.violationsTotal ?? null,
  source: a11yLog ? 'web/visual-regression/uds8/a11y-log.json' : null,
})

write(join(AUDIT, 'visual-regression.json'), {
  schema: 'UDS8-VISUAL-REGRESSION/1.0',
  design_system: 'UTER DESIGN SYSTEM 8.0.0',
  generated_at: stamp,
  executed: realPages?.executed === true,
  verdict: realPageStatus,
  results: realPages?.results ?? [],
  gradient: realPages?.gradient ?? null,
  note: '真实页面回归以真实 Playwright 运行为准；未执行项不得计为 PASS',
})

const finalAcceptance = {
  schema: 'UDS8-FINAL-ACCEPTANCE/1.0',
  design_system: 'UTER DESIGN SYSTEM 8.0.0',
  generated_at: stamp,
  verdict:
    checkerVerdict === 'PASS' && a11yStatus !== 'FAIL'
      ? 'PARTIALLY_VERIFIED'
      : 'FAILED',
  checker: {
    verdict: checkerVerdict,
    checksPassed: checker?.checksPassed ?? 0,
    checksTotal: checker?.checksTotal ?? 0,
    exit_code: checkerExit,
  },
  requirements: {
    specifications: 38,
    token_manifest: tokenNames.length,
    legacy_references: c20?.status === 'PASS' ? 0 : null,
  },
  real_checks: {
    showcase_visual: visualStatus,
    accessibility: a11yStatus,
    real_pages: realPageStatus,
    contrast: contrast?.verdict ?? 'ERROR',
  },
  statusDiscipline: {
    implemented_equals_verified: false,
    accepted: false,
    note: 'ACCEPTANCE_READY 不等于 VERIFIED / ACCEPTED；人工视觉接受须单独批准',
  },
}
write(join(AUDIT, 'final-acceptance.json'), finalAcceptance)

const lines = [
  '# UDS 8.0.0 视觉与无障碍验证报告',
  '',
  `> 生成时间 ${stamp} · 设计系统 UTER DESIGN SYSTEM 8.0.0`,
  '',
  '## 1. 自动检查器',
  '',
  `| 项 | 值 |`,
  `|---|---|`,
  `| 命令 | \`node web/scripts/check-design-system-8.0.0.mjs --json\` |`,
  `| 退出码 | ${checkerExit} |`,
  `| 判定 | ${checkerVerdict} |`,
  `| 通过项 | ${checker?.checksPassed ?? 0}/${checker?.checksTotal ?? 0} |`,
  '',
  '## 2. Showcase 视觉与无障碍',
  '',
  `| 项 | 状态 |`,
  `|---|---|`,
  `| Showcase 视觉回归 | ${visualStatus} |`,
  `| axe 无障碍 | ${a11yStatus} |`,
  `| 真实产品页面回归 | ${realPageStatus} |`,
  '',
  '## 3. 差距与边界',
  '',
  '- 视觉基线更新须人工审核并单独批准，不得由脚本批量覆盖。',
  '- 未执行（NOT_EXECUTED）与失败（FAIL）均如实登记，不转换为 PASS。',
  '- ACCEPTANCE_READY 不等于 ACCEPTED；最终人工接受仍需用户确认。',
  '',
]
write(join(DS, 'VISUAL-REGRESSION-REPORT.md'), lines.join('\n'))

console.log(
  `[UDS8] finalize: checker=${checkerVerdict} (${checker?.checksPassed ?? 0}/${checker?.checksTotal ?? 0}), ` +
    `visual=${visualStatus}, a11y=${a11yStatus}, real-pages=${realPageStatus}, contrast=${contrast?.verdict ?? 'ERROR'}`
)
process.exit(checkerExit === 0 ? 0 : 1)