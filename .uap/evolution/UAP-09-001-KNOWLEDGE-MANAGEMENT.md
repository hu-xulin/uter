# UAP-09-001 — 知识管理规范
> **UDS 7.0 状态边界：** 当前文档/Token SSOT 为 UDS 7.0（`ACCEPTANCE_READY`、`accepted: false`）。指定运行时标量 Token 与图表色已切换到 7.0 值；UDS 3.0 兼容层仍须保留，未迁移页面不得假定已完成全站切换。页面级状态以 `COMPAT-MAP.json` 和 `FINAL-ACCEPTANCE-REPORT.md` 的本次证据为准，不得将局部 Token 迁移等同于整体验收。


**编号：** UAP-09-001
**标准编号：** UAP-09-001
**名称：** 知识管理规范
**版本：** 1.0.0
**状态：** ACTIVE
**适用范围：** 约束 Uter 与 UAP 治理体系中全部项目知识的来源、适用范围、更新时间、检索与差异管理，覆盖 `AGENTS.md`（全仓强制约定）、`web/AGENTS.md`、`docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md` 与 `docs/design-system/SHOWCASE-7.0.html`、`docs-dev/`（含 `plugin-api/v1.md` / `v1.schema.json` / `v1.d.ts`、`channel-adaptor-map.md`、`authentication.md`、`translation-glossary*.md`）、`pkg/billingexpr/expr.md`，以及 `.uap/config/` 六份注册中心、`.uap/tools/spec-baseline.md`、`.uap/state/BASELINE.json`、`VERSION`。
**关键级别：** P1
**依赖标准：** UAP-00-004

## 规范目标
本规范要求项目知识有明确来源、适用范围与更新时间，可被检索，可关联代码、架构、需求与业务规则，能识别过时、冲突和重复知识，并把知识与实际代码的差异落成记录。目标是使 Agent 使用知识时可追溯来源、推测不被当作已确认事实、重要决策有证据、敏感信息不进入知识库，且过时知识必须标记或归档而非静默继续使用。

## 强制性要求
1. 项目知识必须有明确来源。
2. 知识必须包含适用范围和更新时间。
3. 代码、架构、需求和业务规则必须可关联。
4. 必须识别过时、冲突和重复知识。
5. 知识更新必须有变更记录。
6. Agent 使用知识时必须能够追溯来源。
7. 不得将推测作为已确认事实存储。
8. 重要决策必须有证据。
9. 必须支持知识检索。
10. 必须避免将敏感信息写入知识库。
11. 知识与实际代码不一致时必须产生差异记录。
12. 过时知识必须标记或归档，不能静默继续使用。

## Uter 落地细则
- 权威知识来源由 `AGENTS.md` 的 Rule Auto-Loading 表格固定：仓库级为 `AGENTS.md`，前端为 `web/AGENTS.md`，设计系统/排版/颜色为 `docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md`（标注「single authoritative file, 2026-11-03 起唯一标准」）；`.uap/state/BASELINE.json` 的 `pre_existing_governance` 记录 `AGENTS.md` 为「343 lines, repository-wide mandatory discipline; PRESERVED IN FULL」、`design_system` 指向该设计系统文件。任何知识条目必须能指向这些权威文件之一或 `.uap/config/` 注册中心。
- 知识头部必须带适用范围与版本/时间：`docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md` 头部声明「文档级别：Engineering Standard / Mandatory」「适用项目：Uter」「适用范围：PC Web、H5、响应式页面及全部业务组件」「正式版本：3.0」；`.uap/state/BASELINE.json` 的 `captured_at: 2026-11-12T10:19:06Z` 与 `baseline_id: UAP-BASELINE-2026-11-12T10-19-06Z` 是基线时间点；`VERSION` 文件经 `rebuild-all.sh` 的 `-ldflags -X` 注入版本并 patch +1 递进，是产物版本标识。
- 变更记录的可参照实现是 `web/AGENTS.md` 的「更新日志」章节：逐条以日期记录（2026-01-28 初始版本、2026-01-29 重组结构、2026-01-31 补充类型检查、2026-06-21 补充 Lint 检查、2026-09-06 明确组件复用流程）；§四要求「重大功能或规范变更时更新相关文档与 `AGENTS.md`」；`AGENTS.md` Documentation files 规定「Do NOT add new files under `docs/` or any of its subdirectories unless the user explicitly requests it」，避免知识库无来源膨胀。
- 代码/架构/需求/业务规则的可关联载体是 `.uap/config/specification-registry.yaml`：32 条规范各有 `id` / `file` / `domain` / `criticality` / `executor` / `validator` / `dependencies`，构成规范的 DAG；`execution-mapping.yaml` 的 `executor_entries` 把执行器 ID 映射到 `.uap/engines/*/index.mjs` 等真实 ESM 模块；`validator-registry.yaml` 的 `target` / `implementation` / `checks` 把验证器绑定回规范；`workflow-registry.yaml` 的 7 个工作流（含 `scan_knowledge`、`build_defect_registry`）提供跨层检索路径；业务规则实体落在 `web/src/features/wallet/lib/payment.ts` / `billing.ts` / `constants.ts` 与 `pkg/billingexpr/expr.md`。
- 过时知识识别：`AGENTS.md` Rule Auto-Loading 的「Task-based spec routing (mandatory)」明确旧的领域规范语料库已于 2026-11-12 退役、在新体系发布前约束来源为 `AGENTS.md`、`web/AGENTS.md` 与设计系统文件；`.uap/tools/spec-baseline.md` 自我标注「生成输入，不是交付规范」，正式交付是 `.uap/{domain}/UAP-xx-xxx-*.md`；`specification-registry.yaml` 的 `status_values`（`NOT_BUILT` … `FAILED`）与 `defaults.status: IMPLEMENTED_NOT_VERIFIED` 提供标记状态。过时知识必须标注状态并归档，禁止静默继续引用。
- 冲突与重复知识检测：`AGENTS.md` JavaScript task plugins 要求 `docs-dev/plugin-api/v1.md`、`docs-dev/plugin-api/v1.schema.json`、`docs-dev/plugin-api/v1.d.ts` 三者保持一致；`AGENTS.md` Design System Enforcement 规定「文档与实现冲突时，设计值取代码（`tokens/`、`theme.css`），规则与边界取规范」，并禁止「do not silently choose one」；`web/scripts/check-design-tokens.mjs` 的 `ALLOWLIST` / `RAW_COLOR_OWNERS` 是唯一例外登记处，`bun run design:tokens:check`（`web/scripts/generate-design-tokens.mjs --check`）验证 DTCG 源与生成物 `web/src/design-system/tokens/generated/brand.css` 一致。
- 知识更新必须可追溯：`AGENTS.md` Rule Auto-Loading 要求「Load the governing rules before acting」「Re-read them when you start a new session, switch to a different task, or descend into a subdirectory that has its own AGENTS.md」；Agent 读取知识须经 `.uap/runtime/_lib/yaml.mjs` 的 `parseYAML()` 解析注册中心、经 `.uap/runtime/_lib/util.mjs` 的 `readText()` / `readJSON()` 读取文件，并在证据中记录被引用的文件路径与版本/时间，形成来源链。
- 不得将推测作为已确认事实：`AGENTS.md` Verification Evidence 明确拒绝「已检查 / tests passed / consistent with the spec / looks correct」这类断言，要求「If a gate was not run, say so and label the result unverified」；`UAP-00-004` 确立「文件存在不能证明功能实现」「命令存在不能证明命令可运行」「测试文件存在不能证明测试通过」；`specification-registry.yaml` 的 `defaults.status: IMPLEMENTED_NOT_VERIFIED` 与 `status_values` 使未验证知识只能处于未验证状态。
- 重要决策必须有证据：决策类知识（架构/API/设计/技术选择）必须能经 `.uap/reports/EVIDENCE-INDEX.md` 与 `.uap/evidence/` 的 `UAP-EVD-*` 证据 ID 反查；`.uap/state/BASELINE.json` 的 `uap_deviations_from_literal_instruction` 是「决策与理由」留痕范例（说明为何以追加章节而非覆盖方式处理 `AGENTS.md` / `CLAUDE.md`）；`docs-dev/channel-adaptor-map.md`、`docs-dev/authentication.md`、`docs-dev/plugin-api/v1.md` 是带适用范围的技术知识条目。
- 支持知识检索：`util.mjs` 提供 `listFiles()` / `readText()` / `readJSON()` / `readJSONL()` / `exists()`；`.uap/reports/EVIDENCE-INDEX.md` 是证据索引，`scripts/verify-all.sh` 输出「门禁汇总」表（检查项 / 结果 / 耗时 / 退出码）与失败项复现命令；`AGENTS.md` Project Governance 要求处理问题前先搜索项目文档、README 与代码，本身就是检索流程约定。
- 避免敏感信息写入知识库：`permission-policy.yaml` 的 `secret_export: deny`、`enforcement.redact_secrets: true`、`local_command.forbid_secret_exfiltration: true`，写入前用 `util.mjs` 的 `redact()` 处理；`AGENTS.md` Change Protection 禁止把 `.env`、`*.db` / `-shm` / `-wal`、`logs/`、构建产物写入提交/代码/文档；`AGENTS.md` Authentication Security 要求认证审计排除密码、验证码、恢复码、私钥与令牌；CI 侧 `.github/workflows/weekly-security-audit.yml` 与 `nightly-full-audit.yml` 的 `secrets` job（gitleaks）扫描泄漏。
- 知识与实际代码不一致必须产生差异记录：`scripts/verify-docs-artifacts.sh "$ROOT/web/dist"` 把文档产物缺失变成硬失败；`bun run i18n:check`（`web/scripts/check-i18n-keys.mjs`）校验 `web/src/i18n/locales/` 7 份 flat JSON 的键一致性；`bun run components:registry:check` 校验 React 组件注册表与文件系统一致；`docs-dev/plugin-api/` 三件套一致性检查；差异记录须写明知识条目路径、实际代码路径、差异内容与处置依据（`AGENTS.md` Verification Evidence 要求列出已知失败或跳过项，不得省略）。
- 过时知识标记或归档而非静默继续使用：`AGENTS.md` 的退役声明与「Until the new corpus is published, the binding sources are this file, web/AGENTS.md, and docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md」给出替代关系；`docs-dev/` 的 `translation-glossary.md` / `.ru.md` / `.fr.md` 是多语言版本共存的范例；`AGENTS.md` Documentation files 禁止擅自新增 `docs/` 文件，防止重复知识再次产生；`specification-registry.yaml` 的 `dependencies` 提供旧规范到新规范的替代链。
- 一致性门禁命令集合：`./scripts/verify-all.sh [--quick]`（全量模式存在任一 SKIP 即 `exit 2`，`scripts/verify-all.sh` 第 208–211 行）、`cd web && bun run design:tokens:check|i18n:check|components:registry:check|lint:design:strict|test|build:check`、`scripts/verify-docs-artifacts.sh`；`AGENTS.md` Automated Quality Gates 规定「Non-zero exit is a stop condition, not a warning」，差异未闭环不得标记知识已同步。

## 执行流程
1. `uap-orchestrator`（`.uap/runtime/agent-runtime/index.mjs`，权限 `project_read/task_create/task_dispatch/evidence_write`）读取 `specification-registry.yaml`，确认 `UAP-09-001` 的依赖 `UAP-00-004` 已满足，创建结构化任务（`task_id` / `specification_ids` / `scope` / `constraints` / `acceptance_criteria`）。
2. Orchestrator 经 `.uap/runtime/_lib/yaml.mjs` 加载 `execution-mapping.yaml`，解析 `evolution.knowledge` → `.uap/engines/knowledge/index.mjs`，动态 `import()` 并调用 `health(ctx)`；不可导入或 `health()` 缺失写入 `blocked_reasons`。
3. 执行器按 `AGENTS.md` Rule Auto-Loading 表格读取 `AGENTS.md`、`web/AGENTS.md`、`docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md`，再用 `util.mjs` 的 `listFiles()` / `readText()` 扫描 `docs-dev/`、`pkg/billingexpr/expr.md`、`.uap/tools/spec-baseline.md`、`.uap/config/*.yaml`、`.uap/state/BASELINE.json`、`VERSION`，建立知识清单（来源 / 适用范围 / 更新时间 / 关联代码）。
4. 执行器执行 `source_traceability`：逐条核对知识条目是否指向权威文件、是否带适用范围与时间；用 `parseYAML()` 解析 `specification-registry.yaml` 的 32 条 `id` / `dependencies`、`execution-mapping.yaml` 的 `executor_entries`、`validator-registry.yaml` 的 `target`，确认代码/架构/需求/业务规则可关联。
5. 执行器执行 `stale_knowledge` 与 `conflict_detection`：比对 `AGENTS.md` 的退役声明与 `.uap/state/BASELINE.json` 时间点，标出过时条目及替代关系；核对 `docs-dev/plugin-api/v1.md` / `v1.schema.json` / `v1.d.ts` 三件套一致性、设计系统文档与 `web/src/design-system/tokens/` 实现的值/边界归属、`web/scripts/check-design-tokens.mjs` 的 `ALLOWLIST` 例外登记；产出差异记录（知识路径、代码路径、差异内容、处置依据）。
6. 执行器按 `local_command` 运行 `bun run design:tokens:check`、`bun run i18n:check`、`bun run components:registry:check`、`scripts/verify-docs-artifacts.sh` 与 `./scripts/verify-all.sh`（全量），逐条记录命令、退出码与输出；对采集文本先经 `util.mjs` 的 `redact()` 脱敏，确认无 `.env` / 密钥 / 令牌等敏感信息进入知识库。
7. 执行器用 `contract.mjs` 的 `executorResult()` 归一化输出；证据写入 `.uap/evidence/`（`newId('UAP-EVD')`），记录命令、退出码、ISO 8601 时间、环境（`.uap/state/BASELINE.json` toolchain）、知识清单与差异记录全文、输入输出与日志引用，索引追加 `.uap/reports/EVIDENCE-INDEX.md`。
8. `evolution.knowledge_integrity` 验证器（`.uap/validators/evolution/index.mjs`）执行 `source_traceability` / `stale_knowledge` / `conflict_detection` 并返回 `validatorResult()`；仅当 `executed=true && exit_code=0` 且 findings 无 `severity=BLOCKER` 时判 PASS；发现未标注来源的推测、过时知识仍被引用、未登记冲突或敏感信息泄漏时 fail-closed 记为 BLOCKED/FAIL 并保留失败证据。

## 对应执行器
- 执行器 ID：`evolution.knowledge`
- 实现路径：`.uap/engines/knowledge/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：按 `.uap/config/agent-registry.yaml` 的 `uap-knowledge-agent`（`[project_read, knowledge_write, evidence_write]`，tools `knowledge_engine` / `traceability_engine`）与 `.uap/config/permission-policy.yaml` 执行：需要 `project_read`（读权威文件、配置、代码）、`knowledge_write`（受 `AGENTS.md` Documentation files 约束：未经明确请求不得在 `docs/` 下新增文件）、`evidence_write`。`secret_export: deny` 强制知识条目经 `redact()` 脱敏；`production_read` / `production_write` / `production_deploy` / `quality_gate_disable` / `test_deletion_to_force_pass` / `branch_creation` / `force_push` / `destructive_git` 一律 `deny`；受 `enforcement.check_before_action: true`、`log_denied_actions: true`、`redact_secrets: true`、`fail_closed: true`、`default_effect: deny` 约束。

## 对应验证器
- 验证器 ID：`evolution.knowledge_integrity`
- 实现路径：`.uap/validators/evolution/index.mjs`
- 检查项：`[source_traceability, stale_knowledge, conflict_detection]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `task_id` | 任务唯一 ID，来自 `execution-mapping.yaml` 的 `execution_contract.required_input` |
| 输入 | `specification_ids` | 关联规范 ID：`[UAP-09-001]` 及依赖 `UAP-00-004` |
| 输入 | `scope` | 知识范围：`AGENTS.md`、`web/AGENTS.md`、设计系统文档、`docs-dev/`、`pkg/billingexpr/expr.md`、`.uap/config/`、`.uap/state/BASELINE.json` |
| 输入 | `authority_sources` | 权威来源清单（取自 `AGENTS.md` Rule Auto-Loading 表格）与基线时间点 `2026-11-12T10:19:06Z` |
| 输入 | `constraints` | 约束：来源必填、推测不得存为事实、敏感信息脱敏、过时知识须标记、fail-closed |
| 输入 | `acceptance_criteria` | 验收标准：关键项目知识可检索、知识来源可追溯、过时知识可识别、知识与实现差异可发现 |
| 输出 | `executorResult` | 由 `contract.mjs` 的 `executorResult()` 归一化的结构化执行结果 |
| 输出 | `status` / `summary` / `changed_files` | 执行状态、摘要、变更文件清单 |
| 输出 | `knowledge_inventory` | 知识清单：每条的来源 / 适用范围 / 更新时间 / 关联代码路径 |
| 输出 | `validation_results` | 由 `evolution.knowledge_integrity` 独立回填的三类检查结果 |
| 输出 | `difference_records` | 差异记录：知识路径、实际代码路径、差异内容、处置依据 |
| 输出 | `evidence_refs` | 指向 `.uap/evidence/` 的证据 ID 列表 |
| 输出 | `blocked_reasons` | 阻断原因（含过时知识仍被引用、来源缺失、敏感信息泄漏） |
| 输出 | `validatorResult` | `validatorResult()` 返回的机器可读判定 |

## 失败处理
按 `.uap/config/execution-mapping.yaml` 的 `execution.failure_policy` 与 `.uap/config/permission-policy.yaml` 的 `enforcement.fail_closed: true`（`default_effect: deny`）逐类处置：
1. **permission_denied**：执行前由 `.uap/runtime/policy-engine/index.mjs` 校验权限组；若任务试图未经明确请求在 `docs/` 下新增文件、导出敏感信息（`secret_export: deny`）或关闭门禁，立即拒绝并记录 `log_denied_actions`，处置策略 `block`，任务由 RUNNING 迁移为 BLOCKED，不重试、不绕过。
2. **missing_dependency**：`.uap/engines/knowledge/index.mjs` 无法导入、`health()` 缺失、依赖 `UAP-00-004` 未满足、`AGENTS.md` / `web/AGENTS.md` / 设计系统文档 / `.uap/config/*.yaml` 不可读，或 `parseYAML()` 解析失败时，处置策略 `block`，任务迁移 BLOCKED 并写入 `blocked_reasons`，补齐后由 Orchestrator 重新排队（QUEUED）。
3. **validation_failed**：`source_traceability` / `stale_knowledge` / `conflict_detection` 任一失败（如知识条目无来源、推测被标为已确认事实、过时知识仍被引用、`docs-dev/plugin-api/` 三件套不一致、findings 含 `severity=BLOCKER`）时，处置策略 `repair_then_revalidate`，交 `uap-defect-repair` 修复后复验；未复验通过不得标记 SUCCEEDED，差异未闭环不得标记知识已同步。
4. **retryable**：处置策略 `bounded_retry`，重试上限 **3 次**（`execution.max_repair_attempts_per_root_cause: 3`），退避采用指数退避（第 n 次等待 `base × 2^(n-1)`，base=1s，上限 8s，附随机抖动）；每次重试写入独立证据；恢复执行须校验 `task_id` / `result_id` 幂等，禁止重放非幂等副作用，禁止覆盖既有知识条目或历史差异记录。
5. **unrecoverable**：处置策略 `fail`，任务迁移 FAILED 并保留全部失败证据与差异记录；按 `contract.mjs` 的 `TASK_TRANSITIONS`，FAILED 仅允许 → QUEUED / BLOCKED / CANCELLED，禁止重置状态隐藏失败，禁止删除过时/冲突知识记录制造通过。
全局 fail-closed：验证器缺失（`fail_if_validator_missing: true`）、验证器不可执行（`fail_if_validator_not_executable: true`）、证据缺失（`fail_if_evidence_missing: true`）或必需检查被跳过（`fail_if_required_check_skipped: true`）时，结果一律按 BLOCKED / FAIL 处理，绝不降级为 PASS；`allow_explicit_blocked_status: true` 只允许显式声明 BLOCKED，不允许隐式跳过。

## 验收条件
1. 关键项目知识可检索。
2. 知识来源可追溯。
3. 过时知识可识别。
4. 知识与实现差异可发现。

## 证据要求
- 证据统一落盘到 `.uap/evidence/`，索引写入 `.uap/reports/EVIDENCE-INDEX.md`；证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EVD')` 生成稳定唯一 ID（格式 `UAP-EVD-<时间戳>-<随机>`），禁止与历史证据复用；落盘使用 `writeEvidence()` / `appendJSONL()`，知识条目与日志样本经 `redact()` 脱敏。
- 每条证据必须记录：执行命令原文（如 `bun run design:tokens:check`、`bun run i18n:check`、`bun run components:registry:check`、`scripts/verify-docs-artifacts.sh web/dist`、`./scripts/verify-all.sh`）、`exit_code`、开始/结束时间（ISO 8601，由 `nowISO()` 生成）、环境（取自 `.uap/state/BASELINE.json` 的 toolchain：Go `go1.27.4` / Node `v22.22.2` / Bun `1.4.2` 与 `baseline_id`）、输入（`task_id` / `specification_ids` / `authority_sources` / `constraints`）、输出（`executorResult` 或 `validatorResult` 全文）以及日志引用路径（知识条目文件路径、`.uap/reports/EVIDENCE-INDEX.md`、`docs-dev/plugin-api/` 三件套路径）。
- 证据必须包含知识清单与差异记录原文：每条知识注明来源、适用范围、更新时间与关联代码；过时知识注明标记/归档状态与替代关系；冲突注明依据（如三件套一致性、设计系统文档与 `web/src/design-system/tokens/` 的值/边界归属、`ALLOWLIST` 登记）；并证明敏感信息（`.env`、`*.db`、密钥、令牌、`logs/`）未以明文进入知识库。
- 验证结果由 `contract.mjs` 的 `validatorResult()` 归一化为 `{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；`PASS` 仅在 `executed=true && exit_code=0` 且 findings 无 `severity=BLOCKER` 时成立；未验证条目只能处于 `IMPLEMENTED_NOT_VERIFIED` 等未验证状态，不得标为已确认事实；`BLOCKED` / `NOT_EXECUTED` 必须原样记录。
- **证据不可覆盖**：新结果写入新证据文件，禁止覆盖历史记录；`execution.persist_task_state: true` 保证状态持久化。**失败证据不可删除**：BLOCKED / FAILED / NOT_EXECUTED / 过时或冲突知识的差异记录必须保留，禁止以删除失败证据或删除差异记录制造通过结果；报告须能经 `evidence_refs` 反查原始记录并满足 `AGENTS.md` Verification Evidence 四项要求；状态迁移受 `TASK_TRANSITIONS` 约束。

## 依赖标准
- **UAP-00-004（证据与状态管理规范）**：`.uap/config/specification-registry.yaml` 中 `UAP-09-001` 的 `dependencies: [UAP-00-004]`。它定义八态状态集合（`NOT_BUILT` … `FAILED`），要求每次执行产生唯一执行记录、验证结果记录命令/退出码/时间/环境/输入/输出/日志引用、报告可追溯到原始证据、证据有稳定 ID、执行状态持久化可恢复、历史证据不得静默覆盖、失败证据不得删除，并确立「文件存在不能证明功能实现」「测试文件存在不能证明测试通过」的原则。本规范据此把 `.uap/evidence/` 与 `.uap/reports/EVIDENCE-INDEX.md` 作为「重要决策必须有证据」「Agent 使用知识可追溯来源」「不得将推测作为已确认事实」的落地载体，并用未验证状态（`IMPLEMENTED_NOT_VERIFIED`）约束未经证据支持的知识条目。
