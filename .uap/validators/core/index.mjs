import { pathToFileURL } from 'node:url';
import { ROOT, FILES, rootPath } from '../../runtime/_lib/paths.mjs';
import {
  loadAllConfigs, registryIntegrity, validatorById, specById,
  executorEntries, REQUIRED_SPEC_SECTIONS,
} from '../../runtime/_lib/config.mjs';
import { validatorResult, finding, TASK_TRANSITIONS } from '../../runtime/_lib/contract.mjs';
import { exists, readText, readJSON, listFiles } from '../../runtime/_lib/util.mjs';
import { runCommand } from '../../runtime/_lib/proc.mjs';

export const component = 'validators.core';

// ---------------------------------------------------------------------------
// Self-contained local helpers. Every validator below really reads files,
// re-computes a value, runs a subprocess, or dynamically imports a module.
// ---------------------------------------------------------------------------
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
  const evNote = ev.length ? `evidence_refs ${ev.length} 个(${ev.slice(0, 2).join(',')}${ev.length > 2 ? '…' : ''})` : 'evidence_refs=[] (ctx.evidenceIds 为空)';
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
  // UAP-00-001 : module_presence / dependency_integrity / interface_integrity
  'core.architecture_integrity': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'core.architecture_integrity');
    const specs = configs['specification-registry'].specifications || [];

    // module_presence: real scan of every registered specification file.
    let good = 0;
    const bad = [];
    for (const s of specs) {
      const abs = rootPath(s.file);
      if (!exists(abs)) { bad.push(`${s.id}(file missing)`); continue; }
      const text = readText(abs);
      const missing = REQUIRED_SPEC_SECTIONS.filter((x) => !text.includes(x));
      if (text.length >= 2000 && missing.length === 0 && text.includes(`**编号：** ${s.id}`)) good += 1;
      else bad.push(`${s.id}(bytes=${text.length},sections_missing=${missing.length})`);
    }
    const rModule = {
      name: 'module_presence',
      ok: good === specs.length && good === 32 && bad.length === 0,
      detail: `${good}/${specs.length} 规范文件 >=2000B 且含 11 sections 与自身 ID${bad.length ? '; 未达标 ' + bad.slice(0, 4).join(',') + (bad.length > 4 ? '…' : '') : ''}`,
    };

    // dependency_integrity: independently recompute the dependency DAG.
    const byId = new Map(specs.map((s) => [s.id, s]));
    const state = new Map();
    let cycles = 0;
    const missingDeps = [];
    const visit = (id) => {
      if (state.get(id) === 'done') return;
      if (state.get(id) === 'visiting') { cycles += 1; return; }
      state.set(id, 'visiting');
      for (const d of byId.get(id)?.dependencies || []) {
        if (!byId.has(d)) missingDeps.push(`${id}->${d}`);
        else visit(d);
      }
      state.set(id, 'done');
    };
    for (const s of specs) visit(s.id);
    const depIds = ['registry.unique_ids', 'registry.dependencies_exist', 'registry.dependencies_acyclic'];
    const depOk = cycles === 0 && missingDeps.length === 0 && depIds.every((c) => regPass(registry, c));
    const rDep = {
      name: 'dependency_integrity', ok: depOk,
      detail: `自算依赖图 cycles=${cycles} missing_deps=${missingDeps.length}; ${depIds.map((c) => `${c}=${regPass(registry, c)}`).join(',')}`,
    };

    // interface_integrity: dynamically import real runtime modules, verify the
    // exported contract (component + health function). We do NOT invoke every
    // health() here because some runtime health probes have write side effects;
    // capability-to-run is proven independently by reliability/engineering
    // validators calling health() on safe modules.
    const mods = listFiles(rootPath('.uap/runtime'), { filter: (f) => f.endsWith('/index.mjs') })
      .filter((f) => !f.includes('/_lib/'));
    let ifaceOk = 0;
    const ifaceBad = [];
    for (const abs of mods) {
      try {
        const m = await import(`${pathToFileURL(abs).href}?t=${Date.now()}`);
        if (typeof m.component === 'string' && typeof m.health === 'function') ifaceOk += 1;
        else ifaceBad.push(abs.slice(ROOT.length + 1));
      } catch (e) { ifaceBad.push(`${abs.slice(ROOT.length + 1)}(${e.message})`); }
    }
    const rIface = {
      name: 'interface_integrity',
      ok: mods.length > 0 && ifaceBad.length === 0,
      detail: `动态 import ${mods.length} 个 runtime 模块, ${ifaceOk} 个导出 component+health()${ifaceBad.length ? '; 异常 ' + ifaceBad.slice(0, 3).join(',') : ''}`,
    };

    // Real subprocess run: recompute registryIntegrity in a fresh Node process.
    const url = pathToFileURL(rootPath('.uap/runtime/_lib/config.mjs')).href;
    const script = "const {loadAllConfigs,registryIntegrity}=await import('" + url + "');"
      + "const r=registryIntegrity(loadAllConfigs());"
      + "console.log(JSON.stringify({checks:r.checks.length,pass:r.checks.filter(c=>c.status==='PASS').length,findings:r.findings.length,ok:r.ok}));";
    const self = await selfCheck(script, 15000);
    const parsed = parseOut(self);
    const selfDetail = `node 子进程复跑 registryIntegrity: exit_code=${self.exit_code} timed_out=${self.timed_out} spawn_error=${self.spawn_error || 'none'} ${parsed ? `${parsed.pass}/${parsed.checks} checks` : 'stdout 不可解析'}`;
    // A command that failed to run / timed out must yield BLOCKED, never a fake PASS.
    const blockedByCmd = !cmdRan(self);
    return assemble('core.architecture_integrity', checks, [rModule, rDep, rIface], {
      started, registry, evidence_refs: evidenceIds, commands: [self], blocked: blockedByCmd,
      findings: parsed ? [] : [finding('BLOCKER', 'self_check_unparseable', selfDetail)],
      note: selfDetail,
    });
  },

  // UAP-00-002 : task_execution / dependency_order / bounded_retry
  'core.execution_integrity': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'core.execution_integrity');
    const store = readJSON(FILES.tasks, null);
    const tasks = store && typeof store.tasks === 'object' ? Object.values(store.tasks) : [];
    const succeeded = tasks.filter((t) => t && (t.state === 'SUCCEEDED' || t.status === 'SUCCEEDED'));

    const rTask = {
      name: 'task_execution',
      ok: succeeded.length > 0 && succeeded.some((t) => (t.evidence_refs || []).length > 0),
      detail: store ? `tasks.json: ${tasks.length} 任务, SUCCEEDED=${succeeded.length}, 含 evidence_refs 的 SUCCEEDED=${succeeded.filter((t) => (t.evidence_refs || []).length > 0).length}` : `缺少 ${FILES.tasks}`,
    };

    // dependency_order: replay every persisted state transition against TASK_TRANSITIONS.
    const target = succeeded[0] || tasks[0];
    const hist = target?.history || [];
    let illegal = 0;
    for (const h of hist) {
      const allowed = TASK_TRANSITIONS[h.from] || null;
      if (!allowed || !allowed.includes(h.to)) illegal += 1;
    }
    const rOrder = {
      name: 'dependency_order',
      ok: hist.length > 0 && illegal === 0 && (target?.state === 'SUCCEEDED' || target?.status === 'SUCCEEDED'),
      detail: `复核 ${target?.task_id || 'n/a'} 的 ${hist.length} 次迁移, 非法迁移=${illegal}, 终态=${target?.state || target?.status || 'n/a'}`,
    };

    // bounded_retry: real config value + persisted retry_count.
    const maxCfg = configs['execution-mapping'].execution?.max_repair_attempts_per_root_cause;
    const retryOk = succeeded.every((t) => (t.retry_count ?? 0) <= (t.max_retries ?? maxCfg ?? 3));
    const rRetry = {
      name: 'bounded_retry',
      ok: maxCfg === 3 && retryOk,
      detail: `execution.max_repair_attempts_per_root_cause=${maxCfg}; SUCCEEDED 任务 retry_count<=上限=${retryOk}`,
    };

    // Real subprocess run of the transition/result contract.
    const url = pathToFileURL(rootPath('.uap/runtime/_lib/contract.mjs')).href;
    const script = "const {TASK_TRANSITIONS,TASK_STATES,executorResult}=await import('" + url + "');"
      + "const terminal=['SUCCEEDED','CANCELLED'].every(s=>TASK_TRANSITIONS[s].length===0);"
      + "const er=executorResult({status:'SUCCEEDED'});"
      + "const shape=er.validation_results.length===0&&'changed_files' in er&&'evidence_refs' in er;"
      + "console.log(JSON.stringify({terminal,shape,states:TASK_STATES.length,ok:terminal&&shape}));";
    const self = await selfCheck(script, 15000);
    const parsed = parseOut(self);
    const selfDetail = `node 子进程复验 TASK_TRANSITIONS/executorResult: exit_code=${self.exit_code} ${parsed ? `terminal=${parsed.terminal} shape=${parsed.shape}` : 'stdout 不可解析'}`;
    const blocked = !store || !cmdRan(self);
    return assemble('core.execution_integrity', checks, [rTask, rOrder, rRetry], {
      started, registry, evidence_refs: evidenceIds, commands: [self], blocked,
      findings: parsed && parsed.ok === false ? [finding('BLOCKER', 'transition_contract_broken', selfDetail)] : [],
      note: `${selfDetail}${!store ? '; tasks.json 缺失 -> BLOCKED(未自行创建)' : ''}`,
    });
  },

  // UAP-00-004 : evidence_exists / state_validity / traceability
  'core.evidence_integrity': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'core.evidence_integrity');
    let engine = null;
    let importErr = null;
    try {
      engine = await import(`${pathToFileURL(rootPath('.uap/runtime/evidence-engine/index.mjs')).href}?t=${Date.now()}`);
    } catch (e) { importErr = e.message; }

    let ids = [];
    let valid = 0;
    let immutabilityRejected = false;
    let traced = 0;
    if (engine) {
      ids = engine.list();
      for (const id of ids) if (engine.verify(id).valid === true) valid += 1;
      const one = ids[0];
      if (one) {
        const rec = engine.get(one);
        if (rec && rec.environment && rec.environment.node && rec.recorded_at) traced += 1;
        // Evidence is append-only: a second write with the same ID must throw
        // (this call does NOT create a file because writeEvidence rejects it).
        try { engine.record({ evidence_id: one, kind: 'overwrite_probe' }); }
        catch { immutabilityRejected = true; }
      }
    }
    const rExists = {
      name: 'evidence_exists', ok: ids.length > 0 && valid > 0,
      detail: importErr ? `evidence-engine import 失败: ${importErr}` : `list()=${ids.length} 条, verify().valid=true 的=${valid} 条`,
    };
    const rState = {
      name: 'state_validity', ok: immutabilityRejected,
      detail: `对已存在证据重复 record() 覆盖被拒绝(append-only)=${immutabilityRejected}; content_hash 由 verify() 重算比对`,
    };
    const rTrace = {
      name: 'traceability', ok: traced > 0,
      detail: `证据记录含 environment.node/recorded_at 可追溯字段=${traced}/${ids.length}`,
    };
    const blocked = ids.length === 0;
    return assemble('core.evidence_integrity', checks, [rExists, rState, rTrace], {
      started, registry, evidence_refs: evidenceIds, blocked,
      note: blocked ? '当前 .uap/evidence 无持久化证据, 未自行创建以免伪造 PASS -> BLOCKED' : `evidence-engine.list()/verify()/get()/record(覆盖) 真实调用, 验证 ${valid} 条 hash`,
    });
  },
};

export function health() {
  const configs = loadAllConfigs();
  const registry = registryIntegrity(configs);
  const ids = Object.keys(validators);
  const declared = validatorById(configs);
  const mapped = ids.every((id) => declared.has(id));
  const runtimeOk = exists(rootPath('.uap/runtime/_lib/contract.mjs')) && exists(rootPath('.uap/runtime/evidence-engine/index.mjs'));
  const execCount = Object.keys(executorEntries(configs)).length;
  return {
    component,
    ok: mapped && runtimeOk && ids.length === 3,
    checks: {
      validators_exported: ids.length,
      all_mapped_to_registry: mapped,
      runtime_lib_present: runtimeOk,
      executor_entries: execCount,
      registry_ok: registry.ok,
    },
    summary: `core 导出 ${ids.length} 个验证器; registry ${registry.checks.filter((c) => c.status === 'PASS').length}/${registry.checks.length}; executor_entries=${execCount}`,
    checked_at: new Date().toISOString(),
  };
}
