# Uter 全面符合 AES 正式验收报告（PROVISIONAL / BLOCKED）

- 执行时间：2026-11-10 00:35–00:52 GMT+8（UTC 2026-11-09 16:35–16:52）
- 项目：`/Users/lincolnhu/uter` · `main` @ `775e9eb50` · 产品版本 `v1.5.16`
- 上游 AES：`/Users/lincolnhu/aes` · `main` @ `9d727f6` · registry `1.12.2 / ACTIVE` · `AES-SPEC-CORE@2.0.0`
- 使用版本锁定：`.aes/aes-pin.json` → `fingerprint 4438ad0f35fc`、`requirement_count 2150`、`integration_status: MIGRATION_PENDING`
- 联合总报告：`/Users/lincolnhu/aes/docs/governance/reports/UTER-AES-JOINT-GOVERNANCE-ACCEPTANCE-REPORT.md`（可追溯互引）

## 1. 前置条件判定（第五部分）

> 「只有 AES 正式验收通过后，才允许将其正式版本作为 Uter 的验收基线。如果 AES 未通过，不得给 Uter 出具正式的全面合规 PASS，可以继续开展预审和整改，但必须标记 `PROVISIONAL`。」

AES 实测结论：`FAIL — AUTOMATION_NOT_VERIFIED`（13 域门禁 NOT_RUN、3 项发布门禁 NOT_RUN、400 份 attestation REVOKED、负向测试 6 类未阻断、Agent 1/3 验证）。

→ **前置条件不成立**，本验收为 `PROVISIONAL` 预审，不授予正式 PASS。

## 2. 验收指标逐项核对（10.2）

| 指标 | 目标 | 实测 | 判定 |
|---|---:|---|---|
| 适用 AES Requirement 映射率 | 100% | 分母 2150；13 域级识别，逐条映射未完成 | ❌ |
| 适用规范符合性判定率 | 100% | `UNKNOWN 2131` | ❌ |
| COMPLIANT 证据完整率 | 100% | `COMPLIANT=0`，无可授证据 | ❌ |
| 必需自动化检查覆盖率 | 100% | pin/集成/go 测试实跑；集成适配器 6 FAIL；全量审计因保护用户修改未运行 | ❌ |
| 关键业务流程测试覆盖率 | 100% | 资金安全相关 `go test ./controller/... -run …` 实跑 PASS，但未做全量关键业务 | ⚠️ 部分 |
| 关键安全要求验证率 | 100% | 回调/退款/Outbox 代码与测试文件真实存在、局部实跑 PASS；对账/并发/备份未验证 | ⚠️ 部分 |
| 必需 Agent 实际验证率 | 100% | 1/3（Claude Code / Codex `NOT_EXECUTED`） | ❌ |
| AES 版本识别准确率 | 100% | `aes-pin-check.sh` PASS `1.12.2`；但 pin 内部指纹自相矛盾 | ⚠️ |
| 规范漂移检查覆盖率 | 100% | `sync-to-uter --check` NOOP/0 changed；机制可用，但上游 400 认证全 REVOKED | ⚠️ |
| 未解决 P0/P1 | 0 | **8 项 P1** | ❌ |
| 未授权豁免 | 0 | 0 ✅ | ✅ |
| 未解决阻断级不合规项 | 0 | 集成适配器 6 FAIL、42 项签批缺失、14 域门禁未执行 | ❌ |

## 3. 判定状态汇总（5.1）

| 状态 | 数量 |
|---|---:|
| 适用规范总数 | **2150** |
| `COMPLIANT` | **0** |
| `PARTIAL` | **13** |
| `NON_COMPLIANT` | **6** |
| `NOT_APPLICABLE` | 0 |
| `UNKNOWN` | **2131** |
| `WAIVED` | 0 |

## 4. 关键实证结果

| 领域 | 结果 |
|---|---|
| 关键业务验证 | `go test ./common/...` 2 包 PASS；`go test ./controller/... -run 'TopUp\|Refund\|Callback\|Billing\|Security\|Outbox\|Idempot'` → `ok 26.320s` / EXIT=0 ✅ |
| 安全与可靠性 | 支付回调安全矩阵、退款恢复、Outbox 真实代码存在，局部测试 PASS；7 项环境控制未验证 → `UNKNOWN` |
| UEQE | 4 份标准保留为项目级扩展；静态检查 PASS；**集成适配器 6 FAIL / EXIT=1** ❌ |
| Agent 实际执行 | WorkBuddy `EXECUTED`（测试 A、D）；Claude Code / Codex `NOT_EXECUTED`；测试 B/C/F `NOT_EXECUTED` |
| 自动化门禁 | pin 校验 PASS、集成检查 PASS（自述静态、不作符合性声明）、适配器测试 FAIL、全量审计未运行（安全阻断） |
| 规范漂移 | 机制可用；但 AES 升级已造成签名模型不兼容（6 FAIL），上游 400 份认证全 REVOKED |

## 5. 不得放行的硬性理由（用户最终通过条件）

1. **AES 未通过** → 不得宣布 Uter 全面符合 AES。
2. **Uter 有 8 项未解决 P1**（至少 1 项即受阻）→ 不得宣布全面符合。
3. **Agent 仅 1/3 实跑** → 不得宣布 Agent 合规。
4. **AES 侧负向测试 6 类未阻断**，Uter 侧隔离负向测试 `NOT_EXECUTED` → 不得宣布自动化体系完整。
5. **每日/每周定时任务未在本次实跑** → 不得宣布长期自动化治理已建立。

## 6. 待授权事项（摘要）

| ID | 事项 |
|---|---|
| U-A-01 | 授权对齐集成适配器与 AES 无签名机器证据模型（不得降低断言） |
| U-A-02 | 确认唯一 `governed_fingerprint` 并统一 pin / INTEGRATION.md / 迁移报告 |
| U-A-03 | 42 项逐项人工验收签批 |
| U-A-04 | 14 域门禁执行（需等价环境） |
| U-A-05 | 授权修改 `.ai/AIES.md` 优先级表述（该文件正处于用户未提交修改状态） |
| U-A-06 | 授权在隔离副本运行 `full-conformance-audit.py`，保护用户 491 项修改 |
| U-A-07 | 逐条 2150 Requirement 映射补全 |
| U-A-08 | 资金安全专项等价环境测试授权 |
| 上游 | AES A-01…A-08（正式批准、DRAFT 处置、Validator 修复重封签、第三方独立审核） |

完整字段见 `UTER-AES-REMEDIATION-REGISTER.md` 与上游 `AES-FINAL-ACCEPTANCE-REPORT.md` §4。

## 7. 最终状态

```
UTER_STATUS = BLOCKED — AES_BASELINE_NOT_APPROVED
（预审标记 PROVISIONAL；同时存在未解决 P1，不得给 FULLY_COMPLIANT_WITH_AES）
AES_AND_UTER_FULLY_VERIFIED = FALSE
```

> 特别声明：Uter 确实引用了 AES（pin、适配器、skills、CI），也确实有真实代码与局部测试通过；但**引用 AES ≠ 全面符合 AES**，本次不以此判定通过。
