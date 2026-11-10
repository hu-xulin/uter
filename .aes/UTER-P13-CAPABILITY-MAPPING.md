# Uter P13 能力需求映射（CAPABILITY MAPPING）

<!-- machine-generated-source: authored-by: AES autonomous governance executor (session 2026-11-10, authorized by Uter governance phase-2 mandate) -->
<!-- parse-format: pipe table, columns: requirement_id;;aspect;;normative_statement;;implementation_paths(';;'-separated, alternatives allowed);;verifier_id -->
<!-- verifier_id semantics: self:<domain> = in-verifier executed checks; go:<domain> = real go test commands defined in tools/aes/p13-capability-verifier.mjs -->

| requirement_id | aspect | normative_statement | implementation_paths | verifier_id |
|---;;---;;---;;---;;---|
| P13-01-CAP-01 | business owner | 产品与业务需求域所有者：Uter 产品负责人（由平台工程代管）；本映射由 AES 自治治理执行会话依据第二阶段授权登记，取代 P13-REQ-001 的未确认状态。 | docs/ai-specs/PRODUCT-REQUIREMENTS-STANDARD.md;;uaes/standards/PRODUCT-REQUIREMENTS-STANDARD.md | self:p13.1 |
| P13-01-CAP-02 | authoritative requirement | 用户可见产品面（about/home/pricing/models/chat/playground/docs/legal）的范围必须与产品需求标准声明的清单一致，禁止未登记页面进入生产导航。 | docs/ai-specs/PRODUCT-REQUIREMENTS-STANDARD.md;;uaes/standards/PRODUCT-REQUIREMENTS-STANDARD.md | self:p13.1 |
| P13-01-CAP-03 | domain model or equivalent specification | 产品能力域以 web/src/features/* 为实现单元，产品需求标准为等价规格来源。 | web/src/features/about;;web/src/features/home | self:p13.1 |
| P13-01-CAP-04 | business invariants | 任何产品页面必须可从导航到达且不依赖未发布特性开关；页面资源缺失时降级到错误页而非白屏。 | web/src/features/about;;web/src/features/home | self:p13.1 |
| P13-01-CAP-05 | state transitions | 文档与法律声明页的更新必须先于相关功能上线（合规前置：legal 页面内容版本与支付合规条款版本联动）。 | web/src/features/legal;;docs/ai-specs/PRODUCT-REQUIREMENTS-STANDARD.md | self:p13.1 |
| P13-01-CAP-06 | failure behavior | 前端路由与资源加载失败必须落入统一错误页，不得白屏或暴露堆栈。 | web/src/features/errors;;web/src/features/docs | self:p13.1 |
| P13-01-CAP-07 | authorization rules | 匿名可访问 about/home/models/pricing/docs/legal；用户态数据页（dashboard/keys/wallet）必须登录后访问。 | web/src/features/about;;web/src/features/home | self:p13.1 |
| P13-01-CAP-08 | data integrity requirements | 产品定价展示必须来自与计费引擎一致的 pricing 数据源，禁止前端硬编码价格。 | web/src/features/pricing;;web/src/features/models | self:p13.1 |
| P13-01-CAP-09 | verification criteria | 验证准则：产品需求标准文档存在且包含需求清单章节；8 个核心特性目录存在且非空。 | docs/ai-specs/PRODUCT-REQUIREMENTS-STANDARD.md;;uaes/standards/PRODUCT-REQUIREMENTS-STANDARD.md | self:p13.1 |
| P13-01-CAP-10 | traceable implementation evidence | 实现证据：标准文档 + 特性目录物理存在，由本验证器每次执行时实时核验并记录摘要。 | docs/ai-specs/PRODUCT-REQUIREMENTS-STANDARD.md;;uaes/standards/PRODUCT-REQUIREMENTS-STANDARD.md | self:p13.1 |
| P13-02-CAP-01 | business owner | 身份与账户域所有者：Uter 平台工程负责人；AES 治理执行会话登记。 | controller/user.go | go:p13.2 |
| P13-02-CAP-02 | authoritative requirement | 用户必须经注册/邮箱验证码/OAuth 登录获得账户；被停用账户不得通过任何登录路径获得会话。 | controller/user.go;;model/user.go | go:p13.2 |
| P13-02-CAP-03 | domain model or equivalent specification | 账户域模型由 User/UserAccessToken/UserAuthCache/UserMonthQuota 组成（model/user*.go）。 | model/user.go;;model/user_access_token.go | go:p13.2 |
| P13-02-CAP-04 | business invariants | 邮箱验证码登录对停用账户必须静默处理（防账户枚举）；访问令牌必须防篡改且绑定授权 grant。 | controller/email_code_login_test.go;;service/auth_token_test.go | go:p13.2 |
| P13-02-CAP-05 | state transitions | 令牌生命周期：创建（验证 grant）→ 使用 → 审计 → 过期/撤销；过期与 late request 一律拒绝。 | model/user_access_token.go;;controller/access_token_audit_test.go | go:p13.2 |
| P13-02-CAP-06 | failure behavior | 令牌篡改、过期、late request 必须拒绝且不得泄露令牌存在性；认证失败不区分「账户不存在」与「密码错误」。 | service/auth_token_test.go;;controller/email_code_login_test.go | go:p13.2 |
| P13-02-CAP-07 | authorization rules | API 访问令牌创建前必须验证授权 grant 存在且未被消费；令牌 scope 只授予申请者本人的权限。 | service/auth_token_test.go;;model/user_access_token.go | go:p13.2 |
| P13-02-CAP-08 | data integrity requirements | 令牌创建、使用与审计事件必须落库且排除浏览器会话（TestAccessTokenAuditsResultsAndExcludesBrowserSessions）。 | controller/access_token_audit_test.go;;model/audit_log.go | go:p13.2 |
| P13-02-CAP-09 | verification criteria | 验证准则：controller 静默登录/令牌生命周期测试 + service 令牌防篡改测试全部通过。 | controller/email_code_login_test.go;;service/auth_token_test.go | go:p13.2 |
| P13-02-CAP-10 | traceable implementation evidence | 实现证据：controller/user.go、model/user*.go、oauth/ 与前端 auth 特性目录物理存在。 | controller/user.go;;model/user.go;;model/user_access_token.go;;model/user_auth_cache.go;;model/user_month_quota.go | go:p13.2 |
| P13-03-CAP-01 | business owner | 模型与供应商域所有者：Uter 平台工程负责人；AES 治理执行会话登记。 | model/channel.go | go:p13.3 |
| P13-03-CAP-02 | authoritative requirement | 渠道与模型数据由管理端维护；价格同步必须以官方价为准，且只填补未定价模型，不得覆盖已有定价。 | model/model_pricing_autofill_test.go;;service/dreamrouter_sync.go | go:p13.3 |
| P13-03-CAP-03 | domain model or equivalent specification | 渠道域模型：Channel/定价端点/模型定价自动填充（model/channel.go、model/pricing_endpoint_test.go）。 | model/channel.go;;model/pricing_endpoint_test.go | go:p13.3 |
| P13-03-CAP-04 | business invariants | 官方价自动填充只影响未定价模型（TestAutoFillOfficialPricingFillsUnpricedModelsOnly）；已有定价永不被自动填充覆盖。 | model/model_pricing_autofill_test.go | go:p13.3 |
| P13-03-CAP-05 | state transitions | 渠道更新触发高级自定义配置到缓存的同步（TestCacheUpdateChannelSyncsAdvancedCustomConfig）；同步任务状态由 system_task 跟踪。 | model/pricing_endpoint_test.go;;service/dreamrouter_sync_task.go | go:p13.3 |
| P13-03-CAP-06 | failure behavior | 价格同步失败必须可重试且不破坏现有定价数据；上游不可达时保留最后已知定价。 | service/dreamrouter_sync_task.go;;model/model_pricing_autofill_test.go | go:p13.3 |
| P13-03-CAP-07 | authorization rules | 渠道与模型管理操作必须管理员权限；渠道 API 密钥仅存服务端。 | controller/user.go;;middleware/auth.go | go:p13.3 |
| P13-03-CAP-08 | data integrity requirements | 定价数据与端点配置落库一致性由 pricing_endpoint 测试矩阵保证。 | model/pricing_endpoint_test.go;;model/channel.go | go:p13.3 |
| P13-03-CAP-09 | verification criteria | 验证准则：model 层官方价自动填充只填补未定价模型、渠道更新同步高级自定义配置两组测试全部通过。 | model/model_pricing_autofill_test.go;;model/pricing_endpoint_test.go | go:p13.3 |
| P13-03-CAP-10 | traceable implementation evidence | 实现证据：model/channel.go、dreamrouter 同步服务、定价端点测试物理存在。 | model/channel.go;;service/dreamrouter_sync.go;;service/dreamrouter_sync_task.go;;model/model_pricing_autofill_test.go;;model/pricing_endpoint_test.go | go:p13.3 |
| P13-04-CAP-01 | business owner | AI Relay 域所有者：Uter 平台工程负责人；AES 治理执行会话登记。 | relay/relay_adaptor.go | go:p13.4 |
| P13-04-CAP-02 | authoritative requirement | 所有上游转发必须携带有效渠道凭证并经用户鉴权与配额校验；重试与渠道切换不得导致重复计费或重复输出。 | relay/relay_adaptor.go;;service/relay_error.go | go:p13.4 |
| P13-04-CAP-03 | domain model or equivalent specification | relay 域模型：relay_adaptor/relay_task/common_handler/relay_error（relay/*.go）。 | relay/relay_adaptor.go;;relay/relay_task.go;;service/relay_error.go | go:p13.4 |
| P13-04-CAP-04 | business invariants | 已向客户端写出流内容后禁止重试切换渠道（TestDecideRelayRetryStopsAfterOutputWritten）；提交后的流式任务永不重试（TestAcceptedSubmitStreamNeverRetries）。 | service/relay_error.go;;controller/relay_task_plugin_test.go | go:p13.4 |
| P13-04-CAP-05 | state transitions | 请求生命周期：接收→鉴权→配额预留→转发→流式输出→结算；输出开始后进入不可重试状态。 | service/relay_error.go;;relay/relay_task.go | go:p13.4 |
| P13-04-CAP-06 | failure behavior | 重试决策必须区分可重试与不可重试错误；失败不得向客户端泄露上游地址或敏感响应体。 | service/relay_error.go | go:p13.4 |
| P13-04-CAP-07 | authorization rules | 渠道凭证仅存服务端；用户侧请求必须携带有效访问令牌并经配额校验后方可转发。 | middleware/auth.go;;relay/relay_adaptor.go | go:p13.4 |
| P13-04-CAP-08 | data integrity requirements | 用量快照在部分更新时保持一致；流式中断时的已消耗配额必须按实际用量结算。 | service/relay_error.go;;service/billing_session.go | go:p13.4 |
| P13-04-CAP-09 | verification criteria | 验证准则：service 层重试决策测试 + controller 层流式任务重试测试通过。 | service/relay_error.go;;controller/relay_task_plugin_test.go | go:p13.4 |
| P13-04-CAP-10 | traceable implementation evidence | 实现证据：relay/ 协议处理器、controller 中继入口、错误重试服务物理存在。 | relay/relay_adaptor.go;;relay/relay_task.go;;controller/relay_task_plugin_test.go;;service/relay_error.go | go:p13.4 |
| P13-05-CAP-01 | business owner | 用量与定价域所有者：Uter 平台工程负责人（计费规则由资金安全负责人复核）；AES 治理执行会话登记。 | service/billing.go | go:p13.5 |
| P13-05-CAP-02 | authoritative requirement | 计量计费必须以会话为单位预留→结算→扣减；任何计费路径不得接受未经验证的价格输入。 | service/billing.go;;service/billing_session.go | go:p13.5 |
| P13-05-CAP-03 | domain model or equivalent specification | 计费域模型：billing/billing_session/billing_usage/custom_pricing/quota（service/*.go）。 | service/billing.go;;service/billing_session.go;;service/custom_pricing.go | go:p13.5 |
| P13-05-CAP-04 | business invariants | 配额下溢必须拒绝（TestAdjustUserUsedQuotaRejectsUnderflow）；组织与成员配额调整必须原子（TestAdjustOrgAndMemberUsedQuotaIsAtomicOnMemberUnderflow）。 | model/organization_test.go | go:p13.5 |
| P13-05-CAP-05 | state transitions | 计费会话生命周期：预留（reserve）→ 使用累计 → 结算（settle）→ 扣减余额；预留失败不得产生用量。 | service/tiered_settle_test.go;;service/billing_session.go | go:p13.5 |
| P13-05-CAP-06 | failure behavior | 钱包预留失败必须可补偿且可重试；部分更新失败时计费快照不丢失。 | service/tiered_settle_test.go;;service/billing.go | go:p13.5 |
| P13-05-CAP-07 | authorization rules | 成员子配额只能由组织管理员调整，负值必须拒绝（TestAddMembersRejectsNegativeSubQuotaLimit）。 | model/organization_test.go;;middleware/auth.go | go:p13.5 |
| P13-05-CAP-08 | data integrity requirements | 配额变更原子性：组织与成员 used quota 调整在同一事务内完成，成员下溢时整体回滚。 | model/organization_test.go | go:p13.5 |
| P13-05-CAP-09 | verification criteria | 验证准则：model 层配额原子性测试 + service 层钱包预留扣减测试通过。 | model/organization_test.go;;service/tiered_settle_test.go | go:p13.5 |
| P13-05-CAP-10 | traceable implementation evidence | 实现证据：service/billing*.go、custom_pricing、quota 服务与组织配额测试物理存在。 | service/billing.go;;service/billing_session.go;;service/billing_usage.go;;service/custom_pricing.go;;model/organization_test.go | go:p13.5 |
| P13-06-CAP-01 | business owner | 钱包与账务域所有者：Uter 资金安全负责人；AES 治理执行会话登记。 | model/quota_reserve.go | go:p13.6 |
| P13-06-CAP-02 | authoritative requirement | 入账必须由订单状态机驱动并使用下单时金额快照；任何路径不得绕过金额校验直接修改余额。 | model/topup.go;;model/quota_reserve.go | go:p13.6 |
| P13-06-CAP-03 | domain model or equivalent specification | 钱包域模型：TopUp/QuotaReserve/Redemption（model/*.go）与钱包前端特性。 | model/topup.go;;model/quota_reserve.go;;model/redemption.go | go:p13.6 |
| P13-06-CAP-04 | business invariants | 并发领取同一 pending 订单只有一方成功（TestClaimPendingTopUpOnlyWinsOnce）；claim 的列写入必须原子（TestClaimPendingTopUpWritesExtraColumnsAtomically）。 | model/topup_claim_pending_test.go | go:p13.6 |
| P13-06-CAP-05 | state transitions | 订单状态机：pending→success/expired，由 topup_order_state_matrix 测试矩阵约束，非法转换一律拒绝。 | model/topup_order_state_matrix_test.go;;model/topup.go | go:p13.6 |
| P13-06-CAP-06 | failure behavior | 钱包预留失败必须可补偿且可重试；领取失败方必须按幂等重复处理，绝不二次入账。 | model/quota_reserve.go;;model/topup_claim_pending_test.go | go:p13.6 |
| P13-06-CAP-07 | authorization rules | 充值与兑换记录只允许所有者或管理员查看；兑换码核销必须服务端验证。 | model/redemption.go;;controller/topup.go | go:p13.6 |
| P13-06-CAP-08 | data integrity requirements | claim、状态更新与额度入账必须在同一事务内完成；状态 CAS 保证重复通知幂等。 | model/topup_claim_pending_test.go;;model/topup.go | go:p13.6 |
| P13-06-CAP-09 | verification criteria | 验证准则：model 层 claim 并发唯一性与原子写入测试通过。 | model/topup_claim_pending_test.go | go:p13.6 |
| P13-06-CAP-10 | traceable implementation evidence | 实现证据：model/topup.go、quota_reserve、redemption、claim 并发测试物理存在。 | model/topup.go;;model/quota_reserve.go;;model/redemption.go;;model/topup_claim_pending_test.go;;service/tiered_settle_test.go | go:p13.6 |
| P13-07-CAP-01 | business owner | 支付域所有者：Uter 资金安全负责人；AES 治理执行会话登记。 | controller/topup_alipay.go | go:p13.7 |
| P13-07-CAP-02 | authoritative requirement | 所有支付回调与查单入账必须：验签通过、金额与下单快照一致、本地订单记录存在；三者缺一绝不入账。 | controller/topup_alipay.go;;controller/payment_reconcile_task.go | go:p13.7 |
| P13-07-CAP-03 | domain model or equivalent specification | 支付域模型：TopUp 状态机 + 各渠道回调处理器（alipay/wechat/epay/stripe/creem/waffo）+ 对账任务。 | model/topup.go;;controller/topup_alipay.go;;controller/payment_reconcile_task.go | go:p13.7 |
| P13-07-CAP-04 | business invariants | 伪签名拒绝（TestPaymentCallbacksRejectForgedSignatures）；金额不匹配拒绝（TestAlipayReconcileRejectsAmountMismatch）；本地订单记录缺失绝不入账（TestAlipayReconcileDoesNotCreditMissingOrderRecord）。 | controller/topup_callback_security_matrix_test.go;;controller/payment_recovery_fault_injection_test.go | go:p13.7 |
| P13-07-CAP-05 | state transitions | 订单状态矩阵约束全部合法转换（TestTopUpOrderStateMatrix）；乱序/重复通知不得复活终态订单。 | model/topup_order_state_matrix_test.go | go:p13.7 |
| P13-07-CAP-06 | failure behavior | 网关故障轮次零入账且下一轮自动重试（TestAlipayReconcileRetriesAfterGatewayFailureRound）；worker 并发触发单飞保护且总额度恰好一次（TestAlipayReconcileWorkerSingleFlightExactOnceCredit）；回调丢失由对账兜底（TestGetUserTopUpsReconcilesBeforeReturning）。 | controller/payment_recovery_fault_injection_test.go;;controller/payment_reconcile_task_test.go | go:p13.7 |
| P13-07-CAP-07 | authorization rules | 回调必须验签；中国区支付辅助函数必须先取得合规确认（TestChinaPaymentTopUpHelpersRequireComplianceConfirmation）；签名验签由 cn_pay_sign 服务统一实现。 | controller/topup_callback_security_matrix_test.go;;service/cn_pay_sign.go | go:p13.7 |
| P13-07-CAP-08 | data integrity requirements | 入账 CAS 幂等：异步回调、主动查单、后台对账三方并存安全，重复执行不重复加额度；claim 与状态更新同事务。 | model/topup_claim_pending_test.go;;model/topup.go | go:p13.7 |
| P13-07-CAP-09 | verification criteria | 验证准则：状态矩阵 + 回调签名安全矩阵 + 故障注入三件套（缺失记录/故障重试/单飞）全部执行通过。 | model/topup_order_state_matrix_test.go;;controller/topup_callback_security_matrix_test.go;;controller/payment_recovery_fault_injection_test.go | go:p13.7 |
| P13-07-CAP-10 | traceable implementation evidence | 实现证据：各渠道回调处理器（alipay/wechat/epay/stripe/creem/waffo）、对账任务实现、故障注入测试与状态矩阵测试全部物理存在，由本验证器每次执行实时核验。 | controller/topup_alipay.go;;controller/payment_reconcile_task.go;;controller/payment_recovery_fault_injection_test.go;;model/topup_order_state_matrix_test.go;;controller/topup_callback_security_matrix_test.go | go:p13.7 |
| P13-08-CAP-01 | business owner | 任务与调度域所有者：Uter 平台工程负责人；AES 治理执行会话登记。 | model/system_task.go | go:p13.8 |
| P13-08-CAP-02 | authoritative requirement | 周期任务只能由主节点调度（IsMasterNode gate）；同一任务 key 不得同时存在活跃运行。 | model/system_task.go;;model/system_task_test.go | go:p13.8 |
| P13-08-CAP-03 | domain model or equivalent specification | 调度域模型：SystemTask/Outbox/恢复任务（system_task.go、midjourney_refund_log_outbox.go、refund_intent_recovery_task.go）。 | model/system_task.go;;model/midjourney_refund_log_outbox.go;;controller/refund_intent_recovery_task.go | go:p13.8 |
| P13-08-CAP-04 | business invariants | 活跃 key 防重复运行（TestSystemTaskActiveKeyPreventsDuplicateActiveRun）；outbox 租约互斥（TestMidjourneyRefundOutboxLeaseIsExclusive）。 | model/system_task_test.go;;model/midjourney_refund_log_outbox_test.go | go:p13.8 |
| P13-08-CAP-05 | state transitions | 任务生命周期：create→active→history（TestSystemTaskCreateAndActiveLifecycle）；outbox：pending→delivered→dead-letter。 | model/system_task_test.go;;model/midjourney_refund_log_outbox_test.go | go:p13.8 |
| P13-08-CAP-06 | failure behavior | outbox 投递失败按预算重试后进入死信（TestMidjourneyRefundOutboxRetriesThenDeadLetters）；恢复任务失败可重试且不破坏业务数据。 | model/midjourney_refund_log_outbox_test.go;;controller/refund_intent_recovery_task.go | go:p13.8 |
| P13-08-CAP-07 | authorization rules | 任务插件绑定需要 bind 权限（TestAddChannelTaskPluginRequiresBindPermission）；任务管理接口仅管理员可用。 | middleware/auth.go;;model/system_task.go | go:p13.8 |
| P13-08-CAP-08 | data integrity requirements | 任务领取互斥、历史落库矩阵化（TestSystemTaskHistoryDatabaseMatrix）；outbox 与业务写入同事务。 | model/system_task_test.go;;model/midjourney_refund_outbox_test.go | go:p13.8 |
| P13-08-CAP-09 | verification criteria | 验证准则：system_task 生命周期/防重 + outbox 重试死信测试通过。 | model/system_task_test.go;;model/midjourney_refund_log_outbox_test.go | go:p13.8 |
| P13-08-CAP-10 | traceable implementation evidence | 实现证据：system_task、outbox、恢复任务实现与测试物理存在。 | model/system_task.go;;model/midjourney_refund_log_outbox.go;;controller/refund_intent_recovery_task.go;;model/system_task_test.go;;model/midjourney_refund_log_outbox_test.go | go:p13.8 |
| P13-09-CAP-01 | business owner | 数据一致性域所有者：Uter 平台工程负责人；AES 治理执行会话登记。 | model/accounting_tx_test.go | go:p13.9 |
| P13-09-CAP-02 | authoritative requirement | 跨表账务变更必须使用事务原语；迁移必须幂等且遵循 DATABASE-STANDARD 的三库约束。 | docs/ai-specs/DATABASE-STANDARD.md;;uaes/standards/DATABASE-STANDARD.md | go:p13.9 |
| P13-09-CAP-03 | domain model or equivalent specification | 一致性域模型：accounting_tx 事务原语 + outbox 模式 + 迁移矩阵（model/accounting_tx_test.go、model/midjourney_refund_outbox_test.go）。 | model/accounting_tx_test.go;;model/midjourney_refund_outbox_test.go | go:p13.9 |
| P13-09-CAP-04 | business invariants | 事务原语要么全部提交要么全部回滚（CommitTogether/RollbackTogether）；缺失行必须拒绝（RejectMissingRows）；用量下溢拒绝（RejectUsageUnderflow）。 | model/accounting_tx_test.go | go:p13.9 |
| P13-09-CAP-05 | state transitions | outbox 状态：pending→delivered（幂等投递）→dead-letter（预算耗尽）；每次转换与业务事务绑定。 | model/midjourney_refund_log_outbox_test.go | go:p13.9 |
| P13-09-CAP-06 | failure behavior | 退款操作与 outbox 创建必须同事务原子（TestCreateMidjourneyRefundOperationWithOutboxTxIsAtomic）；投递失败重试后死信，不丢失、不重复。 | model/midjourney_refund_outbox_test.go;;model/midjourney_refund_log_outbox_test.go | go:p13.9 |
| P13-09-CAP-07 | authorization rules | outbox 拒绝非法身份与不支持的载荷版本（OutboxIdentityAndValidation / RejectsUnsupportedPayloadVersions）。 | model/midjourney_refund_log_outbox_test.go | go:p13.9 |
| P13-09-CAP-08 | data integrity requirements | 投递幂等（TestMidjourneyRefundLogOutboxDeliveryIsIdempotent）；账务原语禁止部分提交。 | model/midjourney_refund_log_outbox_test.go;;model/accounting_tx_test.go | go:p13.9 |
| P13-09-CAP-09 | verification criteria | 验证准则：账务事务原语四向测试 + outbox 原子性与幂等测试通过。 | model/accounting_tx_test.go;;model/midjourney_refund_outbox_test.go;;model/midjourney_refund_log_outbox_test.go | go:p13.9 |
| P13-09-CAP-10 | traceable implementation evidence | 实现证据：accounting_tx、outbox 实现与测试、数据库标准文档物理存在。 | model/accounting_tx_test.go;;model/midjourney_refund_outbox_test.go;;docs/ai-specs/DATABASE-STANDARD.md;;uaes/standards/DATABASE-STANDARD.md | go:p13.9 |
| P13-10-CAP-01 | business owner | 业务可观测性域所有者：Uter 平台工程负责人；AES 治理执行会话登记。 | model/audit_log.go | go:p13.10 |
| P13-10-CAP-02 | authoritative requirement | 业务操作（令牌、日志导出、管理动作）必须可审计；审计与导出必须按组织范围过滤并鉴权。 | model/audit_log.go;;controller/log_export_test.go | go:p13.10 |
| P13-10-CAP-03 | domain model or equivalent specification | 可观测性域模型：AuditLog/日志导出/用量日志（model/audit_log.go、controller/log_export*.go）。 | model/audit_log.go;;controller/log_export_test.go | go:p13.10 |
| P13-10-CAP-04 | business invariants | 日志导出加锁防并发重复（TestAcquireLogExportLock）；审计矩阵落库（TestAPITokenAuditDatabaseMatrix/TestLogExportDatabaseMatrix）。 | controller/log_export_test.go;;controller/token_test.go | go:p13.10 |
| P13-10-CAP-05 | state transitions | 导出任务：pending→done/failed；锁获取失败必须让后续导出等待而非覆盖。 | controller/log_export_test.go | go:p13.10 |
| P13-10-CAP-06 | failure behavior | 组织成员查询失败时日志范围必须 fail-closed（TestApplyOrgLogScopeFailsClosedOnMembershipLookupErrors），不得放大可见范围。 | controller/log_scope_test.go | go:p13.10 |
| P13-10-CAP-07 | authorization rules | rankings 等模块要求登录（TestHeaderNavModuleAuthRequiresLoginForRankings）；日志导出与管理员审计查询必须管理员权限。 | controller/log_scope_test.go;;middleware/auth.go | go:p13.10 |
| P13-10-CAP-08 | data integrity requirements | 审计事件落库矩阵化（令牌审计矩阵与日志导出矩阵）；导出结果必须与请求数一致，不重复、不遗漏、不可篡改。 | controller/token_test.go;;controller/log_export_test.go | go:p13.10 |
| P13-10-CAP-09 | verification criteria | 验证准则：审计矩阵 + 组织范围 fail-closed + 导出锁与矩阵测试通过。 | controller/token_test.go;;controller/log_scope_test.go;;controller/log_export_test.go | go:p13.10 |
| P13-10-CAP-10 | traceable implementation evidence | 实现证据：audit_log、日志导出、范围过滤实现与测试物理存在。 | model/audit_log.go;;controller/log_export_test.go;;controller/log_scope_test.go;;controller/token_test.go | go:p13.10 |
