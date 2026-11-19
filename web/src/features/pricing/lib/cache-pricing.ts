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
import {
  BILLING_PRICING_VARS,
  type BillingVar,
  type ParsedTier,
} from './billing-expr'

export type CachePricingMode = 'generic' | 'gpt' | 'claude' | 'custom'

/** Mixed or conflicting cache prices need the custom editor to show every item. */
export function getCachePricingMode(
  variables: Iterable<string>,
  modelName?: string
): CachePricingMode {
  const used = new Set(variables)
  const claudeWrite = used.has('cc1h')
  const gptWrite = used.has('cc12h')
  const model = modelName?.toLowerCase() ?? ''
  let modelMode: CachePricingMode | undefined
  if (model.includes('claude')) modelMode = 'claude'
  else if (model.includes('gpt')) modelMode = 'gpt'
  else if (model.includes('gemini')) modelMode = 'generic'

  if (claudeWrite && gptWrite) return 'custom'
  if (claudeWrite) {
    return modelMode && modelMode !== 'claude' ? 'custom' : 'claude'
  }
  if (gptWrite) return modelMode && modelMode !== 'gpt' ? 'custom' : 'gpt'
  if (used.has('cc')) {
    return modelMode === 'gpt' || modelMode === 'claude' ? modelMode : 'custom'
  }
  return modelMode ?? 'generic'
}

export function getTierCachePricingMode(
  tiers: readonly ParsedTier[],
  modelName?: string
): CachePricingMode {
  const variables = BILLING_PRICING_VARS.filter(
    (variable) =>
      variable.field &&
      tiers.some(
        (tier) => typeof tier[variable.field as keyof ParsedTier] === 'number'
      )
  ).map((variable) => variable.key)
  return getCachePricingMode(variables, modelName)
}

export function getCachePriceLabels(
  variable: Pick<BillingVar, 'key' | 'label' | 'shortLabel'>,
  mode: CachePricingMode
): Pick<BillingVar, 'label' | 'shortLabel'> {
  if (variable.key === 'cc') {
    if (mode === 'gpt') {
      return {
        label: 'Cache create (30m) price',
        shortLabel: 'Cache Write (30m)',
      }
    }
    if (mode === 'claude') {
      return {
        label: 'Cache create (5m) price',
        shortLabel: 'Cache Write (5m)',
      }
    }
    return { label: 'Standard cache write price', shortLabel: 'Cache Write' }
  }
  if (variable.key === 'cc1h' && mode !== 'claude') {
    return {
      label: 'Claude cache write (1h) price',
      shortLabel: 'Cache Write (Claude 1h)',
    }
  }
  if (variable.key === 'cc12h' && mode !== 'gpt') {
    return {
      label: 'GPT cache write (12h) price',
      shortLabel: 'Cache Write (GPT 12h)',
    }
  }
  return { label: variable.label, shortLabel: variable.shortLabel }
}
