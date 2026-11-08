> 生成日期：2026-11-07 ｜ 执行仓库：`/Users/lincolnhu/uter`（本地 `main` @ `ec6501adceb008d46140a7e5ab6508eb78006731`，未 push）
> 上游基线：UAES `main` @ `46c648836ee4cf06e285712ae2504da7ccab5602`（不可变发布基线：registry `1.12.0 / ACTIVE`，178 份标准正式发布；发布 commit `6c78ab50dc2b1adfedc035c88a70a906564318e4`，最终 pinned commit 为其后的收尾提交）
> 基准时刻：2026-11-07 21:30 +0800 之后；复审期间上游由并发会话连续刷新（3bc8285 → 6c78ab50 → 46c64883），Uter 治理入口已同步，证据见 evidence/governance-refresh-verification-final.log
> 证据目录：`reports/compliance/uaes-final-2026-11-07/evidence/`
> 纪律声明：本报告不含伪造的测试结果、批准或签署；`NOT_RUN` / `BLOCKED` 一律不计为 PASS；文档存在不等于符合性。
> **本轮结论：Uter 尚不能宣称「已全面按照 UAES 执行」。**

> **基线时序说明（重要）**：R-01～R-08 记录的是 20:41 时点的事实，当时 UAES 基线为 `3bc8285… / 1.9.0 APPROVED`。复审期间并发会话把 UAES 正式发布到不可变 commit、并连续刷新 pin 两次（`3bc8285` → `6c78ab50` → `46c64883`），最终基线为 `46c648836ee4cf06e285712ae2504da7ccab5602 / 1.12.0 ACTIVE`。因此 R-02 / R-06 中「统一到 1.9.0 APPROVED」等描述是**当时的历史动作**，不代表当前状态；R-09 记录发布后的二次收敛。所有报告头部已统一到最终基线。

# 4. UTER–UAES 整改与复验报告

每项含：问题编号 / UAES 标准 ID / 描述 / 方案 / 修改文件 / 验证方法与结果 / 剩余风险。

## R-01 本地分支未收敛到 main

- **标准 ID**：`UAES-11`（DevOps & Delivery）、`UTER-UAES-GOV-001` §6.3
- **描述**：HEAD 位于 `governance/uaes-full-migration-2026-11-06`，与 `main` 同提交 `ec6501adc`；用户指令要求合并本地所有分支到 main，且该分支名在多份治理文件中成为失效引用。
- **方案**：先备份全部 WIP（patch + 408 个未跟踪文件 tar + SHA256），`git checkout main`，确认 WIP 逐字节一致后 `git branch -d` 删除已完全合并分支；同步治理文件分支声明。
- **修改文件**：`.uaes/agent-governance.yaml`、`AGENTS.md`（Branch strategy 段）
- **验证**：`git status --porcelain | diff` → `WIP-IDENTICAL: yes`；`git for-each-ref refs/heads/` → 仅 `main`；`WIP` 计数收敛前后均 11 D / 140 M / 29 ??。
- **结果**：**PASS**（未 push、未创建 merge commit、未 deploy）
- **剩余风险**：并发会话若再次创建分支需重新收敛；已写入长期约定。

## R-02 UAES pin 指向不承载声明制品的旧 commit 且生命周期状态失真

- **标准 ID**：`UAES-00`（Foundation）、`UAES-00-004`（注册表与依赖）
- **描述**：pin `source_commit=0c9386b`，`verify-pin` 报 6/6 声明制品缺席；`registry_status=ACTIVE` 与当时（20:41 时点）的 UAES HEAD registry `1.9.0 / APPROVED` 不符。
- **方案**：刷新到 `3bc8285861b9c9c7ede63e6d9d08b508f1bd74b8`（实测 6/6 制品在 commit 中），状态纠正为 `APPROVED`，同步 21 处引用，重跑校验。
- **修改文件**：`.uaes/uaes-pin.json`、`INTEGRATION.md`、`TRACEABILITY.md`、`AI-GOVERNANCE-ENTRY.md`、`uter-governance-registry.yaml`、`UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md`、`AGENTS.md`、`.claude/skills/uaes-integration/SKILL.md`、`.uaes/agent-governance.yaml`
- **验证**：`node tools/uaes/integration-adapter.mjs verify-pin` → `ok=true, checked=6, missing=0, EXIT=0`；`uaes-pin-check.sh` EXIT=0；`uaes-integration-check.sh` EXIT=0
- **结果**：**PASS**
- **剩余风险**：上游工作区重新签名导致 digest 漂移（见 B-02），pin 与 ACTIVE 摘要当前不匹配。

## R-03 集成状态可被技术条件隐式提升（隐式批准漏洞）

- **标准 ID**：`UAES-01-003`（人工审批与升级）、`UAES-00`（`prohibit_implicit_approval`）
- **描述**：R-02 刷新后 `integrationStatus()` 仅凭「签名可验 + 需求全映射 + pin 匹配 + commit 承载制品」自动返回 `INTEGRATED` 并 exit 0，而 UAES 未发布、14 域门禁 0/14、42 项验收未签。
- **方案**：新增 `governanceAcceptanceEvidence()`，读取真实 L3/L4/人工验收/上游验证证据；`integrated` 增加「pin 显式声明 INTEGRATED」与「验收证据全 PASS」两道守卫；rationale 列出具体阻断原因。
- **修改文件**：`tools/uaes/integration-adapter.mjs`、`.uaes/reports/uaes-integration-status.json`（重新生成）
- **验证**：`node tools/uaes/integration-adapter.mjs status` → `EXIT=1`，`integration_status=MIGRATION_PENDING`，`pin_declares_integration=false`，`governance_acceptance.ok=false`，四项 checks 全 false；`node --test tools/uaes/integration-adapter.test.mjs` → 23/23 PASS
- **结果**：**PASS**
- **剩余风险**：守卫依赖 `reports/compliance/.../evidence/gates/` 证据文件；证据路径变更需同步更新。

## R-04 门禁断言与实现/上游数据不同步

- **标准 ID**：`UAES-09`（Quality Engineering）、`UAES-09-003`（测试策略）
- **描述**：整改前 `test-uaes-pin-check.rb` 1 项失败（脚本已允许 `APPROVED or ACTIVE`，断言仍为旧文案）；上游 requirements registry 由 590 条扩至 2132 条、13/13 域覆盖，导致 adapter 测试 4 项失败。
- **方案**：同步断言到真实规则；把绑定旧数据状态的断言改为**行为不变量**，并新增合成负向用例（1/13 域有需求时 `fully_covered` 必须为 false）；使测试对上游 digest 漂移稳健且仍能检测漂移。
- **修改文件**：`scripts/quality/test-uaes-pin-check.rb`、`tools/uaes/integration-adapter.test.mjs`
- **验证**：整改前治理门禁 7/8、adapter 19/23；整改后治理门禁 **8/8**、adapter **23/23**（`node --test` EXIT=0）
- **结果**：**PASS**
- **剩余风险**：无（负向能力已由合成用例保留）。

## R-05 订单状态迁移改为条件更新（规范口径对齐 / 纵深防御，非并发缺陷修复）

- **标准 ID**：`UAES-10`（Security & Reliability）、`UAES-10-011`（支付安全）、`docs/ai-specs/DATABASE-STANDARD.md:282`
- **定性修正（撤回初版结论）**：初版把本路径记为「SQLite 下全字段覆盖窗口 / 并发竞态，P2」。**该定性不成立，予以撤回**。复核 `common/database.go:48-64`：默认 DSN 含 `_pragma=busy_timeout(30000)` + `journal_mode(WAL)` + `_txlock=immediate`，`BEGIN IMMEDIATE` 在事务开始即取写锁，写事务串行化；MySQL/PostgreSQL 由 `lockForUpdate` 生成 `FOR UPDATE`；`DATABASE-STANDARD.md:282` 亦写明「SQLite 跳过（行锁），依赖单写者模型」。在受支持的默认配置下两个并发回调不可能同时读到 `pending`，后到者看到的是已提交状态。完整核实链见 `evidence/BUSINESS-AUDIT-CORRECTION-2026-11-07.md`。
- **真实问题（重分类为 P3 一致性改进）**：① 与 `DATABASE-STANDARD.md:282`「条件更新 + RowsAffected 判定」范式不一致；② 原实现的正确性隐式依赖 DSN 的 `_txlock=immediate`，而 `common/init.go:61-63` 允许 `SQLITE_PATH` **无校验**覆盖，若运维提供不含该参数的 DSN，读-改-写路径会重新暴露 `SQLITE_BUSY_SNAPSHOT` / 陈旧写回风险；③ 整行 `tx.Save` 会写回兄弟字段。
- **治理分类（高风险领域）**：`AUTO-FIX-STANDARD.md:115` 明确「支付、余额及计费修复属于高风险领域，必须执行专项测试和额外审查」。本改动按高风险流程处理：专项测试已执行，**额外审查未完成（`NOT_RUN`）**，不得记为闭环。
- **方案**：改为 `Where(trade_no = ? AND status = 'pending').Update("status", targetStatus)`，由数据库决定唯一胜者；`RowsAffected != 1` 返回 `ErrTopUpStatusInvalid`；不再整行 Save。同步改写 `model/topup.go:291-299` 注释，删除已撤回的竞态断言。
- **修改文件**：`model/topup.go`（实现 + 注释）、`model/topup_status_retry_test.go`（追加 2 个确定性回归测试）
- **验证**：`gofmt -l model/topup.go model/topup_status_retry_test.go` → 无输出 EXIT=0；`go test ./model/ -run 'TestUpdatePendingTopUpStatus|TestRechargeTopUpDistinguishes|TestClaimPendingTopUp' -count=1` → `ok github.com/uter-ai/uter/model 1.923s` EXIT=0；两个新测试分别验证「首次 pending→expired 成功、二次 pending→failed 返回 `ErrTopUpStatusInvalid`、兄弟字段未被整行覆盖」与「provider guard 仍返回 `ErrPaymentMethodMismatch`」。
- **结果**：**PASS（代码与专项测试）／PARTIAL（治理闭合）** —— 额外审查未由人类/独立审查人完成，不计 PASS。
- **剩余风险**：额外审查 `NOT_RUN`（B-11）；`SQLITE_PATH` 配置门禁未实现（B-11）；订阅侧 `CompleteSubscriptionOrder` 仍为读-改-写 + 整行 Save（B-12，默认配置下无已证实竞态，本轮不擅自扩大资金改动面）；并发 goroutine 交错未单独建模；未做任何生产资金操作。

## R-06 失效引用与过时知识

- **标准 ID**：`UAES-03`（Knowledge Engineering）
- **描述**：删除执行分支后 `AGENTS.md`、`.uaes/agent-governance.yaml`、`.claude` 适配器仍指向该分支或多套 UAES commit（`0c9386b` / `ff7cf878`）；`AGENTS.md` 分支策略仍要求「不得直接修改 main」，与单分支模式及本轮授权冲突。
- **方案**：21 处精确替换（预校验匹配数后才写入），统一到当时的 `3bc8285861b9c9c7ede63e6d9d08b508f1bd74b8` 与 `1.9.0 / APPROVED`（后由 R-09 二次收敛到发布基线）；分支策略改写为单分支模式并保留全部禁止项。历史证据文件（`reports/compliance/**/evidence/`）**未改写**，保持 append-only。
- **修改文件**：见 R-02 列表
- **验证**：`ai-specs-check.sh` EXIT=0；`uaes-integration-check.sh` EXIT=0；`test-ai-governance-policy.rb` EXIT=0
- **结果**：**PASS**
- **剩余风险**：历史报告中的旧 commit 仍为当时快照，已在报告中注明口径差异。

## R-07 上游 ACTIVE 声明的证据争议未披露

- **标准 ID**：`UAES-00`（Foundation）、`UAES-01-003`
- **描述**：UAES `spec-registry` 字面声明 `UAES-SPEC-CORE@2.0.0 ACTIVE` 且 sshsig 可验，但 `release-history.json` 更正记录 `UAES-REL-2026-006` 指出 `release_gate_result=PASS` 为字面量、`checks_total=0`、无门禁运行支撑，`verification_status=UNVERIFIED`。
- **方案**：在 pin `notes` 与本报告如实披露，不单方裁决、不据此宣称上游已正式发布。
- **修改文件**：`.uaes/uaes-pin.json`
- **验证**：pin 字段复核；`uaes-pin-check.sh` EXIT=0
- **结果**：**PASS（披露型整改）**
- **剩余风险**：需 UAES 授权方在授权环境完成签名与门禁实跑（B-01）。

## R-08 原有 AI 规范无逐文件处置记录

- **标准 ID**：`UAES-03`、`UAES-00`
- **描述**：18 份本地 AI 规范此前无 keep/migrate/deprecate 台账；用户要求「无法确定是否重复：保留并标记，经过审查后再处理」。
- **方案**：建立 `.uaes/AI-SPEC-DISPOSITION-REGISTRY.yaml`，逐文件登记语义对齐分类、UAES 对应标准、Uter 特有内容、删除前置条件满足度与处置决定；**不删除任何文件**（UAES 五项前置 1/5 满足，且 `ai-specs-check.sh` 硬阻断）。
- **修改文件**：`.uaes/AI-SPEC-DISPOSITION-REGISTRY.yaml`（新增）、`UTER-AI-SPEC-MIGRATION-REPORT.md`
- **验证**：`ai-specs-check.sh` EXIT=0（新增文件不破坏门禁）
- **结果**：**PASS（受上游阻断的部分整改）**
- **剩余风险**：`approved_lifecycle` 前置已因上游发布满足（1/5），但语义对齐、项目映射、运行时发现、CI 强制 4 项仍缺，且 `ai-specs-check.sh` 硬依赖这些文件；删除仍被禁止。

## R-09 上游发布后 pin 刷新导致治理入口失配（复审新发现）

- **标准 ID**：`UAES-00-004`（注册表与依赖）、`UAES-03`（Knowledge Engineering）、`UAES-11`（DevOps & Delivery）
- **描述**：最终复审 `re-audit.log` 中 `PIN_CHECK_EXIT=1`、`INTEGRATION_CHECK_EXIT=1`。根因不是本轮代码回退，而是并发会话在 20:56 把 UAES 发布到不可变 commit `6c78ab50…`（registry `1.12.0 / ACTIVE`）并刷新 pin，随后又在 21:31 收敛到最终 commit `46c648836…`；本轮先前写下的 8 份治理入口仍指向 `3bc8285… / 1.9.0 APPROVED`，被 `uaes-pin-check.sh` 的交叉校验如实阻断。
- **方案**：不回退并发会话的 pin（发布是正确的上游演进），而是把 8 份治理入口同步到最终 pinned commit / registry blob / 版本 / 生命周期；重写 `INTEGRATION.md`、`AI-GOVERNANCE-ENTRY.md`、`TRACEABILITY.md` 的叙述，准确区分「发布 commit `6c78ab50…`」与「最终 pinned commit `46c648836…`」；明确记录发布签名的单机职责分离例外未裁决、UAES 工作区仍有 4 项未提交改动；修改前副本存入 `evidence/governance-before-refresh/`。
- **修改文件**：`.uaes/INTEGRATION.md`、`.uaes/AI-GOVERNANCE-ENTRY.md`、`.uaes/TRACEABILITY.md`、`.uaes/uter-governance-registry.yaml`、`.uaes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md`、`.uaes/AI-SPEC-DISPOSITION-REGISTRY.yaml`、`AGENTS.md`、`.claude/skills/uaes-integration/SKILL.md`；10 份报告头部同步
- **验证**：`evidence/governance-refresh-verification-final.log` → `PIN_CHECK_EXIT=0`、`INTEGRATION_CHECK_EXIT=0`、`AI_SPECS_CHECK_EXIT=0`、`VERIFY_PIN_EXIT=0`（`checked=6, missing=[]`）；`integrationStatus()` 在 `technical_preconditions_met=true` 下仍返回 `MIGRATION_PENDING`、`ADAPTER_STATUS_EXIT=1`，四项验收证据全 false
- **结果**：**PASS（门禁恢复）／结论不变（仍不得宣称符合）**
- **剩余风险**：上游若继续刷新 pin 需再次收敛；发布签名职责分离例外与 `verification_status=UNVERIFIED` 属 UAES Authority 裁决范围（B-01/B-02），本轮不代裁、不代签。

## 复验汇总

| 类别 | 整改前 | 整改后 |
|---|---|---|
| 治理门禁（8 项） | 7 PASS / 1 FAIL | **8 PASS / 0 FAIL** |
| adapter 测试 | 19/23 | **23/23** |
| verify-pin | 6/6 missing | **0/6 missing** |
| 本地分支 | 2（含 1 执行分支） | **1（main）** |
| 未提交 WIP | 180 项 | **180 项（逐字节未变）** |
| L3 / L4 门禁 | 0/14、9/16 | **0/14、9/16（未虚报改善）** |
| 全量 `verify-all.sh` | 未执行 | **EXIT=1，8 PASS / 3 FAIL / 0 SKIP（如实未通过）** |
| 上游发布后契约一致性（R-09） | 2 个静态门禁 FAIL | **4/4 静态门禁 EXIT=0；`integration_status` 仍 `MIGRATION_PENDING`（守卫有效）** |

## 附：2026-11-07 修复后复审增补

> 本节追加于 2026-11-07 23:15 CST。正文保留 21:45 前的实测状态作为历史证据；
> 最新事实与逐条「被更新 / 仍不变」判定见同目录
> `UTER-POST-FIX-REEVALUATION-2026-11-07.md`，证据在 `evidence/`。

- 更新末表「全量 `verify-all.sh`」行：由 `EXIT=1，8 PASS / 3 FAIL` 改为 **12 PASS / 0 FAIL / 0 SKIP、`EXIT=0`**。
- **新增两项整改**：① `uter-quality.sh::compute_verdict()` 跨阶段状态污染 → 按当前阶段统计，`full` 严格度不变，守卫 7/16/0；② `verify-all.sh` 缺 `//go:embed` 前置 → 新增幂等非破坏性 `ensure-go-embed-artifacts.sh`，守卫 7/32/0，四模块 `go vet` 全 EXIT=0。
- 两项均属门禁逻辑/入口治理变更，**额外审查仍 `NOT_RUN`**，不计为已验收。

**统一不变项**：L3 域门禁 0/14 PASS、L4 全局门禁 9/16 MET（BLOCKED）、
42 项人工验收 0/42 签署、无任何 `APPROVED_EXCEPTION`、**仍不得宣称 Uter 已全面按照 UAES 执行**。
本轮未 commit / push / merge / 部署 / 改 UAES 仓库 / 生成签名 / 代填验收。
