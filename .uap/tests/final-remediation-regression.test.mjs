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
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { classifyVisualDiff, MANDATED_CATEGORIES } from '../runtime/status-engine/visual-classifier.mjs';
import { worktreeFingerprint } from '../runtime/status-engine/execution.mjs';
import { FINAL_REPORTS } from '../runtime/evidence-engine/manifest.mjs';

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
  assert.match(o, /verifyEvidenceManifest\(\{ strictCurrent: true \}\)/);
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
