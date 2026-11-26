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
    'UAP post-audit independent verification',
    'Run authoritative UAP final acceptance closure',
    'Publish authoritative UAP final acceptance status',
    'Enforce UAP governance gate',
  ]

  for (const name of names) {
    assert.match(stepBlock(name), /if: always\(\)/, name)
  }
})

test('visual snapshots run on the platform for which committed baselines exist', () => {
  const start = workflow.indexOf('  uap-governance:')
  const end = workflow.indexOf('\n  ueqe-review:', start)
  assert.notEqual(start, -1)
  assert.notEqual(end, -1)
  const job = workflow.slice(start, end)
  assert.ok(job.includes('runs-on: macos-15'))
  assert.ok(job.includes('bunx playwright install chromium'))
  assert.ok(!job.includes('playwright install --with-deps'))
  const snapshots = join(root, 'web/e2e/visual/public.spec.ts-snapshots')
  assert.ok(readFileSync(join(snapshots, 'home-desktop-chromium-darwin.png')).length > 0)
})

test('post-audit independent verification runs after current reports and is required by acceptance', () => {
  const reportIndex = workflow.indexOf('- name: Regenerate final UAP reports from current execution')
  const postAuditIndex = workflow.indexOf('- name: UAP post-audit independent verification')
  const acceptIndex = workflow.indexOf('- name: Run authoritative UAP final acceptance closure')
  assert.ok(reportIndex >= 0 && postAuditIndex > reportIndex && acceptIndex > postAuditIndex)
  const postAudit = stepBlock('UAP post-audit independent verification')
  assert.match(postAudit, /continue-on-error: true/)
  assert.ok(postAudit.includes('node --test .uap/tests/independent-verification.test.mjs'))
  const accept = stepBlock('Run authoritative UAP final acceptance closure')
  assert.ok(accept.includes('UAP_POST_AUDIT_VERIFY_OUTCOME:'))
  const gate = stepBlock('Enforce UAP governance gate')
  assert.ok(gate.includes('UAP_POST_AUDIT_VERIFY_OUTCOME:'))
  assert.ok(gate.includes('test "$UAP_POST_AUDIT_VERIFY_OUTCOME" = success'))
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
      gate.includes(`test "$${name}" = success`),
      `${name} must be required for a passing gate`
    )
  }
})

test('CI publishes the canonical UDS gate evidence and TAP failure identities', () => {
  assert.ok(workflow.includes("read('docs/design-system/GATE-EVIDENCE.json')"))
  assert.match(workflow, /^\s+docs\/design-system\/GATE-EVIDENCE\.json$/m)
  assert.ok(workflow.includes('report.failed_tests ?? []'))
})
