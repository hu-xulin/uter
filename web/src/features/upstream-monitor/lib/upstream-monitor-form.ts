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
import { z } from 'zod'

import type {
  UpstreamMonitorFormValues,
  UpstreamMonitorTask,
  UpstreamMonitorTaskPayload,
} from '../types'

type UpstreamMonitorTranslate = (
  key: string,
  options?: Record<string, unknown>
) => string

export function createUpstreamMonitorFormSchema(t: UpstreamMonitorTranslate) {
  return z
    .object({
      name: z.string().trim().min(1).max(128),
      // A monitor references a channel from channel management. Legacy tasks
      // (channel_id null) keep their embedded endpoint for editing only.
      channel_id: z.number().int().positive().nullable(),
      channel_group: z.string().trim().max(64),
      channel_key_index: z.number().int().min(0),
      base_url: z.string().trim().max(512),
      api_key: z.string().trim(),
      models: z
        .array(z.string().trim().min(1).max(256))
        .min(1, t('Please select at least one model')),
      protocol: z.enum(['openai', 'anthropic']),
      check_interval_minute: z.number().int().min(1).max(10080),
      probe_depth: z.enum(['quick', 'standard', 'full']),
      enabled: z.boolean(),
    })
    .refine(
      (values) =>
        values.channel_id !== null || values.base_url.trim().length > 0,
      {
        message: t('Please select a channel'),
        path: ['channel_id'],
      }
    )
}

type UpstreamMonitorSchema = ReturnType<typeof createUpstreamMonitorFormSchema>

export type UpstreamMonitorFormInput = z.input<UpstreamMonitorSchema>

export const UPSTREAM_MONITOR_FORM_DEFAULTS: UpstreamMonitorFormValues = {
  name: '',
  channel_id: null,
  channel_group: '',
  channel_key_index: 0,
  base_url: '',
  api_key: '',
  models: [],
  protocol: 'openai',
  check_interval_minute: 30,
  probe_depth: 'standard',
  enabled: true,
}

function taskModels(task: UpstreamMonitorTask): string[] {
  if (task.models && task.models.length > 0) return task.models
  if (task.model) return [task.model]
  return []
}

export function upstreamTaskToFormDefaults(
  task: UpstreamMonitorTask
): UpstreamMonitorFormValues {
  return {
    name: task.name,
    channel_id: task.channel_id > 0 ? task.channel_id : null,
    channel_group: task.channel_group ?? '',
    channel_key_index: task.channel_key_index ?? 0,
    base_url: task.base_url,
    api_key: '',
    models: taskModels(task),
    protocol: task.protocol,
    check_interval_minute: task.check_interval_minute,
    probe_depth: task.probe_depth,
    enabled: task.enabled,
  }
}

export function transformUpstreamFormToPayload(
  values: UpstreamMonitorFormValues,
  isUpdate: boolean
): UpstreamMonitorTaskPayload {
  const payload: UpstreamMonitorTaskPayload = {
    name: values.name,
    channel_group: values.channel_group,
    channel_key_index: values.channel_key_index,
    model: values.models[0],
    models: values.models,
    protocol: values.protocol,
    check_interval_minute: values.check_interval_minute,
    probe_depth: values.probe_depth,
    enabled: values.enabled,
  }
  if (values.channel_id !== null) {
    payload.channel_id = values.channel_id
  } else {
    // Legacy endpoint path kept for editing tasks created before channels
    // were referenced.
    payload.base_url = values.base_url
    payload.api_key = values.api_key.trim()
  }
  if (isUpdate && values.api_key.trim() !== '') {
    payload.api_key = values.api_key.trim()
  }
  return payload
}
