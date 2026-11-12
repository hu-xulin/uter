# UAP-05-003 — 自动修复规范

**编号：** UAP-05-003
**标准编号：** UAP-05-003
**名称：** 自动修复规范
**版本：** 1.0.0
**状态：** ACTIVE
**适用范围：** 约束 Uter 全仓由已确认缺陷触发的自动修复，覆盖 `controller/`、`service/`、`model/`、`common/`、`relay/`、`middleware/` 的 Go 代码与 `web/src/` 的 TypeScript 代码；执行器 `quality.auto_repair`（`.uap/engines/auto-repair/index.mjs`）按 `.uap/config/workflow-registry.yaml` 的 `uap-defect-repair` 工作，修复前必须遵守 `AGENTS.md` 的 Change Protection 与 `web/AGENTS.md` §3.14 的「先写复现失败用例再修复」约定。
**关键级别：** P0
**依赖标准：** UAP-05-001、UAP-05-002

## 规范目标
本规范把 Uter 的缺陷修复固化为「已确认缺陷 → 根因与影响分析 → 修复计划 → 授权修复 → 回归复验 → 独立复审 → 证据留痕」闭环，且每个根因最多尝试 3 种实质不同的修复方案。修复必须以 `common/quota_math.go` 这类集中式根因为范式，禁止掩盖症状、禁止删除失败测试或降低质量门禁，禁止重放用户未提交的改动；无法安全自动修复时一律迁移 BLOCKED，绝不声称成功。

## 强制性要求
1. 自动修复必须从已确认缺陷开始。
2. 必须分析根因和影响范围。
3. 必须生成修复计划。
4. 必须优先修复根因，不得只掩盖症状。
5. 修复必须符合代码规范和安全边界。
6. 每个根因最多尝试 3 种实质不同的修复方案。
7. 修复失败必须保留证据。
8. 修复后必须执行相关测试。
9. 关键修改必须重新审查。
10. 失败后不得无限循环。
11. 自动修复不得删除失败测试或降低质量门禁。
12. 修复必须生成前后差异和验证报告。
13. 修复涉及用户未提交内容时必须保护原始内容。
14. 无法安全自动修复时必须标记 BLOCKED。

## Uter 落地细则
- 修复工作流的机器定义是 `.uap/config/workflow-registry.yaml` 的 `uap-defect-repair`：`classify_defect → identify_root_cause → calculate_impact → generate_repair_plan → apply_authorized_repair → run_regression → independent_review → persist_evidence`，`acceptance: defect_verified_or_blocked`，`retry.max_attempts_per_root_cause: 3`、`stop_on_permission_denied: true`、`stop_on_unrecoverable: true`。
- 每个根因最多 3 次的上限同时写死在 `.uap/config/execution-mapping.yaml` 的 `execution.max_repair_attempts_per_root_cause: 3` 与 `preserve_user_changes: true`；`execution.failure_policy` 规定 `validation_failed: repair_then_revalidate`，即修复后必须复验而非直接标记完成。
- 「从已确认缺陷开始」的输入来源：`quality.test_integrity` 的 findings（UAP-05-002）、`development.review_integrity` 的结构化发现（UAP-04-002）与 `.uap/config/workflow-registry.yaml` 的 `uap-full-audit` 步骤 `build_defect_registry`；`AGENTS.md` Verification Evidence 要求缺陷记录带可复制命令、退出码与失败测试名。
- 「先写能复现的失败用例再修复」是 `web/AGENTS.md` §3.14 的硬约定：新增功能、修复缺陷或修改行为必须同步新增/更新测试，Bug 修复必须先编写稳定复现问题的失败用例，再实现修复并确认用例转为通过；后端 `AGENTS.md` Backend test quality 要求优先扩展既有测试文件、必要时最多新增一个。
- 根因优先的真实范式：`AGENTS.md` Billing safety invariants 规定所有额度换算集中在 `common/quota_math.go`（`QuotaFromFloat` / `QuotaRound` / `QuotaFromDecimal` / `WalletQuotaFromDecimalStrict` 及 `*Checked` 变体），「Do not reintroduce local conversion helpers or bare casts」；饱和审计由 `service/log_info_generate.go` 的 `attachQuotaSaturation` 统一挂到 `admin_info.quota_saturation`，修复不得在调用点复制局部逻辑掩盖症状。
- 影响范围分析的真实对象：`controller/topup_gateway_contract_test.go` 用 `rechargeCallingFunctions()` 的 AST 扫描 `controller/` 下所有 `model.Recharge*` 调用点，任何新增入账路径必须登记到 `requiredGatewayCallbacks` 并补齐「验签 / 幂等 / 实付金额比对」三件套，改动支付链路时该测试即为影响清单。
- 修复必须符合代码规范：Go 侧遵循 `AGENTS.md` Modern Go conventions（`any` 替代 `interface{}`、`slices.Contains`、`strings.Cut`、`common.Marshal/Unmarshal` 走 `common/json.go`）并执行 `gofmt`；前端遵循 `web/AGENTS.md` §3.2（禁 2 层以上嵌套三元、避免 `any`、改后必跑 `bun run typecheck` 与 lint）。
- 修复后必须执行相关测试：`./scripts/verify-all.sh`（必要时 `--quick` 仅作开发便利，非完整验收）、`make test`、`go test -race -count=1 ./service/... ./relay/... ./middleware/... ./model/...`、`cd web && bun run test`；`web/AGENTS.md` §3.14 要求提交前至少运行受影响测试文件与 `bun run typecheck`、涉及文件 lint。
- 关键修改必须重新审查：`.uap/config/agent-registry.yaml` 的 `uap-review-agent`（`.uap/engines/code-review/index.mjs`，权限 `project_read/evidence_write`，`output_schema: review-result`）承担 `independent_review` 步骤；`AGENTS.md` 的「Automatic Code Review」要求每次变更自动审查并「修复后必须重新审查」，审查结果保存证据。
- 不得删除失败测试或降低门禁：`.uap/config/permission-policy.yaml` 显式 `test_deletion_to_force_pass: effect: deny` 与 `quality_gate_disable: effect: deny`；`AGENTS.md` Design System Enforcement「never disable lint rules, weaken tests, or bypass CI to make a change pass」；`controller/topup_gateway_contract_test.go` 自身即防止删掉金额比对后门禁假通过的结构性断言。
- 保护用户未提交内容：`AGENTS.md` Change Protection 要求编辑前先 `git status --short` 记录已脏文件、绝不把既有改动卷入自己的提交，只 `git add <path>`（`git add -A` / `-u` 禁用）、提交前 `git diff --cached --name-status`；禁止 `rm -rf` 与 `git clean -fd`，删除文件走系统回收站且每批最多 10 个；`.env`、`*.db`/`-shm`/`-wal`、`logs/`、构建产物不得进入提交。
- 前后差异与验证报告：用只读 `git diff` 生成 before/after 差异，`AGENTS.md` Verification Evidence 要求报告列出改动文件路径、精确命令、退出码、pass/fail 计数、失败测试名与已知跳过项；`.uap/config/execution-mapping.yaml` 的 `required_output.changed_files` / `validation_results` / `evidence_refs` 固化该结构。
- 无法安全自动修复时标记 BLOCKED：`.uap/config/workflow-registry.yaml` 的 `stop_on_permission_denied: true` / `stop_on_unrecoverable: true` 与 `.uap/config/permission-policy.yaml` 的 `fail_closed: true`（`default_effect: deny`）；涉及 `production_write` / `production_deploy` / `real_payment` / `real_refund` / `secret_export` 的修复一律 BLOCKED，不自动执行。
- 状态与证据持久化：`.uap/runtime/state-machine/index.mjs` 的 `TASK_TRANSITIONS` 禁止「重置状态隐藏失败」（`AGENTS.md` 对应 UAP-00-004 第 12 条），`.uap/runtime/evidence-engine/index.mjs` 保证 `persist_after_each_step: true` 与 `resume_on_interruption: true`；每次修复尝试（含失败）都生成独立 `UAP-EVD-...` 证据。
- 回归与独立复审的真实门禁：`./scripts/verify-all.sh` 全量模式任一 FAIL 即 `exit 1`、存在 SKIP 即 `exit 2`；`.github/workflows/ci.yml` 的 `ueqe-review` job 执行 `bash scripts/quality/uter-quality.sh review`，`scripts/quality/uter-quality.sh` 为已存在的审查/安全引擎入口。

## 执行流程
1. `uap-orchestrator`（`.uap/runtime/agent-runtime/index.mjs`）按 `.uap/config/workflow-registry.yaml` 的 `uap-defect-repair` 发起；入口缺陷必须来自 `build_defect_registry` 或独立验证器的 findings，禁止从模型推测直接开工。
2. `classify_defect` / `identify_root_cause` / `calculate_impact`：读取相关源码与 `controller/topup_gateway_contract_test.go`、`common/quota_math.go` 等契约，产出根因分类与影响文件清单，写入 `blocked_reasons` / `scope`。
3. `generate_repair_plan`：为同一根因生成最多 3 种实质不同的修复方案，登记 `attempt_index`（1..3）与 `acceptance_criteria`，写入任务上下文并生成计划证据。
4. `apply_authorized_repair`：`uap-repair-agent`（`.uap/engines/auto-repair/index.mjs`）执行前先 `git status --short` 快照，按 `preserve_user_changes: true` 保护用户未提交内容，仅修改授权文件；`permission_denied` 立即停止。
5. `run_regression`：执行 `./scripts/verify-all.sh`、`make test`、受影响包的 `go test -race -count=1 ./...` 与 `cd web && bun run test`，先确认复现用例由红转绿，再采集每条命令的 `exit_code`。
6. `independent_review`：`uap-review-agent`（`.uap/engines/code-review/index.mjs`）对关键修改重新审查，产出 `review-result`；执行器不得自行声明通过（`assertExecutorResult()` 强制 `validation_results` 为空）。
7. `persist_evidence`：用只读 `git diff` 生成前后差异，写入验证报告与 `UAP-EVD-...` 证据到 `.uap/evidence/`，索引追加 `.uap/reports/EVIDENCE-INDEX.md`；失败尝试同样留痕。
8. `quality.repair_integrity` 验证器（`.uap/validators/quality/index.mjs`）执行 `root_cause` / `bounded_retry` / `regression`；3 次尝试仍未通过或遇 `unrecoverable` 时迁移 BLOCKED / FAILED 并保留全部失败证据。

## 对应执行器
- 执行器 ID：`quality.auto_repair`
- 实现路径：`.uap/engines/auto-repair/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：按 `.uap/config/agent-registry.yaml` 的 `uap-repair-agent`（`output_schema: repair-result`）与 `.uap/config/permission-policy.yaml`，需 `project_read`（读取源码与缺陷记录）、`project_write`（受 `preserve_uncommitted_changes: true` 与 `forbid_destructive_git_operations: true` 约束）、`local_command`（执行 `make test` 等已批准命令，受 `require_command_logging: true` 约束）、`evidence_write`；受 `enforcement.check_before_action: true`、`fail_closed: true`、`default_effect: deny` 约束，`quality_gate_disable` / `test_deletion_to_force_pass` / `destructive_git` / `force_push` / `branch_switch` 一律 deny。

## 对应验证器
- 验证器 ID：`quality.repair_integrity`
- 实现路径：`.uap/validators/quality/index.mjs`
- 检查项：`[root_cause, bounded_retry, regression]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `task_id` | 任务唯一 ID，来自 `.uap/config/execution-mapping.yaml` 的 `execution_contract.required_input` |
| 输入 | `specification_ids` | 关联规范 ID（UAP-05-001、UAP-05-002、UAP-05-003） |
| 输入 | `defect_record` | 已确认缺陷：失败测试名、命令原文、退出码、根因分类、影响文件清单 |
| 输入 | `scope` / `constraints` | 授权修改范围、权限组、超时、禁改动清单、保护用户未提交内容 |
| 输入 | `acceptance_criteria` | 复现用例由红转绿、回归通过、独立复审通过 |
| 输入 | `ctx` | Runtime 上下文，含 `git status --short` 快照与 `.uap/state/BASELINE.json` 环境 |
| 输出 | `executorResult` | 由 `.uap/runtime/_lib/contract.mjs` 的 `executorResult()` 归一化的结构化结果 |
| 输出 | `repair_plan` | 最多 3 种实质不同方案与 `attempt_index` 记录 |
| 输出 | `before_after_diff` | 只读 `git diff` 生成的前后差异与 `changed_files` 清单 |
| 输出 | `regression_results` | 复验命令、`exit_code`、pass/fail 计数与失败测试名 |
| 输出 | `validation_report` | 前后差异 + 独立复审结论的验证报告 |
| 输出 | `evidence_refs` / `blocked_reasons` | 证据 ID 列表与阻断原因（含 BLOCKED 判定） |

## 失败处理
按 `.uap/config/execution-mapping.yaml` 的 `execution.failure_policy`、`.uap/config/workflow-registry.yaml` 的 `uap-defect-repair.retry` 与 `.uap/config/permission-policy.yaml` 的 `enforcement.fail_closed: true`（`default_effect: deny`）逐类处置：
1. **permission_denied**：`apply_authorized_repair` 前由 policy-engine 校验 `project_read/project_write/local_command/evidence_write`，缺失即拒绝动作、记录 `log_denied_actions`，处置策略 `block` 且 `stop_on_permission_denied: true`，任务由 RUNNING 迁移 BLOCKED，不重试、不绕过；涉及生产资金/密钥/发布一律 BLOCKED。
2. **missing_dependency**：依赖的测试命令、`uap-review-agent` 或 UAP-05-001 / UAP-05-002 前置能力不可用时，处置策略 `block`，任务迁移 BLOCKED 并写入 `blocked_reasons`，补齐后由 Orchestrator 重新排队（QUEUED）。
3. **validation_failed**：复现用例未转绿、回归测试非零退出、独立复审 FAIL 或 `quality.repair_integrity` 含 `severity=BLOCKER` findings 时，处置策略 `repair_then_revalidate`，按 `attempt_index` 换用实质不同的修复方案并再次复验；3 次用尽仍未通过即迁移 BLOCKED。
4. **retryable**：处置策略 `bounded_retry`，同一根因重试上限 **3 次**（`max_repair_attempts_per_root_cause: 3`），退避采用指数退避（第 n 次等待 base × 2^(n-1)，base=1s，上限 8s，附随机抖动）；每次尝试写入独立证据；恢复执行须校验 `task_id` 幂等，禁止重放非幂等副作用（如重复入账、重复退款）。
5. **unrecoverable**：处置策略 `fail` 且 `stop_on_unrecoverable: true`，任务迁移 FAILED / BLOCKED 并保留全部失败证据；按 `.uap/runtime/_lib/contract.mjs` 的 `TASK_TRANSITIONS`，FAILED 仅允许 → QUEUED / BLOCKED / CANCELLED，禁止重置状态隐藏失败。
全局 fail-closed：任何策略判定异常、验证器缺失（`fail_if_validator_missing: true`）、证据缺失（`fail_if_evidence_missing: true`）或达到 3 次上限时，结果一律按 BLOCKED / FAIL 处理，绝不降级为 PASS；禁止删除失败测试或降低门禁制造成功。

## 验收条件
> 基线原文：能够自动识别、修复和复验缺陷；能够停止无效重试；修复前后差异可追溯；不会通过破坏测试制造成功。

1. 能够自动识别、修复和复验缺陷
2. 能够停止无效重试
3. 修复前后差异可追溯
4. 不会通过破坏测试制造成功。

## 证据要求
- 证据统一落盘到 `.uap/evidence/`，索引写入 `.uap/reports/EVIDENCE-INDEX.md`；证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EVD')` 生成稳定唯一 ID（格式 `UAP-EVD-<时间戳>-<随机>`），每次修复尝试（含失败尝试）各自独立，禁止与历史证据复用。
- 每条证据必须记录：执行命令原文（如 `git status --short`、`git diff`、`./scripts/verify-all.sh`、`make test`、`go test -race -count=1 ./...`、`cd web && bun run test`）、`exit_code`、开始/结束时间（ISO 8601）、环境（取自 `.uap/state/BASELINE.json`：Go `go1.27.4` / Node `v22.22.2` / Bun `1.4.2`）、输入（`defect_record` / `repair_plan` / `attempt_index` / `scope`）、输出（前后差异、复验结果、`executorResult` / `validatorResult` 全文、独立复审结论）以及日志引用路径。
- 验证结果由 `.uap/runtime/_lib/contract.mjs` 的 `validatorResult()` 归一化为 `{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；`PASS` 仅在 `executed=true && exit_code=0` 且 `findings` 无 `severity=BLOCKER` 时成立。
- 报告必须能经 `evidence_refs` 反查到 `.uap/evidence/` 下的原始记录；`AGENTS.md` Verification Evidence 要求列出改动文件、精确命令、退出码、pass/fail 计数、失败测试名与已知跳过项；前后差异须可定位到具体 `changed_files`。
- **证据不可覆盖**：新结果写入新证据文件，禁止覆盖历史记录；`persist_after_each_step: true` 保证逐步持久化。**失败证据不可删除**：修复失败、BLOCKED / FAILED / NOT_EXECUTED 的证据必须保留，禁止以删除失败测试、删除失败证据或重置状态制造通过结果；状态迁移受 `TASK_TRANSITIONS` 约束。

## 依赖标准
- **UAP-05-001（质量工程总规范，`.uap/quality/UAP-05-001-QUALITY-ENGINEERING.md`）**：提供「四项能力协同」「失败必须分类并关联缺陷」「不得通过降低门禁制造通过结果」的总框架，并把 `uap-defect-repair` 与 `uap-quality-gate` 纳入统一调度，是自动修复的边界来源。
- **UAP-05-002（自动化测试规范，`.uap/quality/UAP-05-002-AUTOMATED-TESTING.md`）**：提供「测试结果必须记录命令、退出码和证据」「测试失败不得被静默忽略」「关键并发和幂等场景覆盖」能力，其 `quality.test_integrity` findings 是本规范唯一合法的缺陷输入，并为 `run_regression` 步骤提供可复验的测试集合与失败传播契约。
