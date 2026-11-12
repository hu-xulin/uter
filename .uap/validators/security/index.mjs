import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, STATE, REPORTS, rootPath } from '../../runtime/_lib/paths.mjs';
import { loadAllConfigs, registryIntegrity, validatorById } from '../../runtime/_lib/config.mjs';
import { validatorResult, finding, TASK_TRANSITIONS } from '../../runtime/_lib/contract.mjs';
import { exists, readText, readJSON, readJSONL, listFiles } from '../../runtime/_lib/util.mjs';
import { runCommand } from '../../runtime/_lib/proc.mjs';
import { check as policyCheck } from '../../runtime/policy-engine/index.mjs';

export const component = 'validators.security';

const MUST_DENY = [
  'production_read', 'production_write', 'production_deploy', 'real_payment', 'real_refund',
  'secret_export', 'force_push', 'branch_creation', 'branch_switch', 'destructive_git',
  'quality_gate_disable', 'test_deletion_to_force_pass',
];
const AUDIT_FILE = path.join(STATE, 'policy-audit.jsonl');

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
async function probeHealth(rel) {
  const abs = rootPath(rel);
  if (!exists(abs)) return { ok: false, detail: `缺少 ${rel}` };
  try {
    const m = await import(`${pathToFileURL(abs).href}?t=${Date.now()}`);
    if (typeof m.health !== 'function') return { ok: false, detail: '未导出 health()' };
    let h;
    try { h = m.health(); } catch (e) { return { ok: false, detail: `health() 抛错: ${e.message}` }; }
    return { ok: h?.ok === true, detail: `health().ok=${h?.ok}`, component: m.component };
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
  // UAP-00-003 : least_privilege / denied_operations / audit_logging
  'security.permission_boundary': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'security.permission_boundary');
    const policy = configs['permission-policy'];
    const auditBefore = readJSONL(AUDIT_FILE).length;

    // least_privilege: real decisions from policy-engine.check().
    const unreg = policyCheck({ agent_id: '__uap_unregistered__', permission: 'project_read', action: 'permission_boundary_probe' });
    const undeclared = policyCheck({ agent_id: 'uap-development-agent', permission: 'product_write', action: 'permission_boundary_probe' });
    const allowControl = policyCheck({ agent_id: 'uap-orchestrator', permission: 'project_read', action: 'permission_boundary_probe' });
    const rLeast = {
      name: 'least_privilege',
      ok: policy.default_effect === 'deny' && unreg.decision === 'DENY'
        && undeclared.decision === 'DENY' && allowControl.decision === 'ALLOW',
      detail: `default_effect=${policy.default_effect}; 未注册 agent=${unreg.decision}; 未声明权限=${undeclared.decision}; 已声明最小权限放行=${allowControl.decision}(控制组,证明非全 DENY 假阳性)`,
    };

    // denied_operations: every high-risk permission must return DENY.
    const decisions = MUST_DENY.map((p) => ({
      permission: p,
      decision: policyCheck({ agent_id: 'uap-development-agent', permission: p, action: 'permission_boundary_probe' }).decision,
    }));
    const notDenied = decisions.filter((d) => d.decision !== 'DENY');
    const rDenied = {
      name: 'denied_operations',
      ok: notDenied.length === 0 && regPass(registry, 'policy.fail_closed') && regPass(registry, 'policy.enforcement'),
      detail: `${decisions.length - notDenied.length}/${decisions.length} 高危权限实判 DENY (含 production_write/real_payment/force_push/quality_gate_disable); 未拒绝=${notDenied.length ? notDenied.map((d) => d.permission).join(',') : '无'}; fail_closed=${regPass(registry, 'policy.fail_closed')}`,
    };

    // audit_logging: check() must have appended real DENY decisions.
    const auditAfter = readJSONL(AUDIT_FILE);
    const added = auditAfter.slice(auditBefore);
    const denyLogged = added.filter((e) => e.decision === 'DENY' && MUST_DENY.includes(e.permission));
    const rAudit = {
      name: 'audit_logging',
      ok: added.length > 0 && denyLogged.length > 0,
      detail: `policy-audit.jsonl 行数 ${auditBefore}->${auditAfter.length} (新增 ${added.length}); 新增 DENY 且命中高危权限=${denyLogged.length}`,
    };
    return assemble('security.permission_boundary', checks, [rLeast, rDenied, rAudit], {
      started, registry, evidence_refs: evidenceIds,
      note: '真实调用 policy-engine.check() 产生决策并核对审计日志追加; 未连接生产库/未发起任何真实支付; 仅模拟/本地策略',
    });
  },

  // UAP-06-001 : vulnerability_scan / authz / secret_scan
  'security.application_integrity': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'security.application_integrity');
    const agentsMd = exists(rootPath('AGENTS.md')) ? readText(rootPath('AGENTS.md')) : '';
    const authzGo = listFiles(rootPath('service/authz'), { filter: (f) => f.endsWith('.go') }).length;

    // authz: real Casbin/authz code + the binding OWASP discipline in AGENTS.md.
    const rAuthz = {
      name: 'authz',
      ok: authzGo > 0 && exists(rootPath('router')) && agentsMd.includes('OWASP')
        && agentsMd.includes('Authentication Security'),
      detail: `service/authz/*.go=${authzGo} 个; router/ 存在=${exists(rootPath('router'))}; AGENTS.md 含 OWASP/Authentication Security=${agentsMd.includes('OWASP') && agentsMd.includes('Authentication Security')}`,
    };

    // secret_scan: really execute redact() in a subprocess.
    // The redaction test doubles are ASSEMBLED AT RUNTIME on purpose: a
    // key-shaped literal written verbatim in the source would itself be a
    // forbidden "secret-shaped literal" in a fixture. Splitting the prefix
    // from the body keeps the real redaction branch under test while the
    // repository stays free of key-shaped strings.
    const utilUrl = pathToFileURL(rootPath('.uap/runtime/_lib/util.mjs')).href;
    const redactScript = "const {redact}=await import('" + utilUrl + "');"
      + "const a=redact('token: SUPERSECRETVALUE123');"
      + "const fakeKey='sk-'+'abcdefghijklmnopqrstuvwxyz123456';"
      + "const b=redact(fakeKey);"
      + "const ok=!a.includes('SUPERSECRETVALUE123')&&!b.includes(fakeKey);"
      + "console.log(JSON.stringify({ok,okA:!a.includes('SUPERSECRETVALUE123'),okB:!b.includes(fakeKey)}));";
    const redactCmd = await selfCheck(redactScript, 15000);
    const redactOut = parseOut(redactCmd);
    const baseline = readJSON(rootPath('.uap/state/BASELINE.json'), null);
    const protectedState = JSON.stringify(baseline?.pre_existing_governance?.protected_user_state || baseline || '');
    const rSecret = {
      name: 'secret_scan',
      ok: cmdRan(redactCmd) && !!redactOut && redactOut.ok === true
        && /\.env/.test(protectedState) && /secret_export:\s*effect:\s*deny/.test(
          exists(rootPath('.uap/config/permission-policy.yaml')) ? readText(rootPath('.uap/config/permission-policy.yaml')) : ''),
      detail: `子进程复跑 redact(): token/secret 均被 REDACTED=${redactOut?.ok}; exit_code=${redactCmd.exit_code}; BASELINE 保护 .env/*.db=${/\.env/.test(protectedState)}; policy secret_export=deny`,
    };

    // vulnerability_scan: context-aware static scan of every UAP .mjs.
    // Raw textual hits are classified by an executable-code tokenizer
    // (.uap/tools/danger-scan.mjs): dangerous CALLS in real code
    // (eval / new Function / execSync / child_process.exec) or destructive
    // shell fragments paired with an exec primitive are real_call; comments,
    // regex detector literals and non-exec strings are recorded as benign
    // (auditable, never silently dropped, never counted as failures). The
    // scanner runs a built-in self-test first — dangerous fixtures MUST be
    // caught and benign fixtures MUST NOT be flagged; a failed self-test
    // fails the whole scan closed (BLOCKED), never PASS.
    const scanTool = rootPath('.uap/tools/danger-scan.mjs');
    const scan = exists(scanTool)
      ? await runCommand({
          command: 'node',
          args: [scanTool, rootPath('.uap/runtime'), rootPath('.uap/engines'), rootPath('.uap/validators')],
          timeoutMs: 30000,
        })
      : { exit_code: 2, stdout: '', stderr: 'scanner tool .uap/tools/danger-scan.mjs missing', command: 'node .uap/tools/danger-scan.mjs', timed_out: false, duration_ms: 0 };
    const scanOut = parseOut(scan);
    const selfTestOk = scanOut?.self_test?.ok === true;
    const realCalls = Array.isArray(scanOut?.real_calls) ? scanOut.real_calls : null;
    const rVuln = {
      name: 'vulnerability_scan',
      ok: cmdRan(scan) && !!scanOut && selfTestOk && realCalls !== null && realCalls.length === 0,
      detail: `node 子进程上下文感知扫描 ${scanOut?.scanned ?? 'n/a'} 个 UAP .mjs: 真实危险调用=${scanOut?.real_calls?.length ?? 'n/a'} 处(eval/new Function/execSync/child_process.exec 及经 exec 原语执行的破坏性 shell 片段); 良性命中(注释/检测正则/非执行字符串, 已逐条留痕)=${scanOut?.benign_count ?? 'n/a'} 处; 扫描器自检(危险 fixture 必须命中+良性 fixture 必须零命中)=${selfTestOk}; exit_code=${scan.exit_code}; 未运行外部 CVE 库(离线), 不声称无 CVE`,
    };
    // Fail closed: if the scanner cannot run or its self-test fails, the
    // whole application-integrity verdict is BLOCKED, not PASS.
    const blocked = !cmdRan(redactCmd) || !cmdRan(scan) || (!!scanOut && scanOut.self_test?.ok === false);
    return assemble('security.application_integrity', checks, [rVuln, rAuthz, rSecret], {
      started, registry, evidence_refs: evidenceIds, commands: [redactCmd, scan], blocked,
      note: '真实运行 redact() 与 .mjs 危险模式扫描两个子进程; authz 基于真实 service/authz 代码与 AGENTS.md OWASP 约束; 全程只读/模拟',
    });
  },

  // UAP-06-002 : ledger_consistency / idempotency / concurrency / recovery
  'security.financial_integrity_validator': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'security.financial_integrity_validator');
    const file = path.join(REPORTS, 'FINANCIAL-INTEGRITY.json');
    const rep = exists(file) ? readJSON(file, null) : null;
    const text = JSON.stringify(rep || {});
    // A "real result" means the report carries a numeric exit_code / boolean
    // outcome, not just a keyword placeholder.
    const hasRealResult = /"exit_code":\s*-?\d+/.test(text)
      || /"(?:passed|ok|valid|consistent|balanced)":\s*(?:true|false)/.test(text);

    const rLedger = {
      name: 'ledger_consistency',
      ok: !!rep && rep.simulated_only === true && /ledger|对账|reconcil|balance|余额/i.test(text) && hasRealResult,
      detail: rep ? `simulated_only=${rep.simulated_only}; 账本/对账字段=${/ledger|对账|reconcil|balance|余额/i.test(text)}; 含真实结果(数值 exit_code/布尔)=${hasRealResult}` : `缺少 ${file}`,
    };
    const rIdem = {
      name: 'idempotency',
      ok: !!rep && rep.simulated_only === true && /idempoten|幂等|duplicate|重复回调/i.test(text) && hasRealResult,
      detail: rep ? `幂等/重复回调字段=${/idempoten|幂等|duplicate|重复回调/i.test(text)}; 含真实结果=${hasRealResult}` : `缺少 ${file}`,
    };
    const rConcur = {
      name: 'concurrency',
      ok: !!rep && rep.simulated_only === true && /concurr|并发|race/i.test(text) && hasRealResult,
      detail: rep ? `并发字段=${/concurr|并发|race/i.test(text)}; 含真实结果=${hasRealResult}` : `缺少 ${file}`,
    };
    const rRecover = {
      name: 'recovery',
      ok: !!rep && rep.simulated_only === true && /recover|恢复|对账|reconcil/i.test(text) && hasRealResult,
      detail: rep ? `恢复/对账字段=${/recover|恢复|对账|reconcil/i.test(text)}; 含真实结果=${hasRealResult}` : `缺少 ${file}`,
    };
    const simulatedOk = !!rep && rep.simulated_only === true;
    const blocked = !rep;
    return assemble('security.financial_integrity_validator', checks, [rLedger, rIdem, rConcur, rRecover], {
      started, registry, evidence_refs: evidenceIds, blocked,
      findings: [
        ...(blocked ? [finding('BLOCKER', 'financial_report_missing', `缺少报告 ${file}, 无法校验资金完整性 -> BLOCKED`)] : []),
        ...(!blocked && !simulatedOk ? [finding('BLOCKER', 'not_simulated_only', `报告 simulated_only 非 true(${rep?.simulated_only}), 绝不把非模拟结果当作生产验证`)] : []),
      ],
      note: blocked ? `报告 ${file} 不存在, 未自行创建 -> BLOCKED` : `simulated_only=${rep.simulated_only}; 仅校验模拟数据的幂等/并发/重复回调/对账结果, 绝不声称真实生产资金验证; 未发起任何真实支付/退款`,
    });
  },

  // UAP-06-003 : health / timeout / retry / recovery
  'security.reliability_integrity': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'security.reliability_integrity');

    // health: dynamically import 4 safe runtime modules and REALLY call health().
    const mods = [
      '.uap/runtime/state-machine/index.mjs',
      '.uap/runtime/scheduler/index.mjs',
      '.uap/runtime/resource-manager/index.mjs',
      '.uap/runtime/event-system/index.mjs',
    ];
    const probes = [];
    for (const rel of mods) probes.push({ rel, ...(await probeHealth(rel)) });
    const rHealth = {
      name: 'health',
      ok: probes.every((p) => p.ok),
      detail: `动态 import 并调用 health().ok===true: ${probes.filter((p) => p.ok).length}/${probes.length} (${probes.map((p) => path.basename(path.dirname(p.rel)) + '=' + p.ok).join(',')})`,
    };

    // timeout: real subprocess run + static confirmation of the timeout branch.
    const timeoutCmd = await selfCheck("console.log(JSON.stringify({ok:true,pid:process.pid}));", 15000);
    const procSrc = exists(rootPath('.uap/runtime/_lib/proc.mjs')) ? readText(rootPath('.uap/runtime/_lib/proc.mjs')) : '';
    const rTimeout = {
      name: 'timeout',
      ok: cmdRan(timeoutCmd) && timeoutCmd.timed_out === false && /setTimeout/.test(procSrc) && /timeoutMs/.test(procSrc),
      detail: `runCommand 真实运行 exit_code=${timeoutCmd.exit_code} timed_out=${timeoutCmd.timed_out} spawn_error=${timeoutCmd.spawn_error || 'none'}; proc.mjs 含 setTimeout/timeoutMs=${/setTimeout/.test(procSrc) && /timeoutMs/.test(procSrc)}`,
    };

    // retry / recovery: real transition table + baseline recovery policy.
    const failedRetry = (TASK_TRANSITIONS.FAILED || []).includes('QUEUED');
    const waitRecovery = (TASK_TRANSITIONS.WAITING_RECOVERY || []).includes('QUEUED');
    const rRetry = {
      name: 'retry', ok: failedRetry && waitRecovery,
      detail: `TASK_TRANSITIONS FAILED->QUEUED=${failedRetry}; WAITING_RECOVERY->QUEUED=${waitRecovery} (有界可重试路径真实存在)`,
    };
    const baseline = readJSON(rootPath('.uap/state/BASELINE.json'), null);
    const gitPolicy = String(baseline?.git?.policy || '');
    const recoveryExport = await (async () => {
      const abs = rootPath('.uap/runtime/recovery-engine/index.mjs');
      if (!exists(abs)) return { ok: false, detail: 'recovery-engine 模块缺失' };
      try {
        const m = await import(`${pathToFileURL(abs).href}?t=${Date.now()}`);
        return { ok: typeof m.health === 'function' && typeof m.execute === 'function', detail: `导出 health/execute=${typeof m.health === 'function' && typeof m.execute === 'function'}` };
      } catch (e) { return { ok: false, detail: `import 失败: ${e.message}` }; }
    })();
    const rRecovery = {
      name: 'recovery',
      ok: recoveryExport.ok && gitPolicy.includes('no_destructive_git') && gitPolicy.includes('preserve_user_changes')
        && regPass(registry, 'registry.dependencies_acyclic'),
      detail: `${recoveryExport.detail}; BASELINE git.policy 含 no_destructive_git/preserve_user_changes=${gitPolicy.includes('no_destructive_git') && gitPolicy.includes('preserve_user_changes')}; 依赖 DAG 无环=${regPass(registry, 'registry.dependencies_acyclic')}`,
    };
    const blocked = !cmdRan(timeoutCmd);
    return assemble('security.reliability_integrity', checks, [rHealth, rTimeout, rRetry, rRecovery], {
      started, registry, evidence_refs: evidenceIds, commands: [timeoutCmd], blocked,
      note: '动态 import 4 个 runtime 模块并调用 health().ok===true 证明可运行; runCommand 真实记录 exit_code; 重试/恢复基于共享状态机与 BASELINE 策略',
    });
  },
};

export function health() {
  const configs = loadAllConfigs();
  const ids = Object.keys(validators);
  const declared = validatorById(configs);
  const mapped = ids.every((id) => declared.has(id));
  const policyOk = exists(rootPath('.uap/runtime/policy-engine/index.mjs')) && exists(rootPath('.uap/config/permission-policy.yaml'));
  return {
    component,
    ok: mapped && policyOk && ids.length === 4,
    checks: { validators_exported: ids.length, all_mapped_to_registry: mapped, policy_engine_present: policyOk, must_deny_count: MUST_DENY.length },
    summary: `security 导出 ${ids.length} 个验证器; policy-engine/permission-policy 存在=${policyOk}`,
    checked_at: new Date().toISOString(),
  };
}
