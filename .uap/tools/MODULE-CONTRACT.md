# UAP 模块实现契约（引擎 / 验证器共同遵守）

所有路径相对仓库根 `/Users/lincolnhu/uter`。运行时是零外部依赖的 Node ESM（`.mjs`），
**禁止 npm install、禁止引入第三方包、禁止 `rm -rf`、禁止 git 写操作、禁止提交**。

## 1. 共享库（已经实现，直接 import，不要重写）

| 模块 | 主要导出 |
| --- | --- |
| `.uap/runtime/_lib/paths.mjs` | `ROOT`, `UAP`, `CONFIG`, `STATE`, `EVIDENCE`, `REPORTS`, `FILES`, `rootPath(...)`, `uapPath(...)`, `relToRoot(...)` |
| `.uap/runtime/_lib/config.mjs` | `loadAllConfigs()`, `loadConfig(name)`, `registryIntegrity(configs)`, `CONFIG_NAMES`, `REQUIRED_SPEC_SECTIONS`, `specById(configs)`, `validatorById(configs)`, `executorEntries(configs)`, `configPath(name)`, `readVersion()` |
| `.uap/runtime/_lib/contract.mjs` | `validatorResult(input)`, `executorResult(input)`, `finding(severity, code, message, extra)`, `assertValidatorResult(r)`, `assertExecutorResult(r)`, `LIFECYCLE_STATUSES`, `TASK_TRANSITIONS` |
| `.uap/runtime/_lib/util.mjs` | `readText(file)`, `exists(file)`, `listFiles(dir, opts)`, `readJSON(file, fallback)`, `writeJSON(file, v)`, `appendJSONL`, `readJSONL`, `nowISO()`, `newId(prefix)`, `hash(s)`, `redact(s)`, `deepEqual(a,b)`, `stableStringify` |
| `.uap/runtime/_lib/proc.mjs` | `runCommand({command, args, cwd, timeoutMs})` → `{command,cwd,started_at,duration_ms,exit_code,signal,timed_out,spawn_error,stdout,stderr}`；`isCommandAllowed(cmd)` |
| `.uap/runtime/_lib/yaml.mjs` | `parseYAML(text)` |

`validatorResult` 的关键约束（**不要绕过**）：只有 `executed === true`、`exit_code === 0` 且 `findings` 中没有 `severity: 'BLOCKER'` 时，状态才会是 `PASS`；否则即使你传了 `status:'PASS'` 也会被强制降级为 `FAIL`。无法执行时必须返回 `status:'BLOCKED', executed:false, exit_code:null` 并写明原因，**绝不伪造 PASS**。

`finding(severity, code, message, extra)` 的 severity 用 `'BLOCKER' | 'MAJOR' | 'MINOR' | 'INFO'`。只有 BLOCKER 会阻断门禁。

## 2. 引擎模块契约

每个文件 `.uap/engines/<name>/index.mjs` 必须导出：

```js
export const component = 'engines.<name>';
export const version = '1.0.0';
export const executors = ['<executor.id>', ...];   // 本模块实现的执行器 ID 列表，取自 execution-mapping.yaml
export function health() {                         // 同步，真实检查，禁止硬编码 ok:true
  return { component, ok: <boolean>, checks: { <name>: <boolean>, ... }, summary: '...', checked_at: new Date().toISOString() };
}
export async function execute(task = {}, ctx = {}) {
  return {
    status: 'SUCCEEDED' | 'BLOCKED' | 'FAILED',
    summary: '...',
    changed_files: [],       // 相对 ROOT 的路径
    commands: [],            // 真实执行过的命令摘要
    evidence_refs: [],
    outputs: {},             // 结构化结果（引擎真实产物）
  };
}
```

`execute` 必须**真的做事**：读写真实文件、扫描真实代码、或调用 `runCommand`。
禁止只返回一句「已完成」；禁止返回 `outputs: { pass: true }` 这类无信息量结果。
`health()` 必须至少验证：本模块依赖的真实项目文件存在、产物 schema 正确、以及至少一条业务规则确实被检查到。

## 3. 验证器模块契约

每个文件 `.uap/validators/<domain>/index.mjs` 必须导出：

```js
export const component = 'validators.<domain>';
export const validators = {
  '<validator.id>': async (ctx = {}) => validatorResult({ ... }),
  // ... 本域全部 validator ID，键名必须与 validator-registry.yaml 完全一致
};
export function health() { return { component, ok, checks, summary, checked_at }; }
```

`ctx` 会由 `.uap/validators/index.mjs`（主调度器，由主代理实现）传入，包含：
`{ configs, registry: registryIntegrity(configs), evidenceIds, root, uapPath, rootPath }`。

每个验证函数必须：
1. 真的读取配置 / 文件 / 状态产物，或真的执行一个快速命令，并**记录实际结果**到 `checks_run` 与 `findings`。
2. 设置 `executed: true` 与 `exit_code: 0|1`（`BLOCKED` 时 `executed:false, exit_code:null`）。
3. `evidence_refs` 引用真实存在的证据 ID（可用 `ctx.evidenceIds`，或自己用 `.uap/runtime/evidence-engine/index.mjs` 的 `record()` 生成）。
4. `checks_run` 至少包含 `validator-registry.yaml` 中该验证器声明的全部 `checks` 项名称。
5. `summary` 写实际检查了什么、结果如何，不要写「一切正常」。

**严禁**：`return validatorResult({ validator_id, status:'PASS', executed:true, exit_code:0 })` 这种无条件 PASS；
严禁把「文件存在」当作「能力已运行」；严禁读取配置里写死的 PASS。

验证器与执行器必须分离：验证器不得调用引擎的 `execute()` 来给自己盖章，只能检查引擎产出的**持久化证据/状态**或独立地重新计算。

## 4. 域与文件对照

| 域目录 | 文件 | 必须实现的 validator ID |
| --- | --- | --- |
| core | `.uap/validators/core/index.mjs` | `core.architecture_integrity`, `core.execution_integrity`, `core.evidence_integrity` |
| product | `.uap/validators/product/index.mjs` | `product.requirement_traceability`, `product.prototype_consistency`, `product.business_rule_integrity` |
| architecture | `.uap/validators/architecture/index.mjs` | `architecture.consistency`, `architecture.api_database_integrity`, `architecture.adr_integrity` |
| agents | `.uap/validators/agents/index.mjs` | `agents.registry_integrity`, `agents.execution_integrity`, `agents.collaboration_integrity`, `agents.recovery_integrity` |
| development | `.uap/validators/development/index.mjs` | `development.coding_compliance`, `development.review_integrity`, `development.dependency_integrity` |
| quality | `.uap/validators/quality/index.mjs` | `quality.engineering_integrity`, `quality.test_integrity`, `quality.repair_integrity`, `quality.gate_integrity` |
| security | `.uap/validators/security/index.mjs` | `security.permission_boundary`, `security.application_integrity`, `security.financial_integrity_validator`, `security.reliability_integrity` |
| cross-platform | `.uap/validators/cross-platform/index.mjs` | `cross_platform.web_integrity`, `cross_platform.h5_integrity`, `cross_platform.consistency_integrity` |
| delivery | `.uap/validators/delivery/index.mjs` | `delivery.ci_integrity`, `delivery.deployment_integrity`, `delivery.observability_integrity` |
| evolution | `.uap/validators/evolution/index.mjs` | `evolution.knowledge_integrity`, `evolution.evolution_integrity` |

## 5. 安全边界

- 不得连接生产数据库、不得发起真实支付/退款、不得输出或提交密钥。
- 所有资金相关验证只能使用模拟数据，并在报告中明确标注 `simulated_only`。
- 不得修改 `AGENTS.md`、`CLAUDE.md`、`.uap/config/*.yaml`、`.uap/runtime/**`、`.uap/tools/**`、`.uap/tests/**`、`.uap/reports/FINAL-STATUS.json`。
- 不得删除或放宽任何测试，不得关闭任何门禁。
