# Runtime Test Report

> 由 `./uap report` 依据真实运行产物生成 · 2026-11-15T02:15:26.385Z · UAP 1.0.0
> 数据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与实时文件系统探测。

## 10 个核心组件健康

| 组件 | 结果 | 错误 |
| --- | --- | --- |
| orchestrator | PASS | — |
| task-engine | PASS | — |
| state-machine | PASS | — |
| event-system | PASS | — |
| scheduler | PASS | — |
| resource-manager | PASS | — |
| recovery-engine | PASS | — |
| agent-runtime | PASS | — |
| evidence-engine | PASS | — |
| policy-engine | PASS | — |


## UAP 自身测试

命令：`node --test --test-concurrency=1 .uap/tests/execution-identity-race.test.mjs .uap/tests/final-acceptance-negative.test.mjs .uap/tests/independent-repair-review.test.mjs .uap/tests/independent-verification.test.mjs .uap/tests/phase2-requirement-verification.test.mjs .uap/tests/phase2-security-negative.test.mjs .uap/tests/real-code-repair-boundaries.test.mjs .uap/tests/real-repair-e2e.test.mjs .uap/tests/requirement-behavior-suite.test.mjs .uap/tests/requirement-honesty.test.mjs .uap/tests/runtime.test.mjs .uap/tests/status-consistency.test.mjs .uap/tests/status-snapshot.test.mjs .uap/tests/test-collector.test.mjs`

真实退出码：**1**；耗时 164480ms；测试文件 14 个。

```
ok 2 - stale 判定与卡片绑定状态严格一致，且绝不提升为 PASS
      ---
      duration_ms: 796.116412
      type: 'test'
      ...
    # Subtest: 伪造旧 execution_id / HEAD 的真实快照一律判为 stale
    ok 3 - 伪造旧 execution_id / HEAD 的真实快照一律判为 stale
      ---
      duration_ms: 791.210167
      type: 'test'
      ...
    # Subtest: statusVerdict 与 FINAL-STATUS.json / 索引同源，且不得自行宣称成功
    ok 4 - statusVerdict 与 FINAL-STATUS.json / 索引同源，且不得自行宣称成功
      ---
      duration_ms: 3031.21118
      type: 'test'
      ...
    # Subtest: 注入 indexDeclaration 只影响一致性比对，不伪造通过数
    ok 5 - 注入 indexDeclaration 只影响一致性比对，不伪造通过数
      ---
      duration_ms: 2852.872171
      type: 'test'
      ...
    # Subtest: 状态块是可机读 JSON，字段与 verdict 一致
    ok 6 - 状态块是可机读 JSON，字段与 verdict 一致
      ---
      duration_ms: 3078.601845
      type: 'test'
      ...
    1..6
ok 67 - 真实快照适配器
  ---
  duration_ms: 11416.015409
  type: 'suite'
  ...
# Subtest: 证据链 fail-closed
    # Subtest: 缺少绑定字段或哈希未校验的证据一律失败
    ok 1 - 缺少绑定字段或哈希未校验的证据一律失败
      ---
      duration_ms: 0.483639
      type: 'test'
      ...
    1..1
ok 68 - 证据链 fail-closed
  ---
  duration_ms: 0.723868
  type: 'suite'
  ...
# Subtest: fixtures are excluded, real self-tests are kept
ok 69 - fixtures are excluded, real self-tests are kept
  ---
  duration_ms: 4.235076
  type: 'test'
  ...
# Subtest: the intentionally failing repair canaries are never collected
ok 70 - the intentionally failing repair canaries are never collected
  ---
  duration_ms: 0.680357
  type: 'test'
  ...
# Subtest: discovery is fail-closed on non-test / malformed paths
ok 71 - discovery is fail-closed on non-test / malformed paths
  ---
  duration_ms: 1.430716
  type: 'test'
  ...
# Subtest: the CLI actually uses the shared collector (no re-introduced inline filter)
ok 72 - the CLI actually uses the shared collector (no re-introduced inline filter)
  ---
  duration_ms: 1.42613
  type: 'test'
  ...
1..72
# tests 161
# suites 31
# pass 159
# fail 2
# cancelled 0
# skipped 0
# todo 0
# duration_ms 164312.075952

```

## 测试文件清单

| 文件 |
| --- |
| .uap/tests/execution-identity-race.test.mjs |
| .uap/tests/final-acceptance-negative.test.mjs |
| .uap/tests/fixtures/repair-e2e/full.test.mjs |
| .uap/tests/fixtures/repair-e2e/module.test.mjs |
| .uap/tests/fixtures/repair-e2e/original.test.mjs |
| .uap/tests/fixtures/repair-e2e/regression.test.mjs |
| .uap/tests/independent-repair-review.test.mjs |
| .uap/tests/independent-verification.test.mjs |
| .uap/tests/phase2-requirement-verification.test.mjs |
| .uap/tests/phase2-security-negative.test.mjs |
| .uap/tests/real-code-repair-boundaries.test.mjs |
| .uap/tests/real-repair-e2e.test.mjs |
| .uap/tests/requirement-behavior-suite.test.mjs |
| .uap/tests/requirement-honesty.test.mjs |
| .uap/tests/runtime.test.mjs |
| .uap/tests/status-consistency.test.mjs |
| .uap/tests/status-snapshot.test.mjs |
| .uap/tests/test-collector.test.mjs |


## 中断恢复

| 检查 | 结果 |
| --- | --- |
| child_process_crashed | true |
| state_persisted_before_crash | true |
| step1_completed_before_crash | true |
| recovery_reached_succeeded | true |
| completed_steps_not_repeated | true |
| recovery_evidence_written | true |

最终状态：SUCCEEDED，整体 ok=true
