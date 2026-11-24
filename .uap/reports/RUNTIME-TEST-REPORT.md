# Runtime Test Report

> 由 `./uap report` 依据真实运行产物生成 · 2026-11-24T07:46:08.854Z · UAP 1.0.0
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

命令：`node --test --test-reporter=tap --test-concurrency=1 .uap/tests/architecture-adr-traceability.test.mjs .uap/tests/deployment-drill-classification.test.mjs .uap/tests/execution-identity-race.test.mjs .uap/tests/execution-lifecycle.test.mjs .uap/tests/final-acceptance-capabilities.test.mjs .uap/tests/final-acceptance-negative.test.mjs .uap/tests/final-remediation-regression.test.mjs .uap/tests/independent-repair-review.test.mjs .uap/tests/independent-verification.test.mjs .uap/tests/phase2-requirement-verification.test.mjs .uap/tests/phase2-security-negative.test.mjs .uap/tests/real-code-repair-boundaries.test.mjs .uap/tests/real-repair-e2e.test.mjs .uap/tests/requirement-behavior-suite.test.mjs .uap/tests/requirement-honesty.test.mjs .uap/tests/runtime.test.mjs .uap/tests/status-consistency.test.mjs .uap/tests/status-snapshot.test.mjs .uap/tests/test-collector.test.mjs .uap/tests/worktree-fingerprint-exclusions.test.mjs`

真实退出码：**0**；耗时 270673ms；测试文件 20 个。

```
   ok 6 - 状态块是可机读 JSON，字段与 verdict 一致
      ---
      duration_ms: 2730.054082
      type: 'test'
      ...
    1..6
ok 117 - 真实快照适配器
  ---
  duration_ms: 9350.53641
  type: 'suite'
  ...
# Subtest: 证据链 fail-closed
    # Subtest: 缺少绑定字段或哈希未校验的证据一律失败
    ok 1 - 缺少绑定字段或哈希未校验的证据一律失败
      ---
      duration_ms: 0.290997
      type: 'test'
      ...
    1..1
ok 118 - 证据链 fail-closed
  ---
  duration_ms: 0.448132
  type: 'suite'
  ...
# Subtest: fixtures are excluded, real self-tests are kept
ok 119 - fixtures are excluded, real self-tests are kept
  ---
  duration_ms: 2.347823
  type: 'test'
  ...
# Subtest: the intentionally failing repair canaries are never collected
ok 120 - the intentionally failing repair canaries are never collected
  ---
  duration_ms: 0.272348
  type: 'test'
  ...
# Subtest: discovery is fail-closed on non-test / malformed paths
ok 121 - discovery is fail-closed on non-test / malformed paths
  ---
  duration_ms: 0.63239
  type: 'test'
  ...
# Subtest: the CLI actually uses the shared collector (no re-introduced inline filter)
ok 122 - the CLI actually uses the shared collector (no re-introduced inline filter)
  ---
  duration_ms: 0.623213
  type: 'test'
  ...
# Subtest: generated Playwright reports do not invalidate a UAP execution batch
ok 123 - generated Playwright reports do not invalidate a UAP execution batch
  ---
  duration_ms: 1.054162
  type: 'test'
  ...
# Subtest: Playwright test sources and frozen visual baselines remain fingerprint-bound
ok 124 - Playwright test sources and frozen visual baselines remain fingerprint-bound
  ---
  duration_ms: 0.235584
  type: 'test'
  ...
# Subtest: visual baseline generation is disabled by default and requires the explicit update command
ok 125 - visual baseline generation is disabled by default and requires the explicit update command
  ---
  duration_ms: 1.278338
  type: 'test'
  ...
1..125
# tests 219
# suites 32
# pass 219
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 270531.768619

```

## 测试文件清单

| 文件 |
| --- |
| .uap/tests/architecture-adr-traceability.test.mjs |
| .uap/tests/deployment-drill-classification.test.mjs |
| .uap/tests/execution-identity-race.test.mjs |
| .uap/tests/execution-lifecycle.test.mjs |
| .uap/tests/final-acceptance-capabilities.test.mjs |
| .uap/tests/final-acceptance-negative.test.mjs |
| .uap/tests/final-remediation-regression.test.mjs |
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
| .uap/tests/worktree-fingerprint-exclusions.test.mjs |


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
