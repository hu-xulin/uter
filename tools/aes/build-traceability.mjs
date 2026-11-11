#!/usr/bin/env node
/** Uter AES Requirement Traceability builder / verifier.
 *
 *  The P0 instruction explicitly forbids trusting the old 23-row
 *  `.aes/TRACEABILITY.md` domain index. This tool re-derives every record from
 *  the AES normative requirement registry via the AES-generated
 *  Requirement -> Validator map, and emits ONE machine-readable record per
 *  requirement carrying exactly the twelve mandated fields:
 *
 *    requirement_id, source_standard, source_version, requirement_level,
 *    applicability, implementation, verifier, test_cases, execution_status,
 *    evidence, independent_verification, final_status
 *
 *  Honesty rule: grouped domain-gate evidence is NOT per-requirement evidence.
 *  A record whose `final_status` is PASS without an independent verification
 *  and current SHA-bound evidence is rejected as a forged state edit.
 *
 *  Usage:
 *    node tools/aes/build-traceability.mjs --source <aes-emitted.json>
 *    node tools/aes/build-traceability.mjs --verify [--root <repo>]
 */
import {
  existsSync, readFileSync, writeFileSync, mkdirSync, statSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'

export const TOOL_ID = 'uter-build-traceability@1.0.0'
export const REQUIRED_FIELDS = [
  'requirement_id', 'source_standard', 'source_version', 'requirement_level',
  'applicability', 'implementation', 'verifier', 'test_cases',
  'execution_status', 'evidence', 'independent_verification', 'final_status',
]
export const STATE_MODEL = [
  'PASS', 'FAIL', 'NOT_RUN', 'NOT_VERIFIED', 'BLOCKED',
  'NOT_APPLICABLE', 'PENDING_APPROVAL',
]

const ROOT = resolve(process.env.UTER_ROOT || process.cwd())
const DEFAULT_SOURCE = join(ROOT, '.aes/reports/AES-REQUIREMENT-MAP.json')
const JSONL_REL = '.aes/TRACEABILITY.jsonl'
const MD_REL = '.aes/TRACEABILITY.md'
const REPORT_REL = '.aes/reports/REQUIREMENT-TRACEABILITY-VERIFICATION.json'

// A commit that only refreshes generated evidence does not change the governed
// inputs the traceability describes. Anything else invalidates it immediately.
export const OUTPUT_ONLY_PREFIXES = [
  '.aes/reports/', '.aes/TRACEABILITY.jsonl', '.aes/TRACEABILITY.md',
  'reports/', 'docs/governance/reports/',
]

export function isOutputOnlyPath(p, prefixes = OUTPUT_ONLY_PREFIXES) {
  return prefixes.some((prefix) => p.startsWith(prefix))
}

/**
 * Load the AES repository's own output-only prefix list so that cross-repo
 * HEAD compatibility is judged by the SAME rule the AES harness applies.
 * Reading the AES source of truth instead of duplicating the list here
 * removes the drift risk of two independently maintained policies.
 *
 * The list is parsed from the AES harness source synchronously (the hard-gate
 * evaluator is a sync API). A parse failure is fail-closed: the caller must
 * treat "no list" as "nothing is output-only", never as "everything is".
 */
export function aesOutputOnlyPrefixes(aesRoot) {
  if (!aesRoot) return null
  const harness = join(aesRoot, 'quality/scripts/aes/governance-evidence-harness.mjs')
  if (!existsSync(harness)) return null
  try {
    const src = readFileSync(harness, 'utf8')
    const m = src.match(/export const OUTPUT_ONLY_PREFIXES\s*=\s*\[([\s\S]*?)\]/)
    if (!m) return null
    const prefixes = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
    return prefixes.length ? prefixes : null
  } catch { return null }
}

function sha256(buf) { return createHash('sha256').update(buf).digest('hex') }
function gitHead(root) {
  const r = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' })
  return r.status === 0 ? r.stdout.trim() : null
}

export function headCompatibility(evidenceHead, currentHead, root, outputOnlyPrefixes = OUTPUT_ONLY_PREFIXES) {
  if (!evidenceHead || !currentHead) return { ok: false, reason: 'HEAD unavailable' }
  if (evidenceHead === currentHead) return { ok: true, reason: 'EXACT', commits: 0 }
  const anc = spawnSync('git', ['-C', root, 'merge-base', '--is-ancestor', evidenceHead, currentHead])
  if (anc.status !== 0) return { ok: false, reason: 'evidence HEAD is not an ancestor', commits: -1 }
  const revs = spawnSync('git', ['-C', root, 'rev-list', `${evidenceHead}..${currentHead}`], { encoding: 'utf8' })
  if (revs.status !== 0) return { ok: false, reason: 'cannot enumerate intervening commits', commits: -1 }
  const shas = revs.stdout.trim().split('\n').filter(Boolean)
  for (const sha of shas) {
    const names = spawnSync('git', ['-C', root, 'show', '--pretty=format:', '--name-only', sha], { encoding: 'utf8' })
    if (names.status !== 0) return { ok: false, reason: `cannot inspect ${sha.slice(0, 8)}`, commits: shas.length }
    const substantive = names.stdout.trim().split('\n').filter(Boolean).filter((p) => !isOutputOnlyPath(p, outputOnlyPrefixes))
    if (substantive.length) {
      return { ok: false, reason: `commit ${sha.slice(0, 8)} changed governed input ${substantive[0]}`, commits: shas.length }
    }
  }
  return { ok: true, reason: 'EVIDENCE_ONLY_COMMITS', commits: shas.length }
}

/**
 * Cross-repository HEAD compatibility: is the AES revision that Uter's
 * evidence was bound to still current?
 *
 * The P0 rule "evidence whose SHA does not match the current revision must
 * FAIL" is not satisfied by merely carrying a 40-hex SHA in the manifest.
 * The bound AES revision must still be reachable from the AES HEAD, and every
 * intervening AES commit must touch only paths the AES harness itself
 * classifies as output-only. Otherwise the AES governed inputs moved and the
 * Uter evidence is stale even though the Uter tree did not change.
 */
export function governanceHeadCompatibility(evidenceHead, aesRoot) {
  if (!evidenceHead) return { ok: false, reason: 'manifest carries no governance_head' }
  if (!aesRoot) return { ok: false, reason: 'no AES checkout provided (--aes-root)' }
  const current = gitHead(aesRoot)
  if (!current) return { ok: false, reason: 'cannot read AES HEAD' }
  const prefixes = aesOutputOnlyPrefixes(aesRoot)
  if (!prefixes) {
    return { ok: false, reason: 'cannot read the AES output-only policy (fail-closed)', commits: -1 }
  }
  const r = headCompatibility(evidenceHead, current, aesRoot, prefixes)
  return { ...r, current_head: current, policy_source: 'AES quality/scripts/aes/governance-evidence-harness.mjs' }
}

function nonEmpty(v) {
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.keys(v).length > 0
  return true
}

/** Validate one emitted record. Returns an array of problems (empty = valid). */
export function validateRecord(rec, index) {
  const problems = []
  const at = rec?.requirement_id || `#${index}`
  for (const f of REQUIRED_FIELDS) {
    // `evidence` is legitimately empty when nothing was executed; it must still
    // be PRESENT as an array so the state cannot be silently omitted.
    if (!(f in (rec || {}))) problems.push(`${at}: missing field ${f}`)
    else if (f !== 'evidence' && !nonEmpty(rec[f])) problems.push(`${at}: empty field ${f}`)
  }
  if (!Array.isArray(rec?.evidence)) problems.push(`${at}: evidence is not an array`)
  if (!Array.isArray(rec?.implementation) || !rec.implementation.length) problems.push(`${at}: no implementation`)
  if (!Array.isArray(rec?.test_cases) || !rec.test_cases.length) problems.push(`${at}: no test cases`)
  if (!rec?.verifier?.validator_ids?.length) problems.push(`${at}: no verifier binding`)
  for (const s of ['execution_status', 'independent_verification', 'final_status']) {
    if (rec?.[s] && !STATE_MODEL.includes(rec[s])) problems.push(`${at}: ${s}=${rec[s]} outside 7-state model`)
  }
  // Anti-forgery: per-requirement PASS requires real evidence AND an
  // independent verification. Absence of a failure is not a pass.
  if (rec?.final_status === 'PASS' && (
    !Array.isArray(rec.evidence) || rec.evidence.length === 0
    || rec.independent_verification !== 'VERIFIED'
  )) problems.push(`${at}: forged PASS without evidence/independent verification`)
  if (rec?.execution_status === 'NOT_RUN' && rec?.final_status === 'PASS') {
    problems.push(`${at}: PASS with execution_status NOT_RUN`)
  }
  return problems
}

/** Validate the complete source document. */
export function validateSource(doc, { expectedHead = null, root = ROOT, maxAgeHours = 24 } = {}) {
  const errors = []
  const records = doc?.records
  if (!Array.isArray(records)) return { verdict: 'FAIL', errors: ['source has no records array'], record_count: 0 }
  if (records.length !== 2150) errors.push(`record_count=${records.length}, expected 2150`)
  const ids = new Set()
  for (let i = 0; i < records.length; i += 1) {
    const r = records[i]
    if (ids.has(r?.requirement_id)) errors.push(`duplicate requirement_id ${r.requirement_id}`)
    if (r?.requirement_id) ids.add(r.requirement_id)
    errors.push(...validateRecord(r, i))
  }
  if (doc?.requirement_count && doc.requirement_count !== records.length) {
    errors.push(`requirement_count ${doc.requirement_count} != records ${records.length}`)
  }
  if (!doc?.governance_head) errors.push('source has no AES governance_head')
  if (!doc?.product_head) errors.push('source has no Uter product_head')
  const head = doc?.product_head ? headCompatibility(doc.product_head, gitHead(root), root) : { ok: false, reason: 'no product_head' }
  if (!head.ok) errors.push(`SHA/HEAD mismatch: ${head.reason}`)
  const ageH = doc?.generated_at ? (Date.now() - new Date(doc.generated_at).getTime()) / 3600000 : Infinity
  if (!Number.isFinite(ageH) || ageH > maxAgeHours) errors.push(`source evidence stale: ${Number.isFinite(ageH) ? ageH.toFixed(1) + 'h' : 'unknown'}`)
  if (expectedHead && doc?.product_head !== expectedHead) errors.push('source product_head differs from expectedHead')
  return {
    verdict: errors.length ? 'FAIL' : 'PASS',
    errors: errors.slice(0, 40), error_count: errors.length,
    record_count: records.length, unique_ids: ids.size,
    head_policy: head, age_hours: Number(ageH.toFixed(2)),
  }
}

function counts(records, field) {
  return records.reduce((a, r) => { const k = r[field] ?? 'MISSING'; a[k] = (a[k] || 0) + 1; return a }, {})
}

export function renderMarkdown(doc, check) {
  const byDomain = {}
  for (const r of doc.records) {
    const d = r.applicability?.domain || 'UNBOUND'
    byDomain[d] = (byDomain[d] || 0) + 1
  }
  const lines = [
    '# AES → Uter Requirement Traceability Matrix',
    '',
    '**Generated by:** `tools/aes/build-traceability.mjs` (do not hand-edit).',
    `**Generated at:** ${doc.generated_at}`,
    `**Normative source:** ${doc.source}`,
    `**AES governance HEAD:** \`${doc.governance_head}\``,
    `**Uter product HEAD:** \`${doc.product_head}\``,
    `**Authoritative full matrix:** \`${JSONL_REL}\` (${doc.requirement_count} records, one JSON object per requirement).`,
    `**Integrity:** ${check.verdict} — 12 fields per record, 7-state model, no forged PASS.`,
    '',
    '> This file replaces the retired 23-row domain index. Every one of the 2,150 AES',
    '> requirements is re-derived from the AES requirement registry; the old',
    '> `TRACEABILITY.md` was NOT trusted. A verifier binding proves coverage only.',
    '> Grouped domain-gate execution is never promoted to a per-requirement PASS.',
    '',
    '## Mandatory record fields',
    '',
    REQUIRED_FIELDS.map((f) => `- \`${f}\``).join('\n'),
    '',
    '## Status distribution (honest, unverified states preserved)',
    '',
    '| execution_status | count |', '|---|---:|',
    ...Object.entries(counts(doc.records, 'execution_status')).sort().map(([k, v]) => `| ${k} | ${v} |`),
    '',
    '| final_status | count |', '|---|---:|',
    ...Object.entries(counts(doc.records, 'final_status')).sort().map(([k, v]) => `| ${k} | ${v} |`),
    '',
    '| independent_verification | count |', '|---|---:|',
    ...Object.entries(counts(doc.records, 'independent_verification')).sort().map(([k, v]) => `| ${k} | ${v} |`),
    '',
    '## Requirements by domain',
    '',
    '| Domain | Requirements |', '|---|---:|',
    ...Object.entries(byDomain).sort().map(([k, v]) => `| ${k} | ${v} |`),
    '',
    '## Acceptance rule',
    '',
    '`final_status = PASS` is only legitimate when `execution_status` reflects a real,',
    'current, SHA-bound command execution, `evidence` is non-empty, and',
    '`independent_verification = VERIFIED`. Until then the repository remains',
    '`MIGRATION_PENDING` and cannot be reported as `FULLY_COMPLIANT`.',
    '',
    '## Verification',
    '',
    '```sh',
    'node tools/aes/build-traceability.mjs --verify',
    'node --test tools/aes/build-traceability.test.mjs',
    '```',
    '',
  ]
  return lines.join('\n')
}

export function build({ sourcePath = DEFAULT_SOURCE, root = ROOT } = {}) {
  if (!existsSync(sourcePath)) throw new Error(`AES emitted requirement map missing: ${sourcePath}`)
  const doc = JSON.parse(readFileSync(sourcePath, 'utf8'))
  const check = validateSource(doc, { root })
  const jsonl = doc.records.map((r) => JSON.stringify(r)).join('\n') + '\n'
  const buf = Buffer.from(jsonl, 'utf8')
  mkdirSync(dirname(join(root, JSONL_REL)), { recursive: true })
  mkdirSync(dirname(join(root, REPORT_REL)), { recursive: true })
  writeFileSync(join(root, JSONL_REL), buf)
  writeFileSync(join(root, MD_REL), renderMarkdown(doc, check))
  const report = {
    report_id: 'UTER-REQUIREMENT-TRACEABILITY-VERIFICATION',
    tool_id: TOOL_ID, generated_at: new Date().toISOString(),
    source: sourcePath, jsonl: JSONL_REL,
    jsonl_sha256: sha256(buf), jsonl_bytes: buf.length,
    record_count: doc.records.length,
    governance_head: doc.governance_head, product_head: doc.product_head,
    current_product_head: gitHead(root), head_policy: check.head_policy,
    by_execution_status: counts(doc.records, 'execution_status'),
    by_final_status: counts(doc.records, 'final_status'),
    verdict: check.verdict, error_count: check.error_count, errors: check.errors,
  }
  writeFileSync(join(root, REPORT_REL), JSON.stringify(report, null, 2) + '\n')
  return { report, check }
}

/** Re-verify the emitted matrix from disk, recomputing the digest. */
export function verify({ root = ROOT, maxAgeHours = 24 } = {}) {
  const errors = []
  const jsonlPath = join(root, JSONL_REL)
  const reportPath = join(root, REPORT_REL)
  if (!existsSync(jsonlPath)) return { verdict: 'FAIL', errors: [`matrix missing: ${JSONL_REL}`] }
  if (!existsSync(reportPath)) return { verdict: 'FAIL', errors: [`verification report missing: ${REPORT_REL}`] }
  const buf = readFileSync(jsonlPath)
  const report = JSON.parse(readFileSync(reportPath, 'utf8'))
  if (buf.length !== report.jsonl_bytes) errors.push(`byte count ${buf.length} != sealed ${report.jsonl_bytes}`)
  if (sha256(buf) !== report.jsonl_sha256) errors.push('matrix SHA-256 mismatch (tampered or regenerated)')
  const lines = buf.toString('utf8').trim().split('\n').filter(Boolean)
  if (lines.length !== 2150) errors.push(`matrix line count ${lines.length} != 2150`)
  let records = []
  try { records = lines.map((l) => JSON.parse(l)) } catch (e) { errors.push(`unparseable matrix line: ${e.message}`) }
  const seen = new Set()
  records.forEach((r, i) => {
    if (seen.has(r?.requirement_id)) errors.push(`duplicate requirement_id ${r.requirement_id}`)
    if (r?.requirement_id) seen.add(r.requirement_id)
    errors.push(...validateRecord(r, i))
  })
  const head = headCompatibility(report.product_head, gitHead(root), root)
  if (!head.ok) errors.push(`SHA/HEAD mismatch: ${head.reason}`)
  const ageH = (Date.now() - new Date(report.generated_at).getTime()) / 3600000
  if (!Number.isFinite(ageH) || ageH > maxAgeHours) errors.push(`verification stale: ${ageH.toFixed(1)}h > ${maxAgeHours}h`)
  if (statSync(join(root, MD_REL)).size < 200) errors.push('TRACEABILITY.md is empty or truncated')
  return {
    verdict: errors.length ? 'FAIL' : 'PASS',
    record_count: records.length, unique_ids: seen.size,
    head_policy: head, age_hours: Number(ageH.toFixed(2)),
    error_count: errors.length, errors: errors.slice(0, 40),
  }
}

const isCli = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)
if (isCli) {
  const argv = process.argv.slice(2)
  const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null }
  const root = arg('--root') || ROOT
  if (argv.includes('--verify')) {
    const r = verify({ root, maxAgeHours: Number(arg('--max-age-hours') || 24) })
    console.log(JSON.stringify(r, null, 2))
    process.exitCode = r.verdict === 'PASS' ? 0 : 1
  } else {
    const out = build({ sourcePath: arg('--source') || DEFAULT_SOURCE, root })
    console.log(`records=${out.report.record_count} sha256=${out.report.jsonl_sha256.slice(0, 16)} verdict=${out.report.verdict} errors=${out.report.error_count}`)
    console.log(`written: ${JSONL_REL}, ${MD_REL}, ${REPORT_REL}`)
    if (out.report.error_count) for (const e of out.report.errors.slice(0, 10)) console.error(`  ${e}`)
  }
}
