/**
 * UAP engine: development
 * Executors: development.coding_standard / development.dependencies
 * Reads real go.mod / web/package.json / web/bun.lock, runs gofmt -l . for a
 * real format check, and scans .uap/**\/*.mjs for dead-code / unused-import hints.
 */
import path from 'node:path';
import { STATE, rootPath, uapPath, relToRoot } from '../../runtime/_lib/paths.mjs';
import { readText, exists, listFiles, readJSON, writeJSON, nowISO, hash } from '../../runtime/_lib/util.mjs';
import { runCommand } from '../../runtime/_lib/proc.mjs';

export const component = 'engines.development';
export const version = '1.0.0';
export const executors = ['development.coding_standard', 'development.dependencies'];

const DEP_FILE = path.join(STATE, 'dependency-inventory.json');
const CODING_FILE = path.join(STATE, 'coding-standard.json');

function parseGoMod() {
  const abs = rootPath('go.mod');
  if (!exists(abs)) return { exists: false };
  const text = readText(abs);
  const module = (text.match(/^module\s+(.+)$/m) || [])[1] || null;
  const goVersion = (text.match(/^go\s+(.+)$/m) || [])[1] || null;
  const toolchain = (text.match(/^toolchain\s+(.+)$/m) || [])[1] || null;
  const requireBlock = text.match(/require\s*\(([\s\S]*?)\)/);
  const requires = [];
  if (requireBlock) {
    for (const line of requireBlock[1].split('\n')) {
      const m = line.match(/^\s*([^\s]+)\s+([^\s]+)(\s+\/\/\s*indirect)?/);
      if (m) requires.push({ path: m[1], version: m[2], indirect: Boolean(m[3]) });
    }
  }
  return {
    exists: true, module, go_version: goVersion, toolchain,
    require_count: requires.length,
    indirect_count: requires.filter((r) => r.indirect).length,
    direct_count: requires.filter((r) => !r.indirect).length,
    sample: requires.slice(0, 15), hash: hash(text),
  };
}

function parsePackageJson() {
  const abs = rootPath('web/package.json');
  if (!exists(abs)) return { exists: false };
  const j = readJSON(abs, null);
  if (!j) return { exists: false, parse_error: true };
  const deps = Object.keys(j.dependencies || {});
  const dev = Object.keys(j.devDependencies || {});
  const scripts = Object.keys(j.scripts || {});
  return {
    exists: true, name: j.name, version: j.version,
    dependency_count: deps.length, dev_dependency_count: dev.length, script_count: scripts.length,
    dependencies_sample: deps.slice(0, 15), scripts_sample: scripts.slice(0, 15),
  };
}

function parseBunLock() {
  const abs = rootPath('web/bun.lock');
  if (!exists(abs)) return { exists: false };
  const text = readText(abs);
  const lines = text.split('\n');
  const entries = [];
  for (const line of lines) {
    const m = line.match(/^\s*"([^"]+)"\s*:/);
    if (m) entries.push(m[1]);
  }
  return {
    exists: true, size: text.length, line_count: lines.length,
    entry_line_count: entries.length, sample_entries: entries.slice(0, 15), hash: hash(text),
  };
}

function scanDependencies() {
  return { go_mod: parseGoMod(), frontend: parsePackageJson(), bun_lock: parseBunLock() };
}

/** Heuristic scan of .uap/**\/*.mjs for obvious dead-code / unused-import patterns. */
function scanDeadCode() {
  const files = listFiles(uapPath(), { recursive: true, filter: (a) => a.endsWith('.mjs') });
  const findings = [];
  const push = (rel, line, kind, pattern, snippet) => {
    findings.push({ file: rel, line, kind, pattern, snippet: String(snippet).trim().slice(0, 160) });
  };
  let unusedImportCount = 0;

  for (const abs of files) {
    const rel = relToRoot(abs);
    const text = readText(abs);
    const lines = text.split('\n');
    const body = lines.filter((l) => !/^\s*import\s/.test(l)).join('\n');

    const importRe = /^\s*import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"]/gm;
    let im;
    while ((im = importRe.exec(text)) !== null) {
      const clause = im[1];
      const names = [];
      const named = clause.match(/\{([\s\S]*?)\}/);
      if (named) {
        for (const part of named[1].split(',')) {
          const seg = part.trim().split(/\s+as\s+/).pop().trim();
          if (/^[A-Za-z_$][\w$]*$/.test(seg)) names.push(seg);
        }
      }
      const ns = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
      if (ns) names.push(ns[1]);
      if (!named && !ns) {
        const def = clause.match(/([A-Za-z_$][\w$]*)/);
        if (def) names.push(def[1]);
      }
      const atLine = (text.slice(0, im.index).match(/\n/g) || []).length + 1;
      for (const name of names) {
        const re = new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`);
        if (!re.test(body)) {
          unusedImportCount += 1;
          push(rel, atLine, 'unused_import_heuristic', name, im[0].trim().slice(0, 120));
        }
      }
    }

    lines.forEach((line, i) => {
      if (/\bif\s*\(\s*(?:false|true)\s*\)/.test(line)) push(rel, i + 1, 'constant_condition', 'if(true|false)', line);
      if (/=>\s*\{\s*\}\s*;?\s*$|\bfunction\s+\w+\s*\([^)]*\)\s*\{\s*\}/.test(line)) push(rel, i + 1, 'empty_function', 'empty body', line);
      if (/\b(?:TODO|FIXME|HACK)\b/.test(line)) push(rel, i + 1, 'todo_marker', 'TODO/FIXME', line);
      if (/\bconsole\.log\s*\(/.test(line) && !rel.includes('engines/')) push(rel, i + 1, 'debug_residue', 'console.log', line);
    });
  }

  return {
    scanned_file_count: files.length,
    finding_count: findings.length,
    unused_import_count: unusedImportCount,
    findings: findings.slice(0, 200),
    policy: 'heuristic patterns only; these hints never disable a quality gate',
  };
}

async function gofmtCheck() {
  const r = await runCommand({ command: 'gofmt', args: ['-l', '.'], timeoutMs: 60000 });
  const files = r.stdout.split('\n').map((s) => s.trim()).filter(Boolean);
  let status;
  if (r.timed_out || r.spawn_error) status = 'BLOCKED';
  else if (r.exit_code === 0 && files.length === 0) status = 'CLEAN';
  else if (r.exit_code === 0) status = 'UNFORMATTED';
  else status = 'FAILED';
  return {
    status,
    command_record: {
      command: r.command, args: ['-l', '.'], exit_code: r.exit_code, signal: r.signal,
      timed_out: r.timed_out, spawn_error: r.spawn_error, duration_ms: r.duration_ms,
    },
    unformatted_file_count: files.length,
    unformatted_files: files.slice(0, 50),
    stdout_summary: r.stdout.slice(0, 600),
    stderr_summary: r.stderr.slice(0, 300),
    note: 'gofmt -l . executed for real; timeout / spawn_error is recorded as BLOCKED, never faked as success',
  };
}

function artifactOk(file, keys) {
  if (!exists(file)) return true;
  let j;
  try { j = readJSON(file); } catch { return false; }
  if (!j || typeof j !== 'object') return false;
  for (const k of keys) if (j[k] === undefined || j[k] === null) return false;
  return true;
}

export function health() {
  const checks = {};
  checks.go_mod_exists = exists(rootPath('go.mod'));
  checks.package_json_exists = exists(rootPath('web/package.json'));
  checks.bun_lock_exists = exists(rootPath('web/bun.lock'));
  let deps = null;
  try { deps = scanDependencies(); } catch { deps = null; }
  checks.dependencies_parsed = Boolean(deps && deps.go_mod.require_count >= 1 && deps.frontend.dependency_count >= 1);
  let mjsCount = 0;
  try { mjsCount = listFiles(uapPath(), { recursive: true, filter: (a) => a.endsWith('.mjs') }).length; } catch { mjsCount = 0; }
  checks.mjs_files_present = mjsCount >= 1;
  checks.dep_schema = artifactOk(DEP_FILE, ['go_mod', 'frontend', 'bun_lock']);
  checks.coding_schema = artifactOk(CODING_FILE, ['format_check', 'dead_code_scan']);
  const ok = Object.values(checks).every(Boolean);
  return {
    component, ok, checks,
    summary: `go_requires=${deps ? deps.go_mod.require_count : 0} frontend_deps=${deps ? deps.frontend.dependency_count : 0} `
      + `bun_lock=${checks.bun_lock_exists} mjs_files=${mjsCount}`,
    checked_at: nowISO(),
  };
}

export async function execute(task = {}, ctx = {}) {
  const started = nowISO();
  const deps = scanDependencies();
  writeJSON(DEP_FILE, {
    schema_version: '1.0', generated_at: started,
    executor_ids: ['development.dependencies'], ...deps,
  });

  const fmt = await gofmtCheck();
  const dead = scanDeadCode();
  writeJSON(CODING_FILE, {
    schema_version: '1.0', generated_at: started,
    executor_ids: ['development.coding_standard'],
    format_check: fmt,
    dead_code_scan: dead,
    commands: [fmt.command_record],
  });

  return {
    status: 'SUCCEEDED',
    summary: `read real go.mod (${deps.go_mod.require_count} requires), web/package.json (${deps.frontend.dependency_count} deps), `
      + `web/bun.lock (exists=${deps.bun_lock.exists}); gofmt -l . exit_code=${fmt.command_record.exit_code} status=${fmt.status} `
      + `unformatted=${fmt.unformatted_file_count}; scanned ${dead.scanned_file_count} .mjs files, ${dead.finding_count} dead-code hints`,
    changed_files: [relToRoot(DEP_FILE), relToRoot(CODING_FILE)],
    commands: [fmt.command_record],
    evidence_refs: [],
    outputs: {
      go_require_count: deps.go_mod.require_count || 0,
      go_module: deps.go_mod.module || null,
      frontend_dependency_count: deps.frontend.dependency_count || 0,
      bun_lock_exists: deps.bun_lock.exists,
      bun_lock_entry_lines: deps.bun_lock.entry_line_count || 0,
      gofmt_status: fmt.status,
      gofmt_exit_code: fmt.command_record.exit_code,
      gofmt_timed_out: fmt.command_record.timed_out,
      unformatted_file_count: fmt.unformatted_file_count,
      dead_code_finding_count: dead.finding_count,
      unused_import_count: dead.unused_import_count,
      scanned_mjs_files: dead.scanned_file_count,
    },
  };
}
