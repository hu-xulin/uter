/*
Copyright (C) 2023-2026 QuantumNous

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

For commercial licensing, please contact support@quantumnous.com
*/
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { useTheme } from '@/context/theme-provider'
import { aboutPathFor, resolveDocsLocaleCode } from '@/lib/docs-link'

/**
 * Message type exchanged with the framed About page.
 *
 * Same protocol as the docs frame (see `docs-viewer.tsx` and
 * `docs-web/src/lib/docs-embed-bridge.tsx`): the framed site is built
 * from the same Next.js export and carries the same bridge, so the two
 * sides already agree on it.
 */
const THEME_MESSAGE = 'urouters:docs:theme'

/**
 * Height of `PublicHeader` in its unscrolled form (`h-16`), leaving the
 * frame to fill the rest of the viewport so the framed sidebar and table
 * of contents stay sticky inside it.
 */
const SPA_HEADER_HEIGHT = '4rem'

/**
 * In-app About page for `/about`.
 *
 * The About content is the company profile (`项目介绍`), authored in
 * `docs-web` and exported statically next to the docs site. It is
 * rendered the same way the docs are: the SPA shell stays, and the
 * export is framed underneath it, so the page keeps the app's own
 * navigation and reads as one more page of the app rather than a
 * separate site.
 *
 * The framed page detects that it is embedded and drops its own top
 * bar, and the two sides then keep the theme in step over
 * `postMessage`. Unlike the docs frame there is no page path to mirror
 * back into the host URL — About is a single page whose chapters are
 * anchors — so only the theme is exchanged.
 */
export function AboutViewer() {
  const { t, i18n } = useTranslation()
  const { resolvedTheme, setTheme } = useTheme()
  const frameRef = useRef<HTMLIFrameElement>(null)

  // One page per locale, so switching the UI language re-points the
  // frame at the same document in the other language.
  const frameSrc = aboutPathFor(resolveDocsLocaleCode(i18n.language))

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

      const data = event.data as { type?: unknown; theme?: unknown } | null
      if (!data || typeof data !== 'object' || data.type !== THEME_MESSAGE) {
        return
      }
      if (data.theme === 'light' || data.theme === 'dark') {
        setTheme(data.theme)
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [setTheme])

  return (
    <PublicLayout showMainContainer={false}>
      <div className='h-16 shrink-0' aria-hidden='true' />
      <iframe
        ref={frameRef}
        src={frameSrc}
        title={t('About')}
        onLoad={syncTheme}
        className='w-full border-0'
        style={{ height: `calc(100svh - ${SPA_HEADER_HEIGHT})` }}
      />
    </PublicLayout>
  )
}
