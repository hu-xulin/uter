# UTER-LEGACY-STANDARD-MIGRATION-REPORT

**生成时间**：2026-11-09
**生成方式**：WorkBuddy 全自动执行（无人工逐项审批 / 无第三方复核前置）
**仓库**：
- 企业级规范 `AES`：`/Users/lincolnhu/aes`（远端 `hu-xulin/aes`）
- 项目级规范 `UAES`（本目录）：`/Users/lincolnhu/uter/uaes/`
- Uter 项目：`/Users/lincolnhu/uter`（本地 `main`，未 push / merge / deploy）

---

## 1. 命名空间分离决策（关键澄清）

用户在本次执行中明确澄清了此前全局改名（UAES→AES）引起的命名歧义：

- **`AES` = 企业级规范（Enterprise Governance Authority）**，唯一权威来源，覆盖 P00–P12 通用治理要求。
- **`UAES` = Uter 项目级规范（Uter Project-Level Standard）**，是 Uter 自有 AI 相关规范的独立归集，引用 `AES` 为上位权威，在其基础上**扩展** Uter 特有的实现细节与业务规则，但**不得降低任何 AES 强制要求**。

此前 UAES→AES 的全局改名把 Uter 自有规范误并入企业命名空间；本步骤将 Uter 自有规范**重新独立**为 `uaes` 项目级标准，消除命名歧义，同时把所有企业级引用统一为 `aes`。

## 2. 迁移内容（从 `docs/ai-specs/` → `uaes/standards/`）

共迁移 **18 份规范文件**（原 `docs/ai-specs/` 13 份 + `docs/ai-specs/engineering-quality/` 4 份规范与 1 份 README）：

| 原路径 | 新路径 |
|---|---|
| `docs/ai-specs/AI-EXECUTION-STANDARD.md` | `uaes/standards/AI-EXECUTION-STANDARD.md` |
| `docs/ai-specs/API-CONTRACT-STANDARD.md` | `uaes/standards/API-CONTRACT-STANDARD.md` |
| `docs/ai-specs/ARCHITECTURE-STANDARD.md` | `uaes/standards/ARCHITECTURE-STANDARD.md` |
| `docs/ai-specs/CHANGE-MANAGEMENT-STANDARD.md` | `uaes/standards/CHANGE-MANAGEMENT-STANDARD.md` |
| `docs/ai-specs/CONFLICT-REPORT.md` | `uaes/standards/CONFLICT-REPORT.md` |
| `docs/ai-specs/DATABASE-STANDARD.md` | `uaes/standards/DATABASE-STANDARD.md` |
| `docs/ai-specs/DEVELOPMENT-STANDARD.md` | `uaes/standards/DEVELOPMENT-STANDARD.md` |
| `docs/ai-specs/DOCUMENTATION-STANDARD.md` | `uaes/standards/DOCUMENTATION-STANDARD.md` |
| `docs/ai-specs/PRODUCT-REQUIREMENTS-STANDARD.md` | `uaes/standards/PRODUCT-REQUIREMENTS-STANDARD.md` |
| `docs/ai-specs/SECURITY-STANDARD.md` | `uaes/standards/SECURITY-STANDARD.md` |
| `docs/ai-specs/UX-INTERACTION-STANDARD.md` | `uaes/standards/UX-INTERACTION-STANDARD.md` |
| `docs/ai-specs/ENGINEERING-SYSTEM-ACCEPTANCE-REPORT.md` | `uaes/standards/ENGINEERING-SYSTEM-ACCEPTANCE-REPORT.md` |
| `docs/ai-specs/UTER-AES-GOVERNANCE-ARCHITECTURE-WORKBUDDY-EXECUTION-SPECIFICATION.md` | `uaes/standards/UTER-AES-GOVERNANCE-ARCHITECTURE-WORKBUDDY-EXECUTION-SPECIFICATION.md` |
| `docs/ai-specs/engineering-quality/CODE-REVIEW-STANDARD.md` | `uaes/standards/engineering-quality/CODE-REVIEW-STANDARD.md` |
| `docs/ai-specs/engineering-quality/AUTOMATED-TEST-STANDARD.md` | `uaes/standards/engineering-quality/AUTOMATED-TEST-STANDARD.md` |
| `docs/ai-specs/engineering-quality/AUTO-FIX-STANDARD.md` | `uaes/standards/engineering-quality/AUTO-FIX-STANDARD.md` |
| `docs/ai-specs/engineering-quality/QUALITY-GATE-STANDARD.md` | `uaes/standards/engineering-quality/QUALITY-GATE-STANDARD.md` |
| `docs/ai-specs/engineering-quality/README.md` | `uaes/standards/engineering-quality/README.md` |

## 3. 新增项目级规范骨架

- `uaes/README.md`：项目级规范总纲，定义 `aes`（企业）/ `uaes`（项目）上下游关系、绑定（`.aes/aes-pin.json`，`AES-SPEC-CORE` 2.0.0 / 指纹 `e9e6274e…`）、三段式治理分层、命名空间约定、业务规则保留要求。
- `uaes/uaes-standard-registry.yaml`：仅登记 Uter 项目级规范（18 项），每项标注 `parent: AES-Pxx` 上位关系与 `business_critical` 标记。

## 4. 引用更新（消除悬空引用）

将所有指向 `docs/ai-specs/...` 的活跃引用迁移为 `uaes/standards/...`：

- **Uter 仓 18 个活跃文件**（AGENTS.md 29 处、`.aes/AI-SPEC-DISPOSITION-REGISTRY.yaml` 24 处、`.aes/TRACEABILITY.md`、`.aes/UTER-P13-*`、`.aes/uter-governance-registry.yaml`、`.agents/skills/aes-integration/SKILL.md`、`.ai/AIES.md`、CI 工作流、`.github/workflows/*`、`scripts/quality/*`、`.go/.py/.sh` 脚本、`docs/adr/0001-*` 等），全类型扫描后 **0 残留**。
- **AES 仓 20 个活跃文件**（`governance/ai-native/config/internal-acceptance-probes.json` 20 处探针、引擎 `build-registries.mjs` / `internal-acceptance.mjs`、`registry/AES-UTER-DOWNSTREAM-BINDING.yaml` / `SIGNOFF-RECLASSIFICATION.json` / `UTER-PRODUCT-EXTENSIONS.yaml` / `INTERNAL-ACCEPTANCE-LEDGER.json`、P02–P12 自治模块文档、`.aes/registry/*`、`.aes/policies/execution-policy.yaml` 等），全类型扫描后 **0 残留**。

> 修复前的回归：因 AES 仓 `internal-acceptance-probes.json` 中 20 处探针仍指向 `docs/ai-specs`，导致 `internal_acceptance_42` 出现 20 个 `internal_not_run`、验证降级为 `NOT_ALL_PASS`。迁移引用后恢复 `internal_not_run=0`。

## 5. 业务关键规范保留确认

以下业务/安全关键规范**已完整迁移、未删除、未降级**（属指令要求保留项）：

- `PRODUCT-REQUIREMENTS-STANDARD.md`（支付 / 充值 / 退款 / 订单状态机 / 幂等 / 对账）
- `SECURITY-STANDARD.md`、`DATABASE-STANDARD.md`、`API-CONTRACT-STANDARD.md`
- `engineering-quality/{CODE-REVIEW,AUTOMATED-TEST,AUTO-FIX,QUALITY-GATE}-STANDARD.md`
- `UTER Design System 3.0` 继续作为当前有效版本（未在本次清理中触及）

## 6. 已删除的垃圾/失效文件（指令 #1）

仅删除**零引用且明确为垃圾**的文件，未触碰任何仍被引用或属历史证据的目录：

- AES 仓根零字节日志：`--require-intact.log`、`check.log`
- 两仓所有 `.DS_Store`（macOS 元数据，非证据）：AES 仓 3 个、Uter 仓 6 个
- Uter 旧空目录 `docs/ai-specs/`（规范迁出后仅余 `.DS_Store`，已清空删除）

## 7. 有意未删除的部分（说明）

以下**重复/历史**目录被保留，因它们仍被治理/注册表引用或属有效历史证据，删除会破坏引用或违反"不删除有效历史证据"约束：

- `reports/compliance/aes-final-2026-11-07/`、`_reports/UTER-AES-FULL-COMPLIANCE/`：历史审计报告，被 `.aes/uter-governance-registry.yaml`、部分脚本与报告相互引用，属证据。
- `reports/compliance/aes-full-migration-2026-11-06/`：Uter 侧内部验收门禁 `ai-native-internal-gate.json` 所在目录，被 `status-engine` 与独立复核 `IR-O` 实时读取，**不得删除**。
- 内存日志（`.workbuddy*/memory/*`）、迁移台账（`governance/autonomous/migration/*`）、证据工件（`governance/ai-native/evidence/*`）：历史证据，保留。
- AES 仓顶层历史规划文档（`AES-UTER-UNIFIED-EXECUTION-PLAN.md` 等）：叙述性历史文档，其中 `docs/ai-specs` 引用属历史记录，未改写。

## 8. 验证证据（真实执行，非手工填写）

| 验证项 | 命令 | 结果 |
|---|---|---|
| AES 企业级全链验证 | `node governance/ai-native/engine/cli.mjs verify` | `ALL_PASS`（23/23 步骤全部 OK） |
| AES 内部验收台账 | `internal_acceptance_42` | `total=42, internal_not_run=0, direct=27, substitute=15` |
| 独立自动复核 | `independent_automated_review` | `VERIFIED`（15/15，无第三方认证） |
| AN 验收套件 | `ai_native_acceptance_suite_18` | `ALL_PASS` |
| Uter 侧内部验收门禁 | `scripts/quality/ai-native-internal-gate.rb` | `INTERNAL_ACCEPTED`（11/11 PASS，0 NOT_RUN） |
| 最终状态 | `status_compute_final` | `ALL_INTERNAL_FLAGS_ACHIEVED` |
| 下游证据 | `uter_downstream_evidence` | `INTERNAL_ACCEPTED` |

AES 最终六旗：`AUTONOMOUS_GOVERNANCE_ENABLED=true`、`AES_ESTABLISHED=true`、`UTER_COMPLIANT=true`、`AGENT_ENFORCEMENT_VERIFIED=true`、`INTEGRATED_INTERNAL=true`、`FULL_INTERNAL_ACCEPTANCE_PASSED=true`。

## 9. 结论

- `aes` 继续作为**企业级规范**唯一权威，治理引擎真实自主运行。
- `uaes` 作为 **Uter 项目级规范**已独立成体系，引用 `aes` 为上位，扩展不降低。
- Uter 原有 AI 相关规范全部归入 `uaes`，历史证据与业务关键规范完整保留，无悬空引用。
- 全过程未 push / merge / deploy，未伪造签名或证据，未放宽权限控制。

可复现命令：
```bash
cd /Users/lincolnhu/aes && node governance/ai-native/engine/cli.mjs verify
cd /Users/lincolnhu/uter && ruby scripts/quality/ai-native-internal-gate.rb
```
