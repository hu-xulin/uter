import fs from 'node:fs';
import path from 'node:path';
import { parseYAML } from './yaml.mjs';
import { CONFIG, ROOT, FILES } from './paths.mjs';
import { finding } from './contract.mjs';

export const CONFIG_NAMES = Object.freeze([
  'specification-registry',
  'execution-mapping',
  'agent-registry',
  'permission-policy',
  'workflow-registry',
  'validator-registry',
]);

export const REQUIRED_SPEC_SECTIONS = Object.freeze([
  '标准编号',
  '规范目标',
  '强制性要求',
  '执行流程',
  '对应执行器',
  '对应验证器',
  '输入和输出',
  '失败处理',
  '验收条件',
  '证据要求',
  '依赖标准',
]);

export const EXPECTED_STATUS_VALUES = Object.freeze([
  'NOT_BUILT', 'PARTIALLY_BUILT', 'IMPLEMENTED_NOT_VERIFIED', 'PARTIALLY_VERIFIED',
  'FULLY_VERIFIED', 'FULLY_OPERATIONAL', 'BLOCKED', 'FAILED',
]);

export function configPath(name) {
  return path.join(CONFIG, `${name}.yaml`);
}

export function loadConfig(name) {
  const file = configPath(name);
  if (!fs.existsSync(file)) throw new Error(`missing UAP config: ${file}`);
  const text = fs.readFileSync(file, 'utf8');
  if (!text.trim()) throw new Error(`empty UAP config: ${file}`);
  return parseYAML(text);
}

export function loadAllConfigs() {
  const out = {};
  for (const name of CONFIG_NAMES) out[name] = loadConfig(name);
  return out;
}

function flattenEngines(mapping) {
  const flat = {};
  for (const [domain, engines] of Object.entries(mapping.engines || {})) {
    for (const [key, value] of Object.entries(engines || {})) {
      flat[`${domain}.${key}`] = value;
    }
  }
  return flat;
}

export function executorEntries(configs) {
  return { ...flattenEngines(configs['execution-mapping']), ...(configs['execution-mapping'].executor_entries || {}) };
}

export function specById(configs) {
  return new Map((configs['specification-registry'].specifications || []).map((s) => [s.id, s]));
}

export function validatorById(configs) {
  return new Map((configs['validator-registry'].validators || []).map((v) => [v.id, v]));
}

function detectCycle(specs) {
  const byId = new Map(specs.map((s) => [s.id, s]));
  const state = new Map();
  const stack = [];
  const cycles = [];
  const visit = (id) => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'visiting') {
      const at = stack.indexOf(id);
      cycles.push([...stack.slice(at), id].join(' -> '));
      return;
    }
    state.set(id, 'visiting');
    stack.push(id);
    for (const dep of byId.get(id)?.dependencies || []) {
      if (byId.has(dep)) visit(dep);
    }
    stack.pop();
    state.set(id, 'done');
  };
  for (const s of specs) visit(s.id);
  return cycles;
}

/**
 * Real registry integrity check. Every check inspects the filesystem and the
 * parsed config objects; no check returns PASS merely because a name exists.
 */
export function registryIntegrity(configs = loadAllConfigs()) {
  const checks = [];
  const findings = [];
  const add = (id, ok, detail, severity = 'BLOCKER') => {
    checks.push({ id, status: ok ? 'PASS' : 'FAIL', detail });
    if (!ok) findings.push(finding(severity, id, detail));
  };

  // 1. Configuration files are present and parseable.
  for (const name of CONFIG_NAMES) {
    const file = configPath(name);
    const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
    add(`config.present.${name}`, size > 200, `${name}.yaml size=${size} bytes`);
    add(`config.parsed.${name}`, configs[name] !== null && typeof configs[name] === 'object',
      `${name}.yaml parsed to ${configs[name] && typeof configs[name] === 'object' ? 'object' : typeof configs[name]}`);
  }

  const registry = configs['specification-registry'];
  const specs = registry.specifications || [];
  const ids = specs.map((s) => s.id);

  // 2. Exactly 32 unique specification IDs.
  add('registry.spec_count', specs.length === 32, `specification count = ${specs.length} (expected 32)`);
  add('registry.unique_ids', new Set(ids).size === ids.length, `unique IDs = ${new Set(ids).size}/${ids.length}`);
  add('registry.status_values', JSON.stringify(registry.status_values) === JSON.stringify(EXPECTED_STATUS_VALUES),
    `status_values = ${(registry.status_values || []).length} values, equality=${JSON.stringify(registry.status_values) === JSON.stringify(EXPECTED_STATUS_VALUES)}`);

  // 3. Every specification file exists, is substantive and has all 11 sections.
  let specSectionFailures = 0;
  let specShortFiles = 0;
  for (const spec of specs) {
    const file = path.join(ROOT, spec.file);
    const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (text.length < 2000) specShortFiles += 1;
    const missing = REQUIRED_SPEC_SECTIONS.filter((section) => !text.includes(section));
    if (missing.length) specSectionFailures += 1;
    if (!fs.existsSync(file) || missing.length || text.length < 2000) {
      findings.push(finding('BLOCKER', 'registry.spec_content',
        `${spec.id}: missing=${missing.join(',') || 'none'} bytes=${text.length}`));
    }
    if (!text.includes(`**编号：** ${spec.id}`)) {
      findings.push(finding('BLOCKER', 'registry.spec_id_header', `${spec.id}: file header does not declare its own ID`));
      specSectionFailures += 1;
    }
    const statusMatch = text.match(/\*\*状态：\*\*\s*([A-Z_]+)/);
    if (!statusMatch || !['ACTIVE', 'IMPLEMENTED_NOT_VERIFIED'].includes(statusMatch[1])) {
      findings.push(finding('BLOCKER', 'registry.spec_status',
        `${spec.id}: status must be ACTIVE or IMPLEMENTED_NOT_VERIFIED, got ${statusMatch ? statusMatch[1] : 'none'}`));
      specSectionFailures += 1;
    }
  }
  add('registry.spec_files_nonempty', specShortFiles === 0, `spec files under 2000 bytes = ${specShortFiles}`);
  add('registry.spec_sections', specSectionFailures === 0, `spec files with missing sections / bad header / bad status = ${specSectionFailures}`);

  // 4. Dependencies exist and form a DAG.
  const missingDeps = [];
  for (const spec of specs) {
    for (const dep of spec.dependencies || []) if (!ids.includes(dep)) missingDeps.push(`${spec.id}->${dep}`);
  }
  add('registry.dependencies_exist', missingDeps.length === 0, `missing dependency references = ${missingDeps.length}`);
  const cycles = detectCycle(specs);
  add('registry.dependencies_acyclic', cycles.length === 0, `cycles = ${cycles.length}${cycles.length ? ` (${cycles[0]})` : ''}`);

  // 5. Executor and validator mappings reference real objects and real files.
  const executors = executorEntries(configs);
  const validators = validatorById(configs);
  let missingExecutor = 0;
  let missingExecutorFile = 0;
  let missingValidator = 0;
  let missingValidatorFile = 0;
  let wrongValidatorTarget = 0;
  for (const spec of specs) {
    if (!spec.executor || !spec.validator) { missingExecutor += 1; continue; }
    if (!executors[spec.executor]) {
      missingExecutor += 1;
      findings.push(finding('BLOCKER', 'registry.executor_unknown', `${spec.id}: ${spec.executor} not in execution-mapping`));
    }
    const entry = configs['execution-mapping'].executor_entries?.[spec.executor];
    if (!entry || !fs.existsSync(path.join(ROOT, entry))) {
      missingExecutorFile += 1;
      findings.push(finding('BLOCKER', 'registry.executor_entry_missing', `${spec.id}: entry ${entry || 'none'} not found`));
    }
    const validator = validators.get(spec.validator);
    if (!validator) {
      missingValidator += 1;
      findings.push(finding('BLOCKER', 'registry.validator_unknown', `${spec.id}: ${spec.validator} not in validator-registry`));
    } else {
      if (validator.target !== spec.id) wrongValidatorTarget += 1;
      if (!validator.implementation || !fs.existsSync(path.join(ROOT, validator.implementation))) {
        missingValidatorFile += 1;
        findings.push(finding('BLOCKER', 'registry.validator_entry_missing', `${spec.id}: implementation ${validator.implementation} not found`));
      }
    }
  }
  add('registry.executor_mapping', missingExecutor === 0, `specs without a registered executor = ${missingExecutor}`);
  add('registry.executor_files', missingExecutorFile === 0, `executor entry files missing = ${missingExecutorFile}`);
  add('registry.validator_mapping', missingValidator === 0, `specs without a registered validator = ${missingValidator}`);
  add('registry.validator_files', missingValidatorFile === 0, `validator implementation files missing = ${missingValidatorFile}`);
  add('registry.validator_targets', wrongValidatorTarget === 0, `validators with wrong target = ${wrongValidatorTarget}`);

  // 6. Validator registry: unique IDs, non-empty checks, no orphan validators.
  const validatorIds = [...validators.keys()];
  add('registry.validator_unique', new Set(validatorIds).size === validatorIds.length,
    `unique validator IDs = ${new Set(validatorIds).size}/${validatorIds.length}`);
  const emptyChecks = validatorIds.filter((id) => !(validators.get(id).checks || []).length);
  add('registry.validator_checks', emptyChecks.length === 0, `validators without checks = ${emptyChecks.length}`);
  const orphanValidators = validatorIds.filter((id) => !specs.some((s) => s.validator === id));
  add('registry.validator_orphans', orphanValidators.length === 0, `orphan validators = ${orphanValidators.length}`);

  // 7. Agent registry: unique IDs, declared permissions, real implementation.
  const agents = configs['agent-registry'].agents || [];
  const agentIds = agents.map((a) => a.id);
  const policyGroups = configs['permission-policy'].permission_groups || {};
  const undeclaredPerms = [];
  const missingAgentImpl = [];
  for (const agent of agents) {
    for (const perm of agent.permissions || []) if (!policyGroups[perm]) undeclaredPerms.push(`${agent.id}:${perm}`);
    if (!agent.implementation || !fs.existsSync(path.join(ROOT, agent.implementation))) missingAgentImpl.push(agent.id);
  }
  add('registry.agent_unique', new Set(agentIds).size === agentIds.length, `unique agent IDs = ${new Set(agentIds).size}/${agentIds.length}`);
  add('registry.agent_count', agents.length === 11, `registered agents = ${agents.length} (expected 11)`);
  add('registry.agent_permissions', undeclaredPerms.length === 0, `undeclared permissions = ${undeclaredPerms.length}`);
  add('registry.agent_implementation', missingAgentImpl.length === 0, `agents without real implementation = ${missingAgentImpl.length}`);

  // 8. Permission policy: fail-closed denials are actually present.
  const policy = configs['permission-policy'];
  const mustDeny = ['production_read', 'production_write', 'production_deploy', 'real_payment', 'real_refund',
    'secret_export', 'force_push', 'branch_creation', 'branch_switch', 'destructive_git',
    'quality_gate_disable', 'test_deletion_to_force_pass'];
  const notDenied = mustDeny.filter((k) => policyGroups[k]?.effect !== 'deny');
  add('policy.fail_closed', policy.default_effect === 'deny' && notDenied.length === 0,
    `default_effect=${policy.default_effect}, missing denies=${notDenied.length}`);
  add('policy.enforcement', (configs['permission-policy'].enforcement || {}).fail_closed === true,
    `enforcement.fail_closed=${(configs['permission-policy'].enforcement || {}).fail_closed}`);

  // 9. Workflow registry: 7 unique workflows, each with real steps and implementation.
  const workflows = configs['workflow-registry'].workflows || [];
  add('registry.workflow_count', workflows.length === 7, `workflows = ${workflows.length} (expected 7)`);
  add('registry.workflow_unique', new Set(workflows.map((w) => w.id)).size === workflows.length,
    `unique workflow IDs = ${new Set(workflows.map((w) => w.id)).size}`);
  const badWorkflows = workflows.filter((w) => !(w.steps || []).length || !w.implementation || !fs.existsSync(path.join(ROOT, w.implementation)));
  add('registry.workflow_implementation', badWorkflows.length === 0, `workflows with missing steps/implementation = ${badWorkflows.length}`);

  // 10. Zero runtime dependency on retired AES/UAES governance.
  const configText = CONFIG_NAMES.map((n) => fs.readFileSync(configPath(n), 'utf8')).join('\n');
  const retiredRefs = (configText.match(/\b(?:AES|UAES|uaes|docs\/ai-specs|uaes\/standards)\b/g) || []);
  add('independence.no_retired_governance_refs', retiredRefs.length === 0,
    `AES/UAES references in configs = ${retiredRefs.length}`);

  return {
    ok: findings.length === 0,
    checks,
    findings,
    summary: `${checks.filter((c) => c.status === 'PASS').length}/${checks.length} registry checks passed, ${findings.length} blocking findings`,
  };
}

export function readVersion() {
  return fs.existsSync(FILES.version) ? fs.readFileSync(FILES.version, 'utf8').trim() : '0.0.0';
}
