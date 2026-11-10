# Uter 支付恢复场景验证报告

> 生成时间（UTC）：`2026-11-10T08:06:19.355598+00:00` ｜ 基线：Uter 远程 `main` `6ef64a116191784781785efc41e507199c907f7a` 只读克隆
> 结论：**NOT_VERIFIED**（场景 A / B 均未闭合）

## 1. P0 场景判定

| 场景 | 用户定义 | 当前状态 |
|---|---|---|
| A | 支付成功，但本地订单未成功落库 | `NOT_VERIFIED` — 无故障注入自动化证明「网关成功但本地订单记录完全未落库」可自动恢复 |
| B | 支付订单恢复失败 | `NOT_VERIFIED` — 恢复失败路径未闭合 |

P13 报告 `verdict=NOT_VERIFIED`，`requirement_count=110`，
`all_applicable_requirements_verified=False`，
`payment_scenarios_not_verified=2`。

## 2. 场景明细（来自机器生成报告，未人工改写）

| 要求 | 状态 | 独立验证 | 原因 |
|---|---|---|---|
| `P13-PAY-001` | NOT_VERIFIED | NOT_RUN | Existing reconciliation recovers an already-persisted pending order; no fault-injection test currently proves recovery when the local order record itself is absent. |
| `P13-PAY-002` | PASS | PASS |  |
| `P13-PAY-003` | PASS | PASS |  |
| `P13-PAY-004` | PASS | PASS |  |
| `P13-PAY-005` | PASS | PASS |  |
| `P13-PAY-006` | PASS | PASS |  |
| `P13-PAY-007` | PASS | PASS |  |
| `P13-PAY-008` | PASS | PASS |  |
| `P13-PAY-009` | PASS | PASS |  |
| `P13-PAY-010` | NOT_VERIFIED | NOT_RUN | Existing refund-intent recovery tests do not prove the payment-order recovery failure path; a dedicated payment-order recovery test is required. |

## 3. 已存在的真实单元测试（不等于故障注入覆盖）

只读基线中存在 `controller/topup_callback_security_matrix_test.go`、
`controller/topup_epay_order_consistency_test.go`、`controller/payment_reconcile_task_test.go`、
`model/topup_order_state_matrix_test.go`、`model/topup_claim_pending_test.go`、
`model/refund_intent_test.go`、`model/midjourney_refund_log_outbox_test.go`、
`controller/refund_intent_recovery_task_test.go` 等，覆盖重复回调、乱序、金额不一致、
签名错误、退款幂等、Outbox 重试/死信、下单时订单表写失败不发支付链接。

但这些**没有**覆盖用户要求的完整故障注入链：

- 场景 A：`支付成功 → 订单未落库 → 进程崩溃重启 → 重新通知 → 对账恢复 → 余额只入账一次`
- 场景 B：`恢复失败 → DB 暂不可用 → 回调重复 → 重试 → Outbox 补偿 → 对账`

规范 `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md` §4 自身已把场景 1 标为 `NOT_VERIFIED`，
§6 结论为 `NOT_VERIFIED`。本报告与该诚实标注一致，未提升状态。

## 4. 约束

必须使用本地 Mock / sandbox / isolated DB，禁止真实支付。本轮因 Uter 工作区保护
（533 项在途变更、28 个冲突路径）未新增或修改任何 Uter 代码，也未执行真实支付链路测试。
