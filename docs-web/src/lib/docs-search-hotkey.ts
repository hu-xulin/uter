/*
 * The search hotkey, defined once.
 *
 * Three consumers need to agree on this key combination, and before this
 * module they could drift independently:
 *
 *   1. Fumadocs' `SearchProvider` — the actual keydown handler that opens
 *      the dialog (`RootProvider search={{ hotKey }}`),
 *   2. `aria-keyshortcuts` on the sidebar trigger — what assistive tech
 *      announces as the shortcut,
 *   3. the `<kbd>` glyphs — what sighted keyboard users read off the
 *      screen.
 *
 * Deriving all three from one declaration is the only way to guarantee
 * that the hint on screen matches the key that actually works. Fumadocs'
 * own default (`DEFAULT_HOT_KEYS`) cannot be reused for this: its
 * modifier entry carries `key: (e) => e.metaKey || e.ctrlKey` and
 * `display: <MetaOrControl />` — a *function* and a *React element* — so
 * there is no string to read back out of it. We therefore own the
 * declaration and pass it down explicitly.
 *
 * Cross-platform choice: one combo for every OS. `aria-keyshortcuts`
 * describes a single canonical shortcut, and a hint that renders "⌘K" on
 * macOS but "Ctrl+K" elsewhere would need `navigator` sniffing at render
 * time, which cannot happen during static export without a hydration
 * mismatch. Accepting both modifiers (Meta *or* Control) also keeps the
 * docs honest on tablets with an external keyboard, where the platform
 * modifier varies.
 */

/** Platform-neutral modifier glyph — "⌘/Ctrl" — used for the on-screen hint. */
export const SEARCH_HOTKEY_MODIFIER_GLYPH = '⌘/Ctrl';

/** The letter that, together with the modifier, opens search. */
export const SEARCH_HOTKEY_LETTER = 'K';

/** Visible glyph for the letter key. */
export const SEARCH_HOTKEY_LETTER_GLYPH = 'K';

/**
 * `aria-keyshortcuts` token list.
 *
 * The ARIA syntax wants modifiers spelled out and joined with `+`
 * (`Meta+K`). Control is listed as an alternative spelling because the
 * handler accepts either modifier — see `SEARCH_HOTKEY_DISPLAY` note.
 */
export const SEARCH_HOTKEY_ARIA = 'Meta+K Control+K';

/**
 * The glyph pair rendered as `<kbd>`s in the sidebar trigger.
 * Order matters: modifier first, letter second.
 */
export const SEARCH_HOTKEY_DISPLAY: readonly string[] = [
  SEARCH_HOTKEY_MODIFIER_GLYPH,
  SEARCH_HOTKEY_LETTER_GLYPH,
];

/**
 * Shape accepted by Fumadocs' `SearchProviderProps.hotKey`.
 *
 * Declared locally because `fumadocs-ui/contexts/search` does not export
 * its `HotKey` interface. `display` is typed as a plain string on
 * purpose: our own keys are all strings, and keeping it narrow means the
 * sidebar trigger can render `key.display` directly instead of guarding
 * every read against `ReactNode`.
 */
export interface DocsSearchHotKey {
  key: string | ((e: KeyboardEvent) => boolean);
  display: string;
}

/**
 * Hotkeys handed to Fumadocs' search provider. Every entry must match for
 * the dialog to open, which is how "modifier + K" is expressed.
 */
export const DOCS_SEARCH_HOTKEYS: readonly DocsSearchHotKey[] = [
  { key: (e: KeyboardEvent) => e.metaKey || e.ctrlKey, display: SEARCH_HOTKEY_MODIFIER_GLYPH },
  { key: 'k', display: SEARCH_HOTKEY_LETTER_GLYPH },
];