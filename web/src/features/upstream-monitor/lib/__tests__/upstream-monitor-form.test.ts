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
import { describe, expect, it } from 'vitest'

import type { UpstreamMonitorTask } from '../../types'
import {
  createUpstreamMonitorFormSchema,
  transformUpstreamFormToPayload,
  upstreamTaskToFormDefaults,
  UPSTREAM_MONITOR_FORM_DEFAULTS,
} from '../upstream-monitor-form'

const task: UpstreamMonitorTask = {
  id: 1,
  name: 'Relay',
  channel_id: 0,
  channel_name: '',
  channel_group: '',
  channel_key_index: 0,
  base_url: 'https://api.example.com/v1',
  api_key_fingerprint: 'abc123',
  model: 'first-model',
  models: ['first-model', 'second-model'],
  protocol: 'openai',
  check_interval_minute: 30,
  probe_depth: 'standard',
  enabled: true,
  status: 'unknown',
  last_score: 0,
  last_verdict: 'unknown',
  last_run_at: 0,
  created_at: 0,
  updated_at: 0,
}

describe('upstream monitor form helpers', () => {
  it('keeps every fetched model in form defaults', () => {
    expect(upstreamTaskToFormDefaults(task).models).toEqual([
      'first-model',
      'second-model',
    ])
  })

  it('falls back to the legacy single-model column', () => {
    expect(upstreamTaskToFormDefaults({ ...task, models: [] }).models).toEqual([
      'first-model',
    ])
  })

  it('sends models plus the legacy primary model', () => {
    const values = upstreamTaskToFormDefaults(task)
    const payload = transformUpstreamFormToPayload(values, true)
    expect(payload.models).toEqual(['first-model', 'second-model'])
    expect(payload.model).toBe('first-model')
    // Legacy tasks keep their embedded endpoint when edited.
    expect(payload.base_url).toBe('https://api.example.com/v1')
    expect(payload.api_key).toBe('')
  })

  it('references a channel instead of embedding credentials', () => {
    const values = {
      ...upstreamTaskToFormDefaults(task),
      channel_id: 42,
      channel_group: 'default',
      channel_key_index: 2,
      base_url: 'https://channel.example.com/v1',
      models: ['channel-model'],
    }
    const payload = transformUpstreamFormToPayload(values, false)
    expect(payload.channel_id).toBe(42)
    expect(payload.channel_group).toBe('default')
    expect(payload.channel_key_index).toBe(2)
    expect(payload.models).toEqual(['channel-model'])
    expect(payload.base_url).toBeUndefined()
    expect(payload.api_key).toBeUndefined()
  })

  it('allows a manual endpoint with no channel reference', () => {
    const schema = createUpstreamMonitorFormSchema((key) => key)
    const manual = {
      ...UPSTREAM_MONITOR_FORM_DEFAULTS,
      name: 'Manual relay',
      base_url: 'https://manual.example.com/v1',
      api_key: 'sk-manual',
      models: ['m1'],
    }
    expect(schema.safeParse(manual).success).toBe(true)

    const withoutEndpoint = {
      ...manual,
      base_url: '',
      channel_id: null,
    }
    expect(schema.safeParse(withoutEndpoint).success).toBe(false)

    // A channel-backed task does not require an embedded base URL.
    const channelBacked = {
      ...UPSTREAM_MONITOR_FORM_DEFAULTS,
      name: 'Channel relay',
      channel_id: 7,
      models: ['m1'],
    }
    expect(schema.safeParse(channelBacked).success).toBe(true)
  })

  it('keeps a manual endpoint embedded in the update payload', () => {
    const values = {
      ...upstreamTaskToFormDefaults(task),
      channel_id: null,
      base_url: 'https://manual.example.com/v1',
      api_key: 'sk-rotated',
      models: ['m1'],
    }
    const payload = transformUpstreamFormToPayload(values, true)
    expect(payload.channel_id).toBeUndefined()
    expect(payload.base_url).toBe('https://manual.example.com/v1')
    expect(payload.api_key).toBe('sk-rotated')
  })
})
