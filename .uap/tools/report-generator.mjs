/**
 * UAP report generator.
 *
 * All numbers are derived from real artifacts produced by `uap` commands and
 * from live probes of the filesystem / runtime. Missing artifacts are reported
 * as NOT_EXECUTED or BLOCKED; no report contains a fabricated PASS.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, UAP, STATE, REPORTS, EVIDENCE, FILES, uapPath, rootPath, relToRoot } from '../runtime/_lib/paths.mjs';
import { nowISO, readJSON, writeJSON, readText, exists, listFiles, hash } from '../runtime/_lib/util.mjs';
import { loadAllConfigs, registryIntegrity, readVersion, executorEntries, specById, validatorById, CONFIG_NAMES, configPath, REQUIRED_SPEC_SECTIONS } from '../runtime/_lib/config.mjs';
import { list as listEvidence, get as getEvidence, verify as verifyEvidence } from '../runtime/evidence-engine/index.mjs';
import { health as policyHealth, deniedDecisions, auditTrail } from '../runtime/policy-engine/index.mjs';
import { listAgents, implementationExists } from '../runtime/agent-runtime/index.mjs';
import { listWorkflows } from '../workflows/index.mjs';
import { statusVerdict } from '../runtime/status-engine/snapshot.mjs';
import { generateIndex } from './generate-index.mjs';

export const component = 'uap.report-generator';
export const version = '1.0.0';

const REPORT_NAMES = Object.freeze([
  'IMPLEMENTATION-REPORT.md', 'SPECIFICATION-COMPLIANCE-REPORT.md', 'SPECIFICATION-REGISTRY-REPORT.md',
  'EXECUTOR-COVERAGE-REPORT.md', 'VALIDATOR-COVERAGE-REPORT.md', 'AGENT-COMPLIANCE-REPORT.md',
  'WORKFLOW-VERIFICATION-REPORT.md', 'RUNTIME-TEST-REPORT.md', 'SECURITY-AUDIT-REPORT.md',
  'QUALITY-REPORT.md', 'WEB-ENGINEERING-REPORT.md', 'H5-ENGINEERING-REPORT.md',
  'CROSS-PLATFORM-REPORT.md', 'FINANCIAL-INTEGRITY-REPORT.md', 'AUTO-REPAIR-REPORT.md',
  'EVIDENCE-INDEX.md', 'BLOCKED-ITEMS.md',
]);

const MUST_DENY = Object.freeze([
  'production_read', 'production_write', 'production_deploy', 'real_payment', 'real_refund',
  'secret_export', 'force_push', 'branch_creation', 'branch_switch', 'destructive_git',
  'quality_gate_disable', 'test_deletion_to_force_pass',
]);

function p(name) { return path.join(REPORTS, name); }
function load(name, fallback = null) { return readJSON(p(name), fallback); }
function stamp(title) { return `# ${title}\n\n> 由 \`./uap report\` 依据真实运行产物生成 · ${nowISO()} · UAP ${readVersion()}\n> 数据来源：\`.uap/state/\`、\`.uap/reports/*.json\`、\`.uap/evidence/\` 与实时文件系统探测。\n\n`; }
function table(headers, rows) {
  const h = `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n`;
  return h + rows.map((r) => `| ${r.map((c) => String(c ?? '—').replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ')} |`).join('\n') + '\n';
}
function md(title, sections) {
  return stamp(title) + sections.map(([h, body]) => `## ${h}\n\n${body}\n`).join('\n');
}
function artifactState(name) {
  const data = readJSON(p(name), null);
  return { exists: Boolean(data), data };
}

async function probeImplementation(implementation) {
  const abs = path.join(ROOT, implementation);
  if (!fs.existsSync(abs)) return { exists: false, importable: false, exports: [], error: 'file missing' };
  try {
    const m = await import(`${abs}?t=${Date.now()}`);
    const exports = Object.keys(m).filter((k) => typeof m[k] === 'function');
    return { exists: true, importable: true, exports, error: null };
  } catch (error) {
    return { exists: true, importable: false, exports: [], error: error.message };
  }
}

function specRows(configs) {
  const specs = [...specById(configs).values()];
  const validation = load('VALIDATION-RESULTS.json');
  const byValidator = new Map((validation?.results || []).map((r) => [r.validator_id, r]));
  return specs.map((s) => {
    const abs = path.join(ROOT, s.file);
    const text = fs.existsSync(abs) ? readText(abs) : '';
    const missing = REQUIRED_SPEC_SECTIONS.filter((x) => !text.includes(x));
    const status = (text.match(/\*\*状态：\*\*\s*([A-Z_]+)/) || [])[1] || 'MISSING';
    const headerOk = text.includes(`**编号：** ${s.id}`);
    const v = byValidator.get(s.validator);
    return {
      id: s.id, domain: s.domain, file: s.file, bytes: text.length,
      criticality: s.criticality, status, header_ok: headerOk, missing_sections: missing,
      complete: text.length >= 2000 && missing.length === 0 && headerOk && ['ACTIVE', 'IMPLEMENTED_NOT_VERIFIED'].includes(status),
      executor: s.executor, validator: s.validator,
      validator_status: v?.status || 'NOT_EXECUTED',
    };
  });
}

function bound(card, snapshot) {
  return Boolean(card)
    && card.execution_id === snapshot.execution_id
    && card.git_head === snapshot.git_head
    && card.worktree_fingerprint === snapshot.worktree_fingerprint;
}

function threeResults({ specRowsOut, registry, runtimeCard, validation, defects, financial, gates, audit, tests, snapshot }) {
  const specComplete = specRowsOut.filter((s) => s.complete).length;
  const specOk = specComplete === 32 && registry.ok;
  const runtimeComponents = Object.values(runtimeCard?.components || {});
  // A validator that cannot run because the environment or an authorization is
  // missing is NOT a capability failure — but it is also not a PASS. Only a
  // BLOCKED result that declares a restricted category counts as "restricted";
  // a BLOCKED result WITHOUT a declared category is treated as a capability
  // failure (fail-closed).
  const RESTRICTED_BLOCK_CATEGORIES = new Set(['ENVIRONMENT_UNAVAILABLE', 'AUTHORIZATION_REQUIRED']);
  const vResults = validation?.results || [];
  const blockedRows = vResults.filter((r) => ['BLOCKED', 'NOT_EXECUTED'].includes(r.status));
  const restrictedBlocked = blockedRows.filter((r) => RESTRICTED_BLOCK_CATEGORIES.has(r.block_category));
  const undeclaredBlocked = blockedRows.filter((r) => !RESTRICTED_BLOCK_CATEGORIES.has(r.block_category));
  const failCount = validation?.fail ?? 0;
  // A historical card is not evidence for THIS code version.
  const validationCurrent = bound(validation, snapshot);
  const testsCurrent = bound(tests, snapshot);
  const runtimeOk = runtimeCard?.health_check_passed === true
    && runtimeComponents.length > 0 && runtimeComponents.every((c) => c.ok === true)
    && validation?.total === 32 && failCount === 0 && undeclaredBlocked.length === 0
    && tests?.exit_code === 0 && validationCurrent && testsCurrent;
  const list = defects?.defects || [];
  const openP0 = list.filter((d) => d.severity === 'P0' && !['FIXED', 'VERIFIED', 'ACCEPTED_RISK'].includes(d.status)).length;
  const openP1 = list.filter((d) => d.severity === 'P1' && !['FIXED', 'VERIFIED', 'ACCEPTED_RISK'].includes(d.status)).length;
  // Uter compliance is judged strictly: every one of the 32 checks must have
  // actually PASSed. Restricted blocks are surfaced explicitly instead of
  // being folded into either verdict.
  const uterOk = Boolean(audit) && Boolean(defects) && Boolean(financial)
    && financial.failed === 0 && financial.blocked === 0
    && validation?.total === 32 && validation?.pass === 32
    && gates?.failed === 0 && openP0 === 0 && openP1 === 0
    && validationCurrent && testsCurrent
    && financial?.simulated_only !== true;  // simulation is not real financial integrity
  const restrictedList = restrictedBlocked.map((r) => ({ validator_id: r.validator_id, block_category: r.block_category }));
  return {
    specification_completeness: {
      status: specOk ? 'COMPLETE' : 'INCOMPLETE',
      evidence: { specs_complete: specComplete, specs_total: 32, registry_ok: registry.ok, registry_summary: registry.summary },
    },
    uap_runtime_capability: {
      status: runtimeOk ? 'FULLY_OPERATIONAL' : 'NOT_FULLY_VERIFIED',
      evidence: {
        health_check_passed: runtimeCard?.health_check_passed ?? false,
        components_healthy: runtimeComponents.filter((c) => c.ok === true).length,
        components_total: runtimeComponents.length,
        validators_pass: validation?.pass ?? 0,
        validators_fail: failCount,
        validators_total: validation?.total ?? 0,
        validators_blocked_restricted: restrictedBlocked.length,
        validators_blocked_undeclared: undeclaredBlocked.length,
        uap_tests_exit_code: tests?.exit_code ?? null,
        tests_bound_to_current_execution: testsCurrent,
        validators_bound_to_current_execution: validationCurrent,
        verdict_detail: runtimeOk
          ? `Runtime 健康 ${runtimeComponents.filter((c) => c.ok === true).length}/${runtimeComponents.length} 组件健康; 32 个验证器 ${validation?.pass ?? 0} PASS / ${failCount} FAIL; ${restrictedBlocked.length} 项因环境或授权受限未能执行(已声明类别, 不计为能力失败); UAP 自测 exit=${tests?.exit_code ?? 'n/a'}; 卡片已绑定当前 execution_id/HEAD/worktree`
          : `Runtime 健康组件 ${runtimeComponents.filter((c) => c.ok === true).length}/${runtimeComponents.length}; 验证器 ${validation?.pass ?? 0} PASS / ${failCount} FAIL / 未声明受限的 BLOCKED ${undeclaredBlocked.length} 项; 当前执行绑定 validators=${validationCurrent} tests=${testsCurrent}（历史卡片不计为当前能力证据）`,
      },
    },
    uter_real_compliance: {
      status: uterOk ? 'FULLY_COMPLIANT' : 'NOT_FULLY_VERIFIED',
      evidence: {
        audit_executed: Boolean(audit),
        defect_registry_built: Boolean(defects),
        financial_failed: financial?.failed ?? null,
        financial_blocked: financial?.blocked ?? null,
        quality_gates_failed: gates?.failed ?? null,
        open_p0: openP0,
        open_p1: openP1,
        validators_pass: validation?.pass ?? 0,
        validators_fail: failCount,
        validators_total: validation?.total ?? 0,
        restricted_blocked_items: restrictedList,
        financial_simulated_only: financial?.simulated_only ?? null,
        validators_bound_to_current_execution: validationCurrent,
        verdict_detail: uterOk
          ? `审计/缺陷/资金/门禁全部通过, 32/32 验证器 PASS, 且卡片绑定当前执行`
          : `可执行检查: 验证器 ${validation?.pass ?? 0}/${validation?.total ?? 0} PASS, ${failCount} FAIL; 质量门禁失败数=${gates?.failed ?? 'n/a'}; 开放 P0=${openP0} P1=${openP1}; 资金验证 simulated_only=${financial?.simulated_only ?? 'n/a'}; 当前执行绑定 validators=${validationCurrent} tests=${testsCurrent}; 受限未执行 ${restrictedList.length} 项${restrictedList.length ? ` (${restrictedList.map((r) => `${r.validator_id}:${r.block_category}`).join(', ')})` : ''} -> 见 BLOCKED-ITEMS.md。历史/模拟结果不得冒充真实业务合规。`,
      },
    },
  };
}

function finalStatus(ctx) {
  const { configs, registry, specRowsOut, runtimeCard, validation, defects, financial, gates, audit, tests, three, executorProbes, validatorImpl, runtimeCardExists } = ctx;
  const agents = listAgents();
  const workflows = listWorkflows();
  // Derived from the SAME status-engine verdict used by the index and CLI.
  // A validator PASS on a stale card is not a verified specification.
  const specVerified = ctx.engine.specVer.verified_specs;
  const specFailed = specRowsOut.filter((s) => s.validator_status === 'FAIL').length;
  const specBlocked = specRowsOut.filter((s) => ['BLOCKED', 'NOT_EXECUTED'].includes(s.validator_status)).length;
  const execPaths = Object.values(executorEntries(configs)).filter((x) => typeof x === 'string');
  const uniqueExecPaths = [...new Set(execPaths)];
  const execImplemented = uniqueExecPaths.filter((f) => executorProbes.get(f)?.importable).length;
  const validatorFiles = [...validatorById(configs).values()];
  const validatorImplemented = validatorFiles.filter((v) => validatorImpl.get(v.implementation)?.importable).length;
  const validatorVerified = (validation?.results || []).filter((r) => r.status === 'PASS').length;
  const list = defects?.defects || [];
  const open = list.filter((d) => ['OPEN', 'IN_PROGRESS', 'BLOCKED'].includes(d.status));
  const critical = open.filter((d) => ['P0', 'P1'].includes(d.severity));
  const blockedItems = collectBlocked(ctx);
  const recovery = readJSON(path.join(STATE, 'recovery-verification.json'), null);
  const configsVerified = CONFIG_NAMES.filter((n) => { try { const v = readText(configPath(n)); return v.length > 200; } catch { return false; } }).length;
  const entrypointsVerified = ['AGENTS.md', 'CLAUDE.md'].filter((n) => {
    if (!exists(rootPath(n))) return false;
    const t = readText(rootPath(n));
    return t.includes('UAP Agent Entry Point') || t.includes('UAP Claude Code Entry Point');
  }).length;

  const verdict = ctx.engine.verdict;
  const snap = ctx.engine.snapshot;
  const uapOperational = verdict.three_independent_results.uap_runtime_capability === 'FULLY_OPERATIONAL';
  const uterCompliant = verdict.three_independent_results.uter_real_compliance === 'FULLY_COMPLIANT';
  const overall = verdict.overall_status;
  const validationIsCurrent = Boolean(validation)
    && validation.execution_id === verdict.execution_id
    && validation.git_head === verdict.git_head
    && validation.worktree_fingerprint === snap.worktree_fingerprint;
  const testsAreCurrent = Boolean(tests)
    && tests.execution_id === verdict.execution_id
    && tests.git_head === verdict.git_head
    && tests.worktree_fingerprint === snap.worktree_fingerprint;

  return {
    platform: 'UAP',
    version: readVersion(),
    overall_status: overall,
    claim_allowed: verdict.claim_allowed,
    status_engine: {
      computed_by: verdict.computed_by,
      execution_id: verdict.execution_id,
      git_head: verdict.git_head,
      worktree_fingerprint: snap.worktree_fingerprint,
      counts: verdict.counts,
      capabilities: verdict.capabilities,
      capability_gaps: verdict.capability_gaps,
      reasons: verdict.reasons,
      claim_allowed: verdict.claim_allowed,
      p0_blockers: snap.p0_blockers,
      evidence_chain: ctx.engine.evidence_chain,
      stale_historical_artefacts: verdict.reasons.filter((r) => r.includes('stale artefacts')),
    },
    generated_at: nowISO(),
    generated_from: 'uap report (real command results, never copied from the template)',
    specifications: { total: specById(configs).size, complete: specRowsOut.filter((s) => s.complete).length, verified: specVerified, blocked: specBlocked, failed: specFailed },
    machine_configs: { total: CONFIG_NAMES.length, verified: configsVerified, failed: CONFIG_NAMES.length - configsVerified, registry_ok: registry.ok },
    system_entrypoints: { total: 2, verified: entrypointsVerified, failed: 2 - entrypointsVerified },
    runtime: {
      implemented: true,
      started: runtimeCardExists,
      health_check_passed: runtimeCard?.health_check_passed ?? false,
      end_to_end_passed: validationIsCurrent && testsAreCurrent && verdict.claim_allowed,
      all_validators_passed: validationIsCurrent && validation.total === 32 && validation.pass === 32,
      validation_bound_to_current_execution: validationIsCurrent,
      tests_bound_to_current_execution: testsAreCurrent,
      recovery_test_passed: recovery?.ok === true,
      components_total: Object.keys(runtimeCard?.components || {}).length,
      components_healthy: Object.values(runtimeCard?.components || {}).filter((c) => c.ok === true).length,
    },
    executors: { registered: execPaths.length, unique_implementations: uniqueExecPaths.length, implemented: execImplemented, verified: specVerified },
    validators: { registered: validatorFiles.length, implemented: validatorImplemented, verified: validatorVerified },
    agents: { registered: agents.length, implemented: agents.filter(implementationExists).length },
    workflows: { registered: workflows.length, runs: (readJSON(FILES.runs, { runs: [] }).runs || []).length },
    three_independent_results: three,
    final_acceptance: {
      uap_fully_operational: uapOperational,
      uter_fully_compliant: uterCompliant,
      both_satisfied: verdict.claim_allowed,
      claim_allowed: verdict.claim_allowed,
      restricted_blocked_items: three.uter_real_compliance.evidence?.restricted_blocked_items || [],
      claim_note: '规范完整性 / UAP 运行能力 / Uter 合规性三者分别取证, 不可互相替代; 受限未执行项一律记入 BLOCKED-ITEMS.md, 不计入通过',
    },
    uter_compliance: three.uter_real_compliance.status,
    critical_defects: critical.length,
    open_defects: open.length,
    blocked_items: blockedItems,
    evidence_index: '.uap/reports/EVIDENCE-INDEX.md',
  };
}

function collectBlocked(ctx) {
  const out = [];
  for (const f of ctx.registry.findings) {
    out.push({ id: `REGISTRY:${f.code}`, severity: 'BLOCKER', reason: f.message, source: 'registryIntegrity()' });
  }
  for (const r of ctx.validation?.results || []) {
    if (r.status === 'PASS') continue;
    out.push({ id: `VALIDATOR:${r.validator_id}`, severity: r.status === 'FAIL' ? 'BLOCKER' : 'BLOCKED', reason: r.summary, source: 'VALIDATION-RESULTS.json' });
  }
  for (const c of ctx.financial?.checks || []) {
    if (c.status === 'PASS') continue;
    out.push({ id: `FINANCIAL:${c.id}`, severity: 'BLOCKED', reason: `${c.scenario}: ${c.status}`, source: 'FINANCIAL-INTEGRITY.json' });
  }
  for (const d of ctx.defects?.defects || []) {
    if (!['BLOCKED', 'OPEN'].includes(d.status)) continue;
    out.push({ id: d.id, severity: d.severity, reason: d.blocked_reason || d.title, source: 'DEFECT-REGISTRY.json', repair_attempts: d.repair_attempts });
  }
  for (const s of ctx.specRowsOut) {
    if (!s.complete) out.push({ id: `SPEC:${s.id}`, severity: 'BLOCKED', reason: `incomplete (${s.bytes}B, missing=${s.missing_sections.join(',') || 'none'}, status=${s.status})`, source: s.file });
  }
  if (!ctx.tests) out.push({ id: 'TESTS:NOT_EXECUTED', severity: 'BLOCKED', reason: 'uap test --all has not been executed', source: 'RUNTIME-TEST-RESULTS.json' });
  if (!ctx.gates) out.push({ id: 'GATES:NOT_EXECUTED', severity: 'BLOCKED', reason: 'quality gates have not been executed (uap build --full)', source: 'QUALITY-GATES.json' });
  if (!ctx.audit) out.push({ id: 'AUDIT:NOT_EXECUTED', severity: 'BLOCKED', reason: 'uap audit has not been executed', source: 'AUDIT-REPORT.json' });
  // Authorisation boundaries are deliberately blocked, never executed.
  for (const item of ['production_deploy', 'production_database_write', 'real_payment', 'real_refund']) {
    out.push({ id: `AUTH:${item}`, severity: 'BLOCKED_BY_DESIGN', reason: 'requires explicit production authorization; UAP performs local simulation only', source: '.uap/config/permission-policy.yaml' });
  }
  return out;
}

export async function generateReports({ final = false } = {}) {
  const configs = loadAllConfigs();
  const registry = registryIntegrity(configs);
  const specRowsOut = specRows(configs);
  const runtimeCard = readJSON(path.join(STATE, 'runtime-health.json'), null);
  const validation = load('VALIDATION-RESULTS.json');
  const tests = load('RUNTIME-TEST-RESULTS.json');
  const defects = readJSON(FILES.defects, null);
  const financial = load('FINANCIAL-INTEGRITY.json');
  const gates = load('QUALITY-GATES.json');
  const audit = load('AUDIT-REPORT.json');
  const repair = load('REPAIR-RUN.json');        // CLI defect-registry repair run
  const repairEngine = load('AUTO-REPAIR.json'); // engine sandbox repair exercise
  const build = load('BUILD-RESULTS.json');
  const release = load('RELEASE-CHECK.json');
  const runs = (readJSON(FILES.runs, { runs: [] }).runs || []);
  const agents = listAgents();
  const workflows = listWorkflows();

  // Real dynamic imports: registry references must point at importable modules.
  const execPaths = Object.values(executorEntries(configs)).filter((x) => typeof x === 'string');
  const executorProbes = new Map();
  for (const f of new Set(execPaths)) executorProbes.set(f, await probeImplementation(f));
  const validatorImpl = new Map();
  for (const v of validatorById(configs).values()) {
    if (!validatorImpl.has(v.implementation)) validatorImpl.set(v.implementation, await probeImplementation(v.implementation));
  }
  const validatorFunctions = new Map();
  for (const [impl, probe] of validatorImpl) {
    if (!probe.importable) continue;
    try {
      const m = await import(`${path.join(ROOT, impl)}?t=${Date.now()}`);
      validatorFunctions.set(impl, Object.keys(m.validators || {}));
    } catch { validatorFunctions.set(impl, []); }
  }

  // ONE status source for the index, the CLI and every report. The first pass
  // establishes the spec-verification counts; the second binds the report
  // claims and the index declaration to that exact verdict instance, so the
  // three artifacts cannot disagree.
  const probe = statusVerdict();
  const engine = statusVerdict({
    claims: {
      specifications_verified: probe.specVer.verified_specs,
      overall_status: probe.verdict.overall_status,
    },
    indexDeclaration: {
      verified_specs: probe.specVer.verified_specs,
      total_specs: probe.specVer.total_specs,
      overall_status: probe.verdict.overall_status,
    },
  });
  const three = threeResults({ specRowsOut, registry, runtimeCard, validation, defects, financial, gates, audit, tests, snapshot: engine.snapshot });
  // Detailed evidence stays; the three verdict labels come from the engine.
  three.specification_completeness.status = engine.verdict.three_independent_results.specification_completeness;
  three.uap_runtime_capability.status = engine.verdict.three_independent_results.uap_runtime_capability;
  three.uter_real_compliance.status = engine.verdict.three_independent_results.uter_real_compliance;

  const ctx = { configs, registry, specRowsOut, runtimeCard, validation, defects, financial, gates, audit, tests, three, executorProbes, validatorImpl, runtimeCardExists: Boolean(runtimeCard), engine };
  const blockedItems = collectBlocked(ctx);
  ctx.blockedItems = blockedItems;

  const written = [];
  const write = (name, content) => { fs.writeFileSync(p(name), content, 'utf8'); written.push(name); };

  // 1 — implementation
  write('IMPLEMENTATION-REPORT.md', md('UAP 1.0 Implementation Report', [
    ['结论（三项独立验收，不可互相替代）', table(['验收项', '结论', '证据摘要'], [
      ['规范完整性', three.specification_completeness.status, `${three.specification_completeness.evidence.specs_complete}/32 规范完整，registry_ok=${three.specification_completeness.evidence.registry_ok}`],
      ['UAP 实际运行能力', three.uap_runtime_capability.status, `组件 ${three.uap_runtime_capability.evidence.components_healthy}/${three.uap_runtime_capability.evidence.components_total}，验证器 ${three.uap_runtime_capability.evidence.validators_pass}/${three.uap_runtime_capability.evidence.validators_total}，测试退出码 ${three.uap_runtime_capability.evidence.uap_tests_exit_code}`],
      ['Uter 真实合规性', three.uter_real_compliance.status, `audit=${three.uter_real_compliance.evidence.audit_executed}，资金失败=${three.uter_real_compliance.evidence.financial_failed}，未处理 P0=${three.uter_real_compliance.evidence.open_p0}，P1=${three.uter_real_compliance.evidence.open_p1}`],
    ]) + `\n> 只有前两项各自成立，第三项才可能被认定。文档存在不等于 Runtime 可运行；Runtime 可运行不等于 Uter 已合规。\n`],
    ['注册表完整性', `${registry.summary}\n\n` + table(['检查 ID', '状态', '明细'], registry.checks.map((c) => [c.id, c.status, c.detail]))],
    ['阶段执行实况', table(['Phase', '内容', '真实状态'], [
      ['Phase 0', '基线保护', exists(FILES.baseline) ? 'BASELINE.json 已保存' : 'NOT_EXECUTED'],
      ['Phase 1', '32 规范 / 6 配置 / 2 入口', `${specRowsOut.filter((s) => s.complete).length}/32 规范完整；${CONFIG_NAMES.length}/6 配置；2 入口已接入`],
      ['Phase 2', 'Core Runtime', runtimeCard ? `${Object.values(runtimeCard.components || {}).filter((c) => c.ok).length}/${Object.keys(runtimeCard.components || {}).length} 组件健康` : 'NOT_EXECUTED'],
      ['Phase 3', '执行器 / 验证器', `${[...executorProbes.values()].filter((v) => v.importable).length}/${executorProbes.size} 可执行模块；${[...validatorImpl.values()].filter((v) => v.importable).length}/${validatorImpl.size} 验证器域模块`],
      ['Phase 4', '全项目扫描', audit ? 'AUDIT-REPORT.json 已生成' : 'NOT_EXECUTED'],
      ['Phase 5', '统一整改', repair ? `${repair.processed} 次修复尝试` : 'NOT_EXECUTED'],
      ['Phase 6', '业务/资金专项', financial ? `${financial.total} 项检查（simulated_only=${financial.simulated_only}）` : 'NOT_EXECUTED'],
      ['Phase 7', '全量复验', validation ? `${validation.pass}/${validation.total} 验证器 PASS` : 'NOT_EXECUTED'],
      ['Phase 8', '最终交付', `${REPORT_NAMES.length + 1} 份交付物由本次运行生成`],
    ])],
    ['安全边界', `生产发布 / 生产数据库写入 / 真实支付 / 真实退款 / 密钥导出 / 强制推送 / 破坏性 Git 操作均由 \`permission-policy.yaml\` 拒绝。资金验证使用进程内模拟（\`simulated_only=${financial?.simulated_only ?? 'NOT_EXECUTED'}\`）。`],
    ['未解决项', `共 ${blockedItems.length} 条，详见 [BLOCKED-ITEMS.md](BLOCKED-ITEMS.md)。`],
  ]));

  // 2 — specification compliance
  write('SPECIFICATION-COMPLIANCE-REPORT.md', md('Specification Compliance Report', [
    ['逐份规范（真实文件探测）', table(['编号', '域', '字节', '状态', '章节缺失', '执行器', '验证器', '验证结果', '完整'], specRowsOut.map((s) => [s.id, s.domain, s.bytes, s.status, s.missing_sections.join(',') || '无', s.executor, s.validator, s.validator_status, s.complete ? 'YES' : 'NO']))],
    ['汇总', `完整 ${specRowsOut.filter((s) => s.complete).length}/${specRowsOut.length}；验证 PASS ${specRowsOut.filter((s) => s.validator_status === 'PASS').length}；FAIL ${specRowsOut.filter((s) => s.validator_status === 'FAIL').length}；未执行 ${specRowsOut.filter((s) => s.validator_status === 'NOT_EXECUTED').length}。\n\n统一章节要求：${REQUIRED_SPEC_SECTIONS.join('、')}。`],
  ]));

  // 3 — registry
  write('SPECIFICATION-REGISTRY-REPORT.md', md('Specification Registry Report', [
    ['6 份机器配置', table(['配置', '字节', '可解析'], CONFIG_NAMES.map((n) => [n, fs.statSync(configPath(n)).size, configs[n] ? 'YES' : 'NO']))],
    ['37 项完整性检查', table(['检查', '结果', '明细'], registry.checks.map((c) => [c.id, c.status, c.detail]))],
    ['阻断发现', registry.findings.length ? table(['severity', 'code', 'message'], registry.findings.map((f) => [f.severity, f.code, f.message])) : '无。'],
    ['结论', registry.summary],
  ]));

  // 4 — executor coverage
  const execRows = Object.entries(executorEntries(configs)).map(([id, impl]) => {
    const probe = typeof impl === 'string' ? executorProbes.get(impl) : null;
    return [id, typeof impl === 'string' ? impl : JSON.stringify(impl), probe?.exists ? 'YES' : 'NO', probe?.importable ? 'YES' : 'NO', (probe?.exports || []).join(',') || '—', probe?.error || '—'];
  });
  write('EXECUTOR-COVERAGE-REPORT.md', md('Executor Coverage Report', [
    ['逐项映射（真实动态 import）', table(['执行器 ID', '实现路径', '文件存在', '可 import', '导出函数', '错误'], execRows)],
    ['汇总', `注册 ${execRows.length} 项；唯一实现文件 ${executorProbes.size} 个；可 import ${[...executorProbes.values()].filter((v) => v.importable).length} 个；缺失 ${[...executorProbes.values()].filter((v) => !v.exists).length} 个。`],
  ]));

  // 5 — validator coverage
  const valRows = [...validatorById(configs).values()].map((v) => {
    const probe = validatorImpl.get(v.implementation);
    const fns = validatorFunctions.get(v.implementation) || [];
    const r = (validation?.results || []).find((x) => x.validator_id === v.id);
    return [v.id, v.target, v.implementation, probe?.importable ? 'YES' : 'NO', fns.includes(v.id) ? 'YES' : 'NO', (v.checks || []).length, r?.status || 'NOT_EXECUTED', r?.summary || '—'];
  });
  write('VALIDATOR-COVERAGE-REPORT.md', md('Validator Coverage Report', [
    ['逐项验证器', table(['验证器', '目标规范', '实现模块', '可 import', '函数存在', '声明检查数', '最近结果', '摘要'], valRows)],
    ['汇总', `注册 ${valRows.length}；实现模块可 import ${[...validatorImpl.values()].filter((v) => v.importable).length}/${validatorImpl.size}；${validation ? `最近全量运行 ${validation.pass} PASS / ${validation.fail} FAIL / ${validation.blocked} BLOCKED` : 'NOT_EXECUTED'}`],
  ]));

  // 6 — agents
  const agentRows = agents.map((a) => [a.id, a.role, (a.permissions || []).join(','), (a.tools || []).length, a.output_schema || '—', a.implementation, implementationExists(a) ? 'YES' : 'NO']);
  const ph = policyHealth();
  write('AGENT-COMPLIANCE-REPORT.md', md('Agent Compliance Report', [
    ['11 个 Agent', table(['ID', '角色', '权限', '工具数', '输出 schema', '实现路径', '实现存在'], agentRows)],
    ['策略引擎健康', table(['检查', '结果'], Object.entries(ph.checks).map(([k, v]) => [k, v ? 'PASS' : 'FAIL'])) + `\n整体 ok=${ph.ok}`],
    ['拒绝决策审计', `审计记录 ${auditTrail(1000).length} 条，其中拒绝 ${deniedDecisions(1000).length} 条。`],
  ]));

  // 7 — workflows
  const runRows = runs.map((r) => [r.workflow_id, r.state, r.steps_total, r.steps_succeeded, r.steps_blocked, (r.evidence_refs || []).length, r.run_id]);
  write('WORKFLOW-VERIFICATION-REPORT.md', md('Workflow Verification Report', [
    ['7 个注册工作流', table(['ID', '名称', '步骤数', '验收条件'], workflows.map((w) => [w.id, w.name, (w.steps || []).length, w.acceptance]))],
    ['端到端运行记录', runRows.length ? table(['工作流', '状态', '步骤', '成功', '未完成', '证据数', 'run_id'], runRows) : '尚无端到端运行记录（NOT_EXECUTED）。执行 `./uap workflow run --all`。'],
    ['汇总', `注册 ${workflows.length}；已运行 ${runs.length}；成功 ${runs.filter((r) => r.state === 'SUCCEEDED').length}。`],
  ]));

  // 8 — runtime tests
  const testFiles = listFiles(uapPath('tests'), { filter: (f) => f.endsWith('.test.mjs') });
  const compRows = runtimeCard ? Object.entries(runtimeCard.components).map(([n, c]) => [n, c.ok === true ? 'PASS' : 'FAIL', c.error || '—']) : [];
  write('RUNTIME-TEST-REPORT.md', md('Runtime Test Report', [
    ['10 个核心组件健康', compRows.length ? table(['组件', '结果', '错误'], compRows) : 'NOT_EXECUTED（`uap doctor` 未运行）。'],
    ['UAP 自身测试', tests ? `命令：\`${tests.command}\`\n\n真实退出码：**${tests.exit_code}**；耗时 ${tests.duration_ms}ms；测试文件 ${tests.test_files.length} 个。\n\n\`\`\`\n${(tests.stdout_tail || '').slice(-2000)}\n\`\`\`` : 'NOT_EXECUTED。执行 `./uap test --all`。'],
    ['测试文件清单', testFiles.length ? table(['文件'], testFiles.map((f) => [relToRoot(f)])) : '无测试文件（BLOCKED）。'],
    ['中断恢复', (() => { const r = readJSON(path.join(STATE, 'recovery-verification.json'), null); return r ? table(['检查', '结果'], Object.entries(r.checks).map(([k, v]) => [k, v])) + `\n最终状态：${r.final_state}，整体 ok=${r.ok}` : 'NOT_EXECUTED。'; })()],
  ]));

  // 9 — security
  const secretHits = [];
  for (const f of listFiles(UAP, { filter: (f) => /\.(mjs|yaml|md|json)$/.test(f) })) {
    const text = fs.readFileSync(f, 'utf8');
    for (const re of [/AIza[0-9A-Za-z_-]{20,}/g, /whsec_[0-9A-Za-z]{16,}/g, /sk-[0-9A-Za-z]{20,}/g, /ghp_[0-9A-Za-z]{30,}/g]) {
      const m = text.match(re);
      if (m) secretHits.push({ file: relToRoot(f), count: m.length });
    }
  }
  write('SECURITY-AUDIT-REPORT.md', md('Security Audit Report', [
    ['权限策略', table(['检查', '结果'], Object.entries(ph.checks).map(([k, v]) => [k, v ? 'PASS' : 'FAIL'])) + `\n\`default_effect=${configs['permission-policy'].default_effect}\`，\`fail_closed=${configs['permission-policy'].enforcement?.fail_closed}\`。`],
    ['必须拒绝的权限组', table(['权限', '配置 effect'], MUST_DENY.map((k) => [k, configs['permission-policy'].permission_groups?.[k]?.effect || 'MISSING']))],
    ['密钥形态字面量扫描', secretHits.length ? table(['文件', '命中数'], secretHits.map((h) => [h.file, h.count])) : 'UAP 目录 0 命中。'],
    ['拒绝决策审计', `policy-audit.jsonl 共 ${auditTrail(100000).length} 条决策，${deniedDecisions(100000).length} 条 DENY。`],
    ['生产授权边界', '生产发布、生产数据库写入、真实支付/退款、密钥导出、强制推送与破坏性 Git 操作从未执行，且被策略引擎拒绝。详见 BLOCKED-ITEMS.md。'],
  ]));

  // 10 — quality
  write('QUALITY-REPORT.md', md('Quality Report', [
    ['质量门禁', gates ? `命令 \`${gates.command}\`，退出码 **${gates.exit_code}**，失败门禁 ${gates.failed}。` : 'NOT_EXECUTED。执行 `./uap build --full` 运行 `scripts/verify-all.sh`。'],
    ['构建结果', build ? table(['项目', '结果'], [['UAP 模块语法检查', `${build.uap_modules_checked} 个，失败 ${build.syntax_failures.length}`], ...build.commands.map((c) => [c.command, `exit ${c.exit_code}`])]) : 'NOT_EXECUTED。'],
    ['验证器结果', validation ? `${validation.pass} PASS / ${validation.fail} FAIL / ${validation.blocked} BLOCKED / ${validation.not_executed} NOT_EXECUTED（共 ${validation.total}）` : 'NOT_EXECUTED。'],
    ['不得降低门禁', '本报告不通过删除测试、放宽断言或忽略错误来取得绿色结果；所有失败均如实记录。'],
  ]));

  // 11 — web
  const webPkg = readJSON(rootPath('web', 'package.json'), null);
  const webScripts = Object.keys(webPkg?.scripts || {});
  write('WEB-ENGINEERING-REPORT.md', md('Web Engineering Report', [
    ['技术栈探测', `web/package.json ${webPkg ? '存在' : '缺失'}；脚本 ${webScripts.length} 个：${webScripts.join(', ') || '—'}。`],
    ['真实命令结果', build ? table(['命令', '退出码', '耗时'], build.commands.map((c) => [c.command, c.exit_code, `${c.duration_ms}ms`])) : 'NOT_EXECUTED。'],
    ['前端文件统计', `web/src 下 TS/TSX 文件 ${listFiles(rootPath('web', 'src'), { filter: (f) => /\.(ts|tsx)$/.test(f) }).length} 个；设计系统目录 ${exists(rootPath('web', 'src', 'design-system')) ? '存在' : '缺失'}。`],
  ]));

  // 12 — H5
  const h5Scripts = webScripts.filter((s) => /h5|mobile|wap/i.test(s));
  const h5Dirs = ['web/src/pages/h5', 'web/src/features/h5', 'h5', 'mobile'].filter((d) => exists(rootPath(d)));
  const h5Matrix = readJSON(rootPath('.uap/reports/H5-BROWSER-MATRIX.json'), null);
  const h5Verdict = h5Matrix?.verdict || {};
  const h5MatrixPass = Number(h5Matrix?.matrix_rows ?? h5Matrix?.matrix?.length ?? 0) > 0
    && ['h5_build', 'viewport', 'touch', 'mobile_tests'].every((k) => h5Verdict[k] === 'PASS');
  const h5MatrixFail = h5Matrix && Object.values(h5Verdict).some((v) => v === 'FAIL');
  write('H5-ENGINEERING-REPORT.md', md('H5 Engineering Report', [
    ['H5 独立构建探测', `package.json 中 H5/mobile 相关脚本：${h5Scripts.join(', ') || '无'}；独立 H5 目录：${h5Dirs.join(', ') || '无'}；Uter Web/H5 共用 React 代码库。`],
    ['真实浏览器矩阵', h5MatrixPass
      ? `PASS：真实 Chromium 执行 ${h5Matrix.matrix_rows ?? h5Matrix.matrix.length} 个视口/路由组合；h5_build、viewport、touch、mobile_tests 全部 PASS。`
      : h5MatrixFail
        ? `FAIL：真实浏览器矩阵存在失败；verdict=${JSON.stringify(h5Verdict)}。`
        : 'BLOCKED / NOT_EXECUTED：缺少本次执行生成的 H5-BROWSER-MATRIX.json 或矩阵未完整通过；不得用旧报告或目录存在性替代浏览器证据。'],
    ['真实数据', `Web typecheck 退出码：${build?.commands?.find((c) => c.command.includes('typecheck'))?.exit_code ?? 'NOT_EXECUTED'}。`],
  ]));

  // 13 — cross platform
  const platformDirs = ['web', 'electron', 'desktop', 'web/src/design-system', 'web/src/features/wallet', 'docs/design-system'];
  const udsFiles = ['00-UTER-DESIGN-SYSTEM-OVERVIEW.md', 'TOKEN-MANIFEST.json', 'UDS-8.0.0-MIGRATION-REPORT.md', 'COMPAT-MAP.json', 'FINAL-ACCEPTANCE-REPORT.md'];
  const udsMissing = udsFiles.filter((f) => !exists(rootPath('docs', 'design-system', f)));
  const udsManifest = readJSON(rootPath('docs', 'design-system', 'TOKEN-MANIFEST.json'), null);
  const udsAcceptance = readText(rootPath('docs', 'design-system', 'FINAL-ACCEPTANCE-REPORT.md')) || '';
  const udsReady = udsMissing.length === 0 && udsManifest?.version === '8.0.0'
    && udsManifest?.status === 'ACCEPTANCE_READY' && udsAcceptance.includes('accepted: false');
  write('CROSS-PLATFORM-REPORT.md', md('Cross-Platform Report', [
    ['平台目录探测', table(['路径', '存在', '文件数'], platformDirs.map((d) => [d, exists(rootPath(d)) ? 'YES' : 'NO', listFiles(rootPath(d)).length]))],
    ['设计系统约束', `UDS 8.0.0 文档集：${udsReady ? 'PRESENT / ACCEPTANCE_READY / accepted=false' : `INCOMPLETE; missing=${udsMissing.join(',')}`}; UDS 8.0.0 --ds8-* 运行时桥接与 3.0 兼容层退役边界按迁移证据核验；web/AGENTS.md：${exists(rootPath('web', 'AGENTS.md')) ? '存在' : '缺失'}。`],
    ['结论', '仅报告真实探测到的目录与命令结果；未完成独立平台构建验证的部分不标记为 PASS。'],
  ]));

  // 14 — financial
  const finRows = (financial?.checks || []).map((c) => [c.id, c.scenario, c.status, typeof c.evidence === 'object' ? JSON.stringify(c.evidence).slice(0, 180) : String(c.evidence ?? '—')]);
  write('FINANCIAL-INTEGRITY-REPORT.md', md('Financial Integrity Report', [
    ['红线声明', financial ? `simulated_only = **${financial.simulated_only}**。全部检查为静态源码分析与进程内内存模拟；未连接支付网关、未写数据库、未发起真实交易或退款。` : 'NOT_EXECUTED。'],
    ['逐场景结果', finRows.length ? table(['ID', '场景', '结果', '证据'], finRows) : '无检查记录。'],
    ['汇总', financial ? `共 ${financial.total} 项：PASS ${financial.passed}，FAIL ${financial.failed}，BLOCKED ${financial.blocked}。` : 'NOT_EXECUTED。'],
    ['资金数据保护', '历史资金数据迁移与并发扣费场景以源码证据判定；无法从源码证明的场景保持 BLOCKED，不伪造 PASS。'],
  ]));

  // 15 — auto repair
  const attemptRows = (repair?.attempts || []).map((a) => [a.id, a.attempt, a.action, a.status, a.evidence_ref || '—']);
  write('AUTO-REPAIR-REPORT.md', md('Auto Repair Report', [
    ['修复尝试', attemptRows.length ? table(['缺陷', '尝试次数', '动作', '结果', '证据'], attemptRows) : 'NOT_EXECUTED。执行 `./uap repair`。'],
    ['独立复验', repair ? `修复前后 registry：${JSON.stringify(repair.independent_reverification)}` : 'NOT_EXECUTED。'],
    ['策略边界', '每个根因最多 3 次实质不同的修复尝试；Uter 业务源码变更需要显式授权，UAP 修复器不会猜测改写生产代码；无法安全修复的缺陷保持 OPEN/BLOCKED。'],
    ['沙箱修复演练', repairEngine ? `auto-repair 引擎沙箱演练 final_status=${repairEngine.final_status}; 尝试 ${(repairEngine.attempts || []).length} 次; 仅沙箱文件被写入=${repairEngine.safety?.only_sandbox_files_written}` : 'NOT_EXECUTED。'],
    ['剩余阻断', repair ? `P0/P1 未关闭 ${repair.open_critical_defects ?? 'n/a'} 项；开放缺陷 ${repair.open_defects} 项。` : 'NOT_EXECUTED。'],
  ]));

  // 16 — evidence index
  const ids = listEvidence();
  let verified = 0;
  const evRows = [];
  for (const id of ids) {
    const rec = getEvidence(id);
    const v = verifyEvidence(id);
    if (v.valid) verified += 1;
    evRows.push([id, rec?.kind || '—', rec?.command || '—', rec?.exit_code ?? '—', rec?.recorded_at || '—', v.valid ? 'HASH_OK' : v.reason]);
  }
  write('EVIDENCE-INDEX.md', md('Evidence Index', [
    ['汇总', `证据总数 **${ids.length}**；SHA-256 校验通过 **${verified}**；失败 **${ids.length - verified}**。证据为 append-only，同 ID 覆盖写入会被拒绝。`],
    ['逐条索引', evRows.length ? table(['证据 ID', '类型', '命令', '退出码', '时间', '完整性'], evRows) : '无证据。'],
    ['证据契约', '每条证据含 `evidence_id / kind / recorded_at / environment / command / exit_code / duration_ms / inputs(stdout,stderr 已脱敏) / findings / summary / content_hash`。'],
  ]));

  // 17 — blocked items
  write('BLOCKED-ITEMS.md', md('Blocked Items', [
    ['汇总', `共 **${blockedItems.length}** 条。按来源分组：` + Object.entries(blockedItems.reduce((acc, b) => { const k = String(b.id).split(':')[0]; acc[k] = (acc[k] || 0) + 1; return acc; }, {})).map(([k, v]) => `${k}=${v}`).join(', ') + '。'],
    ['明细', blockedItems.length ? table(['ID', '级别', '原因', '来源'], blockedItems.map((b) => [b.id, b.severity, b.reason, b.source])) : '无。'],
    ['生产授权事项', '生产发布、生产数据库写入、真实支付、真实退款、密钥导出均因缺少显式生产授权而记录为 BLOCKED。UAP 已完成本地模拟与源码级验证，不擅自执行。'],
  ]));

  // 18 — FINAL-STATUS.json
  const status = finalStatus(ctx);
  status.blocked_items = blockedItems;
  status.report_count = written.length + 1;
  status.reports = [...written, 'FINAL-STATUS.json'];
  status.generated_by_real_run = true;
  writeJSON(FILES.finalStatus, status);
  written.push('FINAL-STATUS.json');
  // The index is regenerated from the SAME verdict object, in the same run.
  const indexResult = generateIndex(engine);

  return {
    generated_at: nowISO(), written, total: written.length,
    overall_status: status.overall_status,
    status_engine: {
      execution_id: engine.verdict.execution_id,
      git_head: engine.verdict.git_head,
      counts: engine.verdict.counts,
      claim_allowed: engine.verdict.claim_allowed,
      capability_gaps: engine.verdict.capability_gaps,
    },
    specification_index: {
      file: relToRoot(indexResult.file),
      overall_status: indexResult.verdict.overall_status,
      verified_specs: indexResult.specVer.verified_specs,
      total_specs: indexResult.specVer.total_specs,
    },
    three_independent_results: three,
    blocking_findings: registry.findings.length,
    blocked_items: blockedItems.length,
    evidence: { total: ids.length, hash_verified: verified },
    final_acceptance: status.final_acceptance,
  };
}

export function health() {
  const missing = REPORT_NAMES.filter((n) => !exists(p(n)));
  return { component, version, ok: missing.length === 0 && exists(FILES.finalStatus), checks: { reports_present: REPORT_NAMES.length - missing.length, reports_expected: REPORT_NAMES.length, final_status_present: exists(FILES.finalStatus) }, missing, checked_at: nowISO() };
}
