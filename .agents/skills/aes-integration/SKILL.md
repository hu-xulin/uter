---
name: aes-integration
description: Audit and maintain Uter's integration with the central AES standards repository without duplicating or prematurely deleting project rules.
---

# Uter AES Integration Skill

## Bootstrap

1. Read root `AGENTS.md`, `.aes/INTEGRATION.md`, and `.aes/TRACEABILITY.md`.
2. Identify the AES source commit and registry blob SHA recorded in the integration contract.
3. If the AES repository is available in the workspace, read its canonical `skills/aes-uter-integration/SKILL.md` and the applicable AES standards.
4. If the canonical AES source is unavailable, report BLOCKED for any task requiring its normative content; do not invent or reconstruct missing rules.

## Rules

- Keep Uter-specific payment, billing, authentication, database, architecture, and design-system constraints.
- Do not delete `uaes/standards/` or `.ai/AIES.md` while integration status is MIGRATION_PENDING.
- Reuse `scripts/quality/uter-quality.sh`, `scripts/verify-all.sh`, and existing CI jobs.
- Distinguish static wiring checks from semantic compliance and runtime skill discovery.
- Never claim AES integration is VERIFIED until the acceptance criteria in `.aes/INTEGRATION.md` have evidence.

## Required output

Report the pinned source, baseline commit, changed paths, mapping status, commands and exit codes, CI evidence, unresolved conflicts, and remaining risks.
