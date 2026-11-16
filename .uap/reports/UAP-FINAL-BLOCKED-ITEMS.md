# 阻断项清单

> 仓库 https://github.com/hu-xulin/uter · 分支 `main` · HEAD `cfb471c6cd043d81228e9703ff95d6d61c61da62` · 执行 `UAP-EXEC-20261116115030-6a0ef6da` · 生成于 2026-11-16 20:12:05
> 证据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与真实命令退出码。任何 PASS 均绑定本次执行。

| # | ID | 原因 | 影响 | 解除条件 |
|---|---|---|---|---|
| 1 | REQUIREMENTS-NOT-ALL-VERIFIED | 415 条需求缺少逐需求独立行为断言（PROBE_SHARED_EVIDENCE） | 不能 claim FULLY_VERIFIED | 为 415 条需求编写真实行为断言并验证 |
| 2 | E2E-BIZ-01 | 注册新用户被策略标记 `BLOCKED_BY_POLICY` | E2E 能力不得为 true | 用户授权注册流程并更新策略 |
| 3 | AXE-AUTHED-SKIPPED | 页面级会话无法在当前隔离栈建立 | 鉴权页 axe 未执行 | 提供可建立页面会话的测试账号/机制 |
| 4 | VISUAL-26-DIFFS | UDS 8.0 圆角/Hero 变更后的像素差异 | 视觉门禁 FAIL | 人工审核后重冻结 Playwright 基线（禁止批量自动更新） |
| 5 | EXT-PROVIDER-SANDBOX | 无真实支付沙箱凭据/端点 | financial_integrity=false | 提供沙箱商户凭据并授权沙箱调用 |
| 6 | BOOTSTRAP-NESTED-TESTS | 活动工作流内运行完整 UAP 套件 exit 1；CLI 同一命令 205/0 | uap-bootstrap BLOCKED | 修复平台并发/身份锁问题后重跑 |
| 7 | DB-THREE-ENGINE | 本机无 MySQL/PostgreSQL 客户端 | 未执行三库矩阵 | 提供三库实例；本次无 schema 变更 |

以上均未伪装为 PASS；`claim_allowed=false`。
