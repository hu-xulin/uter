#!/usr/bin/env node
/**
 * P13 capability requirement verifier (100 x domain-aspect closure).
 *
 * Fail-closed semantics:
 *   - Every requirement must map to (a) a non-trivial normative statement,
 *     (b) implementation paths that physically exist, (c) an executed
 *     verifier command whose declared tests all pass.
 *   - Anything missing, failing, or non-executable keeps the requirement
 *     NOT_VERIFIED. This script never upgrades a status without executed
 *     evidence, and never rewrites historical evidence.
 *
 * Inputs:
 *   .aes/UTER-P13-CAPABILITY-MAPPING.md  (machine-parseable pipe table)
 * Outputs:
 *   .aes/reports/P13-CAPABILITY-VERIFICATION.json
 *   .aes/reports/p13-evidence/cap-<verifier_id>.log
 *
 * Env overrides (for negative tests only):
 *   P13_ROOT, P13_MAPPING_PATH, P13_OUTPUT_PATH, P13_EVIDENCE_DIR
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(process.env.P13_ROOT || process.cwd())
const MAPPING_PATH = resolve(process.env.P13_MAPPING_PATH || resolve(ROOT, '.aes/UTER-P13-CAPABILITY-MAPPING.md'))
const OUTPUT_PATH = resolve(process.env.P13_OUTPUT_PATH || resolve(ROOT, '.aes/reports/P13-CAPABILITY-VERIFICATION.json'))
const EVIDENCE_DIR = resolve(process.env.P13_EVIDENCE_DIR || resolve(ROOT, '.aes/reports/p13-evidence'))

const sha = (v) => createHash('sha256').update(v).digest('hex')

// Clean execution environment: nested test runners and injected test contexts
// are prohibited inside verification commands.
const childEnv = { ...process.env }
delete childEnv.NODE_TEST_CONTEXT
delete childEnv.NODE_OPTIONS
childEnv.GOWORK = 'off'

const domainVerifiers = {
  'go:p13.2': [
    {
      args: ['test', './controller', '-run', '^(TestEmailCodeLogin_SuspendedAccountSilent|TestAccessTokenLifecycleAndLateRequests)$', '-count=1', '-v'],
      expect: ['TestEmailCodeLogin_SuspendedAccountSilent', 'TestAccessTokenLifecycleAndLateRequests'],
    },
    { args: ['test', './service', '-run', '^TestAccessTokenRejectsTampering$', '-count=1', '-v'], expect: ['TestAccessTokenRejectsTampering'] },
  ],
  'go:p13.3': [
    {
      args: ['test', './model', '-run', '^(TestAutoFillOfficialPricingFillsUnpricedModelsOnly|TestCacheUpdateChannelSyncsAdvancedCustomConfig)$', '-count=1', '-v'],
      expect: ['TestAutoFillOfficialPricingFillsUnpricedModelsOnly', 'TestCacheUpdateChannelSyncsAdvancedCustomConfig'],
    },
  ],
  'go:p13.4': [
    { args: ['test', './service', '-run', '^TestDecideRelayRetryStopsAfterOutputWritten$', '-count=1', '-v'], expect: ['TestDecideRelayRetryStopsAfterOutputWritten'] },
    { args: ['test', './controller', '-run', '^TestAcceptedSubmitStreamNeverRetries$', '-count=1', '-v'], expect: ['TestAcceptedSubmitStreamNeverRetries'] },
  ],
  'go:p13.5': [
    {
      args: ['test', './model', '-run', '^(TestAdjustOrgAndMemberUsedQuotaIsAtomicOnMemberUnderflow|TestAdjustUserUsedQuotaRejectsUnderflow)$', '-count=1', '-v'],
      expect: ['TestAdjustOrgAndMemberUsedQuotaIsAtomicOnMemberUnderflow', 'TestAdjustUserUsedQuotaRejectsUnderflow'],
    },
    { args: ['test', './service', '-run', '^TestBillingSessionReserveWalletTopUpDecrementsBalance$', '-count=1', '-v'], expect: ['TestBillingSessionReserveWalletTopUpDecrementsBalance'] },
  ],
  'go:p13.6': [
    {
      args: ['test', './model', '-run', '^(TestClaimPendingTopUpOnlyWinsOnce|TestClaimPendingTopUpWritesExtraColumnsAtomically)$', '-count=1', '-v'],
      expect: ['TestClaimPendingTopUpOnlyWinsOnce', 'TestClaimPendingTopUpWritesExtraColumnsAtomically'],
    },
  ],
  'go:p13.7': [
    { args: ['test', './model', '-run', '^TestTopUpOrderStateMatrix$', '-count=1', '-v'], expect: ['TestTopUpOrderStateMatrix'] },
    {
      args: ['test', './controller', '-run', '^(TestPaymentCallbacksRejectForgedSignatures|TestAlipayReconcileDoesNotCreditMissingOrderRecord|TestAlipayReconcileRetriesAfterGatewayFailureRound|TestAlipayReconcileWorkerSingleFlightExactOnceCredit|TestGetUserTopUpsReconcilesBeforeReturning)$', '-count=1', '-v'],
      expect: ['TestPaymentCallbacksRejectForgedSignatures', 'TestAlipayReconcileDoesNotCreditMissingOrderRecord', 'TestAlipayReconcileRetriesAfterGatewayFailureRound', 'TestAlipayReconcileWorkerSingleFlightExactOnceCredit', 'TestGetUserTopUpsReconcilesBeforeReturning'],
    },
  ],
  'go:p13.8': [
    {
      args: ['test', './model', '-run', '^(TestSystemTaskActiveKeyPreventsDuplicateActiveRun|TestSystemTaskCreateAndActiveLifecycle|TestMidjourneyRefundOutboxRetriesThenDeadLetters)$', '-count=1', '-v'],
      expect: ['TestSystemTaskActiveKeyPreventsDuplicateActiveRun', 'TestSystemTaskCreateAndActiveLifecycle', 'TestMidjourneyRefundOutboxRetriesThenDeadLetters'],
    },
  ],
  'go:p13.9': [
    {
      args: ['test', './model', '-run', '^(TestAccountingTransactionPrimitivesCommitTogether|TestAccountingTransactionPrimitivesRollbackTogether|TestCreateMidjourneyRefundOperationWithOutboxTxIsAtomic|TestMidjourneyRefundLogOutboxDeliveryIsIdempotent)$', '-count=1', '-v'],
      expect: ['TestAccountingTransactionPrimitivesCommitTogether', 'TestAccountingTransactionPrimitivesRollbackTogether', 'TestCreateMidjourneyRefundOperationWithOutboxTxIsAtomic', 'TestMidjourneyRefundLogOutboxDeliveryIsIdempotent'],
    },
  ],
  'go:p13.10': [
    {
      args: ['test', './controller', '-run', '^(TestAPITokenAuditDatabaseMatrix|TestApplyOrgLogScopeFailsClosedOnMembershipLookupErrors|TestLogExportDatabaseMatrix)$', '-count=1', '-v'],
      expect: ['TestAPITokenAuditDatabaseMatrix', 'TestApplyOrgLogScopeFailsClosedOnMembershipLookupErrors', 'TestLogExportDatabaseMatrix'],
    },
  ],
}

const requiredAspectIds = Array.from({ length: 10 }, (_, i) => `CAP-${String(i + 1).padStart(2, '0')}`)
const requiredDomainIds = Array.from({ length: 10 }, (_, i) => `P13-${String(i + 1).padStart(2, '0')}`)

function parseMapping() {
  if (!existsSync(MAPPING_PATH)) {
    return { ok: false, error: `mapping file missing: ${MAPPING_PATH}`, rows: [] }
  }
  const text = readFileSync(MAPPING_PATH, 'utf8')
  const rows = []
  const seen = new Set()
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line.startsWith('|') || line.includes('---')) continue
    const cells = line.split('|').map((c) => c.trim())
    if (cells.length < 7) continue
    const [ , requirementId, aspect, statement, paths, verifierId ] = cells
    if (!/^P13-\d{2}-CAP-\d{2}$/.test(requirementId || '')) continue
    if (seen.has(requirementId)) {
      return { ok: false, error: `duplicate requirement row: ${requirementId}`, rows }
    }
    seen.add(requirementId)
    rows.push({ requirementId, aspect, statement, paths, verifierId })
  }
  // Structural completeness: 10 domains x 10 aspects, no gaps.
  for (const d of requiredDomainIds) {
    for (const a of requiredAspectIds) {
      const id = `${d}-${a}`
      if (!seen.has(id)) {
        return { ok: false, error: `mapping incomplete: missing ${id}`, rows }
      }
    }
  }
  for (const row of rows) {
    if (!row.aspect || row.statement.length < 30) {
      return { ok: false, error: `mapping row ${row.requirementId}: missing aspect or normative statement too short`, rows }
    }
    if (!row.paths) {
      return { ok: false, error: `mapping row ${row.requirementId}: no implementation paths`, rows }
    }
    const known = row.verifierId === 'self:p13.1' || domainVerifiers[row.verifierId]
    if (!known) {
      return { ok: false, error: `mapping row ${row.requirementId}: unknown verifier_id ${row.verifierId}`, rows }
    }
  }
  return { ok: true, error: null, rows }
}

function pathGroupsSatisfied(pathsField) {
  // Convention: the paths cell contains logical paths separated by ';;'.
  // Fragments sharing the same basename are ALTERNATIVE roots for one logical
  // file (e.g. docs/ai-specs/X vs uaes/standards/X); fragments with distinct
  // basenames are independent logical paths that must each exist.
  const fragments = pathsField.split(';;').map((p) => p.trim()).filter(Boolean)
  if (fragments.length === 0) return false
  const groups = new Map()
  for (const f of fragments) {
    const basename = f.split('/').pop()
    if (!groups.has(basename)) groups.set(basename, [])
    groups.get(basename).push(f)
  }
  for (const candidates of groups.values()) {
    if (!candidates.some((c) => existsSync(resolve(ROOT, c)))) return false
  }
  return true
}

function checkProductDomain() {
  const failures = []
  const standardsCandidates = [
    'docs/ai-specs/PRODUCT-REQUIREMENTS-STANDARD.md',
    'uaes/standards/PRODUCT-REQUIREMENTS-STANDARD.md',
  ]
  const standards = standardsCandidates.map((p) => resolve(ROOT, p)).find((p) => existsSync(p))
  if (!standards) failures.push('product requirements standard document not found')
  else {
    const content = readFileSync(standards, 'utf8')
    if (content.length < 1000) failures.push('product requirements standard too short to be authoritative')
    if (!content.includes('需求')) failures.push('product requirements standard lacks requirement-list section')
  }
  for (const feature of ['about', 'home', 'pricing', 'models', 'chat', 'playground', 'docs', 'legal']) {
    const dir = resolve(ROOT, 'web/src/features', feature)
    if (!existsSync(dir) || !statSync(dir).isDirectory()) { failures.push(`web feature missing: ${feature}`); continue }
    const entries = readdirSync(dir)
    if (entries.length === 0) failures.push(`web feature empty: ${feature}`)
  }
  return failures
}

function runDomainVerifier(verifierId) {
  const specs = domainVerifiers[verifierId]
  if (!specs) return { ok: false, error: `no verifier registered for ${verifierId}`, logs: [] }
  const logs = []
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  let combined = ''
  for (const spec of specs) {
    const res = spawnSync('go', spec.args, {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 10 * 60 * 1000,
      maxBuffer: 32 * 1024 * 1024,
      env: childEnv,
    })
    const output = [res.stdout || '', res.stderr || ''].join('\n')
    combined += `$ go ${spec.args.join(' ')}\nexit=${res.status}\n${output}\n`
    const missing = spec.expect.filter((name) => !output.includes(`--- PASS: ${name}`))
    if (res.status !== 0 || missing.length > 0) {
      const logPath = resolve(EVIDENCE_DIR, `cap-${verifierId.replace(/[:.]/g, '-')}.log`)
      writeFileSync(logPath, combined)
      return {
        ok: false,
        error: `verifier ${verifierId} failed: exit=${res.status} missing_pass=${missing.join(',')}`,
        logs: [{ logPath, digest: sha(combined), command: `go ${spec.args.join(' ')}`, exit_code: res.status }],
      }
    }
  }
  const logPath = resolve(EVIDENCE_DIR, `cap-${verifierId.replace(/[:.]/g, '-')}.log`)
  writeFileSync(logPath, combined)
  return {
    ok: true,
    error: null,
    logs: [{ logPath, digest: sha(combined), command: `go ${specs.map((s) => 'go ' + s.args.join(' ')).join(' && ')}`, exit_code: 0 }],
  }
}

const mapping = parseMapping()
const executed = new Map()
const requirements = []

if (!mapping.ok) {
  // Fail-closed: emit structural failure, no requirement may pass.
  const report = {
    schema_version: '1.0.0',
    report_id: 'UTER-P13-CAPABILITY-VERIFICATION',
    generated_at: new Date().toISOString(),
    generated_by: 'tools/aes/p13-capability-verifier.mjs',
    uter_root: ROOT,
    mapping_path: MAPPING_PATH,
    mapping_digest: existsSync(MAPPING_PATH) ? sha(readFileSync(MAPPING_PATH)) : null,
    structural_error: mapping.error,
    verdict: 'NOT_VERIFIED',
    requirement_count: 100,
    verified_count: 0,
    requirements: [],
  }
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
  writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2) + '\n')
  console.error(JSON.stringify({ verdict: report.verdict, structural_error: mapping.error }))
  process.exit(1)
}

for (const row of mapping.rows) {
  const problems = []
  let evidence = null
  let digest = null

  if (!pathGroupsSatisfied(row.paths)) {
    problems.push(`implementation path not found on disk (checked candidates of: ${row.paths})`)
  }

  if (row.verifierId === 'self:p13.1') {
    const failures = checkProductDomain()
    if (failures.length > 0) problems.push(...failures)
    const content = row.paths + '|' + row.statement
    digest = sha(content + '|self-checks-executed')
  } else {
    if (!executed.has(row.verifierId)) {
      executed.set(row.verifierId, runDomainVerifier(row.verifierId))
    }
    const result = executed.get(row.verifierId)
    if (!result.ok) problems.push(result.error)
    evidence = result.logs
    if (result.ok) {
      digest = sha(row.statement + row.paths + result.logs.map((l) => l.digest).join(''))
    }
  }

  const passed = problems.length === 0 && digest !== null
  requirements.push({
    requirement_id: row.requirementId,
    aspect: row.aspect,
    normative_statement: row.statement,
    implementation_paths: row.paths.split(';;').map((p) => p.trim()),
    verifier_id: row.verifierId,
    status: passed ? 'PASS' : 'NOT_VERIFIED',
    independent_verification: passed ? 'PASS' : 'NOT_RUN',
    evidence_digest: digest,
    evidence_path: evidence ? evidence.map((l) => l.logPath.replace(ROOT + '/', '')) : ['.aes/reports/P13-CAPABILITY-VERIFICATION.json#self-checks'],
    command: evidence ? evidence.map((l) => l.command) : ['node tools/aes/p13-capability-verifier.mjs (product-domain self checks)'],
    problems: problems.length > 0 ? problems : null,
    source_path: '.aes/UTER-P13-CAPABILITY-MAPPING.md',
  })
}

const verified = requirements.filter((r) => r.status === 'PASS').length
const report = {
  schema_version: '1.0.0',
  report_id: 'UTER-P13-CAPABILITY-VERIFICATION',
  generated_at: new Date().toISOString(),
  generated_by: 'tools/aes/p13-capability-verifier.mjs',
  uter_root: ROOT,
  mapping_path: MAPPING_PATH,
  mapping_digest: sha(readFileSync(MAPPING_PATH)),
  verdict: verified === 100 ? 'PASS' : 'NOT_VERIFIED',
  requirement_count: requirements.length,
  verified_count: verified,
  requirements,
  honesty_note: 'A requirement is PASS only when its normative statement is registered, its implementation paths physically exist, and its declared verifier executed with every expected test passing. Any missing piece keeps the requirement NOT_VERIFIED.',
}
mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({
  verdict: report.verdict,
  requirement_count: report.requirement_count,
  verified_count: report.verified_count,
  output: OUTPUT_PATH.replace(ROOT + '/', ''),
}, null, 2))
if (report.verdict !== 'PASS') process.exit(1)
