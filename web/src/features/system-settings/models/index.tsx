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
  RetryTimes: 0,
  ChannelDisableThreshold: '',
  AutomaticDisableChannelEnabled: false,
  AutomaticEnableChannelEnabled: false,
  AutomaticDisableKeywords: '',
  AutomaticDisableStatusCodes: '401',
  AutomaticRetryStatusCodes:
    '100-199,300-399,401-407,409-499,500-503,505-523,525-599',
  'monitor_setting.auto_test_channel_enabled': false,
  'monitor_setting.auto_test_channel_minutes': 10,
  'monitor_setting.channel_test_concurrency': 1,
  'monitor_setting.channel_test_mode': 'scheduled_all',
  'channel_affinity_setting.enabled': false,
  'channel_affinity_setting.switch_on_success': true,
  'channel_affinity_setting.keep_on_channel_disabled': false,
  'channel_affinity_setting.max_entries': 100000,
  'channel_affinity_setting.default_ttl_seconds': 3600,
  'channel_affinity_setting.rules': '[]',
  'model_deployment.ionet.api_key': '',
  'model_deployment.ionet.enabled': false,
  // ===== 降本优化（costopt_setting.*）：默认值与后端 setting/costopt/config.go 对齐 =====
  'costopt_setting.arbitrage_mode': 'auto',
  'costopt_setting.arbitrage_price_source': 'ratio_config',
  'costopt_setting.arbitrage_model_prices': '{}',
  'costopt_setting.arbitrage_prefer_same_model_only': true,
  'costopt_setting.arbitrage_max_price_ratio': 1,
  'costopt_setting.arbitrage_auto_max_price_ratio': 1,
  'costopt_setting.arbitrage_fallback_model': '',
  'costopt_setting.value_tier_mode': 'auto',
  'costopt_setting.value_tier_model_equivalents': '{}',
  'costopt_setting.value_tier_auto_detect_bulk': true,
  'costopt_setting.value_tier_channel_types': '[]',
  'costopt_setting.value_tier_models': '[]',
  'costopt_setting.value_tier_bulk_only': true,
  'costopt_setting.value_tier_min_prompt_chars': 2000,
  'costopt_setting.value_tier_vendor_base_url': '',
  'costopt_setting.value_tier_vendor_api_key': '',
  'costopt_setting.tier_split_mode': 'auto',
  'costopt_setting.tier_split_auto_detect': true,
  'costopt_setting.tier_split_visible_models': '[]',
  'costopt_setting.tier_split_background_tags': '[]',
  'costopt_setting.tier_split_background_model': '',
  'costopt_setting.tier_split_non_stream_as_background': false,
  'costopt_setting.rag_enabled': false,
  'costopt_setting.rag_endpoint': '',
  'costopt_setting.rag_api_key': '',
  'costopt_setting.rag_top_k': 4,
  'costopt_setting.rag_score_threshold': 0.7,
  'costopt_setting.rag_rerank_enabled': true,
  'costopt_setting.rag_rerank_model': '',
  'costopt_setting.rag_max_context_tokens': 2048,
  'costopt_setting.rag_timeout_ms': 1500,
  'costopt_setting.rag_inject_position': 'system',
  'costopt_setting.rag_query_from_last_n': 2,
  'costopt_setting.batch_enabled': false,
  'costopt_setting.batch_api_base_url': '',
  'costopt_setting.batch_api_key': '',
  'costopt_setting.batch_endpoint_path': '/v1/batches',
  'costopt_setting.batch_result_path': '/v1/batches/{id}',
  'costopt_setting.batch_completion_window': '24h',
  'costopt_setting.batch_max_items': 100,
  'costopt_setting.batch_flush_interval_seconds': 300,
  'costopt_setting.batch_eligible_models': '[]',
  'costopt_setting.cdn_enabled': false,
  'costopt_setting.cdn_asset_base_url': '',
  'costopt_setting.cdn_origin_url': '',
  'costopt_setting.cdn_cache_ttl_seconds': 86400,
  'costopt_setting.cdn_path_prefixes': '[]',
  'costopt_setting.cdn_include_query': false,
  'costopt_setting.cdn_signing_header': '',
  'costopt_setting.cdn_signing_secret': '',
  'costopt_setting.shared_prefix_enabled': false,
  'costopt_setting.shared_prefix_templates': '{}',
  'costopt_setting.shared_prefix_max_chars': 4000,
  'costopt_setting.structured_output_enabled': false,
  'costopt_setting.structured_output_mode': 'json_object',
  'costopt_setting.structured_output_stop_sequences': '[]',
  'costopt_setting.structured_output_max_retries': 1,
  'costopt_setting.long_task_persist_enabled': false,
  'costopt_setting.long_task_store_endpoint': '',
  'costopt_setting.long_task_fact_interval': 5,
  'costopt_setting.long_task_max_facts': 50,
  'costopt_setting.cost_per_success_enabled': false,
  'costopt_setting.cost_per_success_signal': 'no_error',
  'costopt_setting.cost_per_success_field': '',
  'costopt_setting.cost_per_success_expected': '',
  // ===== 降本优化 · 核心已落地项（纯代码、无需外部基建）=====
  'costopt_setting.response_cache_enabled': false,
  'costopt_setting.response_cache_ttl_seconds': 300,
  'costopt_setting.response_cache_max_tokens': 4096,
  'costopt_setting.negative_cache_enabled': false,
  'costopt_setting.negative_cache_ttl_seconds': 30,
  'costopt_setting.max_tokens_cap_enabled': false,
  'costopt_setting.max_tokens_cap_global': 8192,
  'costopt_setting.loop_detection_enabled': false,
  'costopt_setting.loop_detection_threshold': 3,
  'costopt_setting.agent_step_budget_enabled': false,
  'costopt_setting.agent_step_budget_max_steps': 20,
  'costopt_setting.agent_step_budget_max_tokens': 200000,
  'costopt_setting.metrics_enabled': false,
  'costopt_setting.anomaly_alert_enabled': false,
  'costopt_setting.gzip_enabled': false,
  'costopt_setting.cascade_enabled': false,
  'costopt_setting.cascade_cheap_model': '',
  'costopt_setting.cascade_premium_model': '',
  'costopt_setting.cascade_refusal_keywords': '[]',
  'costopt_setting.semantic_cache_enabled': false,
  'costopt_setting.semantic_cache_ttl_seconds': 300,
  'costopt_setting.semantic_cache_embed_base_url': '',
  'costopt_setting.semantic_cache_embed_api_key': '',
  'costopt_setting.semantic_cache_embed_model': '',
  'costopt_setting.semantic_cache_top_k': 3,
  'costopt_setting.semantic_cache_score_threshold': 0.92,
  // ===== 模型描述多语化：默认全关，开启后才会产生外部请求与 LLM 调用 =====
  ModelDescriptionSyncEnabled: false,
  ModelDescriptionTranslateEnabled: false,
  ModelDescriptionTranslateBaseURL: '',
  ModelDescriptionTranslateApiKey: '',
  ModelDescriptionTranslateModel: '',
  ModelDescriptionTranslateLocales: '',
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
