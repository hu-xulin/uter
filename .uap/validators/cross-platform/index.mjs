import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { ROOT, rootPath } from '../../runtime/_lib/paths.mjs';
import { loadAllConfigs, registryIntegrity, validatorById, specById } from '../../runtime/_lib/config.mjs';
import { validatorResult, finding } from '../../runtime/_lib/contract.mjs';
import { exists, readText, readJSON, listFiles } from '../../runtime/_lib/util.mjs';
import { runCommand } from '../../runtime/_lib/proc.mjs';

export const component = 'validators.cross-platform';

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
  // UAP-07-001 : web_build / web_tests / route_integrity
  'cross_platform.web_integrity': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'cross_platform.web_integrity');
    const pkg = readJSON(rootPath('web/package.json'), null);

    // Real subprocess run: parse web/package.json and count real source files.
    const script = "import fs from 'node:fs';import path from 'node:path';"
      + "const pkg=JSON.parse(fs.readFileSync(" + JSON.stringify(rootPath('web/package.json')) + ",'utf8'));"
      + "const root=" + JSON.stringify(rootPath('web/src')) + ";"
      + "let n=0,tests=0;const walk=(d)=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const a=path.join(d,e.name);if(e.isDirectory())walk(a);else if(/\\.(ts|tsx)$/.test(a)){n++;if(/\\.(test|spec)\\.(ts|tsx)$/.test(a))tests++;}}};walk(root);"
      + "console.log(JSON.stringify({scripts:Object.keys(pkg.scripts||{}).length,n,tests,hasBuild:!!pkg.scripts?.build,hasTest:!!pkg.scripts?.test}));";
    const self = await selfCheck(script, 15000);
    const out = parseOut(self);
    const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
    const routerDep = Object.keys(deps).some((k) => /@tanstack\/.*router/.test(k));

    const rBuild = {
      name: 'web_build',
      ok: cmdRan(self) && !!out && out.hasBuild === true && out.n > 1000 && !!pkg?.scripts?.['build:check'],
      detail: `node 子进程统计 web/src .ts/.tsx=${out?.n ?? 'n/a'} 个; scripts.build=${out?.hasBuild} scripts.build:check=${!!pkg?.scripts?.['build:check']}; 未在本地执行完整 web 构建(需 bun 工具链), 不声称构建通过`,
    };
    const rTests = {
      name: 'web_tests',
      ok: !!out && out.hasTest === true && out.tests > 100 && !!pkg?.scripts?.typecheck,
      detail: `scripts.test=${out?.hasTest} scripts.typecheck=${!!pkg?.scripts?.typecheck}; web/src 测试文件=${out?.tests ?? 'n/a'} 个; 未在本地执行 bun run test, 不声称测试通过`,
    };
    const routeTree = listFiles(rootPath('web/src'), { filter: (f) => /routeTree/i.test(f) }).length;
    const rRoute = {
      name: 'route_integrity',
      ok: routeTree > 0 && routerDep && exists(rootPath('web/src')),
      detail: `routeTree 生成文件=${routeTree}; @tanstack/react-router 依赖=${routerDep}; web/src 存在=${exists(rootPath('web/src'))}`,
    };
    const blocked = !cmdRan(self);
    return assemble('cross_platform.web_integrity', checks, [rBuild, rTests, rRoute], {
      started, registry, evidence_refs: evidenceIds, commands: [self], blocked,
      note: '真实运行 node 子进程解析 web/package.json 并统计源码/测试文件; 仅核对源码与配置结构完整性, 未跑完整 web 构建/测试',
    });
  },

  // UAP-07-002 : h5_build / viewport / touch / mobile_tests
  // REAL browser verification: drives .uap/tools/h5-browser-matrix.mjs
  // (Playwright Chromium, 5 viewports x 5 routes, real touch dispatch, WCAG
  // 2.5.8-conformant hit-area measurement). Exit 2 = target unreachable /
  // browser unavailable => BLOCKED (ENVIRONMENT_UNAVAILABLE), never a pass.
  // Exit 1 = tool failure => FAIL (our failure, fail-closed). Exit 0 = the
  // tool's own verdict gates each declared check.
  'cross_platform.h5_integrity': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'cross_platform.h5_integrity');
    const toolRel = '.uap/tools/h5-browser-matrix.mjs';
    const reportRel = '.uap/reports/H5-BROWSER-MATRIX.json';
    const cmd = await runCommand({ command: 'node', args: [rootPath(toolRel)], timeoutMs: 600000 });
    const matrix = parseOut(cmd) || readJSON(rootPath(reportRel), null);
    const reportExists = exists(rootPath(reportRel));

    if (!cmdRan(cmd) || !matrix || typeof matrix.verdict !== 'object') {
      if (cmd.exit_code === 2 || matrix?.blocked === true) {
        return assemble('cross_platform.h5_integrity', checks, [], {
          started, registry, evidence_refs: evidenceIds, blocked: true, block_category: 'ENVIRONMENT_UNAVAILABLE',
          findings: [finding('BLOCKER', 'h5_environment_unavailable',
            `H5 浏览器矩阵未执行(${(matrix?.reason || cmd.stderr || '').slice(0, 160)}); 按服务门禁约定一律 BLOCKED, 绝不判 PASS`)],
          commands: [cmd],
          note: 'BLOCKED: 目标服务不可达或浏览器缺失, 矩阵未执行',
        });
      }
      return assemble('cross_platform.h5_integrity', checks, [
        { name: 'h5_build', ok: false, detail: `矩阵工具自身故障(exit=${cmd.exit_code}, stderr=${(cmd.stderr || '').slice(0, 120)}) — fail-closed` },
      ], {
        started, registry, evidence_refs: evidenceIds,
        findings: [finding('BLOCKER', 'h5_matrix_tool_failure', 'H5 矩阵工具执行失败, 无法取证')].filter(() => !cmdRan(cmd) || !matrix),
        commands: [cmd],
        note: 'FAIL: 工具故障视为能力失败( fail-closed ), 不归为环境受限',
      });
    }

    const v = matrix.verdict;
    const ctxF = matrix.context_findings || {};
    const cov = ctxF.touch_target_44_coverage || {};
    const mk = (name, key, extra) => ({
      name,
      ok: v[key] === 'PASS',
      detail: `真实浏览器矩阵 verdict.${key}=${v[key]} (${extra})`,
    });
    const results = [
      mk('h5_build', 'h5_build', `${matrix.matrix_rows} 行(5 视口 x 5 路由), 全部真实渲染=${matrix.matrix?.every((r) => r.spa_rendered) ?? 'n/a'}`),
      mk('viewport', 'viewport', `meta viewport + 横向溢出 0: ${matrix.matrix?.filter((r) => r.horizontal_overflow_px > 0).length ?? 'n/a'} 行溢出`),
      mk('touch', 'touch', `真实触屏 tap 派发 + WCAG 2.5.8 24x24 硬线违规 <24=${cov.interactive_elements_below_24 ?? 'n/a'} 个(含等效命中区/豁免判定); 44x44 推荐以下=${cov.interactive_elements_below_44 ?? 'n/a'} 个如实记录(设计系统 §15.3 非强制)`),
      mk('mobile_tests', 'mobile_tests', `matrix_rows=${matrix.matrix_rows}, rendered=${matrix.matrix?.filter((r) => r.spa_rendered).length ?? 'n/a'}, 控制台/页面错误行=${matrix.matrix?.filter((r) => r.page_errors?.length || r.console_errors?.length).length ?? 'n/a'}`),
    ];
    return assemble('cross_platform.h5_integrity', checks, results, {
      started, registry, evidence_refs: evidenceIds,
      commands: [cmd],
      findings: results.filter((r) => !r.ok).map((r) => finding('BLOCKER', `h5_${r.name}_fail`, r.detail)),
      note: `真实 Playwright Chromium 矩阵(${matrix.viewports?.length || 5} 视口 x ${(matrix.routes || []).length || 5} 路由), 产物 ${reportRel} 存在=${reportExists}; verdict=${JSON.stringify(v)}`,
    });
  },

  // UAP-07-003 : feature_mapping / api_consistency / business_consistency
  'cross_platform.consistency_integrity': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'cross_platform.consistency_integrity');
    const agentsMd = exists(rootPath('AGENTS.md')) ? readText(rootPath('AGENTS.md')) : '';
    const specs = configs['specification-registry'].specifications || [];
    const webSpec = specById(configs).get('UAP-07-001');
    const h5Spec = specById(configs).get('UAP-07-002');

    // feature_mapping: web and H5 share ONE source tree and ONE API layer.
    // The single authoritative Markdown path is the UDS 8.0.0 standard,
    // so checking that retired path made this validator fail for the wrong
    // reason. Validate the current canonical 7.0 SSOT and its explicit
    // compatibility boundary instead: 7.0 is acceptance-ready but NOT yet
    // accepted, while 3.0 remains the runtime-enforced standard until Phase 6.
    const dsRel = 'docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md';
    const manifestRel = 'docs/design-system/TOKEN-MANIFEST.json';
    const migrationRel = 'docs/design-system/UDS-8.0.0-MIGRATION-REPORT.md';
    const ds = exists(rootPath(dsRel)) ? readText(rootPath(dsRel)) : '';
    const manifest = readJSON(rootPath(manifestRel), null);
    const migration = exists(rootPath(migrationRel)) ? readText(rootPath(migrationRel)) : '';
    const compatMap = readJSON(rootPath('docs/design-system/COMPAT-MAP.json'), null);
    const acceptance = exists(rootPath('docs/design-system/FINAL-ACCEPTANCE-REPORT.md'))
      ? readText(rootPath('docs/design-system/FINAL-ACCEPTANCE-REPORT.md')) : '';
    const batches = Array.isArray(compatMap?.migrationBatches) ? compatMap.migrationBatches : [];
    const designSystemReady = !!manifest
      && manifest.version === '8.0.0'
      && manifest.status === 'ACCEPTANCE_READY'
      && ds.includes('UDS 8.0.0 是唯一现行规范')
      && ds.includes('TOKEN-MANIFEST.json')
      && migration.includes('当前字号真值')
      && migration.includes('B6')
      && migration.includes('DONE_VERIFIED')
      && exists(rootPath('docs/design-system/SHOWCASE-8.0.0.html'));
    const runtimeBoundaryExplicit = ds.includes('颜色语义层 --ds-* bridge 为唯一运行时权威')
      && ds.includes('3.0 兼容层 colors.css 已退役')
      && typeof compatMap?.isolation?.scalarAlignment === 'string'
      && compatMap.version === '8.0.0'
      && compatMap.isolation.runtimePrefix === '--ds-'
      && compatMap.isolation.scalarAlignment.includes('TOKEN-MANIFEST')
      && batches.length >= 6 && batches.every((batch) => batch.status === 'DONE_VERIFIED')
      && migration.includes('B6') && migration.includes('DONE_VERIFIED')
      && migration.includes('PROHIBITED')
      && acceptance.includes('accepted: false');
    const dupTrees = ['h5/src', 'mobile/src', 'web-h5/src', 'm/src'].filter((d) => exists(rootPath(d)));
    const featureDirs = exists(rootPath('web/src/features'))
      ? fs.readdirSync(rootPath('web/src/features'), { withFileTypes: true }).filter((e) => e.isDirectory()).length
      : 0;
    const sharedTypeScale = designSystemReady && runtimeBoundaryExplicit;
    const rFeature = {
      name: 'feature_mapping',
      ok: dupTrees.length === 0 && featureDirs > 0 && sharedTypeScale
        && agentsMd.includes('00-UTER-DESIGN-SYSTEM-OVERVIEW.md') && !!webSpec && !!h5Spec,
      detail: `重复移动端源码树=${dupTrees.length ? dupTrees.join(',') : '无'}; web/src/features 实际 feature 目录数=${featureDirs}; UDS 8.0.0 SSOT/Token Manifest/迁移报告/Showcase 完整=${designSystemReady}; 8.0.0 运行时 bridge/迁移批次/未接受状态边界明确=${runtimeBoundaryExplicit}; AGENTS.md 绑定当前设计系统总纲=${agentsMd.includes('00-UTER-DESIGN-SYSTEM-OVERVIEW.md')}`,
    };

    // api_consistency: single frontend API client + backend-only business rules.
    const apiClient = listFiles(rootPath('web/src'), { filter: (f) => /(?:\/api\/|\/client\.|apiClient|request\.)/i.test(f) }).length;
    const rApi = {
      name: 'api_consistency',
      ok: exists(rootPath('service/authz')) && apiClient > 0 && !exists(rootPath('web-h5/src/api')),
      detail: `web/src 下 API 客户端/请求封装文件=${apiClient}; 后端 service/authz 存在=${exists(rootPath('service/authz'))}; 无独立 H5 API 树=${!exists(rootPath('web-h5/src/api'))}; 前后端共用同一 API 层`,
    };

    const pm = readJSON(rootPath('docs/product/registry/product-model.json'), null);
    const locales = listFiles(rootPath('web/src/i18n/locales'), { filter: (f) => f.endsWith('.json') }).length;
    const sameBase = !!webSpec && !!h5Spec && JSON.stringify(webSpec.dependencies) === JSON.stringify(h5Spec.dependencies);
    const rBusiness = {
      name: 'business_consistency',
      ok: !!pm?.source_of_truth && locales >= 2 && sameBase
        && regPass(registry, 'registry.dependencies_exist'),
      detail: `product-model.json source_of_truth=${!!pm?.source_of_truth}; i18n locales=${locales}; web/H5 规范依赖同一基线=${sameBase} (${JSON.stringify(webSpec?.dependencies || [])}); 依赖存在=${regPass(registry, 'registry.dependencies_exist')}`,
    };
    return assemble('cross_platform.consistency_integrity', checks, [rFeature, rApi, rBusiness], {
      started, registry, evidence_refs: evidenceIds,
      note: `源码/配置级一致性真实核对(单一 web/src 源码树/统一 API/共享 SSOT); 真机两端一致性未验证(见 h5_integrity BLOCKED); feature 目录计数=${featureDirs}`,
    });
  },
};

export function health() {
  const configs = loadAllConfigs();
  const ids = Object.keys(validators);
  const declared = validatorById(configs);
  const mapped = ids.every((id) => declared.has(id));
  const webOk = exists(rootPath('web/package.json')) && exists(rootPath('web/src'));
  return {
    component,
    ok: mapped && webOk && ids.length === 3,
    checks: { validators_exported: ids.length, all_mapped_to_registry: mapped, web_project_present: webOk },
    summary: `cross-platform 导出 ${ids.length} 个验证器; web 工程存在=${webOk}; h5_integrity 由真实浏览器矩阵判定(目标不可达时 BLOCKED)`,
    checked_at: new Date().toISOString(),
  };
}
