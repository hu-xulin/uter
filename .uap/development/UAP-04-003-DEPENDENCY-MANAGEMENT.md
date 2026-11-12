# UAP-04-003 — 依赖管理规范

**编号：** UAP-04-003
**标准编号：** UAP-04-003
**名称：** 依赖管理规范
**版本：** 1.0.0
**状态：** IMPLEMENTED_NOT_VERIFIED
**适用范围：** 适用于 Uter 全部依赖：`go.mod`（`module github.com/uter-ai/uter`，`go 1.27.3`）与 `go.sum`、`relaykit/go.mod`+`relaykit/go.sum`、`tokenkit/tokenkit/go.mod` 等四个 Go 模块，`web/package.json`、`web/bun.lock`、`web/knip.jsonc`、`web/.oxlintrc.json`、`web/.oxfmtrc.json`，以及 `scripts/quality/uter-quality.sh` 的 `security` 阶段与 `.github/workflows/ci.yml` 的依赖安装/验证作业。
**关键级别：** P1
**依赖标准：** [UAP-04-001]

## 规范目标
Uter 采用 Bun 管理前端依赖（`web/bun.lock` 锁文件、`Makefile` 的 `bun install --frozen-lockfile`）与 Go modules 管理后端依赖（四个独立模块各有 `go.mod`）。本规范要求依赖用途明确、版本受锁文件约束、未使用/重复/过时依赖可识别（`knip`）、已知漏洞可扫描（`govulncheck`/`gitleaks`），禁止未经评估的全量升级或删除安全检查消除扫描结果。`development.dependency_integrity` 的 `lockfile`/`vulnerabilities`/`unused_dependencies` 检查与 UEQE 安全阶段使依赖变更必须经构建与测试验证并保存审计报告。

## 强制性要求
1. 依赖必须有明确用途。
2. 依赖版本必须受锁文件管理。
3. 必须识别未使用、重复和过时依赖。
4. 必须扫描已知安全漏洞。
5. 依赖升级必须评估兼容性。
6. 禁止未经评估自动升级全部依赖。
7. 依赖许可证必须满足项目使用要求。
8. 不得引入来源不明的二进制和脚本。
9. 依赖变更必须执行构建和测试。
10. 关键依赖必须记录替代方案。
11. 禁止通过删除安全检查来消除扫描结果。
12. 必须保存依赖审计报告。

## Uter 落地细则
- `web/bun.lock` 是前端锁文件；`Makefile` 的 `build-web` 目标与 `.github/workflows/ci.yml` 的 `Install web dependencies` 步骤均使用 `bun install --frozen-lockfile`，保证依赖版本可复现、不可静默漂移。
- `web/package.json` 声明 `dependencies`、`devDependencies` 与 `overrides`（如 `brace-expansion: 2.1.7`、`decode-uri-component: 0.5.1`、`dompurify: 3.4.17`、`follow-redirects: ^1.16.1`、`zod: 4.6.7`），`overrides` 用于收敛传递依赖版本；版本统一用 `^`/`~` 控制。
- `web/package.json` 的 `knip` 脚本（`knip`）配合 `web/knip.jsonc` 是未使用依赖/死代码识别入口，对应 `.uap/config/validator-registry.yaml` 中 `development.dependency_integrity` 的 `unused_dependencies` 检查。
- `go.mod`（`module github.com/uter-ai/uter`，`go 1.27.3`）与 `go.sum` 是 Go 根模块锁文件；`relaykit/go.mod`+`relaykit/go.sum`、`tokenkit/tokenkit/go.mod` 为独立模块依赖清单，`AGENTS.md` 要求 `relaykit/` 不得依赖根 `uter` 模块。
- `scripts/quality/uter-quality.sh` 的 `security` 阶段执行 `govulncheck`（Go 已知漏洞）与 `gitleaks`（密钥/敏感文件），缺工具输出 `NOT_RUN` 而非通过；`.quality/gitleaks.toml` 为扫描配置，`scripts/quality/gitleaks-allowlist.test.sh` 测试允许清单。
- 同脚本 header 的 stage 集合 `inventory|review|test|security|coverage|regression|report|status|full` 与状态语义 `PASSED`/`PARTIAL`/`BLOCKED`/`NOT_RUN`/`FAILED` 明确「缺工具=NOT_RUN，绝不伪通过」；`./scripts/verify-all.sh` 的 `安全扫描 (UEQE security)` 步骤直接调用 `uter-quality.sh security`。
- `.uap/runtime/_lib/util.mjs` 的 `SECRET_PATTERNS` 覆盖 `AIza`/`whsec_`/`sk-`/`ghp_` 与密码赋值，`redact()` 防止扫描输出泄露密钥；`AGENTS.md` Change Protection 禁止 `.env`、`*.db`、`logs/`、构建产物入库。
- `AGENTS.md`「Database compatibility」把 GORM core 与各 dialect/driver 视为兼容版本集，升级其中一个必须检查上游兼容性并跑完整 SQLite/MySQL/PostgreSQL 三库验证矩阵，不得只升 core 推断 driver 兼容；迁移至少启动两次证明幂等。
- `AGENTS.md`「Backend Rules」要求 `relaykit/` 独立 `cd relaykit && GOWORK=off go build ./...`，`tokenkit/tokenkit/` 独立 `GOWORK=off go vet ./... && GOWORK=off go test ./... && GOWORK=off go build ./...`；`make test` 覆盖四个模块，依赖变更须逐模块构建与测试。
- `web/AGENTS.md` §3.15 规定用 `bun install`/`bun add <pkg>`/`bun add -d <pkg>`/`bun remove <pkg>`/`bun pm ls`/`bun update`，新增依赖前评估维护情况、体积与许可，生产与开发依赖区分清楚；§3.16 要求发布前执行 typecheck、lint、format 检查与生产构建。
- `.github/workflows/ci.yml` 的 `backend` 作业以 `Set up Go`/`Set up Bun`（`bun-version: '1.4.0'`）固定工具链、`Install web dependencies` 使用 `--frozen-lockfile`，`coverage` 作业含 `Collect independent Go module coverage`，覆盖四个 Go 模块。
- `./scripts/verify-all.sh` 的 `Go vet (all four modules)`、`前端 类型检查 (tsgo)`、`前端 Lint (oxlint+i18n)`、`前端 单元测试 (vitest)`、`前端 生产构建 (build:check)`、`安全扫描 (UEQE security)` 步骤为依赖变更后的构建与测试证据；`web/.oxlintrc.json`/`web/.oxfmtrc.json` 固定 lint/format 规则。
- `.uap/config/validator-registry.yaml` 中 `development.dependency_integrity` 的 `checks: [lockfile, vulnerabilities, unused_dependencies]`；`validation_policy.fail_if_validator_missing: true`、`fail_if_evidence_missing: true`、`fail_if_required_check_skipped: true`。
- `.uap/runtime/evidence-engine/index.mjs` 的 `record()` 持久化依赖审计报告（`command`/`exit_code`/`duration_ms`/`content_hash`），`resolveAll()` 校验 `evidence_refs` 有效；`.uap/reports/DEFECT-REGISTRY.json` 登记依赖相关缺陷，`uap-defect-repair` 工作流约束修复重试上限 3 次。

## 执行流程
1. `uap-development-agent` 或 `uap-security-agent` 接收依赖任务，执行器 `development.dependencies`（`.uap/engines/development/index.mjs`）读取 `go.mod`/`go.sum`/`web/package.json`/`web/bun.lock` 与 `scope`。
2. 执行器经 `.uap/runtime/policy-engine/index.mjs` 校验 `project_read`/`local_command`/`evidence_write`，确认无 `production_write`/`quality_gate_disable` 等 deny 组权限。
3. 生成依赖清单与锁文件校验：`bun pm ls`、`bun install --frozen-lockfile`（只读校验）、`GOWORK=off go list -m all`；用 `knip` 识别未使用/重复依赖，记录到清单。
4. 执行漏洞扫描：`bash scripts/quality/uter-quality.sh security`（含 `govulncheck`/`gitleaks`）与 `./scripts/verify-all.sh` 的安全扫描步骤，缺工具记 `NOT_RUN`/`BLOCKED`，绝不伪通过。
5. 依赖变更（或升级评估）后执行构建与测试：`GOWORK=off go vet ./...`（四模块）、`make test`、`cd relaykit && GOWORK=off go build ./...`、`cd tokenkit/tokenkit && GOWORK=off go vet ./... && go test ./... && go build ./...`、`cd web && bun run typecheck|lint|test|build:check`。
6. 结果用 `.uap/runtime/_lib/contract.mjs` 的 `executorResult()` 归一化，`commands`/`evidence_refs`/`changed_files` 来自真实执行，`validation_results` 保持空数组；`event-system.publish()` 追加 `UAP-EVT-*` 事件。
7. 独立验证器 `development.dependency_integrity`（`.uap/validators/development/index.mjs`）执行 `lockfile`/`vulnerabilities`/`unused_dependencies`，返回 `validatorResult()`；BLOCKER（如未修复高危漏洞、锁文件被绕过）强制 FAIL。
8. `evidence-engine.record()` 把依赖清单、扫描输出、构建测试命令与退出码、`content_hash` 写入 `.uap/evidence/UAP-EV-*.json` 与依赖审计报告，索引追加到 `.uap/reports/EVIDENCE-INDEX.md`；仅当 `executed=true`、`exit_code=0`、无 BLOCKER 时迁移 `RUNNING → SUCCEEDED`。

## 对应执行器
- 执行器 ID：`development.dependencies`
- 实现路径：`.uap/engines/development/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：需 `project_read`（读取锁文件、`package.json`、`go.mod`）、`local_command`（`require_command_logging: true`、`forbid_secret_exfiltration: true`，执行 `bun`/`go`/扫描命令）、`evidence_write`；变更依赖需 `project_write`（`preserve_uncommitted_changes: true`、`forbid_destructive_git_operations: true`）。按 `.uap/config/permission-policy.yaml` 的 `default_effect: deny`、`enforcement.check_before_action: true`、`fail_closed: true` 逐动作校验；`production_write`/`production_deploy`/`real_payment`/`force_push`/`branch_creation`/`quality_gate_disable`/`test_deletion_to_force_pass` 为 deny 组，禁止删除安全检查消除扫描结果。

## 对应验证器
- 验证器 ID：`development.dependency_integrity`
- 实现路径：`.uap/validators/development/index.mjs`
- 检查项：`[lockfile, vulnerabilities, unused_dependencies]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `go.mod` / `go.sum` / `relaykit/go.mod` / `tokenkit/tokenkit/go.mod` | 四个 Go 模块的依赖声明与锁文件 |
| 输入 | `web/package.json` / `web/bun.lock` / `web/knip.jsonc` | 前端依赖清单、锁文件与未使用依赖检测配置 |
| 输入 | `.quality/gitleaks.toml` / `scripts/quality/uter-quality.sh` | 漏洞与密钥扫描基线及 `security` 阶段入口 |
| 输入 | `.uap/config/execution-mapping.yaml` | `execution_contract` 与 `failure_policy` |
| 输出 | 依赖清单与审计报告 | 依赖用途、版本、`overrides`、未使用/重复/过时项、许可证与替代方案记录 |
| 输出 | 漏洞扫描结果 | `govulncheck`/`gitleaks` 的真实退出码与 `NOT_RUN`/`BLOCKED` 标注 |
| 输出 | 构建与测试结果 | 四模块 `go vet`/`go test`/`go build` 与 `bun run typecheck|lint|test|build:check` 退出码 |
| 输出 | `.uap/evidence/UAP-EV-*.json` | 依赖审计证据（命令、退出码、`content_hash`、`trace_id`）及索引行 |

## 失败处理
- `permission_denied`：命中 deny 组或 `local_command` 约束时停止扫描/安装，任务迁移 `RUNNING → BLOCKED`，处置为 `block`，写 `blocked_reasons` 与审计事件；禁止绕过检查或未经评估全量升级依赖。
- `missing_dependency`：`govulncheck`/`gitleaks`/Bun/Go 工具链缺失、锁文件缺失或 UAP-04-001 未就绪时迁移 `QUEUED → BLOCKED`，处置为 `block`；`fail_if_validator_missing: true`、`fail_if_required_check_skipped: true`，缺工具只能记 `NOT_RUN`/`BLOCKED`，绝不伪通过。
- `validation_failed`：`lockfile`/`vulnerabilities`/`unused_dependencies` 任一 FAIL（含锁文件漂移、未修复高危漏洞）时迁移为 `FAILED`，处置为 `repair_then_revalidate`，修复后必须重跑构建、测试与同一验证器并生成新证据，禁止直接改判 PASS。
- `retryable`：扫描或构建瞬时失败按 `bounded_retry` 处理，重试上限 3 次（`execution.max_repair_attempts_per_root_cause: 3`、`uap-defect-repair` 的 `max_attempts_per_root_cause: 3`），退避采用指数退避（1s → 2s → 4s），每次重试写独立 `evidence_id`；`WAITING_RECOVERY → QUEUED` 为合法续跑链，超限迁移 `FAILED`。
- `unrecoverable`：升级导致三库/GORM 兼容集不可调和、或需删除安全检查才能通过时迁移 `BLOCKED` 或 `FAILED`，处置为 `fail`，完整保留失败证据与审计报告；`assertTransition()` 对非法迁移抛 `IllegalTransitionError`，`fail_closed: true`，禁止通过删测试或弱化门禁制造成功。

## 验收条件
> 基线原文：锁文件有效；依赖清单可生成；漏洞扫描可执行；依赖变更经过测试。

1. 锁文件有效
2. 依赖清单可生成
3. 漏洞扫描可执行
4. 依赖变更经过测试。

## 证据要求
- 证据目录 `.uap/evidence/`，索引 `.uap/reports/EVIDENCE-INDEX.md`；文件命名 `.uap/evidence/<evidence_id>.json`，ID 格式 `UAP-EV-<14位UTC时间戳>-<8位hex>`，由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EV')` 生成。
- 证据必须记录 `command`（如 `bun install --frozen-lockfile`、`bun pm ls`、`GOWORK=off go vet ./...`、`make test`、`bash scripts/quality/uter-quality.sh security`、`govulncheck`、`gitleaks`、`knip`）、`exit_code`、`duration_ms`、`recorded_at`、`environment`（platform/node/cwd/uap_root）、`inputs`、`stdout`、`stderr`、`artifacts`、`findings`、`summary`、`content_hash`、`task_id`、`trace_id`、`specification_ids`（含 UAP-04-003）。
- 依赖审计报告必须包含：依赖清单（用途/版本/许可证/替代方案）、锁文件校验结果、未使用/重复/过时依赖清单、漏洞扫描输出与 `NOT_RUN` 原因、依赖变更后的构建与测试退出码；`scripts/quality/uter-quality.sh` 的 `.status` 与 `./scripts/verify-all.sh` 的 `step()` 输出为原始日志引用。
- 证据 append-only：`writeEvidence()` 对同 ID 二次写入抛错，`verify()` 用 `content_hash` 校验，`resolveAll()` 校验 `evidence_refs` 有效；失败证据（漏洞、锁文件漂移、扫描失败、构建/测试失败）不得删除或被新结果静默覆盖，禁止通过删除安全检查消除扫描结果。
- 敏感值经 `redact()` 脱敏，禁止把扫描出的密钥、Token、密码明文写入 stdout/stderr/日志/报告；`AGENTS.md` Change Protection 要求 `.env`、`*.db`、`logs/`、构建产物不入库。
- 报告必须能经 `.uap/reports/EVIDENCE-INDEX.md` 定位到每条扫描与构建测试的原始记录；未真实执行的扫描必须标注 `NOT_RUN`/`BLOCKED`，状态保持 IMPLEMENTED_NOT_VERIFIED。

## 依赖标准
- `UAP-04-001`（编码规范）：提供 Go/TypeScript 编码约定、`go 1.27.3` 兼容基线、`relaykit`/`tokenkit/tokenkit` 独立模块边界，以及 `./scripts/verify-all.sh`、`make test`、`bun run typecheck|lint|test|build:check` 的自动构建与测试门禁；使依赖升级的兼容性评估、变更后的构建/测试验证与「禁止提交无用依赖/死代码」有可执行的判定依据。
