# Specification Registry Report

> 由 `./uap report` 依据真实运行产物生成 · 2026-11-24T07:46:08.754Z · UAP 1.0.0
> 数据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与实时文件系统探测。

## 6 份机器配置

| 配置 | 字节 | 可解析 |
| --- | --- | --- |
| specification-registry | 7813 | YES |
| execution-mapping | 4357 | YES |
| agent-registry | 3462 | YES |
| permission-policy | 1795 | YES |
| workflow-registry | 3117 | YES |
| validator-registry | 5984 | YES |


## 37 项完整性检查

| 检查 | 结果 | 明细 |
| --- | --- | --- |
| config.present.specification-registry | PASS | specification-registry.yaml size=7813 bytes |
| config.parsed.specification-registry | PASS | specification-registry.yaml parsed to object |
| config.present.execution-mapping | PASS | execution-mapping.yaml size=4357 bytes |
| config.parsed.execution-mapping | PASS | execution-mapping.yaml parsed to object |
| config.present.agent-registry | PASS | agent-registry.yaml size=3462 bytes |
| config.parsed.agent-registry | PASS | agent-registry.yaml parsed to object |
| config.present.permission-policy | PASS | permission-policy.yaml size=1795 bytes |
| config.parsed.permission-policy | PASS | permission-policy.yaml parsed to object |
| config.present.workflow-registry | PASS | workflow-registry.yaml size=3117 bytes |
| config.parsed.workflow-registry | PASS | workflow-registry.yaml parsed to object |
| config.present.validator-registry | PASS | validator-registry.yaml size=5984 bytes |
| config.parsed.validator-registry | PASS | validator-registry.yaml parsed to object |
| registry.spec_count | PASS | specification count = 32 (expected 32) |
| registry.unique_ids | PASS | unique IDs = 32/32 |
| registry.status_values | PASS | status_values = 8 values, equality=true |
| registry.spec_files_nonempty | PASS | spec files under 2000 bytes = 0 |
| registry.spec_sections | PASS | spec files with missing sections / bad header / bad status = 0 |
| registry.dependencies_exist | PASS | missing dependency references = 0 |
| registry.dependencies_acyclic | PASS | cycles = 0 |
| registry.executor_mapping | PASS | specs without a registered executor = 0 |
| registry.executor_files | PASS | executor entry files missing = 0 |
| registry.validator_mapping | PASS | specs without a registered validator = 0 |
| registry.validator_files | PASS | validator implementation files missing = 0 |
| registry.validator_targets | PASS | validators with wrong target = 0 |
| registry.validator_unique | PASS | unique validator IDs = 32/32 |
| registry.validator_checks | PASS | validators without checks = 0 |
| registry.validator_orphans | PASS | orphan validators = 0 |
| registry.agent_unique | PASS | unique agent IDs = 11/11 |
| registry.agent_count | PASS | registered agents = 11 (expected 11) |
| registry.agent_permissions | PASS | undeclared permissions = 0 |
| registry.agent_implementation | PASS | agents without real implementation = 0 |
| policy.fail_closed | PASS | default_effect=deny, missing denies=0 |
| policy.enforcement | PASS | enforcement.fail_closed=true |
| registry.workflow_count | PASS | workflows = 7 (expected 7) |
| registry.workflow_unique | PASS | unique workflow IDs = 7 |
| registry.workflow_implementation | PASS | workflows with missing steps/implementation = 0 |
| independence.no_retired_governance_refs | PASS | AES/UAES references in configs = 0 |


## 阻断发现

无。

## 结论

37/37 registry checks passed, 0 blocking findings
