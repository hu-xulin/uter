# UAP-04-001 — 编码规范
> **UDS 7.0 状态边界：** 当前文档/Token SSOT 为 UDS 7.0（`ACCEPTANCE_READY`、`accepted: false`）。指定运行时标量 Token 与图表色已切换到 7.0 值；UDS 3.0 兼容层仍须保留，未迁移页面不得假定已完成全站切换。页面级状态以 `COMPAT-MAP.json` 和 `FINAL-ACCEPTANCE-REPORT.md` 的本次证据为准，不得将局部 Token 迁移等同于整体验收。


**编号：** UAP-04-001
**标准编号：** UAP-04-001
**名称：** 编码规范
**版本：** 1.0.0
**状态：** IMPLEMENTED_NOT_VERIFIED
**适用范围：** 适用于 Uter 全仓 Go 与 TypeScript 代码的编写与修改：`go.mod`（`module github.com/uter-ai/uter`，`go 1.27.3`）、`router/`、`middleware/`、`model/`、`controller/`、`service/`、`relay/`、`common/json.go`、`common/quota_math.go`、`service/authz/`、`relaykit/`、`tokenkit/tokenkit/`，以及 `web/src/`、`web/package.json`、`web/AGENTS.md`。格式化和静态检查统一由 `./scripts/verify-all.sh` 收敛执行。
**关键级别：** P1
**依赖标准：** [UAP-00-001]

## 规范目标
Uter 是 Go 1.27.3 + React 19/TypeScript 的双栈仓库，编码约定已固化在 `AGENTS.md`（Common Code Quality / Backend Rules / Change Protection）与 `web/AGENTS.md`（§3.2 代码风格与类型、§3.14 测试）。本规范要求 Agent 复用 `common/json.go`、`common/quota_math.go` 等既有基础设施，禁止裸 `encoding/json` 与裸 `int(float64)` 金额转换，且所有改动必须经 `gofmt -l .`、`GOWORK=off go vet ./...`、`make test`、`bun run typecheck|lint|test|build:check` 的真实执行结果判定。`development.coding_compliance` 的 `format/lint/typecheck/dead_code` 检查使规范不可被「看起来正确」绕过。

## 强制性要求
1. 遵循项目现有语言和框架约定。
2. 优先复用现有模块和基础设施。
3. 避免无必要重复实现。
4. 类型、命名、异常和日志必须保持一致。
5. 禁止提交无效代码、死代码和无用依赖。
6. 不得通过忽略类型错误或关闭 Lint 规则规避问题。
7. 关键逻辑必须有测试。
8. 敏感数据不得写入普通日志。
9. API、数据库和业务规则变更必须同步更新文档。
10. 复杂逻辑必须有必要的注释和说明。
11. 代码修改必须遵守现有架构边界。
12. 格式化和静态检查必须纳入自动执行。

## Uter 落地细则
- `AGENTS.md`「Common Code Quality」要求新代码直接可读、优先早返回、避免深层嵌套与单调用者包级 helper；「Backend Rules」要求 `any` 替代 `interface{}`、`for i := range n`、`slices.Contains`/`slices.Sort`、`strings.Cut`/`CutPrefix`/`CutSuffix`、`strings.Builder`、`min`/`max`、`maps.Copy`、`sync.WaitGroup.Go`。
- `AGENTS.md`「Backend Rules → JSON package」强制所有 JSON marshal/unmarshal 走 `common/json.go` 的 `common.Marshal` / `common.Unmarshal` / `common.UnmarshalJsonStr` / `common.DecodeJson` / `common.GetJsonType`（该文件另有 `DecodeJsonWithValidation`），业务代码禁止直接调用 `encoding/json`；`relaykit/` 改用 `relaykit/relayconvert/kitutil/json.go` 的 `kitutil.*`。
- `AGENTS.md`「Billing safety invariants」与 `common/quota_math.go` 集中 `QuotaFromFloat` / `QuotaRound` / `QuotaFromDecimal` / `WalletQuotaFromDecimalStrict` 及 `*Checked` 变体；禁止 `int(float64(quota) * ratio)` 等裸转换，`common/quota_math_test.go` 为其回归测试。
- `gofmt -l .` 是 `scripts/verify-all.sh` 的「Go 格式」步骤（过滤 `^vendor/`，非空即 `exit 1`）；`GOWORK=off go vet ./...` 步骤覆盖 root、`relaykit`、`tokenkit`、`tokenkit/tokenkit` 四个模块。
- `Makefile` 的 `test` 目标以 `GOWORK=off go test` 依次验证四个 Go 模块；`verify` / `verify-quick` 目标调用 `./scripts/verify-all.sh` 与 `--quick`；`build-web` 目标使用 `bun install --frozen-lockfile`。
- `web/package.json` 的真实脚本：`typecheck`（`tsgo -b`）、`lint`（`node scripts/check-i18n-keys.mjs && oxlint -c .oxlintrc.json .`）、`test`（`vitest run`）、`format:check`、`copyright:check`、`lint:design:strict`、`build:check`；配置为 `web/.oxlintrc.json`、`web/.oxfmtrc.json`、`web/knip.jsonc`。
- `web/AGENTS.md` §3.2 要求改 TS/TSX 后执行 `bun run typecheck` 修复至无错、完成前修复涉及文件全部 lint error，禁止 2 层以上嵌套三元、避免 `any`、仅类型导入用 `import type`；§3.14 要求 `*.test.ts` 用 Vitest 且测试放模块专属 `__tests__/` 目录。
- `.github/workflows/ci.yml` 的 `backend` 作业含 `Check gofmt`、`golangci-lint (root module, new issues only)`、`Vet/Build/Test` 四模块；`race` 作业为 Backend race detector；`coverage` 作业含 `Enforce critical-path coverage thresholds`；`.github/workflows/release-gate.yml` 为发布门禁。
- `.uap/config/validator-registry.yaml` 中 `development.coding_compliance` 的 `checks: [format, lint, typecheck, dead_code]` 与 `validation_policy.fail_if_required_check_skipped: true`；`scripts/quality/uter-quality.sh` 的 `review`/`coverage` 阶段分别复用 lint 与覆盖率门禁。
- `AGENTS.md`「Backend test quality」要求优先扩展既有测试文件、使用 `github.com/stretchr/testify/require`（fatal）与 `testify/assert`（非 fatal）、确定性 table tests；真实样例 `relay/helper/openai_image_request_test.go`、`relay/common/relay_utils_test.go`、`common/quota_math_test.go`、`service/authz/authz_test.go`。
- `AGENTS.md`「Change Protection」规定 `.env`、`*.db`/`-shm`/`-wal`、`logs/`、构建产物不得进入提交；`.uap/runtime/_lib/util.mjs` 的 `redact()` 脱敏 `AIza`/`whsec_`/`sk-`/`ghp_` 及密码赋值模式，保证敏感数据不写入普通日志。
- `relaykit/` 必须独立可构建（`cd relaykit && GOWORK=off go build ./...`），`tokenkit/tokenkit/` 必须独立验证 `GOWORK=off go vet ./... && GOWORK=off go test ./... && GOWORK=off go build ./...`；`AGENTS.md`「Database compatibility」要求 GORM 改动跑 SQLite/MySQL/PostgreSQL 三库验证矩阵并以 `model/main.go` 的 `lockForUpdate(tx)` 加行锁。
- `docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md` 与 `web/src/design-system/` 为 UI 基线，`web/src/components/ui/` 组件须优先复用；`pkg/billingexpr/expr.md` 为计费表达式变更必读文档，`setting/billing_setting/builtin_billing.go` 为内置模型价格定义位置。
- `./scripts/verify-all.sh [--quick]` 把上述检查收敛为一条本地命令，其 `step()` 强制输出「实际命令 + 退出码 + 耗时」，退出码 `0/1/2` 语义由脚本头定义；`AGENTS.md`「Verification Evidence」禁止「已检查」「tests passed」等无证据声明。

## 执行流程
1. `uap-development-agent` 接收任务，执行器 `development.coding_standard`（`.uap/engines/development/index.mjs`）先加载 `AGENTS.md` 与 `web/AGENTS.md`（Rule Auto-Loading），读取变更文件清单与 `scope`。
2. 执行器按 `.uap/config/execution-mapping.yaml` 的 `execution_contract.required_input` 校验任务字段，并调用 `.uap/runtime/policy-engine/index.mjs` 做 `check_before_action` 权限校验（`project_read`/`project_write`/`local_command`）。
3. 编码阶段复用既有模块：Go 侧走 `common/json.go`、`common/quota_math.go`、`service/authz/`；前端侧复用 `web/src/components/` 与 `web/src/design-system/`，不新增重复实现。
4. 执行器调用真实命令：`gofmt -l .`、`GOWORK=off go vet ./...`、`make test`、`cd web && bun run typecheck|lint|test|lint:design:strict|copyright:check|format:check|build:check`，或直接运行 `./scripts/verify-all.sh`，逐条经 `step()` 采集退出码。
5. 结果用 `.uap/runtime/_lib/contract.mjs` 的 `executorResult()` 归一化，`changed_files`/`commands`/`evidence_refs` 来自真实执行，`validation_results` 保持空数组。
6. 独立验证器 `development.coding_compliance`（`.uap/validators/development/index.mjs`）执行 `format`/`lint`/`typecheck`/`dead_code`，返回 `validatorResult()`；BLOCKER 发现强制 FAIL。
7. `evidence-engine.record()` 把命令、退出码、耗时、stdout/stderr（脱敏）、`content_hash` 写入 `.uap/evidence/UAP-EV-*.json`，索引追加到 `.uap/reports/EVIDENCE-INDEX.md`。
8. 仅当 `executed=true`、`exit_code=0`、无 BLOCKER 时任务迁移 `RUNNING → SUCCEEDED`；否则保持 `FAILED`/`BLOCKED` 并保留失败证据。

## 对应执行器
- 执行器 ID：`development.coding_standard`
- 实现路径：`.uap/engines/development/index.mjs`
- 接口约定：`health(ctx)` 返回健康状态；`execute(task, ctx)` 返回结构化 executorResult。
- 权限：需 `project_read`（读取源码与 `AGENTS.md`）、`project_write`（`preserve_uncommitted_changes: true`、`forbid_destructive_git_operations: true`）、`local_command`（`require_command_logging: true`、`forbid_secret_exfiltration: true`）、`evidence_write`。按 `.uap/config/permission-policy.yaml` 的 `default_effect: deny`、`enforcement.check_before_action: true`、`fail_closed: true` 逐动作校验；`quality_gate_disable`/`test_deletion_to_force_pass`/`force_push`/`branch_creation`/`production_write` 为 deny 组，禁止关闭 Lint、删测试或忽略类型错误。

## 对应验证器
- 验证器 ID：`development.coding_compliance`
- 实现路径：`.uap/validators/development/index.mjs`
- 检查项：`[format, lint, typecheck, dead_code]`
- 返回结构：`{validator_id, status, executed, exit_code, checked_at, evidence_refs, findings, summary}`；PASS 只在 executed=true 且 exit_code=0 且无 BLOCKER 时成立。

## 输入和输出
| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 输入 | `AGENTS.md` / `web/AGENTS.md` | 仓库级与前端级编码约定（Common Code Quality / Backend Rules / §3.2 / §3.14） |
| 输入 | 变更文件清单（`scope`/`changed_files`） | 本次修改涉及的 Go 包与 `web/src/` 路径 |
| 输入 | `go.mod` / `web/package.json` | `go 1.27.3` 与前端脚本/依赖版本，决定兼容基线 |
| 输入 | `.uap/config/execution-mapping.yaml` | `execution_contract` 与 `failure_policy` |
| 输出 | `executorResult` | 含 `status`/`summary`/`changed_files`/`commands`/`evidence_refs`/`blocked_reasons` |
| 输出 | 门禁执行结果 | `gofmt`/`go vet`/`make test`/`typecheck`/`lint`/`dead_code` 的真实命令与退出码 |
| 输出 | `validatorResult` | `development.coding_compliance` 的 `checks_run` 与 `findings` |
| 输出 | `.uap/evidence/UAP-EV-*.json` | 命令、退出码、耗时、脱敏输出、`content_hash` 证据及索引行 |

## 失败处理
- `permission_denied`：命中 `project_write` 约束或 deny 组时停止编辑，任务迁移 `RUNNING → BLOCKED`，处置为 `block`，写 `blocked_reasons` 与审计事件；禁止通过 `git add -A`、`rm -rf` 或关闭检查绕过。
- `missing_dependency`：Go/Bun 工具链、`relaykit`/`tokenkit/tokenkit` 独立模块或 UAP-00-001 依赖不可用时迁移 `QUEUED → BLOCKED`，处置为 `block`；`fail_if_validator_missing: true` 使验证器缺失同样阻断。
- `validation_failed`：`format`/`lint`/`typecheck`/`dead_code` 任一 FAIL 或存在新增死代码时迁移为 `FAILED`，处置为 `repair_then_revalidate`，修复后必须重跑同一验证器并生成新证据，禁止直接改判 PASS 或忽略类型错误。
- `retryable`：命令瞬时失败按 `bounded_retry` 处理，重试上限 3 次（`execution.max_repair_attempts_per_root_cause: 3`），退避采用指数退避（1s → 2s → 4s），每次重试写独立 `evidence_id`；`WAITING_RECOVERY → QUEUED` 为合法续跑链，超限迁移 `FAILED`。
- `unrecoverable`：无法在现有架构边界内修复、或需降低门禁才能通过时迁移 `BLOCKED` 或 `FAILED`，处置为 `fail`，完整保留失败证据；`assertTransition()` 对非法边抛 `IllegalTransitionError`，`fail_closed: true` 禁止重置状态隐藏失败历史。

## 验收条件
> 基线原文：格式化通过；Lint 通过；类型检查通过；关键逻辑测试通过；无新增无效代码。

1. 格式化通过
2. Lint 通过
3. 类型检查通过
4. 关键逻辑测试通过
5. 无新增无效代码。

## 证据要求
- 证据目录 `.uap/evidence/`，索引 `.uap/reports/EVIDENCE-INDEX.md`；文件命名 `.uap/evidence/<evidence_id>.json`，ID 格式 `UAP-EV-<14位UTC时间戳>-<8位hex>`（`.uap/runtime/_lib/util.mjs` 的 `newId('UAP-EV')`）。
- 证据必须记录 `command`（如 `gofmt -l .`、`GOWORK=off go vet ./...`、`make test`、`bun run typecheck`、`./scripts/verify-all.sh`）、`exit_code`、`duration_ms`、`recorded_at`、`environment`（platform/node/cwd/uap_root）、`inputs`、`stdout`、`stderr`、`artifacts`、`findings`、`summary`、`content_hash`、`task_id`、`trace_id`、`specification_ids`（含 UAP-04-001）。
- `AGENTS.md`「Verification Evidence」要求的确切命令、退出码、通过/失败计数、失败测试名、改动文件、已知失败/跳过项均为证据必填；`scripts/verify-all.sh` 的 `step()` 输出（命令 + 退出码 + 耗时）作为原始日志引用。
- 证据 append-only：`writeEvidence()` 对同 ID 二次写入抛错，`verify()` 用 `content_hash` 校验，`resolveAll()` 校验 `evidence_refs` 有效；失败证据（Lint/类型/测试失败）不得删除或被新结果静默覆盖，禁止通过删测试制造通过。
- 敏感值经 `redact()` 脱敏，禁止把密钥、Token、密码、`.env` 内容写入 `stdout`/`stderr`/日志/报告；`evidence-engine.health()` 的 `secret_redaction` 自检必须为真。
- 报告必须能经 `.uap/reports/EVIDENCE-INDEX.md` 定位到每条门禁的原始记录；未真实执行的检查必须标注为未验证，状态保持 IMPLEMENTED_NOT_VERIFIED。

## 依赖标准
- `UAP-00-001`（UAP 核心架构规范）：提供分层边界、稳定接口、单一职责与可追溯性基线，规定任何规范必须有执行映射、任何执行器必须声明输入/输出/权限/失败状态，使编码规范的格式化与静态检查能够映射到 `development.coding_standard` 执行器与 `development.coding_compliance` 验证器，并约束代码修改遵守现有架构边界。
