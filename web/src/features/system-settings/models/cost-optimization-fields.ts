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
  /** 需外部基建：依赖上游 Batch、embedding 服务或自有 RAG/存储端点。缺端点时为 no-op。 */
  | 'infra'

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
  /**
   * 已因「模型保真」原则停用：该项原本会把客户选择的模型换成另一个模型
   * （跨模型降本），违反客户明确要求，后端已整体停用且不会再执行。
   * 保留字段仅为兼容既有配置，前端一律禁用并标注原因，避免运营误开后无效。
   */
  retired?: boolean
  /** 保真分级（见 FidelityTier）。分组标题会据此汇总，风险项所在分组排在后面。 */
  fidelity?: FidelityTier
}

// 分组：每组一个标题 + 字段清单。
//
// 分组顺序即推荐启用顺序：零风险保真排最前（可放心全开），其次是需要外部基建的，
// 有损项与已停用的跨模型项沉到最后。运营从上往下配一遍即可，不必在几十个开关里挑。
export const GROUPS: Array<{
  title: string
  desc: string
  fields: FieldDef[]
}> = [
  {
    title: 'Zero-risk savings (recommended)',
    // 档位 A：不改变发给模型的内容，响应逐字节相同，省下的是重复劳动的钱。
    // 这一组**推荐全部开启**（新部署已默认打开），无需逐项权衡。
    desc: 'These never change what the model sees, so the answer stays byte-for-byte identical — only duplicated work is saved. Recommended to keep all of them on.',
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
        name: 'costopt_setting.tool_call_dedup_enabled',
        kind: 'bool',
        fidelity: 'safe',
        label: 'Enable tool result deduplication',
        help: 'Drops repeated identical tool messages inside one conversation. The model still sees exactly the same set of distinct results.',
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
        name: 'costopt_setting.gzip_enabled',
        kind: 'bool',
        fidelity: 'safe',
        label: 'Enable response gzip compression',
        help: 'Compresses response bodies with gzip, cutting bandwidth cost on text-heavy traffic. The decompressed content is identical.',
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
    ],
  },
  {
    title: 'Same-model channel arbitrage',
    // 同一模型名跨渠道比价：模型分毫不变，只是决定走哪条通道（direct / Bedrock /
    // Azure / 中转），单价可差数倍。这是保真前提下最实在的成本节约。
    desc: 'Compares prices for the exact same model across channels and picks the cheapest route. The model never changes — only the route does.',
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
        help: 'auto derives prices from channel model mappings, manual relies only on the fields below, off disables arbitrage. Recommended auto.',
      },
      {
        name: 'costopt_setting.arbitrage_price_source',
        kind: 'select',
        fidelity: 'safe',
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
        fidelity: 'safe',
        label: 'Model price table',
        gated: 'costopt_setting.arbitrage_mode',
        placeholder: '{"gpt-4o": 1.5}',
        help: 'Manual price table mapping a model name to its USD price per 1M input tokens. Only exact model-name matches are ever considered.',
      },
      {
        name: 'costopt_setting.arbitrage_prefer_same_model_only',
        kind: 'bool',
        fidelity: 'safe',
        label: 'Compare only across channels of the same model',
        gated: 'costopt_setting.arbitrage_mode',
        help: 'Only compares channels serving the exact same model and never substitutes a different one. This is now enforced by the backend and cannot be turned off.',
      },
      {
        name: 'costopt_setting.arbitrage_max_price_ratio',
        kind: 'number',
        fidelity: 'safe',
        label: 'Maximum price ratio',
        gated: 'costopt_setting.arbitrage_mode',
        placeholder: '1.0',
        help: 'Rejects a more expensive channel once it exceeds the reference price by this ratio.',
      },
      {
        name: 'costopt_setting.arbitrage_auto_max_price_ratio',
        kind: 'number',
        fidelity: 'safe',
        label: 'Auto price tolerance ratio',
        gated: 'costopt_setting.arbitrage_mode',
        placeholder: '1.0',
        help: 'Tolerance used by auto mode when comparing derived channel prices. Recommended 1.15 to avoid concentrating all traffic on one channel — raise only if the cheapest route is stable.',
      },
    ],
  },
  {
    title: 'Lossy savings (opt in knowingly)',
    // 档位 B：确实省钱，但会改变 prompt 或约束输出形态，可能掉质量。
    // 默认全关；参数已按实测推荐值预填，打开即生效。
    desc: 'These do save money, but they change what the model receives or how it may answer, so quality can drop. They ship disabled with recommended values already filled in.',
    fields: [
      {
        name: 'costopt_setting.context_window_enabled',
        kind: 'bool',
        fidelity: 'lossy',
        label: 'Enable context window trimming',
        help: 'Keeps all system messages plus the most recent turns and drops the rest. Older context is genuinely lost, so only enable it for long-running sessions.',
      },
      {
        name: 'costopt_setting.context_window_max_messages',
        kind: 'number',
        fidelity: 'lossy',
        label: 'Context window messages to keep',
        gated: 'costopt_setting.context_window_enabled',
        placeholder: '20',
        help: 'How many non-system messages to keep. Recommended 20, roughly ten conversation rounds.',
      },
      {
        name: 'costopt_setting.max_tokens_cap_enabled',
        kind: 'bool',
        fidelity: 'lossy',
        label: 'Enable max tokens cap',
        help: 'Clamps the max_tokens of every request to a global ceiling, preventing accidental runaway generation cost. Truncated answers end mid-sentence.',
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
        name: 'costopt_setting.prompt_compression_enabled',
        kind: 'bool',
        fidelity: 'lossy',
        label: 'Enable prompt compression',
        help: 'Rewrites long user messages with a separate compression model to cut input tokens. It paraphrases what the customer wrote, so wording is not preserved.',
      },
      {
        name: 'costopt_setting.prompt_compression_api_base_url',
        kind: 'text',
        fidelity: 'lossy',
        label: 'Compression API base URL',
        gated: 'costopt_setting.prompt_compression_enabled',
        placeholder: 'https://api.siliconflow.cn/v1',
        help: 'OpenAI-compatible base URL of the model used to compress prompts. This model only summarizes; the customer request is still answered by the model they chose.',
      },
      {
        name: 'costopt_setting.prompt_compression_api_key',
        kind: 'text',
        fidelity: 'lossy',
        secret: true,
        label: 'Compression API key',
        gated: 'costopt_setting.prompt_compression_enabled',
        placeholder: 'sk-...',
        help: 'API key for the compression service.',
      },
      {
        name: 'costopt_setting.prompt_compression_model',
        kind: 'text',
        fidelity: 'lossy',
        label: 'Compression model',
        gated: 'costopt_setting.prompt_compression_enabled',
        placeholder: 'Qwen/Qwen3-8B',
        help: 'Model used to compress prompts. Pick a small fast one — it only has to summarize.',
      },
      {
        name: 'costopt_setting.prompt_compression_max_ratio',
        kind: 'number',
        fidelity: 'lossy',
        label: 'Compression target ratio',
        gated: 'costopt_setting.prompt_compression_enabled',
        placeholder: '0.5',
        help: 'How small the compressed text should be relative to the original. 0.5 keeps half; lower values save more but lose more detail.',
      },
      {
        name: 'costopt_setting.tool_def_trim_enabled',
        kind: 'bool',
        fidelity: 'lossy',
        label: 'Enable tool definition trimming',
        help: 'Slims the tool schemas sent with every request. Descriptions and examples are what let a model pick the right tool, so trimming them lowers accuracy.',
      },
      {
        name: 'costopt_setting.tool_def_trim_strip_description',
        kind: 'bool',
        fidelity: 'lossy',
        label: 'Strip tool descriptions',
        gated: 'costopt_setting.tool_def_trim_enabled',
        help: 'Removes each tool description. Not recommended: it is the only signal the model uses to decide when a tool applies.',
      },
      {
        name: 'costopt_setting.tool_def_trim_strip_examples',
        kind: 'bool',
        fidelity: 'lossy',
        label: 'Strip parameter examples',
        gated: 'costopt_setting.tool_def_trim_enabled',
        help: 'Strips examples from the parameter schema. Recommended: examples are long and rarely change which tool the model picks.',
      },
      {
        name: 'costopt_setting.image_resize_enabled',
        kind: 'bool',
        fidelity: 'lossy',
        label: 'Enable image downscaling',
        help: 'Rewrites remote image URLs through a proxy that downsamples them, cutting vision tokens. Fine detail in the image is lost.',
      },
      {
        name: 'costopt_setting.image_resize_max_edge',
        kind: 'number',
        fidelity: 'lossy',
        label: 'Maximum image edge in pixels',
        gated: 'costopt_setting.image_resize_enabled',
        placeholder: '1024',
        help: 'Longest edge after downscaling. Recommended 1024 for chat, raise to 2048 when reading fine print or screenshots.',
      },
      {
        name: 'costopt_setting.image_resize_proxy_template',
        kind: 'text',
        fidelity: 'lossy',
        label: 'Image proxy template',
        gated: 'costopt_setting.image_resize_enabled',
        placeholder: 'https://wsrv.nl/?url={url}&w={max}',
        help: 'URL template of the image proxy. {url} is the original image and {max} the edge limit.',
      },
      {
        name: 'costopt_setting.semantic_cache_enabled',
        kind: 'bool',
        fidelity: 'lossy',
        label: 'Enable semantic cache',
        help: 'Matches prompts by meaning rather than exact text and reuses a near-identical past answer. Requires an embedding endpoint, and similar questions can still deserve different answers.',
      },
      {
        name: 'costopt_setting.semantic_cache_ttl_seconds',
        kind: 'number',
        fidelity: 'lossy',
        label: 'Semantic cache TTL in seconds',
        gated: 'costopt_setting.semantic_cache_enabled',
        placeholder: '300',
        help: 'How long a semantic match stays reusable, in seconds.',
      },
      {
        name: 'costopt_setting.semantic_cache_embed_base_url',
        kind: 'text',
        fidelity: 'lossy',
        label: 'Embedding API base URL',
        gated: 'costopt_setting.semantic_cache_enabled',
        placeholder: 'https://open.bigmodel.cn',
        help: 'OpenAI-compatible base URL of the embedding service used to compare prompt meaning. Both forms work: with or without the trailing /v1 — the gateway appends /v1/embeddings exactly once, so it never becomes /v1/v1/embeddings.',
      },
      {
        name: 'costopt_setting.semantic_cache_embed_api_key',
        kind: 'text',
        fidelity: 'lossy',
        secret: true,
        label: 'Embedding API key',
        gated: 'costopt_setting.semantic_cache_enabled',
        placeholder: 'sk-...',
        help: 'API key for the embedding service.',
      },
      {
        name: 'costopt_setting.semantic_cache_embed_model',
        kind: 'text',
        fidelity: 'lossy',
        label: 'Embedding model',
        gated: 'costopt_setting.semantic_cache_enabled',
        placeholder: 'text-embedding-3-small',
        help: 'Name of the embedding model, for example a small OpenAI embedding model.',
      },
      {
        name: 'costopt_setting.semantic_cache_embed_endpoint',
        kind: 'text',
        fidelity: 'lossy',
        label: 'Embedding endpoint',
        gated: 'costopt_setting.semantic_cache_enabled',
        placeholder: '/v1/embeddings',
        help: 'Full embeddings path appended to the base URL. Default /v1/embeddings for OpenAI-compatible providers; Zhipu uses /api/paas/v4/embeddings.',
      },
      {
        name: 'costopt_setting.semantic_cache_top_k',
        kind: 'number',
        fidelity: 'lossy',
        label: 'Semantic cache top K',
        gated: 'costopt_setting.semantic_cache_enabled',
        placeholder: '3',
        help: 'How many nearest neighbours to inspect when looking for a reusable answer.',
      },
      {
        name: 'costopt_setting.semantic_cache_score_threshold',
        kind: 'number',
        fidelity: 'lossy',
        label: 'Semantic cache score threshold',
        gated: 'costopt_setting.semantic_cache_enabled',
        placeholder: '0.92',
        help: 'Minimum similarity between 0 and 1 required before a cached answer is reused. Keep this at 0.92 or above — lowering it starts answering questions the customer did not ask.',
      },
      {
        name: 'costopt_setting.structured_output_enabled',
        kind: 'bool',
        fidelity: 'lossy',
        label: 'Enable structured output constraint',
        help: 'Constrains the output shape at the gateway to stop over-explaining. It also forbids the model from answering freely, so only enable it when callers parse the output.',
      },
      {
        name: 'costopt_setting.structured_output_mode',
        kind: 'select',
        fidelity: 'lossy',
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
        fidelity: 'lossy',
        label: 'Stop sequences',
        gated: 'costopt_setting.structured_output_enabled',
        placeholder: '["\\n\\nUser:"]',
        help: 'Stop sequences that end the response at the right boundary, such as an extra turn marker.',
      },
      {
        name: 'costopt_setting.structured_output_max_retries',
        kind: 'number',
        fidelity: 'lossy',
        label: 'Maximum retries',
        gated: 'costopt_setting.structured_output_enabled',
        placeholder: '1',
        help: 'How many times to retry when the output does not satisfy the constraint.',
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
      {
        name: 'costopt_setting.short_circuit_enabled',
        kind: 'bool',
        fidelity: 'lossy',
        label: 'Enable short circuit rules',
        help: 'Answers matching requests from a rule list without calling any model at all. Nothing is generated, so only use it for fixed answers such as greetings.',
      },
    ],
  },
  {
    title: 'External infrastructure required',
    // 档位 C：依赖上游 Batch / embedding / 自有 RAG。缺端点时优雅 no-op。
    desc: 'These need an external endpoint (upstream Batch API, embedding service or your own RAG). They stay inactive until you fill in the endpoint and key.',
    fields: [
      {
        name: 'costopt_setting.batch_enabled',
        kind: 'bool',
        fidelity: 'infra',
        label: 'Enable batch offload',
        help: 'Submits offline traffic to the upstream Batch API at roughly half price. Same model, just executed asynchronously. Requires upstream batch support.',
      },
      {
        name: 'costopt_setting.batch_api_base_url',
        kind: 'text',
        fidelity: 'infra',
        label: 'Batch API base URL',
        gated: 'costopt_setting.batch_enabled',
        placeholder: 'https://open.bigmodel.cn/api/paas/v4',
        help: 'Base URL of the upstream that serves the batch API. Both forms work: with or without the trailing version — the gateway appends each path exactly once.',
      },
      {
        name: 'costopt_setting.batch_api_key',
        kind: 'text',
        fidelity: 'infra',
        secret: true,
        label: 'Batch API key',
        gated: 'costopt_setting.batch_enabled',
        placeholder: 'sk-...',
        help: 'API key for the batch endpoint.',
      },
      {
        name: 'costopt_setting.batch_endpoint_path',
        kind: 'text',
        fidelity: 'infra',
        label: 'Batch submit path',
        gated: 'costopt_setting.batch_enabled',
        placeholder: '/v1/batches',
        help: 'Path used to create a batch, following the OpenAI batch convention.',
      },
      {
        name: 'costopt_setting.batch_chat_endpoint',
        kind: 'text',
        fidelity: 'infra',
        label: 'Batch inner chat endpoint',
        gated: 'costopt_setting.batch_enabled',
        placeholder: '/v1/chat/completions',
        help: 'The per-item endpoint recorded inside each batch line. Zhipu (GLM) uses the /v4 prefix — set /v4/chat/completions there, otherwise the upstream rejects the batch. Leave as default for OpenAI-compatible providers.',
      },
      {
        name: 'costopt_setting.batch_files_path',
        kind: 'text',
        fidelity: 'infra',
        label: 'Batch file upload path',
        gated: 'costopt_setting.batch_enabled',
        placeholder: '/v1/files',
        help: 'Path used to upload the JSONL batch file. Zhipu uses /v4/files.',
      },
      {
        name: 'costopt_setting.batch_result_path',
        kind: 'text',
        fidelity: 'infra',
        label: 'Batch result path',
        gated: 'costopt_setting.batch_enabled',
        placeholder: '/v1/batches/{id}',
        help: 'Path used to poll a batch by id. The {id} placeholder is replaced with the batch id.',
      },
      {
        name: 'costopt_setting.batch_completion_window',
        kind: 'text',
        fidelity: 'infra',
        label: 'Completion window',
        gated: 'costopt_setting.batch_enabled',
        placeholder: '24h',
        help: 'Upstream completion window such as 24h. Longer windows are cheaper.',
      },
      {
        name: 'costopt_setting.batch_max_items',
        kind: 'number',
        fidelity: 'infra',
        label: 'Maximum items per batch',
        gated: 'costopt_setting.batch_enabled',
        placeholder: '100',
        help: 'Flushes a batch once it reaches this many items.',
      },
      {
        name: 'costopt_setting.batch_flush_interval_seconds',
        kind: 'number',
        fidelity: 'infra',
        label: 'Flush interval in seconds',
        gated: 'costopt_setting.batch_enabled',
        placeholder: '300',
        help: 'Flushes a pending batch after this many seconds even when it is not full.',
      },
      {
        name: 'costopt_setting.batch_eligible_models',
        kind: 'json',
        fidelity: 'infra',
        label: 'Eligible models',
        gated: 'costopt_setting.batch_enabled',
        placeholder: '["glm-4-flash"]',
        help: 'Only these models are submitted as batches. Anything else passes through normally.',
      },
      {
        name: 'costopt_setting.batch_embed_enabled',
        kind: 'bool',
        fidelity: 'infra',
        label: 'Enable batch embedding',
        help: 'Submits multiple texts to a single embedding call. Requires the base URL, endpoint, API key and model below.',
      },
      {
        name: 'costopt_setting.batch_embed_base_url',
        kind: 'text',
        fidelity: 'infra',
        label: 'Batch embedding API base URL',
        gated: 'costopt_setting.batch_embed_enabled',
        placeholder: 'https://open.bigmodel.cn',
        help: 'Host of the embedding service. For Zhipu (BigModel/GLM) use https://open.bigmodel.cn — the gateway appends the endpoint path, so do not include /api/paas/v4 here.',
      },
      {
        name: 'costopt_setting.batch_embed_endpoint',
        kind: 'text',
        fidelity: 'infra',
        label: 'Batch embedding endpoint',
        gated: 'costopt_setting.batch_embed_enabled',
        placeholder: '/api/paas/v4/embeddings',
        help: 'Full embeddings path appended to the base URL. Default /v1/embeddings for OpenAI-compatible providers; Zhipu uses /api/paas/v4/embeddings.',
      },
      {
        name: 'costopt_setting.batch_embed_api_key',
        kind: 'text',
        fidelity: 'infra',
        secret: true,
        label: 'Batch embedding API key',
        gated: 'costopt_setting.batch_embed_enabled',
        placeholder: 'sk-... / Zhipu key',
        help: 'API key for the embedding service.',
      },
      {
        name: 'costopt_setting.batch_embed_model',
        kind: 'text',
        fidelity: 'infra',
        label: 'Batch embedding model',
        gated: 'costopt_setting.batch_embed_enabled',
        placeholder: 'embedding-2',
        help: 'Embedding model name. Zhipu embedding models are embedding-2 (1024-dim) and embedding-3 (2048-dim). GLM-4-Flash is a chat model and cannot produce embeddings.',
      },
      {
        name: 'costopt_setting.rag_enabled',
        kind: 'bool',
        fidelity: 'infra',
        label: 'Enable precise RAG',
        help: 'Retrieves relevant knowledge and injects it before the model answers. Requires an external RAG service.',
      },
      {
        name: 'costopt_setting.rag_endpoint',
        kind: 'text',
        fidelity: 'infra',
        label: 'RAG endpoint',
        gated: 'costopt_setting.rag_enabled',
        placeholder: 'https://rag.example.com/search',
        help: 'HTTP endpoint of your RAG service, queried with the conversation query.',
      },
      {
        name: 'costopt_setting.rag_api_key',
        kind: 'text',
        fidelity: 'infra',
        secret: true,
        label: 'RAG API key',
        gated: 'costopt_setting.rag_enabled',
        placeholder: 'rk_...',
        help: 'API key sent to the RAG endpoint. Leave empty when the service needs no authentication.',
      },
      {
        name: 'costopt_setting.rag_top_k',
        kind: 'number',
        fidelity: 'infra',
        label: 'Top K',
        gated: 'costopt_setting.rag_enabled',
        placeholder: '4',
        help: 'How many snippets to retrieve per request.',
      },
      {
        name: 'costopt_setting.rag_score_threshold',
        kind: 'number',
        fidelity: 'infra',
        label: 'Score threshold',
        gated: 'costopt_setting.rag_enabled',
        placeholder: '0.7',
        help: 'Minimum relevance score a snippet must reach before it is injected.',
      },
      {
        name: 'costopt_setting.rag_rerank_enabled',
        kind: 'bool',
        fidelity: 'infra',
        label: 'Enable rerank',
        gated: 'costopt_setting.rag_enabled',
        help: 'Re-scores retrieved snippets with a rerank model to improve their ordering.',
      },
      {
        name: 'costopt_setting.rag_rerank_model',
        kind: 'text',
        fidelity: 'infra',
        label: 'Rerank model',
        gated: 'costopt_setting.rag_enabled',
        placeholder: 'bge-reranker-v2-m3',
        help: 'Name of the reranking model exposed by your RAG service.',
      },
      {
        name: 'costopt_setting.rag_max_context_tokens',
        kind: 'number',
        fidelity: 'infra',
        label: 'Maximum context tokens',
        gated: 'costopt_setting.rag_enabled',
        placeholder: '2048',
        help: 'Upper bound on the number of tokens injected from retrieved snippets.',
      },
      {
        name: 'costopt_setting.rag_timeout_ms',
        kind: 'number',
        fidelity: 'infra',
        label: 'Timeout in milliseconds',
        gated: 'costopt_setting.rag_enabled',
        placeholder: '1500',
        help: 'How long to wait for the RAG service before continuing without it.',
      },
      {
        name: 'costopt_setting.rag_inject_position',
        kind: 'select',
        fidelity: 'infra',
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
        fidelity: 'infra',
        label: 'Build query from last N messages',
        gated: 'costopt_setting.rag_enabled',
        placeholder: '2',
        help: 'Builds the retrieval query from the last N messages of the conversation.',
      },
      {
        name: 'costopt_setting.shared_prefix_enabled',
        kind: 'bool',
        fidelity: 'infra',
        label: 'Enable shared prefix',
        help: 'Pins a stable system prefix so upstream prefix caching actually hits. The prefix text is sent on every request.',
      },
      {
        name: 'costopt_setting.shared_prefix_templates',
        kind: 'json',
        fidelity: 'infra',
        label: 'Prefix templates by model',
        gated: 'costopt_setting.shared_prefix_enabled',
        placeholder: '{"gpt-4o": "You are a helpful assistant."}',
        help: 'System prefix template per model. Reusing identical text is what produces the cache hit.',
      },
      {
        name: 'costopt_setting.shared_prefix_max_chars',
        kind: 'number',
        fidelity: 'infra',
        label: 'Maximum prefix characters',
        gated: 'costopt_setting.shared_prefix_enabled',
        placeholder: '4000',
        help: 'Truncates the shared prefix to this many characters.',
      },
      {
        name: 'costopt_setting.long_task_persist_enabled',
        kind: 'bool',
        fidelity: 'infra',
        label: 'Enable long task persistence',
        help: 'Stores confirmed facts externally and compresses history at stage boundaries instead of replaying it every round.',
      },
      {
        name: 'costopt_setting.long_task_store_endpoint',
        kind: 'text',
        fidelity: 'infra',
        label: 'Fact store endpoint',
        gated: 'costopt_setting.long_task_persist_enabled',
        placeholder: 'https://facts.example.com/store',
        help: 'HTTP endpoint that stores and retrieves the confirmed facts of a long task.',
      },
      {
        name: 'costopt_setting.long_task_fact_interval',
        kind: 'number',
        fidelity: 'infra',
        label: 'Fact extraction interval in rounds',
        gated: 'costopt_setting.long_task_persist_enabled',
        placeholder: '5',
        help: 'Extracts and persists facts every N conversation rounds.',
      },
      {
        name: 'costopt_setting.long_task_max_facts',
        kind: 'number',
        fidelity: 'infra',
        label: 'Maximum facts kept',
        gated: 'costopt_setting.long_task_persist_enabled',
        placeholder: '50',
        help: 'Cap on how many facts are retained per task.',
      },
    ],
  },
  {
    title: 'Observability and safeguards',
    // 度量与护栏：本身不省钱，但让「省了多少」可被证明，且防呆。
    desc: 'Measurement and guardrails. These do not save money by themselves, but they prove how much is saved and stop runaway spend.',
    fields: [
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
        name: 'costopt_setting.cache_warmup_enabled',
        kind: 'bool',
        label: 'Enable cache warmup',
        help: 'Preloads the exact cache from inline entries at startup so the first requests are already served warm.',
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
