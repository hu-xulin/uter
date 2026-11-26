/**
 * UAP self-test file discovery (single source of truth).
 *
 * `uap test --all` runs the platform's own pre-audit self-tests. Files under a
 * `fixtures/` directory are input data, not self-tests. The independent
 * verification suite is deliberately post-audit: it reads the current
 * execution's FINAL-STATUS and traceability matrix, so it must run only after
 * those reports have been regenerated for the active execution.
 *
 * Excluding fixtures and the post-audit suite from this phase does not remove
 * coverage: repair fixtures are tested by real-repair-e2e.test.mjs, while
 * independent-verification.test.mjs is executed by CI after report generation
 * and before the authoritative final acceptance closure.
 */
const FIXTURE_SEGMENTS = Object.freeze(['fixtures']);
const POST_AUDIT_TEST_FILES = Object.freeze(['independent-verification.test.mjs']);

function normalizeTestPath(rel) {
  return String(rel || '').replaceAll('\\', '/');
}

/** @param {string} rel path (relative or absolute, posix or win separators) */
export function isUapPostAuditTestFile(rel) {
  const normalized = normalizeTestPath(rel);
  if (!normalized.endsWith('.test.mjs')) return false;
  if (normalized.split('/').some((s) => FIXTURE_SEGMENTS.includes(s))) return false;
  return POST_AUDIT_TEST_FILES.includes(normalized.split('/').pop());
}

/** @param {string} rel path (relative or absolute, posix or win separators) */
export function isUapSelfTestFile(rel) {
  const normalized = normalizeTestPath(rel);
  if (!normalized.endsWith('.test.mjs')) return false;
  if (normalized.split('/').some((s) => FIXTURE_SEGMENTS.includes(s))) return false;
  return !POST_AUDIT_TEST_FILES.includes(normalized.split('/').pop());
}

/** @param {string[]} files */
export function filterSelfTestFiles(files) {
  return (files || []).filter(isUapSelfTestFile);
}

/** @param {string[]} files */
export function filterPostAuditTestFiles(files) {
  return (files || []).filter(isUapPostAuditTestFile);
}
