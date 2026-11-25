/**
 * UAP Requirement extraction + strict traceability matrix (audit P2-06).
 *
 * IDs are STABLE by construction: `<spec-id>-REQ-<ordinal>` / `-ACC-<ordinal>`
 * derive only from the specification ID and the item's position in the
 * "强制性要求" / "验收条件" section. They never depend on report content,
 * timestamps or text hashes, so regenerating a report cannot renumber a
 * requirement. A per-statement sha256 is stored separately to detect wording
 * drift without changing the ID.
 *
 *   node .uap/tools/requirement-matrix.mjs            # regenerate strict matrix
 *   node .uap/tools/requirement-matrix.mjs --check   # verify ID stability only
 *
 * The strict 4-state status (RequirementStatus) is produced by
 * requirement-verification.mjs. This module reads that tool's real RESULTS.json
 * (with a current-execution stale check) and overlays it, so that BOTH the
 * verification tool AND a standalone matrix regeneration yield the SAME honest
 * strict fields. Extraction alone NEVER claims a VERIFIED status.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { currentExecution } from '../runtime/status-engine/execution.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const UAP = path.join(ROOT, '.uap');
const OUT_JSON = path.join(UAP, 'reports', 'REQUIREMENT-TRACEABILITY-MATRIX.json');
const RESULTS = path.join(UAP, 'reports', 'REQUIREMENT-VERIFICATION-RESULTS.json');

const SECTIONS = [
  { key: '强制性要求', tag: 'REQ' },
  { key: '验收条件', tag: 'ACC' },
];

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const readIf = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const readJSON = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };

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
 * BASE extraction. Honest by construction: no requirement is VERIFIED here.
 * A status is assigned ONLY by the strict verification overlay (RESULTS.json),
 * never by file existence, a test-case name, or a spec's self-declared header.
 */
export function extractRequirements() {
  const registry = loadSpecRegistry();
  const validatorImpls = loadValidatorImpls();
  const executorImpls = loadExecutorImpls();
  const tests = collectTestCases();
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

        const implemented = implementationFiles.length > 0;
        const implementationStatus = implemented ? 'IMPLEMENTED' : 'NOT_IMPLEMENTED';

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
          // Honest baseline: extraction NEVER verifies a requirement.
          verification_status: 'NOT_VERIFIED',
          verification_state: 'NOT_VERIFIED',
          status: 'NOT_VERIFIED',
          status_reason: 'NO_VALIDATOR: 尚未由严格验证引擎执行真实行为断言',
          original_text: statement,
          module: spec.id,
          code_locations: implementationFiles,
          tests: testCases,
          acceptance_criteria: `[${key}] ${statement}`,
          actual_result: '未执行任何真实行为命令；提取阶段不产生验证结论',
          evidence_refs: [],
          verified_at: null,
          execution_id: null,
          git_head: null,
          worktree_fingerprint: null,
          evidence: [],
          blockers: implemented ? [] : ['implementation_file_missing'],
          owner: null,
        });
      });
    }
  }
  return { requirements, specs: registry, tests };
}

/**
 * Compare a generated matrix against the current registered specification
 * catalog. The registry + numbered requirement sections are authoritative;
 * a historical count or a stale matrix can never define completeness.
 */
export function compareRequirementIds(rows, expectedRequirements = null) {
  const expected = expectedRequirements ?? extractRequirements().requirements;
  if (!Array.isArray(expected)) throw new Error('registered requirement catalog is not an array');
  const actualRows = Array.isArray(rows) ? rows : [];
  const expectedIds = expected.map((r) => r?.requirement_id);
  const actualIds = actualRows.map((r) => r?.requirement_id ?? r?.id ?? null);
  const expectedCounts = new Map();
  const actualCounts = new Map();
  for (const id of expectedIds) expectedCounts.set(id, (expectedCounts.get(id) || 0) + 1);
  for (const id of actualIds) actualCounts.set(id, (actualCounts.get(id) || 0) + 1);
  const expectedDuplicateIds = [...expectedCounts].filter(([, count]) => count > 1).map(([id]) => id);
  const duplicateIds = [...actualCounts].filter(([, count]) => count > 1).map(([id]) => id);
  const expectedSet = new Set(expectedIds);
  const actualSet = new Set(actualIds.filter((id) => typeof id === 'string' && id.trim()));
  const missingIds = expectedIds.filter((id) => !actualSet.has(id));
  const unexpectedIds = actualIds.filter((id) => typeof id !== 'string' || !expectedSet.has(id));
  const invalidRowCount = actualIds.filter((id) => typeof id !== 'string' || !id.trim()).length;
  const ok = expectedIds.length > 0
    && expectedDuplicateIds.length === 0
    && actualRows.length === expectedIds.length
    && duplicateIds.length === 0
    && invalidRowCount === 0
    && missingIds.length === 0
    && unexpectedIds.length === 0;
  return {
    ok,
    expected_total: expectedIds.length,
    actual_total: actualRows.length,
    expected_duplicate_ids: expectedDuplicateIds,
    duplicate_ids: duplicateIds,
    invalid_row_count: invalidRowCount,
    missing_ids: missingIds,
    unexpected_ids: unexpectedIds,
  };
}

/**
 * Apply the strict verification overlay from RESULTS.json, but ONLY when that
 * file was produced against the CURRENT execution (id / HEAD / worktree
 * fingerprint). A stale overlay can never promote a historical PASS.
 */
export function strictOverlay() {
  const j = readJSON(RESULTS, null);
  if (!j?.rows?.length) return null;
  let e;
  try { e = currentExecution(); } catch { return null; }
  if (j.execution_id !== e.execution_id || j.git_head !== e.git_head
      || j.worktree_fingerprint !== e.worktree_fingerprint) return null;
  return new Map(j.rows.map((r) => [r.requirement_id, r]));
}

/** Merge strict result rows into base extraction rows (for standalone regen). */
function applyOverlay(requirements, overlay) {
  if (!overlay) return requirements;
  for (const r of requirements) {
    const ov = overlay.get(r.requirement_id);
    if (!ov) continue;
    for (const k of ['status', 'status_reason', 'actual_result', 'evidence_refs',
      'verified_at', 'execution_id', 'git_head', 'worktree_fingerprint',
      'module', 'code_locations', 'tests', 'acceptance_criteria',
      'verification_status', 'verification_state', 'implementation_status',
      'evidence', 'blockers', 'na_reason', 'na_basis', 'na_approval']) {
      if (ov[k] !== undefined) r[k] = ov[k];
    }
  }
  return requirements;
}

/** Count states from requirement rows (single source of truth for states:). */
export function computeStatesFromRows(rows) {
  const states = { VERIFIED: 0, NOT_VERIFIED: 0, BLOCKED: 0, NOT_APPLICABLE: 0 };
  for (const r of rows) {
    const s = r.status;
    if (Object.prototype.hasOwnProperty.call(states, s)) states[s] += 1;
  }
  return states;
}

export function buildMatrix() {
  const { requirements, specs, tests } = extractRequirements();
  const overlay = strictOverlay();
  applyOverlay(requirements, overlay);
  return assembleMatrix(requirements, specs, tests, overlay);
}

function assembleMatrix(requirements, specs, tests, overlay) {
  const implCounts = {};
  const verCounts = {};
  const bySpec = {};
  for (const r of requirements) {
    implCounts[r.implementation_status] = (implCounts[r.implementation_status] || 0) + 1;
    verCounts[r.verification_status] = (verCounts[r.verification_status] || 0) + 1;
    (bySpec[r.specification_id] ||= []).push(r.requirement_id);
  }
  const states = computeStatesFromRows(requirements);
  let execution = null;
  try { execution = currentExecution(); } catch { execution = null; }
  return {
    schema_version: '2.0',
    status_model: 'RequirementStatus = VERIFIED | NOT_VERIFIED | BLOCKED | NOT_APPLICABLE',
    generated_at: new Date().toISOString(),
    generator: 'node .uap/tools/requirement-verification.mjs (strict) / requirement-matrix.mjs',
    id_policy: 'stable: <spec-id>-REQ|ACC-<ordinal-in-section>; text hash stored separately, never used to mint IDs',
    // Flat binding fields are REQUIRED: the evidence manifest's
    // REQUIRED_REPORT_FIELDS and the final acceptance gate read them
    // uniformly from every final report (nested `execution` kept for
    // human readability + binding_policy documentation).
    execution_id: execution?.execution_id || null,
    git_head: execution?.git_head || null,
    worktree_fingerprint: execution?.worktree_fingerprint || null,
    environment_fingerprint: execution?.environment_fingerprint || null,
    execution: {
      id: execution?.execution_id || null,
      git_head: execution?.git_head || null,
      worktree_fingerprint: execution?.worktree_fingerprint || null,
      environment_fingerprint: execution?.environment_fingerprint || null,
      binding_policy: 'VERIFIED requires a real BEHAVIOR_EXECUTION command bound to THIS execution with a distinct output assertion and hash-valid evidence',
    },
    totals: {
      specifications: specs.length,
      requirements: requirements.length,
      mandatory: requirements.filter((r) => r.section === '强制性要求').length,
      acceptance: requirements.filter((r) => r.section === '验收条件').length,
      discovered_test_cases: tests.length,
    },
    implementation_status_counts: implCounts,
    verification_status_counts: verCounts,
    states,
    verification_overlay: overlay ? {
      source: '.uap/reports/REQUIREMENT-VERIFICATION-RESULTS.json',
      generator: 'requirement-verification.mjs (real behaviour probes + independent validator)',
    } : { source: null, note: 'no current-version strict overlay present' },
    specifications: specs.map((s) => ({
      specification_id: s.id,
      requirement_ids: bySpec[s.id] || [],
      declared_status: s.status || null,
    })),
    requirements,
  };
}

/** ID-stability guard: a regenerated matrix must never silently renumber. */
function assertStableIds(rows) {
  const ids = rows.map((r) => r.requirement_id);
  if (new Set(ids).size !== ids.length) throw new Error('duplicate requirement IDs');
  if (fs.existsSync(OUT_JSON)) {
    const prev = readJSON(OUT_JSON, null);
    const prevIds = (prev?.requirements || []).map((r) => r.requirement_id);
    if (prevIds.length && (prevIds.length !== ids.length || prevIds.some((x, i) => x !== ids[i]))) {
      throw new Error('requirement ID set changed — refusing to silently renumber');
    }
  }
}

/**
 * Write the strict matrix JSON (the ONE owned generated artifact).
 * `rows` may already be fully enriched (from verifyRequirements) or base rows.
 */
export function writeMatrix(rows, { specs = null, tests = null, overlay = null } = {}) {
  assertStableIds(rows);
  const s = specs || loadSpecRegistry();
  const t = tests || collectTestCases();
  const m = assembleMatrix(rows, s, t, overlay);
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, `${JSON.stringify(m, null, 2)}\n`, 'utf8');
  return m;
}

const checkOnly = process.argv.includes('--check');
if (checkOnly) {
  const { requirements, specs, tests } = extractRequirements();
  assertStableIds(requirements);
  console.log(`CHECK OK: ${requirements.length} requirements, IDs stable, ` +
    `${specs.length} specs, ${tests.length} test cases discovered`);
} else if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const m = buildMatrix();
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, `${JSON.stringify(m, null, 2)}\n`, 'utf8');
  console.log(`matrix written: ${m.totals.requirements} requirements / ${m.totals.specifications} specs`);
  console.log(`states: ${JSON.stringify(m.states)}`);
}
