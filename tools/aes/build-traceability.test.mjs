#!/usr/bin/env node
/** Positive / negative controls for the 2,150-record traceability matrix. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, appendFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import {
  REQUIRED_FIELDS, STATE_MODEL, validateRecord, validateSource,
  headCompatibility, isOutputOnlyPath, build, verify,
} from './build-traceability.mjs'

const now = () => new Date().toISOString()

function git(root, args) {
  return spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' })
}
function commitAll(root, message) {
  git(root, ['add', '-A'])
  const r = git(root, ['-c', 'user.email=test@example.invalid', '-c', 'user.name=Fixture', 'commit', '-q', '-m', message])
  assert.equal(r.status, 0, `fixture commit failed: ${r.stderr}`)
}
function fixtureRepo() {
  const root = mkdtempSync(join(tmpdir(), 'uter-trace-'))
  git(root, ['init', '-q'])
  mkdirSync(join(root, '.aes', 'reports'), { recursive: true })
  writeFileSync(join(root, '.aes', 'seed.txt'), 'seed\n')
  commitAll(root, 'fixture seed')
  return { root, head: git(root, ['rev-parse', 'HEAD']).stdout.trim() }
}
function record(i) {
  const id = `AES-00-${String(i + 1).padStart(4, '0')}-M001`
  return {
    requirement_id: id, source_standard: 'AES-00-001', source_version: '1.1.0',
    requirement_level: 'MUST',
    applicability: { project: 'uter', phase: 'P00', domain: 'AES-00', status: 'ACTIVE' },
    implementation: [{ validator_id: 'AES-VAL-SPEC', repository: 'GOVERNANCE', path: 'quality/scripts/aes/spec-integrity.mjs', digest_sha256: 'a'.repeat(64) }],
    verifier: { validator_ids: ['AES-VAL-SPEC'], primary: 'quality/scripts/aes/spec-integrity.mjs', commands: ['node x.mjs'] },
    test_cases: [{ validator_id: 'AES-VAL-SPEC', suite: 'quality/scripts/aes/spec-integrity.test.mjs', exists: true }],
    execution_status: 'NOT_RUN', evidence: [], independent_verification: 'NOT_VERIFIED',
    final_status: 'NOT_VERIFIED',
  }
}
function doc(head, { count = 2150, generatedAt = now(), mutate = null } = {}) {
  const records = Array.from({ length: count }, (_, i) => record(i))
  if (mutate) mutate(records)
  return {
    report_id: 'UTER-AES-REQUIREMENT-TRACEABILITY', generated_at: generatedAt,
    governance_head: 'b'.repeat(40), product_head: head,
    source: 'fixture', requirement_count: count, records,
  }
}
function writeSource(root, d) {
  const p = join(root, '.aes', 'reports', 'AES-REQUIREMENT-MAP.json')
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(d))
  return p
}
function cleanup(root) { rmSync(root, { recursive: true, force: true }) }

test('PC-01: a complete current matrix builds and re-verifies PASS', () => {
  const { root, head } = fixtureRepo()
  try {
    const src = writeSource(root, doc(head))
    const out = build({ sourcePath: src, root })
    assert.equal(out.report.record_count, 2150)
    assert.equal(out.report.verdict, 'PASS')
    assert.equal(out.report.error_count, 0)
    const r = verify({ root })
    assert.equal(r.verdict, 'PASS', JSON.stringify(r.errors))
    assert.equal(r.record_count, 2150)
    assert.equal(r.unique_ids, 2150)
    const lines = readFileSync(join(root, '.aes/TRACEABILITY.jsonl'), 'utf8').trim().split('\n')
    assert.equal(lines.length, 2150)
    assert.deepEqual(Object.keys(JSON.parse(lines[0])).filter((k) => REQUIRED_FIELDS.includes(k)).length, 12)
  } finally { cleanup(root) }
})

test('PC-02: generated markdown exists and carries the honest state counts', () => {
  const { root, head } = fixtureRepo()
  try {
    build({ sourcePath: writeSource(root, doc(head)), root })
    const md = readFileSync(join(root, '.aes/TRACEABILITY.md'), 'utf8')
    assert.match(md, /MIGRATION_PENDING/)
    assert.match(md, /NOT_VERIFIED \| 2150/)
    assert.match(md, /TRACEABILITY\.jsonl/)
  } finally { cleanup(root) }
})

test('PC-03: an evidence-only commit does not invalidate the SHA-bound matrix', () => {
  const { root, head } = fixtureRepo()
  try {
    build({ sourcePath: writeSource(root, doc(head)), root })
    writeFileSync(join(root, '.aes/reports/extra.json'), '{}\n')
    commitAll(root, 'refresh evidence only')
    assert.equal(verify({ root }).verdict, 'PASS')
  } finally { cleanup(root) }
})

test('NC-01: a missing mandatory field is rejected', () => {
  const r = record(0); delete r.source_version
  assert.ok(validateRecord(r, 0).some((e) => e.includes('source_version')))
})

test('NC-02: a forged per-requirement PASS without evidence is rejected', () => {
  const r = record(0); r.final_status = 'PASS'
  assert.ok(validateRecord(r, 0).some((e) => e.includes('forged PASS')))
})

test('NC-03: PASS with NOT_RUN execution is rejected', () => {
  const r = record(0); r.final_status = 'PASS'; r.independent_verification = 'VERIFIED'
  r.evidence = [{ id: 'fake' }]
  assert.ok(validateRecord(r, 0).some((e) => e.includes('NOT_RUN')))
})

test('NC-04: a state outside the 7-state model is rejected', () => {
  const r = record(0); r.final_status = 'GREEN'
  assert.ok(validateRecord(r, 0).some((e) => e.includes('7-state model')))
  assert.equal(STATE_MODEL.length, 7)
})

test('NC-05: duplicate requirement IDs are rejected', () => {
  const { root, head } = fixtureRepo()
  try {
    const d = doc(head, { mutate: (rs) => { rs[1].requirement_id = rs[0].requirement_id } })
    writeSource(root, d)
    const r = validateSource(d, { root })
    assert.equal(r.verdict, 'FAIL')
    assert.ok(r.errors.some((e) => e.includes('duplicate requirement_id')))
  } finally { cleanup(root) }
})

test('NC-06: a truncated matrix (2149 records) is rejected', () => {
  const { root, head } = fixtureRepo()
  try {
    const r = validateSource(doc(head, { count: 2149 }), { root })
    assert.equal(r.verdict, 'FAIL')
    assert.ok(r.errors.some((e) => e.includes('expected 2150')))
  } finally { cleanup(root) }
})

test('NC-07: evidence bound to a foreign HEAD is rejected', () => {
  const { root } = fixtureRepo()
  try {
    const r = validateSource(doc('c'.repeat(40)), { root })
    assert.equal(r.verdict, 'FAIL')
    assert.ok(r.errors.some((e) => e.includes('SHA/HEAD mismatch')))
  } finally { cleanup(root) }
})

test('NC-08: stale evidence (48h) is rejected', () => {
  const { root, head } = fixtureRepo()
  try {
    const r = validateSource(doc(head, { generatedAt: new Date(Date.now() - 48 * 3600000).toISOString() }), { root })
    assert.equal(r.verdict, 'FAIL')
    assert.ok(r.errors.some((e) => e.includes('stale')))
  } finally { cleanup(root) }
})

test('NC-09: tampering with one byte of the matrix is detected', () => {
  const { root, head } = fixtureRepo()
  try {
    build({ sourcePath: writeSource(root, doc(head)), root })
    appendFileSync(join(root, '.aes/TRACEABILITY.jsonl'), ' ')
    const r = verify({ root })
    assert.equal(r.verdict, 'FAIL')
    assert.ok(r.errors.some((e) => e.includes('SHA-256 mismatch')))
  } finally { cleanup(root) }
})

test('NC-10: deleting the matrix fails closed', () => {
  const { root, head } = fixtureRepo()
  try {
    build({ sourcePath: writeSource(root, doc(head)), root })
    rmSync(join(root, '.aes/TRACEABILITY.jsonl'))
    const r = verify({ root })
    assert.equal(r.verdict, 'FAIL')
    assert.ok(r.errors.some((e) => e.includes('matrix missing')))
  } finally { cleanup(root) }
})

test('NC-11: a commit touching governed source invalidates the matrix', () => {
  const { root, head } = fixtureRepo()
  try {
    build({ sourcePath: writeSource(root, doc(head)), root })
    mkdirSync(join(root, 'tools'), { recursive: true })
    writeFileSync(join(root, 'tools/changed.mjs'), '// governed source change\n')
    commitAll(root, 'change governed source')
    const r = verify({ root })
    assert.equal(r.verdict, 'FAIL')
    assert.ok(r.errors.some((e) => e.includes('SHA/HEAD mismatch')))
  } finally { cleanup(root) }
})

test('NC-12: output-only path classification never hides a governed input', () => {
  assert.equal(isOutputOnlyPath('.aes/reports/x.json'), true)
  assert.equal(isOutputOnlyPath('.aes/TRACEABILITY.jsonl'), true)
  assert.equal(isOutputOnlyPath('tools/aes/verifier.mjs'), false)
  assert.equal(isOutputOnlyPath('.github/workflows/ci.yml'), false)
  const { root, head } = fixtureRepo()
  try {
    assert.equal(headCompatibility(head, head, root).ok, true)
  } finally { cleanup(root) }
})
