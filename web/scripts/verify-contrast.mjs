/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// UTER Design System 3.0 — WCAG contrast checks consume the structured DTCG token source.
const sourceUrl = new URL('../src/design-system/source/brand.tokens.json', import.meta.url)
const { themes } = JSON.parse(readFileSync(fileURLToPath(sourceUrl), 'utf8'))
const values = (theme) => Object.fromEntries(
  Object.entries(themes[theme].brand)
    .filter(([key]) => key !== '$type')
    .map(([key, token]) => [key, token.$value])
)
const light = values('light')
const dark = values('dark')

const L = (hex) => {
  const c = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (fg, bg) => {
  const [a, b] = [L(fg), L(bg)].sort((x, y) => y - x)
  return (a + 0.05) / (b + 0.05)
}

// [foreground, background, minimum, label, theme, state]
const pairs = [
  [light.primaryForeground, light.primary, 4.5, 'primary text on primary', 'light', 'default'],
  [light.primaryForeground, light.hover, 4.5, 'primary text on hover', 'light', 'hover'],
  [light.primaryForeground, light.active, 4.5, 'primary text on active', 'light', 'active'],
  [light.primary, '#FFFFFF', 4.5, 'brand link on page', 'light', 'link'],
  [light.softForeground, light.soft, 4.5, 'navigation selected state — remediated foreground per UAES-05-003 §6', 'light', 'selected'],
  [light.primary, light.subtleSurface, 4.5, 'brand link on subtle surface', 'light', 'link'],
  ['#67778D', '#FFFFFF', 4.5, 'tertiary foreground on page (audited mix)', 'light', 'tertiary'],
  [dark.primaryForeground, dark.primary, 4.5, 'primary text on primary', 'dark', 'default'],
  [dark.primaryForeground, dark.hover, 4.5, 'primary text on hover', 'dark', 'hover'],
  [dark.primaryForeground, dark.active, 4.5, 'primary text on active', 'dark', 'active'],
  [dark.primary, dark.subtleSurface, 4.5, 'brand link on dark surface', 'dark', 'link'],
  [dark.softForeground, dark.soft, 4.5, 'soft foreground on soft', 'dark', 'soft'],
  [dark.primary, dark.subtleSurface, 3.0, 'ring on dark surface', 'dark', 'non-text'],
  [light.primary, '#FFFFFF', 3.0, 'ring on light page', 'light', 'non-text'],
]

let failures = 0
const rows = pairs.map(([fg, bg, min, label, theme, state]) => {
  const value = ratio(fg, bg)
  const pass = value >= min
  if (!pass) failures += 1
  return (pass ? 'PASS' : 'FAIL') + '  ' + theme + '/' + state + '  ' + fg + ' on ' + bg + '  ' + value.toFixed(2) + ':1 (min ' + min + ')  ' + label
})
console.log(rows.join('\n'))

// Negative test (UAES-P05 acceptance baseline §L.4 / UAES-05-003 §6):
// the pre-remediation navigation selected combination was 4.44:1 and MUST be
// rejected, not silently waived because the gap is small.
const NEG_FG = '#5B5EE6'
const NEG_BG = '#F0F0FF'
const negValue = ratio(NEG_FG, NEG_BG)
const negRejected = negValue < 4.5
if (!negRejected) failures += 1
console.log(
  (negRejected ? 'NEGATIVE-TEST PASS' : 'NEGATIVE-TEST FAIL') +
  '  pre-remediation navigation selected ' + NEG_FG + ' on ' + NEG_BG +
  ' = ' + negValue.toFixed(2) + ':1 -> ' +
  (negRejected ? 'correctly rejected by the AA 4.5:1 rule' : 'incorrectly accepted')
)

// UAES-05-GATE-001 §4/§6: checks that cannot run are NOT_RUN, never PASS.
console.log('\nNOT_RUN: full non-text 3:1 inventory, gradient text, runtime')
console.log('theme-switch combinations and automated axe scan are not covered here.')

console.log(failures === 0 ? '\nAll executable brand contrast checks pass; NOT_RUN items remain open.' : '\n' + failures + ' check(s) FAILED')
process.exit(failures === 0 ? 0 : 1)
