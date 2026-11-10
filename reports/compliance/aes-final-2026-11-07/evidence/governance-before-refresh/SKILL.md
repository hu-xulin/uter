---
name: aes-integration
description: Claude Code runtime adapter for the Uter × AES integration skill; delegates to the canonical project skill instead of duplicating its rules.
---

# Uter AES Integration Skill — Claude Runtime Adapter

This is a Claude Code runtime adapter. The canonical project skill is:

`.agents/skills/aes-integration/SKILL.md`

Before any AES integration work, read that canonical skill in full. Then read
`.aes/AI-GOVERNANCE-ENTRY.md`, `.aes/INTEGRATION.md`, `.aes/TRACEABILITY.md`,
root `AGENTS.md`, and the AES canonical `skills/aes-uter-integration/SKILL.md`
from the pinned AES release (`1.9.0` / `3bc8285861b9c9c7ede63e6d9d08b508f1bd74b8`).

Keep Uter-specific payment, billing, authentication, database, architecture and
design-system constraints. Reuse `scripts/quality/uter-quality.sh`,
`scripts/verify-all.sh` and existing CI jobs. Never claim AES integration is VERIFIED until `.aes/INTEGRATION.md` §6 acceptance criteria have reproducible evidence.

If this adapter conflicts with the canonical skill or project instructions, stop
and report the conflict. Do not duplicate, paraphrase, or fork the canonical rules
here; a divergent copy would make different Agents load different rule versions.
