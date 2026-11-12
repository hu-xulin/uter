# UAP-08-002 — 部署与回滚规范

**编号：** UAP-08-002
**标准编号：** UAP-08-002
**名称：** 部署与回滚规范
**版本：** 1.0.0
**状态：** ACTIVE
**适用范围：** 约束 Uter 的本地/隔离测试环境部署与回滚，覆盖 `Dockerfile`、`docker-compose.yml` / `docker-compose.dev.yml` / `docker-compose.multidb.yml`、`build-prod.sh`、`rebuild-all.sh`、`VERSION`、`electron/build.sh`，以及 `controller/misc.go` 的 `GetStatus` 与 `router/api-router.go` 的 `GET /status` 健康检查链路。**生产部署必须经过明确授权**，`permission-policy.yaml` 中 `production_deploy` / `production_write` / `production_read` 均为 `deny`，本次 UAP 建设只能在本地或隔离测试环境验证部署流程（`test_environment.isolated_environment_only: true`、`execution.dry_run_for_production: true`）。
**关键级别：** P0
**依赖标准：** UAP-08-001、UAP-06-003

## 规范目标
本规范要求每次部署先定义环境、版本与依赖，部署前执行质量门禁，核对配置/环境变量与数据库迁移兼容性，具备区分代码回滚与数据回滚的回滚方案，部署后执行健康检查并记录版本与执行证据。目标是使 `Dockerfile` / `docker-compose*.yml` / `rebuild-all.sh` / `build-prod.sh` 的存在本身不能被当作「部署已验证」，任何部署结论都必须来自真实执行的隔离部署与带退出码的健康检查证据，且绝不因脚本存在而放宽生产授权边界。

## 强制性要求
1. 部署必须定义环境、版本和依赖。
2. 部署前必须执行质量门禁。
3. 必须检查配置和环境变量。
4. 必须验证数据库迁移兼容性。
5. 必须有回滚方案。
6. 必须明确回滚对数据库和数据的影响。
7. 必须区分代码回滚与数据回滚。
8. 部署后必须执行健康检查。
9. 必须记录部署版本和执行证据。
10. 生产部署必须经过明确授权。
11. 本次建设只能在本地或隔离测试环境验证部署流程。
12. 不得将部署脚本存在标记为部署已验证。

## Uter 落地细则
- 部署的环境/版本/依赖由真实文件定义：`Dockerfile`（镜像构建）、`docker-compose.yml`（`services: uter` / `redis` / `postgres`，`uter` 映射 `127.0.0.1:3000:3000`、挂载 `./data:/data` 与 `./logs:/app/logs`，`redis` 固定 `redis:7-alpine@sha256:...`、`postgres` 固定 `postgres:15@sha256:...`，并声明 `pg_data` volume 与 `uter-network`）、`docker-compose.dev.yml`、`docker-compose.multidb.yml`（三方言验证环境）、`VERSION`（仓库根版本号）、`electron/build.sh`（桌面端构建）。
- 版本注入与产物可追溯：`rebuild-all.sh` 用 `go build -o uter-bin .` 并通过 `-ldflags -X` 注入 `VERSION` 的语义版本，构建成功后自动把 patch 位 +1 写回 `VERSION`（`v1.0.0 → v1.0.1 → ...`），首页 logo 旁显示该版本；`build-prod.sh` 的顺序是 `cd web && bun install && bun run build` → `cd .. && go run main.go`，必须先构建 `web/dist` 再让 `//go:embed` 嵌入，否则 Go 编译成功但二进制里没有 SPA 与文档产物。
- 部署前质量门禁（强制性要求第 2 条）：`.github/workflows/release-gate.yml`（可复用工作流，`on: workflow_call` / `workflow_dispatch`，含 `backend` / `vulnscan` / `desktop` / `frontend` 四 job）是发布门禁；`.github/workflows/release.yml` 的 `gate` job 用 `uses: ./.github/workflows/release-gate.yml`，`linux` / `macos` / `windows` 三 job 均 `needs: gate`（注释：「任何一项失败，下面的 linux/macos/windows 作业都不会启动」）；`.github/workflows/docker-build.yml` 的 `build_single_arch` / `create_manifests` 同样依赖 `gate`；本地等效为 `./scripts/verify-all.sh` 全量（存在 SKIP 即 `exit 2`）。
- 配置与环境变量核对（强制性要求第 3 条）：逐项对照 `docker-compose.yml` 的 `environment`（`SQL_DSN=postgresql://...@postgres:5432/...`、`REDIS_CONN_STRING=redis://...@redis:6379`、`SESSION_SECRET`、`SESSION_COOKIE_SECURE`、`SESSION_COOKIE_TRUSTED_URL`、`CORS_ALLOWED_ORIGINS`、`TZ`、`ERROR_LOG_ENABLED=true`、`BATCH_UPDATE_ENABLED=true`、`NODE_NAME=uter-node-1`）；`.env` / `*.db` / `logs/` / `web/dist` 属 `AGENTS.md` Change Protection 的受保护本地状态，禁止进入提交或报告明文；`ci.yml` 的 `desktop` job 注释要求 `SESSION_SECRET` / `CRYPTO_SECRET` 跨重启稳定。核对只检查变量「存在性」，不得输出其值（`secret_export: deny`、`redact_secrets: true`）。
- 数据库迁移兼容性（强制性要求第 4 条）：`AGENTS.md` Database compatibility 要求所有数据库代码同时支持 SQLite、MySQL >= 5.7.8、PostgreSQL >= 9.6，且变更必须用**真实三方言实例**验证，单元测试/mock/只测一种方言均不可替代；schema/迁移变更须在 fresh database 与「由最新发布版本创建的代表性数据库升级」两种场景测试，启动迁移至少跑两次证明幂等，并验证既有数据、索引、约束、唯一性保证被保留，覆盖单独配置的 log database。`docker-compose.multidb.yml` 是隔离的多数据库环境，`model/main.go` 提供 SQLite 用 `ALTER TABLE ... ADD COLUMN` 的迁移模式与 `lockForUpdate(tx)` 行锁助手；`production_write: deny` 禁止连接生产库写入。
- 回滚方案（强制性要求第 5 条）：代码回滚以「重新构建指定版本的 `web/dist` + `go build -o uter-bin .` 二进制 + 重启」实现，而非 git 破坏性操作——`permission-policy.yaml` 中 `branch_switch: deny`、`force_push: deny`、`destructive_git: deny`、`project_write.forbid_destructive_git_operations: true` 禁止 `git reset --hard` / `git checkout --` 类操作；`rebuild-all.sh` 明确「顺序仍是先 web 后 Go」，并在编译前用 `scripts/verify-docs-artifacts.sh` 把缺产物变成硬失败，保证回滚产物完整可启动。
- 明确回滚对数据库和数据的影响、区分代码回滚与数据回滚（强制性要求第 6、7 条）：`docker-compose.yml` 的 `pg_data` volume 与 `./data` / `./logs` 挂载是持久化数据，代码回滚（替换 `uter-bin` / `web/dist`）**不**回滚这些数据；数据回滚必须走备份与迁移逆方案，`AGENTS.md` 要求「破坏性迁移必须有备份和回滚方案」「Schema or migration changes ... verify that existing data, indexes, constraints, and uniqueness guarantees are preserved」，并禁止静默删除生产数据；回滚计划必须分别写明代码层与数据层的动作、影响范围与验证方式。
- 部署后健康检查（强制性要求第 8 条）：`rebuild-all.sh` 第 4/5 步「杀掉旧进程后以独立会话启动 `uter-bin`，并做端口 + HTTP 体检」，且注释要求 Redis 强 ping 不通即 `FatalLog` 退出、绝不静默降级；可核验端点为 `router/api-router.go:32` 注册的 `GET /status` → `controller/misc.go:41` 的 `GetStatus()`，另有 `controller/channel_inference.go:119` 的上游 `/health` / `/v1/models` / `/metrics` 探测与 `controller/uptime_kuma.go` 的 `apiStatusPath` / `apiHeartbeatPath` 心跳；健康检查必须记录真实 HTTP 状态码与退出码。
- 记录部署版本与执行证据（强制性要求第 9 条）：以 `VERSION` 内容、`uter-bin` 构建产物、`web/dist` 产物清单（由 `scripts/verify-docs-artifacts.sh` 校验 7 份 docs-search 索引与静态资产）、镜像 digest 与 compose 服务清单为版本标识；执行证据写入 `.uap/evidence/`，索引 `.uap/reports/EVIDENCE-INDEX.md`，并满足 `AGENTS.md` Verification Evidence 的命令/退出码/变更文件/已知失败四项要求。
- **生产部署必须经过明确授权**：`permission-policy.yaml` 的 `production_deploy: deny`（reason: `Explicit production authorization required`）、`production_write: deny`（同因）、`production_read: deny`（reason: `Not required for local UAP implementation`）；`execution-mapping.yaml` 固定 `execution.mode: local`、`default_environment: local`、`dry_run_for_production: true`、`branch_policy: no_branch_creation`；`AGENTS.md` Project Governance 规定 Pull Requests 被禁用（Agents MUST NOT create, update, review or merge Pull Requests），`release.yml` / `docker-build.yml` / `release-gate.yml` 的 `workflow_dispatch` 是人工授权触发入口。任何生产动作在策略层默认拒绝，必须由人类显式授权，UAP 不得自行授权。
- **本次建设只能在本地或隔离测试环境验证部署流程**：`permission-policy.yaml` 的 `test_environment: allow` 且 `constraints.isolated_environment_only: true`；可用环境为 `docker-compose.dev.yml`、`docker-compose.multidb.yml` 与本地 `build-prod.sh`（`go run main.go`）；`workflow-registry.yaml` 的 `uap-financial-verification` 标注 `environment: simulated_only`、`acceptance: financial_integrity_verified`；`real_payment` / `real_refund` 为 `deny`。
- **不得将部署脚本存在标记为部署已验证**（强制性要求第 12 条）：对应 `UAP-00-004` 的「文件存在不能证明功能实现」「命令存在不能证明命令可运行」「测试文件存在不能证明测试通过」。`Dockerfile` / `build-prod.sh` / `rebuild-all.sh` 存在只说明有脚本；必须在隔离环境真实执行构建、启动、健康检查并产出 `deployment_plan` / `rollback_plan` / `health_check` 三类证据后，才可声明部署流程「可执行」，且结论必须限定为「测试环境部署可验证」，不得外推为生产已验证（`UAP-06-003` 第 12 条：不得声称已经验证生产恢复，除非实际完成授权的生产恢复演练）。
- 全仓门禁与变更保护：`./scripts/verify-all.sh [--quick]`（全量模式存在 SKIP 即 `exit 2`，`scripts/verify-all.sh` 第 208–211 行）、`gofmt -l .`、`GOWORK=off go vet ./...`、`make test`、`cd web && bun run typecheck|lint|test|lint:design:strict|copyright:check|format:check|build:check`；`AGENTS.md` Change Protection 要求先 `git status --short`、只 `git add <path>`、禁止 `rm -rf` / `git clean -fd`。
- 依赖链约束：`specification-registry.yaml` 中 `UAP-08-002` 的 `dependencies: [UAP-08-001, UAP-06-003]`；`UAP-08-001` 提供发布门禁与 `needs: gate` 阻断，`UAP-06-003` 提供健康检查、超时/重试/退避/熔断、关键任务恢复与重启后状态验证。两类能力缺一即不得进入部署验证阶段（`missing_dependency` → BLOCKED）。

## 执行流程
1. `uap-orchestrator`（`.uap/runtime/agent-runtime/index.mjs`，权限 `project_read/task_create/task_dispatch/evidence_write`）读取 `specification-registry.yaml`，按 DAG 顺序确认 `UAP-08-001` 与 `UAP-06-003` 两个依赖均已满足，再创建结构化任务（`task_id` / `specification_ids` / `scope` / `constraints` / `acceptance_criteria`）。
2. Orchestrator 经 `.uap/runtime/_lib/yaml.mjs` 加载 `execution-mapping.yaml`，解析 `delivery.deployment` → `.uap/engines/delivery/index.mjs`，动态 `import()` 并调用 `health(ctx)`；同时由 `.uap/runtime/policy-engine/index.mjs` 校验 `production_deploy` / `production_write` 为 `deny`，确认只进入 `test_environment`（`isolated_environment_only: true`）。
3. 执行器用 `util.mjs` 的 `readText()` / `listFiles()` 读取 `Dockerfile`、`docker-compose.yml` / `docker-compose.dev.yml` / `docker-compose.multidb.yml`、`VERSION`、`build-prod.sh`、`rebuild-all.sh`、`controller/misc.go`、`router/api-router.go`，生成 `deployment_plan`：环境、版本、依赖、配置/环境变量清单、数据库三方言兼容性检查项。
4. 执行器核对部署前门禁：解析 `.github/workflows/release-gate.yml` 的四个 job、`.github/workflows/release.yml` 的 `needs: gate` 链、`.github/workflows/docker-build.yml` 的 `gate`；在本地运行 `./scripts/verify-all.sh`（全量，不接受 `--quick` 结果），记录命令、退出码与 PASS/FAIL/SKIP 明细；任何 `exit 1` / `exit 2` 即停止，不进入部署。
5. 执行器生成 `rollback_plan`：分别写明代码回滚（重建指定 `VERSION` 的 `web/dist` + `go build -o uter-bin .` + 重启，禁止 git 破坏性操作）与数据回滚（备份、`pg_data` / `./data` / `./logs` 持久化数据处理、迁移逆方案与幂等验证），并明确二者对数据库与数据的影响差异。
6. 执行器在隔离环境（`docker-compose.dev.yml` / `docker-compose.multidb.yml`）真实执行构建与启动：`bun install` + `bun run build`、`scripts/verify-docs-artifacts.sh`、`go build -o uter-bin .`，记录版本标识与产物清单；随后执行 `health_check`：端口探测 + `GET /api/status`（`controller.GetStatus`）真实 HTTP 状态码 + Redis ping 结果，逐项记录退出码。
7. 执行器用 `contract.mjs` 的 `executorResult()` 归一化输出；证据写入 `.uap/evidence/`（`newId('UAP-EVD')`），记录命令、退出码、ISO 8601 时间、环境（`.uap/state/BASELINE.json` toolchain）、`deployment_plan` / `rollback_plan` / `health_check` 全文、输入输出与日志引用，索引追加 `.uap/reports/EVIDENCE-INDEX.md`；结论明确限定为「测试环境部署可验证」，不声称生产已验证。
8. `delivery.deployment_integrity` 验证器（`.uap/validators/delivery/index.mjs`）执行 `deployment_plan` / `rollback_plan` / `health_check` 并返回 `validatorResult()`；仅当 `executed=true && exit_code=0` 且 findings 无 `severity=BLOCKER` 时判 PASS；脚本存在但未真实执行、健康检查缺失、回滚方案未区分代码/数据、或试图生产部署时一律 fail-closed 记为 BLOCKED/FAIL 并保留失败证据。

## 对应执行器
- 执行器 ID：`delivery.deployment`
- 实现路径：`.uap/engines/delivery/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：按 `.uap/config/agent-registry.yaml` 的 `uap-delivery-agent`（`[project_read, local_command, test_environment, evidence_write]`，tools `delivery_engine` / `build_adapter`）与 `.uap/config/permission-policy.yaml` 执行：需要 `project_read`（读部署脚本/配置/健康检查代码）、`local_command`（`require_command_logging: true`、`forbid_secret_exfiltration: true`）、`test_environment`（`isolated_environment_only: true`）、`evidence_write`。**`production_deploy: deny`、`production_write: deny`、`production_read: deny` 是本规范的核心边界**，仅在人类显式授权后才可例外，UAP 不得自行授权；`secret_export` / `real_payment` / `real_refund` / `force_push` / `branch_creation` / `branch_switch` / `destructive_git` / `quality_gate_disable` / `test_deletion_to_force_pass` 一律 `deny`；受 `enforcement.check_before_action: true`、`log_denied_actions: true`、`log_sensitive_actions: true`、`redact_secrets: true`、`fail_closed: true`、`default_effect: deny` 约束。

## 对应验证器
- 验证器 ID：`delivery.deployment_integrity`
- 实现路径：`.uap/validators/delivery/index.mjs`
- 检查项：`[deployment_plan, rollback_plan, health_check]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `task_id` | 任务唯一 ID，来自 `execution-mapping.yaml` 的 `execution_contract.required_input` |
| 输入 | `specification_ids` | 关联规范 ID：`[UAP-08-002]` 及依赖 `UAP-08-001`、`UAP-06-003` |
| 输入 | `scope` | 部署范围：隔离测试环境的 `Dockerfile` / `docker-compose*.yml` / `VERSION` / `build-prod.sh` / `rebuild-all.sh` |
| 输入 | `environment_manifest` | 环境清单：compose 服务、`SQL_DSN` / `REDIS_CONN_STRING` / `SESSION_SECRET` 等变量存在性（不含值）、三方言数据库版本 |
| 输入 | `constraints` | 约束：生产部署须明确授权、仅隔离环境、代码/数据回滚分离、不输出密钥、fail-closed |
| 输入 | `acceptance_criteria` | 验收标准：部署流程可执行、测试环境部署可验证、回滚方案有测试证据、生产操作权限得到限制 |
| 输出 | `executorResult` | 由 `contract.mjs` 的 `executorResult()` 归一化的结构化执行结果 |
| 输出 | `status` / `summary` / `changed_files` | 执行状态、摘要、变更文件清单 |
| 输出 | `deployment_plan` | 环境/版本/依赖定义、配置与环境变量核对、三方言迁移兼容性检查项 |
| 输出 | `rollback_plan` | 代码回滚与数据回滚分离方案，含对数据库与数据的影响说明 |
| 输出 | `validation_results` | 由 `delivery.deployment_integrity` 独立回填的三类检查结果 |
| 输出 | `health_check` | 端口探测、`GET /api/status` 状态码、Redis ping 的逐项退出码 |
| 输出 | `evidence_refs` | 指向 `.uap/evidence/` 的证据 ID 列表 |
| 输出 | `blocked_reasons` | 阻断原因（含生产授权缺失、门禁失败、健康检查未执行） |
| 输出 | `validatorResult` | `validatorResult()` 返回的机器可读判定 |

## 失败处理
按 `.uap/config/execution-mapping.yaml` 的 `execution.failure_policy` 与 `.uap/config/permission-policy.yaml` 的 `enforcement.fail_closed: true`（`default_effect: deny`）逐类处置：
1. **permission_denied**：执行前由 `.uap/runtime/policy-engine/index.mjs` 校验权限组；任何 `production_deploy` / `production_write` / `production_read` 请求（无论是否紧急）因策略为 `deny` 且需人类显式授权而立即被拒绝，记录 `log_denied_actions` 与 `log_sensitive_actions`，处置策略 `block`，任务由 RUNNING 迁移为 BLOCKED，不重试、不绕过、不自行提权。试图用 git 破坏性操作回滚同样阻断。
2. **missing_dependency**：`.uap/engines/delivery/index.mjs` 无法导入、`health()` 缺失、`UAP-08-001` / `UAP-06-003` 任一依赖未满足、`VERSION` / `Dockerfile` / `docker-compose*.yml` 缺失、三方言数据库实例不可用或 `web/dist` 产物缺失（`scripts/verify-docs-artifacts.sh` 失败）时，处置策略 `block`，任务迁移 BLOCKED 并写入 `blocked_reasons`，补齐后由 Orchestrator 重新排队（QUEUED）。
3. **validation_failed**：部署前门禁 `./scripts/verify-all.sh` 返回 `exit 1` / `exit 2`、`deployment_plan` 缺环境变量核对、`rollback_plan` 未区分代码/数据回滚、`health_check` 未真实执行或 `GET /api/status` 非预期，或 findings 含 `severity=BLOCKER` 时，处置策略 `repair_then_revalidate`，交 `uap-defect-repair` 修复后复验；未复验通过不得标记 SUCCEEDED，且不得把「脚本存在」当作验证通过。
4. **retryable**：处置策略 `bounded_retry`，重试上限 **3 次**（`execution.max_repair_attempts_per_root_cause: 3`），退避采用指数退避（第 n 次等待 `base × 2^(n-1)`，base=1s，上限 8s，附随机抖动）；每次重试写入独立证据；恢复执行须校验 `task_id` / `result_id` 幂等，禁止重放非幂等副作用（尤其禁止重复执行启动/迁移导致数据重复变更，`AGENTS.md` 要求启动迁移至少跑两次证明幂等）。
5. **unrecoverable**：处置策略 `fail`，任务迁移 FAILED 并保留全部失败证据（含部署与健康检查日志）；按 `contract.mjs` 的 `TASK_TRANSITIONS`，FAILED 仅允许 → QUEUED / BLOCKED / CANCELLED，禁止重置状态隐藏失败；不得声称已验证生产恢复（`UAP-06-003`）。
全局 fail-closed：验证器缺失（`fail_if_validator_missing: true`）、验证器不可执行（`fail_if_validator_not_executable: true`）、证据缺失（`fail_if_evidence_missing: true`）或必需检查被跳过（`fail_if_required_check_skipped: true`）时，结果一律按 BLOCKED / FAIL 处理，绝不降级为 PASS；`allow_explicit_blocked_status: true` 只允许显式声明 BLOCKED，不允许隐式跳过。

## 验收条件
1. 部署流程可执行。
2. 测试环境部署可验证。
3. 回滚方案有测试证据。
4. 生产操作权限得到限制。

## 证据要求
- 证据统一落盘到 `.uap/evidence/`，索引写入 `.uap/reports/EVIDENCE-INDEX.md`；证据 ID 由 `.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EVD')` 生成稳定唯一 ID（格式 `UAP-EVD-<时间戳>-<随机>`），禁止与历史证据复用；落盘使用 `writeEvidence()` / `appendJSONL()`，环境变量值与密钥经 `redact()` 处理。
- 每条证据必须记录：执行命令原文（如 `./scripts/verify-all.sh`、`scripts/verify-docs-artifacts.sh web/dist`、`bun run build`、`go build -o uter-bin .`、端口探测与 `GET /api/status`）、`exit_code`、开始/结束时间（ISO 8601，由 `nowISO()` 生成）、环境（取自 `.uap/state/BASELINE.json` 的 toolchain：Go `go1.27.4` / Node `v22.22.2` / Bun `1.4.2`）、输入（`task_id` / `specification_ids` / `environment_manifest` / `constraints`）、输出（`executorResult` 或 `validatorResult` 全文）以及日志引用路径（compose 服务日志、`web/dist` 产物清单、`VERSION` 值、`uter-bin` 构建记录）。
- 证据必须包含 `deployment_plan`、`rollback_plan`（代码回滚与数据回滚分离、对数据库与数据的影响）与 `health_check`（真实 HTTP 状态码/退出码）三份原文；`VERSION` 与镜像 digest 作为版本标识可追溯；结论须明确限定为「测试环境部署可验证」，不得写成生产已验证。
- 验证结果由 `contract.mjs` 的 `validatorResult()` 归一化为 `{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；`PASS` 仅在 `executed=true && exit_code=0` 且 findings 无 `severity=BLOCKER` 时成立；「脚本存在但未执行」「健康检查 SKIP」「生产授权缺失」必须原样记录为 BLOCKED / NOT_EXECUTED，不得改写为 PASS。
- **证据不可覆盖**：新结果写入新证据文件，禁止覆盖历史记录；`execution.persist_task_state: true` 保证状态持久化。**失败证据不可删除**：BLOCKED / FAILED / NOT_EXECUTED / 门禁 `exit 2` / 健康检查失败的证据必须保留，禁止以删除失败证据或删除失败测试制造通过结果；报告须能经 `evidence_refs` 反查原始记录并满足 `AGENTS.md` Verification Evidence 四项要求；状态迁移受 `TASK_TRANSITIONS` 约束。

## 依赖标准
- **UAP-08-001（CI/CD 规范）**：`.uap/config/specification-registry.yaml` 中 `UAP-08-002` 的 `dependencies` 第一项。它提供真实命令/退出码的 CI 检查、失败阻断后续发布步骤（`.github/workflows/release.yml` 的 `needs: gate` 链）、本地等效全量验证（`./scripts/verify-all.sh`，全量有 SKIP 即 `exit 2`）、构建产物可追溯与 CI 验证报告，构成本规范「部署前必须执行质量门禁」的具体实现与证据来源。
- **UAP-06-003（可靠性与恢复规范）**：`dependencies` 第二项。它提供关键服务健康检查、超时/重试/退避/熔断策略、关键任务恢复、进程重启后任务状态验证、后台任务失败队列、备份与恢复能力验证状态，以及「不得声称已经验证生产恢复，除非实际完成了授权的生产恢复演练」。本规范据此把 `controller.GetStatus` 的 `GET /api/status` 与 `rebuild-all.sh` 的端口+HTTP 体检作为部署后健康检查，并把恢复/回滚能力纳入 `rollback_plan` 与 `health_check` 检查项。
