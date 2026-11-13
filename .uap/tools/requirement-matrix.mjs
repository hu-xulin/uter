/**
 * UAP Requirement extraction + traceability matrix.
 *
 * IDs are STABLE by construction: `<spec-id>-REQ-<ordinal>` / `-ACC-<ordinal>`
 * derive only from the specification ID and the item's position in the
 * "强制性要求" / "验收条件" section. They never depend on report content,
 * timestamps or text hashes, so regenerating a report cannot renumber a
 * requirement. A per-statement sha256 is stored separately to detect wording
 * drift without changing the ID.
 *
 *   node .uap/tools/requirement-matrix.mjs            # regenerate JSON + MD
 *   node .uap/tools/requirement-matrix.mjs --check    # verify stability, no writes
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { currentEvidence } from '../runtime/evidence-engine/index.mjs';
import { verificationOverlay } from './requirement-verification.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const UAP = path.join(ROOT, '.uap');
const OUT_JSON = path.join(UAP, 'reports', 'REQUIREMENT-TRACEABILITY-MATRIX.json');
const OUT_MD = path.join(UAP, 'reports', 'REQUIREMENT-TRACEABILITY-MATRIX.md');

const SECTIONS = [
  { key: '强制性要求', tag: 'REQ' },
  { key: '验收条件', tag: 'ACC' },
];

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const readIf = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

/** Minimal, deterministic YAML reader for the two registries we need. */
function loadSpecRegistry() {
  const text = readIf(path.join(UAP, 'config', 'specification-registry.yaml'));
  const out = [];
  let cur = null;
  for (const line of text.split('\n')) {
    const mId = line.match(/^\s*-\s*id:\s*(UAP-\d{2}-\d{3})\s*$/);
    if (mId) { cur = { id: mId[1] }; out.push(cur); continue; }
    if (!cur) continue;
    const m = line.match(/^\s{4}(file|executor|validator|domain|criticality|status):\s*"?([^"\n]+?)"?\s*$/);
    if (m) cur[m[1]] = m[2];
  }
  return out;
}
function loadValidatorImpls() {
  const text = readIf(path.join(UAP, 'config', 'validator-registry.yaml'));
  const out = new Map();
  let cur = null;
  for (const line of text.split('\n')) {
    // IDs may contain digits (e.g. cross_platform.h5_integrity). A letters-only
    // class silently dropped those entries and made real implementations look
    // absent in the matrix.
    const mId = line.match(/^\s*-\s*id:\s*([a-z][a-z0-9_.]+)\s*$/);
    if (mId) { cur = mId[1]; out.set(cur, null); continue; }
    if (!cur) continue;
    const m = line.match(/^\s+implementation:\s*(\S+)/);
    if (m) out.set(cur, m[1]);
  }
  return out;
}
function loadExecutorImpls() {
  const text = readIf(path.join(UAP, 'config', 'execution-mapping.yaml'));
  const out = new Map();
  for (const line of text.split('\n')) {
    const m = line.match(/^\s{4}([a-z][a-z0-9_]*):\s*(\.uap\/\S+)/);
    if (m) out.set(m[1], m[2]);
  }
  return out;
}

/** Collect real test case names from every .uap/tests/*.test.mjs. */
function collectTestCases() {
  const dir = path.join(UAP, 'tests');
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.test.mjs'))) {
    const t = readIf(path.join(dir, f));
    for (const m of t.matchAll(/\btest\(\s*['"`]([^'"`]+)['"`]/g)) {
      out.push({ file: rel(path.join(dir, f)), name: m[1] });
    }
  }
  return out;
}

/**
 * Structured evidence for the CURRENT execution only.
 *
 * A bare evidence id string proves nothing: status-engine requires an object
 * carrying execution_id / git_head / worktree_fingerprint / hash_valid. Only
 * records that were really written by this run and whose SHA-256 verifies are
 * returned. Evidence is linked to a requirement ONLY by an explicit
 * requirement_ids / specification_ids declaration on the record — never by
 * guessing from text similarity.
 */
function loadCurrentEvidence() {
  const f = path.join(UAP, 'state', 'current-execution.json');
  let execution = null;
  if (fs.existsSync(f)) {
    try { execution = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { execution = null; }
  }
  const evidence = currentEvidence().filter((e) => e.hash_valid && e.binding_valid);
  return {
    executionId: execution?.execution_id || null,
    head: execution?.git_head || null,
    fingerprint: execution?.worktree_fingerprint || null,
    evidence,
  };
}

export function extractRequirements() {
  const registry = loadSpecRegistry();
  const validatorImpls = loadValidatorImpls();
  const executorImpls = loadExecutorImpls();
  const tests = collectTestCases();
  const current = loadCurrentEvidence();
  const requirements = [];

  for (const spec of registry) {
    if (!spec.file) throw new Error(`${spec.id}: no file in specification-registry.yaml`);
    const abs = path.join(ROOT, spec.file);
    if (!fs.existsSync(abs)) throw new Error(`${spec.id}: spec file missing at ${spec.file}`);
    const text = fs.readFileSync(abs, 'utf8');
    const declaredStatus = (text.match(/\*\*状态：\*\*\s*([A-Z_]+)/) || [])[1] || 'MISSING';
    const headingSections = {};
    for (const { key } of SECTIONS) {
      const re = new RegExp(`^## ${key}\\s*$`, 'm');
      const parts = text.split(re);
      headingSections[key] = (parts[1] || '').split(/^## /m)[0];
    }

    for (const { key, tag } of SECTIONS) {
      const body = headingSections[key];
      const items = body.split('\n').filter((l) => /^\d+\.\s+/.test(l));
      items.forEach((line, i) => {
        const ordinal = i + 1;
        const statement = line.replace(/^\d+\.\s+/, '').trim();
        const id = `${spec.id}-${tag}-${String(ordinal).padStart(3, '0')}`;
        const executorImpl = executorImpls.get((spec.executor || '').split('.').pop()) || null;
        const validatorImpl = validatorImpls.get(spec.validator) || null;
        const implementationFiles = [executorImpl, validatorImpl]
          .filter((p) => p && fs.existsSync(path.join(ROOT, p)));

        // Test cases are linked only when the test name genuinely mentions the
        // spec id, the requirement id, or the tag. Never fabricate a link.
        const testCases = tests
          .filter((t) => t.name.includes(spec.id) || t.name.includes(id) || t.name.includes(`${tag}-`))
          .map((t) => `${t.file}::${t.name}`);

        // Status is derived from evidence, not from the spec's self-declared
        // header. A current-execution evidence record is required for VERIFIED.
        const evidence = current.evidence
          .filter((e) => (e.requirement_ids || []).includes(id)
            || ((e.requirement_ids || []).length === 0 && (e.specification_ids || []).includes(spec.id)))
          .map((e) => ({
            evidence_id: e.evidence_id,
            execution_id: e.execution_id,
            git_head: e.git_head,
            worktree_fingerprint: e.worktree_fingerprint,
            hash_valid: e.hash_valid,
            recorded_at: e.recorded_at,
            exit_code: e.exit_code,
            command: e.command,
          }));
        const implemented = implementationFiles.length > 0;
        let implementationStatus;
        if (!implemented) implementationStatus = 'NOT_IMPLEMENTED';
        else if (declaredStatus === 'IMPLEMENTED_NOT_VERIFIED') implementationStatus = 'IMPLEMENTED_NOT_VERIFIED';
        else implementationStatus = 'IMPLEMENTED';

        const verificationStatus = evidence.length && testCases.length
          ? 'VERIFIED'
          : (testCases.length ? 'IMPLEMENTED_NOT_VERIFIED' : 'NOT_VERIFIED');

        requirements.push({
          requirement_id: id,
          specification_id: spec.id,
          section: key,
          requirement: statement,
          statement_sha256: sha(statement),
          declared_spec_status: declaredStatus,
          criticality: spec.criticality || null,
          implementation_status: implementationStatus,
          implementation_files: implementationFiles,
          executor_ids: spec.executor ? [spec.executor] : [],
          validator_ids: spec.validator ? [spec.validator] : [],
          test_cases: testCases,
          last_execution_id: current.executionId,
          verification_status: verificationStatus,
          evidence,
          blockers: [
            ...(implementationFiles.length < 2 ? ['implementation_file_missing'] : []),
            ...(testCases.length === 0 ? ['no_linked_test_case'] : []),
            ...(evidence.length === 0 ? ['no_current_execution_evidence'] : []),
          ],
          owner: null,
        });
      });
    }
  }
  return { requirements, specs: registry, tests, current };
}

export function buildMatrix() {
  const { requirements, specs, tests, current } = extractRequirements();
  // Real Phase-2 verification overlay. It is produced by actually executing
  // declared probes (uap verify-requirements) and is STALE-checked inside
  // verificationOverlay(): an overlay from another code version is ignored,
  // never promoted into the current run.
  const overlay = verificationOverlay();
  const ovCounts = {};
  const VERIFIED_STATE = 'FULLY_VERIFIED';
  for (const r of requirements) {
    const ov = overlay?.get(r.requirement_id) || null;
    if (!ov) continue;
    // Fail-closed mapping into the matrix's own fields. A requirement is
    // VERIFIED only when the overlay itself says FULLY_VERIFIED.
    r.verification_state = ov.verification_state;
    r.verification_reason = ov.reason || null;
    r.coverage_basis = ov.coverage_basis || null;
    r.probes = ov.probes || [];
    r.blocked_dependency_id = ov.blocked_dependency_id || null;
    r.unblock_condition = ov.unblock_condition || null;
    r.na_reason = ov.na_reason || null;
    r.na_basis = ov.na_basis || null;
    r.na_approval = ov.na_approval || null;
    r.evidence_hash = ov.evidence_hash || null;
    if (ov.verification_state === VERIFIED_STATE) {
      r.verification_status = 'VERIFIED';
    } else if (ov.verification_state === 'NOT_APPLICABLE') {
      r.verification_status = 'NOT_APPLICABLE';
      r.implementation_status = 'NOT_APPLICABLE';
      // Replace the generic traceability blockers with the real N/A reason.
      r.blockers = ['not_applicable_with_reviewed_basis'];
    } else if (ov.verification_state === 'BLOCKED') {
      r.verification_status = 'BLOCKED';
      r.implementation_status = 'BLOCKED';
      // Only the REAL external dependency is a blocker here.
      r.blockers = [`external_dependency:${ov.blocked_dependency_id || 'undeclared'}`];
    } else {
      r.verification_status = ov.verification_state;
    }
    if (ov.verification_state === 'NOT_BUILT' || ov.verification_state === 'PARTIALLY_BUILT') {
      r.implementation_status = ov.verification_state;
    }
    ovCounts[ov.verification_state] = (ovCounts[ov.verification_state] || 0) + 1;
  }
  const counts = {};
  for (const r of requirements) {
    counts[r.implementation_status] = (counts[r.implementation_status] || 0) + 1;
  }
  const vcounts = {};
  for (const r of requirements) vcounts[r.verification_status] = (vcounts[r.verification_status] || 0) + 1;
  const bySpec = {};
  for (const r of requirements) (bySpec[r.specification_id] ||= []).push(r.requirement_id);
  return {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    generator: 'node .uap/tools/requirement-matrix.mjs',
    id_policy: 'stable: <spec-id>-REQ|ACC-<ordinal-in-section>; text hash stored separately, never used to mint IDs',
    execution: {
      id: current.executionId,
      git_head: current.head,
      worktree_fingerprint: current.fingerprint,
      evidence_records_current: current.evidence.length,
      binding_policy: 'explicit requirement_ids / specification_ids on real, hash-valid evidence records only',
    },
    totals: {
      specifications: specs.length,
      requirements: requirements.length,
      mandatory: requirements.filter((r) => r.section === '强制性要求').length,
      acceptance: requirements.filter((r) => r.section === '验收条件').length,
      discovered_test_cases: tests.length,
    },
    implementation_status_counts: counts,
    verification_status_counts: vcounts,
    verification_state_counts: ovCounts,
    verification_overlay: overlay ? {
      source: '.uap/reports/REQUIREMENT-VERIFICATION-RESULTS.json',
      generator: 'uap verify-requirements (real probe execution + independent validator)',
    } : { source: null, note: 'no current-version verification overlay present' },
    specifications: specs.map((s) => ({
      specification_id: s.id,
      requirement_ids: bySpec[s.id] || [],
      declared_status: s.status || null,
    })),
    requirements,
  };
}

function mdReport(m) {
  const lines = [
    '# UAP 1.0 — 规范追踪矩阵',
    '',
    `> 由 \`node .uap/tools/requirement-matrix.mjs\` 从 32 份规范原文真实提取生成。`,
    `> 生成时间：${m.generated_at}。ID 策略：${m.id_policy}。`,
    '',
    '## 汇总',
    '',
    `| 项 | 数量 |`,
    `| --- | ---: |`,
    `| 规范 | ${m.totals.specifications} |`,
    `| 要求总数 | ${m.totals.requirements} |`,
    `| 强制性要求 | ${m.totals.mandatory} |`,
    `| 验收条件 | ${m.totals.acceptance} |`,
    `| 已发现测试用例 | ${m.totals.discovered_test_cases} |`,
    '',
    '## 实现状态分布',
    '',
    '| 状态 | 数量 |',
    '| --- | ---: |',
    ...Object.entries(m.implementation_status_counts).sort().map(([k, v]) => `| ${k} | ${v} |`),
    '',
    '## 验证状态分布',
    '',
    '| 状态 | 数量 |',
    '| --- | ---: |',
    ...Object.entries(m.verification_status_counts).sort().map(([k, v]) => `| ${k} | ${v} |`),
    '',
    '> `VERIFIED` 只在该要求同时具备「当前执行 ID 的证据」与「真实链接的测试用例」时出现；',
    '> 规范头部自述的 `ACTIVE` 不会被当作验证证据。',
    '',
    '## 按规范索引',
    '',
    '| 规范 | 自述状态 | 要求数 | 要求 ID 范围 |',
    '| --- | --- | ---: | --- |',
    ...m.specifications.map((s) => `| ${s.specification_id} | ${s.declared_status} | ${s.requirement_ids.length} | ${s.requirement_ids[0] || '—'} … ${s.requirement_ids.at(-1) || '—'} |`),
    '',
    '## 要求明细',
    '',
    '| Requirement ID | 状态 | 验证 | 实现文件 | 测试 | 阻断 | 要求 |',
    '| --- | --- | --- | --- | ---: | --- | --- |',
    ...m.requirements.map((r) => `| \`${r.requirement_id}\` | ${r.implementation_status} | ${r.verification_status} | ${r.implementation_files.length} | ${r.test_cases.length} | ${r.blockers.length} | ${r.requirement.replace(/\|/g, '\\|').slice(0, 90)} |`),
    '',
    '> 完整字段（含 statement_sha256 / evidence / executor_ids / validator_ids / owner）见',
    '> `.uap/reports/REQUIREMENT-TRACEABILITY-MATRIX.json`。',
    '',
  ];
  return lines.join('\n');
}

const checkOnly = process.argv.includes('--check');
const m = buildMatrix();

// Stability guard: IDs must be unique, and identical to a previously written
// matrix if the spec texts have not changed.
const ids = m.requirements.map((r) => r.requirement_id);
if (new Set(ids).size !== ids.length) {
  console.error('FATAL: duplicate requirement IDs');
  process.exit(1);
}
if (fs.existsSync(OUT_JSON)) {
  const prev = JSON.parse(fs.readFileSync(OUT_JSON, 'utf8'));
  const prevIds = (prev.requirements || []).map((r) => r.requirement_id);
  if (prevIds.length && (prevIds.length !== ids.length || prevIds.some((x, i) => x !== ids[i]))) {
    console.error('FATAL: requirement ID set changed — refusing to silently renumber');
    process.exit(1);
  }
}

if (checkOnly) {
  console.log(`CHECK OK: ${m.totals.requirements} requirements, IDs stable, ` +
    `${m.totals.specifications} specs, ${m.totals.discovered_test_cases} test cases discovered`);
} else {
  fs.writeFileSync(OUT_JSON, `${JSON.stringify(m, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_MD, mdReport(m), 'utf8');
  console.log(`matrix written: ${m.totals.requirements} requirements / ${m.totals.specifications} specs`);
  console.log(`implementation: ${JSON.stringify(m.implementation_status_counts)}`);
  console.log(`verification  : ${JSON.stringify(m.verification_status_counts)}`);
}
