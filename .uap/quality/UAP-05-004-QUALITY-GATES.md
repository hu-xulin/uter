# UAP-05-004 — 质量门禁规范

**编号：** UAP-05-004
**标准编号：** UAP-05-004
**名称：** 质量门禁规范
**版本：** 1.0.0
**状态：** ACTIVE
**适用范围：** 约束 Uter 全部机器可执行门禁：本地 `./scripts/verify-all.sh`、`scripts/coverage-gate.sh`、`.github/workflows/ci.yml`（7 个 job）、`.github/workflows/release-gate.yml`（发布前门禁）、`.github/workflows/weekly-security-audit.yml`（周期安全门禁）与 `web/` 的 `bun run typecheck|lint|test|lint:design:strict|copyright:check|build:check`；机器配置登记于 `.uap/config/workflow-registry.yaml` 的 `uap-quality-gate` 与 `uap-final-verification`。
**关键级别：** P0
**依赖标准：** UAP-05-001、UAP-05-002、UAP-05-003

## 规范目标
本规范把 Uter 散落在 `Makefile`、`web/package.json`、CI workflow 与 `scripts/` 中的检查收敛为「输入、执行器、阈值、失败条件、证据」五要素齐全的版本化门禁，确保阻断级问题真实失败、全量门禁可执行、豁免可审计且不能由被审查任务自建。任何 `SKIP` 在全量模式下必须导致 `exit 2`，任何非零退出必须按 `AGENTS.md` Automated Quality Gates 视为停止条件而非警告，最终发布检查必须汇总全部门禁结果并留痕。

## 强制性要求
1. 所有质量门禁必须机器可执行。
2. 门禁必须定义输入、执行器、阈值、失败条件和证据。
3. 阻断级问题必须失败。
4. 高风险业务变更必须执行额外测试。
5. 构建、类型检查、Lint、测试和安全检查必须纳入门禁。
6. 门禁配置必须版本控制。
7. 禁止未经审计临时关闭门禁。
8. 门禁失败必须产生明确原因。
9. 豁免必须有范围、理由、期限和证据。
10. 豁免不能由被审查任务自行创建。
11. 所有门禁必须支持单项和全量执行。
12. 最终发布检查必须汇总全部门禁结果。

## Uter 落地细则
- 门禁的机器定义是 `.uap/config/workflow-registry.yaml` 的 `uap-quality-gate`：`lint → typecheck → unit_tests → integration_tests → end_to_end_tests → security_scan → dependency_scan → build → code_review`，`acceptance: all_required_gates_pass`；`uap-final-verification` 的 `run_full_quality_gate` / `generate_final_report` / `acceptance: full_operational_acceptance` 负责汇总。
- 本地全量门禁唯一入口 `./scripts/verify-all.sh`（真实脚本 `scripts/verify-all.sh`）定义退出码语义：`0 = 全部通过`、`1 = 至少一个门禁失败`、`2 = 环境不满足（命令缺失）`；全量模式存在任一 `SKIP` 即 `exit 2`（`scripts/verify-all.sh:208-211`），并回显「失败项复现命令」清单（`scripts/verify-all.sh:184-194`）。
- 门禁五要素的真实取值：`scripts/coverage-gate.sh` 以 `./scripts/coverage-gate.sh coverage.out "$(go list -m)" controller=39 model=45 service=43 middleware=62` 定义关键路径覆盖率阈值（基线 controller 41.6% / model 47.7% / service 45.7% / middleware 66.4%，各留约 2 个点），输入为 `coverage.out`，失败条件为低于阈值，证据为 `go tool cover -func=coverage.out` 输出与上传的 `go-coverage` artifact。
- 构建、类型检查、Lint、测试、安全检查纳入门禁的真实命令集，见 `.uap/state/BASELINE.json` 的 `real_gate_commands`：`gofmt -l .`、`GOWORK=off go vet ./...`（含 `relaykit` / `tokenkit` / `tokenkit/tokenkit`）、`make test`、`cd web && bun run typecheck|lint|test|lint:design:strict|copyright:check|format:check|build:check`。
- CI 侧 7 个 job 逐一落地：`.github/workflows/ci.yml` 的 `ueqe-review`（`bash scripts/quality/uter-quality.sh review`）、`backend`（gofmt / golangci-lint v2 / `go vet` / `go build` / `make test`）、`race`、`coverage`、`vulnscan`、`desktop`、`frontend`；`permissions: contents: read` 体现最小权限。
- 高风险业务变更的额外测试：`go test -race -count=1 ./service/... ./relay/... ./middleware/... ./model/...` 与 `go test -race -count=1 ./e2e/...`（组织计费全链路），以及 `controller/topup_gateway_contract_test.go` 对新增支付网关强制登记「验签 / 幂等 / 实付金额比对」三件套的结构性断言；`AGENTS.md` Billing safety invariants 要求计费改动在边界处补回归测试。
- 阻断级问题必须失败：`AGENTS.md` Automated Quality Gates「Never substitute manual inspection for a gate that already exists, and never declare work done while an applicable gate is red. Non-zero exit is a stop condition, not a warning.」；`.uap/config/validator-registry.yaml` 的 `validation_policy.fail_if_validator_not_executable: true` 与 `fail_if_required_check_skipped: true`。
- 门禁配置必须版本控制并可读：`.github/workflows/ci.yml`、`release-gate.yml`、`weekly-security-audit.yml`、`scripts/verify-all.sh`、`scripts/coverage-gate.sh`、`web/package.json` 与 `.uap/config/workflow-registry.yaml` 全部纳入仓库；`release-gate.yml` 以 `workflow_call` 被 `release.yml` / `docker-build.yml` / `electron-build.yml` 复用并设为第一个依赖作业，门禁不过则不进入构建发布。
- 禁止未经审计临时关闭门禁：`.uap/config/permission-policy.yaml` 显式 `quality_gate_disable: effect: deny`；`AGENTS.md` Design System Enforcement「never disable lint rules, weaken tests, or bypass CI to make a change pass」；`AGENTS.md` 的 P09/P10 分离由 `scripts/quality/uter-p09-p10-boundary-check.rb` 强制，防止以质量工程名义绕过安全门禁。
- 带范围、理由、期限的登记式豁免（真实范例）：`.github/workflows/ci.yml` 的 `backend` job 用 golangci-lint v2 `only-new-issues: true`，仅拦本次变更引入的问题，存量 **121 项** 为已知基线「分批清理」；`frontend` job 明确注释「格式检查（format:check）**不要**设为必需」——因根目录递归 oxfmt 涉及 `public/plugins` 第三方插件、当前 248 个文件不合规，「待格式基线统一后再纳入」，而 `scripts/verify-all.sh` 全量本地仍执行 `bun run format:check`。二者都是版本控制内、附理由与范围、非被审任务自建的登记决定。
- 门禁失败必须产生明确原因：`scripts/verify-all.sh` 的汇总表逐项打印「检查项 / 结果 / 耗时 / 退出码」并回显失败项复现命令；`.uap/config/execution-mapping.yaml` 的 `required_output.blocked_reasons` 与 `validatorResult.findings`（含 `severity`、`文件位置`、`根因`）把原因结构化；`AGENTS.md` Verification Evidence 要求报告写明失败测试名。
- 所有门禁支持单项和全量执行：单项如 `gofmt -l .`、`GOWORK=off go vet ./...`、`bun run typecheck`、`bun run lint:design:strict`、`govulncheck ./...`、`gitleaks dir . --no-banner --config .quality/gitleaks.toml`；全量为 `./scripts/verify-all.sh`（`--quick` 明确标注「非完整质量验收」）与 `.github/workflows/ci.yml` 全 job。
- 最终发布检查汇总全部门禁结果：`.github/workflows/release-gate.yml` 的 `backend / vulnscan / desktop / frontend` 四 job 跑在即将发布的 commit 上，`vulnscan` 对四个 Go 模块 `govulncheck ./...`，`weekly-security-audit.yml` 的 `report` job 用 `needs: [vulnerabilities, secrets, workflow-permissions]` 汇总三类结果到 Job Summary 并在失败时创建/更新 `quality-alert` issue。
- 不存在未登记的隐式跳过：`scripts/verify-all.sh` 的 `skip()` 必须写明原因（如「未检测到 go 命令」「--quick 模式跳过」），全量模式任意 SKIP 即 `exit 2`；设计系统视觉回归 track 1 / track 2 在浏览器或服务栈缺失时以 `BLOCKED` 非零退出（track 1 `exit 2`，track 2 经 `lib/service-gate.ts`），`AGENTS.md` 明确「`BLOCKED` means *not executed* — never report it as a pass」。

## 执行流程
1. `uap-orchestrator`（`.uap/runtime/agent-runtime/index.mjs`）按 `.uap/config/workflow-registry.yaml` 的 `uap-quality-gate` 或 `uap-final-verification` 发起，读取 `.uap/config/specification-registry.yaml` 确认 UAP-05-001 / UAP-05-002 / UAP-05-003 三项依赖状态。
2. 经 `.uap/runtime/_lib/yaml.mjs` 加载 `execution-mapping.yaml`、`validator-registry.yaml`、`permission-policy.yaml`，解析每道门禁的 `输入 / 执行器 / 阈值 / 失败条件 / 证据` 五要素与阈值（`coverage-gate.sh` 的 controller/model/service/middleware 下限）。
3. `quality.gates` 执行器（`.uap/engines/testing/index.mjs`）按 `changed_files` 判定是否高风险业务变更，决定是否追加 `go test -race -count=1 ./e2e/...` 与支付网关契约测试。
4. 依次执行 `./scripts/verify-all.sh`（全量）、`make test`、`go test -race -count=1 ./service/... ./relay/... ./middleware/... ./model/...`、`cd web && bun run typecheck|lint|test|lint:design:strict|copyright:check|build:check`、`govulncheck ./...`；逐项记录命令原文、`exit_code`、耗时、阈值比较结果。
5. 任一阻断级失败即写入 `blocked_reasons` 与 `findings`，停止后续步骤并回显复现命令；`quality_gate_disable` 请求由 policy-engine 按 `effect: deny` 拒绝并记 `log_denied_actions`。
6. 结果由 `.uap/runtime/_lib/contract.mjs` 的 `executorResult()` 归一化；生成 `UAP-EVD-...` 证据落盘 `.uap/evidence/`，索引追加 `.uap/reports/EVIDENCE-INDEX.md`；`release-gate.yml` 场景汇总全部门禁结果到发布报告。
7. `quality.gate_integrity` 验证器（`.uap/validators/quality/index.mjs`）执行 `gate_execution` / `blocking` / `bypass_detection`，检测未登记的隐式跳过与豁免篡改，返回 `validatorResult()`。
8. 仅当 `executed=true && exit_code=0`、无 SKIP（全量模式）、无 `severity=BLOCKER` findings 时判定 `all_required_gates_pass`；否则 fail-closed 记 BLOCKED / FAILED，保留失败证据并交由 `uap-defect-repair` 修复后复验。

## 对应执行器
- 执行器 ID：`quality.gates`
- 实现路径：`.uap/engines/testing/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：按 `.uap/config/agent-registry.yaml` 的 `uap-test-agent` 与 `.uap/config/permission-policy.yaml`，需 `project_read`（读取门禁配置与代码）、`local_command`（执行 `./scripts/verify-all.sh`、`scripts/coverage-gate.sh`、`govulncheck` 等已批准命令，受 `require_command_logging: true` 约束）、`test_environment`（`isolated_environment_only: true`）、`evidence_write`；受 `enforcement.check_before_action: true`、`fail_closed: true`、`default_effect: deny` 约束，`quality_gate_disable` / `test_deletion_to_force_pass` / `production_deploy` 一律 deny。

## 对应验证器
- 验证器 ID：`quality.gate_integrity`
- 实现路径：`.uap/validators/quality/index.mjs`
- 检查项：`[gate_execution, blocking, bypass_detection]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `task_id` | 任务唯一 ID，来自 `.uap/config/execution-mapping.yaml` 的 `execution_contract.required_input` |
| 输入 | `specification_ids` | 关联规范 ID（UAP-05-001~004） |
| 输入 | `scope` / `changed_files` | 影响范围与变更文件，用于判定是否追加高风险业务测试 |
| 输入 | `gate_definitions` | 每道门禁的输入、执行器、阈值、失败条件、证据五要素 |
| 输入 | `constraints` | 权限组、超时、fail-closed、禁止 `quality_gate_disable` |
| 输入 | `ctx` | Runtime 上下文，含 `.uap/state/BASELINE.json` 的 `real_gate_commands` |
| 输出 | `executorResult` | 由 `.uap/runtime/_lib/contract.mjs` 的 `executorResult()` 归一化的结构化结果 |
| 输出 | `gate_matrix` | 逐项门禁的命令原文、`exit_code`、耗时、阈值比较与 PASS/FAIL/SKIP/BLOCKED |
| 输出 | `findings` / `blocked_reasons` | 结构化发现（严重程度、文件位置、根因、建议）与阻断原因 |
| 输出 | `evidence_refs` | 指向 `.uap/evidence/` 的证据 ID 列表 |
| 输出 | `final_gate_report` | 汇总全部门禁结果的最终发布检查报告 |
| 输出 | `exemption_records` | 带范围、理由、期限、证据的豁免登记（拒绝被审任务自建） |

## 失败处理
按 `.uap/config/execution-mapping.yaml` 的 `execution.failure_policy`、`.uap/config/validator-registry.yaml` 的 `validation_policy` 与 `.uap/config/permission-policy.yaml` 的 `enforcement.fail_closed: true`（`default_effect: deny`）逐类处置：
1. **permission_denied**：`execute(task, ctx)` 前校验 `project_read/local_command/test_environment/evidence_write`，任何 `quality_gate_disable` / `test_deletion_to_force_pass` / `production_deploy` 请求即拒绝动作、记录 `log_denied_actions`，处置策略 `block`，任务由 RUNNING 迁移 BLOCKED，不重试、不绕过。
2. **missing_dependency**：`go` / `bun` / `govulncheck` / `gitleaks` 命令缺失、门禁配置不可解析或 UAP-05-001~003 依赖未满足时，处置策略 `block`，任务迁移 BLOCKED 并写入 `blocked_reasons`；`./scripts/verify-all.sh` 环境缺失返回 `exit 2`，补齐后由 Orchestrator 重新排队（QUEUED）。
3. **validation_failed**：任一门禁非零退出、覆盖率低于阈值、含 `severity=BLOCKER` findings 或 `bypass_detection` 检出未登记跳过时，处置策略 `repair_then_revalidate`，交由 `uap-defect-repair` 修复后复验；未复验通过不得标记 SUCCEEDED，禁止通过临时关闭门禁制造通过。
4. **retryable**：处置策略 `bounded_retry`，重试上限 **3 次**（`max_repair_attempts_per_root_cause: 3`），退避采用指数退避（第 n 次等待 base × 2^(n-1)，base=1s，上限 8s，附随机抖动）；每次重试写入独立证据；恢复执行须校验 `task_id` 幂等，禁止重放非幂等副作用。
5. **unrecoverable**：处置策略 `fail`，任务迁移 FAILED 并保留全部失败证据；按 `.uap/runtime/_lib/contract.mjs` 的 `TASK_TRANSITIONS`，FAILED 仅允许 → QUEUED / BLOCKED / CANCELLED，禁止重置状态隐藏失败。
全局 fail-closed：验证器缺失（`fail_if_validator_missing: true`）、验证器不可执行（`fail_if_validator_not_executable: true`）、必要检查被跳过（`fail_if_required_check_skipped: true`）、证据缺失（`fail_if_evidence_missing: true`）或全量模式存在 SKIP（`./scripts/verify-all.sh` 返回 `exit 2`）时，结果一律按 BLOCKED / FAIL 处理，绝不降级为 PASS。

## 验收条件
> 基线原文：门禁能够真实阻断失败任务；门禁结果可追溯；全量门禁可执行；不存在未登记的隐式跳过。

1. 门禁能够真实阻断失败任务
2. 门禁结果可追溯
3. 全量门禁可执行
4. 不存在未登记的隐式跳过。

## 证据要求
- 证据统一落盘到 `.uap/evidence/`，索引写入 `.uap/reports/EVIDENCE-INDEX.md`；证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EVD')` 生成稳定唯一 ID（格式 `UAP-EVD-<时间戳>-<随机>`），禁止与历史证据复用。
- 每条证据必须记录：执行命令原文（如 `./scripts/verify-all.sh`、`scripts/coverage-gate.sh coverage.out "$(go list -m)" controller=39 model=45 service=43 middleware=62`、`gofmt -l .`、`GOWORK=off go vet ./...`、`make test`、`cd web && bun run typecheck|lint|test|lint:design:strict|copyright:check|build:check`、`govulncheck ./...`）、`exit_code`、开始/结束时间（ISO 8601）、耗时、环境（取自 `.uap/state/BASELINE.json`：Go `go1.27.4` / Node `v22.22.2` / Bun `1.4.2`）、输入（`gate_definitions` / `scope` / 阈值）、输出（逐项 PASS/FAIL/SKIP/BLOCKED 汇总、`coverage.out` 数值、`executorResult` / `validatorResult` 全文）以及日志引用路径（`coverage.out`、CI Job Summary、`weekly-security-report` artifact）。
- 验证结果由 `.uap/runtime/_lib/contract.mjs` 的 `validatorResult()` 归一化为 `{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；`PASS` 仅在 `executed=true && exit_code=0`、全量模式无 SKIP 且 `findings` 无 `severity=BLOCKER` 时成立。
- 报告必须能经 `evidence_refs` 反查到 `.uap/evidence/` 下的原始记录；`.uap/config/validator-registry.yaml` 的 `validation_policy.fail_if_evidence_missing: true` 强制证据存在；`AGENTS.md` Verification Evidence 要求报告列出精确命令、退出码、pass/fail 计数、失败测试名、改动文件与已知跳过项，未运行的门禁必须标注 unverified。
- **证据不可覆盖**：新结果写入新证据文件，禁止覆盖历史记录；`persist_task_state: true` 保证状态持久化。**失败证据不可删除**：BLOCKED / FAILED / NOT_EXECUTED 的证据必须保留，禁止以删除失败证据或临时关闭门禁制造通过结果；状态迁移受 `TASK_TRANSITIONS` 约束。

## 依赖标准
- **UAP-05-001（质量工程总规范，`.uap/quality/UAP-05-001-QUALITY-ENGINEERING.md`）**：提供「质量结果必须基于真实工具执行」「不得通过降低门禁制造通过结果」「质量状态必须有证据」的总约束，并把 `uap-quality-gate` 与 `uap-final-verification` 定义为本规范门禁步骤的调度框架。
- **UAP-05-002（自动化测试规范，`.uap/quality/UAP-05-002-AUTOMATED-TESTING.md`）**：提供 `unit_tests / integration_tests / end_to_end_tests` 的可执行测试集合、命令与退出码证据，以及「测试失败不得被静默忽略」的失败传播契约，是门禁中测试类步骤的输入来源。
- **UAP-05-003（自动修复规范，`.uap/quality/UAP-05-003-AUTO-REPAIR.md`）**：提供门禁失败后的 `repair_then_revalidate` 闭环——根因分析、最多 3 次修复、回归复验与独立复审，保证 `validation_failed` 后的任务可恢复且不会通过破坏测试制造成功。
