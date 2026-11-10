import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { detect, processChanges } from './sync.mjs'

function fixture(version = '1.12.2') {
  const root = mkdtempSync(join(tmpdir(), 'uter-aes-sync-'))
  const paths = {
    root,
    registryPath: join(root, 'aes', '.aes', 'STANDARD-REGISTRY.yaml'),
    pinPath: join(root, 'uter', '.aes', 'aes-pin.json'),
    eventsPath: join(root, 'aes', 'governance', 'ai-native', 'records', 'VERSION-EVENTS.jsonl'),
    statusPath: join(root, 'uter', '.aes', 'reports', 'aes-integration-status.json'),
    processedPath: join(root, 'uter', '.aes', 'autonomous', 'records', 'PROCESSED-EVENTS.json'),
    outputPath: join(root, 'uter', '.aes', 'autonomous', 'records', 'LAST-SYNC.json'),
    checksPath: join(root, 'uter', '.aes', 'autonomous', 'records', 'DOWNSTREAM-CHECKS.jsonl'),
    findingsPath: join(root, 'uter', '.aes', 'autonomous', 'records', 'COMPLIANCE-FINDINGS.jsonl'),
  }
  for (const p of [paths.registryPath, paths.pinPath, paths.eventsPath, paths.statusPath, paths.processedPath]) {
    mkdirSync(join(p, '..'), { recursive: true })
  }
  writeFileSync(paths.registryPath, `# AES registry\n  version: "${version}"\n  status: "ACTIVE"\n`)
  writeFileSync(paths.pinPath, JSON.stringify({ registry_version: '1.12.2', integration_status: 'MIGRATION_PENDING' }))
  writeFileSync(paths.eventsPath, '')
  writeFileSync(paths.statusPath, JSON.stringify({ conformance_status: 'NOT_VERIFIED' }))
  writeFileSync(paths.processedPath, JSON.stringify({ processed_event_ids: [] }))
  return paths
}

test('detect parses quoted YAML version with indentation', () => {
  const f = fixture('1.12.2')
  try {
    const result = detect(f)
    assert.equal(result.aes_registry_version, '1.12.2')
    assert.equal(result.uter_pin_registry_version, '1.12.2')
    assert.equal(result.version_drift, false)
  } finally { rmSync(f.root, { recursive: true, force: true }) }
})

test('detect reports registry drift and never promotes Uter conformance', () => {
  const f = fixture('1.12.3')
  try {
    const result = detect(f)
    assert.equal(result.version_drift, true)
    assert.equal(result.compliance_audit.integration_status, 'MIGRATION_PENDING')
    assert.equal(result.compliance_audit.auto_promotion_applied, false)
    assert.ok(result.compliance_audit.findings.some(x => x.finding_id === 'AES-UTER-005'))
  } finally { rmSync(f.root, { recursive: true, force: true }) }
})

test('check-only mode is side-effect free', () => {
  const f = fixture('1.12.3')
  try {
    const result = processChanges({ ...f, checkOnly: true })
    assert.equal(result.mode, 'CHECK_ONLY')
    assert.equal(result.would_process, true)
    assert.equal(existsSync(f.outputPath), false)
    assert.equal(existsSync(f.checksPath), false)
    assert.equal(existsSync(f.findingsPath), false)
  } finally { rmSync(f.root, { recursive: true, force: true }) }
})

test('processing records detection but preserves non-conformant state', () => {
  const f = fixture('1.12.3')
  try {
    const result = processChanges(f)
    assert.equal(result.mode, 'PROCESSED')
    assert.equal(result.record.downstream_check.status, 'PROCESSED')
    assert.equal(result.record.downstream_check.integration_status_preserved, 'MIGRATION_PENDING')
    assert.equal(result.record.downstream_check.gates_marked_pass, 0)
    const stored = JSON.parse(readFileSync(f.outputPath, 'utf8'))
    assert.equal(stored.downstream_check.integration_status_preserved, 'MIGRATION_PENDING')
    assert.equal(JSON.parse(readFileSync(f.processedPath, 'utf8')).processed_event_ids.length, 0)
  } finally { rmSync(f.root, { recursive: true, force: true }) }
})
