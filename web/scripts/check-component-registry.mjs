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
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const REGISTRY_PATH = join(ROOT, 'src/design-system/component-registry.json')
const UI_ROOT = join(ROOT, 'src/components/ui')
const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'))
const errors = []
const warnings = []
const ids = new Set()
const files = new Set()

function collectTsx(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') return []
      return collectTsx(full)
    }
    if (!entry.isFile() || !entry.name.endsWith('.tsx')) return []
    if (/\.(test|spec)\.tsx$/.test(entry.name)) return []
    return [relative(ROOT, full).replaceAll('\\', '/')]
  })
}

if (registry.designSystem !== 'UTER Design System 3.0') errors.push('Registry designSystem must be UTER Design System 3.0')
if (registry.implementationRoot !== 'src/components/ui') errors.push('Unexpected implementation root')
if (!Array.isArray(registry.components)) errors.push('components must be an array')

for (const component of registry.components ?? []) {
  if (ids.has(component.id)) errors.push('Duplicate component ID: ' + component.id)
  ids.add(component.id)
  if (files.has(component.file)) errors.push('Duplicate component file: ' + component.file)
  files.add(component.file)
  if (!existsSync(join(ROOT, component.file))) errors.push('Missing component file: ' + component.file)
  if (!component.contract?.states?.length) errors.push('Missing states: ' + component.id)
  for (const section of ['accessibility', 'responsive', 'tokens', 'evidence']) {
    if (!component.contract?.[section]) errors.push('Missing contract section ' + section + ': ' + component.id)
  }
  if (!['NOT_VERIFIED', 'PARTIAL', 'VERIFIED', 'EXCEPTION'].includes(component.contract?.evidence?.status)) {
    errors.push('Invalid evidence status: ' + component.id)
  }
  for (const test of component.contract?.evidence?.tests ?? []) {
    if (!existsSync(join(ROOT, test))) errors.push('Missing test evidence file ' + test + ' for ' + component.id)
  }
  if (component.contract?.evidence?.status !== 'VERIFIED') warnings.push('Evidence not verified: ' + component.id)
}

const actual = new Set(collectTsx(UI_ROOT))
for (const file of actual) if (!files.has(file)) errors.push('Unregistered UI component file: ' + file)
for (const file of files) if (!actual.has(file)) errors.push('Registry entry is not an eligible UI component: ' + file)

const summary = {
  registered: registry.components.length,
  discovered: actual.size,
  evidenceVerified: registry.components.filter((x) => x.contract.evidence.status === 'VERIFIED').length,
  evidencePartial: registry.components.filter((x) => x.contract.evidence.status === 'PARTIAL').length,
  evidenceNotVerified: registry.components.filter((x) => x.contract.evidence.status === 'NOT_VERIFIED').length,
  errors: errors.length,
  warnings: warnings.length,
}
console.log('[UAES Component Registry]', JSON.stringify(summary, null, 2))
for (const error of errors) console.error('ERROR:', error)
for (const warning of warnings) console.warn('WARN:', warning)
if (errors.length) process.exit(1)
if (process.argv.includes('--strict') && warnings.length) {
  console.error('Strict mode: all registered components must have VERIFIED evidence.')
  process.exit(1)
}
console.log('Component registry structure and filesystem inventory are valid.')
