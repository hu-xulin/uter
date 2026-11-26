import { describe, expect, test } from 'vitest'

import { colorIconName, monoIconName, resolveModelIconKey } from '../lobe-icon'

describe('colorIconName', () => {
  test('upgrades a monochrome brand key to its color variant', () => {
    // Claude ships a ".Color" glyph, so the pricing cards get brand colors.
    expect(colorIconName('Claude')).toBe('Claude.Color')
    expect(colorIconName('Gemini')).toBe('Gemini.Color')
    expect(colorIconName('Qwen')).toBe('Qwen.Color')
  })

  test('falls back to the avatar variant for brands without a color glyph', () => {
    // OpenAI / Moonshot only ship ".Avatar" (brand background + glyph), which
    // is still a colored rendering rather than a currentColor silhouette.
    expect(['OpenAI.Avatar', 'OpenAI.Color']).toContain(colorIconName('OpenAI'))
    expect(['Moonshot.Avatar', 'Moonshot.Color']).toContain(
      colorIconName('Moonshot')
    )
  })

  test('leaves keys that already target an explicit rendering untouched', () => {
    expect(colorIconName('Claude.Color')).toBe('Claude.Color')
    expect(colorIconName('OpenAI.Avatar')).toBe('OpenAI.Avatar')
    // GPT/OpenAI rankings use the transparent Mono glyph instead of Avatar's
    // solid brand background, so an explicit Mono key must stay untouched.
    expect(colorIconName('OpenAI.Mono')).toBe('OpenAI.Mono')
    expect(colorIconName(`Claude.Avatar.type={'platform'}`)).toBe(
      `Claude.Avatar.type={'platform'}`
    )
  })

  test('passes through empty and unknown keys', () => {
    expect(colorIconName('')).toBe('')
    expect(colorIconName('   ')).toBe('')
    expect(colorIconName('NotABrand')).toBe('NotABrand')
  })
})

describe('monoIconName', () => {
  test('strips a bare color variant so the icon follows currentColor', () => {
    expect(monoIconName('Gemini.Color')).toBe('Gemini')
    expect(monoIconName('  Qwen.Color ')).toBe('Qwen')
  })

  test('strips a bare avatar variant (backend now persists color keys)', () => {
    // Sync writes "OpenAI.Avatar" / "Anthropic.Avatar" for brands without a
    // ".Color" glyph; the sidebar must still render them monochrome.
    expect(monoIconName('OpenAI.Avatar')).toBe('OpenAI')
    expect(monoIconName(' Anthropic.Avatar ')).toBe('Anthropic')
  })

  test('leaves monochrome and advanced chain forms untouched', () => {
    expect(monoIconName('OpenAI')).toBe('OpenAI')
    expect(monoIconName(`Claude.Avatar.type={'platform'}`)).toBe(
      `Claude.Avatar.type={'platform'}`
    )
  })

  test('handles empty input', () => {
    expect(monoIconName('')).toBe('')
    expect(monoIconName('   ')).toBe('')
  })
})

describe('resolveModelIconKey', () => {
  test("renders a model's own product logo in brand colors", () => {
    // Model logos stay colored: Claude.Color for the model, Anthropic for the
    // company that serves it.
    expect(resolveModelIconKey('Claude')).toBe('Claude.Color')
    expect(resolveModelIconKey('Qwen')).toBe('Qwen.Color')
  })

  test('never falls back to the vendor company logo', () => {
    // Hard product rule: a vendor's company logo (set per-vendor in
    // 模型-供应商) belongs to vendor surfaces only. A model without its own
    // product logo resolves to no icon, and the call site renders the
    // initial-letter placeholder. Regressions here repeatedly put company
    // logos on pricing cards — keep this assertion failing loudly.
    expect(resolveModelIconKey('')).toBe('')
    expect(resolveModelIconKey(undefined)).toBe('')
    expect(resolveModelIconKey('   ')).toBe('')
  })

  test('keeps an already-colored key untouched', () => {
    expect(resolveModelIconKey('Claude.Color')).toBe('Claude.Color')
    expect(resolveModelIconKey('OpenAI.Avatar')).toBe('OpenAI.Avatar')
  })
})
