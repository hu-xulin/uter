> 生成日期：2026-11-07 ｜ 执行仓库：`/Users/lincolnhu/uter`（本地 `main` @ `ec6501adceb008d46140a7e5ab6508eb78006731`，未 push）
> 上游基线：UAES `main` @ `46c648836ee4cf06e285712ae2504da7ccab5602`（不可变发布基线：registry `1.12.0 / ACTIVE`，178 份标准正式发布；发布 commit `6c78ab50dc2b1adfedc035c88a70a906564318e4`，最终 pinned commit 为其后的收尾提交）
> 基准时刻：2026-11-07 21:30 +0800 之后；复审期间上游由并发会话连续刷新（3bc8285 → 6c78ab50 → 46c64883），Uter 治理入口已同步，证据见 evidence/governance-refresh-verification-final.log
> 证据目录：`reports/compliance/uaes-final-2026-11-07/evidence/`
> 纪律声明：本报告不含伪造的测试结果、批准或签署；`NOT_RUN` / `BLOCKED` 一律不计为 PASS；文档存在不等于符合性。
> **本轮结论：Uter 尚不能宣称「已全面按照 UAES 执行」。**

# 5. UTER 原有 AI 规范迁移与清理报告

## 5.1 执行结论

**本轮未删除、未存根化任何本地 AI 规范文件。** 这不是遗漏，而是严格遵守 UAES `skills/uaes-uter-integration/SKILL.md` Procedure §10 与 Uter `AGENTS.md` §UAES 章节的结果：删除重复本地规范必须同时满足 5 项前置条件，当前 **1/5 满足**。以「删文件」制造清理假象会降低治理强度并破坏 CI 门禁。

## 5.2 逐项语义对齐盘点（18 份）

| 文件 | 元数据 | Uter 特有内容（举例） | 与 UAES 关系 | 处置 |
|---|---|---|---|---|
| `AI-EXECUTION-STANDARD.md` | v1.0.0 Active | Task-based spec routing、AGENTS.md 优先级、Uter 门禁清单 | 部分重复（含 P00/P01 通用条款） | 保留，标记复核 |
| `PRODUCT-REQUIREMENTS-STANDARD.md` | v1.0.0 Active | 定价汇率+0.2、QuotaPerUnit=500000、VIP 分组 0–5 | 部分重复（含 P02 通用条款） | 保留，标记复核 |
| `ARCHITECTURE-STANDARD.md` | v1.0.0 Active | Go/React/Electron 模块边界、relaykit/tokenkit、数据库三库 | 部分重复（含 P04 通用条款） | 保留，标记复核 |
| `UX-INTERACTION-STANDARD.md` | v1.0.0 Active | 页面/交互约定 | 部分重复（含 P05） | 保留，标记复核 |
| `API-CONTRACT-STANDARD.md` | v1.0.0 Active | 134 paths/159 ops、`/api/status` 单一源 | 部分重复（含 P04） | 保留，标记复核 |
| `SECURITY-STANDARD.md` | v1.0.0 Active | 登录 429 退款、微信登录、step-up 邮箱验证码 | 部分重复（含 P10） | 保留，标记复核 |
| `DATABASE-STANDARD.md` | v1.0.0 Active | SQLite/MySQL/PostgreSQL + ClickHouse 迁移矩阵 | 部分重复（含 P04） | 保留，标记复核 |
| `DEVELOPMENT-STANDARD.md` | v1.0.0 Active | Go/Bun 工程约定 | 部分重复（含 P06） | 保留，标记复核 |
| `CHANGE-MANAGEMENT-STANDARD.md` | v1.0.0 Active | 单分支工作模式、变更保护、身份守卫 | 部分重复（含 P11/P12） | 保留，标记复核 |
| `DOCUMENTATION-STANDARD.md` | v1.0.0 Active | `docs/` 不新增文件、i18n 7 语种同步 | 部分重复（含 P03） | 保留，标记复核 |
| `CONFLICT-REPORT.md` | Active | §98 规范正文 verbatim、§121 未逐条语义对齐 | Uter 特有裁定记录 | 保留，标记复核 |
| `ENGINEERING-SYSTEM-ACCEPTANCE-REPORT.md` | Active | UEQE 实施验收记录 | Uter 特有 | 保留，标记复核 |
| `UTER-UAES-GOVERNANCE-ARCHITECTURE-...md` | GOV-001 | 三层两仓、P13、WorkBuddy 20 步执行序列 | Uter 接入契约（权威） | 保留 |
| `engineering-quality/CODE-REVIEW-STANDARD.md` | 1.0.0 Active | Uter 代码审查清单、门禁钩子 | 部分重复（对应 UAES-09-002） | 保留，标记复核 |
| `engineering-quality/AUTOMATED-TEST-STANDARD.md` | 1.0.0 Active | 四 Go 模块/前端/Electron 测试矩阵 | 部分重复（对应 UAES-09-003..） | 保留，标记复核 |
| `engineering-quality/AUTO-FIX-STANDARD.md` | UTER-ENG-003 | `.quality/policy.env`、修复分级 | 部分重复（对应 UAES-09-014） | 保留，标记复核 |
| `engineering-quality/QUALITY-GATE-STANDARD.md` | UTER-ENG-004 | L1–L4 门禁、阻断条件 | 部分重复（对应 UAES-09-015） | 保留，标记复核 |
| `engineering-quality/README.md` | 1.0.0 Active | UEQE 双引擎实施规范 | Uter 特有 | 保留，标记复核 |

**统计**：完全重复 0 / 部分重复含 Uter 特有内容 18 / 已过时 0 份（但含 1 处文件名与 1 处状态描述过时，见 §5.4）/ 无法确定 0。

## 5.3 删除/存根化前置条件逐条判断（UAES Skill §10）

| # | 前置条件 | 状态 | 证据 |
|---|---|---|---|
| 1 | semantic parity report（逐条语义对齐） | **未满足** | `CONFLICT-REPORT.md:121` 明确「尚未逐条对照 UAES 全部适用规则；不能视为完整语义一致性验收」；18 份文件 `uaes` 关键字命中 0 |
| 2 | approved UAES lifecycle（正式发布） | **满足（附裁决保留）** | UAES HEAD `46c648836ee4cf06e285712ae2504da7ccab5602`，registry `1.12.0 / ACTIVE`，178 份标准正式发布（发布 commit `6c78ab50dc2b1adfedc035c88a70a906564318e4`）；发布签名的职责分离例外由 UAES Authority 裁决，见 B-01 |
| 3 | project mapping（项目映射） | **未满足** | 2132 条需求映射到执行点，但 2868 条适用要求的 Requirement→Implementation→Verification→Evidence 逐条闭环未完成 |
| 4 | runtime discovery（运行时发现） | **未满足** | `uaes-pin-check.sh` / `uaes-integration-check.sh` 自述「不声称运行时技能发现」；P08 域 BLOCKED、`L1-16=FAIL` |
| 5 | CI enforcement（CI 强制） | **未满足** | `test-ai-governance-policy.rb` 自述「static policy/schema tests do not replace live Agent runtime denial tests」；本轮不 push，远程 CI 未验证 |

**1/5 满足 → 禁止删除。**

## 5.4 已识别的冲突与过时内容（登记，待人工/上游裁定）

| # | 位置 | 冲突/过时 | 处置 |
|---|---|---|---|
| C-01 | `AUTO-FIX-STANDARD.md` §4 步骤 4 | 「创建独立修复分支」与 Uter 单分支模式、`AGENTS.md` 本轮更新冲突 | 已登记；本轮按 `AGENTS.md` 单分支执行，规范正文待复审 |
| C-02 | `QUALITY-GATE-STANDARD.md` | 状态集/风险分级/覆盖率口径与 UAES-09-015 的三态（PASS/FAIL/NOT_RUN）不一致 | 登记，待语义对齐 |
| C-03 | `QUALITY-GATE-STANDARD.md` | 引用 `.quality/policy.yml`，真实文件为 `.quality/policy.env` | 登记（已核实）；不擅自改规范正文 |
| C-04 | `AUTO-FIX-STANDARD.md` | 「CI 已停止运行」表述与当前 CI 配置不符 | 登记 |
| C-05 | UAES `UAES-09-002/014/015` 自身 | P09 上游标准头部 Owner 为 `Uter Engineering Governance`，§6 含 Uter 测试矩阵，通用标准内嵌项目事实，形成双源风险 | 登记，需 UAES 侧修订（Uter 无权改上游） |

`AGENTS.md:487-491` 与 `CONFLICT-REPORT.md:125` 明文规定迁移期禁止删除或弱化本地规范，本轮遵守。

## 5.5 本轮实际落地

- 新增 `.uaes/AI-SPEC-DISPOSITION-REGISTRY.yaml`：18 份文件逐条登记分类、对应 UAES 标准 ID、Uter 特有内容、前置条件满足度、处置决定与复核触发条件。
- 清理范围限于**治理入口与事实口径**（R-06），未改动任何规范正文，保持 `CONFLICT-REPORT.md` §98 的 verbatim 声明与历史证据哈希。
- `ai-specs-check.sh` 复跑 EXIT=0，确认新增台账未破坏门禁。

## 5.6 后续迁移触发条件

UAES 正式发布进入不可变 commit → 完成 18 份文件逐条语义对齐报告 → project mapping 逐条闭环 → Agent 运行时技能发现实证 → CI 强制门禁验证 → 独立批准 → 才可按「完全重复删除 / 部分重复迁移 Uter 特有内容至 overlay / 冲突以 UAES 为准 / 过时删除」执行，并同步更新 `ai-specs-check.sh`、`AGENTS.md`、`CONFLICT-REPORT.md` 与全部引用点。

## 附：2026-11-07 修复后复审增补

> 本节追加于 2026-11-07 23:15 CST。正文保留 21:45 前的实测状态作为历史证据；
> 最新事实与逐条「被更新 / 仍不变」判定见同目录
> `UTER-POST-FIX-REEVALUATION-2026-11-07.md`，证据在 `evidence/`。

- 更新：`ai-specs-check.sh` 复审 `EXIT=0`（10 域 + 4 质量规范 + 引用完整性）；`PIN_CHECK_EXIT=0` / `INTEGRATION_CHECK_EXIT=0`。
- 本文 §5.6 的后续迁移触发条件**不变**：语义对齐、逐条闭环、Agent 技能发现实证、CI 强制门禁、独立批准仍缺。

**统一不变项**：L3 域门禁 0/14 PASS、L4 全局门禁 9/16 MET（BLOCKED）、
42 项人工验收 0/42 签署、无任何 `APPROVED_EXCEPTION`、**仍不得宣称 Uter 已全面按照 UAES 执行**。
本轮未 commit / push / merge / 部署 / 改 UAES 仓库 / 生成签名 / 代填验收。
