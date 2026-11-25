import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('../..', import.meta.url))
const workflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')

function stepBlock(name) {
  const marker = `- name: ${name}`
  const start = workflow.indexOf(marker)
  assert.notEqual(start, -1, `workflow step not found: ${name}`)
  const next = workflow.indexOf('\n      - name:', start + marker.length)
  return workflow.slice(start, next === -1 ? workflow.length : next)
}

test('UAP evidence-producing steps run even when an earlier gate fails', () => {
  const names = [
    'Build isolated Uter backend release binary',
    'Start isolated Uter server with disposable SQLite',
    'Open single UAP evidence batch',
    'UAP full audit and current architecture/knowledge index refresh',
    'Generate current UAP build evidence',
    'UAP runtime health',
    'UAP registry and validator execution',
    'UAP complete self-test suite',
    'UAP real code repair and independent regression',
    'UAP isolated database integration and migrations',
    'UAP local payment simulation (no provider calls)',
    'UAP browser E2E and accessibility verification',
    'UAP visual regression verification',
    'UAP security negative tests and secret scan',
    'UAP full requirement traceability verification',
    'Regenerate final UAP reports from current execution',
    'Run authoritative UAP final acceptance closure',
    'Publish authoritative UAP final acceptance status',
    'Enforce UAP governance gate',
  ]

  for (const name of names) {
    assert.match(stepBlock(name), /if: always\(\)/, name)
  }
})

test('isolated server startup is conditional on a successful release binary build', () => {
  assert.match(
    stepBlock('Start isolated Uter server with disposable SQLite'),
    /if: always\(\) && steps\.uap_backend_build\.outcome == 'success'/
  )
})

test('the final gate fails closed when required UAP prerequisites are skipped', () => {
  const gate = stepBlock('Enforce UAP governance gate')
  for (const name of [
    'UAP_BACKEND_BUILD_OUTCOME',
    'UAP_SERVER_OUTCOME',
    'UAP_BATCH_OUTCOME',
  ]) {
    assert.ok(gate.includes(`${name}:`), `${name} must be reported`)
    assert.ok(
      gate.includes(`test "${name}" = success`),
      `${name} must be required for a passing gate`
    )
  }
})

test('CI publishes the canonical UDS gate evidence and TAP failure identities', () => {
  assert.ok(workflow.includes("read('docs/design-system/GATE-EVIDENCE.json')"))
  assert.match(workflow, /^\s+docs\/design-system\/GATE-EVIDENCE\.json$/m)
  assert.ok(workflow.includes('report.failed_tests ?? []'))
})
