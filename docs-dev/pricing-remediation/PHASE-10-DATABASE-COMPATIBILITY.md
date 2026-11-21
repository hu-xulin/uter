# PHASE 10 — 数据库与历史兼容

状态：**IMPLEMENTED_AND_VERIFIED（SQLite 升级）/ 三库建表验证通过**
（SQLite/MySQL 8.0/PostgreSQL 16 建表与唯一键通过；旧库升级在 SQLite 备份上连续执行两次并保留数据）

## 1. 表结构

`channel_model_pricing`：

- 主键自增；
- 唯一索引 `idx_channel_model_pricing_identity`
  `(channel_id, provider, region, deployment_id, model_name)`；
- 价格负载为 TEXT（JSON）：`official_pricing`、`normalized_pricing`、
  `internal_pricing`；
- `pricing_version`、`pricing_source`、`fetched_at`、`updated_at`、
  `lifecycle`、`missing_count` 等审计字段；
- `channel_pricing_history` 保存每次写入的前后值与来源。

JSON TEXT 在三库通用，未使用数据库特有 JSON 类型。

## 2. 迁移与幂等

- `AutoMigrate` 建表/补列；`prepareChannelModelPricingIdentity` 在建立唯一索引
  前合并历史重复行（`TestChannelModelPricingMigrationAndUniqueKey`）。
- 删除渠道不删除价格行：历史价格保留，账单可追溯。
- 同步写入使用 upsert + 身份查找，重复执行不产生重复行。

## 3. 三库矩阵

`model/channel_pricing_multidb_test.go`：

- 默认执行 SQLite。
- 设置 `UTER_TEST_MYSQL_DSN` / `UTER_TEST_POSTGRES_DSN` 时才连接 MySQL/PostgreSQL。
- 本轮已使用本地 Docker 服务执行：

```bash
UTER_TEST_MYSQL_DSN='root:uter@tcp(127.0.0.1:3306)/uter?parseTime=true&charset=utf8mb4' \
UTER_TEST_POSTGRES_DSN='postgres://uter:uter@127.0.0.1:5432/uter?sslmode=disable' \
go test ./model -run TestChannelPricingTablesAcrossDatabases -v -count=1
```

结果：sqlite / mysql / postgres 三个子测试全部 PASS。日志中的重复键错误是
测试刻意验证唯一索引产生的预期输出，不影响 PASS。

- 新增 `billing_price_snapshots` 表也由同一 AutoMigrate 创建，三库均通过。

## 4. 历史账单

- 消费/任务日志保存价格版本、模式、身份、渠道价、采购报价、币种、汇率
  （admin scope）。
- 价格更新不修改历史日志。
- 没有独立不可变快照表；若日志被清理，无法仅靠价格表还原历史。

## 5. 验证

```bash
go test ./model/ -run 'TestChannel(ModelPricing|Pricing)' -count=1   # 通过
GOWORK=off go test ./...                                             # exit 0
```

旧库升级验证（SQLite）：

- 使用 2026-11-21 11:03 的升级前备份副本，连续执行两次 `model.InitDB()`。
- 两次均 PASS：`channels=4 users=19 pricing=326 purchase_column=1 snapshots=1`。
- 证明新列 `purchase_pricing` 与新表 `billing_price_snapshots` 可增量创建，
  业务数据行数未变化，第二次启动不重复破坏结构。
- 未执行 MySQL/PostgreSQL 旧库升级，仍只验证了三库新建。

## 6. 风险

- 唯一索引对已有重复数据的合并逻辑只在 SQLite 测试过；不同数据库的索引长度
  限制（MySQL utf8mb4 767/3072 字节）需真库确认。
- 旧版本升级路径需在代表性数据库副本上验证，当前未执行。