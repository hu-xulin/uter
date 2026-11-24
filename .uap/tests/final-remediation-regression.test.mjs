/**
 * Final-remediation anti-regression suite.
 *
 * Each test pins one root cause found during the P0 final remediation:
 *   1. tsgo stale incremental cache -> clean build must drop *.tsbuildinfo
 *   2. execution identity lock timeout under real concurrency -> critical
 *      section must NOT recompute worktreeFingerprint()
 *   3. visual pixel diff mislabelled AUTHENTICATION because the spec path
 *      contains "authed" -> real behaviour test of the extracted classifier
 *   4. isolated-stack env contract mismatch (UTER_ vs UAP_TEST_STACK)
 *   5. mixed evidence batches -> orchestrator must exist, use the canonical
 *      FINAL_REPORTS list, and be read-only after the manifest
 *   6. empty / non-content-bearing worktree fingerprint
 *
 * Behaviour tests exercise real exported functions. Source guards are
 * explicitly labelled as static guards; they pin the presence of a mitigation
 * in the exact file/line where a regression would silently reappear.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { classifyVisualDiff, MANDATED_CATEGORIES } from '../runtime/status-engine/visual-classifier.mjs';
import { worktreeFingerprint } from '../runtime/status-engine/execution.mjs';
import { FINAL_REPORTS, generateEvidenceManifest, MAX_REPORT_AGE_MS } from '../runtime/evidence-engine/manifest.mjs';
import { checkBatchConsistency, classifyFingerprintStatusLines } from '../tools/final-acceptance-gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// ---------------------------------------------------------------------------
// 1. Visual classifier — REAL behaviour tests (not a source scan)
// ---------------------------------------------------------------------------

const PIXEL_DIFF_FROM_AUTHED_SPEC = [
  'Error: expect(page).toHaveScreenshot(expected) failed',
  '  9127 pixels (ratio 0.01 of all image pixels) are different.',
  '  Snapshot: keys-desktop.png',
  '  at e2e/visual/authed.spec.ts:76',
].join('\n');

test('R1 真实像素差异即使来自 authed.spec.ts 也判 REAL_UI_REGRESSION，不得洗成 AUTHENTICATION', () => {
  const c = classifyVisualDiff({ title: '鉴权页面基线 - desktop', ok: false }, PIXEL_DIFF_FROM_AUTHED_SPEC);
  assert.equal(c.category, 'REAL_UI_REGRESSION');
  assert.match(c.evidence_basis, /pixel-diff|visual|screenshot/i);
});

test('R2 无像素差异的真实认证失败仍判 AUTHENTICATION', () => {
  const c = classifyVisualDiff({ title: 'login flow' }, 'Error: 401 Unauthorized — credential rejected, session expired');
  assert.equal(c.category, 'AUTHENTICATION');
});

test('R3 字体/动画/动态内容/基线缺失/环境失败的分类不被像素差异守卫破坏', () => {
  const cases = [
    ['fonts failed to load: glyph fallback detected', 'FONT_RENDERING'],
    ['CSS animation keyframe still running', 'ANIMATION'],
    ['dynamic timestamp / live data changed between captures', 'DYNAMIC_CONTENT'],
    ['snapshot not found: no baseline for this viewport', 'BASELINE_MISMATCH'],
    [`Error: expect(page).toHaveScreenshot(expected) failed\nA snapshot doesn't exist at home-desktop-chromium-linux.png`, 'BASELINE_MISMATCH'],
    ['ECONNREFUSED at localhost:3100, service gate not reachable', 'TEST_ENVIRONMENT'],
  ];
  for (const [message, expected] of cases) {
    assert.equal(classifyVisualDiff({ title: 'x' }, message).category, expected, message);
  }
});

test('R4 8 类分类模型完整且每个结果都在合法集合内', () => {
  assert.equal(MANDATED_CATEGORIES.length, 8);
  for (const msg of [PIXEL_DIFF_FROM_AUTHED_SPEC, 'login failed 401', 'font glyph', '', 'ECONNREFUSED']) {
    const c = classifyVisualDiff({ title: 't', reason: '用例执行异常：failed' }, msg);
    assert.ok(MANDATED_CATEGORIES.includes(c.category), `${msg.slice(0, 30)} -> ${c.category}`);
    assert.ok(c.evidence_basis.length > 0);
  }
});

test('R5 Playwright 通用 font-load 调用日志不得把真实像素差异洗成 FONT_RENDERING', () => {
  // toHaveScreenshot 的 call-log 恒含 "waiting for fonts to load... fonts loaded"，
  // 旧实现 /font/ 命中它导致 10/10 像素差异全被误判 FONT_RENDERING。
  const withGenericFontLog = [
    PIXEL_DIFF_FROM_AUTHED_SPEC,
    '  waiting for fonts to load...',
    '  fonts loaded',
  ].join('\n');
  const c = classifyVisualDiff({ title: 'home - desktop', ok: false }, withGenericFontLog);
  assert.equal(c.category, 'REAL_UI_REGRESSION');
  // 真正的字体证据（非通用等待日志）仍应判 FONT_RENDERING。
  assert.equal(
    classifyVisualDiff({ title: 'x' }, 'glyph fallback / 字体 ligature mismatch').category,
    'FONT_RENDERING',
  );
});

test('R6 Playwright 通用 "disabled all CSS animations" 调用日志不得把稳定像素差异洗成 ANIMATION', () => {
  // animations:'disabled' 时 call-log 恒含 "disabled all CSS animations"（证明动画
  // 已被禁用），旧实现 /animation/ 命中它导致 10/10 稳定像素差异全被误判 ANIMATION。
  const withGenericAnimationLog = [
    PIXEL_DIFF_FROM_AUTHED_SPEC,
    '  - taking page screenshot',
    '    - disabled all CSS animations',
    '  - captured a stable screenshot',
    '  - 9588 pixels (ratio 0.01 of all image pixels) are different.',
  ].join('\n');
  const c = classifyVisualDiff({ title: 'home - desktop', ok: false }, withGenericAnimationLog);
  assert.equal(c.category, 'REAL_UI_REGRESSION');
  // 真正的动画证据（非通用 disabled 日志）仍应判 ANIMATION。
  assert.equal(
    classifyVisualDiff({ title: 'x' }, 'CSS animation keyframe still running').category,
    'ANIMATION',
  );
});

// ---------------------------------------------------------------------------
// 2. Build: stale tsgo incremental cache must be removed before a clean build
// ---------------------------------------------------------------------------

test('R5 [静态守卫] Build Runner 在构建前移走 *.tsbuildinfo，防止 phantom 引用复发', () => {
  const cli = src('.uap/bin/uap.mjs');
  assert.match(cli, /tsgoCacheDir/);
  assert.match(cli, /endsWith\('\.tsbuildinfo'\)/);
  assert.match(cli, /movableArtifacts\.push\(\{ path: path\.join\(tsgoCacheDir, f\)/);
  // Cleaning derived state must not disable the TypeScript check.
  assert.match(cli, /bun', args: \['run', 'typecheck'\]/);
  assert.match(cli, /bun', args: \['run', 'build:check'\]/);
});

test('R6 [静态守卫] 空 dist 不得被当成真实产物，index.html 与文件数都要校验', () => {
  const cli = src('.uap/bin/uap.mjs');
  assert.match(cli, /artifactReal = exists\(distIndex\) && distFileCount > 3/);
});

// ---------------------------------------------------------------------------
// 3. Execution identity: no fingerprint work inside the lock
// ---------------------------------------------------------------------------

test('R7 [静态守卫] writeExecution 复用锁外预算的 (head, fingerprint)，临界区不重算指纹', () => {
  const e = src('.uap/runtime/status-engine/execution.mjs');
  assert.match(e, /function writeExecution\(reason, precomputed = null\)/);
  assert.match(e, /precomputed\?\.fingerprint|precomputed\s*\?\s*precomputed\.fingerprint/);
  assert.match(e, /writeExecution\(latest \? 'code-version-changed' : 'bootstrap', \{ head, fingerprint: fp \}\)/);
  assert.match(e, /LOCK_WAIT_MS/);
});

test('R8 并发下所有进程收敛到同一执行身份且无锁超时（真实多进程执行）', async () => {
  const PROBE = "import('./.uap/runtime/status-engine/execution.mjs')"
    + ".then(m => console.log(JSON.stringify(m.currentExecution())))";
  const results = await Promise.all(Array.from({ length: 8 }, () => new Promise((resolve, reject) => {
    let out = '', err = '';
    const child = spawn(process.execPath, ['-e', PROBE], { cwd: ROOT });
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, out: out.trim(), err: err.trim() }));
  })));
  for (const r of results) assert.equal(r.code, 0, `worker failed: ${r.err}`);
  const ids = new Set(results.map((r) => JSON.parse(r.out).execution_id));
  const realHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  for (const r of results) {
    const e = JSON.parse(r.out);
    assert.equal(e.git_head, realHead);
    assert.match(e.worktree_fingerprint || '', /^[0-9a-f]{64}$/);
  }
  assert.equal(ids.size, 1, `同一代码版本出现 ${ids.size} 个执行身份`);
});

// ---------------------------------------------------------------------------
// 4. Isolated stack env contract
// ---------------------------------------------------------------------------

test('R9 [静态守卫] 隔离栈同时导出 UAP_TEST_STACK 与 UTER_TEST_STACK，且绝不写生产库', () => {
  const sh = src('scripts/phase2-test-stack.sh');
  assert.match(sh, /export UAP_TEST_STACK='isolated'/);
  assert.match(sh, /export UTER_TEST_STACK='isolated'/);
  assert.match(sh, /RegisterEnabled 保持 false|UPDATE options SET value='false' WHERE key='RegisterEnabled'/);
  assert.match(sh, /SQLITE_PATH="\$\{ISOLATED_DB\}"/);
});

// ---------------------------------------------------------------------------
// 5. Single-batch orchestration + read-only final integrity
// ---------------------------------------------------------------------------

test('R10 [静态守卫] 单一批次编排器使用规范顺序，并在 manifest 之后只做只读校验', () => {
  const o = src('.uap/tools/final-remediation-run.mjs');
  for (const step of ['build', 'test', '--all', 'validate', '--all', 'verify-e2e',
    'verify-visual', 'verify-database', 'verify-payment', 'verify-security',
    'verify-requirements', 'report', '--final', 'accept']) {
    assert.ok(o.includes(`'${step}'`), `orchestrator missing step ${step}`);
  }
  assert.match(o, /STRICTLY READ-ONLY integrity verification/);
  assert.match(o, /verifyEvidenceManifest\(\{ strictCurrent: true, execution: batch \}\)/);
  assert.match(o, /overwrittenAfterManifest/);
  assert.match(o, /single_batch/);
  // The only write after the manifest is the orchestrator's own result file.
  assert.match(o, /writeJSON\(RESULTS_FILE, result\)/);
  assert.equal((o.match(/writeJSON\(/g) || []).length, 1);
});

test('R11 编排器引用的 FINAL_REPORTS 与证据引擎规范清单完全一致', () => {
  const o = src('.uap/tools/final-remediation-run.mjs');
  assert.match(o, /FINAL_REPORTS,/);
  assert.ok(Array.isArray(FINAL_REPORTS) && FINAL_REPORTS.length === 15);
  assert.ok(FINAL_REPORTS.includes('RUNTIME-TEST-RESULTS.json'));
  assert.ok(FINAL_REPORTS.includes('FINAL-ACCEPTANCE.json'));
});

test('R12 worktree_fingerprint 必须是真实的 64 位内容哈希，不得为空串/常量', () => {
  const fp = worktreeFingerprint();
  assert.match(fp || '', /^[0-9a-f]{64}$/);
  // SHA256("") — the historical defect where a clean tree hashed nothing.
  assert.notEqual(fp, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});

test('R13 [静态守卫] 批次锁只固定身份、不匹配即 fail-closed，且独立指纹校验仍在', () => {
  const e = src('.uap/runtime/status-engine/execution.mjs');
  assert.match(e, /UAP_BATCH_LOCK_ID/);
  assert.match(e, /does not match current identity \(fail-closed\)/);
  assert.match(e, /HEAD mismatch \(fail-closed\)/);
  // The lock must not remove the independent fingerprint verification.
  const o = src('.uap/tools/final-remediation-run.mjs');
  assert.match(o, /verifyEvidenceManifest\(\{ strictCurrent: true, execution: batch \}\)/);
  assert.match(o, /fingerprint_now: fpNow/);
  assert.match(o, /BATCH_ENV = \{ UAP_BATCH_LOCK_ID: batch\.execution_id \}/);
});

test('R14 [静态守卫] 编排器用文件 fd 而非 pipe，避免隔离栈后台进程挂住 close 事件', () => {
  const o = src('.uap/tools/final-remediation-run.mjs');
  assert.match(o, /stdio: \['ignore', fd, fd\]/);
  assert.match(o, /fs\.openSync\(logPath, 'w'\)/);
  assert.doesNotMatch(o, /stdio: \['ignore', 'pipe', 'pipe'\]/);
});

// ---------------------------------------------------------------------------
// 7. Second full batch: four real defects found by real verifier output
// ---------------------------------------------------------------------------

test('R15 最终只读完整性校验必须锁定冻结批次身份，不得在父进程重新 currentExecution()', () => {
  const o = src('.uap/tools/final-remediation-run.mjs');
  assert.match(o, /verifyEvidenceManifest\(\{ strictCurrent: true, execution: batch \}\)/);
  assert.match(o, /verifyFinalReportBindings\(\{ execution: batch \}\)/);
  // strictCurrent must stay on: a real concurrent source change still fails.
  assert.match(o, /strictCurrent: true/);
  assert.match(o, /frozen_fingerprint_match/);
  assert.match(o, /drift\.length === 0/);
});

test('R16 [行为+静态] TEST-RUNS.json 只有一个 schema；health() 的 artifactOk 契约不得被 CLI 覆写抹掉', async () => {
  const cli = src('.uap/bin/uap.mjs');
  const engine = src('.uap/engines/testing/index.mjs');
  // CLI must reconstruct the four fields artifactOk() really checks.
  for (const key of ['summary: {', 'test_plan: testingPlan()', 'gate_plan: testingGatePlan()']) {
    assert.ok(cli.includes(key), `CLI TEST-RUNS writer missing ${key}`);
  }
  assert.match(cli, /testingGatePlan/);
  assert.match(engine, /^export function gatePlan\(\)/m);
  assert.match(engine, /checks\.report_schema = artifactOk\(REPORT_FILE\)/);

  const { plan, gatePlan, artifactOk } = await import('../engines/testing/index.mjs');
  // Real behaviour: the engine's discovery functions return real, non-empty data.
  assert.ok(plan().layers.length >= 3);
  assert.equal(typeof gatePlan().verify_all_exists, 'boolean');

  // Real behaviour of the exact contract health() applies. Use isolated temp
  // files (the UAP self-test suite must never depend on .uap/reports disk state
  // produced by a PREVIOUS run — that made the suite order-dependent).
  const tmp = path.join(os.tmpdir(), `uap-artifact-ok-${process.pid}-${Date.now()}`);
  fs.mkdirSync(tmp, { recursive: true });
  const full = { runs: [{ status: 'PASSED_EXECUTED', exit_code: 0, tap: { tests: 20 } }],
    summary: { total: 1 }, test_plan: { layers: [] }, gate_plan: { gates: [] } };
  const write = (name, obj) => { const f = path.join(tmp, name); fs.writeFileSync(f, JSON.stringify(obj)); return f; };
  assert.equal(artifactOk(write('full.json', full)), true);
  assert.equal(artifactOk(write('no-plan.json', { runs: full.runs, summary: full.summary, gate_plan: {} })), false);
  assert.equal(artifactOk(write('fake-pass.json', {
    ...full, runs: [{ status: 'PASSED_EXECUTED', exit_code: 1, tap: { tests: 20 } }],
  })), false);
  assert.equal(artifactOk(write('no-tap.json', {
    ...full, runs: [{ status: 'PASSED_EXECUTED', exit_code: 0 }],
  })), false);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('R17 [静态守卫] 隔离栈必须把 :3101 加进 CORS_ALLOWED_ORIGINS，否则浏览器登录被 403', () => {
  const sh = src('scripts/phase2-test-stack.sh');
  assert.match(sh, /CORS_ALLOWED_ORIGINS="\$\{isolated_cors\}"/);
  assert.match(sh, /grep -E '\^CORS_ALLOWED_ORIGINS='/);
  assert.match(sh, /isolated_cors="\$\{base_cors:\+\$\{base_cors\},\}\$\{TEST_FRONTEND_URL\}"/);
  // Do not overwrite production config: the original origins are preserved.
  assert.match(sh, /base_cors=.*CORS_ALLOWED_ORIGINS/);
});

test('R18 [静态守卫] 业务 E2E 表单登录必须过法律同意闸门，biz_23 必须独占上下文做真实登录', () => {
  const login = src('web/e2e/business/lib/login.ts');
  assert.match(login, /getByRole\('checkbox'\)/);
  assert.match(login, /#legal-consent/);
  assert.match(login, /consent\.first\(\)\.click\(\)/);
  const spec = src('web/e2e/business/specs/business.spec.ts');
  // Extract the biz_23 block by position: the signature may be formatted across
  // multiple lines, so a `\n})`-terminated regex would stop at the fixture
  // destructuring and miss the body. Assertions below are unchanged.
  const start = spec.indexOf("test('biz_23");
  assert.ok(start >= 0, 'biz_23 test not found');
  const next = spec.indexOf('test(', start + 1);
  const block = spec.slice(start, next === -1 ? spec.length : next);
  assert.match(block, /browser\.newContext\(\)/);
  assert.match(block, /await loginViaUi\(page\)/);
  assert.match(block, /toBeVisible\(/);
  assert.match(block, /timeout: 20_000/);
  assert.match(block, /context\.close\(\)/);
  assert.doesNotMatch(block, /async \(\{ authedApi, authedPage \}\)/);
});

test('R19 [静态守卫] 视觉基线必须移除开发态 devtools 浮层，且不放宽像素阈值', () => {
  const h = src('web/e2e/visual/lib/harness.ts');
  assert.match(h, /\.tsqd-parent-container/);
  assert.match(h, /\.TanStackRouterDevtools/);
  assert.match(h, /display: none !important/);
  // Masking must remain on the product-volatile selector only.
  assert.match(h, /const VOLATILE_SELECTOR = '\[data-visual-volatile\]'/);
  const cfg = src('web/e2e/visual/playwright.config.ts');
  assert.doesNotMatch(cfg, /maxDiffPixelRatio:\s*0\.[1-9]/);
});

test('R20 [静态守卫] 邮箱验证码登录按钮满足 WCAG 2.5.8 的 24x24 硬线', () => {
  const f = src('web/src/features/auth/sign-in/components/user-auth-form.tsx');
  const m = f.match(/<button[\s\S]{0,600}?Sign in with email code[\s\S]{0,120}?<\/button>/);
  assert.ok(m, 'email-code toggle button not found');
  assert.match(m[0], /min-h-6/);
  assert.match(m[0], /items-center/);
});

// ---------------------------------------------------------------------------
// 8. Directive §3.4 — single-batch consistency gate (REAL behaviour, hermetic)
// ---------------------------------------------------------------------------

const B_HEAD = 'a'.repeat(40);
const B_ENV = 'e'.repeat(64);
const B_FP = 'b'.repeat(64);
const B_EXEC = {
  execution_id: 'UAP-EXEC-BATCH-TEST-0001',
  git_head: B_HEAD,
  worktree_fingerprint: B_FP,
  environment_fingerprint: B_ENV,
  started_at: new Date(Date.now() - 1000).toISOString(),
  status: 'RUNNING',
};

function bDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'uap-batch-consistency-')); }
function bWrite(dir, name, obj) { fs.writeFileSync(path.join(dir, name), `${JSON.stringify(obj, null, 2)}\n`, 'utf8'); }
function bRead(dir, name) { return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')); }
function bValidReport() {
  return {
    schema_version: '1.0', status: 'PASS',
    generated_at: new Date(Date.now() - 1000).toISOString(),
    execution_id: B_EXEC.execution_id, git_head: B_EXEC.git_head,
    worktree_fingerprint: B_EXEC.worktree_fingerprint,
    environment_fingerprint: B_EXEC.environment_fingerprint,
    commit_sha: B_HEAD,
  };
}
function bWriteAllValid(dir) {
  for (const name of FINAL_REPORTS) {
    if (name.endsWith('.md')) fs.writeFileSync(path.join(dir, name), '# isolated batch test\n', 'utf8');
    else bWrite(dir, name, bValidReport());
  }
}
function bGenerate(dir) {
  return generateEvidenceManifest({ execution: B_EXEC, reportsDir: dir, rootDir: dir, headSha: B_HEAD });
}
function bCheck(dir, extra = {}) {
  return checkBatchConsistency({ reportsDir: dir, rootDir: dir, headSha: B_HEAD, execution: B_EXEC, ...extra });
}
/** Build a valid isolated batch, run fn(dir), always clean up. */
function withBatch(fn) {
  const dir = bDir();
  try { bWriteAllValid(dir); bGenerate(dir); return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('R21 合法单一批次：六项 single_*/integrity/freshness 全为 true 且门禁 PASS', () => {
  withBatch((dir) => {
    const r = bCheck(dir);
    assert.equal(r.status, 'PASS', `合法批次必须通过：${r.problems.join(' | ')}`);
    for (const k of ['single_execution_id', 'single_git_head', 'single_worktree_fingerprint', 'single_environment_fingerprint', 'evidence_integrity', 'evidence_freshness']) {
      assert.equal(r.single[k], true, `${k} 必须为 true`);
    }
  });
});

test('R22 混合 execution_id（拼接多批次）→ single_execution_id=false 且 FAIL', () => {
  withBatch((dir) => {
    const r0 = bCheck(dir);
    assert.equal(r0.single.single_execution_id, true);
    const card = bRead(dir, 'E2E-RESULTS.json');
    card.execution_id = 'UAP-EXEC-OTHER-BATCH';
    bWrite(dir, 'E2E-RESULTS.json', card);
    const r = bCheck(dir);
    assert.equal(r.single.single_execution_id, false);
    assert.equal(r.status, 'FAIL');
    assert.ok(r.problems.some((p) => /mixed batch|execution_id/.test(p)), r.problems.join(' | '));
  });
});

test('R23 某报告缺 environment_fingerprint（哈希仍一致）→ single_environment_fingerprint=false 且 FAIL', () => {
  withBatch((dir) => {
    const card = bRead(dir, 'PAYMENT-SANDBOX.json');
    delete card.environment_fingerprint;
    bWrite(dir, 'PAYMENT-SANDBOX.json', card);
    bGenerate(dir); // 重算清单：字节哈希一致，精确命中「缺字段」而非哈希失配
    const r = bCheck(dir);
    assert.equal(r.single.single_environment_fingerprint, false);
    assert.equal(r.single.evidence_integrity, true, '哈希一致时 integrity 仍 true，证明 single_* 捕获了哈希检查漏掉的缺字段');
    assert.equal(r.status, 'FAIL');
    assert.ok(r.problems.some((p) => /missing environment_fingerprint/.test(p)), r.problems.join(' | '));
  });
});

test('R24 某报告 environment_fingerprint 与批次不符（工具链变化）→ single_environment_fingerprint=false 且 FAIL', () => {
  withBatch((dir) => {
    const card = bRead(dir, 'VISUAL-REGRESSION.json');
    card.environment_fingerprint = 'f'.repeat(64);
    bWrite(dir, 'VISUAL-REGRESSION.json', card);
    bGenerate(dir);
    const r = bCheck(dir);
    assert.equal(r.single.single_environment_fingerprint, false);
    assert.equal(r.status, 'FAIL');
  });
});

test('R25 过期报告（generated_at 超过 24h）→ evidence_freshness=false 且 FAIL', () => {
  withBatch((dir) => {
    const card = bRead(dir, 'VALIDATION-RESULTS.json');
    card.generated_at = new Date(Date.now() - MAX_REPORT_AGE_MS - 60_000).toISOString();
    bWrite(dir, 'VALIDATION-RESULTS.json', card);
    bGenerate(dir);
    const r = bCheck(dir);
    assert.equal(r.single.evidence_freshness, false);
    assert.equal(r.status, 'FAIL');
    assert.ok(r.problems.some((p) => /older than/.test(p)), r.problems.join(' | '));
  });
});

test('R26 报告生成后代码变化（worktree 指纹漂移）→ evidence_freshness=false 且 FAIL', () => {
  withBatch((dir) => {
    const r = bCheck(dir, { fpNow: 'c'.repeat(64) });
    assert.equal(r.single.evidence_freshness, false);
    assert.equal(r.status, 'FAIL');
    assert.ok(r.problems.some((p) => /worktree changed after generation/.test(p)), r.problems.join(' | '));
  });
});

test('R27 [静态守卫] 门禁装配 single-batch 组并 surfaced 六项；独立一致性校验器复核环境绑定', () => {
  const g = src('.uap/tools/final-acceptance-gate.mjs');
  assert.match(g, /checkBatchConsistency\(\{ execution: e, phase: evidencePhase \}\)/);
  assert.match(g, /batch_consistency: batchGroup\?\.single/);
  assert.match(g, /single_environment_fingerprint/);
  assert.match(g, /environment_fingerprint: e\.environment_fingerprint/);
  const c = src('.uap/tools/verify-status-consistency.mjs');
  assert.match(c, /single_batch_consistency_proven/);
  assert.match(c, /environment_fingerprint_matches_current_run/);
  assert.match(c, /gate\.environment_fingerprint === execution\.environment_fingerprint/);
});

test('R28 fingerprint drift diagnostics identify bound source paths and separate volatile reports without reading contents', () => {
  const result = classifyFingerprintStatusLines([
    ' M src/handlers/recharge.go',
    '?? .uap/reports/FINAL-ACCEPTANCE.json',
    '?? web/.visual-e2e/report.json',
    ' M docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md',
  ].join('\n'));
  assert.equal(result.total_status_entries, 4);
  assert.deepEqual(result.included_paths, [
    'src/handlers/recharge.go',
    'docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md',
  ]);
  assert.deepEqual(result.excluded_volatile_paths, [
    '.uap/reports/FINAL-ACCEPTANCE.json',
    'web/.visual-e2e/report.json',
  ]);
  assert.equal(JSON.stringify(result).includes('file contents'), false);
});

test('R29 [静态守卫] 渠道删除必须在同一事务内级联清理所有 channel_id 引用表', () => {
  const helper = src('model/channel_cascade_delete.go');
  const channel = src('model/channel.go');
  // All production channel-referencing tables are enumerated (no silent omissions).
  for (const table of [
    'abilities', 'billing_cost_breakdowns', 'billing_financial_ledgers',
    'billing_price_snapshots', 'channel_model_pricing', 'channel_pricing_history',
    'channel_pricing_review', 'channel_sync_states', 'logs',
    'midjourney_refund_operations', 'quota_data', 'tasks',
    'upstream_billing_invoices',
  ]) {
    assert.ok(helper.includes(`"${table}"`), `cascade table list missing ${table}`);
  }
  assert.match(helper, /midjourneys.*billing_channel_id|"billing_channel_id"/);
  // Sentinel 0 must never be purged (it means "no channel" in ledger/quota rows).
  assert.match(helper, /if id > 0/);
  // All three deletion entry points must call the cascade helper.
  assert.match(channel, /func \(channel \*Channel\) Delete\(\)[\s\S]{0,400}deleteChannelCascadeRows\(tx/);
  assert.match(channel, /func BatchDeleteChannels[\s\S]{0,1200}deleteChannelCascadeRows\(tx, chunk\)/);
  assert.match(channel, /func DeleteDisabledChannel[\s\S]{0,1600}deleteChannelCascadeRows\(tx, ids\)/);
  // Every entry point deletes the channel row inside the SAME transaction.
  assert.match(channel, /DB\.Transaction\(func\(tx \*gorm\.DB\) error \{[\s\S]{0,300}tx\.Delete\(channel\)/);
});
