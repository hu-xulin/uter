/**
 * UAP engine: security
 * Executors: security.application / security.financial_integrity / security.reliability
 * Scans real files for secret-shaped literals, checks billing-invariant code
 * anchors and the permission-policy deny groups. All funds checks are simulated.
 */
import path from 'node:path';
import { REPORTS, rootPath, uapPath, relToRoot } from '../../runtime/_lib/paths.mjs';
import { readText, exists, listFiles, readJSON, writeJSON, nowISO, hash, redact } from '../../runtime/_lib/util.mjs';

export const component = 'engines.security';
export const version = '1.0.0';
export const executors = ['security.application', 'security.financial_integrity', 'security.reliability'];

const REPORT_FILE = path.join(REPORTS, 'SECURITY-SCAN.json');
const POLICY_FILE = '.uap/config/permission-policy.yaml';

const MUST_DENY = [
  'production_read', 'production_write', 'production_deploy', 'real_payment', 'real_refund',
  'secret_export', 'force_push', 'branch_creation', 'branch_switch', 'destructive_git',
  'quality_gate_disable', 'test_deletion_to_force_pass',
];

const SECRET_PATTERNS = [
  { id: 'gcp_api_key', re: /AIza[0-9A-Za-z_-]{20,}/g, severity: 'BLOCKER' },
  { id: 'stripe_webhook_secret', re: /whsec_[0-9A-Za-z]{16,}/g, severity: 'BLOCKER' },
  { id: 'openai_style_key', re: /\bsk-[0-9A-Za-z]{20,}/g, severity: 'BLOCKER' },
  { id: 'github_pat', re: /\bghp_[0-9A-Za-z]{30,}/g, severity: 'BLOCKER' },
  { id: 'aws_access_key', re: /\bAKIA[0-9A-Z]{16}\b/g, severity: 'BLOCKER' },
  { id: 'private_key_block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g, severity: 'BLOCKER' },
  { id: 'merchant_id', re: /(?:mch|merchant|商户)[_-]?id["'\s:=]+(\d{8,})/gi, severity: 'MAJOR' },
];

function scanSecrets() {
  const files = [
    ...listFiles(uapPath(), { recursive: true, filter: () => true }),
    ...listFiles(rootPath('web/src'), { recursive: true, filter: (a) => /\.tsx?$/.test(a) }),
    ...listFiles(rootPath('controller'), { recursive: true, filter: (a) => a.endsWith('.go') }),
  ].filter((a) => path.resolve(a) !== path.resolve(REPORT_FILE));

  const findings = [];
  let scanned = 0;
  for (const abs of files) {
    const rel = relToRoot(abs);
    let text;
    try { text = readText(abs); } catch { continue; }
    scanned += 1;
    text.split('\n').forEach((line, i) => {
      for (const p of SECRET_PATTERNS) {
        p.re.lastIndex = 0;
        if (p.re.test(line)) {
          findings.push({
            id: `SEC-${hash(`${rel}:${i + 1}:${p.id}`).slice(0, 10)}`,
            severity: p.severity, pattern_id: p.id, file: rel, line: i + 1,
            redacted_snippet: redact(line.trim().slice(0, 160)),
            possible_test_fixture: /_test\.|\.test\.|\.spec\.|fixture/i.test(rel),
          });
        }
      }
    });
  }
  return { scanned_file_count: scanned, secret_finding_count: findings.length, findings: findings.slice(0, 200) };
}

function checkFinancialAnchors() {
  const results = [];
  const qmAbs = rootPath('common/quota_math.go');
  const qm = exists(qmAbs) ? readText(qmAbs) : '';
  const qmLines = qm.split('\n');
  const fileAnchors = [
    { id: 'common.QuotaFromFloat', re: /func\s+QuotaFromFloat\s*\(/ },
    { id: 'common.QuotaRound', re: /func\s+QuotaRound\s*\(/ },
    { id: 'common.WalletQuotaFromDecimalStrict', re: /func\s+WalletQuotaFromDecimalStrict\s*\(/ },
    { id: 'common.QuotaFromDecimal', re: /func\s+QuotaFromDecimal\s*\(/ },
  ];
  for (const a of fileAnchors) {
    let line = null;
    qmLines.forEach((l, i) => { if (line === null && a.re.test(l)) line = i + 1; });
    results.push({ id: a.id, source: 'common/quota_math.go', found: line !== null, line, simulated_only: true });
  }

  const cross = [
    { id: 'toPayAmount', re: /toPayAmount/, dirs: ['controller', 'web/src'] },
    { id: 'TRADE_NOT_EXIST', re: /TRADE_NOT_EXIST/, dirs: ['controller', 'model', 'service', 'router'] },
    { id: 'alipay_signature_verification', re: /(?:alipay|VerifySign|NotifyVerify|VerifyWith)/, dirs: ['controller', 'service'] },
  ];
  for (const c of cross) {
    const evidence = [];
    for (const d of c.dirs) {
      const files = listFiles(rootPath(d), { recursive: true, filter: (a) => /\.(go|ts|tsx|mjs)$/.test(a) });
      for (const f of files) {
        readText(f).split('\n').forEach((l, i) => {
          c.re.lastIndex = 0;
          if (evidence.length < 5 && c.re.test(l)) {
            evidence.push({ file: relToRoot(f), line: i + 1, redacted: redact(l.trim().slice(0, 120)) });
          }
        });
        if (evidence.length >= 5) break;
      }
      if (evidence.length >= 5) break;
    }
    results.push({ id: c.id, source: c.dirs.join(','), found: evidence.length > 0, evidence, simulated_only: true });
  }
  return results;
}

function checkReliabilityAnchors() {
  const targets = [
    { id: 'quota_clamp_checked_variants', file: 'common/quota_math.go', re: /QuotaFromFloatChecked|QuotaRoundChecked|QuotaFromDecimalChecked/ },
    { id: 'quota_saturation_audit', file: 'service/log_info_generate.go', re: /attachQuotaSaturation|quota_saturation/ },
    { id: 'permission_fail_closed', file: POLICY_FILE, re: /fail_closed:\s*true/ },
  ];
  return targets.map((t) => {
    const abs = rootPath(t.file);
    return { id: t.id, source: t.file, found: exists(abs) ? t.re.test(readText(abs)) : false, simulated_only: true };
  });
}

function checkPermissionPolicy() {
  const abs = rootPath(POLICY_FILE);
  if (!exists(abs)) {
    return { exists: false, deny_groups_checked: MUST_DENY.length, deny_groups_present: 0, missing: MUST_DENY };
  }
  const text = readText(abs);
  const groups = {};
  let cur = null;
  for (const line of text.split('\n')) {
    const gm = line.match(/^  ([\w_]+):\s*$/);
    if (gm) { cur = gm[1]; groups[cur] = []; continue; }
    if (cur && /effect:/.test(line)) groups[cur].push(line.trim());
  }
  const present = MUST_DENY.filter((k) => (groups[k] || []).some((l) => /effect:\s*deny/.test(l)));
  const missing = MUST_DENY.filter((k) => !present.includes(k));
  return {
    exists: true, source: POLICY_FILE,
    deny_groups_checked: MUST_DENY.length,
    deny_groups_present: present.length,
    present, missing,
    default_effect_deny: /default_effect:\s*deny/.test(text),
    enforcement_fail_closed: /fail_closed:\s*true/.test(text),
  };
}

function artifactOk(file) {
  if (!exists(file)) return true;
  let j;
  try { j = readJSON(file); } catch { return false; }
  if (!j || !Array.isArray(j.secret_findings) || !Array.isArray(j.financial_anchors)) return false;
  if (!j.permission_policy || j.simulated_only !== true) return false;
  return true;
}

export function health() {
  const checks = {};
  checks.controller_dir = listFiles(rootPath('controller'), {
    recursive: false, filter: (a) => a.endsWith('.go'),
  }).length >= 1;
  checks.web_src_exists = exists(rootPath('web/src'));
  checks.uap_dir_exists = exists(uapPath());
  checks.quota_math_exists = exists(rootPath('common/quota_math.go'));
  checks.permission_policy_exists = exists(rootPath(POLICY_FILE));
  let anchors = null;
  try { anchors = checkFinancialAnchors(); } catch { anchors = null; }
  checks.financial_anchor_hit = Boolean(anchors && anchors.some((a) => a.found));
  let pol = null;
  try { pol = checkPermissionPolicy(); } catch { pol = null; }
  checks.deny_groups_hit = Boolean(pol && pol.deny_groups_present >= 1);
  checks.report_schema = artifactOk(REPORT_FILE);
  const ok = Object.values(checks).every(Boolean);
  return {
    component, ok, checks,
    summary: `financial_anchor_hits=${anchors ? anchors.filter((a) => a.found).length : 0} `
      + `deny_groups_present=${pol ? pol.deny_groups_present : 0} report_schema=${checks.report_schema}`,
    checked_at: nowISO(),
  };
}

export async function execute(task = {}, ctx = {}) {
  const started = nowISO();
  const secrets = scanSecrets();
  const financial = checkFinancialAnchors();
  const reliability = checkReliabilityAnchors();
  const policy = checkPermissionPolicy();

  const severityCounts = { BLOCKER: 0, MAJOR: 0 };
  for (const f of secrets.findings) severityCounts[f.severity] = (severityCounts[f.severity] || 0) + 1;

  writeJSON(REPORT_FILE, {
    schema_version: '1.0', generated_at: started,
    executor_ids: executors,
    simulated_only: true,
    scanned_file_count: secrets.scanned_file_count,
    secret_finding_count: secrets.secret_finding_count,
    severity_counts: severityCounts,
    secret_findings: secrets.findings,
    financial_anchors: financial,
    financial_anchor_hit_count: financial.filter((a) => a.found).length,
    reliability_anchors: reliability,
    reliability_anchor_hit_count: reliability.filter((a) => a.found).length,
    permission_policy: policy,
    policy: {
      no_real_funds: true,
      simulated_only: true,
      snippets_redacted: true,
      note: 'All billing/payment checks are static code anchors; no funds were moved.',
    },
  });

  return {
    status: 'SUCCEEDED',
    summary: `scanned ${secrets.scanned_file_count} real files; ${secrets.secret_finding_count} secret-shaped literals `
      + `(BLOCKER=${severityCounts.BLOCKER}); ${financial.filter((a) => a.found).length}/${financial.length} financial anchors, `
      + `${reliability.filter((a) => a.found).length}/${reliability.length} reliability anchors; `
      + `deny groups present ${policy.deny_groups_present}/${policy.deny_groups_checked}, missing=${policy.missing.length}; simulated_only=true`,
    changed_files: [relToRoot(REPORT_FILE)],
    commands: [],
    evidence_refs: [],
    outputs: {
      scanned_file_count: secrets.scanned_file_count,
      secret_finding_count: secrets.secret_finding_count,
      blocker_secret_count: severityCounts.BLOCKER,
      financial_anchor_hit_count: financial.filter((a) => a.found).length,
      financial_anchor_total: financial.length,
      reliability_anchor_hit_count: reliability.filter((a) => a.found).length,
      reliability_anchor_total: reliability.length,
      deny_groups_present: policy.deny_groups_present,
      deny_groups_checked: policy.deny_groups_checked,
      missing_deny_groups: policy.missing,
      default_effect_deny: policy.default_effect_deny || false,
      enforcement_fail_closed: policy.enforcement_fail_closed || false,
      simulated_only: true,
    },
  };
}
