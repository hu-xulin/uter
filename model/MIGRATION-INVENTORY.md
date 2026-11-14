# 版本化 Schema 迁移清单（MIGRATION-INVENTORY）

本文件是 `model/schema_migrations.go` 所实现框架的事实性清单，用于取代此前
`model/*_migration.go` 里的临时 helper 与 `bin/migration_v*.sql` 里的裸 SQL。
审计项 P2-01 / P2-02 要求：真实外键约束 + 真实可回滚的版本化迁移框架。

## 1. 为什么需要、在哪里生效

- **连接初始化点**：`common/database.go` 的 `SQLitePath` 默认 DSN 增加
  `_pragma=foreign_keys(1)`；`common/init.go` 的 `ensureSQLiteConcurrencyPragmas()`
  （SQLITE_PATH 覆盖路径）与导出 helper `common.SQLiteForeignKeysEnabledDSN()`
  共用同一套规范化逻辑 `normalizeSQLiteDSN()`，保证**每个**池连接都开启外键
  （modernc.org/sqlite 对每个新连接逐条执行 `_pragma`）。一次性 `PRAGMA
  foreign_keys=ON` 会随连接切换而丢失，故必须走 DSN 参数。
- **启动接入点**：`model/main.go` 的 `migrateDB()` 在 `DB.AutoMigrate(...)`
  成功之后、函数返回之前调用 `MigrateSchemaUp(DB)`。失败会中止启动（fail
  closed），不会带病运行。
- 外键约束由 V1 迁移显式 DDL 建立；DSN 参数只是让引擎真正**执行**它。两者缺一不可。

## 2. 迁移清单

| Version | Name | Up（摘要） | Down（摘要） | 可逆 | 说明 |
|---|---|---|---|---|---|
| 1 | `add_top_ups_user_fk` | 为 `top_ups.user_id` 增加指向 `users.id` 的真实外键 `ON DELETE RESTRICT ON UPDATE CASCADE` | 无（拒绝） | **否** | 唯一确定的真实业务关系：充值订单必须归属一个用户。见 §3。 |
| 2 | `add_top_ups_user_status_index` | `CREATE INDEX IF NOT EXISTS idx_topups_user_status ON top_ups(user_id, status)` | `DROP INDEX IF EXISTS idx_topups_user_status` | **是** | 真实、幂等、可回滚的索引升级，服务于 `GetUserTopUps` / `ListPendingTopUpsForReconcile` 的按用户+状态查询，并为框架提供一条真实 Down 路径。 |

`LatestSchemaVersion()` 返回当前注册表最高版本（= 2）。`schemaRegistry` 中每个
迁移有不可变 `Fingerprint`，`Checksum = sha256(Version|Name|Fingerprint|Reversible|Rationale)`。
**修改迁移行为必须同步修改 Fingerprint**，否则一致性校验无法发现"已记录版本与代码
不一致"（与 Flyway 对迁移脚本内容取哈希同理）。

`schema_migrations` 表结构：
`version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL, checksum TEXT NOT NULL`。

## 3. V1 外键 DDL（真实关系，非 GORM 关联字段）

刻意**不**使用 GORM association struct 字段（会改变 Save 语义），而是显式 DDL：

- **SQLite**（不支持 `ALTER TABLE ADD CONSTRAINT`）：事务内重建表——
  1. 备份行到 `top_ups__v1_backup`（`CREATE TABLE ... AS SELECT *`）；
  2. 读取原 `CREATE TABLE top_ups` DDL 与全部显式索引定义；
  3. 在原 DDL 的结尾 `)` 前注入表级约束；
  4. `DROP TABLE top_ups`；用注入 FK 的 DDL 重建 `top_ups`；
  5. `INSERT INTO top_ups SELECT * FROM 备份表`（`foreign_keys=ON` 时引擎再次逐行校验）；
  6. 删除备份表、重建全部索引；`PRAGMA foreign_key_check(top_ups)` 收尾。

  注入的约束：
  ```sql
  CONSTRAINT fk_top_ups_user_id
  FOREIGN KEY (user_id) REFERENCES users(id)
  ON DELETE RESTRICT ON UPDATE CASCADE
  ```
- **MySQL / PostgreSQL**：方言检测后执行
  `ALTER TABLE top_ups ADD CONSTRAINT fk_top_ups_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE`。
- **其他/未知方言**：返回显式错误并中止（fail closed），绝不静默跳过。

**ON DELETE RESTRICT 的理由**：`model/user.go:107` 的 `User.DeletedAt gorm.DeletedAt`
与 `DeleteUserById`（`model/user.go:586`）表明用户是**软删除**——父行不会被物理删除，
因此 RESTRICT 不会与正常业务冲突，反而能在误物理删除时挡住，避免订单悬空。

**没有为其它表伪造外键**：只建立业务上确定的 `top_ups.user_id -> users.id`。
`subscription_orders.user_id`、`refund_intents.user_id` 等虽也指向用户，但本审计
聚焦被误判的 `top_ups` 订单关系，避免无关扩散；对退款的说明见 §8。

## 4. 存量孤儿行策略（fail closed，绝不删数据）

V1 在重建前显式执行
`SELECT COUNT(*) FROM top_ups t LEFT JOIN users u ON t.user_id = u.id WHERE u.id IS NULL`。
若存在孤儿行：返回明确错误（含数量与示例 `user_id`），事务整体回滚，**不删除、
不改写任何用户数据**。这些行需要运维人工核对/隔离后再重试迁移。软删除用户仍有
物理行，不会被误判为孤儿。

## 5. 不可逆迁移策略

V1 被标记为 `Reversible=false`（`Down=nil`）：自动 down 掉一条数据完整性约束会
重新允许孤儿行，属于危险的静默降级，因此必须是人工显式决策。`MigrateSchemaDown()`
在执行任何 Down **之前**预检查待回滚集合，一旦包含不可逆迁移立即返回错误，且
**不做任何部分回滚**（避免半回滚状态）。V2 是真实可逆迁移，用于验证完整 Down 流程。

## 6. 失败恢复策略

- 每个迁移在**独立事务**内执行；版本行只在 `Up` 成功后、同一事务里写入。
- `Up` 失败：DDL 随事务回滚，`schema_migrations` 不记录该版本，下次启动可安全重试。
- `Down` 失败：DDL 回滚，版本记录保留，状态与失败前一致。
- `MigrateSchemaUp` 幂等：仅按升序应用"未记录"的版本；重复运行是 no-op。
- 已应用版本的 `checksum` 与注册表比对由一致性校验负责，防止代码漂移。

## 7. 如何验证

框架 API：
- `MigrateSchemaUp(db) error` — 应用全部待处理版本。
- `MigrateSchemaDown(db, targetVersion) error` — 降序回滚到目标版本。
- `SchemaVersion(db) (int, error)` — 最高已记录版本（0 = 未迁移）。
- `MigrationInventory(db) ([]SchemaMigrationStatus, error)` — 注册表 + 应用状态。
- `VerifySchemaVersionConsistency(db) error` — 校验：记录版本 ∈ 注册表、
  `name`/`checksum` 匹配、已应用版本是注册表的连续前缀、**物理 schema 与账本一致**
  （SQLite: `PRAGMA foreign_key_list(top_ups)` 非空 ⇔ V1 已记录；V2 索引存在 ⇔
  V2 已记录）。任何不一致都返回错误，绝不静默通过。

验证命令（Go 1.27.4）：
```
GOWORK=off go test ./model/ -run 'TestPhase2DB|TestIsolatedDB|TestSchema|TestPhase2FK' -count=1
GOWORK=off go test ./common/ -count=1
GOWORK=off go test ./model/ ./common/ -count=1
```

## 8. 关于"引用不存在订单的孤儿退款必须失败"（诚实说明）

审计要求一条 **refund → order** 的外键。经核查真实模型：

- `RefundIntent`（`refund_intents`，`model/refund_intent.go`）字段为 `UserId`、
  `FundingSource`、`WalletAmount`、`SubRequestId`、`SubId`、`TokenId` 等，是
  **BillingSession 预扣退款凭证**，不含任何 `order_id` / `trade_no` 列。
- `MidjourneyRefundOperation`（`midjourney_refund_operations`，
  `model/midjourney_refund_operation.go`）以 `MidjourneyTaskID` 关联任务，同样不含
  订单列；`MidjourneyRefundOutbox` 是事件 outbox，不是订单引用。
- 退款与支付订单在现实代码里通过 **`trade_no` 自然键**关联：支付 webhook 用
  `model.GetTopUpByTradeNo(tradeNo)` 查订单，查不到即拒绝
  （`controller/topup.go:745-750`，"回调订单不存在" -> 返回 fail）。

**结论：不存在真实的 refund→order 外键列，且业务代码里没有"退款记录直接持有
订单外键"这个概念，因此：**
1. 不伪造虚构外键（FK 必须指向真实存在的列）；
2. 不凭空新增列/表（没有代码写入这样的列，新增即死数据）；
3. 采用**应用层完整性校验**：退款前置检查 `top_ups.trade_no` 必须存在，否则拒绝
   且不落任何退款行。`model/phase2_fk_integration_test.go` 的
   `TestPhase2FKRefundAgainstMissingOrderRejected` 用真实 SQL 验证了该契约
   （存在订单→落一条 `RefundIntent`；不存在的 `trade_no`→拒绝且行数不变）。

此项**未**使用数据库外键实现，而是如实的文档记录 + 应用层检查。理由如上：
关系是通过 trade_no 自然键表达，而非可加 FK 的物理列。
