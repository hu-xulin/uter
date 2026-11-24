# Uter 定价整改——最终验收清单（2026-11-24，HEAD `8c1e9139c`）

总体状态：**PARTIALLY_VERIFIED**，**NOT PRODUCTION READY**。本清单只按本轮实际证据给出状态；历史报告不算当前 HEAD 的验收证据。

| # | 验收项 | 状态 | 证据 / 说明 |
| --- | --- | --- | --- |
| 1 | 渠道创建失败保护（同步失败、空价格、缺失模型均不能启用） | CODE_FIXED / TESTS_PASSED | Uter.api 创建路径强制禁用 + 逐模型验证；`TestCreateUterAPIChannelsKeepsChannelDisabledWhenPricingFails` PASS。其他创建入口未全覆盖 |
| 2 | Uter.api 分组准确性（真实 Key、模型授权、GroupRatio 逐项匹配） | PARTIALLY_BUILT | 模型授权改为 `enable_groups` ∩ Key 可见模型；GroupRatio 仍沿用既有单次应用逻辑，真实 Key 逐项匹配未验证 |
| 3 | 百炼价格准确性（币种、单位、地域、阶梯、多模态） | PARTIALLY_BUILT | 原始/标准化币种已拆分并记录推断与汇率来源；未知币种/缺汇率进待审核；单位、阶梯、多模态未专项验证 |
| 4 | Uter Route 价格准确性（折扣组与渠道报价一致） | NOT_VERIFIED | 本轮未修改 Uter Route 适配；历史证据不代表当前 HEAD |
| 5 | 销售价格准确性（自动加价一次、人工价不覆盖） | NOT_VERIFIED | 既有保护保留，本轮未新增针对重复加价的回归 |
| 6 | 价格隔离（不同供应商/渠道/地域/部署不串价） | PARTIALLY_BUILT | 新增显式定价模式门并用于三条计费入口；Uter.api 价格行改为真实 Provider 且旧身份行被接管；多地域多部署未做专项验证 |
| 7 | 实际计费一致性（预扣、结算、退款与价格版本一致） | PARTIALLY_VERIFIED | Dreamrouter 单请求对账通过：上游 `$0.000528` 与渠道价复算一致，本地 290 quota ≈ 销售价 `$0.0005808`；其余 17 条上游记录无本地映射，完整账单级对账未通过 |
| 8 | Apiko 清理（运行时代码和有效历史价格清理） | DATA_CLEANED / AUDIT_LOG_PRESERVED | 运行时无适配器/路由；在线备份后删除 1 条 `channel_sync_states` 与 2 条 `options` 配置，价格表 Apiko 行已为 0；14 条审计日志按不可篡改原则保留 |
| 9 | 真实上游验证（授权接口实际请求，不能只用 Mock） | PARTIALLY_VERIFIED | Dreamrouter usage logs 已读取并复算，18 条真实记录价格全部匹配；Uter.api / 百炼仍 BLOCKED（无授权密钥） |
| 10 | 生产安全验收（数据库迁移、回滚、前后端验收） | PARTIALLY_VERIFIED | 本地库已在线备份并回填 962 行 owner、删除 715 条孤儿活动价格，复核孤儿/空 owner/重复身份均为 0；生产库未执行，历史/账单孤儿归档与回滚演练仍需审批 |
| 11 | 价格所有权隔离（AUTO / OPERATOR / BATCH / APPROVED，同步只覆盖自动价） | CODE_FIXED / TESTS_PASSED | `ChannelModelPricing.PricingOwner` 落库；owner-aware 覆盖/审核/Provider 清理；`TestPricingOwner*` 与全量门禁通过。生产库旧行仍需启动时 AutoMigrate 增加列，且需真实库迁移验证 |
| 12 | 财务金额精度（float64 → decimal） | PARTIALLY_BUILT | 计费账本/成本明细/账单快照 PurchaseUSD 已改为 `model.Money`（decimal-backed，SQL decimal 字符串、JSON 数字）；计算层全 decimal。TopUp / Subscription / 渠道价格 JSON / 表达式输入仍为 float64，全局迁移未做。回归测试与全量门禁通过 |

## 状态口径

- `CODE_FIXED`：代码已修改，不代表已验证。
- `TESTS_PASSED`：本轮实际运行并通过的自动化测试。
- `LIVE_PROVIDER_VERIFIED` / `BILLING_RECONCILED` / `PRODUCTION_READY`：本轮均**未达成**。

## 复现本次证据的命令

见 `UTER-PRICING-REGRESSION-TESTS.md`。所有命令均记录真实退出码；未执行的项明确标注为未执行，不以历史结果替代。
