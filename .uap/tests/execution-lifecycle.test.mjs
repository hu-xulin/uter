/**
 * Execution lifecycle / interrupt-recovery tests (directive §十, defect
 * STALE-RUNNING-EXECUTIONS).
 *
 * The audit found executions.jsonl full of RUNNING batches that were never
 * closed (interrupted / superseded), i.e. fake live state. These tests prove the
 * append-only closure ledger + reconcile recovery close every orphaned RUNNING
 * execution while NEVER touching the current one, idempotently, without deleting
 * or reordering history. Fully hermetic: every test injects a temp stateDir and
 * never writes the real .uap/state.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  executionHistory, closeExecution, reconcileExecutions,
  completeExecution, cancelExecution, EXECUTION_TERMINAL_STATUSES,
} from '../runtime/status-engine/execution.mjs';

function freshState() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uap-exec-lifecycle-'));
  return dir;
}
function writeLedger(dir, entries, currentId) {
  fs.writeFileSync(path.join(dir, 'executions.jsonl'), entries.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
  const cur = entries.find((e) => e.execution_id === currentId);
  if (cur) fs.writeFileSync(path.join(dir, 'current-execution.json'), JSON.stringify(cur, null, 2), 'utf8');
}
function entry(id, fp = 'a'.repeat(64)) {
  return { execution_id: id, git_head: 'h'.repeat(40), worktree_fingerprint: fp, environment_fingerprint: 'e'.repeat(64), started_at: '2026-11-13T01:00:00.000Z', status: 'RUNNING' };
}
function withState(fn) {
  const dir = freshState();
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const closureLines = (dir) => {
  const f = path.join(dir, 'execution-closures.jsonl');
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean) : [];
};

test('L1 closeExecution 追加终态闭环，executionHistory 反映有效状态，原始账本不被改写', () => {
  withState((dir) => {
    const e = entry('UAP-EXEC-A');
    writeLedger(dir, [e], 'UAP-EXEC-A');
    const before = fs.readFileSync(path.join(dir, 'executions.jsonl'), 'utf8');
    const c = closeExecution('UAP-EXEC-A', 'COMPLETED', 'done', { stateDir: dir });
    assert.equal(c.final_status, 'COMPLETED');
    // Start ledger is immutable.
    assert.equal(fs.readFileSync(path.join(dir, 'executions.jsonl'), 'utf8'), before);
    const hist = executionHistory({ stateDir: dir });
    assert.equal(hist.length, 1);
    assert.equal(hist[0].status, 'COMPLETED');
    assert.equal(hist[0].closure_reason, 'done');
    assert.ok(hist[0].closed_at);
  });
});

test('L2 closeExecution 幂等：重复关闭不产生第二条闭环记录', () => {
  withState((dir) => {
    writeLedger(dir, [entry('UAP-EXEC-A')], 'UAP-EXEC-A');
    const first = closeExecution('UAP-EXEC-A', 'COMPLETED', 'first', { stateDir: dir });
    const second = closeExecution('UAP-EXEC-A', 'ABORTED', 'second', { stateDir: dir });
    assert.deepEqual(second, first, '已关闭的执行不得被再次关闭/覆盖');
    assert.equal(closureLines(dir).length, 1);
    assert.equal(executionHistory({ stateDir: dir })[0].status, 'COMPLETED');
  });
});

test('L3 reconcileExecutions 关闭所有孤儿 RUNNING，但绝不关闭当前身份', () => {
  withState((dir) => {
    const cur = entry('UAP-EXEC-CURRENT', 'c'.repeat(64));
    writeLedger(dir, [entry('UAP-EXEC-OLD1'), entry('UAP-EXEC-OLD2'), cur], 'UAP-EXEC-CURRENT');
    const r = reconcileExecutions({ stateDir: dir });
    assert.equal(r.closed.length, 2);
    assert.equal(r.current_execution_id, 'UAP-EXEC-CURRENT');
    const hist = executionHistory({ stateDir: dir });
    const byId = Object.fromEntries(hist.map((e) => [e.execution_id, e]));
    assert.equal(byId['UAP-EXEC-OLD1'].status, 'SUPERSEDED');
    assert.equal(byId['UAP-EXEC-OLD2'].status, 'SUPERSEDED');
    assert.equal(byId['UAP-EXEC-CURRENT'].status, 'RUNNING', '当前身份必须保持 RUNNING');
    // 账本条目数量与顺序不变（append-only，不删除/重排）。
    assert.deepEqual(hist.map((e) => e.execution_id), ['UAP-EXEC-OLD1', 'UAP-EXEC-OLD2', 'UAP-EXEC-CURRENT']);
  });
});

test('L4 reconcileExecutions 幂等：第二次运行不再关闭任何执行', () => {
  withState((dir) => {
    writeLedger(dir, [entry('UAP-EXEC-OLD'), entry('UAP-EXEC-CUR', 'c'.repeat(64))], 'UAP-EXEC-CUR');
    const r1 = reconcileExecutions({ stateDir: dir });
    assert.equal(r1.closed.length, 1);
    const r2 = reconcileExecutions({ stateDir: dir });
    assert.equal(r2.closed.length, 0);
    assert.equal(closureLines(dir).length, 1);
  });
});

test('L5 reconcileExecutions 不触碰已是终态的账本条目', () => {
  withState((dir) => {
    const old = entry('UAP-EXEC-OLD');
    writeLedger(dir, [old, entry('UAP-EXEC-CUR', 'c'.repeat(64))], 'UAP-EXEC-CUR');
    closeExecution('UAP-EXEC-OLD', 'ABORTED', 'crashed', { stateDir: dir });
    const r = reconcileExecutions({ stateDir: dir });
    assert.equal(r.closed.length, 0, '已 ABORTED 的执行不得被改写为 SUPERSEDED');
    assert.equal(executionHistory({ stateDir: dir }).find((e) => e.execution_id === 'UAP-EXEC-OLD').status, 'ABORTED');
  });
});

test('L6 completeExecution / cancelExecution 关闭当前身份为 COMPLETED / CANCELLED', () => {
  withState((dir) => {
    writeLedger(dir, [entry('UAP-EXEC-CUR')], 'UAP-EXEC-CUR');
    const done = completeExecution('COMPLETED', 'acceptance-finished', { stateDir: dir });
    assert.equal(done.execution_id, 'UAP-EXEC-CUR');
    assert.equal(done.final_status, 'COMPLETED');
    assert.equal(executionHistory({ stateDir: dir })[0].status, 'COMPLETED');
  });
  withState((dir) => {
    writeLedger(dir, [entry('UAP-EXEC-CUR')], 'UAP-EXEC-CUR');
    const c = cancelExecution('operator-cancel', { stateDir: dir });
    assert.equal(c.final_status, 'CANCELLED');
    assert.equal(executionHistory({ stateDir: dir })[0].status, 'CANCELLED');
  });
});

test('L7 非法终态被拒绝；终态集合完整', () => {
  withState((dir) => {
    writeLedger(dir, [entry('UAP-EXEC-A')], 'UAP-EXEC-A');
    assert.throws(() => closeExecution('UAP-EXEC-A', 'PASS', 'bogus', { stateDir: dir }), /invalid terminal status/);
    assert.throws(() => closeExecution('UAP-EXEC-A', 'RUNNING', 'bogus', { stateDir: dir }), /invalid terminal status/);
    assert.equal(closureLines(dir).length, 0);
    for (const s of ['COMPLETED', 'SUPERSEDED', 'ABORTED', 'CANCELLED', 'FAILED']) {
      assert.ok(EXECUTION_TERMINAL_STATUSES.includes(s), `${s} 必须是合法终态`);
    }
  });
});

test('L8 无当前身份时 reconcile 关闭全部 RUNNING（崩溃后无 current-execution.json）', () => {
  withState((dir) => {
    // 只有账本，没有 current-execution.json：模拟进程崩溃后遗留的假运行状态。
    fs.writeFileSync(path.join(dir, 'executions.jsonl'), [entry('UAP-EXEC-X'), entry('UAP-EXEC-Y')].map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
    const r = reconcileExecutions({ stateDir: dir });
    assert.equal(r.closed.length, 2);
    assert.equal(r.current_execution_id, null);
    assert.ok(executionHistory({ stateDir: dir }).every((e) => e.status === 'SUPERSEDED'));
  });
});

test('L9 preserveExecutionId 保护本进程刚开启的身份，即使 CURRENT 已被并发写者移动', () => {
  withState((dir) => {
    // 并发场景：本进程刚开启 MINE，但另一进程已把 CURRENT 移到 OTHER。
    // reconcile 必须保留 MINE（调用方显式指定），绝不把它关闭。
    const mine = entry('UAP-EXEC-MINE', 'm'.repeat(64));
    const other = entry('UAP-EXEC-OTHER', 'o'.repeat(64));
    writeLedger(dir, [entry('UAP-EXEC-OLD'), mine, other], 'UAP-EXEC-OTHER');
    const r = reconcileExecutions({ stateDir: dir, preserveExecutionId: 'UAP-EXEC-MINE' });
    const byId = Object.fromEntries(executionHistory({ stateDir: dir }).map((e) => [e.execution_id, e]));
    assert.equal(byId['UAP-EXEC-MINE'].status, 'RUNNING', '本进程开启的身份必须保持 RUNNING');
    assert.equal(byId['UAP-EXEC-OLD'].status, 'SUPERSEDED');
    assert.equal(byId['UAP-EXEC-OTHER'].status, 'SUPERSEDED', '非保留的孤儿（含已移动的 CURRENT）应被关闭');
    assert.ok(r.closed.every((c) => c.execution_id !== 'UAP-EXEC-MINE'));
    // 不指定 preserveExecutionId 时回退到 CURRENT（OTHER）。OTHER 已终态被跳过，
    // 唯一仍 RUNNING 的 MINE 此时不再是 current，故被关闭——证明回退语义正确。
    const r2 = reconcileExecutions({ stateDir: dir });
    assert.deepEqual(r2.closed.map((c) => c.execution_id), ['UAP-EXEC-MINE']);
    assert.ok(executionHistory({ stateDir: dir }).every((e) => e.status === 'SUPERSEDED'));
  });
});