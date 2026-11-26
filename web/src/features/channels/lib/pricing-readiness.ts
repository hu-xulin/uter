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
import type { ChannelModelPricingRecord } from '../types'
import { resolveBillingIdentity } from './model-mapping-validation'

export interface SelectedPricingReadiness {
  /** Number of models the operator selected for this channel. */
  selected: number
  /** Selected models that already have a billable sale price. */
  configured: number
  /**
   * Selected models that have a catalogue row but no billable price yet.
   * These are exactly the models the server refuses to publish
   * (`draftPublishBlockers`), so the UI must not offer to submit them.
   */
  blocking: string[]
  /**
   * Selected models without any catalogue row. The server does not block on
   * them (it only inspects existing rows), but they cannot bill either, so
   * they are reported as pending work.
   */
  missing: string[]
  /** Every selected model that still needs a price: blocking + missing. */
  pending: string[]
}

const MISSING = 'missing'

// A configured row means the model can bill. Any other status (needs_review,
// official_only, ...) has no sale price yet, so the model is not billable and
// publishing would either block on the server or silently under-bill.
function isConfigured(status: string): boolean {
  return status === 'configured'
}

function formatPending(model: string, status: string): string {
  return `${model} (${status})`
}

/**
 * Parse a channel's model_mapping into the plain string map the resolver
 * needs. A malformed mapping is ignored rather than guessed — readiness then
 * falls back to exact-name matching, which is the conservative behavior.
 */
function parseReadinessMapping(
  modelMapping?: string
): Record<string, string> | null {
  if (!modelMapping?.trim()) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(modelMapping)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null
  }
  if (Object.values(parsed).some((value) => typeof value !== 'string')) {
    return null
  }
  return parsed as Record<string, string>
}

/**
 * The identity a name bills under. A redirect alias and its upstream name are
 * the same billable model: the catalogue row may still be keyed by the upstream
 * name while the channel publishes the alias, or vice versa. The mapping can
 * be authored in either direction (see `resolveBillingIdentity`), so both
 * sides are normalized through the undirected component rather than a
 * one-way chain. A broken/self mapping falls back to the trimmed name and can
 * never invent a match.
 */
function billingIdentity(
  name: string,
  mapping: Record<string, string> | null
): string {
  return resolveBillingIdentity(name, mapping)
}

/**
 * Summarize publish readiness for the models the operator actually selected.
 *
 * The draft catalogue sync writes the whole upstream directory, so rows for
 * models the channel never serves are expected and must not be reported here —
 * this mirrors `draftPublishBlockers` on the server, which only inspects
 * `channel.Models`.
 *
 * The server walks rows one by one and blocks on the first row of a selected
 * model that is not `configured`, so a model with one configured and one
 * review-only row is still blocked. This summary keeps the same rule: a
 * model is billable only when every one of its rows is configured.
 *
 * `modelMapping` makes the match redirect-aware: an alias and its upstream
 * name share one billing identity, so a redirected model is not reported as
 * missing when its catalogue row exists under the other name.
 */
/**
 * Keep only upstream models the channel can actually bill. This is the
 * discovery-list counterpart of `summarizeSelectedPricingReadiness`: a model
 * with no price row, an official-only row or a needs-review row must never be
 * offered for selection, otherwise the operator can select a model that every
 * relay call rejects at settlement time.
 *
 * Redirect aliases share a billing identity with their upstream name, so the
 * filter matches the same identity the readiness summary uses.
 */
export function filterModelsWithBillablePrice(
  records: ChannelModelPricingRecord[],
  models: string[],
  modelMapping?: string
): string[] {
  const mapping = parseReadinessMapping(modelMapping)
  const configured = new Set<string>()
  const blocked = new Set<string>()
  for (const record of records) {
    const identity = billingIdentity(record.model_name, mapping)
    if (isConfigured(record.pricing_status)) configured.add(identity)
    else blocked.add(identity)
  }
  for (const identity of blocked) configured.delete(identity)
  return models.filter((model) => {
    const trimmed = model.trim()
    return Boolean(trimmed) && configured.has(billingIdentity(trimmed, mapping))
  })
}

export function summarizeSelectedPricingReadiness(
  records: ChannelModelPricingRecord[],
  selectedModels: string[],
  modelMapping?: string
): SelectedPricingReadiness {
  const mapping = parseReadinessMapping(modelMapping)
  // Keep the original selected name for display, but index rows by the
  // identity they bill under so an alias matches its upstream price row.
  const wanted = new Map<string, string>()
  for (const name of selectedModels) {
    const trimmed = name.trim()
    if (trimmed) wanted.set(trimmed, billingIdentity(trimmed, mapping))
  }

  // Duplicate rows per model are possible (one per provider identity). The
  // worst status wins, so a review-only duplicate cannot hide behind a
  // configured row the way it would on the server. A chain that resolves to
  // the same tail counts as a duplicate of that identity.
  const byModel = new Map<string, string>()
  for (const record of records) {
    const identity = billingIdentity(record.model_name, mapping)
    let matched = false
    for (const wantedIdentity of wanted.values()) {
      if (wantedIdentity === identity) {
        matched = true
        break
      }
    }
    if (!matched) continue
    const previous = byModel.get(identity)
    if (previous == null || isConfigured(previous)) {
      byModel.set(identity, record.pricing_status)
    }
  }

  const blocking: string[] = []
  const missing: string[] = []
  let configured = 0
  for (const [name, identity] of wanted) {
    const status = byModel.get(identity)
    if (status == null) {
      missing.push(formatPending(name, MISSING))
      continue
    }
    if (isConfigured(status)) {
      configured++
      continue
    }
    blocking.push(formatPending(name, status))
  }

  return {
    selected: wanted.size,
    configured,
    blocking,
    missing,
    pending: [...blocking, ...missing],
  }
}
