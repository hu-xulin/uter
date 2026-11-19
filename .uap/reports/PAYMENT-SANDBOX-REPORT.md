# PAYMENT-SANDBOX-REPORT（Phase 2）

- 生成：2026-11-13（UAP Phase 2）
- 能力卡：`.uap/reports/PAYMENT-SANDBOX.json`
- 结论：**本地模拟 21/21 PASS（`LOCAL_SIMULATION`）；真实服务商沙箱 BLOCKED_EXTERNAL_DEPENDENCY**

## 1. 两种口径严格分离（本报告的核心要求）

| 口径 | 状态 | 依据 |
| --- | --- | --- |
| `LOCAL_SIMULATION`（本地模拟） | **PASS 21/0** | 真实运行 `service/paymentsandbox/` 21 个测试：运行时 RSA-2048 签名/验签、订单状态机、幂等入账、金额快照比对、文件型 SQLite Store |
| `PAYMENT_SANDBOX_VERIFIED`（真实服务商沙箱） | **未达成，0 项被标** | 无支付宝/微信/Creem 沙箱凭据（EXT-PROVIDER-SANDBOX）；`gateway_verified=false`；`network_calls_to_real_provider=0`；`real_payments=0`、`real_refunds=0` |

代码层强制：`paymentsandbox.Report()` 显式断言 `mode == LOCAL_SIMULATION` 且
`TestReportDeclaresLocalSimulation` 显式 `assert.NotEqual("PAYMENT_SANDBOX_VERIFIED", …)`——
本地模拟在类型与测试两层都不可能被标成沙箱验证。

## 2. 21 项真实测试清单

签名与验签（4）：`TestSignatureVerificationAcceptsValid` / `RejectsTampered`（changed_provider_amount、changed_trade_no、missing_signature、garbage_signature）
通知与幂等（3）：`TestNotificationHandling` / `TestDuplicateNotificationIsIdempotent` / `TestRefundStatusIdempotent`
订单查询（1）：`TestOrderQueryFourState`（success/pending/unpaid/closed 四态分离）
金额快照（1）：`TestAmountSnapshotMismatchRejected`
fail-closed 配置（3）：`TestConfigRejectsProductionGateway` / `TestConfigRejectsProviderSandboxWithoutCredentials` / `TestConfigRejectsRealLookingCredentials`
诚实声明（1）：`TestReportDeclaresLocalSimulation`（含 file-backed store 披露子测试）
资金故障注入（4）：提交失败回滚无入账 / 响应丢失重试不双记 / 并发恰好一次 / 重试无重复账目

## 3. 外部阻断（如实记录，不造绿）

- `EXT-PROVIDER-SANDBOX`：缺真实服务商沙箱账户与凭据 → `PAYMENT_SANDBOX_VERIFIED` 不可用。
- 因此 `financial_integrity` 能力**诚实保持 false**；真实成果另立为
  `financial_logic_verification`（真实隔离库 + 真实故障注入，见 DATABASE-INTEGRATION-REPORT）。
- 红线遵守：零真实支付、零真实退款、零生产库写入；`production_credentials_read=false`。

## 4. 复验命令（可重放）

```bash
GOWORK=off go test ./service/paymentsandbox/ -count=1 -v   # 21 pass
node .uap/bin/uap.mjs verify-payment                        # 能力卡生成
```

---

<!-- LIVE-PAYMENT-RECONCILIATION-20261118 -->

## 附：人工真实支付对账（2026-11-18）

上文「零真实支付」描述的是**自动化支付沙箱套件**的口径。2026-11-18 操作者在本地站点
手工完成了一笔 **Alipay 0.14 CNY** 支付，并完成订单/回调/余额/流水的只读核对：

- 订单 `top_ups.id=20`（`trade_no=USR3NOjLUYF2bo1794993184`）已为 `success`；
- 本机无法接收支付宝异步回调，入账由返回页触发的 `POST /api/user/alipay/query`
  查单确认（日志：`支付宝查单确认入账`）；
- 入账 `quota_to_add=10000`，对应流水 `logs.id=7955`；同一 `trade_no` 仅 1 条订单、
  1 条入账流水，未观察到重复入账；
- 完整证据与限制见 `.uap/reports/PAYMENT-LIVE-RECONCILIATION-20261118.md|json`。

口径不变：这是一次人工验证，不改变 `financial_integrity=false`、
`PAYMENT_SANDBOX_VERIFIED` 仍为 BLOCKED 的自动化结论；异步通知、失败/关闭、
金额不一致、退款等路径仍未验证。
