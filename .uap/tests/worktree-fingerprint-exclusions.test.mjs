import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fingerprintBasis, isVolatileWorktreePath } from '../runtime/status-engine/execution.mjs';

const generatedReports = [
  'web/.visual-e2e/report',
  'web/.visual-e2e/report.json',
  'web/.axe-e2e/report',
  'web/.axe-e2e/report.json',
  'web/.business-e2e/report',
  'web/.business-e2e/report.json',
];

test('generated Playwright reports do not invalidate a UAP execution batch', () => {
  const basis = fingerprintBasis();
  for (const output of generatedReports) {
    const generatedFile = output.endsWith('.json') ? output : `${output}/index.html`;
    assert.equal(isVolatileWorktreePath(generatedFile), true, `${generatedFile} must be treated as generated output`);
    assert.ok(basis.diff_excludes.includes(`:(exclude)${output}`), `${output} must be excluded from tracked diff fingerprints`);
  }
});

test('Playwright test sources and frozen visual baselines remain fingerprint-bound', () => {
  const sourceFiles = [
    'web/e2e/visual/playwright.config.ts',
    'web/e2e/visual/public.spec.ts',
    'web/e2e/visual/public.spec.ts-snapshots/home-desktop-chromium-darwin.png',
    'web/e2e/axe/public.spec.ts',
    'web/e2e/business/playwright.config.ts',
  ];
  for (const source of sourceFiles) {
    assert.equal(isVolatileWorktreePath(source), false, `${source} is source/baseline and must remain bound`);
  }
});
