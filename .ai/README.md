# .ai — Uter AI 工程执行设施

本目录是 **AIES（AI Engineering Execution Standard）** 在 Uter 的落地。它把用户的自然语言需求转换为「受项目约束、范围明确、可执行、可验证、可追溯」的工程任务。

## 目录导航

| 文件 | 用途 |
|---|---|
| `AIES.md` | 整合后的统一执行标准：五层规则 L0–L4、阶段 0–11 SOP、任务合同、四类工作流、六层门禁 G0–G5、P0/P1/P2、五级交付状态、违规库、评分体系、分阶段落地 |
| `task-schema.json` | 任务合同 JSON Schema（draft-07）：必填字段、12 类任务枚举、R0–R3 风险枚举、验收项/测试项状态枚举 |
| `checklists/ui-design.md` | UI_DESIGN 验收清单 |
| `checklists/feature-bugfix.md` | FEATURE / BUGFIX / REFACTOR 验收清单 |
| `checklists/auth-payment.md` | AUTH_SECURITY / PAYMENT_FINANCIAL / DATABASE 验收清单 |
| `checklists/test-audit.md` | TEST_QA / CODE_AUDIT 验收清单 |

## 优先级关系（勿覆盖）

AIES 是**上层方法论 + L2/L3 补齐**，不替代项目已批准的"宪法"。冲突时以更高优先级为准：

1. 用户明确的操作授权、L0 安全底线（最高）
2. `AGENTS.md`（根，项目宪法：技术栈/OWASP/后端/前端/项目治理/Git-PR）
3. `web/AGENTS.md`（前端专属）
4. `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md` + `showcase-3.0.html`（设计系统唯一真源，2026-11-03 起唯一标准）
5. `.ai/AIES.md` + `.ai/task-schema.json` + `.ai/checklists/*`（通用框架与机器规则）
6. `.workbuddy/memory/MEMORY.md`（踩坑记忆/勿回退红线）

**硬约束（来自 `AGENTS.md`）**：
- `docs/` 下非显式请求**不得新增文件**——本目录产出位于 `.ai/`（非 `docs/`），由用户"输出整合后的文档"授权。
- 受保护标识 **nеw-аρi / QuаntumΝоuѕ** 相关引用**严禁修改/删除/替换/移除**。
- `plugins/**` 下不得新增文档文件。

## 快速使用

1. 收到需求 → 按 `AIES.md` 第四章编译任务合同（用 `task-schema.json` 校验必填/枚举）。
2. 按任务类型加载对应 `checklists/`，逐项执行与验收。
3. 按 `AIES.md` 第九章输出交付报告（状态/修改文件/验收证据/测试实际结果/未解决风险/Git 状态）。

**Uter 真实门禁命令（须实际运行并记录结果，不得臆造）**：

```bash
# 设计令牌（T1–T15）
cd web && bun run lint:design:strict
# 设计系统守卫（spec-guards 等 10 套件）
cd web && bunx vitest run src/design-system/__tests__
# 前端类型
cd web && npx tsgo -b --force
# 后端编译 / 单测
go build ./...
go test ./... -count=1
# relaykit 独立性
cd relaykit && GOWORK=off go build ./...
# i18n 键完整性（prop 形式键须人工同补 7 份）
cd web && node scripts/check-i18n-keys.mjs
# 数据库变更：真实 SQLite / MySQL / PostgreSQL 三库验证矩阵
```

## 历史实施快照（截至 2026-10-29；不代表当前状态）

| 层 | 已存在（复用） | 本次补齐 | 待建设（诚实标注，不可声称已实现） |
|---|---|---|---|
| L1 宪法 | `AGENTS.md`/`web/AGENTS.md`/`docs/design-system/UTER-DESIGN-SYSTEM-3.0.md` | — | — |
| L2 合同 | — | `AIES.md` + `task-schema.json` + 4 清单 | 自动化需求编译（当前靠 AI 依合同人工编译） |
| L3 门禁 | T1–T15、spec-guards 等、CI、pre-commit、i18n | 六层门禁分级映射 | Playwright 截图基线/视觉回归 |
| 度量 | — | 评分维度/权重/指标 | 违规与返工的自动采集 |

## 历史协调记录（2026-10-29；不代表当前任务状态）

- **历史记录：** 当时 `AGENTS.md` 存在并发修改，因此未在该次任务中编辑。当前是否存在并发 WIP，必须以执行时工作区和 Git 状态为准。
- **历史记录：** 当时未执行 commit/push。后续 Git 操作必须遵循当前用户授权、分支隔离和变更保护规则。
- **PandaMall 规范包**：平移本框架时须换成 React Native/Expo/Clerk 技术规则，不共用 Uter 的 Web 设计与支付规则。

## 维护规则

- 违规与返工 → 登记到 `AIES.md` 第十章 + `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md` §26（用附录 D 模板），把可重复验证的要求转化为自动化测试/静态检查/CI 门禁。
- 已批准决策 → 用 `AIES.md` 附录 E 模板登记，防止 AI 反复推翻。
- **未经负责人批准不得自动修改核心规范**；规则负责指导，工具负责检查，权限系统负责阻止未授权操作——三者不能互相替代。
