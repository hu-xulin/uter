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
export type SystemOption = {
  key: string
  value: string
}

export type SystemOptionKey = string

export type SystemOptionsResponse = {
  success: boolean
  message: string
  data: SystemOption[]
}

export type UpdateOptionRequest = {
  key: string
  value: string | boolean | number
}

export type UpdateOptionResponse = {
  success: boolean
  message: string
}

export interface PasskeyDomainChange {
  rp_id: string
  legacy_rp_ids: string
  origins: string
  previous_rp_id: string
  effective_rp_id: string
  removed_rp_ids: string[]
  affected_credentials: number
  unknown_credentials: number
  confirmation_required: boolean
  removal_confirmation: string
}

export interface UpdatePasskeyDomainsRequest {
  rp_id: string
  legacy_rp_ids: string
  origins: string
  preview: boolean
  removal_confirmation?: string
}

export interface UpdatePasskeyDomainsResponse extends UpdateOptionResponse {
  code?: string
  data: PasskeyDomainChange
}

export type ConfirmPaymentComplianceResponse = {
  success: boolean
  message: string
  data?: {
    confirmed: boolean
    terms_version: string
    confirmed_at: number
    confirmed_by: number
  }
}

export type SystemTaskStatus = 'pending' | 'running' | 'succeeded' | 'failed'

export type SystemTask<
  TPayload = Record<string, unknown>,
  TState = Record<string, unknown>,
  TResult = Record<string, unknown>,
> = {
  id: number
  task_id: string
  type: string
  status: SystemTaskStatus
  active_key?: string
  payload?: TPayload
  state?: TState
  result?: TResult
  error?: string
  locked_by?: string
  locked_until?: number
  created_at: number
  updated_at: number
}

export type LogCleanupTaskPayload = {
  target_timestamp: number
  batch_size: number
}

export type LogCleanupTaskState = {
  total: number
  processed: number
  progress: number
  remaining: number
}

export type LogCleanupTaskResult = {
  deleted_count: number
}

export type LogCleanupTask = SystemTask<
  LogCleanupTaskPayload,
  LogCleanupTaskState,
  LogCleanupTaskResult
>

export type SystemTaskResponse<TTask = SystemTask | null> = {
  success: boolean
  message: string
  data?: TTask
}

export type SystemTaskListResponse = {
  success: boolean
  message: string
  data?: SystemTask[]
  total: number
}

export type SystemTaskFilters = {
  type?: string
  status?: SystemTaskStatus | ''
  scope?: 'active' | 'history'
  offset?: number
}

export type SiteSettings = {
  Notice: string
  SystemName: string
  Logo: string
  Footer: string
  About: string
  HomePageContent: string
  ServerAddress: string
  TaskPublicAddress: string
  'general_setting.docs_link': string
  'legal.user_agreement': string
  'legal.privacy_policy': string
  'legal.recharge_agreement': string
  HeaderNavModules: string
  SidebarModulesAdmin: string
  /** 智能客服入口总开关；与后端 common.CustomerServiceEnabled 对应。 */
  CustomerServiceEnabled: boolean
  /**
   * 智能客服入口的页面级白名单（逗号分隔的页面键）；与后端
   * common.CustomerServicePages 对应。两种特殊值：空串表示未配置 = 全部页面都开
   * （后端 NormalizeCustomerServicePages 会展开成全部键）；"none" 表示全部页面都关。
   */
  CustomerServicePages: string
  /**
   * 智能客服（uter-cs）管理员令牌（敏感）。前端只用来判断「是否已配置」，绝不在表单里
   * 回显明文。真正保存/代理调用发生在 Uter 后端（controller/customer_service_deploy.go），
   * 它拿这个值作为 Bearer 令牌转发到 uter-cs 的管理端 API。
   */
  CustomerServiceAdminToken: string
}

export type AuthSettings = {
  PasswordLoginEnabled: boolean
  PasswordRegisterEnabled: boolean
  EmailCodeLoginEnabled: boolean
  EmailVerificationEnabled: boolean
  RegisterEnabled: boolean
  EmailDomainRestrictionEnabled: boolean
  EmailAliasRestrictionEnabled: boolean
  EmailDomainWhitelist: string
  ServerAddress: string
  GitHubOAuthEnabled: boolean
  GitHubClientId: string
  GitHubClientSecret: string
  'discord.enabled': boolean
  'discord.client_id': string
  'discord.client_secret': string
  'oidc.enabled': boolean
  'oidc.display_name': string
  'oidc.client_id': string
  'oidc.client_secret': string
  'oidc.well_known': string
  'oidc.authorization_endpoint': string
  'oidc.token_endpoint': string
  'oidc.user_info_endpoint': string
  TelegramOAuthEnabled: boolean
  'telegram.client_id': string
  'telegram.client_secret': string
  TelegramBotToken: string
  TelegramBotName: string
  LinuxDOOAuthEnabled: boolean
  LinuxDOClientId: string
  LinuxDOClientSecret: string
  LinuxDOMinimumTrustLevel: string
  WeChatAuthEnabled: boolean
  WeChatServerAddress: string
  WeChatServerToken: string
  WeChatAccountQRCodeImageURL: string
  WeChatAccountQRCodeImagePath: string
  WeChatWebAuthEnabled: boolean
  WeChatWebAppId: string
  WeChatWebAppSecret: string
  WeChatWebCallbackDomain: string
  WeChatWebUseUnionId: boolean
  TurnstileCheckEnabled: boolean
  TurnstileSiteKey: string
  TurnstileSecretKey: string
  'passkey.enabled': boolean
  'passkey.rp_display_name': string
  'passkey.rp_id': string
  'passkey.legacy_rp_ids': string
  'passkey.origins': string
  'passkey.allow_insecure_origin': boolean
  'passkey.user_verification': 'required' | 'preferred' | 'discouraged'
  'passkey.attachment_preference': '' | 'platform' | 'cross-platform'
}

export type ContentSettings = {
  'console_setting.api_info': string
  'console_setting.announcements': string
  'console_setting.faq': string
  'console_setting.uptime_kuma_groups': string
  'console_setting.api_info_enabled': boolean
  'console_setting.announcements_enabled': boolean
  'console_setting.faq_enabled': boolean
  'console_setting.uptime_kuma_enabled': boolean
  DataExportEnabled: boolean
  DataExportDefaultTime: string
  DataExportInterval: number
  Chats: string
  DrawingEnabled: boolean
  MjNotifyEnabled: boolean
  MjAccountFilterEnabled: boolean
  MjForwardUrlEnabled: boolean
  MjModeClearEnabled: boolean
  MjActionCheckSuccessEnabled: boolean
}

export type ModelSettings = {
  'global.pass_through_request_enabled': boolean
  'global.thinking_model_blacklist': string
  'global.chat_completions_to_responses_policy': string
  'general_setting.ping_interval_enabled': boolean
  'general_setting.ping_interval_seconds': number
  'gemini.safety_settings': string
  'gemini.version_settings': string
  'gemini.supported_imagine_models': string
  'gemini.thinking_adapter_enabled': boolean
  'gemini.thinking_adapter_budget_tokens_percentage': number
  'gemini.function_call_thought_signature_enabled': boolean
  'gemini.remove_function_response_id_enabled': boolean
  'claude.model_headers_settings': string
  'claude.default_max_tokens': string
  'claude.thinking_adapter_enabled': boolean
  'claude.thinking_adapter_budget_tokens_percentage': number
  'grok.violation_deduction_enabled': boolean
  'grok.violation_deduction_amount': number
  ModelPrice: string
  ModelRatio: string
  CacheRatio: string
  CreateCacheRatio: string
  CompletionRatio: string
  ImageRatio: string
  AudioRatio: string
  AudioCompletionRatio: string
  ExposeRatioEnabled: boolean
  'billing_setting.billing_mode': string
  'billing_setting.billing_expr': string
  'billing_setting.plugin_billing_expr': string
  'tool_price_setting.prices': string
  TopupGroupRatio: string
  GroupRatio: string
  UserUsableGroups: string
  GroupGroupRatio: string
  AutoGroups: string
  MaxTokenAutoGroups: number
  DefaultUseAutoGroup: boolean
  'group_ratio_setting.group_special_usable_group': string
  'model_deployment.ionet.api_key': string
  'model_deployment.ionet.enabled': boolean
  /**
   * 降本优化（costopt）字段：由后端 `setting/costopt/config.go` 的 json tag 决定，
   * 数量多且随版本演进，这里用模板字面量索引签名统一承载，避免每加一个开关
   * 都要同时改类型与默认值两处。
   */
  [key: `costopt_setting.${string}`]: string | number | boolean
  /**
   * 模型描述多语化：上游目录按语种各有一份文件，其余语种由站内 LLM 补译。
   * 默认全关，管理员需显式开启并填齐翻译端点（base + key + model）才生效。
   */
  ModelDescriptionSyncEnabled: boolean
  ModelDescriptionTranslateEnabled: boolean
  ModelDescriptionTranslateBaseURL: string
  ModelDescriptionTranslateApiKey: string
  ModelDescriptionTranslateModel: string
  ModelDescriptionTranslateLocales: string
  /**
   * 渠道登录与同步：上游渠道凭据 + 同步时刻 + 价格规则。
   * 口令是 secret 键，GET /api/option/ 以掩码串下发（不返回明文）。
   */
  DreamRouterSyncEnabled: boolean
  DreamRouterSyncProvider: string
  DreamRouterSyncChannelID: string
  DreamRouterSyncUsername: string
  DreamRouterSyncPassword: string
  DreamRouterSyncRuleDirection: string
  DreamRouterSyncRuleAmount: string
}

export type BillingSettings = {
  QuotaForNewUser: number
  QuotaForInviter: number
  QuotaForInvitee: number
  TopUpLink: string
  'quota_setting.enable_free_model_pre_consume': boolean
  'quota_setting.trust_quota_usd': number
  'quota_setting.pre_consume_multiplier': number
  QuotaPerUnit: number
  USDExchangeRate: number
  /** A 最近一次成功同步外部行情的时间（Unix 秒，0 表示从未同步）。 */
  USDExchangeRateUpdatedAt: number
  'general_setting.quota_display_type': string
  'general_setting.custom_currency_symbol': string
  'general_setting.custom_currency_exchange_rate': number
  DisplayInCurrencyEnabled: boolean
  DisplayTokenStatEnabled: boolean
  ModelPrice: string
  ModelRatio: string
  CacheRatio: string
  CreateCacheRatio: string
  CompletionRatio: string
  ImageRatio: string
  AudioRatio: string
  AudioCompletionRatio: string
  ExposeRatioEnabled: boolean
  'billing_setting.billing_mode': string
  'billing_setting.billing_expr': string
  'billing_setting.plugin_billing_expr': string
  'tool_price_setting.prices': string
  /** Global model plaza pricing source: official | models.dev | channel. */
  PricingSource: string
  /** Per-channel model pricing overrides (JSON). See setting/custom_pricing. */
  ChannelPriceSetting: string
  /** Per-(channel, model) routing weight & priority overrides (JSON). See setting/channel_weight. */
  ChannelModelWeight: string
  /** Per-user monthly consumption tier multipliers (JSON). */
  UserPriceSetting: string
  TopupGroupRatio: string
  GroupRatio: string
  UserUsableGroups: string
  GroupGroupRatio: string
  AutoGroups: string
  MaxTokenAutoGroups: number
  DefaultUseAutoGroup: boolean
  'group_ratio_setting.group_special_usable_group': string
  PayAddress: string
  EpayId: string
  EpayKey: string
  Price: number
  MinTopUp: number
  CustomCallbackAddress: string
  PaymentSiteAddress: string
  PayMethods: string
  'payment_setting.amount_options': string
  'payment_setting.amount_discount': string
  'payment_setting.order_title_prefix': string
  'payment_setting.compliance_confirmed': boolean
  'payment_setting.compliance_terms_version': string
  'payment_setting.compliance_confirmed_at': number
  'payment_setting.compliance_confirmed_by': number
  'payment_setting.compliance_confirmed_ip': string
  StripeApiSecret: string
  StripeWebhookSecret: string
  StripePriceId: string
  StripeUnitPrice: number
  StripeMinTopUp: number
  StripePromotionCodesEnabled: boolean
  CreemApiKey: string
  CreemWebhookSecret: string
  CreemTestMode: boolean
  CreemProducts: string
  WaffoEnabled: boolean
  WaffoApiKey: string
  WaffoPrivateKey: string
  WaffoPublicCert: string
  WaffoSandboxPublicCert: string
  WaffoSandboxApiKey: string
  WaffoSandboxPrivateKey: string
  WaffoSandbox: boolean
  WaffoMerchantId: string
  WaffoCurrency: string
  WaffoUnitPrice: number
  WaffoMinTopUp: number
  WaffoNotifyUrl: string
  WaffoReturnUrl: string
  WaffoPayMethods: string
  WaffoPancakeMerchantID: string
  WaffoPancakePrivateKey: string
  WaffoPancakeReturnURL: string
  // Bound by the operator through the catalog flow in the admin Pancake
  // section (saved via /api/option/waffo-pancake/save).
  WaffoPancakeStoreID: string
  WaffoPancakeProductID: string
  /** 钱包入口显式开关：关闭后钱包不露出 Waffo Pancake 充值入口（已支付订单仍由 webhook 结算）。默认开启。 */
  WaffoPancakeEnabled: boolean
  // Official China payments (Alipay 当面付 / WeChat Pay Native)
  AlipayEnabled: boolean
  AlipayAppId: string
  AlipayPrivateKey: string
  AlipayPublicKey: string
  WechatPayEnabled: boolean
  WechatPayMchId: string
  WechatPayAppId: string
  WechatPayApiV3Key: string
  WechatPaySerialNo: string
  WechatPayPrivateKey: string
  WechatPayPublicKey: string
  'checkin_setting.enabled': boolean
  'checkin_setting.min_quota': number
  'checkin_setting.max_quota': number
}

export type OperationsSettings = {
  DefaultCollapseSidebar: boolean
  DemoSiteEnabled: boolean
  SelfUseModeEnabled: boolean
  QuotaRemindEnabled: boolean
  QuotaRemindThreshold: string
  EmailProvider: 'smtp' | 'resend'
  ResendApiKey: string
  ResendKeyConfigured: boolean
  ResendFrom: string
  SMTPServer: string
  SMTPPort: string
  SMTPAccount: string
  SMTPFrom: string
  SMTPToken: string
  SMTPSSLEnabled: boolean
  SMTPStartTLSEnabled: boolean
  SMTPInsecureSkipVerify: boolean
  SMTPForceAuthLogin: boolean
  WorkerUrl: string
  WorkerValidKey: string
  WorkerAllowHttpImageRequestEnabled: boolean
  LogConsumeEnabled: boolean
  'log_setting.user_export_enabled': boolean
  'log_setting.max_range_days': number
  'performance_setting.disk_cache_enabled': boolean
  'performance_setting.disk_cache_threshold_mb': number
  'performance_setting.disk_cache_max_size_mb': number
  'performance_setting.disk_cache_path': string
  'performance_setting.monitor_enabled': boolean
  'performance_setting.monitor_cpu_threshold': number
  'performance_setting.monitor_memory_threshold': number
  'performance_setting.monitor_disk_threshold': number
  'perf_metrics_setting.enabled': boolean
  'perf_metrics_setting.flush_interval': number
  'perf_metrics_setting.bucket_time': 'hour' | 'minute' | '5min'
  'perf_metrics_setting.retention_days': number
}

export type SecuritySettings = {
  ModelRequestRateLimitEnabled: boolean
  ModelRequestRateLimitCount: number
  ModelRequestRateLimitSuccessCount: number
  ModelRequestRateLimitDurationMinutes: number
  ModelRequestRateLimitGroup: string
  CheckSensitiveEnabled: boolean
  CheckSensitiveOnPromptEnabled: boolean
  SensitiveWords: string
  'fetch_setting.enable_ssrf_protection': boolean
  'fetch_setting.allow_private_ip': boolean
  'fetch_setting.domain_filter_mode': boolean
  'fetch_setting.ip_filter_mode': boolean
  'fetch_setting.domain_list': string[]
  'fetch_setting.ip_list': string[]
  'fetch_setting.allowed_ports': number[]
  'fetch_setting.apply_ip_filter_for_domain': boolean
  'token_setting.max_user_tokens': number
}

export type UpstreamChannel = {
  id: number
  name: string
  base_url: string
  status: number
  type?: number
}

export type RatioType =
  | 'model_ratio'
  | 'completion_ratio'
  | 'cache_ratio'
  | 'create_cache_ratio'
  | 'image_ratio'
  | 'audio_ratio'
  | 'audio_completion_ratio'
  | 'model_price'
  | 'billing_mode'
  | 'billing_expr'

export type RatioDifference = {
  current: number | string | null
  upstreams: Record<string, number | string | 'same'>
  confidence: Record<string, boolean>
}

export type DifferencesMap = Record<
  string,
  Partial<Record<RatioType, RatioDifference>>
>

export type PricingSyncValues = Partial<Record<RatioType, number | string>>
export type PricingSyncModels = Record<
  string,
  { current: PricingSyncValues; upstreams: Record<string, PricingSyncValues> }
>

export type UpstreamChannelsResponse = {
  success: boolean
  message: string
  data: UpstreamChannel[]
}

export type UpstreamConfig = {
  id: number
  name: string
  base_url: string
  endpoint: string
}

export type FetchUpstreamRatiosRequest = {
  upstreams: UpstreamConfig[]
  timeout: number
}

export type TestResult = {
  name: string
  status: 'success' | 'error'
  error?: string
}

export type UpstreamRatiosResponse = {
  success: boolean
  message: string
  data: {
    differences: DifferencesMap
    prices: PricingSyncModels
    test_results: TestResult[]
  }
}

// ── 渠道登录与同步（上游 创梦 / DreamRouter）────────────────────────────
//
// 价格单位：按量/分层计费为美元 / 1M tokens，按次计费为美元 / 次。
export type DreamRouterPriceLine = {
  input: number
  output: number
  cache: number
  create_cache: number
}

export type DreamRouterSyncModelRow = {
  upstream_name: string
  local_name: string
  billing_class: 'per_token' | 'per_call' | 'tiered' | 'tiered_unparsable'
  quota_type: number
  group_ratio: number
  official: DreamRouterPriceLine
  upstream: DreamRouterPriceLine
  uter: DreamRouterPriceLine
  upstream_discount_percent: number
  uter_discount_percent: number
  upstream_zhe: number
  uter_zhe: number
  aligned: boolean
  note?: string
}

export type DreamRouterSyncModelsResponse = {
  success: boolean
  message: string
  data: {
    synced: boolean
    pricing_version?: string
    synced_at?: string
    rule_direction?: string
    rule_amount?: number
    channel_id?: number
    models: DreamRouterSyncModelRow[]
    summary: {
      total?: number
      aligned?: number
      drifted?: number
      all_aligned?: boolean
    }
  }
}

export type DreamRouterSyncStatusResponse = {
  success: boolean
  message: string
  data: {
    enabled: boolean
    channel_id: number
    step: number
    username: string
    provider: string
    rule_direction: string
    rule_amount: number
    password_configured: boolean
    last_run_at: string
    last_error: string
    last_result: string
  }
}

export type DreamRouterRunResponse = {
  success: boolean
  message: string
  data: {
    // upstream_count 是上游 data[] 的原始记录数，含 vendor 缺失的孤儿记录；
    // offered_count 才是真正同步进渠道的在售模型数。verifiable_count 是复核
    // 的分母（排除孤儿记录与无法解析表达式的模型），因此
    // verified === verifiable_count 才代表本轮完全对齐。
    upstream_count: number
    offered_count?: number
    verifiable_count?: number
    verified: number
    misaligned?: string[]
    added_models?: string[]
    removed_models?: string[]
    skipped_models?: { name: string; reason: string }[]
    warnings?: string[]
    applied: boolean
    dry_run: boolean
  }
}
