/**
 * 把「独立复核路径」注册进 UAP 测试门禁（uap test --all 自动发现）。
 *
 * 该测试本身不实现复核逻辑，而是真实 spawn 独立复核脚本并断言其退出码；
 * 复核脚本不导入任何 UAP 运行时模块，因此修复者无法用自己的结论影响验收。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REVIEW = path.join(ROOT, '.uap', 'engines', 'auto-repair', 'independent-review.mjs');

test('独立复核路径可从磁盘重算哈希并独立重跑定向/回归测试', async () => {
  // 顺序无关性保障：独立复核校验「最新账本绑定当前 git HEAD」（fail-closed，
  // 不可放宽）。任何新提交都会使历史账本过期 —— 因此本测试先通过修复金丝雀
  // （提交态缺陷 fixture）在当前 HEAD 上产生一次真实修复事件（真实引擎、
  // 真实补丁、真实账本，绝不伪造），再复核。
  const { runRealRepair } = await import('../engines/auto-repair/real-code-repair.mjs');
  const canary = '.uap/tests/fixtures/repair-canary.mjs';
  // 恢复金丝雀的提交态缺陷（该 fixture 提交态即缺陷态，不可能含用户 WIP，
  // 此恢复是确定性的，不是破坏性 git 操作）。
  const restore = spawnSync('git', ['checkout', '--', canary], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(restore.status, 0, `金丝雀恢复失败：${restore.stderr}`);
  try {
    const run = await runRealRepair({
      taskFile: path.join(ROOT, '.uap/state/repair-tasks/UAP-CANARY-REPAIR.json'),
      dryRun: false,
    });
    assert.equal(run.status, 'SUCCEEDED', `金丝雀修复未成功：${JSON.stringify(run.blockers)}`);

    // 复核必须发生在「修复后、恢复前」的工作区状态上：review 校验磁盘内容
    // 与账本 after_hash 一致、并重跑账本记录的定向/回归命令（此刻应为绿）。
    const result = spawnSync(process.execPath, [REVIEW], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 300000,
      maxBuffer: 8 * 1024 * 1024,
    });
    const output = `${result.stdout || ''}${result.stderr || ''}`;
    assert.equal(result.status, 0, `独立复核未通过：\n${output.slice(0, 4000)}`);
    const verdict = JSON.parse((result.stdout || '').trim().split('\n').pop());
    assert.equal(verdict.verdict, 'PASS', JSON.stringify(verdict.failures));
    assert.ok(verdict.checks.length >= 10, `复核检查项过少：${verdict.checks.length}`);
    assert.ok(verdict.checks.every((c) => c.ok), JSON.stringify(verdict.checks.filter((c) => !c.ok)));
    assert.ok(verdict.commands.every((c) => c.exit_code === 0), '独立重跑的命令存在失败');
  } finally {
    // 无论成败都恢复提交态（缺陷态），保持工作区干净：下一轮从同一确定性
    // 状态开始。该 fixture 提交态即缺陷态，不可能包含用户 WIP。
    spawnSync('git', ['checkout', '--', canary], { cwd: ROOT });
  }
});
