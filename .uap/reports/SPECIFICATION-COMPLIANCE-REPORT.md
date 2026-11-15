# Specification Compliance Report

> 由 `./uap report` 依据真实运行产物生成 · 2026-11-15T06:22:01.965Z · UAP 1.0.0
> 数据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与实时文件系统探测。

## 逐份规范（真实文件探测）

| 编号 | 域 | 字节 | 状态 | 章节缺失 | 执行器 | 验证器 | 验证结果 | 完整 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UAP-00-001 | core | 9748 | ACTIVE | 无 | core.architecture | core.architecture_integrity | PASS | YES |
| UAP-00-002 | core | 9652 | ACTIVE | 无 | core.autonomous_execution | core.execution_integrity | PASS | YES |
| UAP-00-003 | core | 10279 | ACTIVE | 无 | security.policy | security.permission_boundary | PASS | YES |
| UAP-00-004 | core | 9385 | ACTIVE | 无 | core.evidence | core.evidence_integrity | PASS | YES |
| UAP-01-001 | product | 9756 | IMPLEMENTED_NOT_VERIFIED | 无 | product.requirements | product.requirement_traceability | PASS | YES |
| UAP-01-002 | product | 9032 | IMPLEMENTED_NOT_VERIFIED | 无 | product.prototype_sync | product.prototype_consistency | PASS | YES |
| UAP-01-003 | product | 9548 | ACTIVE | 无 | product.business_rules | product.business_rule_integrity | PASS | YES |
| UAP-02-001 | architecture | 9321 | IMPLEMENTED_NOT_VERIFIED | 无 | architecture.analyzer | architecture.consistency | PASS | YES |
| UAP-02-002 | architecture | 10498 | ACTIVE | 无 | architecture.api_database | architecture.api_database_integrity | PASS | YES |
| UAP-02-003 | architecture | 9326 | IMPLEMENTED_NOT_VERIFIED | 无 | architecture.adr | architecture.adr_integrity | PASS | YES |
| UAP-03-001 | agents | 9633 | IMPLEMENTED_NOT_VERIFIED | 无 | agents.registry | agents.registry_integrity | PASS | YES |
| UAP-03-002 | agents | 9289 | IMPLEMENTED_NOT_VERIFIED | 无 | agents.execution | agents.execution_integrity | PASS | YES |
| UAP-03-003 | agents | 9393 | IMPLEMENTED_NOT_VERIFIED | 无 | agents.collaboration | agents.collaboration_integrity | PASS | YES |
| UAP-03-004 | agents | 9124 | IMPLEMENTED_NOT_VERIFIED | 无 | agents.recovery | agents.recovery_integrity | PASS | YES |
| UAP-04-001 | development | 9829 | IMPLEMENTED_NOT_VERIFIED | 无 | development.coding_standard | development.coding_compliance | PASS | YES |
| UAP-04-002 | development | 9977 | IMPLEMENTED_NOT_VERIFIED | 无 | development.code_review | development.review_integrity | PASS | YES |
| UAP-04-003 | development | 9869 | IMPLEMENTED_NOT_VERIFIED | 无 | development.dependencies | development.dependency_integrity | PASS | YES |
| UAP-05-001 | quality | 11820 | ACTIVE | 无 | quality.engineering | quality.engineering_integrity | PASS | YES |
| UAP-05-002 | quality | 11535 | ACTIVE | 无 | quality.testing | quality.test_integrity | PASS | YES |
| UAP-05-003 | quality | 11487 | ACTIVE | 无 | quality.auto_repair | quality.repair_integrity | PASS | YES |
| UAP-05-004 | quality | 12446 | ACTIVE | 无 | quality.gates | quality.gate_integrity | PASS | YES |
| UAP-06-001 | security | 13593 | ACTIVE | 无 | security.application | security.application_integrity | PASS | YES |
| UAP-06-002 | security | 17956 | ACTIVE | 无 | security.financial_integrity | security.financial_integrity_validator | PASS | YES |
| UAP-06-003 | security | 14187 | ACTIVE | 无 | security.reliability | security.reliability_integrity | PASS | YES |
| UAP-07-001 | cross-platform | 13422 | ACTIVE | 无 | cross_platform.web | cross_platform.web_integrity | PASS | YES |
| UAP-07-002 | cross-platform | 13081 | ACTIVE | 无 | cross_platform.h5 | cross_platform.h5_integrity | PASS | YES |
| UAP-07-003 | cross-platform | 13669 | ACTIVE | 无 | cross_platform.consistency | cross_platform.consistency_integrity | PASS | YES |
| UAP-08-001 | delivery | 14836 | ACTIVE | 无 | delivery.ci_cd | delivery.ci_integrity | PASS | YES |
| UAP-08-002 | delivery | 15533 | ACTIVE | 无 | delivery.deployment | delivery.deployment_integrity | PASS | YES |
| UAP-08-003 | delivery | 14964 | ACTIVE | 无 | delivery.observability | delivery.observability_integrity | PASS | YES |
| UAP-09-001 | evolution | 14559 | ACTIVE | 无 | evolution.knowledge | evolution.knowledge_integrity | PASS | YES |
| UAP-09-002 | evolution | 17127 | ACTIVE | 无 | evolution.continuous | evolution.evolution_integrity | PASS | YES |


## 汇总

完整 32/32；验证 PASS 32；FAIL 0；未执行 0。

统一章节要求：标准编号、规范目标、强制性要求、执行流程、对应执行器、对应验证器、输入和输出、失败处理、验收条件、证据要求、依赖标准。
