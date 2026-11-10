# Uter × AES 修复后复审增补（2026-11-07 22:44–23:15 CST）

> 本文件是 `aes-final-2026-11-07/` 下 10 份指定命名报告的**附注**，不替代任何一份报告。
> 10 份报告正文记录的是 2026-11-07 21:45 之前的实测状态，作为历史证据**保持原样**；
> 本附注给出随后「真实执行可自主完成的门禁与验证并修复真实缺陷」一轮的新事实，
> 并逐条标明哪些结论被更新、哪些**仍然不变**。
> 证据目录：`reports/compliance/aes-final-2026-11-07/evidence/`。

## 1. 授权边界（与正文一致，未扩大）

本轮只做可自主完成的**代码缺陷修复与真实验证**。未 commit / push / merge / 创建 PR / 部署；
未改动 AES 仓库任何文件；未改动生产配置、资金数据或凭据；未生成任何数字签名；
未代填 42 项人工验收签字；未把任何 `NOT_RUN` / `TIMEOUT` 记为 PASS；未提升任何生命周期状态。

## 2. 两个真实缺陷的修复与回归

### 2.1 UEQE `compute_verdict()` 跨阶段状态污染（B-13 ③，已修复）

- **根因**：`scripts/quality/uter-quality.sh` 的 `compute_verdict()` 无条件扫描
  `.quality/.state/` 下**全部六个阶段**的 `.status`，单阶段执行（如 `security`）会被其他
  阶段遗留的 `FAILED` / `NOT_RUN` 污染成假阴性。
- **修复**：单阶段只统计本阶段 `.status`；`full` 仍统计全部六阶段，严格度未放宽，
  `FAILED` / `BLOCKED` / `NOT_RUN` 依旧阻断；无子项仍判 FAIL（fail-closed）。
- **守卫**：`scripts/quality/test-ueqe-verdict-scope.rb`（从生产脚本提取真实函数体执行）
  → `7 runs, 16 assertions, 0 failures, EXIT=0`。
- **真实回归**：`bash scripts/quality/uter-quality.sh security` → `EXIT=0`，
  `verdict: PASS`，7 个 `security.*.status` 全 PASSED。日志
  `evidence/ueqe-security-rerun.log`。

### 2.2 `verify-all.sh` 缺 `//go:embed` 前置产物（B-13 ①，已修复）

- **根因**：CI 的后端作业在 `go vet` 前调用 `scripts/make-frontend-placeholder.sh`；
  本地统一门禁 `scripts/verify-all.sh` **漏了这一步**。`main.go` 有两条 embed 指令
  （`web/dist/index.html` 与 `all:web/dist/docs-content/_next`），两者都要求目标在编译期存在，
  于是 Go 代码本身无问题时仍报 `no matching files found`。属构建前置条件缺陷，非 Go 代码缺陷。
- **修复**：新增 `scripts/quality/ensure-go-embed-artifacts.sh` 并在 `verify-all.sh` 的
  Go 后端段**之前**新增 `Go embed 前置产物` 步骤。该 helper 与 CI 脚本不同，是
  **幂等且非破坏性**的：已有真实 `index.html` 或已有任意 `_next` 文件一律原样保留，
  只在确实缺失时补空骨架；空骨架仅用于 `//go:embed` pattern 解析，**不代表前端构建通过**。
- **守卫**：`scripts/quality/test-verify-all-embed-precondition.rb` →
  `7 runs, 32 assertions, 0 failures, EXIT=0`（校验顺序、全量仍真跑 go vet、不覆盖真实产物、
  缺产物时两条 pattern 均可解析、二次运行幂等、`bash -n`）。
- **真实回归**：`evidence/gate-fix-regression-2026-11-07.log` →
  `ENSURE_EXIT=0`；根模块 / relaykit / tokenkit / tokenkit/tokenkit 四个模块 `go vet`
  **全部 `EXIT=0`**。生成真实前端产物后又复跑一次根模块 `go vet` → `EXIT=0`。
- **未放宽的核对**：`make test` 按 `makefile:43-47` 本就排除根包（`grep -vxF "$root_module"`），
  故 `main_docs_test.go` 的 `isPlaceholderFrontend()` 跳过行为与本轮改动前**完全一致**，
  没有新增任何被跳过的用例。前端产物完整性仍由 `build:check` 单独负责。

### 2.3 前端构建环境（B-13 ②，本轮已具备可复现的通过路径）

- `scripts/quality/aes-test-matrix.sh` 的 L2-07 已有宿主构建整理（`mv web/dist` 到临时目录
  后再构建），可规避安全删除包装器对 rsbuild 清理旧产物的拦截。
- 完整矩阵复跑：`bun run build:check` **`EXIT=0` / 21s**，随后按项目自身的
  `docs-web/scripts/copy-to-web.mjs` + `verify-docs-artifacts.sh` 恢复文档静态导出，
  校验 `docs artifact verification passed`。真实产物 `web/dist/index.html`（3482 B）
  与 `web/dist/docs-content/_next` 均已落盘。
- 全量 `./scripts/verify-all.sh` 在**同样的一次性宿主整理**下完成：
  **`12 PASS / 0 FAIL / 0 SKIP，EXIT=0`**（`evidence/verify-all-full-after-fix.log`）。
  分项含 `Go embed 前置产物 PASS`、`Go vet PASS`、`make test PASS`、`vitest PASS (317s)`、
  `build:check PASS (26s)`、`安全扫描 (UEQE security) PASS (81s)`。
- ⚠️ **残留条件**：该次通过依赖「先把已存在的 `web/dist` 移开」这一一次性宿主整理。
  在 `web/dist` 已被填满的工作区里**直接**调用 `verify-all.sh`，`build:check` 仍可能
  触发安全删除包装器而长时间无进展。建议由平台工程把矩阵里已验证的整理动作并入
  `verify-all.sh`，或在干净环境执行；本轮**没有**据此宣称环境问题已永久消失。

## 3. 新鲜证据下的门禁结论（2026-11-07 15:12Z 重跑）

| 项目 | 结果 | 证据 |
|---|---|---|
| 完整测试矩阵（非 `--quick`） | `total=29 passed=28 failed=1 skipped=0`，唯一失败 `L1-16` | `evidence/test-matrix-full-rerun.log`、`evidence/test-matrix.json` |
| L1_CHANGE_GATE | **FAIL 17/18**（仅 `L1-16` 失败） | `evidence/gates/l1-l2-gates.json` |
| L2_INTEGRATION_GATE | **PASS 9/9** | 同上 |
| L3 域验收（13 AES + UTER-P13） | **BLOCKED 0/14 PASS** | `evidence/gates/l3-domain-gates.json`、`GATES-SUMMARY.md` |
| L4 全局符合性 | **BLOCKED 9/16 MET**（7 NOT_MET） | `evidence/gates/l4-global-gate.json` |
| D26 独立评估 | `COMPLETED re_evaluation=5/7`，`open_findings=6`，`conformance_claim_supported=false` | `evidence/independent-assessment.json` |
| 静态治理门禁 | `PIN_CHECK_EXIT=0` / `INTEGRATION_CHECK_EXIT=0` / `AI_SPECS_CHECK_EXIT=0` | `evidence/gate-reevaluation-final-2026-11-07.log` |
| `verify-all.sh --quick` | `EXIT=0`，8 PASS / 0 FAIL / 4 SKIP（快速模式非权威） | `evidence/verify-all-quick-after-fix.log` |
| `verify-all.sh` 全量 | `EXIT=0`，12/12 PASS（带 §2.3 宿主整理前提） | `evidence/verify-all-full-after-fix.log` |

> 说明：中途一次 `--quick` 矩阵复跑曾把完整矩阵证据覆盖为仅 L1（L2 一度显示 0/0），
> 随后已用**完整矩阵复跑**刷新为同一批新鲜结果；中间态另存
> `evidence/test-matrix-quick-only-2026-11-07.json` 与 `evidence/test-matrix-quick-rerun.log`，
> 未用于最终判定。

## 4. 仍然不变的核心结论（**不得据此宣称全面符合**）

- 42 项人工验收仍 **0/42 签署**，`acceptance_decision=PENDING_ITEM_BY_ITEM_REVIEW`；
  `acceptance-authority.json` 中「blanket 代签」与 `signoff_scope="等我逐项复核后决定"`
  自相矛盾，gate 的 fail-closed 判定正确，未作粉饰。
- 14 个 L3 域门禁仍全部 BLOCKED；L4 仍 7 项 NOT_MET（`L4-05/06/09/10/11/12/13`）。
- B-01..B-12 全部未解除（发布签名职责分离裁决、`verification_status=VERIFIED` 证据刷新、
  14 域门禁、42 项签批、独立评估 6 项发现、资金修复额外审查、`SQLITE_PATH` 配置门禁等）。
- **B-13（全量门禁三项失败）本轮已用真实复跑关闭，但两项门禁逻辑/构建入口改动仍属
  治理变更，按 `AUTO-FIX-STANDARD.md:115` 与 B-11 需「额外审查」；该审查不得由执行代理代做，
  状态仍为 `NOT_RUN`，不得视为已验收。**
- `integrationStatus()` 在 `technical_preconditions_met=true` 下仍返回 `MIGRATION_PENDING`，
  隐式批准守卫未被绕过。

## 5. 新增阻断：L1-16 / W1 任务作用域越界（需项目 Owner 决策）

`aes-agent-runtime-check.rb workspace` 的 W1 控制**正确检出** 7 条不在
`agent-runtime-task.json`（2026-11-06 声明）`scope` 内的新路径，因此 `L1-16=FAIL`，
并连带 P01 / P08 / P09 仍标 `automated checks not passing`：

| 路径 | 来源 |
|---|---|
| `model/topup.go`、`model/topup_status_retry_test.go` | 上一轮业务审计的 `UpdatePendingTopUpStatus` 纵深防御改动 |
| `tools/` | AES 集成适配器及其测试（20:48–20:51） |
| `common/init.go`、`docs/ai-specs/DATABASE-STANDARD.md`、`common/sqlite_dsn_override_test.go` | 并发会话 22:32–22:33 的 `SQLITE_PATH` 配置门禁 WIP（**非本轮改动**） |
| `scripts/verify-all.sh` | 本轮 §2.2 的门禁前置步骤改动 |

**执行代理未自行 widening scope 来把 W1 变绿**——那等于用改写声明规避控制。
请项目 Owner 二选一并留证：①按 §13.4 出具带 authority 与 review date 的
`APPROVED_EXCEPTION` / 书面作用域扩展，逐条说明上表路径确属授权任务足迹；
②要求相应作者回退这 7 条越界改动。无论哪一种，L3 0/14 与 42 项签批仍独立阻断，
**不会**因此得到 CONFORMANT 结论。

## 6. V-07 / V-08 仍未执行（上游侧，属任务 #13）

AES `quality/scripts/aes/independent-verifier.mjs verify --execute` 是唯一能把
V-07/V-08 从 `NOT_RUN` 推进的入口。本轮**未执行**，理由如实登记：
① 它会在 `aes-verification` 命名空间对判定签名，执行代理不得产出「独立验收人」签名；
② 它会向 AES 仓库 `reports/governance/` 写入新报告，超出用户「产品侧在 Uter 项目中进行」边界；
③ 目录含 20 条命令，其中多项依赖宿主构建整理。需 AES Authority 在授权环境执行。
相关 Uter 侧门禁与 `evidence/` 已刷新，但不替代上游独立验证。

## 7. 本轮文件与证据清单

**修改**：`scripts/verify-all.sh`（新增 embed 前置步骤 + 头部说明）、
`scripts/quality/uter-quality.sh`（`compute_verdict` 作用域修复）。
**新增**：`scripts/quality/ensure-go-embed-artifacts.sh`、
`scripts/quality/test-ueqe-verdict-scope.rb`、
`scripts/quality/test-verify-all-embed-precondition.rb`、本附注。
**证据**：`gate-fix-regression-2026-11-07.log`、`ueqe-security-rerun.log`、
`test-matrix-quick-rerun.log`、`test-matrix-full-rerun.log`、
`gate-reevaluation-2026-11-07.log`（中途态）、`gate-reevaluation-final-2026-11-07.log`、
`verify-all-quick-after-fix.log`、`verify-all-full-after-fix.log`、
`results-tsv-before-2026-11-07-rerun.tsv`、`test-matrix-quick-only-2026-11-07.json`，
以及被刷新的 `reports/compliance/aes-full-migration-2026-11-06/evidence/` 下
`test-matrix.json`、`matrix/results.tsv`、`gates/*.json`、`GATES-SUMMARY.md`、
`agent-runtime-{preflight,workspace,selftest}.json`、`independent-assessment.json`。
