# .ai — Uter Project Execution Method

This directory contains Uter-specific execution methodology and machine-readable task contracts. It is a **project execution overlay**, not a second enterprise governance standard. AES P00–P12 in the separate `hu-xulin/aes` repository is the sole universal governance authority; this directory may add Uter-specific execution details but MUST NOT weaken or duplicate AES normative requirements.

## Directory map

| File | Purpose |
|---|---|
| `UTER-EXECUTION-METHOD.md` | Uter task compilation, execution SOP, local-main workflow, risk boundaries and machine-only acceptance |
| `task-schema.json` | Draft-07 task contract schema with machine authorization, execution evidence and main-only Git state |
| `checklists/ui-design.md` | UI design execution and machine acceptance checklist |
| `checklists/feature-bugfix.md` | Feature, bug-fix and refactor checklist |
| `checklists/auth-payment.md` | Authentication, payment, financial and database checklist |
| `checklists/test-audit.md` | Testing, QA and code-audit checklist |

## Authority and precedence

1. AES P00–P12: universal governance, authorization, engineering, quality, security and lifecycle requirements.
2. Uter `AGENTS.md`: repository entrypoint, technology constraints, project execution boundaries and agent bootstrap.
3. Applicable Uter project overlays under `docs/ai-specs/`, UTER P13 and `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`.
4. This directory: Uter-specific task compilation and execution methodology.
5. Historical memory and reports: context only; never normative authority or acceptance evidence.

A lower layer MUST NOT weaken a higher layer. A conflicting or missing rule is resolved by the AES machine policy; if the exact action is not authorized, the action is automatically BLOCKED.

## Autonomous execution

- Internal specification review, code review, testing, remediation, acceptance and release-readiness are machine-executed and independently re-verified.
- No human approval, manual review, human signature, third-party review or third-party certification is an internal acceptance prerequisite.
- FAIL, BLOCKED, NOT_RUN, UNKNOWN and NOT_VERIFIED are never PASS.
- No manual fallback is permitted for a missing validator. The missing validator is an automation defect and remains BLOCKED until implemented and executed.
- Uter engineering work runs on the existing local `main` worktree. No work branch, linked worktree, PR, remote push, merge or deployment is created by this execution method.
- Existing uncommitted user work MUST be preserved. Destructive production, real-funds, production-secret and external legal/regulatory actions are deny-by-default; if the exact action is outside the existing machine authorization envelope, it is automatically denied without a human approval queue.

## Required machine gates

Run the applicable gates and preserve actual command output:

```bash
# AES source integrity and current machine pin
node scripts/quality/aes-integration-check.mjs --aes-root ../aes

# Uter governance, P09/P10 boundary and independent machine review
AES_ROOT=../aes ruby scripts/quality/ai-native-internal-gate.rb
ruby scripts/quality/uter-p09-p10-boundary-check.rb
UTER_ROOT="$PWD" node ../aes/governance/ai-native/engine/cli.mjs review

# Uter quality orchestration
bash scripts/quality/uter-quality.sh
```

The commands above are entrypoints, not blanket proof that every product requirement passed. The current execution must resolve the live AES fingerprint, all applicable requirement mappings, real test execution, current evidence and product-specific business invariants. Missing or stale evidence remains BLOCKED.

## Historical records

Older AIES-era migration notes and reports are retained only when needed for provenance. They MUST be marked HISTORICAL / SUPERSEDED, MUST NOT be loaded as current authority and MUST NOT create manual tasks or acceptance dependencies.

## Maintenance

- Keep the task schema and this execution method synchronized by automated schema and reference tests.
- Keep project-specific business facts in Uter; keep universal requirements in AES.
- Add executable validators for any newly discovered normative requirement before allowing that requirement to be accepted.
- Changes to this file or the task schema are checked by AES and Uter CI; no human sign-off step is part of internal acceptance.
