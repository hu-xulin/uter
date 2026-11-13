# Executor Coverage Report

> 由 `./uap report` 依据真实运行产物生成 · 2026-11-13T03:32:03.607Z · UAP 1.0.0
> 数据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与实时文件系统探测。

## 逐项映射（真实动态 import）

| 执行器 ID | 实现路径 | 文件存在 | 可 import | 导出函数 | 错误 |
| --- | --- | --- | --- | --- | --- |
| core.architecture | .uap/runtime/orchestrator/index.mjs | YES | YES | aggregate,dispatch,execute,health,plan,start | — |
| core.autonomous_execution | .uap/runtime/task-engine/index.mjs | YES | YES | cancelTask,createTask,defaultValidator,execute,getTask,hasStepHandler,health,listStepHandlers,listTasks,markInterrupted,pauseTask,registerStepHandler,resumeTask,runTask,updateTask | — |
| core.evidence | .uap/runtime/evidence-engine/index.mjs | YES | YES | currentEvidence,execute,get,health,list,record,resolveAll,verify | — |
| product.requirements | .uap/engines/product/index.mjs | YES | YES | execute,health | — |
| product.prototype_sync | .uap/engines/product/index.mjs | YES | YES | execute,health | — |
| product.business_rules | .uap/engines/product/index.mjs | YES | YES | execute,health | — |
| architecture.analyzer | .uap/engines/architecture/index.mjs | YES | YES | execute,health | — |
| architecture.api_database | .uap/engines/architecture/index.mjs | YES | YES | execute,health | — |
| architecture.adr | .uap/engines/architecture/index.mjs | YES | YES | execute,health | — |
| agents.registry | .uap/runtime/agent-runtime/index.mjs | YES | YES | assertTool,execute,getAgent,health,implementationExists,invoke,listAgents | — |
| agents.execution | .uap/runtime/agent-runtime/index.mjs | YES | YES | assertTool,execute,getAgent,health,implementationExists,invoke,listAgents | — |
| agents.collaboration | .uap/runtime/agent-runtime/index.mjs | YES | YES | assertTool,execute,getAgent,health,implementationExists,invoke,listAgents | — |
| agents.recovery | .uap/runtime/recovery-engine/index.mjs | YES | YES | execute,health,inspectRecovery,recover,simulateInterruption | — |
| development.coding_standard | .uap/engines/development/index.mjs | YES | YES | execute,health | — |
| development.code_review | .uap/engines/code-review/index.mjs | YES | YES | execute,health | — |
| development.dependencies | .uap/engines/development/index.mjs | YES | YES | execute,health | — |
| quality.engineering | .uap/engines/testing/index.mjs | YES | YES | execute,health,plan | — |
| quality.testing | .uap/engines/testing/index.mjs | YES | YES | execute,health,plan | — |
| quality.auto_repair | .uap/engines/auto-repair/index.mjs | YES | YES | execute,health | — |
| quality.gates | .uap/engines/testing/index.mjs | YES | YES | execute,health,plan | — |
| security.policy | .uap/runtime/policy-engine/index.mjs | YES | YES | PolicyDeniedError,assertAllowed,auditTrail,check,deniedDecisions,execute,health | — |
| security.application | .uap/engines/security/index.mjs | YES | YES | execute,health | — |
| security.financial_integrity | .uap/engines/security/index.mjs | YES | YES | execute,health | — |
| security.reliability | .uap/engines/security/index.mjs | YES | YES | execute,health | — |
| cross_platform.web | .uap/engines/cross-platform/index.mjs | YES | YES | execute,health | — |
| cross_platform.h5 | .uap/engines/cross-platform/index.mjs | YES | YES | execute,health | — |
| cross_platform.consistency | .uap/engines/cross-platform/index.mjs | YES | YES | execute,health | — |
| delivery.ci_cd | .uap/engines/delivery/index.mjs | YES | YES | execute,health | — |
| delivery.deployment | .uap/engines/delivery/index.mjs | YES | YES | execute,health | — |
| delivery.observability | .uap/engines/delivery/index.mjs | YES | YES | execute,health | — |
| evolution.knowledge | .uap/engines/knowledge/index.mjs | YES | YES | execute,health | — |
| evolution.continuous | .uap/engines/knowledge/index.mjs | YES | YES | execute,health | — |


## 汇总

注册 32 项；唯一实现文件 16 个；可 import 16 个；缺失 0 个。
