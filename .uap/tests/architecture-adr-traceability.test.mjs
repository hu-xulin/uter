import { test } from 'node:test';
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
