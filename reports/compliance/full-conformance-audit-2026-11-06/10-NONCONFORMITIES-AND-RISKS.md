# 不符合项及风险清单

- **Document:** `10/14` of §11 (14 mandated deliverables)
- **Generated:** 2026-11-06T17:41:59Z
- **Uter commit SHA:** `ec6501adceb008d46140a7e5ab6508eb78006731`
- **UAES commit SHA:** `0c9386b192090e901ccc5de6df1f2aebe3f5c618`
- **Execution environment:** macOS-26.7.2-x86_64-i386-64bit-Mach-O
- **Collector:** WorkBuddy (Tencent Hunyuan Hy)
- **Evidence root:** `reports/compliance/full-conformance-audit-2026-11-06/evidence/`

> 本文件由真实仓库状态与真实命令退出码生成。未执行的验证一律记为 `NOT_RUN` / `BLOCKED`，
> 绝不以文档、代码改动或 Agent 自述代替工程验证（§12 / §13）。

---


共 13 条，其中未解决 P0/P1：`FIND-FCA-001, FIND-FCA-002, FIND-FCA-003, FIND-FCA-004, FIND-FCA-009, FIND-FCA-011`。
完整机器可读版本：`evidence/07-findings-register.json`。

| ID | 级别 | 状态 | 标题 | 影响 | 所需授权 |
|---|---|---|---|---|---|
| FIND-FCA-001 | P0 | OPEN | UAES 规范性基线未被逐条批准，无法作为正式符合性基准 | 29 条适用要求全部 BLOCKED；CONFORMANT 不可达。 | UAES Owner / 规范批准权限 |
| FIND-FCA-002 | P1 | OPEN | 无逐条实现映射与逐条验证，requirement-specific PASS 为 0 | 2880 条要求中逐条验证数为 0；任何单条 PASS 均无证据支撑。 | 项目 Owner 排期 / 工程资源 |
| FIND-FCA-003 | P1 | OPEN | 42 项人工验收未被验收负责人逐项接受 | item_count=42，VERIFIED=0，signoff_granted=False；BUSINESS_ACCEPTANCE_GATE 与 L4 BLOCKED。 | 项目 Owner（用户本人） |
| FIND-FCA-004 | P1 | OPEN | 需要授权运行环境的安全/可靠性验证仍未执行（本地可修复部分已闭环） | SECURITY_GATE BLOCK；§6 多项要求不可判定。本地可修复项（MA-06/MA-12）已在本轮闭环并复测。 | 安全测试授权 / 运行环境 / 产品会话配置 |
| FIND-FCA-005 | P2 | FIXED / REVALIDATED | 构建与静态分析既有失败已全部闭环（无断言放宽、无豁免） | 三项均以原始命令真实复跑 PASS；未删测试、未放宽断言、未改写状态。 | 无（用户已裁定环境修复路径） |
| FIND-FCA-006 | P2 | FIXED / REVALIDATED | 本轮审计引擎 4 个真实缺陷（漏记中文要求、状态解析、P13 空域、commit 绑定） | 要求数 1592 → 2880；DRAFT 45/178 → 178/178；P13 0 → 29；matrix_commit_sha 由 null 变为真实 SHA。 | 无（Uter 侧工具缺陷） |
| FIND-FCA-007 | P2 | DISCLOSED / SUPERSEDED | 历史报告 reports/compliance/FINAL-COMPLIANCE-REPORT.md 状态过期 | 不改写历史证据；新审计包以当前真实基线为准。 | 无 |
| FIND-FCA-008 | P3 | DISCLOSED | UAES reports/ 下历史 UAES-P13-* 命名易与 UTER P13 混淆 | UAES 通用规范目录中 P13 命中为 0；不违反双仓库分别治理。 | UAES Owner |
| FIND-FCA-009 | P1 | OPEN | 14 域 L3 与 L4 全局门禁仍 BLOCKED | RELEASE_GATE / GLOBAL_UAES_CONFORMANCE_GATE 阻断；禁止 commit/push/PR/merge/deploy。 | 验收负责人 + UAES Owner |
| FIND-FCA-010 | P3 | CLOSED BY JUSTIFICATION | 12 条 N/A 引用行 | 不构成义务；每条均附书面适用性依据（§10）。 | 无 |
| FIND-FCA-011 | P1 | OPEN | 八类质量门禁中存在 BLOCK 结果 | §8 门禁未全部放行；每个门禁的负向阻断测试已真实执行。 | 同上 |
| FIND-FCA-012 | P2 | FIXED / REVALIDATED | 审计执行层 harness() 无法解析纯文本子命令输出，AG-07/08/09 被误判 FAIL | 修复前 agent 10 例 7 PASS / 3 FAIL（全部为解析误判，非真实绕过）；底层控制全部有效（两个绕过尝试均被 DENY exit 2）。 | 无（审计器自身缺陷） |
| FIND-FCA-013 | P2 | OPEN / EXTERNAL ACTION | 执行分支出现完整验证前的 commit（非本审计会话所为），workspace W3 保持 fail-closed FAIL | workspace W3 FAIL → 矩阵 L1-16 FAIL → L1 17/18；L1/L2 层因此未能全绿。交付门禁保持关闭（无 push/PR）。 | 项目 Owner（用户本人） |


### 每条的完整信息（位置 / 根因 / 证据 / 整改）

#### FIND-FCA-001 — UAES 规范性基线未被逐条批准，无法作为正式符合性基准

- 级别/状态：`P0` / `OPEN`
- 位置：UAES `.uaes/APPROVAL-RECORD.md` §4；`standards/**` 178/178 DRAFT；`.uaes/registry/gates.yaml` 13 gates NOT_RUN
- 根因：Registry 1.9.0 APPROVED 只代表注册表基线；APPROVAL-RECORD §4 明确未批准 304 个 DRAFT 条目、未执行 13 个 L3 域门禁、未声称 Uter 合规。
- 影响：29 条适用要求全部 BLOCKED；CONFORMANT 不可达。
- 证据：`evidence/00-baseline.json`, `evidence/01-conflict-register.json (CONF-005)`
- 整改：由 UAES Owner 正式批准条目与执行 13 个 L3 gates；不得由 Uter 侧代改。
- 复测：`NOT REVALIDATED`

#### FIND-FCA-002 — 无逐条实现映射与逐条验证，requirement-specific PASS 为 0

- 级别/状态：`P1` / `OPEN`
- 位置：evidence/02-compliance-matrix.json 的 implementation_location / verification_method 字段
- 根因：仓库只有域级命令与域级门禁；域级命令对单条规范只是 INDIRECT 证据，不能证明任何单条要求。
- 影响：2880 条要求中逐条验证数为 0；任何单条 PASS 均无证据支撑。
- 证据：`evidence/02-compliance-matrix.json`, `evidence/04-engineering-verification.json`
- 整改：为每条适用要求建立 implementation mapping + requirement-specific verification case + 原始退出码证据。
- 复测：`NOT REVALIDATED`

#### FIND-FCA-003 — 42 项人工验收未被验收负责人逐项接受

- 级别/状态：`P1` / `OPEN`
- 位置：evidence/manual-acceptance/inventory.json、acceptance-authority.json
- 根因：用户已明确「等我逐项复核后决定」；Agent 不得代签、不得把本地 PASS 自动升级为 VERIFIED。
- 影响：item_count=42，VERIFIED=0，signoff_granted=False；BUSINESS_ACCEPTANCE_GATE 与 L4 BLOCKED。
- 证据：`reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/inventory.json`, `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/acceptance-authority.json`
- 整改：由项目 Owner / Acceptance Authority 逐项复核并签署；签署后重跑门禁。
- 复测：`NOT REVALIDATED`

#### FIND-FCA-004 — 需要授权运行环境的安全/可靠性验证仍未执行（本地可修复部分已闭环）

- 级别/状态：`P1` / `OPEN`
- 位置：DAST / 渗透 / API 安全 / 三库迁移 / DR / 备份恢复 / 性能测试 NOT_RUN；鉴权页 axe 扫描因管理员禁用密码登录而显式 skip
- 根因：这些验证需要授权运行环境（DAST 工具、三库环境、真实备份目标、压力负载）或产品侧会话配置；本地已无工具链类阻塞（axe 已安装并真实执行）。
- 影响：SECURITY_GATE BLOCK；§6 多项要求不可判定。本地可修复项（MA-06/MA-12）已在本轮闭环并复测。
- 证据：`evidence/04-engineering-verification.json`, `evidence/06-gates-verification.json`, `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/findings.json`, `web/e2e/axe/authed.spec.ts`
- 整改：由授权环境执行 DAST/渗透/三库迁移/DR/备份恢复/性能验证；鉴权页 axe 扫描需产品开放密码登录或提供 OAuth 测试会话。
- 复测：`PARTIAL: local toolchain items revalidated PASS`

#### FIND-FCA-005 — 构建与静态分析既有失败已全部闭环（无断言放宽、无豁免）

- 级别/状态：`P2` / `FIXED / REVALIDATED`
- 位置：MA-09 knip、MA-10 docs-web build、MA-11 electron build；修复记录见 evidence/08-remediation-register.json FIX-06..FIX-08
- 根因：MA-09 knip 复跑 PASS（本审计未做任何清理动作）；MA-10 受宿主 safe-delete 批量删除拦截（旧 .next 产物）；MA-11 为 Electron 运行时下载网络超时（镜像吞吐 ~47KB/s，撞 600s 请求超时）。
- 影响：三项均以原始命令真实复跑 PASS；未删测试、未放宽断言、未改写状态。
- 证据：`evidence/04-engineering-verification.json`, `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/execution.json`, `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-10.log`, `reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-11.log`
- 整改：FIX-06 mv 卫生预置；FIX-07 8 路并行续传下载并 SHA-256 校验后种子 @electron/get 缓存；FIX-08 安装 axe 工具链并修复真实违规。
- 复测：`REVALIDATED: collector final run all local checks PASS`

#### FIND-FCA-006 — 本轮审计引擎 4 个真实缺陷（漏记中文要求、状态解析、P13 空域、commit 绑定）

- 级别/状态：`P2` / `FIXED / REVALIDATED`
- 位置：scripts/quality/full-conformance-audit.py
- 根因：初版只匹配英文 MUST/SHALL；只解析 `**Status:**`；P13 为中文；D19 使用 `uter_commit` 键。
- 影响：要求数 1592 → 2880；DRAFT 45/178 → 178/178；P13 0 → 29；matrix_commit_sha 由 null 变为真实 SHA。
- 证据：`evidence/bugfix/02-compliance-matrix.BEFORE.json`, `evidence/bugfix/02-compliance-matrix.AFTER.json`, `evidence/01-conflict-register.json (CONF-007)`
- 整改：已修复：双语匹配 + SHOULD + 引用行、standard_meta()、P13 中文抽取、uter_commit 绑定；覆盖账本逐行对账。
- 复测：`REVALIDATED: py_compile OK + 三次真实重跑 + BEFORE/AFTER hash`

#### FIND-FCA-007 — 历史报告 reports/compliance/FINAL-COMPLIANCE-REPORT.md 状态过期

- 级别/状态：`P2` / `DISCLOSED / SUPERSEDED`
- 位置：reports/compliance/FINAL-COMPLIANCE-REPORT.md
- 根因：该报告基于 PR #15 基线写 UAES registry DRAFT / 13 gates NOT_RUN。
- 影响：不改写历史证据；新审计包以当前真实基线为准。
- 证据：`evidence/01-conflict-register.json (CONF-004)`
- 整改：标记 SUPERSEDED，保留原文以供复核。
- 复测：`DISCLOSURE VERIFIED`

#### FIND-FCA-008 — UAES reports/ 下历史 UAES-P13-* 命名易与 UTER P13 混淆

- 级别/状态：`P3` / `DISCLOSED`
- 位置：UAES 仓库 reports/（非 standards/、非 .uaes/registry/）
- 根因：Repository Integration 阶段派生报告的历史命名。
- 影响：UAES 通用规范目录中 P13 命中为 0；不违反双仓库分别治理。
- 证据：`reports/compliance/uaes-full-migration-2026-11-06/evidence/governance-separation.json`
- 整改：不修改 UAES 仓库（含 5 项未提交用户修改）；仅披露并持续由分离门禁监控。
- 复测：`MONITORED BY GATE`

#### FIND-FCA-009 — 14 域 L3 与 L4 全局门禁仍 BLOCKED

- 级别/状态：`P1` / `OPEN`
- 位置：gates/l3-domain-gates.json、gates/l4-global-gate.json
- 根因：L3 pass_count=0/14；L4 status=BLOCKED，5 条未满足。
- 影响：RELEASE_GATE / GLOBAL_UAES_CONFORMANCE_GATE 阻断；禁止 commit/push/PR/merge/deploy。
- 证据：`reports/compliance/uaes-full-migration-2026-11-06/evidence/gates/l3-domain-gates.json`, `reports/compliance/uaes-full-migration-2026-11-06/evidence/gates/l4-global-gate.json`
- 整改：完成 14 域人工验收与逐条验证后重跑门禁。
- 复测：`NOT REVALIDATED`

#### FIND-FCA-010 — 12 条 N/A 引用行

- 级别/状态：`P3` / `CLOSED BY JUSTIFICATION`
- 位置：evidence/02-compliance-matrix.json (keyword_class=REFERENCE_ROW)
- 根因：交叉引用索引行带 native UAES ID 但无规范性谓词。
- 影响：不构成义务；每条均附书面适用性依据（§10）。
- 证据：`evidence/02-compliance-matrix.json`
- 整改：已记录且不跳过；无进一步整改。
- 复测：`JUSTIFICATION RECORDED`

#### FIND-FCA-011 — 八类质量门禁中存在 BLOCK 结果

- 级别/状态：`P1` / `OPEN`
- 位置：evidence/06-gates-verification.json
- 根因：real BLOCK gates = ['SECURITY_GATE', 'BUSINESS_ACCEPTANCE_GATE', 'RELEASE_GATE', 'GLOBAL_UAES_CONFORMANCE_GATE']
- 影响：§8 门禁未全部放行；每个门禁的负向阻断测试已真实执行。
- 证据：`evidence/06-gates-verification.json`
- 整改：按 FIND-FCA-001..009 逐项解除后重跑八类门禁。
- 复测：`NEGATIVE BLOCKING TESTS EXECUTED`

#### FIND-FCA-012 — 审计执行层 harness() 无法解析纯文本子命令输出，AG-07/08/09 被误判 FAIL

- 级别/状态：`P2` / `FIXED / REVALIDATED`
- 位置：scripts/quality/full-conformance-execution.py harness()；evidence/bugfix/05-agent-verification.BEFORE.json / AFTER.json
- 根因：workspace/selftest/verify 子命令输出纯文本而非 JSON；harness() 只尝试 stdout 内联 JSON 解析，未回退读取 harness 写出的结构化证据文件（agent-runtime-workspace.json 等），导致 3 个实际 PASS 的用例被审计器自身误记为 FAIL。
- 影响：修复前 agent 10 例 7 PASS / 3 FAIL（全部为解析误判，非真实绕过）；底层控制全部有效（两个绕过尝试均被 DENY exit 2）。
- 证据：`evidence/bugfix/05-agent-verification.BEFORE.json`, `evidence/bugfix/05-agent-verification.AFTER.json`, `evidence/05-agent-verification.json`
- 整改：harness() 增加 `evidence: <path>` 回退解析；重跑 agent 与 gates 阶段，agent 10/10 PASS、负向阻断 8/8 证实。
- 复测：`REVALIDATED: agent cases=10 passed=10 failed=[]`

#### FIND-FCA-013 — 执行分支出现完整验证前的 commit（非本审计会话所为），workspace W3 保持 fail-closed FAIL

- 级别/状态：`P2` / `OPEN / EXTERNAL ACTION`
- 位置：commit ec6501adc（HEAD 领先 main 1 个提交）；scripts/quality/uaes-agent-runtime-check.rb W3（HEAD == main）
- 根因：2026-11-06 17:12:30，用户账号（Uter.ai <huxulin.hxl@gmail.com>）通过并行会话提交 ec6501adc「fix(governance): abbreviate commit SHA misdetected as API key by gitleaks」——内容正是 MA-06 gitleaks 误报的正式修复（缩短审计文档中的完整 SHA 并提交）。本审计会话自始至终零 commit；依并发红线不得 reset/merge 撤销他人提交，W3 断言亦不得放宽。
- 影响：workspace W3 FAIL → 矩阵 L1-16 FAIL → L1 17/18；L1/L2 层因此未能全绿。交付门禁保持关闭（无 push/PR）。
- 证据：`reports/compliance/full-conformance-audit-2026-11-06/evidence/agent/agent-runtime-workspace.json`, `reports/compliance/full-conformance-audit-2026-11-06/evidence/agent-runtime-task.json`
- 整改：由用户裁定其一：① 授权该 commit 作为执行基线的一部分并相应更新 W3 判定基线；② 撤销该 commit 后重跑。两者均超出本会话权限。
- 复测：`NOT REVALIDATED`


### 既有未解决发现（独立评估）

[
  {
    "finding_id": "FIND-IA-07",
    "severity": "High",
    "title": "42 domain acceptance items remain unverified",
    "detail": "14 domains have unresolved manual acceptance evidence (§16.3)",
    "source_requirement": "§16.3 / §8.2",
    "lifecycle_status": "IDENTIFIED",
    "verification_status": "NOT_VERIFIED"
  },
  {
    "finding_id": "FIND-IA-08",
    "severity": "High",
    "title": "7 L4 global conditions remain NOT_MET",
    "detail": "Global acceptance cannot be granted (§16.4)",
    "source_requirement": "§16.4",
    "lifecycle_status": "IDENTIFIED",
    "verification_status": "NOT_VERIFIED"
  },
  {
    "finding_id": "FIND-IA-09",
    "severity": "Medium",
    "title": "3 test-matrix commands FAIL",
    "detail": "Each failure is recorded with its raw log and exit code; no failure is masked or reinterpreted as a skip",
    "source_requirement": "§8.2 / §9.3",
    "lifecycle_status": "IDENTIFIED",
    "verification_status": "NOT_VERIFIED"
  },
  {
    "finding_id": "FIND-IA-10",
    "severity": "Low",
    "title": "no APPROVED_EXCEPTION records granted",
    "detail": "All unmet requirements remain open; no risk-owner acceptance exists (§13.4 / §16.4)",
    "source_requirement": "§13.4",
    "lifecycle_status": "IDENTIFIED",
    "verification_status": "NOT_VERIFIED"
  }
]

### 既有非 PASS 本地证据



**未授予任何正式例外 / waiver**；`policy` 中 5 项自动关闭手段全部为 `false`。
