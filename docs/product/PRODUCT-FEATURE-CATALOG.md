# UTER 产品功能目录（PRODUCT FEATURE CATALOG）

> 由唯一权威模型 `docs/product/registry/product-model.json` 渲染 · 模型版本 **v1** · 渲染于 2026-11-09T15:47:41.776Z
> 盘点基线：`main` @ `/Users/lincolnhu/uter`，扫描日期 2026-11-09；技术栈 React 19 + TypeScript + Rsbuild 2 + TanStack Router (web/) / Go 1.27.3 + Gin + GORM (router/, controller/, service/, model/, relay/)。

## 状态口径

| 状态 | 定义 | 本次数量 |
| --- | --- | --- |
| IMPLEMENTED | 已实现（前后端均有证据） | 46 |
| PARTIALLY_IMPLEMENTED | 部分实现（存在明确缺口） | 1 |
| FRONTEND_ONLY | 仅前端（未发现后端实现） | 0 |
| BACKEND_ONLY | 仅后端（未发现用户侧页面） | 8 |
| DOCUMENTED_ONLY | 仅文档规划（无代码实现） | 0 |
| NOT_IMPLEMENTED | 未实现（仅规划原型，非已上线功能） | 1 |
| UNKNOWN | 证据不足，待确认（不编造业务决策） | 0 |

合计 **56** 项功能 · 124 条需求 · 90 个原型页面 · 124 条映射。

## 功能清单

| Feature ID | 功能名称 | 业务模块 | 用户角色 | 实现状态 | 页面路径 | API 路径 | 数据模型 | PRD 路径 | 原型路径 | 交互式原型（HTML） | 测试路径 | 优先级 | 验收状态 | 证据来源 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [UTER-AUTH-001](prd/auth/UTER-AUTH-001.md) | 邮箱密码登录 | auth | `guest` | `IMPLEMENTED` | `web/src/routes/(auth)/sign-in.tsx`, `web/src/routes/(auth)/route.tsx` | `POST /api/user/login`, `GET /api/user/login/encryption-key` | `user.go`, `login_verification.go` | `docs/product/prd/auth/UTER-AUTH-001.md` | `docs/product/prototypes/auth/UTER-AUTH-001.md` | `docs/product/prototypes/auth/UTER-AUTH-001.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P0 | DEFINED(9) | `controller/user.go`, `controller/login_verification.go` |
| [UTER-AUTH-002](prd/auth/UTER-AUTH-002.md) | 用户注册与邮箱验证 | auth | `guest` | `IMPLEMENTED` | `web/src/routes/(auth)/sign-up.tsx`, `web/src/routes/(auth)/register.tsx` | `POST /api/user/register`, `GET /api/verification` | `user.go`, `email_binding.go` | `docs/product/prd/auth/UTER-AUTH-002.md` | `docs/product/prototypes/auth/UTER-AUTH-002.md` | `docs/product/prototypes/auth/UTER-AUTH-002.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P0 | DEFINED(9) | `controller/user.go`, `controller/email_binding.go` |
| [UTER-AUTH-003](prd/auth/UTER-AUTH-003.md) | 密码找回与重置 | auth | `guest`, `user` | `IMPLEMENTED` | `web/src/routes/(auth)/forgot-password.tsx`, `web/src/routes/(auth)/reset.tsx` | `GET /api/reset_password`, `POST /api/user/reset_password` | `password_crypto.go`, `user.go` | `docs/product/prd/auth/UTER-AUTH-003.md` | `docs/product/prototypes/auth/UTER-AUTH-003.md` | `docs/product/prototypes/auth/UTER-AUTH-003.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P0 | DEFINED(6) | `controller/user.go`, `model/password_crypto.go` |
| [UTER-AUTH-004](prd/auth/UTER-AUTH-004.md) | OAuth 与第三方登录绑定 | auth | `guest`, `user` | `IMPLEMENTED` | `web/src/routes/oauth/$provider.tsx`, `web/src/routes/(auth)/oauth.wechat-web.tsx` | `GET /api/oauth/:provider`, `GET /api/oauth/wechat-web` | `external_identity_claim.go`, `custom_oauth_provider.go` | `docs/product/prd/auth/UTER-AUTH-004.md` | `docs/product/prototypes/auth/UTER-AUTH-004.md` | `docs/product/prototypes/auth/UTER-AUTH-004.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P1 | DEFINED(9) | `controller/oauth.go`, `controller/wechat_web.go` |
| [UTER-AUTH-005](prd/auth/UTER-AUTH-005.md) | Passkey / 2FA 与二次验证 | auth | `user` | `IMPLEMENTED` | `web/src/routes/_authenticated/security/index.tsx`, `web/src/routes/(auth)/otp.tsx` | `GET /api/user/passkey`, `POST /api/user/2fa/setup` | `passkey.go`, `account_security.go` | `docs/product/prd/auth/UTER-AUTH-005.md` | `docs/product/prototypes/auth/UTER-AUTH-005.md` | `docs/product/prototypes/auth/UTER-AUTH-005.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P1 | DEFINED(9) | `controller/passkey.go`, `controller/twofa.go` |
| [UTER-AUTH-006](prd/auth/UTER-AUTH-006.md) | 登录会话与登出 | auth | `user`, `admin` | `IMPLEMENTED` | `web/src/routes/_authenticated/security/index.tsx` | `GET /api/user/sessions`, `DELETE /api/user/sessions/:sid` | `auth_flow.go` | `docs/product/prd/auth/UTER-AUTH-006.md` | `docs/product/prototypes/auth/UTER-AUTH-006.md` | `docs/product/prototypes/auth/UTER-AUTH-006.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P1 | DEFINED(9) | `controller/auth_session.go`, `service/auth_session.go` |
| [UTER-USER-001](prd/user/UTER-USER-001.md) | 个人资料与偏好 | user | `user` | `IMPLEMENTED` | `web/src/routes/_authenticated/profile/index.tsx`, `web/src/features/profile` | `GET /api/user/self`, `PUT /api/user/self` | `user.go`, `option.go` | `docs/product/prd/user/UTER-USER-001.md` | `docs/product/prototypes/user/UTER-USER-001.md` | `docs/product/prototypes/user/UTER-USER-001.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P1 | DEFINED(6) | `controller/user.go`, `web/src/features/profile` |
| [UTER-USER-002](prd/user/UTER-USER-002.md) | 账户安全与身份绑定 | user | `user` | `IMPLEMENTED` | `web/src/routes/_authenticated/security/index.tsx`, `web/src/features/security` | `GET /api/user/oauth/bindings`, `GET /api/user/2fa/status` | `account_security.go`, `email_binding.go` | `docs/product/prd/user/UTER-USER-002.md` | `docs/product/prototypes/user/UTER-USER-002.md` | `docs/product/prototypes/user/UTER-USER-002.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P1 | DEFINED(6) | `service/account_security.go`, `controller/secure_verification.go` |
| [UTER-USER-003](prd/user/UTER-USER-003.md) | 用户管理（管理员） | user | `admin`, `super_admin` | `IMPLEMENTED` | `web/src/routes/_authenticated/users/index.tsx`, `web/src/features/users` | `GET /api/user/`, `GET /api/users` | `user.go`, `audit_log.go` | `docs/product/prd/user/UTER-USER-003.md` | `docs/product/prototypes/user/UTER-USER-003.md` | `docs/product/prototypes/user/UTER-USER-003.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P0 | DEFINED(9) | `controller/user.go`, `controller/user_quota.go` |
| [UTER-PAY-001](prd/pay/UTER-PAY-001.md) | 充值金额选择与充值下单 | pay | `user` | `IMPLEMENTED` | `web/src/routes/_authenticated/wallet/index.tsx`, `web/src/features/wallet` | `GET /api/user/topup/info`, `POST /api/user/topup` | `topup.go`, `option.go` | `docs/product/prd/pay/UTER-PAY-001.md` | `docs/product/prototypes/pay/UTER-PAY-001.md` | `docs/product/prototypes/pay/UTER-PAY-001.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P0 | DEFINED(10) | `controller/topup.go`, `service/billing.go` |
| [UTER-PAY-002](prd/pay/UTER-PAY-002.md) | 支付渠道与支付方式 | pay | `user` | `IMPLEMENTED` | `web/src/routes/_authenticated/wallet/index.tsx` | `POST /api/user/epay/pay`, `POST /api/user/alipay/webpay` | `option.go` | `docs/product/prd/pay/UTER-PAY-002.md` | `docs/product/prototypes/pay/UTER-PAY-002.md` | `docs/product/prototypes/pay/UTER-PAY-002.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P0 | DEFINED(9) | `controller/topup_epay.go`, `controller/topup_wechat.go` |
| [UTER-PAY-003](prd/pay/UTER-PAY-003.md) | 支付回调、幂等与对账 | pay | `system` | `BACKEND_ONLY` | — | `POST /api/user/epay/notify`, `GET /api/user/epay/notify` | `accounting_tx.go`, `topup.go` | `docs/product/prd/pay/UTER-PAY-003.md` | `docs/product/prototypes/pay/UTER-PAY-003.md` | `docs/product/prototypes/pay/UTER-PAY-003.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P0 | DEFINED(9) | `controller/payment_compliance.go`, `controller/payment_reconcile_task.go` |
| [UTER-PAY-004](prd/pay/UTER-PAY-004.md) | 充值记录与订单查询 | pay | `user`, `admin` | `IMPLEMENTED` | `web/src/routes/_authenticated/wallet/index.tsx` | `GET /api/user/topup/self`, `GET /api/user/topup` | `topup.go` | `docs/product/prd/pay/UTER-PAY-004.md` | `docs/product/prototypes/pay/UTER-PAY-004.md` | `docs/product/prototypes/pay/UTER-PAY-004.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P1 | DEFINED(6) | `controller/topup.go`, `router/api-router.go:152-153,191` |
| [UTER-REFUND-001](prd/refund/UTER-REFUND-001.md) | 通用用户退款申请与审核 | refund | `user`, `admin` | `NOT_IMPLEMENTED` | — | — | — | `docs/product/prd/refund/UTER-REFUND-001.md` | `docs/product/prototypes/refund/UTER-REFUND-001.md` | `docs/product/prototypes/refund/UTER-REFUND-001.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P1 | DEFINED(6) | — |
| [UTER-REFUND-002](prd/refund/UTER-REFUND-002.md) | Midjourney 任务失败自动退款 | refund | `system` | `BACKEND_ONLY` | — | `POST /mj/submit/imagine`, `GET /mj/task/:id/fetch` | `midjourney_refund_transaction.go`, `midjourney_refund_outbox.go` | `docs/product/prd/refund/UTER-REFUND-002.md` | `docs/product/prototypes/refund/UTER-REFUND-002.md` | `docs/product/prototypes/refund/UTER-REFUND-002.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P0 | DEFINED(6) | `controller/midjourney_refund_outbox_task.go`, `controller/midjourney_refund_recovery_task.go` |
| [UTER-REFUND-003](prd/refund/UTER-REFUND-003.md) | 支付对账与异常补偿 | refund | `system`, `admin` | `BACKEND_ONLY` | — | `POST /api/user/topup/complete` | `accounting_tx.go`, `topup.go` | `docs/product/prd/refund/UTER-REFUND-003.md` | `docs/product/prototypes/refund/UTER-REFUND-003.md` | `docs/product/prototypes/refund/UTER-REFUND-003.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P0 | DEFINED(6) | `controller/payment_reconcile_task.go`, `controller/payment_compliance.go` |
| [UTER-BALANCE-001](prd/balance/UTER-BALANCE-001.md) | 用户余额与额度展示 | balance | `user` | `IMPLEMENTED` | `web/src/routes/_authenticated/wallet/index.tsx`, `web/src/features/wallet` | `GET /api/user/self`, `GET /api/user/self/stat` | `user.go`, `quota_reserve.go` | `docs/product/prd/balance/UTER-BALANCE-001.md` | `docs/product/prototypes/balance/UTER-BALANCE-001.md` | `docs/product/prototypes/balance/UTER-BALANCE-001.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P0 | DEFINED(6) | `controller/user.go`, `service/billing.go` |
| [UTER-BALANCE-002](prd/balance/UTER-BALANCE-002.md) | 资金流水与会计事务 | balance | `system`, `admin` | `BACKEND_ONLY` | — | `GET /api/log/token`, `GET /api/data/users` | `accounting_tx.go`, `quota_reserve.go` | `docs/product/prd/balance/UTER-BALANCE-002.md` | `docs/product/prototypes/balance/UTER-BALANCE-002.md` | `docs/product/prototypes/balance/UTER-BALANCE-002.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P0 | DEFINED(6) | `service/billing.go`, `service/billing_usage.go` |
| [UTER-BALANCE-003](prd/balance/UTER-BALANCE-003.md) | 额度预占与并发扣减 | balance | `system` | `BACKEND_ONLY` | — | `POST /v1/chat/completions` | `quota_reserve.go`, `locking.go` | `docs/product/prd/balance/UTER-BALANCE-003.md` | `docs/product/prototypes/balance/UTER-BALANCE-003.md` | `docs/product/prototypes/balance/UTER-BALANCE-003.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P0 | DEFINED(6) | `service/admission_quota_test.go`, `model/quota_reserve.go` |
| [UTER-BILLING-001](prd/billing/UTER-BILLING-001.md) | Token 用量统计与计费 | billing | `user`, `admin` | `IMPLEMENTED` | `web/src/routes/_authenticated/usage-logs/$section.tsx`, `web/src/features/usage-logs` | `GET /api/log/token`, `GET /api/usage/token` | `log.go`, `pricing.go` | `docs/product/prd/billing/UTER-BILLING-001.md` | `docs/product/prototypes/billing/UTER-BILLING-001.md` | `docs/product/prototypes/billing/UTER-BILLING-001.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P0 | DEFINED(6) | `tokenkit/`, `service/billing_usage.go` |
| [UTER-BILLING-002](prd/billing/UTER-BILLING-002.md) | 消费记录与日志导出 | billing | `user`, `admin` | `IMPLEMENTED` | `web/src/routes/_authenticated/usage-logs/index.tsx`, `web/src/routes/_authenticated/usage-logs/$section.tsx` | `GET /api/log/self`, `GET /api/log` | `log.go`, `log_other.go` | `docs/product/prd/billing/UTER-BILLING-002.md` | `docs/product/prototypes/billing/UTER-BILLING-002.md` | `docs/product/prototypes/billing/UTER-BILLING-002.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P1 | DEFINED(6) | `controller/log.go`, `service/log_export.go` |
| [UTER-BILLING-003](prd/billing/UTER-BILLING-003.md) | 模型倍率与价格配置 | billing | `super_admin` | `IMPLEMENTED` | `web/src/routes/_authenticated/system-settings/billing/$section.tsx`, `web/src/features/model-pricing` | `GET /api/ratio_config`, `PATCH /api/ratio_config` | `pricing.go`, `model_pricing_config.go` | `docs/product/prd/billing/UTER-BILLING-003.md` | `docs/product/prototypes/billing/UTER-BILLING-003.md` | `docs/product/prototypes/billing/UTER-BILLING-003.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P0 | DEFINED(6) | `controller/ratio_config.go`, `controller/ratio_sync.go` |
| [UTER-MODEL-001](prd/model/UTER-MODEL-001.md) | 模型列表与模型广场 | model | `user`, `admin` | `IMPLEMENTED` | `web/src/routes/_authenticated/models/index.tsx`, `web/src/routes/_authenticated/models/$section.tsx` | `GET /api/models`, `GET /api/models/:model` | `model_meta.go`, `model_extra.go` | `docs/product/prd/model/UTER-MODEL-001.md` | `docs/product/prototypes/model/UTER-MODEL-001.md` | `docs/product/prototypes/model/UTER-MODEL-001.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P0 | DEFINED(6) | `controller/model.go`, `controller/model_meta.go` |
| [UTER-MODEL-002](prd/model/UTER-MODEL-002.md) | 模型元数据同步与自动补全 | model | `super_admin` | `IMPLEMENTED` | `web/src/routes/_authenticated/system-settings/models/$section.tsx` | `GET /api/sync_upstream/preview`, `POST /api/sync_upstream` | `model_metadata_sync.go`, `model_description_fill.go` | `docs/product/prd/model/UTER-MODEL-002.md` | `docs/product/prototypes/model/UTER-MODEL-002.md` | `docs/product/prototypes/model/UTER-MODEL-002.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P1 | DEFINED(6) | `controller/model_sync.go`, `controller/model_auto_fill.go` |
| [UTER-MODEL-003](prd/model/UTER-MODEL-003.md) | 公开定价页 | model | `guest`, `user` | `IMPLEMENTED` | `web/src/routes/_public/pricing/index.tsx`, `web/src/routes/_public/pricing/$modelId/index.tsx` | `GET /api/pricing`, `GET /api/model_pricing` | `pricing.go`, `pricing_default.go` | `docs/product/prd/model/UTER-MODEL-003.md` | `docs/product/prototypes/model/UTER-MODEL-003.md` | `docs/product/prototypes/model/UTER-MODEL-003.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P1 | DEFINED(6) | `controller/pricing.go`, `model/pricing_endpoint_test.go` |
| [UTER-CHANNEL-001](prd/channel/UTER-CHANNEL-001.md) | 渠道管理 | channel | `super_admin` | `IMPLEMENTED` | `web/src/routes/_authenticated/channels/index.tsx`, `web/src/features/channels` | `GET /api/channel/`, `POST /api/channel/` | `channel.go`, `channel_constraint.go` | `docs/product/prd/channel/UTER-CHANNEL-001.md` | `docs/product/prototypes/channel/UTER-CHANNEL-001.md` | `docs/product/prototypes/channel/UTER-CHANNEL-001.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P0 | DEFINED(6) | `controller/channel.go`, `service/channel.go` |
| [UTER-CHANNEL-002](prd/channel/UTER-CHANNEL-002.md) | 渠道选择、优先级与亲和性 | channel | `system` | `BACKEND_ONLY` | — | `POST /v1/chat/completions`, `GET /api/channel_affinity_cache` | `channel_priority.go`, `channel_satisfy.go` | `docs/product/prd/channel/UTER-CHANNEL-002.md` | `docs/product/prototypes/channel/UTER-CHANNEL-002.md` | `docs/product/prototypes/channel/UTER-CHANNEL-002.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P0 | DEFINED(9) | `service/channel_select.go`, `service/channel_affinity.go` |
| [UTER-CHANNEL-003](prd/channel/UTER-CHANNEL-003.md) | 渠道测试与健康状态 | channel | `super_admin` | `IMPLEMENTED` | `web/src/routes/_authenticated/channels/index.tsx` | `GET /api/channel/test`, `POST /api/channel/test` | `channel_cache_status_test.go` | `docs/product/prd/channel/UTER-CHANNEL-003.md` | `docs/product/prototypes/channel/UTER-CHANNEL-003.md` | `docs/product/prototypes/channel/UTER-CHANNEL-003.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P1 | DEFINED(6) | `controller/channel-test.go`, `controller/channel_inference.go` |
| [UTER-APIKEY-001](prd/apikey/UTER-APIKEY-001.md) | API Key 创建与管理 | apikey | `user` | `IMPLEMENTED` | `web/src/routes/_authenticated/keys/index.tsx`, `web/src/features/keys` | `GET /api/token/`, `POST /api/token/` | `access_token.go` | `docs/product/prd/apikey/UTER-APIKEY-001.md` | `docs/product/prototypes/apikey/UTER-APIKEY-001.md` | `docs/product/prototypes/apikey/UTER-APIKEY-001.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P0 | DEFINED(6) | `controller/token.go`, `controller/access_token.go` |
| [UTER-APIKEY-002](prd/apikey/UTER-APIKEY-002.md) | Key 额度与使用限制 | apikey | `user` | `IMPLEMENTED` | `web/src/routes/_authenticated/keys/index.tsx` | `GET /api/token/:id`, `PUT /api/token/:id` | `access_token.go` | `docs/product/prd/apikey/UTER-APIKEY-002.md` | `docs/product/prototypes/apikey/UTER-APIKEY-002.md` | `docs/product/prototypes/apikey/UTER-APIKEY-002.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P1 | DEFINED(6) | `controller/token_limit_test.go`, `controller/token_auto_groups_test.go` |
| [UTER-APIKEY-003](prd/apikey/UTER-APIKEY-003.md) | API Key 审计 | apikey | `admin`, `super_admin` | `IMPLEMENTED` | `web/src/routes/_authenticated/usage-logs/audit.tsx` | `GET /api/audit`, `GET /api/token/:id/audit` | `audit_log.go`, `audit_other.go` | `docs/product/prd/apikey/UTER-APIKEY-003.md` | `docs/product/prototypes/apikey/UTER-APIKEY-003.md` | `docs/product/prototypes/apikey/UTER-APIKEY-003.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P1 | DEFINED(6) | `controller/audit.go`, `controller/access_token.go` |
| [UTER-RELAY-001](prd/relay/UTER-RELAY-001.md) | OpenAI 兼容 API 中继 | relay | `user`, `developer` | `IMPLEMENTED` | `web/src/routes/_authenticated/playground/index.tsx` | `POST /v1/chat/completions`, `POST /v1/completions` | `log.go`, `ability.go` | `docs/product/prd/relay/UTER-RELAY-001.md` | `docs/product/prototypes/relay/UTER-RELAY-001.md` | `docs/product/prototypes/relay/UTER-RELAY-001.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P0 | DEFINED(9) | `router/relay-router.go`, `relay/` |
| [UTER-RELAY-002](prd/relay/UTER-RELAY-002.md) | 多协议中继适配 | relay | `user`, `developer` | `IMPLEMENTED` | `web/src/routes/_authenticated/playground/index.tsx`, `web/src/routes/_authenticated/task-plugins/index.tsx` | `POST /v1/messages`, `POST /v1beta/models/*path` | `relaykit`, `log.go` | `docs/product/prd/relay/UTER-RELAY-002.md` | `docs/product/prototypes/relay/UTER-RELAY-002.md` | `docs/product/prototypes/relay/UTER-RELAY-002.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P0 | DEFINED(6) | `router/relay-router.go`, `controller/responses_websocket.go` |
| [UTER-RELAY-003](prd/relay/UTER-RELAY-003.md) | 中继错误处理、超时与重试 | relay | `system` | `BACKEND_ONLY` | — | `POST /v1/chat/completions` | `channel_cache_status_test.go` | `docs/product/prd/relay/UTER-RELAY-003.md` | `docs/product/prototypes/relay/UTER-RELAY-003.md` | `docs/product/prototypes/relay/UTER-RELAY-003.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P0 | DEFINED(6) | `controller/relay_error.go`, `controller/relay_error_log_test.go` |
| [UTER-TASK-001](prd/task/UTER-TASK-001.md) | 异步任务创建、查询与产物 | task | `user`, `developer` | `IMPLEMENTED` | `web/src/routes/_authenticated/usage-logs/$section.tsx`, `web/src/features/usage-logs` | `POST /api/task/:key`, `GET /api/task/:key` | `task.go`, `midjourney.go` | `docs/product/prd/task/UTER-TASK-001.md` | `docs/product/prototypes/task/UTER-TASK-001.md` | `docs/product/prototypes/task/UTER-TASK-001.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P1 | DEFINED(9) | `controller/task.go`, `router/task-router.go` |
| [UTER-TASK-002](prd/task/UTER-TASK-002.md) | 任务插件管理与市场 | task | `super_admin` | `IMPLEMENTED` | `web/src/routes/_authenticated/task-plugins/index.tsx`, `web/src/features/task-plugins` | `GET /api/plugin/task`, `POST /api/plugin/task` | `task_plugin.go` | `docs/product/prd/task/UTER-TASK-002.md` | `docs/product/prototypes/task/UTER-TASK-002.md` | `docs/product/prototypes/task/UTER-TASK-002.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P1 | DEFINED(6) | `controller/task_plugin.go`, `controller/task_plugin_debug.go` |
| [UTER-TASK-003](prd/task/UTER-TASK-003.md) | 系统任务与定时维护 | task | `system` | `BACKEND_ONLY` | — | `GET /api/system-task`, `POST /api/system-task` | `option.go` | `docs/product/prd/task/UTER-TASK-003.md` | `docs/product/prototypes/task/UTER-TASK-003.md` | `docs/product/prototypes/task/UTER-TASK-003.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P2 | DEFINED(6) | `controller/system_task.go`, `controller/system_task_handlers.go` |
| [UTER-PLAN-001](prd/plan/UTER-PLAN-001.md) | 套餐列表与订阅购买 | plan | `user`, `admin` | `IMPLEMENTED` | `web/src/routes/_authenticated/subscriptions/index.tsx`, `web/src/features/subscriptions` | `GET /api/subscription/plans`, `GET /api/plans` | `subscription.go`, `user_subscription.go` | `docs/product/prd/plan/UTER-PLAN-001.md` | `docs/product/prototypes/plan/UTER-PLAN-001.md` | `docs/product/prototypes/plan/UTER-PLAN-001.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P1 | DEFINED(6) | `controller/subscription.go`, `router/api-router.go:253-286` |
| [UTER-PLAN-002](prd/plan/UTER-PLAN-002.md) | 订阅支付与回调 | plan | `user`, `system` | `IMPLEMENTED` | `web/src/routes/_authenticated/subscriptions/index.tsx` | `POST /api/subscription/epay/pay`, `POST /api/subscription/creem/pay` | `subscription.go`, `user_subscription.go` | `docs/product/prd/plan/UTER-PLAN-002.md` | `docs/product/prototypes/plan/UTER-PLAN-002.md` | `docs/product/prototypes/plan/UTER-PLAN-002.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P1 | DEFINED(6) | `controller/subscription_payment_epay.go`, `controller/subscription_payment_creem.go` |
| [UTER-PLAN-003](prd/plan/UTER-PLAN-003.md) | 兑换码 | plan | `user`, `super_admin` | `IMPLEMENTED` | `web/src/routes/_authenticated/redemption-codes/index.tsx`, `web/src/features/redemption-codes` | `GET /api/redemption`, `POST /api/redemption` | `redemption.go` | `docs/product/prd/plan/UTER-PLAN-003.md` | `docs/product/prototypes/plan/UTER-PLAN-003.md` | `docs/product/prototypes/plan/UTER-PLAN-003.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P1 | DEFINED(6) | `controller/redemption.go`, `router/api-router.go:391-402` |
| [UTER-ADMIN-001](prd/admin/UTER-ADMIN-001.md) | 系统设置 | admin | `super_admin` | `IMPLEMENTED` | `web/src/routes/_authenticated/system-settings/route.tsx`, `web/src/routes/_authenticated/system-settings/site/$section.tsx` | `GET /api/option/`, `PUT /api/option/` | `option.go`, `frontend_option_migration.go` | `docs/product/prd/admin/UTER-ADMIN-001.md` | `docs/product/prototypes/admin/UTER-ADMIN-001.md` | `docs/product/prototypes/admin/UTER-ADMIN-001.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P0 | DEFINED(6) | `controller/option.go`, `controller/setup.go` |
| [UTER-ADMIN-002](prd/admin/UTER-ADMIN-002.md) | 数据统计看板 | admin | `admin`, `super_admin` | `IMPLEMENTED` | `web/src/routes/_authenticated/dashboard/index.tsx`, `web/src/routes/_authenticated/dashboard/$section.tsx` | `GET /api/data/`, `GET /api/data/users` | `log.go`, `user.go` | `docs/product/prd/admin/UTER-ADMIN-002.md` | `docs/product/prototypes/admin/UTER-ADMIN-002.md` | `docs/product/prototypes/admin/UTER-ADMIN-002.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P1 | DEFINED(6) | `controller/usedata.go`, `controller/dashboard.go` |
| [UTER-ADMIN-003](prd/admin/UTER-ADMIN-003.md) | 操作审计日志 | admin | `admin`, `super_admin` | `IMPLEMENTED` | `web/src/routes/_authenticated/usage-logs/audit.tsx`, `web/src/features/usage-logs/audit` | `GET /api/audit`, `GET /api/audit/self` | `audit_log.go`, `audit_other.go` | `docs/product/prd/admin/UTER-ADMIN-003.md` | `docs/product/prototypes/admin/UTER-ADMIN-003.md` | `docs/product/prototypes/admin/UTER-ADMIN-003.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P1 | DEFINED(6) | `controller/audit.go`, `router/authz-router.go` |
| [UTER-ADMIN-004](prd/admin/UTER-ADMIN-004.md) | 权限与请求策略 | admin | `super_admin` | `IMPLEMENTED` | `web/src/routes/_authenticated/system-settings/request-policies/$section.tsx`, `web/src/routes/(errors)/403.tsx` | `GET /api/authz/`, `POST /api/authz/` | `authz_role.go`, `casbin_rule.go` | `docs/product/prd/admin/UTER-ADMIN-004.md` | `docs/product/prototypes/admin/UTER-ADMIN-004.md` | `docs/product/prototypes/admin/UTER-ADMIN-004.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P0 | DEFINED(6) | `service/authz/`, `controller/authz.go` |
| [UTER-ADMIN-005](prd/admin/UTER-ADMIN-005.md) | 系统信息与运行状态 | admin | `super_admin` | `IMPLEMENTED` | `web/src/routes/_authenticated/system-info/index.tsx`, `web/src/features/system-info` | `GET /api/system-info`, `GET /api/status` | `option.go` | `docs/product/prd/admin/UTER-ADMIN-005.md` | `docs/product/prototypes/admin/UTER-ADMIN-005.md` | `docs/product/prototypes/admin/UTER-ADMIN-005.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P2 | DEFINED(6) | `controller/system_info.go`, `controller/uptime_kuma.go` |
| [UTER-ORG-001](prd/org/UTER-ORG-001.md) | 组织与成员管理 | org | `user`, `admin` | `IMPLEMENTED` | `web/src/routes/_authenticated/organization/index.tsx`, `web/src/features/organization` | `GET /api/organization`, `POST /api/organization` | `organization.go` | `docs/product/prd/org/UTER-ORG-001.md` | `docs/product/prototypes/org/UTER-ORG-001.md` | `docs/product/prototypes/org/UTER-ORG-001.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P1 | DEFINED(6) | `controller/organization.go`, `router/api-router.go:218-251` |
| [UTER-MISC-001](prd/misc/UTER-MISC-001.md) | 签到与赠送额度 | misc | `user` | `IMPLEMENTED` | `web/src/routes/_authenticated/wallet/index.tsx` | `GET /api/user/checkin`, `POST /api/user/checkin` | `checkin.go` | `docs/product/prd/misc/UTER-MISC-001.md` | `docs/product/prototypes/misc/UTER-MISC-001.md` | `docs/product/prototypes/misc/UTER-MISC-001.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P2 | DEFINED(6) | `controller/checkin.go` |
| [UTER-MISC-002](prd/misc/UTER-MISC-002.md) | 排行榜 | misc | `guest`, `user` | `IMPLEMENTED` | `web/src/routes/_public/rankings/index.tsx`, `web/src/features/rankings` | `GET /api/rankings` | `log.go` | `docs/product/prd/misc/UTER-MISC-002.md` | `docs/product/prototypes/misc/UTER-MISC-002.md` | `docs/product/prototypes/misc/UTER-MISC-002.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P2 | DEFINED(6) | `controller/rankings.go` |
| [UTER-MISC-003](prd/misc/UTER-MISC-003.md) | Playground 与 Chat | misc | `user` | `IMPLEMENTED` | `web/src/routes/_authenticated/playground/index.tsx`, `web/src/routes/_authenticated/chat/$chatId.tsx` | `POST /pg/chat/completions`, `GET /pg/models` | `ability.go` | `docs/product/prd/misc/UTER-MISC-003.md` | `docs/product/prototypes/misc/UTER-MISC-003.md` | `docs/product/prototypes/misc/UTER-MISC-003.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P1 | DEFINED(6) | `controller/playground.go`, `router/relay-router.go:69` |
| [UTER-MISC-004](prd/misc/UTER-MISC-004.md) | 文档站与协议页面 | misc | `guest`, `user` | `IMPLEMENTED` | `web/src/routes/_public/docs.tsx`, `web/src/routes/_public/docs/$.tsx` | `GET /api/user-agreement`, `GET /api/privacy-policy` | `option.go` | `docs/product/prd/misc/UTER-MISC-004.md` | `docs/product/prototypes/misc/UTER-MISC-004.md` | `docs/product/prototypes/misc/UTER-MISC-004.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P2 | DEFINED(6) | `router/web-router.go`, `docs-web/` |
| [UTER-MISC-005](prd/misc/UTER-MISC-005.md) | 客服与客服部署 | misc | `user`, `super_admin` | `PARTIALLY_IMPLEMENTED` | `web/src/features/customer-service` | `GET /api/customer-service/admin-token`, `GET /api/customer-service/deploy/llm` | `option.go` | `docs/product/prd/misc/UTER-MISC-005.md` | `docs/product/prototypes/misc/UTER-MISC-005.md` | `docs/product/prototypes/misc/UTER-MISC-005.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P2 | DEFINED(6) | `controller/customer_service_deploy.go`, `controller/misc.go` |
| [UTER-MISC-006](prd/misc/UTER-MISC-006.md) | 性能指标与运行监控 | misc | `admin`, `super_admin` | `IMPLEMENTED` | `web/src/features/performance-metrics` | `GET /api/perf-metrics`, `GET /api/performance/logs` | `perf_metric.go` | `docs/product/prd/misc/UTER-MISC-006.md` | `docs/product/prototypes/misc/UTER-MISC-006.md` | `docs/product/prototypes/misc/UTER-MISC-006.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P2 | DEFINED(6) | `controller/perf_metrics.go`, `controller/performance.go` |
| [UTER-MISC-007](prd/misc/UTER-MISC-007.md) | 自定义 OAuth Provider 与供应商元数据 | misc | `super_admin` | `IMPLEMENTED` | `web/src/routes/_authenticated/system-settings/integrations/$section.tsx` | `GET /api/custom-oauth-provider`, `POST /api/custom-oauth-provider` | `custom_oauth_provider.go` | `docs/product/prd/misc/UTER-MISC-007.md` | `docs/product/prototypes/misc/UTER-MISC-007.md` | `docs/product/prototypes/misc/UTER-MISC-007.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P2 | DEFINED(6) | `controller/custom_oauth.go`, `controller/vendor_meta.go` |
| [UTER-MISC-008](prd/misc/UTER-MISC-008.md) | 文件上传与产物代理 | misc | `user`, `developer` | `IMPLEMENTED` | `web/src/routes/_authenticated/usage-logs/$section.tsx` | `GET /api/files`, `GET /api/files/:id/content` | `option.go` | `docs/product/prd/misc/UTER-MISC-008.md` | `docs/product/prototypes/misc/UTER-MISC-008.md` | `docs/product/prototypes/misc/UTER-MISC-008.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P2 | DEFINED(6) | `service/file_service.go`, `controller/video_proxy.go` |
| [UTER-MISC-009](prd/misc/UTER-MISC-009.md) | 统一错误页与空状态 | misc | `guest`, `user` | `IMPLEMENTED` | `web/src/routes/(errors)/401.tsx`, `web/src/routes/(errors)/403.tsx` | — | — | `docs/product/prd/misc/UTER-MISC-009.md` | `docs/product/prototypes/misc/UTER-MISC-009.md` | `docs/product/prototypes/misc/UTER-MISC-009.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P2 | DEFINED(6) | `web/src/features/errors` |
| [UTER-MISC-010](prd/misc/UTER-MISC-010.md) | 首次安装与初始化 | misc | `guest`, `super_admin` | `IMPLEMENTED` | `web/src/routes/setup/index.tsx`, `web/src/features/setup` | `GET /api/setup`, `POST /api/setup` | `option.go`, `user.go` | `docs/product/prd/misc/UTER-MISC-010.md` | `docs/product/prototypes/misc/UTER-MISC-010.md` | `docs/product/prototypes/misc/UTER-MISC-010.html` | `tools/product-workspace/tests/requirements-trace.test.mjs` | P1 | DEFINED(6) | `controller/setup.go` |

> 表格中的页面 / API / 模型 / 代码路径均为真实仓库证据的摘录；完整证据见各 PRD §9 与 §11。

## 按状态分组

### IMPLEMENTED（46）

- `UTER-AUTH-001` 邮箱密码登录
- `UTER-AUTH-002` 用户注册与邮箱验证
- `UTER-AUTH-003` 密码找回与重置
- `UTER-AUTH-004` OAuth 与第三方登录绑定
- `UTER-AUTH-005` Passkey / 2FA 与二次验证
- `UTER-AUTH-006` 登录会话与登出
- `UTER-USER-001` 个人资料与偏好
- `UTER-USER-002` 账户安全与身份绑定
- `UTER-USER-003` 用户管理（管理员）
- `UTER-PAY-001` 充值金额选择与充值下单 — 最低金额 10 元为代码基线值；若在 PRD 中修改该业务规则，同步引擎会同步更新原型校验、错误提示与验收标准。
- `UTER-PAY-002` 支付渠道与支付方式
- `UTER-PAY-004` 充值记录与订单查询
- `UTER-BALANCE-001` 用户余额与额度展示
- `UTER-BILLING-001` Token 用量统计与计费
- `UTER-BILLING-002` 消费记录与日志导出
- `UTER-BILLING-003` 模型倍率与价格配置
- `UTER-MODEL-001` 模型列表与模型广场
- `UTER-MODEL-002` 模型元数据同步与自动补全
- `UTER-MODEL-003` 公开定价页
- `UTER-CHANNEL-001` 渠道管理
- `UTER-CHANNEL-003` 渠道测试与健康状态
- `UTER-APIKEY-001` API Key 创建与管理
- `UTER-APIKEY-002` Key 额度与使用限制
- `UTER-APIKEY-003` API Key 审计
- `UTER-RELAY-001` OpenAI 兼容 API 中继
- `UTER-RELAY-002` 多协议中继适配
- `UTER-TASK-001` 异步任务创建、查询与产物
- `UTER-TASK-002` 任务插件管理与市场
- `UTER-PLAN-001` 套餐列表与订阅购买
- `UTER-PLAN-002` 订阅支付与回调
- `UTER-PLAN-003` 兑换码
- `UTER-ADMIN-001` 系统设置
- `UTER-ADMIN-002` 数据统计看板
- `UTER-ADMIN-003` 操作审计日志
- `UTER-ADMIN-004` 权限与请求策略
- `UTER-ADMIN-005` 系统信息与运行状态
- `UTER-ORG-001` 组织与成员管理
- `UTER-MISC-001` 签到与赠送额度
- `UTER-MISC-002` 排行榜
- `UTER-MISC-003` Playground 与 Chat
- `UTER-MISC-004` 文档站与协议页面
- `UTER-MISC-006` 性能指标与运行监控
- `UTER-MISC-007` 自定义 OAuth Provider 与供应商元数据
- `UTER-MISC-008` 文件上传与产物代理
- `UTER-MISC-009` 统一错误页与空状态
- `UTER-MISC-010` 首次安装与初始化
### BACKEND_ONLY（8）

- `UTER-PAY-003` 支付回调、幂等与对账 — 后端已实现并具备测试，未发现独立的前端回调管理页面，因此状态为 BACKEND_ONLY。
- `UTER-REFUND-002` Midjourney 任务失败自动退款 — 代码含完整事务/Outbox 实现与测试，但未发现对应前端退款管理页面。
- `UTER-REFUND-003` 支付对账与异常补偿
- `UTER-BALANCE-002` 资金流水与会计事务
- `UTER-BALANCE-003` 额度预占与并发扣减
- `UTER-CHANNEL-002` 渠道选择、优先级与亲和性
- `UTER-RELAY-003` 中继错误处理、超时与重试
- `UTER-TASK-003` 系统任务与定时维护
### NOT_IMPLEMENTED（1）

- `UTER-REFUND-001` 通用用户退款申请与审核 — 经全仓扫描 router/controller/service/model 与 web/src/routes（含 /wallet、/subscriptions、/usage-logs、(auth)/*），未发现用户侧退款申请入口、退款 API 或退款审核后台；Midjourney 任务失败自动退款由后端事务处理，见 UTER-REFUND-002，不在此 Feature 范围。 ｜ 待产品决策：退款适用范围（充值余额 / 订阅 / 任务扣费）；退款时效与审核流；退款与会计事务的冲正规则
### PARTIALLY_IMPLEMENTED（1）

- `UTER-MISC-005` 客服与客服部署 — 前后端证据不充分，按 PARTIALLY_IMPLEMENTED 记录，不写成完整实现。

## 证据来源（全量盘点维度）

- web/src/routes/**/*.tsx (71 route files)
- web/src/features/** (36 feature modules)
- router/*.go (api-router, relay-router, task-router, channel-router, web-router)
- controller/*.go
- service/*.go
- model/*.go
- *_test.go / *.test.ts / web/e2e

治理基线：AGENTS.md / web/AGENTS.md

设计基线：`docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md`（UDS 8.0.0（ACCEPTANCE_READY / accepted=false；保留 既有语义层）；不使用已废弃的 2.1）

## 诚实性声明

- `UNKNOWN` 仅建立待确认条目，不编造业务决策；本次盘点未发现需要标记为 UNKNOWN 的功能。
- `NOT_IMPLEMENTED` 功能有 PRD 与规划原型，但原型页面标记 `PLANNED`，不冒充已上线功能。
- `BACKEND_ONLY` 功能有后端实现证据但缺少用户侧页面证据，原型按后端能力描述并标注缺口。
- `PARTIALLY_IMPLEMENTED` 功能在 PRD 中列明缺失部分与待确认事项。
- 原型中的所有交易/退款/余额数据均为 `DEMO / MOCK` 合成值，不写真实数据。
