// UTER-DESIGN-SYSTEM-3.0 §2.3 / §19.3 — brand color contrast verification.
// Computes WCAG relative-luminance ratios for every brand state pair.
// Exit 1 when any required AA pair fails. Usage: node scripts/verify-contrast.mjs
const L = (hex) => {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    let v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (fg, bg) => {
  const [a, b] = [L(fg), L(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
};

// [foreground, background, min, label, theme, state]
const pairs = [
  ['#ffffff', '#5558d8', 4.5, 'primary-foreground on primary-strong', 'light', 'default'],
  ['#ffffff', '#4f52d1', 4.5, 'primary-foreground on hover-primary', 'light', 'hover'],
  ['#ffffff', '#4a4dc5', 4.5, 'primary-foreground on primary-active', 'light', 'active'],
  ['#5558d8', '#ffffff', 4.5, 'fg-link on background', 'light', 'link'],
  ['#5558d8', '#f0f0ff', 4.5, 'soft-foreground on soft', 'light', 'soft'],
  ['#5558d8', '#fafbfc', 4.5, 'fg-link on subtle surface', 'light', 'link'],
  ['#020617', '#a1a3f7', 4.5, 'primary-foreground on primary-strong', 'dark', 'default'],
  ['#020617', '#b1b3ff', 4.5, 'primary-foreground on hover-primary', 'dark', 'hover'],
  ['#020617', '#9294f7', 4.5, 'primary-foreground on primary-active', 'dark', 'active'],
  ['#a1a3f7', '#020617', 4.5, 'fg-link on background', 'dark', 'link'],
  ['#b1b3ff', '#25264a', 4.5, 'soft-foreground on soft', 'dark', 'soft'],
  ['#a1a3f7', '#0f172a', 3.0, 'ring/brand-border vs card surface', 'dark', 'non-text'],
  ['#5558d8', '#ffffff', 3.0, 'ring vs page surface', 'light', 'non-text'],
];

let fail = 0;
const rows = pairs.map(([fg, bg, min, label, theme, state]) => {
  const r = ratio(fg, bg);
  const pass = r >= min;
  if (!pass) fail += 1;
  return `${pass ? 'PASS' : 'FAIL'}  ${theme}/${state}  ${fg} on ${bg}  ${r.toFixed(2)}:1 (min ${min})  ${label}`;
});
console.log(rows.join('\n'));
console.log(fail === 0 ? '\nAll brand contrast pairs pass.' : `\n${fail} pair(s) FAILED`);
process.exit(fail === 0 ? 0 : 1);
