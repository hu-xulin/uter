# UAP-05-001 — 质量工程总规范
> **UDS 7.0 状态边界：** 当前文档/Token SSOT 为 UDS 7.0（`ACCEPTANCE_READY`、`accepted: false`）。指定运行时标量 Token 与图表色已切换到 7.0 值；UDS 3.0 兼容层仍须保留，未迁移页面不得假定已完成全站切换。页面级状态以 `COMPAT-MAP.json` 和 `FINAL-ACCEPTANCE-REPORT.md` 的本次证据为准，不得将局部 Token 迁移等同于整体验收。


**编号：** UAP-05-001
**标准编号：** UAP-05-001
**名称：** 质量工程总规范
**版本：** 1.0.0
**状态：** ACTIVE
**适用范围：** 约束 Uter 全仓（`controller/`、`service/`、`model/`、`relay/`、`middleware/`、`common/`、`web/src/`）的工程质量治理，把代码审查、自动化测试、自动修复、质量门禁四项能力统一映射到 `.uap/config/specification-registry.yaml` 的 UAP-05-001~004、`.uap/config/execution-mapping.yaml` 的 `quality.*` 执行器与 `.uap/config/workflow-registry.yaml` 的 `uap-quality-gate`；与 `AGENTS.md` 的 Automated Quality Gates / Verification Evidence / Backend test quality / Change Protection 以及 `web/AGENTS.md` §3.14 测试约定共同生效。
**关键级别：** P0
**依赖标准：** UAP-04-002

## 规范目标
本规范把 Uter 已有的真实门禁（`./scripts/verify-all.sh`、`make test`、`.github/workflows/ci.yml` 的 7 个 job）收敛为「代码审查—自动化测试—自动修复—质量门禁」四项协同能力，杜绝「文件存在即通过」「口头宣称通过」。任何质量判定必须来自真实命令的退出码与 `.uap/evidence/` 证据，任何关键业务路径（充值回调、计费换算、认证会话）必须有可追溯的自动化验证，且质量系统自身（`.uap/runtime/_lib/contract.mjs`、`uap-bootstrap` 的 `run_runtime_tests`）也必须被测。

## 强制性要求
1. 质量工程由代码审查、自动化测试、自动修复和质量门禁组成。
2. 四项能力必须协同工作。
3. 质量检查必须覆盖代码、业务、架构、安全、数据和用户体验。
4. 每次变更必须确定影响范围。
5. 质量结果必须基于真实工具执行。
6. 必须区分单元、集成、端到端和回归测试。
7. 测试范围必须与修改风险匹配。
8. 关键业务路径必须有端到端测试。
9. 失败必须分类并关联缺陷。
10. 不得通过降低门禁制造通过结果。
11. 质量状态必须有证据。
12. 质量系统自身也必须经过测试。

## Uter 落地细则
- 四项能力的机器映射由 `.uap/config/execution-mapping.yaml` 的 `executor_entries` 固定：`quality.engineering: .uap/engines/testing/index.mjs`、`quality.testing: .uap/engines/testing/index.mjs`、`quality.auto_repair: .uap/engines/auto-repair/index.mjs`、`quality.gates: .uap/engines/testing/index.mjs`；四条规范分别在 `.uap/config/specification-registry.yaml` 登记为 UAP-05-001~004，`criticality: P0`。
- 完整质量工作流的机器定义是 `.uap/config/workflow-registry.yaml` 的 `uap-quality-gate`：`lint → typecheck → unit_tests → integration_tests → end_to_end_tests → security_scan → dependency_scan → build → code_review`，`acceptance: all_required_gates_pass`；`uap-final-verification` 的 `run_full_quality_gate` 负责汇总。
- 本地全量门禁唯一入口 `./scripts/verify-all.sh`（真实脚本 `scripts/verify-all.sh`）：全量模式执行 `gofmt -l .`、四模块 `GOWORK=off go vet ./...`、`make test`，前端 `cd web && bun run typecheck|lint|lint:design:strict|copyright:check|format:check|test|build:check`，以及 `scripts/quality/uter-quality.sh security`；任一 FAIL 即 `exit 1`，全量模式存在 SKIP 即 `exit 2`（`scripts/verify-all.sh:200-211`），`--quick` 明确为「非完整质量验收」（exit 0 但带警告）。
- 影响范围与真实工具执行的 CI 落地为 `.github/workflows/ci.yml` 的 7 个 job：`ueqe-review / backend / race / coverage / vulnscan / desktop / frontend`；其中 `race` 跑 `go test -race -count=1 ./service/... ./relay/... ./middleware/... ./model/...` 与 `go test -race -count=1 ./e2e/...`，`vulnscan` 对 `.` / `relaykit` / `tokenkit` / `tokenkit/tokenkit` 四模块跑 `govulncheck ./...`。
- 质量结果可追溯：`.github/workflows/ci.yml` 的 `coverage` job 用 `go test -covermode=set -coverprofile=coverage.out` 产出 `coverage.out` 并 `upload-artifact`（retention-days: 14），再由 `./scripts/coverage-gate.sh coverage.out "$(go list -m)" controller=39 model=45 service=43 middleware=62` 对资金/权限所在包设覆盖率下限。
- 分层测试区分：后端 `make test` 覆盖 root / `relaykit` / `tokenkit` / `tokenkit/tokenkit` 四个独立 Go 模块（`.github/workflows/ci.yml` backend job 与 `.github/workflows/release-gate.yml`）；前端单元测试 `cd web && bun run test`（`web/package.json` 的 `test: vitest run`）；端到端由 `e2e/` 的组织计费全链路用例在 `-race` 下执行。
- 测试范围与修改风险匹配：`AGENTS.md` 的「Backend test quality」要求聚焦改动先扩展既有测试文件、必要时最多新增一个，禁止跨 `controller/`、`service/`、`setting/` 重复铺文件，禁止只提升覆盖率的 smoke/sleep/随机输入测试，并要求 `github.com/stretchr/testify/require` 与 `assert`。
- 失败分类并关联缺陷：`.uap/config/execution-mapping.yaml` 的 `execution.failure_policy`（`retryable: bounded_retry`、`permission_denied: block`、`missing_dependency: block`、`validation_failed: repair_then_revalidate`、`unrecoverable: fail`）与 `.uap/config/workflow-registry.yaml` 的 `uap-defect-repair`（`classify_defect → identify_root_cause → calculate_impact → generate_repair_plan → ... → run_regression → independent_review`）共同落地。
- 不得降低门禁制造通过：`.uap/config/permission-policy.yaml` 显式 `quality_gate_disable: effect: deny` 与 `test_deletion_to_force_pass: effect: deny`；`AGENTS.md` Design System Enforcement 明确「never disable lint rules, weaken tests, or bypass CI to make a change pass」；`web/AGENTS.md` §3.14 要求提交前至少运行受影响测试并看到最新通过结果。
- 质量状态必须有证据：`.uap/config/execution-mapping.yaml` 的 `evidence.directory: .uap/evidence`、`reports_directory: .uap/reports`、`persist_task_state: true`；`.uap/config/validator-registry.yaml` 的 `validation_policy.fail_if_evidence_missing: true` 与 `fail_if_validator_not_executable: true`。
- 质量系统自身被测：`.uap/runtime/_lib/contract.mjs` 的 `executorResult()` / `validatorResult()` / `assertExecutorResult()` / `assertValidatorResult()` 与 `LIFECYCLE_STATUSES` / `TASK_TRANSITIONS` 为运行时契约；`.uap/config/workflow-registry.yaml` 的 `uap-bootstrap` 步骤 `run_runtime_tests` 且 `acceptance: runtime_health_check`；被测对象含 `.uap/runtime/evidence-engine/index.mjs` 与 `.uap/runtime/state-machine/index.mjs`。
- P09 / P10 边界：`AGENTS.md`「Change Protection」规定 P09 质量工程证明工程质量是否满足要求，P10 安全与可靠性定义系统必须满足的安全/可靠性要求，安全测试由 P09 测试系统执行并记录，二者互不替代。
- 用户体验维度纳入门禁：`.github/workflows/ci.yml` 的 `frontend` job 含 `bun run design:tokens:check`、`bun run verify:contrast`、`bun run lint:design:strict`（T1–T16 令牌门禁）、`bun run test:visual`、`bun run components:registry:check`、`bun run copyright:check`，基线为 `docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md`。
- 环境与工具链基线：`.uap/state/BASELINE.json` 记录 Go `go1.27.4`、Node `v22.22.2`、Bun `1.4.2`、Python `3.13.12` 与 9 个 CI workflow，其 `real_gate_commands` 固定全量门禁命令清单；`docs/ai-specs/` 与 `uaes/standards/` 已于 2026-11-12 退役，不作为质量规范来源。
- `AGENTS.md` 的「Verification Evidence」把「禁止空话」写成硬规则：报告须写明可复制的命令原文、退出码、pass/fail 计数、失败测试名、改动文件清单、已知失败或跳过项；「已检查 / tests passed / looks correct」视为未完成工作。

## 执行流程
1. `uap-orchestrator`（`.uap/runtime/agent-runtime/index.mjs`，权限 `project_read/task_create/task_dispatch/evidence_write`）按 `.uap/config/workflow-registry.yaml` 的 `uap-quality-gate` / `uap-final-verification` 发起，先 `inspect_project` 读取 `AGENTS.md`、`web/AGENTS.md`、`.uap/state/BASELINE.json` 与本次 `changed_files`。
2. Orchestrator 经 `.uap/runtime/_lib/yaml.mjs` 加载 `.uap/config/specification-registry.yaml`、`execution-mapping.yaml`、`validator-registry.yaml`，解析 UAP-05-001~004 四项能力与依赖顺序，计算影响范围（`scope`）。
3. `quality.engineering` 执行器（`.uap/engines/testing/index.mjs`）按修改风险选择单元 / 集成 / 端到端 / 回归测试集合，写入 `scope` 与 `acceptance_criteria` 到任务上下文。
4. 依次调用 `./scripts/verify-all.sh`、`make test`、`cd web && bun run test`、`go test -race -count=1 ./service/... ./relay/... ./middleware/... ./model/...`，每条命令记录原文、退出码、耗时与输出（对齐 `AGENTS.md` Verification Evidence 的四项证据要求）。
5. 结果由 `.uap/runtime/_lib/contract.mjs` 的 `executorResult()` 归一化，`validation_results` 只允许由独立验证器回填，执行器禁止自行声明通过（`assertExecutorResult()` 强制为空）。
6. 生成证据 `UAP-EVD-...` 落盘 `.uap/evidence/`，记录命令、退出码、时间、环境、输入、输出与日志引用，索引追加到 `.uap/reports/EVIDENCE-INDEX.md`。
7. `quality.engineering_integrity` 验证器（`.uap/validators/quality/index.mjs`）执行 `review_engine` / `test_engine` / `repair_engine` / `gates` 四项检查，返回 `validatorResult()`。
8. 仅当 `executed=true && exit_code=0` 且无 `severity=BLOCKER` findings 时质量状态记为可用；否则 fail-closed 记 BLOCKED，交由 `uap-defect-repair` 修复后复验，并保留失败证据。

## 对应执行器
- 执行器 ID：`quality.engineering`
- 实现路径：`.uap/engines/testing/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：按 `.uap/config/agent-registry.yaml` 的 `uap-test-agent` 与 `.uap/config/permission-policy.yaml`，需 `project_read`（读取规范/配置/代码）、`local_command`（执行 `./scripts/verify-all.sh`、`make test` 等已批准命令，受 `require_command_logging: true` 与 `forbid_secret_exfiltration: true` 约束）、`test_environment`（`isolated_environment_only: true`）、`evidence_write`；受 `enforcement.check_before_action: true`、`fail_closed: true`、`default_effect: deny` 约束，`quality_gate_disable` / `test_deletion_to_force_pass` 对本执行器一律 deny。

## 对应验证器
- 验证器 ID：`quality.engineering_integrity`
- 实现路径：`.uap/validators/quality/index.mjs`
- 检查项：`[review_engine, test_engine, repair_engine, gates]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `task_id` | 任务唯一 ID，来自 `.uap/config/execution-mapping.yaml` 的 `execution_contract.required_input` |
| 输入 | `specification_ids` | 本次执行关联的规范 ID 列表（UAP-05-001~004） |
| 输入 | `scope` / `changed_files` | 影响范围与变更文件清单，用于选择测试集合 |
| 输入 | `constraints` | 权限组、超时、禁改动清单、fail-closed |
| 输入 | `acceptance_criteria` | 四项能力均运行、工作流可执行、结果可追溯 |
| 输入 | `ctx` | Runtime 上下文，含 `.uap/state/BASELINE.json` 的 toolchain 快照 |
| 输出 | `executorResult` | 由 `.uap/runtime/_lib/contract.mjs` 的 `executorResult()` 归一化的结构化结果 |
| 输出 | `status` / `summary` / `changed_files` | 执行状态、摘要、变更文件清单 |
| 输出 | `validation_results` | 由独立验证器回填，执行器禁止自行声明 |
| 输出 | `evidence_refs` | 指向 `.uap/evidence/` 的证据 ID 列表 |
| 输出 | `blocked_reasons` | 阻断原因列表（失败分类结果） |
| 输出 | `quality_report` | 汇总全部门禁结果与覆盖率结果的质量报告 |

## 失败处理
按 `.uap/config/execution-mapping.yaml` 的 `execution.failure_policy` 与 `.uap/config/permission-policy.yaml` 的 `enforcement.fail_closed: true`（`default_effect: deny`）逐类处置：
1. **permission_denied**：`execute(task, ctx)` 前由 policy-engine 校验 `project_read/local_command/test_environment/evidence_write`，缺失即拒绝动作、记录 `log_denied_actions` 审计事件，处置策略 `block`，任务由 RUNNING 迁移为 BLOCKED，不重试、不绕过。
2. **missing_dependency**：`executor_entries` 路径不存在、模块无法 `import()`、`health()` 缺失，或 `specification-registry.yaml` 中 UAP-05-001 的依赖 UAP-04-002 不可解析时，处置策略 `block`，任务迁移 BLOCKED 并写入 `blocked_reasons`，补齐后由 Orchestrator 重新排队（QUEUED）。
3. **validation_failed**：独立验证器返回 FAIL / NOT_EXECUTED 或含 `severity=BLOCKER` findings（例如 `review_engine` / `gates` 检查未通过）时，处置策略 `repair_then_revalidate`，交由 `uap-defect-repair` 工作流修复后复验；未复验通过不得标记 SUCCEEDED。
4. **retryable**：处置策略 `bounded_retry`，重试上限 **3 次**（`.uap/config/execution-mapping.yaml` 的 `max_repair_attempts_per_root_cause: 3`），退避采用指数退避（第 n 次等待 base × 2^(n-1)，base=1s，上限 8s，附随机抖动）；每次重试写入独立证据；恢复执行须校验 `task_id` 幂等，禁止重放非幂等副作用。
5. **unrecoverable**：处置策略 `fail`，任务迁移 FAILED 并保留全部失败证据；按 `.uap/runtime/_lib/contract.mjs` 的 `TASK_TRANSITIONS`，FAILED 仅允许 → QUEUED / BLOCKED / CANCELLED，禁止重置状态隐藏失败。
全局 fail-closed：任何策略判定异常、验证器缺失（`fail_if_validator_missing: true`）、命令非零退出或证据缺失（`fail_if_evidence_missing: true`）时，结果一律按 BLOCKED / FAIL 处理，绝不降级为 PASS；禁止通过 `quality_gate_disable` 或删除失败证据制造通过结果。

## 验收条件
> 基线原文：四项能力均真实运行；能够执行完整质量工作流；质量结果可以追溯；关键业务路径有自动化验证。

1. 四项能力均真实运行
2. 能够执行完整质量工作流
3. 质量结果可以追溯
4. 关键业务路径有自动化验证。

## 证据要求
- 证据统一落盘到 `.uap/evidence/`，索引写入 `.uap/reports/EVIDENCE-INDEX.md`；证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EVD')` 生成稳定唯一 ID（格式 `UAP-EVD-<时间戳>-<随机>`），禁止与历史证据复用。
- 每条证据必须记录：执行命令原文（如 `./scripts/verify-all.sh`、`GOWORK=off go vet ./...`、`make test`、`go test -race -count=1 ./service/... ./relay/... ./middleware/... ./model/...`、`cd web && bun run test`）、`exit_code`、开始/结束时间（ISO 8601）、耗时、环境（取自 `.uap/state/BASELINE.json` 的 `toolchain`：Go `go1.27.4` / Node `v22.22.2` / Bun `1.4.2`）、输入（`task_id` / `specification_ids` / `scope` / `constraints`）、输出（`executorResult` 或 `validatorResult` 全文、失败测试名与 pass/fail 计数）以及日志引用路径（如 `coverage.out`、`scripts/verify-all.sh` 汇总表）。
- 验证结果由 `.uap/runtime/_lib/contract.mjs` 的 `validatorResult()` 归一化为 `{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；`PASS` 仅在 `executed=true && exit_code=0` 且 `findings` 无 `severity=BLOCKER` 时成立。
- 报告必须能经 `evidence_refs` 反查到 `.uap/evidence/` 下的原始记录；`.uap/config/validator-registry.yaml` 的 `validation_policy.fail_if_evidence_missing: true` 强制证据存在；`AGENTS.md` Verification Evidence 要求报告列出改动文件与已知失败/跳过项，未运行的门禁必须标注 unverified。
- **证据不可覆盖**：新结果写入新证据文件，禁止覆盖历史记录；`persist_task_state: true` 保证状态持久化。**失败证据不可删除**：BLOCKED / FAILED / NOT_EXECUTED 的证据必须保留，禁止以删除失败证据制造通过结果；状态迁移受 `TASK_TRANSITIONS` 约束。

## 依赖标准
- **UAP-04-002（自动代码审查规范，`.uap/development/UAP-04-002-CODE-REVIEW.md`）**：提供「每次变更自动审查正确性/安全性/性能/兼容性/业务逻辑」「每个发现含严重程度、文件位置、根因和建议」「严重问题阻断质量门禁」「修复后重新审查」「审查结果保存证据」能力，是质量工程四项能力中「代码审查」一侧的上游，并为 `uap-quality-gate` 的 `code_review` 步骤与 `review_engine` 检查提供输入。
