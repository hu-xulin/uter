# CI/CD 门禁验证报告（§8 八类门禁）

- **Document:** `9/14` of §11 (14 mandated deliverables)
- **Generated:** 2026-11-09T05:04:20Z
- **Uter commit SHA:** `ec6501adceb008d46140a7e5ab6508eb78006731`
- **AES commit SHA:** `0c9386b192090e901ccc5de6df1f2aebe3f5c618`
- **Execution environment:** macOS-26.7.2-x86_64-i386-64bit-Mach-O
- **Collector:** WorkBuddy (Tencent Hunyuan Hy)
- **Evidence root:** `reports/compliance/full-conformance-audit-2026-11-06/evidence/`

> 本文件由真实仓库状态与真实命令退出码生成。未执行的验证一律记为 `NOT_RUN` / `BLOCKED`，
> 绝不以文档、代码改动或 Agent 自述代替工程验证（§12 / §13）。

---


真实状态评估 8 类门禁；每类另做一次**真实子进程负向阻断测试**：
把一份「不符合要求的变更」写成 fixture state，再调用
`gate-check --state <fixture> --gate <ID>`，要求 exit 2 / verdict BLOCK。

**负向阻断证明：8/8**

## 真实状态判定

| 门禁 | 真实 verdict | 通过检查数 | 未通过检查 | 判定说明 |
|---|---|---|---|---|
| CHANGE_GATE | BLOCK | 5/10 | workspace_overall_PASS, workspace_W1_PASS, workspace_W5_PASS, L1_CHANGE_GATE_PASS, no_staged_changes | workspace/branch/WIP protection + spec completeness |
| CODE_REVIEW_GATE | BLOCK | 5/6 | agent_reverse_bypass_PASS | positive + negative fixtures, independent re-evaluation, Agent bypass resistance |
| TESTING_GATE | BLOCK | 2/6 | final_matrix_PASS, final_matrix_all_pass, final_matrix_no_fail_skip, recheck_compile_static_unit_PASS | compile / unit / integration / regression / race / coverage; excludes security FAILs owned by SECURITY_GATE |
| SECURITY_GATE | BLOCK | 7/9 | DAST_penetration_API_security_executed, three_database_and_recovery_executed | §6 security verification; DAST/penetration/API security/three-DB/DR require authorised environments |
| ARCHITECTURE_GATE | ALLOW | 6/6 |  | two-repository separation, P09 proves / P10 defines, 14-domain scope, build wiring |
| BUSINESS_ACCEPTANCE_GATE | BLOCK | 6/7 | all_items_VERIFIED | §16.3/§16.4 human acceptance; WorkBuddy must not self-sign |
| RELEASE_GATE | BLOCK | 2/7 | L1_PASS, L3_all_14_PASS, L4_not_BLOCKED, no_open_P0_P1, no_delivery_action_performed | full validation before any commit/push/PR/merge/deploy |
| GLOBAL_AES_CONFORMANCE_GATE | BLOCK | 2/7 | requirement_specific_verification_exists, all_applicable_requirements_PASS, no_unresolved_P0_P1, independent_review_supports_claim, all_eight_gates_ALLOW | §10 final acceptance conditions; §12 vocabulary |


## 负向阻断测试

| 门禁 | 注入的不合规变更 | exit | verdict | 阻断成立 | 原始日志 |
|---|---|---|---|---|---|
| CHANGE_GATE | workspace W2 staged-change check forced to FAIL | 2 | BLOCK | True | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/GATE-NEG-CHANGE_GATE.log` |
| CODE_REVIEW_GATE | runtime selftest honesty assertion forced to FAIL | 2 | BLOCK | True | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/GATE-NEG-CODE_REVIEW_GATE.log` |
| TESTING_GATE | final matrix forced to 28/29 with 1 FAIL | 2 | BLOCK | True | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/GATE-NEG-TESTING_GATE.log` |
| SECURITY_GATE | all local scanners faked PASS while DAST/DR evidence still absent | 2 | BLOCK | True | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/GATE-NEG-SECURITY_GATE.log` |
| ARCHITECTURE_GATE | repository separation gate forced to FAIL | 2 | BLOCK | True | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/GATE-NEG-ARCHITECTURE_GATE.log` |
| BUSINESS_ACCEPTANCE_GATE | signoff_granted=true with zero signed items (self-approval bypass) | 2 | BLOCK | True | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/GATE-NEG-BUSINESS_ACCEPTANCE_GATE.log` |
| RELEASE_GATE | L4 declared PASS while 0/14 L3 domains passed | 2 | BLOCK | True | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/GATE-NEG-RELEASE_GATE.log` |
| GLOBAL_AES_CONFORMANCE_GATE | matrix by_result faked to all-PASS with 0 requirement-specific verifications | 2 | BLOCK | True | `reports/compliance/full-conformance-audit-2026-11-06/evidence/raw/GATE-NEG-GLOBAL_AES_CONFORMANCE_GATE.log` |


## CI 接线

`.github/workflows/ci.yml` 含 `test-aes-integration-check.rb`、`test-aes-pin-check.rb`、
`test-ai-governance-policy.rb`、`test-uter-governance-boundaries.rb`、
`aes-agent-runtime-check.rb selftest` 与 authorize deny 循环。
本轮在本地真实执行了同一 deny 循环（AG-10）与 8 条门禁负向测试。
**未在 GitHub 上产生真实 CI 运行**：无授权 push / PR，记为 `NOT_RUN`（NR-09）。

## 与四层门禁的关系

`UTER-AES-GOV-001` 的 L1/L2/L3/L4 继续保留；本指令 §8 的八类门禁作为
额外的可执行层映射到它（CONF-002），两者不互相替代。
