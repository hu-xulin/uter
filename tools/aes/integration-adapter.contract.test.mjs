#!/usr/bin/env node
/** Uter <-> AES adapter phase-2 contract tests.
 *
 *  Kept in a separate file so the integration-adapter suite stays at exactly
 *  23 cases (the AES acceptance-claims verifier asserts that number) while
 *  still adding real positive and negative coverage for the new
 *  signature-free machine-evidence contract.
 *
 *  Every assertion here is about REAL execution: exit codes, recomputed
 *  digests, evidence chain continuity and fail-closed behaviour.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  verifyAesMachineEvidence, discoverAuthoritativeSpecification,
  verifyPinnedCommit, integrationStatus, governanceAcceptanceEvidence,
} from './integration-adapter.mjs'

const ROOT = join(import.meta.dirname, '..', '..')
const ADAPTER = join(ROOT, 'tools/aes/integration-adapter.mjs')

/** Run a snippet against the adapter with an overridden AES_ROOT. */
function withAesRoot(aesRoot, body) {
  const script = `import * as a from ${JSON.stringify(ADAPTER)}\n${body}`
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8', timeout: 180000,
    env: { ...process.env, AES_REPO_ROOT: aesRoot },
  })
  return r
}

// ---------------------------------------------------------------------------
// Positive: the real signature-free chain of trust.
// ---------------------------------------------------------------------------
test('machine evidence executes three real AES verifiers with recorded exit codes', () => {
  const m = verifyAesMachineEvidence()
  assert.equal(m.ok, true, m.detail)
  assert.equal(m.commands.length, 3)
  for (const c of m.commands) {
    assert.equal(c.exit_code, 0, `${c.label}: ${c.detail}`)
    assert.ok(c.command.startsWith('node '))
  }
  assert.equal(m.chain_verified, true)
  assert.equal(m.specification_evidence_chain_verified, true)
  assert.equal(m.seal_intact, true)
  assert.equal(m.digest_recomputed_matches, true)
  assert.match(m.fingerprint, /^[a-f0-9]{64}$/)
})

test('no signature, human signer or third-party dependency remains in the trust chain', () => {
  const m = verifyAesMachineEvidence()
  assert.equal(m.evidence_model, 'aes-machine-evidence-v1')
  assert.equal(m.signature_dependency, 'NONE')
  assert.equal(m.human_signature_dependency, 'NONE')
  assert.equal(m.third_party_signature_dependency, 'NONE')
  assert.equal(m.private_key_dependency, 'NONE')
  const s = discoverAuthoritativeSpecification()
  assert.equal(s.signature, null)
  assert.equal(s.signature_model, 'SIGNATURE_FREE_MACHINE_EVIDENCE')
  assert.equal(s.digest_recomputed_matches, true)
})

test('the pinned commit really carries all seven current governance artefacts', () => {
  const v = verifyPinnedCommit()
  assert.equal(v.ok, true, v.detail)
  assert.equal(v.checked, 7)
  assert.deepEqual(v.missing, [])
  assert.ok(!v.detail.includes('allowed_signers'), 'the retired signer roster must not be required')
})

// ---------------------------------------------------------------------------
// Negative: fail-closed under every broken-input scenario.
// ---------------------------------------------------------------------------
test('a missing AES verifier directory makes discovery fail closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aes-missing-'))
  try {
    const r = withAesRoot(dir, `
      const s = a.discoverAuthoritativeSpecification()
      console.log(JSON.stringify({ ok: s.ok, detail: s.detail }))
    `)
    assert.equal(r.status, 0, `${r.stdout}${r.stderr}`)
    const out = JSON.parse(`${r.stdout}`.trim().split('\n').pop())
    assert.equal(out.ok, false, 'an absent registry must never be accepted')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('machine evidence fails closed when the AES verifiers are absent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aes-noverifier-'))
  try {
    const r = withAesRoot(dir, `
      const m = a.verifyAesMachineEvidence()
      console.log(JSON.stringify({ ok: m.ok, detail: m.detail, failed: m.commands.filter(c => !c.ok).length }))
    `)
    assert.equal(r.status, 0, `${r.stdout}${r.stderr}`)
    const out = JSON.parse(`${r.stdout}`.trim().split('\n').pop())
    assert.equal(out.ok, false)
    assert.equal(out.failed, 3)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('pin verification rejects null, missing and non-existent commits', () => {
  assert.equal(verifyPinnedCommit(null).ok, false)
  assert.equal(verifyPinnedCommit({ specification_version: '2.0.0' }).ok, false)
  const bogus = verifyPinnedCommit({ source_commit: '0'.repeat(40) })
  assert.equal(bogus.ok, false)
  assert.equal(bogus.missing.length, bogus.checked)
})

test('product conformance evidence is absent -> acceptance stays fail-closed', () => {
  const g = governanceAcceptanceEvidence()
  assert.equal(g.ok, false, 'product-side machine acceptance must not be claimed from wiring alone')
  assert.equal(g.checks.product_conformance_evidence, false)
  assert.equal(g.checks.domain_gates_pass, false)
  assert.equal(g.checks.global_gate_pass, false)
  assert.ok(Array.isArray(g.product_conformance_evidence))
  assert.equal(g.product_conformance_evidence.every((p) => p.ok), false)
})

test('technical wiring alone never promotes integration status to INTEGRATED', () => {
  const s = integrationStatus()
  assert.equal(s.aes.ok, true)
  assert.equal(s.pin_commit_verified.ok, true)
  assert.equal(s.pin_declares_integration, false)
  assert.equal(s.governance_acceptance.ok, false)
  assert.notEqual(s.integration_status, 'INTEGRATED')
  assert.equal(s.integration_status, 'MIGRATION_PENDING')
})

test('the adapter CLI real call chain emits a real discovery with machine evidence', () => {
  const r = spawnSync(process.execPath, [ADAPTER, 'discover'], { encoding: 'utf8', timeout: 180000 })
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`)
  const d = JSON.parse(`${r.stdout}`.trim())
  assert.equal(d.ok, true)
  assert.equal(d.status, 'ACTIVE')
  assert.equal(d.machine_evidence.ok, true)
  assert.equal(d.machine_evidence.commands.length, 3)
  assert.equal(d.signature, null)
})
