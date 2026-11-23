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
import { describe, expect, test, vi } from 'vitest'

import {
  runChannelAutoProvision,
  type AutoProvisionDeps,
} from '../channel-auto-provision'

function deps(overrides: Partial<AutoProvisionDeps> = {}): AutoProvisionDeps {
  return {
    createDraft: overrides.createDraft ?? vi.fn(async () => 41),
    syncPrices:
      overrides.syncPrices ??
      vi.fn(async () => ({
        channel_id: 41,
        written: 13,
        models: ['claude-sonnet-5'],
        models_added: 13,
      })),
    getReconciliation:
      overrides.getReconciliation ??
      vi.fn(async () => ({ status: 'RULES_PASSED' })),
    onPricesStarted: overrides.onPricesStarted ?? vi.fn(),
  }
}

describe('runChannelAutoProvision', () => {
  test('creates the draft, syncs prices, and passes verification when rules pass', async () => {
    const input = deps({})
    const result = await runChannelAutoProvision(input)

    expect(result).toEqual({
      channelId: 41,
      written: 13,
      verification: 'passed',
    })
    expect(
      vi.mocked(input.onPricesStarted).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(input.createDraft).mock.invocationCallOrder[0])
    expect(input.syncPrices).toHaveBeenCalledWith(41)
    expect(input.getReconciliation).toHaveBeenCalledWith(41)
  })

  test('labels a synced channel as needing review when price rules do not pass', async () => {
    const input = deps({
      getReconciliation: vi.fn(async () => ({ status: 'RULES_FAILED' })),
    })
    const result = await runChannelAutoProvision(input)

    expect(result.verification).toBe('attention')
    expect(result.written).toBe(13)
  })

  test('keeps a successful sync when the reconciliation report is unavailable', async () => {
    const input = deps({
      getReconciliation: vi.fn(async () => {
        throw new Error('report unavailable')
      }),
    })
    const result = await runChannelAutoProvision(input)

    expect(result.verification).toBe('attention')
    expect(result.channelId).toBe(41)
  })

  test('propagates a price sync failure instead of reporting success', async () => {
    const input = deps({
      syncPrices: vi.fn(async () => {
        throw new Error('upstream rejected the key')
      }),
    })

    await expect(runChannelAutoProvision(input)).rejects.toThrow(
      'upstream rejected the key'
    )
    expect(input.getReconciliation).not.toHaveBeenCalled()
  })
})
