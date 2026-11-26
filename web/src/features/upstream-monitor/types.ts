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
export type UpstreamProtocol = 'openai' | 'anthropic'
export type UpstreamDepth = 'quick' | 'standard' | 'full'
export type UpstreamVerdict = 'pass' | 'marginal' | 'fail' | 'error' | 'unknown'

export type UpstreamMonitorTask = {
  id: number
  name: string
  base_url: string
  api_key_fingerprint: string
  model: string
  models: string[]
  protocol: UpstreamProtocol
  check_interval_minute: number
  probe_depth: UpstreamDepth
  enabled: boolean
  status: UpstreamVerdict
  last_score: number
  last_verdict: UpstreamVerdict
  last_run_at: number
  created_at: number
  updated_at: number
}

export type UpstreamDimension = {
  key: string
  label: string
  score: number
  weight: number
  summary: string
  findings: string[]
}

export type UpstreamProbe = {
  key: string
  label: string
  passed: boolean
  skipped: boolean
  detail: string
}

export type UpstreamMetrics = {
  http_status: number
  models_endpoint_ok: boolean
  model_advertised: boolean
  stream_supported: boolean
  ttft_ms: number
  tpot_ms: number
  tps: number
  duration_ms: number
  reported_prompt_tokens: number
  reported_completion_tokens: number
  estimated_completion_tokens: number
  token_inflation_ratio: number
  finish_reason: string
  injection_resisted: boolean
  consistent: boolean
}

export type UpstreamMonitorReport = {
  id: number
  task_id: number
  model: string
  run_id: string
  score: number
  verdict: UpstreamVerdict
  dimensions: UpstreamDimension[]
  metrics: UpstreamMetrics
  probes: UpstreamProbe[]
  error: string
  created_at: number
}

export type UpstreamMonitorRunResult = {
  score: number
  verdict: UpstreamVerdict
  dimensions: UpstreamDimension[]
  metrics: UpstreamMetrics
  probes: UpstreamProbe[]
  hard_gates: string[]
  error: string
}

export type UpstreamMonitorModelRun = {
  model: string
  result: UpstreamMonitorRunResult | null
  error: string
}

export type UpstreamMonitorRunSummary = {
  task_id: number
  score: number
  verdict: UpstreamVerdict
  models: UpstreamMonitorModelRun[]
}

export type UpstreamModelDiscovery = {
  models: string[]
}

export type UpstreamModelsRequest = {
  base_url: string
  api_key?: string
  protocol: UpstreamProtocol
  task_id?: number
}

export type UpstreamMonitorFormValues = {
  name: string
  base_url: string
  api_key: string
  models: string[]
  protocol: UpstreamProtocol
  check_interval_minute: number
  probe_depth: UpstreamDepth
  enabled: boolean
}

export type UpstreamMonitorTaskPayload = Omit<
  UpstreamMonitorFormValues,
  'api_key'
> & {
  api_key?: string
  model?: string
}

export type ApiResponse<T> = {
  success: boolean
  message?: string
  data: T
}
