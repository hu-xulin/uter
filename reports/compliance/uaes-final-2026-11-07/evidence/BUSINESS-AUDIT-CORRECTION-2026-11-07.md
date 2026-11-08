# 业务资金链路审计结论修正记录

- 记录时间：2026-11-07T13:15:13Z（UTC）/ 21:15:13 +0800
- 执行仓库：`/Users/lincolnhu/uter`，本地 `main`，未 push
- 触发：核心业务专项审计子任务在初版报告（14a/14b/14c）之后提交的修正情报，明确要求「请以本条为准」「我原报告的『SQLite 竞态』结论需要降级」
- 性质：**主动纠错**。本文件覆盖此前报告中对同一代码路径的错误定性，不改写历史命令输出，不删除原始证据。

## 1. 被撤回的定性

初版审计把 `model/topup.go::UpdatePendingTopUpStatus` 的「`lockForUpdate` + 内存状态检查 + `tx.Save` 整行写回」定性为**SQLite 下的并发竞态 / 全字段覆盖窗口**，并记为 P2 低风险可自主修复。

该定性**不成立，予以撤回**。原因：它只考虑了「SQLite 跳过 `FOR UPDATE` 行锁」，忽略了默认 DSN 的事务级串行化。

## 2. 本轮实际核实的代码事实

核实命令（只读）：

```sh
grep -n '_txlock' common/database.go
grep -n 'SQLITE_PATH' common/init.go
grep -n '条件更新 + RowsAffected\|禁止先查后改' docs/ai-specs/DATABASE-STANDARD.md
grep -n -B 12 -A 2 '高风险领域' docs/ai-specs/engineering-quality/AUTO-FIX-STANDARD.md
grep -n -A 30 'func UpdatePendingTopUpStatus' model/topup.go
sed -n '570,660p' model/subscription.go
```

事实清单：

| # | 位置 | 事实 |
|---|---|---|
| F-1 | `common/database.go:64` | 默认 DSN = `one-api.db?_pragma=busy_timeout(30000)&_pragma=journal_mode(WAL)&_txlock=immediate` |
| F-2 | `common/database.go:48-63` | 注释明确：`_txlock=immediate` 令 `BEGIN IMMEDIATE` 在事务开始即取写锁，写者经 busy timeout 串行化；缺失时先 SELECT 后 WRITE 会触发 `SQLITE_BUSY_SNAPSHOT` |
| F-3 | `model/locking.go` / `DATABASE-STANDARD.md:282` | MySQL/PostgreSQL 由 `lockForUpdate` 生成 `FOR UPDATE`；规范对 SQLite 明确写「SQLite 跳过，依赖单写者模型」 |
| F-4 | `common/init.go:61-63` | `SQLITE_PATH` 环境变量**无校验**覆盖 `SQLitePath`，可以去掉 `_txlock=immediate` / `busy_timeout` |
| F-5 | `AUTO-FIX-STANDARD.md:115` | 「支付、余额及计费修复属于高风险领域，必须执行专项测试和额外审查。」 |
| F-6 | `model/subscription.go:582-655` | `CompleteSubscriptionOrder` 仍为 `lockForUpdate(tx).First(&order)` + 内存状态判断 + `tx.Save(&order)` 整行写回；`success` 幂等分支走 `upsertSubscriptionTopUpTx` 修复影子 top-up 记录 |

由 F-1/F-2/F-3 推出：在**受支持的默认配置**下，两个并发写事务无法同时读到 `pending`；后到事务在 `BEGIN IMMEDIATE` 处等待，看到的是已提交状态。因此「落后者用陈旧内存值覆盖」的窗口不存在。

## 3. 重分类结果

| 维度 | 初版 | 修正后 |
|---|---|---|
| 问题性质 | 并发缺陷 / 资金链路风险 | **规范口径对齐 + 纵深防御**（非缺陷修复） |
| 级别 | P2 | **P3（一致性改进）** |
| 真实价值 | 修复竞态 | ① 对齐 `DATABASE-STANDARD.md:282`「条件更新 + RowsAffected 判定」范式；② 消除正确性对 DSN 配置 `_txlock=immediate` 的隐式依赖（对应 F-4）；③ 避免整行 `Save` 写回兄弟字段 |
| 治理分类 | 低风险自主修复 | **高风险领域修复**（F-5）：必须专项测试 + **额外审查** |
| 是否仍保留代码改动 | 是 | 是。改动本身正确且有益，只是**理由与风险等级必须改** |

## 4. 由修正派生的新增开放项

| 编号 | 级别 | 内容 | 状态 |
|---|---|---|---|
| B-11 | P2 | 高风险修复的**额外审查未完成**；`SQLITE_PATH` 无校验覆盖构成条件性配置风险，建议加 DSN 配置门禁 | `NOT_RUN` / 未实现 |
| B-12 | P3 | 订阅侧 `CompleteSubscriptionOrder` 与 F-13 范式不一致，属一致性候选；默认配置下无已证实竞态 | 观察项，未改动代码 |

订阅侧**本轮不改动代码**的理由：该函数在事务内串联用户组升级、订阅快照创建、影子 top-up 记录与幂等分支，改动面与风险显著大于 `UpdatePendingTopUpStatus`；在 F-5 要求的「额外审查」尚缺的情况下扩大资金代码改动面不符合最小变更原则。如实登记为候选，而非宣称已解决。

## 5. 已执行的处置

1. `model/topup.go:291-299` 注释改写：删除「two concurrent callbacks can both read pending」的错误断言，改为说明默认配置已串行化、条件更新用于范式对齐与消除 DSN 隐式依赖。
2. `UTER-UAES-REMEDIATION-REPORT.md` R-05 整段重写（含撤回声明、高风险分类、专项测试证据、额外审查 `NOT_RUN`）。
3. `UTER-SECURITY-RELIABILITY-REPORT.md` 8.2 / 8.3 / 8.4 / 8.5 修正，补入 F-1~F-6 事实与订阅侧观察。
4. `UTER-UAES-COMPLIANCE-REPORT.md` §1.1 / §1.2 / §1.3 / §1.4 修正措辞与汇总数字。
5. `UTER-REMAINING-TASKS.md` 新增 B-11 / B-12，汇总由 10 项更新为 12 项，并修正 §10.5 的完成条件计数。
6. `UTER-HUMAN-ACCEPTANCE-REPORT.md` 同步剩余阻断数量。

## 6. 明确未做的事

- 未伪造「额外审查已通过」；额外审查状态如实记为 `NOT_RUN`，需人类/独立审查人完成。
- 未把 `SQLITE_PATH` 风险写成已修复；配置门禁尚未实现。
- 未对订阅侧资金代码做未经额外审查的改动。
- 未执行任何生产环境资金操作、退款、数据库破坏性操作或支付配置变更。
- 未改写历史证据文件；`verify-all.log` 等原始输出保持原样。
