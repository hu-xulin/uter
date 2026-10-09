package costopt

import (
	"strings"

	"github.com/uter-ai/uter/setting/config"
)

// ShortCircuitRule 零调用短路规则：命中后直接返回预设答案，根本不调上游 LLM。
// 机制：规则/正则/模板/静态 FAQ 库直接命中，省去该部分 100% 的模型调用成本。
type ShortCircuitRule struct {
	ID      string `json:"id"`
	Enabled bool   `json:"enabled"`
	// Scope 为空=全局生效；否则仅对指定分组（UsingGroup 或 TokenGroup）生效。
	Scope string `json:"scope"`
	// Model 为空=任意模型；否则仅对精确匹配该名称的请求生效。
	Model string `json:"model"`
	// Match: exact（精确相等）| contains（包含）| regex（正则）。
	Match string `json:"match"`
	// Pattern 匹配目标：请求中"最后一条用户消息"的文本。
	Pattern string `json:"pattern"`
	// CaseSensitive 是否区分大小写（默认不区分）。
	CaseSensitive bool   `json:"case_sensitive"`
	Answer        string `json:"answer"`
	// Priority 数值越大越优先匹配（用于多条规则共存时排序）。
	Priority int `json:"priority"`
}

// CostOptSetting 降本中间层配置（轻资产业务无关、纯软件，无服务器重资产）。
// 全部字段通过 config.GlobalConfig 从数据库 Options 表加载（前缀 costopt_setting.）。
type CostOptSetting struct {
	// 精确缓存（Redis 响应缓存 + 租户隔离 + in-flight 合并）
	ResponseCacheEnabled bool `json:"response_cache_enabled"`
	// ResponseCacheTTLSeconds 缓存生存时间（秒），默认 300。
	ResponseCacheTTLSeconds int `json:"response_cache_ttl_seconds"`
	// ResponseCacheMaxTokens 仅缓存 completion_tokens <= 该值的成功响应，避免大响应占内存，默认 4096。
	ResponseCacheMaxTokens int `json:"response_cache_max_tokens"`

	// 零调用短路规则层
	ShortCircuitEnabled bool               `json:"short_circuit_enabled"`
	ShortCircuitRules   []ShortCircuitRule `json:"short_circuit_rules"`

	// 输出长度成本硬上限（max_tokens 封顶，防输出失控）
	MaxTokensCapEnabled bool           `json:"max_tokens_cap_enabled"`
	MaxTokensCapGlobal  int            `json:"max_tokens_cap_global"`
	MaxTokensCapByGroup map[string]int `json:"max_tokens_cap_by_group"`
	// MaxTokensCapByChannel key=渠道类型名（constant.GetChannelTypeName）
	MaxTokensCapByChannel map[string]int `json:"max_tokens_cap_by_channel"`

	// 上下文滑动窗口 / 对话摘要（轻资产：裁掉旧消息，或用便宜模型压成摘要）
	ContextWindowEnabled        bool   `json:"context_window_enabled"`
	ContextWindowMaxMessages    int    `json:"context_window_max_messages"`    // 保留最近 N 条，超出部分裁掉或摘要
	ContextWindowSummaryEnabled bool   `json:"context_window_summary_enabled"` // 溢出前缀用便宜模型压成摘要
	ContextWindowSummaryModel   string `json:"context_window_summary_model"`   // 摘要用的便宜模型（如 haiku 级）
	SummaryAPIBaseURL           string `json:"summary_api_base_url"`           // OpenAI 兼容端点
	SummaryAPIKey               string `json:"summary_api_key"`

	// 负缓存：确定性失败请求短期不重复烧钱重试
	NegativeCacheEnabled    bool `json:"negative_cache_enabled"`
	NegativeCacheTTLSeconds int  `json:"negative_cache_ttl_seconds"`

	// 轻量复杂度路由（启发式把简单任务降级到便宜模型）
	ComplexityRoutingEnabled    bool     `json:"complexity_routing_enabled"`
	ComplexityRoutingFromModels []string `json:"complexity_routing_from_models"` // 仅对这些源模型做降级
	ComplexityRoutingCheapModel string   `json:"complexity_routing_cheap_model"` // 降级目标便宜模型

	// 突增 / 尖峰告警（每租户 token 速率）
	SpikeAlertEnabled      bool    `json:"spike_alert_enabled"`
	SpikeAlertTokensPerMin int     `json:"spike_alert_tokens_per_min"` // 单租户每分钟 token 硬阈值
	SpikeAlertMultiplier   float64 `json:"spike_alert_multiplier"`     // 超过基线倍数也告警

	// 图像下采样代理（视觉 token 降本，纯字符串改写，不引入图像解码依赖）
	ImageResizeEnabled       bool   `json:"image_resize_enabled"`
	ImageResizeMaxEdge       int    `json:"image_resize_max_edge"`       // 长边最大像素
	ImageResizeProxyTemplate string `json:"image_resize_proxy_template"` // 如 https://wsrv.nl/?url={url}&w={max}

	// gzip 响应压缩（按 Accept-Encoding 自动压缩所有响应）
	GzipEnabled bool `json:"gzip_enabled"`

	// 成本感知路由（多供应商自动择优）：按渠道类型名（constant.GetChannelTypeName）
	// 偏置选路权重，让运营把流量导向更便宜的供应商。key=渠道类型名，value=权重倍数(>=1)。
	CostAwareRoutingEnabled    bool           `json:"cost_aware_routing_enabled"`
	CostAwareChannelTypeWeight map[string]int `json:"cost_aware_channel_type_weight"`

	// ===== 以下为 V2 剩余特性（全部配置门控，缺外部服务时优雅 no-op） =====

	// 3. LLM 级联 Cascade：先调便宜模型，命中拒绝/低质关键词则升级贵模型
	CascadeEnabled         bool     `json:"cascade_enabled"`
	CascadeCheapModel      string   `json:"cascade_cheap_model"`
	CascadePremiumModel    string   `json:"cascade_premium_model"`
	CascadeRefusalKeywords []string `json:"cascade_refusal_keywords"`

	// 9. 地理/区域比价：按请求头区域路由到偏好的渠道类型
	GeoRoutingEnabled             bool              `json:"geo_routing_enabled"`
	GeoRoutingRegionHeader        string            `json:"geo_routing_region_header"`
	GeoRoutingChannelTypeByRegion map[string]string `json:"geo_routing_channel_type_by_region"`

	// 10. RouterLM 选模：用小型 router 模型替用户选最优上游
	RouterLMEnabled    bool     `json:"router_lm_enabled"`
	RouterLMModel      string   `json:"router_lm_model"`
	RouterLMAPIBaseURL string   `json:"router_lm_api_base_url"`
	RouterLMAPIKey     string   `json:"router_lm_api_key"`
	RouterLMFromModels []string `json:"router_lm_from_models"`

	// 14. 语义缓存：可配 embedding 端点 + Redis 向量近似匹配
	SemanticCacheEnabled        bool    `json:"semantic_cache_enabled"`
	SemanticCacheTTLSeconds     int     `json:"semantic_cache_ttl_seconds"`
	SemanticCacheEmbedBaseURL   string  `json:"semantic_cache_embed_base_url"`
	SemanticCacheEmbedAPIKey    string  `json:"semantic_cache_embed_api_key"`
	SemanticCacheEmbedModel     string  `json:"semantic_cache_embed_model"`
	SemanticCacheTopK           int     `json:"semantic_cache_top_k"`
	SemanticCacheScoreThreshold float64 `json:"semantic_cache_score_threshold"`
	SemanticCacheDim            int     `json:"semantic_cache_dim"`

	// 15. 工具/检索结果缓存：按工具名+参数哈希缓存结果
	ToolResultCacheEnabled    bool `json:"tool_result_cache_enabled"`
	ToolResultCacheTTLSeconds int  `json:"tool_result_cache_ttl_seconds"`

	// 16. 缓存预热：从内联条目预填精确缓存
	CacheWarmupEnabled bool          `json:"cache_warmup_enabled"`
	CacheWarmupEntries []WarmupEntry `json:"cache_warmup_entries"`

	// 18. 边缘/CDN：静态资源前缀（文档站/资源走 CDN）
	CDNEnabled      bool   `json:"cdn_enabled"`
	CDNAssetBaseURL string `json:"cdn_asset_base_url"`

	// 19. Prompt 压缩：用便宜压缩模型压短 system/历史
	PromptCompressionEnabled    bool    `json:"prompt_compression_enabled"`
	PromptCompressionModel      string  `json:"prompt_compression_model"`
	PromptCompressionAPIBaseURL string  `json:"prompt_compression_api_base_url"`
	PromptCompressionAPIKey     string  `json:"prompt_compression_api_key"`
	PromptCompressionMaxRatio   float64 `json:"prompt_compression_max_ratio"`

	// 21. 工具定义精简：发送前裁剪 tools schema
	ToolDefTrimEnabled          bool `json:"tool_def_trim_enabled"`
	ToolDefTrimStripDescription bool `json:"tool_def_trim_strip_description"`
	ToolDefTrimStripExamples    bool `json:"tool_def_trim_strip_examples"`

	// 28. 精准 RAG（基础开关与端点；其余参数见下方 V2.2「模型优化」配置区）
	RAGEnabled  bool   `json:"rag_enabled"`
	RAGEndpoint string `json:"rag_endpoint"`
	RAGAPIKey   string `json:"rag_api_key"`

	// 29. 长任务状态持久化：把旧事实外置为系统注记（复用摘要能力）
	LongTaskPersistEnabled bool `json:"long_task_persist_enabled"`

	// 31. Batch 转批：离线流量半价（队列+批量端点，异步取结果桩）
	BatchEnabled             bool     `json:"batch_enabled"`
	BatchAPIBaseURL          string   `json:"batch_api_base_url"`
	BatchAPIKey              string   `json:"batch_api_key"`
	BatchEligibleModels      []string `json:"batch_eligible_models"`
	BatchPollIntervalSeconds int      `json:"batch_poll_interval_seconds"`

	// 32. 批量 Embedding：一次提交多个文本
	BatchEmbedEnabled bool   `json:"batch_embed_enabled"`
	BatchEmbedBaseURL string `json:"batch_embed_base_url"`
	BatchEmbedAPIKey  string `json:"batch_embed_api_key"`
	BatchEmbedModel   string `json:"batch_embed_model"`

	// 33. Agent 步数预算：按会话步数/Token 预算
	AgentStepBudgetEnabled   bool   `json:"agent_step_budget_enabled"`
	AgentStepBudgetMaxSteps  int    `json:"agent_step_budget_max_steps"`
	AgentStepBudgetMaxTokens int    `json:"agent_step_budget_max_tokens"`
	AgentStepBudgetHeader    string `json:"agent_step_budget_header"`

	// 35. 工具调用去重
	ToolCallDedupEnabled bool `json:"tool_call_dedup_enabled"`

	// 36. 循环/收敛检测
	LoopDetectionEnabled   bool `json:"loop_detection_enabled"`
	LoopDetectionThreshold int  `json:"loop_detection_threshold"`

	// 40. 可观测性看板：暴露聚合指标端点
	MetricsEnabled bool `json:"metrics_enabled"`

	// 41. 成本 per 成功任务
	CostPerSuccessEnabled bool `json:"cost_per_success_enabled"`

	// 43. 异常用量审计增强
	AnomalyAlertEnabled bool `json:"anomaly_alert_enabled"`

	// ===== 以下为 V2.2「模型优化」配置区字段 =====
	// 定位：V2 中标记为 🟡（基础设施具备或仅部分覆盖）的项，缺的都是「上游参数」或
	// 「策略开关」。这些参数集中在后台「模型与路由 → 模型部署 → 模型优化」下填写，
	// 填完即由钩子升级为完整能力；留空则维持优雅 no-op，不影响主链路。

	// 4/5. 多供应商套利 + 同模型跨通道比价：自动择优引擎
	//
	// 三态模式：auto（默认）| manual | off
	//   - auto：自动按「渠道对该模型的有效单价」择优。单价来自渠道 model_mapping 后的
	//     上游模型定价（ratio_setting），无需手填任何价目表；手填项作为覆盖/约束。
	//   - manual：只用下方手填价目表做择优（V2.2 行为）。
	//   - off：关闭。
	// 未配置（老版本 Options 表无该键）时回退到 ArbitrageEnabled 遗留开关。
	ArbitrageMode string `json:"arbitrage_mode"`
	// ArbitrageEnabled 遗留总开关：仅当 ArbitrageMode 为空时作为回退判定。
	ArbitrageEnabled bool `json:"arbitrage_enabled"`
	// ArbitragePriceSource 取价来源：ratio_config（用渠道倍率折算）| manual（用下方价目表）。
	ArbitragePriceSource string `json:"arbitrage_price_source"`
	// ArbitrageModelPrices 手动价目表：key="供应商/模型"（如 "groq/llama-3.3-70b"），
	// value=每百万 input token 的美元单价。auto 模式下作为覆盖值优先于自动推算。
	ArbitrageModelPrices map[string]float64 `json:"arbitrage_model_prices"`
	// ArbitragePreferSameModelOnly 仅在同一模型名跨通道间比价（#5 场景：direct/Bedrock/Azure）。
	ArbitragePreferSameModelOnly bool `json:"arbitrage_prefer_same_model_only"`
	// ArbitrageMaxPriceRatio 最贵候选相对最便宜候选的价差上限（1.0=只选最便宜）。
	ArbitrageMaxPriceRatio float64 `json:"arbitrage_max_price_ratio"`
	// ArbitrageAutoMaxPriceRatio 自动择优的价差容忍：1.0=严格最便宜；>1 时在容忍范围内
	// 仍按权重随机，避免所有流量压到单一渠道（默认 1.0）。
	ArbitrageAutoMaxPriceRatio float64 `json:"arbitrage_auto_max_price_ratio"`
	// ArbitrageFallbackModel 价目表完全未命中时的兜底模型（空=不改模型）。
	ArbitrageFallbackModel string `json:"arbitrage_fallback_model"`

	// 6. Serverless 开源模型价值层（Groq / Fireworks / DeepInfra 等）
	// 三态模式同 4/5：auto 默认自动（自动识别 bulk 流量 + 自动在等价组内选最便宜）。
	ValueTierMode string `json:"value_tier_mode"`
	// ValueTierEnabled 遗留总开关（ValueTierMode 为空时回退）。
	ValueTierEnabled bool `json:"value_tier_enabled"`
	// ValueTierChannelTypes 价值层渠道类型名清单（constant.GetChannelTypeName 口径）。
	// auto 模式下留空=不限渠道类型，纯按单价择优；填了则只在清单内择优。
	ValueTierChannelTypes []string `json:"value_tier_channel_types"`
	// ValueTierModels 允许下沉到价值层的开源模型名清单（留空=不限）。
	ValueTierModels []string `json:"value_tier_models"`
	// ValueTierModelEquivalents 等价模型组：key=原模型，value=可下沉的开源模型清单。
	// auto 模式下自动在组内选有效单价最低者下沉。例：{"gpt-4o": ["llama-3.3-70b", "qwen2.5-72b"]}
	// 质量等价关系必须由人工确认，故该表是「自动执行 + 手动定义边界」的分界点。
	ValueTierModelEquivalents map[string][]string `json:"value_tier_model_equivalents"`
	// ValueTierBulkOnly 仅对 bulk（长 prompt）流量下沉，短交互仍走前沿模型。
	ValueTierBulkOnly bool `json:"value_tier_bulk_only"`
	// ValueTierAutoDetectBulk auto 模式下自动判定 bulk 流量（按 ValueTierMinPromptChars）。
	ValueTierAutoDetectBulk bool `json:"value_tier_auto_detect_bulk"`
	// ValueTierMinPromptChars bulk 判定阈值（用户消息字符数）。
	ValueTierMinPromptChars int `json:"value_tier_min_prompt_chars"`
	// ValueTierVendorBaseURL / Key 未接入独立渠道时的直连端点（可选，留空走渠道机制）。
	ValueTierVendorBaseURL string `json:"value_tier_vendor_base_url"`
	ValueTierVendorAPIKey  string `json:"value_tier_vendor_api_key"`

	// 7. A-tier + 价值层混合：用户可见走贵模，后台走便宜模
	// 三态模式同 4/5：auto 默认自动识别后台流量并下沉。
	TierSplitMode string `json:"tier_split_mode"`
	// TierSplitEnabled 遗留总开关（TierSplitMode 为空时回退）。
	TierSplitEnabled bool `json:"tier_split_enabled"`
	// TierSplitVisibleModels 用户可见请求保留的前沿模型（不参与下沉）。
	TierSplitVisibleModels []string `json:"tier_split_visible_models"`
	// TierSplitBackgroundTags 后台任务标记：命中请求头/元信息即判定为后台流量。
	TierSplitBackgroundTags []string `json:"tier_split_background_tags"`
	// TierSplitAutoDetect auto 模式下自动识别后台流量的显式信号
	// （X-Uter-Background / X-Uter-Async / X-Uter-Task 头，或模型名 -batch、:background 后缀）。
	TierSplitAutoDetect bool `json:"tier_split_auto_detect"`
	// TierSplitNonStreamAsBackground 把非流式请求也视为后台流量。
	// ⚠️ 默认 false：非流式不等于后台，开启会把大量交互式请求判为后台，可能掉质量。
	TierSplitNonStreamAsBackground bool `json:"tier_split_non_stream_as_background"`
	// TierSplitBackgroundModel 后台流量使用的便宜模型。
	// auto 模式下留空则回退到 ValueTierModelEquivalents 组内最便宜者。
	TierSplitBackgroundModel string `json:"tier_split_background_model"`

	// 18. 边缘 / CDN 静态资源缓存（需 CDN 基建，参数填齐后由钩子升级为完整能力）
	CDNCacheTTLSeconds int `json:"cdn_cache_ttl_seconds"`
	// CDNOriginURL 回源地址（CDN 未命中时回源）。
	CDNOriginURL string `json:"cdn_origin_url"`
	// CDNIncludeQuery 缓存键是否包含 query string。
	CDNIncludeQuery bool `json:"cdn_include_query"`
	// CDNPathPrefixes 只有这些前缀走 CDN（空=全部静态资源）。
	CDNPathPrefixes []string `json:"cdn_path_prefixes"`
	// CDNSigningHeader / Secret 回源鉴权（可选），留空不签名。
	CDNSigningHeader string `json:"cdn_signing_header"`
	CDNSigningSecret string `json:"cdn_signing_secret"`

	// 24. 结构化输出约束（中转层强制策略，避免模型啰嗦输出）
	StructuredOutputEnabled bool `json:"structured_output_enabled"`
	// StructuredOutputMode：json_object | json_schema | stop。
	StructuredOutputMode string `json:"structured_output_mode"`
	// StructuredOutputStopSequences 强制追加的停止序列。
	StructuredOutputStopSequences []string `json:"structured_output_stop_sequences"`
	// StructuredOutputMaxRetries 结构校验失败后的最大重发次数。
	StructuredOutputMaxRetries int `json:"structured_output_max_retries"`

	// 28. 精准 RAG（需外部 RAG 系统，参数填齐后钩子升级为真实检索）
	RAGTopK int `json:"rag_top_k"`
	// RAGScoreThreshold 检索得分下限，低于该值的片段直接丢弃（紧 top-k 的关键）。
	RAGScoreThreshold float64 `json:"rag_score_threshold"`
	// RAGRerankEnabled 是否启用重排（rerank），显著提升精度并省 token。
	RAGRerankEnabled bool `json:"rag_rerank_enabled"`
	// RAGRerankModel 重排模型名（由 RAG 服务端解释）。
	RAGRerankModel string `json:"rag_rerank_model"`
	// RAGMaxContextTokens 注入上下文的 token 上限，超出截断。
	RAGMaxContextTokens int `json:"rag_max_context_tokens"`
	// RAGTimeoutMS 检索超时（毫秒），超时静默降级不阻塞主链路。
	RAGTimeoutMS int `json:"rag_timeout_ms"`
	// RAGInjectPosition 注入位置：system | user。
	RAGInjectPosition string `json:"rag_inject_position"`
	// RAGQueryFromLastN 用最后 N 条消息拼检索 query。
	RAGQueryFromLastN int `json:"rag_query_from_last_n"`

	// 29. 长任务状态持久化（外部存事实，边界压缩）
	// LongTaskStoreEndpoint 外部事实存储端点（可选；留空则用进程内摘要外置）。
	LongTaskStoreEndpoint string `json:"long_task_store_endpoint"`
	// LongTaskFactInterval 每 N 轮做一次事实提取与外置。
	LongTaskFactInterval int `json:"long_task_fact_interval"`
	// LongTaskMaxFacts 保留的最大事实条数，超出丢弃最旧。
	LongTaskMaxFacts int `json:"long_task_max_facts"`

	// 30. 共享系统前缀 / 模板化（稳定前缀置顶，配合 Prompt Caching）
	SharedPrefixEnabled bool `json:"shared_prefix_enabled"`
	// SharedPrefixTemplates key=模型名（"*" 为通配），value=稳定前缀文本。
	SharedPrefixTemplates map[string]string `json:"shared_prefix_templates"`
	// SharedPrefixMaxChars 前缀最大字符数，超出截断（防前缀过长反噬缓存）。
	SharedPrefixMaxChars int `json:"shared_prefix_max_chars"`

	// 31. Batch 转批（需上游 Batch API，参数填齐后队列桩升级为真实提交）
	// BatchCompletionWindow 上游承诺完成窗口（如 "24h"）。
	BatchCompletionWindow string `json:"batch_completion_window"`
	// BatchMaxItems 单批最大条目数，达到即触发提交。
	BatchMaxItems int `json:"batch_max_items"`
	// BatchFlushIntervalSeconds 距上次 flush 超过该秒数也触发提交。
	BatchFlushIntervalSeconds int `json:"batch_flush_interval_seconds"`
	// BatchEndpointPath 提交端点路径（默认 /v1/batches）。
	BatchEndpointPath string `json:"batch_endpoint_path"`
	// BatchResultPath 结果查询路径模板（默认 /v1/batches/{id}）。
	BatchResultPath string `json:"batch_result_path"`
	// BatchMetadata 随批提交的元数据（便于对账）。
	BatchMetadata map[string]string `json:"batch_metadata"`

	// 41. 成本 per 成功任务（补上「成功信号」，避免省 token 却降质量的假节省）
	// CostPerSuccessSignal 成功判定来源：http_ok | no_error | json_field。
	CostPerSuccessSignal string `json:"cost_per_success_signal"`
	// CostPerSuccessField / Expected 仅在 json_field 模式下生效：
	// 解析响应体 JSON 指定字段，等于期望值才算成功。
	CostPerSuccessField    string `json:"cost_per_success_field"`
	CostPerSuccessExpected string `json:"cost_per_success_expected"`
}

// WarmupEntry 缓存预热条目：把一组 (model, messages) 直接映射到预置响应体。
type WarmupEntry struct {
	Model    string `json:"model"`
	Messages string `json:"messages"` // JSON 数组（OpenAI messages 格式）
	Response string `json:"response"` // 预置响应体（完整 JSON）
}

var costOptSetting = CostOptSetting{
	ResponseCacheEnabled:    false,
	ResponseCacheTTLSeconds: 300,
	ResponseCacheMaxTokens:  4096,
	ShortCircuitEnabled:     false,
	MaxTokensCapEnabled:     false,
	MaxTokensCapGlobal:      8192,

	ContextWindowEnabled:     false,
	ContextWindowMaxMessages: 20,
	NegativeCacheEnabled:     false,
	NegativeCacheTTLSeconds:  30,
	ComplexityRoutingEnabled: false,
	SpikeAlertEnabled:        false,
	SpikeAlertTokensPerMin:   200000,
	SpikeAlertMultiplier:     5,
	ImageResizeEnabled:       false,
	ImageResizeMaxEdge:       1024,
	GzipEnabled:              false,
	CostAwareRoutingEnabled:  false,

	// V2 剩余特性默认值（全部默认关闭）
	CascadeEnabled:              false,
	GeoRoutingEnabled:           false,
	RouterLMEnabled:             false,
	SemanticCacheEnabled:        false,
	SemanticCacheTTLSeconds:     300,
	SemanticCacheTopK:           3,
	SemanticCacheScoreThreshold: 0.92,
	ToolResultCacheEnabled:      false,
	ToolResultCacheTTLSeconds:   600,
	CacheWarmupEnabled:          false,
	CDNEnabled:                  false,
	PromptCompressionEnabled:    false,
	PromptCompressionMaxRatio:   0.5,
	ToolDefTrimEnabled:          false,
	RAGEnabled:                  false,
	RAGEndpoint:                 "",
	RAGAPIKey:                   "",
	LongTaskPersistEnabled:      false,
	BatchEnabled:                false,
	BatchPollIntervalSeconds:    30,
	BatchEmbedEnabled:           false,
	AgentStepBudgetEnabled:      false,
	AgentStepBudgetMaxSteps:     20,
	AgentStepBudgetMaxTokens:    200000,
	ToolCallDedupEnabled:        false,
	LoopDetectionEnabled:        false,
	LoopDetectionThreshold:      3,
	MetricsEnabled:              false,
	CostPerSuccessEnabled:       false,
	AnomalyAlertEnabled:         false,

	// V2.2「降本优化」默认值
	// #4/#5/#6/#7 默认走 auto：自动实现 + 手动可配置。自动模式从渠道 model_mapping 后的
	// 上游模型定价自动推算有效单价并择优，无需手填价目表；手填项作为覆盖/边界约束。
	ArbitrageMode:                "auto",
	ArbitrageEnabled:             false,
	ArbitragePriceSource:         "ratio_config",
	ArbitrageMaxPriceRatio:       1.0,
	ArbitrageAutoMaxPriceRatio:   1.0,
	ArbitragePreferSameModelOnly: true,

	ValueTierMode:           "auto",
	ValueTierEnabled:        false,
	ValueTierMinPromptChars: 2000,
	ValueTierBulkOnly:       true,
	ValueTierAutoDetectBulk: true,

	TierSplitMode:                  "auto",
	TierSplitEnabled:               false,
	TierSplitAutoDetect:            true,
	TierSplitNonStreamAsBackground: false,

	CDNCacheTTLSeconds: 86400,
	CDNIncludeQuery:    false,

	StructuredOutputEnabled:    false,
	StructuredOutputMode:       "json_object",
	StructuredOutputMaxRetries: 1,

	RAGTopK:             4,
	RAGScoreThreshold:   0.7,
	RAGRerankEnabled:    true,
	RAGMaxContextTokens: 2048,
	RAGTimeoutMS:        1500,
	RAGInjectPosition:   "system",
	RAGQueryFromLastN:   2,

	LongTaskFactInterval: 5,
	LongTaskMaxFacts:     50,

	SharedPrefixEnabled:  false,
	SharedPrefixMaxChars: 4000,

	BatchCompletionWindow:     "24h",
	BatchMaxItems:             100,
	BatchFlushIntervalSeconds: 300,
	BatchEndpointPath:         "/v1/batches",
	BatchResultPath:           "/v1/batches/{id}",

	CostPerSuccessSignal: "no_error",
}

func init() {
	// 注册到全局配置管理器，使其从 Options 表加载（前缀 costopt_setting.）
	config.GlobalConfig.Register("costopt_setting", &costOptSetting)
}

// GetCostOptSetting 获取降本中间层配置（返回包级变量指针，加载后原地更新）。
func GetCostOptSetting() *CostOptSetting {
	return &costOptSetting
}

// ===== 三态模式判定：auto（默认）| manual | off =====
//
// #4/#5/#6/#7 的定位是「自动实现 + 手动可配置，默认走自动」：
//   - auto：自动推算每个渠道对该模型的有效单价并择优，无需手填价目表；
//     手填参数退化为「覆盖/边界约束」（等价模型组、渠道类型白名单、兜底模型等）。
//   - manual：只按手填参数执行（不给任何自动推导）。
//   - off：关闭。
//
// 兼容逻辑：Options 表若已存在旧版 enabled 键，mode 为空时回退到 enabled，
// 保证老部署升级后行为不变；新部署（无 mode 键）直接用 Go 默认值 auto。

// modeActive 判定三态模式是否生效；mode 为空时回退 legacy（旧 enabled 开关）。
func modeActive(mode string, legacy bool) bool {
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "off":
		return false
	case "auto", "manual":
		return true
	}
	return legacy
}

// modeIsAuto 判定是否为自动模式（mode 为空视为 auto，即默认走自动）。
func modeIsAuto(mode string) bool {
	m := strings.ToLower(strings.TrimSpace(mode))
	return m == "" || m == "auto"
}

// ArbitrageActive 多供应商套利 + 同模型跨通道比价（#4/#5）是否生效。
func (c *CostOptSetting) ArbitrageActive() bool {
	return modeActive(c.ArbitrageMode, c.ArbitrageEnabled)
}

// ArbitrageAuto #4/#5 是否为自动模式（自动按有效单价择优）。
func (c *CostOptSetting) ArbitrageAuto() bool {
	return c.ArbitrageActive() && modeIsAuto(c.ArbitrageMode)
}

// ValueTierActive Serverless 开源模型价值层（#6）是否生效。
func (c *CostOptSetting) ValueTierActive() bool {
	return modeActive(c.ValueTierMode, c.ValueTierEnabled)
}

// ValueTierAuto #6 是否为自动模式。
func (c *CostOptSetting) ValueTierAuto() bool {
	return c.ValueTierActive() && modeIsAuto(c.ValueTierMode)
}

// TierSplitActive A-tier + 价值层混合（#7）是否生效。
func (c *CostOptSetting) TierSplitActive() bool {
	return modeActive(c.TierSplitMode, c.TierSplitEnabled)
}

// TierSplitAuto #7 是否为自动模式（自动识别后台流量）。
func (c *CostOptSetting) TierSplitAuto() bool {
	return c.TierSplitActive() && modeIsAuto(c.TierSplitMode)
}

// AutoPriceFirst 选路层是否应按有效单价择优。
// #4/#5/#6/#7 任一处于自动模式即开启——它们的比价动作最终都落在渠道选择上。
func (c *CostOptSetting) AutoPriceFirst() bool {
	return c.ArbitrageAuto() || c.ValueTierAuto() || c.TierSplitAuto()
}

// ArbitrageTolerance 自动择优的价差容忍（<=0 视为 1.0，即严格选最便宜）。
// 大于 1 时在容忍范围内仍按权重随机，避免把全部流量压到单一渠道。
func (c *CostOptSetting) ArbitrageTolerance() float64 {
	if c.ArbitrageAutoMaxPriceRatio > 0 {
		return c.ArbitrageAutoMaxPriceRatio
	}
	if c.ArbitrageMaxPriceRatio > 0 {
		return c.ArbitrageMaxPriceRatio
	}
	return 1.0
}
