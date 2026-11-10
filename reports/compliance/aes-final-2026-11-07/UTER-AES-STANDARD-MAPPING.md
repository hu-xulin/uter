> 生成日期：2026-11-07 ｜ 执行仓库：`/Users/lincolnhu/uter`（本地 `main` @ `ec6501adceb008d46140a7e5ab6508eb78006731`，未 push）
> 上游基线：AES `main` @ `46c648836ee4cf06e285712ae2504da7ccab5602`（不可变发布基线：registry `1.12.0 / ACTIVE`，178 份标准正式发布；发布 commit `6c78ab50dc2b1adfedc035c88a70a906564318e4`，最终 pinned commit 为其后的收尾提交）
> 基准时刻：2026-11-07 21:30 +0800 之后；复审期间上游由并发会话连续刷新（3bc8285 → 6c78ab50 → 46c64883），Uter 治理入口已同步，证据见 evidence/governance-refresh-verification-final.log
> 证据目录：`reports/compliance/aes-final-2026-11-07/evidence/`
> 纪律声明：本报告不含伪造的测试结果、批准或签署；`NOT_RUN` / `BLOCKED` 一律不计为 PASS；文档存在不等于符合性。
> **本轮结论：Uter 尚不能宣称「已全面按照 AES 执行」。**

# 2. UTER–AES 标准映射报告

## 2.1 上游版本与来源锁定

| 项目 | 值 |
|---|---|
| AES 仓库 | `hu-xulin/aes`，分支 `main` |
| **已提交、CI 可见的 pin 基线** | `3bc8285861b9c9c7ede63e6d9d08b508f1bd74b8` |
| 该 commit 内 registry | `.aes/STANDARD-REGISTRY.yaml`，`1.12.0 / ACTIVE`，blob `03424d878aa1a9ce7b064f92e123ad73d3d1e984` |
| 审批记录 | `AES-APPROVAL-2026-11-06-001` |
| Uter pin 文件 | `.aes/aes-pin.json` |
| pin 校验 | `node tools/aes/integration-adapter.mjs verify-pin` → `ok=true, checked=6, missing=0` |

**上游发布与基线刷新（复审期实测，取代初版「工作区漂移」结论）**：本轮复审期间，并发会话把 AES 正式发布推进到不可变 commit：发布 commit `6c78ab50dc2b1adfedc035c88a70a906564318e4`（`release(governance): publish 178 standards as ACTIVE, registry 1.12.0`），随后收尾 commit `46c648836ee4cf06e285712ae2504da7ccab5602`（`chore(governance): consolidate post-release regression fixes and final reports`）成为最终 pinned baseline；规范内容、sealed digest `94141240bea54cceaa6a1f3d8bc2512e6cba0ab10a28ec1b453ef4907d1b8f73` 与 detached release signature 均未变。Uter pin 与 8 份治理入口已同步到 `46c64883…`，`pin_matches_active_specification=true`、`technical_preconditions_met=true`、`verify-pin` 6/6 制品 PRESENT，`PIN_CHECK / INTEGRATION_CHECK / AI_SPECS_CHECK / VERIFY_PIN` 全 EXIT=0。因此初版所称「工作区 `1.12.0 / ACTIVE` 未提交、281 项 dirty、digest 漂移」**已失效**：漂移消除，AES 工作区未提交项降至 4。**仍待裁决**：pin notes 自述发布签名是执行工作区的单机职责分离例外（非独立权威环境签名），gate 证据 `verification_status=UNVERIFIED` 未刷新，见 B-01 / B-02。

## 2.2 适用标准清单与 ID

标准注册表 `.aes/STANDARD-REGISTRY.yaml` 为唯一事实源，共 308 条注册条目：standards 178 / schemas 76 / phases 13 / gates 13 / acceptance 13 / system_files 10 / tool_adapters 5。

| 域 | 域标准 ID | 标准数 | 状态（HEAD） |
|---|---|---:|---|
| P00 Foundation | `AES-00`, `AES-00-001..006` | 7 | ACTIVE |
| P01 AI Governance | `AES-01`, `AES-01-001..010` | 11 | ACTIVE |
| P02 Product Engineering | `AES-02`, `AES-02-001..008` | 9 | ACTIVE |
| P03 Knowledge Engineering | `AES-03`, `AES-03-001..012` | 13 | ACTIVE |
| P04 System Architecture | `AES-04`, `AES-04-001..013` | 14 | ACTIVE |
| P05 Experience & Design | `AES-05`, `AES-05-001..013` | 14 | ACTIVE |
| P06 Software Engineering | `AES-06`, `AES-06-001..014` | 15 | ACTIVE |
| P07 Cross-Platform | `AES-07`, `AES-07-001..013` | 14 | ACTIVE |
| P08 AI Agent Engineering | `AES-08`, `AES-08-001..014` | 15 | ACTIVE |
| P09 Quality Engineering | `AES-09`, `AES-09-001..015` | 16 | ACTIVE |
| P10 Security & Reliability | `AES-10`, `AES-10-001..016` | 17 | ACTIVE |
| P11 DevOps & Delivery | `AES-11`, `AES-11-001..015` | 16 | ACTIVE |
| P12 Lifecycle & Evolution | `AES-12`, `AES-12-001..016` | 17 | ACTIVE |
| **合计** | | **178** | **178 ACTIVE / 0 non-ACTIVE** |

Uter 侧独立第 14 域 `UTER-P13`（`.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md`）仅注册于 Uter，不进入 AES 注册表（双仓分离，由 `uter-governance-separation-check.rb` 强制）。

**注**：用户指令中的「UEQE 4 个引擎标准」在 AES 注册表中并无独立标准 ID；UEQE 是 P09 的四阶段（REVIEW / TEST / AUTO-FIX / GATE），Uter 侧对应 `docs/ai-specs/engineering-quality/` 下 4 份项目规范。

## 2.3 需求到执行点的映射

`buildRequirementMap()`（真实运行）结果：

| 指标 | 值 |
|---|---|
| 需求总数 | 2132（AES 工作区 `.aes/registry/requirements.yaml`） |
| 映射到执行点 | 2132 (`MAPPED`) |
| 无执行点 | 0 (`MISSING`) |
| 语料域 / 有需求域 | 13 / 13，`fully_covered=true` |
| 继承阶段 | 13 |

主要执行点：`scripts/quality/aes-governance-gates.rb`（13 域）、`aes-agent-runtime-check.rb`（P01/P08）、`ai-specs-check.sh`（P02）、`uter-quality.sh`（P05/P06/P07/P09）、`scripts/verify-all.sh`（P10）、`aes-integration-check.sh` + `aes-pin-check.sh`（P11）。

**关键限制：`MAPPED` 不等于 `VERIFIED`。** 映射只证明「存在可执行检查点」，不证明检查已运行、已通过、或覆盖语义。域门禁当前 0/14 PASS。

## 2.4 版本升级机制

- pin 的 commit / blob / digest / 状态由 `.aes/aes-pin.json` 单一源定义；`INTEGRATION.md`、`AI-GOVERNANCE-ENTRY.md`、`TRACEABILITY.md`、`uter-governance-registry.yaml`、`UTER-P13` 与 pin 由 `aes-pin-check.sh` / `aes-integration-check.sh` 交叉校验。
- 升级只能经 **reviewed integration change**：先确认目标 commit 真实承载 6 个声明制品（`verify-pin`），再同步全部引用与测试，最后复跑门禁。
- `integration-adapter.mjs` 的 `writePin()` 为写侧门禁，拒绝写入任何 `verifyPinnedCommit` 不通过的 pin。
- 本轮新增守卫：`integration_status` 从 `MIGRATION_PENDING` 提升为 `INTEGRATED` 必须由 pin **显式声明**，且 `governanceAcceptanceEvidence()` 读取的 L3/L4/人工验收/上游验证证据全部 PASS。技术条件满足不再自动放行。

## 2.5 持续检查与不符合项追踪

`aes-pin-check.sh`、`aes-integration-check.sh`、`ai-specs-check.sh`、`ai-specs-check.sh`（10 域 + 4 质量规范）、`uter-governance-separation-check.rb`、`uter-p09-p10-boundary-check.rb`、`uter-independent-assessment.rb`、`aes-governance-gates.rb`、`integration-adapter.test.mjs` 共同构成持续检查链；不符合项登记于 `UTER-REMAINING-TASKS.md` 与既有 `10-NONCONFORMITIES-AND-RISKS.md` / `D28`。

## 附：2026-11-07 修复后复审增补

> 本节追加于 2026-11-07 23:15 CST。正文保留 21:45 前的实测状态作为历史证据；
> 最新事实与逐条「被更新 / 仍不变」判定见同目录
> `UTER-POST-FIX-REEVALUATION-2026-11-07.md`，证据在 `evidence/`。

- 更新：持续检查链复跑 `PIN_CHECK / INTEGRATION_CHECK / AI_SPECS_CHECK` 全 `EXIT=0`；新增两套回归守卫 `test-ueqe-verdict-scope.rb`、`test-verify-all-embed-precondition.rb`（各 7 runs / 0 failures）。
- 本文 §2.5 的不符合项登记口径**不变**，仍需与 `UTER-REMAINING-TASKS.md` 的 B-13 状态更新、新增 B-14 待决项一并阅读。

**统一不变项**：L3 域门禁 0/14 PASS、L4 全局门禁 9/16 MET（BLOCKED）、
42 项人工验收 0/42 签署、无任何 `APPROVED_EXCEPTION`、**仍不得宣称 Uter 已全面按照 AES 执行**。
本轮未 commit / push / merge / 部署 / 改 AES 仓库 / 生成签名 / 代填验收。
