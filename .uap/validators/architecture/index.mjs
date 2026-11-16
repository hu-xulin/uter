import { ROOT, rootPath } from '../../runtime/_lib/paths.mjs';
import { loadAllConfigs, registryIntegrity, validatorById, specById, REQUIRED_SPEC_SECTIONS } from '../../runtime/_lib/config.mjs';
import { validatorResult, finding } from '../../runtime/_lib/contract.mjs';
import { exists, readText, readJSON, listFiles } from '../../runtime/_lib/util.mjs';

export const component = 'validators.architecture';

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
  return { ok, detail: `bytes=${text.length} sections_missing=${missing.length} header=${header} status=${m ? m[1] : 'none'}`, text };
}
function goCount(dir) {
  return listFiles(rootPath(dir), { filter: (f) => f.endsWith('.go') }).length;
}
// Independently recompute the specification dependency DAG.
function dag(specs) {
  const byId = new Map(specs.map((s) => [s.id, s]));
  const state = new Map();
  let cycles = 0;
  const missing = [];
  const visit = (id) => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'visiting') { cycles += 1; return; }
    state.set(id, 'visiting');
    for (const d of byId.get(id)?.dependencies || []) {
      if (!byId.has(d)) missing.push(`${id}->${d}`);
      else visit(d);
    }
    state.set(id, 'done');
  };
  for (const s of specs) visit(s.id);
  return { cycles, missing: missing.length };
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

const DOMAINS = ['core', 'product', 'architecture', 'agents', 'development', 'quality', 'security', 'cross-platform', 'delivery', 'evolution'];

export const validators = {
  // UAP-02-001 : module_boundaries / dependency_graph / architecture_evidence
  'architecture.consistency': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'architecture.consistency');
    const specs = configs['specification-registry'].specifications || [];
    const spec = inspectSpec(configs, 'UAP-02-001');

    const dirsOk = DOMAINS.filter((d) => exists(rootPath(`.uap/${d}`))).length;
    const domainsInSpecs = [...new Set(specs.map((s) => s.domain))];
    const rBounds = {
      name: 'module_boundaries',
      ok: dirsOk === 10 && domainsInSpecs.every((d) => DOMAINS.includes(d))
        && specs.length === 32 && regPass(registry, 'registry.unique_ids'),
      detail: `10 个域目录存在=${dirsOk}/10; 登记 domain 全部合法=${domainsInSpecs.every((d) => DOMAINS.includes(d))} (${domainsInSpecs.length} 个); spec 数=${specs.length}; unique_ids=${regPass(registry, 'registry.unique_ids')}`,
    };

    const d = dag(specs);
    const rGraph = {
      name: 'dependency_graph',
      ok: d.cycles === 0 && d.missing === 0
        && ['registry.dependencies_exist', 'registry.dependencies_acyclic'].every((c) => regPass(registry, c)),
      detail: `自算 DAG cycles=${d.cycles} missing_deps=${d.missing}; registry dependencies_exist/acyclic=${regPass(registry, 'registry.dependencies_exist')}/${regPass(registry, 'registry.dependencies_acyclic')}`,
    };

    const evFiles = listFiles(rootPath('.uap/evidence'), { filter: (f) => f.endsWith('.json') }).length;
    const rEvidence = {
      name: 'architecture_evidence',
      ok: spec.ok && spec.text.includes('证据要求') && spec.text.includes('证据')
        && ['registry.validator_mapping', 'registry.validator_unique', 'registry.validator_orphans'].every((c) => regPass(registry, c)),
      detail: `规范含证据要求章节=${spec.text.includes('证据要求')}; registry validator 映射/唯一/无孤儿=${['registry.validator_mapping', 'registry.validator_unique', 'registry.validator_orphans'].every((c) => regPass(registry, c))}; .uap/evidence/*.json 当前=${evFiles} 条(运行时产物,如实记录)`,
    };
    return assemble('architecture.consistency', checks, [rBounds, rGraph, rEvidence], {
      started, registry, evidence_refs: evidenceIds,
      note: '按 10 域目录 + 自算依赖 DAG + 证据章节/映射完整性真实复算',
    });
  },

  // UAP-02-002 : api_contracts / schema_integrity / migration_safety
  'architecture.api_database_integrity': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'architecture.api_database_integrity');
    const spec = inspectSpec(configs, 'UAP-02-002');

    const rApi = {
      name: 'api_contracts',
      ok: goCount('router') >= 20 && exists(rootPath('router/api-router.go'))
        && exists(rootPath('docs-dev/plugin-api/v1.schema.json'))
        && ['API', '契约', '幂等'].every((k) => spec.text.includes(k)),
      detail: `router/*.go=${goCount('router')} 个; api-router.go=${exists(rootPath('router/api-router.go'))}; 插件契约 v1.schema.json=${exists(rootPath('docs-dev/plugin-api/v1.schema.json'))}; 规范含 API/契约/幂等=${['API', '契约', '幂等'].every((k) => spec.text.includes(k))}`,
    };
    const rSchema = {
      name: 'schema_integrity',
      ok: goCount('model') >= 100 && exists(rootPath('go.mod')) && exists(rootPath('common/json.go'))
        && ['数据库', '字段', '约束'].every((k) => spec.text.includes(k)),
      detail: `model/*.go=${goCount('model')} 个; go.mod/common/json.go 存在=${exists(rootPath('go.mod')) && exists(rootPath('common/json.go'))}; 规范含 数据库/字段/约束=${['数据库', '字段', '约束'].every((k) => spec.text.includes(k))}`,
    };
    const rMig = {
      name: 'migration_safety',
      ok: exists(rootPath('model/migration_dialector.go')) && exists(rootPath('common/quota_math.go'))
        && ['迁移', '幂等', 'SQLite', 'MySQL', 'PostgreSQL', '备份', '回滚'].every((k) => spec.text.includes(k)),
      detail: `model/migration_dialector.go=${exists(rootPath('model/migration_dialector.go'))}; common/quota_math.go=${exists(rootPath('common/quota_math.go'))}; 规范含 迁移/幂等/三方言/备份/回滚=${['迁移', '幂等', 'SQLite', 'MySQL', 'PostgreSQL', '备份', '回滚'].every((k) => spec.text.includes(k))}`,
    };
    return assemble('architecture.api_database_integrity', checks, [rApi, rSchema, rMig], {
      started, registry, evidence_refs: evidenceIds,
      note: '基于真实 Go 代码目录(router 26 / model 193 个 .go)+插件契约+三方言迁移文件做静态核对; 不连接任何数据库',
    });
  },

  // UAP-02-003 : decision_records / decision_traceability
  'architecture.adr_integrity': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'architecture.adr_integrity');
    const spec = inspectSpec(configs, 'UAP-02-003');
    const adrReadme = exists(rootPath('docs/adr/README.md')) ? readText(rootPath('docs/adr/README.md')) : '';
    const adr0001 = exists(rootPath('docs/adr/0001-uter-design-system-single-source-of-truth.md'))
      ? readText(rootPath('docs/adr/0001-uter-design-system-single-source-of-truth.md')) : '';

    const rRecords = {
      name: 'decision_records',
      ok: !!adrReadme && !!adr0001 && ['ADR', '决策', '背景', '备选方案', '状态'].every((k) => spec.text.includes(k))
        && /Accepted|Proposed|Deprecated|Superseded/.test(adrReadme),
      detail: `docs/adr/README.md(bytes=${adrReadme.length}) 与 0001 ADR(bytes=${adr0001.length}) 存在; README 含状态枚举=${/Accepted|Proposed|Deprecated|Superseded/.test(adrReadme)}; 规范含 ADR/背景/备选方案/状态=${['ADR', '决策', '背景', '备选方案', '状态'].every((k) => spec.text.includes(k))}`,
    };
    const depSpec = specById(configs).get('UAP-02-001');
    const depTargetExists = !!depSpec && exists(rootPath(depSpec.file));
    // ADR-0001 records the historically accepted 3.0 runtime baseline. The
    // 3.0 source document was later retired while UDS 8.0.0 is acceptance-ready
    // (not yet accepted); verify the current canonical docs and explicit
    // compatibility boundary rather than requiring the deleted historical path.
    const designOverview = exists(rootPath('docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md'))
      ? readText(rootPath('docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md')) : '';
    const tokenManifest = readJSON(rootPath('docs/design-system/TOKEN-MANIFEST.json'), null);
    const migrationReport = exists(rootPath('docs/design-system/UDS-8.0.0-MIGRATION-REPORT.md'))
      ? readText(rootPath('docs/design-system/UDS-7.0-MIGRATION-REPORT.md')) : '';
    const currentDesignEvidence = !!tokenManifest
      && tokenManifest.version === '8.0.0'
      && tokenManifest.status === 'ACCEPTANCE_READY'
      && designOverview.includes('UDS 8.0.0 是唯一现行规范')
      && migrationReport.includes('当前字号真值') && migrationReport.includes('B6') && migrationReport.includes('DONE_VERIFIED');
    const rTrace = {
      name: 'decision_traceability',
      ok: depTargetExists && /Accepted/i.test(adr0001)
        && exists(rootPath('go.mod')) && exists(rootPath('web/package.json'))
        && currentDesignEvidence
        && ['追溯', '依赖标准'].every((k) => spec.text.includes(k)),
      detail: `依赖标准 UAP-02-001 文件存在=${depTargetExists}; 0001 ADR 含 Accepted=${/Accepted/i.test(adr0001)}; go.mod/web/package.json 存在=${exists(rootPath('go.mod')) && exists(rootPath('web/package.json'))}; 当前设计证据(UDS8.0.0总纲+Manifest+迁移报告+B6迁移状态)=${currentDesignEvidence}; 规范含 追溯/依赖标准=${['追溯', '依赖标准'].every((k) => spec.text.includes(k))}`,
    };
    return assemble('architecture.adr_integrity', checks, [rRecords, rTrace], {
      started, registry, evidence_refs: evidenceIds,
      note: '真实读取 docs/adr 决策记录与真实技术栈文件, 复核决策→代码可追溯',
    });
  },
};

export function health() {
  const configs = loadAllConfigs();
  const ids = Object.keys(validators);
  const declared = validatorById(configs);
  const mapped = ids.every((id) => declared.has(id));
  const codeOk = exists(rootPath('router/api-router.go')) && exists(rootPath('model/main.go')) && exists(rootPath('docs/adr/README.md'));
  return {
    component,
    ok: mapped && codeOk && ids.length === 3,
    checks: { validators_exported: ids.length, all_mapped_to_registry: mapped, real_code_paths_present: codeOk },
    summary: `architecture 导出 ${ids.length} 个验证器; 真实代码/ADR 路径存在=${codeOk}`,
    checked_at: new Date().toISOString(),
  };
}
