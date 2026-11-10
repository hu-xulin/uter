#!/usr/bin/env node
/**
 * P13 requirement-level machine conformance engine (phase-2 edition).
 *
 * This engine does not infer conformance from file presence, generic CI
 * success, or a repository-level governance PASS. It:
 *   1. executes the capability verifier (tools/aes/p13-capability-verifier.mjs)
 *      as an independent child process and merges its 100 executed rows;
 *   2. independently executes the payment-domain regression suites, including
 *      the two fault-injection scenarios (missing order record, recovery
 *      worker failure/retry/single-flight);
 *   3. emits explicit NOT_VERIFIED rows for anything that did not execute
 *      and pass. It never upgrades a status without executed evidence.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const ROOT = process.cwd()
const AES_ROOT = resolve(process.env.AES_ROOT || resolve(ROOT, '../aes'))
const REPORT = resolve(process.env.P13_REPORT_PATH || '.aes/reports/P13-CONFORMANCE-REPORT.json')
const EVIDENCE_DIR = resolve(ROOT, '.aes/reports/p13-evidence')
const CAPABILITY_VERIFIER = resolve(ROOT, 'tools/aes/p13-capability-verifier.mjs')
const P13_PATH = '.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md'
const sha = (value) => createHash('sha256').update(value).digest('hex')
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8')
const git = (args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' })
const currentHead = git(['rev-parse', 'HEAD']).stdout.trim()
const p13Source = read(P13_PATH)
const aesFingerprintRun = spawnSync(process.execPath, [
  'quality/scripts/aes/governed-fingerprint.mjs', '--json', '--require-intact',
], { cwd: AES_ROOT, encoding: 'utf8', timeout: 60_000 })
let aesFingerprint = null
try { aesFingerprint = JSON.parse(aesFingerprintRun.stdout) } catch {}

const capabilityAspects = [
  'machine responsibility domain and source ownership',
  'traceable machine normative source',
  'domain model or equivalent specification',
  'business invariants',
  'state transitions',
  'failure behavior',
  'authorization rules',
  'data integrity requirements',
  'verification criteria',
  'traceable implementation evidence',
]
const domains = [
  'P13.1 Product and business requirements',
  'P13.2 Identity and accounts',
  'P13.3 Models and providers',
  'P13.4 AI relay',
  'P13.5 Usage and pricing',
  'P13.6 Wallet and accounting',
  'P13.7 Payment',
  'P13.8 Tasks and scheduling',
  'P13.9 Data consistency',
  'P13.10 Business observability',
]

const childEnv = { ...process.env }
delete childEnv.NODE_TEST_CONTEXT
delete childEnv.NODE_OPTIONS
childEnv.GOWORK = 'off'

// ---------------------------------------------------------------------------
// 1. Capability verification: executed as an independent child process.
// ---------------------------------------------------------------------------
const capabilityRun = spawnSync(process.execPath, [CAPABILITY_VERIFIER], {
  cwd: ROOT,
  encoding: 'utf8',
  timeout: 30 * 60 * 1000,
  maxBuffer: 32 * 1024 * 1024,
  env: childEnv,
})
let capabilityReport = null
try { capabilityReport = JSON.parse(read('.aes/reports/P13-CAPABILITY-VERIFICATION.json')) } catch {}
const capabilityByAspect = new Map()
for (const r of (capabilityReport?.requirements || [])) capabilityByAspect.set(r.requirement_id, r)
if (capabilityRun.status !== 0) {
  console.error(`capability verifier exited ${capabilityRun.status}; capability rows stay NOT_VERIFIED (fail-closed)`)
}

const requirements = []
for (let d = 0; d < domains.length; d++) {
  for (let a = 0; a < capabilityAspects.length; a++) {
    const requirementId = `P13-${String(d + 1).padStart(2, '0')}-CAP-${String(a + 1).padStart(2, '0')}`
    const executed = capabilityByAspect.get(requirementId)
    const passed = executed?.status === 'PASS' &&
      executed?.independent_verification === 'PASS' &&
      Boolean(executed?.evidence_digest) &&
      capabilityRun.status === 0
    requirements.push({
      requirement_id: requirementId,
      domain: domains[d],
      capability: capabilityAspects[a],
      applicable: true,
      status: passed ? 'PASS' : 'NOT_VERIFIED',
      independent_verification: passed ? 'PASS' : 'NOT_RUN',
      evidence_digest: passed ? executed.evidence_digest : null,
      evidence_path: passed ? executed.evidence_path : null,
      command: passed ? executed.command : (executed?.command || `node tools/aes/p13-capability-verifier.mjs`),
      problems: passed ? null : (executed?.problems || [`capability verifier did not close this requirement (verifier exit=${capabilityRun.status})`]),
      reason: passed
        ? 'Normative statement registered, implementation paths verified on disk, and the domain verifier executed with every declared test passing.'
        : 'P13 requires an explicit machine source, implementation, verifier, execution and independent evidence mapping; this requirement is not yet closed by executed evidence.',
      source_path: '.aes/UTER-P13-CAPABILITY-MAPPING.md',
    })
  }
}

// ---------------------------------------------------------------------------
// 2. Payment scenarios: 8 regression suites + 2 fault-injection scenarios.
// ---------------------------------------------------------------------------
const paymentTests = [
  {
    id: 'P13-PAY-002',
    scenario: 'duplicate payment notifications and concurrent callbacks',
    args: ['test', './model', '-run', '^(TestTopUpOrderStateMatrix|TestRechargeEpayConcurrentCallbacksCreditOnce)$', '-count=1', '-v'],
    expected_tests: ['TestTopUpOrderStateMatrix', 'TestRechargeEpayConcurrentCallbacksCreditOnce'],
    source_paths: ['model/topup_order_state_matrix_test.go', 'model/topup_claim_pending_test.go'],
  },
  {
    id: 'P13-PAY-003',
    scenario: 'out-of-order payment notifications and terminal-state resurrection',
    args: ['test', './model', '-run', '^TestTopUpOrderStateMatrix$', '-count=1', '-v'],
    expected_tests: ['TestTopUpOrderStateMatrix'],
    source_paths: ['model/topup_order_state_matrix_test.go'],
  },
  {
    id: 'P13-PAY-004',
    scenario: 'paid amount mismatch is rejected before credit',
    args: ['test', './controller', '-run', '^(TestAlipayReconcileRejectsAmountMismatch|TestPaymentGatewayCallbacksMatchPaidAmount)$', '-count=1', '-v'],
    expected_tests: ['TestAlipayReconcileRejectsAmountMismatch', 'TestPaymentGatewayCallbacksMatchPaidAmount'],
    source_paths: ['controller/payment_reconcile_task_test.go', 'controller/topup_gateway_contract_test.go'],
  },
  {
    id: 'P13-PAY-005',
    scenario: 'forged provider signatures are rejected',
    args: ['test', './controller', '-run', '^TestPaymentCallbacksRejectForgedSignatures$', '-count=1', '-v'],
    expected_tests: ['TestPaymentCallbacksRejectForgedSignatures'],
    source_paths: ['controller/topup_callback_security_matrix_test.go'],
  },
  {
    id: 'P13-PAY-006',
    scenario: 'invalid order-state transitions are rejected',
    args: ['test', './model', '-run', '^TestTopUpOrderStateMatrix$', '-count=1', '-v'],
    expected_tests: ['TestTopUpOrderStateMatrix'],
    source_paths: ['model/topup_order_state_matrix_test.go'],
  },
  {
    id: 'P13-PAY-007',
    scenario: 'duplicate refund execution and ledger mutation are idempotent',
    args: ['test', './model', '-run', '^(TestRefundIntentExecuteAppliesRefundOnce|TestRefundMidjourneyTaskBillingIsAtomicAndIdempotent|TestSubscriptionRefundIntentCommitsOnce)$', '-count=1', '-v'],
    expected_tests: ['TestRefundIntentExecuteAppliesRefundOnce', 'TestRefundMidjourneyTaskBillingIsAtomicAndIdempotent', 'TestSubscriptionRefundIntentCommitsOnce'],
    source_paths: ['model/refund_intent_test.go', 'model/midjourney_refund_transaction_test.go'],
  },
  {
    id: 'P13-PAY-008',
    scenario: 'payment-provider query failure is handled without false credit',
    args: ['test', './controller', '-run', '^TestGetUserTopUpsSurvivesGatewayFailure$', '-count=1', '-v'],
    expected_tests: ['TestGetUserTopUpsSurvivesGatewayFailure'],
    source_paths: ['controller/payment_reconcile_task_test.go'],
  },
  {
    id: 'P13-PAY-009',
    scenario: 'missing callback is recovered by automatic provider reconciliation',
    args: ['test', './controller', '-run', '^TestGetUserTopUpsReconcilesBeforeReturning$', '-count=1', '-v'],
    expected_tests: ['TestGetUserTopUpsReconcilesBeforeReturning'],
    source_paths: ['controller/payment_reconcile_task_test.go'],
  },
  {
    id: 'P13-PAY-001',
    scenario: 'gateway reports paid but the local order record was not persisted (fault injection)',
    args: ['test', './controller', '-run', '^TestAlipayReconcileDoesNotCreditMissingOrderRecord$', '-count=1', '-v'],
    expected_tests: ['TestAlipayReconcileDoesNotCreditMissingOrderRecord'],
    source_paths: ['controller/payment_recovery_fault_injection_test.go'],
  },
  {
    id: 'P13-PAY-010',
    scenario: 'payment-order recovery worker failure, automatic retry and single-flight exact-once credit (fault injection)',
    args: ['test', './controller', '-run', '^(TestAlipayReconcileRetriesAfterGatewayFailureRound|TestAlipayReconcileWorkerSingleFlightExactOnceCredit)$', '-count=1', '-v'],
    expected_tests: ['TestAlipayReconcileRetriesAfterGatewayFailureRound', 'TestAlipayReconcileWorkerSingleFlightExactOnceCredit'],
    source_paths: ['controller/payment_recovery_fault_injection_test.go'],
  },
]

const paymentResults = []
for (const item of paymentTests) {
  const result = spawnSync('go', item.args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 10 * 60 * 1000,
    maxBuffer: 16 * 1024 * 1024,
    env: childEnv,
  })
  const output = [result.stdout || '', result.stderr || ''].join('\n')
  const logPath = resolve(EVIDENCE_DIR, `${item.id}.log`)
  mkdirSync(dirname(logPath), { recursive: true })
  writeFileSync(logPath, output)
  const expectedExecuted = (item.expected_tests || []).every((name) =>
    output.includes(`--- PASS: ${name}`))
  const passed = result.status === 0 && expectedExecuted
  paymentResults.push({
    requirement_id: item.id,
    domain: 'P13.7 Payment',
    scenario: item.scenario,
    applicable: true,
    status: passed ? 'PASS' : (result.status === null ? 'NOT_RUN' : 'FAIL'),
    independent_verification: passed ? 'PASS' : 'NOT_RUN',
    evidence_digest: passed ? sha(output) : null,
    evidence_path: passed ? '.aes/reports/p13-evidence/' + item.id + '.log' : null,
    command: 'go ' + item.args.join(' '),
    exit_code: result.status,
    source_paths: item.source_paths,
    detail: passed ? 'Every declared test function executed and passed in an isolated verification run.' : `exit=${result.status}; expected_tests_executed=${expectedExecuted}; ${output.slice(-4000)}`,
  })
}

requirements.push(...paymentResults)

const notRunCount = requirements.filter(x => x.status === 'NOT_RUN').length
const failedCount = requirements.filter(x => x.status === 'FAIL').length
const allVerified = requirements.every(x => x.applicable === false ||
  (x.status === 'PASS' && x.independent_verification === 'PASS' && Boolean(x.evidence_digest)))
const capabilityVerified = requirements.filter(x => /^P13-\d{2}-CAP-/.test(x.requirement_id) && x.status === 'PASS').length
const report = {
  schema_version: '1.0.0',
  report_id: 'UTER-P13-MACHINE-CONFORMANCE',
  generated_at: new Date().toISOString(),
  generated_by: 'scripts/quality/p13-conformance-engine.mjs',
  written_by_hand: false,
  uter_head: currentHead,
  aes_governed_fingerprint: aesFingerprint?.fingerprint || null,
  aes_seal_intact: aesFingerprint?.seal_intact === true,
  p13_source_digest: sha(p13Source),
  capability_mapping_digest: capabilityReport?.mapping_digest || null,
  requirement_count: requirements.length,
  all_applicable_requirements_verified: allVerified,
  not_run_count: notRunCount,
  failed_count: failedCount,
  verdict: allVerified && aesFingerprint?.seal_intact === true ? 'PASS' : (failedCount ? 'FAIL' : 'NOT_VERIFIED'),
  requirements,
  summary: {
    capability_requirements: 100,
    capability_requirements_verified: capabilityVerified,
    payment_scenarios_tested: paymentResults.length,
    payment_scenarios_passed: paymentResults.filter(x => x.status === 'PASS').length,
    payment_scenarios_failed: paymentResults.filter(x => x.status === 'FAIL').length,
    payment_scenarios_not_run: paymentResults.filter(x => x.status === 'NOT_RUN').length,
    fault_injection_scenarios: 2,
  },
  honesty_note: 'A successful generic CI job, a file path or a passing unit test does not establish P13 business-domain requirements. Only the targeted executed tests above are marked PASS; every unclosed capability or payment requirement remains NOT_VERIFIED.',
}
mkdirSync(dirname(REPORT), { recursive: true })
writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({
  verdict: report.verdict,
  requirement_count: report.requirement_count,
  capability_requirements_verified: report.summary.capability_requirements_verified,
  payment_scenarios_passed: report.summary.payment_scenarios_passed,
  payment_scenarios_failed: report.summary.payment_scenarios_failed,
  not_run_count: report.not_run_count,
  failed_count: report.failed_count,
  report: '.aes/reports/P13-CONFORMANCE-REPORT.json',
}, null, 2))
if (!allVerified || !aesFingerprint?.seal_intact) process.exitCode = 1
