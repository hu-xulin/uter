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
  /**
   * 占位提示：直接写死的技术字面量（默认值 / 推荐虚拟地址 / 格式示例），
   * 不走 i18n——它不是自然语言，翻译反而会误导（URL、JSON 样例、模型名）。
   * 空输入时作为 placeholder 显示，告诉用户「该填什么、什么格式」。
   */
  placeholder?: string
  /** i18n key：问号按钮点开后展示的说明文字（key 即英文原文） */
  help?: string
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
      {
        name: 'costopt_setting.response_cache_enabled',
        kind: 'bool',
        label: 'Enable response cache',
        help: 'Caches identical responses for a short TTL and replays them for repeat requests, saving tokens on repeated or template prompts.',
      },
      {
        name: 'costopt_setting.response_cache_ttl_seconds',
        kind: 'number',
        label: 'Response cache TTL in seconds',
        gated: 'costopt_setting.response_cache_enabled',
        placeholder: '300',
        help: 'How long a cached response stays reusable, in seconds. A longer TTL saves more but risks staler answers.',
      },
      {
        name: 'costopt_setting.response_cache_max_tokens',
        kind: 'number',
        label: 'Response cache maximum tokens',
        gated: 'costopt_setting.response_cache_enabled',
        placeholder: '4096',
        help: 'Only responses at or below this many tokens are cached; larger ones are streamed through untouched.',
      },
      {
        name: 'costopt_setting.negative_cache_enabled',
        kind: 'bool',
        label: 'Enable negative cache',
        help: 'Caches upstream failures for a short window so repeated broken calls fail instantly instead of retrying the provider.',
      },
      {
        name: 'costopt_setting.negative_cache_ttl_seconds',
        kind: 'number',
        label: 'Negative cache TTL in seconds',
        gated: 'costopt_setting.negative_cache_enabled',
        placeholder: '30',
        help: 'How long an upstream failure is remembered, in seconds. Keep it short so a real recovery is not masked.',
      },
      {
        name: 'costopt_setting.max_tokens_cap_enabled',
        kind: 'bool',
        label: 'Enable max tokens cap',
        help: 'Clamps the max_tokens of every request to a global ceiling, preventing accidental runaway generation cost.',
      },
      {
        name: 'costopt_setting.max_tokens_cap_global',
        kind: 'number',
        label: 'Global max tokens cap',
        gated: 'costopt_setting.max_tokens_cap_enabled',
        placeholder: '8192',
        help: 'The hard ceiling applied to max_tokens on every request while the cap is enabled.',
      },
      {
        name: 'costopt_setting.loop_detection_enabled',
        kind: 'bool',
        label: 'Enable loop detection',
        help: 'Stops runaway agents that repeat the same tool call, returning the repeated result instead of paying for more rounds.',
      },
      {
        name: 'costopt_setting.loop_detection_threshold',
        kind: 'number',
        label: 'Loop detection threshold',
        gated: 'costopt_setting.loop_detection_enabled',
        placeholder: '3',
        help: 'How many identical repeats count as a loop before the request is cut off.',
      },
      {
        name: 'costopt_setting.agent_step_budget_enabled',
        kind: 'bool',
        label: 'Enable agent step budget',
        help: 'Enforces a per-request ceiling on agent steps and tokens so a long-running agent cannot consume unlimited budget.',
      },
      {
        name: 'costopt_setting.agent_step_budget_max_steps',
        kind: 'number',
        label: 'Maximum agent steps',
        gated: 'costopt_setting.agent_step_budget_enabled',
        placeholder: '20',
        help: 'Maximum number of agent steps allowed within a single request.',
      },
      {
        name: 'costopt_setting.agent_step_budget_max_tokens',
        kind: 'number',
        label: 'Maximum agent tokens',
        gated: 'costopt_setting.agent_step_budget_enabled',
        placeholder: '200000',
        help: 'Maximum total tokens an agent may spend within a single request.',
      },
      {
        name: 'costopt_setting.metrics_enabled',
        kind: 'bool',
        label: 'Enable cost optimization metrics',
        help: 'Exposes the cost-optimization metrics endpoint so you can measure real savings before widening the rollout.',
      },
      {
        name: 'costopt_setting.anomaly_alert_enabled',
        kind: 'bool',
        label: 'Enable anomaly alert',
        help: 'Alerts when cost or token usage deviates sharply from the baseline, so a regression is noticed quickly.',
      },
      {
        name: 'costopt_setting.gzip_enabled',
        kind: 'bool',
        label: 'Enable response gzip compression',
        help: 'Compresses response bodies with gzip, cutting bandwidth cost on text-heavy traffic.',
      },
      {
        name: 'costopt_setting.cascade_enabled',
        kind: 'bool',
        label: 'Enable cascade cheap-to-premium',
        help: 'Routes to a cheap model first and upgrades to a premium model only when the cheap one refuses.',
      },
      {
        name: 'costopt_setting.cascade_cheap_model',
        kind: 'text',
        label: 'Cascade cheap model',
        gated: 'costopt_setting.cascade_enabled',
        placeholder: 'gpt-4o-mini',
        help: 'The low-cost model tried first, for example a small or mini model.',
      },
      {
        name: 'costopt_setting.cascade_premium_model',
        kind: 'text',
        label: 'Cascade premium model',
        gated: 'costopt_setting.cascade_enabled',
        placeholder: 'gpt-4o',
        help: 'The stronger model used once the cheap model refuses. It must differ from the cheap model.',
      },
      {
        name: 'costopt_setting.cascade_refusal_keywords',
        kind: 'json',
        label: 'Cascade refusal keywords',
        gated: 'costopt_setting.cascade_enabled',
        placeholder: '["I cannot", "I apologize"]',
        help: 'Keywords that mark a reply as a refusal, such as apology or inability phrases that trigger the upgrade.',
      },
      {
        name: 'costopt_setting.semantic_cache_enabled',
        kind: 'bool',
        label: 'Enable semantic cache',
        help: 'Matches prompts by meaning rather than exact text and reuses a near-identical past answer. Requires an embedding endpoint.',
      },
      {
        name: 'costopt_setting.semantic_cache_ttl_seconds',
        kind: 'number',
        label: 'Semantic cache TTL in seconds',
        gated: 'costopt_setting.semantic_cache_enabled',
        placeholder: '300',
        help: 'How long a semantic match stays reusable, in seconds.',
      },
      {
        name: 'costopt_setting.semantic_cache_embed_base_url',
        kind: 'text',
        label: 'Embedding API base URL',
        gated: 'costopt_setting.semantic_cache_enabled',
        placeholder: 'https://api.openai.com/v1',
        help: 'OpenAI-compatible base URL of the embedding service used to compare prompt meaning.',
      },
      {
        name: 'costopt_setting.semantic_cache_embed_api_key',
        kind: 'text',
        label: 'Embedding API key',
        gated: 'costopt_setting.semantic_cache_enabled',
        placeholder: 'sk-...',
        help: 'API key for the embedding service.',
      },
      {
        name: 'costopt_setting.semantic_cache_embed_model',
        kind: 'text',
        label: 'Embedding model',
        gated: 'costopt_setting.semantic_cache_enabled',
        placeholder: 'text-embedding-3-small',
        help: 'Name of the embedding model, for example a small OpenAI embedding model.',
      },
      {
        name: 'costopt_setting.semantic_cache_top_k',
        kind: 'number',
        label: 'Semantic cache top K',
        gated: 'costopt_setting.semantic_cache_enabled',
        placeholder: '3',
        help: 'How many nearest neighbours to inspect when looking for a reusable answer.',
      },
      {
        name: 'costopt_setting.semantic_cache_score_threshold',
        kind: 'number',
        label: 'Semantic cache score threshold',
        gated: 'costopt_setting.semantic_cache_enabled',
        placeholder: '0.92',
        help: 'Minimum similarity between 0 and 1 required before a cached answer is reused. Higher is safer.',
      },
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
        help: 'auto derives prices from channel model mappings, manual relies only on the fields below, off disables arbitrage.',
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
        help: 'Where unit prices come from: the platform ratio config, or the manual price table below.',
      },
      {
        name: 'costopt_setting.arbitrage_model_prices',
        kind: 'json',
        label: 'Model price table',
        gated: 'costopt_setting.arbitrage_mode',
        placeholder: '{"gpt-4o": 1.5}',
        help: 'Manual price table mapping a model name to its USD price per 1M input tokens.',
      },
      {
        name: 'costopt_setting.arbitrage_prefer_same_model_only',
        kind: 'bool',
        label: 'Compare only across channels of the same model',
        gated: 'costopt_setting.arbitrage_mode',
        help: 'Only compares channels serving the exact same model and never substitutes a different one.',
      },
      {
        name: 'costopt_setting.arbitrage_max_price_ratio',
        kind: 'number',
        label: 'Maximum price ratio',
        gated: 'costopt_setting.arbitrage_mode',
        placeholder: '1.0',
        help: 'Rejects a more expensive channel once it exceeds the reference price by this ratio.',
      },
      {
        name: 'costopt_setting.arbitrage_auto_max_price_ratio',
        kind: 'number',
        label: 'Auto price tolerance ratio',
        gated: 'costopt_setting.arbitrage_mode',
        placeholder: '1.0',
        help: 'Tolerance used by auto mode when comparing derived channel prices. Raise it to allow pricier channels.',
      },
      {
        name: 'costopt_setting.arbitrage_fallback_model',
        kind: 'text',
        label: 'Fallback model',
        gated: 'costopt_setting.arbitrage_mode',
        placeholder: 'gpt-4o-mini',
        help: 'Model to use when no channel satisfies the price constraint.',
      },
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
        help: 'auto detects bulk traffic and routes it, manual applies only the fields below, off disables the tier.',
      },
      {
        name: 'costopt_setting.value_tier_model_equivalents',
        kind: 'json',
        label: 'Equivalent open-source models',
        gated: 'costopt_setting.value_tier_mode',
        placeholder: '{"gpt-4o": ["llama-3.3-70b"]}',
        help: 'Maps a premium model to cheap open-source equivalents that may serve the same request.',
      },
      {
        name: 'costopt_setting.value_tier_auto_detect_bulk',
        kind: 'bool',
        label: 'Auto detect bulk traffic',
        gated: 'costopt_setting.value_tier_mode',
        help: 'Automatically treats long, repetitive prompts as bulk traffic.',
      },
      {
        name: 'costopt_setting.value_tier_channel_types',
        kind: 'json',
        label: 'Value tier channel types',
        gated: 'costopt_setting.value_tier_mode',
        placeholder: '[8, 14]',
        help: 'Channel type IDs eligible for the value tier, such as Groq, Fireworks or DeepInfra.',
      },
      {
        name: 'costopt_setting.value_tier_models',
        kind: 'json',
        label: 'Value tier models',
        gated: 'costopt_setting.value_tier_mode',
        placeholder: '["llama-3.3-70b"]',
        help: 'Models allowed on the cheap tier. Leave empty to use the equivalent mapping instead.',
      },
      {
        name: 'costopt_setting.value_tier_bulk_only',
        kind: 'bool',
        label: 'Bulk traffic only',
        gated: 'costopt_setting.value_tier_mode',
        help: 'Reroutes bulk traffic only, keeping interactive requests on premium models.',
      },
      {
        name: 'costopt_setting.value_tier_min_prompt_chars',
        kind: 'number',
        label: 'Minimum prompt characters',
        gated: 'costopt_setting.value_tier_mode',
        placeholder: '2000',
        help: 'Prompt length at or above which traffic is considered bulk.',
      },
      {
        name: 'costopt_setting.value_tier_vendor_base_url',
        kind: 'text',
        label: 'Vendor API base URL',
        gated: 'costopt_setting.value_tier_mode',
        placeholder: 'https://api.groq.com/openai/v1',
        help: 'OpenAI-compatible base URL of the cheap vendor serving the value tier.',
      },
      {
        name: 'costopt_setting.value_tier_vendor_api_key',
        kind: 'text',
        label: 'Vendor API key',
        gated: 'costopt_setting.value_tier_mode',
        placeholder: 'gsk_...',
        help: 'API key for the cheap vendor.',
      },
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
        help: 'auto classifies requests automatically, manual applies only your explicit rules, off disables the split.',
      },
      {
        name: 'costopt_setting.tier_split_auto_detect',
        kind: 'bool',
        label: 'Auto detect background traffic',
        gated: 'costopt_setting.tier_split_mode',
        help: 'Automatically recognises background work such as embeddings, summaries and batch jobs.',
      },
      {
        name: 'costopt_setting.tier_split_visible_models',
        kind: 'json',
        label: 'User-facing models to keep',
        gated: 'costopt_setting.tier_split_mode',
        placeholder: '["gpt-4o", "claude-opus"]',
        help: 'Models that must stay on the premium tier for user-facing requests.',
      },
      {
        name: 'costopt_setting.tier_split_background_tags',
        kind: 'json',
        label: 'Background request tags',
        gated: 'costopt_setting.tier_split_mode',
        placeholder: '["embedding", "summary"]',
        help: 'Request tags or paths that mark a request as background work.',
      },
      {
        name: 'costopt_setting.tier_split_background_model',
        kind: 'text',
        label: 'Background model',
        gated: 'costopt_setting.tier_split_mode',
        placeholder: 'gpt-4o-mini',
        help: 'Cheaper model that background requests are allowed to use.',
      },
      {
        name: 'costopt_setting.tier_split_non_stream_as_background',
        kind: 'bool',
        label: 'Treat non-streaming requests as background',
        gated: 'costopt_setting.tier_split_mode',
        help: 'Treats every non-streaming request as background work. Convenient, but risky for user-facing traffic.',
      },
    ],
  },
  {
    title: 'Precise RAG',
    desc: 'Requires an external RAG service. Fill in the endpoint to turn the hook into real retrieval with tight top-k.',
    fields: [
      {
        name: 'costopt_setting.rag_enabled',
        kind: 'bool',
        label: 'Enable precise RAG',
        help: 'Retrieves relevant knowledge and injects it before the model answers. Requires an external RAG service.',
      },
      {
        name: 'costopt_setting.rag_endpoint',
        kind: 'text',
        label: 'RAG endpoint',
        gated: 'costopt_setting.rag_enabled',
        placeholder: 'https://rag.example.com/search',
        help: 'HTTP endpoint of your RAG service, queried with the conversation query.',
      },
      {
        name: 'costopt_setting.rag_api_key',
        kind: 'text',
        label: 'RAG API key',
        gated: 'costopt_setting.rag_enabled',
        placeholder: 'rk_...',
        help: 'API key sent to the RAG endpoint. Leave empty when the service needs no authentication.',
      },
      {
        name: 'costopt_setting.rag_top_k',
        kind: 'number',
        label: 'Top K',
        gated: 'costopt_setting.rag_enabled',
        placeholder: '4',
        help: 'How many snippets to retrieve per request.',
      },
      {
        name: 'costopt_setting.rag_score_threshold',
        kind: 'number',
        label: 'Score threshold',
        gated: 'costopt_setting.rag_enabled',
        placeholder: '0.7',
        help: 'Minimum relevance score a snippet must reach before it is injected.',
      },
      {
        name: 'costopt_setting.rag_rerank_enabled',
        kind: 'bool',
        label: 'Enable rerank',
        gated: 'costopt_setting.rag_enabled',
        help: 'Re-scores retrieved snippets with a rerank model to improve their ordering.',
      },
      {
        name: 'costopt_setting.rag_rerank_model',
        kind: 'text',
        label: 'Rerank model',
        gated: 'costopt_setting.rag_enabled',
        placeholder: 'bge-reranker-v2-m3',
        help: 'Name of the reranking model exposed by your RAG service.',
      },
      {
        name: 'costopt_setting.rag_max_context_tokens',
        kind: 'number',
        label: 'Maximum context tokens',
        gated: 'costopt_setting.rag_enabled',
        placeholder: '2048',
        help: 'Upper bound on the number of tokens injected from retrieved snippets.',
      },
      {
        name: 'costopt_setting.rag_timeout_ms',
        kind: 'number',
        label: 'Timeout in milliseconds',
        gated: 'costopt_setting.rag_enabled',
        placeholder: '1500',
        help: 'How long to wait for the RAG service before continuing without it.',
      },
      {
        name: 'costopt_setting.rag_inject_position',
        kind: 'select',
        label: 'Inject position',
        options: [
          { value: 'system', label: 'system' },
          { value: 'user', label: 'user' },
        ],
        gated: 'costopt_setting.rag_enabled',
        help: 'Whether the retrieved context goes into the system message or the user message.',
      },
      {
        name: 'costopt_setting.rag_query_from_last_n',
        kind: 'number',
        label: 'Build query from last N messages',
        gated: 'costopt_setting.rag_enabled',
        placeholder: '2',
        help: 'Builds the retrieval query from the last N messages of the conversation.',
      },
    ],
  },
  {
    title: 'Batch API offload',
    desc: 'Offline traffic is submitted to the upstream Batch API for a flat 50% discount. Requires upstream Batch support.',
    fields: [
      {
        name: 'costopt_setting.batch_enabled',
        kind: 'bool',
        label: 'Enable batch offload',
        help: 'Submits offline traffic to the upstream Batch API at roughly half price. Requires upstream batch support.',
      },
      {
        name: 'costopt_setting.batch_api_base_url',
        kind: 'text',
        label: 'Batch API base URL',
        gated: 'costopt_setting.batch_enabled',
        placeholder: 'https://api.openai.com/v1',
        help: 'OpenAI-compatible base URL of the upstream that serves the batch API.',
      },
      {
        name: 'costopt_setting.batch_api_key',
        kind: 'text',
        label: 'Batch API key',
        gated: 'costopt_setting.batch_enabled',
        placeholder: 'sk-...',
        help: 'API key for the batch endpoint.',
      },
      {
        name: 'costopt_setting.batch_endpoint_path',
        kind: 'text',
        label: 'Batch submit path',
        gated: 'costopt_setting.batch_enabled',
        placeholder: '/v1/batches',
        help: 'Path used to create a batch, following the OpenAI batch convention.',
      },
      {
        name: 'costopt_setting.batch_result_path',
        kind: 'text',
        label: 'Batch result path',
        gated: 'costopt_setting.batch_enabled',
        placeholder: '/v1/batches/{id}',
        help: 'Path used to poll a batch by id. The {id} placeholder is replaced with the batch id.',
      },
      {
        name: 'costopt_setting.batch_completion_window',
        kind: 'text',
        label: 'Completion window',
        gated: 'costopt_setting.batch_enabled',
        placeholder: '24h',
        help: 'Upstream completion window such as 24h. Longer windows are cheaper.',
      },
      {
        name: 'costopt_setting.batch_max_items',
        kind: 'number',
        label: 'Maximum items per batch',
        gated: 'costopt_setting.batch_enabled',
        placeholder: '100',
        help: 'Flushes a batch once it reaches this many items.',
      },
      {
        name: 'costopt_setting.batch_flush_interval_seconds',
        kind: 'number',
        label: 'Flush interval in seconds',
        gated: 'costopt_setting.batch_enabled',
        placeholder: '300',
        help: 'Flushes a pending batch after this many seconds even when it is not full.',
      },
      {
        name: 'costopt_setting.batch_eligible_models',
        kind: 'json',
        label: 'Eligible models',
        gated: 'costopt_setting.batch_enabled',
        placeholder: '["gpt-4o-mini"]',
        help: 'Only these models are submitted as batches. Anything else passes through normally.',
      },
    ],
  },
  {
    title: 'Edge and CDN asset cache',
    desc: 'Offload static assets to a CDN. Fill in the CDN base URL to activate rewriting, cache headers and origin shield.',
    fields: [
      {
        name: 'costopt_setting.cdn_enabled',
        kind: 'bool',
        label: 'Enable CDN offload',
        help: 'Serves static assets from a CDN to cut origin bandwidth. Note: the rewriting logic is implemented but not yet wired to the asset route.',
      },
      {
        name: 'costopt_setting.cdn_asset_base_url',
        kind: 'text',
        label: 'CDN base URL',
        gated: 'costopt_setting.cdn_enabled',
        placeholder: 'https://cdn.example.com',
        help: 'Public CDN base URL that assets are rewritten to.',
      },
      {
        name: 'costopt_setting.cdn_origin_url',
        kind: 'text',
        label: 'Origin URL',
        gated: 'costopt_setting.cdn_enabled',
        placeholder: 'https://origin.example.com',
        help: 'Origin server the CDN pulls from when rewriting asset URLs.',
      },
      {
        name: 'costopt_setting.cdn_cache_ttl_seconds',
        kind: 'number',
        label: 'Cache TTL in seconds',
        gated: 'costopt_setting.cdn_enabled',
        placeholder: '86400',
        help: 'Cache-Control max-age sent for CDN assets, in seconds.',
      },
      {
        name: 'costopt_setting.cdn_path_prefixes',
        kind: 'json',
        label: 'Path prefixes',
        gated: 'costopt_setting.cdn_enabled',
        placeholder: '["/assets/", "/static/"]',
        help: 'Path prefixes eligible for CDN rewriting, for example the asset and static directories.',
      },
      {
        name: 'costopt_setting.cdn_include_query',
        kind: 'bool',
        label: 'Include query string in cache key',
        gated: 'costopt_setting.cdn_enabled',
        help: 'Includes the query string in the cache key. Leave it off so tracking parameters do not fragment the cache.',
      },
      {
        name: 'costopt_setting.cdn_signing_header',
        kind: 'text',
        label: 'Origin shield header',
        gated: 'costopt_setting.cdn_enabled',
        placeholder: 'X-Origin-Shield',
        help: 'Header the CDN sends to fetch from origin, for example X-Origin-Shield.',
      },
      {
        name: 'costopt_setting.cdn_signing_secret',
        kind: 'text',
        label: 'Origin shield secret',
        gated: 'costopt_setting.cdn_enabled',
        placeholder: 'your-shared-secret',
        help: 'Shared secret used to sign the origin shield header.',
      },
    ],
  },
  {
    title: 'Shared prompt prefix',
    desc: 'Pin a stable system prefix to the top so upstream prefix caching hits reliably.',
    fields: [
      {
        name: 'costopt_setting.shared_prefix_enabled',
        kind: 'bool',
        label: 'Enable shared prefix',
        help: 'Pins a stable system prefix so upstream prefix caching actually hits.',
      },
      {
        name: 'costopt_setting.shared_prefix_templates',
        kind: 'json',
        label: 'Prefix templates by model',
        gated: 'costopt_setting.shared_prefix_enabled',
        placeholder: '{"gpt-4o": "You are a helpful assistant."}',
        help: 'System prefix template per model. Reusing identical text is what produces the cache hit.',
      },
      {
        name: 'costopt_setting.shared_prefix_max_chars',
        kind: 'number',
        label: 'Maximum prefix characters',
        gated: 'costopt_setting.shared_prefix_enabled',
        placeholder: '4000',
        help: 'Truncates the shared prefix to this many characters.',
      },
    ],
  },
  {
    title: 'Structured output constraint',
    desc: 'Enforce output shape at the gateway so models stop over-explaining. Output tokens usually cost 2-5x more than input.',
    fields: [
      {
        name: 'costopt_setting.structured_output_enabled',
        kind: 'bool',
        label: 'Enable structured output constraint',
        help: 'Constrains the output shape at the gateway to stop over-explaining. Output tokens cost far more than input.',
      },
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
        help: 'json_object forces JSON output, json_schema enforces a schema, stop relies on stop sequences.',
      },
      {
        name: 'costopt_setting.structured_output_stop_sequences',
        kind: 'json',
        label: 'Stop sequences',
        gated: 'costopt_setting.structured_output_enabled',
        placeholder: '["\\n\\nUser:"]',
        help: 'Stop sequences that end the response at the right boundary, such as an extra turn marker.',
      },
      {
        name: 'costopt_setting.structured_output_max_retries',
        kind: 'number',
        label: 'Maximum retries',
        gated: 'costopt_setting.structured_output_enabled',
        placeholder: '1',
        help: 'How many times to retry when the output does not satisfy the constraint.',
      },
    ],
  },
  {
    title: 'Long task persistence',
    desc: 'Store confirmed facts externally and compress at stage boundaries instead of replaying full history every round.',
    fields: [
      {
        name: 'costopt_setting.long_task_persist_enabled',
        kind: 'bool',
        label: 'Enable long task persistence',
        help: 'Stores confirmed facts externally and compresses history at stage boundaries instead of replaying it every round.',
      },
      {
        name: 'costopt_setting.long_task_store_endpoint',
        kind: 'text',
        label: 'Fact store endpoint',
        gated: 'costopt_setting.long_task_persist_enabled',
        placeholder: 'https://facts.example.com/store',
        help: 'HTTP endpoint that stores and retrieves the confirmed facts of a long task.',
      },
      {
        name: 'costopt_setting.long_task_fact_interval',
        kind: 'number',
        label: 'Fact extraction interval in rounds',
        gated: 'costopt_setting.long_task_persist_enabled',
        placeholder: '5',
        help: 'Extracts and persists facts every N conversation rounds.',
      },
      {
        name: 'costopt_setting.long_task_max_facts',
        kind: 'number',
        label: 'Maximum facts kept',
        gated: 'costopt_setting.long_task_persist_enabled',
        placeholder: '50',
        help: 'Cap on how many facts are retained per task.',
      },
    ],
  },
  {
    title: 'Cost per successful task',
    desc: 'Measure cost per successful task instead of per request, so token savings never hide a quality regression.',
    fields: [
      {
        name: 'costopt_setting.cost_per_success_enabled',
        kind: 'bool',
        label: 'Enable cost per successful task',
        help: 'Measures cost per successful task instead of per request, so savings cannot hide a quality drop.',
      },
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
        help: 'How a successful task is recognised: no error, HTTP OK, or a field inside the response body.',
      },
      {
        name: 'costopt_setting.cost_per_success_field',
        kind: 'text',
        label: 'Success field name',
        gated: 'costopt_setting.cost_per_success_enabled',
        placeholder: 'success',
        help: 'Response body field checked when the signal is a JSON field.',
      },
      {
        name: 'costopt_setting.cost_per_success_expected',
        kind: 'text',
        label: 'Expected success value',
        gated: 'costopt_setting.cost_per_success_enabled',
        placeholder: 'true',
        help: 'Value that field must equal for the task to count as successful, for example true.',
      },
    ],
  },
]

export const ALL_FIELDS: FieldDef[] = GROUPS.flatMap((g) => g.fields)

/** 供 section-registry 从 settings 中挑选本区字段用。 */
export const COST_OPTIMIZATION_KEYS: Array<`costopt_setting.${string}`> =
  ALL_FIELDS.map((f) => f.name as `costopt_setting.${string}`)

/** 从完整 option key 取出 zod 嵌套用的子字段名。 */
export const leaf = (name: string) => name.replace(/^costopt_setting\./, '')