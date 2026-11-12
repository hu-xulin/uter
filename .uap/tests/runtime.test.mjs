/**
 * UAP Runtime 行为测试集（覆盖 18 类）。
 * 纯测试文件：不修改任何被测源码。单文件串行执行，避免多进程并发读写
 * .uap/state 下共享状态（tasks.json / locks.json）造成 lost update。
 * 所有断言针对运行时真实返回值与真实副作用，不做「文件存在即 PASS」。
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { rootPath } from '../runtime/_lib/paths.mjs';
import { newId, redact, readText, exists, deepEqual } from '../runtime/_lib/util.mjs';
import { CONFIG_NAMES, loadConfig, loadAllConfigs, registryIntegrity, configPath } from '../runtime/_lib/config.mjs';
import { parseYAML, YAMLError } from '../runtime/_lib/yaml.mjs';
import { TASK_STATES, executorResult, validatorResult, finding, assertExecutorResult, ContractError } from '../runtime/_lib/contract.mjs';
import { COMMAND_ALLOWLIST, isCommandAllowed } from '../runtime/_lib/proc.mjs';
import { assertTransition, canTransition, legalNext, transition, IllegalTransitionError } from '../runtime/state-machine/index.mjs';
import { acquire, releaseAll, ResourceConflictError, MAX_CONCURRENCY } from '../runtime/resource-manager/index.mjs';
import { record, get, verify } from '../runtime/evidence-engine/index.mjs';
import { check, auditTrail, deniedDecisions } from '../runtime/policy-engine/index.mjs';
import { createTask, runTask, registerStepHandler, defaultValidator, MAX_RETRIES } from '../runtime/task-engine/index.mjs';
import { topologicalLevels, detectCycle, runGraph } from '../runtime/scheduler/index.mjs';
import { simulateInterruption, inspectRecovery, recover } from '../runtime/recovery-engine/index.mjs';
import { listAgents, invoke, assertTool } from '../runtime/agent-runtime/index.mjs';
import { health as orchestratorHealth } from '../runtime/orchestrator/index.mjs';
import { listWorkflows, stepExecutor, runWorkflow } from '../workflows/index.mjs';
import { financialSimulation } from '../tools/financial-simulation.mjs';
import { normalizeSpecHeaders } from '../tools/normalize-spec-headers.mjs';

const REQUIRED_TASK = {
  objective: 'uap-tester behaviour probe',
  scope: 'runtime/tests',
  specification_ids: ['UAP-00-001'],
  constraints: ['local only'],
  acceptance_criteria: ['real assertions'],
};

function makeTask(extra = {}) {
  return createTask({ ...REQUIRED_TASK, task_id: newId('UAP-TASK-TEST'), ...extra });
}

describe('类别1 Runtime 启动', () => {
  test('orchestrator.health() 返回 10 个组件健康卡且每个组件带结构化 checks', async () => {
    const card = await orchestratorHealth();
    assert.ok(card && typeof card === 'object');
    const names = Object.keys(card.components);
    assert.equal(names.length, 10, '健康卡必须覆盖 10 个核心组件');
    for (const name of names) {
      const c = card.components[name];
      assert.ok(c && typeof c === 'object', `${name} 健康卡应为对象`);
      assert.equal(typeof c.ok, 'boolean', `${name}.ok 应为布尔`);
      assert.ok(c.checks && typeof c.checks === 'object' && !Array.isArray(c.checks), `${name}.checks 应为结构化对象`);
      assert.equal(typeof c.checked_at, 'string');
    }
    assert.ok(names.includes('task-engine') && names.includes('policy-engine') && names.includes('recovery-engine'));
    assert.ok(card.registry && typeof card.registry.checks_total === 'number');
    // 不把「规范/引擎仍在并行建设」误判为 Runtime 缺陷：此处不断言 registry.ok / started。
  });
});

describe('类别2 配置加载', () => {
  test('6 份 YAML 全部可解析且关键键存在', () => {
    assert.equal(CONFIG_NAMES.length, 6);
    const cfg = loadAllConfigs();
    for (const name of CONFIG_NAMES) {
      const c = loadConfig(name);
      assert.ok(c && typeof c === 'object' && Object.keys(c).length > 0, `${name}.yaml 应解析为非空对象`);
      assert.equal(exists(configPath(name)), true);
    }
    assert.ok(Array.isArray(cfg['specification-registry'].specifications) && cfg['specification-registry'].specifications.length > 0);
    assert.ok(Array.isArray(cfg['agent-registry'].agents));
    assert.ok(cfg['permission-policy'].permission_groups && typeof cfg['permission-policy'].permission_groups === 'object');
    assert.equal(cfg['permission-policy'].default_effect, 'deny');
    assert.ok(Array.isArray(cfg['workflow-registry'].workflows));
    assert.ok(Array.isArray(cfg['validator-registry'].validators));
    assert.ok(cfg['execution-mapping'].engines || cfg['execution-mapping'].executor_entries);
  });

  test('parseYAML 拒绝非法输入（重复键 / tab 缩进 / 块标量 / 未闭合流序列）', () => {
    assert.deepEqual(parseYAML('a: 1\nb:\n  c: true'), { a: 1, b: { c: true } });
    assert.throws(() => parseYAML('a: 1\na: 2'), YAMLError);
    assert.throws(() => parseYAML('\tkey: value'), YAMLError);
    assert.throws(() => parseYAML('a: |'), YAMLError);
    assert.throws(() => parseYAML('k: [1, 2'), YAMLError);
  });
});

describe('类别3 规范注册表', () => {
  test('registryIntegrity() 检查数组结构化、含指定检查项、ID 唯一判定与真实数据一致', () => {
    const cfg = loadAllConfigs();
    const r = registryIntegrity(cfg);
    assert.ok(Array.isArray(r.checks) && r.checks.length > 0);
    assert.ok(r.checks.every((c) => typeof c.id === 'string' && ['PASS', 'FAIL'].includes(c.status) && typeof c.detail === 'string'));
    for (const id of ['registry.unique_ids', 'registry.spec_count', 'registry.dependencies_exist', 'registry.dependencies_acyclic', 'policy.fail_closed', 'independence.no_retired_governance_refs']) {
      assert.ok(r.checks.some((c) => c.id === id), `缺少检查项 ${id}`);
    }
    const specs = cfg['specification-registry'].specifications;
    const ids = specs.map((s) => s.id);
    const expected = new Set(ids).size === ids.length ? 'PASS' : 'FAIL';
    assert.equal(r.checks.find((c) => c.id === 'registry.unique_ids').status, expected);
    const acyclic = r.checks.find((c) => c.id === 'registry.dependencies_acyclic');
    assert.ok(['PASS', 'FAIL'].includes(acyclic.status));
    assert.match(acyclic.detail, /cycles =/);
    assert.equal(typeof r.ok, 'boolean');
  });

  test('缺依赖会报 FAIL：注入一个不存在的依赖 id', () => {
    const cfg = loadAllConfigs();
    const specs = cfg['specification-registry'].specifications;
    const injected = specs.map((s, i) => (i === 0
      ? { ...s, dependencies: [...(s.dependencies || []), 'UAP-99-999-NONEXISTENT'] }
      : { ...s }));
    const bad = { ...cfg, 'specification-registry': { ...cfg['specification-registry'], specifications: injected } };
    const r = registryIntegrity(bad);
    const c = r.checks.find((x) => x.id === 'registry.dependencies_exist');
    assert.equal(c.status, 'FAIL');
    assert.match(c.detail, /missing dependency references = 1/);
  });
});

describe('类别4 Agent 注册', () => {
  test('listAgents() 为 11 个；assertTool 拒绝未声明工具；invoke 对未注册 Agent 返回 BLOCKED', async () => {
    const agents = listAgents();
    assert.equal(agents.length, 11);
    assert.equal(new Set(agents.map((a) => a.id)).size, 11);
    assert.equal(assertTool('uap-orchestrator', 'task_engine'), true);
    assert.throws(() => assertTool('uap-orchestrator', '__not_declared_tool__'), /not declared/);
    const out = await invoke('__ghost_agent__', { objective: 'probe' });
    assert.equal(out.status, 'BLOCKED');
    assert.match(out.summary, /not registered/);
    assert.equal(out.evidence_refs.length, 0);
  });
});

describe('类别5 权限拒绝', () => {
  test('高危权限、未注册 Agent、未声明权限、curl 命令全部 DENY；default_effect=deny；DENY 写入 policy-audit.jsonl', () => {
    assert.equal(loadConfig('permission-policy').default_effect, 'deny');
    for (const p of ['production_write', 'real_payment', 'production_deploy']) {
      const d = check({ agent_id: 'uap-development-agent', permission: p, action: 'uap-tester' });
      assert.equal(d.decision, 'DENY', `${p} 必须 DENY`);
      assert.equal(d.allowed, false);
    }
    assert.equal(check({ agent_id: '__ghost__', permission: 'project_read' }).decision, 'DENY');
    assert.equal(check({ agent_id: 'uap-orchestrator', permission: 'product_write' }).decision, 'DENY');
    assert.equal(check({ agent_id: 'uap-development-agent', permission: 'local_command', command: 'curl' }).decision, 'DENY');

    const marker = `uap-tester-deny-${newId('M')}`;
    check({ agent_id: 'uap-development-agent', permission: 'production_write', action: marker });
    const trail = auditTrail(5000);
    assert.ok(trail.some((e) => e.action === marker && e.decision === 'DENY' && e.permission === 'production_write'),
      'DENY 决策必须真实落盘到 policy-audit.jsonl');
    assert.ok(deniedDecisions(5000).length > 0);
  });
});

describe('类别6 任务创建', () => {
  test('createTask() 缺必需字段抛 ContractError；成功任务含 task_id/trace_id/state/steps/history', () => {
    assert.throws(() => createTask({ objective: 'only one field' }), ContractError);
    const t = makeTask({ steps: [{ name: 'step-one', idempotent: true }] });
    for (const k of ['task_id', 'trace_id', 'state', 'steps', 'history']) {
      assert.ok(k in t, `缺少字段 ${k}`);
    }
    assert.equal(t.state, 'CREATED');
    assert.ok(Array.isArray(t.steps) && t.steps.length === 1);
    assert.ok(Array.isArray(t.history) && t.history.length === 0);
    assert.equal(t.steps[0].step_id, 'step-1');
  });
});

describe('类别7 依赖调度', () => {
  test('topologicalLevels() 对 DAG 返回正确层级', () => {
    const dag = [
      { task_id: 'A', dependencies: [] },
      { task_id: 'B', dependencies: ['A'] },
      { task_id: 'C', dependencies: ['A'] },
      { task_id: 'D', dependencies: ['B', 'C'] },
    ];
    assert.deepEqual(topologicalLevels(dag), [['A'], ['B', 'C'], ['D']]);
  });

  test('有环时 detectCycle 返回环信息；registryIntegrity 的 dependencies_acyclic 判 FAIL', () => {
    const cyc = [
      { task_id: 'X', dependencies: ['Y'] },
      { task_id: 'Y', dependencies: ['X'] },
    ];
    const cycle = detectCycle(cyc);
    assert.equal(typeof cycle, 'string');
    assert.match(cycle, /cycle/i);

    const cfg = loadAllConfigs();
    const specs = cfg['specification-registry'].specifications;
    const cycSpecs = specs.map((s, i) => (i === 0 ? { ...s, dependencies: [s.id] } : { ...s }));
    const bad = { ...cfg, 'specification-registry': { ...cfg['specification-registry'], specifications: cycSpecs } };
    const r = registryIntegrity(bad);
    assert.equal(r.checks.find((c) => c.id === 'registry.dependencies_acyclic').status, 'FAIL');
  });
});

describe('类别8 并行执行', () => {
  test('MAX_CONCURRENCY=4；第 5 个并发与重叠写集均抛 ResourceConflictError', () => {
    assert.equal(MAX_CONCURRENCY, 4);
    releaseAll();
    try {
      const ids = ['a', 'b', 'c', 'd', 'e'].map((x) => newId(`UAP-LOCK-${x}`));
      let fifth = null;
      for (const id of ids) {
        try { acquire(id, { files: [] }); } catch (e) { fifth = e; }
      }
      assert.ok(fifth instanceof ResourceConflictError, '第 5 个并发必须抛 ResourceConflictError');
      assert.match(fifth.message, /concurrency limit 4/);
    } finally { releaseAll(); }

    releaseAll();
    try {
      const a = newId('UAP-LOCK-A');
      const b = newId('UAP-LOCK-B');
      acquire(a, { files: ['shared.go'] });
      let conflict = null;
      try { acquire(b, { files: ['shared.go'] }); } catch (e) { conflict = e; }
      assert.ok(conflict instanceof ResourceConflictError, '重叠写集必须抛 ResourceConflictError');
      assert.deepEqual(conflict.conflicts, ['shared.go']);
    } finally { releaseAll(); }
  });

  test('runGraph() 按层级并行并检测重叠写集冲突', async () => {
    releaseAll();
    try {
      const tasks = [
        { task_id: 'A', dependencies: [], files: ['a.go'] },
        { task_id: 'B', dependencies: ['A'], files: ['b.go'] },
        { task_id: 'C', dependencies: ['A'], files: ['b.go'] },
        { task_id: 'D', dependencies: ['B', 'C'], files: ['d.go'] },
      ];
      const out = await runGraph(tasks, async (t) => ({ ran: t.task_id }));
      assert.deepEqual(out.levels, [['A'], ['B', 'C'], ['D']]);
      assert.deepEqual(Object.keys(out.results).sort(), ['A', 'B', 'C', 'D']);
      assert.ok(out.conflicts_found.some((c) => c.file === 'b.go'), 'B/C 重叠写集必须被检测');
      assert.deepEqual(out.results.A, { ran: 'A' });
    } finally { releaseAll(); }
  });
});

describe('类别9 中断恢复', () => {
  test('simulateInterruption 起独立进程在 step2 崩溃(exit 7)；recover 后 SUCCEEDED、已完成步骤不重复、写 2 条证据', async () => {
    const sim = simulateInterruption('idempotent');
    assert.equal(sim.ok, true);
    assert.equal(sim.child_exit_code, 7);
    assert.equal(sim.crashed_mid_step, true);
    assert.ok(sim.task_id && typeof sim.task_id === 'string');

    const before = inspectRecovery(sim.task_id);
    assert.ok(['RUNNING', 'WAITING_RECOVERY'].includes(before.state));
    assert.ok(before.completed_steps.includes('step-1'));
    assert.ok(before.pending_steps.includes('step-2'));

    const out = await recover(sim.task_id);
    assert.equal(out.recovered, true);
    assert.equal(out.task.state, 'SUCCEEDED');
    assert.equal(out.repeated_completed_steps.length, 0);
    assert.equal(out.evidence_refs.length, 2);
    const step1 = out.task.steps.find((s) => s.step_id === 'step-1');
    assert.equal(step1.status, 'SUCCEEDED');
    assert.equal(step1.attempts, 1, '已完成的 step-1 不应被重复执行');
    assert.ok(['step-1', 'step-2', 'step-3'].every((id) => out.task.steps.find((s) => s.step_id === id).status === 'SUCCEEDED'));
    for (const ref of out.evidence_refs) assert.equal(verify(ref).valid, true);
  });
});

describe('类别10 重试上限', () => {
  test('MAX_RETRIES===2；前两次抛错第三次成功时 attempts===3；永远抛错仍 attempts===3 且任务不 SUCCEEDED', async () => {
    assert.equal(MAX_RETRIES, 2);
    registerStepHandler('__uap_test_retry_then_ok__', async ({ attempt }) => {
      if (attempt < 3) throw new Error('transient glitch');
      return { status: 'SUCCEEDED', summary: 'recovered on third attempt' };
    });
    const t1 = makeTask({ steps: [{ name: '__uap_test_retry_then_ok__', idempotent: true }] });
    const r1 = await runTask(t1.task_id);
    assert.equal(r1.task.steps[0].attempts, 3);
    assert.equal(r1.task.state, 'SUCCEEDED');

    registerStepHandler('__uap_test_always_fail__', async () => { throw new Error('always broken'); });
    const t2 = makeTask({ steps: [{ name: '__uap_test_always_fail__', idempotent: true }] });
    const r2 = await runTask(t2.task_id);
    assert.equal(r2.task.steps[0].attempts, 3);
    assert.notEqual(r2.task.state, 'SUCCEEDED');
    assert.equal(r2.task.steps[0].status, 'FAILED');
  });
});

describe('类别11 执行器/验证器映射', () => {
  test('executorResult 强制 validation_results=[]；assertExecutorResult 拒绝自报非空 validation_results', () => {
    const er = executorResult({ task_id: 't', executor_id: 'e', status: 'SUCCEEDED', validation_results: [{ status: 'PASS' }] });
    assert.deepEqual(er.validation_results, []);
    assert.equal(assertExecutorResult(er), true);
    const forged = { ...er, validation_results: [{ status: 'PASS' }] };
    assert.throws(() => assertExecutorResult(forged), ContractError);
  });

  test('validatorResult 在 executed=false / exit_code!==0 / BLOCKER finding 时把 PASS 降为 FAIL', () => {
    assert.equal(validatorResult({ status: 'PASS', executed: true, exit_code: 0, findings: [] }).status, 'PASS');
    assert.equal(validatorResult({ status: 'PASS', executed: false, exit_code: 0, findings: [] }).status, 'FAIL');
    assert.equal(validatorResult({ status: 'PASS', executed: true, exit_code: 1, findings: [] }).status, 'FAIL');
    const withBlocker = validatorResult({ status: 'PASS', executed: true, exit_code: 0, findings: [finding('BLOCKER', 'x', 'y')] });
    assert.equal(withBlocker.status, 'FAIL');
  });
});

describe('类别12 证据完整性', () => {
  test('record 生成 content_hash 且 verify 通过；同 ID 二次写入抛错；redact 脱敏 token', () => {
    const id = newId('UAP-EV-TEST');
    const ev = record({ evidence_id: id, kind: 'uap_tester_probe', command: 'uap test', exit_code: 0, summary: 'immutability probe' });
    assert.equal(ev.evidence_id, id);
    assert.equal(typeof ev.content_hash, 'string');
    assert.equal(ev.content_hash.length, 64);
    assert.equal(get(id).content_hash, ev.content_hash);
    assert.equal(verify(id).valid, true);
    assert.throws(() => record({ evidence_id: id, kind: 'tamper' }), /must not be overwritten|already exists/);
    assert.equal(get(id).kind, 'uap_tester_probe', '原始记录不得被覆盖');

    const secret = 'token: SOMEVALUE123';
    const masked = redact(secret);
    assert.notEqual(masked, secret);
    assert.match(masked, /\[REDACTED\]/);
    assert.equal(masked.includes('SOMEVALUE123'), false);
  });
});

describe('类别13 工作流端到端', () => {
  test('listWorkflows() 为 7 个；stepExecutor 对 validate_environment 返回真实工具链版本与 exit_code', async () => {
    const wfs = listWorkflows();
    assert.equal(wfs.length, 7);
    assert.equal(new Set(wfs.map((w) => w.id)).size, 7);
    const env = await stepExecutor({ task: { task_id: newId('UAP-TASK-TEST') }, step: { name: 'validate_environment' } });
    assert.equal(env.status, 'SUCCEEDED');
    assert.equal(typeof env.outputs.node, 'string');
    assert.match(env.outputs.node, /^v\d/);
    assert.equal(typeof env.outputs.go, 'string');
    assert.equal(typeof env.outputs.bun, 'string');
    assert.equal(env.outputs.exit_codes.length, 3);
    assert.ok(env.outputs.exit_codes.every((c) => typeof c === 'number' || c === null));
    assert.equal(env.commands.length, 3);
    assert.ok(env.evidence_refs.length > 0);
    assert.ok(env.outputs.exit_codes.every((c) => c === 0));
  });

  test('runWorkflow(uap-financial-verification) 返回含 evidence 的 run 记录，state 与内部证据一致', async () => {
    // 选 uap-financial-verification：其 8 个步骤均为只读/记录，不含
    // run_*test*（会 spawn node --test 造成递归）或 lint/build 重活。
    const { run, task } = await runWorkflow('uap-financial-verification', { persist: false });
    assert.ok(run.run_id && run.workflow_id === 'uap-financial-verification');
    assert.equal(run.steps_total, 8);
    assert.ok(Array.isArray(run.evidence_refs) && run.evidence_refs.length > 0);
    assert.ok(TASK_STATES.includes(run.state));
    if (run.state === 'SUCCEEDED') {
      assert.equal(run.steps_succeeded, run.steps_total);
      assert.ok(run.validation.some((v) => v.status === 'PASS'));
      assert.equal((task.blocked_reasons || []).length, 0);
      assert.ok(task.steps.every((s) => s.evidence_refs.length > 0));
    } else {
      // 注册表/报告未齐时允许 BLOCKED/FAILED，但必须带真实原因，绝不伪造 SUCCEEDED。
      const hasRealReason = (task.blocked_reasons || []).length > 0 || run.validation.some((v) => (v.findings || []).length > 0);
      assert.ok(hasRealReason, 'BLOCKED/FAILED 必须带真实 blocked_reasons 或 validation findings');
      assert.ok(run.steps_succeeded < run.steps_total);
    }
  });
});

describe('类别14 安全边界', () => {
  test('12 个 mustDeny 权限组全为 deny；配置无 AES/UAES 引用；COMMAND_ALLOWLIST 不含 curl', () => {
    const groups = loadConfig('permission-policy').permission_groups;
    const mustDeny = ['production_read', 'production_write', 'production_deploy', 'real_payment', 'real_refund', 'secret_export', 'force_push', 'branch_creation', 'branch_switch', 'destructive_git', 'quality_gate_disable', 'test_deletion_to_force_pass'];
    assert.equal(mustDeny.length, 12);
    for (const k of mustDeny) assert.equal(groups[k]?.effect, 'deny', `${k} 必须 deny`);

    const cfgText = CONFIG_NAMES.map((n) => readText(configPath(n))).join('\n');
    const retired = cfgText.match(/\b(?:AES|UAES|uaes|docs\/ai-specs|uaes\/standards)\b/g) || [];
    assert.equal(retired.length, 0, '配置中不得有 AES/UAES 运行时引用');
    assert.ok(registryIntegrity(loadAllConfigs()).checks.some((c) => c.id === 'independence.no_retired_governance_refs'));

    assert.equal(COMMAND_ALLOWLIST.has('curl'), false);
    assert.equal(isCommandAllowed('curl'), false);
    assert.equal(isCommandAllowed('node'), true);
  });
});

describe('类别15 质量门禁阻断', () => {
  test('defaultValidator 对未成功步骤/无证据步骤返回 FAIL；合规任务返回 PASS', () => {
    const unfinished = defaultValidator({ steps: [{ status: 'PENDING', evidence_refs: [] }], history: [], blocked_reasons: [], evidence_refs: [] });
    assert.equal(unfinished.status, 'FAIL');
    assert.ok(unfinished.findings.some((f) => f.code === 'steps_unfinished'));

    const noEvidence = defaultValidator({ steps: [{ status: 'SUCCEEDED', evidence_refs: [] }], history: [], blocked_reasons: [], evidence_refs: [] });
    assert.equal(noEvidence.status, 'FAIL');
    assert.ok(noEvidence.findings.some((f) => f.code === 'step_evidence_missing'));

    const good = defaultValidator({ steps: [{ status: 'SUCCEEDED', evidence_refs: ['ev'] }], history: [], blocked_reasons: [], evidence_refs: ['ev'] });
    assert.equal(good.status, 'PASS');
  });

  test('assertTransition(CREATED,SUCCEEDED) 抛 IllegalTransitionError（fail-closed）', () => {
    assert.throws(() => assertTransition('CREATED', 'SUCCEEDED'), IllegalTransitionError);
    assert.equal(canTransition('CREATED', 'QUEUED'), true);
  });
});

describe('类别16 模拟支付退款', () => {
  test('financialSimulation()：simulated_only=true、>=13 检查、PASS 检查有 evidence 且可追溯真实源码、无真实外部调用', async () => {
    const fin = await financialSimulation();
    assert.equal(fin.simulated_only, true);
    assert.ok(fin.checks.length >= 13);
    assert.ok(fin.checks.every((c) => c.evidence && typeof c.evidence === 'object'), '每项检查必须有 evidence');

    const ids = new Set(fin.checks.map((c) => c.id));
    for (const id of ['payment_success_order_state', 'signature_verification', 'duplicate_refund']) {
      assert.ok(ids.has(id), `缺少真实场景 ${id}`);
    }
    for (const c of fin.checks) {
      if (c.id.startsWith('sim_')) {
        assert.equal(c.evidence.simulated, true, `${c.id} 必须标记为进程内内存模拟`);
        if (c.status === 'PASS') assert.ok(c.evidence.assertions.every((a) => a.exit_code === 0));
      } else if (c.status === 'PASS') {
        assert.equal(typeof c.evidence.file, 'string');
        assert.equal(exists(rootPath(c.evidence.file)), true, `${c.id} 的 evidence.file 必须指向真实源码文件`);
      }
    }
    assert.equal(fin.safety.network_calls, 0);
    assert.equal(fin.safety.database_writes, 0);
    assert.equal(fin.safety.real_payments_or_refunds, 0);

    const src = readText(rootPath('.uap/tools/financial-simulation.mjs'));
    for (const re of [/child_process/, /\bfetch\s*\(/, /\bspawn(?:Sync)?\s*\(/, /runCommand/, /\bhttps?\.(?:request|get)\s*\(/, /\bnet\.connect/]) {
      assert.equal(re.test(src), false, `源码不得出现真实外部调用形态 ${re}`);
    }
  });
});

describe('类别17 自动修复闭环', () => {
  test('normalizeSpecHeaders({dryRun:true}) 返回 scanned/fixed/already_ok/unfixable 且连续两次幂等', () => {
    const r1 = normalizeSpecHeaders({ dryRun: true });
    const r2 = normalizeSpecHeaders({ dryRun: true });
    for (const k of ['scanned', 'fixed', 'already_ok', 'unfixable']) assert.ok(k in r1, `缺少 ${k}`);
    assert.equal(r1.dry_run, true);
    assert.equal(typeof r1.scanned, 'number');
    assert.ok(Array.isArray(r1.fixed) && Array.isArray(r1.already_ok) && Array.isArray(r1.unfixable));
    assert.ok(r1.scanned >= 1);
    // 幂等：排除每次都不同的 generated_at 时间戳后，实质结果必须完全一致。
    const { generated_at: _g1, ...rest1 } = r1;
    const { generated_at: _g2, ...rest2 } = r2;
    assert.equal(deepEqual(rest1, rest2), true, '两次 dry-run 实质结果应完全一致');
    assert.equal(r1.fixed.length, r2.fixed.length);
    assert.equal(r1.unfixable.length, r2.unfixable.length);
  });
});

describe('类别18 状态机', () => {
  test('TASK_STATES 9 个；legalNext(SUCCEEDED) 为空；canTransition(RUNNING,WAITING_RECOVERY)=true；transition 原地更新并追加合法 history', () => {
    assert.equal(TASK_STATES.length, 9);
    assert.deepEqual(legalNext('SUCCEEDED'), []);
    assert.equal(canTransition('RUNNING', 'WAITING_RECOVERY'), true);
    assert.equal(canTransition('CREATED', 'SUCCEEDED'), false);

    const task = { state: 'CREATED', history: [] };
    const ret = transition(task, 'QUEUED', 'accepted');
    assert.equal(ret, task, 'transition 必须原地更新');
    assert.equal(task.state, 'QUEUED');
    assert.equal(task.history.length, 1);
    assert.equal(task.history[0].from, 'CREATED');
    assert.equal(task.history[0].to, 'QUEUED');
    assert.equal(task.history[0].reason, 'accepted');
    assert.equal(task.history[0].at, task.updated_at);
    assert.throws(() => transition(task, 'SUCCEEDED'), IllegalTransitionError);
  });
});
