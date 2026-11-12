// Probe: detailed inspection of interactive elements below the WCAG 24x24
// hard floor, to decide whether they are REAL violations or audit-caliber
// artifacts (pseudo-element hit-area extension, larger clickable ancestor,
// spacing exception per WCAG 2.5.8).
//
// Output: .uap/reports/H5-TOUCH-PROBE.json + single-line JSON on stdout.
// Exit 0 always (probe only; verdict computed downstream).

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOL_DIR, '..', '..');
const WEB = path.join(ROOT, 'web');
const OUT_FILE = path.join(ROOT, '.uap', 'reports', 'H5-TOUCH-PROBE.json');
const TARGET = process.env.H5_BASE_URL || process.env.VISUAL_BASE_URL || 'http://localhost:3000';
const ROUTES = ['/', '/sign-in', '/pricing', '/rankings', '/docs'];

function out(payload) {
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify(payload));
}

// Serialized into the browser — no outer-scope references.
function probePage() {
  const WCAG_MIN = 24;
  const INTERACTIVE = 'a[href], button, [role="button"], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
  const isVisible = (el) => {
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || st.pointerEvents === 'none') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // Effective hit area: element rect UNION its ::before/::after boxes
  // (pseudo-elements receive clicks and forward to the host element).
  const pseudoBox = (el, pseudo) => {
    const st = getComputedStyle(el, pseudo);
    if (st.content === 'none' || st.content === 'normal' || st.display === 'none' || st.position === 'static') return null;
    // Approximate: pseudo boxes derive from the host rect + offsets.
    const r = el.getBoundingClientRect();
    const w = parseFloat(st.width) || 0;
    const h = parseFloat(st.height) || 0;
    if (w <= 0 && h <= 0 && st.position !== 'absolute') return null;
    let left = r.left, top = r.top, right = r.right, bottom = r.bottom;
    if (st.position === 'absolute') {
      const ow = parseFloat(st.left) || null;
      const oh = parseFloat(st.top) || null;
      if (ow !== null) left = r.left + ow;
      if (oh !== null) top = r.top + oh;
      if (w > 0) right = left + w;
      if (h > 0) bottom = top + h;
    }
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  };
  const union = (a, b) => a && b ? {
    left: Math.min(a.left, b.left), top: Math.min(a.top, b.top),
    right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom),
  } : a || b;

  const findings = [];
  for (const el of document.querySelectorAll(INTERACTIVE)) {
    if (!isVisible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width >= WCAG_MIN && r.height >= WCAG_MIN) continue;
    const st = getComputedStyle(el);
    // 1) pseudo-element hit-area extension
    let eff = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    const pb = union(pseudoBox(el, '::before'), pseudoBox(el, '::after'));
    if (pb) eff = union(eff, pb);
    const effW = eff.right - eff.left;
    const effH = eff.bottom - eff.top;
    // 2) nearest clickable ancestor with a bigger box
    let anc = null;
    let p = el.parentElement;
    while (p && p !== document.body) {
      const clickable = p.matches('a[href], button, [role="button"], label') || (p.onclick !== null);
      if (clickable) { anc = p; break; }
      p = p.parentElement;
    }
    const ancR = anc ? anc.getBoundingClientRect() : null;
    const ancBig = ancR && (ancR.width > r.width || ancR.height > r.height);
    // 3) label wrapping (input inside label)
    const labelWrap = !!el.closest('label');
    // 4) spacing: nearest same-type sibling target distance
    let gap = null;
    const parent = el.parentElement;
    if (parent) {
      for (const sib of parent.querySelectorAll(INTERACTIVE)) {
        if (sib === el || !isVisible(sib)) continue;
        const s = sib.getBoundingClientRect();
        const dx = Math.max(0, Math.max(r.left, s.left) - Math.min(r.right, s.right));
        const dy = Math.max(0, Math.max(r.top, s.top) - Math.min(r.bottom, s.bottom));
        const d = Math.max(dx, dy);
        if (gap === null || d < gap) gap = Math.round(d);
      }
    }
    findings.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.getAttribute('class') || '').slice(0, 80),
      aria: el.getAttribute('aria-label') || '',
      text: (el.textContent || '').trim().slice(0, 20),
      rect: `${Math.round(r.width)}x${Math.round(r.height)}`,
      effective_hit: `${Math.round(effW)}x${Math.round(effH)}`,
      pseudo_extends: !!pb && (pb.width > r.width || pb.height > r.height),
      ancestor_clickable: anc ? `${anc.tagName.toLowerCase()}.${(anc.getAttribute('class') || '').slice(0, 40)} [${Math.round(ancR.width)}x${Math.round(ancR.height)}]` : null,
      ancestor_bigger: !!ancBig,
      label_wrapped: labelWrap,
      nearest_gap_px: gap,
    });
  }
  return { url: location.pathname, count: findings.length, findings };
}

async function main() {
  const require = createRequire(path.join(WEB, 'package.json'));
  const pw = require('playwright');
  const browser = await pw.chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true, timezoneId: 'Asia/Shanghai', locale: 'zh-CN',
  });
  const pages = [];
  try {
    for (const route of ROUTES) {
      const page = await context.newPage();
      try {
        await page.goto(TARGET + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);
        const probe = await page.evaluate(probePage);
        pages.push(probe);
      } catch (e) {
        pages.push({ route, error: String(e.message || e) });
      }
      await page.close().catch(() => {});
    }
  } finally {
    await browser.close().catch(() => {});
  }

  // Summaries
  const all = pages.flatMap((p) => p.findings || []);
  const byTag = {};
  for (const f of all) byTag[f.tag] = (byTag[f.tag] || 0) + 1;
  const pseudoExtended = all.filter((f) => f.pseudo_extends).length;
  const ancCovered = all.filter((f) => f.ancestor_bigger && f.ancestor_clickable).length;
  const labelWrapped = all.filter((f) => f.label_wrapped).length;
  const spacedOk = all.filter((f) => f.nearest_gap_px !== null && f.nearest_gap_px >= 24).length;
  const stillRaw = all.filter((f) => !f.pseudo_extends && !f.label_wrapped
    && !(f.ancestor_bigger && f.ancestor_clickable)
    && !(f.nearest_gap_px !== null && f.nearest_gap_px >= 24)).length;
  const widthVsHeight = {
    only_width_small: all.filter((f) => parseFloat(f.rect) < 24 && parseFloat(f.rect.split('x')[1]) >= 24).length,
    only_height_small: all.filter((f) => parseFloat(f.rect.split('x')[0]) >= 24 && parseFloat(f.rect.split('x')[1]) < 24).length,
    both_small: all.filter((f) => parseFloat(f.rect.split('x')[0]) < 24 && parseFloat(f.rect.split('x')[1]) < 24).length,
  };
  out({
    generated_at: new Date().toISOString(), target: TARGET, viewport: 'mobile-390',
    pages, summary: {
      total_below_24: all.length, by_tag: byTag,
      pseudo_extended: pseudoExtended, ancestor_clickable_bigger: ancCovered,
      label_wrapped: labelWrapped, spacing_ge_24: spacedOk,
      raw_unmitigated: stillRaw, size_breakdown: widthVsHeight,
    },
  });
}

main().catch((e) => out({ error: String(e.message || e) }));
