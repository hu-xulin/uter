# UAP-02-003 — 技术决策规范
> **UDS 8.0.0 状态边界：** 当前唯一设计系统 SSOT 为 `TOKEN-MANIFEST.json`（version `8.0.0`、`ACCEPTANCE_READY`、`accepted: false`）。运行时颜色语义由 manifest 派生的 `--ds-*` bridge 提供；现有 UDS 3.0 runtime compatibility boundary 必须保留，直到项目所有者明确授权迁移并完成绑定当前 HEAD 的行为、视觉与兼容回归验证；不得因迁移/映射文件缺失或 UDS 8.0.0 达到 ACCEPTANCE_READY 就推断其已退役。设计系统达到 `ACCEPTANCE_READY` 不等于用户已最终接受；不得将设计系统状态等同于 Uter 全站业务合规。


**编号：** UAP-02-003
**标准编号：** UAP-02-003
**名称：** 技术决策规范
**版本：** 1.0.0
**状态：** IMPLEMENTED_NOT_VERIFIED
**适用范围：** 约束 Uter 重大技术选择的 ADR 记录与效果验证，覆盖 `docs/adr/README.md`（决策注册入口与 Proposed / Accepted / Rejected / Deprecated / Superseded 状态定义）、`docs/adr/0001-uter-design-system-single-source-of-truth.md`（Accepted，2026-11-03），以及受决策约束的真实技术栈 `go.mod`（Go 1.27.3 / Gin / GORM v2）、`relaykit/go.mod`、`web/package.json`（React 19 / Rsbuild 2 / Bun）、`docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md`、`plugins/tasks/`、`electron/`。
**关键级别：** P2
**依赖标准：** UAP-02-001

## 规范目标
本规范以 ADR 记录 Uter 重大技术选择，避免无理由的技术栈替换：ADR 必须包含背景、问题、备选方案、决策、理由、影响和状态，并说明成本与风险。目标是让重大技术选择可追溯、决策与实际代码一致（如 Go 1.27.3 + Gin + GORM v2、React 19 + Rsbuild 2 + Bun、UTER Design System 3.0 唯一事实来源），重大依赖变更先做兼容性与安全性评估，决策实施后验证实际效果，原决策不再成立时提出 ADR 修订。

## 强制性要求
1. 重要技术决策必须记录 ADR。
2. ADR 包含背景、问题、备选方案、决策、理由、影响和状态。
3. 决策必须说明成本和风险。
4. 已废弃决策必须记录替代方案。
5. 不得仅因为某项技术流行就引入。
6. 不得在没有必要时替换现有成熟技术栈。
7. 技术决策必须考虑 Uter 现有架构和部署环境。
8. 重大依赖变更必须进行兼容性和安全性评估。
9. 决策实施后必须验证其实际效果。
10. 发现原决策不再成立时，必须提出 ADR 修订。

## Uter 落地细则
- ADR 正式注册入口 `docs/adr/README.md`（`Architecture Decision Records（ADR）`）：状态定义 5 类（Proposed 待批准不得作为已生效规范 / Accepted 已批准必须遵循 / Rejected 仅保留历史 / Deprecated 不得作为当前依据 / Superseded 必须链接替代记录），维护规则 6 条（新 ADR 先核对现有决策避免重复编号、仅明确批准才 Accepted、必须记录来源/适用范围/实施状态/可核验证据、偏离 Accepted ADR 须修复实现或新 ADR 正式替代、状态变化不得删除历史并保留 Git 历史、历史决策须逐项盘点且未经核实不得批量补写为 Accepted）。
- 现有 ADR：`docs/adr/0001-uter-design-system-single-source-of-truth.md`（索引 ID `ADR-0001`，标题「UTER Design System 3.0 作为设计规范唯一事实来源」，状态 Accepted，日期 2026-11-03）。
- 设计系统决策的实际落地：`docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md`（唯一设计实施标准，已核验章节 `# 0. 规范效力与执行原则` / `# 1. Typography` / `# 2. Color` / `# 3. Page Hierarchy` / `# 4. Surface 与 Border` / `# 5. Radius` / `# 6. Spacing` / `# 7. Density` / `# 8. Shadow 与 Elevation`）、视觉样本 `docs/design-system/SHOWCASE-8.0.0.html`、实现 `web/src/design-system/`、门禁 `cd web && bun run lint:design:strict`（`web/package.json` 的 `lint:design:strict: node scripts/check-design-tokens.mjs --strict`）与 `bunx vitest run src/design-system/__tests__`。
- 现有技术栈（不得无理由替换）：`go.mod`（`module github.com/uter-ai/uter`，Go 1.27.3）、Gin + GORM v2、SQLite/MySQL/PostgreSQL 主库 + ClickHouse 日志库、Redis（go-redis）、Casbin（`service/authz/`）、JWT/WebAuthn/TOTP/OAuth；`web/package.json`（React 19、TypeScript、Rsbuild 2、TanStack Router/Query/Table、Zustand、Base UI、Tailwind CSS 4、Bun 包管理）；`electron/` 桌面包装；`plugins/tasks/*/plugin.js` 经 `pkg/jsplugin/` 由 Sobek 执行。
- 独立模块决策：`relaykit/go.mod`（`module github.com/uter-ai/uter/relaykit`，独立可构建，禁止依赖根模块）、`tokenkit/tokenkit/` 独立 Go 模块；`AGENTS.md` 明确「不得在没有必要时替换现有成熟技术栈」，并要求 `cd relaykit && GOWORK=off go build ./...`、`cd tokenkit/tokenkit && GOWORK=off go vet ./... && GOWORK=off go test ./... && GOWORK=off go build ./...` 独立验证。
- 架构与部署环境约束（`AGENTS.md` / `.uap/state/BASELINE.json`）：Go AI API gateway + React 19/Rsbuild 前端 + Electron 包装；toolchain（Go `go1.27.4`、Node `v22.22.2`、Bun `1.4.2`、Python `3.13.12`）；9 个 CI workflow（`ci.yml`、`release-gate.yml`、`nightly-full-audit.yml`、`weekly-security-audit.yml` 等）；PR 已被 main-only 治理策略禁用。
- 重大依赖变更的兼容性与安全性评估命令：`./scripts/verify-all.sh [--quick]`、`gofmt -l .`、`GOWORK=off go vet ./...`、`make test`（四模块）、`cd web && bun run typecheck|lint|test|copyright:check|format:check|build:check`；`scripts/quality/gitleaks-allowlist.test.sh` 与 `.github/workflows/weekly-security-audit.yml` 为安全扫描；`AGENTS.md` 的 Database compatibility 要求 GORM core 与 dialect/driver 作为兼容版本集整体评估。
- 决策实施效果验证：`docs/adr/README.md` 要求 ADR 记录「可核验的代码/文档证据」；`AGENTS.md` 的 Verification Evidence 要求报告写明确切命令、退出码、失败测试名与变更文件；`docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md` 的截图回归两条本地轨（`cd web && bun run test:visual` / `test:visual:e2e`）`BLOCKED` 表示未执行，不得报为 pass。
- 已退役规范不得作为决策来源：`AGENTS.md` 明确历史域规范语料已于 2026-11-12 退役，UAP 对其零运行时依赖；当前绑定来源仅 `AGENTS.md`、`web/AGENTS.md`、`docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md`（AGENTS.md 的 Rule Auto-Loading 表格将其余域标准标记为待新规范体系发布）。
- 决策与实际代码一致性检查：`router/main.go`、`router/api-router.go`、`common/json.go`（统一 JSON 封装）、`model/main.go`（`lockForUpdate(tx)`）、`setting/billing_setting/builtin_billing.go`（自包含计费表达式）、`web/src/routes/`（TanStack Router `createFileRoute`）、`web/src/i18n/locales/{lang}.json`（i18next flat JSON）。

## 执行流程
1. `uap-architecture-agent`（`.uap/engines/architecture/index.mjs`，权限 `[project_read, architecture_write, evidence_write]`）由 `uap-orchestrator` 分配，读取 `docs/adr/README.md`、`docs/adr/0001-uter-design-system-single-source-of-truth.md`、`AGENTS.md`、`.uap/state/BASELINE.json`。
2. 核对 `docs/adr/README.md` 的决策索引与状态定义，确认新 ADR 编号不重复、状态仅 Proposed / Accepted / Rejected / Deprecated / Superseded，且不得因技术流行或无必要而替换现有成熟栈。
3. 起草 ADR，写入背景、问题、备选方案、决策、理由、影响、状态，并显式说明成本与风险、Uter 现有架构与部署环境约束（Go/Gin/GORM、React/Rsbuild/Bun、Electron、CI workflow）；已废弃决策记录替代方案（Superseded 链接）。
4. 重大依赖变更执行兼容性与安全性评估：运行 `./scripts/verify-all.sh`、`GOWORK=off go vet ./...`、`make test`、`cd web && bun run typecheck|lint|test|build:check` 及独立模块构建，记录命令与退出码。
5. 决策实施后验证实际效果：核对决策与真实代码一致（如 ADR-0001 ↔ `docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md` + `web/src/design-system/` + `bun run lint:design:strict`），把结论写入 `executorResult()` 与 ADR 的可核验证据。
6. `architecture.adr_integrity` 验证器（`.uap/validators/architecture/index.mjs`）执行 `decision_records` / `decision_traceability`，返回 `validatorResult()` 并回填 `validation_results`。
7. 生成证据 `UAP-EVD-...` 写入 `.uap/evidence/`，索引追加到 `.uap/reports/EVIDENCE-INDEX.md`；ADR 状态变化保留历史与 Git 历史，不得删除。
8. 发现原决策不再成立时提出 ADR 修订（新 ADR 正式替代旧决策），并重新执行依赖影响验证；仅当 `executed=true && exit_code=0` 且无 BLOCKER 时判定通过，否则 BLOCKED / FAILED 并保留证据。

## 对应执行器
- 执行器 ID：`architecture.adr`
- 实现路径：`.uap/engines/architecture/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：按 `.uap/config/permission-policy.yaml` 与 `uap-architecture-agent`，需 `project_read`（读取 ADR、技术栈与代码）、`architecture_write`（写 `docs/adr/` 新记录与修订，受 `preserve_uncommitted_changes: true` 约束）、`evidence_write`；如需执行评估命令由 `local_command`（`require_command_logging: true` / `forbid_secret_exfiltration: true`）配合。`force_push`、`branch_creation`、`destructive_git`、`production_deploy`、`quality_gate_disable` 一律 `deny`。

## 对应验证器
- 验证器 ID：`architecture.adr_integrity`
- 实现路径：`.uap/validators/architecture/index.mjs`
- 检查项：`[decision_records, decision_traceability]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `task_id` / `specification_ids` | 任务与关联规范 ID |
| 输入 | `docs/adr/README.md` / `docs/adr/0001-*.md` | 现有决策索引、状态定义与维护规则 |
| 输入 | 技术栈与部署环境 | `go.mod`、`web/package.json`、`.uap/state/BASELINE.json` |
| 输入 | 兼容性/安全性评估命令结果 | `verify-all.sh` / `go vet` / `make test` / `bun run ...` 退出码 |
| 输入 | `scope` / `constraints` / `acceptance_criteria` | 决策范围、不可替换栈约束、验收标准 |
| 输出 | ADR 记录 | 背景/问题/备选方案/决策/理由/影响/状态 + 成本与风险 |
| 输出 | 已废弃决策替代关系 | Deprecated / Superseded 链接的替代记录 |
| 输出 | 决策实施效果验证报告 | 决策与实际代码一致性、真实命令退出码 |
| 输出 | `executorResult` / `validatorResult` | 结构化执行结果与独立验证结论 |
| 输出 | ADR 修订提案 | 原决策不再成立时的新 ADR |
| 输出 | 决策证据 | `.uap/evidence/UAP-EVD-...` 与索引条目 |

## 失败处理
按 `.uap/config/execution-mapping.yaml` 的 `execution.failure_policy` 与 `.uap/config/permission-policy.yaml` 的 `enforcement.fail_closed: true`（`default_effect: deny`）逐类处置：
1. **permission_denied**：`architecture_write` 缺失即拒绝写 ADR、记录审计事件，处置策略 `block`，任务迁移 BLOCKED，不绕过检查；不得通过 `force_push` / `branch_creation` 绕过 main-only 治理策略。
2. **missing_dependency**：`docs/adr/README.md` 索引、现有 `ADR-0001` 或技术栈证据文件缺失、编号冲突时，处置策略 `block`，任务 BLOCKED 并写入 `blocked_reasons`，待核对后重新排队。
3. **validation_failed**：ADR 缺七要素、未说明成本/风险、决策与代码不一致、重大依赖变更缺兼容性与安全性评估或实施效果未验证时，处置策略 `repair_then_revalidate`，转入 `uap-defect-repair` 修复并复验；未复验通过不得 SUCCEEDED。
4. **retryable**：处置策略 `bounded_retry`，重试上限 **3 次**（`max_repair_attempts_per_root_cause: 3`），退避采用指数退避（base=1s，第 n 次 base × 2^(n-1)，上限 8s，附随机抖动）；每次重试写入独立证据，禁止重放非幂等的 ADR 编号分配副作用。
5. **unrecoverable**：处置策略 `fail`，任务迁移 FAILED 并保留全部失败证据与 ADR 历史；按 `TASK_TRANSITIONS` 仅允许 FAILED → QUEUED / BLOCKED / CANCELLED。
全局 fail-closed：验证器缺失、证据缺失、必需检查被跳过或状态迁移非法时，一律按 BLOCKED / FAIL 处理；不得仅因技术流行引入新栈、不得无必要替换现有成熟技术栈，也不得以 2026-11-12 已退役的历史域规范语料作为决策来源。

## 验收条件
1. 重大技术选择可追溯。
2. 不存在无理由的大规模技术栈替换。
3. 决策与实际代码一致。

## 证据要求
- 证据统一落盘到 `.uap/evidence/`，索引写入 `.uap/reports/EVIDENCE-INDEX.md`；证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EVD')` 生成稳定唯一 ID，禁止复用。
- 每条证据必须记录：执行命令原文（如 `./scripts/verify-all.sh`、`GOWORK=off go vet ./...`、`make test`、`cd web && bun run lint:design:strict`、`cd relaykit && GOWORK=off go build ./...`）、`exit_code`、开始/结束时间（ISO 8601）、环境（`.uap/state/BASELINE.json` 的 `toolchain`）、输入（ADR 编号、决策七要素、`scope`/`constraints`）、输出（`executorResult` / `validatorResult` 全文、兼容性与安全性评估结论、实施效果验证）以及日志引用路径。
- 验证结果由 `.uap/runtime/_lib/contract.mjs` 的 `validatorResult()` 归一化为 `{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；`PASS` 仅在 `executed=true && exit_code=0` 且 `findings` 无 `severity=BLOCKER` 时成立。
- 报告必须能经 `evidence_refs` 反查 `.uap/evidence/` 原始记录；`docs/adr/README.md` 要求 ADR 记录来源、适用范围、实施状态与可核验代码/文档证据，状态变化不得删除历史并保留 Git 历史；`fail_if_evidence_missing: true` 强制证据存在。
- **证据不可覆盖**：新结果写入新证据文件，历史 ADR 与修订提案不得被静默覆盖。**失败证据不可删除**：兼容性/安全性评估失败、实施效果验证失败、BLOCKED / FAILED / NOT_EXECUTED 证据必须保留，禁止以删除失败证据或降低门禁制造通过结果。

## 依赖标准
- **UAP-02-001（系统架构规范）**：提供系统边界、模块边界、明确接口、模块依赖图与架构变更依赖影响验证基线，使技术决策能结合 Uter 现有架构与部署环境评估，且 ADR 记录、修订与实施效果验证可追溯到真实代码与证据。
