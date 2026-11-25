/**
 * 最终验收器负向测试（UAP Phase 2 验收整改）。
 *
 * 目标：证明 10 类无效/被篡改/过期的证据都会被生产函数【拒绝】。
 *
 * 全部在隔离临时目录（os.tmpdir + mkdtempSync）构造报告，绝不污染真实的
 * .uap/reports/。通过 manifest.mjs / final-acceptance-gate.mjs 暴露的可选
 * 路径注入参数（reportsDir / rootDir / headSha / execution）把生产函数指向
 * 临时目录，注入执行身份后无需任何 git 子进程、不会写 .uap/state，完全
 * hermetic。每个用例先断言「合法基线通过」，再施加单类篡改并断言「被拒绝」，
 * 拒绝必须是显式的（ok=false / problems 非空 / status!==PASS），不是伪造。
 *
 * 10 项覆盖：
 *   1 修改报告 git_head           -> verifyFinalReportBindings
 *   2 删除 evidence hash(sha256)  -> verifyEvidenceManifest
 *   3 修改 execution_id           -> verifyFinalReportBindings
 *   4 旧报告(过期 generated_at/旧 commit_sha/旧 BUILD-RESULTS)
 *                                -> verifyFinalReportBindings + checkUapSelf
 *   5 BLOCKED 改成 PASS           -> strictCard
 *   6 SKIPPED 改成 PASS           -> strictCard
 *   7 空 E2E 场景(0 测试却 PASS)  -> strictCard
 *   8 exit_code=1 却 status=PASS  -> strictCard
 *   9 counts 与 items 不符        -> strictCard
 *  10 篡改报告内容(sha256 不匹配) -> verifyEvidenceManifest
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  FINAL_REPORTS,
  MAX_REPORT_AGE_MS,
  generateEvidenceManifest,
  verifyEvidenceManifest,
  verifyFinalReportBindings,
} from '../runtime/evidence-engine/manifest.mjs';
import { strictCard, checkUapSelf, checkRequirements } from '../tools/final-acceptance-gate.mjs';
import { extractRequirements } from '../tools/requirement-matrix.mjs';

// 完全确定性的注入身份：不读取真实 git，保证隔离用例与仓库状态无关。
const HEAD = 'a'.repeat(40);
const EXEC = {
  execution_id: 'UAP-EXEC-NEG-TEST-0001',
  git_head: HEAD,
  worktree_fingerprint: 'fp-fixed-for-negative-tests',
  started_at: new Date(Date.now() - 1000).toISOString(),
  status: 'RUNNING',
};

function freshDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'uap-final-neg-'));
}

function writeReport(dir, name, obj) {
  fs.writeFileSync(path.join(dir, name), `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
}

function readReport(dir, name) {
  return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
}

function freshGeneratedAt() {
  return new Date(Date.now() - 1000).toISOString();
}

function validReport() {
  return {
    schema_version: '1.0',
    status: 'PASS',
    generated_at: freshGeneratedAt(),
    execution_id: EXEC.execution_id,
    git_head: EXEC.git_head,
    commit_sha: HEAD,
    worktree_fingerprint: EXEC.worktree_fingerprint,
  };
}

/** 写入一整套（当前批次）合法的 FINAL_REPORTS。 */
function writeAllValid(dir) {
  for (const name of FINAL_REPORTS) {
    if (name.endsWith('.md')) {
      fs.writeFileSync(path.join(dir, name), '# phase-2 remediation (isolated test)\n', 'utf8');
    } else {
      writeReport(dir, name, validReport());
    }
  }
}

/** 用生产生成器在临时目录生成证据清单。 */
function generateValid(dir) {
  return generateEvidenceManifest({
    execution: EXEC, reportsDir: dir, rootDir: dir, headSha: HEAD,
  });
}

const verifyOpts = (dir) => ({
  execution: EXEC, reportsDir: dir, rootDir: dir, headSha: HEAD, strictCurrent: false,
});
const bindingsOpts = (dir) => ({ execution: EXEC, reportsDir: dir, headSha: HEAD });

/** 构造整套合法报告 -> 执行回调 -> 清理临时目录。 */
function withValidReports(fn) {
  const dir = freshDir();
  try {
    writeAllValid(dir);
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** 把一张卡写入临时目录并用生产 strictCard 校验，返回其结果。 */
function strictCardFor(name, card) {
  const dir = freshDir();
  try {
    writeReport(dir, name, card);
    return strictCard(name, dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('requirement gate matches the live registry-derived ID set without a frozen count', () => {
  const expected = extractRequirements().requirements;
  assert.ok(expected.length > 0, 'registered specifications must declare requirements');
  const rows = expected.map((r) => ({
    requirement_id: r.requirement_id,
    status: 'NOT_VERIFIED',
    status_reason: 'No current behavior evidence',
  }));
  const dir = freshDir();
  try {
    writeReport(dir, 'REQUIREMENT-TRACEABILITY-MATRIX.json', { requirements: rows });
    writeReport(dir, 'REQUIREMENT-VERIFICATION-RESULTS.json', validReport());
    const valid = checkRequirements({ reportsDir: dir, expectedRequirements: expected });
    assert.equal(valid.status, 'PASS', valid.problems.join(' | '));

    const missing = checkRequirements({
      reportsDir: dir,
      expectedRequirements: expected,
    });
    assert.equal(missing.status, 'PASS', 'control remains valid before mutation');

    const missingRows = rows.slice(1);
    writeReport(dir, 'REQUIREMENT-TRACEABILITY-MATRIX.json', { requirements: missingRows });
    const missingResult = checkRequirements({ reportsDir: dir, expectedRequirements: expected });
    assert.equal(missingResult.status, 'FAIL');
    assert.ok(missingResult.problems.some((p) => /registered specification requirements/.test(p)));

    const sameCountWrongIds = rows.slice();
    sameCountWrongIds[0] = { ...sameCountWrongIds[0], requirement_id: 'UAP-99-999-REQ-999' };
    writeReport(dir, 'REQUIREMENT-TRACEABILITY-MATRIX.json', { requirements: sameCountWrongIds });
    const wrongIdResult = checkRequirements({ reportsDir: dir, expectedRequirements: expected });
    assert.equal(wrongIdResult.status, 'FAIL');
    assert.ok(wrongIdResult.details.registry_catalog.missing_ids.length > 0);
    assert.ok(wrongIdResult.details.registry_catalog.unexpected_ids.length > 0);

    writeReport(dir, 'REQUIREMENT-TRACEABILITY-MATRIX.json', {
      requirements: [...rows, rows[0]],
    });
    const duplicateResult = checkRequirements({ reportsDir: dir, expectedRequirements: expected });
    assert.equal(duplicateResult.status, 'FAIL');
    assert.ok(duplicateResult.details.registry_catalog.duplicate_ids.length > 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** 断言「被拒绝」：ok=false 或 problems 非空 或 status 非 PASS。 */
function assertRejected(label, result) {
  const rejected = result.ok === false
    || (Array.isArray(result.problems) && result.problems.length > 0)
    || (result.status !== undefined && result.status !== 'PASS' && result.status !== 'FULLY_VERIFIED');
  assert.ok(rejected, `${label} 必须被拒绝，实际：${JSON.stringify(result)}`);
}

const COUNTS = { PASS: 0, FAIL: 0, SKIPPED: 0, BLOCKED: 0, NOT_RUN: 0, NOT_APPLICABLE: 0 };

// ---------------------------------------------------------------------------

test('1. 修改报告 git_head（HEAD 不匹配）→ verifyFinalReportBindings 拒绝', () => {
  withValidReports((dir) => {
    const control = verifyFinalReportBindings(bindingsOpts(dir));
    assert.equal(control.ok, true, '合法基线必须通过绑定校验');

    const r = readReport(dir, 'E2E-RESULTS.json');
    r.git_head = 'f'.repeat(40);
    writeReport(dir, 'E2E-RESULTS.json', r);

    const v = verifyFinalReportBindings(bindingsOpts(dir));
    assertRejected('git_head 不匹配', v);
    assert.equal(v.ok, false);
    assert.ok(v.problems.some((p) => /git_head/.test(p)), `应报出 git_head 问题：${v.problems.join(' | ')}`);
  });
});

test('2. 删除 evidence hash（清单条目 sha256 缺失）→ verifyEvidenceManifest 拒绝', () => {
  withValidReports((dir) => {
    generateValid(dir);
    const control = verifyEvidenceManifest(verifyOpts(dir));
    assert.equal(control.ok, true, '合法基线必须通过清单校验');

    const manifestFile = path.join(dir, 'EVIDENCE-MANIFEST.json');
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    // 手工删除某个条目的证据哈希，且不重算 manifest_integrity_hash（模拟篡改）。
    const target = manifest.entries.find((e) => e.is_json);
    assert.ok(target, '基线清单必须含 JSON 条目');
    delete target.sha256;
    fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    const v = verifyEvidenceManifest(verifyOpts(dir));
    assertRejected('删除 evidence hash', v);
    assert.equal(v.ok, false);
    assert.ok(v.problems.some((p) => /sha256|integrity_hash/i.test(p)), `应报出哈希问题：${v.problems.join(' | ')}`);
  });
});

test('3. 修改 execution_id（批次不一致）→ verifyFinalReportBindings 拒绝', () => {
  withValidReports((dir) => {
    const control = verifyFinalReportBindings(bindingsOpts(dir));
    assert.equal(control.ok, true);

    const r = readReport(dir, 'DATABASE-INTEGRATION.json');
    r.execution_id = 'UAP-EXEC-ANCIENT-BATCH';
    writeReport(dir, 'DATABASE-INTEGRATION.json', r);

    const v = verifyFinalReportBindings(bindingsOpts(dir));
    assertRejected('execution_id 不匹配', v);
    assert.equal(v.ok, false);
    assert.ok(v.problems.some((p) => /execution_id/.test(p)), `应报出 execution_id 问题：${v.problems.join(' | ')}`);
  });
});

test('4. 使用旧报告（过期 generated_at / 旧 commit_sha / 旧 BUILD-RESULTS）→ 拒绝', () => {
  // 4A: 过期 generated_at + 旧 commit_sha -> verifyFinalReportBindings 拒绝
  withValidReports((dir) => {
    const control = verifyFinalReportBindings(bindingsOpts(dir));
    assert.equal(control.ok, true);

    const r = readReport(dir, 'VALIDATION-RESULTS.json');
    r.generated_at = new Date(Date.now() - MAX_REPORT_AGE_MS - 60_000).toISOString(); // 超过 24h
    r.commit_sha = '0'.repeat(40); // 旧版本
    writeReport(dir, 'VALIDATION-RESULTS.json', r);

    const v = verifyFinalReportBindings(bindingsOpts(dir));
    assertRejected('旧报告', v);
    assert.equal(v.ok, false);
    assert.ok(v.problems.some((p) => /stale/i.test(p)), `应报出过期问题：${v.problems.join(' | ')}`);
    assert.ok(v.problems.some((p) => /commit_sha/.test(p)), `应报出 commit_sha 问题：${v.problems.join(' | ')}`);
  });

  // 4B: 过期/无绑定的 BUILD-RESULTS（审计中的真实缺陷）-> checkUapSelf 拒绝
  const dir = freshDir();
  try {
    writeReport(dir, 'RUNTIME-TEST-RESULTS.json', { exit_code: 0, status: 'PASS' });
    writeReport(dir, 'VALIDATION-RESULTS.json', { total: 5, pass: 5, fail: 0, blocked: 0, exit_code: 0 });
    // 控制组：绑定到当前 HEAD 与 execution 的 BUILD-RESULTS 应通过 checkUapSelf。
    writeReport(dir, 'BUILD-RESULTS.json', {
      git_head: HEAD, execution_id: EXEC.execution_id,
      commands: [{ exit_code: 0 }], quality_gate: null,
    });
    const control = checkUapSelf(dir, EXEC);
    assert.equal(control.status, 'PASS', `合法 BUILD-RESULTS 应通过：${control.problems.join(' | ')}`);

    // 篡改：把 BUILD-RESULTS 换成过期且无绑定字段（含 3 项失败命令）的旧报告。
    writeReport(dir, 'BUILD-RESULTS.json', {
      generated_at: '2020-01-01T00:00:00Z',
      commands: [{ exit_code: 1 }, { exit_code: 1 }, { exit_code: 1 }],
      quality_gate: null,
    });
    const v = checkUapSelf(dir, EXEC);
    assertRejected('旧 BUILD-RESULTS', v);
    assert.ok(v.problems.some((p) => /not bound to current HEAD/.test(p)), `应报出 HEAD 绑定问题：${v.problems.join(' | ')}`);
    assert.ok(v.problems.some((p) => /not bound to current execution/.test(p)), `应报出 execution 绑定问题：${v.problems.join(' | ')}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('5. 把 BLOCKED 改成 PASS（含 BLOCKED 项却声明 PASS）→ strictCard 拒绝', () => {
  const card = {
    status: 'PASS',
    items: [{ status: 'BLOCKED', title: 'biz_01', reason: 'blocked by policy' }],
    counts: { ...COUNTS, BLOCKED: 1 },
    pass: 0,
    exit_code: 0,
  };
  const r = strictCardFor('E2E-RESULTS.json', card);
  assertRejected('BLOCKED→PASS', r);
  assert.notEqual(r.status, 'PASS');
  assert.ok(r.problems.length > 0, `应报出问题：${JSON.stringify(r)}`);
});

test('6. 把 SKIPPED 改成 PASS（含 SKIPPED 项却声明 PASS）→ strictCard 拒绝', () => {
  const card = {
    status: 'PASS',
    items: [{ status: 'SKIPPED', title: 'skipped_spec', reason: 'runner skip' }],
    counts: { ...COUNTS, SKIPPED: 1 },
    pass: 0,
    exit_code: 0,
  };
  const r = strictCardFor('E2E-RESULTS.json', card);
  assertRejected('SKIPPED→PASS', r);
  assert.notEqual(r.status, 'PASS');
  assert.ok(r.problems.length > 0, `应报出问题：${JSON.stringify(r)}`);
});

test('7. 空 E2E 场景（scenarios=[] / expected=0 却 status=PASS）→ strictCard 拒绝', () => {
  const card = {
    status: 'PASS',
    scenarios: [],
    expected: 0,
    items: [],
    counts: { ...COUNTS },
    pass: 0,
    exit_code: 0,
  };
  const r = strictCardFor('E2E-RESULTS.json', card);
  assertRejected('空 E2E 场景', r);
  assert.notEqual(r.status, 'PASS');
  assert.ok(r.problems.some((p) => /zero executed test items|no execution evidence/i.test(p)),
    `应报出零测试问题：${r.problems.join(' | ')}`);
});

test('8. exit_code=1 却 status=PASS → strictCard 拒绝', () => {
  const card = {
    status: 'PASS',
    items: [{ status: 'PASS', title: 'spec_ok' }],
    counts: { ...COUNTS, PASS: 1 },
    pass: 1,
    exit_code: 1,
  };
  const r = strictCardFor('E2E-RESULTS.json', card);
  assertRejected('exit_code=1 却 PASS', r);
  assert.notEqual(r.status, 'PASS');
  assert.ok(r.problems.some((p) => /exit_code/.test(p)), `应报出 exit_code 问题：${r.problems.join(' | ')}`);
});

test('9. 修改测试数量（counts 与 items 不符）→ strictCard 拒绝', () => {
  const card = {
    status: 'PASS',
    items: [{ status: 'PASS', title: 'a' }, { status: 'PASS', title: 'b' }],
    counts: { ...COUNTS, PASS: 5 }, // 虚报：items 只有 2 个
    pass: 5,
    exit_code: 0,
  };
  const r = strictCardFor('E2E-RESULTS.json', card);
  assertRejected('counts 与 items 不符', r);
  assert.notEqual(r.status, 'PASS');
  assert.ok(r.problems.some((p) => /counts\.PASS|items contain/i.test(p)), `应报出计数问题：${r.problems.join(' | ')}`);
});

test('10. 篡改 evidence 内容（sha256 不匹配）→ verifyEvidenceManifest 拒绝', () => {
  withValidReports((dir) => {
    generateValid(dir);
    const control = verifyEvidenceManifest(verifyOpts(dir));
    assert.equal(control.ok, true, '合法基线必须通过清单校验');

    // 只改动一个中性字段：字节变化使 sha256 失配，但绑定字段保持合法，
    // 从而精确命中「sha256 不匹配」这一拒绝路径（不重算清单）。
    const r = readReport(dir, 'PAYMENT-SANDBOX.json');
    r.tamper_marker = 'content-changed-after-manifest';
    writeReport(dir, 'PAYMENT-SANDBOX.json', r);

    const v = verifyEvidenceManifest(verifyOpts(dir));
    assertRejected('篡改报告内容', v);
    assert.equal(v.ok, false);
    assert.ok(v.problems.some((p) => /sha256 changed/.test(p)), `应报出 sha256 失配：${v.problems.join(' | ')}`);

    // 补充断言 A3：报告自身 commit_sha 与清单 commit_sha 不一致同样必须被拒绝。
    // 重算清单使字节哈希保持一致后，仅让 commit_sha 绑定失配（HEAD=aaa, 报告=fff）。
    const r2 = readReport(dir, 'PAYMENT-SANDBOX.json');
    delete r2.tamper_marker;
    r2.commit_sha = 'f'.repeat(40);
    writeReport(dir, 'PAYMENT-SANDBOX.json', r2);
    generateValid(dir);
    const v2 = verifyEvidenceManifest(verifyOpts(dir));
    assert.equal(v2.ok, false, 'A3：报告 commit_sha 与清单不一致必须被拒绝');
    assert.ok(v2.problems.some((p) => /report commit_sha/.test(p)), `应报出 A3 问题：${v2.problems.join(' | ')}`);
  });
});
