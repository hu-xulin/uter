/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
import { useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { resolveDocsLocaleCode, type DocsLocaleCode } from '@/lib/docs-link'

import {
  DOCS_SEARCH_HOTKEY_ARIA,
  DOCS_SEARCH_HOTKEY_DISPLAY,
  isDocsSearchHotkey,
} from './docs-search-hotkey'

/**
 * The docs search — the client-side rebuild of the framed export's
 * `search-index.json` + dialog, fed by the build-time index
 * `public/docs-search/<locale>.json` (`generate-docs-search-index.mjs`).
 *
 * The reader's locale index is fetched on first open and cached for the
 * session; matching runs entirely in the browser, title matches first,
 * then headings and body text.
 */

type SearchDoc = {
  /** Host page path (after `/docs/<locale>/`). */
  p: string
  /** Page title. */
  t: string
  /** h2 headings. */
  h: string[]
  /** Plain-text body excerpt. */
  b: string
}

const indexCache = new Map<DocsLocaleCode, SearchDoc[]>()

async function loadIndex(locale: DocsLocaleCode): Promise<SearchDoc[]> {
  const cached = indexCache.get(locale)
  if (cached) return cached
  const response = await fetch(`/docs-search/${locale}.json`)
  if (!response.ok) throw new Error(`docs search index ${response.status}`)
  const docs = (await response.json()) as SearchDoc[]
  indexCache.set(locale, docs)
  return docs
}

/** Case-insensitive substring score: title beats heading beats body. */
function scoreDoc(doc: SearchDoc, query: string): number {
  const q = query.toLowerCase()
  if (!doc.t.toLowerCase().includes(q)) return 0
  if (doc.t.toLowerCase().startsWith(q)) return 3
  return 2
}

/** Body/heading match, used only when the title does not match. */
function scoreDocLoose(doc: SearchDoc, query: string): boolean {
  const q = query.toLowerCase()
  return (
    doc.h.some((h) => h.toLowerCase().includes(q)) ||
    doc.b.toLowerCase().includes(q)
  )
}

export function DocsSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const docsLocale = resolveDocsLocaleCode(i18n.language)

  const [query, setQuery] = useState('')
  const [docs, setDocs] = useState<SearchDoc[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'ready'>('idle')

  // ⌘/Ctrl+K opens (and re-closes) the dialog. The combination lives in
  // `docs-search-hotkey.ts` together with the sidebar's on-screen hint, so
  // the key that works and the key that is advertised cannot diverge.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isDocsSearchHotkey(event)) return
      event.preventDefault()
      onOpenChange(!open)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  useEffect(() => {
    if (!open) return
    setState('loading')
    loadIndex(docsLocale)
      .then((loaded) => {
        setDocs(loaded)
        setState('ready')
      })
      .catch(() => {
        setDocs([])
        setState('ready')
      })
  }, [open, docsLocale])

  const results = (() => {
    const q = query.trim()
    if (q === '') return docs.slice(0, 12)
    const exact = docs
      .map((doc) => ({ doc, s: scoreDoc(doc, q) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
    if (exact.length > 0) return exact.slice(0, 12).map((r) => r.doc)
    return docs.filter((doc) => scoreDocLoose(doc, q)).slice(0, 12)
  })()

  const openDoc = useCallback(
    (pagePath: string) => {
      onOpenChange(false)
      navigate({
        to: '/docs/$',
        params: { _splat: `${docsLocale}/${pagePath}` },
      })
    },
    [docsLocale, navigate, onOpenChange]
  )

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('docs.search.title')}
      description={t('docs.search.placeholder')}
    >
      {/* `CommandDialog` is a bare Radix dialog — the cmdk store context
          comes from this explicit `<Command>`, exactly like the global
          command menu uses it. */}
      <Command shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder={t('docs.search.placeholder')}
        />
        <CommandList>
          {state === 'loading' ? (
            <p className='text-dense text-fg-secondary px-3 py-6 text-center'>
              {t('docs.search.loading')}
            </p>
          ) : null}
          {state === 'ready' && results.length === 0 ? (
            <CommandEmpty>{t('docs.search.noResults')}</CommandEmpty>
          ) : null}
          {results.length > 0 ? (
            <CommandGroup heading={t('docs.search.title')}>
              {results.map((doc) => (
                <CommandItem
                  key={doc.p}
                  value={`${doc.t} ${doc.p}`}
                  onSelect={() => openDoc(doc.p)}
                  className='flex-col items-start gap-0.5'
                >
                  <span className='text-dense font-medium'>{doc.t}</span>
                  <span className='text-dense text-fg-secondary'>{doc.p}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

/** Sidebar entry button for the docs search. */
export function DocsSearchButton({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      type='button'
      onClick={onOpen}
      aria-keyshortcuts={DOCS_SEARCH_HOTKEY_ARIA}
      className='text-dense text-fg-secondary hover:bg-muted mb-4 flex w-full items-center gap-2 rounded-md border px-3 py-2 transition-colors'
    >
      <Search className='size-4' aria-hidden='true' />
      <span className='min-w-0 flex-1 text-left'>
        {t('docs.search.placeholder')}
      </span>
      <span className='flex shrink-0 items-center gap-0.5' aria-hidden='true'>
        {DOCS_SEARCH_HOTKEY_DISPLAY.map((glyph) => (
          <kbd
            key={glyph}
            className='text-dense text-fg-secondary rounded border px-1 font-mono'
          >
            {glyph}
          </kbd>
        ))}
      </span>
    </button>
  )
}
