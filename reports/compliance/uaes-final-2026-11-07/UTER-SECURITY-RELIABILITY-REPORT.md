> 生成日期：2026-11-07 ｜ 执行仓库：`/Users/lincolnhu/uter`（本地 `main` @ `ec6501adceb008d46140a7e5ab6508eb78006731`，未 push）
> 上游基线：UAES `main` @ `46c648836ee4cf06e285712ae2504da7ccab5602`（不可变发布基线：registry `1.12.0 / ACTIVE`，178 份标准正式发布；发布 commit `6c78ab50dc2b1adfedc035c88a70a906564318e4`，最终 pinned commit 为其后的收尾提交）
> 基准时刻：2026-11-07 21:30 +0800 之后；复审期间上游由并发会话连续刷新（3bc8285 → 6c78ab50 → 46c64883），Uter 治理入口已同步，证据见 evidence/governance-refresh-verification-final.log
> 证据目录：`reports/compliance/uaes-final-2026-11-07/evidence/`
> 纪律声明：本报告不含伪造的测试结果、批准或签署；`NOT_RUN` / `BLOCKED` 一律不计为 PASS；文档存在不等于符合性。
> **本轮结论：Uter 尚不能宣称「已全面按照 UAES 执行」。**

# 8. 安全与可靠性专项报告（P10）

## 8.1 核心业务资金链路审计范围

按原始指令第五节，对 15 个主题做真实静态审计（不是治理文档审计）：账户与权限、Token 余额与并发、充值订单状态机、支付回调验签/幂等/金额比对、重复通知、退款、计费与价格同步、支付成功落库失败恢复、事务与 Outbox、DB 迁移与三库、资金对账、并发余额更新、日志审计等。

## 8.2 四大关键风险实测结论

| 风险 | 结论 | 关键机制与证据 |
|---|---|---|
| 支付成功但数据库未完成记录 | **未发现资金损失路径** | `claimPendingTopUp` 在**同一事务**内完成「条件抢占订单状态 → 增加用户额度 → 记录配额日志」；`c14df597d` 已补后台对账 + 读时对账；`RechargeEpay` / `rechargeOfficial` / Stripe / Creem / Waffo 回调均核对网关金额快照 |
| 重复回调导致重复入账 | **未发现资金损失路径** | 条件更新 `WHERE trade_no = ? AND status = 'pending'`（F-12），仅一个 UPDATE 能生效；`TestClaimPendingTopUpOnlyWinsOnce`、`TestRechargeEpayConcurrentCallbacksCreditOnce` 为既有回归证据 |
| 重复退款 | **未发现资金损失路径** | `CompleteSubscriptionOrder`（`model/subscription.go:582-655`）在事务内取行锁并校验状态，`success` 幂等分支走 `upsertSubscriptionTopUpTx` 修复影子 top-up 记录；退款走订单状态机 + 幂等 trade_no；Midjourney 退款事务设计已登记（DRAFT，未实现） |
| 并发余额更新丢失 | **未发现资金损失路径** | `DecreaseUserQuota` / `IncreaseUserQuota` 使用 `quota = quota + ?` 原子增量并带 `quota >= ?` 下界保护；`cacheIncrUserQuota` 仅同步已提交的差值；`AdjustUserQuota` 在事务内加行锁 |

## 8.3 本轮改动（含定性撤回）

**问题 S-01（原 P2，重分类为 P3 一致性改进）**：`model/topup.go::UpdatePendingTopUpStatus`（pending → failed/expired 路径）原使用 `lockForUpdate` + 内存状态判断 + `tx.Save(topUp)` 全字段写回。

- **撤回的结论**：初版报告称「SQLite 下 `lockForUpdate` 降级为普通 SELECT，两个并发回调可都读到 pending」并定性为竞态缺陷。**该结论不成立**。实测 `common/database.go:64` 默认 DSN = `one-api.db?_pragma=busy_timeout(30000)&_pragma=journal_mode(WAL)&_txlock=immediate`；`common/database.go:48-63` 注释说明 `BEGIN IMMEDIATE` 在事务开始即取写锁、写者经 busy timeout 串行化；MySQL/PostgreSQL 有 `FOR UPDATE`；`DATABASE-STANDARD.md:282` 亦写明 SQLite「依赖单写者模型」。因此受支持默认配置下不存在陈旧覆盖窗口。
- **真实问题**：① 与「条件更新 + RowsAffected 判定」规范范式不一致；② 正确性隐式依赖 `_txlock=immediate`，而 `common/init.go:61-63` 的 `SQLITE_PATH` 可无校验覆盖 DSN，构成**条件性配置风险**；③ 整行 Save 会写回兄弟字段。
- **对应标准 ID**：`UAES-10`、`UAES-10-011`、`DATABASE-STANDARD.md:282`；治理流程受 `AUTO-FIX-STANDARD.md:115` 约束
- **修复**：改为 `Where(trade_no = ? AND status = 'pending').Update("status", targetStatus)`；`RowsAffected != 1` 返回 `ErrTopUpStatusInvalid`；不再整行 Save；同步删除代码注释中的错误竞态断言。
- **文件**：`model/topup.go`、`model/topup_status_retry_test.go`
- **验证**：`gofmt -l` 无输出；`go test ./model/ -run '...' -count=1` → `ok ... 1.923s` EXIT=0；新增 2 个确定性回归测试（状态机 + 支付渠道守卫不被绕过）。
- **高风险流程状态**：按 `AUTO-FIX-STANDARD.md:115`，支付/余额/计费修复须「专项测试 + 额外审查」。**专项测试已执行；额外审查 `NOT_RUN`**，需人类/独立审查人完成，不得记为闭环。
- **订阅侧增补观察（未改代码）**：`CompleteSubscriptionOrder` 仍为 `lockForUpdate` + 内存状态判断 + `tx.Save(&order)` 整行写回，与 F-13 范式不一致；默认 DSN 串行化下**无已证实竞态**。该函数在事务内串联用户组升级、订阅快照、影子 top-up 记录与幂等分支，改动面显著更大，在额外审查尚缺时不扩大资金代码改动面，登记为候选（B-12）。
- **剩余风险**：额外审查未完成、`SQLITE_PATH` 配置门禁未实现（B-11）；并发 goroutine 交错未单独建模；同类保护见 `TestRechargeEpayConcurrentCallbacksCreditOnce`。

## 8.4 已具备的控制（代码事实）

- 认证/权限：session / API token / PAT / JWT / WebAuthn / TOTP / OAuth；`service/authz/` Casbin；登录 `CriticalRateLimit` + `RefundIPRateLimit`。
- 支付：回调三件套（验签、幂等、实付金额比对，仅拦少付）；Creem 用分；微信 Native+H5、支付宝电脑+手机网站；`hasConfigurableTopup` 双开关。
- 计费：`QuotaPerUnit=500_000`，定价汇率+0.2，分组 VIP0–5 无 default；不变量「初始余额−最终余额 == logs.Quota」。
- 事务/恢复：订单状态、额度、日志同事务；缓存仅回放已提交差值；`LOG_DB` outbox 与后台对账（既有设计文档）。
- 数据库：SQLite / MySQL / PostgreSQL 主库 + ClickHouse 日志库；迁移清单 20 步 + 2 个手工 SQL；`DATABASE-STANDARD.md` 三库约束。
- SQLite 并发基线：`common/database.go:64` 默认 DSN 同时启用 `busy_timeout(30000)`、WAL 与 `_txlock=immediate`（`BEGIN IMMEDIATE` 事务开始即取写锁，写者串行化）；MySQL/PostgreSQL 由 `lockForUpdate` 生成 `FOR UPDATE`。这是四大资金风险「未发现损失路径」判定的重要前提，并已用于撤回初版 SQLite 竞态定性。
- 条件性配置缺口：`common/init.go:61-63` 允许 `SQLITE_PATH` 无校验覆盖默认 DSN，可去掉 `_txlock=immediate` / `busy_timeout`；目前**无配置门禁**校验，已登记 B-11。
- 密钥：`maskSecret` + Secret 三件套；`SMTPAccounts` token 经 `excludedOptionKeys` 剔除。
- 日志审计：资金链路日志 + 对账窗口 24h + 人工补单 `POST /api/user/topup/complete`。

## 8.5 尚未通过 / `NOT_RUN`（不得记为 PASS）

| 项目 | 状态 | 说明 |
|---|---|---|
| SECURITY_GATE | **BLOCK** | DAST / 渗透 / API 安全专项 `NOT_RUN` |
| 三库迁移全流程 | `NOT_RUN` | 历史证据为 SQLite/MySQL 8.4.4/PostgreSQL 17.4 的选定子集，非 20 步全量回放 |
| 灾备 / 备份恢复 / RTO-RPO | `NOT_RUN` | 需授权环境 |
| 鉴权页 axe / 键盘可达性 | `NOT_RUN` | 工具链已建（`web/e2e/axe/`），未跑鉴权场景 |
| 多实例故障恢复 / Outbox 端到端 | `NOT_VERIFIED` | 设计已登记，端到端未跑 |
| Midjourney 退款事务 | DRAFT / 未实现 | `.uaes/MIDJOURNEY-REFUND-TRANSACTION-DESIGN-2026-11-05.md` |
| Stripe/Creem/Waffo/Epay 主动查单对账 | 覆盖缺口 | 仅官方支付有后台+读时对账；建议后续补主动查单 |
| 42 项人工验收中 4 项 P10 验收 | `NOT_VERIFIED` | 见 `UTER-HUMAN-ACCEPTANCE-REPORT.md` |
| F-13 资金修复的**额外审查** | `NOT_RUN` | `AUTO-FIX-STANDARD.md:115` 要求高风险领域专项测试 + 额外审查；专项测试已 PASS，额外审查需人类/独立审查人（B-11） |
| `SQLITE_PATH` DSN 配置门禁 | `NOT_IMPLEMENTED` | `common/init.go:61-63` 无校验覆盖；建议校验 `_txlock=immediate` 与 `busy_timeout`（B-11） |
| 订阅侧条件 CAS 一致性改造 | `NOT_IMPLEMENTED` | `CompleteSubscriptionOrder` 仍为读-改-写 + 整行 Save；默认配置下无已证实竞态（B-12） |
| 全量质量门禁 `verify-all.sh` | **FAIL（EXIT=1）** | 8 PASS / 3 FAIL / 0 SKIP；含 Go vet 产物顺序、build:check 挂起、UEQE 安全扫描假阴性，见 B-13 与 `evidence/verify-all.log` |

## 8.6 安全边界声明

本轮**未**执行任何生产环境资金操作、退款、数据库破坏性操作或支付配置修改；所有测试均在 SQLite `:memory:` / 本地工作区进行。Root 超管凭据、`.env`、`SESSION_SECRET`、数据库文件均未被读取或改动。

## 附：2026-11-07 修复后复审增补

> 本节追加于 2026-11-07 23:15 CST。正文保留 21:45 前的实测状态作为历史证据；
> 最新事实与逐条「被更新 / 仍不变」判定见同目录
> `UTER-POST-FIX-REEVALUATION-2026-11-07.md`，证据在 `evidence/`。

- 更新 §8 表格「全量质量门禁 `verify-all.sh`」行：由 `FAIL（EXIT=1）8 PASS / 3 FAIL` 改为 **12 PASS / 0 FAIL / 0 SKIP、`EXIT=0`**（带一次性宿主构建整理前提）。
- 更新：UEQE 单阶段安全扫描 `EXIT=0`、`verdict: PASS`；四个 Go 模块 `go vet` 全 `EXIT=0`；完整矩阵 28/29（唯一失败 `L1-16`）。
- §8.6 安全边界声明**不变**，本轮同样未触碰生产资金数据、凭据或配置。

**统一不变项**：L3 域门禁 0/14 PASS、L4 全局门禁 9/16 MET（BLOCKED）、
42 项人工验收 0/42 签署、无任何 `APPROVED_EXCEPTION`、**仍不得宣称 Uter 已全面按照 UAES 执行**。
本轮未 commit / push / merge / 部署 / 改 UAES 仓库 / 生成签名 / 代填验收。
