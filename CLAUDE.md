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

# AES Autonomous Governance Bootstrap Block

This block binds every Agent to the single machine governance engine. It grants no new permissions and cannot weaken existing permission constraints.

# AES Autonomous Governance Bootstrap Block

This block binds every Agent to the single machine governance engine. It grants no new permissions and cannot weaken existing permission constraints.

## AES_AUTONOMOUS_GOVERNANCE / AI_NATIVE_GOVERNANCE — Canonical AES machine policy

- marker: AUTONOMOUS_GOVERNANCE
- canonical_marker: AES_AUTONOMOUS_GOVERNANCE
- compatibility_marker: AI_NATIVE_GOVERNANCE
- canonical_repository: https://github.com/hu-xulin/aes
- governed_rule_identity_verifier: quality/scripts/aes/governed-fingerprint.mjs
- canonical_engine_entrypoint: governance/ai-native/engine/cli.mjs
- governance_mode: AUTONOMOUS_MACHINE_ONLY
- governance_dependency: ZERO_HUMAN_DEPENDENCY
- decision_engine: governance/ai-native/engine/cli.mjs
- policy_engine: governance/ai-native/engine/policy-engine.mjs
- acceptance_engine: governance/ai-native/engine/acceptance-engine.mjs
- independent_verifier: governance/ai-native/engine/independent-review.mjs
- evidence_engine: governance/ai-native/engine/evidence-engine.mjs
- evidence_mode: AUTONOMOUS_MACHINE_EVIDENCE
- default_decision: DENY_UNLESS_VERIFIED

## Mandatory load order

1. Resolve AES_ROOT from an explicit environment variable or the sibling `../aes` checkout; never silently treat a Uter-local copy as the canonical AES source.
2. Load the canonical AES governance standard and registry from AES_ROOT.
3. Load the Agent's repository entrypoint and project policy.
4. Run `node governance/ai-native/engine/cli.mjs self-check` with AES_ROOT as the working directory.
5. Recompute the governed rule identity using `node quality/scripts/aes/governed-fingerprint.mjs --json --require-intact`; reject missing, stale, or broken seals.
6. Verify task identity, scope, permission envelope and repository baseline.
7. Execute only declared actions and commands.
8. Run all required acceptance rules.
9. Invoke independent machine verification.
10. Append evidence and recompute status.

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
- Internal machine verification is not a human signature, legal authorization or third-party certification.

## Protected invariants

- `agent_can_modify_own_policy: false`
- `max_delegatable_level: A2`
- Uter `downstream-policy.json` hard constraints remain enforced.
- No Agent may modify this block to expand its own authority.
