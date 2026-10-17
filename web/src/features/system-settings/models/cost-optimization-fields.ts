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

/**
 * 保真分级：这一项省下的钱，是否以改变模型所见内容为代价。
 *
 * 背景：客户选择某个大模型，服务方就必须用那个模型、以它应有的完整上下文服务。
 * 因此并非所有"省钱"手段都能默认打开——有的数学等价，有的会悄悄削减输入或约束输出。
 * 运营据此判断哪些可以放心开、哪些需要知情后才开。
 */
export type FidelityTier =
  /** 零风险：不改变发给模型的内容，响应逐字节相同，纯省重复劳动的钱。可放心开启。 */
  | 'safe'
  /** 有损：确实省钱，但会改变 prompt（裁历史/压提示/降图）或约束输出形态，可能掉质量。默认关闭，需知情后开启。 */
  | 'lossy'

/**
 * 省钱的**作用机理**：钱到底是从哪一笔里省出来的。
 *
 * 这是分组的唯一依据——分类的意义在于让同类项聚合、好对比、好一起决策。
 * 取钱之处只有四种，对应四大类：
 *   1. reuse  已付过钱的东西别再付一次（缓存 / 前缀命中 / 传输压缩）
 *   2. shrink 同一个模型换更便宜的执行方式（渠道价差、批处理折扣）
 *   3. inject 用检索结果替掉客户反复粘贴的背景资料
 *   4. guard  防失控与度量（不直接省钱，但决定前三种是否在可控范围内）
 *
 * 在前述四大类之下，再按「外部依赖形态」细分子组（缓存 / 批处理 / RAG / 护栏…），
 * 让每组参数既同源、又不超过 ~9 个，便于运营逐项决策、互不干扰。
 */
export type SavingMechanism = 'reuse' | 'shrink' | 'inject' | 'guard'

export type FieldDef = {
  /** 完整option key（含 costopt_setting. 前缀） */
  name: string
  kind: FieldKind
  /** i18n key：按项目约定「key 即英文原文」，此处存可读英文 */
  label: string
  /** 该字段依赖的开关（开关关闭时禁用输入） */
  gated?: string
  options?: Array<{ value: string; label: string }>
  /**
   * 占位提示：直接写死的技术字面量（默认值 / 推荐虚拟地址 / 格式示例），
   * 不走 i18n——它不是自然语言，翻译反而会误导（URL、JSON样例、模型名）。
   * 空输入时作为 placeholder 显示，告诉用户「该填什么、什么格式」。
   */
  placeholder?: string
  /** i18n key：问号按钮点开后展示的说明文字（key 即英文原文） */
  help?: string
  /**
   * 标记为密钥字段：前端以 SecretInput 渲染——保存后显示掩码（前 4 + 中间星号 + 后 4），
   * 聚焦可输入新值，绝不把掩码串写回后端。用于 API key / secret 等敏感字段。
   */
  secret?: boolean
  /** 保真分级（见 FidelityTier）：这一项是否以改变模型所见内容为代价。 */
  fidelity?: FidelityTier
  /**
   * 已停用的历史配置项标记。当前降本优化已不再展示任何停用项（模型保真原则下整体停用），
   * 故新分组里不会再出现 retired 字段；此处保留类型声明仅为兼容既有组件引用。
   */
  retired?: boolean
}

// 分组：按「钱从哪一笔省出来」归为四大类（复用 / 换更便宜跑法 / 注入外部知识 / 护栏与度量），
// 每大类之下再按外部依赖形态细分子组，使得每个子组参数同源、且数量可控（≤9）。
//
// 设计要点：
//   - 复用（reuse）：命中即返回历史结果，或让上游前缀缓存命中、压缩传输字节。
//     不改变模型所见内容，响应逐字节相同，是唯一的零风险省钱手段。
//   - 换更便宜的跑法（shrink）：同一个模型，换一条更便宜的通道或异步批处理方式。
//     模型分毫未变，只是「怎么付钱」变了。
//   - 注入外部知识（inject）：用检索结果替掉客户每次反复粘贴的背景资料。
//     效果取决于检索质量，单独成组、且明确标注外部依赖。
//   - 护栏与度量（guard）：不直接省钱，但决定前三种是否可控、是否真的省了。
export const GROUPS: Array<{
  title: string
  desc: string
  fields: FieldDef[]
}> = [
  // ===== 复用（reuse）：响应缓存 =====
  {
    title: 'Cache setting',
    desc: 'Caches an identical request and replays it, so repeated work costs nothing the second time. The model sees exactly what it would have seen anyway, which makes these the only truly risk-free savings here.',
    fields: [
      {
        name: 'costopt_setting.response_cache_enabled',
        kind: 'bool',
        fidelity: 'safe',
        label: 'Enable response cache',
        help: 'Caches identical responses for a short TTL and replays them for repeat requests, saving tokens on repeated or template prompts.',
      },
      {
        name: 'costopt_setting.response_cache_ttl_seconds',
        kind: 'number',
        fidelity: 'safe',
        label: 'Response cache TTL in seconds',
        gated: 'costopt_setting.response_cache_enabled',
        placeholder: '300',
        help: 'How long a cached response stays reusable, in seconds. Recommended 300: long enough to absorb repeated prompts, short enough that fresh context is never served stale.',
      },
      {
        name: 'costopt_setting.response_cache_max_tokens',
        kind: 'number',
        fidelity: 'safe',
        label: 'Response cache maximum tokens',
        gated: 'costopt_setting.response_cache_enabled',
        placeholder: '4096',
        help: 'Only responses at or below this many tokens are cached; larger ones are streamed through untouched. Recommended 4096.',
      },
      {
        name: 'costopt_setting.tool_result_cache_enabled',
        kind: 'bool',
        fidelity: 'safe',
        label: 'Enable tool result cache',
        help: 'Caches tool and retrieval results by tool name plus arguments, so an identical call in a later request costs nothing.',
      },
      {
        name: 'costopt_setting.tool_result_cache_ttl_seconds',
        kind: 'number',
        fidelity: 'safe',
        label: 'Tool result cache TTL in seconds',
        gated: 'costopt_setting.tool_result_cache_enabled',
        placeholder: '600',
        help: 'How long a cached tool result stays reusable, in seconds. Recommended 600.',
      },
      {
        name: 'costopt_setting.tool_call_dedup_enabled',
        kind: 'bool',
        fidelity: 'safe',
        label: 'Enable tool result deduplication',
        help: 'Drops repeated identical tool messages inside one conversation. The model still sees exactly the same set of distinct results.',
      },
    ],
  },
  // ===== 复用（reuse）：前缀与传输 =====
  {
    title: 'Compression setting',
    desc: 'Pins a stable system prefix so upstream prompt caching actually hits, and compresses the response body on the wire. Both cut cost without changing what the model receives.',
    fields: [
      {
        name: 'costopt_setting.shared_prefix_enabled',
        kind: 'bool',
        fidelity: 'safe',
        label: 'Enable shared prefix',
        help: 'Pins a stable system prefix so upstream prefix caching actually hits, turning a repeated prompt prefix into a discount.',
      },
      {
        name: 'costopt_setting.shared_prefix_templates',
        kind: 'json',
        fidelity: 'safe',
        label: 'Prefix templates by model',
        gated: 'costopt_setting.shared_prefix_enabled',
        placeholder: '{"gpt-4o": "You are a helpful assistant."}',
        help: 'System prefix template per model. Reusing identical text is what produces the cache hit.',
      },
      {
        name: 'costopt_setting.shared_prefix_max_chars',
        kind: 'number',
        fidelity: 'safe',
        label: 'Maximum prefix characters',
        gated: 'costopt_setting.shared_prefix_enabled',
        placeholder: '4000',
        help: 'Truncates the shared prefix to this many characters.',
      },
      {
        name: 'costopt_setting.gzip_enabled',
        kind: 'bool',
        fidelity: 'safe',
        label: 'Enable response gzip compression',
        help: 'Compresses response bodies with gzip, cutting bandwidth cost on text-heavy traffic. The decompressed content is identical.',
      },
      {
        name: 'costopt_setting.cache_warmup_enabled',
        kind: 'bool',
        fidelity: 'safe',
        label: 'Enable cache warmup',
        help: 'Preloads the exact cache at startup so the very first requests are already served warm.',
      },
    ],
  },
  // ===== 换更便宜的跑法（shrink）：渠道套利 =====
  {
    title: 'Price routing',
    desc: 'Picks the cheapest channel serving the exact same model, using the platform pricing table automatically. Same model, lower price — never a model swap.',
    fields: [
      {
        name: 'costopt_setting.arbitrage_mode',
        kind: 'select',
        fidelity: 'safe',
        label: 'Mode',
        options: [
          { value: 'auto', label: 'auto' },
          { value: 'manual', label: 'manual' },
          { value: 'off', label: 'off' },
        ],
        help: 'auto reads prices from the platform pricing table, manual relies only on the override table below, off disables it. Recommended auto.',
      },
      {
        name: 'costopt_setting.arbitrage_auto_max_price_ratio',
        kind: 'number',
        fidelity: 'safe',
        label: 'Price tolerance ratio',
        gated: 'costopt_setting.arbitrage_mode',
        placeholder: '1.15',
        help: 'How much more expensive a channel may be and still be considered. Recommended 1.15: with 1.0 every request piles onto the single cheapest channel, so one outage there takes the whole site down.',
      },
      {
        name: 'costopt_setting.arbitrage_price_source',
        kind: 'select',
        fidelity: 'safe',
        label: 'Price source',
        options: [
          { value: 'ratio_config', label: 'ratio_config (automatic)' },
          { value: 'manual', label: 'manual override table' },
        ],
        gated: 'costopt_setting.arbitrage_mode',
        help: 'Automatic takes the platform price of the model each channel maps to. Manual is only for models the pricing table does not cover.',
      },
      {
        name: 'costopt_setting.arbitrage_model_prices',
        kind: 'json',
        fidelity: 'safe',
        label: 'Price override table',
        gated: 'costopt_setting.arbitrage_price_source',
        placeholder: '{"gpt-4o": 1.5}',
        help: 'Only needed in manual mode. Prices come from the platform pricing table automatically, so this should normally stay empty — a hand-written price goes stale the moment the provider changes it.',
      },
      {
        name: 'costopt_setting.arbitrage_max_price_ratio',
        kind: 'number',
        fidelity: 'safe',
        label: 'Maximum price ratio',
        gated: 'costopt_setting.arbitrage_price_source',
        placeholder: '1.0',
        help: 'Rejects a more expensive channel once it exceeds the cheapest reference by this ratio.',
      },
      {
        name: 'costopt_setting.arbitrage_prefer_same_model_only',
        kind: 'bool',
        fidelity: 'safe',
        label: 'Compare only across channels of the same model',
        gated: 'costopt_setting.arbitrage_mode',
        help: 'Only compares channels serving the exact same model and never substitutes a different one. This is enforced by the backend and can no longer be turned off.',
      },
    ],
  },
  // ===== 换更便宜的跑法（shrink）：批量转批（连接 + 调参合并） =====
  {
    title: 'Batch setting',
    desc: 'Submits offline traffic to an upstream Batch API at roughly half price. Same model, executed asynchronously. Fill in the endpoint details below to wire it up.',
    fields: [
      {
        name: 'costopt_setting.batch_enabled',
        kind: 'bool',
        fidelity: 'safe',
        label: 'Enable batch offload',
        help: 'Submits offline traffic to the upstream Batch API at roughly half price. Same model, just executed asynchronously. Requires upstream batch support.',
      },
      {
        name: 'costopt_setting.batch_api_base_url',
        kind: 'text',
        fidelity: 'safe',
        label: 'Batch API base URL',
        gated: 'costopt_setting.batch_enabled',
        placeholder: 'https://open.bigmodel.cn/api/paas/v4',
        help: 'Base URL of the upstream that serves the batch API. Both forms work: with or without the trailing version — the gateway appends each path exactly once.',
      },
      {
        name: 'costopt_setting.batch_api_key',
        kind: 'text',
        fidelity: 'safe',
        secret: true,
        label: 'Batch API key',
        gated: 'costopt_setting.batch_enabled',
        placeholder: 'sk-...',
        help: 'API key for the batch endpoint.',
      },
      {
        name: 'costopt_setting.batch_endpoint_path',
        kind: 'text',
        fidelity: 'safe',
        label: 'Batch submit path',
        gated: 'costopt_setting.batch_enabled',
        placeholder: '/v1/batches',
        help: 'Path used to create a batch, following the OpenAI batch convention.',
      },
      {
        name: 'costopt_setting.batch_chat_endpoint',
        kind: 'text',
        fidelity: 'safe',
        label: 'Batch inner chat endpoint',
        gated: 'costopt_setting.batch_enabled',
        placeholder: '/v1/chat/completions',
        help: 'The per-item endpoint recorded inside each batch line. Zhipu (GLM) uses the /v4 prefix — set /v4/chat/completions there, otherwise the upstream rejects the batch. Leave as default for OpenAI-compatible providers.',
      },
      {
        name: 'costopt_setting.batch_files_path',
        kind: 'text',
        fidelity: 'safe',
        label: 'Batch file upload path',
        gated: 'costopt_setting.batch_enabled',
        placeholder: '/v1/files',
        help: 'Path used to upload the JSONL batch file. Zhipu uses /v4/files.',
      },
      {
        name: 'costopt_setting.batch_result_path',
        kind: 'text',
        fidelity: 'safe',
        label: 'Batch result path',
        gated: 'costopt_setting.batch_enabled',
        placeholder: '/v1/batches/{id}',
        help: 'Path used to poll a batch by id. The {id} placeholder is replaced with the batch id.',
      },
    ],
  },
  // ===== 换更便宜的跑法（shrink）：批量转批 — 调参 =====
  {
    title: 'Batch scheduling',
    desc: 'Controls how requests are batched and which models are eligible. Larger windows and larger batches are cheaper, but they are also slower to return.',
    fields: [
      {
        name: 'costopt_setting.batch_completion_window',
        kind: 'text',
        fidelity: 'safe',
        label: 'Completion window',
        gated: 'costopt_setting.batch_enabled',
        placeholder: '24h',
        help: 'Upstream completion window such as 24h. Longer windows are cheaper.',
      },
      {
        name: 'costopt_setting.batch_max_items',
        kind: 'number',
        fidelity: 'safe',
        label: 'Maximum items per batch',
        gated: 'costopt_setting.batch_enabled',
        placeholder: '100',
        help: 'Flushes a batch once it reaches this many items.',
      },
      {
        name: 'costopt_setting.batch_flush_interval_seconds',
        kind: 'number',
        fidelity: 'safe',
        label: 'Flush interval in seconds',
        gated: 'costopt_setting.batch_enabled',
        placeholder: '300',
        help: 'Flushes a pending batch after this many seconds even when it is not full.',
      },
      {
        name: 'costopt_setting.batch_eligible_models',
        kind: 'json',
        fidelity: 'safe',
        label: 'Eligible models',
        gated: 'costopt_setting.batch_enabled',
        placeholder: '["glm-4-flash"]',
        help: 'Only these models are submitted as batches. Anything else passes through normally.',
      },
    ],
  },
  // ===== 换更便宜的跑法（shrink）：批量 embedding =====
  {
    title: 'Embedding setting',
    desc: 'Submits multiple texts to a single embedding call. Requires the embedding base URL, endpoint, API key and model below.',
    fields: [
      {
        name: 'costopt_setting.batch_embed_enabled',
        kind: 'bool',
        fidelity: 'safe',
        label: 'Enable batch embedding',
        help: 'Submits multiple texts to a single embedding call. Requires the base URL, endpoint, API key and model below.',
      },
      {
        name: 'costopt_setting.batch_embed_base_url',
        kind: 'text',
        fidelity: 'safe',
        label: 'Batch embedding API base URL',
        gated: 'costopt_setting.batch_embed_enabled',
        placeholder: 'https://open.bigmodel.cn',
        help: 'Host of the embedding service. For Zhipu (BigModel/GLM) use https://open.bigmodel.cn — the gateway appends the endpoint path, so do not include /api/paas/v4 here.',
      },
      {
        name: 'costopt_setting.batch_embed_endpoint',
        kind: 'text',
        fidelity: 'safe',
        label: 'Batch embedding endpoint',
        gated: 'costopt_setting.batch_embed_enabled',
        placeholder: '/api/paas/v4/embeddings',
        help: 'Full embeddings path appended to the base URL. Default /v1/embeddings for OpenAI-compatible providers; Zhipu uses /api/paas/v4/embeddings.',
      },
      {
        name: 'costopt_setting.batch_embed_api_key',
        kind: 'text',
        fidelity: 'safe',
        secret: true,
        label: 'Batch embedding API key',
        gated: 'costopt_setting.batch_embed_enabled',
        placeholder: 'sk-... / Zhipu key',
        help: 'API key for the embedding service.',
      },
      {
        name: 'costopt_setting.batch_embed_model',
        kind: 'text',
        fidelity: 'safe',
        label: 'Batch embedding model',
        gated: 'costopt_setting.batch_embed_enabled',
        placeholder: 'embedding-2',
        help: 'Embedding model name. Zhipu embedding models are embedding-2 (1024-dim) and embedding-3 (2048-dim). GLM-4-Flash is a chat model and cannot produce embeddings.',
      },
    ],
  },
  // ===== 换更便宜的跑法（shrink）：CDN =====
  {
    title: 'CDN setting',
    desc: 'Serves static assets from a CDN to cut origin bandwidth. The rewriting logic is implemented but is not yet wired to the asset route.',
    fields: [
      {
        name: 'costopt_setting.cdn_enabled',
        kind: 'bool',
        fidelity: 'safe',
        label: 'Enable CDN offload',
        help: 'Serves static assets from a CDN to cut origin bandwidth. The rewriting logic is implemented but not yet wired to the asset route.',
      },
      {
        name: 'costopt_setting.cdn_asset_base_url',
        kind: 'text',
        fidelity: 'safe',
        label: 'CDN base URL',
        gated: 'costopt_setting.cdn_enabled',
        placeholder: 'https://cdn.example.com',
        help: 'Public CDN base URL that assets are rewritten to.',
      },
      {
        name: 'costopt_setting.cdn_origin_url',
        kind: 'text',
        fidelity: 'safe',
        label: 'Origin URL',
        gated: 'costopt_setting.cdn_enabled',
        placeholder: 'https://origin.example.com',
        help: 'Origin server the CDN pulls from when rewriting asset URLs.',
      },
      {
        name: 'costopt_setting.cdn_cache_ttl_seconds',
        kind: 'number',
        fidelity: 'safe',
        label: 'Cache TTL in seconds',
        gated: 'costopt_setting.cdn_enabled',
        placeholder: '86400',
        help: 'Cache-Control max-age sent for CDN assets, in seconds.',
      },
      {
        name: 'costopt_setting.cdn_path_prefixes',
        kind: 'json',
        fidelity: 'safe',
        label: 'Path prefixes',
        gated: 'costopt_setting.cdn_enabled',
        placeholder: '["/assets/", "/static/"]',
        help: 'Path prefixes eligible for CDN rewriting, for example the asset and static directories.',
      },
      {
        name: 'costopt_setting.cdn_include_query',
        kind: 'bool',
        fidelity: 'safe',
        label: 'Include query string in cache key',
        gated: 'costopt_setting.cdn_enabled',
        help: 'Includes the query string in the cache key. Leave it off so tracking parameters do not fragment the cache.',
      },
      {
        name: 'costopt_setting.cdn_signing_header',
        kind: 'text',
        fidelity: 'safe',
        label: 'Origin shield header',
        gated: 'costopt_setting.cdn_enabled',
        placeholder: 'X-Origin-Shield',
        help: 'Header the CDN sends to fetch from origin, for example X-Origin-Shield.',
      },
      {
        name: 'costopt_setting.cdn_signing_secret',
        kind: 'text',
        fidelity: 'safe',
        secret: true,
        label: 'Origin shield secret',
        gated: 'costopt_setting.cdn_enabled',
        placeholder: 'your-shared-secret',
        help: 'Shared secret used to sign the origin shield header.',
      },
    ],
  },
  // ===== 注入外部知识（inject）：连接 =====
  {
    title: 'RAG setting',
    desc: 'Retrieves relevant knowledge from your own service and injects just that, instead of having the customer paste the same context on every call. Requires an external RAG endpoint.',
    fields: [
      {
        name: 'costopt_setting.rag_enabled',
        kind: 'bool',
        fidelity: 'lossy',
        label: 'Enable precise RAG',
        help: 'Retrieves relevant knowledge and injects it before the model answers. Requires an external RAG service.',
      },
      {
        name: 'costopt_setting.rag_endpoint',
        kind: 'text',
        fidelity: 'lossy',
        label: 'RAG endpoint',
        gated: 'costopt_setting.rag_enabled',
        placeholder: 'https://rag.example.com/search',
        help: 'HTTP endpoint of your RAG service, queried with the conversation query.',
      },
      {
        name: 'costopt_setting.rag_api_key',
        kind: 'text',
        fidelity: 'lossy',
        secret: true,
        label: 'RAG API key',
        gated: 'costopt_setting.rag_enabled',
        placeholder: 'rk_...',
        help: 'API key sent to the RAG endpoint. Leave empty when the service needs no authentication.',
      },
      {
        name: 'costopt_setting.rag_inject_position',
        kind: 'select',
        fidelity: 'lossy',
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
        fidelity: 'lossy',
        label: 'Build query from last N messages',
        gated: 'costopt_setting.rag_enabled',
        placeholder: '2',
        help: 'Builds the retrieval query from the last N messages of the conversation.',
      },
    ],
  },
  // ===== 注入外部知识（inject）：检索调参 =====
  {
    title: 'Retrieval setting',
    desc: 'Tunes how many snippets are retrieved, how they are scored and reranked, and how much is injected. A low score threshold injects noise and costs more than it saves.',
    fields: [
      {
        name: 'costopt_setting.rag_top_k',
        kind: 'number',
        fidelity: 'lossy',
        label: 'Top K',
        gated: 'costopt_setting.rag_enabled',
        placeholder: '4',
        help: 'How many snippets to retrieve per request.',
      },
      {
        name: 'costopt_setting.rag_score_threshold',
        kind: 'number',
        fidelity: 'lossy',
        label: 'Score threshold',
        gated: 'costopt_setting.rag_enabled',
        placeholder: '0.7',
        help: 'Minimum relevance score a snippet must reach before it is injected. A low value injects noise and costs more than it saves.',
      },
      {
        name: 'costopt_setting.rag_rerank_enabled',
        kind: 'bool',
        fidelity: 'lossy',
        label: 'Enable rerank',
        gated: 'costopt_setting.rag_enabled',
        help: 'Re-scores retrieved snippets with a rerank model to improve their ordering.',
      },
      {
        name: 'costopt_setting.rag_rerank_model',
        kind: 'text',
        fidelity: 'lossy',
        label: 'Rerank model',
        gated: 'costopt_setting.rag_enabled',
        placeholder: 'bge-reranker-v2-m3',
        help: 'Name of the reranking model exposed by your RAG service.',
      },
      {
        name: 'costopt_setting.rag_max_context_tokens',
        kind: 'number',
        fidelity: 'lossy',
        label: 'Maximum context tokens',
        gated: 'costopt_setting.rag_enabled',
        placeholder: '2048',
        help: 'Upper bound on the number of tokens injected from retrieved snippets.',
      },
      {
        name: 'costopt_setting.rag_timeout_ms',
        kind: 'number',
        fidelity: 'lossy',
        label: 'Timeout in milliseconds',
        gated: 'costopt_setting.rag_enabled',
        placeholder: '1500',
        help: 'How long to wait for the RAG service before continuing without it.',
      },
      {
        name: 'costopt_setting.rag_net_benefit_enabled',
        kind: 'bool',
        fidelity: 'lossy',
        label: 'Only inject when it actually pays off',
        help: 'Skips injection when the retrieved context is so large relative to the original prompt that it would cost more than it saves. Recommended on.',
      },
      {
        name: 'costopt_setting.rag_injected_vs_prompt_tokens_ratio',
        kind: 'number',
        fidelity: 'lossy',
        label: 'Injection size limit',
        gated: 'costopt_setting.rag_net_benefit_enabled',
        placeholder: '4',
        help: 'Injected tokens may not exceed the original prompt by more than this multiple, otherwise injection is skipped. Recommended 4.',
      },
      {
        name: 'costopt_setting.rag_max_injected_tokens',
        kind: 'number',
        fidelity: 'lossy',
        label: 'Maximum injected tokens',
        gated: 'costopt_setting.rag_net_benefit_enabled',
        placeholder: '2048',
        help: 'Absolute ceiling on injected tokens. Leave 0 to use the context-token limit instead.',
      },
    ],
  },
  // ===== 护栏与度量（guard）：防失控 =====
  {
    title: 'Protection setting',
    desc: 'Caps runaway spend and stops runaway agents, so the savings elsewhere stay under control. Enable these alongside the rest rather than after.',
    fields: [
      {
        name: 'costopt_setting.negative_cache_enabled',
        kind: 'bool',
        fidelity: 'safe',
        label: 'Enable negative cache',
        help: 'Caches deterministic client errors so a malformed request fails instantly instead of being resent to the provider. Rate limits and server errors are never cached.',
      },
      {
        name: 'costopt_setting.negative_cache_ttl_seconds',
        kind: 'number',
        fidelity: 'safe',
        label: 'Negative cache TTL in seconds',
        gated: 'costopt_setting.negative_cache_enabled',
        placeholder: '30',
        help: 'How long an upstream failure is remembered, in seconds. Keep it short so a real recovery is not masked. Recommended 30.',
      },
      {
        name: 'costopt_setting.loop_detection_enabled',
        kind: 'bool',
        fidelity: 'safe',
        label: 'Enable loop detection',
        help: 'Stops runaway agents that repeat the same tool call, returning the repeated result instead of paying for more rounds.',
      },
      {
        name: 'costopt_setting.loop_detection_threshold',
        kind: 'number',
        fidelity: 'safe',
        label: 'Loop detection threshold',
        gated: 'costopt_setting.loop_detection_enabled',
        placeholder: '3',
        help: 'How many identical repeats count as a loop before the request is cut off.',
      },
      {
        name: 'costopt_setting.max_tokens_cap_enabled',
        kind: 'bool',
        fidelity: 'lossy',
        label: 'Enable max tokens cap',
        help: 'Clamps the max_tokens of every request to a ceiling, preventing accidental runaway generation cost. Truncated answers end mid-sentence, so set it above what your longest real answers need.',
      },
      {
        name: 'costopt_setting.max_tokens_cap_global',
        kind: 'number',
        fidelity: 'lossy',
        label: 'Global max tokens cap',
        gated: 'costopt_setting.max_tokens_cap_enabled',
        placeholder: '8192',
        help: 'The hard ceiling applied to max_tokens on every request while the cap is enabled.',
      },
      {
        name: 'costopt_setting.agent_step_budget_enabled',
        kind: 'bool',
        fidelity: 'lossy',
        label: 'Enable agent step budget',
        help: 'Enforces a per-request ceiling on agent steps and tokens. A legitimate long task gets cut off when it hits the ceiling.',
      },
      {
        name: 'costopt_setting.agent_step_budget_max_steps',
        kind: 'number',
        fidelity: 'lossy',
        label: 'Maximum agent steps',
        gated: 'costopt_setting.agent_step_budget_enabled',
        placeholder: '20',
        help: 'Maximum number of agent steps allowed within a single request.',
      },
      {
        name: 'costopt_setting.agent_step_budget_max_tokens',
        kind: 'number',
        fidelity: 'lossy',
        label: 'Maximum agent tokens',
        gated: 'costopt_setting.agent_step_budget_enabled',
        placeholder: '200000',
        help: 'Maximum total tokens an agent may spend within a single request.',
      },
    ],
  },
  // ===== 护栏与度量（guard）：告警与度量 =====
  {
    title: 'Spend alerts & measurement',
    desc: 'Alerts on abnormal spend and exposes metrics, so you can prove the savings are real before widening the rollout.',
    fields: [
      {
        name: 'costopt_setting.spike_alert_enabled',
        kind: 'bool',
        label: 'Enable spend spike alert',
        help: 'Alerts when a single tenant burns tokens far above its normal rate.',
      },
      {
        name: 'costopt_setting.spike_alert_tokens_per_min',
        kind: 'number',
        label: 'Spike alert tokens per minute',
        gated: 'costopt_setting.spike_alert_enabled',
        placeholder: '200000',
        help: 'Absolute per-tenant token rate that triggers an alert regardless of baseline.',
      },
      {
        name: 'costopt_setting.spike_alert_multiplier',
        kind: 'number',
        label: 'Spike alert multiplier',
        gated: 'costopt_setting.spike_alert_enabled',
        placeholder: '5',
        help: 'How many times above its own baseline a tenant has to go before an alert fires.',
      },
      {
        name: 'costopt_setting.anomaly_alert_enabled',
        kind: 'bool',
        label: 'Enable anomaly alert',
        help: 'Alerts when cost or token usage deviates sharply from the baseline, so a regression is noticed quickly.',
      },
      {
        name: 'costopt_setting.metrics_enabled',
        kind: 'bool',
        label: 'Enable cost optimization metrics',
        help: 'Exposes the cost-optimization metrics endpoint so you can measure real savings before widening the rollout.',
      },
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
