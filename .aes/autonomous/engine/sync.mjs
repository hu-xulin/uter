#!/usr/bin/env node
/**
 * AES downstream synchronization engine.
 *
 * Recomputes the live AES seal and governed fingerprint, refreshes the Uter
 * content pin when and only when the seal is intact, and records the sync.
 * Pin synchronization never promotes Uter product conformance.
 */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, renameSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const UTER_ROOT = resolve(HERE, '../../..')
export const AES_ROOT = process.env.AES_REPO || process.env.AES_ROOT || resolve(UTER_ROOT, '../aes')
const sha256 = (v) => createHash('sha256').update(v).digest('hex')
const now = () => new Date().toISOString()
const exists = (p) => { try { return existsSync(p) && readFileSync(p).length > 0 } catch { return false } }
const readJson = (p, fallback = null) => { try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return fallback } }
const readJsonl = (p) => exists(p) ? readFileSync(p, 'utf8').split('\n').filter(Boolean).map((x) => { try { return JSON.parse(x) } catch { return null } }).filter(Boolean) : []
const writeAtomic = (p, value) => { mkdirSync(dirname(p), { recursive: true }); const tmp = p + '.tmp-' + process.pid; writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n'); renameSync(tmp, p) }
const append = (p, value) => { mkdirSync(dirname(p), { recursive: true }); appendFileSync(p, JSON.stringify(value) + '\n') }
const run = (bin, args, cwd) => {
  const r = spawnSync(bin, args, { cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024 })
  if (r.error) throw r.error
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' }
}

export function detect(opts = {}) {
  const pinPath = opts.pinPath || join(UTER_ROOT, '.aes/aes-pin.json')
  const registryPath = opts.registryPath || join(AES_ROOT, '.aes/STANDARD-REGISTRY.yaml')
  const fingerprintPath = join(AES_ROOT, 'quality/scripts/aes/governed-fingerprint.mjs')
  const statusPath = opts.statusPath || join(UTER_ROOT, '.aes/reports/aes-integration-status.json')
  const pin = readJson(pinPath, {})
  const registryText = exists(registryPath) ? readFileSync(registryPath, 'utf8') : ''
  const version = (registryText.match(/^\s*version:\s*"?([^"\n]+)"?/m) || [])[1]?.trim() || null
  const status = (registryText.match(/^\s*status:\s*"?([^"\n]+)"?/m) || [])[1]?.trim() || null
  let live = null, fingerprintError = null, registryBlob = null, sourceCommit = null
  try {
    if (!exists(fingerprintPath)) throw new Error('AES governed fingerprint verifier is missing')
    const fp = run(process.execPath, [fingerprintPath, '--json', '--require-intact'], AES_ROOT)
    if (fp.code !== 0) throw new Error(fp.stderr || fp.stdout || 'fingerprint verifier failed')
    live = JSON.parse(fp.stdout)
    if (live.seal_intact !== true) throw new Error('AES specification seal is not intact')
    const blob = run('git', ['hash-object', '.aes/STANDARD-REGISTRY.yaml'], AES_ROOT)
    if (blob.code !== 0) throw new Error(blob.stderr || 'git hash-object failed')
    registryBlob = blob.stdout.trim()
    const head = run('git', ['rev-parse', 'HEAD'], AES_ROOT)
    if (head.code !== 0) throw new Error(head.stderr || 'git rev-parse failed')
    sourceCommit = head.stdout.trim()
  } catch (e) {
    fingerprintError = String(e?.message || e)
  }
  const componentMatch = Boolean(live && JSON.stringify(Object.fromEntries(Object.entries(pin.governed_components || {}).sort())) === JSON.stringify(Object.fromEntries(Object.entries(live.components || {}).sort())))
  const pinCurrent = Boolean(live && pin.governed_fingerprint === live.fingerprint &&
    pin.registry_blob_sha === registryBlob && pin.registry_version === version &&
    pin.registry_status === status && componentMatch)
  const projectStatus = readJson(statusPath, {})
  const conformance = projectStatus.conformance_status || pin.integration_status || 'MIGRATION_PENDING'
  const findings = []
  if (!exists(pinPath)) findings.push({ id: 'AES-PIN-001', reason: 'Uter AES pin is missing' })
  if (!exists(registryPath)) findings.push({ id: 'AES-PIN-002', reason: 'AES authoritative registry is missing' })
  if (fingerprintError) findings.push({ id: 'AES-PIN-003', reason: fingerprintError })
  if (live && !pinCurrent) findings.push({ id: 'AES-PIN-004', reason: 'Uter content pin differs from the live sealed AES rule set' })
  if (conformance !== 'CONFORMANT' && conformance !== 'INTEGRATED') findings.push({ id: 'AES-PIN-005', reason: 'Uter product conformance has not been established by requirement-level evidence' })
  return {
    aes_registry_version: version,
    aes_registry_status: status,
    aes_registry_blob_sha: registryBlob,
    aes_source_commit: sourceCommit,
    live_fingerprint: live?.fingerprint || null,
    seal_intact: live?.seal_intact === true,
    pin_current: pinCurrent,
    pin_conformance_status: conformance,
    version_change_detected: Boolean(live && !pinCurrent),
    findings,
    auto_promotion_applied: false,
    paths: { pinPath, registryPath, fingerprintPath, statusPath },
  }
}

export function processChanges(opts = {}) {
  const d = detect(opts)
  const outputPath = opts.outputPath || join(UTER_ROOT, '.aes/autonomous/records/LAST-SYNC.json')
  const checksPath = opts.checksPath || join(UTER_ROOT, '.aes/autonomous/records/DOWNSTREAM-CHECKS.jsonl')
  const findingsPath = opts.findingsPath || join(UTER_ROOT, '.aes/autonomous/records/COMPLIANCE-FINDINGS.jsonl')
  const pinPath = d.paths.pinPath
  const pin = readJson(pinPath, {})
  const checkOnly = Boolean(opts.checkOnly)
  const canRefresh = d.seal_intact === true && d.live_fingerprint && d.aes_registry_blob_sha
  const recordId = 'AES-DS-' + sha256(now() + ':' + String(d.live_fingerprint)).slice(0, 12)
  const record = {
    check_id: recordId,
    engine: 'UTER-AES-AUTONOMOUS-DOWNSTREAM-SYNC',
    executed_at: now(),
    mode: checkOnly ? 'CHECK_ONLY' : 'EXECUTE',
    seal_intact: d.seal_intact,
    aes_registry_version: d.aes_registry_version,
    aes_source_commit: d.aes_source_commit,
    live_fingerprint: d.live_fingerprint,
    pin_current_before: d.pin_current,
    conformance_status_before: d.pin_conformance_status,
    pin_refresh_allowed: canRefresh,
    auto_promotion_applied: false,
    result: canRefresh ? (d.pin_current ? 'CURRENT' : 'PIN_REFRESH_REQUIRED') : 'BLOCKED',
  }
  if (checkOnly) return { mode: 'CHECK_ONLY', would_refresh_pin: canRefresh && !d.pin_current, detection: d, record }
  if (!canRefresh) {
    writeAtomic(outputPath, { ...record, result: 'BLOCKED', findings: d.findings })
    append(checksPath, { ...record, result: 'BLOCKED', findings: d.findings })
    for (const f of d.findings) append(findingsPath, { ...f, check_id: recordId, recorded_at: now() })
    return { mode: 'BLOCKED', detection: d, record }
  }
  const live = JSON.parse(run(process.execPath, [d.paths.fingerprintPath, '--json', '--require-intact'], AES_ROOT).stdout)
  const updated = {
    ...pin,
    governed_fingerprint: live.fingerprint,
    governed_components: live.components,
    registry_blob_sha: d.aes_registry_blob_sha,
    registry_version: d.aes_registry_version,
    registry_status: d.aes_registry_status,
    source_commit: d.aes_source_commit,
    pinned_at: now(),
    integration_status: pin.integration_status || 'MIGRATION_PENDING',
    machine_authorization_state: pin.machine_authorization_state || 'ACTIVE',
    note: 'AES governed fingerprint and seal are machine-recomputed. Pin refresh identifies the normative source only; product conformance is independently computed from requirement-level evidence and is never auto-promoted by synchronization.',
  }
  writeAtomic(pinPath, updated)
  const final = { ...record, result: 'PIN_REFRESHED', pin_current_after: true, pin_sha256: sha256(JSON.stringify(updated)), conformance_status_after: updated.integration_status }
  writeAtomic(outputPath, final)
  append(checksPath, final)
  return { mode: 'PIN_REFRESHED', detection: d, record: final }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2)
  const value = (key) => { const i = args.indexOf('--' + key); return i >= 0 ? args[i + 1] : null }
  const result = processChanges({ checkOnly: args.includes('--check'), outputPath: value('output'), checksPath: value('checks'), findingsPath: value('findings'), pinPath: value('pin'), registryPath: value('registry'), statusPath: value('status') })
  console.log(JSON.stringify(result, null, 2))
  if (args.includes('--check') && result.would_refresh_pin) process.exitCode = 1
  if (result.mode === 'BLOCKED') process.exitCode = 2
}
