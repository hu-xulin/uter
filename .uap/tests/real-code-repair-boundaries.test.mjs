/**
 * 真实代码修复引擎的边界/反向测试（UAP 1.0 §4.3 / §4.5 / §9.3）。
 *
 * 使用真实 Uter 路径与真实修复产物，不构造假 PASS：
 *   - 权限分级：普通业务代码 AUTO_ALLOW，支付/退款/密钥/部署/迁移/认证一律非自动。
 *   - 缺陷不成立时 fail-closed 拒绝修复（不制造假闭环）。
 *   - 最大尝试次数有硬上限（任务声明 99 也封顶 5）。
 *   - 修复产物：证据哈希有效且绑定当前 execution；回滚备份哈希可复原。
 *   - 未触碰任何敏感路径。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { classifyPath, runRealRepair } = await import('../engines/auto-repair/real-code-repair.mjs');
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('权限分级：真实 Uter 敏感路径一律不得自动修改', () => {
  const cases = [
    ['common/request_path.go', 'AUTO_ALLOW'],
    ['controller/topup_wechat.go', 'DENY'],
    ['service/wechat_query.go', 'DENY'],
    ['common/quota.go', 'FINANCIAL_REVIEW'],
    ['controller/oauth.go', 'SECURITY_REVIEW'],
    ['db/migration/0001_init.go', 'DATA_SAFETY_REVIEW'],
    ['deploy/nginx/uter.ai.conf', 'DENY'],
    ['.env', 'DENY'],
    ['secrets/prod.yaml', 'DENY'],
  ];
  for (const [file, expected] of cases) {
    const result = classifyPath(file);
    assert.equal(result.level, expected, `${file} → ${result.level}, 期望 ${expected}`);
    if (expected !== 'AUTO_ALLOW') assert.equal(result.auto_allow, false, `${file} 必须 fail-closed`);
  }
});

test('权限分级：普通业务代码自动允许，敏感路径必须 fail-closed', () => {
  assert.equal(classifyPath('common/copy.go').auto_allow, true);
  assert.equal(classifyPath('common/request_path.go').auto_allow, true);
  assert.equal(classifyPath('controller/topup_wechat.go').auto_allow, false);
  assert.equal(classifyPath('deploy/nginx/uter.ai.conf').level, 'DENY');
});

test('WIP 保护：目标文件存在未提交修改时必须拒绝修复（真实脏文件）', async () => {
  const task = JSON.parse(read('.uap/state/repair-tasks/UAP-REAL-REPAIR-001.json'));
  task.task_id = 'UAP-NEG-WIP';
  const taskFile = path.join(ROOT, '.uap/state/repair-tasks/UAP-NEG-WIP.json');
  const targetAbs = path.join(ROOT, task.patch.file);
  // 该负向用例此前假定 common/request_path.go 天然带未提交修改；历史缺陷被
  // 修复并落库后文件变干净，WIP 分支永远走不到，引擎会在更后面的「复现
  // 测试已通过」处终止，导致用例红。这里改为真实制造一个临时脏文件，
  // 并用 Buffer 快照精确还原，既不依赖历史状态、也不覆盖任何用户 WIP。
  const original = fs.readFileSync(targetAbs);
  fs.writeFileSync(taskFile, `${JSON.stringify(task, null, 2)}\n`, 'utf8');
  fs.appendFileSync(targetAbs, '\n// UAP WIP-protection negative test marker (restored in finally)\n', 'utf8');
  const before = sha256(read(task.patch.file));
  const cleanProbe = spawnSync('git', ['status', '--short', '--', task.patch.file],
    { cwd: ROOT, encoding: 'utf8' });
  assert.ok((cleanProbe.stdout || '').trim(), '前置条件：目标文件必须确实处于未提交修改状态');
  try {
    const run = await runRealRepair({ taskFile, dryRun: false });
    assert.equal(run.status, 'BLOCKED', JSON.stringify(run.blockers));
    assert.ok(run.blockers.join(' ').includes('USER_WIP_PROTECTED'), run.blockers.join(' '));
    assert.equal(sha256(read(task.patch.file)), before, '禁止覆盖用户/前序未提交修改');
  } finally {
    fs.writeFileSync(targetAbs, original);
    fs.unlinkSync(taskFile);
  }
});

test('缺陷不成立时 fail-closed：复现测试已通过则拒绝制造假修复闭环', async () => {
  const task = JSON.parse(read('.uap/state/repair-tasks/UAP-REAL-REPAIR-001.json'));
  // 换用一个干净的业务文件作为补丁目标，隔离掉 WIP 保护，才能走到
  // 「复现测试在修复前已通过」这一分支（真实已修复状态）。
  task.task_id = 'UAP-NEG-NO-DEFECT';
  task.patch.file = 'common/copy.go';
  task.scope.allowed_paths = ['common/copy.go'];
  const taskFile = path.join(ROOT, '.uap/state/repair-tasks/UAP-NEG-NO-DEFECT.json');
  fs.writeFileSync(taskFile, `${JSON.stringify(task, null, 2)}\n`, 'utf8');
  const before = sha256(read('common/copy.go'));
  try {
    const run = await runRealRepair({ taskFile, dryRun: false });
    assert.equal(run.status, 'BLOCKED', JSON.stringify(run.blockers));
    assert.ok(run.blockers.join(' ').includes('复现测试在修复前已通过'), run.blockers.join(' '));
    assert.equal(run.independent_review.exit_code, null, '不得产生任何复核结论');
    assert.equal(sha256(read('common/copy.go')), before, '被拒绝时不得改动业务文件');
    // 成功运行的报告不得被失败运行覆盖。
    assert.equal(JSON.parse(read('.uap/state/repair-tasks/UAP-REAL-REPAIR-001.result.json')).status, 'SUCCEEDED');
  } finally {
    fs.unlinkSync(taskFile);
  }
});

test('有界重试：任务声明 99 次仍被硬上限封顶，且不会无限循环', async () => {
  const tmpDir = path.join(ROOT, '.uap/state/repair-tasks');
  const tmpFile = path.join(tmpDir, 'UAP-BOUNDARY-TMP.json');
  const task = JSON.parse(read('.uap/state/repair-tasks/UAP-REAL-REPAIR-001.json'));
  task.task_id = 'UAP-BOUNDARY-TMP';
  task.limits = { ...task.limits, max_attempts: 99 };
  fs.writeFileSync(tmpFile, `${JSON.stringify(task, null, 2)}\n`, 'utf8');
  try {
    const run = await runRealRepair({ taskFile: tmpFile, dryRun: false });
    assert.equal(run.max_attempts, 5, '硬上限必须生效');
    assert.ok(run.attempts <= run.max_attempts);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test('真实修复产物：证据哈希有效、绑定当前 execution、回滚备份可复原', () => {
  const run = JSON.parse(read('.uap/state/repair-tasks/UAP-REAL-REPAIR-001.result.json'));
  assert.equal(run.status, 'SUCCEEDED');
  assert.equal(run.attempts, 1);
  assert.equal(run.independent_review.exit_code, 0);
  assert.equal(run.blockers.length, 0);
  assert.ok(run.evidence_ids.length >= 5);

  for (const id of run.evidence_ids) {
    const rec = JSON.parse(read(`.uap/evidence/${id}.json`));
    const expected = crypto.createHash('sha256')
      .update(JSON.stringify({ ...rec, content_hash: null })).digest('hex');
    assert.equal(rec.content_hash, expected, `证据哈希不匹配：${id}`);
    assert.equal(rec.execution?.binding_status, 'BOUND', `证据未绑定 execution：${id}`);
    assert.equal(rec.git_head, run.git_head);
  }

  const ledger = JSON.parse(read(run.ledger_path));
  assert.equal(sha256(read(run.target_file)), ledger.after_hash);
  assert.equal(sha256(read(ledger.backup_path)), ledger.before_hash);
  assert.notEqual(ledger.before_hash, ledger.after_hash, '业务代码必须真实发生变化');
  assert.ok(ledger.commands.length >= 4 && ledger.commands.every((c) => c.exit_code === 0));
  assert.deepEqual(ledger.modified_files, ['common/request_path.go']);
  assert.ok(ledger.modified_files.every((f) => !/(payment|refund|secret|\.env|migration|auth)/i.test(f)));
});

test('独立复核脚本与修复账本：真实磁盘重算全部通过', () => {
  const run = JSON.parse(read('.uap/state/repair-tasks/UAP-REAL-REPAIR-001.result.json'));
  const checks = JSON.parse(read('.uap/state/repair-ledger/' + path.basename(run.ledger_path)));
  assert.equal(checks.status, 'TESTS_PASSED');
  assert.ok(checks.attempts <= checks.max_attempts);
});
