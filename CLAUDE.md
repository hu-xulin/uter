# CLAUDE.md — Project Conventions for uter

## MANDATORY: Read AGENTS.md with the Read tool

Do not treat `@AGENTS.md` as loaded. Claude Code does not reliably inline that import.

Before any planning, coding, reviewing, or answering a project question, you MUST call the Read tool on the repo-root file `AGENTS.md` and wait for the full contents. This is the first action of every session and every new task.

Rules:

- Do not start from memory, summaries, or this file alone.
- Do not skip the Read because a previous turn mentioned AGENTS.md.
- Do not replace the Read with a grep, glob, or partial skim.
- After reading, follow every rule in `AGENTS.md` for the rest of the work.
- Before planning or executing an engineering task, also Read `.ai/UTER-EXECUTION-METHOD.md` and `.ai/README.md` in full. Treat them as execution methodology and navigation aids; `AGENTS.md`, the applicable domain standards, and explicit user authorization retain precedence.
- Load every task-specific standard routed by `AGENTS.md` before editing or reviewing the corresponding domain.
- If the task touches `web/`, also Read `web/AGENTS.md` before editing frontend files.
- If the task touches billing as defined under **Billing rules (mandatory read gate)** in `AGENTS.md`, also Read `.agents/rules/billing.md` in full before planning or editing. Tasks outside that definition may skip it.

## AI_NATIVE_GOVERNANCE — 强制加载与执行块

- 治理模式：`AI_NATIVE_GOVERNANCE` / `AUTONOMOUS_MACHINE_ONLY`。
- 唯一通用规范源：独立仓库 `https://github.com/hu-xulin/aes`；通用规范注册表 `aes/.aes/STANDARD-REGISTRY.yaml`；规范注册表 `aes/.aes/spec-registry/SPECIFICATION-REGISTRY.yaml`。
- Uter 项目入口：`.aes/AI-GOVERNANCE-ENTRY.md`、`.aes/INTEGRATION.md`、`.aes/aes-pin.json`、`.aes/uter-governance-registry.yaml`、`.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md`。
- 强制加载顺序：本文件 → `.aes/agent-governance.yaml` → `.aes/AI-GOVERNANCE-ENTRY.md` → 当前 AES pin 与适用标准 → UTER-P13 → 任务相关项目规范。
- 强制执行：运行 `node ${AES_ROOT:-../aes}/quality/scripts/aes/governed-fingerprint.mjs --json --require-intact`、`node .aes/autonomous/engine/sync.mjs`、`node scripts/quality/aes-integration-check.mjs --aes-root "${AES_ROOT:-../aes}"`、`ruby scripts/quality/ai-native-internal-gate.rb`。
- 决策流程：`Requirement → Rule → Actual Execution → Evidence → Independent Machine Verification → Decision`。
- 所有内部规范决策、代码审查、测试验收、整改关闭和发布准备状态均由可执行机器规则计算；禁止手写成功状态。
- `PASS` 必须来自当前 revision 的真实执行与独立复验；`FAIL`、`BLOCKED`、`NOT_RUN`、`UNKNOWN`、`NOT_VERIFIED` 均不得折算为 PASS。
- 超出仓库工作区权限的生产数据库写入、真实资金操作、生产部署、生产密钥访问、不可逆副作用、权限升级和策略自修改一律 `AUTO_DENY`；拒绝结果写入机器证据，不产生交互审批任务。
- Uter 的执行约束：本地 `main` 执行；不创建分支、不 push、不创建或合并 PR、不部署；必须保护所有预先存在的工作区修改。
- AES 负责通用 P00–P12；Uter 负责产品实现和 UTER-P13。Uter 项目覆盖层必须映射 AES，不得降低 AES 要求或建立第二套通用规范。
- P09 Quality Engineering proves whether engineering quality meets requirements. P10 Security & Reliability defines security and reliability requirements. P09 executes and records the tests required by P10.

