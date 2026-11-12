# UAP-06-002 — 资金与数据完整性规范

**编号：** UAP-06-002
**标准编号：** UAP-06-002
**名称：** 资金与数据完整性规范
**版本：** 1.0.0
**状态：** ACTIVE
**适用范围：** 约束 Uter 充值/支付/退款/扣费/余额/订单全链路：后端 `controller/topup*.go`（`topup.go`、`topup_alipay.go`、`topup_wechat.go`、`topup_stripe.go`、`topup_waffo.go`、`topup_waffo_pancake.go`、`topup_creem.go`）、`controller/return_path.go`、`service/alipay_query.go`、`model.TopUp` 与 `common/quota_math.go`、`service/log_info_generate.go`，以及前端 `web/src/features/wallet/lib/payment.ts`、`web/src/features/wallet/lib/__tests__/alipay-return.test.ts`。**所有验证只使用模拟支付、模拟退款与隔离数据库，禁止真实资金；任何生产资金/生产库/真实支付或真实退款操作一律 BLOCKED。**
**关键级别：** P0
**依赖标准：** UAP-01-003、UAP-02-002、UAP-06-001

## 规范目标
本规范把 Uter 已有的资金防护契约固化为可执行的验证要求：金额用 `decimal.Decimal` 与 `common/quota_math.go` 的集中换算，回调必须「验签 + 幂等 + 实付金额比对」三件套，支付宝主动查单按 success/pending/unpaid/closed 四分状态处理，微信 H5 严格区分 APIv3 与 APIv2 的 `scene_info` 字段，按秒计费不得与 token 倍率混用量纲，前端支付金额禁止 `Math.floor`。所有验证由 `.uap/config/workflow-registry.yaml` 的 `uap-financial-verification`（`environment: simulated_only`）驱动，任何资金差异必须阻断相关验收。

## 强制性要求
1. 金额必须采用精确计算类型，不得使用不可靠的浮点计算处理资金。
2. 充值、支付、退款、扣费、余额和订单必须具有明确状态机。
3. 关键资金操作必须保证幂等。
4. 必须防止重复回调导致重复入账。
5. 必须防止并发请求造成余额超扣或重复扣费。
6. 必须验证订单金额、用户、订单状态和支付渠道的一致性。
7. 支付成功通知必须进行签名验证。
8. 退款必须关联原订单和原支付记录。
9. 必须记录资金流水，不得只依赖余额字段。
10. 余额变更必须具备可追溯的业务来源。
11. 关键操作必须考虑事务边界和失败补偿。
12. 必须设计异常恢复、对账和重复通知处理。
13. 支付成功但本地订单未保存、通知延迟、通知重复和退款失败必须有处理策略。
14. Outbox、任务恢复和补偿机制应根据现有架构实现。
15. 数据迁移不得破坏历史订单和资金流水。
16. 测试必须使用模拟支付渠道、模拟回调和隔离数据库。
17. 不得使用真实支付、真实退款或真实资金账户进行测试。
18. 任何资金差异都必须阻断相关验收。

## Uter 落地细则
- **金额精度**：`common/quota_math.go` 用 `github.com/shopspring/decimal` 提供 `QuotaFromDecimal`（decimal 先 `Round(0)` 再饱和）、`QuotaRound`（half-away-from-zero）、`QuotaFromFloat`（截断）、`WalletQuotaFromDecimalStrict`（钱包/充值走 JavaScript 安全整数域 `MaxWalletQuota = 1<<53 - 1`），单次请求饱和在 `MaxQuota = math.MaxInt32`；`AGENTS.md` Billing safety invariants 禁止 `int(float64(quota) * ratio)`、`int(math.Round(...))`、`int(decimal.IntPart())` 等裸转换，所有换算必须复用上述 helper，禁止重引入局部换算。
- **精度与饱和审计**：`common/quota_math.go` 的 `*Checked` 变体（`QuotaFromFloatChecked` / `QuotaRoundChecked` / `QuotaFromDecimalChecked`）返回 `*QuotaClamp`（`Op/Kind/Original/Clamped`），每次 clamp 经 `SysError` 记录；`service/log_info_generate.go` 的 `attachQuotaSaturation` 把标记嵌到 consume/task log 的 `other.admin_info.quota_saturation`，嵌套在 `admin_info` 下对非管理员日志视图自动剥离；`common/quota_math_test.go` 为该边界的真实回归测试。
- **按秒计费价格量纲**：`service/dreamrouter_snapshot_test.go` 的 `TestLoadDreamRouterOfficialReferenceSkipsPerSecondModels` 锁定按秒模型必须下发独立的 `official_price_per_second`（原值、不缩放），**绝不**写入 `model_ratio`（注释明确单位是美元/秒，与 token 倍率不同构，误写即 **586 倍溢价**）；`AGENTS.md` JavaScript task plugins 要求 `usageSchema` / `usageProfiles[].schema` 中 `seconds` 的 `description` 必须是「Video generation unit price / 视频生成单价」且字段值仍是使用量而非价格，时长上限复用 `relaycommon.MaxTaskDurationSeconds`，计费表达式变更先读 `pkg/billingexpr/expr.md`，内置价格定义在 `setting/billing_setting/builtin_billing.go`（真实 USD per million tokens）。
- **状态机**：`model.TopUp` 的 `Status` 取 `common.TopUpStatusPending` / `TopUpStatusSuccess` / `TopUpStatusExpired`，字段含 `TradeNo`、`UserId`、`Amount`（额度）、`Money`（法币）、`ProviderAmount`、`ProviderCurrency`（`"CNY"`）、`PaymentMethod`（`model.PaymentMethodAlipay`）、`PaymentProvider`、`CreateTime`、`CompleteTime`；`controller/topup_alipay_query_test.go` 断言 `TRADE_SUCCESS` 落 `TopUpStatusSuccess` 且 `CompleteTime` 非零、`TRADE_CLOSED` 落 `TopUpStatusExpired`、金额不符保持 `Pending`。
- **支付宝查单状态码四分**（`controller/topup_alipay_query_test.go`）：`TRADE_SUCCESS` → `success`（入账）；`WAIT_BUYER_PAY` → `pending`（订单保持 Pending，前端继续等，几秒后可能转 `TRADE_SUCCESS`）；`code "40004"` + `sub_code "ACQ.TRADE_NOT_EXIST"` → `unpaid`（回 unpaid 而非 pending，避免前端永远「支付确认中」，但本地仍保持 Pending 以便用户用原 pay_url 付款）；`TRADE_CLOSED` → `closed`（终态，落 Expired）；`service/alipay_query_test.go` 的 `TestAlipayQueryOrderTreatsTradeNotExistAsUnpaid` 与 `TestAlipayQueryOrderSurfacesOtherBusinessFailures`（`ACQ.INVALID_PARAMETER` 仍为网关故障错误）补齐 service 层语义。
- **微信 v2/v3 scene_info 差异**（`controller/topup_wechat_h5_scene_test.go`）：APIv3 `/v3/pay/transactions/h5` 的 `scene_info.h5_info` 只允许 `type` / `app_name` / `app_url`（可选 `bundle_id` / `package_name`），`buildWechatH5SceneInfo` 必须含 `payer_client_ip` 且 `h5_info.type = "Wap"`；APIv2 统一订单的 `wap_url` / `wap_name` 在 APIv3 不存在，测试用 `assert.NotContains` 锁死不得回退，否则网关判 `PARAM_ERROR`。
- **幂等与重复回调**：`controller/topup_gateway_contract_test.go` 的 `requiredGatewayCallbacks` 登记 9 个网关回调（EpayNotify / AlipayNotify / QueryAlipayOrder / QueryWechatOrder / WechatPayNotify / StripeWebhook / WaffoWebhook / WaffoPancakeWebhook / CreemWebhook），`TestPaymentGatewayCallbacksAreIdempotent` 断言入账前必有 `LockOrder(` 或 `alreadyDone` / `TopUpStatusPending`；`controller/topup_alipay_query_test.go` 的 `TestQueryAlipayOrderIsIdempotentAfterCallback` 连续两次主动查单断言 `Quota` 不变；`TestGatewayCallbackRegistryCoversAllRechargePaths` 防止新增网关漏登记。
- **并发扣费**：`.github/workflows/ci.yml` 的 `race` job 执行 `go test -race -count=1 ./service/... ./relay/... ./middleware/... ./model/...` 与 `go test -race -count=1 ./e2e/...`；`model/main.go` 的 `lockForUpdate(tx)` 是 GORM v2 下唯一有效的 `FOR UPDATE` 行锁（禁用 v1 `Set("gorm:query_option", ...)` 静默失效写法）；`model/user_cache.go` 的 `runCacheSync` / `WaitCacheSyncForTest()` 与 `perfmetrics.WaitRecordForTest()` 是修复测试隔离竞争的真实屏障；`AGENTS.md` Billing safety invariants 要求预扣费与结算/差额两侧都饱和安全。
- **流水与余额一致性**：`controller/topup_gateway_contract_test.go` 的 `TestGatewayRechargeAmountAlwaysComesFromLocalOrder` 断言 `model.Recharge*` 实参不得含直接取回调 `.Money)`，入账金额恒取本地订单；`TestQueryAlipayOrderCreditsPaidOrder` 用 `common.WalletQuotaFromDecimalStrict(decimal.NewFromFloat(order.Amount).Mul(decimal.NewFromFloat(common.QuotaPerUnit)))` 计算期望额度并比对 `reloaded.Quota`；`applyAlipayQueryResult` / `applyWechatQueryResult` 是用户回跳主动查单、后台对账任务、读时对账共用的唯一入账函数（见 `topup_gateway_contract_test.go` 注释），资金流水由 consume/task log 与 `model.TopUp` 记录而非只依赖 `Quota` 字段。
- **订单金额/用户/状态/渠道一致性**：`TestQueryAlipayOrderRejectsAmountMismatch`（`total_amount "0.01"` vs 快照 `"10.00"` → `订单金额不匹配`，订单保持 Pending，`Quota` 为零）、`TestQueryAlipayOrderRejectsForeignOrder`（拿他人 `trade_no` → `订单不存在`，防越权泄露）、`TestApplyAlipayQueryResultRejectsOrderAndCurrencyMismatch`（返回订单号不符 / `ProviderCurrency` 被改成 `"USD"` → `AlipayReconcileAmountMismatch`）；`StripeWebhook` 用 `expectedCents` 而非 `topUp.Money`（后者经分组倍率换算），`CreemWebhook` 用 `creemPaidCoversOrder` 按最小货币单位（分）判定，`QueryWechatOrder` 用 `providerExpectedMinorUnits` / `WechatReconcileAmountMismatch`。
- **签名验证**：`service/alipay_query_test.go` 的 `TestAlipayQueryOrderRejectsBadSignature` 用另一把 RSA 私钥签名触发 `signature invalid`，正常响应验 `method=alipay.trade.query`、`biz_content={"out_trade_no":"T1"}` 与 `sign`；`controller/topup_alipay_query_test.go` 的 `alipayTestSign` 用 PKCS#8 私钥对 `alipay_trade_query_response` 节点原文做 RSA2（SHA256 + PKCS1v15）签名，服务端必须用同一段字节验签；`topup_gateway_contract_test.go` 为每个网关登记 `verifySign`（`service.AlipayVerifySign(` / `service.WechatPayVerifyNotify(` / `wh.VerifySignature(` / `webhook.ConstructEventWithOptions(` / `verifyCreemSignature(` 等）。
- **前端支付金额禁止 Math.floor**：`web/src/features/wallet/lib/payment.ts` 的 `toPayAmount` 用 `Math.round((amount + Number.EPSILON) * 100) / 100` 保留两位小数（源码注释明确「这里**绝不能取整**：`Math.floor(0.01)` 会变成 0，后端 `req.Amount < min_topup` 直接拒绝且该分支不打日志」），`Number.EPSILON` 修正 1.005 类二进制表示误差并抹掉 `0.1 + 0.2` 浮点尾巴；`getMinTopupAmount` 统一读后端 `operation_setting.MinTopUp`（`min_topup`），`formatPaymentAmount` 按渠道区分人民币 ¥ 与境外美元 $ 结算币种；`submitPaymentForm` 经 `resolvePaymentRedirectUrl` 拒绝 `javascript:` action。
- **前端回跳与通知延迟/重复**：`web/src/features/wallet/lib/__tests__/alipay-return.test.ts` 的 `pollAlipayOrder` 锁定四分状态（success / pending / unpaid / closed）、默认 4 次尝试与 2000ms 间隔（`wait` 只等 3 次）、瞬时网络错误重试、`isCancelled` 卸载即停、`unpaid` 与 `closed` 立即终止不再轮询；后端 `controller/return_path.go` 的 `paymentReturnPath` / `paymentReturnURLFor` / `paymentNotifyURLFor`（优先 `operation_setting.CustomCallbackAddress`）与 `requestOrigin`（`X-Forwarded-Proto` / `X-Forwarded-Host` 取第一段）负责回跳与回调站点根。
- **异常恢复、对账与 Outbox**：`.uap/config/workflow-registry.yaml` 的 `uap-financial-verification` 定义 8 步 `inspect_payment_state_machine → inspect_refund_state_machine → inspect_balance_ledger → test_idempotency → test_concurrency → test_duplicate_notifications → test_failure_recovery → verify_reconciliation`，`environment: simulated_only`、`acceptance: financial_integrity_verified`；主动查单（`QueryAlipayOrder` / `QueryWechatOrder`）是「本地收不到异步回调」的兜底，`apply*QueryResult` 共用函数承担读时对账，`execution.persist_after_each_step: true` / `resume_on_interruption: true` / `stop_on_unrecoverable_data_integrity_failure: true` 与 `.uap/runtime/recovery-engine/index.mjs` 提供任务恢复与补偿。
- **数据迁移与退款链路**：`AGENTS.md` Database compatibility 要求 schema/迁移变更在全新库与「由最新发布版本创建的代表性库升级」两种场景测试、启动迁移至少跑两次证明幂等、验证既有数据/索引/约束/唯一性保留，并覆盖 SQLite / MySQL >= 5.7.8 / PostgreSQL >= 9.6 三方言矩阵与独立日志库；`AGENTS.md` Billing safety invariants 要求新增计费路径追踪 `validation → EstimateBilling/OtherRatios → quota conversion → pre-consume → settle/refund` 全链，`types.PriceData.AddOtherRatio` 拒绝非正、NaN、+Inf 倍率。
- **模拟支付/隔离数据库与生产 BLOCKED**：`controller/topup_alipay_query_test.go` 的 `setupAlipayQueryEnv` / `setupCallbackSecurityDB` 用内存库并指向 `httptest.NewServer` 本地 mock 网关，`t.Cleanup` 还原 `operation_setting.AlipayGateway` 等全局量；`service/alipay_query_test.go` 同样用 `httptest.NewServer` 模拟 `alipay_trade_query_response`；`.uap/config/permission-policy.yaml` 显式 `real_payment: effect: deny`（`All payment verification must use simulation`）、`real_refund: effect: deny`、`production_read/write/deploy: effect: deny`；`.uap/config/workflow-registry.yaml` 的 `uap-financial-verification` 标注 `environment: simulated_only`。**本规范所有验证与 UAP 建设过程禁止真实支付、真实退款、真实资金账户及生产数据库写入；任何此类操作一律 BLOCKED，不得自动执行。**
- **资金差异阻断验收**：`AlipayReconcileAmountMismatch` / `WechatReconcileAmountMismatch` / `订单金额不匹配` / `TopUpStatusPending` 保持 / `Quota` 为零等断言失败即视为资金差异；`security.financial_integrity_validator` 的检查项 `[ledger_consistency, idempotency, concurrency, recovery]` 任一 FAIL 含 `severity=BLOCKER` 即阻断；`service/dreamrouter_snapshot_test.go` 的 `TestDreamRouterDiscountPercentAndZhe`（官方价缺失不编造折扣）与 `TestDreamRouterRowAligned`（只有「写入成功且等于官方价×系数」才算对齐）保护定价对账不被伪造。

## 执行流程
1. `uap-security-agent`（`.uap/engines/security/index.mjs`）按 `.uap/config/workflow-registry.yaml` 的 `uap-financial-verification`（`environment: simulated_only`）发起；先由 policy-engine 按 `.uap/config/permission-policy.yaml` 校验 `real_payment` / `real_refund` / `production_write` 均为 deny，确认环境为模拟支付 + 隔离数据库，否则立即 BLOCKED。
2. 经 `.uap/runtime/_lib/yaml.mjs` 加载 `specification-registry.yaml`（确认 UAP-01-003 / UAP-02-002 / UAP-06-001 三项依赖）、`execution-mapping.yaml`、`validator-registry.yaml`，读取 `controller/topup*.go`、`common/quota_math.go`、`web/src/features/wallet/lib/payment.ts` 计算影响范围。
3. `inspect_payment_state_machine` / `inspect_refund_state_machine` / `inspect_balance_ledger`：核对 `model.TopUp` 状态机、`applyAlipayQueryResult` / `applyWechatQueryResult` 共用入账函数、`model.Recharge*` 入账金额恒取本地订单、`service/log_info_generate.go` 的流水与 `admin_info.quota_saturation` 审计标记。
4. `test_idempotency` / `test_concurrency` / `test_duplicate_notifications`：执行 `controller/topup_alipay_query_test.go`、`service/alipay_query_test.go`、`controller/topup_wechat_h5_scene_test.go`、`controller/topup_gateway_contract_test.go`、`common/quota_math_test.go`、`web/src/features/wallet/lib/__tests__/alipay-return.test.ts`，以及 `go test -race -count=1 ./service/... ./relay/... ./middleware/... ./model/...` 与 `./e2e/...`。
5. `test_failure_recovery` / `verify_reconciliation`：核对支付宝四分状态、金额/用户/订单号/币种一致性、签名验证与前端 `toPayAmount` 两位小数契约；逐条采集命令原文、`exit_code`、耗时与输出，任一 `AlipayReconcileAmountMismatch` 类断言或退出码非 0 即写入 `blocked_reasons`。
6. 结果由 `.uap/runtime/_lib/contract.mjs` 的 `executorResult()` 归一化（`validation_results` 留给独立验证器回填）；生成 `UAP-EVD-...` 证据落盘 `.uap/evidence/`，记录命令、退出码、时间、环境、输入、输出与日志引用，索引追加 `.uap/reports/EVIDENCE-INDEX.md`。
7. `security.financial_integrity_validator` 验证器（`.uap/validators/security/index.mjs`）执行 `ledger_consistency` / `idempotency` / `concurrency` / `recovery`，返回 `validatorResult()`。
8. 仅当 `executed=true && exit_code=0` 且无 `severity=BLOCKER` findings 时判定 `financial_integrity_verified`；任何资金差异一律 fail-closed 记 BLOCKED / FAILED，阻断相关验收并保留失败证据，绝不触碰真实资金。

## 对应执行器
- 执行器 ID：`security.financial_integrity`
- 实现路径：`.uap/engines/security/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：按 `.uap/config/agent-registry.yaml` 的 `uap-security-agent` 与 `.uap/config/permission-policy.yaml`，需 `project_read`（读取资金相关源码/测试/配置）、`local_command`（执行 `go test -race`、`cd web && bun run test` 等已批准命令，受 `require_command_logging: true` 约束）、`test_environment`（`isolated_environment_only: true`，内存库 + `httptest` 模拟网关）、`evidence_write`；受 `enforcement.check_before_action: true`、`fail_closed: true`、`default_effect: deny` 约束，**`real_payment` / `real_refund` / `production_read` / `production_write` / `production_deploy` / `secret_export` 一律 deny，生产资金操作一律 BLOCKED**。

## 对应验证器
- 验证器 ID：`security.financial_integrity_validator`
- 实现路径：`.uap/validators/security/index.mjs`
- 检查项：`[ledger_consistency, idempotency, concurrency, recovery]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `task_id` | 任务唯一 ID，来自 `.uap/config/execution-mapping.yaml` 的 `execution_contract.required_input` |
| 输入 | `specification_ids` | 关联规范 ID（UAP-01-003、UAP-02-002、UAP-06-001、UAP-06-002） |
| 输入 | `scope` / `changed_files` | 影响范围（充值/退款/计费/前端支付模块） |
| 输入 | `environment` | 必须为 `simulated_only`：模拟支付渠道、模拟回调、隔离数据库 |
| 输入 | `constraints` | 权限组、fail-closed、禁止真实资金与生产写入、交易与流水一致性阈值 |
| 输入 | `ctx` | Runtime 上下文，含 `.uap/state/BASELINE.json` 与 `uap-financial-verification` 8 步定义 |
| 输出 | `executorResult` | 由 `.uap/runtime/_lib/contract.mjs` 的 `executorResult()` 归一化的结构化结果 |
| 输出 | `state_machine_report` | 充值/退款状态机与 `model.TopUp` 状态转换核验结果 |
| 输出 | `reconciliation_report` | 流水与余额一致性、金额/用户/订单号/币种一致性比对结果 |
| 输出 | `idempotency_concurrency_results` | 幂等、重复回调、并发扣费用例的命令与退出码 |
| 输出 | `evidence_refs` | 指向 `.uap/evidence/` 的证据 ID 列表 |
| 输出 | `blocked_reasons` | 资金差异、`AlipayReconcileAmountMismatch` 等阻断原因 |

## 失败处理
按 `.uap/config/execution-mapping.yaml` 的 `execution.failure_policy`、`.uap/config/workflow-registry.yaml` 的 `stop_on_unrecoverable_data_integrity_failure: true` 与 `.uap/config/permission-policy.yaml` 的 `enforcement.fail_closed: true`（`default_effect: deny`）逐类处置：
1. **permission_denied**：`execute(task, ctx)` 前由 policy-engine 校验权限组，任何 `real_payment` / `real_refund` / `production_write` / `production_deploy` / `secret_export` 请求即拒绝动作、记录 `log_denied_actions`，处置策略 `block`，任务由 RUNNING 迁移 **BLOCKED**，不重试、不绕过；**生产资金与生产数据库操作一律 BLOCKED，禁止自动执行**。
2. **missing_dependency**：隔离内存库、`httptest` mock 网关、`go`/`bun` 命令或 UAP-01-003 / UAP-02-002 / UAP-06-001 依赖不可用时，处置策略 `block`，任务迁移 BLOCKED 并写入 `blocked_reasons`，补齐后由 Orchestrator 重新排队（QUEUED）。
3. **validation_failed**：金额不一致、幂等/并发/重复回调用例失败、签名校验失败、`ledger_consistency` 或 `recovery` 检查 FAIL 或含 `severity=BLOCKER` findings 时，处置策略 `repair_then_revalidate`，交由 `uap-defect-repair` 修复后复验；任何资金差异必须阻断相关验收，未复验通过不得标记 SUCCEEDED。
4. **retryable**：处置策略 `bounded_retry`，重试上限 **3 次**（`max_repair_attempts_per_root_cause: 3`），退避采用指数退避（第 n 次等待 base × 2^(n-1)，base=1s，上限 8s，附随机抖动）；每次重试写入独立证据；恢复执行须校验 `task_id` 幂等，**禁止重放非幂等副作用（重复入账、重复退款、重复扣费）**。
5. **unrecoverable**：处置策略 `fail` 且 `stop_on_unrecoverable_data_integrity_failure: true`，任务迁移 FAILED / BLOCKED 并保留全部失败证据；按 `.uap/runtime/_lib/contract.mjs` 的 `TASK_TRANSITIONS`，FAILED 仅允许 → QUEUED / BLOCKED / CANCELLED，禁止重置状态隐藏失败。
全局 fail-closed：任何策略判定异常、验证器缺失（`fail_if_validator_missing: true`）、证据缺失（`fail_if_evidence_missing: true`）或资金差异时，结果一律按 BLOCKED / FAIL 处理，绝不降级为 PASS；禁止通过删除失败用例或忽略对账差异制造通过结果。

## 验收条件
1. 充值和退款状态机可验证。
2. 幂等测试通过。
3. 并发测试通过。
4. 重复回调测试通过。
5. 异常恢复测试通过。
6. 流水与余额一致性验证通过。
7. 所有测试均不触碰真实资金。

## 证据要求
- 证据统一落盘到 `.uap/evidence/`，索引写入 `.uap/reports/EVIDENCE-INDEX.md`；证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EVD')` 生成稳定唯一 ID（格式 `UAP-EVD-<时间戳>-<随机>`），禁止与历史证据复用。
- 每条证据必须记录：执行命令原文（如 `go test ./controller/... ./service/... ./model/... ./common/...`、`go test -race -count=1 ./service/... ./relay/... ./middleware/... ./model/...`、`go test -race -count=1 ./e2e/...`、`cd web && bun run test`、`make test`、`./scripts/verify-all.sh`）、`exit_code`、开始/结束时间（ISO 8601）、环境（取自 `.uap/state/BASELINE.json`：Go `go1.27.4` / Node `v22.22.2` / Bun `1.4.2`；并显式标注 `environment: simulated_only`）、输入（`task_id` / `scope` / 模拟订单快照）、输出（`executorResult` / `validatorResult` 全文、对账差异值、失败用例名）以及日志引用路径（consume/task log 的 `admin_info.quota_saturation`、`model.TopUp` 记录）。
- 验证结果由 `.uap/runtime/_lib/contract.mjs` 的 `validatorResult()` 归一化为 `{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；`PASS` 仅在 `executed=true && exit_code=0` 且 `findings` 无 `severity=BLOCKER` 时成立。
- 证据必须自证「未触碰真实资金」：记录所用 `httptest.NewServer` mock 网关、内存库（`setupCallbackSecurityDB`）、`t.Cleanup` 全局量还原，以及 `real_payment` / `real_refund` / `production_write` 的 deny 判定；`.uap/config/validator-registry.yaml` 的 `validation_policy.fail_if_evidence_missing: true` 强制证据存在，`.uap/config/workflow-registry.yaml` 的 `uap-financial-verification` 标注 `environment: simulated_only`。
- **证据不可覆盖**：新结果写入新证据文件，禁止覆盖历史记录；`persist_task_state: true` 保证状态持久化。**失败证据不可删除**：金额不符、幂等失败、并发竞争、对账差异等 BLOCKED / FAILED / NOT_EXECUTED 的证据必须保留，禁止以删除失败证据或重置状态制造通过结果；状态迁移受 `TASK_TRANSITIONS` 约束。

## 依赖标准
- **UAP-01-003（业务规则工程规范，`.uap/product/UAP-01-003-BUSINESS-RULES.md`）**：提供「业务规则集中登记与唯一 Rule ID」「关键资金规则必须采用精确金额类型和明确舍入策略」「权限、额度、计费、退款和订单状态必须具有明确状态转换且禁止非法回退/跳转」「关键规则必须有正向、反向、边界和并发测试」能力，是本规范状态机、金额精度与按秒计费量纲的规则来源。
- **UAP-02-002（API 与数据库规范，`.uap/architecture/UAP-02-002-API-AND-DATABASE.md`）**：提供「金额字段必须采用适合精确计算的类型」「数据库迁移可追踪可验证且不得静默删除生产数据」「数据库访问必须遵循事务边界」「关键业务操作必须检查并发竞争」「数据库迁移必须在隔离测试数据库中验证」「禁止擅自连接生产数据库执行写入」能力，对应 `model/main.go` 的 `lockForUpdate(tx)`、三方言迁移矩阵与隔离测试库要求。
- **UAP-06-001（应用安全规范，`.uap/security/UAP-06-001-APPLICATION-SECURITY.md`）**：提供「支付成功通知签名验证」「所有输入服务端验证」「所有权限服务端鉴权」「外部模型、渠道和工具返回的数据必须视为不可信输入」「高危漏洞阻断门禁」能力，对应 `service/alipay_query_test.go` 的验签用例、`controller/topup_gateway_contract_test.go` 的三件套与 `controller/return_path.go` 的回跳站点根校验。
