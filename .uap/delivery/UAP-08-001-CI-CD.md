# UAP-08-001 — CI/CD 规范

**编号：** UAP-08-001
**标准编号：** UAP-08-001
**名称：** CI/CD 规范
**版本：** 1.0.0
**状态：** ACTIVE
**适用范围：** 约束 Uter 仓库全部 CI 工作流与本地等效验证，覆盖 `.github/workflows/ci.yml`、`release-gate.yml`、`weekly-security-audit.yml`、`nightly-full-audit.yml`、`release.yml`、`docker-build.yml`，以及 `scripts/verify-all.sh`、`scripts/quality/uter-quality.sh`、`scripts/verify-docs-artifacts.sh`、`Makefile` 与 `web/package.json` 的门禁命令。UAP 本地执行采取 `execution.mode: local`、`branch_policy: no_branch_creation`、`dry_run_for_production: true`，生产发布默认禁止自动执行。
**关键级别：** P0
**依赖标准：** UAP-05-004

## 规范目标
本规范把 Uter 的代码检查、类型检查、测试、构建与安全扫描固化为真实命令、真实退出码的 CI 步骤，要求 CI 失败能阻断后续发布、本地存在等效全量验证、构建产物可追溯，并生成 CI 验证报告。目标是使 `.github/workflows/` 的每条 job 都能映射到 `specification-registry.yaml` / `validator-registry.yaml` 的机器对象，杜绝以跳过工作流步骤或口头宣称「应该能通过 CI」伪造通过结果。

## 强制性要求
1. CI 必须执行代码检查、类型检查、测试、构建和安全扫描。
2. 检查必须使用真实命令和真实退出码。
3. CI 失败必须能够阻断后续发布步骤。
4. CI 配置必须纳入版本管理。
5. 必须区分本地验证、CI 验证和部署验证。
6. 依赖缓存不得导致错误地复用过期产物。
7. 构建产物必须可追溯。
8. 不得通过跳过工作流步骤伪造通过。
9. 必须检查必要的环境变量是否存在，但不得输出密钥。
10. 本次 UAP 建设不得擅自触发生产发布。
11. 必须支持本地全量验证。
12. 必须生成 CI 验证报告。

## Uter 落地细则
- CI 主配置 `.github/workflows/ci.yml` 真实包含 **7 个 job**：`ueqe-review`（`UEQE review engine (all modules)`）、`backend`（`Backend vet, build, and test`）、`race`（`Backend race detector`）、`coverage`（`Backend coverage report`）、`vulnscan`（`Go dependency vulnerability scan`）、`desktop`（`Electron desktop secret persistence`）、`frontend`（`Frontend typecheck, tests, lint and production build`）；`concurrency.group: ci-${{ github.workflow }}-${{ github.ref }}` 与 `cancel-in-progress: true` 纳入版本管理（强制性要求第 4 条）。
- `backend` job 的真实命令链：`gofmt -l $(git ls-files '*.go')`、`golangci-lint v2.15.0`（`only-new-issues: true`，聚合 gofmt/govet/ineffassign/unused/staticcheck，只拦新增问题、存量 121 项基线不阻断）、`go vet ./...`（root / relaykit / tokenkit / tokenkit/tokenkit 四模块）、`go build ./...`（同四模块）、`make test`；`env.GOWORK: 'off'`，`setup-go` 的 `cache-dependency-path` 明确列出 `go.sum`、`relaykit/go.sum`、`tokenkit/go.sum`、`tokenkit/tokenkit/go.sum` 四个锁文件，防止缓存复用过期产物（强制性要求第 6 条）。
- `race` job 跑 `go test -race -count=1 ./service/... ./relay/... ./middleware/... ./model/...`、`go test -race -count=1 ./e2e/...`，并对 relaykit / tokenkit / tokenkit/tokenkit 分别 `GOWORK=off go test -race -count=1 ./...`；`-count=1` 禁用测试结果缓存。
- `coverage` job 用 `go tool cover -func=coverage.out | tail -1` 输出摘要，并用 `./scripts/coverage-gate.sh coverage.out "$(go list -m)" controller=39 model=45 service=43 middleware=62` 对关键路径设下限；产物经 `actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9` 上传为 `go-coverage`、`retention-days: 14`，实现构建/测试产物可追溯（强制性要求第 7 条）。
- `vulnscan` job 固定 `go install golang.org/x/vuln/cmd/govulncheck@v1.9.0`（注释说明此前 `@latest` + PATH 未导出导致扫描从未真正执行），把 `$(go env GOPATH)/bin` 写入 `$GITHUB_ENV` 后对 root / relaykit / tokenkit / tokenkit/tokenkit 四个 `go.mod` 分别执行 `govulncheck ./...`；`weekly-security-audit.yml` 的 `vulnerabilities` / `secrets`（gitleaks）/ `workflow-permissions` / `report` 与 `nightly-full-audit.yml` 的 `quality-gate` / `coverage` / `secrets` / `report` 为周期安全层。
- `ueqe-review` job 执行 `bash scripts/quality/uter-quality.sh review`；`desktop` job 执行 `node --check main.js` 与 `node --test desktop-secrets.test.js`，校验 `electron/` 的 `SESSION_SECRET` / `CRYPTO_SECRET` 跨重启稳定；`frontend` job 前置 `python3 -m py_compile scripts/docs-sync/sync-upstream-docs.py` 与 `python3 scripts/docs-sync/test_sync_upstream_docs.py`。
- `frontend` job 的真实命令链（全部 `working-directory: web`）：`bun install --frozen-lockfile` → `bun run typecheck` → `bun run test` → `bun run lint` → `bun run design:tokens:check` → `bun run verify:contrast` → `bun run lint:design:strict` → `bunx playwright install chromium` → `bun run test:visual` → `bun run components:registry:check` → `bun run copyright:check` → `bun run build:check`；`setup-bun` 固定 `bun-version: '1.4.0'`。注释明确 `format:check` 因根目录递归 oxfmt 存在 248 个存量不合规文件**不设为必需**，不得据此宣称格式已验收。
- 本地等效全量验证入口 `./scripts/verify-all.sh [--quick]`：`scripts/verify-all.sh` 第 15 行定义退出码语义 `0 = 全部通过；1 = 至少一个门禁失败；2 = 环境不满足（命令缺失）`；第 208–211 行明确 **全量模式（`QUICK=0`）只要存在任一 `SKIPPED > 0` 即打印「全量门禁不完整」并 `exit 2`**，`--quick` 仅作非权威的开发便利（第 213–216 行）。全量步骤覆盖 Go 格式、`GOWORK=off go vet ./...`（四模块）、`make test`、前端 typecheck/lint/lint:design:strict/copyright:check/format:check/test/build:check、`scripts/verify-docs-artifacts.sh` 原生文档产物完整性与 `scripts/quality/uter-quality.sh security` 安全扫描。
- Go `//go:embed` 前置产物必须齐备：CI 后端作业调用 `./scripts/make-frontend-placeholder.sh`，本地 `verify-all.sh` 调用 `scripts/quality/ensure-go-embed-artifacts.sh`（仅在缺失时补空 `web/dist/index.html`，不覆盖已有真实产物）；`build:check` 会清空并重建 `web/dist`，随后由 `scripts/verify-docs-artifacts.sh "$ROOT/web/dist"` 把「缺产物」变成硬失败，保证产物可追溯。
- 发布阻断链（强制性要求第 3 条）：`.github/workflows/release.yml` 的 `gate` job 用 `uses: ./.github/workflows/release-gate.yml`，`linux` / `macos` / `windows` 三个 job 均声明 `needs: gate`，注释写明「任何一项失败，下面的 linux/macos/windows 作业都不会启动」；`docker-build.yml` 的 `build_single_arch` / `create_manifests` 同样依赖 `gate`。`release-gate.yml` 是可复用工作流（`on: workflow_call` / `workflow_dispatch`），含 `backend` / `vulnscan` / `desktop` / `frontend` 四个 job。
- 环境与密钥边界（强制性要求第 9 条）：CI 显式 `env.GOWORK: 'off'`、`bun-version: '1.4.0'`、四个 `go.sum` 锁文件清单；`.uap/config/permission-policy.yaml` 的 `secret_export: deny`、`local_command.forbid_secret_exfiltration: true`、`enforcement.redact_secrets: true` 与 `AGENTS.md` Change Protection「never stage secrets or local state」（`.env`、`*.db` / `-shm` / `-wal`、`logs/`、构建产物）共同禁止在日志/报告/提交中输出密钥；环境变量存在性只检查「是否存在」，不输出值。
- 本地 / CI / 部署验证三分（强制性要求第 5 条）：本地为 `./scripts/verify-all.sh` 与 `web/package.json` 脚本；CI 为 `.github/workflows/ci.yml` 等版本化工作流；部署验证为 `release-gate.yml` / `release.yml` / `docker-build.yml` 的门禁与产物。`.uap/config/execution-mapping.yaml` 固定 `execution.mode: local`、`default_environment: local`、`dry_run_for_production: true`、`branch_policy: no_branch_creation`；`permission-policy.yaml` 的 `production_deploy: deny`（reason: `Explicit production authorization required`）与 `production_write: deny` 使「本次 UAP 建设不得擅自触发生产发布」成为机器策略（强制性要求第 10 条）。
- 工具链与命令清单由 `.uap/state/BASELINE.json` 固化：`project.ci_workflows` 列出 9 个工作流，`real_gate_commands` 列出 `./scripts/verify-all.sh [--quick]`、`gofmt -l .`、`GOWORK=off go vet ./...`、`make test` 及 7 条 `cd web && bun run ...`；`toolchain` 记录 Go `go1.27.4` / Node `v22.22.2` / Bun `1.4.2`，作为 CI 验证报告的环境字段。
- `AGENTS.md` §Automated Quality Gates 规定「Never substitute manual inspection for a gate that already exists」「The same set runs in CI (`.github/workflows/ci.yml` and `release-gate.yml`). "It should pass CI" is not a claim — run it.」；§Verification Evidence 要求报告写明可复制命令、实际退出码与 pass/fail 计数、变更文件路径、已知失败或跳过项，作为 CI 验证报告（强制性要求第 12 条）的最低内容。

## 执行流程
1. `uap-orchestrator`（`.uap/runtime/agent-runtime/index.mjs`，权限 `project_read/task_create/task_dispatch/evidence_write`）读取 `specification-registry.yaml`，确认 `UAP-08-001` 的依赖 `UAP-05-004` 已满足，按 DAG 顺序创建结构化任务（`task_id` / `specification_ids` / `scope` / `constraints` / `acceptance_criteria`）。
2. Orchestrator 经 `.uap/runtime/_lib/yaml.mjs` 加载 `execution-mapping.yaml`，解析 `delivery.ci_cd` → `.uap/engines/delivery/index.mjs`，动态 `import()` 并调用 `health(ctx)`；不可导入或 `health()` 缺失写入 `blocked_reasons`。
3. 执行器用 `util.mjs` 的 `readText()` / `listFiles()` 解析 `.github/workflows/ci.yml`、`release-gate.yml`、`release.yml`、`docker-build.yml`、`weekly-security-audit.yml`、`nightly-full-audit.yml`，提取 7 个 CI job 名、各 step 的真实命令、`needs:` 依赖与 `uses:` 复用关系，生成 `pipeline_config` 清单。
4. 执行器按 `local_command` 权限在仓库根运行 `./scripts/verify-all.sh`（不带 `--quick`，全量），逐项记录每条 step 的命令原文、退出码、耗时、stdout/stderr 摘要；若脚本以 `exit 2` 结束（存在 SKIP 或环境缺失），整轮记为失败并保留 SKIP 明细，不得用 `--quick` 的 `exit 0` 替代。
5. 执行器补跑 CI 特有项并核对一致性：`gofmt -l .`、`GOWORK=off go vet ./...`、`make test`、`cd web && bun run typecheck|lint|test|lint:design:strict|copyright:check|format:check|build:check`，与 `ci.yml` 各 job 命令逐条比对，产出 `local_equivalent` 对照表；同时核对 `bun install --frozen-lockfile`、四个 `go.sum` 缓存键、`govulncheck@v1.9.0` 版本 pin。
6. 执行器验证 `failure_propagation`：确认 `release.yml` 的 `linux` / `macos` / `windows` 均 `needs: gate`、`docker-build.yml` 依赖 `gate`；核对环境变量清单存在但无任何密钥明文出现在输出（用 `util.mjs` 的 `redact()` 处理日志）。
7. 执行器生成 CI 验证报告（命令清单、job 映射、退出码汇总、产物引用如 `go-coverage` artifact、`web/dist` 与 `coverage.out`、已知失败/跳过项），用 `contract.mjs` 的 `executorResult()` 归一化输出；证据写入 `.uap/evidence/`（`newId('UAP-EVD')`），记录命令、退出码、ISO 8601 时间、环境（`.uap/state/BASELINE.json`）、输入输出与日志引用，索引追加 `.uap/reports/EVIDENCE-INDEX.md`。
8. `delivery.ci_integrity` 验证器（`.uap/validators/delivery/index.mjs`）执行 `pipeline_config` / `local_equivalent` / `failure_propagation` 并返回 `validatorResult()`；仅当 `executed=true && exit_code=0` 且 findings 无 `severity=BLOCKER` 时判 PASS，否则 fail-closed 记为 BLOCKED/FAIL 并保留失败证据。

## 对应执行器
- 执行器 ID：`delivery.ci_cd`
- 实现路径：`.uap/engines/delivery/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：按 `.uap/config/agent-registry.yaml` 的 `uap-delivery-agent`（`[project_read, local_command, test_environment, evidence_write]`，tools `delivery_engine` / `build_adapter`）与 `.uap/config/permission-policy.yaml` 执行：需要 `project_read`（读工作流/脚本/配置）、`local_command`（`require_command_logging: true`、`forbid_secret_exfiltration: true`）、`test_environment`（`isolated_environment_only: true`）、`evidence_write`。`production_deploy` / `production_write` / `production_read` / `secret_export` / `force_push` / `branch_creation` / `branch_switch` / `destructive_git` / `quality_gate_disable` / `test_deletion_to_force_pass` 一律 `deny`（`production_deploy` 的 reason 为 `Explicit production authorization required`）；受 `enforcement.check_before_action: true`、`log_denied_actions: true`、`redact_secrets: true`、`fail_closed: true`、`default_effect: deny` 约束。

## 对应验证器
- 验证器 ID：`delivery.ci_integrity`
- 实现路径：`.uap/validators/delivery/index.mjs`
- 检查项：`[pipeline_config, local_equivalent, failure_propagation]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `task_id` | 任务唯一 ID，来自 `execution-mapping.yaml` 的 `execution_contract.required_input` |
| 输入 | `specification_ids` | 关联规范 ID：`[UAP-08-001]` 及依赖 `UAP-05-004` |
| 输入 | `scope` | 范围：`.github/workflows/*.yml`、`scripts/verify-all.sh`、`scripts/quality/uter-quality.sh`、`web/package.json` |
| 输入 | `environment_manifest` | 环境清单：`GOWORK=off`、Bun `1.4.0`、四个 `go.sum` 缓存键、`govulncheck@v1.9.0`（仅检查存在性，不含密钥值） |
| 输入 | `constraints` | 约束：真实命令与退出码、全量不得 SKIP、不触发生产发布、不输出密钥、fail-closed |
| 输入 | `acceptance_criteria` | 验收标准：CI 工作流可解析、本地等效验证可执行、失败能够阻断、构建和测试证据完整 |
| 输出 | `executorResult` | 由 `contract.mjs` 的 `executorResult()` 归一化的结构化执行结果 |
| 输出 | `status` / `summary` / `changed_files` | 执行状态、摘要、变更文件清单 |
| 输出 | `pipeline_config` | 7 个 CI job 与各 step 真实命令、`needs:` / `uses:` 关系清单 |
| 输出 | `local_equivalent` | 本地 `verify-all.sh` 全量结果与 CI 各 job 命令的逐条对照表 |
| 输出 | `validation_results` | 由 `delivery.ci_integrity` 独立回填的三类检查结果 |
| 输出 | `ci_report` | CI 验证报告：退出码汇总、产物引用、已知失败/跳过项 |
| 输出 | `evidence_refs` | 指向 `.uap/evidence/` 的证据 ID 列表 |
| 输出 | `blocked_reasons` | 阻断原因（含全量 `exit 2` 的 SKIP 明细） |
| 输出 | `validatorResult` | `validatorResult()` 返回的机器可读判定 |

## 失败处理
按 `.uap/config/execution-mapping.yaml` 的 `execution.failure_policy` 与 `.uap/config/permission-policy.yaml` 的 `enforcement.fail_closed: true`（`default_effect: deny`）逐类处置：
1. **permission_denied**：执行前由 `.uap/runtime/policy-engine/index.mjs` 校验权限组；若任务试图触发 `production_deploy`（`deny`，需显式生产授权）、导出密钥或关闭门禁，立即拒绝并记录 `log_denied_actions`，处置策略 `block`，任务由 RUNNING 迁移为 BLOCKED，不重试、不绕过。
2. **missing_dependency**：`.uap/engines/delivery/index.mjs` 无法导入、`health()` 缺失、依赖 `UAP-05-004` 未满足、`go` / `bun` 命令缺失（`verify-all.sh` 的 `MISSING` 检查）、`govulncheck` / `gitleaks` 缺失或 `.github/workflows/ci.yml` 不可解析时，处置策略 `block`，任务迁移 BLOCKED 并写入 `blocked_reasons`，补齐后由 Orchestrator 重新排队（QUEUED）。
3. **validation_failed**：任一门禁真实命令非零退出（脚本 `exit 1`）、全量模式因 SKIP `exit 2`、`pipeline_config` / `local_equivalent` / `failure_propagation` 检查失败（如 `needs: gate` 缺失、步骤被跳过伪造通过、findings 含 `severity=BLOCKER`）时，处置策略 `repair_then_revalidate`，交 `uap-defect-repair` 修复后复验；未复验通过不得标记 SUCCEEDED，且不得通过 `--quick` 或临时关闭门禁制造通过。
4. **retryable**：处置策略 `bounded_retry`，重试上限 **3 次**（`execution.max_repair_attempts_per_root_cause: 3`），退避采用指数退避（第 n 次等待 `base × 2^(n-1)`，base=1s，上限 8s，附随机抖动）；每次重试写入独立证据；恢复执行须校验 `task_id` / `result_id` 幂等，禁止重放非幂等副作用（尤其禁止重复执行 `build:check` 清空 `web/dist` 造成产物与证据不一致）。
5. **unrecoverable**：处置策略 `fail`，任务迁移 FAILED 并保留全部失败证据；按 `contract.mjs` 的 `TASK_TRANSITIONS`，FAILED 仅允许 → QUEUED / BLOCKED / CANCELLED，禁止重置状态隐藏失败，禁止删除失败记录或失败测试制造通过。
全局 fail-closed：验证器缺失（`fail_if_validator_missing: true`）、验证器不可执行（`fail_if_validator_not_executable: true`）、证据缺失（`fail_if_evidence_missing: true`）或必需检查被跳过（`fail_if_required_check_skipped: true`）时，结果一律按 BLOCKED / FAIL 处理，绝不降级为 PASS；`allow_explicit_blocked_status: true` 只允许显式声明 BLOCKED，不允许隐式跳过工作流步骤。

## 验收条件
1. CI 工作流可解析。
2. 本地等效验证可执行。
3. 失败能够阻断。
4. 构建和测试证据完整。

## 证据要求
- 证据统一落盘到 `.uap/evidence/`，索引写入 `.uap/reports/EVIDENCE-INDEX.md`；证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EVD')` 生成稳定唯一 ID（格式 `UAP-EVD-<时间戳>-<随机>`），禁止与历史证据复用；落盘使用 `writeEvidence()` / `appendJSONL()`，敏感文本经 `redact()` 处理。
- 每条证据必须记录：执行命令原文（如 `./scripts/verify-all.sh`、`gofmt -l .`、`GOWORK=off go vet ./...`、`make test`、`cd web && bun run typecheck|lint|test|lint:design:strict|copyright:check|format:check|build:check`）、`exit_code`、开始/结束时间（ISO 8601，由 `nowISO()` 生成）、环境（取自 `.uap/state/BASELINE.json` 的 toolchain：Go `go1.27.4` / Node `v22.22.2` / Bun `1.4.2` 与 9 个 `ci_workflows`）、输入（`task_id` / `specification_ids` / `environment_manifest` / `constraints`）、输出（`executorResult` 或 `validatorResult` 全文）以及日志引用路径（CI job 名/step 名、`coverage.out`、`web/dist`、`go-coverage` artifact）。
- CI 验证报告必须逐项列出 7 个 job 的映射命令与实际退出码、全量 `verify-all.sh` 的 PASS/FAIL/SKIP 计数、`exit 2` 时的 SKIP 明细、以及 `needs: gate` 阻断链核对结果；`AGENTS.md` Verification Evidence 要求已知失败或跳过项不得省略、不得四舍五入。
- 验证结果由 `contract.mjs` 的 `validatorResult()` 归一化为 `{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；`PASS` 仅在 `executed=true && exit_code=0` 且 findings 无 `severity=BLOCKER` 时成立；任何 SKIP / NOT_EXECUTED 必须原样记录，不得改写为 PASS；`validator-registry.yaml` 的 `fail_if_evidence_missing: true` 强制证据存在。
- **证据不可覆盖**：新结果写入新证据文件，禁止覆盖历史记录；`execution.persist_task_state: true` 保证状态持久化。**失败证据不可删除**：BLOCKED / FAILED / NOT_EXECUTED / 全量 `exit 2` 的证据必须保留，禁止以删除失败证据、删除失败测试或跳过工作流步骤制造通过结果；报告须能经 `evidence_refs` 反查原始记录；状态迁移受 `TASK_TRANSITIONS` 约束。

## 依赖标准
- **UAP-05-004（质量门禁规范）**：`.uap/config/specification-registry.yaml` 中 `UAP-08-001` 的 `dependencies: [UAP-05-004]`。它要求全部门禁机器可执行、定义输入/执行器/阈值/失败条件/证据、门禁配置版本控制、支持单项与全量执行、最终发布检查汇总全部门禁结果，并规定豁免必须有范围/理由/期限/证据且不得由被审查任务自行创建。本规范据此把 `.github/workflows/ci.yml` 的 7 个 job 与 `./scripts/verify-all.sh` 全量模式视为同一套门禁的 CI 侧与本地侧实现，并据此判定 `pipeline_config`、`local_equivalent` 与 `failure_propagation`（CI 失败阻断 `release.yml` 的 `needs: gate` 链）；没有该依赖，门禁阈值、阻断语义与豁免边界都无法机器化。
