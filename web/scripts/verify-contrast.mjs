/*
Copyright (C) 2023-2026 Uter.ai
Licensed under the GNU Affero General Public License v3 or later.
*/
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const sourceUrl = new URL('../src/design-system/source/brand.tokens.json', import.meta.url)
const { themes } = JSON.parse(readFileSync(fileURLToPath(sourceUrl), 'utf8'))
const light = themes.light
const dark = themes.dark

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
  [light.softForeground, light.soft, 4.5, 'soft foreground on soft', 'light', 'soft'],
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
  return `${pass ? 'PASS' : 'FAIL'}  ${theme}/${state}  ${fg} on ${bg}  ${value.toFixed(2)}:1 (min ${min})  ${label}`
})
console.log(rows.join('\n'))
console.log(failures === 0 ? '\nAll brand contrast pairs pass.' : `\n${failures} pair(s) FAILED`)
process.exit(failures === 0 ? 0 : 1)
