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
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = resolve(WEB_ROOT, 'src/design-system/source/brand.tokens.json')
const OUTPUT = resolve(WEB_ROOT, 'src/design-system/tokens/generated/brand.css')
const CHECK_ONLY = process.argv.includes('--check')
const source = JSON.parse(readFileSync(SOURCE, 'utf8'))
const keys = ['primary','primaryForeground','hover','active','soft','softForeground','border','subtleSurface']
for (const theme of ['light','dark']) {
  const palette = source.themes?.[theme]
  if (!palette) throw new Error(`Missing theme: ${theme}`)
  for (const key of keys) {
    if (typeof palette[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(palette[key])) {
      throw new Error(`Invalid ${theme}.${key}: expected #RRGGBB`)
    }
  }
}
const names = {primary:'primary',primaryForeground:'primary-foreground',hover:'hover',active:'active',soft:'soft',softForeground:'soft-foreground',border:'border',subtleSurface:'subtle-surface'}
const render = theme => keys.map(key => `  --uaes-brand-${names[key]}: ${source.themes[theme][key]};`).join('\n')
const output = `/*
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
/*
 * GENERATED FILE — DO NOT EDIT.
 * Source: src/design-system/source/brand.tokens.json
 * Generator: scripts/generate-design-tokens.mjs
 */
:root {
${render('light')}
}

.dark {
${render('dark')}
}
`
if (CHECK_ONLY) {
  if (!existsSync(OUTPUT) || readFileSync(OUTPUT, 'utf8') !== output) {
    console.error('Generated design tokens are stale. Run: bun run design:tokens:generate')
    process.exit(1)
  }
  console.log('Design token source and generated CSS are in sync.')
} else {
  mkdirSync(dirname(OUTPUT), {recursive:true})
  writeFileSync(OUTPUT, output)
  console.log('Generated src/design-system/tokens/generated/brand.css')
}
