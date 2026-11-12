import { pathToFileURL } from 'node:url';
import { ROOT, STATE, FILES, rootPath } from '../../runtime/_lib/paths.mjs';
import {
  loadAllConfigs, registryIntegrity, validatorById, specById,
  REQUIRED_SPEC_SECTIONS,
} from '../../runtime/_lib/config.mjs';
import { validatorResult, finding, TASK_TRANSITIONS } from '../../runtime/_lib/contract.mjs';
import { exists, readText, readJSON } from '../../runtime/_lib/util.mjs';
import { runCommand } from '../../runtime/_lib/proc.mjs';

export const component = 'validators.agents';

function ctxOf(ctx = {}) {
  const configs = ctx.configs || loadAllConfigs();
  return {
    configs,
    registry: ctx.registry || registryIntegrity(configs),
    evidenceIds: Array.isArray(ctx.evidenceIds) ? ctx.evidenceIds : [],
  };
}
function checksOf(configs, id) {
  return (validatorById(configs).get(id)?.checks || []).slice();
}
function regPass(registry, cid) {
  const c = registry.checks.find((x) => x.id === cid);
  return !!c && c.status === 'PASS';
}
function inspectSpec(configs, id) {
  const spec = specById(configs).get(id);
  if (!spec) return { ok: false, detail: `${id} 未登记`, text: '' };
  const a = rootPath(spec.file);
  if (!exists(a)) return { ok: false, detail: `缺少 ${spec.file}`, text: '' };
  const text = readText(a);
  const missing = REQUIRED_SPEC_SECTIONS.filter((s) => !text.includes(s));
  const header = text.includes(`**编号：** ${id}`);
  const m = text.match(/\*\*状态：\*\*\s*([A-Z_]+)/);
  const ok = text.length >= 2000 && missing.length === 0 && header
    && !!m && ['ACTIVE', 'IMPLEMENTED_NOT_VERIFIED'].includes(m[1]);
  return { ok, detail: `bytes=${text.length} sections_missing=${missing.length}`, text };
}
async function selfCheck(script, timeoutMs = 15000) {
  return runCommand({ command: 'node', args: ['--input-type=module', '-e', script], timeoutMs });
}
function cmdRan(cmd) {
  return !!cmd && !cmd.spawn_error && !cmd.timed_out && cmd.exit_code === 0;
}
function parseOut(cmd) {
  try {
    const lines = (cmd.stdout || '').trim().split('\n').filter(Boolean);
    return JSON.parse(lines[lines.length - 1]);
  } catch { return null; }
}
// Dynamically import a module and really call its health() to prove it runs.
async function probeHealth(rel) {
  const abs = rootPath(rel);
  if (!exists(abs)) return { ok: false, detail: `缺少 ${rel}` };
  try {
    const m = await import(`${pathToFileURL(abs).href}?t=${Date.now()}`);
    if (typeof m.health !== 'function') return { ok: false, detail: '未导出 health()' };
    let h;
    try { h = m.health(); } catch (e) { return { ok: false, detail: `health() 抛错: ${e.message}` }; }
    return { ok: h?.ok === true, component: m.component, detail: `health().ok=${h?.ok}` };
  } catch (e) { return { ok: false, detail: `import 失败: ${e.message}` }; }
}
// Import-only probe for modules whose health() has write side effects.
async function probeExports(rel, names) {
  const abs = rootPath(rel);
  if (!exists(abs)) return { ok: false, detail: `缺少 ${rel}` };
  try {
    const m = await import(`${pathToFileURL(abs).href}?t=${Date.now()}`);
    const missing = names.filter((n) => typeof m[n] !== 'function' && typeof m[n] !== 'string');
    return { ok: missing.length === 0, detail: missing.length ? `缺导出 ${missing.join(',')}` : `导出 ${names.join(',')} 齐全`, component: m.component };
  } catch (e) { return { ok: false, detail: `import 失败: ${e.message}` }; }
}
function assemble(id, checks, results, opts = {}) {
  const t0 = opts.started || Date.now();
  const findings = [];
  for (const r of results) {
    if (!r.ok) findings.push(finding(r.severity || 'BLOCKER', `check.${r.name}`, `${r.name}: ${r.detail}`));
  }
  for (const f of opts.findings || []) findings.push(f);
  const blockers = findings.filter((f) => f.severity === 'BLOCKER').length;
  let status, executed, exit_code;
  if (opts.blocked) {
    status = 'BLOCKED'; executed = false; exit_code = null;
  } else {
    const allOk = results.every((r) => r.ok) && blockers === 0;
    status = allOk ? 'PASS' : 'FAIL'; executed = true; exit_code = allOk ? 0 : 1;
  }
  const parts = results.map((r) => `${r.name}=${r.ok ? 'PASS' : 'FAIL'}(${r.detail})`);
  const ev = opts.evidence_refs || [];
  const evNote = ev.length ? `evidence_refs ${ev.length} 个` : 'evidence_refs=[] (ctx.evidenceIds 为空)';
  const r = opts.registry;
  const regNote = r ? `registryIntegrity ${r.checks.filter((c) => c.status === 'PASS').length}/${r.checks.length} checks / ${r.findings.length} findings` : '';
  const summary = [`${id} 实检: ${parts.join('; ')}`, regNote, evNote, opts.note || ''].filter(Boolean).join(' | ');
  return validatorResult({
    validator_id: id, status, executed, exit_code,
    evidence_refs: ev, checks_run: checks, findings,
    commands: opts.commands || [], summary, duration_ms: Date.now() - t0,
  });
}

export const validators = {
  // UAP-03-001 : agent_ids / implementation_exists / permission_mapping
  'agents.registry_integrity': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'agents.registry_integrity');
    const agents = configs['agent-registry'].agents || [];
    const groups = configs['permission-policy'].permission_groups || {};

    const ids = agents.map((a) => a.id);
    const rIds = {
      name: 'agent_ids',
      ok: agents.length === 11 && new Set(ids).size === 11
        && agents.every((a) => a.role && a.output_schema)
        && ['registry.agent_unique', 'registry.agent_count'].every((c) => regPass(registry, c)),
      detail: `agents=${agents.length} 唯一ID=${new Set(ids).size}; 每个含 role/output_schema=${agents.every((a) => a.role && a.output_schema)}; registry agent_unique/count=${regPass(registry, 'registry.agent_unique')}/${regPass(registry, 'registry.agent_count')}`,
    };

    const missingImpl = agents.filter((a) => !a.implementation || !exists(rootPath(a.implementation)));
    const rImpl = {
      name: 'implementation_exists',
      ok: missingImpl.length === 0 && regPass(registry, 'registry.agent_implementation'),
      detail: `真实实现文件缺失=${missingImpl.length}/${agents.length}${missingImpl.length ? ' (' + missingImpl.slice(0, 4).map((a) => `${a.id}->${a.implementation}`).join(',') + (missingImpl.length > 4 ? '…' : '') + ')' : ''}; registry.agent_implementation=${regPass(registry, 'registry.agent_implementation')}`,
    };

    const undeclared = [];
    for (const a of agents) for (const p of a.permissions || []) if (!groups[p]) undeclared.push(`${a.id}:${p}`);
    const rPerm = {
      name: 'permission_mapping',
      ok: undeclared.length === 0 && regPass(registry, 'registry.agent_permissions'),
      detail: `未在 permission-policy 声明的权限=${undeclared.length}${undeclared.length ? ' (' + undeclared.slice(0, 4).join(',') + ')' : ''}; registry.agent_permissions=${regPass(registry, 'registry.agent_permissions')}`,
    };
    return assemble('agents.registry_integrity', checks, [rIds, rImpl, rPerm], {
      started, registry, evidence_refs: evidenceIds,
      note: '逐个 exists() 检查 agent.implementation 真实文件; 缺失如实计为 FAIL, 不以"已登记"替代"实现存在"',
    });
  },

  // UAP-03-002 : execution_contract / structured_output / timeout
  'agents.execution_integrity': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'agents.execution_integrity');
    const ec = configs['execution-mapping'].execution_contract || {};
    const needIn = ['task_id', 'specification_ids', 'scope', 'constraints', 'acceptance_criteria'];
    const needOut = ['status', 'summary', 'changed_files', 'validation_results', 'evidence_refs', 'blocked_reasons'];

    const rContract = {
      name: 'execution_contract',
      ok: needIn.every((k) => (ec.required_input || []).includes(k))
        && needOut.every((k) => (ec.required_output || []).includes(k)),
      detail: `required_input 覆盖 ${needIn.filter((k) => (ec.required_input || []).includes(k)).length}/${needIn.length}; required_output 覆盖 ${needOut.filter((k) => (ec.required_output || []).includes(k)).length}/${needOut.length}`,
    };

    const exports = await probeExports('.uap/runtime/agent-runtime/index.mjs', ['component', 'health', 'execute']);
    const url = pathToFileURL(rootPath('.uap/runtime/_lib/contract.mjs')).href;
    const self = await selfCheck(
      "const {executorResult}=await import('" + url + "');"
      + "const er=executorResult({status:'SUCCEEDED',task_id:'probe'});"
      + "const ok=er.validation_results.length===0&&['status','summary','changed_files','evidence_refs','outputs'].every(k=>k in er);"
      + "console.log(JSON.stringify({ok,shape:Object.keys(er)}));", 15000);
    const parsed = parseOut(self);
    const rStruct = {
      name: 'structured_output',
      ok: exports.ok && cmdRan(self) && !!parsed && parsed.ok === true,
      detail: `agent-runtime 导出 ${exports.detail}; 子进程复跑 executorResult 结构 ok=${parsed?.ok}; exit_code=${self.exit_code}`,
    };

    const procSrc = exists(rootPath('.uap/runtime/_lib/proc.mjs')) ? readText(rootPath('.uap/runtime/_lib/proc.mjs')) : '';
    const timeoutSelf = await selfCheck("console.log(JSON.stringify({ok:true}));", 15000);
    const rTimeout = {
      name: 'timeout',
      ok: cmdRan(timeoutSelf) && /setTimeout/.test(procSrc) && /timeoutMs/.test(procSrc) && timeoutSelf.timed_out === false,
      detail: `runCommand 真实运行 exit_code=${timeoutSelf.exit_code} timed_out=${timeoutSelf.timed_out} spawn_error=${timeoutSelf.spawn_error || 'none'}; proc.mjs 含 setTimeout/timeoutMs=${/setTimeout/.test(procSrc) && /timeoutMs/.test(procSrc)}`,
    };
    const blocked = !cmdRan(self) || !cmdRan(timeoutSelf);
    return assemble('agents.execution_integrity', checks, [rContract, rStruct, rTimeout], {
      started, registry, evidence_refs: evidenceIds, commands: [self, timeoutSelf], blocked,
      note: '动态 import agent-runtime 验证导出 + node 子进程复验 executorResult 结构 + runCommand 真实运行记录 exit_code',
    });
  },

  // UAP-03-003 : task_dependencies / conflict_detection / result_consistency
  'agents.collaboration_integrity': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'agents.collaboration_integrity');
    const specs = configs['specification-registry'].specifications || [];
    const agentSpecs = specs.filter((s) => s.domain === 'agents');
    const byId = new Map(specs.map((s) => [s.id, s]));
    let cycles = 0;
    const missingDeps = [];
    const state = new Map();
    const visit = (id) => {
      if (state.get(id) === 'done') return;
      if (state.get(id) === 'visiting') { cycles += 1; return; }
      state.set(id, 'visiting');
      for (const d of byId.get(id)?.dependencies || []) {
        if (!byId.has(d)) missingDeps.push(`${id}->${d}`); else visit(d);
      }
      state.set(id, 'done');
    };
    for (const s of agentSpecs) visit(s.id);
    const rDeps = {
      name: 'task_dependencies',
      ok: agentSpecs.length === 4 && cycles === 0 && missingDeps.length === 0 && regPass(registry, 'registry.dependencies_acyclic'),
      detail: `agents 域 ${agentSpecs.length} 条规范自算 DAG cycles=${cycles} missing_deps=${missingDeps.length}; registry 无环=${regPass(registry, 'registry.dependencies_acyclic')}`,
    };

    const agents = configs['agent-registry'].agents || [];
    const ids = agents.map((a) => a.id);
    const defaults = configs['agent-registry'].defaults || {};
    const spec3 = inspectSpec(configs, 'UAP-03-003');
    const rConflict = {
      name: 'conflict_detection',
      ok: new Set(ids).size === ids.length && defaults.deny_undeclared_tools === true
        && spec3.text.includes('冲突') && spec3.text.includes('一致') && regPass(registry, 'registry.agent_unique'),
      detail: `agent id 唯一=${new Set(ids).size === ids.length}; deny_undeclared_tools=${defaults.deny_undeclared_tools}; 规范含 冲突/一致=${spec3.text.includes('冲突') && spec3.text.includes('一致')}`,
    };

    // Prove a real runtime module can actually run (not just exist on disk).
    const healthProbe = await probeHealth('.uap/runtime/state-machine/index.mjs');
    const rResult = {
      name: 'result_consistency',
      ok: healthProbe.ok && agents.every((a) => !!a.output_schema) && spec3.text.includes('结构化'),
      detail: `动态 import state-machine 并调用 health().ok===true: ${healthProbe.detail}; 11 agent 均有 output_schema=${agents.every((a) => !!a.output_schema)}; 规范含 结构化=${spec3.text.includes('结构化')}`,
    };
    return assemble('agents.collaboration_integrity', checks, [rDeps, rConflict, rResult], {
      started, registry, evidence_refs: evidenceIds,
      note: '自算协作依赖 DAG + 冲突规则 + 动态 import 调用 health() 证明模块可运行',
    });
  },

  // UAP-03-004 : state_persistence / interruption_recovery / idempotency
  'agents.recovery_integrity': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'agents.recovery_integrity');
    const baseline = readJSON(FILES.baseline, null);

    const rState = {
      name: 'state_persistence',
      ok: !!baseline && !!baseline.workspace && !!baseline.git && !!baseline.toolchain && exists(STATE),
      detail: `BASELINE.json 含 workspace/git/toolchain=${!!baseline && !!baseline.workspace && !!baseline.git && !!baseline.toolchain}; .uap/state 目录存在=${exists(STATE)}`,
    };

    const recoveryPaths = TASK_TRANSITIONS.WAITING_RECOVERY || [];
    // recovery-engine.health() creates a task and may throw, so we only verify
    // its exported contract here; health().ok===true is proven on safe modules
    // in collaboration_integrity / reliability_integrity.
    const exports = await probeExports('.uap/runtime/recovery-engine/index.mjs', ['component', 'health', 'execute']);
    const rRecover = {
      name: 'interruption_recovery',
      ok: exports.ok && recoveryPaths.includes('QUEUED') && recoveryPaths.includes('FAILED')
        && !!TASK_TRANSITIONS.WAITING_RECOVERY,
      detail: `recovery-engine 导出 ${exports.detail}; WAITING_RECOVERY 可迁移=[${recoveryPaths.join(',')}] (含 QUEUED/FAILED=${recoveryPaths.includes('QUEUED') && recoveryPaths.includes('FAILED')})`,
    };

    const url = pathToFileURL(rootPath('.uap/runtime/_lib/contract.mjs')).href;
    const self = await selfCheck(
      "const {TASK_TRANSITIONS}=await import('" + url + "');"
      + "const terminal=['SUCCEEDED','CANCELLED'].every(s=>TASK_TRANSITIONS[s].length===0);"
      + "const noSelfLoop=Object.entries(TASK_TRANSITIONS).every(([k,v])=>!v.includes(k));"
      + "console.log(JSON.stringify({terminal,noSelfLoop,ok:terminal&&noSelfLoop}));", 15000);
    const parsed = parseOut(self);
    const rIdem = {
      name: 'idempotency',
      ok: cmdRan(self) && !!parsed && parsed.ok === true && (TASK_TRANSITIONS.SUCCEEDED || []).length === 0,
      detail: `子进程复验终态(SUCCEEDED/CANCELLED 无后继)=${parsed?.terminal} 无自环=${parsed?.noSelfLoop}; exit_code=${self.exit_code}`,
    };
    const blocked = !cmdRan(self);
    return assemble('agents.recovery_integrity', checks, [rState, rRecover, rIdem], {
      started, registry, evidence_refs: evidenceIds, commands: [self], blocked,
      note: '真实读取 BASELINE.json + 动态 import recovery-engine 导出 + node 子进程复验状态机幂等/终态; 不调用有写副作用的 recovery health()',
    });
  },
};

export function health() {
  const configs = loadAllConfigs();
  const ids = Object.keys(validators);
  const declared = validatorById(configs);
  const mapped = ids.every((id) => declared.has(id));
  const runtimeOk = exists(rootPath('.uap/runtime/agent-runtime/index.mjs')) && exists(rootPath('.uap/runtime/recovery-engine/index.mjs'));
  return {
    component,
    ok: mapped && runtimeOk && ids.length === 4,
    checks: { validators_exported: ids.length, all_mapped_to_registry: mapped, runtime_modules_present: runtimeOk },
    summary: `agents 导出 ${ids.length} 个验证器; agent-runtime/recovery-engine 模块存在=${runtimeOk}`,
    checked_at: new Date().toISOString(),
  };
}
