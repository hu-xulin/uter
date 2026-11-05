# Uter AI 规范体系冲突检查报告

**项目：** Uter
**检查日期：** 2026-11-05
**检查范围：** `docs/ai-specs/` 10 份规范 + `docs/ai-specs/engineering-quality/` 4 份工程质量规范 + `AGENTS.md` + `web/AGENTS.md` + `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`（2026-11-03 起唯一标准，旧 design-system.md/2.0 已废止删除） + `.ai/AIES.md` + UEQE 实际实现（`scripts/quality/uter-quality.sh`）+ 真实技术栈（`go.mod` ×3、`web/package.json`）
**检查方法：** 本报告保留 2026-11-01 的全文冲突审查记录；2026-11-05 复核并更新了 C1 单一工作分支策略、ADR 注册状态及 AIES 设计系统引用。其余历史结论属于原审查基线，未经本次逐项复核的内容不得视为当前实时验收证据；使用前须重新对照代码、规范与 CI。
**原则：** 只报告与给出修改方案，不擅自删除任何已有安全限制。

---

## 一、发现的冲突与解决方案

### C1. 分支策略：单一工作分支约束（已统一）

- **权威规则：** 根 `AGENTS.md`「Branch strategy」规定每个项目最多一个非 `main` 工作分支；所有审计、修复、测试和文档变更复用该分支及其现有 PR。
- **本次核验：** 远端当前可见 `main` 与 `ai/uaes-uter-integration-2026-11-05`，满足单一工作分支要求。
- **统一要求：** 不得为独立问题或自动修复创建第二分支；使用 Issue ID、Commit 和报告区分任务。若远端出现多个非 `main` 分支，必须停止并由用户决定保留项，不得自动删除或重写。
- **权限边界：** 允许在唯一工作分支上按明确授权 Commit、Push、创建/更新现有 PR；禁止直接推送 `main`、force push、合并 PR、部署及生产写操作。

### C2. 执行状态语义不一致（定义冲突，轻微）

- **来源：** AI-EXECUTION-STANDARD §8 定义六态 `PASS / FAIL / BLOCKED / NOT RUN / SKIPPED / NOT APPLICABLE`；UEQE 编排器实现五级 `PASSED / FAILED / BLOCKED / NOT_RUN / PARTIAL`。
- **解决（映射，不改代码）：** `PASSED↔PASS`、`FAILED↔FAIL`；UEQE 的 `PARTIAL` 是含失败/阻塞子项的聚合态（需人工归因，比六态更严格）；`SKIPPED` 与 `NOT APPLICABLE` 由 UEQE 的 `*.reason` 伴随文件承载（如「未指定 --with-e2e」「工具未安装」）。UEQE 五级语义不变。

### C3. API 错误结构「建议形态」 vs 仓库实际契约（潜在误导）

- **来源：** API-CONTRACT-STANDARD §7 建议逻辑结构 `code / message / request_id / details`。
- **实际：** 仓库统一响应契约为 `{success, message, data}`（`controller/` 层既有惯例）。
- **解决：** 无需修改。规范自带兜底条款「实际字段必须以 Uter 现有 API 契约为准，不得擅自引入第二套错误体系」。AI 不得按 §7 的建议字面新建错误结构。

### C4. 产品功能文档目录建议 vs docs/ 准入规则（权限冲突）

- **来源：** PRODUCT-REQUIREMENTS-STANDARD §9 建议 `docs/product/features/` 目录。
- **实际：** `AGENTS.md`「Documentation files」规定非用户显式请求不得在 `docs/` 下新增文件。
- **解决（已实施）：** 不预创建该目录；功能文档按逐次显式请求准入。AGENTS.md「Documentation sync」节已重申。

### C5. AGENTS.md 技术栈行陈旧（与实际技术栈不一致）

- **来源：** AGENTS.md Tech Stack 写「Go 1.25.1」；根 `go.mod` 与 `relaykit/go.mod`、`tokenkit/go.mod` 实际均为 `go 1.27.3`。
- **解决（已实施）：** AGENTS.md 该行已修正为 Go 1.27.3（以真实仓库为准，符合 ARCHITECTURE-STANDARD §3「架构事实来源」要求）。

### C6. 规范路由双表（重复，需明确权威源）

- **来源：** AI-EXECUTION-STANDARD §3 有任务路由表（较简，如支付开发缺 Change Management/Development）；本任务在 AGENTS.md 新建了权威超集路由表。
- **解决（已实施）：** AGENTS.md「Task routing」为权威表（含用户指定的支付/UI/Token 计费/数据库修改四条完整路由）；AI-EXECUTION §3 视为其概览子集，冲突时以 AGENTS.md 为准。

### C7. 变更门禁清单 vs UEQE 当前实现覆盖差（部分不可自动化）

- **来源：** CHANGE-MANAGEMENT-STANDARD §11 列 8 项检查（含 Business Critical、Change Integrity），并自带兜底「实际门禁以 QUALITY-GATE-STANDARD 为准」。
- **实际：** UEQE 五引擎覆盖 review/test/security/coverage/regression；**Business Critical**（支付/计费路径专项回归）目前靠 `spec-guards` 测试组与定向回归承担，**Change Integrity** 依赖 pre-commit 钩子（身份/暂存区/设计令牌）+ UEQE inventory 快照。
- **解决：** 记录为差距，不虚造引擎。对应人工清单见附录 A-1/A-7。

---

## 二、一致性确认项（无冲突）

| 检查项 | 结论 |
|---|---|
| DEVELOPMENT §7 样式规范引用 design-system | 一致，互补（开发规范让位设计系统权威） |
| UX-INTERACTION §12 响应式 vs design-system v1.2 响应式规则 | 一致（输入 14px 全平台无 H5 例外，两侧同口径） |
| UX-INTERACTION §1「不替代 design-system 视觉规则」 | 边界清晰，无重叠 |
| SECURITY §14 禁止事项 vs AGENTS.md OWASP 节 | 一致且互补（规范覆盖 Relay/支付专项，AGENTS 覆盖认证细节） |
| DATABASE §14 测试要求 vs AGENTS.md 三库兼容矩阵 | 一致；AGENTS.md 更严格（三库实测），规范不降低要求 |
| DOCUMENTATION §4 命名规则 vs `docs/ai-specs/` 实际文件名 | 一致（大写连字符） |
| AI-EXECUTION §3「必须遵守 UEQE」 vs UEQE 真实存在（`scripts/quality/uter-quality.sh`，五引擎已跑通） | 与现实一致 |
| CHANGE §7 Conventional Commits vs 仓库既有提交风格（feat/fix/test/docs/chore/style） | 一致 |
| API-CONTRACT §8 服务端权限 vs AGENTS.md 权限要求 | 一致 |
| ARCHITECTURE §3 架构事实来源 vs AGENTS.md Architecture 节 | 一致（均以真实仓库为准） |

---

## 三、不可执行 / 需人工核对的条款

以下条款当前无法程序化，已建立人工/AI 审查清单（交付报告中必须逐项声明执行结果）：

| # | 规范条款 | 现状 | 人工/AI 核对方式 |
|---|---|---|---|
| A-1 | CHANGE §11 Business Critical（支付/计费专项回归） | 无独立引擎 | 改支付/计费代码时，必须定向跑 `_reports/Uter测试用例集.md` 中 BE-PAY/BE-BIL 组用例并在报告列出 |
| A-2 | API-CONTRACT §13 API 测试矩阵 | 无 OpenAPI 工具链 | API 变更时按 §13 九类场景自查并断言进测试 |
| A-3 | API-CONTRACT §11 Schema 校验 | 仓库无 OpenAPI 契约源 | 不适用（除非引入契约工具），不得虚构 |
| A-4 | DATABASE §11/14 三库迁移矩阵 | SQLite 由 `go test` 覆盖；MySQL/PG 需 `docker-compose.multidb.yml` 人工执行 | Schema/迁移变更必须实跑三库并在报告记录版本与命令 |
| A-5 | DATABASE §13 备份/恢复（RPO/RTO） | 运维域，仓库无自动化 | 变更涉及备份策略时人工确认并记录 |
| A-6 | ARCHITECTURE §11 架构图同步 | 无图生成工具链 | 架构变更时人工更新文档并说明 |
| A-7 | CHANGE §15 变更追溯完整性 | 部分自动化（git log + UEQE 报告） | 交付报告须含任务→基线 SHA→Commit→测试→门禁链路 |
| A-8 | UX §15 交互状态覆盖（H5 触摸、键盘） | Playwright 本地轨可覆盖部分；CI 无 | UI 变更按 §3–§14 状态清单自查，视觉双轨本地跑 |
| A-9 | PRODUCT §7 验收标准（Given/When/Then 完备性） | 判断性要求 | 功能任务交付前对照 §2–§8 自查 |
| A-10 | DOCUMENTATION §12 文档链接/术语审查 | `go test`（`main_docs_test.go`）覆盖嵌入产物存在性，非链接校验 | 文档变更人工核对链接与术语 |

---

## 四、修改记录

| 日期 | 文件 | 修改 |
|---|---|---|
| 2026-11-01 | `AGENTS.md` | 新增「AI Spec System」节（索引/路由/优先级/分支策略/文档同步）；修正 Tech Stack Go 版本 1.25.1→1.27.3 |
| 2026-11-01 | 本报告 | 首次建立 |

规范正文（10 份 + engineering-quality 4 份）保持 verbatim，未做任何删改。

---

## 五、UAES P00 跨仓库治理冲突审计（2026-11-05）

**审计基线：** UAES 当前发布基线仍为 1.7.0 / DRAFT；Uter 集成锁定 commit 与 registry blob 以 `.uaes/INTEGRATION.md` 为准。UAES 1.8.0 仅存在于未批准的治理工作分支，不得作为已采用版本。

| 对照项 | UAES 目标规则 | Uter 当前规则/事实 | 裁定与执行要求 |
|---|---|---|---|
| 权威层级 | UAES 负责通用治理；项目事实和授权仍受用户与项目边界约束 | Uter AGENTS.md、嵌套指令、领域规范及设计系统仍为当前项目宪法 | 无冲突。UAES DRAFT 不覆盖 Uter 当前规则；只有经批准、锁定版本并完成迁移验证后才可调整权威关系 |
| 规则 ID | UAES 使用独立 UAES 命名空间，禁止与 Standard ID 冲突 | Uter 使用 DS-、AUTH-、UEQE- 等本地规则 ID | 无冲突。保留两套命名空间，跨仓库引用使用 Traceability Matrix，不重编号 Uter 既有规则 |
| 验收状态 | PASS / FAIL / BLOCKED / NOT_RUN / NOT_APPLICABLE / NOT_VERIFIED | Uter AIES 使用 PASSED / PARTIAL / BLOCKED / FAILED / NOT_RUN；UEQE 使用聚合状态 | 采用显式映射：PASS→PASSED；FAIL→FAILED；BLOCKED→BLOCKED；NOT_RUN→NOT_RUN；NOT_APPLICABLE→SKIPPED 且必须记录 reason；NOT_VERIFIED→PARTIAL 且必须记录证据缺口。PARTIAL 不得满足强制门禁，聚合状态不得隐藏失败子项 |
| 例外与豁免 | UAES E0–E4；E0 不得批准或激活；有效例外需审批、风险、补偿控制、到期与回滚证据 | Uter agent-governance.yaml 默认 deny，生产、真实支付、生产数据库、合并与部署均禁止自动执行 | Uter 当前更严格的拒绝策略继续生效。UAES 例外不能扩大 Uter 授权，也不能覆盖用户明确禁止项；未获用户/授权负责人批准不得改变 Uter 权限 |
| 任务合同 Schema | UAES task.schema.json 是通用任务合同目标 | Uter .ai/task-schema.json 是当前 WorkBuddy/AIES 任务合同 | 保留 Uter 现有 Schema 与运行时消费者。迁移前必须完成字段映射、正负向兼容测试和 Agent 运行时验证，不得直接替换 |
| 依赖关系 | UAES depends_on 表示通用标准前置关系 | Uter Go modules、前端、数据库、UEQE 及业务依赖以真实代码和本地架构规范为准 | UAES 依赖图不替代 Uter 产品架构图或模块依赖图；必须通过本地 ADR、架构事实和 Traceability Matrix 对应 |
| 质量门禁 | UAES P09/P10/P11 规定通用质量、安全和交付治理 | Uter 已有 scripts/quality/uter-quality.sh、scripts/verify-all.sh、CI 与 UEQE | 复用并映射 Uter 现有门禁，不建立竞争性 Runner，不因 UAES 规范而降低既有阈值 |
| 仓库职责 | UAES 为治理标准仓库 | Uter 为产品代码与项目事实仓库 | 无冲突。UAES 不承载 Uter 产品实现；Uter 保留支付、计费、认证、数据库、架构和 UTER Design System 3.0 项目覆盖层 |

### 本轮发现与未决事项

1. **已解决的口径映射：** UAES 的 NOT_APPLICABLE、NOT_VERIFIED 与 Uter AIES/UEQE 状态之间补充了显式映射；不得把 PARTIAL 视为 PASS。
2. **已确认的权限边界：** Uter agent-governance.yaml 的 default deny、单一工作分支、禁止合并/部署/生产写入规则优先于 UAES 通用建议。
3. **未完成：** 尚未逐条对照 Uter 全部 10 份领域规范、4 份 UEQE 规范和 UTER Design System 3.0 与 UAES 全部适用规则；不能将本表视为完整语义一致性验收。
4. **未完成：** Uter 当前集成锁定检查及版本/状态负向测试必须在当前 PR head CI 中实际通过。
5. **未完成：** 所有本地豁免、ADR、历史规则与运行时 Agent/WorkBuddy 的权限拒绝测试仍需独立盘点。

**结论：** 当前无理由删除或弱化任何 Uter 本地规范。集成状态继续保持 MIGRATION_PENDING；UAES 1.8.0 不得被 Uter 采用，直至正式批准、不可变版本锁定、全量映射、CI 与独立审计全部通过。
