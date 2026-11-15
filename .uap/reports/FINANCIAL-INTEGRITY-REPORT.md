# Financial Integrity Report

> 由 `./uap report` 依据真实运行产物生成 · 2026-11-15T02:15:27.542Z · UAP 1.0.0
> 数据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与实时文件系统探测。

## 红线声明

simulated_only = **true**。全部检查为静态源码分析与进程内内存模拟；未连接支付网关、未写数据库、未发起真实交易或退款。

## 逐场景结果

| ID | 场景 | 结果 | 证据 |
| --- | --- | --- | --- |
| payment_success_order_state | 支付成功后订单状态落库路径 | PASS | {"file":"model/topup.go","matched":["TopUpStatusSuccess","alreadyDone","claimPendingTopUp","CompleteTime","creditTopUpQuota"],"detail":"已读取 1/1 个候选源码文件；锚点匹配 5/5；命中文件=[model/topup.g |
| signature_verification | 支付宝/微信回调验签 | PASS | {"file":"service/cn_pay_sign.go","matched":["func AlipayVerifySign","alipayNotifyVerifyContent","AlipayVerifyResponse","signature invalid","RSA2"],"detail":"已读取 2/2 个候选源码文件；锚点匹配 5/ |
| duplicate_notification | 重复通知幂等 | PASS | {"file":"model/topup.go","matched":["alreadyDone","绝不二次入账","idempotent repeat","AlipayReconcileSuccess"],"detail":"已读取 2/2 个候选源码文件；锚点匹配 4/4；命中文件=[model/topup.go, controller/topup_a |
| local_order_save_failure_recovery | 本地订单保存失败恢复 | PASS | {"file":"controller/topup_alipay.go","matched":["credit_failed","AlipayReconcileCreditFailed","恰好入账一次","恢复","保持 pending 待重试"],"detail":"已读取 2/2 个候选源码文件；锚点匹配 5/5；命中文件=[controller/to |
| refund_linked_to_original_order | 退款关联原订单 | PASS | {"file":"service/billing_session.go","matched":["requestId","relay-refund:","originating request id","IdempotencyKey"],"detail":"已读取 2/2 个候选源码文件；锚点匹配 4/4；命中文件=[service/billing_sess |
| duplicate_refund | 重复退款防护 | PASS | {"file":"model/refund_intent.go","matched":["errRefundIntentAlreadyDone","already done","s.refunded","refunded \|\|"],"detail":"已读取 2/2 个候选源码文件；锚点匹配 4/4；命中文件=[model/refund_intent.go, |
| concurrent_billing | 并发扣费 / quota 原子 CAS | PASS | {"file":"model/token.go","matched":["remain_quota >= ?","RowsAffected == 0","原子预扣","超扣"],"detail":"已读取 2/2 个候选源码文件；锚点匹配 4/4；命中文件=[model/token.go, service/quota.go]；未命中锚点=[无]。"} |
| balance_ledger_consistency | 余额流水一致 | PASS | {"file":"model/billing_integrity_test.go","matched":["PreConsumed","settlement delta","balance","IdempotencyKey"],"detail":"已读取 2/2 个候选源码文件；锚点匹配 4/4；命中文件=[model/billing_integrity_t |
| exception_recovery | 异常恢复 | PASS | {"file":"model/refund_intent.go","matched":["SweepPendingRefundIntents","stays pending for sweep","fail-closed","故障注入"],"detail":"已读取 3/3 个候选源码文件；锚点匹配 4/4；命中文件=[model/refund_intent |
| price_change | 价格变化时的金额快照 | PASS | {"file":"controller/topup_cn_amount_snapshot_test.go","matched":["ProviderAmount","ProviderCurrency","快照","providerExpectedMinorUnits"],"detail":"已读取 3/3 个候选源码文件；锚点匹配 4/4；命中文件=[con |
| upstream_failure | 上游失败处理 | PASS | {"file":"controller/payment_recovery_fault_injection_test.go","matched":["网关故障","自动重试","保持 pending","http status","signature invalid"],"detail":"已读取 2/2 个候选源码文件；锚点匹配 5/5；命中文件=[cont |
| idempotency | 幂等键 / 状态检查 | PASS | {"file":"model/refund_intent.go","matched":["IdempotencyKey","uniqueIndex","status = ?","alreadyDone","billing_idempotency_key"],"detail":"已读取 3/3 个候选源码文件；锚点匹配 5/5；命中文件=[model/refu |
| historical_fund_data_protection | 历史资金数据迁移保护 | PASS | {"file":"service/task_billing.go","matched":["TaskRefundLegacyCutoff","historical terminal task","automatic refund is disabled","fail-closed"],"detail":"已读取 2/2 个候选源码文件；锚点匹配 4/4；命中 |
| alipay_query_four_state | 查单四分状态与未支付/终态区分 | PASS | {"file":"service/alipay_query.go","matched":["ACQ.TRADE_NOT_EXIST","TRADE_CLOSED","AlipayReconcileUnpaid","\"unpaid\"","\"pending\"","\"closed\"","\"success\""],"detail":"已读取 3/3 个 |
| wechat_scene_info | 微信 v2/v3 scene_info 差异 | PASS | {"file":"controller/topup_wechat_h5_scene_test.go","matched":["scene_info","h5_info","APIv3","buildWechatH5SceneInfo"],"detail":"已读取 2/2 个候选源码文件；锚点匹配 4/4；命中文件=[controller/topup_wec |
| frontend_amount_rounding | 前端金额取整（toPayAmount 替代 Math.floor） | PASS | {"file":"web/src/features/wallet/lib/payment.ts","matched":["toPayAmount","Math.round","Math.floor(0.01)","0.01"],"detail":"已读取 1/1 个候选源码文件；锚点匹配 4/4；命中文件=[web/src/features/wallet/l |
| sim_duplicate_notification_credited_once | 内存模拟：重复通知只入账一次 | PASS | {"simulated":true,"mode":"in-process in-memory only (no DB / no network / no gateway / no real refund)","input":{"initial_balance":0,"order_amount":100,"notifications":5,"initial_s |
| sim_duplicate_refund_rejected | 内存模拟：重复退款被拒 | PASS | {"simulated":true,"mode":"in-process in-memory only (no DB / no network / no gateway / no real refund)","input":{"initial_balance":100,"refund_amount":40,"attempts":3,"idempotency_ |
| sim_concurrent_billing_balance_conserved | 内存模拟：并发扣费余额守恒 | PASS | {"simulated":true,"mode":"in-process in-memory only (no DB / no network / no gateway / no real refund)","input":{"initial_balance":100,"charge":15,"concurrent_requests":10},"output |


## 汇总

共 19 项：PASS 19，FAIL 0，BLOCKED 0。

## 资金数据保护

历史资金数据迁移与并发扣费场景以源码证据判定；无法从源码证明的场景保持 BLOCKED，不伪造 PASS。
