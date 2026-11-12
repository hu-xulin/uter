/**
 * UAP engine: code-review
 * Executor: development.code_review
 * Gets the REAL changed-file list from git status / git diff and runs a
 * structured review over those files. Style preferences are NEVER BLOCKERs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPORTS, rootPath, relToRoot } from '../../runtime/_lib/paths.mjs';
import { readText, exists, listFiles, readJSON, writeJSON, nowISO, redact } from '../../runtime/_lib/util.mjs';
import { runCommand } from '../../runtime/_lib/proc.mjs';

export const component = 'engines.code-review';
export const version = '1.0.0';
export const executors = ['development.code_review'];

const REPORT_FILE = path.join(REPORTS, 'CODE-REVIEW.json');

const MONEY_CONTEXT = /(amount|price|quota|pay|fee|金额|价格|计费|结算|charge|wallet|topup)/i;
const SECRET_PATTERNS = [
  { id: 'gcp_api_key', re: /AIza[0-9A-Za-z_-]{20,}/g },
  { id: 'stripe_webhook_secret', re: /whsec_[0-9A-Za-z]{16,}/g },
  { id: 'openai_style_key', re: /\bsk-[0-9A-Za-z]{20,}/g },
  { id: 'github_pat', re: /\bghp_[0-9A-Za-z]{30,}/g },
  { id: 'private_key_block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { id: 'merchant_id', re: /(?:mch|merchant|商户)[_-]?id["'\s:=]+(\d{8,})/gi },
];

function anySecret(line, indices) {
  return indices.some((i) => { SECRET_PATTERNS[i].re.lastIndex = 0; return SECRET_PATTERNS[i].re.test(line); });
}

/**
 * A line that merely *documents* a prohibition (e.g. "禁止 rm -rf" in a spec
 * or a rule's root_cause string) is not an executed destructive command.
 * Suppress those so prose references do not become false BLOCKER findings.
 * Secret-literal rules deliberately do NOT use this suppression.
 */
function isProseLine(line) {
  const s = line.trim();
  if (/^(?:[-*+]\s|>|\/\/|#|\/\*|\*)/.test(s)) return true;
  if (/[\u4e00-\u9fa5]/.test(line) && /禁止|不得|绝不|不允许|要求|规范|约束|说明|明确|对齐|保护|政策/i.test(line)) return true;
  if (/AGENTS\.md|Change Protection|MODULE-CONTRACT|root_cause|reserved for|\bnote\b/i.test(line)) return true;
  return false;
}

const RULES = [
  {
    code: 'CR-MONEY-MATH-FLOOR', severity: 'MAJOR',
    test: (l) => /Math\.floor\s*\(/.test(l) && MONEY_CONTEXT.test(l),
    root_cause: '金额换算使用裸 Math.floor，可能绕过集中式 quota/toPayAmount 转换与饱和钳制',
    suggestion: '改用集中式 helper（toPayAmount / common.QuotaFromFloat）并校验输入上界',
  },
  {
    code: 'CR-SECRET-LITERAL', severity: 'BLOCKER',
    test: (l) => anySecret(l, [0, 1, 2, 3, 4]),
    root_cause: '疑似真实密钥字面量出现在改动文件中',
    suggestion: '立即轮换密钥，改用环境变量/密钥管理，禁止提交明文',
  },
  {
    code: 'CR-MERCHANT-ID', severity: 'MAJOR',
    test: (l) => anySecret(l, [5]),
    root_cause: '疑似真实商户号硬编码在改动文件中',
    suggestion: '改用配置项注入，避免提交真实商户标识',
  },
  {
    code: 'CR-RM-RF', severity: 'BLOCKER',
    test: (l) => !isProseLine(l) && /\brm\s+-[rR]*[fF]|\brm\s+-[fF]*[rR]/.test(l),
    root_cause: '破坏性删除命令（AGENTS.md 明确禁止 rm -rf）',
    suggestion: '改用 OS 回收站机制分批删除，每批不超过 10 个并复核',
  },
  {
    code: 'CR-DESTRUCTIVE-GIT', severity: 'BLOCKER',
    test: (l) => !isProseLine(l) && /git\s+(?:clean\s+-fd|reset\s+--hard|push\s+(?:--force|-f)\b|checkout\s+--|branch\s+-D)/.test(l),
    root_cause: '破坏性 git 操作会覆盖用户未提交改动',
    suggestion: '改用非破坏性操作；确需回滚须先与用户确认',
  },
  {
    code: 'CR-TODO-MONEY', severity: 'MAJOR',
    test: (l) => /\b(?:TODO|FIXME)\b/.test(l) && MONEY_CONTEXT.test(l),
    root_cause: '资金路径存在未完成的 TODO/FIXME',
    suggestion: '补齐实现与对应回归测试后再合入',
  },
  {
    code: 'CR-EMPTY-CATCH', severity: 'MAJOR',
    test: (l) => /catch\s*\([^)]*\)\s*\{\s*\}|catch\s*\{\s*\}/.test(l),
    root_cause: '空 catch 吞掉异常，错误被静默忽略',
    suggestion: '记录日志并向上返回错误，或显式处理',
  },
  {
    code: 'CR-IGNORED-ERR', severity: 'MINOR',
    test: (l) => /_\s*=\s*err\b|@ts-ignore|eslint-disable/.test(l),
    root_cause: '错误被显式忽略或校验被禁用（启发式）',
    suggestion: '处理错误，或在审查说明中记录豁免理由',
  },
  {
    code: 'CR-DEBUG-LOG', severity: 'INFO',
    test: (l) => /console\.log\s*\(/.test(l),
    root_cause: '调试日志残留（风格提示，不作为阻断）',
    suggestion: '按需移除或用受控 logger 替代',
  },
];

function reviewText(rel, text) {
  const out = [];
  text.split('\n').forEach((line, i) => {
    for (const rule of RULES) {
      let hit = false;
      try { hit = rule.test(line); } catch { hit = false; }
      if (hit) {
        out.push({
          severity: rule.severity, file: rel, line: i + 1,
          message: `[${rule.code}] ${rule.root_cause}`,
          root_cause: rule.root_cause,
          suggestion: rule.suggestion,
          code: rule.code,
          matched_text: redact(line.trim().slice(0, 200)),
        });
      }
    }
  });
  return out;
}

function parseGitStatus(stdout) {
  const files = [];
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue;
    const xy = line.slice(0, 2);
    let p = line.slice(3).trim();
    if (p.includes(' -> ')) p = p.split(' -> ').pop();
    if (p.startsWith('"') && p.endsWith('"')) {
      try { p = JSON.parse(p); } catch { /* keep raw */ }
    }
    if (p) files.push({ status: xy, path: p });
  }
  return files;
}

function cmdRecord(label, r) {
  return {
    label, command: r.command, exit_code: r.exit_code, signal: r.signal,
    timed_out: r.timed_out, spawn_error: r.spawn_error, duration_ms: r.duration_ms,
  };
}

/**
 * git status --porcelain collapses an untracked directory into a single
 * "?? dir/" line. Expand it into the real files so the review is not empty.
 */
function expandPath(p) {
  const abs = rootPath(p);
  let isDir = false;
  try { isDir = fs.statSync(abs).isDirectory(); } catch { isDir = false; }
  if (!isDir) return { files: [p], expanded: false };
  const files = listFiles(abs, { recursive: true, filter: () => true })
    .map((f) => relToRoot(f))
    .slice(0, 600);
  return { files, expanded: true };
}

async function collectChangedFiles() {
  const st = await runCommand({ command: 'git', args: ['status', '--porcelain=v1'] });
  const df = await runCommand({ command: 'git', args: ['diff', '--name-only'] });
  const commands = [cmdRecord('git status --porcelain=v1', st), cmdRecord('git diff --name-only', df)];
  const map = new Map();
  const directoryExpansions = [];
  const addPath = (p, status) => {
    const { files, expanded } = expandPath(p);
    if (expanded) directoryExpansions.push({ path: p, file_count: files.length });
    for (const real of files) if (!map.has(real)) map.set(real, status);
  };
  for (const f of parseGitStatus(st.stdout)) addPath(f.path, f.status);
  for (const p of df.stdout.split('\n').map((s) => s.trim()).filter(Boolean)) addPath(p, ' M');
  return {
    files: [...map.entries()].map(([p, status]) => ({ path: p, status })),
    commands,
    directory_expansions: directoryExpansions,
    git_ok: !st.spawn_error && !df.spawn_error,
  };
}

function artifactOk(file) {
  if (!exists(file)) return true;
  let j;
  try { j = readJSON(file); } catch { return false; }
  if (!j || typeof j !== 'object') return false;
  if (!Array.isArray(j.findings) || !Array.isArray(j.rules_applied)) return false;
  if (j.severity_counts === undefined) return false;
  return true;
}

export function health() {
  const checks = {};
  checks.repo_git_dir = exists(rootPath('.git'));
  checks.sample_source_exists = exists(rootPath('router/api-router.go'));
  checks.rules_loaded = RULES.length >= 7;
  let evaluated = 0;
  try {
    const sample = readText(rootPath('router/api-router.go'));
    evaluated = sample.split('\n').length + reviewText('router/api-router.go', sample).length;
  } catch { evaluated = 0; }
  checks.rule_engine_evaluates_real_file = evaluated > 0;
  checks.report_schema = artifactOk(REPORT_FILE);
  const ok = Object.values(checks).every(Boolean);
  return {
    component, ok, checks,
    summary: `rules=${RULES.length} sample_lines_evaluated=${evaluated} report_schema=${checks.report_schema}`,
    checked_at: nowISO(),
  };
}

export async function execute(task = {}, ctx = {}) {
  const started = nowISO();
  const cc = await collectChangedFiles();
  const findings = [];
  let reviewed = 0;

  for (const f of cc.files) {
    const abs = rootPath(f.path);
    if (path.resolve(abs) === path.resolve(REPORT_FILE)) continue; // never review our own output
    if (!exists(abs)) continue;
    let stat;
    try { stat = fs.statSync(abs); } catch { continue; }
    if (!stat.isFile() || stat.size > 2 * 1024 * 1024) continue;
    if (/\.(png|jpg|jpeg|gif|ico|woff2?|ttf|pdf|db|zip|gz|lock)$/i.test(f.path)) continue;
    let text;
    try { text = readText(abs); } catch { continue; }
    reviewed += 1;
    findings.push(...reviewText(f.path, text));
  }

  const counts = { BLOCKER: 0, MAJOR: 0, MINOR: 0, INFO: 0 };
  for (const f of findings) counts[f.severity] = (counts[f.severity] || 0) + 1;

  writeJSON(REPORT_FILE, {
    schema_version: '1.0', generated_at: started,
    executor_id: 'development.code_review',
    git_available: cc.git_ok,
    changed_file_count: cc.files.length,
    changed_files: cc.files,
    directory_expansions: cc.directory_expansions,
    files_reviewed: reviewed,
    finding_count: findings.length,
    severity_counts: counts,
    findings: findings.slice(0, 300),
    rules_applied: RULES.map((r) => ({ code: r.code, severity: r.severity })),
    policy: {
      style_preferences_are_blockers: false,
      snippets_redacted: true,
      note: 'BLOCKER reserved for secrets, rm -rf, destructive git; style/format hints are INFO/MINOR',
    },
    commands: cc.commands,
  });

  return {
    status: 'SUCCEEDED',
    summary: `git status/diff produced ${cc.files.length} real changed files; reviewed ${reviewed}; `
      + `${findings.length} findings (BLOCKER=${counts.BLOCKER}, MAJOR=${counts.MAJOR}, MINOR=${counts.MINOR}, INFO=${counts.INFO}); `
      + `git exit_codes=[${cc.commands.map((c) => c.exit_code).join(',')}]`,
    changed_files: [relToRoot(REPORT_FILE)],
    commands: cc.commands,
    evidence_refs: [],
    outputs: {
      changed_file_count: cc.files.length,
      directory_expansions: cc.directory_expansions,
      files_reviewed: reviewed,
      finding_count: findings.length,
      severity_counts: counts,
      blocker_count: counts.BLOCKER,
      git_exit_codes: cc.commands.map((c) => c.exit_code),
      git_spawn_errors: cc.commands.map((c) => c.spawn_error),
      rules_applied: RULES.length,
    },
  };
}
