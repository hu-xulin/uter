'use client';

import type { ReactNode } from 'react';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { DocsSearchDialog } from '@/lib/docs-search';
import { DOCS_SEARCH_HOTKEYS } from '@/lib/docs-search-hotkey';

/**
 * Client-side wrapper for Fumadocs' `RootProvider`.
 *
 * `layout.tsx` is a server component, and the search hotkey list contains a
 * *function* (`key: (e) => e.metaKey || e.ctrlKey`) so that one combination
 * works on macOS and elsewhere. React refuses to serialise functions across
 * the server/client boundary — "Functions cannot be passed directly to Client
 * Components" — so the provider and its props have to be created inside a
 * client module. Same pattern as `docs-i18n-provider.tsx`.
 *
 * Keeping the hotkey here rather than in `layout.tsx` is not just a technical
 * workaround: it makes `docs-search-hotkey.ts` the only place the shortcut is
 * declared, and both consumers of it — Fumadocs' keydown handler (via
 * `hotKey`) and the sidebar trigger's `aria-keyshortcuts` + `<kbd>` glyphs —
 * read from that one declaration. A hint that promises a key the handler does
 * not listen for would be a genuine accessibility defect, not a cosmetic one.
 */
export function DocsRootProvider({ children }: { children: ReactNode }) {
  return (
    <RootProvider
      search={{
        SearchDialog: DocsSearchDialog,
        // Spread to satisfy the mutable-array prop type.
        hotKey: [...DOCS_SEARCH_HOTKEYS],
      }}
    >
      {children}
    </RootProvider>
  );
}