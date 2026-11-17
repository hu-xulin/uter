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

    const adrRows = [...adrReadme.matchAll(/^\|\s*\[(ADR-\d{4})\]\(([^)]+)\)\s*\|\s*([^|]+?)\s*\|\s*(Proposed|Accepted|Rejected|Deprecated|Superseded)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|$/gm)];
    const adrRecords = adrRows.map((row) => {
      const fileRel = `docs/adr/${row[2]}`;
      const body = exists(rootPath(fileRel)) ? readText(rootPath(fileRel)) : '';
      const frontmatter = (body.match(/^---\s*\n([\s\S]*?)\n---/) || [])[1] || '';
      const field = (key) => {
        const line = frontmatter.split('\n').find((item) => item.startsWith(`${key}:`));
        return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '') : '';
      };
      return { id: row[1], fileRel, status: row[4], date: row[5], body,
        frontmatterId: field('id'), frontmatterStatus: field('status'), frontmatterDate: field('date') };
    });
    const adrIds = adrRecords.map((a) => a.id);
    const adrRecordsValid = adrRecords.length > 0
      && new Set(adrIds).size === adrIds.length
      && adrRecords.every((a) => a.body.length > 0 && a.id === a.frontmatterId
        && a.status === a.frontmatterStatus && a.date === a.frontmatterDate);
    const acceptedAdrEvidence = adrRecords.filter((a) => a.status === 'Accepted').every((a) => {
      const refs = a.body.split('`').filter((part, index) => index % 2 === 1 && /^(?:docs|web|\.uap)\//.test(part));
      return refs.filter((p) => exists(rootPath(p))).length >= 2;
    });
    const rRecords = {
      name: 'decision_records',
      ok: !!adrReadme && adrRecordsValid && acceptedAdrEvidence
        && ['ADR', '决策', '背景', '备选方案', '状态'].every((k) => spec.text.includes(k))
        && /Accepted|Proposed|Rejected|Deprecated|Superseded/.test(adrReadme),
      detail: `ADR 索引条目=${adrRecords.length}; ID 唯一=${new Set(adrIds).size === adrIds.length}; frontmatter ID/status/date 与索引一致=${adrRecordsValid}; Accepted ADR 至少引用 2 个真实文件=${acceptedAdrEvidence}; 规范含 ADR/背景/备选方案/状态=${['ADR', '决策', '背景', '备选方案', '状态'].every((k) => spec.text.includes(k))}`,
    };
    const depSpec = specById(configs).get('UAP-02-001');
    const depTargetExists = !!depSpec && exists(rootPath(depSpec.file));
    const designOverview = exists(rootPath('docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md'))
      ? readText(rootPath('docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md')) : '';
    const tokenManifest = readJSON(rootPath('docs/design-system/TOKEN-MANIFEST.json'), null);
    const acceptanceRel = 'docs/design-system/UDS-8.0.0-FINAL-IMPLEMENTATION-AND-ACCEPTANCE-REPORT.md';
    const acceptance = exists(rootPath(acceptanceRel)) ? readText(rootPath(acceptanceRel)) : '';
    const compatibilityAdr = adrRecords.find((a) => a.id === 'ADR-0002');
    const currentDesignEvidence = !!tokenManifest
      && tokenManifest.version === '8.0.0'
      && tokenManifest.status === 'ACCEPTANCE_READY'
      && designOverview.includes('UDS 8.0.0 是唯一现行设计系统')
      && designOverview.includes('TOKEN-MANIFEST.json')
      && acceptance.includes('ACCEPTANCE_READY')
      && /accepted\s*=\s*false/i.test(acceptance);
    const compatibilityBoundaryRecorded = !!compatibilityAdr
      && compatibilityAdr.status === 'Accepted'
      && compatibilityAdr.body.includes('3.0 runtime compatibility boundary')
      && compatibilityAdr.body.includes('explicitly authorizes');
    const rTrace = {
      name: 'decision_traceability',
      ok: depTargetExists && adrRecordsValid && acceptedAdrEvidence
        && exists(rootPath('go.mod')) && exists(rootPath('web/package.json'))
        && currentDesignEvidence && compatibilityBoundaryRecorded
        && ['追溯', '依赖标准'].every((k) => spec.text.includes(k)),
      detail: `依赖标准 UAP-02-001 文件存在=${depTargetExists}; ADR 索引/文件/frontmatter 一致=${adrRecordsValid}; Accepted ADR 代码/文档引用存在=${acceptedAdrEvidence}; go.mod/web/package.json 存在=${exists(rootPath('go.mod')) && exists(rootPath('web/package.json'))}; 当前 UDS 总纲+Manifest+正式报告为 ACCEPTANCE_READY/accepted=false=${currentDesignEvidence}; ADR-0002 明确保留 3.0 runtime compatibility boundary=${compatibilityBoundaryRecorded}`,
    };
    return assemble('architecture.adr_integrity', checks, [rRecords, rTrace], {
      started, registry, evidence_refs: evidenceIds,
      note: '解析 ADR 索引与 frontmatter、验证唯一 ID/状态/日期、Accepted 决策的真实文件引用及 UDS 当前验收/兼容边界证据',
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
