# Runtime Test Report

> 由 `./uap report` 依据真实运行产物生成 · 2026-11-12T17:04:40.625Z · UAP 1.0.0
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

命令：`node --test .uap/tests/runtime.test.mjs`

真实退出码：**0**；耗时 2285ms；测试文件 1 个。

```
stDeny 权限组全为 deny；配置无 AES/UAES 引用；COMMAND_ALLOWLIST 不含 curl
      ---
      duration_ms: 8.693923
      type: 'test'
      ...
    1..1
ok 14 - 类别14 安全边界
  ---
  duration_ms: 8.833581
  type: 'suite'
  ...
# Subtest: 类别15 质量门禁阻断
    # Subtest: defaultValidator 对未成功步骤/无证据步骤返回 FAIL；合规任务返回 PASS
    ok 1 - defaultValidator 对未成功步骤/无证据步骤返回 FAIL；合规任务返回 PASS
      ---
      duration_ms: 0.26779
      type: 'test'
      ...
    # Subtest: assertTransition(CREATED,SUCCEEDED) 抛 IllegalTransitionError（fail-closed）
    ok 2 - assertTransition(CREATED,SUCCEEDED) 抛 IllegalTransitionError（fail-closed）
      ---
      duration_ms: 0.230282
      type: 'test'
      ...
    1..2
ok 15 - 类别15 质量门禁阻断
  ---
  duration_ms: 0.65082
  type: 'suite'
  ...
# Subtest: 类别16 模拟支付退款
    # Subtest: financialSimulation()：simulated_only=true、>=13 检查、PASS 检查有 evidence 且可追溯真实源码、无真实外部调用
    ok 1 - financialSimulation()：simulated_only=true、>=13 检查、PASS 检查有 evidence 且可追溯真实源码、无真实外部调用
      ---
      duration_ms: 16.455595
      type: 'test'
      ...
    1..1
ok 16 - 类别16 模拟支付退款
  ---
  duration_ms: 16.553831
  type: 'suite'
  ...
# Subtest: 类别17 自动修复闭环
    # Subtest: normalizeSpecHeaders({dryRun:true}) 返回 scanned/fixed/already_ok/unfixable 且连续两次幂等
    ok 1 - normalizeSpecHeaders({dryRun:true}) 返回 scanned/fixed/already_ok/unfixable 且连续两次幂等
      ---
      duration_ms: 14.049219
      type: 'test'
      ...
    1..1
ok 17 - 类别17 自动修复闭环
  ---
  duration_ms: 14.156404
  type: 'suite'
  ...
# Subtest: 类别18 状态机
    # Subtest: TASK_STATES 9 个；legalNext(SUCCEEDED) 为空；canTransition(RUNNING,WAITING_RECOVERY)=true；transition 原地更新并追加合法 history
    ok 1 - TASK_STATES 9 个；legalNext(SUCCEEDED) 为空；canTransition(RUNNING,WAITING_RECOVERY)=true；transition 原地更新并追加合法 history
      ---
      duration_ms: 0.273006
      type: 'test'
      ...
    1..1
ok 18 - 类别18 状态机
  ---
  duration_ms: 0.356441
  type: 'suite'
  ...
1..18
# tests 25
# suites 18
# pass 25
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2172.354401

```

## 测试文件清单

| 文件 |
| --- |
| .uap/tests/runtime.test.mjs |


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
