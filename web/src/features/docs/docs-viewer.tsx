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
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { useTheme } from '@/context/theme-provider'
import { useStatus } from '@/hooks/use-status'
import {
  DOCS_CONTENT_PREFIX,
  DOCS_LANDING_SEGMENT,
  docsLandingPathFor,
  isBundledDocsHref,
  resolveDocsHref,
  resolveDocsLocaleCode,
  toDocsSplat,
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
 * Height of the static `PublicHeader` (`h-16`). The frame fills the rest
 * of the viewport, which keeps the docs' own sidebar and table of
 * contents sticky inside the frame instead of scrolling away with a
 * page-level scroll.
 */
const SPA_HEADER_HEIGHT = '4rem'

type DocsViewerProps = {
  /**
   * Docs page to open with, as a host path like `/docs/zh/api/...`.
   *
   * Comes from the `/docs/$` splat route, so reloading or sharing the
   * URL reopens the same page. `undefined` on the bare `/docs` entry,
   * in which case the locale landing is shown.
   */
  initialHostPath?: string
}

/**
 * In-app docs page for `/docs` and `/docs/$`.
 *
 * The docs content is a Next.js static export mounted by the gateway at
 * `/docs-content/docs/<lang>/...` (see `docs-web/next.config.mjs`'s
 * `basePath` and `web/src/lib/docs-link.ts#DOCS_CONTENT_PREFIX`). The
 * SPA keeps its own shell — `PublicHeader` plus the framed export — so
 * reading the docs feels like another page of the app rather than a
 * separate site that replaced it.
 *
 * The host URL is the clean, encoding-free `/docs/<lang>/<page>` (the
 * `/docs/$` splat). The iframe loads the same page from the content
 * prefix (`/docs-content/docs/<lang>/<page>`). The framed site reports
 * the page it is showing over `postMessage`; we mirror that into the
 * `/docs/$` route so a reload or a shared link reopens the same page.
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
export function DocsViewer({ initialHostPath }: DocsViewerProps) {
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

  // The part after `/docs/` — e.g. `zh/api/audio-openai/`. Derived purely
  // from the route (the `/docs/$` splat) or, when the entry was opened bare,
  // from the locale landing. It is the single source of truth for both the
  // iframe source and the mirrored host URL, so a frame-driven navigation and
  // a UI-language switch both just rewrite this one string + the URL.
  const hostSplat = useMemo(() => {
    const fromRoute = initialHostPath ? toDocsSplat(initialHostPath) : null
    if (fromRoute) return fromRoute
    return (
      toDocsSplat(docsLandingPathFor(docsLocale)) ??
      `${docsLocale}/${DOCS_LANDING_SEGMENT}`
    )
  }, [initialHostPath, docsLocale])

  const frameSrc = `${DOCS_CONTENT_PREFIX}/${hostSplat}`

  // Switching the UI language re-points the frame at the same page in
  // the other locale — both locales ship the same page tree — so the
  // reader stays where they were instead of being bounced back to the
  // opening page. We swap only the locale segment of the splat and mirror
  // it into the host URL.
  const previousLocale = useRef(docsLocale)
  useEffect(() => {
    if (previousLocale.current === docsLocale) return
    previousLocale.current = docsLocale
    const idx = hostSplat.indexOf('/')
    const rest = idx === -1 ? '' : hostSplat.slice(idx + 1)
    navigate({
      to: '/docs/$',
      params: { _splat: `${docsLocale}/${rest}` },
      replace: true,
    })
  }, [docsLocale, hostSplat, navigate])

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
        const splat = toDocsSplat(
          typeof data.path === 'string' ? data.path : undefined
        )
        if (!splat || splat === hostSplat) return
        // Mirror the framed page into the host URL so a reload lands
        // back on it. `replace` keeps the back button meaning "leave
        // the docs" instead of stepping through every page read.
        navigate({ to: '/docs/$', params: { _splat: splat }, replace: true })
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
  }, [navigate, setTheme, hostSplat])

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
      {/* The framed docs share the SPA's origin, so we keep
          `allow-same-origin`: the host verifies `event.origin ===
          window.location.origin` on every postMessage, and a sandboxed
          frame without this flag would post from an opaque "null" origin
          and have every theme/route message rejected. `allow-scripts` is
          required for the docs' own client scripts (sidebar, search, the
          embed bridge). This is intentionally tighter than no sandbox.
          oxlint's `iframe-missing-sandbox` rule bans the
          allow-scripts + allow-same-origin combo as a generic heuristic,
          but here the content is our own trusted docs export and the
          combo is required for the bridge — the rule is disabled for this
          file via an override in `.oxlintrc.json`. */}
      <iframe
        ref={frameRef}
        src={frameSrc}
        title={t('Docs')}
        onLoad={syncTheme}
        sandbox='allow-scripts allow-same-origin'
        className='w-full border-0'
        style={{ height: `calc(100svh - ${SPA_HEADER_HEIGHT})` }}
      />
    </PublicLayout>
  )
}
