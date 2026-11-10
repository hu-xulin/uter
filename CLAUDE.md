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

# AES Autonomous Governance Bootstrap Block

This block binds every Agent to the single machine governance engine. It grants no new permissions and cannot weaken existing permission constraints.

## AI_NATIVE_GOVERNANCE — Canonical machine policy

- marker: AI_NATIVE_GOVERNANCE

## Canonical machine policy

- governance_mode: AUTONOMOUS_MACHINE_ONLY
- decision_engine: governance/ai-native/engine/cli.mjs
- policy_engine: governance/ai-native/engine/policy-engine.mjs
- acceptance_engine: governance/ai-native/engine/acceptance-engine.mjs
- independent_verifier: governance/ai-native/engine/independent-review.mjs
- evidence_engine: governance/ai-native/engine/evidence-engine.mjs
- evidence_mode: AUTONOMOUS_MACHINE_EVIDENCE
- default_decision: DENY_UNLESS_VERIFIED

## Mandatory load order

1. Load the canonical AES governance standard and registry.
2. Load the Agent's repository entrypoint and project policy.
3. Run `node governance/ai-native/engine/cli.mjs self-check`.
4. Verify task identity, scope, permission envelope and repository baseline.
5. Execute only declared actions and commands.
6. Run all required acceptance rules.
7. Invoke independent machine verification.
8. Append evidence and recompute status.

## Action boundaries

- A0–A5: bounded internal engineering actions within declared permissions.
- A6: out-of-scope operations; always AUTO_DENY.
- Production database mutation, real-funds operation, production credential access, irreversible external side effects, permission escalation and policy self-modification are denied by machine policy.
- A denied action produces an immutable decision record and BLOCKED result; no interactive approval task is created.

## Evidence and decision rules

- All decisions use real command execution, content hashes and append-only evidence.
- The verifier reads source files independently and recomputes the result.
- The executor cannot write or override its own success state.
- NOT_RUN, UNKNOWN, SKIPPED, BLOCKED, FAILED and NOT_VERIFIED never count as PASS.
- Internal release readiness is computed from current mandatory requirement evidence only.

## Protected invariants

- `agent_can_modify_own_policy: false`
- `max_delegatable_level: A2`
- Uter `downstream-policy.json` hard constraints remain enforced.
- No Agent may modify this block to expand its own authority.
