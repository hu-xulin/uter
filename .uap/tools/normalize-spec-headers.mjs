/**
 * Mechanically reconcile specification metadata with the registry contract.
 *
 * The specification generator emitted `**编号：** <id>` but the registry
 * requires the document to explicitly declare the `标准编号` section as well.
 * This tool adds the missing label without touching any normative content.
 * It is idempotent and refuses to fabricate a header when the ID line is absent.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, REPORTS, relToRoot } from '../runtime/_lib/paths.mjs';
import { loadAllConfigs } from '../runtime/_lib/config.mjs';
import { nowISO, writeJSON } from '../runtime/_lib/util.mjs';

export const component = 'uap.spec-header-normalizer';

export function normalizeSpecHeaders({ dryRun = false } = {}) {
  const configs = loadAllConfigs();
  const specs = configs['specification-registry'].specifications || [];
  const result = { generated_at: nowISO(), scanned: specs.length, fixed: [], already_ok: [], unfixable: [], dry_run: dryRun };
  for (const spec of specs) {
    const abs = path.join(ROOT, spec.file);
    if (!fs.existsSync(abs)) { result.unfixable.push({ id: spec.id, reason: 'file missing', file: spec.file }); continue; }
    const text = fs.readFileSync(abs, 'utf8');
    if (text.includes('**标准编号：**')) { result.already_ok.push(spec.id); continue; }
    const lines = text.split('\n');
    const at = lines.findIndex((l) => l.trim() === `**编号：** ${spec.id}`);
    if (at === -1) { result.unfixable.push({ id: spec.id, reason: 'no **编号：** <id> line to anchor on', file: spec.file }); continue; }
    lines.splice(at + 1, 0, `**标准编号：** ${spec.id}`);
    if (!dryRun) fs.writeFileSync(abs, `${lines.join('\n')}`, 'utf8');
    result.fixed.push({ id: spec.id, file: spec.file, inserted_at_line: at + 2 });
  }
  result.summary = `scanned ${result.scanned}; inserted ${result.fixed.length}; already compliant ${result.already_ok.length}; unfixable ${result.unfixable.length}`;
  if (!dryRun) writeJSON(path.join(REPORTS, 'SPEC-HEADER-REPAIR.json'), result);
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = normalizeSpecHeaders({ dryRun: process.argv.includes('--dry-run') });
  process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
  process.exitCode = r.unfixable.length ? 1 : 0;
}
