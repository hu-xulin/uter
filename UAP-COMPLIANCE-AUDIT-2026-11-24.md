# Uter 项目 UAP 全面合规检查报告

> 检查时间：2026-11-24（GMT+8）
> UAP 版本：1.0.0 ｜ Git HEAD：`33def7a5a7585779965e85e5854596c4ca7f79e0`
> 执行身份：本地单分支 `main`；权限策略 `default_effect: deny`
> 证据口径：所有结论均来自本次真实执行的命令、退出码与落盘证据，不引用历史报告作为当前状态。
> 报告性质：这是**合规检查清单**，不是验收通过声明。UAP 最终状态仍为 `IMPLEMENTED_NOT_VERIFIED` / `claim_allowed=false`（原因见 §5）。

---

## 0. 结论摘要

| 维度 | 检查结果 | 本次修复后 | 判定依据 |
| --- | --- | --- | --- |
| 规范完整性 | COMPLETE（32/32 规范、37/37 注册表检查） | 不变 | `registryIntegrity()` / `uap status` |
| UAP 运行能力 | 修复前 31/32 验证器通过 | **32/32 通过** | `./uap validate --all` exit 0 |
| Uter 真实合规性 | 修复前 1 个 OPEN 缺陷（P1） | **0 个 OPEN 缺陷** | `./uap audit` open_defects=0 |
| 用户态死代码 | 4 项 Knip 发现（1 P1 缺陷） | **0 项** | `knip --reporter json` issues=0 |
| 真实代码修复 + 独立回归能力 | 未绑定当前执行 | **已重跑并绑定** | 能力卡 PASS，19/19 独立检查 |
| 发布门禁 release check | 3 项不满足 | **1 项不满足**（诚实性门槛） | `./uap release check` |
| 最终状态 claim_allowed | false | false（**刻意设计，不可伪造**） | status-engine `computeFinalStatus` |

**修复概览**：本次定位 18 条检查项，其中 1 条为真实可修复缺陷（已修复并闭环）、5 条为设计性 BLOCKED（权限策略要求）、6 条为能力/证据绑定的诚实性缺口（部分已重跑，剩余需生产授权或完整 code-freeze 批次）、6 条为通过项。

---

## 1. 检查项逐条清单（全量）

| # | 检查项 | 类别 | 修复前证据 | 修复后证据 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 1 | 规范注册表完整性 `registryIntegrity()` | 规范层 | 37/37 PASS，0 findings | 37/37 PASS | ✅ PASS |
| 2 | 32 份规范文件存在且章节完整 | 规范层 | COMPLETE 32/32 | COMPLETE 32/32 | ✅ PASS |
| 3 | 6 份机器配置可解析（yaml） | 配置层 | 6/6 parsed | 6/6 parsed | ✅ PASS |
| 4 | 系统入口 AGENTS.md / CLAUDE.md 含 UAP Entry Point | 配置层 | 2/2 has_uap_entry | 2/2 | ✅ PASS |
| 5 | 32 个执行器实现覆盖 | 执行层 | 32 registered / 32 implemented | 不变 | ✅ PASS |
| 6 | 32 个验证器实现覆盖 | 验证层 | 32 registered / 32 implemented | 不变 | ✅ PASS |
| 7 | 11 个 Agent 注册与实现 | 执行层 | 11 registered / 11 implemented | 不变 | ✅ PASS |
| 8 | 7 个工作流注册 | 执行层 | 7 registered / 113 runs | 不变 | ✅ PASS |
| 9 | Runtime 10 组件健康 + 中断恢复探针 | 运行层 | `uap doctor` 10/10 healthy，recovery PASS | 不变 | ✅ PASS |
| 10 | UAP 自身测试（20 个测试文件） | 验证层 | `uap test --all` exit 0 | exit 0 | ✅ PASS |
| 11 | **32 个验证器执行结果** | 验证层 | **31 PASS / 1 FAIL**（`development.dependency_integrity`） | **32 PASS / 0 FAIL** | 🔧 已修复 |
| 12 | 全项目审计缺陷 | 业务层 | 6 总缺陷 / **1 OPEN**（UAP-DEFECT-0007 P1） | 7 总缺陷 / **0 OPEN** | 🔧 已修复 |
| 13 | 资金链路验证（simulated_only） | 安全层 | 19/19 PASS，simulated_only=true | 19/19 PASS | ✅ PASS |
| 14 | 前端生产构建 `bun run build:check` | 门禁 | exit 0 | exit 0 | ✅ PASS |
| 15 | 前端类型检查 `bun run typecheck` | 门禁 | exit 0 | exit 0 | ✅ PASS |
| 16 | Go 编译 `go build ./...` | 门禁 | 首轮 exit 1（并发会话瞬态），复测 exit 0 | exit 0 | ⚠️ 见 §6 风险 R1 |
| 17 | `go vet ./...` | 门禁 | exit 0 | exit 0 | ✅ PASS |
| 18 | 设计规范严格门禁 `lint:design:strict` | 门禁 | exit 0（1336 文件合规） | exit 0 | ✅ PASS |

---

## 2. 不合规项逐条明细（修复前 → 修复后）

| 编号 | 规范/门禁条款 | 不合规事实 | 严重度 | 根因 | 修复动作 | 修复后状态 |
| --- | --- | --- | --- | --- | --- | --- |
| D-01 | UAP-04-003 依赖完整性 / `development.dependency_integrity` 验证器 | 验证器 FAIL：`unused_dependencies` 检查失败，Knip exit=1 报告 4 项发现 | P1（OPEN 缺陷 UAP-DEFECT-0007） | 前端存在未使用文件/导出/类型及重复常量别名 | 见下表 §3 四项逐一修复 | ✅ PASS，缺陷转 VERIFIED |
| D-02 | release check `full_validation_all_pass` | 发布门禁失败 | 阻断 | 由 D-01 验证器失败连带 | D-01 修复后自动满足 | ✅ PASS |
| D-03 | release check `no_open_critical_defects` | 发布门禁失败（存在 1 个 OPEN P1 缺陷） | 阻断 | 由 D-01 缺陷连带 | D-01 修复后自动满足 | ✅ PASS |
| D-04 | release check `final_status_claims_success` | 发布门禁仍失败 | 阻断（诚实性门槛） | 最终状态因证据/能力绑定不足拒绝宣称成功 | **不修复**：强行通过需伪造证据，违反 UAP 核心原则 | ⛔ 保留 BLOCKED（设计性） |

---

## 3. D-01 的四项 Knip 发现逐条处置

| 子项 | 文件:位置 | Knip 报告类型 | 业务判断是否死代码 | 处置方式 | 验证 |
| --- | --- | --- | --- | --- | --- |
| 3.1 | `web/src/features/wallet/components/wallet-stats-card.tsx` | `files`（孤立文件） | 是——无任何引用；等价实现在 `profile-header.tsx` 且已有测试覆盖 | **删除文件** | wallet 模块 12 测试文件 / 80 测试全通过 |
| 3.2 | `web/src/features/wallet/types.ts:263` `UserWalletData` | `types`（未使用类型） | 是——仅被 3.1 孤立文件引用 | **删除类型定义** | typecheck exit 0 |
| 3.3 | `web/src/features/channels/api.ts:259` `getUterAPIPricingGroups` | `exports`（未使用导出） | 否——后端 `GET /api/channel/uterapi/groups` 端点活跃，属待接线的类型化客户端 | **保留**，加 `@public` JSDoc 注解声明为有意公开的 API 表面 | Knip 识别 `@public` 后忽略 |
| 3.4 | `web/src/features/channels/constants.ts:34` `CHANNEL_TYPE_NEW_API` | `duplicates`（与 `CHANNEL_TYPE_UTER_API` 同值 64） | 否——被 6 处引用的刻意兼容别名（`New API` 兼容中继沿用旧名） | **保留**，加 `@alias` JSDoc 注解；并新增回归测试锁定别名契约 | 新增测试通过；Knip 识别 `@alias` 后忽略 |

**修复后 Knip 结果**：`issues: 0`，exit 0。
**说明**：3.3/3.4 采用 Knip 官方支持的 `@public` / `@alias` 源码级标记（`isAlwaysIgnored()` 机制），而非配置级 `ignore` 白名单——更精确、更自文档化，不削弱严格门禁。

---

## 4. 回归证据（本次真实执行的命令）

| 命令 | 退出码 | 结果摘要 |
| --- | --- | --- |
| `./uap status` | 0 | 初始：0/538 verified，2 P0 blocker，claim_allowed=false |
| `./uap doctor` | 0 | 10 组件健康，恢复探针通过 |
| `./uap validate --all` | 1 → **0** | 31/32 → **32/32 validators passed** |
| `./uap test --all` | 0 | 20 测试文件通过 |
| `./uap report` | 0 | 18 报告生成 |
| `./uap audit` | 0 | open_defects 1 → **0**，financial 19/19 PASS |
| `./uap release check` | 1 → **1** | 失败项 3 → 1（仅剩 `final_status_claims_success`） |
| `./uap build` | 1 → （复测 0） | Go 段首轮因并发 WIP 瞬态失败，复测 `go build ./...` exit 0 |
| `knip --reporter json`（web） | 1 → **0** | issues 4 → **0** |
| `tsgo -b`（web typecheck） | 0 | 通过 |
| `vitest run`（受影响模块） | 0 | 12 文件 / 80 测试通过 |
| `node .uap/tools/phase2-capability-cards.mjs` | 0 | 真实代码修复 SUCCEEDED + 独立回归 19/19 PASS，绑定当前执行 |
| `node .uap/tools/requirement-verification.mjs` | 0 | 538 需求 / 123 独立断言 / validator PASS |

---

## 5. 剩余不满足项（如实记录，非本次可修复范围）

| 编号 | 项目 | 当前状态 | 为何不修复 / 需何条件 | 分类 |
| --- | --- | --- | --- | --- |
| BLOCK-01 | `final_status_claims_success` / `claim_allowed=false` | IMPLEMENTED_NOT_VERIFIED | 需求矩阵 538 条中 `counts.verified=0`（严格口径：仅绑定当前执行的独立行为断言才算 VERIFIED，摘要中 123 条绑定旧执行）。要修复需在**单一 code-freeze 批次**内重跑全套 phase2 验证 | 诚实性门槛 |
| BLOCK-02 | 6 项运行能力卡全部 `false`（real_code_repair / independent_regression / recovery / e2e / database_integration / financial_integrity） | 未绑定当前执行 | 每次 CLI 命令新建 `execution_id` 造成"移动靶"；需 `UAP_BATCH_LOCK_ID` 批次锁 + `final-remediation-run.mjs` 完整编排（会启动隔离栈 :3100/:3101、重拷生产库至隔离库） | 需 code-freeze + 隔离栈 |
| BLOCK-03 | 415 条需求 NOT_VERIFIED | 诚实缺口 | 缺少每条需求各自的独立行为探测（BEHAVIOR_EXECUTION + 独立断言 + 当前执行绑定），非配置可解 | 治理体系设计 |
| BLOCK-04 | `production_deploy` | BLOCKED_BY_DESIGN | 权限策略 `deny`，需显式生产授权 | 权限边界 |
| BLOCK-05 | `production_database_write` | BLOCKED_BY_DESIGN | 同上 | 权限边界 |
| BLOCK-06 | `real_payment` | BLOCKED_BY_DESIGN | 同上；资金验证一律 simulated_only | 权限边界 |
| BLOCK-07 | `real_refund` | BLOCKED_BY_DESIGN | 同上 | 权限边界 |
| BLOCK-08 | `secret_export` | DENY | 权限策略拒绝 | 权限边界 |
| BLOCK-09 | `force_push` / `branch_creation` / `branch_switch` / `destructive_git` | DENY | 权限策略 + 单分支模式约定 | 权限边界 |
| BLOCK-10 | 规范验收状态 `accepted=false`（UDS 8.0.0） | ACCEPTANCE_READY | 设计系统需项目所有者显式接受；不得声称已验收 | 授权事项 |

---

## 6. 风险与注意事项

| 编号 | 风险 | 说明 | 处置 |
| --- | --- | --- | --- |
| R1 | 并发会话编辑 `model/pricing.go` | 首次 `uap build` 报 `channelPriceApplied declared and not used`（exit 1）；核验发现该文件 mtime 为检查期间、属另一并发会话 WIP，重读后变量已被正确使用，复测 `go build ./...` exit 0 | 未触碰该 WIP 文件；以复测结果为准 |
| R2 | 工作区存在大量既有 WIP | 检查开始时 `git status` 已记录 17 项修改 + 4 项删除（channel.go、用户指南截图、usage-logs 等） | 全部保留，未混入本次改动；本次仅修改 §3 所列 4 个前端文件 |
| R3 | 本次修复文件清单 | `web/src/features/channels/constants.ts`、`web/src/features/channels/api.ts`、`web/src/features/wallet/types.ts`、`web/src/features/channels/lib/__tests__/channel-type-options.test.ts`；删除 `wallet-stats-card.tsx` | 均为独立、干净的源文件，无并发 WIP 冲突 |
| R4 | 证据目录膨胀 | UAP 检查命令写入约 150+ 份 `.uap/evidence/*.json` 与状态文件 | 属治理系统正常证据落盘；未清理（禁止破坏性删除） |
| R5 | 检查期间出现新的并发 WIP | 最终复核 Knip 时发现新未跟踪文件 `web/src/features/subscriptions/components/plan-channel-models-field.tsx`（mtime 15:52），已被 WIP 中的 `subscriptions-mutate-drawer.tsx` 引用，属进行中的订阅功能开发，Knip 因入口链暂时不完整报 1 项 `files` | **不触碰**该 WIP；此项非本次修复引入。待该会话完成接线（drawer 纳入入口链）后自然清零。本次四项修复本身已验证 issues=0 |

---

## 7. 状态口径声明

本报告严格区分 UAP 定义的三个独立验收结论，不互相替代：

1. **规范完整性**：COMPLETE（文件与注册表层面）
2. **UAP 实际运行能力**：32/32 验证器通过，但 `NOT_FULLY_VERIFIED`（能力卡未绑定统一执行批次）
3. **Uter 真实合规性**：0 OPEN 缺陷、资金 19/19 PASS，但 `NOT_FULLY_VERIFIED`（需求证据绑定不足）

最终状态 `IMPLEMENTED_NOT_VERIFIED`、`claim_allowed=false` 是系统在证据不足时的**正确诚实结论**，不是缺陷。任何声称"UAP 全绿/验收通过"的表述都与证据不符。

---

*报告生成：基于 UAP 1.0.0 真实命令执行与证据落盘。所有 BLOCKED 项均记录于 `.uap/reports/BLOCKED-ITEMS.md`，未伪造为 PASS。*
