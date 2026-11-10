# UTER P13 — Business Domain Engineering

| Field | Value |
|---|---|
| Document ID | `UTER-P13-001` |
| Classification | **Uter project-specific governance extension** |
| Governing specification | `docs/ai-specs/UTER-AES-GOVERNANCE-ARCHITECTURE-WORKBUDDY-EXECUTION-SPECIFICATION.md` (`UTER-AES-GOV-001`) |
| Registered in | Uter project governance registry: `.aes/uter-governance-registry.yaml` |
| **Not registered in** | AES universal standards registry (`.aes/STANDARD-REGISTRY.yaml` in the AES repository) |
| AES baseline inherited | `1.12.2 / ACTIVE`, source commit `8e1c72d9015f600ea541ef84c8530753d65fc4e7` (provenance only), registry blob `308d9610c679f1c75a049953feb1341d7b55c365`; governed fingerprint pending machine recomputation |
| Uter revision at inventory | `ef778bf08f335aaf16f4c8805be02b1111336fbe` |
| Status | `PROPOSED_BASELINE` — repository inventory completed; domain acceptance **not** performed |
| Language | 中文（术语保留英文） |

> **归属声明（§1.3 / §4.1）**：P13 只定义 Uter 专属业务领域规则，**不属于 AES 通用标准**，
> 不得写入 AES `standards/`、`.aes/registry/` 或 AES Registry。
> AES 仓库 `reports/` 下历史命名的 `AES-P13-*`（Repository Integration 阶段派生报告）
> 与本文档无关，且该文件自带「本文件是实施证据，不是 AES 标准文件」声明。

---

## 1. 目的与边界

P13 继承 AES P00–P12 全部适用强制要求（§4.3），只补充 Uter 项目特有的业务规则、
领域模型、状态机、业务不变量与业务验收条件。

按 §1.3 / §17：

- **不得**把 Uter 专属支付流程、Token 计费、模型路由、余额账务、订单状态机、渠道管理写入 AES。
- **不得**用 P13 削弱或重定义任何 AES 强制要求；P13 只能增加更严格的项目级约束。
- **不得**从当前代码反推业务规则当成权威需求（§4.2）。代码与批准需求不一致时必须登记差异并走变更控制。
- 冲突必须登记并上报，**Agent 不得自行选择较宽松的规则**（§1.4 第 7 条）。

按 §0.3：**存在代码或文档不等于符合规范**；单个测试通过不等于系统符合。
因此下文每个域只记录「已盘点的实现位置」，不声称该域已通过验收。

---

## 2. 真实仓库盘点（§4.1 要求：先检查实际仓库，再定义范围）

盘点命令：`ls controller/ service/ model/ relay/ router/ plugins/tasks/ web/src/features/` +
`git status --porcelain` + `git rev-parse HEAD`。盘点对象为 Uter 仓库 `ef778bf08`，
未修改任何业务代码。下表「实现位置」是**物理文件清单**，不是业务规则定义，
也不是验证结论（§4.2 / §0.3）。

状态口径来自 §5.3：`IMPLEMENTED`（存在实现，尚未 VERIFIED）、
`GAP_IDENTIFIED`（已发现缺口）、`NOT_ASSESSED`（未评估）。
**本执行没有把任何域标记为 `VERIFIED`。**

| 域 | 规范条目 | 真实实现位置（盘点） | 状态 |
|---|---|---|---|
| P13.1 产品与业务需求 | Product / business requirements | `docs/ai-specs/PRODUCT-REQUIREMENTS-STANDARD.md`, `web/src/features/*` (about/home/pricing/models/chat/playground/docs/legal) | `IMPLEMENTED` / 需求到实现的追踪未验证 |
| P13.2 身份与账户 | Identity & account | `controller/user.go`, `model/user.go`, `model/user_access_token.go`, `model/user_cache.go`, `model/user_month_quota.go`, `oauth/`, `web/src/features/auth/`, `web/src/features/users/`, `web/src/features/organization/`, `web/src/features/security/` | `IMPLEMENTED` / 账户状态机与租户边界未独立验收 |
| P13.3 模型与供应商 | Model & provider | `model/`(model/channel/pricing 相关), `service/dreamrouter_sync.go`, `service/dreamrouter_sync_task.go`, `service/pricing_post_sync.go`, `web/src/features/models/`, `web/src/features/channels/`, `web/src/features/model-pricing/`, `web/src/features/system-settings/` | `IMPLEMENTED` / 价格同步与上游状态规则未独立验收 |
| P13.4 AI Relay | AI relay | `relay/`(relay_adaptor.go, relay_task.go, common_handler/, channel/, common/, helper/, costopt/, 各协议 handler), `controller/relay*`, `router/api-router.go` | `IMPLEMENTED` / 流式、超时、重试、渠道切换行为未独立验收 |
| P13.5 用量与定价 | Usage & pricing | `service/billing.go`, `service/billing_session.go`, `service/billing_usage.go`, `service/custom_pricing.go`, `service/task_billing.go`, `service/image_billing.go`, `service/quota.go`, `service/text_quota.go`, `service/dreamrouter_pricing_expr.go`, `pkg/billingexpr/`, `web/src/features/pricing/` | `IMPLEMENTED` / 精度、舍入、价格版本规则需条款级复核 |
| P13.6 钱包与账务 | Wallet & accounting | `model/quota_reserve.go`, `model/topup.go`, `model/redemption.go`, `service/quota_error.go`, `controller/topup.go`, `web/src/features/wallet/`, `web/src/features/redemption-codes/` | `IMPLEMENTED` / 幂等、并发扣减、账务对账未独立验收 |
| P13.7 支付 | Payment | `controller/topup_alipay.go`, `topup_wechat.go`, `topup_waffo*.go`, `topup_stripe.go`, `topup_creem.go`, `topup_epay*`, `subscription_payment_*.go`, `controller/payment_compliance.go`, `payment_reconcile_task.go`, `payment_webhook_availability.go`, `return_path.go`, `service/alipay_query.go`, `service/wechat_query.go`, `service/cn_pay_sign.go`, `service/epay.go`, `web/src/features/wallet/lib/payment.ts` | `IMPLEMENTED` / 异常场景矩阵见 §4，未独立验收 |
| P13.8 任务与调度 | Task & scheduler | `controller/midjourney_refund_outbox_task.go`, `midjourney_refund_recovery_task.go`, `refund_intent_recovery_task.go`, `service/dreamrouter_sync_task.go`, `plugins/tasks/*`, `web/src/features/task-plugins/` | `IMPLEMENTED` / 多实例调度、死信、恢复未独立验收 |
| P13.9 数据一致性 | Data consistency | `model/*_test.go` (billing_integrity / topup_order_state_matrix / refund_intent / outbox), `scripts/` 迁移矩阵, `docs/ai-specs/DATABASE-STANDARD.md` | `IMPLEMENTED` / 三库迁移与恢复本执行 `NOT_RUN` |
| P13.10 业务可观测性 | Business observability | `web/src/features/usage-logs/`, `performance-metrics/`, `system-info/`, `rankings/`, `logger/`, `model/` 日志相关表 | `IMPLEMENTED` / 脱敏与审计完整性未独立验收 |

**盘点结论**：10 个业务域在代码层均有可定位实现，但按 §4.2「业务规则不得仅从代码推断」，
本执行**不把这些实现当作已批准的业务需求**；权威业务需求、业务所有者与验收准则尚未逐域确认，
已登记为 `P13-REQ-001`。

---

## 3. 每个业务能力必须具备的 10 项（§4.2）

| # | 要求 | 当前处置 |
|---|---|---|
| 1 | 明确的业务所有者 | 未确认 → `P13-REQ-001` |
| 2 | 权威业务需求 | 未确认 → `P13-REQ-001` |
| 3 | 领域模型或等价规格 | 部分存在于代码与 `docs/ai-specs/`，未批准 |
| 4 | 业务不变量 | 部分有测试覆盖，未条款化 |
| 5 | 状态转换定义（适用时） | `model/topup_order_state_matrix_test.go` 等存在，未批准为规格 |
| 6 | 失败行为定义 | 部分有恢复任务，未条款化 |
| 7 | 授权规则 | 散落在 `middleware/` 与 controller，未条款化 |
| 8 | 数据完整性要求 | 部分有测试，未条款化 |
| 9 | 验证准则 | 未逐域批准 |
| 10 | 可追溯实现证据 | 本文件 §2 提供物理位置，非验收证据 |

按 §13.2：**不得仅因为存在实现变更就关闭 finding**；按 §5.3：`IMPLEMENTED` 不等于 `VERIFIED`。

---

## 4. 支付域重点异常场景（P13.7，最高资金风险）

以下场景为**必须验证清单**，不是已完成清单。按 §9.4，涉及真实资金的测试必须使用
经批准的隔离测试环境；本执行未运行任何真实资金或生产库测试。

| # | 场景 | 现有可定位证据 | 本执行状态 |
|---|---|---|---|
| 1 | 支付成功但本地订单保存失败 | `controller/refund_intent_recovery_task.go`, `controller/payment_reconcile_task.go` | `NOT_RUN` |
| 2 | 支付通知重复 | `model/topup_claim_pending_test.go`, `controller/topup_callback_security_matrix_test.go` | 单元测试存在，端到端 `NOT_RUN` |
| 3 | 通知乱序 | `model/topup_order_state_matrix_test.go` | 单元测试存在，端到端 `NOT_RUN` |
| 4 | 金额不一致 | `controller/topup_amount_match_test.go`, `topup_cn_amount_snapshot_test.go`, `topup_pay_money_rounding_test.go` | 单元测试存在，端到端 `NOT_RUN` |
| 5 | 签名验证失败 | `service/cn_pay_notify_verify_test.go`, `cn_pay_sign_test.go`, `controller/topup_gateway_contract_test.go` | 单元测试存在，端到端 `NOT_RUN` |
| 6 | 订单状态不一致 | `model/topup_order_state_matrix_test.go`, `topup_status_retry_test.go` | 单元测试存在，端到端 `NOT_RUN` |
| 7 | 退款重复 | `model/midjourney_refund_transaction_test.go`, `refund_intent_test.go` | 单元测试存在，端到端 `NOT_RUN` |
| 8 | 支付渠道异常 | `controller/topup_wechat_query_test.go`, `topup_alipay_query_test.go` | 单元测试存在，端到端 `NOT_RUN` |
| 9 | 回调丢失 | `service/alipay_query.go`, `controller/payment_reconcile_task.go`, `web/src/features/wallet/lib/alipay-return.ts` | 主动查单/对账链路存在，端到端 `NOT_RUN` |
| 10 | 订单恢复失败 | `controller/payment_reconcile_task_test.go`, `refund_intent_recovery_task_test.go` | 单元测试存在，端到端 `NOT_RUN` |

---

## 5. 继承映射（§4.3）

| AES 域 | P13 继承要求 | 不得削弱的红线 |
|---|---|---|
| P00 Foundation | 规范注册、版本、追踪 | 版本必须锁定，需求必须有所有者与验证方法 |
| P01 AI Governance | 业务自动化中的 Agent 权限 | 越权一律 fail-closed |
| P02 Product Engineering | 业务需求可测试、可追踪 | 需求必须有验收准则 |
| P03 Knowledge Engineering | 业务知识与实际代码一致 | 不得把未验证信息当作权威 |
| P04 System Architecture | 业务模块边界与 ADR | 实现必须与批准架构一致 |
| P05 Experience & Design | 钱包/定价等 UI | 遵循 UTER Design System 3.0 |
| P06 Software Engineering | 类型安全、错误处理、静态分析 | 敏感信息不得进日志 |
| P07 Cross-Platform | Electron / Web 一致性 | 未验证平台不得标记已支持 |
| P08 AI Agent Engineering | 业务任务执行 Agent | 必须在显式权限内运行 |
| **P09 Quality Engineering** | **证明**业务工程质量是否达到要求：测试策略、测试执行、缺陷管理、质量度量、质量验收 | 不得用单次测试通过代替体系验收 |
| **P10 Security & Reliability** | **定义**系统必须达到的安全与可靠性要求：威胁建模、身份/API/数据安全、可靠性目标、备份恢复、事件响应 | 不得用「扫描器无报告」代替安全符合性 |
| P11 DevOps & Delivery | 业务变更的构建/发布/回滚 | 可复现、可回滚、有交付证据 |
| P12 Lifecycle & Evolution | 业务规则与数据迁移演进 | 变更必须做影响分析与兼容性评估 |

> **P09 / P10 分工（用户明确要求，§1.3 / §8 / §9 / §10 / §16.3）**：
> P09 管理**质量验证体系**（是否达到要求、测试如何组织、缺陷如何闭环、证据如何归档）；
> P10 定义**系统必须达到什么安全与可靠性要求**（控制目标、阈值、恢复目标）。
> 安全测试由 P10 提出要求，由 P09 的测试工程体系组织执行与记录。
> 两者共同构成强制门禁，但**不得互相代替、不得重复建立冲突的管理体系**。
> 机器可读声明见 `.aes/uter-governance-registry.yaml` 的 `domain_ownership.P09/P10`，
> 自动化校验见 `scripts/quality/uter-p09-p10-boundary-check.rb`。

---

## 6. 验收状态与证据要求

- 按 §16.3，UTER P13 作为**独立域**评估，不得因 AES 某域通过而抵消。
- 按 §16.4，全局符合性声明不得在存在未评估/无证据的强制要求时作出。
- 按 §14.3，每条证据需记录 Evidence ID、关联需求、修订版本、执行环境、采集时间、采集者、完整性信息、存储引用。
- 按 §9.3，每项测试执行需记录 Test ID、用例版本、被测修订、环境、工具版本、预期/实际结果、PASS/FAIL/BLOCKED、失败详情、缺陷引用、证据位置。

**本域当前结论：`NOT ASSESSED`（§16.2）** —— 已完成仓库盘点与规范落盘，
但 §3 的 10 项、§4 的 10 个异常场景、独立域验收与证据链均未完成。

---

## 7. 禁止项

1. 不得把本文件或任何 UTER P13 内容提交进 AES `standards/`、`.aes/registry/` 或 AES Registry。
2. 不得把 Uter 业务实现细节反向写入 AES 通用标准。
3. 不得因"代码里有实现"而把业务域标记为 `VERIFIED` 或 `CONFORMANT`。
4. 不得在未获授权时使用真实资金、生产数据库或生产支付配置做验证。
5. 不得由 WorkBuddy 自行批准业务风险、例外或削弱任何 AES 强制要求（§6.1 / §13.4）。
