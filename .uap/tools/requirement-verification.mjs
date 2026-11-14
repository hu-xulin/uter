/**
 * UAP Phase 2 — STRICT Requirement verification engine (audit P2-06).
 *
 *   node .uap/tools/requirement-verification.mjs                 # real full run
 *   node .uap/tools/requirement-verification.mjs --dry-run      # no commands (unit tests)
 *   node .uap/tools/requirement-verification.mjs --no-execute-probes
 *   node .uap/tools/requirement-verification.mjs --print-states # recompute honest counts
 *
 * RequirementStatus = VERIFIED | NOT_VERIFIED | BLOCKED | NOT_APPLICABLE
 *
 * A requirement is VERIFIED ONLY when a REAL BEHAVIOR_EXECUTION probe ran a
 * command with exit_code 0, a DISTINCT required output assertion was really
 * observed in that command's stdout, and a hash-valid evidence record is bound
 * to THIS execution (id / HEAD / worktree fingerprint). A STATIC_EXISTENCE
 * probe (file/dir/symbol/config-key/report-card read) can NEVER yield VERIFIED,
 * and exit_code===0 of a static scan is NEVER turned into VERIFIED. A generic
 * whole-suite / whole-CLI / whole-build command shared across many unrelated
 * requirements without a distinct assertion each is rejected as
 * PROBE_SHARED_EVIDENCE. One shared evidence ref covering unrelated
 * requirements is detected and rejected. Every NOT_VERIFIED / BLOCKED /
 * NOT_APPLICABLE carries a concrete reason or basis.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseYAML } from '../runtime/_lib/yaml.mjs';
import { record, verify as verifyEvidence, get as getEvidence } from '../runtime/evidence-engine/index.mjs';
import { currentExecution } from '../runtime/status-engine/execution.mjs';
import { PROBE_IDS, probeKind, probeKindCounts, runBehaviorProbes } from './requirement-probes.mjs';
import { extractRequirements, writeMatrix, computeStatesFromRows } from './requirement-matrix.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const UAP = path.join(ROOT, '.uap');
const REPORTS = path.join(UAP, 'reports');
const REGISTRY = path.join(UAP, 'config', 'requirement-probes.yaml');
const MATRIX = path.join(REPORTS, 'REQUIREMENT-TRACEABILITY-MATRIX.json');
const RESULTS = path.join(REPORTS, 'REQUIREMENT-VERIFICATION-RESULTS.json');
const COVERAGE_SUMMARY = path.join(REPORTS, 'REQUIREMENT-COVERAGE-SUMMARY.md');

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const readJSON = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const writeJSON = (p, v) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`, 'utf8'); };
const now = () => new Date().toISOString();

/* ------------------------------------------------------------ strict model */
export const RequirementStatus = Object.freeze({
  VERIFIED: 'VERIFIED',
  NOT_VERIFIED: 'NOT_VERIFIED',
  BLOCKED: 'BLOCKED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});
export const REQUIREMENT_STATUSES = Object.freeze(Object.values(RequirementStatus));
/** Backward-compatible name. The model is now strictly the 4 states above. */
export const VERIFICATION_STATES = REQUIREMENT_STATUSES;

/* ------------------------------------------------------ registry / coverage */
export function loadRegistry() {
  const text = fs.readFileSync(REGISTRY, 'utf8');
  const j = parseYAML(text);
  if (!j?.batches?.length) throw new Error('requirement-probes.yaml: no batches');
  return j;
}

/** Requirement text tolerates both base rows (`requirement`) and final matrix
 *  rows (`original_text`) — the classifier must never crash on either shape. */
function reqText(r) {
  return (r && (r.requirement ?? r.original_text)) || '';
}

/** Map every requirement to its declared batch + legacy probe set (audit only).
 *  Legacy probes are NEVER sufficient for VERIFIED; they only document what the
 *  old engine claimed to cover. */
export function coverageMap(matrix, registry) {
  const specToBatch = new Map();
  for (const b of registry.batches) for (const s of b.specs) specToBatch.set(s, b);
  const out = new Map();
  for (const r of matrix.requirements || []) {
    const batch = specToBatch.get(r.specification_id) || null;
    const probes = new Set(batch?.probes || []);
    const rules = [];
    for (const rule of registry.keyword_rules || []) {
      if (reqText(r).includes(rule.keyword)) {
        for (const p of rule.probes) probes.add(p);
        rules.push(rule.keyword);
      }
    }
    out.set(r.requirement_id, {
      batch_id: batch?.id || 'UNMAPPED',
      batch_name: batch?.name || null,
      probes: [...probes].filter((p) => PROBE_IDS.includes(p)),
      keyword_rules: rules,
      coverage_basis: `spec ${r.specification_id} -> batch ${batch?.id || 'UNMAPPED'}; keyword rules: ${rules.join(',') || 'none'}`,
    });
  }
  return out;
}

/** Real external-dependency classification, restricted to declared rules. */
export function externalBlock(r, registry) {
  for (const rule of registry.blocked_rules || []) {
    if ((rule.keywords || []).some((k) => reqText(r).includes(k))) return rule;
  }
  return null;
}
export function notApplicable(r, registry) {
  return (registry.not_applicable_rules || []).find((x) => x.requirement_id === r.requirement_id) || null;
}

export { probeKind, probeKindCounts };

/* -------------------------------------------------------- honesty helpers */
const NON_RUN_STATUSES = new Set(['BLOCKED', 'SKIPPED', 'NOT_RUN', 'DRY_RUN_NOT_EXECUTED', 'FAILED']);

/**
 * A behavior assertion is usable for VERIFIED only when ALL of the following
 * hold. Each guard maps to a distinct honesty negative test.
 */
export function isValidBehaviorAssertion(a, execution) {
  return Boolean(a)
    && a.probe_kind === 'BEHAVIOR_EXECUTION'          // STATIC_EXISTENCE never verifies
    && a.skipped !== true                              // skipped never verifies
    && !NON_RUN_STATUSES.has(a.raw_status)             // BLOCKED/NOT_RUN never verifies
    && a.exit_code === 0
    && a.assertion_found === true                      // distinct output assertion observed
    && typeof a.evidence_hash === 'string' && a.evidence_hash.length > 0 // hash present
    && a.evidence_hash_valid === true                  // hash valid
    && a.evidence_disk_hash_valid === true             // no hash mismatch (recomputed)
    && a.evidence_binding_valid === true               // bound to an execution
    && a.evidence_output_hash === a.output_hash        // hash matches the real output (no mismatch)
    && a.distinct === true                             // not shared evidence
    && Boolean(execution && execution.execution_id)
    && a.evidence_execution_id === execution.execution_id
    && a.evidence_git_head === execution.git_head
    && a.evidence_worktree_fingerprint === execution.worktree_fingerprint;
}

/** Detect one shared evidence/command+assertion covering unrelated requirements. */
export function detectSharedEvidence(bindings = []) {
  const groups = new Map();
  for (const b of bindings) {
    const key = `${b.command}::${b.assertion_id}`;
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key).add(b.requirement_id);
  }
  const rejected = new Set();
  const conflicts = [];
  for (const [key, ids] of groups) {
    if (ids.size > 1) {
      conflicts.push({ key, requirement_ids: [...ids] });
      for (const id of ids) rejected.add(id);
    }
  }
  return { rejected, conflicts };
}

function notVerified(code, reason, requirement, declaredProbeKinds, behaviorAssertions) {
  return {
    status: RequirementStatus.NOT_VERIFIED,
    status_reason_code: code,
    status_reason: reason,
    evidence_refs: [],
    actual_result: `未通过真实行为断言：${reason}；声明探针种类=${[...new Set(declaredProbeKinds)].join(',') || 'none'}；绑定行为断言=${behaviorAssertions.length}`,
    verified_at: null,
  };
}

/**
 * STRICT classifier (4 states). Pure function of a per-requirement context, so
 * the honesty negative tests can exercise the exact production logic.
 */
export function classifyStrict(ctx = {}) {
  const {
    requirement = {},
    behaviorAssertions = [],
    declaredProbeKinds = [],
    blockedRule = null,
    naRule = null,
    sharedEvidenceRejected = false,
    execution = null,
    verifiedAt = null,
  } = ctx;

  // NOT_APPLICABLE requires a concrete, reviewed business basis.
  if (naRule) {
    if (!naRule.reason || !naRule.basis) {
      return notVerified('NA_BASIS_MISSING', 'NOT_APPLICABLE 缺少具体业务依据/审批，fail-closed 视为 NOT_VERIFIED', requirement, declaredProbeKinds, behaviorAssertions);
    }
    return {
      status: RequirementStatus.NOT_APPLICABLE,
      status_reason_code: 'NOT_APPLICABLE_WITH_BASIS',
      status_reason: `业务上不适用：${naRule.reason}（依据：${naRule.basis}${naRule.approving_validator ? `；审批：${naRule.approving_validator}` : ''}）`,
      evidence_refs: [],
      actual_result: `不适用（有具体业务依据）：${naRule.reason}`,
      verified_at: null,
    };
  }
  // BLOCKED requires a concrete blocking condition.
  if (blockedRule) {
    if (!blockedRule.dependency) {
      return notVerified('BLOCK_CONDITION_MISSING', 'BLOCKED 缺少具体阻断条件，fail-closed 视为 NOT_VERIFIED', requirement, declaredProbeKinds, behaviorAssertions);
    }
    return {
      status: RequirementStatus.BLOCKED,
      status_reason_code: 'EXTERNAL_DEPENDENCY',
      status_reason: `外部依赖未满足：${blockedRule.dependency}；解除条件：${blockedRule.unblock_condition || '未声明'}`,
      evidence_refs: [],
      actual_result: `被外部依赖阻断，未执行行为验证：${blockedRule.dependency}`,
      verified_at: null,
    };
  }
  if (sharedEvidenceRejected) {
    return notVerified('PROBE_SHARED_EVIDENCE', '同一证据/断言被用于多条不相关要求且未各自断言独立行为', requirement, declaredProbeKinds, behaviorAssertions);
  }

  const valid = behaviorAssertions.filter((a) => isValidBehaviorAssertion(a, execution));
  if (valid.length > 0) {
    const refs = valid.map((a) => ({
      assertion_id: a.assertion_id,
      probe_id: a.probe_id,
      probe_kind: a.probe_kind,
      command: a.command,
      exit_code: a.exit_code,
      output_hash: a.output_hash,
      required_output: a.required_output,
      evidence_id: a.evidence_id,
      evidence_hash: a.evidence_hash,
      evidence_hash_valid: a.evidence_hash_valid,
      evidence_binding_valid: a.evidence_binding_valid,
      distinct: true,
    }));
    return {
      status: RequirementStatus.VERIFIED,
      status_reason_code: 'REAL_BEHAVIOR_ASSERTION',
      status_reason: `${valid.length} 个真实行为断言通过（命令 exit 0、断言在真实 stdout 观测到、证据哈希有效且绑定当前执行）：${valid.map((a) => a.assertion_id).join('; ')}`,
      evidence_refs: refs,
      actual_result: valid.map((a) => `${a.command} -> exit ${a.exit_code}; observed "${a.assertion_id}"; output_sha256=${a.output_hash}`).join(' | '),
      verified_at: verifiedAt || now(),
    };
  }

  // NOT_VERIFIED — choose the most concrete reason.
  if (behaviorAssertions.length === 0) {
    const hasGeneric = declaredProbeKinds.includes('BEHAVIOR_EXECUTION');
    const hasStatic = declaredProbeKinds.includes('STATIC_EXISTENCE');
    if (hasGeneric) {
      return notVerified('PROBE_SHARED_EVIDENCE',
        '声明的通用套件/CLI/构建命令为共享证据，未对本要求绑定独立的行为断言（一个套件覆盖多条不相关要求）；本轮未执行任何针对本要求的行为命令',
        requirement, declaredProbeKinds, behaviorAssertions);
    }
    if (hasStatic) {
      return notVerified('PROBE_ONLY_FILE_EXISTENCE',
        '仅有静态存在性探针（文件/目录/符号/配置项/报告卡/文本哈希），不足以验证运行时行为',
        requirement, declaredProbeKinds, behaviorAssertions);
    }
    return notVerified('NO_VALIDATOR', '未注册任何行为验证器或探针，无法验证该要求', requirement, declaredProbeKinds, behaviorAssertions);
  }
  // A behavior binding existed but was not valid — say exactly why.
  const anyNonRun = behaviorAssertions.some((a) => a.skipped === true || NON_RUN_STATUSES.has(a.raw_status));
  if (anyNonRun) {
    return notVerified('BEHAVIOR_NOT_RUN', '行为探针为 BLOCKED/SKIPPED/NOT_RUN/DRY_RUN 状态，未真实执行', requirement, declaredProbeKinds, behaviorAssertions);
  }
  if (behaviorAssertions.some((a) => a.probe_kind !== 'BEHAVIOR_EXECUTION')) {
    return notVerified('PROBE_ONLY_FILE_EXISTENCE', '绑定探针为 STATIC_EXISTENCE/EXTERNAL_DEPENDENCY，非真实行为执行', requirement, declaredProbeKinds, behaviorAssertions);
  }
  if (behaviorAssertions.some((a) => a.exit_code !== 0)) {
    return notVerified('BEHAVIOR_COMMAND_FAILED', '真实行为命令退出码非 0，未通过', requirement, declaredProbeKinds, behaviorAssertions);
  }
  if (behaviorAssertions.some((a) => a.assertion_found !== true)) {
    return notVerified('BEHAVIOR_ASSERTION_NOT_OBSERVED', '命令虽 exit 0，但要求的独立行为断言未在该命令的真实输出中观测到', requirement, declaredProbeKinds, behaviorAssertions);
  }
  if (behaviorAssertions.some((a) => !a.evidence_hash || !a.evidence_hash_valid || !a.evidence_disk_hash_valid
      || !a.evidence_binding_valid || a.evidence_output_hash !== a.output_hash || !a.distinct
      || !execution || a.evidence_execution_id !== execution.execution_id
      || a.evidence_git_head !== execution.git_head
      || a.evidence_worktree_fingerprint !== execution.worktree_fingerprint)) {
    return notVerified('EVIDENCE_INVALID_OR_STALE', '证据哈希缺失/不匹配/失效或未绑定当前执行，不能作为 VERIFIED 依据', requirement, declaredProbeKinds, behaviorAssertions);
  }
  return notVerified('BEHAVIOR_NOT_EXERCISED', '未对该要求执行到真实行为断言', requirement, declaredProbeKinds, behaviorAssertions);
}

/**
 * Compatibility wrapper for the legacy 6-arg `classify(...)`. Legacy probes are
 * static/generic and carry NO distinct per-requirement assertion, so this
 * wrapper can NEVER return VERIFIED — which is the whole point of P2-06.
 */
export function classify(requirement, cov, probeResults = {}, independent = null, registry = null, execution = null) {
  const declaredProbeKinds = (cov?.probes || []).map((id) => probeKind(id));
  const behaviorAssertions = Object.entries(probeResults || {}).map(([id, p]) => ({
    assertion_id: `legacy:${id}`, probe_id: id, probe_kind: probeKind(id),
    command: p?.command || id, exit_code: p?.exit_code ?? null, output_hash: p?.output_hash || null,
    assertion_found: false, skipped: p?.skipped ?? false,
    raw_status: p?.skipped ? 'SKIPPED' : (p?.ok ? 'OK' : 'FAILED'),
    evidence_hash: null, evidence_hash_valid: false, evidence_disk_hash_valid: false,
    evidence_binding_valid: false, evidence_output_hash: null,
    evidence_execution_id: null, evidence_git_head: null, evidence_worktree_fingerprint: null,
    distinct: false,
  }));
  return classifyStrict({
    requirement, behaviorAssertions, declaredProbeKinds,
    blockedRule: registry ? externalBlock(requirement, registry) : null,
    naRule: registry ? notApplicable(requirement, registry) : null,
    sharedEvidenceRejected: false, execution,
  });
}

/* ------------------------------------------------------------- state counts */
export const computeStates = computeStatesFromRows;

export function computeStatesFromMatrix(matrix) {
  const states = { VERIFIED: 0, NOT_VERIFIED: 0, BLOCKED: 0, NOT_APPLICABLE: 0 };
  for (const r of (matrix?.requirements || [])) {
    if (Object.prototype.hasOwnProperty.call(states, r.status)) states[r.status] += 1;
  }
  return states;
}

/* ------------------------------------------------------------------- audit */
function auditLegacyEngine(existing, base, covMap) {
  let legacyBaseline;
  if (existing && existing.schema_version === '1.0' && existing.counts) {
    legacyBaseline = { verdicts: existing.counts, rows: existing.rows?.length || 0, source: 'pre-remediation REQUIREMENT-VERIFICATION-RESULTS.json (schema 1.0)' };
  } else if (existing?.audit?.legacy_baseline) {
    legacyBaseline = existing.audit.legacy_baseline;
  } else {
    legacyBaseline = { verdicts: null, note: 'legacy baseline not available' };
  }
  let staticOnly = 0; let genericCoverage = 0; let noProbes = 0;
  for (const r of base) {
    const kinds = (covMap.get(r.requirement_id)?.probes || []).map((id) => probeKind(id));
    const hasB = kinds.includes('BEHAVIOR_EXECUTION');
    const hasS = kinds.includes('STATIC_EXISTENCE');
    if (!hasB && !hasS) noProbes += 1;
    else if (hasB) genericCoverage += 1;
    else staticOnly += 1;
  }
  return {
    total_requirements: base.length,
    probes_total: Object.keys(probeKindCounts()).length ? PROBE_IDS.length : 0,
    probe_kind_counts: probeKindCounts(),
    legacy_baseline: legacyBaseline,
    legacy_distinct_behavior_assertions: 0,
    note: 'Legacy 7-state engine: 0/538 requirements had a DISTINCT real behaviour assertion. PARTIALLY_VERIFIED verdicts came from shared generic probes + implementation-file presence. Static/file/config probes alone can never verify behaviour.',
    legacy_coverage: {
      requirements_with_generic_command_probes: genericCoverage,
      requirements_static_only_coverage: staticOnly,
      requirements_with_no_declared_probe: noProbes,
    },
  };
}

/* --------------------------------------------------------------- row build */
function buildRow(r, cov, c, behaviorAssertions, execution, blockedRule, naRule) {
  const verified = c.status === RequirementStatus.VERIFIED;
  const implStatus = c.status === 'BLOCKED' ? 'BLOCKED'
    : c.status === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE'
      : r.implementation_status;
  const refs = c.evidence_refs || [];
  const tests = [...(r.test_cases || [])];
  for (const e of refs) tests.push(`${e.probe_id}::${e.assertion_id}`);
  const codeLocations = [...(r.implementation_files || [])];
  for (const e of refs) if (e.command) codeLocations.push(e.command);
  const legacyEvidence = verified ? behaviorAssertions.filter((a) => a.evidence_id).map((a) => ({
    evidence_id: a.evidence_id,
    execution_id: a.evidence_execution_id,
    git_head: a.evidence_git_head,
    worktree_fingerprint: a.evidence_worktree_fingerprint,
    hash_valid: a.evidence_hash_valid,
    recorded_at: now(),
    exit_code: a.exit_code,
    command: a.command,
  })) : [];
  return {
    // ---- mandated strict fields ----
    requirement_id: r.requirement_id,
    original_text: r.requirement,
    module: cov.batch_name || r.specification_id,
    code_locations: codeLocations,
    tests,
    acceptance_criteria: verified
      ? `需真实行为断言：${r.requirement}；已观测 ${refs.map((e) => e.assertion_id).join(', ')}`
      : `[${r.section}] ${r.requirement}`,
    actual_result: c.actual_result,
    evidence_refs: refs,
    status: c.status,
    status_reason: c.status_reason,
    status_reason_code: c.status_reason_code || null,
    verified_at: c.verified_at,
    execution_id: execution?.execution_id || null,
    git_head: execution?.git_head || null,
    worktree_fingerprint: execution?.worktree_fingerprint || null,
    // ---- traceability context ----
    specification_id: r.specification_id,
    section: r.section,
    statement_sha256: r.statement_sha256,
    batch_id: cov.batch_id,
    coverage_basis: cov.coverage_basis,
    declared_probes: cov.probes,
    declared_probe_kinds: cov.probes.map((id) => probeKind(id)),
    behavior_assertions: behaviorAssertions.map((a) => ({
      assertion_id: a.assertion_id, probe_id: a.probe_id, probe_kind: a.probe_kind,
      found: a.assertion_found, reason: a.reason, evidence_id: a.evidence_id,
    })),
    // ---- legacy compatibility fields (status-engine / older consumers) ----
    implementation_status: implStatus,
    implementation_files: r.implementation_files,
    verification_status: c.status,
    verification_state: c.status, // never FULLY_VERIFIED -> status-engine cannot count a fake verified
    // A VERIFIED row MUST bind the real test case that proved it (the probe
    // command + distinct assertion). Independent recounters key on this field;
    // leaving it empty for a VERIFIED row is a coverage lie (P2-06).
    test_cases: verified ? [...tests] : r.test_cases,
    evidence: legacyEvidence,
    blockers: c.status === 'BLOCKED' ? [`external_dependency:${blockedRule?.id || 'undeclared'}`] : (r.blockers || []),
    declared_spec_status: r.declared_spec_status,
    criticality: r.criticality,
    executor_ids: r.executor_ids,
    validator_ids: r.validator_ids,
    owner: r.owner,
    blocked_dependency_id: c.status === 'BLOCKED' ? (blockedRule?.id || null) : null,
    unblock_condition: c.status === 'BLOCKED' ? (blockedRule?.unblock_condition || null) : null,
    na_reason: c.status === 'NOT_APPLICABLE' ? (naRule?.reason || null) : null,
    na_basis: c.status === 'NOT_APPLICABLE' ? (naRule?.basis || null) : null,
    na_approval: c.status === 'NOT_APPLICABLE' ? (naRule?.approving_validator || null) : null,
    timestamp: now(),
  };
}

/* ----------------------------------------------------------- summary report */
function writeCoverageSummary(out, rows) {
  const states = out.states;
  const byReason = {};
  for (const r of rows) if (r.status === 'NOT_VERIFIED') {
    byReason[r.status_reason_code] = (byReason[r.status_reason_code] || 0) + 1;
  }
  const verifiedIdx = rows.filter((r) => r.status === 'VERIFIED').map((r) =>
    `- \`${r.requirement_id}\` → ${r.evidence_refs.map((e) => `${e.assertion_id} (evidence ${e.evidence_id}, sha ${String(e.evidence_hash).slice(0, 12)})`).join(', ')}`);
  const blockedIdx = rows.filter((r) => r.status === 'BLOCKED').map((r) =>
    `- \`${r.requirement_id}\` → ${r.status_reason}`);
  const naIdx = rows.filter((r) => r.status === 'NOT_APPLICABLE').map((r) =>
    `- \`${r.requirement_id}\` → ${r.status_reason}`);
  const behaviorRuns = out.behavior_runs || [];
  const lines = [
    '# 需求验证覆盖摘要（诚实 / audit P2-06）',
    '',
    `> 由 \`node .uap/tools/requirement-verification.mjs\` 的真实运行生成。生成时间：${out.generated_at}。`,
    `> 执行绑定：execution_id=${out.execution_id} / git_head=${out.git_head} / worktree_fingerprint=${out.worktree_fingerprint}。`,
    '',
    '## 结论先行',
    '',
    `- 需求总数 **${rows.length}**（强制性 ${out.totals.mandatory} / 验收 ${out.totals.acceptance}）。`,
    `- 本轮真实执行的**有界行为套件命令**数：**${behaviorRuns.length}**（不盲目执行 538 条命令矩阵）。`,
    `- 真实观测到的**独立行为断言**数：**${behaviorRuns.reduce((n, r) => n + (r.assertions || []).filter((a) => a.found).length, 0)}**。`,
    `- 只有绑定了这些独立行为断言、命令 exit 0、且证据哈希有效并绑定当前执行的要求，才是 VERIFIED。`,
    '',
    '## 状态分布（严格 4 态）',
    '',
    '| 状态 | 数量 |',
    '| --- | ---: |',
    `| VERIFIED | ${states.VERIFIED} |`,
    `| NOT_VERIFIED | ${states.NOT_VERIFIED} |`,
    `| BLOCKED | ${states.BLOCKED} |`,
    `| NOT_APPLICABLE | ${states.NOT_APPLICABLE} |`,
    '',
    '## 各状态桶的证据索引',
    '',
    `### VERIFIED (${states.VERIFIED})`,
    ...(verifiedIdx.length ? verifiedIdx : ['- （无）']),
    '',
    `### NOT_VERIFIED (${states.NOT_VERIFIED}) — 按原因码`,
    ...Object.entries(byReason).sort().map(([k, v]) => `- \`${k}\`: ${v}`),
    '',
    `### BLOCKED (${states.BLOCKED})`,
    ...(blockedIdx.length ? blockedIdx : ['- （无）']),
    '',
    `### NOT_APPLICABLE (${states.NOT_APPLICABLE})`,
    ...(naIdx.length ? naIdx : ['- （无，未登记任何豁免）']),
    '',
    '## 明确声明：哪些没有验证',
    '',
    `- **${states.NOT_VERIFIED} 条 NOT_VERIFIED**：占绝大多数。它们没有针对本要求的独立真实行为断言；`,
    '  旧引擎的 `PARTIALLY_VERIFIED` 来自通用套件/CLI/构建命令与「实现文件存在」这类共享/静态证据，',
    '  并不代表这些要求的行为被真正执行验证过。本轮未将任何 `IMPLEMENTED` 批量转换为 `VERIFIED`。',
    `- **${states.BLOCKED} 条 BLOCKED**：依赖生产授权/真实支付/服务商沙箱/真机等外部条件，未满足，绝不假通过。`,
    `- 旧引擎事实：${out.audit.probe_kind_counts.STATIC_EXISTENCE} 个 STATIC_EXISTENCE 探针（文件/符号/配置/报告卡/文本哈希）、`,
    `  ${out.audit.probe_kind_counts.BEHAVIOR_EXECUTION} 个通用 BEHAVIOR_EXECUTION 命令（整套件/整 CLI/整构建，共享证据）；`,
    '  **0/538 条要求**在旧引擎中拥有独立真实行为断言。',
    '- 外键等「观察即通过」的测试：本引擎要求真实断言（如 `FK enforced` + `orphan rejected`）出现在输出中，',
    '  仅「命令 exit 0」不足以 VERIFIED。',
    '',
    '## 复现命令',
    '',
    '- `node .uap/tools/requirement-verification.mjs`（真实运行，写出 RESULTS + 全 538 严格 MATRIX + 本摘要）',
    '- `node .uap/tools/requirement-verification.mjs --print-states`（从矩阵重算并打印诚实 `states:` 行）',
    '- `node .uap/tools/requirement-verification.mjs --dry-run`（单元/负向测试用，不执行命令、不写文件）',
    '',
  ];
  fs.mkdirSync(path.dirname(COVERAGE_SUMMARY), { recursive: true });
  fs.writeFileSync(COVERAGE_SUMMARY, `${lines.join('\n')}\n`, 'utf8');
}

/* ------------------------------------------------------------- main engine */
function compactRun(run) {
  return {
    id: run.id, command: run.command, probe_kind: run.probe_kind,
    exit_code: run.exit_code, output_hash: run.output_hash, duration_ms: run.duration_ms,
    skipped: run.skipped, dry_run: run.dry_run, timed_out: run.timed_out || false,
    assertions: (run.assertions || []).map((a) => ({
      name: a.name, requirement_id: a.requirement_id, behavior: a.behavior,
      required_output: a.required_output, forbid_output: a.forbid_output,
      found: a.found, reason: a.reason,
      missing_required_output: a.missing_required_output, forbidden_output_present: a.forbidden_output_present,
    })),
  };
}

export async function verifyRequirements({ batches = null, dryRun = false, executeProbes = true } = {}) {
  const registry = loadRegistry();
  const { requirements: base, specs, tests } = extractRequirements();
  const execution0 = currentExecution(); // establish identity early
  const covMap = coverageMap({ requirements: base }, registry);
  const existing = readJSON(RESULTS, null); // read BEFORE overwrite (honest legacy audit)
  const audit = auditLegacyEngine(existing, base, covMap);

  // Bounded set of REAL behaviour suite runs (never a 538-command matrix).
  const shouldExecute = executeProbes && !dryRun;
  const behaviorRuns = await runBehaviorProbes(registry.behavior_probes || [], { dryRun: !shouldExecute });

  // ONE immutable evidence record per REAL behaviour run, bound to current
  // execution. Its binding becomes the AUTHORITATIVE execution for the report.
  const evidenceByRun = {};
  for (const run of behaviorRuns) {
    if (run.dry_run || run.skipped || run.exit_code === null) { evidenceByRun[run.id] = null; continue; }
    const passedAssertions = run.assertions.filter((a) => a.found).map((a) => a.requirement_id);
    const ev = record({
      kind: 'requirement_behavior_verification',
      command: run.command,
      exit_code: run.exit_code,
      summary: `behaviour run ${run.id}: ${passedAssertions.length}/${run.assertions.length} distinct assertions observed in real stdout`,
      specification_ids: [...new Set(passedAssertions.map((id) => id.replace(/-(REQ|ACC)-\d+$/, '')))],
      requirement_ids: passedAssertions,
      inputs: { assertions: run.assertions.map((a) => ({ name: a.name, required_output: a.required_output, found: a.found })) },
      stdout: (run.stdout || '').slice(0, 50000),
      findings: run.assertions.filter((a) => !a.found).map((a) => ({
        severity: 'WARN', code: 'assertion_not_observed', message: `${a.name}: ${a.reason}`,
      })),
    });
    const rec = getEvidence(ev.evidence_id);
    const v = verifyEvidence(ev.evidence_id);
    const diskHashValid = rec ? sha(JSON.stringify({ ...rec, content_hash: null })) === rec.content_hash : false;
    evidenceByRun[run.id] = {
      evidence_id: ev.evidence_id, evidence_path: ev.file, content_hash: ev.content_hash,
      output_hash: run.output_hash, hash_valid: v.hash_valid, disk_hash_valid: diskHashValid,
      binding_valid: v.binding_valid,
      execution_id: rec?.execution_id || null, git_head: rec?.git_head || null,
      worktree_fingerprint: rec?.worktree_fingerprint || null,
      requirement_ids: passedAssertions,
    };
  }
  const evList = Object.values(evidenceByRun).filter(Boolean);
  const execution = evList.length
    ? { execution_id: evList[0].execution_id, git_head: evList[0].git_head, worktree_fingerprint: evList[0].worktree_fingerprint }
    : execution0;
  const executionConsistent = evList.every((e) => e.execution_id === execution.execution_id
    && e.git_head === execution.git_head && e.worktree_fingerprint === execution.worktree_fingerprint);
  const execBindingUsable = executionConsistent && Boolean(execution?.execution_id && execution?.git_head);

  // Build per-requirement behaviour assertion bindings with distinct assertions.
  const bindingsByReq = new Map();
  const allBindings = [];
  for (const run of behaviorRuns) {
    const ev = evidenceByRun[run.id];
    for (const a of run.assertions) {
      const rec = {
        assertion_id: (a.required_output && a.required_output[0]) || a.name,
        probe_id: run.id, probe_kind: run.probe_kind, command: run.command,
        exit_code: run.exit_code, output_hash: run.output_hash,
        required_output: a.required_output, forbid_output: a.forbid_output,
        assertion_found: a.found, skipped: run.skipped,
        raw_status: run.dry_run ? 'DRY_RUN_NOT_EXECUTED' : (run.exit_code === 0 ? 'OK' : 'FAILED'),
        behavior: a.behavior, reason: a.reason,
        evidence_id: ev?.evidence_id || null, evidence_hash: ev?.content_hash || null,
        evidence_hash_valid: ev?.hash_valid || false,
        evidence_disk_hash_valid: ev?.disk_hash_valid || false,
        evidence_binding_valid: ev?.binding_valid || false,
        evidence_output_hash: ev?.output_hash || null,
        evidence_execution_id: ev?.execution_id || null,
        evidence_git_head: ev?.git_head || null,
        evidence_worktree_fingerprint: ev?.worktree_fingerprint || null,
        distinct: true,
      };
      if (!bindingsByReq.has(a.requirement_id)) bindingsByReq.set(a.requirement_id, []);
      bindingsByReq.get(a.requirement_id).push(rec);
      allBindings.push({ requirement_id: a.requirement_id, assertion_id: rec.assertion_id, command: rec.command });
    }
  }
  const shared = detectSharedEvidence(allBindings);

  // Classify ALL 538 requirements (no sampling, no truncation).
  const rows = [];
  for (const r of base) {
    const cov = covMap.get(r.requirement_id) || { batch_id: 'UNMAPPED', batch_name: null, probes: [], coverage_basis: 'unmapped' };
    const blockedRule = externalBlock(r, registry);
    const naRule = notApplicable(r, registry);
    const behaviorAssertions = bindingsByReq.get(r.requirement_id) || [];
    const c = classifyStrict({
      requirement: r,
      behaviorAssertions,
      declaredProbeKinds: cov.probes.map((id) => probeKind(id)),
      blockedRule, naRule,
      sharedEvidenceRejected: shared.rejected.has(r.requirement_id),
      execution: execBindingUsable ? execution : null,
      verifiedAt: now(),
    });
    rows.push(buildRow(r, cov, c, behaviorAssertions, execution, blockedRule, naRule));
  }
  let states = computeStates(rows);

  // Independent validator: re-verify evidence from disk + re-derive counts.
  const { independentValidate } = await import('./requirement-independent-validator.mjs');
  const independent = await independentValidate({ rows, states, execution, write: !dryRun });
  if (!independent.ok) {
    for (const row of rows) if (row.status === RequirementStatus.VERIFIED) {
      row.status = RequirementStatus.NOT_VERIFIED;
      row.status_reason_code = 'EVIDENCE_INVALID_OR_STALE';
      row.status_reason = `独立校验器未通过，证据不可信，fail-closed 降级：${independent.problems.slice(0, 2).join('; ')}`;
      row.actual_result = '独立校验失败，fail-closed 降级为 NOT_VERIFIED';
      row.evidence_refs = [];
      row.verified_at = null;
    }
    states = computeStates(rows);
  }

  const out = {
    schema_version: '2.0',
    report_id: 'REQUIREMENT-VERIFICATION-RESULTS',
    status_model: 'RequirementStatus = VERIFIED | NOT_VERIFIED | BLOCKED | NOT_APPLICABLE',
    generated_at: now(),
    generator: 'node .uap/tools/requirement-verification.mjs',
    execution_id: execution?.execution_id || null,
    git_head: execution?.git_head || null,
    worktree_fingerprint: execution?.worktree_fingerprint || null,
    execution_binding_usable: execBindingUsable,
    dry_run: dryRun,
    totals: {
      requirements: rows.length,
      specifications: specs.length,
      mandatory: rows.filter((r) => r.section === '强制性要求').length,
      acceptance: rows.filter((r) => r.section === '验收条件').length,
      probes_registered_legacy: PROBE_IDS.length,
      behavior_suite_runs: behaviorRuns.length,
      behavior_assertions_observed: behaviorRuns.reduce((n, r) => n + (r.assertions || []).filter((a) => a.found).length, 0),
      batches: batches?.length || (registry.batches || []).length,
    },
    states,
    counts: states, // `verify-requirements` CLI reads the states:/counts line
    audit,
    probe_kinds: probeKindCounts(),
    shared_evidence_conflicts: shared.conflicts,
    behavior_runs: behaviorRuns.map(compactRun),
    behavior_evidence: evidenceByRun,
    independent_validation: independent,
    rows,
  };

  if (!dryRun) {
    writeJSON(RESULTS, out);
    writeMatrix(rows, { specs, tests, overlay: new Map(rows.map((r) => [r.requirement_id, r])) });
    writeCoverageSummary(out, rows);
  }
  return out;
}

/** Consumed by legacy consumers; now returns the strict rows with a stale-check. */
export function verificationOverlay() {
  const j = readJSON(RESULTS, null);
  if (!j?.rows?.length) return null;
  let e;
  try { e = currentExecution(); } catch { return null; }
  if (j.execution_id !== e.execution_id || j.git_head !== e.git_head
      || j.worktree_fingerprint !== e.worktree_fingerprint) return null;
  return new Map(j.rows.map((r) => [r.requirement_id, r]));
}

/* ------------------------------------------------------------------- CLI */
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const args = process.argv.slice(2);
  const batches = args.filter((a) => a.startsWith('--batch=')).map((a) => a.split('=')[1]).filter(Boolean);
  const dryRun = args.includes('--dry-run');
  const executeProbes = !args.includes('--no-execute-probes') && !dryRun;
  try {
    if (args.includes('--print-states')) {
      const m = readJSON(MATRIX, null);
      const states = computeStatesFromMatrix(m);
      console.log(`states: ${JSON.stringify(states)}`);
      process.exit(0);
    }
    const out = await verifyRequirements({ batches: batches.length ? batches : null, dryRun, executeProbes });
    console.log(`requirement verification: ${out.totals.requirements} requirements / ${out.totals.behavior_suite_runs} real behaviour suite runs / ${out.totals.behavior_assertions_observed} distinct assertions observed`);
    console.log(`states: ${JSON.stringify(out.states)}`);
    console.log(`independent validator: ${out.independent_validation.ok ? 'PASS' : 'FAIL'}`);
    if (dryRun) console.log('DRY RUN: no commands executed, no artifacts written');
    process.exit(0);
  } catch (e) {
    console.error(`FATAL: ${e.stack || e.message}`);
    process.exit(1);
  }
}
