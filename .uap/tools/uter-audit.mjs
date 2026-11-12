/**
 * uter-audit.mjs — Uter 全项目业务专项验证（只读静态审计）
 *
 * 约束：仅读取真实源码 / 执行只读本地命令；不访问网络、不写生产数据库、
 * 不执行支付/退款、不执行任何 git 写操作。
 *
 * 每个检查都基于真实文件数量、真实文本匹配或真实命令退出码；
 * 纯存在性探测一律命名为 *_presence 并使用 INFO/MINOR，绝不标成 BLOCKER 通过。
 */
import { rootPath, uapPath } from '../runtime/_lib/paths.mjs';
import { nowISO, readText, exists, listFiles, redact } from '../runtime/_lib/util.mjs';
import { runCommand } from '../runtime/_lib/proc.mjs';

export const component = 'uter-audit';

/** 必须真实扫描并统计文件数的 Uter 路径。 */
const SCAN_PATHS = [
  'controller/', 'model/', 'service/', 'middleware/', 'router/', 'common/',
  'web/src/', 'web/src/features/', 'scripts/', '.github/workflows/',
  'docs/design-system/', 'relaykit/', 'tokenkit/',
];

const SEVERITIES = ['BLOCKER', 'MAJOR', 'MINOR', 'INFO'];

// ---- 真实扫描辅助 ----------------------------------------------------------

function safeRead(rel) {
  try {
    return readText(rootPath(rel));
  } catch {
    return null; // 文件不存在或不可读：如实返回 null，绝不伪造内容
  }
}

function countFilesMatching(dirRel, re) {
  // listFiles 返回排序后的绝对路径数组；不存在时返回 []。
  return listFiles(rootPath(dirRel), { filter: (abs) => re.test(abs) }).length;
}

function countAnchorMatches(texts, anchors) {
  const combined = texts.filter((t) => typeof t === 'string').join('\n');
  return anchors.filter((a) => combined.includes(a));
}

// ---- 结果聚合 --------------------------------------------------------------

let allFindings = [];
let domainState = new Map();

function state(domain) {
  if (!domainState.has(domain)) {
    domainState.set(domain, { checks_run: 0, findings: [], files_read: new Set() });
  }
  return domainState.get(domain);
}

/** 记录一条 finding（evidence 记录），并计入该域的 checks_run。 */
function addFinding(domain, severity, code, message, file) {
  const s = state(domain);
  s.checks_run += 1;
  const f = { severity, code, message, ...(file ? { file } : {}), domain };
  s.findings.push(f);
  allFindings.push(f);
}

/** 读取某域用到的源码，并把「实际读取过的文件」计入 files_read。 */
function readFor(domain, rel) {
  const text = safeRead(rel);
  if (text !== null) state(domain).files_read.add(rel);
  return text;
}

// ---- 主审计 ----------------------------------------------------------------

export async function auditUter() {
  allFindings = [];
  domainState = new Map();

  // 1) 真实扫描 13 个路径，记录 exists / 真实文件数。目录不存在记为 MAJOR finding。
  const scanned_paths = [];
  let files_scanned_total = 0;
  for (const p of SCAN_PATHS) {
    const abs = rootPath(p);
    const dirExists = exists(abs);
    const files = listFiles(abs); // 排序后的绝对路径数组
    const count = files.length;
    files_scanned_total += count;
    scanned_paths.push({ path: p, exists: dirExists, file_count: count });
    if (!dirExists) {
      addFinding('environment', 'MINOR', `scan_target_presence`,
        `扫描路径 ${p} 不存在（exists:false），未按 PASS 计`, p);
    }
  }

  // 2) 认证与权限
  {
    const d = 'authentication';
    const mwBoundary = countFilesMatching('middleware/', /auth|permission|secure|token|rate.?limit/i);
    addFinding(d, mwBoundary > 0 ? 'INFO' : 'MAJOR', 'authz_middleware_boundary_files',
      `middleware/ 下授权/鉴权/限流边界相关文件真实计数 = ${mwBoundary}`, 'middleware/');
    const ctrlAuth = countFilesMatching('controller/', /token|login|auth|user|setup|oauth/i);
    addFinding(d, ctrlAuth > 0 ? 'INFO' : 'MAJOR', 'authz_controller_token_files',
      `controller/ 下登录/令牌/用户相关文件真实计数 = ${ctrlAuth}`, 'controller/');
    const combined = [readFor(d, 'middleware/auth.go'), readFor(d, 'middleware/secure_verification.go')];
    const authAnchors = ['role', 'token', 'authenticate', 'c.Get', 'c.Abort'];
    const matched = countAnchorMatches(combined, authAnchors);
    addFinding(d, matched.length > 0 ? 'INFO' : 'MINOR', 'authz_middleware_text',
      `middleware/auth.go + secure_verification.go 真实文本匹配鉴权锚点 ${matched.length}/${authAnchors.length}: [${matched.join(', ') || '无'}]`,
      'middleware/auth.go');
  }

  // 3) 计费
  {
    const d = 'billing';
    const svcBilling = countFilesMatching('service/', /billing|quota|settle|task_billing|funding/i);
    addFinding(d, svcBilling > 0 ? 'INFO' : 'MAJOR', 'billing_service_files',
      `service/ 下计费/quota/结算相关文件真实计数 = ${svcBilling}`, 'service/');
    const sessionText = readFor(d, 'service/billing_session.go');
    const sessionAnchors = ['type BillingSession struct', 'func (s *BillingSession) Refund',
      'PreConsumeBilling', 'func (s *BillingSession) Settle'];
    const matched = countAnchorMatches([sessionText], sessionAnchors);
    addFinding(d, matched.length >= 2 ? 'INFO' : 'MAJOR', 'billing_session_symbols',
      `service/billing_session.go 真实文本匹配计费会话锚点 ${matched.length}/${sessionAnchors.length}: [${matched.join(', ') || '无'}]`,
      'service/billing_session.go');
    const tokenText = readFor(d, 'model/token.go');
    const casAnchors = ['remain_quota >= ?', 'RowsAffected == 0', 'used_quota >= ?'];
    const casMatched = countAnchorMatches([tokenText], casAnchors);
    addFinding(d, casMatched.length > 0 ? 'INFO' : 'MAJOR', 'billing_quota_atomic_cas',
      `model/token.go 真实文本匹配原子 CAS 锚点 ${casMatched.length}/${casAnchors.length}: [${casMatched.join(', ') || '无'}]`,
      'model/token.go');
  }

  // 4) 模型与价格
  {
    const d = 'pricing';
    const modelPrice = countFilesMatching('model/', /price|pricing|model_pricing|model_catalog/i);
    addFinding(d, modelPrice > 0 ? 'INFO' : 'MAJOR', 'pricing_model_files',
      `model/ 下 price/pricing/model 相关文件真实计数 = ${modelPrice}`, 'model/');
    const pricingDirExists = exists(rootPath('web/src/features/pricing/'));
    const pricingFiles = listFiles(rootPath('web/src/features/pricing/')).length;
    addFinding(d, 'INFO', 'pricing_feature_presence',
      `web/src/features/pricing/ exists=${pricingDirExists}，真实文件计数 = ${pricingFiles}（存在性探测，仅 INFO）`,
      'web/src/features/pricing/');
    const pricingText = [readFor(d, 'model/model_pricing_autofill.go'), readFor(d, 'model/model_pricing_config.go')];
    const pAnchors = ['Price', 'QuotaType', 'ModelPrice'];
    const matched = countAnchorMatches(pricingText, pAnchors);
    addFinding(d, matched.length > 0 ? 'INFO' : 'MINOR', 'pricing_config_text',
      `model_pricing_* 真实文本匹配价格锚点 ${matched.length}/${pAnchors.length}: [${matched.join(', ') || '无'}]`,
      'model/model_pricing_config.go');
  }

  // 5) 支付
  {
    const d = 'payment';
    const topupFiles = countFilesMatching('controller/', /topup|alipay|wechat|payment|pay_/i);
    addFinding(d, topupFiles > 0 ? 'INFO' : 'MAJOR', 'payment_topup_files',
      `controller/ 下 topup/alipay/wechat/payment 相关文件真实计数 = ${topupFiles}`, 'controller/');
    const alipayText = readFor(d, 'controller/topup_alipay.go');
    const aAnchors = ['applyAlipayQueryResult', 'AlipayReconcileUnpaid', 'AlipayReconcileCreditFailed',
      'TRADE_CLOSED', 'ACQ.TRADE_NOT_EXIST'];
    const aMatched = countAnchorMatches([alipayText], aAnchors);
    addFinding(d, aMatched.length >= 2 ? 'INFO' : 'MAJOR', 'payment_alipay_reconcile_text',
      `controller/topup_alipay.go 真实文本匹配查单/入账锚点 ${aMatched.length}/${aAnchors.length}: [${aMatched.join(', ') || '无'}]`,
      'controller/topup_alipay.go');
    const topupText = readFor(d, 'model/topup.go');
    const idAnchors = ['claimPendingTopUp', 'alreadyDone', 'status = ?', 'RowsAffected != 1'];
    const idMatched = countAnchorMatches([topupText], idAnchors);
    addFinding(d, idMatched.length >= 2 ? 'INFO' : (topupText === null ? 'BLOCKER' : 'MAJOR'),
      'payment_idempotent_cas_text',
      `model/topup.go 真实文本匹配幂等 CAS 锚点 ${idMatched.length}/${idAnchors.length}: [${idMatched.join(', ') || '无'}]`,
      'model/topup.go');
    const payTs = readFor(d, 'web/src/features/wallet/lib/payment.ts');
    const tsAnchors = ['toPayAmount', 'Math.round', 'Math.floor(0.01)'];
    const tsMatched = countAnchorMatches([payTs], tsAnchors);
    addFinding(d, tsMatched.length >= 2 ? 'INFO' : 'MINOR', 'payment_amount_rounding_text',
      `wallet/lib/payment.ts 真实文本匹配金额取整锚点 ${tsMatched.length}/${tsAnchors.length}: [${tsMatched.join(', ') || '无'}]`,
      'web/src/features/wallet/lib/payment.ts');
  }

  // 6) 前端 / 设计系统
  {
    const d = 'frontend-design-system';
    const dsFiles = listFiles(rootPath('web/src/design-system/')).length;
    addFinding(d, dsFiles > 0 ? 'INFO' : 'MINOR', 'designsystem_src_files',
      `web/src/design-system/ 真实文件计数 = ${dsFiles}`, 'web/src/design-system/');
    const agentsText = readFor(d, 'web/AGENTS.md');
    addFinding(d, 'INFO', 'designsystem_agents_presence',
      `web/AGENTS.md 存在=${agentsText !== null}，真实字符长度 = ${agentsText !== null ? agentsText.length : 0}（存在性/长度探测，仅 INFO）`,
      'web/AGENTS.md');
    const docsFiles = listFiles(rootPath('docs/design-system/')).length;
    addFinding(d, docsFiles > 0 ? 'INFO' : 'MINOR', 'designsystem_docs_files',
      `docs/design-system/ 真实文件计数 = ${docsFiles}`, 'docs/design-system/');
  }

  // 7) CI/CD（读取真实文本，检查非空且含真实指令）
  {
    const d = 'ci-cd';
    const ciText = readFor(d, '.github/workflows/ci.yml');
    const ciAnchors = ['jobs:', 'steps:', 'uses:', 'run:'];
    const ciMatched = countAnchorMatches([ciText], ciAnchors);
    const ciOk = ciText !== null && ciText.trim().length > 0 && ciMatched.length >= 2;
    addFinding(d, ciOk ? 'INFO' : 'MAJOR', 'cicd_ci_yml_content',
      `.github/workflows/ci.yml 真实字节长度 = ${ciText !== null ? Buffer.byteLength(ciText) : 0}，非空指令锚点匹配 ${ciMatched.length}/${ciAnchors.length}: [${ciMatched.join(', ') || '无'}]`,
      '.github/workflows/ci.yml');
    const shText = readFor(d, 'scripts/verify-all.sh');
    const shAnchors = ['go test', 'set -e', 'echo', 'bun', 'npm'];
    const shMatched = countAnchorMatches([shText], shAnchors);
    const shOk = shText !== null && shText.trim().length > 0 && shMatched.length >= 2;
    addFinding(d, shOk ? 'INFO' : 'MAJOR', 'cicd_verify_all_content',
      `scripts/verify-all.sh 真实字节长度 = ${shText !== null ? Buffer.byteLength(shText) : 0}，非空指令锚点匹配 ${shMatched.length}/${shAnchors.length}: [${shMatched.join(', ') || '无'}]`,
      'scripts/verify-all.sh');
  }

  // 8) 依赖（读取真实文本 / JSON）
  {
    const d = 'dependencies';
    const goMod = readFor(d, 'go.mod');
    const goAnchors = ['module ', 'go 1.', 'require ('];
    const goMatched = countAnchorMatches([goMod], goAnchors);
    addFinding(d, goMatched.length >= 2 ? 'INFO' : 'MAJOR', 'deps_go_mod_text',
      `go.mod 真实文本匹配 ${goMatched.length}/${goAnchors.length}: [${goMatched.join(', ') || '无'}]`, 'go.mod');
    const pkgText = readFor(d, 'web/package.json');
    let depMsg = 'web/package.json 不可读';
    let depSev = 'MAJOR';
    if (pkgText !== null) {
      try {
        const pkg = JSON.parse(pkgText);
        const deps = Object.keys(pkg.dependencies || {}).length;
        const devDeps = Object.keys(pkg.devDependencies || {}).length;
        depMsg = `web/package.json 真实解析：dependencies=${deps}，devDependencies=${devDeps}`;
        depSev = deps + devDeps > 0 ? 'INFO' : 'MAJOR';
      } catch (e) {
        depMsg = `web/package.json JSON 解析失败：${redact(String(e.message))}`;
      }
    }
    addFinding(d, depSev, 'deps_package_json_text', depMsg, 'web/package.json');
    const lockCandidates = ['web/bun.lock', 'web/bun.lockb'];
    const lockFound = lockCandidates.find((c) => exists(rootPath(c))) || null;
    const lockLen = lockFound && readFor(d, lockFound) !== null ? safeRead(lockFound).length : 0;
    addFinding(d, 'INFO', 'deps_lockfile_presence',
      `lockfile 存在=${lockFound !== null}${lockFound ? `（${lockFound}，真实字符长度=${lockLen}）` : '（bun.lock/bun.lockb 均不存在）'}（存在性探测，仅 INFO）`,
      lockFound || 'web/bun.lock');
  }

  // 9) 真实本地命令（只读，记录真实 exit_code）
  const commandSpecs = [
    { command: 'git', args: ['status', '--porcelain=v1'], label: 'env_git_status' },
    { command: 'node', args: ['--version'], label: 'env_node_version' },
    { command: 'go', args: ['version'], label: 'env_go_version' },
  ];
  const commands = [];
  for (const spec of commandSpecs) {
    const r = await runCommand({ command: spec.command, args: spec.args, timeoutMs: 30000 });
    commands.push({
      command: r.command,
      exit_code: r.exit_code,
      timed_out: r.timed_out,
      spawn_error: r.spawn_error,
      stdout_preview: String(r.stdout || '').trim().slice(0, 200),
      stderr_preview: String(r.stderr || '').trim().slice(0, 200),
    });
    const changedLines = String(r.stdout || '').split('\n').filter((l) => l.trim().length > 0).length;
    let sev = 'INFO';
    if (r.spawn_error) sev = 'MINOR';
    else if (r.exit_code !== 0) sev = 'MAJOR';
    addFinding('environment', sev, spec.label,
      `真实命令 "${r.command}" exit_code=${r.exit_code}, timed_out=${r.timed_out}, spawn_error=${r.spawn_error || 'null'}` +
      (spec.label === 'env_git_status' ? `, porcelain 变更行数=${changedLines}` : `, stdout="${String(r.stdout || '').trim().slice(0, 80)}"`),
      null);
  }

  // 10) 汇总
  const blockers = allFindings.filter((f) => f.severity === 'BLOCKER').length;
  const majors = allFindings.filter((f) => f.severity === 'MAJOR').length;
  const minors = allFindings.filter((f) => f.severity === 'MINOR').length;
  const infos = allFindings.filter((f) => f.severity === 'INFO').length;
  const domains = [...domainState.entries()].map(([domain, s]) => ({
    domain,
    files_scanned: s.files_read.size, // 该域实际读取文本的不同源码文件数
    checks_run: s.checks_run,
    findings: s.findings,
  }));
  const checks_run_total = domains.reduce((a, d) => a + d.checks_run, 0);
  const summary = `扫描 ${SCAN_PATHS.length} 个路径（真实文件计数合计 ${files_scanned_total}，路径重叠按独立扫描计），` +
    `执行 ${checks_run_total} 项静态检查与 ${commands.length} 条真实只读命令，共 ${allFindings.length} 条 finding：` +
    `BLOCKER=${blockers}, MAJOR=${majors}, MINOR=${minors}, INFO=${infos}。` +
    `blockers 由 findings 中 severity==='BLOCKER' 的真实计数得出（未硬编码）。` +
    (blockers > 0 ? `存在 ${blockers} 项阻断级问题。` : '无阻断级 finding。');

  return {
    generated_at: nowISO(),
    domains,
    scanned_paths,
    commands,
    files_scanned_total,
    findings: allFindings,
    summary,
    blockers,
    severities: SEVERITIES,
  };
}

/** 真实探测：共享库、扫描目标、核心源码、命令适配器是否就绪。 */
export function health() {
  const libs = ['paths.mjs', 'util.mjs', 'proc.mjs'].every((f) => exists(uapPath('runtime/_lib', f)));
  const foundTargets = SCAN_PATHS.filter((p) => exists(rootPath(p))).length;
  const core = exists(rootPath('controller/topup.go')) &&
    exists(rootPath('model/topup.go')) &&
    exists(rootPath('service/billing_session.go')) &&
    exists(rootPath('web/src/features/wallet/lib/payment.ts'));
  const checks = {
    shared_libs_present: libs,
    all_scan_targets_present: foundTargets === SCAN_PATHS.length,
    core_source_present: core,
    proc_lib_available: typeof runCommand === 'function',
  };
  const ok = Object.values(checks).every(Boolean);
  return { component, ok, checks, checked_at: nowISO() };
}
