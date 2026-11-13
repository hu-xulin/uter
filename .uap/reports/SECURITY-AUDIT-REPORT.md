# Security Audit Report

> 由 `./uap report` 依据真实运行产物生成 · 2026-11-13T03:32:03.863Z · UAP 1.0.0
> 数据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与实时文件系统探测。

## 权限策略

| 检查 | 结果 |
| --- | --- |
| policy_loaded | PASS |
| default_deny | PASS |
| allow_registered_permission | PASS |
| deny_production_write | PASS |
| deny_unregistered_agent | PASS |
| deny_undeclared_permission | PASS |
| deny_unlisted_command | PASS |
| all_high_risk_denied | PASS |
| audit_logged | PASS |

`default_effect=deny`，`fail_closed=true`。

## 必须拒绝的权限组

| 权限 | 配置 effect |
| --- | --- |
| production_read | deny |
| production_write | deny |
| production_deploy | deny |
| real_payment | deny |
| real_refund | deny |
| secret_export | deny |
| force_push | deny |
| branch_creation | deny |
| branch_switch | deny |
| destructive_git | deny |
| quality_gate_disable | deny |
| test_deletion_to_force_pass | deny |


## 密钥形态字面量扫描

UAP 目录 0 命中。

## 拒绝决策审计

policy-audit.jsonl 共 1825 条决策，1711 条 DENY。

## 生产授权边界

生产发布、生产数据库写入、真实支付/退款、密钥导出、强制推送与破坏性 Git 操作从未执行，且被策略引擎拒绝。详见 BLOCKED-ITEMS.md。
