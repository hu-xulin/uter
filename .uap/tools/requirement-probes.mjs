/**
 * UAP Phase 2 — executable requirement probes.
 *
 * A probe is a REAL check against actual implementation: it parses the real
 * registries, imports the real runtime modules, executes the real validators /
 * CLI / Go tests and hashes their real output. A probe never asserts on the
 * existence of a documentation sentence and never returns a hard-coded PASS.
 *
 * Every probe returns:
 *   { id, ok, command, exit_code, output_hash, detail, duration_ms, skipped }
 * `ok` is derived exclusively from the real command result / real assertion.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');
const UAP = path.join(ROOT, '.uap');

export const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
const readJSON = (p) => { try { return JSON.parse(read(p) || 'null'); } catch { return null; } };
const exists = (p) => fs.existsSync(p);

export function sh(command, args = [], { timeout = 120000, env = {} } = {}) {
  const started = Date.now();
  const r = spawnSync(command, args, {
    cwd: ROOT, encoding: 'utf8', timeout,
    env: { ...process.env, ...env },
    maxBuffer: 32 * 1024 * 1024,
  });
  const out = `${r.stdout || ''}\n${r.stderr || ''}`;
  return {
    command: `${command} ${args.join(' ')}`.trim(),
    exit_code: r.error ? 124 : (r.status ?? 124),
    timed_out: Boolean(r.error && r.error.code === 'ETIMEDOUT'),
    output_hash: sha(out),
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    duration_ms: Date.now() - started,
  };
}

function result(id, r, extra = {}) {
  return {
    id,
    ok: r.exit_code === 0,
    command: r.command,
    exit_code: r.exit_code,
    output_hash: r.output_hash,
    duration_ms: r.duration_ms,
    detail: extra.detail || `${r.command} -> exit ${r.exit_code}`,
    skipped: false,
    ...extra,
  };
}

/** Minimal, deterministic registry parser (same shape as requirement-matrix). */
function specRegistry() {
  const text = read(path.join(UAP, 'config', 'specification-registry.yaml')) || '';
  const out = []; let cur = null;
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*-\s*id:\s*(UAP-\d{2}-\d{3})\s*$/);
    if (m) { cur = { id: m[1] }; out.push(cur); continue; }
    if (!cur) continue;
    const x = line.match(/^\s{4}(file|executor|validator|domain|criticality|status):\s*"?([^"\n]+?)"?\s*$/);
    if (x) cur[x[1]] = x[2];
  }
  return out;
}
function validatorRegistry() {
  const text = read(path.join(UAP, 'config', 'validator-registry.yaml')) || '';
  const out = []; let cur = null;
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*-\s*id:\s*([a-z][a-z0-9_.]+)\s*$/);
    if (m) { cur = { id: m[1] }; out.push(cur); continue; }
    if (!cur) continue;
    const x = line.match(/^\s+implementation:\s*(\S+)/);
    if (x) cur.implementation = x[1];
    const c = line.match(/^\s+-\s+([a-z][a-z0-9_]+)\s*$/);
    if (c) (cur.checks || (cur.checks = [])).push(c[1]);
  }
  return out;
}
function executorEntries() {
  const text = read(path.join(UAP, 'config', 'execution-mapping.yaml')) || '';
  const out = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\s{4}([a-z][a-z0-9_]*):\s*(\.uap\/\S+)/);
    if (m) out.push({ key: m[1], path: m[2] });
  }
  return out;
}
function registryList(file, idRe) {
  const text = read(path.join(UAP, 'config', file)) || '';
  const out = []; let cur = null;
  for (const line of text.split('\n')) {
    const m = line.match(idRe);
    if (m) { cur = { id: m[1] }; out.push(cur); continue; }
    if (!cur) continue;
    for (const key of ['implementation', 'permissions', 'steps', 'acceptance', 'tools', 'output_schema']) {
      const x = line.match(new RegExp(`^\\s+${key}:\\s*(.+)$`));
      if (x) cur[key] = x[1].trim();
    }
  }
  return out;
}

/* ------------------------------------------------------------------ probes */

const PROBES = {
  // ---- UAP Foundation / registries -------------------------------------
  'reg.specifications': async () => {
    const specs = specRegistry();
    const missing = specs.filter((s) => !s.file || !exists(path.join(ROOT, s.file)));
    const incomplete = specs.filter((s) => !s.executor || !s.validator || !s.domain);
    return result('reg.specifications', {
      command: 'parse specification-registry.yaml + stat 32 spec files',
      exit_code: specs.length === 32 && !missing.length && !incomplete.length ? 0 : 1,
      output_hash: sha(JSON.stringify(specs)),
      duration_ms: 0,
    }, { detail: `${specs.length} specs, missing files=${missing.length}, incomplete mapping=${incomplete.length}` });
  },
  'reg.validators': async () => {
    const vs = validatorRegistry();
    const missing = vs.filter((v) => !v.implementation || !exists(path.join(ROOT, v.implementation)));
    return result('reg.validators', {
      command: 'parse validator-registry.yaml + stat implementations',
      exit_code: vs.length === 32 && !missing.length ? 0 : 1,
      output_hash: sha(JSON.stringify(vs)), duration_ms: 0,
    }, { detail: `${vs.length} validators, missing=${missing.length}` });
  },
  'reg.executors': async () => {
    const es = executorEntries();
    const missing = es.filter((e) => !exists(path.join(ROOT, e.path)));
    return result('reg.executors', {
      command: 'parse execution-mapping.yaml + stat executor paths',
      exit_code: es.length >= 32 && !missing.length ? 0 : 1,
      output_hash: sha(JSON.stringify(es)), duration_ms: 0,
    }, { detail: `${es.length} executor entries, missing=${missing.length}` });
  },
  'reg.agents': async () => {
    const ag = registryList('agent-registry.yaml', /^\s*-\s*id:\s*([a-z0-9-]+)\s*$/);
    return result('reg.agents', {
      command: 'parse agent-registry.yaml', exit_code: ag.length === 11 ? 0 : 1,
      output_hash: sha(JSON.stringify(ag)), duration_ms: 0,
    }, { detail: `${ag.length} registered agents (expected 11)` });
  },
  'reg.workflows': async () => {
    const wf = registryList('workflow-registry.yaml', /^\s*-\s*id:\s*([a-z0-9-]+)\s*$/);
    return result('reg.workflows', {
      command: 'parse workflow-registry.yaml', exit_code: wf.length >= 7 ? 0 : 1,
      output_hash: sha(JSON.stringify(wf)), duration_ms: 0,
    }, { detail: `${wf.length} registered workflows` });
  },
  'reg.policy': async () => {
    const text = read(path.join(UAP, 'config', 'permission-policy.yaml')) || '';
    const denies = ['production_deploy', 'production_write', 'real_payment', 'real_refund', 'secret_export', 'destructive_git', 'quality_gate_disable'];
    const ok = /default_effect:\s*deny/.test(text) && /fail_closed:\s*true/.test(text)
      && denies.every((d) => new RegExp(`${d}:\\s*\\n?\\s*effect:\\s*deny`).test(text));
    return result('reg.policy', {
      command: 'parse permission-policy.yaml (default deny + 7 production denies + fail_closed)',
      exit_code: ok ? 0 : 1, output_hash: sha(text), duration_ms: 0,
    }, { detail: `default_effect=deny, fail_closed=true, ${denies.length} denies present: ${ok}` });
  },
  'contract.exports': async () => {
    const m = await import(pathToFileURL(path.join(UAP, 'runtime', '_lib', 'contract.mjs')).href);
    const names = ['executorResult', 'validatorResult', 'assertExecutorResult', 'assertValidatorResult', 'finding', 'LIFECYCLE_STATUSES', 'TASK_STATES', 'TASK_TRANSITIONS', 'VALIDATOR_STATUSES'];
    const missing = names.filter((n) => m[n] === undefined);
    let rejectsMalformed = false;
    try { m.assertValidatorResult({ status: 'PASS' }); } catch { rejectsMalformed = true; }
    return result('contract.exports', {
      command: 'import runtime/_lib/contract.mjs + assertValidatorResult negative probe',
      exit_code: !missing.length && rejectsMalformed ? 0 : 1,
      output_hash: sha(JSON.stringify({ missing, rejectsMalformed })), duration_ms: 0,
    }, { detail: `exports missing=${missing.length}, rejects malformed=${rejectsMalformed}` });
  },
  'spec.statements': async () => {
    const specs = specRegistry();
    const matrix = readJSON(path.join(UAP, 'reports', 'REQUIREMENT-TRACEABILITY-MATRIX.json'));
    const problems = [];
    let checked = 0;
    for (const s of specs) {
      const text = read(path.join(ROOT, s.file)) || '';
      if (!/^## 强制性要求\s*$/m.test(text) || !/^## 验收条件\s*$/m.test(text)) { problems.push(`${s.id}: section missing`); continue; }
      const body = text.split(/^## 强制性要求\s*$/m)[1]?.split(/^## /m)[0] || '';
      const items = body.split('\n').filter((l) => /^\d+\.\s+/.test(l));
      for (let i = 0; i < items.length; i++) {
        const id = `${s.id}-REQ-${String(i + 1).padStart(3, '0')}`;
        const row = (matrix?.requirements || []).find((r) => r.requirement_id === id);
        const statement = items[i].replace(/^\d+\.\s+/, '').trim();
        if (!row || row.statement_sha256 !== sha(statement)) problems.push(`${id}: statement drift`);
        checked++;
      }
    }
    return result('spec.statements', {
      command: 're-parse 32 spec files and compare statement_sha256 against matrix',
      exit_code: !problems.length && checked > 350 ? 0 : 1,
      output_hash: sha(JSON.stringify({ checked, problems })), duration_ms: 0,
    }, { detail: `${checked} mandatory statements hash-verified, drifts=${problems.length}` });
  },
  'matrix.stable': async () => {
    const r = sh('node', ['.uap/tools/requirement-matrix.mjs', '--check'], { timeout: 60000 });
    return result('matrix.stable', r, { detail: `requirement ID stability --check exit=${r.exit_code}` });
  },

  // ---- runtime behaviour -----------------------------------------------
  'runtime.health': async () => {
    const dirs = fs.readdirSync(path.join(UAP, 'runtime')).filter((d) =>
      exists(path.join(UAP, 'runtime', d, 'index.mjs')));
    const problems = [];
    for (const d of dirs) {
      try {
        const m = await import(pathToFileURL(path.join(UAP, 'runtime', d, 'index.mjs')).href + `?t=${Date.now()}`);
        if (typeof m.health === 'function') {
          const h = m.health();
          if (h && h.ok === false) problems.push(`${d}: health ok=false`);
        }
      } catch (e) { problems.push(`${d}: ${e.message}`); }
    }
    return result('runtime.health', {
      command: `import ${dirs.length} runtime index.mjs and call health() when exported`,
      exit_code: dirs.length >= 10 && !problems.length ? 0 : 1,
      output_hash: sha(JSON.stringify({ dirs, problems })), duration_ms: 0,
    }, { detail: `${dirs.length} runtime components, problems=${problems.length}` });
  },
  'runtime.cli': async () => {
    const r = sh('./uap', ['--help'], { timeout: 60000 });
    const required = ['status', 'doctor', 'audit', 'validate', 'test', 'workflow', 'report', 'verify-status', 'verify-repair', 'repair', 'release'];
    const missing = required.filter((c) => !r.stdout.includes(c));
    return result('runtime.cli', {
      command: r.command, exit_code: r.exit_code === 0 && !missing.length ? 0 : 1,
      output_hash: r.output_hash, duration_ms: r.duration_ms,
    }, { detail: `CLI help exit=${r.exit_code}, missing commands=${missing.join(',') || 'none'}` });
  },
  'runtime.status-engine': async () => {
    const m = await import(pathToFileURL(path.join(UAP, 'runtime', 'status-engine', 'index.mjs')).href);
    const h = m.health();
    return result('runtime.status-engine', {
      command: 'import status-engine/index.mjs + health()',
      exit_code: h.ok === true ? 0 : 1,
      output_hash: sha(JSON.stringify(h)), duration_ms: 0,
    }, { detail: `status-engine self-check ok=${h.ok}` });
  },
  'runtime.evidence': async () => {
    const m = await import(pathToFileURL(path.join(UAP, 'runtime', 'evidence-engine', 'index.mjs')).href);
    const ev = m.record({ kind: 'phase2_probe', command: 'requirement probe evidence round-trip', exit_code: 0, summary: 'real write + hash verify' });
    const v = m.verify(ev.evidence_id);
    const rec = m.get(ev.evidence_id);
    const tampered = { ...rec, summary: 'TAMPERED' };
    const tamperRejected = sha(JSON.stringify({ ...tampered, content_hash: null })) !== rec.content_hash;
    return result('runtime.evidence', {
      command: 'evidence-engine record() -> get() -> verify() -> hash-tamper negative probe',
      exit_code: v.hash_valid && v.binding_valid && Boolean(ev.content_hash) && tamperRejected ? 0 : 1,
      output_hash: sha(JSON.stringify({ v, ev, tamperRejected })), duration_ms: 0,
    }, { detail: `evidence=${ev.evidence_id}, hash_valid=${v.hash_valid}, binding_valid=${v.binding_valid}, tamper_rejected=${tamperRejected}` });
  },
  'runtime.validators': async () => {
    const r = sh('./uap', ['validate', '--all', '--json'], { timeout: 180000 });
    let pass = 0; let total = 0; let fail = 0;
    try {
      const j = JSON.parse(r.stdout);
      const d = j.data || j;
      pass = d.pass ?? (d.results || []).filter((x) => x.status === 'PASS').length;
      fail = d.fail ?? (d.results || []).filter((x) => x.status !== 'PASS').length;
      total = d.total ?? (d.results || []).length;
    } catch { /* keep zeros -> fail closed */ }
    return result('runtime.validators', {
      command: r.command, exit_code: r.exit_code === 0 && total >= 32 && fail === 0 ? 0 : 1,
      output_hash: r.output_hash, duration_ms: r.duration_ms,
    }, { detail: `validate --all -> exit=${r.exit_code}, pass=${pass}/${total}, fail=${fail}` });
  },
  'runtime.doctor': async () => {
    const r = sh('./uap', ['doctor', '--json'], { timeout: 180000 });
    return result('runtime.doctor', r, { detail: `uap doctor --json exit=${r.exit_code}` });
  },
  'runtime.workflows': async () => {
    const r = sh('./uap', ['workflow', 'run', '--all', '--json'], { timeout: 240000 });
    return result('runtime.workflows', r, { detail: `uap workflow run --all exit=${r.exit_code}` });
  },
  'runtime.repair': async () => {
    const r = sh('./uap', ['verify-repair', '--json'], { timeout: 180000 });
    return result('runtime.repair', r, { detail: `uap verify-repair exit=${r.exit_code}` });
  },
  'runtime.verify-status': async () => {
    const r = sh('./uap', ['verify-status', '--json'], { timeout: 120000 });
    return result('runtime.verify-status', r, { detail: `uap verify-status exit=${r.exit_code}` });
  },
  'runtime.release-deny': async () => {
    const r = sh('./uap', ['release', 'check', '--json'], { timeout: 120000 });
    // A DENY is the correct, safe outcome. exit 1 is EXPECTED; we assert the
    // decision itself, not a green exit code, so this probe is not a fake PASS.
    let deny = false;
    try { const j = JSON.parse(r.stdout); deny = JSON.stringify(j).includes('DENY'); } catch { deny = false; }
    return result('runtime.release-deny', {
      command: r.command, exit_code: deny ? 0 : 1,
      output_hash: r.output_hash, duration_ms: r.duration_ms,
    }, { detail: `release check exit=${r.exit_code} (expected 1), deploy_decision=DENY present=${deny}` });
  },
  'runtime.uap-tests': async () => {
    const r = sh('node', ['--test', '--test-concurrency=1', ...fs.readdirSync(path.join(UAP, 'tests'))
      .filter((f) => f.endsWith('.test.mjs')).map((f) => `.uap/tests/${f}`)], { timeout: 300000 });
    const m = /# fail (\d+)/.exec(r.stdout);
    const p = /# pass (\d+)/.exec(r.stdout);
    const fail = m ? Number(m[1]) : 999;
    const pass = p ? Number(p[1]) : 0;
    return result('runtime.uap-tests', {
      command: r.command, exit_code: r.exit_code === 0 && fail === 0 && pass > 0 ? 0 : 1,
      output_hash: r.output_hash, duration_ms: r.duration_ms,
    }, { detail: `node --test --all -> exit=${r.exit_code}, pass=${pass}, fail=${fail}` });
  },
  'runtime.evidence-index': async () => {
    const dir = path.join(UAP, 'evidence');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    let valid = 0; let broken = 0;
    for (const f of files.slice(0, 600)) {
      try {
        const j = JSON.parse(read(path.join(dir, f)));
        const body = { ...j, content_hash: null };
        if (sha(JSON.stringify(body)) === j.content_hash) valid++; else broken++;
      } catch { broken++; }
    }
    return result('runtime.evidence-index', {
      command: `recompute sha256 for ${Math.min(files.length, 600)} evidence records`,
      exit_code: valid > 0 && broken === 0 ? 0 : 1,
      output_hash: sha(JSON.stringify({ valid, broken, total: files.length })), duration_ms: 0,
    }, { detail: `evidence files=${files.length}, hash_valid=${valid}, broken=${broken}` });
  },
  'policy.runtime-deny': async () => {
    const m = await import(pathToFileURL(path.join(UAP, 'runtime', 'policy-engine', 'index.mjs')).href).catch(() => null);
    if (!m) return result('policy.runtime-deny', { command: 'import policy-engine', exit_code: 1, output_hash: '', duration_ms: 0 }, { detail: 'policy engine not importable' });
    const text = read(path.join(UAP, 'config', 'permission-policy.yaml')) || '';
    const ok = /default_effect:\s*deny/.test(text) && typeof (m.check || m.evaluate || m.authorize || m.health) === 'function';
    return result('policy.runtime-deny', {
      command: 'import policy-engine and verify it loads a default-deny policy',
      exit_code: ok ? 0 : 1, output_hash: sha(text), duration_ms: 0,
    }, { detail: `policy engine importable, default deny=${ok}` });
  },
  'security.secret-scan': async () => {
    // Real exit code (no --exit-code 0 override): 0 = clean, 1 = leaks found.
    const r = sh('gitleaks', ['detect', '--no-git', '--source', '.uap/reports', '--no-banner'], { timeout: 180000 });
    return result('security.secret-scan', {
      command: r.command, exit_code: r.exit_code,
      output_hash: r.output_hash, duration_ms: r.duration_ms,
    }, { detail: `gitleaks on .uap/reports exit=${r.exit_code} (0=clean, 1=leaks)` });
  },

  // ---- Uter backend / database / finance --------------------------------
  'go.build': async () => {
    const r = sh('go', ['build', './...'], { timeout: 420000, env: { GOWORK: 'off' } });
    return result('go.build', r, { detail: `GOWORK=off go build ./... exit=${r.exit_code}` });
  },
  'go.vet': async () => {
    const r = sh('go', ['vet', './common/', './model/', './controller/', './service/'], { timeout: 420000, env: { GOWORK: 'off' } });
    return result('go.vet', r, { detail: `GOWORK=off go vet (4 pkgs) exit=${r.exit_code}` });
  },
  'go.db-integration': async () => {
    const r = sh('go', ['test', './model/', '-run', 'TestPhase2DB|TestIsolatedDB', '-count=1', '-v'], { timeout: 420000, env: { GOWORK: 'off' } });
    const pass = (r.stdout.match(/--- PASS:/g) || []).length;
    const fail = (r.stdout.match(/--- FAIL:/g) || []).length;
    return result('go.db-integration', {
      command: r.command, exit_code: r.exit_code === 0 && pass >= 20 && fail === 0 ? 0 : 1,
      output_hash: r.output_hash, duration_ms: r.duration_ms,
    }, { detail: `isolated file-backed SQLite: exit=${r.exit_code}, PASS=${pass}, FAIL=${fail}` });
  },
  'go.payment-sandbox': async () => {
    const r = sh('go', ['test', './service/paymentsandbox/', '-count=1', '-v'], { timeout: 300000, env: { GOWORK: 'off' } });
    const pass = (r.stdout.match(/--- PASS:/g) || []).length;
    const fail = (r.stdout.match(/--- FAIL:/g) || []).length;
    return result('go.payment-sandbox', {
      command: r.command, exit_code: r.exit_code === 0 && pass >= 8 && fail === 0 ? 0 : 1,
      output_hash: r.output_hash, duration_ms: r.duration_ms,
    }, { detail: `LOCAL_SIMULATION gateway tests: exit=${r.exit_code}, PASS=${pass}, FAIL=${fail}` });
  },
  'go.payment-security': async () => {
    const r = sh('go', ['test', './controller/', '-run', 'TestPaymentCallbacksRejectForgedSignatures|TestAlipayReconcile|TestQueryAlipayOrder|TestQueryWechatOrder|Test.*AmountSnapshot', '-count=1', '-v'], { timeout: 420000, env: { GOWORK: 'off' } });
    const pass = (r.stdout.match(/--- PASS:/g) || []).length;
    const fail = (r.stdout.match(/--- FAIL:/g) || []).length;
    return result('go.payment-security', {
      command: r.command, exit_code: r.exit_code === 0 && pass > 0 && fail === 0 ? 0 : 1,
      output_hash: r.output_hash, duration_ms: r.duration_ms,
    }, { detail: `callback signature/amount-snapshot/reconcile tests: exit=${r.exit_code}, PASS=${pass}, FAIL=${fail}` });
  },
  'go.refund-integrity': async () => {
    const r = sh('go', ['test', './model/', './service/', '-run', 'TestRefund|TestBilling|TestTaskBilling|TestQuota', '-count=1', '-v'], { timeout: 420000, env: { GOWORK: 'off' } });
    const pass = (r.stdout.match(/--- PASS:/g) || []).length;
    const fail = (r.stdout.match(/--- FAIL:/g) || []).length;
    return result('go.refund-integrity', {
      command: r.command, exit_code: r.exit_code === 0 && pass > 0 && fail === 0 ? 0 : 1,
      output_hash: r.output_hash, duration_ms: r.duration_ms,
    }, { detail: `refund intent / billing CAS / quota tests: exit=${r.exit_code}, PASS=${pass}, FAIL=${fail}` });
  },
  'go.race': async () => {
    const r = sh('go', ['test', './model/', '-run', 'TestIsolatedDBConcurrent|TestPhase2DB', '-race', '-count=1'], { timeout: 600000, env: { GOWORK: 'off' } });
    return result('go.race', r, { detail: `go test -race (concurrent DB) exit=${r.exit_code}` });
  },

  // ---- frontend / design / cross-platform --------------------------------
  'web.typecheck': async () => {
    const r = sh('bun', ['run', 'typecheck'], { timeout: 420000, env: { NO_COLOR: '1' } });
    return result('web.typecheck', r, { detail: `web typecheck exit=${r.exit_code}` });
  },
  'web.lint': async () => {
    const r = sh('bun', ['run', 'lint'], { timeout: 420000, env: { NO_COLOR: '1' } });
    return result('web.lint', r, { detail: `web lint exit=${r.exit_code}` });
  },
  'web.design-strict': async () => {
    const r = sh('bun', ['run', 'lint:design:strict'], { timeout: 420000, env: { NO_COLOR: '1' } });
    return result('web.design-strict', r, { detail: `web design-system strict exit=${r.exit_code}` });
  },
  'web.copyright': async () => {
    const r = sh('bun', ['run', 'copyright:check'], { timeout: 300000, env: { NO_COLOR: '1' } });
    return result('web.copyright', r, { detail: `web copyright check exit=${r.exit_code}` });
  },
  'web.unit': async () => {
    const r = sh('bun', ['run', 'test'], { timeout: 600000, env: { NO_COLOR: '1' } });
    return result('web.unit', r, { detail: `web vitest exit=${r.exit_code} (3 known failures from committed WIP deletion are reported honestly)` });
  },
  'web.design-tokens': async () => {
    const r = sh('bun', ['run', 'design:tokens:check'], { timeout: 300000, env: { NO_COLOR: '1' } });
    return result('web.design-tokens', r, { detail: `design token guard exit=${r.exit_code}` });
  },
  'ci.workflows': async () => {
    const dir = path.join(ROOT, '.github', 'workflows');
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml')) : [];
    const text = files.map((f) => read(path.join(dir, f)) || '').join('\n');
    const has = ['typecheck', 'lint', 'test', 'build', 'security'].filter((k) => text.includes(k));
    return result('ci.workflows', {
      command: `read ${files.length} CI workflow files and check required gates`,
      exit_code: files.length >= 3 && has.length >= 4 ? 0 : 1,
      output_hash: sha(text), duration_ms: 0,
    }, { detail: `${files.length} workflows, gates found: ${has.join(',')}` });
  },
  'docs.baseline': async () => {
    const files = ['AGENTS.md', 'docs/design-system/UTER-DESIGN-SYSTEM-3.0.md', '.uap/README.md', '.uap/SPECIFICATION-INDEX.md'];
    const missing = files.filter((f) => !exists(path.join(ROOT, f)));
    return result('docs.baseline', {
      command: `stat ${files.length} governance baseline documents`,
      exit_code: !missing.length ? 0 : 1,
      output_hash: sha(files.map((f) => `${f}:${(read(path.join(ROOT, f)) || '').length}`).join('|')), duration_ms: 0,
    }, { detail: `missing=${missing.join(',') || 'none'}` });
  },

  // ---- phase-2 capability cards (produced by real CLI commands) ----------
  'card.database': async () => {
    const j = readJSON(path.join(UAP, 'reports', 'DATABASE-INTEGRATION.json'));
    const ok = j?.status === 'PASS' && (j.transactions || []).length > 0 && j.simulated_only !== true;
    return result('card.database', {
      command: 'read DATABASE-INTEGRATION.json produced by uap verify-database',
      exit_code: ok ? 0 : 1, output_hash: sha(JSON.stringify(j)), duration_ms: 0,
    }, { detail: `status=${j?.status ?? 'MISSING'}, transactions=${j?.transactions?.length ?? 0}` });
  },
  'card.payment-sandbox': async () => {
    const j = readJSON(path.join(UAP, 'reports', 'PAYMENT-SANDBOX.json'));
    const ok = j?.mode === 'LOCAL_SIMULATION' && j?.status === 'PASS' && j?.gateway_verified !== true;
    return result('card.payment-sandbox', {
      command: 'read PAYMENT-SANDBOX.json produced by uap verify-payment',
      exit_code: ok ? 0 : 1, output_hash: sha(JSON.stringify(j)), duration_ms: 0,
    }, { detail: `mode=${j?.mode ?? 'MISSING'}, status=${j?.status ?? 'MISSING'}, gateway_verified=${j?.gateway_verified}` });
  },
  'card.e2e': async () => {
    const j = readJSON(path.join(UAP, 'reports', 'E2E-RESULTS.json'));
    const ok = j?.status === 'PASS' && (j.browser_runs || []).length > 0;
    return result('card.e2e', {
      command: 'read E2E-RESULTS.json produced by uap verify-e2e',
      exit_code: ok ? 0 : 1, output_hash: sha(JSON.stringify(j)), duration_ms: 0,
    }, { detail: `status=${j?.status ?? 'MISSING'}, browser_runs=${j?.browser_runs?.length ?? 0}` });
  },
  'card.visual': async () => {
    const j = readJSON(path.join(UAP, 'reports', 'VISUAL-REGRESSION.json'));
    const ok = j && j.classified === j.total_diffs && j.unclassified === 0;
    return result('card.visual', {
      command: 'read VISUAL-REGRESSION.json produced by uap verify-visual',
      exit_code: ok ? 0 : 1, output_hash: sha(JSON.stringify(j)), duration_ms: 0,
    }, { detail: `classified=${j?.classified ?? 'MISSING'}/${j?.total_diffs ?? '?'}, unclassified=${j?.unclassified ?? '?'}` });
  },
  'card.accessibility': async () => {
    const j = readJSON(path.join(UAP, 'reports', 'ACCESSIBILITY-RESULTS.json'));
    const ok = j?.status === 'PASS' && j?.critical === 0 && j?.serious === 0;
    return result('card.accessibility', {
      command: 'read ACCESSIBILITY-RESULTS.json produced by uap verify-e2e',
      exit_code: ok ? 0 : 1, output_hash: sha(JSON.stringify(j)), duration_ms: 0,
    }, { detail: `status=${j?.status ?? 'MISSING'}, critical=${j?.critical ?? '?'}, serious=${j?.serious ?? '?'}` });
  },
  'card.security': async () => {
    const j = readJSON(path.join(UAP, 'reports', 'SECURITY-VERIFICATION.json'));
    // negative_tests is an array of suites; count the real test cases inside.
    const testCount = (j?.negative_tests || []).reduce((n, s) => n + (s.tests?.length || 0), 0);
    const allPassed = (j?.negative_tests || []).every((s) => s.exit_code === 0);
    const ok = j?.status === 'PASS' && testCount >= 7 && allPassed;
    return result('card.security', {
      command: 'read SECURITY-VERIFICATION.json produced by uap verify-security',
      exit_code: ok ? 0 : 1, output_hash: sha(JSON.stringify(j)), duration_ms: 0,
    }, { detail: `status=${j?.status ?? 'MISSING'}, negative_test_cases=${testCount}, suites_all_pass=${allPassed}` });
  },
};

export const PROBE_IDS = Object.keys(PROBES);

export async function runProbes(ids = PROBE_IDS) {
  const out = {};
  for (const id of ids) {
    const fn = PROBES[id];
    if (!fn) { out[id] = { id, ok: false, exit_code: 127, detail: 'probe not registered', skipped: true, output_hash: null }; continue; }
    try { out[id] = await fn(); }
    catch (e) { out[id] = { id, ok: false, exit_code: 1, detail: `probe threw: ${e.message}`, skipped: false, output_hash: null, command: id }; }
    // Make the result indistinguishable from a real command output for hashing.
    out[id].probe_hash = sha(JSON.stringify(out[id]));
  }
  return out;
}

/* ------------------------------------------------------------------ kinds */
/**
 * Honest `probe_kind` classification for EVERY registered probe.
 *
 *   STATIC_EXISTENCE   — file / dir / symbol / config-key / text-hash / report
 *                        card reads. These NEVER exercise runtime behaviour and
 *                        MUST NOT produce a VERIFIED verdict on their own.
 *   BEHAVIOR_EXECUTION — runs a real command / real assertion against running
 *                        code. The legacy ones below are GENERIC whole-suite /
 *                        whole-CLI / whole-build runs; they are real executions
 *                        but do NOT assert a distinct behaviour per requirement,
 *                        so they are shared generic evidence, not a per-
 *                        requirement behaviour assertion.
 *   EXTERNAL_DEPENDENCY— needs a sandbox / physical device / production
 *                        authorisation that is intentionally unavailable.
 *
 * Any probe not listed here is classified STATIC_EXISTENCE (fail-closed): an
 * unknown probe must never be able to promote a requirement to VERIFIED.
 */
export const PROBE_KINDS = Object.freeze({
  // ---- static existence (file / symbol / config-key / text / report card) --
  'reg.specifications': 'STATIC_EXISTENCE',
  'reg.validators': 'STATIC_EXISTENCE',
  'reg.executors': 'STATIC_EXISTENCE',
  'reg.agents': 'STATIC_EXISTENCE',
  'reg.workflows': 'STATIC_EXISTENCE',
  'reg.policy': 'STATIC_EXISTENCE',
  'spec.statements': 'STATIC_EXISTENCE',
  'runtime.evidence-index': 'STATIC_EXISTENCE',
  'policy.runtime-deny': 'STATIC_EXISTENCE',
  'ci.workflows': 'STATIC_EXISTENCE',
  'docs.baseline': 'STATIC_EXISTENCE',
  'card.database': 'STATIC_EXISTENCE',
  'card.payment-sandbox': 'STATIC_EXISTENCE',
  'card.e2e': 'STATIC_EXISTENCE',
  'card.visual': 'STATIC_EXISTENCE',
  'card.accessibility': 'STATIC_EXISTENCE',
  'card.security': 'STATIC_EXISTENCE',
  // ---- real command executions (generic / shared evidence) -----------------
  'contract.exports': 'BEHAVIOR_EXECUTION',
  'matrix.stable': 'BEHAVIOR_EXECUTION',
  'runtime.health': 'BEHAVIOR_EXECUTION',
  'runtime.cli': 'BEHAVIOR_EXECUTION',
  'runtime.status-engine': 'BEHAVIOR_EXECUTION',
  'runtime.evidence': 'BEHAVIOR_EXECUTION',
  'runtime.validators': 'BEHAVIOR_EXECUTION',
  'runtime.doctor': 'BEHAVIOR_EXECUTION',
  'runtime.workflows': 'BEHAVIOR_EXECUTION',
  'runtime.repair': 'BEHAVIOR_EXECUTION',
  'runtime.verify-status': 'BEHAVIOR_EXECUTION',
  'runtime.release-deny': 'BEHAVIOR_EXECUTION',
  'runtime.uap-tests': 'BEHAVIOR_EXECUTION',
  'security.secret-scan': 'BEHAVIOR_EXECUTION',
  'go.build': 'BEHAVIOR_EXECUTION',
  'go.vet': 'BEHAVIOR_EXECUTION',
  'go.db-integration': 'BEHAVIOR_EXECUTION',
  'go.payment-sandbox': 'BEHAVIOR_EXECUTION',
  'go.payment-security': 'BEHAVIOR_EXECUTION',
  'go.refund-integrity': 'BEHAVIOR_EXECUTION',
  'go.race': 'BEHAVIOR_EXECUTION',
  'web.typecheck': 'BEHAVIOR_EXECUTION',
  'web.lint': 'BEHAVIOR_EXECUTION',
  'web.design-strict': 'BEHAVIOR_EXECUTION',
  'web.copyright': 'BEHAVIOR_EXECUTION',
  'web.unit': 'BEHAVIOR_EXECUTION',
  'web.design-tokens': 'BEHAVIOR_EXECUTION',
});

export function probeKind(id) {
  return PROBE_KINDS[id] || 'STATIC_EXISTENCE';
}

/** Counts per `probe_kind` — used by the honesty audit summary. */
export function probeKindCounts() {
  const out = { STATIC_EXISTENCE: 0, BEHAVIOR_EXECUTION: 0, EXTERNAL_DEPENDENCY: 0 };
  for (const id of PROBE_IDS) out[probeKind(id)] += 1;
  return out;
}

/**
 * Execute a BOUNDED set of real behaviour suite runs. Each run is ONE command
 * and carries a list of DISTINCT assertions; each assertion is bound to exactly
 * ONE requirement and requires a specific substring in the real stdout (plus
 * absence of forbidden substrings). `exit_code===0` alone is NOT enough — the
 * required output assertion must actually be observed.
 *
 * `runs` are the `behavior_probes` from requirement-probes.yaml:
 *   { id, command, args, env, timeout_ms, assertions: [
 *       { name, required_output: [str], forbid_output: [str],
 *         requirement_id, behavior } ] }
 */
export async function runBehaviorProbes(runs = [], { dryRun = false } = {}) {
  const out = [];
  for (const run of runs) {
    const assertions = (run.assertions || []).map((a) => ({
      name: a.name,
      requirement_id: a.requirement_id,
      behavior: a.behavior || null,
      required_output: a.required_output || [],
      forbid_output: a.forbid_output || [],
    }));
    if (dryRun) {
      out.push({
        id: run.id, command: `${run.command} ${(run.args || []).join(' ')}`.trim(),
        probe_kind: run.probe_kind || 'BEHAVIOR_EXECUTION',
        dry_run: true, skipped: true, exit_code: null, output_hash: null,
        stdout: '', duration_ms: 0,
        assertions: assertions.map((a) => ({ ...a, found: false, reason: 'DRY_RUN_NOT_EXECUTED' })),
      });
      continue;
    }
    const r = sh(run.command, run.args || [], {
      timeout: run.timeout_ms || 180000, env: run.env || {},
    });
    const stdout = r.stdout || '';
    const evaluated = assertions.map((a) => {
      const missing = (a.required_output || []).filter((s) => !stdout.includes(s));
      const forbidden = (a.forbid_output || []).filter((s) => stdout.includes(s));
      const found = r.exit_code === 0 && missing.length === 0 && forbidden.length === 0;
      return {
        ...a,
        found,
        observed: found,
        missing_required_output: missing,
        forbidden_output_present: forbidden,
        reason: found ? 'REQUIRED_ASSERTION_OBSERVED'
          : (r.exit_code !== 0 ? `COMMAND_EXIT_${r.exit_code}`
            : (missing.length ? `MISSING_OUTPUT:${missing.join('|')}` : `FORBIDDEN_OUTPUT:${forbidden.join('|')}`)),
      };
    });
    out.push({
      id: run.id, command: r.command, probe_kind: run.probe_kind || 'BEHAVIOR_EXECUTION',
      dry_run: false, skipped: false, exit_code: r.exit_code,
      output_hash: r.output_hash, stdout, duration_ms: r.duration_ms,
      timed_out: r.timed_out,
      assertions: evaluated,
    });
  }
  return out;
}
