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
 */
export function summarizeSelectedPricingReadiness(
  records: ChannelModelPricingRecord[],
  selectedModels: string[]
): SelectedPricingReadiness {
  const wanted = new Set<string>()
  for (const name of selectedModels) {
    const trimmed = name.trim()
    if (trimmed) wanted.add(trimmed)
  }

  // Duplicate rows per model are possible (one per provider identity). The
  // worst status wins, so a review-only duplicate cannot hide behind a
  // configured row the way it would on the server.
  const byModel = new Map<string, string>()
  for (const record of records) {
    const name = record.model_name.trim()
    if (!wanted.has(name)) continue
    const previous = byModel.get(name)
    if (previous == null || isConfigured(previous)) {
      byModel.set(name, record.pricing_status)
    }
  }

  const blocking: string[] = []
  const missing: string[] = []
  let configured = 0
  for (const name of wanted) {
    const status = byModel.get(name)
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
