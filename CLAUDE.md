# CLAUDE.md — Project Conventions for uter

## MANDATORY: Read AGENTS.md with the Read tool

Do not treat `@AGENTS.md` as loaded. Claude Code does not reliably inline that import.

Before any planning, coding, reviewing, or answering a project question, you MUST call the Read tool on the repo-root file `AGENTS.md` and wait for the full contents. This is the first action of every session and every new task.

Rules:

- Do not start from memory, summaries, or this file alone.
- Do not skip the Read because a previous turn mentioned AGENTS.md.
- Do not replace the Read with a grep, glob, or partial skim.
- After reading, follow every rule in `AGENTS.md` for the rest of the work.
- Before planning or executing an engineering task, also Read `.ai/AIES.md` and `.ai/README.md` in full. Treat them as execution methodology and navigation aids; `AGENTS.md`, the applicable domain standards, and explicit user authorization retain precedence.
- Load every task-specific standard routed by `AGENTS.md` before editing or reviewing the corresponding domain.
- If the task touches `web/`, also Read `web/AGENTS.md` before editing frontend files.
- If the task touches billing as defined under **Billing rules (mandatory read gate)** in `AGENTS.md`, also Read `.agents/rules/billing.md` in full before planning or editing. Tasks outside that definition may skip it.

## AUTONOMOUS_GOVERNANCE — AES × Uter unified autonomous governance

This section wires the repository into the single autonomous governance engine. It is wiring only: it grants no new authority to any Agent, and it does not relax any existing governance or release constraint. AES internal governance is SIGNATURE-FREE BY DESIGN: it uses no private key, no human signature and no third-party signature.

- marker: AUTONOMOUS_GOVERNANCE
- trust_model: AES-TRUST-MODEL-002 / AUTONOMOUS_MACHINE_EVIDENCE
- machine_evidence: quality/scripts/aes/machine-evidence.mjs
- signature_dependency: NONE
- human_signature_dependency: NONE
- third_party_signature_dependency: NONE
- private_key_dependency: NONE
- engine: governance/autonomous/engine/cli.mjs
- policy: governance/autonomous/config/authorization-levels.json
- acceptance_rules: governance/autonomous/config/acceptance-rules.json
- approval_policies: governance/autonomous/config/approval-policies.json
- lifecycle: DRAFT -> VALIDATING -> APPROVED -> ACTIVE
- levels: A0 fully automatic; A1 automatic approval within delegated scope; A2 conditional automatic; A3 external / non-transferable matters, isolated and never auto-approved. A3 items are never a prerequisite for AES internal governance or Uter internal engineering acceptance.
- max_delegatable_level: A2
- agent_can_modify_own_policy: false

Operating rules for WorkBuddy, Claude Code, Codex and every other Agent:

1. Load the engine and the four configs before classifying a governance task. Route every internal approval through `cli.mjs approve` or `cli.mjs batch`; there is no out-of-band approval path.
2. Execute `cli.mjs self-check`, `cli.mjs bootstrap` and `cli.mjs validate` as the of-record quality gate. A rule that did not execute is NOT_RUN and is never a pass.
3. AES internal governance uses NO private-key signing anywhere. Every authorization, release, attestation and verification record is produced and verified by recomputable sha256 machine evidence (content digest -> evidence index -> evidence seal -> append-only hash chain). No Agent may create, request, use or verify a private key, sshsig detached signature, signer roster, or human/third-party signature for an AES internal governance action. Product security controls in `standards/` (payment callback, JWT and webhook signature verification) are Uter product requirements and are deliberately outside this prohibition.
4. The remaining A3 matters (statutory acts, regulator/bank approval, real fund operations, production access and real-environment evidence gaps) are isolated by `cli.mjs isolate-a3`. They are never auto-approved, never presented as a human or third-party signature, and never used to block AES internal governance or Uter internal engineering acceptance.
5. Approval records are AI-automated decisions. They carry `decision_subject_type: AI_AUTOMATED` and are never a human signature, a third-party signature, or an external legal authorization.
6. This section must not be edited to raise `max_delegatable_level`, to set `agent_can_modify_own_policy` to true, or to grant any bypass. Any PRIVILEGE_ESCALATION request is rejected and recorded by the engine. AC-18 verifies this block byte-for-byte in AGENTS.md and CLAUDE.md of both repositories.
7. Uter `integration_status` is decided by an explicit, machine-evidenced internal governance record; a mere version sync that sets `downstream_check.status: PROCESSED` never implicitly promotes it to INTEGRATED, VERIFIED, or PASS. That decision requires no human, owner or third-party signature.

---

## AES_AUTONOMOUS_GOVERNANCE — 强制加载与执行块

- 唯一规范源：独立仓库 `https://github.com/hu-xulin/aes`；AES 通用规范注册表为 `aes/.aes/STANDARD-REGISTRY.yaml`，正式规范注册表为 `aes/.aes/spec-registry/SPECIFICATION-REGISTRY.yaml`。
- Uter 项目集成入口：`.aes/INTEGRATION.md`、`.aes/aes-pin.json`、`.aes/uter-governance-registry.yaml`、`.aes/AI-GOVERNANCE-ENTRY.md`。
- 强制加载：任何 Agent 在产品、架构、代码、规范、整改、测试或发布准备任务开始前，必须加载 AES ACTIVE 规范、当前机器 Pin、Uter 项目注册表和本文件；运行 `node aes/quality/scripts/aes/governed-fingerprint.mjs --json --require-intact` 及 `node .aes/autonomous/engine/sync.mjs --check`。
- 执行入口：AES `governance/ai-native/engine/cli.mjs`；Uter 集成检查 `scripts/quality/aes-integration-check.mjs`；UEQE 质量门禁 `scripts/quality/uter-quality.sh`。
- 内部规范审核、代码审核、测试验收、整改关闭、发布准入和项目符合性判定全部由可执行机器规则自动完成；必须有真实执行、独立复验、内容哈希和追加式证据。不得要求用户逐项签批或第三方为内部工程验收签署。
- AI 可在仓库既有权限范围内自动执行审计、修改、测试和修复；不得自行扩大权限、修改自身授权策略、绕过职责分离或将未执行项目标记为 PASS。
- `PASS` 只允许来自真实执行且证据完整的机器验证；`FAIL`、`BLOCKED`、`NOT_RUN`、`UNKNOWN`、`NOT_VERIFIED` 均不得折算为 PASS。
- 法律、监管、合同、外部认证、生产环境和真实资金动作不属于内部机器验收。不得伪造外部签署或认证；无合法、明确、可验证授权时，相关外部动作自动拒绝并隔离，不阻断可独立完成的内部工程验收。
- AES 是通用治理规范源，Uter 仅维护项目实施策略和 UTER-P13 业务扩展；禁止复制 AES 通用规范形成第二权威版本，禁止降低 AES 强制要求。
