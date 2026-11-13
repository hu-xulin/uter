# Runtime Test Report

> 由 `./uap report` 依据真实运行产物生成 · 2026-11-13T11:24:09.898Z · UAP 1.0.0
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

命令：`node --test --test-concurrency=1 .uap/tests/execution-identity-race.test.mjs .uap/tests/independent-repair-review.test.mjs .uap/tests/independent-verification.test.mjs .uap/tests/real-code-repair-boundaries.test.mjs .uap/tests/runtime.test.mjs .uap/tests/status-consistency.test.mjs .uap/tests/status-snapshot.test.mjs`

真实退出码：**0**；耗时 27320ms；测试文件 7 个。

```
 # Subtest: git HEAD 来自真实仓库且是 40 位 sha
    ok 1 - git HEAD 来自真实仓库且是 40 位 sha
      ---
      duration_ms: 17.188139
      type: 'test'
      ...
    # Subtest: worktree 指纹稳定，且不受 UAP 运行产物写入影响
    ok 2 - worktree 指纹稳定，且不受 UAP 运行产物写入影响
      ---
      duration_ms: 179.711847
      type: 'test'
      ...
    # Subtest: currentExecution 返回同一身份，且绑定字段不可被调用方伪造
    ok 3 - currentExecution 返回同一身份，且绑定字段不可被调用方伪造
      ---
      duration_ms: 177.766964
      type: 'test'
      ...
    1..3
ok 34 - 执行身份绑定
  ---
  duration_ms: 376.110601
  type: 'suite'
  ...
# Subtest: 真实快照适配器
    # Subtest: 从真实追踪矩阵构造 538 条要求与 32 份规范
    ok 1 - 从真实追踪矩阵构造 538 条要求与 32 份规范
      ---
      duration_ms: 123.043767
      type: 'test'
      ...
    # Subtest: stale 判定与卡片绑定状态严格一致，且绝不提升为 PASS
    ok 2 - stale 判定与卡片绑定状态严格一致，且绝不提升为 PASS
      ---
      duration_ms: 110.065823
      type: 'test'
      ...
    # Subtest: 伪造旧 execution_id / HEAD 的真实快照一律判为 stale
    ok 3 - 伪造旧 execution_id / HEAD 的真实快照一律判为 stale
      ---
      duration_ms: 83.760907
      type: 'test'
      ...
    # Subtest: statusVerdict 与 FINAL-STATUS.json / 索引同源，且不得自行宣称成功
    ok 4 - statusVerdict 与 FINAL-STATUS.json / 索引同源，且不得自行宣称成功
      ---
      duration_ms: 392.563603
      type: 'test'
      ...
    # Subtest: 注入 indexDeclaration 只影响一致性比对，不伪造通过数
    ok 5 - 注入 indexDeclaration 只影响一致性比对，不伪造通过数
      ---
      duration_ms: 260.469472
      type: 'test'
      ...
    # Subtest: 状态块是可机读 JSON，字段与 verdict 一致
    ok 6 - 状态块是可机读 JSON，字段与 verdict 一致
      ---
      duration_ms: 313.171624
      type: 'test'
      ...
    1..6
ok 35 - 真实快照适配器
  ---
  duration_ms: 1283.950923
  type: 'suite'
  ...
# Subtest: 证据链 fail-closed
    # Subtest: 缺少绑定字段或哈希未校验的证据一律失败
    ok 1 - 缺少绑定字段或哈希未校验的证据一律失败
      ---
      duration_ms: 0.418884
      type: 'test'
      ...
    1..1
ok 36 - 证据链 fail-closed
  ---
  duration_ms: 0.552411
  type: 'suite'
  ...
1..36
# tests 70
# suites 26
# pass 70
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 27214.808352

```

## 测试文件清单

| 文件 |
| --- |
| .uap/tests/execution-identity-race.test.mjs |
| .uap/tests/independent-repair-review.test.mjs |
| .uap/tests/independent-verification.test.mjs |
| .uap/tests/real-code-repair-boundaries.test.mjs |
| .uap/tests/runtime.test.mjs |
| .uap/tests/status-consistency.test.mjs |
| .uap/tests/status-snapshot.test.mjs |


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
