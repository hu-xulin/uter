# UTER-02 Uter 内部门禁报告（AUTONOMOUS RUN 2026-11-09 · ROUND 2）

**结论：AI-Native 内部验收门禁 11/11 PASS，`INTERNAL_ACCEPTED`；G-01..G-11 全部由真实
证据驱动，其中 G-06 / G-08 在上一轮按 AES-TRUST-MODEL-002 重写后本轮复验通过。**

## 1. 门禁清单与本轮结果

```json
{"gate_id":"AI_NATIVE_INTERNAL_ACCEPTANCE_GATE","verdict":"INTERNAL_ACCEPTED",
 "checks":{"total":11,"pass":11,"fail":0,"not_run":0},
 "stable_core_digest":"9abd40d4f8c35f79b828d90ab46e9553c10763faae21dc097afaa26c31ebfc56"}
```

| 检查 | 内容 | 本轮 |
|---|---|---|
| G-01..G-05 | fail-closed 权限、任务 Schema、状态机、证据、生命周期 | PASS |
| G-06 | signature-free trust root：`version=2.0.0`、`trust_model_id=AES-TRUST-MODEL-002`、`signature_class=AUTONOMOUS_MACHINE_EVIDENCE_SEAL`、`algorithm=SHA256_CANONICAL_SEAL`、`private_key_location=NONE`、`private_key_in_git=false`、`original_authority_key.signing_capability=NONE` | PASS |
| G-07 | 泄漏扫描：private key / signer roster / signature namespace 不得出现 | PASS |
| G-08 | 13 项安全测试矩阵：`fail=0, not_run=0, false_pass=0, external_attestation_separate=2` | PASS |
| G-09..G-11 | 状态位推导、ledger、独立复核 | PASS |

## 2. fail-closed 保持

- `NOT_RUN` 不得计为 PASS：G-08 明确 `not_run=0` 才可 PASS；
- 历史签名时代残留（private key / signer roster / `SIGNED_RECORD`）出现在 Uter 侧即 FAIL；
- `legacy_gate_state`（L3=BLOCKED、L4 not_met=4）**如实保留**，未被本门禁改写
  （`rewritten_by_this_gate=false`）——外部/人工证据缺口按架构分离原则单独跟踪。

## 3. 与 AES 门禁的耦合

AES CI-14 的审计对象是 `DECISION` 角色文件；Uter 侧的
`scripts/quality/lib/ai_native_internal_gate.rb` 属于 Uter 仓库，由 Uter 自身门禁与本
报告管辖。两侧对"零私钥、零人工签署、零第三方签署"的判定一致：
AES 侧 `0 gating dependencies / 0 banned artifacts`，Uter 侧 G-06/G-07 PASS。

## 4. 证据文件

- `reports/compliance/aes-full-migration-2026-11-06/evidence/gates/ai-native-internal-gate.json`
- AES 侧存档：`round2/uter-ainative-gate.txt`
