/**
 * UAP Phase 2 — register the REAL requirement behaviour suite as a bounded
 * behaviour probe in the authoritative probe registry.
 *
 *   node .uap/tools/sync-behavior-probes.mjs [--check]
 *
 * WHY THIS EXISTS
 * ---------------
 * `.uap/tools/requirement-behavior-suite.mjs` emits 57 DISTINCT
 * `REQ_ASSERT <requirement_id> PASS <detail>` lines, but ONLY after a real
 * execution (production runtime imports with real return-value assertions, or
 * real `go test` / `node --test` spawns with an observed PASS marker). Those
 * assertions were previously never consumed by the requirement verification
 * engine, so all registered requirements stayed NOT_VERIFIED except a handful of
 * legacy probes.
 *
 * This tool derives the probe definition from `buildProbeAssertions()` (the
 * SAME source of truth as the suite) and writes a versioned, idempotent block
 * into `.uap/config/requirement-probes.yaml`. It NEVER writes a requirement
 * status, NEVER invents a PASS, and NEVER relaxes an assertion: the downstream
 * engine still has to observe every `REQ_ASSERT ... PASS` string in the real
 * stdout of a real command before it may mark a requirement VERIFIED.
 *
 * --check verifies the registered block is in sync (exit 1 when stale) without
 * writing anything.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildProbeAssertions, loadKnownIds } from './requirement-behavior-suite.mjs';
import { CONFIG, REPORTS, ROOT } from '../runtime/_lib/paths.mjs';

const REGISTRY = path.join(CONFIG, 'requirement-probes.yaml');
const BEGIN = '# BEGIN GENERATED: bhv.requirement-behavior-suite (do not edit by hand)';
const END = '# END GENERATED: bhv.requirement-behavior-suite';
const INSERT_BEFORE = 'external_dependency_probes:';

/** Single-quote a YAML scalar, escaping embedded quotes. */
const q = (s) => `'${String(s).replaceAll("'", "''")}'`;

export function renderProbeBlock() {
  const assertions = buildProbeAssertions();
  const known = loadKnownIds();
  const seen = new Set();
  for (const a of assertions) {
    if (!known.has(a.requirement_id)) {
      throw new Error(`assertion id ${a.requirement_id} is not in the ${known.size}-row registry-derived traceability matrix (fail-closed)`);
    }
    if (seen.has(a.requirement_id)) {
      throw new Error(`assertion id ${a.requirement_id} registered twice (shared evidence is forbidden)`);
    }
    seen.add(a.requirement_id);
  }
  if (assertions.length === 0) throw new Error('behaviour suite produced zero assertions (fail-closed)');

  const lines = [
    BEGIN,
    '# Source of truth: .uap/tools/requirement-behavior-suite.mjs buildProbeAssertions()',
    '# Each required_output is a DISTINCT line that the suite emits ONLY after a real',
    '# execution + assertion. A missing line means that requirement stays NOT_VERIFIED.',
    '  - id: bhv.requirement-behavior-suite',
    '    probe_kind: BEHAVIOR_EXECUTION',
    '    command: node',
    '    args: [.uap/tools/requirement-behavior-suite.mjs]',
    '    timeout_ms: 900000',
    '    assertions:',
  ];
  for (const a of assertions) {
    lines.push(`      - name: ${q(a.name)}`);
    lines.push(`        required_output: [${a.required_output.map(q).join(', ')}]`);
    lines.push('        forbid_output: []');
    lines.push(`        requirement_id: ${a.requirement_id}`);
    lines.push(`        behavior: ${q(a.behavior)}`);
  }
  lines.push(END);
  return lines.join('\n');
}

export function syncBehaviorProbes({ check = false } = {}) {
  const source = fs.readFileSync(REGISTRY, 'utf8');
  const block = renderProbeBlock();
  const start = source.indexOf(BEGIN);
  const end = source.indexOf(END);
  let next;
  if (start !== -1 && end !== -1 && end > start) {
    next = `${source.slice(0, start)}${block}${source.slice(end + END.length)}`;
  } else {
    const at = source.indexOf(INSERT_BEFORE);
    if (at === -1) throw new Error(`cannot find insertion point ${INSERT_BEFORE} in ${REGISTRY}`);
    next = `${source.slice(0, at)}${block}\n\n${source.slice(at)}`;
  }
  const inSync = next === source;
  if (!check && !inSync) fs.writeFileSync(REGISTRY, next, 'utf8');
  return {
    registry: path.relative(ROOT, REGISTRY),
    assertion_count: buildProbeAssertions().length,
    in_sync: inSync,
    written: !check && !inSync,
    check_only: check,
  };
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    const out = syncBehaviorProbes({ check: process.argv.includes('--check') });
    console.log(`SYNC_BEHAVIOR_PROBES ${JSON.stringify(out)}`);
    // In --check mode a stale registry is a real failure (never silently pass).
    process.exitCode = out.check_only && !out.in_sync ? 1 : 0;
  } catch (error) {
    console.error(`SYNC_BEHAVIOR_PROBES_FATAL: ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}
