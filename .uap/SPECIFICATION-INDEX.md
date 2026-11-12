# UAP 1.0 — 规范索引

- 生成时间：2026-11-12T10:55:33.437Z（由 `node .uap/tools/generate-index.mjs` 依据真实注册表生成）
- 规范总数：**32**
- 注册表完整性：**PASS**（37/37 项检查，0 条阻断发现）
- 规范状态口径：`ACTIVE` / `IMPLEMENTED_NOT_VERIFIED`；未验证绝不写 `FULLY_VERIFIED`

## 统一章节要求

每份规范必须包含：`标准编号`、`规范目标`、`强制性要求`、`执行流程`、`对应执行器`、`对应验证器`、`输入和输出`、`失败处理`、`验收条件`、`证据要求`、`依赖标准`，另含「Uter 落地细则」。

## 按域索引

### core

| 编号 | 名称 | 文件 | 关键级别 | 状态 | 执行器 | 验证器 | 依赖 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UAP-00-001 | UAP 核心架构规范 | [`.uap/core/UAP-00-001-CORE-ARCHITECTURE.md`](../.uap/core/UAP-00-001-CORE-ARCHITECTURE.md) (14081B) | P0 | ACTIVE | `core.architecture` | `core.architecture_integrity` | — |
| UAP-00-002 | 自主执行规范 | [`.uap/core/UAP-00-002-AUTONOMOUS-EXECUTION.md`](../.uap/core/UAP-00-002-AUTONOMOUS-EXECUTION.md) (13945B) | P0 | ACTIVE | `core.autonomous_execution` | `core.execution_integrity` | UAP-00-001 |
| UAP-00-003 | 自主工程安全边界规范 | [`.uap/core/UAP-00-003-SECURITY-BOUNDARY.md`](../.uap/core/UAP-00-003-SECURITY-BOUNDARY.md) (14710B) | P0 | ACTIVE | `security.policy` | `security.permission_boundary` | UAP-00-001 |
| UAP-00-004 | 证据与状态管理规范 | [`.uap/core/UAP-00-004-EVIDENCE-AND-STATE.md`](../.uap/core/UAP-00-004-EVIDENCE-AND-STATE.md) (13648B) | P0 | ACTIVE | `core.evidence` | `core.evidence_integrity` | UAP-00-001 |

### product

| 编号 | 名称 | 文件 | 关键级别 | 状态 | 执行器 | 验证器 | 依赖 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UAP-01-001 | 产品需求工程规范 | [`.uap/product/UAP-01-001-PRODUCT-REQUIREMENTS.md`](../.uap/product/UAP-01-001-PRODUCT-REQUIREMENTS.md) (13987B) | P1 | IMPLEMENTED_NOT_VERIFIED | `product.requirements` | `product.requirement_traceability` | UAP-00-001 |
| UAP-01-002 | PRD 与原型双向同步规范 | [`.uap/product/UAP-01-002-PRD-PROTOTYPE-SYNC.md`](../.uap/product/UAP-01-002-PRD-PROTOTYPE-SYNC.md) (13372B) | P1 | IMPLEMENTED_NOT_VERIFIED | `product.prototype_sync` | `product.prototype_consistency` | UAP-01-001 |
| UAP-01-003 | 业务规则工程规范 | [`.uap/product/UAP-01-003-BUSINESS-RULES.md`](../.uap/product/UAP-01-003-BUSINESS-RULES.md) (14153B) | P0 | ACTIVE | `product.business_rules` | `product.business_rule_integrity` | UAP-01-001 |

### architecture

| 编号 | 名称 | 文件 | 关键级别 | 状态 | 执行器 | 验证器 | 依赖 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UAP-02-001 | 系统架构规范 | [`.uap/architecture/UAP-02-001-SYSTEM-ARCHITECTURE.md`](../.uap/architecture/UAP-02-001-SYSTEM-ARCHITECTURE.md) (13980B) | P1 | IMPLEMENTED_NOT_VERIFIED | `architecture.analyzer` | `architecture.consistency` | UAP-00-001 |
| UAP-02-002 | API 与数据库规范 | [`.uap/architecture/UAP-02-002-API-AND-DATABASE.md`](../.uap/architecture/UAP-02-002-API-AND-DATABASE.md) (15449B) | P0 | ACTIVE | `architecture.api_database` | `architecture.api_database_integrity` | UAP-02-001 |
| UAP-02-003 | 技术决策规范 | [`.uap/architecture/UAP-02-003-TECHNICAL-DECISIONS.md`](../.uap/architecture/UAP-02-003-TECHNICAL-DECISIONS.md) (14285B) | P2 | IMPLEMENTED_NOT_VERIFIED | `architecture.adr` | `architecture.adr_integrity` | UAP-02-001 |

### agents

| 编号 | 名称 | 文件 | 关键级别 | 状态 | 执行器 | 验证器 | 依赖 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UAP-03-001 | Agent 架构规范 | [`.uap/agents/UAP-03-001-AGENT-ARCHITECTURE.md`](../.uap/agents/UAP-03-001-AGENT-ARCHITECTURE.md) (13383B) | P0 | IMPLEMENTED_NOT_VERIFIED | `agents.registry` | `agents.registry_integrity` | UAP-00-001, UAP-00-003 |
| UAP-03-002 | Agent 执行规范 | [`.uap/agents/UAP-03-002-AGENT-EXECUTION.md`](../.uap/agents/UAP-03-002-AGENT-EXECUTION.md) (12897B) | P0 | IMPLEMENTED_NOT_VERIFIED | `agents.execution` | `agents.execution_integrity` | UAP-03-001 |
| UAP-03-003 | Agent 协作规范 | [`.uap/agents/UAP-03-003-AGENT-COLLABORATION.md`](../.uap/agents/UAP-03-003-AGENT-COLLABORATION.md) (13217B) | P1 | IMPLEMENTED_NOT_VERIFIED | `agents.collaboration` | `agents.collaboration_integrity` | UAP-03-001, UAP-03-002 |
| UAP-03-004 | Agent 恢复规范 | [`.uap/agents/UAP-03-004-AGENT-RECOVERY.md`](../.uap/agents/UAP-03-004-AGENT-RECOVERY.md) (13102B) | P0 | IMPLEMENTED_NOT_VERIFIED | `agents.recovery` | `agents.recovery_integrity` | UAP-03-002 |

### development

| 编号 | 名称 | 文件 | 关键级别 | 状态 | 执行器 | 验证器 | 依赖 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UAP-04-001 | 编码规范 | [`.uap/development/UAP-04-001-CODING-STANDARD.md`](../.uap/development/UAP-04-001-CODING-STANDARD.md) (13855B) | P1 | IMPLEMENTED_NOT_VERIFIED | `development.coding_standard` | `development.coding_compliance` | UAP-00-001 |
| UAP-04-002 | 自动代码审查规范 | [`.uap/development/UAP-04-002-CODE-REVIEW.md`](../.uap/development/UAP-04-002-CODE-REVIEW.md) (14494B) | P0 | IMPLEMENTED_NOT_VERIFIED | `development.code_review` | `development.review_integrity` | UAP-04-001 |
| UAP-04-003 | 依赖管理规范 | [`.uap/development/UAP-04-003-DEPENDENCY-MANAGEMENT.md`](../.uap/development/UAP-04-003-DEPENDENCY-MANAGEMENT.md) (14267B) | P1 | IMPLEMENTED_NOT_VERIFIED | `development.dependencies` | `development.dependency_integrity` | UAP-04-001 |

### quality

| 编号 | 名称 | 文件 | 关键级别 | 状态 | 执行器 | 验证器 | 依赖 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UAP-05-001 | 质量工程总规范 | [`.uap/quality/UAP-05-001-QUALITY-ENGINEERING.md`](../.uap/quality/UAP-05-001-QUALITY-ENGINEERING.md) (16743B) | P0 | ACTIVE | `quality.engineering` | `quality.engineering_integrity` | UAP-04-002 |
| UAP-05-002 | 自动化测试规范 | [`.uap/quality/UAP-05-002-AUTOMATED-TESTING.md`](../.uap/quality/UAP-05-002-AUTOMATED-TESTING.md) (16649B) | P0 | ACTIVE | `quality.testing` | `quality.test_integrity` | UAP-05-001 |
| UAP-05-003 | 自动修复规范 | [`.uap/quality/UAP-05-003-AUTO-REPAIR.md`](../.uap/quality/UAP-05-003-AUTO-REPAIR.md) (17123B) | P0 | ACTIVE | `quality.auto_repair` | `quality.repair_integrity` | UAP-05-001, UAP-05-002 |
| UAP-05-004 | 质量门禁规范 | [`.uap/quality/UAP-05-004-QUALITY-GATES.md`](../.uap/quality/UAP-05-004-QUALITY-GATES.md) (17930B) | P0 | ACTIVE | `quality.gates` | `quality.gate_integrity` | UAP-05-001, UAP-05-002, UAP-05-003 |

### security

| 编号 | 名称 | 文件 | 关键级别 | 状态 | 执行器 | 验证器 | 依赖 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UAP-06-001 | 应用安全规范 | [`.uap/security/UAP-06-001-APPLICATION-SECURITY.md`](../.uap/security/UAP-06-001-APPLICATION-SECURITY.md) (19591B) | P0 | ACTIVE | `security.application` | `security.application_integrity` | UAP-00-003 |
| UAP-06-002 | 资金与数据完整性规范 | [`.uap/security/UAP-06-002-FINANCIAL-AND-DATA-INTEGRITY.md`](../.uap/security/UAP-06-002-FINANCIAL-AND-DATA-INTEGRITY.md) (25719B) | P0 | ACTIVE | `security.financial_integrity` | `security.financial_integrity_validator` | UAP-01-003, UAP-02-002, UAP-06-001 |
| UAP-06-003 | 可靠性与恢复规范 | [`.uap/security/UAP-06-003-RELIABILITY-AND-RECOVERY.md`](../.uap/security/UAP-06-003-RELIABILITY-AND-RECOVERY.md) (20345B) | P0 | ACTIVE | `security.reliability` | `security.reliability_integrity` | UAP-00-004 |

### cross-platform

| 编号 | 名称 | 文件 | 关键级别 | 状态 | 执行器 | 验证器 | 依赖 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UAP-07-001 | Web 工程规范 | [`.uap/cross-platform/UAP-07-001-WEB-ENGINEERING.md`](../.uap/cross-platform/UAP-07-001-WEB-ENGINEERING.md) (19090B) | P1 | ACTIVE | `cross_platform.web` | `cross_platform.web_integrity` | UAP-01-001 |
| UAP-07-002 | H5 工程规范 | [`.uap/cross-platform/UAP-07-002-H5-ENGINEERING.md`](../.uap/cross-platform/UAP-07-002-H5-ENGINEERING.md) (18913B) | P1 | ACTIVE | `cross_platform.h5` | `cross_platform.h5_integrity` | UAP-01-001 |
| UAP-07-003 | 跨平台一致性规范 | [`.uap/cross-platform/UAP-07-003-CROSS-PLATFORM-CONSISTENCY.md`](../.uap/cross-platform/UAP-07-003-CROSS-PLATFORM-CONSISTENCY.md) (20304B) | P1 | ACTIVE | `cross_platform.consistency` | `cross_platform.consistency_integrity` | UAP-07-001, UAP-07-002 |

### delivery

| 编号 | 名称 | 文件 | 关键级别 | 状态 | 执行器 | 验证器 | 依赖 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UAP-08-001 | CI/CD 规范 | [`.uap/delivery/UAP-08-001-CI-CD.md`](../.uap/delivery/UAP-08-001-CI-CD.md) (21007B) | P0 | ACTIVE | `delivery.ci_cd` | `delivery.ci_integrity` | UAP-05-004 |
| UAP-08-002 | 部署与回滚规范 | [`.uap/delivery/UAP-08-002-DEPLOYMENT-AND-ROLLBACK.md`](../.uap/delivery/UAP-08-002-DEPLOYMENT-AND-ROLLBACK.md) (23512B) | P0 | ACTIVE | `delivery.deployment` | `delivery.deployment_integrity` | UAP-08-001, UAP-06-003 |
| UAP-08-003 | 可观测性规范 | [`.uap/delivery/UAP-08-003-OBSERVABILITY.md`](../.uap/delivery/UAP-08-003-OBSERVABILITY.md) (21691B) | P1 | ACTIVE | `delivery.observability` | `delivery.observability_integrity` | UAP-00-004 |

### evolution

| 编号 | 名称 | 文件 | 关键级别 | 状态 | 执行器 | 验证器 | 依赖 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UAP-09-001 | 知识管理规范 | [`.uap/evolution/UAP-09-001-KNOWLEDGE-MANAGEMENT.md`](../.uap/evolution/UAP-09-001-KNOWLEDGE-MANAGEMENT.md) (21875B) | P1 | ACTIVE | `evolution.knowledge` | `evolution.knowledge_integrity` | UAP-00-004 |
| UAP-09-002 | 持续进化规范 | [`.uap/evolution/UAP-09-002-CONTINUOUS-EVOLUTION.md`](../.uap/evolution/UAP-09-002-CONTINUOUS-EVOLUTION.md) (24782B) | P2 | ACTIVE | `evolution.continuous` | `evolution.evolution_integrity` | UAP-09-001, UAP-05-004 |

## 机器配置

| 文件 | 用途 |
| --- | --- |
| `.uap/config/specification-registry.yaml` | 32 条规范的 ID / 路径 / 执行器 / 验证器 / 依赖 |
| `.uap/config/execution-mapping.yaml` | 执行器 ID → 真实 ESM 模块路径 + 执行契约 |
| `.uap/config/agent-registry.yaml` | 11 个 Agent 的身份、权限、工具、实现路径 |
| `.uap/config/permission-policy.yaml` | fail-closed 权限组与审计开关 |
| `.uap/config/workflow-registry.yaml` | 7 个工作流、步骤与验收条件 |
| `.uap/config/validator-registry.yaml` | 32 个验证器、实现路径与检查项 |

## 注册表完整性检查明细

| 检查 ID | 结果 | 说明 |
| --- | --- | --- |
| `config.present.specification-registry` | PASS | specification-registry.yaml size=7813 bytes |
| `config.parsed.specification-registry` | PASS | specification-registry.yaml parsed to object |
| `config.present.execution-mapping` | PASS | execution-mapping.yaml size=4357 bytes |
| `config.parsed.execution-mapping` | PASS | execution-mapping.yaml parsed to object |
| `config.present.agent-registry` | PASS | agent-registry.yaml size=3462 bytes |
| `config.parsed.agent-registry` | PASS | agent-registry.yaml parsed to object |
| `config.present.permission-policy` | PASS | permission-policy.yaml size=1795 bytes |
| `config.parsed.permission-policy` | PASS | permission-policy.yaml parsed to object |
| `config.present.workflow-registry` | PASS | workflow-registry.yaml size=3117 bytes |
| `config.parsed.workflow-registry` | PASS | workflow-registry.yaml parsed to object |
| `config.present.validator-registry` | PASS | validator-registry.yaml size=5984 bytes |
| `config.parsed.validator-registry` | PASS | validator-registry.yaml parsed to object |
| `registry.spec_count` | PASS | specification count = 32 (expected 32) |
| `registry.unique_ids` | PASS | unique IDs = 32/32 |
| `registry.status_values` | PASS | status_values = 8 values, equality=true |
| `registry.spec_files_nonempty` | PASS | spec files under 2000 bytes = 0 |
| `registry.spec_sections` | PASS | spec files with missing sections / bad header / bad status = 0 |
| `registry.dependencies_exist` | PASS | missing dependency references = 0 |
| `registry.dependencies_acyclic` | PASS | cycles = 0 |
| `registry.executor_mapping` | PASS | specs without a registered executor = 0 |
| `registry.executor_files` | PASS | executor entry files missing = 0 |
| `registry.validator_mapping` | PASS | specs without a registered validator = 0 |
| `registry.validator_files` | PASS | validator implementation files missing = 0 |
| `registry.validator_targets` | PASS | validators with wrong target = 0 |
| `registry.validator_unique` | PASS | unique validator IDs = 32/32 |
| `registry.validator_checks` | PASS | validators without checks = 0 |
| `registry.validator_orphans` | PASS | orphan validators = 0 |
| `registry.agent_unique` | PASS | unique agent IDs = 11/11 |
| `registry.agent_count` | PASS | registered agents = 11 (expected 11) |
| `registry.agent_permissions` | PASS | undeclared permissions = 0 |
| `registry.agent_implementation` | PASS | agents without real implementation = 0 |
| `policy.fail_closed` | PASS | default_effect=deny, missing denies=0 |
| `policy.enforcement` | PASS | enforcement.fail_closed=true |
| `registry.workflow_count` | PASS | workflows = 7 (expected 7) |
| `registry.workflow_unique` | PASS | unique workflow IDs = 7 |
| `registry.workflow_implementation` | PASS | workflows with missing steps/implementation = 0 |
| `independence.no_retired_governance_refs` | PASS | AES/UAES references in configs = 0 |

> 本索引由机器遍历真实文件生成。文件存在只证明「规范已建成」，不证明「UAP 已运行」或「Uter 已合规」；三者的独立证据见 `.uap/reports/`。
