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
import { modelPricingDisplay } from '@/features/model-pricing/pricing'
import type { ModelPricingEntry } from '@/features/model-pricing/api'
import { getDynamicPricingSummary } from '@/features/pricing/lib/dynamic-price'

import type { ModelMetadataFilter, ModelPricingFilter } from '../types'

/**
 * Classifiers behind the model list's metadata and pricing filters.
 *
 * Both filters answer a question the row itself cannot: a channel-only model
 * (`id === 0`) has no metadata by definition, and pricing lives in a separate
 * per-model configuration that the list endpoint does not inline. So the
 * table resolves pricing separately and filters the result set in memory, the
 * same way the backend already does for `square_state` — load the enriched
 * candidates, narrow them, then paginate.
 */

/**
 * Whether a row has a record in the `models` table.
 *
 * The API synthesises rows for names that are configured on a channel but
 * absent from the table, giving them `id === 0` and `has_metadata === false`.
 * Prefer the explicit flag and fall back to the id, so a row is never
 * classified as "has metadata" merely because the flag was omitted.
 */
export function classifyModelMetadata(model: {
  id: number
  has_metadata?: boolean
}): ModelMetadataFilter {
  if (typeof model.has_metadata === 'boolean') {
    return model.has_metadata ? 'has' : 'none'
  }
  return model.id > 0 ? 'has' : 'none'
}

function isConfigured(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return value.trim() !== ''
  return true
}

/**
 * How a model is priced, from its pricing configuration entry.
 *
 * The order of the tests matters and mirrors the relay's own resolution
 * order (`relay/relay_task.go` for tasks, `relay/helper/price.go` for text):
 *
 *  1. A billing expression decides the price on its own — `tiered_expr` with
 *     a `billing_expr`, or the per-model plugin expressions. Neither is a
 *     ratio, so it is reported as `expression` regardless of what else is
 *     configured alongside it.
 *  2. A per-call `ModelPrice` overrides ratios, so it is also `expression`:
 *     the model is billed per call, not per token.
 *  3. A `ModelRatio` is ordinary per-token pricing → `standard`.
 *  4. Nothing is saved in the admin configuration. The model is unconfigured
 *     and needs pricing set up, so it is `unconfigured` — regardless of any
 *     platform default the relay might still apply. This is the actionable
 *     bucket an operator filters on, so it must surface every model the admin
 *     has not explicitly priced, not only those with an engine-resolved default.
 *  5. No pricing entry is returned for the model at all (the API knows nothing
 *     about it) → `unset`. In practice this only happens for pattern models
 *     (`name_rule !== 0`) that the client-side filter excludes from the pricing
 *     query; an explicit-name model always has an entry, so it lands in
 *     `unconfigured` when nothing is saved.
 *
 * A model with no entry at all is `unset`: no entry means no configuration.
 */
export function classifyModelPricing(
  entry: ModelPricingEntry | undefined
): ModelPricingFilter {
  if (!entry) return 'unset'

  const configured = entry.configured ?? {}
  const effective = entry.effective ?? {}

  const mode = effective['billing_setting.billing_mode']
  if (mode === 'tiered_expr' && isConfigured(effective['billing_setting.billing_expr'])) {
    return 'expression'
  }
  const pluginExprs = effective['billing_setting.plugin_billing_expr']
  if (pluginExprs && Object.values(pluginExprs).some(isConfigured)) {
    return 'expression'
  }

  // `configured` is what an admin actually saved; `effective` folds in engine
  // defaults. Prefer the former so a model is only called "unconfigured" when
  // the saved configuration is genuinely empty — otherwise every model would
  // look configured, since `effective` always carries a resolved
  // `CompletionRatio` and cache ratios.
  if (isConfigured(configured.ModelPrice)) return 'expression'
  if (isConfigured(configured.ModelRatio)) return 'standard'

  // A model the engine would still bill per call, even without a saved ratio,
  // is genuinely expression-priced.
  if (isConfigured(effective.ModelPrice)) return 'expression'

  // Nothing is saved in the admin configuration. From the operator's point of
  // view the model is unconfigured and needs pricing set up, so it belongs in
  // the `unconfigured` bucket regardless of any platform default the relay might
  // still apply — either way the admin has work to do. (The `unset` bucket is
  // reserved for models the pricing API returned no entry for at all.)
  return 'unconfigured'
}

/**
 * Index pricing entries by model name, dropping the ones with no configuration.
 */
export function indexPricingByModel(
  entries: ModelPricingEntry[] | undefined
): Map<string, ModelPricingEntry> {
  const index = new Map<string, ModelPricingEntry>()
  for (const entry of entries ?? []) {
    index.set(entry.model_name, entry)
  }
  return index
}

/**
 * The pricing state behind the pricing filter, resolved from a model's pricing
 * entry and the pricing request's own status.
 *
 * `state` carries the global fetch status. While the per-model pricing is still
 * loading or has failed for the whole page, every individually-priced row
 * shares that state — the column renders "Loading..." / "Failed to load model
 * pricing" for all of them — so it is reported for every row.
 *
 * Expression-driven pricing resolves first, because `ModelPriceCell` renders it
 * from the expression rather than from a saved ratio:
 *  - `special_expression` — a billing expression that resolves to no tiers.
 *  - `dynamic`            — a resolved tiered/plugin expression with prices.
 *
 * Anything else keeps the saved-configuration classification above, which
 * already distinguishes `standard`, `expression` (per-call), `unconfigured`
 * and `unset`. That keeps those four buckets exactly as they were before the
 * expression buckets were split out, so adding a new facet never moves a model
 * between the existing ones.
 */
export function classifyPricingState(
  entry: ModelPricingEntry | undefined,
  modelName: string,
  state?: 'loading' | 'error'
): ModelPricingFilter {
  if (state === 'loading') return 'loading'
  if (state === 'error') return 'error'

  const model = modelPricingDisplay(
    entry ?? { model_name: modelName, effective: {} }
  )
  const dynamic = getDynamicPricingSummary(model, { tokenUnit: 'M' })
  if (dynamic) {
    if (dynamic.isSpecialExpression) return 'special_expression'
    if (dynamic.entries.length === 0) {
      return dynamic.hasUnconfiguredProviders ? 'unconfigured' : 'dynamic'
    }
    return 'dynamic'
  }
  return classifyModelPricing(entry)
}
