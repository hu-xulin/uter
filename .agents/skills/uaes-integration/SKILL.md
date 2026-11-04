---
name: uaes-integration
description: Audit and maintain Uter's integration with the central UAES standards repository without duplicating or prematurely deleting project rules.
---

# Uter UAES Integration Skill

## Bootstrap

1. Read root `AGENTS.md` and `.uaes/INTEGRATION.md`.
2. Identify the UAES source commit and registry blob SHA recorded in the integration contract.
3. If the UAES repository is available in the workspace, read its canonical `skills/uaes-uter-integration/SKILL.md` and the applicable UAES standards.
4. If the canonical UAES source is unavailable, report BLOCKED for any task requiring its normative content; do not invent or reconstruct missing rules.

## Rules

- Keep Uter-specific payment, billing, authentication, database, architecture, and design-system constraints.
- Do not delete `docs/ai-specs/` or `.ai/AIES.md` while integration status is MIGRATION_PENDING.
- Reuse `scripts/quality/uter-quality.sh`, `scripts/verify-all.sh`, and existing CI jobs.
- Distinguish static wiring checks from semantic compliance and runtime skill discovery.
- Never claim UAES integration is VERIFIED until the acceptance criteria in `.uaes/INTEGRATION.md` have evidence.

## Required output

Report the pinned source, baseline commit, changed paths, mapping status, commands and exit codes, CI evidence, unresolved conflicts, and remaining risks.
