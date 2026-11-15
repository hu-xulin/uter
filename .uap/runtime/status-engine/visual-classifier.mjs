/**
 * Evidence-driven visual-diff classification (UAP P2-05).
 *
 * Extracted from `.uap/bin/uap.mjs` during the final remediation so the
 * classifier is a pure, independently testable function. Behaviour is
 * unchanged except for one deliberate correction: a real screenshot pixel
 * diff is classified BEFORE the authentication keyword check. Playwright
 * error logs embed the spec path (e.g. `e2e/visual/authed.spec.ts`), so a
 * bare /auth/ match used to mislabel genuine UI diffs as AUTHENTICATION and
 * hide the real regression from the acceptance report.
 *
 * Every diff receives one of the mandated categories. "OTHER" is a real
 * category with the raw evidence attached, never a synonym for unclassified.
 */
export const MANDATED_CATEGORIES = Object.freeze([
  'REAL_UI_REGRESSION', 'TEST_ENVIRONMENT', 'FONT_RENDERING', 'ANIMATION',
  'DYNAMIC_CONTENT', 'AUTHENTICATION', 'BASELINE_MISMATCH', 'OTHER',
]);

export function classifyVisualDiff(s, message) {
  const raw = message || '';
  const title = String(s?.title || '');
  // Playwright's toHaveScreenshot call-log ALWAYS embeds generic progress lines
  // that are NOT evidence of the corresponding category:
  //   - "waiting for fonts to load... fonts loaded" is not font-rendering proof;
  //   - "disabled all CSS animations/transitions" is proof animations were
  //     DISABLED, not that animation caused the diff. With animations:'disabled'
  //     every pixel diff carries this line, so matching /animation/ against it
  //     mislabelled every stable pixel diff as ANIMATION.
  // Strip these generic call-log lines before any keyword matching.
  const m = raw.replace(/waiting for fonts to load[^\n]*|fonts loaded|document\.fonts\.ready|disabled all CSS animations|disabled all CSS transitions/gi, '');
  // A runner-level failure (no screenshot comparison happened) is distinct
  // from a pixel diff. Detect it first so it is not mislabelled as a UI diff.
  const runnerFailed = (s?.tests || []).some((t) => (t.results || [])
    .some((r) => r.status === 'failed' || r.status === 'timedOut'))
    || /用例执行异常|Execution exception|Test timeout|ECONNREFUSED|net::ERR|Target page.*closed/i.test(m);
  const hasPixelDiff = /toHaveScreenshot|Snapshot mismatch|\d+ pixels \(ratio|diff ratio|different from snapshot/i.test(m);

  // Stronger evidence wins: a concrete pixel diff is real visual evidence,
  // NOT an authentication failure just because the spec path contains "auth".
  if (!hasPixelDiff && (/auth|login|credential|401|redirect|sign-in|session/i.test(m)
      || /auth|login|credential/i.test(title))) {
    return { category: 'AUTHENTICATION', evidence_basis: 'message/title carries authentication or redirect evidence' };
  }
  if (/font|typeface|glyph|字体|ligature|fallback/i.test(m)) {
    return { category: 'FONT_RENDERING', evidence_basis: 'message carries font/glyph rendering evidence' };
  }
  if (/animation|transition|keyframe|动画|carousel|blink/i.test(m)) {
    return { category: 'ANIMATION', evidence_basis: 'message carries animation/transition evidence' };
  }
  if (/dynamic|timestamp|date|clock|random|live data|动态|a11y-date/i.test(m)) {
    return { category: 'DYNAMIC_CONTENT', evidence_basis: 'message carries dynamic/time-varying content evidence' };
  }
  if (/ECONNREFUSED|net::ERR|Target page|browserType\.launch|service gate|SAFE_DELETE|expected 0|port 3\d{3}|not reachable/i.test(m)) {
    return { category: 'TEST_ENVIRONMENT', evidence_basis: 'message carries service/browser/environment failure evidence' };
  }
  if (/baseline|missing snapshot|snapshot not found|no baseline|基线缺失/i.test(m)) {
    return { category: 'BASELINE_MISMATCH', evidence_basis: 'message carries baseline/snapshot availability evidence' };
  }
  if (/Snapshot mismatch|toHaveScreenshot|diff ratio|pixel|different from snapshot|\d+ pixels/i.test(m)) {
    return { category: 'REAL_UI_REGRESSION', evidence_basis: 'message carries a real screenshot pixel-diff assertion' };
  }
  if (runnerFailed && /用例执行异常：failed|用例执行异常/i.test(String(s?.reason || m))) {
    return { category: 'OTHER', evidence_basis: 'runner-level failure, no specific signature; raw evidence retained' };
  }
  return { category: 'OTHER', evidence_basis: 'no specific signature; raw evidence retained for manual review' };
}
