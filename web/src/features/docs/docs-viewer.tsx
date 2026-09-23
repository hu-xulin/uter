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

For commercial licensing, please contact support@Uter.ai.com
*/
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { useTheme } from '@/context/theme-provider'
import { useStatus } from '@/hooks/use-status'
import {
  DOCS_ENTRY_PATH,
  docsLandingPathFor,
  docsPathFor,
  isBundledDocsHref,
  resolveDocsHref,
  resolveDocsLocaleCode,
} from '@/lib/docs-link'

/**
 * Message types exchanged with the framed docs site.
 *
 * Both sides run on the same origin, so `postMessage` is enough; every
 * message is pinned to `window.location.origin` and every listener
 * verifies `event.origin` (and, here, the sending frame) before acting.
 *
 * See `docs-web/src/lib/docs-embed-bridge.tsx` for the other half.
 */
const THEME_MESSAGE = 'Uter:docs:theme'
const ROUTE_MESSAGE = 'Uter:docs:route'

/**
 * Height of `PublicHeader` in its unscrolled form (`h-16`). The frame
 * fills the rest of the viewport, which keeps the docs' own sidebar and
 * table of contents sticky inside the frame instead of scrolling away
 * with a page-level scroll.
 */
const SPA_HEADER_HEIGHT = '4rem'

/**
 * Accept only same-origin docs paths as the frame target. The value
 * round-trips through the `?p=` query parameter, so it is treated as
 * untrusted input: it must sit under `/docs/` and must not climb out
 * with a `..` segment.
 */
function sanitizeDocsPath(value: string | undefined): string | null {
  if (!value || !value.startsWith('/docs/')) return null
  if (value.includes('..') || value.includes('//')) return null
  return value
}

/**
 * Everything after the `/docs/<locale>/` prefix. Used to carry the page
 * the reader is on across a UI-language switch, which is why the locale
 * segment is stripped rather than matched.
 */
function docsPathWithinLocale(path: string): string {
  const match = /^\/docs\/[^/]+\/(.*)$/.exec(path)
  return match ? match[1] : ''
}

type DocsViewerProps = {
  /**
   * Docs page to open with, read from the route's `?p=` search param so
   * a reload or a shared link reopens the same page.
   */
  initialPath?: string
}

/**
 * In-app docs page for `/docs`.
 *
 * The docs content is a Next.js static export served by the gateway at
 * `/docs/<lang>/`. Rather than handing the whole document over to that
 * export — which replaces the app shell and its navigation — the shell
 * stays and the export is framed underneath it, so reading the docs
 * feels like another page of the SPA.
 *
 * The framed site detects that it is embedded (see the bootstrap script
 * in `docs-web/src/app/layout.tsx`) and drops its own top bar, which
 * would otherwise duplicate the host's. Theme and page location are
 * then kept in step over `postMessage`.
 *
 * Admins can repoint `docs_link` at another destination — usually an
 * external knowledge base — in which case the SPA does not own the
 * target and falls back to a normal full-page navigation.
 */
export function DocsViewer({ initialPath }: DocsViewerProps) {
  const { t, i18n } = useTranslation()
  const { resolvedTheme, setTheme } = useTheme()
  const { status } = useStatus()
  const navigate = useNavigate()
  const frameRef = useRef<HTMLIFrameElement>(null)

  const docsHref = resolveDocsHref(status?.docs_link)
  const bundled = isBundledDocsHref(docsHref)

  // The docs site has no landing page of its own; it opens on 特性说明
  // (see `docsLandingPathFor`), so a fresh visit lands on real content
  // instead of a redirect.
  const docsLocale = resolveDocsLocaleCode(i18n.language)
  const localePrefix = docsPathFor(docsLocale)
  const [frameSrc, setFrameSrc] = useState(
    () => sanitizeDocsPath(initialPath) ?? docsLandingPathFor(docsLocale)
  )

  // Switching the UI language re-points the frame at the same page in
  // the other locale — both locales ship the same page tree — so the
  // reader stays where they were instead of being bounced back to the
  // opening page. Only an actual language change triggers this: the
  // page named by `?p=`, if any, is what was asked for and is left
  // alone on mount.
  const previousPrefix = useRef(localePrefix)
  useEffect(() => {
    if (previousPrefix.current === localePrefix) return
    previousPrefix.current = localePrefix
    setFrameSrc((current) => `${localePrefix}${docsPathWithinLocale(current)}`)
  }, [localePrefix])

  // Push the resolved theme down on load and on every toggle, so the
  // frame follows the SPA's light/dark switch.
  const syncTheme = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage(
      { type: THEME_MESSAGE, theme: resolvedTheme },
      window.location.origin
    )
  }, [resolvedTheme])

  useEffect(() => {
    syncTheme()
  }, [syncTheme])

  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== window.location.origin) return
      if (event.source !== frameRef.current?.contentWindow) return

      const data = event.data as
        | { type?: unknown; path?: unknown; theme?: unknown }
        | null
      if (!data || typeof data !== 'object') return

      if (data.type === ROUTE_MESSAGE) {
        const path = sanitizeDocsPath(
          typeof data.path === 'string' ? data.path : undefined
        )
        if (!path) return
        // Mirror the framed page into the host URL so a reload lands
        // back on it. `replace` keeps the back button meaning "leave
        // the docs" instead of stepping through every page read.
        navigate({ to: DOCS_ENTRY_PATH, search: { p: path }, replace: true })
        return
      }

      if (data.type === THEME_MESSAGE) {
        if (data.theme === 'light' || data.theme === 'dark') {
          setTheme(data.theme)
        }
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [navigate, setTheme])

  // A configured `docs_link` may point outside the SPA entirely; open
  // it the way the app always has, with a full document navigation.
  useEffect(() => {
    if (bundled) return
    window.location.replace(docsHref)
  }, [bundled, docsHref])

  if (!bundled) return null

  return (
    <PublicLayout showMainContainer={false}>
      <div className='h-16 shrink-0' aria-hidden='true' />
      <iframe
        ref={frameRef}
        src={frameSrc}
        title={t('Docs')}
        onLoad={syncTheme}
        className='w-full border-0'
        style={{ height: `calc(100svh - ${SPA_HEADER_HEIGHT})` }}
      />
    </PublicLayout>
  )
}
