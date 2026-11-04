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
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = JSON.parse(readFileSync(join(process.cwd(), 'src/design-system/source/brand.tokens.json'), 'utf8'))
const generated = readFileSync(join(process.cwd(), 'src/design-system/tokens/generated/brand.css'), 'utf8')
const metadata = source.$extensions['com.uter.uaes']

describe('structured brand token source', () => {
  it('records the user-confirmed Light brand primary', () => {
    expect(source.themes.light.brand.primary.$value).toBe('#5B5EE6')
    expect(metadata.provenance['themes.light.primary']).toBe('USER_CONFIRMED')
  })
  it('preserves existing Dark palette provenance', () => {
    expect(source.themes.dark.brand.primary.$value).toBe('#A1A3F7')
    expect(metadata.provenance['themes.dark.primary']).toBe('EXISTING_3_0_IMPLEMENTATION')
  })
  it('has generated CSS for both themes', () => {
    expect(generated).toContain('--uaes-brand-primary: #5B5EE6;')
    expect(generated).toContain('--uaes-brand-primary: #A1A3F7;')
  })
})
