/**
 * Contract tests for the adapter that builds the real execution snapshot.
 *
 * These complement status-consistency.test.mjs: that file proves the pure
 * state machine is correct for all 8 §3.4 scenarios; this file proves the
 * on-disk adapter feeds it truthfully and cannot be tricked into promoting a
 * historical card.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { gitHead, worktreeFingerprint, fingerprintBasis, currentExecution, bindExecution, executionHistory } from '../runtime/status-engine/execution.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const EMPTY_HASH = crypto.createHash('sha256').update('').digest('hex');
const VOLATILE = ['.uap/state/', '.uap/reports/', '.uap/evidence/'];
import {
  buildStatusSnapshot, statusVerdict, specificationVerification,
  renderStatusBlock,
} from '../runtime/status-engine/snapshot.mjs';
import { computeFinalStatus, verifyEvidenceChain, isCurrent } from '../runtime/status-engine/index.mjs';

const BLOCK_RE = /<!--\s*UAP-STATUS-BLOCK\s+(\{[\s\S]*?\})\s*-->/;

/**
 * Quiescence read: under a parallel `node --test` run, sibling test files
 * (real-code-repair-boundaries) deliberately create/restore a real dirty
 * business file, so the worktree fingerprint legitimately changes mid-run.
 * "Deterministic when content unchanged" is still proven strictly: require
 * two CONSECUTIVE reads to agree. If the fingerprint were nondeterministic
 * on a static tree, consecutive agreement would never be reached.
 */
function readStableFingerprint(maxAttempts = 40, intervalMs = 100) {
  let prev = worktreeFingerprint();
  for (let i = 1; i < maxAttempts; i += 1) {
    const next = worktreeFingerprint();
    if (next === prev) return prev;
    prev = next;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, intervalMs);
  }
  return prev; // never settled: equality assertions below will fail loudly
}

/** Retry an equality pair a few times: transient concurrent WIP probes
 *  (created and restored by sibling test files) self-heal; real
 *  nondeterminism on a static tree never converges and fails loudly. */
function assertPairStable(computePair, msg, attempts = 4) {
  let last = null;
  for (let i = 0; i < attempts; i += 1) {
    const [x, y] = computePair();
    last = [x, y];
    if (x === y) { assert.equal(y, x, msg); return; }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.equal(last[1], last[0], `${msg}（重试 ${attempts} 次后仍漂移——若非本测试引起请检查并发写者）`);
}

describe('执行身份绑定', () => {
  test('git HEAD 来自真实仓库且是 40 位 sha', () => {
    const head = gitHead();
    assert.match(head, /^[0-9a-f]{40}$/);
  });

  test('worktree 指纹绑定真实文件内容（不再只是路径集合 / 空串哈希）', () => {
    const a = readStableFingerprint();
    assert.match(a, /^[0-9a-f]{64}$/);
    assertPairStable(
      () => [a, readStableFingerprint()],
      '代码未变化时指纹必须稳定（静默窗口内连续读数一致）',
    );
    assert.notEqual(a, EMPTY_HASH, '指纹不得退化为 sha256("") —— Phase 2 审计明确缺陷');
    const basis = fingerprintBasis();
    assert.equal(basis.includes_file_content, true);
    assert.equal(basis.includes_untracked_files, true);
    assert.ok(basis.excludes.some((p) => p.startsWith('.uap/reports')));

    // 写入 / 改写 UAP 运行产物不得改变指纹（同一验收批次内可以持续生成证据）。
    // 外部并发 WIP 探针若恰好落在窗口内，由 assertPairStable 重试消解。
    const volatileProbe = path.join(ROOT, '.uap', 'state', `fingerprint-probe-${process.pid}.tmp`);
    assertPairStable(() => {
      fs.writeFileSync(volatileProbe, 'runtime artefact A');
      const wA = readStableFingerprint();
      fs.writeFileSync(volatileProbe, 'runtime artefact B');
      const wB = readStableFingerprint();
      return [wA, wB];
    }, '.uap/state 运行产物不得使本批次证据失效');
    fs.unlinkSync(volatileProbe);

    // 新增一个非易失的未跟踪业务文件必须使指纹变化（内容被绑定）。
    const codeProbe = path.join(ROOT, `uap-fingerprint-content-probe-${process.pid}.tmp`);
    fs.writeFileSync(codeProbe, 'version-A');
    const withNewFile = worktreeFingerprint();
    fs.writeFileSync(codeProbe, 'version-B');
    const withChangedContent = worktreeFingerprint();
    fs.unlinkSync(codeProbe);
    assert.notEqual(withNewFile, a, '新增未跟踪业务文件必须改变指纹');
    assert.notEqual(withChangedContent, withNewFile,
      '仅内容变化、文件集合不变也必须改变指纹（旧实现的致命缺陷）');
    assert.notEqual(worktreeFingerprint(), withChangedContent, '探针清理必须被指纹感知');
  });

  test('生成验证报告与构建缓存被排除，审计源文档仍被绑定', () => {
    const basis = fingerprintBasis();
    assert.ok(basis.excludes.some((p) => p.startsWith('tsgo-cache')),
      'tsgo-cache 构建缓存必须被排除（build/self-test 每次重建）');
    assert.ok(basis.excludes.includes('docs/design-system/audit/contrast-validation.json'),
      '生成的审计 JSON 验证报告必须被排除（含墙钟时间戳，每次验证重写）');
    assert.ok(!basis.excludes.some((p) => p.includes('/audit/') && p.endsWith('.md')),
      '手写审计 .md 源文档不得被排除');
    assert.ok(basis.excludes.includes('docs/design-system/03-COLOR-STANDARD.md'),
      'UDS 8.0.0 生成的规范文档必须被排除（build.mjs 每次再生）');
    assert.ok(basis.excludes.some((p) => p.startsWith('web/public/docs-search')),
      '前端构建生成的搜索索引必须被排除（build:check 每次再生，否则本批次自漂移）');
    assert.ok(basis.excludes.includes('web/public/sitemap.xml'),
      '前端构建生成的 sitemap 必须被排除');
    assert.ok(!basis.excludes.includes('docs/design-system/VISUAL-BASELINE.json'),
      '冻结视觉基线 VISUAL-BASELINE.json 是源真相，不得被排除');
    assert.ok(!basis.excludes.some((p) => p.includes('/registry/') && p.endsWith('.mjs')),
      '手写 registry/*.mjs 生成器源不得被排除');

    const base = readStableFingerprint();

    // tsgo-cache 内的构建缓存内容变化不得改变指纹（与 .uap/state 运行产物同理）。
    const cacheDir = path.join(ROOT, 'tsgo-cache');
    const cacheProbe = path.join(cacheDir, `zz-fp-probe-${process.pid}.tsbuildinfo`);
    fs.mkdirSync(cacheDir, { recursive: true });
    assertPairStable(() => {
      fs.writeFileSync(cacheProbe, 'cache-A');
      const cA = readStableFingerprint();
      fs.writeFileSync(cacheProbe, 'cache-B');
      const cB = readStableFingerprint();
      return [cA, cB];
    }, 'tsgo-cache 构建缓存不得使本批次证据失效');
    fs.unlinkSync(cacheProbe);

    // 审计目录下的手写源文档（.md）必须仍被绑定：排除只针对生成的 .json 报告。
    const auditDir = path.join(ROOT, 'docs', 'design-system', 'audit');
    const srcProbe = path.join(auditDir, `zz-fp-source-probe-${process.pid}.md`);
    fs.writeFileSync(srcProbe, 'source-A');
    const withSrc = worktreeFingerprint();
    fs.writeFileSync(srcProbe, 'source-B');
    const withSrcChanged = worktreeFingerprint();
    fs.unlinkSync(srcProbe);
    assert.notEqual(withSrc, base, '新增审计源文档必须改变指纹');
    assert.notEqual(withSrcChanged, withSrc, '审计源文档内容变化必须改变指纹（源仍被绑定）');

    // UDS 8.0.0 代码生成产物（runtime/ 下的派生 CSS）内容变化不得改变指纹。
    const runtimeDir = path.join(ROOT, 'docs', 'design-system', 'runtime');
    const genProbe = path.join(runtimeDir, `zz-fp-gen-probe-${process.pid}.css`);
    fs.mkdirSync(runtimeDir, { recursive: true });
    assertPairStable(() => {
      fs.writeFileSync(genProbe, 'gen-A');
      const gA = readStableFingerprint();
      fs.writeFileSync(genProbe, 'gen-B');
      const gB = readStableFingerprint();
      return [gA, gB];
    }, 'UDS 8.0.0 生成产物不得使本批次证据失效');
    fs.unlinkSync(genProbe);

    // registry/ 下的手写生成器源（.mjs）必须仍被绑定：排除只针对派生产物。
    const registryDir = path.join(ROOT, 'docs', 'design-system', 'registry');
    const regProbe = path.join(registryDir, `zz-fp-reg-probe-${process.pid}.mjs`);
    fs.writeFileSync(regProbe, 'export const a = 1;');
    const withReg = worktreeFingerprint();
    fs.writeFileSync(regProbe, 'export const a = 2;');
    const withRegChanged = worktreeFingerprint();
    fs.unlinkSync(regProbe);
    assert.notEqual(withReg, base, '新增 registry 源必须改变指纹');
    assert.notEqual(withRegChanged, withReg, 'registry 源内容变化必须改变指纹（生成器源仍被绑定）');
  });

  test('currentExecution 返回同一身份，且绑定字段不可被调用方伪造', () => {
    // 其他测试文件会在并行进程里真实制造/还原一个未提交的脏业务文件
    // （WIP 保护负向用例）。工作树指纹因此可能在本用例执行期间变化，而
    // 「代码版本变了必须开启新执行身份」正是规范要求。所以这里验证的是
    // 真正的契约：版本不变 → 身份不变；版本变化 → 必须换身份；任何情况下
    // 调用方都不能伪造绑定字段。
    const e = currentExecution();
    assert.ok(e.execution_id.startsWith('UAP-EXEC-'));
    assert.equal(e.git_head, gitHead());
    assert.match(e.worktree_fingerprint || '', /^[0-9a-f]{64}$/);

    // 身份变化必须由 append-only 账本里可解释的「版本变化」引起。
    // 并发测试可能把工作树从 A 改到 B 再还原回 A，系统不会复用旧身份，
    // 这是规范要求；但无版本变化却凭空出现第二个身份（修复前的竞态）
    // 必须被判定为失败。
    const again = currentExecution();
    if (again.execution_id !== e.execution_id) {
      const history = executionHistory();
      const from = history.findIndex((x) => x.execution_id === e.execution_id);
      const to = history.findIndex((x) => x.execution_id === again.execution_id);
      assert.ok(from >= 0 && to > from, '新身份必须追加到账本，不得回退或凭空出现');
      const intervening = history.slice(from + 1, to);
      // A code-version change is recorded on the NEW identity itself when the
      // two identities are adjacent in the ledger (e.g. another test file
      // created and restored a WIP probe between our two reads). That is a
      // legitimate reason to open a new execution, not a race. The original
      // defect was two DIFFERENT identities for the SAME code version: if both
      // fingerprints are equal AND no intervening entry shows a version
      // change, the identity change is still a concurrency race and must fail.
      const versionChanged = again.worktree_fingerprint !== e.worktree_fingerprint
        || intervening.some((x) => x.worktree_fingerprint !== e.worktree_fingerprint);
      assert.ok(versionChanged,
        '身份变化必须有代码版本变化作为依据（新身份指纹或中间账本条目），否则即为并发竞态');
      assert.notEqual(again.execution_id, e.execution_id);
    }

    // 防伪造：不依赖「当前身份仍与快照相同」这种时序假设，而是直接验证
    // 绑定字段来自真实仓库 + append-only 账本，且调用方字段被保留。
    const bound = bindExecution({ execution_id: 'FORGED', git_head: 'FORGED', hello: 'world' });
    assert.match(bound.execution_id, /^UAP-EXEC-/);
    assert.equal(bound.git_head, gitHead());
    assert.match(bound.worktree_fingerprint || '', /^[0-9a-f]{64}$/);
    assert.equal(bound.hello, 'world');
    const entry = executionHistory().find((x) => x.execution_id === bound.execution_id);
    assert.ok(entry, '绑定的执行身份必须存在于 append-only 账本中');
    assert.equal(entry.git_head, bound.git_head);
    assert.equal(entry.worktree_fingerprint, bound.worktree_fingerprint);
  });
});

describe('真实快照适配器', () => {
  test('从真实追踪矩阵构造 538 条要求与 32 份规范', () => {
    const s = buildStatusSnapshot();
    assert.equal(s.requirements.length, 538);
    const v = specificationVerification({ requirements: s.requirements });
    assert.equal(v.total_specs, 32);
    assert.equal(v.verified_specs, 0);
    assert.ok(s.execution_id && s.git_head && s.worktree_fingerprint);
  });

  test('stale 判定与卡片绑定状态严格一致，且绝不提升为 PASS', () => {
    const s = buildStatusSnapshot();
    const v = computeFinalStatus(s);
    const staleExpected = [];
    if (s.tests && !isCurrent(s.tests, s)) staleExpected.push('tests');
    if (s.validators && !isCurrent(s.validators, s)) staleExpected.push('validators');
    const hasStaleReason = v.reasons.some((r) => r.includes('stale artefacts'));
    assert.equal(hasStaleReason, staleExpected.length > 0,
      `staleExpected=${JSON.stringify(staleExpected)} reasons=${JSON.stringify(v.reasons)}`);
    // The number of VERIFIED rows is no longer hard-coded to 0: P2-06 added
    // real, execution-bound BEHAVIOUR_EXECUTION evidence for a subset of the
    // 538 requirements. What must NEVER happen is a stale or unproven row
    // being counted — so the recount may not exceed the matrix's own VERIFIED
    // rows and can never produce a full-claim verdict.
    const declaredVerified = s.requirements.filter((r) => r.verification_status === 'VERIFIED').length;
    assert.ok(v.counts.verified <= declaredVerified,
      `engine recount ${v.counts.verified} exceeds ${declaredVerified} matrix VERIFIED rows`);
    assert.equal(v.claim_allowed, false);
    assert.ok(!['FULLY_VERIFIED', 'FULLY_OPERATIONAL'].includes(v.overall_status));
  });

  test('伪造旧 execution_id / HEAD 的真实快照一律判为 stale', () => {
    const s = buildStatusSnapshot();
    s.tests = { ...s.tests, execution_id: 'UAP-EXEC-FORGED-OLD' };
    s.validators = { ...s.validators, git_head: 'FORGED-OLD-HEAD' };
    const v = computeFinalStatus(s);
    assert.ok(v.reasons.some((r) => r.includes('stale artefacts')));
    assert.equal(v.claim_allowed, false);
  });

  test('statusVerdict 与 FINAL-STATUS.json / 索引同源，且不得自行宣称成功', () => {
    const { verdict, specVer, snapshot } = statusVerdict();
    assert.equal(verdict.computed_by, 'runtime.status-engine/computeFinalStatus');
    assert.equal(verdict.execution_id, snapshot.execution_id);
    assert.equal(verdict.git_head, snapshot.git_head);
    assert.equal(specVer.total_specs, 32);
    assert.equal(verdict.claim_allowed, false);
    assert.equal(Object.keys(verdict.capabilities).length, 6);
    for (const v of Object.values(verdict.capabilities)) assert.equal(typeof v, 'boolean');
    assert.equal(verdict.capability_gaps.length,
      Object.values(verdict.capabilities).filter((v) => v !== true).length);
  });

  test('注入 indexDeclaration 只影响一致性比对，不伪造通过数', () => {
    const base = buildStatusSnapshot();
    const declared = buildStatusSnapshot({
      indexDeclaration: { verified_specs: 0, total_specs: 32, overall_status: 'IMPLEMENTED_NOT_VERIFIED' },
      claims: { specifications_verified: 0, overall_status: 'IMPLEMENTED_NOT_VERIFIED' },
    });
    const baseCount = computeFinalStatus(base).counts.verified;
    const declaredCount = computeFinalStatus(declared).counts.verified;
    // Injecting an index declaration must not invent verified requirements —
    // the count is identical with or without the declaration, and is bounded
    // by the real matrix rows (not hard-coded to the old 0 baseline).
    assert.equal(declaredCount, baseCount);
    assert.ok(baseCount <= base.requirements.filter((r) => r.verification_status === 'VERIFIED').length);
    assert.equal(computeFinalStatus(declared).claim_allowed, false);
    // A lying declaration is detected, not accepted.
    const lying = buildStatusSnapshot({
      indexDeclaration: { verified_specs: 32, total_specs: 32, overall_status: 'FULLY_OPERATIONAL' },
      claims: { specifications_verified: 0, overall_status: 'IMPLEMENTED_NOT_VERIFIED' },
    });
    const lv = computeFinalStatus(lying);
    assert.ok(lv.reasons.some((r) => r.includes('index/report mismatch')));
  });

  test('状态块是可机读 JSON，字段与 verdict 一致', () => {
    const { verdict, specVer } = statusVerdict();
    const block = renderStatusBlock(verdict, specVer);
    const m = BLOCK_RE.exec(block);
    assert.ok(m, 'status block must be machine-readable');
    const parsed = JSON.parse(m[1]);
    assert.equal(parsed.overall_status, verdict.overall_status);
    assert.equal(parsed.execution_id, verdict.execution_id);
    assert.equal(parsed.git_head, verdict.git_head);
    assert.equal(parsed.requirements_verified, verdict.counts.verified);
    assert.equal(parsed.specifications_verified, specVer.verified_specs);
    assert.equal(parsed.claim_allowed, verdict.claim_allowed);
  });
});

describe('证据链 fail-closed', () => {
  test('缺少绑定字段或哈希未校验的证据一律失败', () => {
    const snap = { execution_id: 'EX', git_head: 'HEAD', worktree_fingerprint: 'FP' };
    const good = [{ evidence_id: 'EV-1', execution_id: 'EX', git_head: 'HEAD', worktree_fingerprint: 'FP', hash_valid: true, recorded_at: '2026-11-13T00:00:00Z' }];
    assert.equal(verifyEvidenceChain(good, snap).ok, true);
    for (const bad of [
      [{ ...good[0], worktree_fingerprint: 'OTHER' }],
      [{ ...good[0], execution_id: 'OLD' }],
      [{ ...good[0], hash_valid: false }],
      [{ ...good[0], recorded_at: null }],
    ]) {
      assert.equal(verifyEvidenceChain(bad, snap).ok, false);
    }
  });
});
