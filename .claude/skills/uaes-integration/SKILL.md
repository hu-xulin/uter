---
name: uaes-integration
description: Claude Code runtime adapter for the Uter × UAES integration skill; delegates to the canonical project skill instead of duplicating its rules.
---

# Uter UAES Integration Skill — Claude Runtime Adapter

This is a Claude Code runtime adapter. The canonical project skill is:

`.agents/skills/uaes-integration/SKILL.md`

Before any UAES integration work, read that canonical skill in full. Then read
`.uaes/AI-GOVERNANCE-ENTRY.md`, `.uaes/INTEGRATION.md`, `.uaes/TRACEABILITY.md`,
root `AGENTS.md`, and the UAES canonical `skills/uaes-uter-integration/SKILL.md`
from the pinned UAES release (`1.12.1` / `74e5d2eea215c96b845d7a0b2111b7fa011c540f`).

Keep Uter-specific payment, billing, authentication, database, architecture and
design-system constraints. Reuse `scripts/quality/uter-quality.sh`,
`scripts/verify-all.sh` and existing CI jobs. Never claim UAES integration is VERIFIED until `.uaes/INTEGRATION.md` §6 acceptance criteria have reproducible evidence.

If this adapter conflicts with the canonical skill or project instructions, stop
and report the conflict. Do not duplicate, paraphrase, or fork the canonical rules
here; a divergent copy would make different Agents load different rule versions.
