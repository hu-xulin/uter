#!/usr/bin/env node
/** Uter P0 hard gates — ten CI rules that MUST fail closed.
 *
 *  Required by the owner instruction: missing specification, conflicting
 *  specification, no verifier, no implementation, no tests, stale evidence,
 *  evidence/SHA mismatch, agent privilege escalation, security-gate bypass and
 *  unapproved forced specification change must each make CI FAIL.
 *
 *  Every rule is a PURE function of an explicit context so that the negative
 *  controls in `uter-governance-hard-gates.test.mjs` can mutate one fact at a
 *  time and prove the rule actually rejects it. `evaluate()` is the only part
 *  that touches the real filesystem / git / AES checkout.
 *
 *  Usage:
 *    node tools/aes/uter-governance-hard-gates.mjs [--aes-root <path>] [--json <path>]
 *    node tools/aes/uter-governance-hard-gates.mjs --self-test
 */
import {
  existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { join, resolve, dirname } from 'node:path'
import { headCompatibility, governanceHeadCompatibility } from './build-traceability.mjs'

export const TOOL_ID = 'uter-governance-hard-gates@1.0.0'
export const STATE_MODEL = [
  'PASS', 'FAIL', 'NOT_RUN', 'NOT_VERIFIED', 'BLOCKED',
  'NOT_APPLICABLE', 'PENDING_APPROVAL',
]

const REQUIRED_ARTIFACTS = [
  '.aes/INTEGRATION.md', '.aes/agent-governance.yaml',
  '.aes/uter-governance-registry.yaml', '.aes/aes-pin.json',
  '.aes/TRACEABILITY.md', '.aes/TRACEABILITY.jsonl',
  '.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md',
  'AGENTS.md', 'CLAUDE.md',
]
const FORBIDDEN_AGENT_ACTIONS = [
  'git.push.main', 'git.force_push', 'git.merge', 'git.pull_request.merge',
  'git.worktree.create', 'git.reset.hard', 'git.clean',
  'git.restore.user_files', 'deployment.execute', 'production.database.write',
  'payment.configuration.write', 'overwrite.user_uncommitted_changes',
  'falsify.verification_result',
]
const NEGATIVE_SUITES = [
  'tools/aes/build-traceability.test.mjs',
  'tools/aes/uter-governance-hard-gates.test.mjs',
  'tools/aes/p13-capability-verifier.negative.test.mjs',
  'tools/aes/agent-skills-runtime-verify.negative.test.mjs',
  'scripts/quality/test-aes-pin-check.rb',
  'scripts/quality/test-ai-governance-policy.rb',
]

function ok(detail) { return { status: 'PASS', detail } }
function bad(detail) { return { status: 'FAIL', detail } }
function notRun(detail) { return { status: 'NOT_RUN', detail } }

/** A self-contained, VALID context used by the test-suite as a control. */
export function baselineCtx() {
  const rec = (i) => ({
    requirement_id: `AES-00-${String(i + 1).padStart(4, '0')}-M001`,
    verifier: { validator_ids: ['AES-VAL-SPEC'], primary: 'quality/scripts/aes/spec-integrity.mjs' },
    implementation: [{ validator_id: 'AES-VAL-SPEC', path: 'quality/scripts/aes/spec-integrity.mjs', digest_sha256: 'a'.repeat(64) }],
    test_cases: [{ validator_id: 'AES-VAL-SPEC', suite: 'quality/scripts/aes/spec-integrity.test.mjs', exists: true }],
    execution_status: 'NOT_RUN', evidence: [], independent_verification: 'NOT_VERIFIED',
    final_status: 'NOT_VERIFIED',
  })
  return {
    artifacts: Object.fromEntries(REQUIRED_ARTIFACTS.map((p) => [p, { exists: true, bytes: 500 }])),
    uaesActive: false,
    duplicateRegistryIds: [],
    normativeAuthorityCount: 1,
    records: Array.from({ length: 2150 }, (_, i) => rec(i)),
    implementationPathsMissing: [],
    negativeSuitesExist: true,
    manifest: {
      generated_at: new Date().toISOString(), product_head: 'a'.repeat(40),
      governance_head: 'b'.repeat(40), entry_count: 11,
      entries: Array.from({ length: 11 }, (_, i) => ({ id: `v${i}`, status: 'PASS', exit_code: 0 })),
    },
    manifestAgeHours: 0.1,
    headPolicy: { ok: true, reason: 'EXACT' },
    governanceHeadPolicy: { ok: true, reason: 'EXACT' },
    agent: {
      default_effect: 'DENY',
      execution_policy: {
        forbidden: [...FORBIDDEN_AGENT_ACTIONS],
        max_execution_branches_per_project: 1,
        current_execution_branch: 'main',
        runtime_agent_verification_required: true,
        independent_assessment_required: true,
      },
    },
    workflows: { 'ci.yml': 'name: CI\npermissions:\n  contents: read\n' },
    pinCheck: { exit_code: 0, output: 'aes-pin-check: PASS' },
    fingerprint: { status: 'PASS', detail: 'governed fingerprint matches' },
    aesStandards: { status: 'PASS', missing: [] },
  }
}

/** 10 pure rules. `RULES` is exported so every rule has an explicit negative control. */
export const RULES = [
  ['HG-01', 'Missing normative specification', (c) => {
    const missing = REQUIRED_ARTIFACTS.filter((p) => !c.artifacts[p]?.exists || (c.artifacts[p]?.bytes ?? 0) < 100)
    if (missing.length) return bad(`missing/empty normative artifact(s): ${missing.join(', ')}`)
    if (c.aesStandards.status === 'NOT_RUN') return notRun('AES standards tree not available; P00-P12 presence NOT_RUN')
    if (c.aesStandards.status !== 'PASS') return bad(`AES P00-P12 standards missing: ${(c.aesStandards.missing || []).join(', ')}`)
    return ok(`${REQUIRED_ARTIFACTS.length} normative artifacts present; P00-P12 standards present`)
  }],
  ['HG-02', 'Conflicting or duplicate specification', (c) => {
    if (c.uaesActive) return bad('retired .uaes/ tree is present as a second normative source')
    if (c.duplicateRegistryIds?.length) return bad(`duplicate registry IDs: ${c.duplicateRegistryIds.join(', ')}`)
    if (c.normativeAuthorityCount !== 1) return bad(`normative authority declarations=${c.normativeAuthorityCount}, expected exactly 1`)
    return ok('single normative authority; no duplicate IDs; no retired .uaes/ source')
  }],
  ['HG-03', 'Requirement without executable verifier', (c) => {
    if (!Array.isArray(c.records) || c.records.length !== 2150) {
      return bad(`traceability has ${c.records?.length ?? 0} records, expected 2150`)
    }
    const unbound = c.records.filter((r) => !r?.verifier?.validator_ids?.length || !r?.verifier?.primary)
    if (unbound.length) return bad(`${unbound.length} requirement(s) have no verifier binding; first=${unbound[0].requirement_id}`)
    return ok('2,150/2,150 requirements bound to executable verifiers')
  }],
  ['HG-04', 'Verifier without implementation', (c) => {
    const badRecs = c.records.filter((r) => !Array.isArray(r.implementation) || !r.implementation.length
      || r.implementation.some((i) => !/^[0-9a-f]{64}$/.test(i.digest_sha256 || '')))
    if (badRecs.length) return bad(`${badRecs.length} requirement(s) reference a non-existent verifier implementation`)
    if (c.implementationPathsMissing?.length) {
      return bad(`verifier implementation path(s) missing on disk: ${c.implementationPathsMissing.slice(0, 3).join(', ')}`)
    }
    return ok('every verifier implementation existed and was hashed at generation time')
  }],
  ['HG-05', 'Requirement without tests / negative controls', (c) => {
    const noTests = c.records.filter((r) => !Array.isArray(r.test_cases) || !r.test_cases.length
      || r.test_cases.some((t) => t.exists !== true || !t.suite))
    if (noTests.length) return bad(`${noTests.length} requirement(s) have no executable test suite`)
    if (!c.negativeSuitesExist) return bad('one or more mandatory negative-control suites are missing')
    return ok('2,150 test bindings present; 6 negative-control suites present')
  }],
  ['HG-06', 'Stale or missing execution evidence', (c) => {
    if (!c.manifest) return bad('SHA-bound EVIDENCE-MANIFEST.json missing — no current execution evidence')
    if (!Number.isFinite(c.manifestAgeHours) || c.manifestAgeHours > 24) {
      return bad(`evidence stale: ${c.manifestAgeHours}h old (>24h)`)
    }
    if ((c.manifest.entry_count || 0) < 11) return bad(`evidence catalogue incomplete: ${c.manifest.entry_count}/11 entries`)
    return ok(`evidence manifest current (${c.manifestAgeHours.toFixed(2)}h, ${c.manifest.entry_count} entries)`)
  }],
  ['HG-07', 'Evidence / current SHA mismatch', (c) => {
    if (!c.manifest) return bad('no evidence to bind to the current revision')
    if (!c.headPolicy?.ok) return bad(`HEAD mismatch: ${c.headPolicy?.reason || 'unknown'}`)
    if (!/^[0-9a-f]{40}$/.test(c.manifest.product_head || '') || !/^[0-9a-f]{40}$/.test(c.manifest.governance_head || '')) {
      return bad('evidence manifest does not carry valid AES + Uter HEAD SHAs')
    }
    if (!c.governanceHeadPolicy?.ok) {
      return bad(`AES HEAD mismatch: ${c.governanceHeadPolicy?.reason || 'unknown'}`)
    }
    return ok(`evidence bound to current AES + Uter HEAD `
      + `(Uter: ${c.headPolicy.reason}; AES: ${c.governanceHeadPolicy.reason})`)
  }],
  ['HG-08', 'Agent privilege escalation', (c) => {
    const a = c.agent || {}
    if (a.default_effect !== 'DENY') return bad(`agent default_effect=${a.default_effect}, expected DENY`)
    const ep = a.execution_policy || {}
    const missing = FORBIDDEN_AGENT_ACTIONS.filter((x) => !(ep.forbidden || []).includes(x))
    if (missing.length) return bad(`agent policy no longer forbids: ${missing.join(', ')}`)
    if (ep.max_execution_branches_per_project !== 1 || ep.current_execution_branch !== 'main') {
      return bad('agent policy allows more than one branch or a non-main execution branch')
    }
    if (ep.runtime_agent_verification_required !== true || ep.independent_assessment_required !== true) {
      return bad('agent runtime verification or independent assessment is not mandatory')
    }
    return ok('default DENY, 13 forbidden actions, main-only, runtime + independent verification required')
  }],
  ['HG-09', 'Security / governance gate bypass in CI', (c) => {
    const hits = []
    for (const [name, text] of Object.entries(c.workflows || {})) {
      if (/continue-on-error\s*:\s*true/i.test(text)) hits.push(`${name}: continue-on-error: true`)
      if (/--no-verify/.test(text)) hits.push(`${name}: --no-verify`)
      if (/\bset\s+\+e\b/.test(text)) hits.push(`${name}: set +e`)
      for (const line of text.split('\n')) {
        if (/\|\|\s*true/.test(line) && /(gate|verify|check|test|lint|scan|audit|integrity)/i.test(line)) {
          hits.push(`${name}: suppressed check exit status (${line.trim().slice(0, 70)})`)
        }
      }
      if (/git\s+push/.test(text) && /contents\s*:\s*write/.test(text)) {
        hits.push(`${name}: auto-push of normative changes (contents: write + git push)`)
      }
      if (/\[skip ci\]/.test(text)) hits.push(`${name}: [skip ci] suppresses mandatory gates`)
    }
    if (hits.length) return bad(`CI bypass pattern(s): ${hits.slice(0, 5).join(' | ')}`)
    return ok(`${Object.keys(c.workflows || {}).length} workflow(s) scanned; no bypass pattern`)
  }],
  ['HG-10', 'Unapproved forced specification change', (c) => {
    if (c.pinCheck?.exit_code !== 0) return bad(`aes-pin-check FAIL: ${String(c.pinCheck?.output || '').slice(-200)}`)
    if (c.fingerprint?.status === 'NOT_RUN') return notRun('AES checkout unavailable; governed fingerprint NOT_RUN')
    if (c.fingerprint?.status !== 'PASS') return bad(`governed fingerprint mismatch: ${c.fingerprint?.detail}`)
    return ok('pin/contract coherent; governed fingerprint matches the AES seal')
  }],
]

export function decide(results) {
  const counts = results.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a }, {})
  let verdict = 'PASS'
  for (const s of ['FAIL', 'BLOCKED', 'PENDING_APPROVAL', 'NOT_RUN', 'NOT_VERIFIED']) {
    if (counts[s]) { verdict = s; break }
  }
  return { verdict, counts, total: results.length }
}

// ---------------------------------------------------------------------------
// Real filesystem context
// ---------------------------------------------------------------------------
function readText(p) { try { return readFileSync(p, 'utf8') } catch { return '' } }
function yamlToJson(root, rel) {
  const abs = join(root, rel)
  if (!existsSync(abs)) return null
  const r = spawnSync('ruby', ['-ryaml', '-rjson', '-e', 'print JSON.generate(YAML.safe_load(File.read(ARGV[0]), permitted_classes: [Date, Time], aliases: true))', abs], { encoding: 'utf8' })
  if (r.status !== 0) return null
  try { return JSON.parse(r.stdout) } catch { return null }
}
function gitHead(root) {
  const r = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' })
  return r.status === 0 ? r.stdout.trim() : null
}

export function buildContext({ root = resolve(process.env.UTER_ROOT || process.cwd()), aesRoot = null } = {}) {
  const artifacts = {}
  for (const p of REQUIRED_ARTIFACTS) {
    const abs = join(root, p)
    artifacts[p] = { exists: existsSync(abs), bytes: existsSync(abs) ? statSync(abs).size : 0 }
  }
  const integration = readText(join(root, '.aes/INTEGRATION.md'))
  const registry = yamlToJson(root, '.aes/uter-governance-registry.yaml')
  const ids = []
  const walk = (v) => {
    if (!v || typeof v !== 'object') return
    if (typeof v.id === 'string') ids.push(v.id)
    for (const x of Object.values(v)) if (typeof x === 'object') walk(x)
  }
  walk(registry)
  const duplicates = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))]

  let records = []
  try {
    records = readText(join(root, '.aes/TRACEABILITY.jsonl')).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
  } catch { records = [] }

  const manifestPath = join(root, '.aes/reports/UTER-EVIDENCE-MANIFEST.json')
  let manifest = null
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) } catch { manifest = null }
  const manifestAgeHours = manifest?.generated_at
    ? (Date.now() - new Date(manifest.generated_at).getTime()) / 3600000 : NaN
  const headPolicy = manifest?.product_head
    ? headCompatibility(manifest.product_head, gitHead(root), root)
    : { ok: false, reason: 'manifest has no product_head' }
  // The evidence is also bound to an AES revision. That binding is only
  // meaningful if the bound revision is still current for the AES governed
  // inputs, so it is judged with the AES repository's own output-only policy.
  const governanceHeadPolicy = manifest?.governance_head
    ? governanceHeadCompatibility(manifest.governance_head, aesRoot)
    : { ok: false, reason: 'manifest has no governance_head' }

  const workflows = {}
  const wfDir = join(root, '.github/workflows')
  if (existsSync(wfDir)) {
    for (const f of readdirSync(wfDir).filter((x) => /\.ya?ml$/.test(x))) {
      workflows[f] = readText(join(wfDir, f))
    }
  }

  const pinRun = spawnSync('bash', ['scripts/quality/aes-pin-check.sh'], { cwd: root, encoding: 'utf8' })
  const pinCheck = { exit_code: pinRun.status, output: `${pinRun.stdout || ''}${pinRun.stderr || ''}` }

  let fingerprint = { status: 'NOT_RUN', detail: 'no AES checkout provided (--aes-root)' }
  if (aesRoot) {
    const pin = (() => { try { return JSON.parse(readText(join(root, '.aes/aes-pin.json'))) } catch { return null } })()
    const fp = spawnSync(process.execPath, ['quality/scripts/aes/governed-fingerprint.mjs', '--json', '--require-intact'],
      { cwd: aesRoot, encoding: 'utf8' })
    // The tool names the value `fingerprint` and exposes `seal_intact`; the
    // first implementation looked for `governed_fingerprint` and misread a
    // healthy seal as tampered.
    let doc = null
    try { doc = JSON.parse(fp.stdout) } catch { doc = null }
    const computed = doc?.fingerprint || null
    const intact = doc?.seal_intact === true
    if (fp.status !== 0 || !computed || !intact) fingerprint = { status: 'FAIL', detail: `AES seal not intact (exit ${fp.status}, seal_intact=${doc?.seal_intact})` }
    else if (computed !== pin?.governed_fingerprint) {
      fingerprint = { status: 'FAIL', detail: `pin=${String(pin?.governed_fingerprint).slice(0, 12)} vs AES=${computed.slice(0, 12)}` }
    } else fingerprint = { status: 'PASS', detail: computed }
  }

  let aesStandards = { status: 'NOT_RUN', missing: [] }
  if (aesRoot) {
    const missing = []
    for (let i = 0; i <= 12; i += 1) {
      const d = join(aesRoot, 'standards', `${String(i).padStart(2, '0')}-`)
      const parent = join(aesRoot, 'standards')
      const found = existsSync(parent) && readdirSync(parent).some((x) => x.startsWith(`${String(i).padStart(2, '0')}-`) && statSync(join(parent, x)).isDirectory())
      if (!found) missing.push(`P${String(i).padStart(2, '0')}`)
      void d
    }
    aesStandards = { status: missing.length ? 'FAIL' : 'PASS', missing }
  }

  const implementationPathsMissing = []
  if (aesRoot) {
    const seen = new Set()
    for (const r of records) {
      for (const i of r.implementation || []) {
        if (!i?.path || seen.has(i.path)) continue
        seen.add(i.path)
        const base = i.repository === 'PRODUCT' ? root : aesRoot
        if (!existsSync(join(base, i.path))) implementationPathsMissing.push(i.path)
      }
    }
  }

  return {
    root, aesRoot, artifacts,
    uaesActive: existsSync(join(root, '.uaes')),
    duplicateRegistryIds: duplicates,
    normativeAuthorityCount: (integration.match(/^\*\*Normative authority:\*\*/gm) || []).length,
    records, implementationPathsMissing: implementationPathsMissing.slice(0, 20),
    negativeSuitesExist: NEGATIVE_SUITES.every((p) => existsSync(join(root, p))),
    manifest, manifestAgeHours, headPolicy, governanceHeadPolicy,
    agent: yamlToJson(root, '.aes/agent-governance.yaml') || {},
    workflows, pinCheck, fingerprint, aesStandards,
  }
}

export function evaluate(opts = {}) {
  const ctx = buildContext(opts)
  const results = RULES.map(([id, name, fn]) => {
    let r
    try { r = fn(ctx) } catch (e) { r = bad(`rule threw: ${e.message}`) }
    return { id, name, status: STATE_MODEL.includes(r.status) ? r.status : 'FAIL', detail: r.detail }
  })
  const summary = decide(results)
  return {
    report_id: 'UTER-GOVERNANCE-HARD-GATES', tool_id: TOOL_ID,
    generated_at: new Date().toISOString(),
    uter_root: ctx.root, aes_root: ctx.aesRoot,
    uter_head: gitHead(ctx.root), aes_head: ctx.aesRoot ? gitHead(ctx.aesRoot) : null,
    state_model: STATE_MODEL, summary, checks: results,
    evidence: {
      manifest: ctx.manifest ? '.aes/reports/UTER-EVIDENCE-MANIFEST.json' : null,
      manifest_generated_at: ctx.manifest?.generated_at || null,
      manifest_age_hours: Number.isFinite(ctx.manifestAgeHours) ? Number(ctx.manifestAgeHours.toFixed(2)) : null,
      head_policy: ctx.headPolicy,
      workflow_count: Object.keys(ctx.workflows || {}).length,
      record_count: ctx.records.length,
    },
  }
}

const isCli = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)
if (isCli) {
  const argv = process.argv.slice(2)
  const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null }
  const root = arg('--root') ? resolve(arg('--root')) : resolve(process.env.UTER_ROOT || process.cwd())
  const aesRoot = arg('--aes-root') ? resolve(arg('--aes-root')) : null
  const out = arg('--json') || 'reports/final/UTER-GOVERNANCE-HARD-GATES.json'
  const report = evaluate({ root, aesRoot })
  for (const c of report.checks) console.log(`${c.status.padEnd(8)} ${c.id} ${c.name} — ${c.detail}`)
  console.log(`\ndecision=${report.summary.verdict} ${JSON.stringify(report.summary.counts)} total=${report.summary.total}`)
  const abs = join(root, out)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, JSON.stringify(report, null, 2) + '\n')
  console.log(`written: ${out}`)
  process.exitCode = report.summary.verdict === 'PASS' ? 0 : 1
}
