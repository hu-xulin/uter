import { pathToFileURL } from 'node:url';
import { ROOT, rootPath } from '../../runtime/_lib/paths.mjs';
import {
  loadAllConfigs, registryIntegrity, validatorById, executorEntries,
} from '../../runtime/_lib/config.mjs';
import { validatorResult, finding } from '../../runtime/_lib/contract.mjs';
import { exists, readText, readJSON } from '../../runtime/_lib/util.mjs';
import { runCommand } from '../../runtime/_lib/proc.mjs';

export const component = 'validators.development';

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
function implPaths(configs) {
  return [...new Set([...validatorById(configs).values()].map((v) => rootPath(v.implementation)))];
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
  // UAP-04-001 : format / lint / typecheck / dead_code
  'development.coding_compliance': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'development.coding_compliance');
    const impls = implPaths(configs);

    let fmtOk = 0;
    for (const f of impls) {
      const t = exists(f) ? readText(f) : '';
      if (t.endsWith('\n') && !t.includes('\t') && !t.includes('\r\n')) fmtOk += 1;
    }
    const rFormat = {
      name: 'format', ok: fmtOk === impls.length,
      detail: `${fmtOk}/${impls.length} 个验证器模块以换行结尾/无 tab/无 CRLF`,
    };

    // lint: really run `node --check` on every validator module in a subprocess.
    const lintScript = "import {spawnSync} from 'node:child_process';"
      + "const files=" + JSON.stringify(impls) + ";"
      + "const bad=[];for(const f of files){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)bad.push(f+':'+r.status);}"
      + "console.log(JSON.stringify({checked:files.length,bad,ok:bad.length===0}));";
    const lint = await selfCheck(lintScript, 15000);
    const lintOut = parseOut(lint);
    const rLint = {
      name: 'lint', ok: cmdRan(lint) && !!lintOut && lintOut.ok === true,
      detail: `node 子进程 spawnSync(node --check) 对 ${impls.length} 个模块: exit_code=${lint.exit_code} 语法失败=${lintOut?.bad?.length ?? 'n/a'}`,
    };

    // typecheck: dynamically import every validator module, verify its exports.
    const exportedKeys = new Set();
    const importBad = [];
    for (const f of impls) {
      try {
        const m = await import(`${pathToFileURL(f).href}?t=${Date.now()}`);
        if (typeof m.component === 'string' && m.validators && typeof m.validators === 'object' && typeof m.health === 'function') {
          for (const k of Object.keys(m.validators)) exportedKeys.add(k);
        } else importBad.push(f);
      } catch (e) { importBad.push(`${f}(${e.message})`); }
    }
    const rType = {
      name: 'typecheck', ok: importBad.length === 0 && exportedKeys.size === 32,
      detail: `动态 import ${impls.length} 个模块成功=${impls.length - importBad.length}; 导出 validator 键合计=${exportedKeys.size}${importBad.length ? '; 异常 ' + importBad.slice(0, 2).join(',') : ''}`,
    };

    // dead_code: exported keys must equal the registered validator IDs exactly.
    const declared = new Set([...validatorById(configs).keys()]);
    const orphan = [...exportedKeys].filter((k) => !declared.has(k));
    const missing = [...declared].filter((k) => !exportedKeys.has(k));
    const rDead = {
      name: 'dead_code', ok: orphan.length === 0 && missing.length === 0,
      detail: `registry 声明 ${declared.size} 个; 导出 ${exportedKeys.size} 个; 孤儿导出=${orphan.length} 未实现=${missing.length}${orphan.length ? ' (' + orphan.slice(0, 3).join(',') + ')' : ''}${missing.length ? ' 缺(' + missing.slice(0, 3).join(',') + ')' : ''}`,
    };
    const blocked = !cmdRan(lint);
    return assemble('development.coding_compliance', checks, [rFormat, rLint, rType, rDead], {
      started, registry, evidence_refs: evidenceIds, commands: [lint], blocked,
      note: '真实对 10 个验证器模块做 node --check / 动态 import / 导出键与 registry 精确对齐; 未跑 Go/前端 lint 门禁(超出本次范围)',
    });
  },

  // UAP-04-002 : review_execution / finding_schema / blocking_rules
  'development.review_integrity': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'development.review_integrity');
    const url = pathToFileURL(rootPath('.uap/runtime/_lib/contract.mjs')).href;
    // Really execute the independent-review contract in a fresh process.
    const script = "const c=await import('" + url + "');"
      + "const er=c.executorResult({status:'SUCCEEDED'});"
      + "let normalOk=true;try{c.assertExecutorResult(er)}catch{normalOk=false}"
      + "let selfReportRejected=false;try{c.assertExecutorResult({...er,validation_results:[{x:1}]})}catch{selfReportRejected=true}"
      + "const f=c.finding('BLOCKER','X','msg',{extra:1});"
      + "const findingSchema=f.severity==='BLOCKER'&&f.code==='X'&&f.message==='msg'&&f.extra===1;"
      + "const p1=c.validatorResult({validator_id:'p',status:'PASS',executed:true,exit_code:0,findings:[c.finding('BLOCKER','b','b')]});"
      + "const p2=c.validatorResult({validator_id:'p',status:'PASS',executed:true,exit_code:0,findings:[c.finding('MAJOR','m','m')]});"
      + "const p3=c.validatorResult({validator_id:'p',status:'PASS',executed:false,exit_code:0,findings:[]});"
      + "const blocking=p1.status==='FAIL'&&p2.status==='PASS'&&p3.status==='FAIL';"
      + "console.log(JSON.stringify({normalOk,selfReportRejected,findingSchema,blocking,ok:normalOk&&selfReportRejected&&findingSchema&&blocking}));";
    const self = await selfCheck(script, 15000);
    const out = parseOut(self);
    const execs = executorEntries(configs);
    const mapped = !!execs['development.code_review'] && regPass(registry, 'registry.validator_mapping');

    const rReview = {
      name: 'review_execution',
      ok: cmdRan(self) && !!out && out.normalOk === true && out.selfReportRejected === true && mapped,
      detail: `执行器不得自报 validation_results(assertExecutorResult 拒绝)=${out?.selfReportRejected}; 正常 executorResult 通过=${out?.normalOk}; code_review 执行器已登记=${!!execs['development.code_review']}`,
    };
    const rSchema = {
      name: 'finding_schema',
      ok: !!out && out.findingSchema === true,
      detail: `finding() 返回 severity/code/message/extra 结构=${out?.findingSchema}`,
    };
    const rBlocking = {
      name: 'blocking_rules',
      ok: !!out && out.blocking === true,
      detail: `BLOCKER 降级 PASS->FAIL / MAJOR 不阻断 / executed:false 降级=${out?.blocking} (p1=${out ? 'FAIL' : 'n/a'} p2=${out ? 'PASS' : 'n/a'} p3=${out ? 'FAIL' : 'n/a'})`,
    };
    const blocked = !cmdRan(self);
    return assemble('development.review_integrity', checks, [rReview, rSchema, rBlocking], {
      started, registry, evidence_refs: evidenceIds, commands: [self], blocked,
      note: 'node 子进程真实复验 执行器/验证器分离 + finding schema + BLOCKER-only 阻断; 未调用 code-review 引擎 execute() 给自己盖章',
    });
  },

  // UAP-04-003 : lockfile / vulnerabilities / unused_dependencies
  'development.dependency_integrity': async (ctx = {}) => {
    const started = Date.now();
    const { configs, registry, evidenceIds } = ctxOf(ctx);
    const checks = checksOf(configs, 'development.dependency_integrity');
    const baseline = readJSON(rootPath('.uap/state/BASELINE.json'), null);
    const goMod = exists(rootPath('go.mod')) ? readText(rootPath('go.mod')) : '';
    const webPkg = readJSON(rootPath('web/package.json'), null);

    const rLock = {
      name: 'lockfile',
      ok: exists(rootPath('go.sum')) && goMod.includes('module ') && !!webPkg && typeof webPkg === 'object',
      detail: `go.sum=${exists(rootPath('go.sum'))}; go.mod 声明 module=${goMod.includes('module ')}; web/package.json 可解析=${!!webPkg}`,
    };

    // vulnerabilities: real local static scan for plaintext secrets in configs
    // plus fail-closed policy. We explicitly do NOT claim a clean CVE bill of
    // materials because no external vulnerability database is available offline.
    const configText = ['permission-policy', 'agent-registry', 'execution-mapping', 'validator-registry', 'workflow-registry', 'specification-registry']
      .map((n) => exists(rootPath(`.uap/config/${n}.yaml`)) ? readText(rootPath(`.uap/config/${n}.yaml`)) : '').join('\n');
    const secretHits = (configText.match(/(?:sk-[0-9A-Za-z]{20,}|ghp_[0-9A-Za-z]{30,}|AIza[0-9A-Za-z_-]{20,}|whsec_[0-9A-Za-z]{16,})/g) || []).length;
    const policyText = exists(rootPath('.uap/config/permission-policy.yaml')) ? readText(rootPath('.uap/config/permission-policy.yaml')) : '';
    const rVuln = {
      name: 'vulnerabilities',
      ok: secretHits === 0 && /secret_export:\s*\n?\s*effect:\s*deny/.test(policyText) && regPass(registry, 'policy.fail_closed'),
      detail: `本地配置明文密钥命中=${secretHits}; policy secret_export=deny=${/secret_export:\s*\n?\s*effect:\s*deny/.test(policyText)}; fail_closed=${regPass(registry, 'policy.fail_closed')}; 未运行外部 CVE 库扫描(离线), 不声称无 CVE`,
    };

    // Execute the repository's strict Knip configuration. A baseline stating
    // that no new dependency was installed is not evidence that existing
    // dependencies or exports are still used; dead-code checks must run.
    const knip = await runCommand({
      command: 'bun',
      args: ['run', 'knip', '--reporter', 'json'],
      cwd: rootPath('web'),
      timeoutMs: 300000,
    });
    const knipOk = cmdRan(knip);
    const newDeps = baseline?.toolchain?.new_dependencies_installed;
    const rUnused = {
      name: 'unused_dependencies',
      ok: knipOk && Array.isArray(newDeps) && newDeps.length === 0
        && regPass(registry, 'independence.no_retired_governance_refs')
        && goMod.includes('require') && !!webPkg?.scripts,
      detail: `Knip 实际执行=${knipOk} (exit=${knip.exit_code ?? 'n/a'}, timeout=${knip.timed_out}, spawn_error=${knip.spawn_error ?? 'none'}); BASELINE.new_dependencies_installed=${Array.isArray(newDeps) ? newDeps.length : 'n/a'}(零新增); 无退役 AES/UAES 治理引用=${regPass(registry, 'independence.no_retired_governance_refs')}; go.mod 含 require=${goMod.includes('require')}; web scripts 存在=${!!webPkg?.scripts}`,
    };
    return assemble('development.dependency_integrity', checks, [rLock, rVuln, rUnused], {
      started, registry, evidence_refs: evidenceIds, commands: [knip],
      note: '真实执行 web/package.json 的 Knip + 读取 Go/前端锁文件与 UAP baseline + 配置明文密钥正则扫描; 未自动删除任何依赖',
    });
  },
};

export function health() {
  const configs = loadAllConfigs();
  const ids = Object.keys(validators);
  const declared = validatorById(configs);
  const mapped = ids.every((id) => declared.has(id));
  const codeOk = exists(rootPath('go.sum')) && exists(rootPath('web/package.json')) && exists(rootPath('.uap/state/BASELINE.json'));
  return {
    component,
    ok: mapped && codeOk && ids.length === 3,
    checks: { validators_exported: ids.length, all_mapped_to_registry: mapped, lockfiles_present: codeOk, validator_modules: implPaths(configs).length },
    summary: `development 导出 ${ids.length} 个验证器; go.sum/web/package.json/BASELINE 存在=${codeOk}`,
    checked_at: new Date().toISOString(),
  };
}
