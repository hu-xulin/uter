import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { validators as architectureValidators } from '../validators/architecture/index.mjs';
import { validators as crossPlatformValidators } from '../validators/cross-platform/index.mjs';

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
