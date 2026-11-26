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
  transformUpstreamFormToPayload,
  upstreamTaskToFormDefaults,
} from '../upstream-monitor-form'

const task: UpstreamMonitorTask = {
  id: 1,
  name: 'Relay',
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
    expect(payload.api_key).toBeUndefined()
  })
})
