#!/usr/bin/env node
/** Uter current-SHA execution evidence harness.
 *
 *  CI runs this BEFORE the hard gates so the freshness rule is evaluated
 *  against evidence produced in THIS run, not against a committed file that
 *  silently ages. Every raw stdout/stderr is hashed (SHA-256), bound to the
 *  current Uter HEAD and (when available) the AES HEAD, and indexed in
 *  `.aes/reports/UTER-EVIDENCE-MANIFEST.json`.
 *
 *  Usage:
 *    node tools/aes/uter-evidence-harness.mjs run [--aes-root <path>]
 *    node tools/aes/uter-evidence-harness.mjs verify
 */
import {
  existsSync, mkdirSync, readFileSync, writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { headCompatibility } from './build-traceability.mjs'

export const TOOL_ID = 'uter-evidence-harness@1.0.0'
export const STATE_MODEL = [
  'PASS', 'FAIL', 'NOT_RUN', 'NOT_VERIFIED', 'BLOCKED',
  'NOT_APPLICABLE', 'PENDING_APPROVAL',
]

const ROOT = resolve(process.env.UTER_ROOT || process.cwd())
const OUT_DIR = join(ROOT, '.aes/reports/evidence')
const MANIFEST = join(OUT_DIR, 'UTER-EVIDENCE-MANIFEST.json')
const HOOK_MANIFEST = join(ROOT, '.aes/reports/UTER-EVIDENCE-MANIFEST.json')

function sha256(buf) { return createHash('sha256').update(buf).digest('hex') }
function gitHead(root) {
  if (!root) return null
  const r = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' })
  return r.status === 0 ? r.stdout.trim() : null
}

export function commands(aesRoot) {
  const N = process.execPath
  const list = [
    ['uter-adapter-tests', [N, '--test', 'tools/aes/integration-adapter.test.mjs']],
    ['uter-adapter-contract', [N, '--test', 'tools/aes/integration-adapter.contract.test.mjs']],
    ['uter-traceability-tests', [N, '--test', 'tools/aes/build-traceability.test.mjs']],
    ['uter-hard-gate-tests', [N, '--test', 'tools/aes/uter-governance-hard-gates.test.mjs']],
    ['uter-negative-suites', [N, '--test', 'tools/aes/p13-capability-verifier.negative.test.mjs', 'tools/aes/agent-skills-runtime-verify.negative.test.mjs']],
    ['uter-integration-check-tests', [N, '--test', 'scripts/quality/aes-integration-check.test.mjs']],
    ['uter-sync-tests', [N, '--test', '.aes/autonomous/engine/sync.test.mjs']],
    ['uter-pin-tests', ['ruby', 'scripts/quality/test-aes-pin-check.rb']],
    ['uter-agent-runtime', [N, 'tools/aes/agent-skills-runtime-verify.mjs']],
    ['uter-pin-check', ['bash', 'scripts/quality/aes-pin-check.sh']],
    ['uter-traceability-verify', [N, 'tools/aes/build-traceability.mjs', '--verify']],
  ]
  if (aesRoot) {
    list.push(['uter-aes-integration', [N, 'scripts/quality/aes-integration-check.mjs', '--aes-root', aesRoot]])
  }
  return list.map(([id, argv]) => ({ id, argv, cwd: ROOT, timeoutMs: 600000 }))
}

export function run({ aesRoot = null, root = ROOT } = {}) {
  mkdirSync(join(root, '.aes/reports/evidence'), { recursive: true })
  const uterHead = gitHead(root)
  const aesHead = gitHead(aesRoot)
  const entries = []
  for (const c of commands(aesRoot)) {
    const started = new Date().toISOString()
    const t0 = Date.now()
    const r = spawnSync(c.argv[0], c.argv.slice(1), {
      cwd: c.cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: c.timeoutMs,
    })
    const timedOut = r.error && String(r.error.code || '') === 'ETIMEDOUT'
    const exitCode = timedOut ? null : (r.status === null ? null : r.status)
    const outBuf = Buffer.from(r.stdout || '', 'utf8')
    const errBuf = Buffer.from(r.stderr || '', 'utf8')
    const outRel = `.aes/reports/evidence/${c.id}.stdout.log`
    const errRel = `.aes/reports/evidence/${c.id}.stderr.log`
    writeFileSync(join(root, outRel), outBuf)
    writeFileSync(join(root, errRel), errBuf)
    const tap = (() => {
      const p = String(r.stdout || '').match(/^# pass (\d+)$/m)
      const f = String(r.stdout || '').match(/^# fail (\d+)$/m)
      return p && f ? { pass: Number(p[1]), fail: Number(f[1]) } : null
    })()
    entries.push({
      id: c.id, command: c.argv.join(' '), started_at: started,
      duration_ms: Date.now() - t0, exit_code: exitCode,
      status: timedOut ? 'NOT_RUN' : (exitCode === 0 ? 'PASS' : 'FAIL'),
      uter_head: uterHead, aes_head: aesHead, tap,
      stdout: { rel: outRel, bytes: outBuf.length, sha256: sha256(outBuf) },
      stderr: { rel: errRel, bytes: errBuf.length, sha256: sha256(errBuf) },
    })
    console.log(`${entries.at(-1).status.padEnd(8)} ${c.id.padEnd(30)} exit=${exitCode ?? 'timeout'} ${Date.now() - t0}ms`)
  }
  const manifest = {
    harness_id: TOOL_ID, generated_at: new Date().toISOString(),
    product_head: uterHead, governance_head: aesHead,
    entry_count: entries.length, entries,
    policy: { max_age_hours: 24, rule: 'Every artefact hash must recompute; HEAD must be current; age <= 24h; non-zero exits are never PASS.' },
  }
  writeFileSync(join(root, '.aes/reports/evidence/UTER-EVIDENCE-MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n')
  // A stable top-level copy is what the hard gates and reports consume.
  writeFileSync(join(root, '.aes/reports/UTER-EVIDENCE-MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(`\nmanifest: .aes/reports/UTER-EVIDENCE-MANIFEST.json entries=${entries.length} `
    + `PASS=${entries.filter((e) => e.status === 'PASS').length} FAIL=${entries.filter((e) => e.status === 'FAIL').length}`)
  return manifest
}

export function verify({ root = ROOT, maxAgeHours = 24, manifestRel = '.aes/reports/UTER-EVIDENCE-MANIFEST.json' } = {}) {
  const abs = join(root, manifestRel)
  if (!existsSync(abs)) return { verdict: 'FAIL', errors: [`manifest missing: ${manifestRel}`] }
  const m = JSON.parse(readFileSync(abs, 'utf8'))
  const errors = []
  const head = headCompatibility(m.product_head, gitHead(root), root)
  if (!head.ok) errors.push(`Uter HEAD mismatch: ${head.reason}`)
  const ageH = (Date.now() - new Date(m.generated_at).getTime()) / 3600000
  if (!Number.isFinite(ageH) || ageH > maxAgeHours) errors.push(`evidence stale: ${ageH.toFixed(1)}h > ${maxAgeHours}h`)
  if ((m.entry_count || 0) < 11) errors.push(`evidence catalogue incomplete: ${m.entry_count}/11`)
  for (const e of m.entries || []) {
    for (const side of ['stdout', 'stderr']) {
      const a = e[side]
      const p = join(root, a.rel)
      if (!existsSync(p)) { errors.push(`${e.id}/${side}: missing`); continue }
      const buf = readFileSync(p)
      if (buf.length !== a.bytes) errors.push(`${e.id}/${side}: byte count mismatch`)
      if (sha256(buf) !== a.sha256) errors.push(`${e.id}/${side}: SHA-256 mismatch (tampered)`)
    }
    if (e.status === 'PASS' && e.exit_code !== 0) errors.push(`${e.id}: PASS with non-zero exit`)
  }
  return {
    harness_id: TOOL_ID, verdict: errors.length ? 'FAIL' : 'PASS',
    age_hours: Number(ageH.toFixed(2)), entry_count: m.entry_count,
    head_policy: head,
    status_counts: (m.entries || []).reduce((a, e) => { a[e.status] = (a[e.status] || 0) + 1; return a }, {}),
    error_count: errors.length, errors,
  }
}

const isCli = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)
if (isCli) {
  const argv = process.argv.slice(2)
  const i = argv.indexOf('--aes-root')
  const aesRoot = i >= 0 ? resolve(argv[i + 1]) : (process.env.AES_ROOT ? resolve(process.env.AES_ROOT) : null)
  const root = argv.includes('--root') ? resolve(argv[argv.indexOf('--root') + 1]) : ROOT
  if (argv[0] === 'run') { run({ aesRoot, root }) }
  else {
    const r = verify({ root })
    console.log(JSON.stringify(r, null, 2))
    process.exitCode = r.verdict === 'PASS' ? 0 : 1
  }
}
