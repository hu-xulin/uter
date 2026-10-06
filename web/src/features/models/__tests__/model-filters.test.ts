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
import type { ModelPricingEntry } from '@/features/model-pricing/api'
import { describe, expect, it } from 'vitest'

import {
  classifyModelMetadata,
  classifyModelPricing,
  classifyPricingState,
  indexPricingByModel,
} from '../lib/model-filters'

/**
 * These cover the two classifiers behind the model list's metadata and
 * pricing filters. For pricing, the boundary that matters is "something the
 * admin saved" (standard / expression) versus "nothing saved" (unconfigured).
 * A model with no saved configuration is reported as `unconfigured` so it
 * surfaces in that filter regardless of any platform default the relay would
 * still apply; `unset` is reserved for models the pricing API returned no
 * entry for at all.
 */

function entry(over: Partial<ModelPricingEntry> = {}): ModelPricingEntry {
  return {
    model_name: 'example',
    version: 'v1',
    configured: {},
    effective: {},
    ...over,
  }
}

describe('classifyModelMetadata', () => {
  it('trusts an explicit has_metadata flag', () => {
    expect(classifyModelMetadata({ id: 7, has_metadata: true })).toBe('has')
    expect(classifyModelMetadata({ id: 7, has_metadata: false })).toBe('none')
  })

  it('falls back to the id when the flag is absent', () => {
    // Channel-only rows are synthesised with id 0 and no flag.
    expect(classifyModelMetadata({ id: 0 })).toBe('none')
    expect(classifyModelMetadata({ id: 12 })).toBe('has')
  })

  it('does not call a row with metadata when the API says otherwise', () => {
    // Guards the flag taking precedence: a stale id must not win.
    expect(classifyModelMetadata({ id: 12, has_metadata: false })).toBe('none')
  })
})

describe('classifyModelPricing', () => {
  it('reports an absent entry as unset', () => {
    expect(classifyModelPricing(undefined)).toBe('unset')
  })

  it('reads a saved ModelRatio as standard pricing', () => {
    expect(
      classifyModelPricing(entry({ configured: { ModelRatio: 2.5 } }))
    ).toBe('standard')
  })

  it('reads a saved per-call ModelPrice as an expression', () => {
    expect(
      classifyModelPricing(entry({ configured: { ModelPrice: 0.3 } }))
    ).toBe('expression')
  })

  it('reads tiered_expr with an expression as an expression', () => {
    expect(
      classifyModelPricing(
        entry({
          effective: {
            'billing_setting.billing_mode': 'tiered_expr',
            'billing_setting.billing_expr': 'tier("standard", p * 5)',
          },
        })
      )
    ).toBe('expression')
  })

  it('reads a per-model plugin expression as an expression', () => {
    expect(
      classifyModelPricing(
        entry({
          effective: {
            'billing_setting.plugin_billing_expr': { doubao: 'p * 1' },
          },
        })
      )
    ).toBe('expression')
  })

  it('prefers the expression over a ratio saved alongside it', () => {
    // Relay bills an expression when one is present, so the ratio is not what
    // decides the price.
    expect(
      classifyModelPricing(
        entry({
          configured: { ModelRatio: 2.5 },
          effective: {
            'billing_setting.billing_mode': 'tiered_expr',
            'billing_setting.billing_expr': 'tier("standard", p * 5)',
          },
        })
      )
    ).toBe('expression')
  })

  it('reports "nothing saved" as unconfigured, with or without an engine default', () => {
    // configured is empty; whether effective carries an engine default
    // (ModelRatio) or only completion/cache defaults, the admin has nothing
    // saved, so the model is unconfigured and surfaces in that filter.
    expect(
      classifyModelPricing(entry({ effective: { ModelRatio: 2.5 } }))
    ).toBe('unconfigured')
  })

  it('treats a saved zero as configured, not missing', () => {
    // A free model is deliberately priced at 0; treating 0 as absent would
    // put it in the wrong bucket.
    expect(
      classifyModelPricing(entry({ configured: { ModelRatio: 0 } }))
    ).toBe('standard')
    expect(
      classifyModelPricing(entry({ configured: { ModelPrice: 0 } }))
    ).toBe('expression')
  })

  it('reports an entry with nothing saved as unconfigured', () => {
    expect(classifyModelPricing(entry())).toBe('unconfigured')
  })

  it('treats an entry with only engine-resolved completion/cache defaults as unconfigured', () => {
    // `effective` always carries a resolved CompletionRatio and cache ratios,
    // but with nothing saved the model is still unconfigured and must surface.
    expect(
      classifyModelPricing(
        entry({
          configured: {},
          effective: { CompletionRatio: 3, CacheRatio: 0.1 },
        })
      )
    ).toBe('unconfigured')
  })
})

describe('classifyPricingState', () => {
  /**
   * Covers only the branches that do not depend on how a billing expression
   * parses into tiers: the global fetch status buckets and the pass-through to
   * `classifyModelPricing` when no expression drives the price. The dynamic and
   * special-expression buckets depend on tier parsing, which is exercised by
   * the pricing-feature tests.
   */
  it('reports the shared fetch status ahead of any per-row pricing', () => {
    // While the pricing request is in flight (or errored) the column renders
    // one state for every individually-priced row.
    expect(classifyPricingState(undefined, 'example', 'loading')).toBe(
      'loading'
    )
    expect(classifyPricingState(undefined, 'example', 'error')).toBe('error')
    expect(
      classifyPricingState(entry({ configured: { ModelRatio: 2.5 } }), 'e', 'loading')
    ).toBe('loading')
  })

  it('falls through to the saved-configuration buckets without an expression', () => {
    expect(classifyPricingState(undefined, 'example')).toBe('unset')
    expect(
      classifyPricingState(entry({ configured: { ModelRatio: 2.5 } }), 'example')
    ).toBe('standard')
    expect(
      classifyPricingState(entry({ configured: { ModelPrice: 0.3 } }), 'example')
    ).toBe('expression')
    expect(classifyPricingState(entry({ effective: { ModelRatio: 2.5 } }), 'example')).toBe(
      'unconfigured'
    )
  })
})

describe('indexPricingByModel', () => {
  it('keys entries by model name and tolerates an absent list', () => {
    const index = indexPricingByModel([
      entry({ model_name: 'a' }),
      entry({ model_name: 'b' }),
    ])
    expect(index.get('a')?.model_name).toBe('a')
    expect(index.size).toBe(2)
    expect(indexPricingByModel(undefined).size).toBe(0)
  })
})
