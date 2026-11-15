/**
 * UAP self-test file discovery (single source of truth).
 *
 * `uap test --all` must run the platform's OWN test suites. Files under a
 * `fixtures/` directory are NOT self-tests: they are INPUT DATA for other
 * engines. In particular `.uap/tests/fixtures/repair-e2e/` contains the
 * intentionally defective source + deliberately failing test that the real
 * code repair engine must fix in an isolated sandbox. Collecting them into the
 * platform self-test run produces 4 guaranteed failures and a red gate that
 * has nothing to do with UAP's own correctness.
 *
 * Excluding fixtures is a discovery fix, NOT a weakened assertion: every real
 * self-test file still runs, and fixture correctness is proven separately by
 * `real-repair-e2e.test.mjs` (10 scenarios) which builds its own sandbox.
 */
const FIXTURE_SEGMENTS = Object.freeze(['fixtures']);

/** @param {string} rel path (relative or absolute, posix or win separators) */
export function isUapSelfTestFile(rel) {
  const normalized = String(rel || '').replaceAll('\\', '/');
  if (!normalized.endsWith('.test.mjs')) return false;
  return !normalized.split('/').some((s) => FIXTURE_SEGMENTS.includes(s));
}

/** @param {string[]} files */
export function filterSelfTestFiles(files) {
  return (files || []).filter(isUapSelfTestFile);
}
