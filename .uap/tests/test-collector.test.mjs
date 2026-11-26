/**
 * Regression guard: UAP self-test discovery must never absorb repair fixtures.
 *
 * Symptom this prevents: `uap test --all` collected the 4 intentionally
 * failing files in `.uap/tests/fixtures/repair-e2e/` and reported
 * 157 pass / 4 fail, red-blocking the whole platform gate even though every
 * genuine self-test passed. Those files are engine INPUT, not self-tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isUapSelfTestFile,
  filterSelfTestFiles,
  isUapPostAuditTestFile,
  filterPostAuditTestFiles,
} from '../runtime/_lib/test-collector.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const TESTS = path.join(ROOT, '.uap', 'tests');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(abs));
    else out.push(abs);
  }
  return out;
}

test('fixtures are excluded, real self-tests are kept', () => {
  const all = walk(TESTS).filter((f) => f.endsWith('.test.mjs'));
  const picked = filterSelfTestFiles(all);
  assert.ok(picked.length >= 10, `expected the real self-test suites, got ${picked.length}`);
  assert.ok(picked.some((f) => f.endsWith('real-repair-e2e.test.mjs')));
  assert.ok(picked.some((f) => f.endsWith('final-acceptance-negative.test.mjs')));
  assert.ok(picked.some((f) => f.endsWith('requirement-behavior-suite.test.mjs')));
  assert.equal(picked.filter((f) => f.split(path.sep).includes('fixtures')).length, 0);
  for (const f of picked) assert.ok(fs.existsSync(f), `collected file missing on disk: ${f}`);
});

test('current-execution independent verification is post-audit, not a pre-audit self-test', () => {
  const all = walk(TESTS).filter((f) => f.endsWith('.test.mjs'));
  const picked = filterSelfTestFiles(all);
  const postAudit = filterPostAuditTestFiles(all);
  const independent = '.uap/tests/independent-verification.test.mjs';

  assert.equal(isUapPostAuditTestFile(independent), true);
  assert.equal(isUapSelfTestFile(independent), false);
  assert.ok(!picked.some((f) => f.endsWith('independent-verification.test.mjs')));
  assert.deepEqual(postAudit.map((f) => path.basename(f)), ['independent-verification.test.mjs']);
  assert.ok(fs.existsSync(path.join(ROOT, independent)));
});

test('the intentionally failing repair canaries are never collected', () => {
  const canaries = [
    '.uap/tests/fixtures/repair-e2e/original.test.mjs',
    '.uap/tests/fixtures/repair-e2e/regression.test.mjs',
    '.uap/tests/fixtures/repair-e2e/module.test.mjs',
    '.uap/tests/fixtures/repair-e2e/full.test.mjs',
  ];
  for (const c of canaries) {
    assert.ok(fs.existsSync(path.join(ROOT, c)), `fixture ${c} must exist as engine input`);
    assert.equal(isUapSelfTestFile(c), false, `${c} must NOT be a platform self-test`);
  }
});

test('discovery is fail-closed on non-test / malformed paths', () => {
  assert.equal(isUapSelfTestFile('.uap/tests/README.md'), false);
  assert.equal(isUapSelfTestFile('.uap/tests/fixtures/anything.test.mjs'), false);
  assert.equal(isUapSelfTestFile('.uap/tests\\fixtures\\anything.test.mjs'), false);
  assert.equal(isUapSelfTestFile(''), false);
  assert.equal(isUapSelfTestFile(null), false);
  assert.deepEqual(filterSelfTestFiles([]), []);
});

test('the CLI actually uses the shared collector (no re-introduced inline filter)', () => {
  const cli = fs.readFileSync(path.join(ROOT, '.uap', 'bin', 'uap.mjs'), 'utf8');
  assert.match(cli, /filterSelfTestFiles\(listFiles\(uapPath\('tests'\)\)\)/);
});
