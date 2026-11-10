#!/usr/bin/env node
/**
 * L4_GLOBAL_CONFORMANCE_GATE
 *
 * Final fail-closed aggregation of same-head CI evidence plus AES/Uter machine
 * governance checks. It never treats missing, skipped, unknown or NOT_RUN as PASS.
 * Product conformance is blocked until the P13 requirement-level report exists
 * and every applicable requirement has current independently verified evidence.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(process.cwd())
const AES_ROOT = resolve(process.env.AES_ROOT || resolve(ROOT, '../aes'))
const REQUIRED_JOBS = [
  ['AES_INTEGRATION', 'NEEDS_AES_INTEGRATION'],
  ['UEQE_REVIEW', 'NEEDS_UEQE_REVIEW'],
  ['BACKEND', 'NEEDS_BACKEND'],
  ['RACE', 'NEEDS_RACE'],
  ['COVERAGE', 'NEEDS_COVERAGE'],
  ['VULNSCAN', 'NEEDS_VULNSCAN'],
  ['DESKTOP', 'NEEDS_DESKTOP'],
  ['FRONTEND', 'NEEDS_FRONTEND'],
]
const checks = []
const run = (id, command, args, cwd = ROOT, env = {}) => {
  const r = spawnSync(command, args, {
    cwd, encoding: 'utf8', timeout: 15 * 60 * 1000, maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, ...env },
  })
  const result = {
    id, command: [command, ...args].join(' '), cwd,
    exit_code: r.status, timed_out: Boolean(r.error?.code === 'ETIMEDOUT'),
    stdout: (r.stdout || '').slice(-12000), stderr: (r.stderr || '').slice(-8000),
    status: r.status === 0 ? 'PASS' : 'FAIL',
  }
  checks.push(result)
  return result
}
const add = (id, ok, detail, evidence = null) => {
  checks.push({ id, status: ok ? 'PASS' : 'FAIL', detail, evidence })
  return ok
}
const readJson = (path) => {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}
const sha = (path) => existsSync(path)
  ? createHash('sha256').update(readFileSync(path)).digest('hex')
  : null

// Same-head workflow results: every mandatory job must have completed successfully.
for (const [name, variable] of REQUIRED_JOBS) {
  const value = process.env[variable] || 'MISSING'
  add('CI_' + name, value === 'success', `${variable}=${value}`)
}

// Canonical AES source and machine-sealed normative rule identity.
const fingerprint = run('AES_FINGERPRINT', process.execPath, [
  'quality/scripts/aes/governed-fingerprint.mjs', '--json', '--require-intact',
], AES_ROOT)
let live = null
try { live = JSON.parse(fingerprint.stdout) } catch {}
add('AES_SEAL', fingerprint.exit_code === 0 && live?.seal_intact === true,
  `exit=${fingerprint.exit_code} seal_intact=${live?.seal_intact}`,
  live ? { fingerprint: live.fingerprint, components: live.components } : null)

// AES pin, registry mapping and machine-seal comparison.
const integration = run('UTER_AES_INTEGRATION', process.execPath, [
  'scripts/quality/aes-integration-check.mjs', '--aes-root', AES_ROOT,
])
let integrationReport = null
try { integrationReport = JSON.parse(integration.stdout) } catch {}
add('UTER_AES_PIN', integration.exit_code === 0 && integrationReport?.verdict === 'PASS',
  `exit=${integration.exit_code} verdict=${integrationReport?.verdict || 'UNREADABLE'}`,
  integrationReport ? { aes_commit: integrationReport.aes_commit, live_fingerprint: integrationReport.live_fingerprint, checks: integrationReport.checks } : null)

// Independent Uter machine gate. Its own result is recomputed from the 11 check records.
const internal = run('UTER_INTERNAL_GATE', 'ruby', ['scripts/quality/ai-native-internal-gate.rb'], ROOT, { AES_ROOT })
const internalReport = readJson(resolve(ROOT, '.aes/reports/ai-native-internal-gate.json'))
add('UTER_INTERNAL_MACHINE_GATE',
  internal.exit_code === 0 && internalReport?.verdict === 'INTERNAL_ACCEPTED' &&
  internalReport?.checks?.length === 11 && internalReport.checks.every((x) => x.status === 'PASS'),
  `exit=${internal.exit_code} verdict=${internalReport?.verdict || 'MISSING'} checks=${internalReport?.checks?.length || 0}`,
  internalReport ? { verdict: internalReport.verdict, checks: internalReport.checks.map(x => ({ id: x.check, status: x.status })) } : null)

// P09 proves quality; P10 defines security and reliability requirements.
const boundary = run('P09_P10_BOUNDARY', 'ruby', ['scripts/quality/uter-p09-p10-boundary-check.rb'], ROOT, { AES_ROOT })
add('P09_P10_RESPONSIBILITY_BOUNDARY',
  boundary.exit_code === 0 && boundary.stdout.includes('overall=PASS'),
  `exit=${boundary.exit_code} ${boundary.stdout.split('\n').filter(x => x.startsWith('overall=')).join(' ')}`)

// Normative AI-spec inventory, metadata, entrypoints and L4 delivery policy.
const specs = run('AI_SPEC_INTEGRITY', 'bash', ['scripts/quality/ai-specs-check.sh'])
add('AI_SPEC_INTEGRITY', specs.exit_code === 0, `exit=${specs.exit_code}`)

// Recompute AES evidence chain independently.
const chain = run('AES_EVIDENCE_CHAIN', process.execPath, [
  'governance/ai-native/engine/cli.mjs', 'chain',
], AES_ROOT)
let chainReport = null
try { chainReport = JSON.parse(chain.stdout) } catch {}
add('AES_EVIDENCE_CHAIN_INTEGRITY',
  chain.exit_code === 0 && chainReport?.ok === true,
  `exit=${chain.exit_code} ok=${chainReport?.ok}`,
  chainReport ? { count: chainReport.count, errors: chainReport.errors } : null)

// UTER-P13 cannot be accepted by a pin or by generic CI alone. Require a
// requirement-level report, exact current AES fingerprint, current Uter HEAD,
// no unexecuted mandatory requirements and independent verification on every row.
const p13Path = resolve(ROOT, '.aes/reports/P13-CONFORMANCE-REPORT.json')
const p13 = readJson(p13Path)
const p13Rows = Array.isArray(p13?.requirements) ? p13.requirements : []
const p13Bad = p13Rows.filter(x => x.applicable !== false &&
  (x.status !== 'PASS' || x.independent_verification !== 'PASS' || !x.evidence_digest))
const currentHead = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim()
const p13Ok = Boolean(p13) && p13.verdict === 'PASS' &&
  p13.all_applicable_requirements_verified === true &&
  p13.not_run_count === 0 && p13.failed_count === 0 &&
  p13Bad.length === 0 && p13Rows.length > 0 &&
  p13.aes_governed_fingerprint === live?.fingerprint &&
  p13.uter_head === currentHead
add('UTER_P13_REQUIREMENT_LEVEL_CONFORMANCE', p13Ok,
  p13
    ? `verdict=${p13.verdict} requirements=${p13Rows.length} bad=${p13Bad.length} not_run=${p13.not_run_count} failed=${p13.failed_count} aes_fingerprint_current=${p13.aes_governed_fingerprint === live?.fingerprint} uter_head_current=${p13.uter_head === currentHead}`
    : 'P13-CONFORMANCE-REPORT.json missing; domain-level acceptance has not been demonstrated',
  p13 ? { report: '.aes/reports/P13-CONFORMANCE-REPORT.json', bad_requirements: p13Bad.map(x => x.requirement_id) } : null)

const failed = checks.filter(x => x.status !== 'PASS')
const report = {
  schema_version: '1.0.0',
  gate_id: 'L4_GLOBAL_CONFORMANCE_GATE',
  generated_at: new Date().toISOString(),
  uter_head: currentHead,
  aes_head: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: AES_ROOT, encoding: 'utf8' }).stdout.trim(),
  aes_governed_fingerprint: live?.fingerprint || null,
  verdict: failed.length ? 'FAIL' : 'PASS',
  check_count: checks.length,
  passed_count: checks.length - failed.length,
  failed_count: failed.length,
  checks,
}
const reportPath = process.env.L4_REPORT_PATH || resolve(process.env.RUNNER_TEMP || '/tmp', 'l4-global-conformance.json')
mkdirSync(dirname(reportPath), { recursive: true })
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ ...report, report_path: reportPath }, null, 2))
if (failed.length) process.exitCode = 1
