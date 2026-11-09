#!/usr/bin/env node
/** Uter autonomous downstream sync engine — standalone, zero third-party deps.
 *
 *  Detects UAES standard/version changes, runs the Uter compliance audit,
 *  records a PROCESSED downstream check, and NEVER promotes Uter's integration
 *  status, acceptance items, or quality gates implicitly.
 *
 *  Usage:
 *    node .uaes/autonomous/engine/sync.mjs                 # detect + process + write
 *    node .uaes/autonomous/engine/sync.mjs --check        # detect only, exit 1 if changes pending
 *    node .uaes/autonomous/engine/sync.mjs --events <path> --output <path> --simulate-version 1.13.0
 */
import { createHash } from 'node:crypto'
import {
  existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, renameSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const UTER_ROOT = resolve(HERE, '../../..')
const UAES_ROOT = process.env.UAES_ROOT || resolve(UTER_ROOT, '../uaes')
const POLICY = join(UTER_ROOT, '.uaes/autonomous/config/downstream-policy.json')

const sha256 = (v) => createHash('sha256').update(v).digest('hex')
const nowIso = () => new Date().toISOString()
const exists = (p) => { try { return existsSync(p) && readFileSync(p).length > 0 } catch { return false } }
const readJson = (p, fb = null) => { try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return fb } }
const readJsonl = (p) => exists(p) ? readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean) : []
const appendJsonl = (p, o) => { mkdirSync(dirname(p), { recursive: true }); appendFileSync(p, `${JSON.stringify(o)}\n`) }
const writeAtomic = (p, o) => { mkdirSync(dirname(p), { recursive: true }); const t = `${p}.tmp-${process.pid}`; writeFileSync(t, `${JSON.stringify(o, null, 2)}\n`); renameSync(t, p) }

function parseArgs(argv) {
  const o = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const k = a.slice(2), n = argv[i + 1]
      if (n !== undefined && !n.startsWith('--')) { o[k] = n; i += 1 } else o[k] = true
    } else o._.push(a)
  }
  return o
}

/** Detect UAES version + pending activation events + Uter conformance findings. */
export function detect(opts = {}) {
  const policy = readJson(POLICY, {})
  const u = policy.upstream || {}, l = policy.local || {}
  const registryPath = opts.registryPath || join(UAES_ROOT, u.registry || '.uaes/STANDARD-REGISTRY.yaml')
  const pinPath = opts.pinPath || join(UTER_ROOT, l.pin || '.uaes/uaes-pin.json')
  const eventsPath = opts.eventsPath || join(UAES_ROOT, u.version_events || 'governance/autonomous/records/VERSION-EVENTS.jsonl')
  const statusPath = opts.statusPath || join(UTER_ROOT, l.integration_status_report || '.uaes/reports/uaes-integration-status.json')
  const processedPath = opts.processedPath || join(UTER_ROOT, l.processed_events || '.uaes/autonomous/records/PROCESSED-EVENTS.json')

  const regText = exists(registryPath) ? readFileSync(registryPath, 'utf8') : ''
  const regV = opts.simulateVersion || (regText.match(/^\s*version:\s*"?([^"\n]+)"?/m) || [])[1] || null
  const pin = readJson(pinPath, {})
  const pinV = pin.registry_version
  const versionDrift = Boolean(regV && pinV && regV !== pinV)

  const processed = readJson(processedPath, { processed_event_ids: [] })?.processed_event_ids || []
  const processedSet = new Set(processed)
  const events = readJsonl(eventsPath)
  const pendingEvents = events.filter((e) => e.requires_downstream_check === true && e.downstream_status !== 'PROCESSED' && !processedSet.has(e.event_id))

  // Compliance audit: honest, never auto-promoting.
  const status = readJson(statusPath, {})
  const findings = []
  const addFinding = (id, finding, evidence) => findings.push({ finding_id: id, finding, severity: 'BLOCKING', auto_promotion_allowed: false, evidence })
  if ((pin.integration_status || 'MIGRATION_PENDING') !== 'INTEGRATED') {
    addFinding('CF-01', `Uter integration_status=${pin.integration_status || 'UNKNOWN'}；无显式外部 INTEGRATED 治理声明，不得隐式提升`, 'uaes-pin.json')
  }
  if (status.manual_acceptance_signed === false || status.manual_acceptance_signed === undefined) {
    addFinding('CF-02', '人工/第三方验收签署未完成（manual_acceptance_signed=false）', 'uaes-integration-status.json')
  }
  if (status.domain_gates_pass === false || status.global_gate_pass === false) {
    addFinding('CF-03', 'L3/L4 域门禁或全局门禁未通过，不得标为 PASS', 'uaes-integration-status.json')
  }
  if (status.verified_item_count === 0 || status.verified_item_count === undefined) {
    addFinding('CF-04', '逐项验收 verified_item_count=0，S01–S42 未变 VERIFIED', 'uaes-integration-status.json')
  }
  if (versionDrift) addFinding('CF-05', `UAES registry_version=${regV} 与 Uter pin=${pinV} 不一致，需下游处理`, 'STANDARD-REGISTRY.yaml / uaes-pin.json')

  return {
    uaes_registry_version: regV,
    uter_pin_registry_version: pinV,
    version_drift: versionDrift,
    pending_events: pendingEvents,
    all_events: events.length,
    version_change_detected: versionDrift || pendingEvents.length > 0,
    compliance_audit: {
      status: findings.length ? 'NOT_CONFORMANT' : 'NO_MACHINE_DETECTABLE_NONCONFORMANCE',
      integration_status: pin.integration_status || 'UNKNOWN',
      findings,
      auto_promotion_applied: false,
      items_marked_verified: 0,
      prohibit_implicit_approval: true,
    },
    policy, paths: { registryPath, pinPath, eventsPath, statusPath, processedPath },
  }
}

/** Process detected changes: write LAST-SYNC + append-only check/finding records. */
export function processChanges(opts = {}) {
  const d = detect(opts)
  const l = d.policy.local || {}
  const outputPath = opts.outputPath || join(UTER_ROOT, l.last_sync || '.uaes/autonomous/records/LAST-SYNC.json')
  const checksPath = opts.checksPath || join(UTER_ROOT, l.checks || '.uaes/autonomous/records/DOWNSTREAM-CHECKS.jsonl')
  const findingsPath = opts.findingsPath || join(UTER_ROOT, l.findings || '.uaes/autonomous/records/COMPLIANCE-FINDINGS.jsonl')
  const processedPath = d.paths.processedPath
  const simulated = Boolean(opts.simulateVersion || opts.simulated)
  const checkId = `DS-${sha256(`${nowIso()}-${d.uaes_registry_version}-${d.pending_events.length}`).slice(0, 12)}`

  const record = {
    check_id: checkId,
    engine: 'UTER-AUTONOMOUS-DOWNSTREAM-SYNC',
    policy_version: d.policy.policy_version || '1.0.0',
    executed_at: nowIso(),
    simulated,
    uaes_registry_version: d.uaes_registry_version,
    uter_pin_registry_version: d.uter_pin_registry_version,
    version_drift: d.version_drift,
    version_change_detected: d.version_change_detected,
    upstream_events_seen: d.all_events,
    upstream_events_processed: d.pending_events.length,
    processed_event_ids: d.pending_events.map((e) => e.event_id),
    applicability: {
      project: 'Uter',
      requirement_count: readJson(d.paths.pinPath, {})?.requirement_count ?? null,
      scope: 'internal engineering governance only',
      external_authorization_items_excluded: true,
    },
    compliance_audit: d.compliance_audit,
    downstream_check: {
      status: 'PROCESSED',
      processed_at: nowIso(),
      meaning: 'UAES 版本变化已被检测并处理；本状态不表示 Uter 符合 UAES、不表示验收通过、不表示任何批准',
      integration_status_preserved: d.compliance_audit.integration_status,
      pin_modified: false,
      items_marked_verified: 0,
      gates_marked_pass: 0,
    },
    hard_constraints: d.policy.hard_constraints || [],
    ai_decision_subject_type: 'AI_AUTOMATED',
    is_human_signature: false,
    is_third_party_signature: false,
  }

  if (opts.checkOnly) return { mode: 'CHECK_ONLY', would_process: d.version_change_detected, detection: d, record }

  writeAtomic(outputPath, record)
  appendJsonl(checksPath, record)
  for (const f of d.compliance_audit.findings) appendJsonl(findingsPath, { ...f, check_id: checkId, recorded_at: nowIso(), engine: record.engine })
  const prev = readJson(processedPath, { processed_event_ids: [] })
  const merged = { processed_event_ids: [...new Set([...(prev.processed_event_ids || []), ...record.processed_event_ids])], updated_at: nowIso() }
  writeAtomic(processedPath, merged)
  return { mode: 'PROCESSED', output: outputPath, version_change_detected: d.version_change_detected, compliance_findings: d.compliance_audit.findings.length, record }
}

function main() {
  const a = parseArgs(process.argv.slice(2))
  const opts = {
    checkOnly: Boolean(a.check), eventsPath: a.events, outputPath: a.output,
    checksPath: a.checks, findingsPath: a.findings, processedPath: a['processed-events'],
    simulateVersion: typeof a['simulate-version'] === 'string' ? a['simulate-version'] : null,
    registryPath: a.registry, pinPath: a.pin, statusPath: a.status,
  }
  const result = processChanges(opts)
  console.log(JSON.stringify(result, null, 2))
  if (a.check && result.would_process) process.exitCode = 1
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main()
