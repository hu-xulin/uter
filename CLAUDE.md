# UAP Claude Code Entry Point

## Governance

This repository uses UAP as its autonomous engineering governance system.

The authoritative rules are stored in `.uap/`.

Before making changes:

1. Read `.uap/README.md`.
2. Read `.uap/config/specification-registry.yaml`.
3. Read `.uap/config/execution-mapping.yaml`.
4. Read `.uap/config/agent-registry.yaml`.
5. Read `.uap/config/permission-policy.yaml`.
6. Read relevant UAP specifications.

## Repository Protection

- Use the existing local main workspace.
- Do not create branches.
- Do not switch branches.
- Preserve uncommitted and untracked user changes.
- Do not run destructive Git cleanup commands.
- Do not overwrite unrelated user work.

## Engineering Execution

All engineering tasks must be represented as structured tasks with:

- Scope.
- Specification references.
- Dependencies.
- Acceptance criteria.
- Execution plan.
- Validation plan.
- Evidence.

Execute changes only within the authorized scope.

## Required Validation

Run relevant:

- Formatting.
- Lint.
- Type checking.
- Unit tests.
- Integration tests.
- End-to-end tests.
- Code review.
- Security checks.
- Build checks.

Do not claim tests passed unless they actually ran and exited successfully.

## Financial and Production Safety

Use simulated payment and refund operations.

Do not access production databases, execute real payments, issue real refunds, expose secrets or deploy to production without explicit authorization.

## Failure Handling

Classify failures, identify root causes, attempt no more than three materially different repair strategies per root cause, and preserve all failure evidence.

Stop and report BLOCKED when a safe resolution is not possible.

## Completion

A task is complete only when its acceptance criteria are satisfied and evidence is recorded.

A document, plan or generated code alone does not prove that a capability is operational.

## UAP Local Entry Point

UAP is implemented as a zero-dependency Node ESM runtime under `.uap/`. Use
`./uap status`, `./uap doctor`, `./uap validate --all`, `./uap test --all`,
`./uap release check` and `./uap report` to obtain evidence-backed state. Every
command writes immutable evidence to `.uap/evidence/` and returns a truthful
exit code (0 PASS, 1 FAIL, 2 BLOCKED/NOT_EXECUTED, 3 usage).

The original `CLAUDE.md` instructions below remain in force, including the
mandatory Read of the repo-root `AGENTS.md`. UAP does not relax any existing
quality gate or security rule.

---

# CLAUDE.md — Project Conventions for uter

## MANDATORY: Read AGENTS.md with the Read tool

Do not treat `@AGENTS.md` as loaded. Claude Code does not reliably inline that import.

Before any planning, coding, reviewing, or answering a project question, you MUST call the Read tool on the repo-root file `AGENTS.md` and wait for the full contents. This is the first action of every session and every new task.

Rules:

- Do not start from memory, summaries, or this file alone.
- Do not skip the Read because a previous turn mentioned AGENTS.md.
- Do not replace the Read with a grep, glob, or partial skim.
- After reading, follow every rule in `AGENTS.md` for the rest of the work.
- If the task touches `web/`, also Read `web/AGENTS.md` before editing frontend files.
- If the task touches billing as defined under **Billing rules (mandatory read gate)** in `AGENTS.md`, also Read `.agents/rules/billing.md` in full before planning or editing. Tasks outside that definition may skip it.

Note: the previous AES governance system was retired on 2026-11-12.
UAP is now the active, repository-local governance and execution system.
The applicable UAP specifications in `.uap/config/specification-registry.yaml`
are binding alongside the preserved project-specific rules in `AGENTS.md`,
`web/AGENTS.md`, and the product quality gates
(`scripts/verify-all.sh`, `.github/workflows/ci.yml`). UAP supplements and
enforces these rules; it does not silently replace or weaken them.
