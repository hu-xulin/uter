// Context-aware dangerous-call scanner for UAP .mjs sources.
//
// Why this exists: a naive textual regex over the source tree flags its own
// detector patterns, comments and report labels as "vulnerabilities"
// (e.g. AGENTS.md-prohibition docs mentioning `rm -rf`, or the destructive-git
// detector regex itself). That produced false BLOCKERs without adding safety.
//
// This scanner classifies every raw textual hit:
//   real_call — dangerous executable code:
//     * bare calls  eval( / new Function( / execSync( / child_process.exec(
//       found in EXECUTABLE code (comments, string/template literals and
//       regex detector literals stripped by a tokenizer first);
//     * destructive shell fragments (rm -rf, git push --force, git reset
//       --hard, git clean -f/-fd) appearing on a raw line that also invokes
//       an exec primitive (execSync/spawnSync/spawn/exec/execFile) in
//       executable code — catches `execSync('rm -rf ' + p)` even though the
//       argument string itself is stripped from code.
//   benign — comments, regex detector literals, report labels. Recorded in
//     the output for auditability, never silently dropped, never counted as
//     failures.
//
// Fail-closed contract: the scanner runs a built-in self-test BEFORE
// scanning — dangerous fixtures MUST be caught, benign fixtures MUST yield
// zero hits. If the self-test fails, ok=false and callers must not PASS.
// Documented limitation: multi-line exec invocations whose shell fragment
// sits on a different line than the primitive are caught via the bare-call
// rule only when the primitive itself is a flagged call (execSync/exec);
// `spawn(` with a multi-line destructive argv is out of scope for the
// same-line rule.

import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Executable-code extraction: strips line/block comments, single/double
// quoted strings, template literals (keeping ${...} expressions parseable at
// top level of the template) and regex literals. Character-level, no deps.
// ---------------------------------------------------------------------------
function isRegexAllowed(prev) {
  if (!prev) return true;
  if (prev === '\n' || prev === ' ') return true;
  return '([{,;=:!&|?+-*%~^<>'.includes(prev);
}

export function executableCode(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let prev = '';
  while (i < n) {
    const c = src[i];
    const next = i + 1 < n ? src[i + 1] : '';
    // line comment
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i++;
      out += '\n';
      prev = '\n';
      continue;
    }
    // block comment
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') out += '\n';
        i++;
      }
      i += 2;
      out += ' ';
      continue;
    }
    // single/double quoted string
    if (c === "'" || c === '"') {
      const q = c;
      i++;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === q || src[i] === '\n') { i++; break; }
        i++;
      }
      out += ' ';
      prev = ' ';
      continue;
    }
    // template literal — keep ${...} expression content as code
    if (c === '`') {
      i++;
      let depth = 0;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '$' && src[i + 1] === '{') { depth++; i += 2; continue; }
        if (src[i] === '}' && depth > 0) { depth--; i++; continue; }
        if (depth === 0 && src[i] === '`') { i++; break; }
        if (src[i] === '\n') out += '\n';
        i++;
      }
      out += ' ';
      prev = ' ';
      continue;
    }
    // regex literal (vs division) decided by previous significant char
    if (c === '/' && isRegexAllowed(prev)) {
      i++;
      let inClass = false;
      let closed = false;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '[') inClass = true;
        else if (src[i] === ']') inClass = false;
        else if (src[i] === '/' && !inClass) { closed = true; i++; break; }
        else if (src[i] === '\n') break; // unterminated -> not a regex literal
        i++;
      }
      if (closed) {
        while (i < n && /[dgimsuvy]/i.test(src[i])) i++;
        out += ' ';
        prev = ' ';
        continue;
      }
      out += '/';
      prev = '/';
      continue;
    }
    out += c;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}

// Bare dangerous calls in executable code. `\b` guards avoid matching
// identifiers like `.evalSafe(`; the `(^|[^\w$.])` prefix excludes member
// calls like `foo.eval(` only when preceded by a dot-word — kept simple by
// requiring the char before to be a non-word/dot char.
const CALL_RE = /(^|[^\w$.)])(eval\s*\(|new\s+Function\s*\(|execSync\s*\(|child_process\s*\.\s*exec\s*\()/;
// Destructive shell fragments (literal, not \s+-parameterised detector text).
const SHELL_RE = /rm\s+-rf|git\s+push\s+--force|git\s+push\s+-f\b|git\s+reset\s+--hard|git\s+clean\s+-[fd]/;
// Exec primitives that make a same-line shell fragment an executed command.
const EXEC_RE = /execSync\s*\(|spawnSync\s*\(|spawn\s*\(|execFile\s*\(|child_process\s*\.\s*exec\s*\(|\bexec\s*\(/;

function scanSource(raw, rel) {
  const code = executableCode(raw);
  const hits = { real_calls: [], benign: [] };
  const rawLines = raw.split('\n');
  const codeLines = code.split('\n');

  // Rule 1: bare dangerous calls in executable code (any line).
  codeLines.forEach((line, idx) => {
    if (CALL_RE.test(line)) {
      hits.real_calls.push({ file: rel, line: idx + 1, rule: 'dangerous_call_in_code' });
    }
  });

  // Rule 2: destructive shell fragment + exec primitive on the same raw line.
  rawLines.forEach((line, idx) => {
    if (!SHELL_RE.test(line)) return;
    const lineCode = codeLines[idx] || '';
    if (EXEC_RE.test(lineCode)) {
      hits.real_calls.push({ file: rel, line: idx + 1, rule: 'destructive_shell_via_exec' });
    } else {
      hits.benign.push({ file: rel, line: idx + 1, rule: 'shell_fragment_without_exec' });
    }
  });
  return hits;
}

// ---------------------------------------------------------------------------
// Built-in self-test: prove the classifier still catches genuine dangerous
// code and does NOT flag benign detector/comment/label patterns.
// ---------------------------------------------------------------------------
export function selfTest() {
  const cases = [];
  const dangerous = [
    { src: "const out = execSync(cmd);", want: 1, why: 'bare execSync call' },
    { src: "eval(userInput);", want: 1, why: 'bare eval call' },
    { src: "const f = new Function(payload); f();", want: 1, why: 'new Function call' },
    { src: "child_process.exec(script);", want: 1, why: 'child_process.exec call' },
    { src: "spawn('sh', ['-c', 'rm -rf /tmp/target']);", want: 1, why: 'destructive shell via spawn' },
    { src: "execSync('rm -rf ' + dir);", want: 2, why: 'execSync + destructive arg (both rules)' },
  ];
  for (const t of dangerous) {
    const h = scanSource(t.src, 'fixture');
    cases.push({ name: `dangerous: ${t.why}`, pass: h.real_calls.length >= t.want && h.benign.length === 0 });
  }
  const benign = [
    { src: "// 禁止 rm -rf（AGENTS.md 文档注释）", why: 'prohibition comment' },
    { src: "const re = /git\\s+(?:push\\s+(?:--force|-f)\\b|reset\\s+--hard)/;", why: 'destructive-git detector regex' },
    { src: "const label = 'AGENTS.md 明确禁止 rm -rf';", why: 'report label string' },
    { src: "const gate = /tsgo -b --force/;", why: 'build-flag detector regex' },
    { src: "note: 'BLOCKER reserved for secrets, rm -rf, destructive git'", why: 'note text' },
    { src: "const { spawn } = await import('node:child_process');", why: 'spawn import (spawn itself allowed)' },
  ];
  for (const t of benign) {
    const h = scanSource(t.src, 'fixture');
    cases.push({ name: `benign: ${t.why}`, pass: h.real_calls.length === 0 });
  }
  return { ok: cases.every((c) => c.pass), cases };
}

// ---------------------------------------------------------------------------
export function dangerScan(roots) {
  const self = selfTest();
  if (!self.ok) {
    return { scanned: 0, real_calls: null, benign: [], self_test: self, ok: false, reason: 'scanner self-test failed — results untrustworthy, fail closed' };
  }
  const files = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const a = path.join(d, e.name);
      if (e.isDirectory()) {
        if (!['_lib_selftest', 'node_modules', 'dist'].includes(e.name)) walk(a);
      } else if (e.isFile() && a.endsWith('.mjs')) files.push(a);
    }
  };
  for (const r of roots) walk(r);
  const real_calls = [];
  const benign = [];
  for (const f of files) {
    let raw = '';
    try { raw = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const h = scanSource(raw, path.relative(process.cwd(), f));
    real_calls.push(...h.real_calls);
    benign.push(...h.benign);
  }
  return {
    scanned: files.length,
    roots,
    real_calls,
    benign_count: benign.length,
    benign,
    self_test: self,
    ok: real_calls.length === 0,
    scanned_at: new Date().toISOString(),
  };
}

// CLI entry: node .uap/tools/danger-scan.mjs <root> [<root> ...]
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] && process.argv[1].endsWith('danger-scan.mjs')) {
  const roots = process.argv.slice(2);
  if (!roots.length) {
    console.error(JSON.stringify({ ok: false, reason: 'usage: danger-scan.mjs <root>...' }));
    process.exit(2);
  }
  const out = dangerScan(roots);
  console.log(JSON.stringify(out));
  process.exit(out.self_test.ok && out.ok ? 0 : 1);
}
