#!/usr/bin/env node
/**
 * AES downstream synchronization engine for Uter.
 *
 * This engine records that an AES change was detected and processed. It never
 * upgrades Uter conformance, never edits the AES pin, and never converts an
 * unexecuted check into PASS. It has no human/third-party approval dependency.
 */
import { createHash } from 'node:crypto'
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

export function detect(opts = {}) {
  const pinPath = opts.pinPath || join(UTER_ROOT, '.aes/aes-pin.json')
  const registryPath = opts.registryPath || join(AES_ROOT, '.aes/STANDARD-REGISTRY.yaml')
  const eventsPath = opts.eventsPath || join(AES_ROOT, 'governance/ai-native/records/VERSION-EVENTS.jsonl')
  const statusPath = opts.statusPath || join(UTER_ROOT, '.aes/reports/aes-integration-status.json')
  const processedPath = opts.processedPath || join(UTER_ROOT, '.aes/autonomous/records/PROCESSED-EVENTS.json')
  const regText = exists(registryPath) ? readFileSync(registryPath, 'utf8') : ''
  const version = opts.simulateVersion || (regText.match(/^\\s*version:\\s*"?([^"\\n]+)"?/m) || [])[1] || null
  const pin = readJson(pinPath, {})
  const pinVersion = pin.registry_version || null
  const drift = Boolean(version && pinVersion && version !== pinVersion)
  const events = readJsonl(eventsPath)
  const processed = readJson(processedPath, { processed_event_ids: [] })?.processed_event_ids || []
  const processedSet = new Set(processed)
  const pending = events.filter((e) => e.requires_downstream_check === true && e.downstream_status !== 'PROCESSED' && !processedSet.has(e.event_id))
  const status = readJson(statusPath, {})
  const findings = []
  const add = (id, description, evidence) => findings.push({ finding_id: id, severity: 'BLOCKING', description, evidence, auto_promotion_allowed: false })
  if (!exists(pinPath)) add('AES-UTER-001', 'AES pin missing', pinPath)
  if (!exists(registryPath)) add('AES-UTER-002', 'AES authoritative registry unavailable', registryPath)
  if ((pin.integration_status || 'MIGRATION_PENDING') !== 'INTEGRATED') add('AES-UTER-003', 'Uter AES conformance has not been machine-verified', pinPath)
  if (pin.governed_fingerprint === 'PENDING_MACHINE_RECOMPUTATION' || !pin.governed_fingerprint) add('AES-UTER-004', 'AES governed fingerprint has not been independently recomputed', pinPath)
  if (drift) add('AES-UTER-005', `AES registry version ${version} differs from Uter pin ${pinVersion}`, registryPath)
  if (status.conformance_status && status.conformance_status !== 'CONFORMANT') add('AES-UTER-006', `Last conformance status is ${status.conformance_status}`, statusPath)
  return {
    aes_registry_version: version,
    uter_pin_registry_version: pinVersion,
    version_drift: drift,
    pending_events: pending,
    all_events: events.length,
    version_change_detected: drift || pending.length > 0,
    compliance_audit: {
      status: findings.length ? 'NOT_CONFORMANT' : 'NO_MACHINE_DETECTABLE_NONCONFORMANCE',
      integration_status: pin.integration_status || 'MIGRATION_PENDING',
      findings,
      auto_promotion_applied: false,
      items_marked_verified: 0,
      gates_marked_pass: 0,
      prohibit_implicit_approval: true,
    },
    paths: { pinPath, registryPath, eventsPath, statusPath, processedPath },
  }
}

export function processChanges(opts = {}) {
  const d = detect(opts)
  const outputPath = opts.outputPath || join(UTER_ROOT, '.aes/autonomous/records/LAST-SYNC.json')
  const checksPath = opts.checksPath || join(UTER_ROOT, '.aes/autonomous/records/DOWNSTREAM-CHECKS.jsonl')
  const findingsPath = opts.findingsPath || join(UTER_ROOT, '.aes/autonomous/records/COMPLIANCE-FINDINGS.jsonl')
  const simulated = Boolean(opts.simulateVersion || opts.simulated)
  const id = 'AES-DS-' + sha256(now() + ':' + d.aes_registry_version + ':' + d.pending_events.length).slice(0, 12)
  const record = {
    check_id: id,
    engine: 'UTER-AES-AUTONOMOUS-DOWNSTREAM-SYNC',
    executed_at: now(),
    simulated,
    aes_registry_version: d.aes_registry_version,
    uter_pin_registry_version: d.uter_pin_registry_version,
    version_drift: d.version_drift,
    version_change_detected: d.version_change_detected,
    upstream_events_seen: d.all_events,
    upstream_events_processed: d.pending_events.length,
    processed_event_ids: d.pending_events.map((e) => e.event_id),
    compliance_audit: d.compliance_audit,
    downstream_check: {
      status: 'PROCESSED',
      processed_at: now(),
      meaning: 'AES version event detection and processing only; this does not assert Uter conformance or acceptance.',
      integration_status_preserved: d.compliance_audit.integration_status,
      pin_modified: false,
      items_marked_verified: 0,
      gates_marked_pass: 0,
    },
    ai_decision_subject_type: 'AI_AUTOMATED',
    is_human_signature: false,
    is_third_party_signature: false,
  }
  if (opts.checkOnly) return { mode: 'CHECK_ONLY', would_process: d.version_change_detected, detection: d, record }
  writeAtomic(outputPath, record)
  append(checksPath, record)
  for (const f of d.compliance_audit.findings) append(findingsPath, { ...f, check_id: id, recorded_at: now() })
  const prev = readJson(d.paths.processedPath, { processed_event_ids: [] })
  writeAtomic(d.paths.processedPath, { processed_event_ids: [...new Set([...(prev.processed_event_ids || []), ...record.processed_event_ids])], updated_at: now() })
  return { mode: 'PROCESSED', output: outputPath, version_change_detected: d.version_change_detected, compliance_findings: d.compliance_audit.findings.length, record }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2)
  const value = (key) => { const i = args.indexOf('--' + key); return i >= 0 ? args[i + 1] : null }
  const result = processChanges({ checkOnly: args.includes('--check'), eventsPath: value('events'), outputPath: value('output'), processedPath: value('processed-events'), checksPath: value('checks'), findingsPath: value('findings'), simulateVersion: value('simulate-version'), registryPath: value('registry'), pinPath: value('pin'), statusPath: value('status') })
  console.log(JSON.stringify(result, null, 2))
  if (args.includes('--check') && result.would_process) process.exitCode = 1
}
