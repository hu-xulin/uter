#!/usr/bin/env node
/** One explicit negative control per hard gate, plus positive baseline. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { RULES, baselineCtx, decide, STATE_MODEL, TOOL_ID } from './uter-governance-hard-gates.mjs'

const byId = Object.fromEntries(RULES.map(([id, name, fn]) => [id, { name, fn }]))
const run = (id, ctx) => byId[id].fn(ctx)
const rejects = (id, ctx, needle) => {
  const r = run(id, ctx)
  assert.equal(r.status, 'FAIL', `${id} unexpectedly ${r.status}: ${r.detail}`)
  if (needle) assert.match(r.detail, needle)
}
const baseline = () => baselineCtx()

test('PC-01: the unmodified control context passes all 10 hard gates', () => {
  const ctx = baseline()
  for (const [id] of RULES) assert.equal(run(id, ctx).status, 'PASS', `${id}: ${run(id, ctx).detail}`)
  assert.equal(decide(RULES.map(([id, , fn]) => ({ status: fn(ctx).status }))).verdict, 'PASS')
  assert.equal(RULES.length, 10)
  assert.equal(STATE_MODEL.length, 7)
  assert.match(TOOL_ID, /uter-governance-hard-gates/)
})

test('NC-01 / HG-01: a missing normative specification FAILs', () => {
  const ctx = baseline(); ctx.artifacts['.aes/INTEGRATION.md'] = { exists: false, bytes: 0 }
  rejects('HG-01', ctx, /missing\/empty normative artifact/)
})

test('NC-02 / HG-01: an empty (0-byte) specification is not a PASS', () => {
  const ctx = baseline(); ctx.artifacts['.aes/agent-governance.yaml'] = { exists: true, bytes: 0 }
  rejects('HG-01', ctx, /agent-governance\.yaml/)
})

test('NC-03 / HG-02: a second normative source or duplicate ID FAILs', () => {
  const ctx = baseline(); ctx.uaesActive = true
  rejects('HG-02', ctx, /\.uaes\//)
  const ctx2 = baseline(); ctx2.duplicateRegistryIds = ['UTER-P13-001']
  rejects('HG-02', ctx2, /duplicate registry IDs/)
  const ctx3 = baseline(); ctx3.normativeAuthorityCount = 2
  rejects('HG-02', ctx3, /normative authority/)
})

test('NC-04 / HG-03: a requirement without a verifier FAILs', () => {
  const ctx = baseline(); ctx.records[7].verifier = {}
  rejects('HG-03', ctx, /no verifier binding/)
  const ctx2 = baseline(); ctx2.records.pop()
  rejects('HG-03', ctx2, /expected 2150/)
})

test('NC-05 / HG-04: a verifier whose implementation does not exist FAILs', () => {
  const ctx = baseline(); ctx.records[3].implementation[0].digest_sha256 = null
  rejects('HG-04', ctx, /non-existent verifier implementation/)
  const ctx2 = baseline(); ctx2.implementationPathsMissing = ['quality/scripts/aes/fake.mjs']
  rejects('HG-04', ctx2, /missing on disk/)
})

test('NC-06 / HG-05: a requirement without tests, or a missing negative suite, FAILs', () => {
  const ctx = baseline(); ctx.records[11].test_cases = []
  rejects('HG-05', ctx, /no executable test suite/)
  const ctx2 = baseline(); ctx2.negativeSuitesExist = false
  rejects('HG-05', ctx2, /negative-control suites/)
})

test('NC-07 / HG-06: missing or stale evidence FAILs', () => {
  const ctx = baseline(); ctx.manifest = null
  rejects('HG-06', ctx, /missing/)
  const ctx2 = baseline(); ctx2.manifestAgeHours = 43.6
  rejects('HG-06', ctx2, /stale/)
  const ctx3 = baseline(); ctx3.manifest.entry_count = 3
  rejects('HG-06', ctx3, /incomplete/)
})

test('NC-08 / HG-07: evidence bound to a different revision FAILs', () => {
  const ctx = baseline(); ctx.headPolicy = { ok: false, reason: 'commit abc changed governed input' }
  rejects('HG-07', ctx, /HEAD mismatch/)
  const ctx2 = baseline(); ctx2.manifest.product_head = 'not-a-sha'
  rejects('HG-07', ctx2, /valid AES \+ Uter HEAD SHAs/)
  // The AES revision the evidence was produced against must still be current
  // for the AES governed inputs; a moved AES HEAD is a SHA mismatch.
  const ctx3 = baseline()
  ctx3.governanceHeadPolicy = { ok: false, reason: 'commit deadbeef changed governed input quality/scripts/aes/spec-integrity.mjs' }
  rejects('HG-07', ctx3, /AES HEAD mismatch/)
  const ctx4 = baseline()
  ctx4.governanceHeadPolicy = { ok: false, reason: 'cannot read the AES output-only policy (fail-closed)' }
  rejects('HG-07', ctx4, /AES HEAD mismatch/)
})

test('NC-09 / HG-08: agent privilege escalation FAILs', () => {
  const ctx = baseline(); ctx.agent.default_effect = 'ALLOW'
  rejects('HG-08', ctx, /default_effect/)
  const ctx2 = baseline(); ctx2.agent.execution_policy.forbidden = ctx2.agent.execution_policy.forbidden.filter((x) => x !== 'git.push.main')
  rejects('HG-08', ctx2, /git\.push\.main/)
  const ctx3 = baseline(); ctx3.agent.execution_policy.current_execution_branch = 'feature/x'
  rejects('HG-08', ctx3, /non-main execution branch/)
  const ctx4 = baseline(); ctx4.agent.execution_policy.runtime_agent_verification_required = false
  rejects('HG-08', ctx4, /runtime verification/)
})

test('NC-10 / HG-09: a CI security-gate bypass FAILs', () => {
  const cases = [
    'name: CI\n  continue-on-error: true\n',
    'run: git commit --no-verify -m x\n',
    'run: |\n  set +e\n  node gate.mjs\n',
    'run: node scripts/quality/verify-gate.mjs || true\n',
    'permissions:\n  contents: write\nrun: git push origin HEAD:main\n',
    'run: git commit -m "x [skip ci]"\n',
  ]
  for (const text of cases) {
    const ctx = baseline(); ctx.workflows = { 'ci.yml': text }
    rejects('HG-09', ctx)
  }
})

test('NC-11 / HG-10: an unapproved forced specification change FAILs', () => {
  const ctx = baseline(); ctx.pinCheck = { exit_code: 1, output: 'FAIL: pin is missing required field' }
  rejects('HG-10', ctx, /aes-pin-check FAIL/)
  const ctx2 = baseline(); ctx2.fingerprint = { status: 'FAIL', detail: 'pin=aaa vs AES=bbb' }
  rejects('HG-10', ctx2, /fingerprint mismatch/)
})

test('NC-12: any single FAIL dominates the aggregate verdict', () => {
  const results = RULES.map(([id, , fn]) => ({ id, status: fn(baseline()).status }))
  results[4].status = 'FAIL'
  assert.equal(decide(results).verdict, 'FAIL')
  assert.equal(decide(results.map((r) => ({ ...r, status: 'PASS' }))).verdict, 'PASS')
})

test('PC-02: a diagnostic `|| true` outside a check line is not a false positive', () => {
  const ctx = baseline()
  ctx.workflows = { 'ci.yml': 'run: |\n  [ -n "$file" ] && gofmt -d "$file" || true\n  exit 1\n' }
  assert.equal(run('HG-09', ctx).status, 'PASS')
})
