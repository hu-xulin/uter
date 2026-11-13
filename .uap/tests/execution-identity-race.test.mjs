/**
 * Regression guard for the execution-identity race (UAP §8 evidence binding).
 *
 * Before the fix, `currentExecution()` did an unsynchronised read / decide /
 * write on the shared `.uap/state/current-execution.json`. Running the UAP test
 * suite (node --test runs every test file in its own process) made several
 * workers observe the same stale identity simultaneously and each open a NEW
 * execution within the same millisecond — see the duplicate pairs in
 * `.uap/state/executions.jsonl`, e.g. UAP-EXEC-20261113103145-a1ebf941 and
 * UAP-EXEC-20261113103145-fc85b65b with identical git_head and fingerprint.
 * Evidence produced during one verification run could then be bound to
 * different execution_ids, which silently breaks the evidence chain.
 *
 * These tests never mutate shared state: they only observe that concurrent
 * readers converge on ONE identity that is genuinely bound to the real HEAD.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const HISTORY = path.join(ROOT, '.uap', 'state', 'executions.jsonl');
const PROBE = "import('./.uap/runtime/status-engine/execution.mjs')"
  + ".then(m => console.log(JSON.stringify(m.currentExecution())))";

function parallelIdentities(count) {
  return Promise.all(Array.from({ length: count }, () => new Promise((resolve, reject) => {
    let out = '';
    let err = '';
    const child = spawn(process.execPath, ['-e', PROBE], { cwd: ROOT });
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { err += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, out: out.trim(), err: err.trim() }));
  })));
}

test('真并发下所有进程必须收敛到唯一执行身份', async () => {
  const results = await parallelIdentities(8);
  for (const r of results) {
    assert.equal(r.code, 0, `worker failed: ${r.err}`);
  }
  const identities = results.map((r) => JSON.parse(r.out));
  const realHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  for (const e of identities) {
    assert.match(e.execution_id, /^UAP-EXEC-/);
    assert.equal(e.git_head, realHead, '执行身份必须绑定真实 HEAD');
    assert.match(e.worktree_fingerprint || '', /^[0-9a-f]{64}$/);
  }
  // 身份是 (HEAD, worktree_fingerprint) 的函数。并行期间若其他测试真的
  // 改动了业务代码，出现多个版本是合法的；但同一版本绝不允许出现两个
  // 执行身份 —— 那正是修复前的竞态（账本里同一秒、同一指纹的重复条目）。
  const byVersion = new Map();
  for (const e of identities) {
    if (!byVersion.has(e.worktree_fingerprint)) byVersion.set(e.worktree_fingerprint, new Set());
    byVersion.get(e.worktree_fingerprint).add(e.execution_id);
  }
  assert.ok(byVersion.size > 0);
  for (const [fp, ids] of byVersion) {
    assert.equal(ids.size, 1,
      `同一代码版本 ${fp.slice(0, 12)} 出现了 ${ids.size} 个执行身份: ${[...ids].join(', ')}`);
  }
});

test('并发返回的身份确实存在于 append-only 执行账本中', async () => {
  const results = await parallelIdentities(4);
  const id = JSON.parse(results[0].out).execution_id;
  const ledger = fs.readFileSync(HISTORY, 'utf8').trim().split('\n').filter(Boolean)
    .map((line) => JSON.parse(line));
  const matches = ledger.filter((e) => e.execution_id === id);
  assert.equal(matches.length, 1, `账本中 ${id} 出现 ${matches.length} 次`);
  assert.equal(results.every((r) => r.code === 0), true);
});
