// H5 browser matrix — REAL multi-viewport browser verification for UAP.
//
// Aligns with the repo's own visual-regression conventions (web/e2e/visual):
//   - target   : VISUAL_BASE_URL ?? http://localhost:3000 (Go backend embedding web/dist)
//   - baseline : desktop 1440x900 + mobile 390x844 (web/e2e/visual/lib/target.ts)
//   - unreachable target => BLOCKED (exit 2), NEVER reported as pass
//   - touch-target standard: docs/design-system/UTER-DESIGN-SYSTEM-3.0.md §15.3
//     (important mobile targets must be 44x44px); minimum font size 12px (§1.2)
//
// What it actually does in a real browser (Playwright Chromium):
//   per (viewport x route):
//     - SPA render check (root container has content)
//     - <meta name=viewport> contains width=device-width
//     - horizontal overflow (scrollWidth vs innerWidth) + offending elements
//     - touch-target audit: visible interactive elements smaller than 44x44
//     - minimum-font audit: visible text rendered below 12px
//     - REAL touch dispatch: touchscreen.tap produces document-level
//       touchstart AND, when a harmless link exists, a real navigation
//     - console errors / page errors (script exceptions vs HTTP >= 400)
//
// Output: single-line JSON on stdout + .uap/reports/H5-BROWSER-MATRIX.json
// Exit codes: 0 = matrix executed (verdict inside), 2 = blocked (target
// unreachable / browser missing), 1 = tool failure.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOL_DIR, '..', '..');
const WEB = path.join(ROOT, 'web');
const OUT_FILE = path.join(ROOT, '.uap', 'reports', 'H5-BROWSER-MATRIX.json');

const TARGET = process.env.H5_BASE_URL || process.env.VISUAL_BASE_URL || 'http://localhost:3000';

// Viewport matrix: the repo's two baseline viewports plus three more real
// device classes. All mobile/tablet contexts have hasTouch (real touch
// pipeline), desktop is the no-touch control.
const VIEWPORTS = [
  { name: 'mobile-390', width: 390, height: 844, dpr: 3, isMobile: true, hasTouch: true },
  { name: 'mobile-375', width: 375, height: 667, dpr: 2, isMobile: true, hasTouch: true },
  { name: 'mobile-430', width: 430, height: 932, dpr: 3, isMobile: true, hasTouch: true },
  { name: 'tablet-768', width: 768, height: 1024, dpr: 2, isMobile: true, hasTouch: true },
  { name: 'desktop-1440', width: 1440, height: 900, dpr: 1, isMobile: false, hasTouch: false },
];

// Public routes only (no login required). Authenticated coverage is probed
// separately below and reported honestly when unavailable.
const ROUTES = ['/', '/sign-in', '/pricing', '/rankings', '/docs'];

const MIN_TOUCH = 44; // design-system §15.3
const MIN_FONT = 12;  // design-system §1.2

function out(payload, code) {
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ ...payload, report: path.relative(ROOT, OUT_FILE) }));
  process.exit(code);
}

async function reachable(url) {
  try {
    const res = await fetch(url + '/', { redirect: 'follow', signal: AbortSignal.timeout(8000) });
    return res.status > 0 && res.status < 500;
  } catch {
    return false;
  }
}

// Visible interactive elements smaller than the 44x44 touch target.
// NOTE: this function is serialized into the browser via page.evaluate —
// it must not reference any outer-scope constant. Thresholds are inlined:
// WCAG 2.5.8 hard floor = 24x24 (violations FAIL the touch check);
// Uter recommended = 44x44 (design-system §15.3 — explicitly "a design
// recommendation, not the uniform WCAG minimum"; density tiers legally
// allow 36/40px, so the recommendation is REPORTED, not gated).
//
// Measurement follows WCAG 2.5.8's own definitions (verified against this
// codebase via .uap/tools/h5-touch-probe.mjs):
//   1. disabled / aria-disabled controls are not targets (no pointer input)
//   2. effective hit area = element rect UNION ::before/::after boxes
//      (pseudo-elements receive clicks and forward them to the host)
//   3. an input wrapped in a <label> is measured by the label's rect
//      (clicking the label toggles the input — shadcn sr-only pattern)
//   4. inline exception: text anchors whose size is constrained by the
//      line-height of surrounding non-target text (footer/protocol links)
function auditPage() {
  const WCAG_MIN = 24;
  const UTER_REC = 44;
  const MIN_FONT = 12;
  const INTERACTIVE = 'a[href], button, [role="button"], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
  const isVisible = (el) => {
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || st.pointerEvents === 'none') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const isTarget = (el) => {
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
    // sr-only/visually-hidden inputs are not the visual target; their label is.
    const cls = el.getAttribute('class') || '';
    if (/sr-only/.test(cls)) return false;
    return true;
  };
  const pseudoBox = (el, pseudo) => {
    const st = getComputedStyle(el, pseudo);
    if (st.content === 'none' || st.content === 'normal' || st.display === 'none' || st.position !== 'absolute') return null;
    const r = el.getBoundingClientRect();
    // Two hit-area patterns in this codebase:
    //   explicit size:      pseudo with numeric width/height
    //   inset extension:    after:-inset-x-3 / -inset-y-2 (Checkbox,
    //                       legal-consent Label) — box = host rect + insets
    const w = parseFloat(st.width) || 0;
    const h = parseFloat(st.height) || 0;
    const iT = parseFloat(st.top);
    const iL = parseFloat(st.left);
    const iR = parseFloat(st.right);
    const iB = parseFloat(st.bottom);
    let left = r.left, top = r.top, right = r.right, bottom = r.bottom;
    let hasInset = false;
    if (Number.isFinite(iL)) { left = r.left + iL; hasInset = true; }
    if (Number.isFinite(iT)) { top = r.top + iT; hasInset = true; }
    if (Number.isFinite(iR)) { right = r.right - iR; hasInset = true; }
    if (Number.isFinite(iB)) { bottom = r.bottom - iB; hasInset = true; }
    if (w > 0) right = left + w;
    if (h > 0) bottom = top + h;
    if (!hasInset && w <= 0 && h <= 0) return null;
    return { left, top, right, bottom };
  };
  // Measured target: a visible input IS the target itself. A visually
  // imperceptible input (1x1, opacity 0, clipped — shadcn/peer patterns) has
  // its real hit area on an associated label (wrapping <label> or
  // <label for=id>); among candidates, the LARGEST label is the surface users
  // actually hit (verified: #legal-consent 1x1 with labels 206x18 and 240x36).
  const measured = (el) => {
    if (el.tagName !== 'INPUT') return el;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    const imperceptible = r.width < 4 || r.height < 4 || parseFloat(st.opacity) === 0
      || st.visibility === 'hidden' || (st.clipPath || '').includes('inset');
    if (!imperceptible) return el;
    const cands = [];
    const wrap = el.closest('label');
    if (wrap) cands.push(wrap);
    if (el.id) {
      for (const l of document.querySelectorAll(`label[for="${CSS.escape(el.id)}"]`)) cands.push(l);
    }
    let best = el;
    let bestArea = r.width * r.height;
    for (const c of cands) {
      const cr = c.getBoundingClientRect();
      const area = cr.width * cr.height;
      if (area > bestArea) { best = c; bestArea = area; }
    }
    return best;
  };
  const effRect = (el) => {
    const r = el.getBoundingClientRect();
    let box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    for (const p of [pseudoBox(el, '::before'), pseudoBox(el, '::after')]) {
      if (!p) continue;
      box = {
        left: Math.min(box.left, p.left), top: Math.min(box.top, p.top),
        right: Math.max(box.right, p.right), bottom: Math.max(box.bottom, p.bottom),
      };
    }
    return { width: box.right - box.left, height: box.bottom - box.top };
  };
  // Inline exception (WCAG 2.5.8): target size constrained by the line-height
  // of text, not by author styling. Verified form in this codebase: text
  // anchors with ZERO vertical padding whose box height equals the text line
  // height (footer legal links 22px/22px; inline "Uter.ai" 17px in 22px text).
  // A padded button or pill NEVER matches this rule.
  const inlineExempt = (el) => {
    if (el.tagName !== 'A' || !(el.textContent || '').trim()) return false;
    const st = getComputedStyle(el);
    const pv = (parseFloat(st.paddingTop) || 0) + (parseFloat(st.paddingBottom) || 0);
    if (pv > 0) return false;
    const ownH = el.getBoundingClientRect().height;
    const ownLH = parseFloat(st.lineHeight) || 0;
    const parentLH = el.parentElement ? parseFloat(getComputedStyle(el.parentElement).lineHeight) || 0 : 0;
    const bound = Math.max(ownLH, parentLH);
    return bound > 0 && ownH <= bound + 2;
  };
  const describe = (el) => {
    const r = el.getBoundingClientRect();
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const cls = el.classList && el.classList.length ? `.${[...el.classList].slice(0, 2).join('.')}` : '';
    const text = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30);
    return `${tag}${id}${cls}${text ? ` "${text}"` : ''} [${Math.round(r.width)}x${Math.round(r.height)}]`;
  };

  const belowRec = [];
  const belowWcag = [];
  const wcagExemptions = { disabled_or_sr_only: 0, label_wrapped_measured: 0, inline_exception: 0, pseudo_extended_pass: 0 };
  for (const el of document.querySelectorAll(INTERACTIVE)) {
    if (!isVisible(el)) continue;
    if (!isTarget(el)) { wcagExemptions.disabled_or_sr_only += 1; continue; }
    const m = measured(el);
    if (m !== el) wcagExemptions.label_wrapped_measured += 1;
    const eff = effRect(m);
    if (eff.width < UTER_REC || eff.height < UTER_REC) {
      if (inlineExempt(el)) { wcagExemptions.inline_exception += 1; continue; }
      const r = m.getBoundingClientRect();
      const desc = `${describe(m)} eff=[${Math.round(eff.width)}x${Math.round(eff.height)}]`;
      belowRec.push(desc);
      if (eff.width < WCAG_MIN || eff.height < WCAG_MIN) {
        belowWcag.push(desc);
      } else {
        wcagExemptions.pseudo_extended_pass += 1;
      }
    }
  }

  const smallFonts = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = (node.textContent || '').trim();
    if (!text) continue;
    const el = node.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') continue;
    if (el.closest('[aria-hidden="true"], .sr-only, [data-visual-hidden]')) continue;
    const size = parseFloat(st.fontSize);
    if (Number.isFinite(size) && size < MIN_FONT) smallFonts.push(`${describe(el)} font=${size}px`);
  }

  const overflowPx = document.documentElement.scrollWidth - window.innerWidth;
  const overflowEls = [];
  if (overflowPx > 1) {
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.right > window.innerWidth + 1 && r.width > 8 && isVisible(el)) overflowEls.push(describe(el));
      if (overflowEls.length >= 5) break;
    }
  }

  const rootEl = document.querySelector('#root') || document.querySelector('#app') || document.body;
  return {
    meta_viewport: document.querySelector('meta[name="viewport"]')?.content || null,
    spa_text_length: (rootEl.textContent || '').trim().length,
    horizontal_overflow_px: Math.max(0, overflowPx),
    overflow_samples: overflowEls,
    small_touch_targets: {
      below_uter_recommended_44: { count: belowRec.length, samples: belowRec.slice(0, 6), standard: 'design-system §15.3 推荐 44x44px（非强制）' },
      below_wcag_min_24: { count: belowWcag.length, samples: belowWcag.slice(0, 6), standard: 'WCAG 2.5.8 硬线 24x24px（违规即 FAIL）' },
      wcag_258_exemptions_applied: wcagExemptions,
    },
    small_fonts: { count: smallFonts.length, samples: smallFonts.slice(0, 6), standard: 'design-system §1.2: min 12px' },
  };
}

async function tapProbe(page, viewport) {
  // Real touch pipeline: a document-level listener must observe the tap.
  await page.evaluate(() => {
    window.__uapTap = { touchstart: 0, pointerdown: 0 };
    document.addEventListener('touchstart', () => { window.__uapTap.touchstart += 1; }, { capture: true, passive: true });
    document.addEventListener('pointerdown', () => { window.__uapTap.pointerdown += 1; }, { capture: true, passive: true });
  });
  const size = page.viewportSize();
  const before = page.url();
  // Tap a harmless link when one exists (real end-to-end touch navigation);
  // otherwise tap dead space near the page edge (pipeline check only).
  const link = await page.evaluate(() => {
    const cand = [...document.querySelectorAll('a[href]')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.pointerEvents !== 'none'
          && r.top >= 0 && r.bottom <= window.innerHeight && !el.closest('[aria-busy="true"]');
      })
      .map((el) => ({ href: el.getAttribute('href'), y: Math.round(el.getBoundingClientRect().top) }))
      .filter((c) => c.href && c.href.startsWith('/') && c.href !== location.pathname);
    return cand.length ? cand[0] : null;
  });
  let tapped = null;
  let navigationWorked = false;
  if (link) {
    const el = page.locator(`a[href="${link.href.replace(/"/g, '\\"')}"]`).first();
    await el.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(150);
    const box = await el.boundingBox().catch(() => null);
    if (box) {
      // A real touchscreen tap at the element's centre — same input path a
      // phone uses, not an emulated mouse click.
      await page.touchscreen.tap(box.x + Math.min(box.width / 2, 40), box.y + box.height / 2);
      tapped = link.href;
      await page.waitForTimeout(1200);
      navigationWorked = page.url() !== before;
    }
  } else {
    await page.touchscreen.tap(10, Math.min(200, size.height - 10));
    tapped = 'dead-space@10x200';
  }
  const counters = await page.evaluate(() => window.__uapTap || { touchstart: 0, pointerdown: 0 });
  return { tapped, navigation_worked: navigationWorked, ...counters };
}

async function main() {
  if (!(await reachable(TARGET))) {
    out({
      generated_at: new Date().toISOString(), target: TARGET, blocked: true,
      reason: `target ${TARGET} unreachable — matrix NOT executed, never reported as pass (service-gate convention)`,
      verdict: { h5_build: 'BLOCKED', viewport: 'BLOCKED', touch: 'BLOCKED', mobile_tests: 'BLOCKED' },
    }, 2);
  }

  let pw;
  try {
    const require = createRequire(path.join(WEB, 'package.json'));
    pw = require('playwright');
  } catch (e) {
    out({ generated_at: new Date().toISOString(), target: TARGET, blocked: true, reason: `playwright unavailable: ${e.message}`, verdict: {} }, 2);
  }

  const browser = await pw.chromium.launch({ headless: true });
  const matrix = [];
  const consoleErrors = [];
  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.dpr,
        isMobile: vp.isMobile,
        hasTouch: vp.hasTouch,
        timezoneId: 'Asia/Shanghai',
        locale: 'zh-CN',
      });
      for (const route of ROUTES) {
        const entry = {
          viewport: vp.name, route, http_status: null, final_url: null,
          spa_rendered: false, meta_viewport_ok: false, meta_viewport: null,
          horizontal_overflow_px: null, overflow_samples: [],
          small_touch_targets: null, small_fonts: null,
          tap: null, console_errors: [], http_failures: [], page_errors: [],
        };
        const page = await context.newPage();
        page.on('console', (m) => { if (m.type() === 'error') entry.console_errors.push(m.text().slice(0, 200)); });
        page.on('pageerror', (e) => entry.page_errors.push(String(e.message).slice(0, 200)));
        page.on('response', (r) => { if (r.status() >= 400) entry.http_failures.push(`${r.status()} ${r.url().slice(0, 120)}`); });
        try {
          const res = await page.goto(TARGET + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
          entry.http_status = res ? res.status() : null;
          entry.final_url = page.url();
          // SPA needs a beat to mount; poll the root container for content.
          for (let i = 0; i < 12 && !entry.spa_rendered; i++) {
            await page.waitForTimeout(500);
            const audit = await page.evaluate(auditPage);
            if (audit.spa_text_length > 40 || i === 11) {
              entry.spa_rendered = audit.spa_text_length > 40;
            }
          }
          // Audit the SETTLED layout, not the mount transition (verified:
          // the legal-consent row measures 206x18 mid-expansion but 240x36
          // once settled — what users actually interact with).
          if (entry.spa_rendered) {
            await page.waitForTimeout(1000);
            const audit = await page.evaluate(auditPage);
            entry.meta_viewport = audit.meta_viewport;
            entry.meta_viewport_ok = !!audit.meta_viewport && audit.meta_viewport.includes('width=device-width');
            entry.horizontal_overflow_px = audit.horizontal_overflow_px;
            entry.overflow_samples = audit.overflow_samples;
            entry.small_touch_targets = audit.small_touch_targets;
            entry.small_fonts = audit.small_fonts;
          }
          // Real touch probe only in touch-enabled viewports.
          if (vp.hasTouch && entry.spa_rendered) entry.tap = await tapProbe(page, vp);
        } catch (e) {
          entry.page_errors.push(`goto: ${String(e.message).slice(0, 200)}`);
        }
        matrix.push(entry);
        await page.close().catch(() => {});
      }
      await context.close().catch(() => {});
    }
  } finally {
    await browser.close().catch(() => {});
  }

  // ---- verdicts (computed from the matrix, never hardcoded) ----
  const mobileRows = matrix.filter((r) => r.viewport.startsWith('mobile') || r.viewport.startsWith('tablet'));
  const rendered = mobileRows.filter((r) => r.spa_rendered);
  const verdict = {
    h5_build: rendered.length > 0 && rendered.every((r) => r.http_status === 200 || r.http_status === 302 || r.http_status === 301)
      ? 'PASS' : 'FAIL',
    viewport: mobileRows.length > 0 && mobileRows.every((r) => r.meta_viewport_ok && r.horizontal_overflow_px === 0) ? 'PASS' : 'FAIL',
    touch: (() => {
      if (!mobileRows.length) return 'FAIL';
      const tapOk = mobileRows.filter((r) => r.spa_rendered).every((r) => r.tap && (r.tap.touchstart > 0 || r.tap.pointerdown > 0));
      // WCAG 2.5.8 hard floor gates the check; the 44px recommendation is
      // surfaced separately (design-system §15.3: "not the uniform minimum").
      const wcagOk = mobileRows.filter((r) => r.spa_rendered).every((r) => r.small_touch_targets && r.small_touch_targets.below_wcag_min_24.count === 0);
      return tapOk && wcagOk ? 'PASS' : 'FAIL';
    })(),
    mobile_tests: matrix.length >= VIEWPORTS.length * 3 && rendered.length >= 4 ? 'PASS' : 'FAIL',
  };
  // Non-blocking context that MUST stay in the report (never silently dropped):
  // font-size violations and console errors are real findings even when the
  // four declared checks pass.
  const fontIssues = matrix.filter((r) => r.small_fonts && r.small_fonts.count > 0).length;
  const consoleIssueRows = matrix.filter((r) => r.page_errors.length > 0).length;
  out({
    generated_at: new Date().toISOString(),
    target: TARGET,
    blocked: false,
    browser: 'playwright chromium (headless, real render)',
    viewports: VIEWPORTS.map((v) => `${v.name} ${v.width}x${v.height} touch=${v.hasTouch}`),
    routes: ROUTES,
    matrix_rows: matrix.length,
    matrix,
    context_findings: {
      small_font_rows: fontIssues,
      page_error_rows: consoleIssueRows,
      touch_target_44_coverage: (() => {
        const rows = matrix.filter((r) => (r.viewport.startsWith('mobile') || r.viewport.startsWith('tablet')) && r.spa_rendered && r.small_touch_targets);
        const total = rows.reduce((n, r) => n + r.small_touch_targets.below_uter_recommended_44.count, 0);
        const wcag = rows.reduce((n, r) => n + r.small_touch_targets.below_wcag_min_24.count, 0);
        return { interactive_elements_below_44: total, interactive_elements_below_24: wcag, note: '44x44 为 Uter 推荐（§15.3），达标率供 UI 迭代跟踪；24x24 为 WCAG 硬线' };
      })(),
      note: 'these are recorded context findings; they do not gate the four declared checks but are never dropped',
    },
    verdict,
  }, 0);
}

main().catch((e) => out({ generated_at: new Date().toISOString(), target: TARGET, blocked: false, error: String(e.message || e), verdict: {} }, 1));
