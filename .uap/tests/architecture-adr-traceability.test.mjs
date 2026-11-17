import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validators } from '../validators/architecture/index.mjs';

test('ADR index, frontmatter, accepted status and implementation evidence are traceable', async () => {
  const result = await validators['architecture.adr_integrity']();
  assert.equal(result.status, 'PASS', result.summary);
});
