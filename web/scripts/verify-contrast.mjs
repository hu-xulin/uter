/*
Copyright (C) 2023-2026 Uter.ai
*/
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB_ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(WEB_ROOT, 'src')
const tokenSourcePath = join(SRC, 'design-system/source/brand.tokens.json')
const tokenSchemaPath = join(
  SRC,
  'design-system/source/brand.tokens.schema.json'
)
const colorsPath = join(SRC, 'design-system/tokens/colors.css')
const typographyPath = join(SRC, 'design-system/foundations/typography.css')
const source = JSON.parse(readFileSync(tokenSourcePath, 'utf8'))
const schema = JSON.parse(readFileSync(tokenSchemaPath, 'utf8'))
const metadata = source.$extensions?.['com.uter.tokens']
const machine = metadata?.machineAuthorization
const themes = source.themes
const values = (theme) =>
  Object.fromEntries(
    Object.entries(themes[theme].brand)
      .filter(([key]) => key !== '$type')
      .map(([key, token]) => [key, token.$value])
  )
const light = values('light')
const dark = values('dark')
const failures = []
const rows = []
const add = (id, ok, detail) => {
  rows.push(`${ok ? 'PASS' : 'FAIL'} ${id}: ${detail}`)
  if (!ok) failures.push(id)
}
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
const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const file = join(dir, name)
    if (statSync(file).isDirectory()) walk(file, out)
    else if (/\.(css|tsx|ts)$/.test(name)) out.push(file)
  }
  return out
}

// The token schema and active namespace must not contain human or third-party approval dependencies.
const extensionKeys = Object.keys(source.$extensions || {})
add(
  'TOKEN_NAMESPACE',
  extensionKeys.length === 1 && extensionKeys[0] === 'com.uter.tokens',
  `extensions=${extensionKeys.join(',') || 'MISSING'}`
)
add(
  'TOKEN_MACHINE_AUTHORIZATION',
  machine?.policy === 'UTER-DESIGN-SYSTEM-GOVERNANCE' &&
    machine?.mode === 'AUTONOMOUS_MACHINE_EVIDENCE' &&
    ['AUTO_ACCEPTED', 'AUTO_REJECTED', 'AUTO_BLOCKED'].includes(
      machine?.decision
    ) &&
    Array.isArray(machine?.evidence) &&
    machine.evidence.length > 0 &&
    machine?.human_signature_dependency === 'NONE' &&
    machine?.third_party_signature_dependency === 'NONE',
  `decision=${machine?.decision || 'MISSING'} human=${machine?.human_signature_dependency || 'MISSING'} third_party=${machine?.third_party_signature_dependency || 'MISSING'}`
)
add(
  'TOKEN_SCHEMA_MACHINE_AUTHORIZATION',
  schema.properties?.$extensions?.required?.includes('com.uter.tokens') ===
    true &&
    schema.$defs?.metadata?.required?.includes('machineAuthorization') ===
      true &&
    schema.$defs?.metadata?.properties?.changeApproval === undefined &&
    schema.$defs?.machineAuthorization?.properties?.human_signature_dependency
      ?.const === 'NONE' &&
    schema.$defs?.machineAuthorization?.properties
      ?.third_party_signature_dependency?.const === 'NONE',
  'schema requires machine authorization and forbids human/third-party signature dependencies'
)

// [foreground, background, minimum, label, theme, state]
const pairs = [
  [
    light.primaryForeground,
    light.primary,
    4.5,
    'primary text on primary',
    'light',
    'default',
  ],
  [
    light.primaryForeground,
    light.hover,
    4.5,
    'primary text on hover',
    'light',
    'hover',
  ],
  [
    light.primaryForeground,
    light.active,
    4.5,
    'primary text on active',
    'light',
    'active',
  ],
  [light.primary, '#FFFFFF', 4.5, 'brand link on page', 'light', 'link'],
  [
    light.softForeground,
    light.soft,
    4.5,
    'navigation selected state',
    'light',
    'selected',
  ],
  [
    light.primary,
    light.subtleSurface,
    4.5,
    'brand link on subtle surface',
    'light',
    'link',
  ],
  [
    '#67778D',
    '#FFFFFF',
    4.5,
    'tertiary foreground on page',
    'light',
    'tertiary',
  ],
  [
    dark.primaryForeground,
    dark.primary,
    4.5,
    'primary text on primary',
    'dark',
    'default',
  ],
  [
    dark.primaryForeground,
    dark.hover,
    4.5,
    'primary text on hover',
    'dark',
    'hover',
  ],
  [
    dark.primaryForeground,
    dark.active,
    4.5,
    'primary text on active',
    'dark',
    'active',
  ],
  [
    dark.primary,
    dark.subtleSurface,
    4.5,
    'brand link on dark surface',
    'dark',
    'link',
  ],
  [
    dark.softForeground,
    dark.soft,
    4.5,
    'soft foreground on soft',
    'dark',
    'soft',
  ],
  [
    dark.primary,
    dark.subtleSurface,
    3.0,
    'focus ring on dark surface',
    'dark',
    'non-text',
  ],
  [
    light.primary,
    '#FFFFFF',
    3.0,
    'focus ring on light page',
    'light',
    'non-text',
  ],
  [
    light.hover,
    '#FFFFFF',
    3.0,
    'primary hover non-text control',
    'light',
    'non-text',
  ],
  [
    dark.hover,
    '#0F172A',
    3.0,
    'dark hover non-text control',
    'dark',
    'non-text',
  ],
]
let textFailures = 0
for (const [fg, bg, min, label, theme, state] of pairs) {
  const value = ratio(fg, bg)
  const pass = value >= min
  if (!pass) textFailures += 1
  add(
    `CONTRAST_${theme.toUpperCase()}_${state.toUpperCase()}_${label.replaceAll(' ', '_')}`,
    pass,
    `${fg} on ${bg} = ${value.toFixed(2)}:1 (minimum ${min}:1) — ${label}`
  )
}
const nonTextCount = pairs.filter((x) => x[5] === 'non-text').length
add(
  'NON_TEXT_CONTRAST_INVENTORY',
  nonTextCount >= 4,
  `registered non-text contrast pairs=${nonTextCount}; minimum required=4`
)

// Negative test: the old selected-state combination must remain rejected.
const oldValue = ratio('#5B5EE6', '#F0F0FF')
add(
  'NEGATIVE_OLD_SELECTED_STATE',
  oldValue < 4.5,
  `legacy #5B5EE6 on #F0F0FF = ${oldValue.toFixed(2)}:1 and is rejected below AA 4.5:1`
)

// UDS 8.0.0 migration (2026-11-15, Phase 6 B2): the legacy upstream-anchored triple
// (--ds-color-brand-gradient-*, worst light-theme 2.54:1) has been removed from the
// runtime. The single utility owner now consumes the TOKEN-MANIFEST-derived
// --ds8-color-gradient-{light,dark}-* triples, each validated over 1001 sRGB sample
// points against 7 real backgrounds (see docs/design-system/
// CONTRAST-VERIFICATION-REPORT.md: worst Light 5.99:1 / worst Dark 8.37:1).
// E28 (spec §26.2) is revoked; the acceptance condition is now the ordinary 4.5:1
// per-stop ratio on the theme canvas, plus single-owner and legacy-trio-removed.
// 8.0.0：colors.css 遗留别名层已整体删除（CM-02~06 闭合），读取改为存在性守卫
const colorsCss = existsSync(colorsPath) ? readFileSync(colorsPath, 'utf8') : ''
const typographyCss = readFileSync(typographyPath, 'utf8')
const manifest = JSON.parse(
  readFileSync(
    join(
      WEB_ROOT,
      '../docs/design-system/TOKEN-MANIFEST.json'
    ),
    'utf8'
  )
)
const gradientStops = {
  LIGHT: ['1D4ED8', '6D28D9', '7E22CE'].map((s) => `#${s}`),
  DARK: ['93C5FD', 'C4B5FD', 'D8B4FE'].map((s) => `#${s}`),
}
for (const theme of ['light', 'dark']) {
  for (const part of ['from', 'via', 'to']) {
    const tok = manifest.tokens[`--ds-color-gradient-${theme}-${part}`]
    add(
      `GRADIENT_6_MANIFEST_${theme}_${part.toUpperCase()}`,
      Boolean(tok && /^#[0-9A-Fa-f]{6}$/.test(tok.light)),
      `manifest --ds-color-gradient-${theme}-${part} = ${tok?.light ?? 'MISSING'}`
    )
  }
}
add(
  'GRADIENT_6_UTILITY_OWNER',
  Boolean(
    typographyCss.includes('@utility ds-text-gradient-brand') &&
      typographyCss.includes('var(--ds8-color-gradient-light-from)') &&
      typographyCss.includes('var(--ds8-color-gradient-dark-from)') &&
      /90deg in srgb/.test(typographyCss)
  ),
  'single utility consumes --ds8-color-gradient-{light,dark}-* with `90deg in srgb`'
)
add(
  'GRADIENT_6_LEGACY_TRIO_REMOVED',
  !colorsCss.includes('--ds-color-brand-gradient-') && !existsSync(colorsPath),
  'legacy §17.5 triple removed — colors.css retired entirely in 8.0.0 (DP-002 executed, E28 revoked)'
)
const registeredReport = readFileSync(
  join(
    WEB_ROOT,
    '../docs/design-system/CONTRAST-VERIFICATION-REPORT.md'
  ),
  'utf8'
)
add(
  'GRADIENT_6_CONTRAST_REGISTERED',
  registeredReport.includes('5.99') && registeredReport.includes('8.37'),
  '7.0 measured worst-stop ratios (Light 5.99:1 / Dark 8.37:1) registered in CONTRAST-VERIFICATION-REPORT.md'
)
for (const [theme, bg] of [
  ['LIGHT', '#F8FAFC'],
  ['DARK', '#0B1120'],
]) {
  for (const [i, name] of ['FROM', 'VIA', 'TO'].entries()) {
    const fg = gradientStops[theme][i]
    const value = ratio(fg, bg)
    add(
      `GRADIENT_${theme}_${name}`,
      value >= 4.5,
      `${fg} on canvas ${bg} = ${value.toFixed(2)}:1 (UDS 8.0.0, per-stop ≥ 4.5:1; E28 revoked 2026-11-15)`
    )
  }
}

// No unregistered gradient text declarations are permitted outside the single utility owner.
const gradientOwners = []
for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8')
  if (
    /background-clip:\s*text|-webkit-background-clip:\s*text|-webkit-text-fill-color:\s*transparent/.test(
      text
    )
  ) {
    gradientOwners.push(relative(SRC, file))
  }
}
add(
  'GRADIENT_TEXT_SINGLE_OWNER',
  gradientOwners.length === 1 &&
    gradientOwners[0] === 'design-system/foundations/typography.css',
  `gradient text declarations=${gradientOwners.join(',') || 'NONE'}`
)

// Print machine-readable rows and a strict final decision. There are no NOT_RUN-as-PASS cases.
console.log(rows.join('\n'))
console.log(
  `\nAutomated contrast/gradient audit: ${failures.length === 0 ? 'PASS' : 'FAIL'}; checks=${rows.length}; failed=${failures.length}`
)
process.exit(failures.length === 0 ? 0 : 1)
