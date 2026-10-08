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

// 降本优化（Cost Optimization）字段定义。
// 独立成文件是为了满足 react(only-export-components)：组件文件只导出组件，
// 常量与类型放这里，避免破坏 Fast Refresh。
export type FieldKind = 'bool' | 'number' | 'text' | 'json' | 'select'

export type FieldDef = {
  /** 完整 option key（含 costopt_setting. 前缀） */
  name: string
  kind: FieldKind
  /** i18n key：按项目约定「key 即英文原文」，此处存可读英文 */
  label: string
  /** 该字段依赖的开关（开关关闭时禁用输入） */
  gated?: string
  options?: Array<{ value: string; label: string }>
}

// 分组：每组一个标题 + 字段清单
export const GROUPS: Array<{ title: string; desc: string; fields: FieldDef[] }> = [
  {
    title: 'Core cost optimization (implemented)',
    // 这些项是 V2 已落地、纯代码完成、无需外部基建的特性；
    // 此前没有 UI，只能靠改 Options 表默认值打开。这里把它们显式暴露出来。
    // 全部默认关闭，开启即生效，不会影响主链路。
    desc: 'These items ship in V2 and are fully coded with no external dependency. They are off by default and take effect the moment you enable them.',
    fields: [
      { name: 'costopt_setting.response_cache_enabled', kind: 'bool', label: 'Enable response cache' },
      { name: 'costopt_setting.response_cache_ttl_seconds', kind: 'number', label: 'Response cache TTL in seconds', gated: 'costopt_setting.response_cache_enabled' },
      { name: 'costopt_setting.response_cache_max_tokens', kind: 'number', label: 'Response cache maximum tokens', gated: 'costopt_setting.response_cache_enabled' },
      { name: 'costopt_setting.negative_cache_enabled', kind: 'bool', label: 'Enable negative cache' },
      { name: 'costopt_setting.negative_cache_ttl_seconds', kind: 'number', label: 'Negative cache TTL in seconds', gated: 'costopt_setting.negative_cache_enabled' },
      { name: 'costopt_setting.max_tokens_cap_enabled', kind: 'bool', label: 'Enable max tokens cap' },
      { name: 'costopt_setting.max_tokens_cap_global', kind: 'number', label: 'Global max tokens cap', gated: 'costopt_setting.max_tokens_cap_enabled' },
      { name: 'costopt_setting.loop_detection_enabled', kind: 'bool', label: 'Enable loop detection' },
      { name: 'costopt_setting.loop_detection_threshold', kind: 'number', label: 'Loop detection threshold', gated: 'costopt_setting.loop_detection_enabled' },
      { name: 'costopt_setting.agent_step_budget_enabled', kind: 'bool', label: 'Enable agent step budget' },
      { name: 'costopt_setting.agent_step_budget_max_steps', kind: 'number', label: 'Maximum agent steps', gated: 'costopt_setting.agent_step_budget_enabled' },
      { name: 'costopt_setting.agent_step_budget_max_tokens', kind: 'number', label: 'Maximum agent tokens', gated: 'costopt_setting.agent_step_budget_enabled' },
      { name: 'costopt_setting.metrics_enabled', kind: 'bool', label: 'Enable cost optimization metrics' },
      { name: 'costopt_setting.anomaly_alert_enabled', kind: 'bool', label: 'Enable anomaly alert' },
      { name: 'costopt_setting.gzip_enabled', kind: 'bool', label: 'Enable response gzip compression' },
      { name: 'costopt_setting.cascade_enabled', kind: 'bool', label: 'Enable cascade cheap-to-premium' },
      { name: 'costopt_setting.cascade_cheap_model', kind: 'text', label: 'Cascade cheap model', gated: 'costopt_setting.cascade_enabled' },
      { name: 'costopt_setting.cascade_premium_model', kind: 'text', label: 'Cascade premium model', gated: 'costopt_setting.cascade_enabled' },
      { name: 'costopt_setting.cascade_refusal_keywords', kind: 'json', label: 'Cascade refusal keywords', gated: 'costopt_setting.cascade_enabled' },
      { name: 'costopt_setting.semantic_cache_enabled', kind: 'bool', label: 'Enable semantic cache' },
      { name: 'costopt_setting.semantic_cache_ttl_seconds', kind: 'number', label: 'Semantic cache TTL in seconds', gated: 'costopt_setting.semantic_cache_enabled' },
      { name: 'costopt_setting.semantic_cache_embed_base_url', kind: 'text', label: 'Embedding API base URL', gated: 'costopt_setting.semantic_cache_enabled' },
      { name: 'costopt_setting.semantic_cache_embed_api_key', kind: 'text', label: 'Embedding API key', gated: 'costopt_setting.semantic_cache_enabled' },
      { name: 'costopt_setting.semantic_cache_embed_model', kind: 'text', label: 'Embedding model', gated: 'costopt_setting.semantic_cache_enabled' },
      { name: 'costopt_setting.semantic_cache_top_k', kind: 'number', label: 'Semantic cache top K', gated: 'costopt_setting.semantic_cache_enabled' },
      { name: 'costopt_setting.semantic_cache_score_threshold', kind: 'number', label: 'Semantic cache score threshold', gated: 'costopt_setting.semantic_cache_enabled' },
    ],
  },
  {
    title: 'Vendor arbitrage and cross-channel price comparison',
    desc: 'Automatically pick the cheapest equivalent vendor for the same model. Prices are per 1M input tokens in USD.',
    fields: [
      {
        name: 'costopt_setting.arbitrage_mode',
        kind: 'select',
        label: 'Mode',
        options: [
          { value: 'auto', label: 'auto' },
          { value: 'manual', label: 'manual' },
          { value: 'off', label: 'off' },
        ],
      },
      {
        name: 'costopt_setting.arbitrage_price_source',
        kind: 'select',
        label: 'Price source',
        options: [
          { value: 'ratio_config', label: 'ratio_config' },
          { value: 'manual', label: 'manual' },
        ],
        gated: 'costopt_setting.arbitrage_mode',
      },
      { name: 'costopt_setting.arbitrage_model_prices', kind: 'json', label: 'Model price table', gated: 'costopt_setting.arbitrage_mode' },
      { name: 'costopt_setting.arbitrage_prefer_same_model_only', kind: 'bool', label: 'Compare only across channels of the same model', gated: 'costopt_setting.arbitrage_mode' },
      { name: 'costopt_setting.arbitrage_max_price_ratio', kind: 'number', label: 'Maximum price ratio', gated: 'costopt_setting.arbitrage_mode' },
      { name: 'costopt_setting.arbitrage_auto_max_price_ratio', kind: 'number', label: 'Auto price tolerance ratio', gated: 'costopt_setting.arbitrage_mode' },
      { name: 'costopt_setting.arbitrage_fallback_model', kind: 'text', label: 'Fallback model', gated: 'costopt_setting.arbitrage_mode' },
    ],
  },
  {
    title: 'Serverless value tier',
    desc: 'Route bulk traffic to cheap open-source endpoints such as Groq, Fireworks or DeepInfra.',
    fields: [
      {
        name: 'costopt_setting.value_tier_mode',
        kind: 'select',
        label: 'Mode',
        options: [
          { value: 'auto', label: 'auto' },
          { value: 'manual', label: 'manual' },
          { value: 'off', label: 'off' },
        ],
      },
      { name: 'costopt_setting.value_tier_model_equivalents', kind: 'json', label: 'Equivalent open-source models', gated: 'costopt_setting.value_tier_mode' },
      { name: 'costopt_setting.value_tier_auto_detect_bulk', kind: 'bool', label: 'Auto detect bulk traffic', gated: 'costopt_setting.value_tier_mode' },
      { name: 'costopt_setting.value_tier_channel_types', kind: 'json', label: 'Value tier channel types', gated: 'costopt_setting.value_tier_mode' },
      { name: 'costopt_setting.value_tier_models', kind: 'json', label: 'Value tier models', gated: 'costopt_setting.value_tier_mode' },
      { name: 'costopt_setting.value_tier_bulk_only', kind: 'bool', label: 'Bulk traffic only', gated: 'costopt_setting.value_tier_mode' },
      { name: 'costopt_setting.value_tier_min_prompt_chars', kind: 'number', label: 'Minimum prompt characters', gated: 'costopt_setting.value_tier_mode' },
      { name: 'costopt_setting.value_tier_vendor_base_url', kind: 'text', label: 'Vendor API base URL', gated: 'costopt_setting.value_tier_mode' },
      { name: 'costopt_setting.value_tier_vendor_api_key', kind: 'text', label: 'Vendor API key', gated: 'costopt_setting.value_tier_mode' },
    ],
  },
  {
    title: 'A-tier and value tier split',
    desc: 'User-facing requests keep premium models; background jobs fall back to a cheaper model.',
    fields: [
      {
        name: 'costopt_setting.tier_split_mode',
        kind: 'select',
        label: 'Mode',
        options: [
          { value: 'auto', label: 'auto' },
          { value: 'manual', label: 'manual' },
          { value: 'off', label: 'off' },
        ],
      },
      { name: 'costopt_setting.tier_split_auto_detect', kind: 'bool', label: 'Auto detect background traffic', gated: 'costopt_setting.tier_split_mode' },
      { name: 'costopt_setting.tier_split_visible_models', kind: 'json', label: 'User-facing models to keep', gated: 'costopt_setting.tier_split_mode' },
      { name: 'costopt_setting.tier_split_background_tags', kind: 'json', label: 'Background request tags', gated: 'costopt_setting.tier_split_mode' },
      { name: 'costopt_setting.tier_split_background_model', kind: 'text', label: 'Background model', gated: 'costopt_setting.tier_split_mode' },
      { name: 'costopt_setting.tier_split_non_stream_as_background', kind: 'bool', label: 'Treat non-streaming requests as background', gated: 'costopt_setting.tier_split_mode' },
    ],
  },
  {
    title: 'Precise RAG',
    desc: 'Requires an external RAG service. Fill in the endpoint to turn the hook into real retrieval with tight top-k.',
    fields: [
      { name: 'costopt_setting.rag_enabled', kind: 'bool', label: 'Enable precise RAG' },
      { name: 'costopt_setting.rag_endpoint', kind: 'text', label: 'RAG endpoint', gated: 'costopt_setting.rag_enabled' },
      { name: 'costopt_setting.rag_api_key', kind: 'text', label: 'RAG API key', gated: 'costopt_setting.rag_enabled' },
      { name: 'costopt_setting.rag_top_k', kind: 'number', label: 'Top K', gated: 'costopt_setting.rag_enabled' },
      { name: 'costopt_setting.rag_score_threshold', kind: 'number', label: 'Score threshold', gated: 'costopt_setting.rag_enabled' },
      { name: 'costopt_setting.rag_rerank_enabled', kind: 'bool', label: 'Enable rerank', gated: 'costopt_setting.rag_enabled' },
      { name: 'costopt_setting.rag_rerank_model', kind: 'text', label: 'Rerank model', gated: 'costopt_setting.rag_enabled' },
      { name: 'costopt_setting.rag_max_context_tokens', kind: 'number', label: 'Maximum context tokens', gated: 'costopt_setting.rag_enabled' },
      { name: 'costopt_setting.rag_timeout_ms', kind: 'number', label: 'Timeout in milliseconds', gated: 'costopt_setting.rag_enabled' },
      {
        name: 'costopt_setting.rag_inject_position',
        kind: 'select',
        label: 'Inject position',
        options: [
          { value: 'system', label: 'system' },
          { value: 'user', label: 'user' },
        ],
        gated: 'costopt_setting.rag_enabled',
      },
      { name: 'costopt_setting.rag_query_from_last_n', kind: 'number', label: 'Build query from last N messages', gated: 'costopt_setting.rag_enabled' },
    ],
  },
  {
    title: 'Batch API offload',
    desc: 'Offline traffic is submitted to the upstream Batch API for a flat 50% discount. Requires upstream Batch support.',
    fields: [
      { name: 'costopt_setting.batch_enabled', kind: 'bool', label: 'Enable batch offload' },
      { name: 'costopt_setting.batch_api_base_url', kind: 'text', label: 'Batch API base URL', gated: 'costopt_setting.batch_enabled' },
      { name: 'costopt_setting.batch_api_key', kind: 'text', label: 'Batch API key', gated: 'costopt_setting.batch_enabled' },
      { name: 'costopt_setting.batch_endpoint_path', kind: 'text', label: 'Batch submit path', gated: 'costopt_setting.batch_enabled' },
      { name: 'costopt_setting.batch_result_path', kind: 'text', label: 'Batch result path', gated: 'costopt_setting.batch_enabled' },
      { name: 'costopt_setting.batch_completion_window', kind: 'text', label: 'Completion window', gated: 'costopt_setting.batch_enabled' },
      { name: 'costopt_setting.batch_max_items', kind: 'number', label: 'Maximum items per batch', gated: 'costopt_setting.batch_enabled' },
      { name: 'costopt_setting.batch_flush_interval_seconds', kind: 'number', label: 'Flush interval in seconds', gated: 'costopt_setting.batch_enabled' },
      { name: 'costopt_setting.batch_eligible_models', kind: 'json', label: 'Eligible models', gated: 'costopt_setting.batch_enabled' },
    ],
  },
  {
    title: 'Edge and CDN asset cache',
    desc: 'Offload static assets to a CDN. Fill in the CDN base URL to activate rewriting, cache headers and origin shield.',
    fields: [
      { name: 'costopt_setting.cdn_enabled', kind: 'bool', label: 'Enable CDN offload' },
      { name: 'costopt_setting.cdn_asset_base_url', kind: 'text', label: 'CDN base URL', gated: 'costopt_setting.cdn_enabled' },
      { name: 'costopt_setting.cdn_origin_url', kind: 'text', label: 'Origin URL', gated: 'costopt_setting.cdn_enabled' },
      { name: 'costopt_setting.cdn_cache_ttl_seconds', kind: 'number', label: 'Cache TTL in seconds', gated: 'costopt_setting.cdn_enabled' },
      { name: 'costopt_setting.cdn_path_prefixes', kind: 'json', label: 'Path prefixes', gated: 'costopt_setting.cdn_enabled' },
      { name: 'costopt_setting.cdn_include_query', kind: 'bool', label: 'Include query string in cache key', gated: 'costopt_setting.cdn_enabled' },
      { name: 'costopt_setting.cdn_signing_header', kind: 'text', label: 'Origin shield header', gated: 'costopt_setting.cdn_enabled' },
      { name: 'costopt_setting.cdn_signing_secret', kind: 'text', label: 'Origin shield secret', gated: 'costopt_setting.cdn_enabled' },
    ],
  },
  {
    title: 'Shared prompt prefix',
    desc: 'Pin a stable system prefix to the top so upstream prefix caching hits reliably.',
    fields: [
      { name: 'costopt_setting.shared_prefix_enabled', kind: 'bool', label: 'Enable shared prefix' },
      { name: 'costopt_setting.shared_prefix_templates', kind: 'json', label: 'Prefix templates by model', gated: 'costopt_setting.shared_prefix_enabled' },
      { name: 'costopt_setting.shared_prefix_max_chars', kind: 'number', label: 'Maximum prefix characters', gated: 'costopt_setting.shared_prefix_enabled' },
    ],
  },
  {
    title: 'Structured output constraint',
    desc: 'Enforce output shape at the gateway so models stop over-explaining. Output tokens usually cost 2-5x more than input.',
    fields: [
      { name: 'costopt_setting.structured_output_enabled', kind: 'bool', label: 'Enable structured output constraint' },
      {
        name: 'costopt_setting.structured_output_mode',
        kind: 'select',
        label: 'Constraint mode',
        options: [
          { value: 'json_object', label: 'json_object' },
          { value: 'json_schema', label: 'json_schema' },
          { value: 'stop', label: 'stop' },
        ],
        gated: 'costopt_setting.structured_output_enabled',
      },
      { name: 'costopt_setting.structured_output_stop_sequences', kind: 'json', label: 'Stop sequences', gated: 'costopt_setting.structured_output_enabled' },
      { name: 'costopt_setting.structured_output_max_retries', kind: 'number', label: 'Maximum retries', gated: 'costopt_setting.structured_output_enabled' },
    ],
  },
  {
    title: 'Long task persistence',
    desc: 'Store confirmed facts externally and compress at stage boundaries instead of replaying full history every round.',
    fields: [
      { name: 'costopt_setting.long_task_persist_enabled', kind: 'bool', label: 'Enable long task persistence' },
      { name: 'costopt_setting.long_task_store_endpoint', kind: 'text', label: 'Fact store endpoint', gated: 'costopt_setting.long_task_persist_enabled' },
      { name: 'costopt_setting.long_task_fact_interval', kind: 'number', label: 'Fact extraction interval in rounds', gated: 'costopt_setting.long_task_persist_enabled' },
      { name: 'costopt_setting.long_task_max_facts', kind: 'number', label: 'Maximum facts kept', gated: 'costopt_setting.long_task_persist_enabled' },
    ],
  },
  {
    title: 'Cost per successful task',
    desc: 'Measure cost per successful task instead of per request, so token savings never hide a quality regression.',
    fields: [
      { name: 'costopt_setting.cost_per_success_enabled', kind: 'bool', label: 'Enable cost per successful task' },
      {
        name: 'costopt_setting.cost_per_success_signal',
        kind: 'select',
        label: 'Success signal',
        options: [
          { value: 'no_error', label: 'no_error' },
          { value: 'http_ok', label: 'http_ok' },
          { value: 'json_field', label: 'json_field' },
        ],
        gated: 'costopt_setting.cost_per_success_enabled',
      },
      { name: 'costopt_setting.cost_per_success_field', kind: 'text', label: 'Success field name', gated: 'costopt_setting.cost_per_success_enabled' },
      { name: 'costopt_setting.cost_per_success_expected', kind: 'text', label: 'Expected success value', gated: 'costopt_setting.cost_per_success_enabled' },
    ],
  },
]

export const ALL_FIELDS: FieldDef[] = GROUPS.flatMap((g) => g.fields)

/** 供 section-registry 从 settings 中挑选本区字段用。 */
export const COST_OPTIMIZATION_KEYS: Array<`costopt_setting.${string}`> =
  ALL_FIELDS.map((f) => f.name as `costopt_setting.${string}`)

/** 从完整 option key 取出 zod 嵌套用的子字段名。 */
export const leaf = (name: string) => name.replace(/^costopt_setting\./, '')
