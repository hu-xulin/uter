import path from 'node:path';
import fs from 'node:fs';
import { ROOT, REPORTS, uapPath, rootPath } from '../runtime/_lib/paths.mjs';
import { loadAllConfigs, registryIntegrity, validatorById } from '../runtime/_lib/config.mjs';
import { assertValidatorResult, validatorResult, finding } from '../runtime/_lib/contract.mjs';
import { nowISO, writeJSON, listFiles } from '../runtime/_lib/util.mjs';
import { record } from '../runtime/evidence-engine/index.mjs';
import { publish } from '../runtime/event-system/index.mjs';

export const component = 'validators.dispatcher';
export const version = '1.0.0';

const moduleCache = new Map();

export function buildContext() {
  const configs = loadAllConfigs();
  const registry = registryIntegrity(configs);
  const evidenceIds = listFiles(uapPath('evidence'), { filter: (f) => f.endsWith('.json') })
    .map((f) => path.basename(f, '.json'));
  return { configs, registry, evidenceIds, root: ROOT, uapPath, rootPath };
}

async function loadDomain(implementation) {
  const abs = path.join(ROOT, implementation);
  if (!fs.existsSync(abs)) return { module: null, error: `implementation missing: ${implementation}` };
  if (moduleCache.has(abs)) return { module: moduleCache.get(abs), error: null };
  try {
    const module = await import(`${abs}?t=${Date.now()}`);
    moduleCache.set(abs, module);
    return { module, error: null };
  } catch (error) {
    return { module: null, error: `cannot import ${implementation}: ${error.message}` };
  }
}

/** Execute exactly one registered validator and persist real evidence. */
export async function runValidator(validatorId, context = buildContext()) {
  const configs = context.configs;
  const entry = validatorById(configs).get(validatorId);
  if (!entry) {
    return validatorResult({
      validator_id: validatorId, status: 'BLOCKED', executed: false, exit_code: null,
      findings: [finding('BLOCKER', 'validator_not_registered', `${validatorId} is not in validator-registry.yaml`)],
      summary: `validator ${validatorId} is not registered`,
    });
  }
  const started = Date.now();
  const { module, error: importError } = await loadDomain(entry.implementation);
  const fn = module?.validators?.[validatorId];
  if (!fn) {
    const result = validatorResult({
      validator_id: validatorId, status: 'BLOCKED', executed: false, exit_code: null,
      findings: [finding('BLOCKER', 'validator_check_missing', importError || `${entry.implementation} does not export validators['${validatorId}']`)],
      checks_run: entry.checks || [],
      summary: `validator ${validatorId} could not be executed: ${importError || 'check function missing'}`,
      duration_ms: Date.now() - started,
    });
    persistResult(validatorId, result);
    return result;
  }
  let result;
  try {
    result = await fn(context);
    assertValidatorResult(result);
  } catch (error) {
    result = validatorResult({
      validator_id: validatorId, status: 'FAIL', executed: true, exit_code: 1,
      findings: [finding('BLOCKER', 'validator_threw', `${validatorId}: ${error.message}`)],
      checks_run: entry.checks || [],
      summary: `validator ${validatorId} threw: ${error.message}`,
      duration_ms: Date.now() - started,
    });
  }
  result.validator_id = validatorId;
  result.duration_ms = Date.now() - started;
  // A checker must actually run every declared check.
  const declared = entry.checks || [];
  const missingChecks = declared.filter((c) => !(result.checks_run || []).includes(c));
  if (missingChecks.length && result.status === 'PASS') {
    result.status = 'FAIL';
    result.findings.push(finding('BLOCKER', 'required_check_skipped', `checks not reported as run: ${missingChecks.join(', ')}`));
  }
  persistResult(validatorId, result);
  return result;
}

function persistResult(validatorId, result) {
  const ev = record({
    kind: 'validator_result',
    command: `uap validate ${validatorId}`,
    exit_code: result.status === 'PASS' ? 0 : (result.exit_code ?? 1),
    inputs: { validator_id: validatorId },
    summary: result.summary,
    findings: result.findings,
  });
  result.evidence_refs = [...(result.evidence_refs || []), ev.evidence_id];
  publish('validator.executed', { validator_id: validatorId, status: result.status }, { severity: result.status === 'PASS' ? 'INFO' : 'WARN' });
}

export async function runAll(context = buildContext()) {
  const configs = context.configs;
  const ids = [...validatorById(configs).keys()];
  const results = [];
  // Sequential: validators may read shared state written by earlier checks.
  for (const id of ids) {
    results.push(await runValidator(id, context));
  }
  const summary = {
    generated_at: nowISO(),
    total: results.length,
    pass: results.filter((r) => r.status === 'PASS').length,
    fail: results.filter((r) => r.status === 'FAIL').length,
    blocked: results.filter((r) => r.status === 'BLOCKED').length,
    not_executed: results.filter((r) => r.status === 'NOT_EXECUTED').length,
    results,
  };
  writeJSON(path.join(REPORTS, 'VALIDATION-RESULTS.json'), summary);
  return summary;
}

export function coverage(context = buildContext()) {
  const configs = context.configs;
  const validators = [...validatorById(configs).values()];
  const implemented = validators.filter((v) => {
    const abs = path.join(ROOT, v.implementation);
    return fs.existsSync(abs);
  });
  return {
    registered: validators.length,
    implementation_files_present: implemented.length,
    domains: [...new Set(validators.map((v) => v.implementation))].length,
    mapping_complete: validators.length === (configs['specification-registry'].specifications || []).length,
    generated_at: nowISO(),
  };
}

export function health() {
  const ctx = buildContext();
  const validators = [...validatorById(ctx.configs).values()];
  const byDomain = new Map();
  for (const v of validators) {
    if (!byDomain.has(v.implementation)) byDomain.set(v.implementation, []);
    byDomain.get(v.implementation).push(v.id);
  }
  return {
    component,
    version,
    ok: ctx.registry.ok && byDomain.size === 10,
    checks: {
      registry_integrity: ctx.registry.ok,
      domain_modules: byDomain.size,
      validators_registered: validators.length,
      evidence_index_available: ctx.evidenceIds.length >= 0,
    },
    checked_at: nowISO(),
  };
}
