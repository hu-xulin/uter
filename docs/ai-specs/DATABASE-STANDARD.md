# DATABASE-STANDARD
# Uter 数据库设计与数据一致性规范

**项目：** Uter  
**文档类型：** 数据库工程标准  
**适用范围：** 所有持久化数据、数据库操作和数据迁移  
**规范级别：** 强制执行
**规范版本：** 1.0.0（统一版本登记）  
**规范状态：** Active  
**最后更新：** 2026-11-05  
**下次复核：** 2027-02-03  
**维护责任：** Uter Engineering Maintainers  
**版本追溯：** 以 Git 文件历史及对应 Commit SHA 为准  

---

## 1. 规范目标

保证数据库结构合理、数据准确、事务完整、并发安全，并且能够追溯和恢复。

数据库设计必须以真实业务需求为依据。

## 2. 基本原则

1. 数据结构必须表达明确业务含义。
2. 核心数据必须有明确所有权。
3. 重要数据变更必须可追溯。
4. 关键业务操作必须保证一致性。
5. 数据库操作必须考虑并发。
6. 迁移必须可验证。
7. 不得随意删除历史数据。
8. 不得未经授权修改生产数据。

## 3. 命名规范

表名、字段名、索引名和约束名应遵循项目已有约定。

命名必须：

- 含义清晰。
- 保持一致。
- 避免模糊缩写。
- 避免不同表对同一业务概念使用不同名称。

不得为追求统一而无条件重命名已有数据库对象。

## 4. 数据类型

### 金额

涉及金额时必须明确：

- 币种。
- 存储单位。
- 精度。
- 舍入方式。
- 计算规则。

禁止直接使用不安全的浮点数处理资金计算。

### Token

必须明确：

- Token 数量类型。
- 输入与输出统计。
- 缓存 Token 统计。
- 计费单位。
- 计费精度。

### 时间

必须明确：

- 时间存储格式。
- 时区策略。
- 创建时间。
- 更新时间。
- 业务发生时间。

### 状态

状态字段必须有清晰定义。

禁止使用含义不明确的数字或字符串状态。

## 5. 索引与约束

根据实际查询和业务约束设计：

- 主键。
- 唯一索引。
- 普通索引。
- 组合索引。
- 外键或等价完整性约束。

必须评估索引对写入性能的影响。

不能只根据单个查询盲目增加索引。

## 6. 事务规范

涉及多个相关数据变更时，必须明确事务边界。

特别关注：

- 订单状态。
- 账户余额。
- 余额流水。
- Token 消费记录。
- 计费结算。
- 退款。
- 任务状态。

事务必须尽量保持短小。

禁止在长事务中执行不可控的外部网络请求。

外部服务与数据库之间的一致性，应采用适合业务的幂等、Outbox、补偿或对账机制。

## 7. 余额专项规则

余额变化必须有可追溯的业务依据。

必须保证：

- 余额变更与流水记录的一致性。
- 重复操作不会重复入账。
- 并发扣款不会造成非法透支。
- 失败操作不会留下错误余额。
- 流水可以追溯来源。
- 余额异常能够通过对账发现。

不得仅通过直接覆盖余额字段实现资金操作。

## 8. 支付订单专项规则

必须考虑：

- 订单唯一性。
- 支付金额核验。
- 订单状态机。
- 重复通知。
- 并发通知。
- 通知验签。
- 订单超时。
- 主动查询。
- 对账恢复。
- 退款和冲正。

不能将第三方回调直接视为无条件可信的数据库更新指令。

## 9. Token 计费专项规则

必须确保：

- 用量记录具有明确来源。
- 计费依据可追溯。
- 重试不会造成重复扣费。
- 流式请求中断有明确处理。
- 计费结果与余额流水可关联。
- 价格变化不会错误覆盖历史计费依据。
- 精度和舍入规则一致。

必要时保存实际计费时使用的价格快照。

## 10. 并发控制

根据业务选择：

- 原子更新。
- 乐观锁。
- 悲观锁。
- 唯一约束。
- 幂等键。
- 事务隔离。

必须考虑：

- 丢失更新。
- 脏读。
- 不可重复读。
- 幻读。
- 死锁。
- 重复写入。

不能仅依靠应用层先查询再更新来保证并发唯一性。

## 11. 数据库迁移

每次 Schema 变更必须：

1. 明确变更目的。
2. 检查兼容性。
3. 设计迁移步骤。
4. 考虑旧版本代码。
5. 考虑数据回填。
6. 考虑索引构建。
7. 验证迁移结果。
8. 制定恢复方案。

禁止未经授权直接在生产数据库执行迁移。

迁移脚本不得依赖不可重复的人工操作。

## 12. 数据删除

删除数据前必须判断：

- 是否存在关联数据。
- 是否有审计要求。
- 是否影响订单和流水。
- 是否需要保留历史记录。
- 是否需要软删除。
- 是否涉及法律或合规保留要求。

禁止级联删除重要资金和计费历史记录，除非经过明确业务与合规设计。

## 13. 备份与恢复

必须明确：

- 备份策略。
- 恢复策略。
- 恢复验证。
- 数据保留周期。
- 恢复点目标。
- 恢复时间目标。

备份存在不等于恢复能力已经验证。

## 14. 测试要求

必须根据实际数据库类型执行：

- Schema 测试。
- Migration 测试。
- 事务测试。
- 并发测试。
- 唯一约束测试。
- 幂等测试。
- 数据一致性测试。
- 回滚测试。

## 15. Uter 代码事实锚点（2026-11-01 校准）

### 15.1 迁移机制（真实机制，非模板）

Uter **没有独立迁移脚本体系**，采用「GORM AutoMigrate + 手写迁移辅助函数混合」：

- 入口：`model/main.go` 的 `InitDB()` → `migrateDB()`（主库）、`InitLogDB()` → `migrateLOGDB()`（日志库）。
- `migrateDB()` 的 AutoMigrate 列表含 30+ struct（&Channel{}, &Token{}, &User{}, &Option{}, &Redemption{}, &Ability{}, &Log{}, &TopUp{}, &QuotaData{}…），AutoMigrate 之前串接多个手写迁移：migrateTokenKeyUniqueness、migratePrefillGroupUniqueness、migrateSubscriptionPlanPriceAmount、migrateTokenModelLimitsToText、migrateOptionPrimaryKey、dedupeQuotaDataAggregatesOnce。
- 多库选择：`chooseDB("SQL_DSN", false)` 按 DSN 前缀分流——postgres:// → PostgreSQL（PreferSimpleProtocol 兼容 PgBouncer）；`local` 或空 → SQLite；其余 → MySQL（自动补 parseTime=true）；clickhouse:// 在主库报错（**ClickHouse 只允许做日志库**，`migrateClickHouseLogDB` 用原生 SQL 建 MergeTree 表，不走 AutoMigrate）。
- 日志库：`LOG_SQL_DSN` 未设置时日志库复用主库（LOG_DB = DB）。
- 方言差异集中在列名引号：`initCol()` 为 PostgreSQL 用 `"group"`/`"key"`，其他库用反引号。
- 迁移守卫：`ensureUserQuotaColumns` 拒绝旧 32 位钱包 schema（要求 bigint/int8）。
- 新增表/字段的正确姿势：在对应 struct 上加 GORM tag 并加入 migrateDB() 的 AutoMigrate 列表；需要数据回填或约束重建时写 `migrateXxx` 手写函数并在 migrateDB 中调用。

### 15.2 核心表与模型（均走 GORM 默认蛇形复数表名，无 TableName() 覆盖）

| Struct | 表名 | 关键字段 | 位置 |
|---|---|---|---|
| User | `users` | `Quota int`（余额）、UsedQuota、Status(1)、Role、Group、AffQuota/AffHistoryQuota | `model/user.go` |
| Token | `tokens` | RemainQuota、UnlimitedQuota、UsedQuota、Key(uniqueIndex)、ExpiredTime(-1 永不过期) | `model/token.go` |
| Channel | `channels` | Status、Type、Key、UsedQuota、ChannelInfo(json 多 Key 状态) | `model/channel.go` |
| TopUp | `top_ups` | Amount(美元额度)、Money、TradeNo(unique)、Status(string)、ProviderAmount(int64 分)、ProviderCurrency | `model/topup.go` |
| Log | `logs` | Quota、PromptTokens/CompletionTokens、CacheReadTokens/CacheWriteTokens、Type(1=充值/2=消费/3=管理/4=系统/5=错误/6=退款/7=登录)、RequestId | `model/log.go` |
| Redemption | `redemptions` | Key char(32) uniqueIndex、Status、Quota、UsedUserId | `model/redemption.go` |
| Option | `options` | Key(primaryKey)、Value | `model/option.go` |
| QuotaData | `quota_data` | 小时级聚合统计（非流水），idx_qdt_agg_unique 唯一索引 | `model/usedata.go` |

### 15.3 余额实现（重要：无独立余额流水表）

- 余额字段是 `User.Quota int`，缓存副本在 `UserBase.Quota`。**充值/消费/退款均以 `logs` 表记录**（LogTypeTopup=1 / LogTypeConsume=2 / LogTypeRefund=6），`quota_data` 只做小时级聚合——「余额流水」在 Uter 即 `logs` 表，设计流水相关功能时不得另立第二套流水体系。
- 换算锚点：`common.QuotaPerUnit = 500 * 1000.0`（1 美元 = 500000 配额单位，$0.002/1K tokens）；`GetTrustQuota() = 10 * QuotaPerUnit`；钱包上限 `MaxWalletQuota = 1<<53-1`；债务地板 `WALLET_DEBT_FLOOR_QUOTA`（默认 0，钱包允许负值但受地板控制）。
- 入账：所有支付网关共用 `creditTopUpQuota(tx, userId, creditedQuota, updates)`——条件更新 `UPDATE users SET quota = quota + ? WHERE id = ? AND quota <= ?`（原子强制钱包上限）。
- 扣费：预扣 `service.PreConsumeBilling`（billing.go，Redis Lua 原子预扣 userQuotaReserveScript）→ 结算 `BillingSession.Settle(actualQuota)`（billing_session.go，delta 两步提交）→ 钱包 `DecreaseUserQuota`、令牌 `DecreaseTokenQuota`（带 `remain_quota >= ?` 条件）。
- 管理员调余额：`AdjustUserQuota`（model/user_quota_adjustment.go）——事务内行锁 + decimal 计算，支持 add/subtract/override。

### 15.4 事务与并发（真实范式）

- 事务写法：`DB.Transaction(func(tx *gorm.DB) error {...})`，事务内 `lockForUpdate(tx)` 行锁（`model/locking.go`；SQLite 跳过，依赖单写者模型）→ 状态校验 → **条件更新 + RowsAffected 判定**赢得状态迁移（`claimPendingTopUp`：`WHERE trade_no = ? AND status = 'pending'`）→ `creditTopUpQuota` 入账；缓存同步与日志记录放事务外。参考实现：RechargeEpay、RechargeAlipay、RechargeCreem、RechargeWaffo、ManualCompleteTopUp（model/topup.go）、Redeem（model/redemption.go）。
- 余额增减全部为原子 SQL（`gorm.Expr("quota ± ?")` + 条件谓词），**禁止先查后改**。
- Redis 预扣用 Lua 脚本保证「校验 + 扣减」原子性（`model/quota_reserve.go`）。
- 批量模式：persistUserQuotaDelta 走 `addNewRecord(BatchUpdateTypeUserQuota, ...)` 批量刷盘（model/utils.go）。

### 15.5 SQLite 角色

`SQL_DSN` 未设置时默认 SQLite：`SQLitePath = "one-api.db?_pragma=busy_timeout(30000)&_pragma=journal_mode(WAL)&_txlock=immediate"`（`common/database.go`）。生产以 `SQL_DSN` 切换 MySQL/PostgreSQL（参考 docker-compose.multidb.yml）。本地开发直接读写仓库根 `one-api.db`——它是真实状态载体，不属于可随意重建的临时文件。

## 16. 完成定义

数据库修改必须满足：

- Schema 合理。
- 约束完整。
- 事务边界明确。
- 并发风险可控。
- 迁移可验证。
- 测试通过。
- 兼容性已评估。
- 数据恢复风险已披露。

---

**Uter 的余额、支付、订单和 Token 计费数据必须优先保证准确性与可追溯性。**