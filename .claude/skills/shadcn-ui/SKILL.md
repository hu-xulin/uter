---
name: shadcn-ui
description: Build and review Uter frontend UI using the project's shadcn/ui configuration, existing shared components, composition patterns, tokens, and vendored upstream guidance.
---

# Uter shadcn/ui Skill — Claude Runtime Adapter

This is a Claude Code runtime adapter. The canonical project skill is:

`.agents/skills/shadcn-ui/SKILL.md`

Before frontend UI work, read the canonical skill and any relevant vendored reference under `.agents/skills/shadcn-ui/vendor/shadcn/`. Then read `web/AGENTS.md` and follow its mandatory component-reuse workflow.

Project commands must run from `web/`, for example:

```bash
bunx shadcn@latest info --json
```

Do not install, replace, or duplicate a component until the existing project components, contracts, aliases, and call sites have been inspected. The approved UTER Design System 3.0 and root `AGENTS.md` remain authoritative.

If this adapter conflicts with the canonical skill or project instructions, stop and report the conflict.
