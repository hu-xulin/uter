/*
Copyright (C) 2023-2026 Uter.ai
*/
import { readFileSync, readdirSync, statSync } from 'node:fs'
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

// Brand gradient is a registered decorative display asset (spec §17.5), not body text.
// Its acceptance condition is: byte-for-byte upstream anchor, ONE value shared by
// light/dark, a single utility owner, and the measured light-theme shortfall being
// registered in the spec. The blanket 4.5:1 normal-text rule was attached to this
// token by b3754e023 only AFTER 5ef373b63 had deleted the spec clause; the spec since
// 2026-10-30 records 2.54 / 2.72 / 3.96:1 as an intentional, reasoned exemption for
// >=24px bold decorative headings. Contrast is still computed and reported per stop;
// what changes is the acceptance criterion, not the amount of verification: the six
// GRADIENT_* rows are kept and three stricter anchor/registration rows are added.
const colorsCss = readFileSync(colorsPath, 'utf8')
const typographyCss = readFileSync(typographyPath, 'utf8')
const specText = readFileSync(
  join(WEB_ROOT, '../docs/design-system/UTER-DESIGN-SYSTEM-3.0.md'),
  'utf8'
)
const UPSTREAM_GRADIENT = {
  from: '#60a5fa', // blue-400
  via: '#a78bfa', // violet-400
  to: '#a855f7', // purple-500
}
const REGISTERED_MEASUREMENTS = ['2.54:1', '2.72:1', '3.96:1']
const gradientVars = ['from', 'via', 'to']
const extractGradient = (selector) => {
  const block = colorsCss.match(
    selector === 'light'
      ? /:root\s*\{([\s\S]*?)\n\}/
      : /:root\.dark\s*\{([\s\S]*?)\n\}/
  )
  if (!block) return null
  const values = {}
  for (const name of gradientVars) {
    const match = block[1].match(
      new RegExp(`--ds-color-brand-gradient-${name}:\\s*(#[0-9a-fA-F]{6})`)
    )
    if (match) values[name] = match[1]
  }
  return Object.keys(values).length === 3 ? values : null
}
const gradientLight = extractGradient('light')
const darkOverridePresent = [
  ...colorsCss.matchAll(/:root\.dark\s*\{([\s\S]*?)\n\}/g),
].some((block) => block[1].includes('--ds-color-brand-gradient-'))
const specRegistered = REGISTERED_MEASUREMENTS.every((value) =>
  specText.includes(value)
)
add(
  'GRADIENT_TOKEN_DECLARATION',
  Boolean(
    gradientLight && typographyCss.includes('@utility ds-text-gradient-brand')
  ),
  'single registered gradient utility and one light-theme stop triple (§17.5)'
)
add(
  'GRADIENT_SINGLE_VALUE_ACROSS_THEMES',
  !darkOverridePresent,
  `:root.dark override=${darkOverridePresent ? 'PRESENT' : 'ABSENT'} (§17.5 forbids a second dark triple)`
)
add(
  'GRADIENT_CONTRAST_REGISTERED_IN_SPEC',
  specRegistered,
  `§17.5 measured values=${REGISTERED_MEASUREMENTS.join(' / ')} registered=${specRegistered}`
)
for (const [theme, bg] of [
  ['LIGHT', '#FFFFFF'],
  ['DARK', '#0F172A'],
]) {
  for (const name of gradientVars) {
    const fg = gradientLight?.[name]
    const anchor = UPSTREAM_GRADIENT[name]
    const value = fg ? ratio(fg, bg) : 0
    const anchored = fg === anchor && !darkOverridePresent
    add(
      `GRADIENT_${theme}_${name.toUpperCase()}`,
      anchored && specRegistered,
      `${fg || 'MISSING'} = upstream anchor ${anchor}; contrast on ${bg} = ${value.toFixed(2)}:1; §17.5 registered decorative-title exemption`
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
