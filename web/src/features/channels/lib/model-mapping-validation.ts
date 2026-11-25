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
// ============================================================================
// Model Mapping Validation Utilities
// ============================================================================

/**
 * Parse models string to array
 */
export function parseModelsString(modelsStr: string): string[] {
  return modelsStr
    ? modelsStr
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean)
    : []
}

/**
 * Format models array to string
 */
export function formatModelsArray(models: string[]): string {
  return [...new Set(models)].join(',')
}

/**
 * 合并上游模型到渠道列表时，跳过已被重定向的上游原名。
 *
 * 批量重定向把上游原名（映射的 target）改写为请求别名（映射的 source）。
 * 若之后再「全选上游模型」把原名追加回来，同一个模型会以原名和别名各占
 * 一格，模型数翻倍（例如 82 变 164），定价就绪面板因此把别名误报为
 * 「尚无定价」。被重定向的原名已经由别名代表，不应再进入列表。
 */
export function mergeUpstreamModelsWithRedirects(
  currentModels: string[],
  upstreamModels: string[],
  modelMapping: string
): string[] {
  const redirectedTargets = new Set(extractRedirectModels(modelMapping))
  const additions = upstreamModels.filter(
    (model) => !redirectedTargets.has(model.trim())
  )
  return [...new Set([...currentModels, ...additions])]
}

/**
 * Normalize model name
 */
export function normalizeModelName(model: string): string {
  return typeof model === 'string' ? model.trim() : ''
}

/**
 * Extract source keys from model_mapping JSON
 * (the keys of the mapping object — models being remapped FROM)
 */
export function extractMappingSourceModels(modelMapping: string): string[] {
  if (typeof modelMapping !== 'string') return []
  const trimmed = modelMapping.trim()
  if (!trimmed) return []

  try {
    const parsed = JSON.parse(trimmed)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return []
    }

    const keys = Object.keys(parsed)
      .map((key) => key.trim())
      .filter(Boolean)

    return [...new Set(keys)]
  } catch {
    return []
  }
}

/**
 * Extract redirect models from model_mapping JSON
 */
export function extractRedirectModels(modelMapping: string): string[] {
  const mapping = modelMapping
  if (typeof mapping !== 'string') return []
  const trimmed = mapping.trim()
  if (!trimmed) return []

  try {
    const parsed = JSON.parse(trimmed)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return []
    }

    const values = Object.values(parsed)
      .map((value) => (typeof value === 'string' ? value.trim() : undefined))
      .filter((value): value is string => Boolean(value))

    return [...new Set(values)]
  } catch {
    return []
  }
}

/**
 * Follow a model_mapping chain to the concrete upstream name. A cycle has no
 * authoritative target and is returned as empty so callers skip the alias.
 */
export function resolveMappingTargetChain(
  source: string,
  mapping: Record<string, string>
): string {
  const seen = new Set<string>()
  let current = source.trim()
  while (current && typeof mapping[current] === 'string') {
    if (seen.has(current)) return ''
    seen.add(current)
    current = mapping[current].trim()
  }
  return current
}

/**
 * Preview saved pricing rows under the request aliases created by an unsaved
 * batch redirect. Saved rows are keyed by upstream names; a redirect publishes
 * aliases in the channel model list. Without this remap the wizard shows every
 * redirected model as having no price even though the upstream row exists.
 */
export function remapPricingRowsForPreview<T extends { model_name: string }>(
  rows: T[],
  modelMapping: string,
  selectedModels: string[]
): T[] {
  if (!modelMapping?.trim() || selectedModels.length === 0) return rows

  let parsed: unknown
  try {
    parsed = JSON.parse(modelMapping)
  } catch {
    return rows
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return rows
  const mapping = parsed as Record<string, string>
  if (Object.values(mapping).some((value) => typeof value !== 'string')) return rows

  const selected = new Set(selectedModels.map((model) => model.trim()))
  const aliasesByUpstream = new Map<string, string[]>()
  for (const source of Object.keys(mapping)) {
    const alias = source.trim()
    if (!alias || !selected.has(alias)) continue
    const target = resolveMappingTargetChain(alias, mapping)
    if (!target || target === alias) continue
    const aliases = aliasesByUpstream.get(target) ?? []
    if (!aliases.includes(alias)) aliases.push(alias)
    aliasesByUpstream.set(target, aliases)
  }
  if (aliasesByUpstream.size === 0) return rows

  const remapped: T[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const aliases = aliasesByUpstream.get(row.model_name)
    if (!aliases?.length) {
      if (!seen.has(row.model_name)) {
        seen.add(row.model_name)
        remapped.push(row)
      }
      continue
    }
    for (const alias of aliases) {
      if (seen.has(alias)) continue
      seen.add(alias)
      remapped.push({ ...row, model_name: alias })
    }
  }
  return remapped
}

/**
 * Check if model configuration has changed
 */
export function hasModelConfigChanged(
  currentModels: string[],
  currentModelMapping: string,
  initialModels: string[],
  initialModelMapping: string
): boolean {
  // Always return true if not editing (new channel)
  if (initialModels.length === 0 && !initialModelMapping) {
    return true
  }

  // Check if models array changed
  if (currentModels.length !== initialModels.length) {
    return true
  }
  for (let i = 0; i < currentModels.length; i++) {
    if (currentModels[i] !== initialModels[i]) {
      return true
    }
  }

  // Check if model_mapping changed
  const normalizedCurrent = (currentModelMapping || '').trim()
  const normalizedInitial = (initialModelMapping || '').trim()

  return normalizedCurrent !== normalizedInitial
}

/**
 * Find models in model_mapping that are missing from the models list
 */
export function findMissingModelsInMapping(
  modelMapping: string,
  currentModels: string[]
): string[] {
  if (!modelMapping || modelMapping.trim() === '') {
    return []
  }

  let parsedMapping: Record<string, unknown>
  try {
    parsedMapping = JSON.parse(modelMapping)
    if (
      !parsedMapping ||
      typeof parsedMapping !== 'object' ||
      Array.isArray(parsedMapping)
    ) {
      return []
    }
  } catch {
    return []
  }

  const modelSet = new Set(currentModels.map((m) => normalizeModelName(m)))
  const missingModels = Object.keys(parsedMapping)
    .map((key) => normalizeModelName(key))
    .filter((key) => key && !modelSet.has(key))

  return [...new Set(missingModels)]
}

/**
 * Validate model mapping JSON format
 */
export function validateModelMappingJson(modelMapping: string): {
  valid: boolean
  error?: string
} {
  if (!modelMapping || modelMapping.trim() === '') {
    return { valid: true }
  }

  try {
    const parsed = JSON.parse(modelMapping)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        valid: false,
        error: 'Model mapping must be a valid JSON object',
      }
    }
    if (Object.values(parsed).some((value) => typeof value !== 'string')) {
      return {
        valid: false,
        error: 'Model mapping values must be strings',
      }
    }
    return { valid: true }
  } catch {
    return {
      valid: false,
      error: 'Model mapping must be valid JSON format',
    }
  }
}

/**
 * Categorize models into different sets for UI display
 */
export function categorizeModelsWithRedirect(
  currentModels: string[],
  redirectModels: string[]
): {
  normalizedCurrentModels: Set<string>
  normalizedRedirectModels: Set<string>
  classificationSet: Set<string>
  redirectOnlySet: Set<string>
} {
  const normalizedCurrentModels = new Set(
    currentModels.map((m) => normalizeModelName(m)).filter(Boolean)
  )

  const normalizedRedirectModels = new Set(
    redirectModels.map((m) => normalizeModelName(m)).filter(Boolean)
  )

  const classificationSet = new Set([
    ...normalizedCurrentModels,
    ...normalizedRedirectModels,
  ])

  const redirectOnlySet = new Set(
    [...normalizedRedirectModels].filter((m) => !normalizedCurrentModels.has(m))
  )

  return {
    normalizedCurrentModels,
    normalizedRedirectModels,
    classificationSet,
    redirectOnlySet,
  }
}
