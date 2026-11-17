import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, rootPath } from '../../runtime/_lib/paths.mjs';
import { loadAllConfigs, registryIntegrity, validatorById } from '../../runtime/_lib/config.mjs';
import { validatorResult, finding } from '../../runtime/_lib/contract.mjs';
import { exists, readText, readJSON } from '../../runtime/_lib/util.mjs';
import { runCommand } from '../../runtime/_lib/proc.mjs';
import { check as policyCheck } from '../../runtime/policy-engine/index.mjs';

export const component = 'validators.delivery';

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

export function classifyDeploymentRehearsal(cmd, rehearsal) {
  if (!cmd || cmd.spawn_error || cmd.timed_out || !Number.isInteger(cmd.exit_code)) {
    return { status: 'FAIL', reason: 'deployment rehearsal process did not complete normally' };
  }
  const explicitPreflightBlock = cmd.exit_code === 1
    && rehearsal?.blocked === true
    && rehearsal.error == null
    && rehearsal.reason === 'preflight: real release artifacts incomplete'
    && Array.isArray(rehearsal.steps)
    && rehearsal.steps.some((step) => step.name === 'preflight_artifacts' && step.ok === false);
  if (explicitPreflightBlock) {
    return { status: 'BLOCKED', reason: rehearsal.reason };
  }
  if (cmd.exit_code !== 0 || !rehearsal || rehearsal.error
    || !rehearsal.verdict || typeof rehearsal.verdict !== 'object' || Array.isArray(rehearsal.verdict)) {
    return { status: 'FAIL', reason: rehearsal?.error || 'deployment rehearsal returned no valid verdict' };
  }
  return { status: 'EXECUTED', reason: 'deployment rehearsal returned a structured verdict' };
}
async function probeHealth(rel) {
  const abs = rootPath(rel);
  if (!exists(abs)) return { ok: false, detail: `缺少 ${rel}` };
  try {
    const m = await import(`${pathToFileURL(abs).href}?t=${Date.now()}`);
    if (typeof m.health !== 'function') return { ok: false, detail: '未导出 health()' };
    let h;
    try { h = m.health(); } catch (e) { return { ok: false, detail: `health() 抛错: ${e.message}` }; }
    return { ok: h?.ok === true, detail: `health().ok=${h?.ok}`, exports: typeof m.publish === 'function' };
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
    block_category: opts.block_category || null,
  });
}

export const validators = {
  // UAP-08-001 : pipeline_config / local_equivalent / failure_propagation
  'delivery.ci_integrity': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'delivery.ci_integrity');
    const ci = exists(rootPath('.github/workflows/ci.yml')) ? readText(rootPath('.github/workflows/ci.yml')) : '';
    const verify = exists(rootPath('scripts/verify-all.sh')) ? readText(rootPath('scripts/verify-all.sh')) : '';
    const baseline = readJSON(rootPath('.uap/state/BASELINE.json'), null);
    const gateCommands = baseline?.real_gate_commands || [];
    const workflows = baseline?.project?.ci_workflows || [];

    // Gate coverage is checked per gate family, not by a magic string:
    // every real gate from BASELINE.real_gate_commands must be enforced by
    // ci.yml OR scripts/verify-all.sh, the core gates must live in ci.yml
    // itself, and failures must propagate with a non-zero exit. ci.yml is
    // deliberately self-contained (it does not invoke verify-all.sh), while
    // format:check is intentionally CI-optional per the comment in ci.yml —
    // so demanding a literal 'verify-all' token would be a false requirement.
    const gateFamilies = [
      { id: 'gofmt', re: /gofmt -l/, core: true },
      { id: 'go vet (4 modules)', re: /go vet \.\/\.\.\./, core: true },
      { id: 'make test', re: /make test/, core: true },
      { id: 'bun run typecheck', re: /bun run typecheck/, core: true },
      { id: 'bun run lint', re: /bun run lint[^:]/, core: true },
      { id: 'bun run test', re: /bun run test\b/, core: true },
      { id: 'bun run lint:design:strict', re: /lint:design:strict/, core: false },
      { id: 'bun run copyright:check', re: /copyright:check/, core: false },
      { id: 'bun run format:check', re: /format:check/, core: false },
      { id: 'bun run build:check', re: /build:check/, core: false },
    ];
    const gateCov = gateFamilies.map((f) => ({ id: f.id, core: f.core, in_ci: f.re.test(ci), in_verify: f.re.test(verify) }));
    const allCovered = gateCov.every((f) => f.in_ci || f.in_verify);
    const coreInCi = gateCov.filter((f) => f.core).every((f) => f.in_ci);
    const missingCore = gateCov.filter((f) => f.core && !f.in_ci).map((f) => f.id);
    const missingAll = gateCov.filter((f) => !f.in_ci && !f.in_verify).map((f) => f.id);
    const rPipeline = {
      name: 'pipeline_config',
      ok: ci.length > 0 && allCovered && coreInCi && workflows.length >= 5
        && exists(rootPath('.github/workflows/release-gate.yml')),
      detail: `门禁族覆盖: 核心[${gateCov.filter((f) => f.core).map((f) => `${f.id}=ci:${f.in_ci}`).join(', ')}] 其余[${gateCov.filter((f) => !f.core).map((f) => `${f.id}=${f.in_ci ? 'ci' : (f.in_verify ? 'verify-all' : 'MISSING')}`).join(', ')}]; ci.yml 缺失核心=${missingCore.length ? missingCore.join(',') : '无'}; ci+verify 均缺=${missingAll.length ? missingAll.join(',') : '无'}; ci.yml bytes=${ci.length}; BASELINE.ci_workflows=${workflows.length} 个; release-gate.yml=${exists(rootPath('.github/workflows/release-gate.yml'))}`,
    };
    const agentsMd = exists(rootPath('AGENTS.md')) ? readText(rootPath('AGENTS.md')) : '';
    const rLocal = {
      name: 'local_equivalent',
      ok: verify.length > 0 && gateCommands.length >= 5 && agentsMd.includes('./scripts/verify-all.sh'),
      detail: `verify-all.sh bytes=${verify.length}; BASELINE.real_gate_commands=${gateCommands.length} 条; AGENTS.md 声明 verify-all.sh=${agentsMd.includes('./scripts/verify-all.sh')}`,
    };
    const rFail = {
      name: 'failure_propagation',
      ok: /exit 1/.test(ci) && /exit/.test(verify)
        && gateCommands.some((c) => /go vet|make test/.test(c)) && gateCommands.some((c) => /bun run/.test(c)),
      detail: `ci.yml 含 exit 1=${/exit 1/.test(ci)}; verify-all.sh 含 exit 非零传播=${/exit/.test(verify)}; 真实门禁命令覆盖 go/前端=${gateCommands.some((c) => /go vet|make test/.test(c)) && gateCommands.some((c) => /bun run/.test(c))}`,
    };
    return assemble('delivery.ci_integrity', checks, [rPipeline, rLocal, rFail], {
      started, registry, evidence_refs: evidenceIds,
      note: '真实读取 .github/workflows/ci.yml、scripts/verify-all.sh、BASELINE 门禁命令清单并核对失败非零退出传播',
    });
  },

  // UAP-08-002 : deployment_plan / rollback_plan / health_check
  // REAL release rehearsal authorized by the user (recorded in
  // .uap/config/deployment-authorization.json). The rehearsal drives
  // .uap/tools/deploy-dry-run.mjs: real artifact manifest (sha256 per file),
  // version advance computation, publish-slot integrity, LIVE health probe of
  // the running release, and a byte-identical rollback restoration. Policy
  // production_deploy/production_write stay DENY for agents (defense in
  // depth). Without a valid authorization record this validator stays
  // BLOCKED(AUTHORIZATION_REQUIRED) — fail-closed.
  'delivery.deployment_integrity': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'delivery.deployment_integrity');
    const ex = configs['execution-mapping'].execution || {};
    const baseline = readJSON(rootPath('.uap/state/BASELINE.json'), null);
    const workflows = baseline?.project?.ci_workflows || [];
    const adrReadme = exists(rootPath('docs/adr/README.md')) ? readText(rootPath('docs/adr/README.md')) : '';
    const changeReg = exists(rootPath('docs/product/registry/change-registry.yaml'))
      ? readText(rootPath('docs/product/registry/change-registry.yaml')) : '';
    const gitPolicy = String(baseline?.git?.policy || '');

    // --- authorization gate (fail-closed) ---
    const authRel = '.uap/config/deployment-authorization.json';
    const auth = readJSON(rootPath(authRel), null);
    const authFields = ['authorization_id', 'authorized_by', 'authorized_at', 'scope', 'boundaries', 'valid_until'];
    const authComplete = !!auth && authFields.every((k) => auth[k] != null)
      && Array.isArray(auth.scope) && auth.scope.length > 0 && Array.isArray(auth.boundaries) && auth.boundaries.length > 0;
    const authValid = authComplete && (!auth.valid_until || new Date(auth.valid_until) > new Date());

    // Real policy decisions: agents still cannot deploy to production.
    let deploy = null, write = null;
    try {
      deploy = policyCheck({ agent_id: 'uap-delivery-agent', permission: 'production_deploy', action: 'deployment_integrity_probe' });
      write = policyCheck({ agent_id: 'uap-delivery-agent', permission: 'production_write', action: 'deployment_integrity_probe' });
    } catch { /* recorded below */ }
    const policyDeny = deploy?.decision === 'DENY' && write?.decision === 'DENY' && ex.dry_run_for_production === true;

    if (!authValid) {
      return assemble('delivery.deployment_integrity', checks, [], {
        started, registry, evidence_refs: evidenceIds, blocked: true, block_category: 'AUTHORIZATION_REQUIRED',
        findings: [
          finding('MAJOR', 'deployment_plan_static_only', '仅核对部署/回滚/健康检查的静态配置与本地门禁入口, 未执行任何生产部署'),
          finding('BLOCKER', 'production_deployment_unauthorized',
            `生产部署授权缺失或无效(${authRel}: 存在=${!!auth}, 字段完整=${authComplete}, 有效期内=${authValid}); policy production_deploy=${deploy?.decision} production_write=${write?.decision}; -> BLOCKED(受限项), 未报告"生产已验证"`),
        ],
        commands: [],
        note: `BLOCKED 受限项: 无有效授权记录(存在=${!!auth}); 绝不把 CI/本地通过当作生产已验证`,
      });
    }

    // --- authorized: run the REAL rehearsal ---
    const toolRel = '.uap/tools/deploy-dry-run.mjs';
    const cmd = await runCommand({ command: 'node', args: [rootPath(toolRel)], timeoutMs: 120000 });
    // Only stdout from this invocation is authoritative. Never fall back to a
    // previous DEPLOY-DRY-RUN.json, which could turn a tool failure into BLOCKED.
    const rehearsal = parseOut(cmd);
    const classification = classifyDeploymentRehearsal(cmd, rehearsal);

    if (classification.status === 'BLOCKED') {
      return assemble('delivery.deployment_integrity', checks, [], {
        started, registry, evidence_refs: evidenceIds, commands: [cmd],
        blocked: true, block_category: 'ENVIRONMENT_UNAVAILABLE',
        findings: [finding('BLOCKER', 'deploy_environment_unavailable',
          `发布演练前置环境不完整: ${String(classification.reason).slice(0, 180)}; 不将环境缺失伪装为代码能力 FAIL`)],
        note: 'BLOCKED: 本次工具调用明确报告真实构建产物缺失; 旧报告不会作为回退证据',
      });
    }
    if (classification.status === 'FAIL') {
      return assemble('delivery.deployment_integrity', checks, [
        { name: 'deployment_plan', ok: false, detail: `授权在案(${auth.authorization_id})但演练工具故障(exit=${cmd.exit_code}, stderr=${(cmd.stderr || '').slice(0, 120)}): ${classification.reason} — fail-closed FAIL` },
      ], {
        started, registry, evidence_refs: evidenceIds, commands: [cmd],
        findings: [finding('BLOCKER', 'deploy_rehearsal_tool_failure', '发布演练工具执行失败或未返回有效 verdict, 无法取证')],
        note: 'FAIL: 本次工具调用失败或输出无效; 不读取任何旧的 DEPLOY-DRY-RUN.json',
      });
    }

    const v = rehearsal.verdict;
    const stepOk = (n) => (rehearsal.steps || []).some((s) => s.name === n && s.ok === true);
    const results = [
      {
        name: 'deployment_plan',
        ok: v.deployment_plan === 'PASS' && stepOk('publish_manifest_integrity') && stepOk('preflight_artifacts'),
        detail: `真实演练: preflight(${(rehearsal.artifacts?.dist_files ?? '?')} 文件清单+二进制 sha256) + 版本推进 ${rehearsal.version?.current}→${rehearsal.version?.next_computed}(仅计算) + 发布槽逐文件 sha256 一致=${stepOk('publish_manifest_integrity')}; verdict.deployment_plan=${v.deployment_plan}`,
      },
      {
        name: 'rollback_plan',
        ok: v.rollback_plan === 'PASS' && stepOk('rollback_restores_previous_release'),
        detail: `真实回滚演练: 注入新版本标记→恢复上一槽位→逐文件 sha256==原构建且标记清除=${stepOk('rollback_restores_previous_release')}; 静态语义(ADR Superseded/Deprecated, change-registry snapshots, no_destructive_git)=${[/Superseded/.test(adrReadme) && /Deprecated/.test(adrReadme), /snapshots:/.test(changeReg), gitPolicy.includes('no_destructive_git')].every(Boolean)}; verdict.rollback_plan=${v.rollback_plan}`,
      },
      {
        name: 'health_check',
        ok: v.health_check === 'PASS' && stepOk('health_check_live'),
        detail: `对运行中发布实例真实探活: ${(rehearsal.steps || []).find((s) => s.name === 'health_check_live')?.detail || 'n/a'}; verdict.health_check=${v.health_check}`,
      },
    ];
    return assemble('delivery.deployment_integrity', checks, results, {
      started, registry, evidence_refs: evidenceIds,
      commands: [cmd],
      findings: results.filter((r) => !r.ok).map((r) => finding('BLOCKER', `deploy_${r.name}_fail`, r.detail))
        .concat(policyDeny ? [] : [finding('MAJOR', 'policy_guardrail_unexpected',
          `policy 纵深防御预期 DENY, 实际 production_deploy=${deploy?.decision} production_write=${write?.decision} dry_run=${ex.dry_run_for_production}`)]),
      note: `授权在案 ${auth.authorization_id}(用户 ${String(auth.authorized_by).slice(0, 40)}…, 有效期至 ${auth.valid_until}); 已执行真实发布演练(产物清单/版本推进/回滚恢复/健康探针, 全程本地只读+临时目录写入); policy 对 Agent 生产写入保持 DENY=${policyDeny}(纵深防御); 线上生产流水线执行超出本地环境与授权边界, 如实记录、不声明"生产已验证"`,
    });
  },

  // UAP-08-003 : structured_logs / traceability / secret_redaction
  'delivery.observability_integrity': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'delivery.observability_integrity');

    // structured_logs: really import event-system and call its health().
    const evProbe = await probeHealth('.uap/runtime/event-system/index.mjs');
    const rLogs = {
      name: 'structured_logs',
      ok: evProbe.ok && evProbe.exports === true,
      detail: `动态 import event-system 并调用 health().ok===true: ${evProbe.detail}; 导出 publish()=${evProbe.exports === true}`,
    };

    // traceability: a real command result carries started_at/duration/exit_code/cwd.
    const cmd = await selfCheck("console.log(JSON.stringify({ok:true}));", 15000);
    const traceFields = ['command', 'cwd', 'started_at', 'duration_ms', 'exit_code', 'timed_out'];
    const rTrace = {
      name: 'traceability',
      ok: cmdRan(cmd) && traceFields.every((k) => k in cmd),
      detail: `runCommand 真实返回含 ${traceFields.filter((k) => k in cmd).length}/${traceFields.length} 个可追溯字段(command/cwd/started_at/duration_ms/exit_code/timed_out); exit_code=${cmd.exit_code}`,
    };

    // secret_redaction: really execute redact() + confirm policy audit redacts.
    const utilUrl = pathToFileURL(rootPath('.uap/runtime/_lib/util.mjs')).href;
    const redactScript = "const {redact}=await import('" + utilUrl + "');"
      + "const a=redact('password: HUNTER2SECRETVALUE');"
      + "console.log(JSON.stringify({ok:!a.includes('HUNTER2SECRETVALUE'),redacted:a}));";
    const redactCmd = await selfCheck(redactScript, 15000);
    const out = parseOut(redactCmd);
    const polSrc = exists(rootPath('.uap/runtime/policy-engine/index.mjs'))
      ? readText(rootPath('.uap/runtime/policy-engine/index.mjs')) : '';
    const polCfg = exists(rootPath('.uap/config/permission-policy.yaml'))
      ? readText(rootPath('.uap/config/permission-policy.yaml')) : '';
    const rRedact = {
      name: 'secret_redaction',
      ok: cmdRan(redactCmd) && !!out && out.ok === true && /redact\(/.test(polSrc) && /redact_secrets:\s*true/.test(polCfg),
      detail: `子进程复跑 redact(): password 被 REDACTED=${out?.ok}; exit_code=${redactCmd.exit_code}; policy-engine 源码用 redact()=${/redact\(/.test(polSrc)}; policy redact_secrets=true=${/redact_secrets:\s*true/.test(polCfg)}`,
    };
    const blocked = !cmdRan(cmd) || !cmdRan(redactCmd);
    return assemble('delivery.observability_integrity', checks, [rLogs, rTrace, rRedact], {
      started, registry, evidence_refs: evidenceIds, commands: [cmd, redactCmd], blocked,
      note: '动态 import event-system 调用 health() + runCommand 真实返回可追溯字段 + node 子进程复跑 redact(); 全程本地只读/模拟',
    });
  },
};

export function health() {
  const configs = loadAllConfigs();
  const ids = Object.keys(validators);
  const declared = validatorById(configs);
  const mapped = ids.every((id) => declared.has(id));
  const ciOk = exists(rootPath('.github/workflows/ci.yml')) && exists(rootPath('scripts/verify-all.sh'));
  return {
    component,
    ok: mapped && ciOk && ids.length === 3,
    checks: { validators_exported: ids.length, all_mapped_to_registry: mapped, ci_and_local_gate_present: ciOk },
    summary: `delivery 导出 ${ids.length} 个验证器; ci.yml/verify-all.sh 存在=${ciOk}; deployment_integrity 由授权+真实发布演练判定(无授权记录时 fail-closed BLOCKED)`,
    checked_at: new Date().toISOString(),
  };
}
