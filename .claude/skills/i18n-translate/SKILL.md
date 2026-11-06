---
name: i18n-translate
description: Maintain Uter frontend translations across all supported locales. Use for missing keys, untranslated UI, locale JSON, translation review, and any new or changed user-facing frontend text.
---

# Uter i18n Translation Skill — Claude Runtime Adapter

This is a Claude Code runtime adapter. The canonical project skill is:

`.agents/skills/i18n-translate/SKILL.md`

Before any i18n work, read that canonical file in full and follow its complete preflight, source-of-truth, locale, translation, validation, and reporting requirements. Do not duplicate or independently reinterpret its rules here.

Repository-specific locale source: `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json`.

If this adapter conflicts with the canonical skill or root `AGENTS.md`, stop and report the conflict; do not choose the more permissive instruction.
