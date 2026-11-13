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

test('独立复核路径可从磁盘重算哈希并独立重跑定向/回归测试', () => {
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
});
