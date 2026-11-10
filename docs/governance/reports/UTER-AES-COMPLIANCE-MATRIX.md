# Uter → AES 规范映射矩阵（PROVISIONAL 预审）

- 执行时间：2026-11-10 GMT+8 · 项目 `/Users/lincolnhu/uter` @ `main 775e9eb50`
- 上游基线：`/Users/lincolnhu/aes` @ `main 9d727f6`，registry `1.12.2 / ACTIVE`，`AES-SPEC-CORE@2.0.0`
- **前置条件未满足**：AES 未通过正式验收（`FAIL — AUTOMATION_NOT_VERIFIED`）→ 按第五部分，本矩阵只能标记 `PROVISIONAL`，**不得据此出具正式全面合规 PASS**。
- 证据目录：`docs/governance/reports/evidence/`

## 1. 分母口径（10.2）

- 适用 AES Requirement 总数 = **2150**（`.aes/registry/requirements.yaml`，`duplicate_ids: 0`，每条含 `source_file`/`source_line`）
- 覆盖域：P00–P12（13 域）+ Uter 自有 `UTER-P13` 业务域扩展
- **不缩小分母**：不以「容易核验的门禁类」代替全部适用要求。

## 2. 判定状态汇总

| 状态 | 数量 | 依据 |
|---|---:|---|
| `COMPLIANT` | **0** | AES 正式基线未批准；无任何项可被授予正式 COMPLIANT |
| `PARTIAL` | **13** | P00–P12 域级静态布线与 pin 校验通过，但 `aes-pin.json` 自身声明 `explicitly unverified` / `MIGRATION_PENDING` |
| `NON_COMPLIANT` | **6** | `integration-adapter.test.mjs` 实测 6 个 FAIL（详见 §4） |
| `NOT_APPLICABLE` | 0 | 未完成逐条适用性判定，不预设 N/A |
| `UNKNOWN` | **2131** | 2150 − 13 − 6；因基线未批准且无逐条执行证据，按 2.3 第 10 条不得默认通过 |
| `WAIVED` | 0 | 无任何经授权的豁免；未发现伪造豁免 |
| **合计** | **2150** | |

> PARTIAL / UNKNOWN / 未授权 WAIVED **均不计入 COMPLIANT**。本表是预审快照，不是正式验收结论。

## 3. P00–P12 逐域结果（5.2 / 5.4–5.8）

| 域 | AES 侧状态 | Uter 侧证据 | 判定 |
|---|---|---|---|
| P00 Foundation | `AES-00-GATE-001` 存在 | `.aes/aes-pin.json`、`AGENTS.md`(55KB)、`CLAUDE.md`；`aes-pin-check.sh` 实跑 PASS | `PARTIAL` |
| P01 AI Governance | 域标准存在 | `.aes/agent-governance.yaml`、`.ai/AIES.md`（优先级表述冲突，见 §5） | `PARTIAL` |
| P02 Product Engineering | 域标准存在 | `uaes/standards/PRODUCT-REQUIREMENTS-STANDARD.md`（支付/退款/订单状态机/幂等/对账保留） | `PARTIAL` |
| P03 Knowledge Engineering | 域标准存在 | `.aes/TRACEABILITY.md`、`docs/adr/0001-*`、Design System 3.0 文档 | `PARTIAL` |
| P04 System Architecture | `AES-04-GATE-001` | Go 后端 206 controller / 193 model / 145 service / 57 middleware / 35 relay；`docs/adr/` | `PARTIAL` |
| P05 Experience & Design | `AES-05-GATE-001` | `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md` + `showcase-3.0.html`；**86 个 `web/src` 文件真实使用 design token** ✅ | `PARTIAL` |
| P06 Software Engineering | `AES-06-GATE-001` | `go test ./common/...` 2 包 PASS；`go test ./controller/... -run 资金安全` PASS | `PARTIAL` |
| P07 Cross-Platform | `AES-07-GATE-001` | `electron/`、`web/`、`e2e/`、`docs-web/`，H5/移动端未在本次实机验证 | `UNKNOWN` |
| P08 Agent Engineering | `AES-08-GATE-001` | `.agents/skills/aes-integration/`、`.claude/skills/aes-integration/`；Claude/Codex CLI `NOT_EXECUTED` | `UNKNOWN` |
| P09 UEQE | `AES-09-GATE-001` | 4 份 UEQE 旧标准保留于 `uaes/standards/engineering-quality/`；`integration-adapter.test.mjs` 6 FAIL | `NON_COMPLIANT` |
| P10 Security & Reliability | `AES-10-GATE-001` | 回调安全矩阵 / Outbox 恢复任务 / 支付安全测试文件真实存在且局部测试 PASS；7 项环境控制未验证 | `PARTIAL` |
| P11 DevOps & Delivery | `AES-11-GATE-001` | `ci.yml`(push/PR)、`nightly-full-audit.yml`(每日)、`weekly-security-audit.yml`(每周)、`release-gate.yml` | `PARTIAL` |
| P12 Lifecycle & Evolution | `AES-12-GATE-001` | `UTER-LEGACY-STANDARD-MIGRATION-REPORT.md`；pin `integration_status: MIGRATION_PENDING` | `PARTIAL` |
| UTER-P13 业务域扩展 | 项目级 | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md` | `PARTIAL` |

## 4. 六项实证不合规（来自真实测试执行）

```
node --test tools/aes/integration-adapter.test.mjs
→ 23 tests / 17 pass / 6 fail / EXIT=1
```

| # | 失败用例 | 真实错误 |
|---|---|---|
| 1 | ACTIVE 规范可发现且签名验证 | `specification discovery failed: release payload absent` |
| 2 | 恰有一个 ACTIVE 规范为权威 | `false !== true` |
| 8 | 上游规范摘要变化应判为漂移 | `false !== true` |
| 9 | 不得仅凭技术布线宣告集成 | `condition 1: an authentic ACTIVE spec …` |
| 10 | pin 校验覆盖所有声明产物 | `the refreshed commit carries every declared artefact` |
| 12 | INTEGRATED 需布线+声明+验收证据 | `condition 1: authentic ACTIVE spec` |

根因：Uter 适配器仍要求**签名/ release payload 模型**，而 AES 已迁移为**无签名机器证据模型**（`CI-14: ZERO_HUMAN_AND_THIRD_PARTY_DEPENDENCY`）。这是 AES 升级破坏下游兼容性的实证，对应 AES 建设目标 A13 与 5.9。

证据：`evidence/uter-adapter.log`。

## 5. 上游版本识别与漂移

| 检查 | 实跑结果 |
|---|---|
| `.aes/aes-pin.json` | registry `1.12.2` / `ACTIVE` / `requirement_count 2150` / `integration_status: MIGRATION_PENDING` |
| `scripts/quality/aes-pin-check.sh` | `PASS scope=static-integrity version=1.12.2 fingerprint=4438ad0f35fc` |
| `scripts/quality/aes-integration-check.sh` | PASS，但脚本自述 `static wiring only … makes no conformance claim` |
| `sync-to-uter.mjs --check`（AES 侧） | `NOOP … changed files 0` |
| `change-impact.mjs`（AES 侧） | 9 域 / 21 规则 / 9 门禁 / 19 命令 |

**pin 自相矛盾**：顶层 `governed_fingerprint: 4438ad0f…`、`registry_blob_sha: 52e054e3…`，而 `notes` 与 `UTER-LEGACY-STANDARD-MIGRATION-REPORT.md` 称当前值为 `e9e6274e…` / `72fbcbea…` → 版本锁定文件内部不一致，需修正。

`aes-pin.json` 原文明确：`INTEGRATED describes inheritance wiring only, not Uter product conformance … no Uter requirement may be marked VERIFIED on this basis`，并列出 14 域门禁、42 项人工验收签批、Requirement-to-Evidence 映射、三运行时 Agent 强制执行**仍属产品仓库责任**。

## 6. 旧规范清理结论（第六部分）

| 类别 | 清单 | 处置 |
|---|---|---|
| AES 正式规范引用 | `.aes/aes-pin.json`、`AGENTS.md`、`.aes/INTEGRATION.md` | 保留 |
| Uter 项目扩展规范 | `uaes/` 全套（`uaes-standard-registry.yaml` 明确 `UAES extends AES … On conflict, AES wins`） | **保留**（规则 3；用户 2026-11-09 已明确澄清命名空间分离） |
| 项目扩展 UEQE 4 件 | `CODE-REVIEW` / `AUTOMATED-TEST` / `AUTO-FIX` / `QUALITY-GATE`-STANDARD.md | **保留**，含有效业务约束（规则 7） |
| 旧规范合并清单 | 18 份 `docs/ai-specs/` → `uaes/standards/` | 已由 `UTER-LEGACY-STANDARD-MIGRATION-REPORT.md` 记录 |
| 删除清单 | **空** | 本次未删除任何文件（保护 491 项用户未提交修改） |
| 兼容迁移清单 | `UTER-LEGACY-STANDARD-MIGRATION-REPORT.md` §4 引用更新，0 残留声明 | 保留 |
| 冲突解决清单 | `.ai/AIES.md` §0 优先级表把 `AGENTS.md`/`uaes/standards/` 列为高/中高权威，**未把 AES 列为最高权威**，与「AES 为企业级唯一真源」冲突 | 待授权修正（P2） |

## 7. 结论

```
UTER_COMPLIANCE_SCOPE = PROVISIONAL
AES → Uter 适用要求映射率（分母 2150）：13 域级已识别，逐条 Requirement 映射未完成
COMPLIANT = 0；UNKNOWN = 2131
UTER_STATUS = BLOCKED — AES_BASELINE_NOT_APPROVED
```

正式验收必须等待 AES 通过 + 6 项适配器 FAIL 修复 + 42 项人工验收签批 + 14 域门禁执行。
