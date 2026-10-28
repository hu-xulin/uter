'use client';

/*
 * Client half of the docs sidebar and search UI.
 *
 * Everything here is a client component because it touches the search
 * context, the router and browser storage. `docs-shell.tsx` is a server
 * component and can only pass these in as elements / component
 * references (a `() => null` slot defined on the server would not be
 * serialisable).
 */

import { SearchIcon } from 'lucide-react';
import { useDocsSearch } from 'fumadocs-core/search/client';
import {
  SearchDialog,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogList,
  SearchDialogOverlay,
} from 'fumadocs-ui/components/dialog/search';
import { useSearchContext } from 'fumadocs-ui/contexts/search';
import { useMemo } from 'react';

import { DOCS_SEARCH_COPY } from '@/lib/docs-copy';
import { useDocsLocale } from '@/lib/docs-locale';
import {
  docsRootFromPath,
  loadSearchIndex,
  querySearchIndex,
} from '@/lib/docs-search-index';
import { usePathname } from 'fumadocs-core/framework';

/**
 * Empties Fumadocs' full-width search row (`searchTrigger.full`).
 *
 * The search affordance moves into the sidebar's header row so it can
 * share that row with the collapse toggle; leaving the default trigger in
 * place would render a second search box directly underneath.
 */
export function EmptySidebarSearchSlot() {
  return null;
}

/**
 * Search trigger for the sidebar's header row — the 3/4 column of the
 * search + collapse pair. `global.css` gives the collapse button the
 * remaining quarter; the two are sized by `flex-[3]` / `flex-[1]` here
 * and in `docs-sidebar-header.tsx` so the split survives any panel width.
 */
export function SidebarSearchButton() {
  const { setOpenSearch, hotKey } = useSearchContext();
  const copy = DOCS_SEARCH_COPY[useDocsLocale()];

  return (
    <button
      type='button'
      data-docs-sidebar-search=''
      aria-label={copy.trigger}
      onClick={() => setOpenSearch(true)}
      className='inline-flex h-9 min-w-0 flex-[3] items-center gap-2 rounded-lg border bg-fd-secondary/50 p-1.5 ps-2 text-sm text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground'
    >
      <SearchIcon className='size-4.5 shrink-0' />
      <span className='truncate'>{copy.trigger}</span>
      <span className='ms-auto inline-flex shrink-0 gap-0.5'>
        {hotKey.map((key, i) => (
          <kbd
            key={i}
            className='rounded-md border bg-fd-background px-1.5 font-sans text-xs'
          >
            {key.display}
          </kbd>
        ))}
      </span>
    </button>
  );
}

/**
 * The docs search dialog.
 *
 * Deliberately not Fumadocs' `DefaultSearchDialog`: that one can only
 * talk to a search *server* (`/api/search`, or an Orama index), and this
 * deployment has neither. The shell is still Fumadocs' — same header,
 * same list, same keyboard handling and the same result rendering
 * (breadcrumbs, `#` marker on headings, `<mark>` highlights) — only the
 * data source and the copy are ours.
 */
export function DocsSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const locale = useDocsLocale();
  const docsRoot = docsRootFromPath(pathname);
  const copy = DOCS_SEARCH_COPY[locale];

  const client = useMemo(
    () => ({
      deps: [locale, docsRoot],
      search: async (query: string) => {
        const index = await loadSearchIndex(docsRoot);
        return querySearchIndex(index, locale, query);
      },
    }),
    [locale, docsRoot]
  );

  const { search, setSearch, query } = useDocsSearch({ client, delayMs: 120 });

  return (
    <SearchDialog
      open={open}
      onOpenChange={onOpenChange}
      search={search}
      onSearchChange={setSearch}
      isLoading={query.isLoading}
    >
      <SearchDialogOverlay />
      {/* `data-docs-search` is the hook `global.css` uses to recolour the
          result highlights with the brand accent. */}
      <SearchDialogContent data-docs-search=''>
        <SearchDialogHeader>
          <SearchDialogIcon />
          {/*
            Fumadocs' own `SearchDialogInput` hard-codes its placeholder
            from the translation context, which lives above this dialog's
            provider and is therefore untranslated. This is the same
            markup with our own copy.
          */}
          <input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={copy.placeholder}
            aria-label={copy.trigger}
            className='w-0 flex-1 bg-transparent text-sm placeholder:text-fd-muted-foreground focus-visible:outline-none'
          />
          <button
            type='button'
            aria-label={copy.close}
            onClick={() => onOpenChange(false)}
            className='inline-flex h-7 shrink-0 items-center rounded-md border px-2 font-mono text-xs text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground'
          >
            {copy.close}
          </button>
        </SearchDialogHeader>
        <SearchDialogList
          items={query.data === 'empty' ? null : query.data}
          Empty={() => (
            <div className='py-12 text-center text-sm text-fd-muted-foreground'>
              {copy.empty}
            </div>
          )}
        />
      </SearchDialogContent>
    </SearchDialog>
  );
}
