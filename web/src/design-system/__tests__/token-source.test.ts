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
import { describe, expect, it } from 'vitest'

const source = JSON.parse(readFileSync(new URL('../source/brand.tokens.json', import.meta.url), 'utf8'))
const generated = readFileSync(new URL('../tokens/generated/brand.css', import.meta.url), 'utf8')

describe('structured brand token source', () => {
  it('records the user-confirmed Light brand primary', () => {
    expect(source.themes.light.primary).toBe('#5B5EE6')
    expect(source.provenance['themes.light.primary']).toBe('USER_CONFIRMED')
  })
  it('preserves existing Dark palette provenance', () => {
    expect(source.themes.dark.primary).toBe('#A1A3F7')
    expect(source.provenance['themes.dark.primary']).toBe('EXISTING_3_0_IMPLEMENTATION')
  })
  it('has generated CSS for both themes', () => {
    expect(generated).toContain('--uaes-brand-primary: #5B5EE6;')
    expect(generated).toContain('--uaes-brand-primary: #A1A3F7;')
  })
})
