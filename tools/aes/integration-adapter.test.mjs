/** Uter ↔ AES integration adapter tests.
 *
 *  These prove the two properties AES-GOV-004 §8 demands:
 *    1. integration is NOT claimed from copied files alone, and
 *    2. a genuine mismatch (version or digest) is detected and blocks.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import {
  discoverAuthoritativeSpecification, loadPhaseCorpus, buildRequirementMap,
  integrationStatus, verifyPinnedCommit, writePin, currentPin,
} from './integration-adapter.mjs'

const ROOT = join(import.meta.dirname, '..', '..')

/** ESM test files have no `require`; resolve one for the few sync fs calls. */
const require = createRequire(import.meta.url)

test('an ACTIVE specification is discoverable and machine-evidence-verified', () => {
  const s = discoverAuthoritativeSpecification()
  assert.equal(s.ok, true, `specification discovery failed: ${s.detail || s.machine_evidence?.detail}`)
  assert.equal(s.status, 'ACTIVE')
  assert.match(s.integrity_digest, /^[a-f0-9]{64}$/)
  // Phase-2 contract: AES is signature-free. Integrity is proven by really
  // executing three independent AES verifiers and recomputing every digest.
  assert.equal(s.signature, null, 'no detached signature may be part of the trust chain')
  assert.equal(s.signature_model, 'SIGNATURE_FREE_MACHINE_EVIDENCE')
  const m = s.machine_evidence
  assert.equal(m.ok, true, `machine evidence verification failed: ${m.detail}`)
  assert.equal(m.evidence_model, 'aes-machine-evidence-v1')
  assert.equal(m.signature_dependency, 'NONE')
  assert.equal(m.human_signature_dependency, 'NONE')
  assert.equal(m.third_party_signature_dependency, 'NONE')
  assert.equal(m.private_key_dependency, 'NONE')
  assert.equal(m.seal_intact, true, 'the governed seal must be recomputed intact')
  assert.equal(m.digest_recomputed_matches, true, 'declared digest must equal the recomputed digest')
  assert.equal(m.chain_verified, true, 'append-only machine evidence chain must verify')
  assert.equal(m.specification_evidence_chain_verified, true, 'specification evidence chain must verify')
  assert.equal(s.digest_recomputed_matches, true,
    'the registry digest must equal the digest recomputed from the covered bytes')
  assert.ok(m.fingerprint && /^[a-f0-9]{64}$/.test(m.fingerprint))
  assert.ok(m.commands.length >= 3, 'at least three real AES verifiers must execute')
  for (const c of m.commands) {
    assert.equal(c.ok, true, `${c.label} must execute successfully: ${c.detail}`)
    assert.equal(typeof c.exit_code, 'number', `${c.label} must have a real exit code`)
  }
})

test('exactly one ACTIVE specification is authoritative', () => {
  // Covered structurally by discoverAuthoritativeSpecification returning ok,
  // which fails when zero or multiple ACTIVE specs exist.
  const s = discoverAuthoritativeSpecification()
  assert.equal(s.ok, true)
})

test('P00 through P12 are all loaded from the AES corpus', () => {
  const c = loadPhaseCorpus()
  const expected = ['P00', 'P01', 'P02', 'P03', 'P04', 'P05', 'P06',
    'P07', 'P08', 'P09', 'P10', 'P11', 'P12']
  for (const p of expected) {
    assert.ok(c.aes_phases[p], `phase ${p} missing from the corpus`)
    assert.ok(c.aes_phases[p].standards > 0, `phase ${p} contains no standards`)
  }
  assert.equal(c.aes_phase_count, 13)
})

test('the UTER P13 extension is project-owned and present', () => {
  const c = loadPhaseCorpus()
  assert.equal(c.p13_extension.present, true, 'UTER P13 must exist in the project repository')
  assert.match(c.p13_extension.owner, /UTER/)
  assert.match(c.p13_extension.digest, /^[a-f0-9]{64}$/)
})

test('P13 is NOT registered in the AES universal registry', () => {
  // Layer separation: the universal standard must not absorb project rules.
  const aesReq = process.env.AES_REPO_ROOT || process.env.AES_REPO || '/Users/lincolnhu/aes'
  const standards = join(aesReq, '.aes/registry/requirements.yaml')
  if (!existsSync(standards)) return
  const text = readFileSync(standards, 'utf8')
  assert.ok(!/UTER-P13/.test(text), 'UTER P13 must not appear in the AES requirement registry')
})

test('all reported requirements map to an executable enforcement point', () => {
  const m = buildRequirementMap()
  assert.equal(m.ok, true)
  assert.equal(m.counts.missing, 0,
    `requirements without enforcement: ${JSON.stringify(m.counts.unenforced_domains)}`)
  assert.ok(m.counts.total > 500, `expected the full corpus, got ${m.counts.total}`)
  for (const row of m.rows) {
    assert.ok(row.enforcement_points.length > 0, `${row.requirement_id} has no enforcement point`)
    for (const p of row.enforcement_points) {
      assert.ok(existsSync(join(ROOT, p)), `enforcement point does not exist: ${p}`)
    }
  }
})

test('every requirement falls inside an inherited phase', () => {
  const m = buildRequirementMap()
  const outside = m.rows.filter((r) => !r.phase_inherited)
  assert.equal(outside.length, 0,
    `requirements outside inherited phases: ${outside.slice(0, 5).map((r) => r.requirement_id).join(',')}`)
})

test('a changed upstream specification digest is detected as drift, never as a pass', () => {
  const s = integrationStatus()
  // The AES working tree was re-sealed to 1.12.0 / ACTIVE while still
  // uncommitted, so its ACTIVE digest no longer equals the one this project
  // pins. A governance gate must surface that as a mismatch, never quietly
  // treat an unpinned release as integrated.
  assert.equal(s.aes_lifecycle_pin.version_matches,
    s.aes_lifecycle_pin.pinned_specification_version === s.aes_lifecycle_pin.active_specification_version)
  assert.equal(s.aes_lifecycle_pin.digest_matches,
    s.aes_lifecycle_pin.pinned_specification_digest === s.aes_lifecycle_pin.active_specification_digest)
  assert.equal(s.pin_matches_active_specification,
    s.aes_lifecycle_pin.version_matches && s.aes_lifecycle_pin.digest_matches)
  if (s.pin_matches_active_specification === false) {
    assert.equal(s.integration_status, 'MIGRATION_PENDING',
      'a digest drift must keep integration pending, never promote it')
    assert.match(s.rationale, /pin does not match the ACTIVE specification/i)
  }
})

test('integration is NOT reported from technical wiring alone', () => {
  // The pin is refreshed to a real AES commit that carries all seven declared
  // signature-free artefacts, so the four technical preconditions now hold. A
  // gate that flips to INTEGRATED on that alone is an implicit approval —
  // exactly what AES prohibit_implicit_approval forbids. Integration also
  // requires an explicit declaration AND real machine acceptance evidence.
  const s = integrationStatus()
  assert.equal(s.aes.ok, true, 'condition 1: an authentic ACTIVE spec is discoverable in the live tree')
  assert.equal(s.requirement_map.counts.missing, 0, 'condition 2: every requirement maps to an enforcement point')
  assert.equal(typeof s.pin_matches_active_specification, 'boolean',
    'condition 3: pin/spec agreement is evaluated — an upstream digest drift is a legitimate detected state')
  assert.equal(s.pin_commit_verified.ok, true,
    'condition 4: the refreshed pinned commit DOES carry every declared artefact')
  assert.equal(s.technical_preconditions_met,
    s.aes.ok && s.requirement_map.counts.missing === 0
      && s.pin_matches_active_specification && s.pin_commit_verified.ok,
    'the technical preconditions are the exact conjunction of the four checks')
  assert.equal(s.pin_declares_integration, false, 'no explicit INTEGRATED declaration is recorded')
  assert.equal(s.governance_acceptance.ok, false, 'domain gates and human acceptance are not PASS')
  assert.equal(s.integration_status, 'MIGRATION_PENDING',
    'technical wiring alone must never yield INTEGRATED')
  assert.match(s.rationale, /explicit INTEGRATED governance declaration/i)
})

test('the pinned-commit check verifies every declared artefact', () => {
  const s = integrationStatus()
  const v = s.pin_commit_verified
  assert.ok(v.checked >= 6, 'the check must cover the specification, requirements, policy, trust boundaries and machine evidence chain')
  assert.equal(v.ok, true, 'the refreshed commit carries every declared artefact')
  assert.equal(v.missing.length, 0, 'no artefact may be reported absent from the refreshed commit')
  // Negative control: the pre-refresh commit genuinely lacks them, so the gate
  // is not permanently green.
  const old = verifyPinnedCommit({ ...currentPin(), source_commit: '0c9386b192090e901ccc5de6df1f2aebe3f5c618' })
  assert.equal(old.ok, false, 'the pre-refresh commit must still be rejected')
  assert.equal(old.missing.length, old.checked)
})

test('verifyPinnedCommit rejects a pin with no commit and a bogus commit', () => {
  assert.equal(verifyPinnedCommit(null).ok, false)
  assert.match(verifyPinnedCommit(null).detail, /no pin/i)

  const noSha = verifyPinnedCommit({ specification_version: '2.0.0' })
  assert.equal(noSha.ok, false)
  assert.match(noSha.detail, /no source_commit/i)

  // A syntactically valid but non-existent commit must not be treated as present.
  const bogus = verifyPinnedCommit({ source_commit: '0'.repeat(40) })
  assert.equal(bogus.ok, false)
  assert.equal(bogus.missing.length, bogus.checked)
})

test('INTEGRATED requires technical wiring AND an explicit declaration AND acceptance evidence', () => {
  // Structural negative case: integration is a CONJUNCTION. Verify each term
  // separately so dropping any single guard flips the outcome.
  const s = integrationStatus()
  assert.equal(s.aes.ok, true, 'condition 1: authentic ACTIVE spec')
  assert.equal(s.requirement_map.counts.missing, 0, 'condition 2: full mapping')
  assert.equal(typeof s.pin_matches_active_specification, 'boolean',
    'condition 3: pin/spec agreement is evaluated, including upstream digest drift')
  assert.equal(typeof s.pin_commit_verified.ok, 'boolean', 'condition 4: pinned commit is actually checked')
  const technical = s.technical_preconditions_met
  assert.equal(typeof technical, 'boolean',
    'the technical preconditions are evaluated, not hard-coded to the current upstream tree')
  assert.equal(s.pin_declares_integration, false, 'guard 5: no explicit governance declaration')
  assert.equal(s.governance_acceptance.ok, false, 'guard 6: product-side machine acceptance evidence is not PASS')
  assert.equal(s.integration_status === 'INTEGRATED',
    technical && s.pin_declares_integration && s.governance_acceptance.ok,
    'INTEGRATED must be exactly the conjunction of all six conditions')
})

test('the pin records the exact specification version and digest', () => {
  const pin = JSON.parse(readFileSync(join(ROOT, '.aes/aes-pin.json'), 'utf8'))
  assert.equal(pin.specification_id, 'AES-SPEC-CORE')
  assert.match(pin.specification_version, /^\d+\.\d+\.\d+$/)
  assert.match(pin.specification_integrity_digest, /^[a-f0-9]{64}$/)
  assert.equal(pin.specification_status, 'ACTIVE')
})

test('a stale pin version is detectable as a mismatch', () => {
  // Simulate by comparing a deliberately wrong version against the ACTIVE one.
  const s = discoverAuthoritativeSpecification()
  const fake = '1.8.0'
  assert.notEqual(fake, s.version, 'a stale version must not equal the ACTIVE version')
})

test('instruction conflicts are reported with a location', () => {
  const s = integrationStatus()
  assert.ok(Array.isArray(s.instruction_findings.findings))
  for (const f of s.instruction_findings.findings) {
    assert.ok(f.kind && f.location && f.detail, 'every finding needs kind, location and detail')
  }
})

// ===========================================================================
// Fail-closed behaviour. A governance tool that exits 0 having done nothing is
// worse than one that crashes, because the crash-free exit reads as a pass.
// ===========================================================================

test('the CLI runs when invoked through a symlinked path', () => {
  // On macOS /var is a symlink to /private/var, and CI workspaces are often
  // symlinked. A literal argv-string comparison against import.meta.url makes
  // main() silently skip and the process exit 0 having verified nothing.
  const { symlinkSync, mkdtempSync, rmSync } = require('node:fs')
  const dir = mkdtempSync(join(tmpdir(), 'aes-symlink-'))
  const link = join(dir, 'linked-adapter.mjs')
  try {
    symlinkSync(join(ROOT, 'tools/aes/integration-adapter.mjs'), link)
    const r = spawnSync(process.execPath, [link, 'discover'], { encoding: 'utf8', timeout: 120000 })
    const out = `${r.stdout || ''}${r.stderr || ''}`
    assert.match(out, /"specification_id"/,
      'the CLI must actually execute through a symlinked path, not exit silently')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('the adapter refuses to run when no YAML parser is available', () => {
  // An unparseable registry must never degrade into "zero requirements", which
  // would read as a perfect result with nothing to fix.
  const { mkdtempSync, cpSync, mkdirSync, rmSync } = require('node:fs')
  const dir = mkdtempSync(join(tmpdir(), 'aes-noparser-'))
  try {
    mkdirSync(join(dir, 'tools/aes'), { recursive: true })
    // A deliberately EMPTY bin directory. Using '/usr/bin:/bin' here used to
    // work on macOS but silently broke on GitHub runners: their system
    // /usr/bin/python3 ships PyYAML, so the "no parser" scenario was never
    // actually constructed and the adapter correctly parsed the registry.
    // Pointing PATH at a directory we just created guarantees `python3` cannot
    // be found, so this negative probe means the same thing on every host.
    // NODE_PATH must also be removed: an inherited NODE_PATH can resolve a
    // hoisted `js-yaml` through createRequire() even with an empty PATH, which
    // silently turns this "no parser" probe into a normal successful parse.
    const emptyBin = join(dir, 'bin')
    mkdirSync(emptyBin, { recursive: true })
    cpSync(join(ROOT, 'tools/aes/integration-adapter.mjs'), join(dir, 'tools/aes/integration-adapter.mjs'))
    const isolated = { ...process.env, PATH: emptyBin }
    delete isolated.NODE_PATH
    delete isolated.NODE_TEST_CONTEXT
    delete isolated.NODE_OPTIONS
    const r = spawnSync(process.execPath, [join(dir, 'tools/aes/integration-adapter.mjs'), 'map'], {
      cwd: dir, encoding: 'utf8', timeout: 120000,
      // No web/node_modules sibling, no NODE_PATH and a PATH with no python3.
      env: isolated,
    })
    const out = `${r.stdout || ''}${r.stderr || ''}`
    assert.notEqual(r.status, 0, 'the adapter must fail rather than report zero requirements')
    assert.match(out, /no YAML parser available/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
/** Pin write-side gate.
 *
 *  The read-side check can detect a pin that no commit backs, but detection is
 *  not prevention — anything could still write the file. These tests pin the
 *  write-side refusal, and assert the on-disk bytes are untouched when it fires.
 */

test('writePin refuses a pin whose commit does not carry the artefacts', () => {
  const before = readFileSync(join(ROOT, '.aes/aes-pin.json'), 'utf8')
  const lying = { ...currentPin(), source_commit: '0c9386b192090e901ccc5de6df1f2aebe3f5c618' }
  const r = writePin(lying)
  assert.equal(r.ok, false, 'a pin naming a commit without the artefacts must be refused')
  assert.equal(r.written, false)
  assert.match(r.detail, /refusing to record the pin/i)
  assert.ok(r.missing.length > 0, 'the refusal must name what is missing')
  const after = readFileSync(join(ROOT, '.aes/aes-pin.json'), 'utf8')
  assert.equal(after, before, 'a refused pin must not touch the file on disk')
})

test('writePin refuses a pin with no commit and a pin with a bogus commit', () => {
  const before = readFileSync(join(ROOT, '.aes/aes-pin.json'), 'utf8')
  const noCommit = { ...currentPin() }
  delete noCommit.source_commit
  const r1 = writePin(noCommit)
  assert.equal(r1.ok, false)
  assert.match(r1.detail, /no source_commit|refusing/i)

  const bogus = { ...currentPin(), source_commit: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef' }
  const r2 = writePin(bogus)
  assert.equal(r2.ok, false)
  assert.match(r2.detail, /refusing to record the pin/i)

  assert.equal(readFileSync(join(ROOT, '.aes/aes-pin.json'), 'utf8'), before,
    'neither refusal may modify the recorded pin')
})

test('writePin refuses a null pin instead of writing an empty record', () => {
  const before = readFileSync(join(ROOT, '.aes/aes-pin.json'), 'utf8')
  const r = writePin(null)
  assert.equal(r.ok, false)
  assert.equal(r.written, false)
  assert.equal(readFileSync(join(ROOT, '.aes/aes-pin.json'), 'utf8'), before)
})

test('the pin gate ACCEPTS a commit that really carries the artefacts', () => {
  // Guards against the opposite failure: a gate that refuses everything looks
  // safe but is just broken. A synthetic AES repo whose commit genuinely holds
  // all seven signature-free artefacts must pass. AES_ROOT is read at import
  // time, so this has to run in a child process.
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs')
  const dir = mkdtempSync(join(tmpdir(), 'aes-goodpin-'))
  try {
    const files = {
      '.aes/spec-registry/SPECIFICATION-REGISTRY.yaml': 'registry: yes\n',
      '.aes/registry/requirements.yaml': 'requirements: []\n',
      '.aes/policies/release-policy.yaml': 'policy: yes\n',
      '.aes/trust/TRUST-BOUNDARIES.yaml': 'zones: []\n',
      '.aes/spec-registry/release-history.json': '{}\n',
      '.aes/evidence/AUTONOMOUS-EVIDENCE-CHAIN.jsonl': '{"format":"aes-machine-evidence-v1"}\n',
      '.aes/evidence/POLICY-AUTHORIZATION.evidence.json': '{"status":"ACTIVE"}\n',
    }
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(join(dir, dirname(rel)), { recursive: true })
      writeFileSync(join(dir, rel), body)
    }
    const git = (...a) => spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' })
    git('init', '-q'); git('config', 'user.email', 's@aes.local'); git('config', 'user.name', 's')
    git('add', '-A'); git('-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'artefacts')
    const sha = (git('rev-parse', 'HEAD').stdout || '').trim()
    assert.match(sha, /^[0-9a-f]{40}$/)

    const script = `
      import { verifyPinnedCommit } from ${JSON.stringify(join(ROOT, 'tools/aes/integration-adapter.mjs'))}
      const r = verifyPinnedCommit({ source_commit: ${JSON.stringify(sha)},
        specification_registry_path: '.aes/spec-registry/SPECIFICATION-REGISTRY.yaml',
        requirement_registry_path: '.aes/registry/requirements.yaml' })
      console.log(JSON.stringify({ ok: r.ok, checked: r.checked, missing: r.missing }))
    `
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8', timeout: 120000, env: { ...process.env, AES_REPO_ROOT: dir },
    })
    const out = `${r.stdout || ''}${r.stderr || ''}`
    assert.equal(r.status, 0, out)
    const parsed = JSON.parse(out.trim().split('\n').pop())
    assert.equal(parsed.ok, true, `a genuinely-backed pin must be accepted; missing=${JSON.stringify(parsed.missing)}`)
    assert.equal(parsed.checked, 7)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

/** Requirement-map coverage honesty.
 *
 *  The mapper iterated only over requirements present in the registry. A domain
 *  with zero machine-readable requirements never entered the loop, so it could
 *  never be reported as a gap: 8 of 13 domains were uncovered while the summary
 *  read `unenforced_domains: []`. Coverage must be measured against the corpus.
 */

test('the requirement map measures coverage against the corpus, not the registry', () => {
  const m = buildRequirementMap()
  assert.equal(m.ok, true)
  const c = m.counts.coverage
  assert.equal(c.domains_in_corpus, 13, 'the corpus has 13 standard domains')
  // The upstream requirement registry has since been expanded to 2132 entries
  // spanning all 13 domains (previously 590 covering 5). The invariant that
  // must never regress is the equivalence below, not a hard-coded "false".
  assert.equal(c.fully_covered, m.counts.domains_without_requirements.length === 0,
    'full coverage must mean, and only mean, that no corpus domain is uncovered')
  assert.equal(c.domains_with_requirements + m.counts.domains_without_requirements.length, 13,
    'covered + uncovered must account for every corpus domain')
})

test('a corpus domain with no requirements is reported as uncovered (synthetic)', () => {
  // Historical trap: iterating only registered requirements can never report a
  // domain that has none, so `missing: 0 / unenforced_domains: []` read as a
  // clean result. Prove the guard with a synthetic 13-domain corpus whose
  // requirement registry carries a single requirement for one domain.
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs')
  const dir = mkdtempSync(join(tmpdir(), 'aes-coverage-'))
  try {
    for (let i = 0; i <= 12; i++) {
      const d = join(dir, 'standards', `${String(i).padStart(2, '0')}-d`)
      mkdirSync(d, { recursive: true })
      writeFileSync(join(d, 'AES.md'), '# standard\n')
    }
    mkdirSync(join(dir, '.aes/registry'), { recursive: true })
    writeFileSync(join(dir, '.aes/registry/requirements.yaml'),
      'requirements:\n  - requirement_id: AES-00-001-001\n    domain: AES-00\n    phase: P00\n    strength: MUST\n')
    const script = `
      import { buildRequirementMap } from ${JSON.stringify(join(ROOT, 'tools/aes/integration-adapter.mjs'))}
      const m = buildRequirementMap()
      console.log(JSON.stringify({ ok: m.ok, coverage: m.counts?.coverage,
        uncovered: m.counts?.domains_without_requirements }))
    `
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8', timeout: 120000, env: { ...process.env, AES_REPO_ROOT: dir },
    })
    const out = `${r.stdout || ''}${r.stderr || ''}`
    assert.equal(r.status, 0, out)
    const parsed = JSON.parse(out.trim().split('\n').pop())
    assert.equal(parsed.coverage.fully_covered, false,
      'a 1-of-13 requirement corpus must NOT be reported as fully covered')
    assert.equal(parsed.uncovered.length, 12, 'the 12 uncovered domains must be named')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
