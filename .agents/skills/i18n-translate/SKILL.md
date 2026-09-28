---
name: i18n-translate
description: >-
  Complete and maintain frontend i18n translations for this project. Covers
  finding missing translation keys, detecting untranslated entries, and adding
  translations for all supported locales (en, zh, zh-TW, fr, ja, ru, vi). Use for any
  task involving frontend locale files, missing translation keys, untranslated
  UI text, `t(...)` keys, `useTranslation()`, static i18n keys, button/label/
  toast/dialog/placeholder/validation copy, or adding/fixing even a single
  i18n key. Use when review findings mention missing i18n, when new UI text
  needs translation, or when the user asks to add translations, fix i18n, or
  complete missing translations. Always load and follow this skill before
  translating, adding locale keys, or editing frontend i18n files.
---

# Frontend i18n Translation Workflow

## Mandatory Preflight

- Read this entire `SKILL.md` before any frontend i18n work, including one-key fixes.
- Before editing locale files, confirm the source text comes from a `t(...)` key, `en.json`, existing UI copy, or an explicitly requested new UI string.
- Use the user conversation only to understand the task target. Do not copy conversation text, review wording, or task descriptions directly into locale values.
- Before translating each key, re-think the intended UI copy from the code and locale context instead of treating the surrounding chat as the translation source.

## Source of Truth

- Locale files: `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json`
- Format: `{"translation": {...}}`, flat string → string, keys are English source strings.
- Base locale: auto-picked by the sync script as the file with the most leaf keys (currently `en.json`).
- The **single authority** for structure, ordering, debt detection, and formatting is `web/scripts/sync-i18n.mjs`:

```bash
cd web && bun run i18n:sync     # preferred; matches AGENTS.md ("CLI tools: bun run i18n:sync (from web/)")
cd web && node scripts/sync-i18n.mjs   # equivalent; no bun required
```

### What `sync-i18n.mjs` actually does (read the script; do not assume)

1. Parses all seven files, picks the base locale (`en`), then **rewrites every file in the base's key order**.
   Key order is therefore **`en.json`'s order**, which is a historical functional-insertion order — **not** alphabetical. `en.json` itself is only approximately alphabetical (newer feature blocks were appended near their neighbours). **Never sort keys.**
2. **Missing keys** (in the base, absent in a target) are filled with the **English value**; counted as `missingCount`.
3. **Extras** (in a target, absent from the base) are **stripped from the locale file** and written to `_extras/<locale>.extras.json`; counted as `extrasCount`.
4. **Untranslated** (value still equal to English and passing the heuristic) is written to `_reports/<locale>.untranslated.json`; counted as `untranslatedCount`.
5. Emits `_reports/_sync-report.json`.
6. Serializes via `stableStringify`: `JSON.stringify(obj, null, 2)` + trailing `\n`, plus one obfuscated-key restoration (`footer.new\u0061pi.projectAttributionSuffix`).

### Consequence — two traps

- Locale history carried a **duplicate `"Uter"` key**. `JSON.parse` silently **merges** duplicate keys, so a naive "read → write" round-trip can **silently delete lines**. Never assume a lossless round-trip unless you have verified it byte-for-byte.
- Because `sync` re-orders everything to `en`'s order, a manual alphabetical sort — or a hand insertion at a "tidy-looking" position — is **undone on the next sync**. Let `sync` own the order; do not fight it.

## Hard Constraint: Programmatic Writes Only

- Do NOT hand-edit locale JSON with text tools (StrReplace / Write / sed / regex replace). The reasons are concrete:
  - text edits break the required `en` key order;
  - a regex replace on a JSON line frequently swallows the trailing comma → invalid JSON;
  - duplicate keys make the file non-round-trippable.
- Any programmatic writer **must be byte-equivalent to `stableStringify`** (rules in §Source of Truth, item 6). If it is not, the next `sync` produces a large spurious diff.
- **Preflight every writer with a 0-change round-trip across all seven files** and require byte-identical output (`shasum -a 256` before/after). Only then touch values.
- A Python writer byte-identical to `stableStringify` is: `json.dumps(obj, ensure_ascii=False, indent=2)` + `"\n"`, then restore the one obfuscated key.

## Scope Checklist

Treat the task as covered by this skill if it involves:

- `i18n`, translation, locale files, language packs, missing keys, or untranslated text
- `t('...')`, `useTranslation()`, `i18n/static-keys.ts`, or `locales/*.json`
- UI copy in buttons, labels, toasts, dialogs, placeholders, validation messages, descriptions, or table/empty states
- A review finding about missing i18n keys

Do not skip this workflow because the fix is "just one key".

## Workflow

### Step 1 — Normalize, then read the report

```bash
cd web && bun run i18n:sync
cat src/i18n/locales/_reports/_sync-report.json
```

Read per-locale `missingCount` / `extrasCount` / `untranslatedCount`.

### Step 2 — Read the debt detail

- `_reports/<locale>.untranslated.json` — value still equals English (heuristic hit).
- `_extras/<locale>.extras.json` — keys stripped from that locale; may hold older translations worth recovering.
- The heuristic is deliberately conservative: `en`-identical values that are brand names, URLs, or abbreviations are whitelisted in `BRAND_AND_LITERAL_KEYS` inside the script. It can still **miss long English sentences** in `fr` / `vi` — when auditing, additionally scan for values that are plain English sentences.

### Step 3 — Fill the translations

Write real translations with a verified byte-equivalent writer (above). Wording sources, in order of preference:

1. existing translations of the same term **in that same locale**;
2. `zh` — the most complete non-English locale — when another locale's wording is unclear.

### Step 4 — Re-sync and require every counter to be zero

```bash
cd web && bun run i18n:sync
```

Require `missingCount == extrasCount == untranslatedCount == 0` for **all** locales.

### Step 5 — Prove idempotency

```bash
cd web && shasum -a 256 src/i18n/locales/*.json > /tmp/i18n-a
bun run i18n:sync
shasum -a 256 src/i18n/locales/*.json > /tmp/i18n-b
diff /tmp/i18n-a /tmp/i18n-b && echo "idempotent"
```

If the files are not byte-identical, your writer disagrees with `stableStringify` — **fix the writer; do not accept the diff.**

### Step 6 — Structural invariants

Assert all of the following before declaring done:

1. every file parses as JSON;
2. no duplicate keys at the text level (count occurrences of `"<key>":` inside `translation`);
3. all seven files have **identical key sets and identical key order**;
4. `{{placeholder}}` multisets per key are preserved versus `en`;
5. HTML entities match `en` for the same key — a `&lt;` where `en` has a bare `<` renders literally in React;
6. no stale brand residue in **values** (`New API` / `新しいAPI` / `Новый API` / `API mới` / `uRouter` / `urouters`);
7. no corrupted placeholders (`__ PH_0 __`, or a brand name mis-written as an interpolation such as `{{LinuxDO}}`).

### Step 7 — Small-fix path (one key)

1. Add the key to `en.json` only.
2. `bun run i18n:sync` — the other six locales receive the English value as fallback.
3. Translate those six.
4. `bun run i18n:sync` again, then run the Step 5 idempotency check.

### Step 8 — Build

The SPA is served by Go via `//go:embed all:web/dist`, so locale changes only reach the browser after a rebuild:

```bash
./rebuild-all.sh        # from the repo root
```

For a quick type-only check: `cd web && ./node_modules/.bin/tsgo -b`.

## Translation Guidelines

### Source Text Rules

- Reconsider every key's UI meaning before translating: component location, user action, placeholder variables, button/label/toast/dialog/validation context, and whether the copy is a noun, command, status, or full sentence.
- Prefer the English key or `en` value as the source text. Use the call site only to clarify meaning, tone, and constraints.
- Do not copy chat messages, review comments, issue descriptions, or task wording as translation text.
- If the source text is unclear, inspect the code and locale files first. Ask the user for exact source copy only when the intended UI text remains ambiguous.

### Length and Layout Awareness

- Consider whether translated text may overflow the UI before choosing final wording, especially for buttons, table headers, menu items, labels, toasts, dialog titles, tabs, badges, and empty states.
- For languages that often expand relative to English, especially French, Russian, and Vietnamese, prefer natural but compact wording.
- Do not sacrifice meaning just to shorten text. When the call site has limited space, choose the shortest clear translation that preserves the UI intent.
- For interpolated variables, counts, model names, provider names, quotas, and dates, consider the longest realistic rendered text, not only the translation string itself.

| Language | Code | Notes |
|----------|------|-------|
| English | en | Base locale, key = value |
| Chinese | zh | Most complete non-English locale; use as semantic reference |
| Traditional Chinese | zh-TW | Use natural Traditional Chinese wording |
| French | fr | Many English cognates are valid (e.g., "Configuration") |
| Japanese | ja | Use katakana for technical loanwords |
| Russian | ru | Use formal register |
| Vietnamese | vi | Use standard Vietnamese |

**Keep as English (do not translate):**

- Brand/product names (OpenAI, Claude, Gemini, etc.)
- URLs and email placeholders
- Technical identifiers (JSON keys, API paths, model names)
- Code-like strings (gpt-3.5-turbo, price_xxx, etc.)

**Always translate:**

- UI labels, button text, error messages, descriptions
- Time units (hours, minutes, months, years)
- Action words (Move, Show, Delete, etc.)

## Key Rules

1. All i18n commands run from `web/`.
2. `sync-i18n.mjs` is the only authority for key order, missing keys, extras, and formatting. Run it **first** (to normalize) and **last** (to verify).
3. Key order = `en.json` order. **Never sort keys alphabetically**, and do not invent insertion points.
4. Never hand-edit locale JSON with text tools. Only byte-equivalent programmatic writes, preflighted by a 0-change round-trip.
5. Never accept a non-zero sync report or a non-idempotent sync run.
6. `{{variable}}` placeholders must be preserved in every translation.
7. `_reports/` is gitignored (`web/.gitignore`); `_extras/` is **not** — do not commit `_extras/*.extras.json` by accident.
8. Rebuild (`./rebuild-all.sh`) for locale changes to take effect in the running app.
