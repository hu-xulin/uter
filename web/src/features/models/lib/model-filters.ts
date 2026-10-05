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
 *  4. Nothing configured, but the model is still resolvable — the platform
 *     has a built-in default, or a ratio that the relay resolves by prefix.
 *     That is `unconfigured`: nothing for the admin to do.
 *  5. Nothing configured and nothing to fall back on → `unset`. Relay rejects
 *     these with "pricing has not been configured" unless self-use mode is
 *     on, so this is the bucket worth acting on.
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

  // Nothing saved: fall back to what the engine would still apply, which is
  // what keeps this bucket accurate for models covered by a built-in default.
  if (isConfigured(effective.ModelPrice)) return 'expression'
  if (isConfigured(effective.ModelRatio)) return 'unconfigured'
  if (mode === 'tiered_expr') return 'unconfigured'

  return 'unset'
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
