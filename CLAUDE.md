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

## AUTONOMOUS_GOVERNANCE — UAES × Uter unified autonomous governance

This section wires the repository into the single autonomous governance engine. It is wiring only: it grants no new authority to any Agent, and it does not relax any existing governance, signature, or release constraint.

- marker: AUTONOMOUS_GOVERNANCE
- engine: governance/autonomous/engine/cli.mjs
- policy: governance/autonomous/config/authorization-levels.json
- acceptance_rules: governance/autonomous/config/acceptance-rules.json
- approval_policies: governance/autonomous/config/approval-policies.json
- lifecycle: DRAFT -> VALIDATING -> APPROVED -> ACTIVE
- levels: A0 fully automatic; A1 automatic approval within delegated scope; A2 conditional automatic; A3 external / non-transferable authorization, isolated and never auto-approved
- max_delegatable_level: A2
- agent_can_modify_own_policy: false

Operating rules for WorkBuddy, Claude Code, Codex and every other Agent:

1. Load the engine and the four configs before classifying a governance task. Route every internal approval through `cli.mjs approve` or `cli.mjs batch`; there is no out-of-band approval path.
2. Execute `cli.mjs self-check`, `cli.mjs bootstrap` and `cli.mjs validate` as the of-record quality gate. A rule that did not execute is NOT_RUN and is never a pass.
3. A3 matters (legal signatures, third-party acceptance, regulator or bank approval, real fund operations, production access, authority private-key signing) are isolated by `cli.mjs isolate-a3`. They are never auto-approved and never presented as a human or third-party signature.
4. Approval records are AI-automated decisions. They carry `decision_subject_type: AI_AUTOMATED` and are never a human signature, a third-party signature, or an external legal authorization.
5. This section must not be edited to raise `max_delegatable_level`, to set `agent_can_modify_own_policy` to true, or to grant any bypass. Any PRIVILEGE_ESCALATION request is rejected and recorded by the engine. AC-18 verifies this block byte-for-byte in AGENTS.md and CLAUDE.md of both repositories.
6. Uter keeps `integration_status: MIGRATION_PENDING` until an explicit external governance declaration exists. A version sync that sets `downstream_check.status: PROCESSED` records that a change was detected and processed; it never promotes Uter to INTEGRATED, VERIFIED, or PASS.
