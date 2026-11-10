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

## AI_NATIVE_GOVERNANCE — 强制加载与执行块

- 治理模式：`AI_NATIVE_GOVERNANCE` / `AUTONOMOUS_FIRST` / `ZERO_HUMAN_DEPENDENCY`。
- 唯一治理源：`aes/governance/ai-native/AI-NATIVE-AUTONOMOUS-GOVERNANCE-STANDARD.md`；注册表 `governance/ai-native/registry/AI-NATIVE-STANDARD-REGISTRY.yaml`。
- 强制加载：任何 Agent 在执行治理、规范、整改、审批、验收任务前，必须真实加载上述总纲，并执行 `governance/ai-native/engine/cli.mjs self-check`。
- 执行入口：`governance/ai-native/engine/cli.mjs`（`verify` / `ai-run-all` / `approve` / `status`）。
- 内部工程事项默认由 AI 在既有授权内自主完成：不要求用户逐项审批、逐项签署、逐项确认，不要求第三方参与内部工程验收。
- 内部审批经 `governance/autonomous/engine/cli.mjs ai-approve` 单一入口路由到 of-record 引擎，只有绑定验收规则真实 ALL_PASS 才自动批准。
- 外部法定签署、第三方认证、监管批准、生产与资金操作属于 A6：检测、隔离、登记、告警；绝不自动批准，绝不伪造，且不阻塞内部交付。
- 证据要求：真实执行 + 内容哈希 + 追加式哈希链 `governance/ai-native/records/EVIDENCE-CHAIN.jsonl`；`NOT_RUN` / `SKIPPED` / `UNKNOWN` / `BLOCKED` 绝不记为 PASS。
- 权限边界：本块不授予任何新权限；canonical governance block 逐字保留，`privilege_guard` 与下游 `downstream-policy.json` 的 hard_constraints 不变，不绕过 SOD。
