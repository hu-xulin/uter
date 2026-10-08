package i18n

const MsgTaskPluginUnknownMetaField = "task_plugin.unknown_meta_field"
const MsgTaskPluginUnsupportedCapability = "task_plugin.unsupported_capability"
const MsgTaskPluginDuplicateCapability = "task_plugin.duplicate_capability"

// Message keys for i18n translations
// Use these constants instead of hardcoded strings

// Common error messages
const (
	MsgInvalidParams     = "common.invalid_params"
	MsgDatabaseError     = "common.database_error"
	MsgRetryLater        = "common.retry_later"
	MsgGenerateFailed    = "common.generate_failed"
	MsgNotFound          = "common.not_found"
	MsgUnauthorized      = "common.unauthorized"
	MsgForbidden         = "common.forbidden"
	MsgInvalidId         = "common.invalid_id"
	MsgIdEmpty           = "common.id_empty"
	MsgFeatureDisabled   = "common.feature_disabled"
	MsgOperationSuccess  = "common.operation_success"
	MsgOperationFailed   = "common.operation_failed"
	MsgUpdateSuccess     = "common.update_success"
	MsgUpdateFailed      = "common.update_failed"
	MsgCreateSuccess     = "common.create_success"
	MsgCreateFailed      = "common.create_failed"
	MsgDeleteSuccess     = "common.delete_success"
	MsgDeleteFailed      = "common.delete_failed"
	MsgAlreadyExists     = "common.already_exists"
	MsgNameCannotBeEmpty = "common.name_cannot_be_empty"
	MsgBatchTooMany      = "common.batch_too_many"
	// MsgAuthMethodUnsupported is used when the current sign-in method
	// cannot be used to complete a security verification step.
	MsgAuthMethodUnsupported = "common.auth_method_unsupported"
)

// Auth middleware messages
const (
	MsgAuthNotLoggedIn           = "auth.not_logged_in"
	MsgAuthAccessTokenInvalid    = "auth.access_token_invalid"
	MsgAuthUserInfoInvalid       = "auth.user_info_invalid"
	MsgAuthUserIdNotProvided     = "auth.user_id_not_provided"
	MsgAuthUserIdFormatError     = "auth.user_id_format_error"
	MsgAuthUserIdMismatch        = "auth.user_id_mismatch"
	MsgAuthUserBanned            = "auth.user_banned"
	MsgAuthInsufficientPrivilege = "auth.insufficient_privilege"
)

// Token related messages
const (
	MsgTokenNameTooLong          = "token.name_too_long"
	MsgTokenQuotaNegative        = "token.quota_negative"
	MsgTokenQuotaExceedMax       = "token.quota_exceed_max"
	MsgTokenGenerateFailed       = "token.generate_failed"
	MsgTokenGetInfoFailed        = "token.get_info_failed"
	MsgTokenExpiredCannotEnable  = "token.expired_cannot_enable"
	MsgTokenExhaustedCannotEable = "token.exhausted_cannot_enable"
	MsgTokenInvalid              = "token.invalid"
	MsgTokenNotProvided          = "token.not_provided"
	MsgTokenExpired              = "token.expired"
	MsgTokenExhausted            = "token.exhausted"
	MsgTokenStatusUnavailable    = "token.status_unavailable"
	MsgTokenDbError              = "token.db_error"
	MsgTokenAutoGroupsTooMany    = "token.auto_groups_too_many"
	MsgTokenAutoGroupsDuplicate  = "token.auto_groups_duplicate"
	MsgTokenAutoGroupsInvalid    = "token.auto_groups_invalid"
	// MsgTokenAllowIpsInvalid is returned when the IP allowlist contains an
	// entry that is neither a single IP nor a valid CIDR range.
	MsgTokenAllowIpsInvalid = "token.allow_ips_invalid"
	// MsgTokenExpiredTimeInvalid is returned when the expiry time is in the
	// past (or 0). Only -1 (never expire) or a future timestamp is accepted.
	MsgTokenExpiredTimeInvalid = "token.expired_time_invalid"
)

// Redemption related messages
const (
	MsgRedemptionNameLength        = "redemption.name_length"
	MsgRedemptionCountPositive     = "redemption.count_positive"
	MsgRedemptionCountMax          = "redemption.count_max"
	MsgRedemptionCreateFailed      = "redemption.create_failed"
	MsgRedemptionInvalid           = "redemption.invalid"
	MsgRedemptionUsed              = "redemption.used"
	MsgRedemptionExpired           = "redemption.expired"
	MsgRedemptionFailed            = "redemption.failed"
	MsgRedemptionNotProvided       = "redemption.not_provided"
	MsgRedemptionExpireTimeInvalid = "redemption.expire_time_invalid"
)

// User related messages
const (
	MsgUserPasswordLoginDisabled     = "user.password_login_disabled"
	MsgUserRegisterDisabled          = "user.register_disabled"
	MsgUserPasswordRegisterDisabled  = "user.password_register_disabled"
	MsgUserUsernameOrPasswordEmpty   = "user.username_or_password_empty"
	MsgUserUsernameOrPasswordError   = "user.username_or_password_error"
	MsgUserEmailOrPasswordEmpty      = "user.email_or_password_empty"
	MsgUserExists                    = "user.exists"
	MsgUserNotExists                 = "user.not_exists"
	MsgUserDisabled                  = "user.disabled"
	MsgUserSessionSaveFailed         = "user.session_save_failed"
	MsgUserRequire2FA                = "user.require_2fa"
	MsgUserEmailVerificationRequired = "user.email_verification_required"
	MsgUserVerificationCodeError     = "user.verification_code_error"
	MsgUserEmailAlreadyTaken         = "user.email_already_taken"
	MsgUserPasswordUnset             = "user.password_unset"
	MsgUserPasswordResetLinkInvalid  = "user.password_reset_link_invalid"
	MsgUserInputInvalid              = "user.input_invalid"
	MsgUserPasswordTooShort          = "user.password_too_short"
	MsgUserPasswordTooLong           = "user.password_too_long"
	MsgUserPasswordTooSimple         = "user.password_too_simple"
	MsgUserPasswordTooCommon         = "user.password_too_common"
	MsgUserPasswordContainsAccount   = "user.password_contains_account"
	MsgUserNoPermissionSameLevel     = "user.no_permission_same_level"
	MsgUserNoPermissionHigherLevel   = "user.no_permission_higher_level"
	MsgUserCannotCreateHigherLevel   = "user.cannot_create_higher_level"
	MsgUserCannotDeleteRootUser      = "user.cannot_delete_root_user"
	MsgUserCannotDisableRootUser     = "user.cannot_disable_root_user"
	MsgUserCannotDemoteRootUser      = "user.cannot_demote_root_user"
	MsgUserAlreadyAdmin              = "user.already_admin"
	MsgUserAlreadyCommon             = "user.already_common"
	MsgUserAdminCannotPromote        = "user.admin_cannot_promote"
	MsgUserOriginalPasswordError     = "user.original_password_error"
	MsgUserInviteQuotaInsufficient   = "user.invite_quota_insufficient"
	MsgUserTransferQuotaMinimum      = "user.transfer_quota_minimum"
	MsgUserTransferSuccess           = "user.transfer_success"
	MsgUserTransferFailed            = "user.transfer_failed"
	MsgUserTopUpProcessing           = "user.topup_processing"
	MsgUserRegisterFailed            = "user.register_failed"
	MsgUserDefaultTokenFailed        = "user.default_token_failed"
	MsgUserAffCodeEmpty              = "user.aff_code_empty"
	MsgUserEmailEmpty                = "user.email_empty"
	MsgUserGitHubIdEmpty             = "user.github_id_empty"
	MsgUserDiscordIdEmpty            = "user.discord_id_empty"
	MsgUserOidcIdEmpty               = "user.oidc_id_empty"
	MsgUserWeChatIdEmpty             = "user.wechat_id_empty"
	MsgUserTelegramIdEmpty           = "user.telegram_id_empty"
	MsgUserTelegramNotBound          = "user.telegram_not_bound"
	MsgUserLinuxDOIdEmpty            = "user.linux_do_id_empty"
	MsgUserQuotaChangeZero           = "user.quota_change_zero"
)

// Quota related messages
const (
	MsgQuotaNegative        = "quota.negative"
	MsgQuotaExceedMax       = "quota.exceed_max"
	MsgQuotaInsufficient    = "quota.insufficient"
	MsgQuotaWarningInvalid  = "quota.warning_invalid"
	MsgQuotaThresholdGtZero = "quota.threshold_gt_zero"
)

// Subscription related messages
const (
	MsgSubscriptionNotEnabled       = "subscription.not_enabled"
	MsgSubscriptionTitleEmpty       = "subscription.title_empty"
	MsgSubscriptionPriceNegative    = "subscription.price_negative"
	MsgSubscriptionPriceMax         = "subscription.price_max"
	MsgSubscriptionPurchaseLimitNeg = "subscription.purchase_limit_negative"
	MsgSubscriptionQuotaNegative    = "subscription.quota_negative"
	MsgSubscriptionGroupNotExists   = "subscription.group_not_exists"
	MsgSubscriptionResetCycleGtZero = "subscription.reset_cycle_gt_zero"
	MsgSubscriptionPurchaseMax      = "subscription.purchase_max"
	MsgSubscriptionInvalidId        = "subscription.invalid_id"
	MsgSubscriptionInvalidUserId    = "subscription.invalid_user_id"
)

// Payment related messages
const (
	MsgPaymentNotConfigured      = "payment.not_configured"
	MsgPaymentMethodNotExists    = "payment.method_not_exists"
	MsgPaymentCallbackError      = "payment.callback_error"
	MsgPaymentCreateFailed       = "payment.create_failed"
	MsgPaymentStartFailed        = "payment.start_failed"
	MsgPaymentAmountTooLow       = "payment.amount_too_low"
	MsgPaymentStripeNotConfig    = "payment.stripe_not_configured"
	MsgPaymentWebhookNotConfig   = "payment.webhook_not_configured"
	MsgPaymentPriceIdNotConfig   = "payment.price_id_not_configured"
	MsgPaymentCreemNotConfig     = "payment.creem_not_configured"
	MsgPaymentComplianceRequired = "payment.compliance_required"
)

// Topup related messages
const (
	MsgTopupNotProvided    = "topup.not_provided"
	MsgTopupOrderNotExists = "topup.order_not_exists"
	MsgTopupOrderStatus    = "topup.order_status"
	MsgTopupFailed         = "topup.failed"
	MsgTopupInvalidQuota   = "topup.invalid_quota"
)

// Channel related messages
const (
	MsgChannelNotExists          = "channel.not_exists"
	MsgChannelIdFormatError      = "channel.id_format_error"
	MsgChannelNoAvailableKey     = "channel.no_available_key"
	MsgChannelGetListFailed      = "channel.get_list_failed"
	MsgChannelGetTagsFailed      = "channel.get_tags_failed"
	MsgChannelGetKeyFailed       = "channel.get_key_failed"
	MsgChannelGetOllamaFailed    = "channel.get_ollama_failed"
	MsgChannelQueryFailed        = "channel.query_failed"
	MsgChannelNoValidUpstream    = "channel.no_valid_upstream"
	MsgChannelUpstreamSaturated  = "channel.upstream_saturated"
	MsgChannelGetAvailableFailed = "channel.get_available_failed"
)

// Model related messages
const (
	MsgModelNameEmpty     = "model.name_empty"
	MsgModelNameExists    = "model.name_exists"
	MsgModelIdMissing     = "model.id_missing"
	MsgModelGetListFailed = "model.get_list_failed"
	MsgModelGetFailed     = "model.get_failed"
	MsgModelResetSuccess  = "model.reset_success"
)

// Vendor related messages
const (
	MsgVendorNameEmpty  = "vendor.name_empty"
	MsgVendorNameExists = "vendor.name_exists"
	MsgVendorIdMissing  = "vendor.id_missing"
)

// Group related messages
const (
	MsgGroupNameTypeEmpty = "group.name_type_empty"
	MsgGroupNameExists    = "group.name_exists"
	MsgGroupIdMissing     = "group.id_missing"
)

// Checkin related messages
const (
	MsgCheckinDisabled     = "checkin.disabled"
	MsgCheckinAlreadyToday = "checkin.already_today"
	MsgCheckinFailed       = "checkin.failed"
	MsgCheckinQuotaFailed  = "checkin.quota_failed"
)

// Passkey related messages
const (
	MsgPasskeyCreateFailed            = "passkey.create_failed"
	MsgPasskeyLoginAbnormal           = "passkey.login_abnormal"
	MsgPasskeyUpdateFailed            = "passkey.update_failed"
	MsgPasskeyInvalidUserId           = "passkey.invalid_user_id"
	MsgPasskeyVerifyFailed            = "passkey.verify_failed"
	MsgPasskeyRPIDInvalid             = "passkey.rp_id_invalid"
	MsgPasskeyRPIDUnavailable         = "passkey.rp_id_unavailable"
	MsgPasskeyRPIDRemovalConfirmation = "passkey.rp_id_removal_confirmation"
	MsgPasskeyNotEnabled              = "passkey.not_enabled"
	MsgPasskeyInvalidRequest          = "passkey.invalid_request"
	MsgPasskeyNotBound                = "passkey.not_bound"
	MsgPasskeyRegisterSuccess         = "passkey.register_success"
	MsgPasskeyDeleted                 = "passkey.deleted"
	MsgPasskeyReset                   = "passkey.reset"
)

// 2FA related messages
const (
	MsgTwoFANotEnabled    = "twofa.not_enabled"
	MsgTwoFAUserIdEmpty   = "twofa.user_id_empty"
	MsgTwoFAAlreadyExists = "twofa.already_exists"
	MsgTwoFARecordIdEmpty = "twofa.record_id_empty"
	MsgTwoFACodeInvalid   = "twofa.code_invalid"
)

// Rate limit related messages
const (
	MsgRateLimitReached      = "rate_limit.reached"
	MsgRateLimitTotalReached = "rate_limit.total_reached"
)

// Setting related messages
const (
	MsgSettingInvalidType      = "setting.invalid_type"
	MsgSettingWebhookEmpty     = "setting.webhook_empty"
	MsgSettingWebhookInvalid   = "setting.webhook_invalid"
	MsgSettingEmailInvalid     = "setting.email_invalid"
	MsgSettingBarkUrlEmpty     = "setting.bark_url_empty"
	MsgSettingBarkUrlInvalid   = "setting.bark_url_invalid"
	MsgSettingGotifyUrlEmpty   = "setting.gotify_url_empty"
	MsgSettingGotifyTokenEmpty = "setting.gotify_token_empty"
	MsgSettingGotifyUrlInvalid = "setting.gotify_url_invalid"
	MsgSettingUrlMustHttp      = "setting.url_must_http"
	MsgSettingSaved            = "setting.saved"
)

// Deployment related messages (io.net)
const (
	MsgDeploymentNotEnabled     = "deployment.not_enabled"
	MsgDeploymentIdRequired     = "deployment.id_required"
	MsgDeploymentContainerIdReq = "deployment.container_id_required"
	MsgDeploymentNameEmpty      = "deployment.name_empty"
	MsgDeploymentNameTaken      = "deployment.name_taken"
	MsgDeploymentHardwareIdReq  = "deployment.hardware_id_required"
	MsgDeploymentHardwareInvId  = "deployment.hardware_invalid_id"
	MsgDeploymentApiKeyRequired = "deployment.api_key_required"
	MsgDeploymentInvalidPayload = "deployment.invalid_payload"
	MsgDeploymentNotFound       = "deployment.not_found"
)

// Performance related messages
const (
	MsgPerfDiskCacheCleared = "performance.disk_cache_cleared"
	MsgPerfStatsReset       = "performance.stats_reset"
	MsgPerfGcExecuted       = "performance.gc_executed"
)

// Ability related messages
const (
	MsgAbilityDbCorrupted   = "ability.db_corrupted"
	MsgAbilityRepairRunning = "ability.repair_running"
)

// OAuth related messages
const (
	MsgOAuthInvalidCode     = "oauth.invalid_code"
	MsgOAuthGetUserErr      = "oauth.get_user_error"
	MsgOAuthAccountUsed     = "oauth.account_used"
	MsgOAuthUnknownProvider = "oauth.unknown_provider"
	MsgOAuthStateInvalid    = "oauth.state_invalid"
	MsgOAuthNotEnabled      = "oauth.not_enabled"
	MsgOAuthUserDeleted     = "oauth.user_deleted"
	MsgOAuthUserBanned      = "oauth.user_banned"
	MsgOAuthBindSuccess     = "oauth.bind_success"
	MsgOAuthAlreadyBound    = "oauth.already_bound"
	MsgOAuthConnectFailed   = "oauth.connect_failed"
	MsgOAuthTokenFailed     = "oauth.token_failed"
	MsgOAuthUserInfoEmpty   = "oauth.user_info_empty"
	MsgOAuthTrustLevelLow   = "oauth.trust_level_low"
)

// Model layer error messages (for translation in controller)
const (
	MsgRedeemFailed          = "redeem.failed"
	MsgCreateDefaultTokenErr = "user.create_default_token_error"
	MsgUuidDuplicate         = "common.uuid_duplicate"
	MsgInvalidInput          = "common.invalid_input"
)

// Distributor related messages
const (
	MsgDistributorInvalidRequest               = "distributor.invalid_request"
	MsgDistributorInvalidChannelId             = "distributor.invalid_channel_id"
	MsgDistributorChannelDisabled              = "distributor.channel_disabled"
	MsgDistributorAffinityChannelDisabled      = "distributor.affinity_channel_disabled"
	MsgDistributorTokenNoModelAccess           = "distributor.token_no_model_access"
	MsgDistributorTokenModelForbidden          = "distributor.token_model_forbidden"
	MsgDistributorModelNameRequired            = "distributor.model_name_required"
	MsgDistributorInvalidPlayground            = "distributor.invalid_playground_request"
	MsgDistributorGroupAccessDenied            = "distributor.group_access_denied"
	MsgDistributorGetChannelFailed             = "distributor.get_channel_failed"
	MsgDistributorNoAvailableChannel           = "distributor.no_available_channel"
	MsgDistributorNoAvailableChannelTaskPlugin = "distributor.no_available_channel_task_plugin"
	MsgDistributorInvalidMidjourney            = "distributor.invalid_midjourney_request"
	MsgDistributorInvalidParseModel            = "distributor.invalid_request_parse_model"
)

// Custom OAuth provider related messages
const (
	MsgCustomOAuthNotFound          = "custom_oauth.not_found"
	MsgCustomOAuthSlugEmpty         = "custom_oauth.slug_empty"
	MsgCustomOAuthSlugExists        = "custom_oauth.slug_exists"
	MsgCustomOAuthNameEmpty         = "custom_oauth.name_empty"
	MsgCustomOAuthHasBindings       = "custom_oauth.has_bindings"
	MsgCustomOAuthBindingNotFound   = "custom_oauth.binding_not_found"
	MsgCustomOAuthProviderIdInvalid = "custom_oauth.provider_id_field_invalid"
)

const (

	// --- generated: backend Chinese-hardcoded error messages (colloquial, 7 languages) ---
	MsgCommonInvalid_param                      = "common.invalid_param"
	MsgCommonInvalid_param_format               = "common.invalid_param_format"
	MsgCommonUnsupported_operation              = "common.unsupported_operation"
	MsgCommonNot_logged_in                      = "common.not_logged_in"
	MsgCommonUser_not_found                     = "common.user_not_found"
	MsgCommonInvalid_id                         = "common.invalid_id"
	MsgCommonInvalid_user_id                    = "common.invalid_user_id"
	MsgCommonInvalid_subscription_id            = "common.invalid_subscription_id"
	MsgCommonInvalid_provider_id                = "common.invalid_provider_id"
	MsgCommonInvalid_token                      = "common.invalid_token"
	MsgCommonUser_id_format_error               = "common.user_id_format_error"
	MsgCommonChannel_id_format_error            = "common.channel_id_format_error"
	MsgCommonEndpoint_deprecated                = "common.endpoint_deprecated"
	MsgCommonMissing_model_id                   = "common.missing_model_id"
	MsgCommonMissing_vendor_id                  = "common.missing_vendor_id"
	MsgCommonAlready_initialized                = "common.already_initialized"
	MsgCommonInit_success                       = "common.init_success"
	MsgCommonInit_failed                        = "common.init_failed"
	MsgCommonSystem_error                       = "common.system_error"
	MsgCommonCreate_admin_failed                = "common.create_admin_failed"
	MsgCommonSave_self_use_mode_failed          = "common.save_self_use_mode_failed"
	MsgCommonSave_demo_mode_failed              = "common.save_demo_mode_failed"
	MsgCommonUsername_too_long                  = "common.username_too_long"
	MsgCommonPassword_mismatch                  = "common.password_mismatch"
	MsgCommonCompliance_field_readonly          = "common.compliance_field_readonly"
	MsgCommonCompliance_confirm_required        = "common.compliance_confirm_required"
	MsgTwofaDisabled                            = "twofa.disabled"
	MsgTwofaGen_backup_failed                   = "twofa.gen_backup_failed"
	MsgTwofaSave_backup_failed                  = "twofa.save_backup_failed"
	MsgTwofaBackup_regenerated                  = "twofa.backup_regenerated"
	MsgTwofaInsufficient_privilege              = "twofa.insufficient_privilege"
	MsgTwofaNot_enabled                         = "twofa.not_enabled"
	MsgTwofaForce_disabled                      = "twofa.force_disabled"
	MsgWechatLogin_disabled                     = "wechat.login_disabled"
	MsgWechatUser_cancelled                     = "wechat.user_cancelled"
	MsgWechatRegistration_closed                = "wechat.registration_closed"
	MsgWechatUser_banned                        = "wechat.user_banned"
	MsgWechatInvalid_request                    = "wechat.invalid_request"
	MsgWechatAlready_bound                      = "wechat.already_bound"
	MsgOauthProvider_not_found                  = "oauth.provider_not_found"
	MsgOauthSlug_in_use                         = "oauth.slug_in_use"
	MsgOauthSlug_conflict                       = "oauth.slug_conflict"
	MsgOauthDiscovery_required                  = "oauth.discovery_required"
	MsgOauthDiscovery_invalid                   = "oauth.discovery_invalid"
	MsgOauthCheck_bind_error                    = "oauth.check_bind_error"
	MsgOauthCannot_delete_bound                 = "oauth.cannot_delete_bound"
	MsgOauthBind_requires_login                 = "oauth.bind_requires_login"
	MsgOauthCreated                             = "oauth.created"
	MsgOauthUpdated                             = "oauth.updated"
	MsgOauthDeleted                             = "oauth.deleted"
	MsgOauthUnbound                             = "oauth.unbound"
	MsgSettingGithub_oauth_creds_required       = "setting.github_oauth_creds_required"
	MsgSettingDiscord_oauth_creds_required      = "setting.discord_oauth_creds_required"
	MsgSettingOidc_creds_required               = "setting.oidc_creds_required"
	MsgSettingLinuxdo_creds_required            = "setting.linuxdo_creds_required"
	MsgSettingEmail_domain_creds_required       = "setting.email_domain_creds_required"
	MsgSettingWechat_login_creds_required       = "setting.wechat_login_creds_required"
	MsgSettingTurnstile_creds_required          = "setting.turnstile_creds_required"
	MsgSettingClassic_theme_removed             = "setting.classic_theme_removed"
	MsgSettingImage_ratio_failed                = "setting.image_ratio_failed"
	MsgSettingAudio_ratio_failed                = "setting.audio_ratio_failed"
	MsgSettingAudio_complete_ratio_failed       = "setting.audio_complete_ratio_failed"
	MsgSettingCache_ratio_failed                = "setting.cache_ratio_failed"
	MsgSubscriptionTitle_required               = "subscription.title_required"
	MsgSubscriptionPrice_negative               = "subscription.price_negative"
	MsgSubscriptionPrice_too_high               = "subscription.price_too_high"
	MsgSubscriptionPurchase_limit_negative      = "subscription.purchase_limit_negative"
	MsgSubscriptionQuota_negative               = "subscription.quota_negative"
	MsgSubscriptionUpgrade_group_not_found      = "subscription.upgrade_group_not_found"
	MsgSubscriptionDowngrade_group_not_found    = "subscription.downgrade_group_not_found"
	MsgSubscriptionReset_period_positive        = "subscription.reset_period_positive"
	MsgSubscriptionPlan_disabled                = "subscription.plan_disabled"
	MsgSubscriptionPurchase_limit_reached       = "subscription.purchase_limit_reached"
	MsgSubscriptionCreem_product_missing        = "subscription.creem_product_missing"
	MsgSubscriptionCreem_webhook_missing        = "subscription.creem_webhook_missing"
	MsgSubscriptionWaffo_product_missing        = "subscription.waffo_product_missing"
	MsgSubscriptionWaffo_not_configured         = "subscription.waffo_not_configured"
	MsgSubscriptionStripe_price_missing         = "subscription.stripe_price_missing"
	MsgSubscriptionStripe_not_configured        = "subscription.stripe_not_configured"
	MsgSubscriptionStripe_webhook_missing       = "subscription.stripe_webhook_missing"
	MsgSubscriptionCallback_config_error        = "subscription.callback_config_error"
	MsgSubscriptionAmount_too_low               = "subscription.amount_too_low"
	MsgSubscriptionPayment_method_not_found     = "subscription.payment_method_not_found"
	MsgSubscriptionAdmin_payment_not_configured = "subscription.admin_payment_not_configured"
	MsgSubscriptionCreate_order_failed          = "subscription.create_order_failed"
	MsgSubscriptionPay_failed                   = "subscription.pay_failed"
	MsgTopupAmount_too_large                    = "topup.amount_too_large"
	MsgTopupRedirect_success_untrusted          = "topup.redirect_success_untrusted"
	MsgTopupRedirect_cancel_untrusted           = "topup.redirect_cancel_untrusted"
	MsgTopup_wechatSuccess                      = "topup_wechat.success"
	MsgTopup_wechatProcess_failed               = "topup_wechat.process_failed"
	MsgTopup_wechatRead_failed                  = "topup_wechat.read_failed"
	MsgTopup_wechatTimestamp_parse_failed       = "topup_wechat.timestamp_parse_failed"
	MsgTopup_wechatTimestamp_abnormal           = "topup_wechat.timestamp_abnormal"
	MsgTopup_wechatSign_verify_failed           = "topup_wechat.sign_verify_failed"
	MsgTopup_wechatParse_failed                 = "topup_wechat.parse_failed"
	MsgTopup_wechatDecrypt_failed               = "topup_wechat.decrypt_failed"
	MsgTopup_wechatDecrypt_parse_failed         = "topup_wechat.decrypt_parse_failed"
	MsgTopup_wechatMch_mismatch                 = "topup_wechat.mch_mismatch"
	MsgTopup_wechatAppid_mismatch               = "topup_wechat.appid_mismatch"
	MsgTopup_wechatAmount_mismatch              = "topup_wechat.amount_mismatch"
	MsgCheckinSuccess                           = "checkin.success"
	MsgGroupName_exists                         = "group.name_exists"
	MsgGroupName_type_required                  = "group.name_type_required"
	MsgGroupMissing_id                          = "group.missing_id"
	MsgChannelTag_required                      = "channel.tag_required"
	MsgChannelKey_index_out_of_range            = "channel.key_index_out_of_range"
	MsgChannelGet_tags_failed                   = "channel.get_tags_failed"
	MsgChannelGet_tag_count_failed              = "channel.get_tag_count_failed"
	MsgChannelGet_tag_channels_failed           = "channel.get_tag_channels_failed"
	MsgChannelGet_channel_count_failed          = "channel.get_channel_count_failed"
	MsgChannelGet_channel_list_failed           = "channel.get_channel_list_failed"
	MsgChannelGet_type_stats_failed             = "channel.get_type_stats_failed"
	MsgChannelGet_success                       = "channel.get_success"
	MsgChannelRefresh_credential_failed         = "channel.refresh_credential_failed"
	MsgChannelUnsupported_add_mode              = "channel.unsupported_add_mode"
	MsgChannelParam_override_json               = "channel.param_override_json"
	MsgChannelHeader_override_json              = "channel.header_override_json"
	MsgChannelAppend_key_parse_failed           = "channel.append_key_parse_failed"
	MsgChannelGet_info_failed                   = "channel.get_info_failed"
	MsgChannelCopy_failed                       = "channel.copy_failed"
	MsgChannelNot_found                         = "channel.not_found"
	MsgChannelNot_multi_key                     = "channel.not_multi_key"
	MsgChannelNo_disable_index                  = "channel.no_disable_index"
	MsgChannelKey_disabled                      = "channel.key_disabled"
	MsgChannelNo_enable_index                   = "channel.no_enable_index"
	MsgChannelKey_enabled                       = "channel.key_enabled"
	MsgChannelNo_key_to_disable                 = "channel.no_key_to_disable"
	MsgChannelNo_delete_index                   = "channel.no_delete_index"
	MsgChannelCannot_delete_last_key            = "channel.cannot_delete_last_key"
	MsgChannelKey_deleted                       = "channel.key_deleted"
	MsgChannelNo_auto_disabled_key              = "channel.no_auto_disabled_key"
	MsgChannelMulti_key_balance_unsupported     = "channel.multi_key_balance_unsupported"
	MsgChannelUpdate_task_running               = "channel.update_task_running"
	MsgChannelTest_task_running                 = "channel.test_task_running"
	MsgChannelAffinity_rule_name_required       = "channel.affinity_rule_name_required"
	MsgRatioQuery_channel_failed                = "ratio.query_channel_failed"
	MsgRatioNo_valid_upstream                   = "ratio.no_valid_upstream"
	MsgModelName_required                       = "model.name_required"
	MsgModelName_exists                         = "model.name_exists"
	MsgPricingReset_ratio_success               = "pricing.reset_ratio_success"
	MsgPerformanceDisk_cache_cleared            = "performance.disk_cache_cleared"
	MsgPerformanceStats_reset                   = "performance.stats_reset"
	MsgPerformanceGc_executed                   = "performance.gc_executed"
	MsgRatioConfig_disabled                     = "ratio.config_disabled"
	MsgCodexParse_credential_failed             = "codex.parse_credential_failed"
	MsgMiscDb_connect_failed                    = "misc.db_connect_failed"
	MsgUsedataSpan_too_long                     = "usedata.span_too_long"
	MsgTurnstileToken_empty                     = "turnstile.token_empty"
	MsgTurnstileVerify_failed                   = "turnstile.verify_failed"
	MsgRate_limitToo_frequent                   = "rate_limit.too_frequent"
	// 额度类错误会直接透出到 API 响应与游乐场提示，必须本地化且可读，
	// 不能把 errors.New 的英文技术串暴露给用户（2026-10-07）。
	MsgQuotaOrgSubQuotaExceeded = "quota.org_sub_quota_exceeded"
	MsgQuotaOrgBudgetExceeded   = "quota.org_budget_exceeded"
	MsgQuotaOrgSuspended        = "quota.org_suspended"
	MsgQuotaUserNotEnough       = "quota.user_not_enough"
	MsgQuotaTokenNotEnough      = "quota.token_not_enough"
)
