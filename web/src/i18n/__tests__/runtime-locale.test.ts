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
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/utils', () => ({ cn: (...args: unknown[]) => args.join(' ') }))

type Bundle = Record<string, unknown>

/** Minimal i18next stand-in that records what the loader does. */
function makeFakeI18n(initial?: Bundle) {
  const store: Record<string, Bundle> = initial
    ? { translation: { ...initial } }
    : {}
  const addResourceBundle = vi.fn(
    (
      _code: string,
      _ns: string,
      bundle: Bundle,
      _deep?: boolean,
      _overwrite?: boolean
    ) => {
      store.translation = { ...store.translation, ...bundle }
    }
  )
  return {
    store,
    addResourceBundle,
    getResourceBundle: vi.fn(() => store.translation),
  }
}

describe('applyBundle', () => {
  it('overrides bundled keys with runtime values', async () => {
    const { applyBundle } = await import('../runtime-locale')
    const fake = makeFakeI18n({ Save: 'Save', Cancel: 'Cancel' })

    const applied = applyBundle(
      'zhCN',
      { translation: { Save: '保存' } },
      fake as never
    )

    expect(applied).toBe(true)
    expect(fake.store.translation.Save).toBe('保存')
    // Keys absent from the runtime payload keep the bundled value.
    expect(fake.store.translation.Cancel).toBe('Cancel')
  })

  it('reports no change when the fetched values already match', async () => {
    const { applyBundle } = await import('../runtime-locale')
    const fake = makeFakeI18n({ Save: '保存' })

    const applied = applyBundle(
      'zhCN',
      { translation: { Save: '保存' } },
      fake as never
    )

    expect(applied).toBe(false)
    expect(fake.addResourceBundle).not.toHaveBeenCalled()
  })

  it('rejects malformed payloads without touching the store', async () => {
    const { applyBundle } = await import('../runtime-locale')
    const fake = makeFakeI18n({ Save: 'Save' })

    expect(applyBundle('zhCN', null, fake as never)).toBe(false)
    expect(applyBundle('zhCN', 'nope', fake as never)).toBe(false)
    expect(applyBundle('zhCN', {}, fake as never)).toBe(false)
    expect(applyBundle('zhCN', { translation: 42 }, fake as never)).toBe(false)
    expect(fake.addResourceBundle).not.toHaveBeenCalled()
    expect(fake.store.translation.Save).toBe('Save')
  })
})
