# Uter 定价数据迁移——执行记录（2026-11-24）

## 状态

**EXECUTED_ON_LOCAL_DB / PARTIALLY_VERIFIED**。用户明确授权后，已对本地 `one-api.db` 执行在线备份、价格所有权回填与孤儿活动价格行清理。生产库未连接、未改写；不可变账单与价格快照未改写。

## 备份

- Apiko 清理前：`/tmp/one-api.db.bak-apiko-20261124-194856`
- 历史迁移前：`/tmp/one-api.db.bak-migration-20261124-201209`

两份备份均通过 SQLite `backup()` API 在线生成，包含 WAL 内容，可用于回滚。

## Apiko 清理

- 全库 55 张表只读扫描：活动价格表中 Apiko 行已为 0。
- 删除 `channel_sync_states` 1 行（provider=`apiko`）、`options` 2 行（Apiko 快照/同步状态）。
- `audit_logs` 中 14 条 Apiko 操作历史保留，属于不可篡改审计证据，不是供应商配置或价格数据。

## 价格所有权回填

- 代码层新增 `model.PrepareChannelModelPricingOwner(db)`，在 AutoMigrate 后、review gate 前执行：
  - 缺列时添加 `pricing_owner`；
  - 按 `pricing_source` 回填 `AUTO / BATCH / APPROVED / OPERATOR`，`pricing_source` 为空时回退到 `internal_pricing.source`；
  - 无法识别的来源默认为 `OPERATOR`，避免同步覆盖人工价；
  - 幂等：已有 owner 不改写；创建 `idx_channel_model_pricing_pricing_owner` 索引。
- 本地库实际回填 962 行，全部为 `AUTO`（实测来源仅有 `uterroute-official` 828、`bailian-channel` 134）。
- 回归：`TestPrepareChannelModelPricingOwnerBackfillsHistory` 通过。

## 孤儿活动价格清理

审计发现孤儿活动价格行 715 条，分属 8 个已删除渠道：

| 已删除 channel_id | 行数 |
| ---: | ---: |
| 62 | 134 |
| 1235 | 84 |
| 63 | 83 |
| 64 | 83 |
| 65 | 83 |
| 1233 | 83 |
| 1234 | 83 |
| 1237 | 82 |

已删除这 715 行。保留项：

- `channel_pricing_history` 8,063 条、`billing_price_snapshots` 26 条、`billing_financial_ledgers` 11 条、`channel_sync_states` 24 条孤儿记录暂不删除，属于历史/审计证据，不参与活动计费。
- 唯一副本验证：清理后活动价格表 247 行，孤儿 0、空 owner 0、重复身份 0、owner 索引 1。

## 未覆盖范围

- 生产库未执行；上线前需按同一备份→审计→迁移→删除→复核流程在生产副本演练。
- `channel_pricing_history` 与账单快照的孤儿归档策略仍需单独审批；本次不删除，避免破坏审计链。
