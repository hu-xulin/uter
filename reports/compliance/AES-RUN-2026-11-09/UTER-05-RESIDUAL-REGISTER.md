# UTER-05 残余事项登记簿（AUTONOMOUS RUN 2026-11-09 · ROUND 2）

**原则：如实登记，不粉饰。下列事项均为"架构分离的设计结果"或"外部证据缺口"，
不属于内部治理缺陷，也不阻塞内部验收；每一项都有明确的归属与解除条件。**

## 1. 登记

| # | 事项 | 性质 | 归属 | 解除条件 |
|---|---|---|---|---|
| R-01 | 历史 L3/L4 全量符合性门禁为 BLOCKED（`l4_not_met=4`） | 外部/人工证据缺口 | Uter 产品验收体系 | 外部认证或等价运行时证据到位；按 `AES-TRUST-MODEL-002` 不作为内部治理前置 |
| R-02 | `integration_status=MIGRATION_PENDING` | 设计占位 | Uter pin | 14 独立域验收完成后由 Uter 自身流程推进 |
| R-03 | 42 项具名签署要求 / 34 项 A3 | 历史签署时代记录 | 双方归档 | 已由 `AES-UTER-EXTERNAL-APPROVAL-DEPENDENCY-REMOVAL-REPORT.md` 声明退役；历史字节哈希留痕 |
| R-04 | 远程 commit 可达性、语义等价、运行时技能发现、CI 策略强制 | 静态检查显式不做 | `aes-integration-check.sh`（§16.5 NOTE） | 各自的专项验收 |
| R-05 | 103 份历史验收证据哈希重锚 | 只读重锚完成 | AES `AUTONOMOUS-EVIDENCE-REANCHOR-REGISTER.json` | 已解除（`reconcile ALL_PASS, 182 verified, 0 mismatch`） |

## 2. 本轮已关闭的缺陷（不计入残余）

- Schema 违规（8 个 additionalProperties error）→ G-027 + 负例回归；
- G-025/G-026 未跟踪治理文件（30→35 项已登记入 index）；
- 残留依赖审计器两处检测盲区（无扩展名文件、数组参数 sshsig 调用）；
- RG-13 政策授权证据失效（重签 AEV-000007）。

## 3. 持续有效的门禁保护

任何上述 R 项状态的伪造（例如把 BLOCKED 改写为 PASS）都会被以下机制发现：
- AI-Native 门禁如实保留 `legacy_gate_state`（`rewritten_by_this_gate=false`）；
- append-only ledger 与机器封印重算失败即红；
- CI-14 / AC-17 / bypass 套件对签名时代残留零容忍。

## 4. 结论

在 AES-TRUST-MODEL-002 定义的内部治理范围内：
`AES = COMPLETE AND AUTONOMOUS`，`UTER = FULLY COMPLIANT WITH AES`。
上表 1–4 项为显式跟踪的外部/后续事项，5 项已解除；不存在被隐瞒或被静默放行的
内部治理缺陷。
