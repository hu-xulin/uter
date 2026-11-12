import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, REPORTS, rootPath } from '../../runtime/_lib/paths.mjs';
import {
  loadAllConfigs, registryIntegrity, validatorById, executorEntries,
} from '../../runtime/_lib/config.mjs';
import { validatorResult, finding } from '../../runtime/_lib/contract.mjs';
import { exists, readText, readJSON } from '../../runtime/_lib/util.mjs';
import { runCommand } from '../../runtime/_lib/proc.mjs';
import { check as policyCheck } from '../../runtime/policy-engine/index.mjs';

export const component = 'validators.quality';

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
// Dynamically import an executor module and REALLY call health() to prove it
// can run, instead of treating "the file exists" as "the capability works".
async function probeHealth(rel) {
  const abs = rootPath(rel);
  if (!exists(abs)) return { present: false, ok: false, detail: `缺少 ${rel}` };
  try {
    const m = await import(`${pathToFileURL(abs).href}?t=${Date.now()}`);
    if (typeof m.health !== 'function') return { present: true, ok: false, detail: '未导出 health()' };
    let h;
    try { h = m.health(); } catch (e) { return { present: true, ok: false, detail: `health() 抛错: ${e.message}` }; }
    return { present: true, ok: h?.ok === true, component: m.component, detail: `health().ok=${h?.ok}` };
  } catch (e) { return { present: true, ok: false, detail: `import 失败: ${e.message}` }; }
}
// Reports may be a bare array or wrapped under runs/tests/records.
function reportRecords(raw) {
  if (Array.isArray(raw)) return raw;
  for (const k of ['runs', 'tests', 'records', 'gates', 'results']) {
    if (Array.isArray(raw?.[k])) return raw[k];
  }
  return [];
}
function readReport(file) {
  if (!exists(file)) return { present: false, raw: null, records: [] };
  const raw = readJSON(file, null);
  return { present: true, raw, records: reportRecords(raw) };
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
  // UAP-05-001 : review_engine / test_engine / repair_engine / gates
  'quality.engineering_integrity': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'quality.engineering_integrity');
    const execs = executorEntries(configs);
    const targets = [
      { check: 'review_engine', key: 'development.code_review' },
      { check: 'test_engine', key: 'quality.testing' },
      { check: 'repair_engine', key: 'quality.auto_repair' },
      { check: 'gates', key: 'quality.gates' },
    ];
    const results = [];
    let anyMissing = false;
    for (const t of targets) {
      const rel = execs[t.key];
      const p = rel ? await probeHealth(rel) : { present: false, ok: false, detail: `execution-mapping 无 ${t.key}` };
      if (!p.present) anyMissing = true;
      results.push({
        name: t.check, ok: p.ok,
        detail: `动态 import ${rel || 'n/a'} 并调用 health(): ${p.detail}`,
      });
    }
    // Missing engine files mean we cannot PROVE the capability runs -> BLOCKED.
    const allOk = results.every((r) => r.ok);
    return assemble('quality.engineering_integrity', checks, results, {
      started, registry, evidence_refs: evidenceIds,
      blocked: anyMissing && !allOk,
      note: anyMissing ? '引擎实现文件缺失, 无法调用 health() 证明可运行 -> BLOCKED(未把"文件存在/已登记"当作能力运行)' : '4 个引擎均动态 import 且 health().ok===true',
    });
  },

  // UAP-05-002 : test_execution / failure_propagation / evidence
  'quality.test_integrity': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'quality.test_integrity');
    const file = path.join(REPORTS, 'TEST-RUNS.json');
    const rep = readReport(file);
    const recs = rep.records;

    const rExec = {
      name: 'test_execution',
      ok: rep.present && recs.length > 0
        && recs.every((x) => typeof x?.command === 'string' && x.command.length > 0)
        && recs.every((x) => typeof x?.exit_code === 'number' && Number.isFinite(x.exit_code)),
      detail: rep.present ? `TEST-RUNS.json ${recs.length} 条; 每条含 command 字符串=${recs.every((x) => typeof x?.command === 'string' && x.command.length > 0)}; exit_code 均为数值=${recs.every((x) => typeof x?.exit_code === 'number' && Number.isFinite(x.exit_code))}` : `缺少 ${file}`,
    };
    const failed = recs.filter((x) => typeof x?.exit_code === 'number' && x.exit_code !== 0);
    const swallowed = recs.filter((x) => x?.status === 'PASS' && typeof x?.exit_code === 'number' && x.exit_code !== 0);
    const rFail = {
      name: 'failure_propagation',
      ok: rep.present && swallowed.length === 0 && failed.every((x) => x.status !== 'PASS'),
      detail: rep.present ? `非零 exit_code 记录=${failed.length} 条; 被伪装为 PASS 的=${swallowed.length} 条; 非零 exit_code 均如实保留=${failed.every((x) => x.status !== 'PASS')}` : `缺少 ${file}`,
    };
    const withEv = recs.filter((x) => Array.isArray(x?.evidence_refs) ? x.evidence_refs.length > 0 : (!!x?.evidence_id || !!x?.evidence));
    const rEv = {
      name: 'evidence',
      ok: rep.present && withEv.length > 0,
      detail: rep.present ? `含证据引用(evidence_refs/evidence_id/evidence)的记录=${withEv.length}/${recs.length}` : `缺少 ${file}`,
    };
    const blocked = !rep.present;
    return assemble('quality.test_integrity', checks, [rExec, rFail, rEv], {
      started, registry, evidence_refs: evidenceIds, blocked,
      findings: blocked ? [finding('BLOCKER', 'test_report_missing', `缺少报告 ${file}, 无法校验测试执行记录 -> BLOCKED`)] : [],
      note: blocked ? `报告 ${file} 不存在, 未自行创建 -> BLOCKED; 绝不因"未发现失败"而判 PASS` : '逐条校验 command + 数值型 exit_code + 失败不被吞 + 证据引用',
    });
  },

  // UAP-05-003 : root_cause / bounded_retry / regression
  'quality.repair_integrity': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'quality.repair_integrity');
    const ex = configs['execution-mapping'].execution || {};
    const fp = configs['execution-mapping'].execution_contract?.failure_policy || {};
    const baseline = readJSON(rootPath('.uap/state/BASELINE.json'), null);

    const rRoot = {
      name: 'root_cause',
      ok: fp.retryable === 'bounded_retry' && fp.permission_denied === 'block'
        && fp.missing_dependency === 'block' && fp.unrecoverable === 'fail',
      detail: `failure_policy retryable=${fp.retryable} permission_denied=${fp.permission_denied} missing_dependency=${fp.missing_dependency} unrecoverable=${fp.unrecoverable} (按根因分类)`,
    };

    const max = ex.max_repair_attempts_per_root_cause;
    const url = pathToFileURL(rootPath('.uap/runtime/_lib/contract.mjs')).href;
    const self = await selfCheck(
      "const {TASK_TRANSITIONS}=await import('" + url + "');"
      + "const max=" + Number(max || 0) + ";"
      + "const retryPath=(TASK_TRANSITIONS.FAILED||[]).includes('QUEUED');"
      + "const bounded=Number.isFinite(max)&&max>0&&max<=3;"
      + "console.log(JSON.stringify({max,retryPath,bounded,ok:retryPath&&bounded}));", 15000);
    const out = parseOut(self);
    const rBounded = {
      name: 'bounded_retry',
      ok: cmdRan(self) && !!out && out.ok === true && max === 3,
      detail: `max_repair_attempts_per_root_cause=${max}; 子进程复验 FAILED->QUEUED 重试路径存在=${out?.retryPath} 且有界(<=3)=${out?.bounded}; exit_code=${self.exit_code}`,
    };

    const rRegression = {
      name: 'regression',
      ok: exists(rootPath('scripts/verify-all.sh')) && exists(rootPath('.github/workflows/ci.yml'))
        && ex.preserve_user_changes === true && fp.validation_failed === 'repair_then_revalidate'
        && Array.isArray(baseline?.git?.modified_tracked_files) && baseline.git.modified_tracked_files.length === 0,
      detail: `回归入口 verify-all.sh/ci.yml 存在=${exists(rootPath('scripts/verify-all.sh')) && exists(rootPath('.github/workflows/ci.yml'))}; preserve_user_changes=${ex.preserve_user_changes}; validation_failed=${fp.validation_failed}; BASELINE 已改跟踪文件=${baseline?.git?.modified_tracked_files?.length ?? 'n/a'}`,
    };
    const blocked = !cmdRan(self);
    return assemble('quality.repair_integrity', checks, [rRoot, rBounded, rRegression], {
      started, registry, evidence_refs: evidenceIds, commands: [self], blocked,
      note: '真实读取 execution-mapping 失败策略/重试上限 + node 子进程复验重试路径有界 + 回归门禁入口; 不调用 auto-repair 引擎 execute()',
    });
  },

  // UAP-05-004 : gate_execution / blocking / bypass_detection
  'quality.gate_integrity': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'quality.gate_integrity');
    const file = path.join(REPORTS, 'QUALITY-GATES.json');
    const rep = readReport(file);
    const recs = rep.records;

    const rExec = {
      name: 'gate_execution',
      ok: rep.present && recs.length > 0
        && recs.every((x) => typeof x?.command === 'string' && x.command.length > 0)
        && recs.every((x) => typeof x?.exit_code === 'number' && Number.isFinite(x.exit_code)),
      detail: rep.present ? `QUALITY-GATES.json ${recs.length} 条; 每条含 command=${recs.every((x) => typeof x?.command === 'string' && x.command.length > 0)}; exit_code 均为数值=${recs.every((x) => typeof x?.exit_code === 'number' && Number.isFinite(x.exit_code))}` : `缺少 ${file}`,
    };

    const url = pathToFileURL(rootPath('.uap/runtime/_lib/contract.mjs')).href;
    const self = await selfCheck(
      "const {validatorResult,finding}=await import('" + url + "');"
      + "const a=validatorResult({validator_id:'g',status:'PASS',executed:true,exit_code:0,findings:[finding('BLOCKER','b','b')]});"
      + "const b=validatorResult({validator_id:'g',status:'PASS',executed:true,exit_code:0,findings:[finding('MAJOR','m','m')]});"
      + "console.log(JSON.stringify({blocking:a.status==='FAIL'&&b.status==='PASS',ok:a.status==='FAIL'&&b.status==='PASS'}));", 15000);
    const out = parseOut(self);
    const swallowed = recs.filter((x) => x?.status === 'PASS' && typeof x?.exit_code === 'number' && x.exit_code !== 0);
    const rBlocking = {
      name: 'blocking',
      ok: cmdRan(self) && !!out && out.blocking === true && rep.present && swallowed.length === 0,
      detail: `子进程复验 BLOCKER 降级 PASS->FAIL / MAJOR 不阻断=${out?.blocking}; 报告中非零 exit_code 被伪装为 PASS 的=${swallowed.length} 条`,
    };

    // Bypass detection: real config + real policy-engine.check() decisions.
    const policyText = exists(rootPath('.uap/config/permission-policy.yaml')) ? readText(rootPath('.uap/config/permission-policy.yaml')) : '';
    const denyDeclared = /quality_gate_disable:\s*effect:\s*deny/.test(policyText)
      && /test_deletion_to_force_pass:\s*effect:\s*deny/.test(policyText);
    let d1 = null, d2 = null;
    try {
      d1 = policyCheck({ agent_id: 'uap-development-agent', permission: 'quality_gate_disable', action: 'gate_integrity_probe' });
      d2 = policyCheck({ agent_id: 'uap-development-agent', permission: 'test_deletion_to_force_pass', action: 'gate_integrity_probe' });
    } catch { /* recorded below */ }
    const rBypass = {
      name: 'bypass_detection',
      ok: denyDeclared && d1?.decision === 'DENY' && d2?.decision === 'DENY' && regPass(registry, 'policy.fail_closed')
        && regPass(registry, 'registry.validator_checks'),
      detail: `policy 声明两个绕过权限 deny=${denyDeclared}; check() 实判 quality_gate_disable=${d1?.decision} test_deletion_to_force_pass=${d2?.decision}; fail_closed=${regPass(registry, 'policy.fail_closed')}`,
    };
    const blocked = !rep.present || !cmdRan(self);
    return assemble('quality.gate_integrity', checks, [rExec, rBlocking, rBypass], {
      started, registry, evidence_refs: evidenceIds, commands: [self], blocked,
      findings: !rep.present ? [finding('BLOCKER', 'gate_report_missing', `缺少报告 ${file}, 无法校验门禁执行记录 -> BLOCKED`)] : [],
      note: !rep.present ? `报告 ${file} 不存在, 未自行创建 -> BLOCKED; 绝不因"无失败记录"判 PASS` : '逐条校验 command + 数值 exit_code; 真实复验 BLOCKER 阻断 + policy check() 拒绝门禁绕过',
    });
  },
};

export function health() {
  const configs = loadAllConfigs();
  const ids = Object.keys(validators);
  const declared = validatorById(configs);
  const mapped = ids.every((id) => declared.has(id));
  const reportsDir = exists(REPORTS);
  return {
    component,
    ok: mapped && reportsDir && ids.length === 4,
    checks: { validators_exported: ids.length, all_mapped_to_registry: mapped, reports_dir_present: reportsDir },
    summary: `quality 导出 ${ids.length} 个验证器; .uap/reports 目录存在=${reportsDir}`,
    checked_at: new Date().toISOString(),
  };
}
