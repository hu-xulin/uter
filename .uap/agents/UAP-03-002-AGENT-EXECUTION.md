# UAP-03-002 — Agent 执行规范

**编号：** UAP-03-002
**标准编号：** UAP-03-002
**名称：** Agent 执行规范
**版本：** 1.0.0
**状态：** IMPLEMENTED_NOT_VERIFIED
**适用范围：** 适用于 `.uap/config/execution-mapping.yaml` 中 `agents.execution` 执行器及其对应的 `uap-development-agent`、`uap-review-agent`、`uap-test-agent` 等 Agent 的单次任务执行；覆盖 `router/api-router.go`、`middleware/access_token_routes.go`、`model/`、`controller/`、`service/`、`relay/`、`common/json.go`、`common/quota_math.go`、`service/authz/` 等被修改或读取的 Uter 代码，以及 `scripts/verify-all.sh`、`Makefile` 中的真实命令。
**关键级别：** P0
**依赖标准：** [UAP-03-001]

## 规范目标
UAP 1.0 的 Agent 执行由 `.uap/runtime/agent-runtime/index.mjs` 承载，其输入必须满足 `.uap/config/execution-mapping.yaml` 的 `execution_contract.required_input`，输出必须由 `.uap/runtime/_lib/contract.mjs` 的 `executorResult()` 归一化。本规范禁止 Agent 伪造工具运行结果或把模型推理冒充真实测试：所有命令结果需经 `scripts/verify-all.sh` / `make test` / `bun run typecheck` 等真实执行并记录退出码，再由独立验证器 `agents.execution_integrity` 复验。Uter 现有门禁（`gofmt -l .`、`GOWORK=off go vet ./...`、`web/package.json` 脚本）是结果可核验的唯一依据。

## 强制性要求
1. Agent 只能执行分配给自己的任务。
2. 任务必须包含目标、上下文、约束和验收标准。
3. Agent 执行前必须进行权限校验。
4. Agent 执行结果必须结构化。
5. 执行结果必须包含状态、摘要、修改文件、测试和证据。
6. Agent 不得伪造工具运行结果。
7. Agent 不得将模型推理结果冒充真实测试。
8. 工具调用必须记录参数摘要和结果。
9. 失败必须返回标准错误分类。
10. Agent 必须遵守任务超时、Token 和资源限制。
11. 关键修改必须由独立验证器复验。
12. Agent 输出必须经过结果校验后才能进入下一阶段。

## Uter 落地细则
- `.uap/config/execution-mapping.yaml` 的 `execution_contract.required_input` 为 `task_id`/`specification_ids`/`scope`/`constraints`/`acceptance_criteria`，`required_output` 为 `status`/`summary`/`changed_files`/`validation_results`/`evidence_refs`/`blocked_reasons`，构成任务最小契约。
- `.uap/runtime/_lib/contract.mjs` 的 `executorResult()` 输出含 `result_id`/`task_id`/`executor_id`/`status`/`summary`/`changed_files`/`commands`/`evidence_refs`/`blocked_reasons`/`outputs`/`validation_results`；`assertExecutorResult()` 强制 `validation_results.length === 0`，执行器禁止自证通过。
- `.uap/runtime/_lib/contract.mjs` 的 `validatorResult()` / `assertValidatorResult()` 规定 PASS 仅当 `executed === true` 且 `exit_code === 0`；`finding('BLOCKER', code, message)` 会把 PASS 降级为 FAIL，实现关键修改的独立复验。
- `.uap/config/permission-policy.yaml` 的 `local_command` 组带 `require_command_logging: true` / `forbid_secret_exfiltration: true`；`project_write` 组带 `preserve_uncommitted_changes: true` / `forbid_destructive_git_operations: true`；`test_environment` 组带 `isolated_environment_only: true`。
- `.uap/config/agent-registry.yaml` 中 `uap-review-agent` 权限仅 `[project_read, evidence_write]`、`output_schema: review-result`，与 `uap-development-agent` 的 `[project_read, project_write, local_command, evidence_write]` 分离，确保审查不与被审修改共用写权限。
- `scripts/verify-all.sh` 的 `step()` 强制输出「实际命令 + 退出码 + 耗时」；脚本头定义退出码 `0 = 全部通过`、`1 = 至少一个门禁失败`、`2 = 环境不满足`，`./scripts/verify-all.sh --quick` 跳过慢套件，禁止口头宣称通过。
- `Makefile` 的 `test` 目标以 `GOWORK=off go test` 依次验证 root、`relaykit`、`tokenkit`、`tokenkit/tokenkit` 四个模块；`verify` / `verify-quick` 目标分别调用 `./scripts/verify-all.sh` 与 `--quick`。
- `web/package.json` 的真实脚本：`typecheck`（`tsgo -b`）、`lint`（`node scripts/check-i18n-keys.mjs && oxlint -c .oxlintrc.json .`）、`test`（`vitest run`）、`lint:design:strict`、`copyright:check`、`format:check`、`build:check`，均在 `web/` 下通过 `bun run <script>` 执行。
- `AGENTS.md`「Verification Evidence」要求完成报告列出确切命令、退出码、通过/失败计数、失败测试名、改动文件、已知失败；明确拒绝「已检查」「tests passed」等无证据声明。
- `.uap/runtime/evidence-engine/index.mjs` 的 `record()` 字段含 `command`/`exit_code`/`duration_ms`/`inputs`/`stdout`/`stderr`/`content_hash`，`get()`/`verify()`/`resolveAll()` 支撑执行结果回溯；`redact()` 保证日志不出现明文密钥。
- `.uap/runtime/event-system/index.mjs` 的 `publish(type, payload, {trace_id, task_id, severity})` 记录工具调用参数摘要与结果，`query({task_id})` 可回放单次执行事件链，构成超时/失败可观测性。
- `.uap/config/validator-registry.yaml` 中 `agents.execution_integrity` 的 `checks: [execution_contract, structured_output, timeout]`，配合 `validation_policy.fail_if_required_check_skipped: true` 与 `fail_if_evidence_missing: true`。
- `AGENTS.md`「Change Protection」要求先 `git status --short`、只 `git add <path>`、禁止 `rm -rf`/`git clean -fd`；与 `.uap/config/execution-mapping.yaml` 的 `branch_policy: no_branch_creation`、`preserve_user_changes: true`、`execution.mode: local` 一致。

## 执行流程
1. `uap-orchestrator` 按 `task_dispatch` 派发任务，写入 `.uap/state/tasks.json`；执行器 `agents.execution`（`.uap/runtime/agent-runtime/index.mjs`）读取任务的 `scope`/`constraints`/`acceptance_criteria`。
2. 执行前调用 `.uap/runtime/policy-engine/index.mjs`（`security.policy`）按 `check_before_action: true` 校验 Agent 权限组；命中 deny 立即返回 `blocked_reasons` 并停止。
3. 执行器调用真实工具：`./scripts/verify-all.sh`、`make test`、`gofmt -l .`、`GOWORK=off go vet ./...`、`cd web && bun run typecheck|lint|test|build:check`，逐条经 `step()` 采集命令与退出码。
4. 执行器用 `.uap/runtime/_lib/contract.mjs` 的 `executorResult()` 归一化输出，`commands`/`evidence_refs`/`changed_files` 必须来自真实工具结果，`validation_results` 保持空数组。
5. 工具调用参数摘要与结果经 `event-system.publish()` 追加到 `.uap/state/events.jsonl`；`evidence-engine.record()` 把命令输出写入 `.uap/evidence/UAP-EV-*.json`。
6. 独立验证器 `agents.execution_integrity`（`.uap/validators/agents/index.mjs`）执行 `execution_contract`、`structured_output`、`timeout` 检查，返回 `validatorResult()`；BLOCKER 发现强制 FAIL。
7. 结果校验通过（`executed=true`、`exit_code=0`、无 BLOCKER）后才允许任务迁移 `RUNNING → SUCCEEDED` 并进入下一阶段，否则迁移 `RUNNING → FAILED`/`BLOCKED`。
8. `.uap/reports/EVIDENCE-INDEX.md` 追加本次 `evidence_id` 索引，状态保持 IMPLEMENTED_NOT_VERIFIED 直至独立复验完成。

## 对应执行器
- 执行器 ID：`agents.execution`
- 实现路径：`.uap/runtime/agent-runtime/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：需 `project_read`（读取 Uter 代码与配置）、`local_command`（`require_command_logging: true`、`forbid_secret_exfiltration: true`）、`evidence_write`；修改代码另需 `project_write`（`preserve_uncommitted_changes: true`）；测试执行需 `test_environment`（`isolated_environment_only: true`）。按 `.uap/config/permission-policy.yaml` 的 `default_effect: deny`、`enforcement.check_before_action: true`、`fail_closed: true` 逐动作校验；禁止 `production_write`/`production_deploy`/`real_payment`/`real_refund`/`quality_gate_disable` 等 deny 组。

## 对应验证器
- 验证器 ID：`agents.execution_integrity`
- 实现路径：`.uap/validators/agents/index.mjs`
- 检查项：`[execution_contract, structured_output, timeout]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `task`（结构化任务对象） | 含 `task_id`/`specification_ids`/`scope`/`constraints`/`acceptance_criteria`，来自 `.uap/state/tasks.json` |
| 输入 | `.uap/config/permission-policy.yaml` | 执行前 `check_before_action` 权限校验依据 |
| 输入 | `scripts/verify-all.sh` / `Makefile` / `web/package.json` | 真实命令与脚本来源，退出码是结果真伪的唯一判定 |
| 输入 | `.uap/config/agent-registry.yaml` | 目标 Agent 的 `permissions`/`tools`/`output_schema` 声明 |
| 输出 | `executorResult` | 含 `status`/`summary`/`changed_files`/`commands`/`evidence_refs`/`blocked_reasons`，`validation_results` 必须为空 |
| 输出 | `validatorResult` | 独立验证器的 `status`/`executed`/`exit_code`/`findings`/`checks_run` |
| 输出 | `.uap/evidence/UAP-EV-*.json` | 命令、退出码、耗时、stdout/stderr（脱敏）、`content_hash` 证据 |
| 输出 | `.uap/state/events.jsonl` | `UAP-EVT-*` 工具调用事件与 `trace_id` 关联记录 |

## 失败处理
- `permission_denied`：权限组校验命中 `deny` 或 `default_effect: deny` 时停止动作，任务迁移 `RUNNING → BLOCKED`，处置为 `block`（`failure_policy.permission_denied: block`），写 `blocked_reasons` 与审计事件，禁止绕过检查重试。
- `missing_dependency`：所需执行器模块、Go/Bun 工具链或前置规范 UAP-03-001 不可用时迁移 `QUEUED → BLOCKED`，处置为 `block`；`fail_if_validator_missing: true` 使验证器缺失同样阻断，不产生伪造结果。
- `validation_failed`：`execution_contract`/`structured_output`/`timeout` 任一 FAIL 时迁移为 `FAILED`，处置为 `repair_then_revalidate`，修复后必须重跑同一验证器并生成新证据，禁止直接改判 PASS。
- `retryable`：命令瞬时失败按 `bounded_retry` 处理，重试上限 3 次（`execution.max_repair_attempts_per_root_cause: 3`），退避为指数退避（1s → 2s → 4s），每次重试写独立 `evidence_id` 与事件；`WAITING_RECOVERY → QUEUED → RUNNING` 为合法迁移链，超限迁移 `FAILED`。
- `unrecoverable`：任务超时不可恢复、上下文损坏或工具链不可修复时迁移 `RUNNING → FAILED` 或 `BLOCKED`，处置为 `fail`，完整保留失败证据；`.uap/runtime/state-machine/index.mjs` 的 `assertTransition()` 对非法边抛 `IllegalTransitionError`，`fail_closed: true` 禁止静默改状态或重置隐藏失败历史。

## 验收条件
> 基线原文：Agent 执行有权限边界；输出可解析；失败可识别；结果有独立验证。

1. Agent 执行有权限边界
2. 输出可解析
3. 失败可识别
4. 结果有独立验证。

## 证据要求
- 证据目录 `.uap/evidence/`，索引 `.uap/reports/EVIDENCE-INDEX.md`；文件命名 `.uap/evidence/<evidence_id>.json`，ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EV')` 生成（`UAP-EV-<14位UTC时间戳>-<8位hex>`）。
- 证据必须记录 `command`（如 `./scripts/verify-all.sh`、`make test`、`bun run typecheck`）、`exit_code`、`duration_ms`、`recorded_at`、`environment`（platform/node/cwd/uap_root）、`inputs`、`stdout`、`stderr`、`artifacts`、`findings`、`summary`、`content_hash`、`task_id`、`trace_id`、`specification_ids`（含 UAP-03-002）。
- 工具调用的参数摘要与结果必须可由 `.uap/state/events.jsonl` 的 `UAP-EVT-*` 事件经 `query({task_id, trace_id})` 回放；`severity` 区分 INFO/WARN/ERROR。
- 证据 append-only：`writeEvidence()` 对同 ID 二次写入抛错，`verify()` 校验 `content_hash`，`resolveAll()` 校验 `evidence_refs` 有效；失败证据不得删除、不得被新结果静默覆盖。
- 独立验证器的 `checks_run` 与 `exit_code` 必须写入证据；`AGENTS.md`「Verification Evidence」要求的命令、退出码、通过/失败计数、失败测试名、改动文件、已知失败均为必填项，缺一项即视为证据不完整。
- 敏感值经 `redact()` 脱敏，禁止把密钥、Token、密码写入 `stdout`/`stderr`/日志/报告；`evidence-engine.health()` 的 `secret_redaction` 自检必须为真。

## 依赖标准
- `UAP-03-001`（Agent 架构规范）：提供 Agent 唯一 ID、职责、输入输出、工具、权限与结构化输出的注册基线（`.uap/config/agent-registry.yaml`），使 `agents.execution` 能确定「分配给自己的任务」边界、权限组与 `output_schema`，并支撑版本兼容性验证。
