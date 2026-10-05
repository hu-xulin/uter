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
import { useCallback, useEffect, useRef } from 'react'

import { PublicLayout } from '@/components/layout'
import { useTheme } from '@/context/theme-provider'

/**
 * Message type exchanged with a framed docs-export page.
 *
 * Same protocol as the docs frame and the About frame
 * (`Uter:docs:theme`; see `docs-web/src/lib/docs-embed-bridge.tsx`).
 * Both sides run on the same origin, so every message is pinned to
 * `window.location.origin` and every listener verifies `event.origin`
 * and the sending frame before acting.
 */
const THEME_MESSAGE = 'Uter:docs:theme'

/**
 * Height of the static `PublicHeader` (`h-16`). The frame fills the
 * rest of the viewport so the framed page keeps its own sticky
 * sidebar and table of contents inside the frame.
 */
const SPA_HEADER_HEIGHT = '4rem'

type DocsExportFrameProps = {
  /**
   * Same-origin path of the exported page to frame. Must already carry
   * its locale (`/docs/<lang>/…`, `/about/<lang>/`) — callers resolve
   * it from the active UI language, which is what makes a language
   * switch re-point the frame at the same page in the other language.
   */
  src: string
  /** Accessible name for the frame. */
  title: string
}

/**
 * Frames a page of the statically exported docs site underneath the
 * SPA's own public shell.
 *
 * The export (`docs-web`, published at `/docs/<lang>/…` and
 * `/about/<lang>/`) is a separate React tree, so it cannot reuse the
 * SPA's components — but handing the whole document over to it would
 * replace the app shell and its navigation. Framing keeps the shell.
 *
 * The framed page detects that it is embedded and drops its own top
 * bar; the two sides then keep the theme in step over `postMessage`.
 * There is no page path to mirror back into the host URL: these frames
 * always open a fixed page, so only the theme is exchanged.
 */
export function DocsExportFrame({ src, title }: DocsExportFrameProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const frameRef = useRef<HTMLIFrameElement>(null)

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
        src={src}
        title={title}
        onLoad={syncTheme}
        className='w-full border-0'
        style={{ height: `calc(100svh - ${SPA_HEADER_HEIGHT})` }}
      />
    </PublicLayout>
  )
}
