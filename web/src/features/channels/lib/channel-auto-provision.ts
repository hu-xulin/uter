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
import type { ChannelUpstreamPriceSync } from '../api'

export type AutoProvisionVerification = 'passed' | 'attention'

export type AutoProvisionResult = {
  channelId: number
  written: number
  verification: AutoProvisionVerification
}

export type AutoProvisionDeps = {
  createDraft: () => Promise<number>
  syncPrices: (channelId: number) => Promise<ChannelUpstreamPriceSync>
  getReconciliation: (channelId: number) => Promise<{ status: string } | null>
  onPricesStarted: () => void
}

// The draft is created disabled, prices are synced from upstream, and the
// reconciliation status decides whether the price rules passed. A missing
// reconciliation report must not turn a successful sync into a failure.
export async function runChannelAutoProvision(
  deps: AutoProvisionDeps
): Promise<AutoProvisionResult> {
  deps.onPricesStarted()
  const channelId = await deps.createDraft()
  const synced = await deps.syncPrices(channelId)
  const report = await deps.getReconciliation(channelId).catch(() => null)
  return {
    channelId,
    written: synced.written,
    verification: report?.status === 'RULES_PASSED' ? 'passed' : 'attention',
  }
}
