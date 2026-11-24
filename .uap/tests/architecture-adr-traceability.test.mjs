import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { validators as architectureValidators } from '../validators/architecture/index.mjs';
import { validators as crossPlatformValidators } from '../validators/cross-platform/index.mjs';
import { execute as executeArchitecture, health as architectureHealth } from '../engines/architecture/index.mjs';
import { execute as executeKnowledge, health as knowledgeHealth } from '../engines/knowledge/index.mjs';
import { gitHead } from '../runtime/status-engine/execution.mjs';

test('ADR index, frontmatter, accepted status and implementation evidence are traceable', async () => {
  const result = await architectureValidators['architecture.adr_integrity']();
  assert.equal(result.status, 'PASS', result.summary);
});

test('cross-platform validator keeps the current UDS status and 3.0 runtime boundary explicit', async () => {
  const result = await crossPlatformValidators['cross_platform.consistency_integrity']();
  assert.equal(result.status, 'PASS', result.summary);
});


test('UDS generator preserves the semantic bridge and 3.0 compatibility boundary', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const generator = readFileSync(path.join(root, 'docs/design-system/registry/build.mjs'), 'utf8');
  const overview = readFileSync(path.join(root, 'docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md'), 'utf8');
  const bridgeContract = '颜色语义层 --ds-* bridge 为新 UI 的唯一运行时权威';
  assert.ok(generator.includes(bridgeContract), 'generator template must preserve the runtime bridge contract');
  assert.ok(overview.includes(bridgeContract), 'generated overview must retain the runtime bridge contract');
  assert.ok(overview.includes('UDS 3.0 runtime compatibility boundary'), 'generated overview must retain the compatibility boundary');
});

test('architecture index refresh excludes historical reports and preserves current ADR traceability', async () => {
  const result = await executeArchitecture();
  assert.equal(result.status, 'SUCCEEDED', result.summary);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const inventory = JSON.parse(readFileSync(path.join(root, '.uap/state/adr-inventory.json'), 'utf8'));
  assert.equal(inventory.generated_for_head, gitHead());
  const formalAdrs = inventory.documents.filter((d) => d.formal_adr);
  assert.equal(inventory.formal_adr_count, formalAdrs.length);
  assert.ok(formalAdrs.every((d) => d.scope === 'adr' && d.has_frontmatter && /^ADR-\d{4}$/i.test(d.id)));
  const adrIndex = inventory.documents.find((d) => d.path === 'docs/adr/README.md');
  assert.ok(adrIndex, 'ADR index must be included in the inventory');
  assert.equal(adrIndex.formal_adr, false, 'README is an index, not a formal ADR record');
  const legacyPath = ['docs', 'design-system', 'UTER-DESIGN-SYSTEM-3.0.md'].join('/');
  assert.ok(inventory.documents.some((d) => d.path === 'docs/adr/0002-preserve-uds-3-runtime-compatibility-boundary.md'));
  assert.equal(inventory.documents.some((d) => d.path.startsWith('.uap/reports/') || d.path.startsWith('.uap/evidence/') || d.path.startsWith('.uap/state/')), false);
  assert.equal(JSON.stringify(inventory.documents).includes(legacyPath), false);
  const health = architectureHealth();
  assert.equal(health.ok, true, JSON.stringify(health.checks));
});

test('knowledge index refresh excludes historical artifacts and classifies the baseline reference as historical only', async () => {
  const result = await executeKnowledge();
  assert.equal(result.status, 'SUCCEEDED', result.summary);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const index = JSON.parse(readFileSync(path.join(root, '.uap/state/knowledge-index.json'), 'utf8'));
  assert.equal(index.generated_for_head, gitHead());
  const retiredScan = index.retired_runtime_dependency_scan;
  assert.ok(retiredScan.scanned_file_count > 0);
  assert.equal(retiredScan.runtime_dependency_count, 0, JSON.stringify(retiredScan.runtime_dependencies));
  assert.equal(retiredScan.runtime_dependency_count, retiredScan.runtime_dependencies.length);
  assert.equal(retiredScan.runtime_dependencies.some((r) =>
    ['.uap/reports/', '.uap/evidence/', '.uap/state/'].some((prefix) => r.file.startsWith(prefix))
  ), false, 'historical UAP reports/evidence/state must not be classified as active runtime dependencies');
  const legacyPath = ['docs', 'design-system', 'UTER-DESIGN-SYSTEM-3.0.md'].join('/');
  assert.equal(index.legacy_design_system_path_scan.active_reference_count, 0);
  assert.equal(index.legacy_design_system_path_scan.historical_baseline_reference.classification, 'HISTORICAL_ONLY_NOT_CURRENT_AUTHORITY');
  assert.ok(index.legacy_design_system_path_scan.historical_tool_references.some((r) => r.file === '.uap/tools/generate-baseline-report.mjs' && r.classification === 'HISTORICAL_ONLY'));
  assert.equal(index.documents.some((d) => d.path.startsWith('.uap/reports/') || d.path.startsWith('.uap/evidence/') || d.path.startsWith('.uap/state/')), false);
  assert.equal(JSON.stringify(index.documents).includes(legacyPath), false);
  const knowledgeSpec = index.documents.find((d) => d.path === '.uap/evolution/UAP-09-001-KNOWLEDGE-MANAGEMENT.md');
  assert.ok(knowledgeSpec, 'current knowledge-management specification must be indexed');
  assert.ok(knowledgeSpec.sources.includes('docs/design-system/TOKEN-MANIFEST.json'));
  assert.ok(knowledgeSpec.sources.includes('docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md'));
  const health = knowledgeHealth();
  assert.equal(health.ok, true, JSON.stringify(health.checks));
});

test('H5 browser matrix references current UDS accessibility and typography sources only', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const h5 = readFileSync(path.join(root, '.uap/tools/h5-browser-matrix.mjs'), 'utf8');
  const legacyPath = ['docs', 'design-system', 'UTER-DESIGN-SYSTEM-3.0.md'].join('/');
  assert.equal(h5.includes(legacyPath), false);
  assert.ok(h5.includes('13-ACCESSIBILITY-STANDARD.md'));
  assert.ok(h5.includes('04-TYPOGRAPHY-STANDARD.md'));
});

test('knowledge-management specification marks the baseline as historical and the manifest as current authority', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const spec = readFileSync(path.join(root, '.uap/evolution/UAP-09-001-KNOWLEDGE-MANAGEMENT.md'), 'utf8');
  assert.ok(spec.includes('TOKEN-MANIFEST.json'));
  assert.ok(spec.includes('不可变历史快照'));
  assert.ok(spec.includes('generate-baseline-report.mjs'));
  assert.ok(spec.includes('HISTORICAL_ONLY'));
  assert.doesNotMatch(spec, /正式版本：3\.0/);
});
