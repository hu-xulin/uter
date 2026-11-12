# Agent Compliance Report

> 由 `./uap report` 依据真实运行产物生成 · 2026-11-12T17:04:40.622Z · UAP 1.0.0
> 数据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与实时文件系统探测。

## 11 个 Agent

| ID | 角色 | 权限 | 工具数 | 输出 schema | 实现路径 | 实现存在 |
| --- | --- | --- | --- | --- | --- | --- |
| uap-orchestrator | task_orchestration | project_read,task_create,task_dispatch,evidence_write | 3 | agent-result | .uap/runtime/agent-runtime/index.mjs | YES |
| uap-product-agent | product_analysis | project_read,product_write,evidence_write | 2 | agent-result | .uap/engines/product/index.mjs | YES |
| uap-architecture-agent | architecture_analysis | project_read,architecture_write,evidence_write | 2 | agent-result | .uap/engines/architecture/index.mjs | YES |
| uap-development-agent | code_implementation | project_read,project_write,local_command,evidence_write | 2 | agent-result | .uap/engines/development/index.mjs | YES |
| uap-review-agent | independent_code_review | project_read,evidence_write | 2 | review-result | .uap/engines/code-review/index.mjs | YES |
| uap-test-agent | test_execution | project_read,local_command,test_environment,evidence_write | 2 | test-result | .uap/engines/testing/index.mjs | YES |
| uap-repair-agent | defect_repair | project_read,project_write,local_command,evidence_write | 2 | repair-result | .uap/engines/auto-repair/index.mjs | YES |
| uap-security-agent | security_assessment | project_read,local_command,evidence_write | 2 | security-result | .uap/engines/security/index.mjs | YES |
| uap-cross-platform-agent | platform_consistency | project_read,project_write,local_command,evidence_write | 2 | agent-result | .uap/engines/cross-platform/index.mjs | YES |
| uap-delivery-agent | build_and_delivery | project_read,local_command,test_environment,evidence_write | 2 | delivery-result | .uap/engines/delivery/index.mjs | YES |
| uap-knowledge-agent | knowledge_management | project_read,knowledge_write,evidence_write | 2 | agent-result | .uap/engines/knowledge/index.mjs | YES |


## 策略引擎健康

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

整体 ok=true

## 拒绝决策审计

审计记录 1000 条，其中拒绝 999 条。
