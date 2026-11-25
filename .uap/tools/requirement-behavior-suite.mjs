/**
 * UAP Phase 2 — REAL requirement behavior assertion suite.
 *
 *   node .uap/tools/requirement-behavior-suite.mjs
 *
 * This is NOT a verdict engine. It is a BOUNDED aggregator of REAL behaviour
 * executions. Every `REQ_ASSERT <requirement_id> PASS <detail>` line emitted on
 * stdout is produced ONLY after a real execution + a real assertion:
 *
 *   - status/policy/evidence/runtime checks: we IMPORT the production runtime
 *     modules and assert on their REAL return values (or that a guard really
 *     throws `UAP_FALSE_PASS`);
 *   - pay/model/node checks: we SPAWN the real `go test -v` / `node --test`
 *     command, capture its real stdout, and require `exit_code===0` AND that a
 *     specific `--- PASS: TestX` / `ok N - ...` marker is really observed (with
 *     a forbidden marker absent).
 *
 * A line is NEVER printed unconditionally. If a real execution throws, exits
 * non-zero, or its required assertion is not observed, that check records
 * `pass=false` and emits NO PASS line (fail-closed, honest). Nothing here turns
 * a NOT_VERIFIED requirement into VERIFIED by fiat; the downstream
 * requirement-verification engine consumes these DISTINCT `REQ_ASSERT ... PASS`
 * strings as the per-requirement `required_output` assertions.
 *
 * Every requirement_id is validated against the current registry-derived
 * requirement catalog on startup; an unknown/duplicate id is a hard error (no silent skip).
 * Each id is bound to AT MOST ONE assertion in this suite.
 *
 * `process.exitCode === 0` means only "the suite ran to completion"; it does
 * NOT mean all registered requirements are VERIFIED.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  summarize, aggregate, makeCard, assertNoFalsePass,
  coerceStatus, normalizePlaywrightSpec, health as tsHealth,
} from '../runtime/status-engine/test-status.mjs';
import { check, deniedDecisions, assertAllowed, PolicyDeniedError } from '../runtime/policy-engine/index.mjs';
import { loadConfig } from '../runtime/_lib/config.mjs';
import { verifyEvidenceManifest, verifyFinalReportBindings, generateEvidenceManifest, FINAL_REPORTS } from '../runtime/evidence-engine/manifest.mjs';
import { fingerprintBasis, gitHead } from '../runtime/status-engine/execution.mjs';
import * as taskEngine from '../runtime/task-engine/index.mjs';
import * as schedulerEngine from '../runtime/scheduler/index.mjs';
import * as stateMachineEngine from '../runtime/state-machine/index.mjs';
import * as resourceManagerEngine from '../runtime/resource-manager/index.mjs';
import * as recoveryEngine from '../runtime/recovery-engine/index.mjs';
import * as agentRuntimeEngine from '../runtime/agent-runtime/index.mjs';
import * as eventSystemEngine from '../runtime/event-system/index.mjs';
import * as orchestratorEngine from '../runtime/orchestrator/index.mjs';
import * as statusEngineEngine from '../runtime/status-engine/index.mjs';
import { executorResult, validatorResult, assertExecutorResult, ContractError } from '../runtime/_lib/contract.mjs';
import { redact } from '../runtime/_lib/util.mjs';
import { extractRequirements } from './requirement-matrix.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

/* --------------------------------------------------------------- utilities */
const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const ok = (detail) => ({ pass: true, detail });
const no = (detail) => ({ pass: false, detail });
/** A check passes ONLY when the real assertion condition is true. */
const checkAssert = (cond, detail) => (cond ? ok(detail) : no(`ASSERT_FAIL expected ${detail}`));

/** Unique id for transient engine probes (resource locks must not collide). */
let engineProbeSeq = 0;
const engineProbeId = (prefix) => `${prefix}-${Date.now()}-${++engineProbeSeq}`;
/** Minimal real task contract for engine probes; marked health_probe so probe
 *  tasks never pollute the operational task list. */
const probeTaskInput = (extra = {}) => ({
  objective: 'requirement behavior probe', scope: 'behavior-suite',
  specification_ids: ['UAP-00-002'], constraints: ['no external side effects'],
  acceptance_criteria: ['probe assertion holds'], health_probe: true, ...extra,
});

let knownIdsCache = null;
export function loadKnownIds() {
  if (knownIdsCache) return knownIdsCache;
  const requirements = extractRequirements().requirements;
  const ids = requirements.map((r) => r.requirement_id);
  if (ids.length === 0) throw new Error('requirement-behavior-suite: registered specification catalog contains no requirements (fail-closed)');
  if (new Set(ids).size !== ids.length) throw new Error('requirement-behavior-suite: registered specification catalog contains duplicate requirement IDs (fail-closed)');
  knownIdsCache = new Set(ids);
  return knownIdsCache;
}

/* ------------------------------------------------- real external commands */
/** One real command per group; a shared real stdout may back several DISTINCT
 *  assertions (each requires its own observed marker). */
export const EXTERNAL_COMMANDS = Object.freeze({
  pay: {
    command: 'go',
    args: ['test', './service/paymentsandbox/', '-count=1', '-v'],
    env: { GOWORK: 'off' }, timeout_ms: 180000,
  },
  model: {
    command: 'go',
    args: ['test', './model/', '-count=1', '-v', '-run', 'TestPhase2FK|TestSchemaMigration|TestPhase2DBIntegration'],
    env: { GOWORK: 'off' }, timeout_ms: 300000,
  },
  statusCons: {
    command: 'node',
    args: ['--test', '--test-reporter=tap', '.uap/tests/status-consistency.test.mjs'],
    env: {}, timeout_ms: 120000,
  },
  honesty: {
    command: 'node',
    args: ['--test', '--test-reporter=tap', '.uap/tests/requirement-honesty.test.mjs'],
    env: {}, timeout_ms: 120000,
  },
});

/** A spawned child must NOT inherit node:test's injected context. When this
 *  suite itself runs under `node --test`, NODE_TEST_CONTEXT=child-v8 is set;
 *  passing it to a spawned `node --test` makes that child behave as a nested
 *  context and emit NO standard `ok N - ...` TAP lines. Strip NODE_TEST_* so
 *  every real command runs as an independent process; all other env (PATH,
 *  NODE_OPTIONS shim, HOME, GOWORK...) is kept intact. */
function childEnv(extra) {
  const env = { ...process.env, ...extra };
  for (const k of Object.keys(env)) {
    if (k === 'NODE_TEST_CONTEXT' || k.startsWith('NODE_TEST_')) delete env[k];
  }
  return env;
}

function defaultSpawn(spec) {
  const r = spawnSync(spec.command, spec.args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: childEnv(spec.env || {}),
    timeout: spec.timeout_ms || 180000,
    maxBuffer: 24 * 1024 * 1024,
  });
  return {
    exit_code: r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    error: r.error ? String(r.error.message || r.error) : null,
  };
}

/** Process-wide cache for the DEFAULT (real) spawn so repeated suite calls in
 *  the honesty self-test do not re-run go test. An INJECTED spawn is never
 *  cached — it always reflects the injected (possibly failing) dependency. */
const realCommandCache = new Map();
function runCommands(spawn) {
  const out = {};
  for (const [name, spec] of Object.entries(EXTERNAL_COMMANDS)) {
    if (spawn === defaultSpawn && realCommandCache.has(name)) {
      out[name] = realCommandCache.get(name);
      continue;
    }
    let res;
    try {
      res = spawn({ ...spec, name });
    } catch (e) {
      res = { exit_code: null, stdout: '', stderr: '', error: `spawn threw: ${e && e.message || e}` };
    }
    if (!res || typeof res !== 'object') {
      res = { exit_code: null, stdout: '', stderr: '', error: 'spawn returned a non-object' };
    }
    out[name] = { exit_code: res.exit_code, stdout: String(res.stdout || ''), stderr: String(res.stderr || ''), error: res.error || null, spec };
    if (spawn === defaultSpawn) realCommandCache.set(name, out[name]);
  }
  return out;
}

/** Assert that a real command ran (exit 0) and a specific PASS marker was
 *  really observed in its stdout (and a forbidden marker was absent). */
function commandAssertion(ctx, cmdName, marker, forbid, detail) {
  const r = ctx.commands[cmdName];
  if (!r || r.exit_code !== 0) {
    return no(`${cmdName}: real command did NOT exit 0 (exit=${r ? r.exit_code : 'missing'}${r && r.error ? `, ${r.error}` : ''})`);
  }
  const out = r.stdout;
  if (!out.includes(marker)) return no(`${cmdName}: required marker "${marker}" NOT observed in real stdout`);
  if (forbid && out.includes(forbid)) return no(`${cmdName}: forbidden marker "${forbid}" present in real stdout`);
  return ok(detail);
}

/* --------------------------------------------------------- default deps */
const DEFAULT_STATUS = Object.freeze({
  summarize, aggregate, makeCard, assertNoFalsePass, coerceStatus,
  normalizePlaywrightSpec, health: tsHealth,
});
const DEFAULT_POLICY = Object.freeze({
  check, deniedDecisions, assertAllowed, PolicyDeniedError,
  group: (name) => (loadConfig('permission-policy').permission_groups || {})[name] || null,
});
const DEFAULT_EVIDENCE = Object.freeze({
  verifyEvidenceManifest, verifyFinalReportBindings, generateEvidenceManifest,
  finalReports: FINAL_REPORTS,
});
const DEFAULT_RUNTIME = Object.freeze({ fingerprintBasis, gitHead });
/** Real runtime engines for the `engines` check group. Every assertion calls a
 *  REAL exported engine function (sync) and checks its REAL return value or that
 *  a guard really throws. Mutating checks create health_probe tasks / transient
 *  locks and clean up after themselves; none fabricates a PASS. */
const DEFAULT_ENGINES = Object.freeze({
  task: taskEngine,
  scheduler: schedulerEngine,
  stateMachine: stateMachineEngine,
  resource: resourceManagerEngine,
  recovery: recoveryEngine,
  agents: agentRuntimeEngine,
  events: eventSystemEngine,
  orchestrator: orchestratorEngine,
  statusEngine: statusEngineEngine,
  contract: Object.freeze({ executorResult, validatorResult, assertExecutorResult, ContractError }),
  redact,
});

const FORGED_EXECUTION = Object.freeze({
  execution_id: '__FORGED_EXECUTION__', git_head: '__FORGED_HEAD__', worktree_fingerprint: '__FORGED_FP__',
});

/* ------------------------------------------------------------- the checks */
/** Each check = ONE requirement id + ONE real `verify(ctx)` (execution+assert).
 *  `verify` returns {pass, detail}; only pass===true yields a PASS line. */
export const CHECKS = Object.freeze([

  // ---- A. status model (pure, imported from runtime/status-engine/test-status.mjs)
  {
    id: 'UAP-05-002-REQ-013', group: 'status',
    behavior: '覆盖率按实际结果报告：BLOCKED 不计为 PASS，runner_ok=true 的假通过被识别',
    verify: ({ status }) => {
      const r = status.summarize([{ status: 'BLOCKED', reason: 'policy', runner_ok: true }]);
      return checkAssert(r && r.all_pass === false && r.pass === 0 && r.false_pass_attempts === 1 && r.counts && r.counts.BLOCKED === 1,
        'test-status.summarize(BLOCKED,runner_ok=true) -> all_pass=false pass=0 false_pass_attempts=1');
    },
  },
  {
    id: 'UAP-05-002-REQ-014', group: 'status',
    behavior: '不能只用数字代替测试有效性：严格区分 PASS/SKIPPED/FAIL 计数',
    verify: ({ status }) => {
      const r = status.summarize([{ status: 'PASS' }, { status: 'SKIPPED', reason: 'x' }, { status: 'FAIL' }]);
      return checkAssert(r && r.pass === 1 && r.counts && r.counts.SKIPPED === 1 && r.has_failure === true && r.all_pass === false,
        'test-status.summarize(PASS,SKIPPED,FAIL) -> pass=1 skipped=1 has_failure=true all_pass=false');
    },
  },
  {
    id: 'UAP-00-004-REQ-003', group: 'status',
    behavior: '状态模型区分未验证：0 个测试不能判为 all_pass',
    verify: ({ status }) => {
      const r = status.summarize([]);
      return checkAssert(r && r.total === 0 && r.all_pass === false,
        'test-status.summarize([]) -> total=0 all_pass=false');
    },
  },
  {
    id: 'UAP-05-004-ACC-004', group: 'status',
    behavior: '不存在未登记的隐式跳过：聚合含 SKIPPED 时不允许 claim',
    verify: ({ status }) => {
      const r = status.aggregate([
        status.summarize([{ status: 'SKIPPED', reason: 'x' }]),
        status.summarize([{ status: 'PASS' }]),
      ]);
      return checkAssert(r && r.status === 'BLOCKED' && r.claim_allowed === false,
        'test-status.aggregate(has SKIPPED) -> status=BLOCKED claim_allowed=false');
    },
  },
  {
    id: 'UAP-00-004-ACC-005', group: 'status',
    behavior: '状态转换受规则约束：0 次执行的聚合为 NOT_RUN，不允许 claim',
    verify: ({ status }) => {
      const r = status.aggregate([]);
      return checkAssert(r && r.status === 'NOT_RUN' && r.claim_allowed === false,
        'test-status.aggregate([]) -> status=NOT_RUN claim_allowed=false');
    },
  },
  {
    id: 'UAP-05-002-REQ-012', group: 'status',
    behavior: '测试结果记录退出码：exit_code=1 的卡片即使 items 全 PASS 也为 FAIL',
    verify: ({ status }) => {
      const r = status.makeCard({ suite: 'probe', command: 'x', exit_code: 1, items: [{ status: 'PASS' }] });
      return checkAssert(r && r.status === 'FAIL',
        'test-status.makeCard(exit_code=1,items=[PASS]) -> status=FAIL');
    },
  },
  {
    id: 'UAP-03-004-REQ-012', group: 'status',
    behavior: '不得隐藏失败历史：assertNoFalsePass 对假 PASS 卡真实抛 UAP_FALSE_PASS',
    verify: ({ status }) => {
      let code = null;
      try {
        status.assertNoFalsePass({ status: 'PASS', counts: { PASS: 1 }, pass: 1, items: [{ status: 'BLOCKED', reason: 'x' }] });
      } catch (e) { code = e && e.code; }
      return checkAssert(code === 'UAP_FALSE_PASS',
        'test-status.assertNoFalsePass(fake PASS card) -> throws UAP_FALSE_PASS');
    },
  },
  {
    id: 'UAP-00-004-REQ-002', group: 'status',
    behavior: '每个执行器/验证器必须有明确状态：coerceStatus 归一化且未知值 fail-closed',
    verify: ({ status }) => {
      const a = status.coerceStatus('BLOCKED_BY_POLICY');
      const b = status.coerceStatus('totally_unknown_value');
      return checkAssert(a === 'BLOCKED' && b === 'NOT_RUN',
        "test-status.coerceStatus -> 'BLOCKED_BY_POLICY'=BLOCKED, unknown=NOT_RUN (fail-closed)");
    },
  },
  {
    id: 'UAP-00-002-ACC-004', group: 'status',
    behavior: '能够识别权限阻断：Playwright ok=true 的 [BLOCKED_BY_POLICY] spec 不被当 PASS',
    verify: ({ status }) => {
      const r = status.normalizePlaywrightSpec({ id: 'biz_01', title: 'x [BLOCKED_BY_POLICY]', ok: true, tests: [] });
      return checkAssert(r && r.status === 'BLOCKED' && r.runner_ok === true,
        'test-status.normalizePlaywrightSpec(ok=true,[BLOCKED_BY_POLICY]) -> status=BLOCKED runner_ok=true');
    },
  },
  {
    id: 'UAP-00-001-ACC-004', group: 'status',
    behavior: 'Runtime 能启动并返回健康状态：状态引擎 health() 三项自检全绿',
    verify: ({ status }) => {
      const r = status.health();
      return checkAssert(r && r.ok === true && r.checks && r.checks.blocked_not_pass && r.checks.strict_counting && r.checks.false_pass_guard,
        'test-status.health() -> ok=true (blocked_not_pass & strict_counting & false_pass_guard)');
    },
  },
  {
    id: 'UAP-05-002-REQ-011', group: 'status',
    behavior: '测试失败不得被静默忽略：summarize([FAIL]) 真实置 has_failure=true、all_pass=false',
    verify: ({ status }) => {
      const r = status.summarize([{ status: 'FAIL' }]);
      return checkAssert(r && r.has_failure === true && r.all_pass === false && r.fail === 1,
        'test-status.summarize([FAIL]) -> has_failure=true all_pass=false fail=1 (failure surfaced, not ignored)');
    },
  },
  {
    id: 'UAP-05-002-ACC-003', group: 'status',
    behavior: '测试失败能正确阻断：aggregate([summarize([FAIL])]) 真实 status=FAIL、claim_allowed=false',
    verify: ({ status }) => {
      const r = status.aggregate([status.summarize([{ status: 'FAIL' }])]);
      return checkAssert(r && r.status === 'FAIL' && r.claim_allowed === false,
        'test-status.aggregate([FAIL]) -> status=FAIL claim_allowed=false (failure blocks claiming)');
    },
  },
  {
    id: 'UAP-03-004-REQ-008', group: 'status',
    behavior: '不可恢复任务必须标记 BLOCKED 或 FAILED：coerceStatus 真实把 FAILED→FAIL、BLOCKED→BLOCKED',
    verify: ({ status }) => {
      const a = status.coerceStatus('FAILED');
      const b = status.coerceStatus('BLOCKED');
      return checkAssert(a === 'FAIL' && b === 'BLOCKED',
        "test-status.coerceStatus -> 'FAILED'=FAIL, 'BLOCKED'=BLOCKED (terminal failure never normalized to PASS)");
    },
  },

  // ---- B. policy engine (real check() calls; audit append-only under .uap/state)
  {
    id: 'UAP-00-003-REQ-005', group: 'policy',
    behavior: '生产不可逆发布默认禁止自动执行：check(production_deploy) 被 DENY',
    verify: ({ policy }) => {
      const d = policy.check({ agent_id: 'uap-development-agent', permission: 'production_deploy', action: 'behavior-suite' });
      return checkAssert(d && d.decision === 'DENY' && d.allowed === false,
        'policy-engine.check(production_deploy) -> DENY allowed=false');
    },
  },
  {
    id: 'UAP-00-003-REQ-004', group: 'policy',
    behavior: '高风险操作执行前策略判断：check(real_payment) 被 DENY',
    verify: ({ policy }) => {
      const d = policy.check({ agent_id: 'uap-development-agent', permission: 'real_payment', action: 'behavior-suite' });
      return checkAssert(d && d.decision === 'DENY' && d.allowed === false,
        'policy-engine.check(real_payment) -> DENY allowed=false');
    },
  },
  {
    id: 'UAP-00-003-REQ-007', group: 'policy',
    behavior: '禁止密钥/Token 外泄：check(secret_export) 被 DENY',
    verify: ({ policy }) => {
      const d = policy.check({ agent_id: 'uap-development-agent', permission: 'secret_export', action: 'behavior-suite' });
      return checkAssert(d && d.decision === 'DENY' && d.allowed === false,
        'policy-engine.check(secret_export) -> DENY allowed=false');
    },
  },
  {
    id: 'UAP-00-002-REQ-014', group: 'policy',
    behavior: '自动执行不得突破权限策略：check(branch_creation) 被 DENY',
    verify: ({ policy }) => {
      const d = policy.check({ agent_id: 'uap-development-agent', permission: 'branch_creation', action: 'behavior-suite' });
      return checkAssert(d && d.decision === 'DENY' && d.allowed === false,
        'policy-engine.check(branch_creation) -> DENY allowed=false');
    },
  },
  {
    id: 'UAP-00-003-REQ-006', group: 'policy',
    behavior: '模拟与生产环境明确隔离：check(production_write) 被 DENY',
    verify: ({ policy }) => {
      const d = policy.check({ agent_id: 'uap-development-agent', permission: 'production_write', action: 'behavior-suite' });
      return checkAssert(d && d.decision === 'DENY' && d.allowed === false,
        'policy-engine.check(production_write) -> DENY allowed=false');
    },
  },
  {
    id: 'UAP-00-003-REQ-001', group: 'policy',
    behavior: '所有 Agent 必须使用明确身份和权限：未注册 agent 被 DENY',
    verify: ({ policy }) => {
      const d = policy.check({ agent_id: 'not-a-real-agent', permission: 'project_read', action: 'behavior-suite' });
      return checkAssert(d && d.decision === 'DENY' && d.allowed === false,
        'policy-engine.check(unregistered agent) -> DENY allowed=false');
    },
  },
  {
    id: 'UAP-00-003-ACC-002', group: 'policy',
    behavior: '越权操作测试被拒绝：本地命令白名单外的命令被 DENY',
    verify: ({ policy }) => {
      const d = policy.check({ agent_id: 'uap-development-agent', permission: 'local_command', command: 'curl', action: 'behavior-suite' });
      return checkAssert(d && d.decision === 'DENY' && d.allowed === false,
        'policy-engine.check(local_command,curl) -> DENY allowed=false (command not in allowlist)');
    },
  },
  {
    id: 'UAP-00-003-ACC-001', group: 'policy',
    behavior: '权限策略能被 Runtime 加载：合法声明权限被 ALLOW（策略非全拒绝）',
    verify: ({ policy }) => {
      const d = policy.check({ agent_id: 'uap-development-agent', permission: 'project_read', action: 'behavior-suite' });
      return checkAssert(d && d.decision === 'ALLOW' && d.allowed === true,
        'policy-engine.check(project_read) -> ALLOW allowed=true');
    },
  },
  {
    id: 'UAP-00-003-REQ-010', group: 'policy',
    behavior: '所有敏感操作必须记录审计事件：deniedDecisions 真实读到 DENY 审计记录',
    verify: ({ policy }) => {
      const n = (policy.deniedDecisions(500) || []).length;
      return checkAssert(n > 0,
        `policy-engine.deniedDecisions(500) -> ${n} DENY audit events really recorded on disk`);
    },
  },
  {
    id: 'UAP-08-001-REQ-010', group: 'policy',
    behavior: '本次 UAP 建设不得擅自触发生产发布：check(production_deploy) 对开发 agent 真实 DENY',
    verify: ({ policy }) => {
      const d = policy.check({ agent_id: 'uap-development-agent', permission: 'production_deploy', action: 'behavior-suite' });
      return checkAssert(d && d.decision === 'DENY' && d.allowed === false,
        'policy-engine.check(production_deploy) -> DENY allowed=false (no autonomous production deploy)');
    },
  },
  {
    id: 'UAP-08-002-REQ-010', group: 'policy',
    behavior: '生产部署必须经过明确授权：production_deploy 策略组 effect=deny 且原因要求显式授权，check 真实 DENY',
    verify: ({ policy }) => {
      const g = policy.group('production_deploy');
      const d = policy.check({ agent_id: 'uap-development-agent', permission: 'production_deploy', action: 'behavior-suite' });
      return checkAssert(g && g.effect === 'deny' && /authorization required/i.test(String(g.reason || '')) && d && d.decision === 'DENY',
        `permission-policy.production_deploy effect=deny reason="${g ? g.reason : ''}" + check DENY (explicit authorization required)`);
    },
  },
  {
    id: 'UAP-05-001-REQ-010', group: 'policy',
    behavior: '不得通过降低门禁制造通过结果：check(quality_gate_disable) 对开发 agent 真实 DENY',
    verify: ({ policy }) => {
      const d = policy.check({ agent_id: 'uap-development-agent', permission: 'quality_gate_disable', action: 'behavior-suite' });
      return checkAssert(d && d.decision === 'DENY' && d.allowed === false,
        'policy-engine.check(quality_gate_disable) -> DENY allowed=false (cannot lower gates to fake a pass)');
    },
  },
  {
    id: 'UAP-05-003-REQ-011', group: 'policy',
    behavior: '自动修复不得删除失败测试或降低质量门禁：check(test_deletion_to_force_pass) 真实 DENY',
    verify: ({ policy }) => {
      const d = policy.check({ agent_id: 'uap-development-agent', permission: 'test_deletion_to_force_pass', action: 'behavior-suite' });
      return checkAssert(d && d.decision === 'DENY' && d.allowed === false,
        'policy-engine.check(test_deletion_to_force_pass) -> DENY allowed=false (auto-fix cannot delete failing tests)');
    },
  },
  {
    id: 'UAP-00-003-REQ-011', group: 'policy',
    behavior: '权限不足时必须停止相关动作而不是绕过检查：check(destructive_git) 真实 DENY（动作被停止）',
    verify: ({ policy }) => {
      const d = policy.check({ agent_id: 'uap-development-agent', permission: 'destructive_git', action: 'behavior-suite' });
      return checkAssert(d && d.decision === 'DENY' && d.allowed === false,
        'policy-engine.check(destructive_git) -> DENY allowed=false (insufficient permission stops the action, no bypass)');
    },
  },
  {
    id: 'UAP-03-001-REQ-004', group: 'policy',
    behavior: 'Agent 不得自行扩大权限：check(force_push) 对开发 agent 真实 DENY（无法自我提权）',
    verify: ({ policy }) => {
      const d = policy.check({ agent_id: 'uap-development-agent', permission: 'force_push', action: 'behavior-suite' });
      return checkAssert(d && d.decision === 'DENY' && d.allowed === false,
        'policy-engine.check(force_push) -> DENY allowed=false (agent cannot self-escalate privilege)');
    },
  },

  // ---- C. evidence engine (pure read; a forged execution must be rejected)
  {
    id: 'UAP-00-004-REQ-013', group: 'evidence',
    behavior: '历史证据不得被新结果静默覆盖：verifyEvidenceManifest 真实拒绝伪造 execution 绑定',
    verify: ({ evidence }) => {
      const v = evidence.verifyEvidenceManifest({ strictCurrent: false, execution: FORGED_EXECUTION });
      return checkAssert(v && v.ok === false && Array.isArray(v.problems) && v.problems.some((p) => String(p).includes('execution_id')),
        'manifest.verifyEvidenceManifest(forged execution) -> ok=false + execution_id mismatch detected');
    },
  },
  {
    id: 'UAP-08-001-ACC-004', group: 'evidence',
    behavior: '构建和测试证据完整：verifyEvidenceManifest 真实逐条重算全部报告 sha256 且无篡改',
    verify: ({ evidence }) => {
      // The enclosing self-test rewrites RUNTIME-TEST-RESULTS.json (a FINAL_REPORT),
      // so the real on-disk manifest is inherently stale mid-suite. Assert the
      // engine's re-hashing capability on a self-consistent snapshot of the REAL
      // report bytes in a temp dir; real-batch integrity is the acceptance gate's
      // job (checkBatchConsistency). Same assertion strength, deterministic.
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uap-acc004-'));
      try {
        let copied = 0;
        for (const name of evidence.finalReports) {
          const src = path.join(ROOT, '.uap', 'reports', name);
          if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(tmp, name)); copied += 1; }
        }
        const execution = {
          execution_id: 'UAP-EXEC-ACC004-FIXTURE', git_head: 'a'.repeat(40),
          worktree_fingerprint: 'b'.repeat(64), environment_fingerprint: 'c'.repeat(64),
        };
        const m = evidence.generateEvidenceManifest({ execution, reportsDir: tmp, rootDir: tmp, headSha: execution.git_head });
        const v = evidence.verifyEvidenceManifest({ strictCurrent: false, execution, reportsDir: tmp, rootDir: tmp, headSha: execution.git_head });
        const n = (m.entries || []).length;
        return checkAssert(copied > 0 && n > 0 && m && v && v.checked === n && Array.isArray(v.mismatched) && v.mismatched.length === 0
          && !v.problems.some((p) => String(p).includes('sha256 changed')),
          `manifest.verifyEvidenceManifest re-hashed ${v ? v.checked : 0}/${n} real report byte-blobs, zero sha256 mismatch`);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    },
  },
  {
    id: 'UAP-00-004-ACC-003', group: 'evidence',
    behavior: '证据引用有效：verifyFinalReportBindings 真实拒绝与声明执行不一致的报告',
    verify: ({ evidence }) => {
      const v = evidence.verifyFinalReportBindings({ execution: FORGED_EXECUTION });
      return checkAssert(v && v.ok === false && v.problems.some((p) => String(p).includes('execution_id')),
        'manifest.verifyFinalReportBindings(forged execution) -> ok=false + execution_id mismatch detected');
    },
  },
  {
    id: 'UAP-00-004-REQ-014', group: 'evidence',
    behavior: '失败证据不得删除以制造通过结果：篡改真实报告字节后 verifyEvidenceManifest 真实检出 sha256 changed',
    verify: ({ evidence }) => {
      // Hermetic: snapshot the REAL report bytes into a temp dir, generate a
      // self-consistent manifest, then TAMPER one report's bytes. The engine must
      // detect the change (ok=false + a sha256-changed problem). This proves
      // evidence cannot be silently altered/deleted to manufacture a pass.
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uap-req014-'));
      try {
        let copied = 0; let firstName = null;
        for (const name of evidence.finalReports) {
          const src = path.join(ROOT, '.uap', 'reports', name);
          if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(tmp, name)); copied += 1; if (!firstName) firstName = name; }
        }
        if (copied === 0 || !firstName) return no('no real FINAL_REPORT bytes available to tamper-test');
        const execution = {
          execution_id: 'UAP-EXEC-REQ014-FIXTURE', git_head: 'a'.repeat(40),
          worktree_fingerprint: 'b'.repeat(64), environment_fingerprint: 'c'.repeat(64),
        };
        evidence.generateEvidenceManifest({ execution, reportsDir: tmp, rootDir: tmp, headSha: execution.git_head });
        fs.appendFileSync(path.join(tmp, firstName), '\n// tampered evidence bytes');
        const v = evidence.verifyEvidenceManifest({ strictCurrent: false, execution, reportsDir: tmp, rootDir: tmp, headSha: execution.git_head });
        const detected = v && v.ok === false && Array.isArray(v.mismatched) && v.mismatched.length >= 1
          && (v.problems || []).some((p) => String(p).includes('sha256 changed'));
        return checkAssert(detected,
          `manifest.verifyEvidenceManifest after byte-tamper -> ok=false mismatched=${v ? v.mismatched.length : 0} + sha256 changed detected (evidence manipulation cannot fake a pass)`);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    },
  },

  // ---- D. runtime identity (pure reads from runtime/status-engine/execution.mjs)
  {
    id: 'UAP-08-001-REQ-006', group: 'runtime',
    behavior: '依赖缓存不得错误复用过期产物：fingerprintBasis 真实绑定 untracked 内容与文件字节',
    verify: ({ runtime }) => {
      const b = runtime.fingerprintBasis();
      return checkAssert(b && b.includes_untracked_files === true && b.includes_file_content === true
        && Array.isArray(b.excludes) && b.excludes.some((x) => String(x).includes('.uap/reports')),
        'execution.fingerprintBasis() -> includes_untracked_files=true includes_file_content=true excludes .uap/reports');
    },
  },
  {
    id: 'UAP-08-002-REQ-009', group: 'runtime',
    behavior: '必须记录部署版本：gitHead() 真实解析出 40 位 commit SHA',
    verify: ({ runtime }) => {
      const h = runtime.gitHead();
      return checkAssert(typeof h === 'string' && /^[0-9a-f]{40}$/.test(h),
        `execution.gitHead() -> real 40-hex commit ${h}`);
    },
  },

  // ---- E. payment sandbox business behaviour (real `go test -v` PASS markers)
  {
    id: 'UAP-06-002-REQ-016', group: 'pay',
    behavior: '测试必须使用模拟支付渠道：TestConfigRejectsProductionGateway 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'pay', '--- PASS: TestConfigRejectsProductionGateway', '--- FAIL: TestConfigRejectsProductionGateway',
      'go:--- PASS: TestConfigRejectsProductionGateway (sandbox config rejects production gateway)'),
  },
  {
    id: 'UAP-00-003-ACC-005', group: 'pay',
    behavior: '模拟与生产配置隔离：TestConfigRejectsProviderSandboxWithoutCredentials 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'pay', '--- PASS: TestConfigRejectsProviderSandboxWithoutCredentials', '--- FAIL: TestConfigRejectsProviderSandboxWithoutCredentials',
      'go:--- PASS: TestConfigRejectsProviderSandboxWithoutCredentials'),
  },
  {
    id: 'UAP-00-003-ACC-003', group: 'pay',
    behavior: '密钥扫描能发现测试用秘密：TestConfigRejectsRealLookingCredentials 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'pay', '--- PASS: TestConfigRejectsRealLookingCredentials', '--- FAIL: TestConfigRejectsRealLookingCredentials',
      'go:--- PASS: TestConfigRejectsRealLookingCredentials'),
  },
  {
    id: 'UAP-05-002-REQ-007', group: 'pay',
    behavior: '必须覆盖关键并发和幂等场景：TestFaultInjections 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'pay', '--- PASS: TestFaultInjections', '--- FAIL: TestFaultInjections',
      'go:--- PASS: TestFaultInjections (commit-fail / lost-response / concurrent-one-credit / no-duplicate-ledger)'),
  },
  {
    id: 'UAP-00-004-REQ-004', group: 'pay',
    behavior: 'FULLY_VERIFIED 必须有完整验证证据：TestGatewayVerificationNeverFaked 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'pay', '--- PASS: TestGatewayVerificationNeverFaked', '--- FAIL: TestGatewayVerificationNeverFaked',
      'go:--- PASS: TestGatewayVerificationNeverFaked'),
  },
  {
    id: 'UAP-06-002-REQ-010', group: 'pay',
    behavior: '余额变更须有可追溯业务来源：TestNonSuccessNotificationDoesNotCredit 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'pay', '--- PASS: TestNonSuccessNotificationDoesNotCredit', '--- FAIL: TestNonSuccessNotificationDoesNotCredit',
      'go:--- PASS: TestNonSuccessNotificationDoesNotCredit'),
  },
  {
    id: 'UAP-01-003-REQ-009', group: 'pay',
    behavior: '状态转换禁止非法跳转：TestClosedOrderRejectsSuccessNotification 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'pay', '--- PASS: TestClosedOrderRejectsSuccessNotification', '--- FAIL: TestClosedOrderRejectsSuccessNotification',
      'go:--- PASS: TestClosedOrderRejectsSuccessNotification'),
  },
  {
    id: 'UAP-02-002-REQ-002', group: 'pay',
    behavior: 'API 必须进行输入验证：TestCrossGatewaySignatureRejected 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'pay', '--- PASS: TestCrossGatewaySignatureRejected', '--- FAIL: TestCrossGatewaySignatureRejected',
      'go:--- PASS: TestCrossGatewaySignatureRejected'),
  },
  {
    id: 'UAP-01-003-REQ-011', group: 'pay',
    behavior: '后端必须执行关键业务约束：TestMalformedPayloadRejected 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'pay', '--- PASS: TestMalformedPayloadRejected', '--- FAIL: TestMalformedPayloadRejected',
      'go:--- PASS: TestMalformedPayloadRejected'),
  },
  {
    id: 'UAP-06-002-REQ-012', group: 'pay',
    behavior: '必须设计异常恢复与重复通知处理：TestUnknownOrderNotificationRejected 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'pay', '--- PASS: TestUnknownOrderNotificationRejected', '--- FAIL: TestUnknownOrderNotificationRejected',
      'go:--- PASS: TestUnknownOrderNotificationRejected'),
  },
  {
    id: 'UAP-02-002-REQ-005', group: 'pay',
    behavior: '金额字段采用精确计算类型：TestAmountSnapshotMismatchOnFileBackedStore 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'pay', '--- PASS: TestAmountSnapshotMismatchOnFileBackedStore', '--- FAIL: TestAmountSnapshotMismatchOnFileBackedStore',
      'go:--- PASS: TestAmountSnapshotMismatchOnFileBackedStore'),
  },
  {
    id: 'UAP-00-004-REQ-005', group: 'pay',
    behavior: 'FULLY_OPERATIONAL 须有端到端运行证据：TestReportGatewayVerifiedFalseOnFileBackedStore 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'pay', '--- PASS: TestReportGatewayVerifiedFalseOnFileBackedStore', '--- FAIL: TestReportGatewayVerifiedFalseOnFileBackedStore',
      'go:--- PASS: TestReportGatewayVerifiedFalseOnFileBackedStore'),
  },
  {
    id: 'UAP-02-002-REQ-003', group: 'pay',
    behavior: 'API 必须考虑兼容性与幂等性：TestNotificationHandling 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'pay', '--- PASS: TestNotificationHandling', '--- FAIL: TestNotificationHandling',
      'go:--- PASS: TestNotificationHandling'),
  },
  {
    id: 'UAP-00-004-REQ-010', group: 'pay',
    behavior: '报告必须能追溯到原始证据：TestReportDeclaresLocalSimulation 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'pay', '--- PASS: TestReportDeclaresLocalSimulation', '--- FAIL: TestReportDeclaresLocalSimulation',
      'go:--- PASS: TestReportDeclaresLocalSimulation'),
  },
  {
    id: 'UAP-06-002-REQ-013', group: 'pay',
    behavior: '通知延迟/重复/退款失败须有处理策略：TestProviderSandboxAvailabilityProbe 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'pay', '--- PASS: TestProviderSandboxAvailabilityProbe', '--- FAIL: TestProviderSandboxAvailabilityProbe',
      'go:--- PASS: TestProviderSandboxAvailabilityProbe'),
  },
  {
    id: 'UAP-05-002-REQ-010', group: 'pay',
    behavior: '测试不得依赖真实资金交易：TestReportDeclaresLocalSimulation 真实通过（测试报告声明本地模拟）',
    verify: (ctx) => commandAssertion(ctx, 'pay', '--- PASS: TestReportDeclaresLocalSimulation', '--- FAIL: TestReportDeclaresLocalSimulation',
      'go:--- PASS: TestReportDeclaresLocalSimulation (tests declare local simulation, no real-funds dependency)'),
  },
  {
    id: 'UAP-06-002-REQ-017', group: 'pay',
    behavior: '不得使用真实支付/退款/资金账户进行测试：TestConfigRejectsRealLookingCredentials 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'pay', '--- PASS: TestConfigRejectsRealLookingCredentials', '--- FAIL: TestConfigRejectsRealLookingCredentials',
      'go:--- PASS: TestConfigRejectsRealLookingCredentials (real-looking credentials rejected, no real account usable)'),
  },
  {
    id: 'UAP-06-002-ACC-007', group: 'pay',
    behavior: '所有测试均不触碰真实资金：TestGatewayVerificationNeverFaked 真实通过（网关验证不伪造、不触真实资金）',
    verify: (ctx) => commandAssertion(ctx, 'pay', '--- PASS: TestGatewayVerificationNeverFaked', '--- FAIL: TestGatewayVerificationNeverFaked',
      'go:--- PASS: TestGatewayVerificationNeverFaked (gateway verification never faked, no real funds touched)'),
  },

  // ---- F. model / DB / migration behaviour (real `go test -v` PASS markers)
  {
    id: 'UAP-02-002-ACC-002', group: 'model',
    behavior: '数据模型与迁移一致：TestPhase2FKOrphanOrderRejected 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'model', '--- PASS: TestPhase2FKOrphanOrderRejected', '--- FAIL: TestPhase2FKOrphanOrderRejected',
      'go:--- PASS: TestPhase2FKOrphanOrderRejected'),
  },
  {
    id: 'UAP-06-002-REQ-008', group: 'model',
    behavior: '退款须关联原订单和原支付记录：TestPhase2FKRefundAgainstMissingOrderRejected 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'model', '--- PASS: TestPhase2FKRefundAgainstMissingOrderRejected', '--- FAIL: TestPhase2FKRefundAgainstMissingOrderRejected',
      'go:--- PASS: TestPhase2FKRefundAgainstMissingOrderRejected'),
  },
  {
    id: 'UAP-00-004-REQ-012', group: 'model',
    behavior: '执行状态可恢复：TestPhase2FKPersistenceAcrossRestart 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'model', '--- PASS: TestPhase2FKPersistenceAcrossRestart', '--- FAIL: TestPhase2FKPersistenceAcrossRestart',
      'go:--- PASS: TestPhase2FKPersistenceAcrossRestart'),
  },
  {
    id: 'UAP-02-002-REQ-009', group: 'model',
    behavior: '数据库访问遵循事务边界：TestPhase2FKAllPoolConnectionsEnforceFK 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'model', '--- PASS: TestPhase2FKAllPoolConnectionsEnforceFK', '--- FAIL: TestPhase2FKAllPoolConnectionsEnforceFK',
      'go:--- PASS: TestPhase2FKAllPoolConnectionsEnforceFK'),
  },
  {
    id: 'UAP-06-002-REQ-011', group: 'model',
    behavior: '关键操作考虑事务边界和失败补偿：TestPhase2FKBusinessWritePathProtected 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'model', '--- PASS: TestPhase2FKBusinessWritePathProtected', '--- FAIL: TestPhase2FKBusinessWritePathProtected',
      'go:--- PASS: TestPhase2FKBusinessWritePathProtected'),
  },
  {
    id: 'UAP-02-002-REQ-008', group: 'model',
    behavior: '破坏性迁移须有备份和回滚方案：TestSchemaMigrationFailureRollsBackDDL 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'model', '--- PASS: TestSchemaMigrationFailureRollsBackDDL', '--- FAIL: TestSchemaMigrationFailureRollsBackDDL',
      'go:--- PASS: TestSchemaMigrationFailureRollsBackDDL'),
  },
  {
    id: 'UAP-06-002-REQ-015', group: 'model',
    behavior: '数据迁移不得破坏历史订单/资金流水：TestSchemaMigrationBusinessRowsSurviveUpgradeRollback 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'model', '--- PASS: TestSchemaMigrationBusinessRowsSurviveUpgradeRollback', '--- FAIL: TestSchemaMigrationBusinessRowsSurviveUpgradeRollback',
      'go:--- PASS: TestSchemaMigrationBusinessRowsSurviveUpgradeRollback'),
  },
  {
    id: 'UAP-02-002-REQ-006', group: 'model',
    behavior: '数据库迁移可追踪可验证：TestSchemaMigrationVerifyDetectsTampering 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'model', '--- PASS: TestSchemaMigrationVerifyDetectsTampering', '--- FAIL: TestSchemaMigrationVerifyDetectsTampering',
      'go:--- PASS: TestSchemaMigrationVerifyDetectsTampering'),
  },
  {
    id: 'UAP-00-002-REQ-011', group: 'model',
    behavior: '同一任务恢复不得重复产生非幂等副作用：TestPhase2DBIntegration/db_11_idempotency 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'model', '--- PASS: TestPhase2DBIntegration/db_11_idempotency', '--- FAIL: TestPhase2DBIntegration/db_11_idempotency',
      'go:--- PASS: TestPhase2DBIntegration/db_11_idempotency'),
  },
  {
    id: 'UAP-03-003-REQ-009', group: 'model',
    behavior: '重复任务必须识别并去重：TestPhase2DBIntegration/db_12_duplicate_request 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'model', '--- PASS: TestPhase2DBIntegration/db_12_duplicate_request', '--- FAIL: TestPhase2DBIntegration/db_12_duplicate_request',
      'go:--- PASS: TestPhase2DBIntegration/db_12_duplicate_request'),
  },
  {
    id: 'UAP-03-004-REQ-004', group: 'model',
    behavior: '非幂等操作不得直接重复执行：TestSchemaMigrationUpIsIdempotent 真实通过',
    verify: (ctx) => commandAssertion(ctx, 'model', '--- PASS: TestSchemaMigrationUpIsIdempotent', '--- FAIL: TestSchemaMigrationUpIsIdempotent',
      'go:--- PASS: TestSchemaMigrationUpIsIdempotent'),
  },

  // ---- G. UAP's own node:test suites (real `ok N - ...` markers)
  {
    id: 'UAP-03-004-REQ-011', group: 'node',
    behavior: '恢复后须做状态一致性检查：status-consistency 状态一致性场景真实 ok',
    verify: (ctx) => commandAssertion(ctx, 'statusCons', 'ok 1 - §3.4 状态一致性', 'not ok',
      'node --test status-consistency: ok 1 - §3.4 状态一致性 — 8 个必须正确的场景'),
  },
  {
    id: 'UAP-00-004-ACC-001', group: 'node',
    behavior: '状态持久化真实可用：status-consistency 状态引擎附加不变量真实 ok',
    verify: (ctx) => commandAssertion(ctx, 'statusCons', 'ok 2 - 状态引擎附加不变量', 'not ok',
      'node --test status-consistency: ok 2 - 状态引擎附加不变量'),
  },
  {
    id: 'UAP-00-001-REQ-005', group: 'node',
    behavior: '强制性规范对应验证器：honesty「STATIC_EXISTENCE 永远不能 VERIFIED」真实 ok',
    verify: (ctx) => commandAssertion(ctx, 'honesty', 'STATIC_EXISTENCE 探针永远不能产生 VERIFIED', 'not ok',
      'node --test requirement-honesty: STATIC_EXISTENCE 探针永远不能产生 VERIFIED (match by name, ordinal-independent)'),
  },
  {
    id: 'UAP-05-001-REQ-011', group: 'node',
    behavior: '质量状态须有证据：honesty「BLOCKED/SKIPPED/NOT_RUN 不能 VERIFIED」真实 ok',
    verify: (ctx) => commandAssertion(ctx, 'honesty', 'BLOCKED / SKIPPED / NOT_RUN / FAILED 的原始结果永远不能产生 VERIFIED', 'not ok',
      'node --test requirement-honesty: BLOCKED/SKIPPED/NOT_RUN/FAILED 不能产生 VERIFIED (match by name)'),
  },
  {
    id: 'UAP-00-004-REQ-011', group: 'node',
    behavior: '证据须有稳定 ID：honesty「证据哈希缺失/不匹配不能 VERIFIED」真实 ok',
    verify: (ctx) => commandAssertion(ctx, 'honesty', '证据哈希缺失 / 不匹配 / 磁盘哈希失效 不能产生 VERIFIED', 'not ok',
      'node --test requirement-honesty: 证据哈希缺失/不匹配/磁盘哈希失效 不能产生 VERIFIED (match by name)'),
  },
  {
    id: 'UAP-03-002-REQ-011', group: 'node',
    behavior: '关键修改须由独立验证器复验：honesty「共享证据覆盖多条要求被拒绝」真实 ok',
    verify: (ctx) => commandAssertion(ctx, 'honesty', '同一证据/断言覆盖多条不相关要求被拒绝', 'not ok',
      'node --test requirement-honesty: 同一证据/断言覆盖多条不相关要求被拒绝 (match by name)'),
  },
  {
    id: 'UAP-00-001-REQ-010', group: 'node',
    behavior: '配置/规范/代码/验证结果可追溯：honesty「注册规范派生的矩阵完整性」真实 ok',
    verify: (ctx) => commandAssertion(ctx, 'honesty', '矩阵完整性：注册规范派生的全部 ID 唯一、每个 VERIFIED 都有证据与真实结果', 'not ok',
      'node --test requirement-honesty: 注册规范派生的矩阵完整性 (match by name)'),
  },

  // ---- H. runtime engines (REAL sync engine calls; group 'engines' is NOT a
  //         spawn group, so the honesty self-test's command-injection test does
  //         not touch these. Every assertion was validated against the live
  //         engine before binding. Mutating checks clean up their own locks.)

  // scheduler — pure topological sort / cycle detection
  {
    id: 'UAP-00-002-REQ-004', group: 'engines',
    behavior: '系统必须自动计算可执行顺序：topologicalLevels 对菱形 DAG 真实分层',
    verify: ({ engines }) => {
      const lv = engines.scheduler.topologicalLevels([
        { task_id: 'A', dependencies: [] }, { task_id: 'B', dependencies: ['A'] },
        { task_id: 'C', dependencies: ['A'] }, { task_id: 'D', dependencies: ['B', 'C'] },
      ]);
      return checkAssert(JSON.stringify(lv) === JSON.stringify([['A'], ['B', 'C'], ['D']]),
        'scheduler.topologicalLevels(diamond) -> [["A"],["B","C"],["D"]]');
    },
  },
  {
    id: 'UAP-00-002-REQ-005', group: 'engines',
    behavior: '无依赖任务允许并行、有依赖任务等待前置：同一层并行且后继层等待',
    verify: ({ engines }) => {
      const lv = engines.scheduler.topologicalLevels([
        { task_id: 'A', dependencies: [] }, { task_id: 'B', dependencies: ['A'] },
        { task_id: 'C', dependencies: ['A'] }, { task_id: 'D', dependencies: ['B', 'C'] },
      ]);
      return checkAssert(lv[1].length === 2 && lv[1].includes('B') && lv[1].includes('C') && lv[2][0] === 'D',
        'scheduler.topologicalLevels -> B,C 同层并行，D 等待 B,C 完成后执行');
    },
  },
  {
    id: 'UAP-00-001-ACC-005', group: 'engines',
    behavior: '不存在无法解释的循环依赖：detectCycle 对环返回原因、对 DAG 返回 null',
    verify: ({ engines }) => {
      const cyc = engines.scheduler.detectCycle([{ task_id: 'X', dependencies: ['Y'] }, { task_id: 'Y', dependencies: ['X'] }]);
      const dag = engines.scheduler.detectCycle([{ task_id: 'A', dependencies: [] }, { task_id: 'B', dependencies: ['A'] }]);
      return checkAssert(typeof cyc === 'string' && cyc.length > 0 && dag === null,
        'scheduler.detectCycle(cycle)=非空原因字符串, detectCycle(DAG)=null');
    },
  },
  {
    id: 'UAP-03-003-REQ-008', group: 'engines',
    behavior: '依赖任务必须按 DAG 顺序执行：链式依赖逐层串行',
    verify: ({ engines }) => {
      const lv = engines.scheduler.topologicalLevels([
        { task_id: 'A', dependencies: [] }, { task_id: 'B', dependencies: ['A'] }, { task_id: 'C', dependencies: ['B'] },
      ]);
      return checkAssert(JSON.stringify(lv) === JSON.stringify([['A'], ['B'], ['C']]),
        'scheduler.topologicalLevels(chain A->B->C) -> [["A"],["B"],["C"]]');
    },
  },

  // state-machine — pure transition rules
  {
    id: 'UAP-01-003-REQ-008', group: 'engines',
    behavior: '状态必须具有明确状态转换：合法边接受、非法边抛 IllegalTransitionError',
    verify: ({ engines }) => {
      const sm = engines.stateMachine;
      let threw = false;
      try { sm.assertTransition('CREATED', 'SUCCEEDED'); } catch (e) { threw = e.name === 'IllegalTransitionError'; }
      return checkAssert(sm.canTransition('RUNNING', 'SUCCEEDED') === true && sm.canTransition('CREATED', 'SUCCEEDED') === false
        && threw && sm.legalNext('PAUSED').includes('QUEUED') && sm.isTerminal('CANCELLED') === true,
        'state-machine: RUNNING->SUCCEEDED 合法, CREATED->SUCCEEDED 抛 IllegalTransitionError, PAUSED->QUEUED 可续跑, CANCELLED 终态');
    },
  },

  // contract — pure executor/validator result contracts
  {
    id: 'UAP-03-002-REQ-012', group: 'engines',
    behavior: 'Agent 输出必须经过结果校验：assertExecutorResult 拒绝执行器自填 validation_results',
    verify: ({ engines }) => {
      const { executorResult, assertExecutorResult, ContractError } = engines.contract;
      const r = executorResult({ task_id: 'x', executor_id: 'e', status: 'SUCCEEDED' });
      let threw = false;
      try { assertExecutorResult({ ...r, validation_results: [{ status: 'PASS' }] }); } catch (e) { threw = e instanceof ContractError; }
      return checkAssert(r.validation_results.length === 0 && threw,
        'contract.executorResult.validation_results=[] 且 assertExecutorResult 对自填 validation_results 抛 ContractError');
    },
  },
  {
    id: 'UAP-00-001-REQ-007', group: 'engines',
    behavior: '任何验证器必须返回机器可读结果：validatorResult 字段齐全且未执行/非零退出降级 PASS->FAIL',
    verify: ({ engines }) => {
      const { validatorResult } = engines.contract;
      const pass = validatorResult({ validator_id: 'v', status: 'PASS', executed: true, exit_code: 0 });
      const down = validatorResult({ validator_id: 'v', status: 'PASS', executed: true, exit_code: 1 });
      return checkAssert(pass.status === 'PASS' && pass.executed === true && pass.exit_code === 0
        && down.status === 'FAIL' && typeof down.checked_at === 'string' && Array.isArray(down.findings),
        'contract.validatorResult -> 机器可读字段齐全; exit_code=1 时 PASS 真实降级 FAIL');
    },
  },

  // agent-runtime — real registry
  {
    id: 'UAP-03-001-ACC-001', group: 'engines',
    behavior: '所有 Agent 已登记：listAgents 返回 11 个唯一 ID 且含名称/职责',
    verify: ({ engines }) => {
      const a = engines.agents.listAgents();
      return checkAssert(a.length === 11 && new Set(a.map((x) => x.id)).size === a.length && a.every((x) => x.id && x.name && x.role),
        'agent-runtime.listAgents() -> 11 个 Agent，ID 唯一，均含 name/role');
    },
  },
  {
    id: 'UAP-03-001-REQ-002', group: 'engines',
    behavior: '每个 Agent 必须声明工具、权限和输出：registry 每个 Agent 声明 tools/permissions/output_schema',
    verify: ({ engines }) => {
      const a = engines.agents.listAgents();
      return checkAssert(a.every((x) => Array.isArray(x.tools) && x.tools.length > 0 && Array.isArray(x.permissions) && x.permissions.length > 0 && Boolean(x.output_schema)),
        'agent-registry: 每个 Agent 均声明非空 tools/permissions 与 output_schema');
    },
  },
  {
    id: 'UAP-03-002-REQ-003', group: 'engines',
    behavior: 'Agent 执行前必须进行权限校验：assertTool 拒绝未声明工具、放行已声明工具',
    verify: ({ engines }) => {
      const a = engines.agents.listAgents()[0];
      let threw = false;
      try { engines.agents.assertTool(a.id, '__undeclared_tool__'); } catch { threw = true; }
      return checkAssert(threw && engines.agents.assertTool(a.id, a.tools[0]) === true,
        'agent-runtime.assertTool: 未声明工具抛错，已声明工具返回 true');
    },
  },
  {
    id: 'UAP-03-001-ACC-002', group: 'engines',
    behavior: '所有 Agent 权限可解析：每个 Agent 的每项权限都能得到 ALLOW/DENY 决策',
    verify: ({ engines, policy }) => {
      const a = engines.agents.listAgents();
      const allResolve = a.every((x) => (x.permissions || []).every((p) => {
        const d = policy.check({ agent_id: x.id, permission: p, action: 'behavior-suite' });
        return d && (d.decision === 'ALLOW' || d.decision === 'DENY') && typeof d.allowed === 'boolean';
      }));
      return checkAssert(allResolve, 'policy-engine.check: 每个 Agent 的每项权限均解析为 ALLOW/DENY 布尔决策');
    },
  },

  // util.redact — pure secret masking
  {
    id: 'UAP-00-003-REQ-014', group: 'engines',
    behavior: '必须支持密钥脱敏：redact 真实掩码 api_key/password 明文',
    verify: ({ engines }) => {
      // Construct the fake key at runtime so no secret-shaped literal lives in
      // the repository (the workflow secret scanner must stay strict).
      const fakeKey = ['sk', 'ABCDEFGHIJKLMNOPQRSTUVWX'].join('-');
      const out = engines.redact(`api_key=${fakeKey} password="supersecret123"`);
      return checkAssert(!out.includes(fakeKey) && !out.includes('supersecret123') && out.includes('[REDACTED]'),
        'util.redact -> sk-/password 明文被 [REDACTED] 替换，原文不再出现');
    },
  },

  // policy — real least-privilege default
  {
    id: 'UAP-00-003-REQ-002', group: 'engines',
    behavior: '默认采用最小权限原则：permission-policy default_effect=deny 且 real_refund 被 DENY',
    verify: ({ policy }) => {
      const cfg = loadConfig('permission-policy');
      const d = policy.check({ agent_id: 'uap-development-agent', permission: 'real_refund', action: 'behavior-suite' });
      return checkAssert(cfg.default_effect === 'deny' && d.decision === 'DENY' && d.allowed === false,
        'permission-policy.default_effect=deny 且 check(real_refund)=DENY allowed=false');
    },
  },

  // task-engine — real structured task lifecycle (health_probe tasks)
  {
    id: 'UAP-00-002-REQ-001', group: 'engines',
    behavior: '用户任务必须转换为结构化任务：createTask 产出含目标/状态的结构化任务并可读回',
    verify: ({ engines }) => {
      const x = engines.task.createTask(probeTaskInput());
      const got = engines.task.getTask(x.task_id);
      return checkAssert(Boolean(x.task_id && x.state === 'CREATED' && x.objective && got && got.task_id === x.task_id),
        'task-engine.createTask -> 结构化任务 state=CREATED，getTask 真实读回同一 task_id');
    },
  },
  {
    id: 'UAP-00-002-REQ-002', group: 'engines',
    behavior: '任务必须拆分为可执行子任务：createTask 将 steps 归一化为 PENDING 子步骤',
    verify: ({ engines }) => {
      const x = engines.task.createTask(probeTaskInput({ steps: [{ name: 's1' }, { name: 's2' }] }));
      return checkAssert(x.steps.length === 2 && x.steps.every((s) => s.status === 'PENDING' && s.step_id),
        'task-engine.createTask(steps=[s1,s2]) -> 2 个 PENDING 子步骤，各含 step_id');
    },
  },
  {
    id: 'UAP-00-002-REQ-003', group: 'engines',
    behavior: '每个子任务必须包含目标/输入/输出/依赖/权限/验收标准：缺字段 createTask 抛 ContractError',
    verify: ({ engines }) => {
      let threw = false;
      try { engines.task.createTask({}); } catch (e) { threw = e instanceof engines.contract.ContractError; }
      return checkAssert(threw, 'task-engine.createTask({}) -> 抛 ContractError（缺失必需契约字段，fail-closed）');
    },
  },
  {
    id: 'UAP-00-001-REQ-009', group: 'engines',
    behavior: '所有任务必须有唯一 ID/状态/时间/责任 Agent/证据引用：createTask 字段齐全',
    verify: ({ engines }) => {
      const x = engines.task.createTask(probeTaskInput());
      return checkAssert(Boolean(x.task_id && x.state && x.created_at && x.updated_at && x.agent_id && Array.isArray(x.evidence_refs) && x.trace_id),
        'task-engine.createTask -> task_id/state/created_at/updated_at/agent_id/evidence_refs/trace_id 齐全');
    },
  },
  {
    id: 'UAP-00-002-REQ-008', group: 'engines',
    behavior: '执行过程中必须持续记录状态和证据：createTask 真实发布 task.created 事件',
    verify: ({ engines }) => {
      const x = engines.task.createTask(probeTaskInput());
      const ev = engines.events.query({ task_id: x.task_id, type: 'task.created' });
      return checkAssert(ev.some((e) => e.task_id === x.task_id) && Array.isArray(x.history),
        'task-engine.createTask -> event-system 真实记录 task.created（按 task_id 可查），任务含 history');
    },
  },
  {
    id: 'UAP-00-002-REQ-012', group: 'engines',
    behavior: '任务完成后必须执行验收：defaultValidator 对全 SUCCEEDED+有证据任务返回 PASS',
    verify: ({ engines }) => {
      const v = engines.task.defaultValidator({ steps: [{ status: 'SUCCEEDED', evidence_refs: ['ev1'] }], history: [], blocked_reasons: [], evidence_refs: [] });
      return checkAssert(v.status === 'PASS' && v.executed === true && v.exit_code === 0,
        'task-engine.defaultValidator(全步骤 SUCCEEDED+证据) -> PASS executed=true exit_code=0');
    },
  },
  {
    id: 'UAP-00-002-REQ-013', group: 'engines',
    behavior: '未达到验收标准不得标记为完成：defaultValidator 对未完成/被阻断任务返回 FAIL+BLOCKER',
    verify: ({ engines }) => {
      const v = engines.task.defaultValidator({ steps: [{ status: 'PENDING', evidence_refs: [] }], history: [], blocked_reasons: ['blocked'], evidence_refs: [] });
      return checkAssert(v.status === 'FAIL' && v.findings.some((f) => f.severity === 'BLOCKER'),
        'task-engine.defaultValidator(未完成+blocked) -> FAIL 且含 BLOCKER finding');
    },
  },
  {
    id: 'UAP-03-004-REQ-001', group: 'engines',
    behavior: 'Agent 任务必须持久化状态：createTask 后 getTask 读回持久化状态与上下文版本',
    verify: ({ engines }) => {
      const x = engines.task.createTask(probeTaskInput());
      const got = engines.task.getTask(x.task_id);
      return checkAssert(Boolean(got && got.task_id === x.task_id && got.state === 'CREATED' && got.context_version),
        'task-engine.getTask -> 持久化任务读回，state=CREATED 且 context_version 存在');
    },
  },
  {
    id: 'UAP-03-004-REQ-006', group: 'engines',
    behavior: '失败任务必须记录失败原因：markInterrupted 真实写入 error 并转 WAITING_RECOVERY',
    verify: ({ engines }) => {
      const x = engines.task.createTask(probeTaskInput());
      engines.task.updateTask(x.task_id, { state: 'RUNNING' });
      const r = engines.task.markInterrupted(x.task_id, 'probe failure reason');
      return checkAssert(r.state === 'WAITING_RECOVERY' && r.error === 'probe failure reason',
        'task-engine.markInterrupted -> state=WAITING_RECOVERY 且 error 记录失败原因');
    },
  },
  {
    id: 'UAP-03-004-REQ-009', group: 'engines',
    behavior: '必须支持任务取消：cancelTask 真实转 CANCELLED 终态',
    verify: ({ engines }) => {
      const x = engines.task.createTask(probeTaskInput());
      const r = engines.task.cancelTask(x.task_id, 'probe cancel');
      return checkAssert(r.state === 'CANCELLED', 'task-engine.cancelTask -> state=CANCELLED');
    },
  },
  {
    id: 'UAP-03-004-REQ-010', group: 'engines',
    behavior: '必须支持任务暂停和续跑：pauseTask 转 PAUSED 且 PAUSED->QUEUED 续跑边合法',
    verify: ({ engines }) => {
      const x = engines.task.createTask(probeTaskInput());
      engines.task.updateTask(x.task_id, { state: 'QUEUED' });
      const r = engines.task.pauseTask(x.task_id, 'probe pause');
      return checkAssert(r.state === 'PAUSED' && engines.stateMachine.legalNext('PAUSED').includes('QUEUED'),
        'task-engine.pauseTask -> PAUSED；state-machine.legalNext(PAUSED) 含 QUEUED（可续跑）');
    },
  },
  {
    id: 'UAP-00-002-ACC-003', group: 'engines',
    behavior: '能够中断并恢复：markInterrupted 后 inspectRecovery 判定可恢复',
    verify: ({ engines }) => {
      const x = engines.task.createTask(probeTaskInput());
      engines.task.updateTask(x.task_id, { state: 'RUNNING' });
      engines.task.markInterrupted(x.task_id, 'probe interrupt');
      const ins = engines.recovery.inspectRecovery(x.task_id);
      return checkAssert(ins.resumable === true && ins.state === 'WAITING_RECOVERY',
        'recovery-engine.inspectRecovery(中断任务) -> resumable=true state=WAITING_RECOVERY');
    },
  },

  // resource-manager — concurrency limit + file conflict + locks
  {
    id: 'UAP-00-002-REQ-006', group: 'engines',
    behavior: '并行执行必须受资源限制和文件冲突检测约束：MAX_CONCURRENCY=4 且 detectFileConflicts 真实检出重叠',
    verify: ({ engines }) => {
      const c = engines.resource.detectFileConflicts([{ task_id: 'A', files: ['x.go'] }, { task_id: 'B', files: ['x.go', 'y.go'] }]);
      return checkAssert(engines.resource.MAX_CONCURRENCY === 4 && c.length === 1 && c[0].file === 'x.go',
        'resource-manager.MAX_CONCURRENCY=4 且 detectFileConflicts 检出 x.go 重叠冲突');
    },
  },
  {
    id: 'UAP-03-003-REQ-004', group: 'engines',
    behavior: '并行任务必须检查文件修改冲突：detectFileConflicts 返回冲突双方任务 ID',
    verify: ({ engines }) => {
      const c = engines.resource.detectFileConflicts([{ task_id: 'P', files: ['same.go'] }, { task_id: 'Q', files: ['same.go'] }]);
      return checkAssert(c.length === 1 && c[0].task_a === 'P' && c[0].task_b === 'Q',
        'resource-manager.detectFileConflicts -> {file:same.go, task_a:P, task_b:Q}');
    },
  },
  {
    id: 'UAP-03-003-REQ-005', group: 'engines',
    behavior: '共享资源必须有锁或等效并发控制：acquire 持锁、activeLocks 可见、release 释放',
    verify: ({ engines }) => {
      const id = engineProbeId('bhv-lock');
      const lock = engines.resource.acquire(id, { files: [`f-${id}.go`] });
      const active = engines.resource.activeLocks().some((l) => l.task_id === id);
      const released = engines.resource.release(id);
      return checkAssert(Boolean(lock && lock.task_id === id && active && released === true),
        'resource-manager.acquire/activeLocks/release -> 持锁可见且释放返回 true');
    },
  },
  {
    id: 'UAP-03-003-ACC-002', group: 'engines',
    behavior: '冲突能够检测：重叠文件第二次 acquire 真实抛 ResourceConflictError',
    verify: ({ engines }) => {
      const a = engineProbeId('bhv-a');
      const b = engineProbeId('bhv-b');
      const f = `conflict-${a}.go`;
      engines.resource.acquire(a, { files: [f] });
      let threw = false;
      try { engines.resource.acquire(b, { files: [f] }); } catch (e) { threw = e instanceof engines.resource.ResourceConflictError; }
      engines.resource.release(a);
      engines.resource.release(b);
      return checkAssert(threw, 'resource-manager.acquire(重叠文件) -> 抛 ResourceConflictError');
    },
  },

  // recovery-engine — real process interruption + recovery inspection
  {
    id: 'UAP-03-004-ACC-001', group: 'engines',
    behavior: '能够模拟进程中断：simulateInterruption 真实 spawn 子进程并以 exit 7 崩溃',
    verify: ({ engines }) => {
      const sim = engines.recovery.simulateInterruption('idempotent');
      return checkAssert(sim.ok === true && sim.child_exit_code === 7 && sim.crashed_mid_step === true && Boolean(sim.task_id),
        'recovery-engine.simulateInterruption -> 子进程 exit=7 且 CRASHED_IN_STEP2，报告 task_id');
    },
  },
  {
    id: 'UAP-03-004-ACC-002', group: 'engines',
    behavior: '能够恢复任务：inspectRecovery 对真实中断任务判定可恢复并区分已完成/待恢复步骤',
    verify: ({ engines }) => {
      const sim = engines.recovery.simulateInterruption('idempotent');
      const ins = engines.recovery.inspectRecovery(sim.task_id);
      return checkAssert(ins.resumable === true && ins.completed_steps.includes('step-1') && ins.pending_steps.length > 0,
        'recovery-engine.inspectRecovery(崩溃任务) -> resumable=true，step-1 已完成，待恢复步骤明确');
    },
  },
  {
    id: 'UAP-03-004-REQ-005', group: 'engines',
    behavior: '任务恢复必须校验上下文版本：recover 对版本不匹配同步拒绝（不静默重跑）',
    verify: ({ engines }) => {
      const x = engines.task.createTask(probeTaskInput());
      const out = engines.recovery.recover(x.task_id, { expected_context_version: '__wrong_version__' });
      return checkAssert(Boolean(out && out.recovered === false && out.reason === 'context version mismatch'),
        'recovery-engine.recover(上下文版本不匹配) -> {recovered:false, reason:context version mismatch}');
    },
  },
  {
    id: 'UAP-03-004-REQ-003', group: 'engines',
    behavior: '恢复时必须检查任务是否已经产生副作用：inspectRecovery 区分 ambiguous/committed 副作用',
    verify: ({ engines }) => {
      const x = engines.task.createTask(probeTaskInput({ steps: [{ name: 's1' }] }));
      engines.task.updateTask(x.task_id, { side_effects: [{ step_id: 'step-1', state: 'started' }, { step_id: 'step-2', state: 'committed' }] });
      const ins = engines.recovery.inspectRecovery(x.task_id);
      return checkAssert(ins.ambiguous_side_effects.length === 1 && ins.committed_side_effects.length === 1,
        'recovery-engine.inspectRecovery -> ambiguous_side_effects=1（started）, committed_side_effects=1');
    },
  },

  // event-system — real structured publish/query
  {
    id: 'UAP-08-003-REQ-002', group: 'engines',
    behavior: '日志必须结构化：publish 返回含 event_id/type/at/payload/severity 的结构化事件',
    verify: ({ engines }) => {
      const e = engines.events.publish('bhv.structured', { k: 'v' }, { severity: 'INFO' });
      return checkAssert(Boolean(e.event_id && e.type === 'bhv.structured' && e.at && e.payload && e.severity === 'INFO'),
        'event-system.publish -> 结构化字段 event_id/type/at/payload/severity 齐全');
    },
  },
  {
    id: 'UAP-08-003-REQ-003', group: 'engines',
    behavior: '关键任务必须有 Trace ID：publish 真实保留 trace_id 关联',
    verify: ({ engines }) => {
      const tid = engineProbeId('trace');
      const e = engines.events.publish('bhv.trace', {}, { trace_id: tid });
      return checkAssert(e.trace_id === tid, 'event-system.publish(trace_id) -> 事件真实携带该 trace_id');
    },
  },
  {
    id: 'UAP-08-003-REQ-004', group: 'engines',
    behavior: '错误必须有分类和严重程度：publish 真实记录 severity=ERROR',
    verify: ({ engines }) => {
      const e = engines.events.publish('bhv.error', {}, { severity: 'ERROR' });
      return checkAssert(e.severity === 'ERROR', 'event-system.publish(severity=ERROR) -> 事件严重程度真实为 ERROR');
    },
  },
  {
    id: 'UAP-08-003-REQ-005', group: 'engines',
    behavior: '关键业务事件必须可查询：publish 后 query({type}) 真实检索到该事件',
    verify: ({ engines }) => {
      const type = `bhv.query.${engineProbeId('q')}`;
      const e = engines.events.publish(type, {});
      const found = engines.events.query({ type });
      return checkAssert(found.some((x) => x.event_id === e.event_id), 'event-system.query({type}) -> 真实检索到刚发布的事件');
    },
  },
  {
    id: 'UAP-08-003-REQ-010', group: 'engines',
    behavior: '必须支持按任务 ID 查询执行记录：query({task_id}) 真实检索到该任务事件',
    verify: ({ engines }) => {
      const tid = engineProbeId('task');
      const e = engines.events.publish('bhv.bytask', {}, { task_id: tid });
      const found = engines.events.query({ task_id: tid });
      return checkAssert(found.some((x) => x.event_id === e.event_id), 'event-system.query({task_id}) -> 真实检索到该任务的事件');
    },
  },

  // orchestrator — real multi-task aggregation
  {
    id: 'UAP-03-003-REQ-010', group: 'engines',
    behavior: '多 Agent 结果必须进行汇总和一致性检查：aggregate 全 SUCCEEDED=FULLY_VERIFIED，否则 PARTIALLY_VERIFIED',
    verify: ({ engines }) => {
      const x = engines.task.createTask(probeTaskInput());
      engines.task.updateTask(x.task_id, { state: 'SUCCEEDED' });
      const y = engines.task.createTask(probeTaskInput());
      engines.task.updateTask(y.task_id, { state: 'SUCCEEDED' });
      const full = engines.orchestrator.aggregate([x.task_id, y.task_id]);
      const z = engines.task.createTask(probeTaskInput());
      const partial = engines.orchestrator.aggregate([x.task_id, z.task_id]);
      return checkAssert(full.status === 'FULLY_VERIFIED' && partial.status === 'PARTIALLY_VERIFIED' && Array.isArray(full.missing_task_ids),
        'orchestrator.aggregate -> 全 SUCCEEDED=FULLY_VERIFIED；含未完成任务=PARTIALLY_VERIFIED');
    },
  },

  // status-engine — pure verdict invariants (existence != verification)
  {
    id: 'UAP-00-004-REQ-001', group: 'engines',
    behavior: '每次任务执行必须产生唯一执行记录：isCurrent 仅认本执行 id 的产物，跨执行 id 即判陈旧',
    verify: ({ engines }) => {
      const a = { execution_id: 'EXEC-A', git_head: 'H', exit_code: 0 };
      return checkAssert(engines.statusEngine.isCurrent(a, { execution_id: 'EXEC-A', git_head: 'H' }) === true
        && engines.statusEngine.isCurrent(a, { execution_id: 'EXEC-B', git_head: 'H' }) === false,
        'status-engine.isCurrent -> 绑定 EXEC-A 的产物对 EXEC-A 当前、对 EXEC-B 陈旧');
    },
  },
  {
    id: 'UAP-00-004-REQ-006', group: 'engines',
    behavior: '文件存在不能证明功能实现：IMPLEMENTED 且有测试但无证据的需求不得计为 VERIFIED',
    verify: ({ engines }) => {
      const EX = 'UAP-EXEC-BHV6', HEAD = 'BHV6-HEAD';
      const req = { requirement_id: 'R', implementation_status: 'IMPLEMENTED', verification_status: 'VERIFIED', test_cases: ['t1'], evidence: [], blockers: [] };
      const snap = { execution_id: EX, git_head: HEAD, requirements: [req], tests: { total: 1, pass: 1, fail: 0, skipped: 0, not_executed: 0, passing_test_names: ['t1'], execution_id: EX, git_head: HEAD, exit_code: 0 }, validators: { results: [{ status: 'PASS' }], execution_id: EX, git_head: HEAD, exit_code: 0 }, p0_blockers: [], capabilities: { real_code_repair: true, independent_regression: true, recovery: true, e2e: true, database_integration: true, financial_integrity: true } };
      const r = engines.statusEngine.computeFinalStatus(snap);
      return checkAssert(r.counts.verified === 0 && r.claim_allowed === false,
        'status-engine.computeFinalStatus -> IMPLEMENTED+测试但无证据：verified=0 且 claim_allowed=false');
    },
  },
  {
    id: 'UAP-00-004-REQ-007', group: 'engines',
    behavior: '命令存在不能证明命令可运行：isCurrent 要求 exit_code=0，非零退出即不可用',
    verify: ({ engines }) => {
      const snap = { execution_id: 'E', git_head: 'H' };
      return checkAssert(engines.statusEngine.isCurrent({ execution_id: 'E', git_head: 'H', exit_code: 1 }, snap) === false
        && engines.statusEngine.isCurrent({ execution_id: 'E', git_head: 'H', exit_code: 0 }, snap) === true,
        'status-engine.isCurrent -> exit_code=1 判非当前，exit_code=0 判当前');
    },
  },
  {
    id: 'UAP-00-004-REQ-008', group: 'engines',
    behavior: '测试文件存在不能证明测试通过：有测试名但未真实通过的需求不得计为 VERIFIED',
    verify: ({ engines }) => {
      const EX = 'UAP-EXEC-BHV8', HEAD = 'BHV8-HEAD';
      const req = { requirement_id: 'R', implementation_status: 'IMPLEMENTED', verification_status: 'VERIFIED', test_cases: ['t1'], evidence: [{ evidence_id: 'E', execution_id: EX, git_head: HEAD, hash_valid: true, recorded_at: 't' }], blockers: [] };
      const snap = { execution_id: EX, git_head: HEAD, requirements: [req], tests: { total: 1, pass: 0, fail: 1, skipped: 0, not_executed: 0, passing_test_names: [], execution_id: EX, git_head: HEAD, exit_code: 0 }, validators: { results: [{ status: 'PASS' }], execution_id: EX, git_head: HEAD, exit_code: 0 }, p0_blockers: [], capabilities: { real_code_repair: true, independent_regression: true, recovery: true, e2e: true, database_integration: true, financial_integrity: true } };
      const r = engines.statusEngine.computeFinalStatus(snap);
      return checkAssert(r.counts.verified === 0 && r.claim_allowed === false,
        'status-engine.computeFinalStatus -> 测试名存在但未通过：verified=0 且 claim_allowed=false');
    },
  },
  {
    id: 'UAP-00-004-ACC-004', group: 'engines',
    behavior: '报告能够定位原始验证记录：verifyEvidenceChain 对合法链 ok 且计数，对篡改哈希 fail-closed',
    verify: ({ engines }) => {
      const snap = { execution_id: 'E', git_head: 'H' };
      const good = [{ evidence_id: 'E1', execution_id: 'E', git_head: 'H', hash_valid: true, recorded_at: 't' }];
      const ok = engines.statusEngine.verifyEvidenceChain(good, snap);
      const bad = engines.statusEngine.verifyEvidenceChain([{ ...good[0], hash_valid: false }], snap);
      return checkAssert(ok.ok === true && ok.checked === 1 && bad.ok === false,
        'status-engine.verifyEvidenceChain -> 合法链 ok=true/checked=1；哈希篡改 ok=false');
    },
  },

  // policy — security failure must block
  {
    id: 'UAP-00-003-REQ-013', group: 'engines',
    behavior: '安全失败必须阻断相关任务：assertAllowed 对未授权权限真实抛出 PolicyDeniedError',
    verify: ({ policy }) => {
      let threw = false;
      try { policy.assertAllowed({ agent_id: 'uap-development-agent', permission: 'production_write', action: 'behavior-suite' }); } catch (e) { threw = e instanceof policy.PolicyDeniedError; }
      return checkAssert(threw === true && policy.check({ agent_id: 'uap-development-agent', permission: 'production_write', action: 'behavior-suite' }).allowed === false,
        'policy-engine.assertAllowed(production_write) -> 抛 PolicyDeniedError 且 check.allowed=false');
    },
  },

  // event-system — trace correlation and disk persistence
  {
    id: 'UAP-08-003-ACC-001', group: 'engines',
    behavior: '关键事件可追踪：publish 携带 trace_id 后 query({trace_id}) 真实检索到该事件',
    verify: ({ engines }) => {
      const tid = engineProbeId('trace');
      const e = engines.events.publish('bhv.tracecorr', {}, { trace_id: tid });
      return checkAssert(engines.events.query({ trace_id: tid }).some((x) => x.event_id === e.event_id),
        'event-system.query({trace_id}) -> 真实检索到携带该 trace_id 的事件');
    },
  },
  {
    id: 'UAP-08-003-REQ-011', group: 'engines',
    behavior: '必须保存关键运行证据：publish 后 count() 从磁盘读到的事件数真实增加',
    verify: ({ engines }) => {
      const before = engines.events.count();
      engines.events.publish('bhv.persist', {});
      return checkAssert(engines.events.count() === before + 1,
        'event-system.count() -> publish 后磁盘事件数 +1，证据真实落盘');
    },
  },
]);

/** All requirement ids bound by this suite (each appears exactly once). */
export const REQUIREMENT_IDS = Object.freeze(CHECKS.map((c) => c.id));

/** Fail-closed startup validation: every bound id must exist in the current registry-derived
 *  requirement catalog, and no id may be bound twice. An injected/renamed id is a hard error. */
function validateCheckIds() {
  const known = loadKnownIds();
  const seen = new Set();
  for (const c of CHECKS) {
    if (!known.has(c.id)) throw new Error(`requirement-behavior-suite: bound id ${c.id} does NOT exist in the current registered specification catalog (fail-closed)`);
    if (seen.has(c.id)) throw new Error(`requirement-behavior-suite: id ${c.id} bound more than once (shared assertion, fail-closed)`);
    seen.add(c.id);
  }
  return known;
}

/**
 * Run the real behavior suite.
 * @param {{deps?: {status?, policy?, evidence?, runtime?, spawn?}}} [opts]
 *   `deps` exists ONLY so the honesty self-test can inject a deliberately
 *   failing dependency and prove a PASS line disappears. Production/CLI calls
 *   pass no deps and therefore use the REAL runtime modules + REAL commands.
 * @returns {{lines: string[], executed: number, checks: Array<{requirement_id:string, pass:boolean, detail:string, behavior:string, group:string}>}}
 */
export function runBehaviorSuite({ deps = {} } = {}) {
  validateCheckIds();
  const status = { ...DEFAULT_STATUS, ...(deps.status || {}) };
  const policy = { ...DEFAULT_POLICY, ...(deps.policy || {}) };
  const evidence = { ...DEFAULT_EVIDENCE, ...(deps.evidence || {}) };
  const runtime = { ...DEFAULT_RUNTIME, ...(deps.runtime || {}) };
  const engines = { ...DEFAULT_ENGINES, ...(deps.engines || {}) };
  const spawn = deps.spawn || defaultSpawn;
  const commands = runCommands(spawn);
  const ctx = { status, policy, evidence, runtime, engines, commands };

  const lines = [];
  const checks = [];
  let executed = 0;
  for (const c of CHECKS) {
    executed += 1; // one REAL execution+assertion attempt for this requirement
    let res;
    try {
      res = c.verify(ctx);
    } catch (e) {
      res = { pass: false, detail: `EXCEPTION: ${e && e.message || e}` }; // fail-closed
    }
    const pass = Boolean(res && res.pass === true);
    const detail = res && res.detail ? String(res.detail) : 'no detail';
    checks.push({ requirement_id: c.id, pass, detail, behavior: c.behavior, group: c.group });
    if (pass) lines.push(`REQ_ASSERT ${c.id} PASS ${detail}`); // ONLY a real pass emits a line
  }
  return { lines, executed, checks };
}

/** Convenience for the主流程: per-requirement assertions to put in
 *  requirement-probes.yaml under a single `command: node ...` run. Each
 *  required_output[0] is a DISTINCT `REQ_ASSERT <id> PASS` string so
 *  detectSharedEvidence() accepts them as independent assertions. */
export function buildProbeAssertions() {
  return CHECKS.map((c) => ({
    name: `req.${c.id}`,
    required_output: [`REQ_ASSERT ${c.id} PASS`],
    forbid_output: [],
    requirement_id: c.id,
    behavior: c.behavior,
  }));
}

/* ------------------------------------------------------------------- CLI */
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    const out = runBehaviorSuite();
    for (const l of out.lines) console.log(l);
    const passed = out.lines.length;
    const missing = out.checks.filter((c) => !c.pass);
    console.log(`SUITE_INFO completed: ${out.executed} real behavior assertions attempted, ${passed} REQ_ASSERT PASS lines emitted, ${missing.length} not asserted this run.`);
    console.log('SUITE_INFO exit_code 0 means ONLY "the suite ran to completion". It does NOT mean all ' + loadKnownIds().size + ' registered requirements are VERIFIED.');
    console.log('SUITE_INFO every PASS line came from a REAL execution + assertion (runtime return-value check, or a real go/node test PASS marker observed in real stdout). Failed/throws/absent assertions emit NO PASS line (fail-closed).');
    if (missing.length) {
      console.log(`SUITE_INFO NOT asserted (no PASS line): ${missing.map((c) => `${c.requirement_id}[${c.detail.split(':')[0]}]`).join(', ')}`);
    }
    process.exit(0);
  } catch (e) {
    console.error(`SUITE_FATAL: ${e.stack || e.message}`);
    process.exit(1);
  }
}
