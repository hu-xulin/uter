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
 * Normalize an applied model selection so a redirected upstream name never
 * sits in the channel list next to the request alias that already represents
 * it. Keeping both exposes the vendor-specific name through `/v1/models` and
 * makes the same model occupy two slots.
 *
 * The "配置模型" dialog applies a fresh, complete selection (unlike the
 * upstream "select all" merge), so removing the raw name alone could drop a
 * model the operator meant to keep. When only the upstream name is picked we
 * publish its alias instead; when both are picked the alias wins. A malformed
 * mapping leaves the selection untouched, matching the conservative fallback
 * used elsewhere in this module.
 */
export function normalizeSelectedModelsForRedirect(
  selectedModels: string[],
  modelMapping: string
): string[] {
  if (!modelMapping?.trim()) return [...selectedModels]

  let parsed: unknown
  try {
    parsed = JSON.parse(modelMapping)
  } catch {
    return [...selectedModels]
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return [...selectedModels]
  }
  if (Object.values(parsed).some((value) => typeof value !== 'string')) {
    return [...selectedModels]
  }
  const mapping = parsed as Record<string, string>

  const aliasesByTarget = new Map<string, string[]>()
  for (const [rawSource, rawTarget] of Object.entries(mapping)) {
    const source = rawSource.trim()
    const target = rawTarget.trim()
    if (!source || !target || source === target) continue
    const aliases = aliasesByTarget.get(target) ?? []
    if (!aliases.includes(source)) aliases.push(source)
    aliasesByTarget.set(target, aliases)
  }
  if (aliasesByTarget.size === 0) return [...selectedModels]

  const selected = new Set(
    selectedModels.map((model) => model.trim()).filter(Boolean)
  )
  const normalized: string[] = []
  const handled = new Set<string>()
  for (const model of selectedModels) {
    const name = model.trim()
    if (!name || handled.has(name)) continue
    const aliases = aliasesByTarget.get(name)
    if (!aliases?.length) {
      handled.add(name)
      normalized.push(name)
      continue
    }
    handled.add(name)
    // The alias is already selected: the upstream name is redundant.
    if (aliases.some((alias) => selected.has(alias))) continue
    // Only the upstream name was selected: publish its alias so the model is
    // still served under the friendly request name.
    const replacement = aliases.find((alias) => !handled.has(alias))
    if (!replacement) continue
    handled.add(replacement)
    normalized.push(replacement)
  }
  return normalized
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
 * Canonical identity a model bills under, independent of which way its
 * redirect mapping is written.
 *
 * model_mapping may be authored in either direction:
 *   { "claude-x-xc0": "claude-x" }  (alias -> upstream, "create aliases")
 *   { "claude-x": "claude-x-xc0" }  (upstream -> alias, "change upstream name")
 * Both describe the same billable model. `resolveMappingTargetChain` only
 * follows keys to values, so matching code that assumes one direction reports
 * the other as `(missing)`. This helper treats every mapping pair as an
 * undirected edge and resolves the whole connected component to a stable
 * representative, so any member (alias or upstream) normalizes to the same
 * identity regardless of direction, chain length or entry order.
 *
 * A cycle or self-map is not authoritative; it resolves to the name itself so
 * a broken mapping can never invent a match. Names are trimmed so whitespace
 * in a hand-edited mapping cannot split one identity into two.
 */
export function resolveBillingIdentity(
  name: string,
  mapping: Record<string, string> | null
): string {
  const start = name.trim()
  if (!start || !mapping) return start

  const neighbours = new Map<string, Set<string>>()
  const link = (a: string, b: string) => {
    if (!a || !b || a === b) return
    let set = neighbours.get(a)
    if (!set) neighbours.set(a, (set = new Set()))
    set.add(b)
  }
  for (const [rawFrom, rawTo] of Object.entries(mapping)) {
    if (typeof rawTo !== 'string') continue
    const from = rawFrom.trim()
    const to = rawTo.trim()
    link(from, to)
    link(to, from)
  }

  // Walk the whole component. Collect its members instead of returning the
  // first chain tail: a component may be entered from any side or chain node.
  const component = new Set<string>()
  const queue = [start]
  while (queue.length > 0) {
    const current = queue.shift() as string
    if (component.has(current)) continue
    component.add(current)
    for (const next of neighbours.get(current) ?? []) {
      if (!component.has(next)) queue.push(next)
    }
  }
  if (component.size <= 1) return start

  // Fail closed on cycles. A two-way authored mapping is a single edge and is
  // fine; a cycle (a->b->a) has no authoritative tail. Walking the directed
  // chain from every member must terminate — if any does not, treat the whole
  // component as broken and keep the literal name instead of inventing a
  // match.
  for (const member of component) {
    const seen = new Set<string>()
    let current = member
    while (current && typeof mapping[current] === 'string') {
      if (seen.has(current)) return start
      seen.add(current)
      current = mapping[current].trim()
    }
  }

  // A stable representative: the lexicographically smallest member. Every
  // alias and upstream name in this component resolves to the same value,
  // independent of mapping direction or JSON key order.
  let representative = start
  for (const member of component) {
    if (member < representative) representative = member
  }
  return representative
}

/**
 * Normalize a redirect mapping into canonical `{ requestName: upstreamName }`
 * pairs, accepting either authored direction. The channel's model list is the
 * authority on which side is the request name users actually call: of each
 * mapping pair, the member published in `requestNames` (and only that member)
 * is the request name. Pairs with neither or both members published are
 * ambiguous and skipped rather than guessed.
 */
export function canonicalRedirectPairs(
  mapping: Record<string, string>,
  requestNames: readonly string[]
): Array<{ request: string; upstream: string }> {
  const published = new Set(
    requestNames.map((name) => name.trim()).filter(Boolean)
  )
  const pairs: Array<{ request: string; upstream: string }> = []
  for (const [rawFrom, rawTo] of Object.entries(mapping)) {
    if (typeof rawTo !== 'string') continue
    const from = rawFrom.trim()
    const to = rawTo.trim()
    if (!from || !to || from === to) continue
    const fromPublished = published.has(from)
    const toPublished = published.has(to)
    if (fromPublished === toPublished) continue
    pairs.push(
      fromPublished
        ? { request: from, upstream: to }
        : { request: to, upstream: from }
    )
  }
  return pairs
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
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    return rows
  const mapping = parsed as Record<string, string>
  if (Object.values(mapping).some((value) => typeof value !== 'string'))
    return rows

  // The selected models are the request names users call. Use them to decide
  // which side of each mapping pair is the alias, so both `{alias:upstream}`
  // and `{upstream:alias}` authoring directions remap the same way.
  const pairs = canonicalRedirectPairs(mapping, selectedModels)
  const aliasesByUpstream = new Map<string, string[]>()
  for (const { request, upstream } of pairs) {
    const aliases = aliasesByUpstream.get(upstream) ?? []
    if (!aliases.includes(request)) aliases.push(request)
    aliasesByUpstream.set(upstream, aliases)
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
 * Restrict saved pricing rows to the request aliases a channel actually
 * publishes. A redirected mapping creates two names for one upstream model;
 * showing both makes the pricing section count 170 models when only 85 are
 * served. Upstream rows are expanded under every published alias, and rows for
 * names with no published alias are omitted so the header and list agree.
 *
 * A missing, malformed or alias-free mapping keeps the original rows so
 * channels without redirects do not lose their pricing view.
 */
export function filterPricingRowsToPublishedAliases<
  T extends {
    model_name: string
    provider?: string
    region?: string
    deployment_id?: string
  },
>(rows: T[], modelMapping: string | undefined, publishedModels: string[]): T[] {
  if (!modelMapping?.trim()) return rows

  let parsed: unknown
  try {
    parsed = JSON.parse(modelMapping)
  } catch {
    return rows
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return rows
  }
  if (Object.values(parsed).some((value) => typeof value !== 'string')) {
    return rows
  }

  const mapping: Record<string, string> = {}
  for (const [rawAlias, rawTarget] of Object.entries(parsed)) {
    const alias = rawAlias.trim()
    const target = rawTarget.trim()
    if (alias && target) mapping[alias] = target
  }

  const published = new Set(
    publishedModels.map((model) => model.trim()).filter(Boolean)
  )
  // publishedModels are the request names users actually call. They decide
  // which member of each mapping pair is the alias, so both authoring
  // directions ({alias:upstream} and {upstream:alias}) behave identically.
  const pairs = canonicalRedirectPairs(mapping, publishedModels)
  if (pairs.length === 0) return rows

  const visibleAliases = published.size
    ? pairs
        .filter((pair) => published.has(pair.request))
        .map((pair) => pair.request)
    : pairs.map((pair) => pair.request)

  const visibleAliasSet = new Set(visibleAliases)
  const visibleAliasesByUpstream = new Map<string, string[]>()
  for (const alias of visibleAliases) {
    const pair = pairs.find((item) => item.request === alias)
    if (!pair) continue
    const aliases = visibleAliasesByUpstream.get(pair.upstream) ?? []
    if (!aliases.includes(alias)) aliases.push(alias)
    visibleAliasesByUpstream.set(pair.upstream, aliases)
  }

  const seen = new Set<string>()
  const visible: T[] = []
  const add = (row: T, modelName: string) => {
    const identity = [
      modelName,
      row.provider ?? '',
      row.region ?? '',
      row.deployment_id ?? '',
    ].join('\u0000')
    if (seen.has(identity)) return
    seen.add(identity)
    visible.push({ ...row, model_name: modelName })
  }

  for (const row of rows) {
    const name = row.model_name.trim()
    const aliases = visibleAliasesByUpstream.get(name)
    if (aliases?.length) {
      for (const alias of aliases) add(row, alias)
      continue
    }
    if (visibleAliasSet.has(name)) add(row, name)
  }
  return visible
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
