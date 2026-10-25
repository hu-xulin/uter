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
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { useTheme } from '@/context/theme-provider'
import { useStatus } from '@/hooks/use-status'
import {
  DOCS_CONTENT_PREFIX,
  DOCS_ENTRY_PATH,
  DOCS_LANDING_SEGMENT,
  docsLandingPathFor,
  isBundledDocsHref,
  resolveDocsHref,
  resolveDocsLocaleCode,
  toDocsHostSplat,
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

/**
 * The framed docs site's `sandbox` attribute.
 *
 * `allow-scripts` + `allow-same-origin` are required for the embed bridge
 * (the host pins every postMessage to `window.location.origin`, and a frame
 * without `allow-same-origin` would post from an opaque "null" origin and have
 * every message rejected).
 *
 * `allow-top-navigation-by-user-activation` is what makes the framed site's
 * own chrome work. The docs header links to the SPA's `/sign-in` and `/` — a
 * **top-level** destination, not an in-frame one. Without this token the
 * sandbox blocks that navigation and the click does nothing at all: the
 * reader presses 「登录」 and the page stays put, which reads as the app
 * crashing. The token only permits navigation the user explicitly activated
 * and grants no origin access beyond the `allow-same-origin` already relied
 * on.
 *
 * Exported so a test can pin it: the failure mode is a **silent** no-op
 * (no error, no console message), so nothing else would catch its removal.
 */
export const DOCS_IFRAME_SANDBOX =
  'allow-scripts allow-same-origin allow-top-navigation-by-user-activation'

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
export function DocsViewer() {
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

  // The part after `/docs/` — e.g. `zh/api/audio-openai`. It is the single
  // source of truth for both the frame source and the mirrored host URL, so a
  // frame-driven navigation and a UI-language switch both just rewrite this
  // one string + the URL.
  //
  // Read from the **live location** rather than from a prop. The bare `/docs`
  // entry and `/docs/<page>` are two sibling routes, so the component that
  // renders the frame has to live in the layout above them (see
  // `routes/docs.tsx`) to stay mounted across that swap — and once it does,
  // it has no prop to read, because the splat belongs to the child route. The
  // location is the one place that always names the page the reader is on,
  // which is exactly what a reload or a shared link has to reopen.
  //
  // It is kept in the **host** form, without a trailing slash, because it is
  // the address the reader sees and shares; the frame's own `src` re-adds the
  // slash below, which the static directory mount requires.
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const hostSplat = useMemo(() => {
    const fromLocation =
      pathname !== DOCS_ENTRY_PATH && pathname.startsWith(DOCS_ENTRY_PATH)
        ? toDocsHostSplat(pathname)
        : null
    if (fromLocation) return fromLocation
    return (
      toDocsHostSplat(docsLandingPathFor(docsLocale)) ??
      `${docsLocale}/${DOCS_LANDING_SEGMENT}`
    )
  }, [pathname, docsLocale])

  // The content mount is a directory tree, so the frame's `src` must keep the
  // trailing slash `/docs-content/docs/<lang>/…/` — the unslashed form 301s.
  //
  // Reassigning an iframe's `src` is a *document load*, not a route change:
  // the frame throws away the DOM it had and re-fetches, which reads as a
  // full page refresh. That is exactly what must not happen when the reader
  // clicks a sidebar link, because in that case the frame has **already**
  // soft-navigated (Next.js swaps the RSC payload — verified: only
  // `__next.*__PAGE__.txt` is fetched, no `index.html`) and then told us so
  // over {@link ROUTE_MESSAGE}. Rewriting `src` to the page the frame is
  // already showing would reload it for nothing.
  //
  // So `src` is pinned to the page the frame was *pointed at* and only moves
  // when the host itself is the side that changed page — the reader arriving
  // on a shared/reloaded link, or a UI-language switch. In-frame navigation
  // updates the address bar alone (`hostSplat` above), leaving the loaded
  // document — and its scroll position and open folder state — untouched.
  const [frameSrc, setFrameSrc] = useState(
    () => `${DOCS_CONTENT_PREFIX}/${hostSplat}/`
  )

  // The page the frame has told us it is on. While it matches `hostSplat`
  // the two are describing the same navigation, so `src` must not be touched.
  // Cleared as soon as the host moves `src` itself, so a later host-side trip
  // back to that same page (browser back/forward onto a frame-reported URL)
  // still reloads instead of wrongly believing the frame is already there.
  const frameReportedSplat = useRef<string | null>(null)

  useEffect(() => {
    if (frameReportedSplat.current === hostSplat) return
    frameReportedSplat.current = null
    setFrameSrc(`${DOCS_CONTENT_PREFIX}/${hostSplat}/`)
  }, [hostSplat])

  // Switching the UI language re-points the frame at the same page in
  // the other locale — both locales ship the same page tree — so the
  // reader stays where they were instead of being bounced back to the
  // opening page. We swap only the locale segment of the splat and mirror
  // it into the host URL. `hostSplat` is already slash-free, so a reader
  // sitting on the locale root gets the bare `zh` rather than a trailing
  // `zh/`.
  const previousLocale = useRef(docsLocale)
  useEffect(() => {
    if (previousLocale.current === docsLocale) return
    previousLocale.current = docsLocale
    const idx = hostSplat.indexOf('/')
    const rest = idx === -1 ? '' : hostSplat.slice(idx + 1)
    const next = rest ? `${docsLocale}/${rest}` : docsLocale
    // The other locale ships the same page tree, so the frame is re-pointed
    // by moving `hostSplat` — not left to re-derive the new locale's landing,
    // which would throw the reader back to the first page of the docs.
    navigate({ to: '/docs/$', params: { _splat: next }, replace: true })
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
        const splat = toDocsHostSplat(
          typeof data.path === 'string' ? data.path : undefined
        )
        if (!splat) return

        // The frame navigated on its own and is now showing this page, so
        // record it *before* the address bar is rewritten. The effect that
        // pins `src` compares this against `hostSplat` and leaves the loaded
        // document alone when they describe the same navigation — which is
        // what keeps a sidebar click from reloading the frame.
        frameReportedSplat.current = splat

        // Mirror the framed page into the host URL so a reload lands
        // back on it. `replace` keeps the back button meaning "leave
        // the docs" instead of stepping through every page read. The
        // splat is the *host* form (no trailing slash) — the frame's
        // own src keeps the slash the static mount needs.
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
          file via an override in `.oxlintrc.json`.

          `allow-top-navigation-by-user-activation` is what makes the
          framed site's own chrome work. The docs header carries a
          「登录」 link pointing at the SPA's `/sign-in` (see
          `docs-web/src/lib/docs-header.tsx`), i.e. a **top-level**
          destination, not an in-frame one. Without this token the sandbox
          silently blocks the navigation and the click does nothing at all
          — the reader presses 「登录」 and the page stays put, which reads
          as the app crashing. The token only permits navigation that the
          user explicitly activated, and it grants no extra origin access
          beyond the `allow-same-origin` we already rely on. */}
      <iframe
        ref={frameRef}
        src={frameSrc}
        title={t('Docs')}
        onLoad={syncTheme}
        sandbox={DOCS_IFRAME_SANDBOX}
        className='w-full border-0'
        style={{ height: `calc(100svh - ${SPA_HEADER_HEIGHT})` }}
      />
    </PublicLayout>
  )
}
