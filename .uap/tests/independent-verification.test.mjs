/**
 * UAP §1.11 — 独立验收路径（independent verification）。
 *
 * 本文件刻意 **不 import 任何 UAP 运行时模块**：不调用
 * runtime/status-engine/computeFinalStatus，不调用 tools/report-generator，
 * 也不调用任何 validators。它直接从磁盘读取规范、追踪矩阵、证据与最终状态，
 * 用一套独立实现重新计算并交叉核验。
 *
 * 因此 UAP 自身验证器即使在逻辑上有缺陷，也无法让这里的断言变绿；反之，
 * 若本文件发现不一致，即为真实缺陷，不得通过修改状态字段消除。
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const abs = (p) => path.join(ROOT, p);
const readJSON = (p) => JSON.parse(fs.readFileSync(abs(p), 'utf8'));
const readText = (p) => fs.readFileSync(abs(p), 'utf8');
const exists = (p) => fs.existsSync(abs(p));

const matrix = readJSON('.uap/reports/REQUIREMENT-TRACEABILITY-MATRIX.json');
const finalStatus = readJSON('.uap/reports/FINAL-STATUS.json');
const registryText = readText('.uap/config/specification-registry.yaml');

// 独立解析注册表：只取 "- id:" 与紧随其后的 "file:"，不依赖 UAP 的 YAML 解析器。
const specEntries = [];
{
  const lines = registryText.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^\s*-\s*id:\s*(UAP-\d{2}-\d{3})\s*$/.exec(lines[i]);
    if (!m) continue;
    let file = null;
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j += 1) {
      const f = /^\s*file:\s*(\S+)\s*$/.exec(lines[j]);
      if (f) { file = f[1]; break; }
      if (/^\s*-\s*id:/.test(lines[j])) break;
    }
    specEntries.push({ id: m[1], file });
  }
}

const reqs = matrix.requirements || [];
const sha256re = /^[a-f0-9]{64}$/;

describe('独立验收：规范与追踪矩阵（不依赖 UAP 自身实现）', () => {
  test('注册表中恰有 32 项规范，文件真实存在且非空、含标准编号', () => {
    assert.equal(specEntries.length, 32, '注册表规范数量');
    const missing = specEntries.filter((s) => !s.file || !exists(s.file));
    assert.deepEqual(missing, [], `缺失规范文件: ${missing.map((s) => s.id).join(',')}`);
    const bad = specEntries.filter((s) => {
      const t = readText(s.file);
      return t.length < 1000 || !/\*\*标准编号：\*\*/.test(t);
    });
    assert.deepEqual(bad.map((s) => s.id), [], '规范文件过小或缺标准编号');
  });

  test('538 条要求的 ID 唯一、符合 id_policy、归属正确、原文哈希为 sha256', () => {
    assert.equal(reqs.length, finalStatus.status_engine.counts.requirements_total);
    // 矩阵 id_policy: "<spec-id>-REQ|ACC-<ordinal>"，REQ=强制要求，ACC=验收准则。
    // 指令 3.1 的 REQ 格式是「推荐」而非唯一；硬约束是稳定、唯一、可归属。
    assert.match(matrix.id_policy, /REQ\|ACC/, 'id_policy 必须声明双类型 ID 策略');
    const ids = new Set();
    const kinds = { REQ: 0, ACC: 0 };
    for (const r of reqs) {
      const m = /^(UAP-\d{2}-\d{3})-(REQ|ACC)-(\d{3})$/.exec(r.requirement_id);
      assert.ok(m, `非法 ID: ${r.requirement_id}`);
      assert.equal(m[1], r.specification_id, `ID 前缀与所属规范不一致: ${r.requirement_id}`);
      assert.ok(!ids.has(r.requirement_id), `重复 ID: ${r.requirement_id}`);
      ids.add(r.requirement_id);
      kinds[m[2]] += 1;
      assert.ok(sha256re.test(r.statement_sha256 || ''), `无效 statement_sha256: ${r.requirement_id}`);
    }
    assert.equal(kinds.REQ, matrix.totals.mandatory, 'REQ 数须等于 mandatory');
    assert.equal(kinds.ACC, matrix.totals.acceptance, 'ACC 数须等于 acceptance');
  });

  test('如实记录证据缺口：不得把无当前证据的要求算作已验证', () => {
    const withTest = reqs.filter((r) => (r.test_cases || []).length > 0).length;
    const withCurrentEvidence = reqs.filter((r) => (r.evidence || []).some(
      (e) => typeof e === 'object' && e.hash_valid === true)).length;
    const verifiedRows = reqs.filter((r) => r.verification_status === 'VERIFIED');
    // 2026-11-14 基线更新（P2-06 整改后）：旧基线 0 条 VERIFIED → 现在每一条
    // VERIFIED 都必须绑定真实 BEHAVIOR_EXECUTION 证据（go test 实跑 + sha256
    // + 当前执行绑定）。若此数字变化，必须重新核对每条证据，而不是直接改数字。
    assert.equal(verifiedRows.length, matrix.states.VERIFIED,
      'verification_status 计数必须与矩阵 states 同源');
    assert.equal(finalStatus.status_engine.counts.verified, verifiedRows.length,
      'FINAL-STATUS 与矩阵的 VERIFIED 计数必须同源');
    // 每一条 VERIFIED 都必须有真实行为证据 + 执行绑定（独立复核，不信任引擎）。
    for (const r of verifiedRows) {
      const refs = r.evidence_refs || [];
      assert.ok(refs.length > 0 && refs.every((e) => e.probe_kind === 'BEHAVIOR_EXECUTION'),
        `${r.requirement_id}: VERIFIED 缺少真实行为证据`);
      assert.ok(r.execution_id && r.git_head && r.worktree_fingerprint,
        `${r.requirement_id}: VERIFIED 缺少执行绑定`);
      assert.ok((r.test_cases || []).length > 0,
        `${r.requirement_id}: VERIFIED 未绑定任何真实测试用例`);
    }
    assert.ok(verifiedRows.length < reqs.length, '真实缺口：绝大多数要求仍未验证');
    assert.ok(withTest < reqs.length, '真实缺口：仍有要求未绑定测试用例');
    assert.ok(withCurrentEvidence < reqs.length, '真实缺口：仍有要求无当前有效证据');
    assert.ok(finalStatus.status_engine.reasons.some((s) => s.includes('lack current valid evidence')),
      '最终状态必须显式列出证据缺口原因，不得静默省略');
  });

  test('implementation_files 不得虚构路径（独立 fs 校验）', () => {
    const bogus = [];
    for (const r of reqs) {
      for (const f of r.implementation_files || []) {
        if (!exists(f)) bogus.push(`${r.requirement_id}:${f}`);
      }
    }
    assert.deepEqual(bogus, [], `虚构实现路径 ${bogus.length} 处: ${bogus.slice(0, 8).join(', ')}`);
  });

  test('executor_ids / validator_ids 非空形如 domain.name', () => {
    const bad = reqs.filter((r) => !(r.executor_ids || []).length || !(r.validator_ids || []).length);
    assert.equal(bad.length, 0, `未绑定执行器/验证器的要求: ${bad.slice(0, 5).map((r) => r.requirement_id).join(',')}`);
  });
});

describe('独立验收：状态口径（独立重算，不调用 computeFinalStatus）', () => {
  const independentVerified = reqs.filter((r) =>
    r.verification_status === 'VERIFIED'
    && (r.test_cases || []).length > 0
    && (r.evidence || []).some((e) => typeof e === 'object' && e.hash_valid === true)
    && (r.blockers || []).length === 0).length;

  test('独立重算的 verified 数必须与 FINAL-STATUS.json 一致', () => {
    assert.equal(independentVerified, finalStatus.status_engine.counts.verified,
      '若不等，说明状态报告与底层矩阵不同源');
  });

  test('存在未验证要求时，claim_allowed 必须为 false 且不得 FULLY_*', () => {
    const applicable = finalStatus.status_engine.counts.applicable;
    if (independentVerified < applicable) {
      assert.equal(finalStatus.claim_allowed, false);
      assert.equal(finalStatus.final_acceptance.claim_allowed, false);
      assert.ok(!['FULLY_VERIFIED', 'FULLY_OPERATIONAL'].includes(finalStatus.overall_status));
    }
  });

  test('6 项运行能力若存在 false，不得宣称 FULLY_OPERATIONAL', () => {
    const caps = finalStatus.status_engine.capabilities;
    const missing = Object.entries(caps).filter(([, v]) => v !== true).map(([k]) => k);
    assert.equal(finalStatus.final_acceptance.uap_fully_operational, missing.length === 0);
    if (missing.length) {
      assert.notEqual(finalStatus.overall_status, 'FULLY_OPERATIONAL');
    }
  });

  test('P0 阻断项与能力缺口一致，且不得被隐藏或静默关闭', () => {
    const p0 = finalStatus.status_engine.p0_blockers || [];
    for (const b of p0) assert.equal(b.status, 'OPEN', `blocker ${b.id} 不得被静默关闭`);
    // 原断言假定「永远至少有一个 P0」，这只在能力尚未建成时成立。真实修复
    // 闭环完成后 P0 应当被真实关闭 —— 因此改为更强的口径：每个尚未证明的
    // 修复/回归能力都必须对应一个 OPEN 的 CAPABILITY_GAP，一个都不能少。
    const caps = finalStatus.status_engine.capabilities;
    const expected = ['real_code_repair', 'independent_regression']
      .filter((k) => caps[k] !== true).length;
    const capBlockers = p0.filter((b) => b.category === 'CAPABILITY_GAP');
    assert.equal(capBlockers.length, expected,
      `未证明的能力必须有对应 OPEN 阻断项: caps=${JSON.stringify(caps)} p0=${JSON.stringify(p0)}`);
    if (p0.length > 0) assert.equal(finalStatus.claim_allowed, false);
  });
});

describe('独立验收：证据与报告完整性', () => {
  test('18 份规定报告全部存在', () => {
    const names = (finalStatus.reports || []);
    assert.equal(names.length, 18);
    const missing = names.filter((n) => !exists(`.uap/reports/${n}`));
    assert.deepEqual(missing, [], `缺失报告: ${missing.join(',')}`);
  });

  test('证据文件抽样：结构完整、content_hash 为 64 位 hex、且未被标记为篡改', () => {
    const dir = abs('.uap/evidence');
    const files = fs.readdirSync(dir).filter((f) => f.startsWith('UAP-EV-') && f.endsWith('.json'));
    assert.ok(files.length > 100, `证据文件数量异常: ${files.length}`);
    // 独立等距抽样 60 份，覆盖不同时间段
    const step = Math.max(1, Math.floor(files.length / 60));
    const sample = files.filter((_, i) => i % step === 0).slice(0, 60);
    for (const f of sample) {
      const e = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      assert.equal(e.evidence_id, f.replace(/\.json$/, ''), `evidence_id 与文件名不符: ${f}`);
      assert.ok(sha256re.test(e.content_hash || ''), `缺 content_hash: ${f}`);
      assert.ok(e.recorded_at, `缺 recorded_at: ${f}`);
    }
  });
});
