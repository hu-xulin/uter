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
import { SettingsPage } from '../components/settings-page'
import type { ModelSettings } from '../types'
import {
  MODELS_DEFAULT_SECTION,
  getModelsSectionContent,
  getModelsSectionMeta,
} from './section-registry.tsx'

const defaultModelSettings: ModelSettings = {
  'global.pass_through_request_enabled': false,
  'global.thinking_model_blacklist': '[]',
  'global.chat_completions_to_responses_policy': '{}',
  'general_setting.ping_interval_enabled': false,
  'general_setting.ping_interval_seconds': 60,
  'gemini.safety_settings': '',
  'gemini.version_settings': '',
  'gemini.supported_imagine_models': '',
  'gemini.thinking_adapter_enabled': false,
  'gemini.thinking_adapter_budget_tokens_percentage': 0.6,
  'gemini.function_call_thought_signature_enabled': true,
  'gemini.remove_function_response_id_enabled': true,
  'claude.model_headers_settings': '',
  'claude.default_max_tokens': '',
  'claude.thinking_adapter_enabled': true,
  'claude.thinking_adapter_budget_tokens_percentage': 0.8,
  'grok.violation_deduction_enabled': true,
  'grok.violation_deduction_amount': 0.05,
  ModelPrice: '',
  ModelRatio: '',
  CacheRatio: '',
  CreateCacheRatio: '',
  CompletionRatio: '',
  ImageRatio: '',
  AudioRatio: '',
  AudioCompletionRatio: '',
  ExposeRatioEnabled: false,
  'billing_setting.billing_mode': '{}',
  'billing_setting.billing_expr': '{}',
  'billing_setting.plugin_billing_expr': '{}',
  'tool_price_setting.prices': '{}',
  TopupGroupRatio: '',
  GroupRatio: '',
  UserUsableGroups: '',
  GroupGroupRatio: '',
  AutoGroups: '',
  MaxTokenAutoGroups: 5,
  DefaultUseAutoGroup: false,
  'group_ratio_setting.group_special_usable_group': '{}',
  'model_deployment.ionet.api_key': '',
  'model_deployment.ionet.enabled': false,
  // ===== 降本优化（costopt_setting.*）：默认值与后端 setting/costopt/config.go 对齐 =====
  // 填写说明（前端默认值种子，改这里只影响新部署/重置后的初值，不改动线上已存配置）：
  //   · 零风险组：默认全开。它们不改变模型所见内容，响应逐字节相同，省的是重复劳动。
  //   · 需外部基建组：端点与模型名已按选定供应商填好；密钥留空待录入，故开关保持关闭。
  //   · 供应商选择：Batch 与批量 embedding 用智谱 BigModel（/v4 前缀）；
  //     若要改用 SiliconFlow，把 base_url 换成 https://api.siliconflow.cn/v1 并相应改路径。
  //     精准 RAG 用自建服务，rag_endpoint / rag_api_key 待填。
  // ===== 1) 零风险降本（推荐全开，不改变模型所见内容）=====
  'costopt_setting.response_cache_enabled': true,
  'costopt_setting.response_cache_ttl_seconds': 300,
  'costopt_setting.response_cache_max_tokens': 4096,
  'costopt_setting.negative_cache_enabled': true,
  'costopt_setting.negative_cache_ttl_seconds': 30,
  'costopt_setting.tool_call_dedup_enabled': true,
  'costopt_setting.loop_detection_enabled': true,
  'costopt_setting.loop_detection_threshold': 3,
  'costopt_setting.gzip_enabled': true,
  'costopt_setting.tool_result_cache_enabled': true,
  'costopt_setting.tool_result_cache_ttl_seconds': 600,
  // ===== 2) 成本护栏（防单请求成本失控；默认关闭，开启后能挡住失控暴涨）=====
  // 说明：这两组会截断输出（属有损），但性质是保护而非省钱，故保留代码与配置。
  // 开关默认 false —— 是否启用由运营决定；阈值取宽松值，开启后不影响正常长度的应答。
  'costopt_setting.max_tokens_cap_enabled': false,
  'costopt_setting.max_tokens_cap_global': 8192,
  'costopt_setting.agent_step_budget_enabled': false,
  'costopt_setting.agent_step_budget_max_steps': 20,
  'costopt_setting.agent_step_budget_max_tokens': 200000,
  // ===== 3) 同模型渠道套利（模型名不变，只换通路）=====
  'costopt_setting.arbitrage_mode': 'auto',
  'costopt_setting.arbitrage_price_source': 'ratio_config',
  'costopt_setting.arbitrage_model_prices': '{}',
  'costopt_setting.arbitrage_prefer_same_model_only': true,
  'costopt_setting.arbitrage_max_price_ratio': 1,
  'costopt_setting.arbitrage_auto_max_price_ratio': 1.15,
  // ===== 4) 需外部基建：Batch 转批（智谱 BigModel /v4）=====
  'costopt_setting.batch_enabled': false,
  'costopt_setting.batch_api_base_url': 'https://open.bigmodel.cn/api/paas/v4',
  'costopt_setting.batch_api_key': '',
  'costopt_setting.batch_endpoint_path': '/v4/batches',
  'costopt_setting.batch_chat_endpoint': '/v4/chat/completions',
  'costopt_setting.batch_files_path': '/v4/files',
  'costopt_setting.batch_result_path': '/v4/batches/{id}',
  'costopt_setting.batch_completion_window': '24h',
  'costopt_setting.batch_max_items': 100,
  'costopt_setting.batch_flush_interval_seconds': 300,
  'costopt_setting.batch_eligible_models': '[]',
  // ===== 5) 需外部基建：批量 embedding（智谱 embedding-2）=====
  'costopt_setting.batch_embed_enabled': false,
  'costopt_setting.batch_embed_base_url': 'https://open.bigmodel.cn',
  'costopt_setting.batch_embed_endpoint': '/api/paas/v4/embeddings',
  'costopt_setting.batch_embed_api_key': '',
  'costopt_setting.batch_embed_model': 'embedding-2',
  // ===== 6) 需外部基建：精准 RAG（自建服务）=====
  'costopt_setting.rag_enabled': false,
  'costopt_setting.rag_endpoint': '',
  'costopt_setting.rag_api_key': '',
  'costopt_setting.rag_top_k': 4,
  'costopt_setting.rag_score_threshold': 0.7,
  'costopt_setting.rag_rerank_enabled': true,
  'costopt_setting.rag_rerank_model': 'bge-reranker-v2-m3',
  'costopt_setting.rag_max_context_tokens': 2048,
  'costopt_setting.rag_timeout_ms': 1500,
  'costopt_setting.rag_inject_position': 'system',
  'costopt_setting.rag_query_from_last_n': 2,
  // ===== 7) 需外部基建：共享前缀 / 长任务持久化 =====
  'costopt_setting.shared_prefix_enabled': false,
  'costopt_setting.shared_prefix_templates': '{}',
  'costopt_setting.shared_prefix_max_chars': 4000,
  'costopt_setting.long_task_persist_enabled': false,
  'costopt_setting.long_task_store_endpoint': '',
  'costopt_setting.long_task_fact_interval': 5,
  'costopt_setting.long_task_max_facts': 50,
  // ===== 8) 可观测与告警 =====
  'costopt_setting.metrics_enabled': true,
  'costopt_setting.cost_per_success_enabled': false,
  'costopt_setting.cost_per_success_signal': 'no_error',
  'costopt_setting.cost_per_success_field': 'success',
  'costopt_setting.cost_per_success_expected': 'true',
  'costopt_setting.spike_alert_enabled': true,
  'costopt_setting.spike_alert_tokens_per_min': 200000,
  'costopt_setting.spike_alert_multiplier': 5,
  'costopt_setting.anomaly_alert_enabled': true,
  'costopt_setting.cache_warmup_enabled': false,
  // ===== 模型描述多语化：默认全关，开启后才会产生外部请求与 LLM 调用 =====
  ModelDescriptionSyncEnabled: false,
  ModelDescriptionTranslateEnabled: false,
  ModelDescriptionTranslateBaseURL: '',
  ModelDescriptionTranslateApiKey: '',
  ModelDescriptionTranslateModel: '',
  // 待补译语种 = 除英语外的全部 6 语。上游目录只提供 zh/en/ja 且覆盖不全，
  // 故 zh/ja 也纳入兜底；补译只填空白位，已存在的描述不会被覆盖。
  ModelDescriptionTranslateLocales: 'zh, zh-TW, fr, ja, ru, vi',
  // ===== 渠道登录与同步（默认值与后端 service/dreamrouter_sync.go 对齐）=====
  // 默认开启同步：上游口径的模型与折扣每日一变，不开同步会让定价长期滞后。
  // 口令默认空串 = 未配置；后端会明确报错提示去后台填，不会用明文兜底。
  DreamRouterSyncEnabled: true,
  DreamRouterSyncProvider: 'dreamrouter',
  DreamRouterSyncChannelID: '20',
  DreamRouterSyncUsername: '',
  DreamRouterSyncPassword: '',
  DreamRouterSyncHour: '0',
  DreamRouterSyncRuleDirection: 'increase',
  DreamRouterSyncRuleAmount: '0.1',
}

export function ModelSettings() {
  return (
    <SettingsPage
      routePath='/_authenticated/system-settings/models/$section'
      defaultSettings={defaultModelSettings}
      defaultSection={MODELS_DEFAULT_SECTION}
      getSectionContent={getModelsSectionContent}
      getSectionMeta={getModelsSectionMeta}
    />
  )
}
