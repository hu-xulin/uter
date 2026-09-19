'use client';

import { usePathname } from 'fumadocs-core/framework';
import { useTheme } from 'next-themes';
import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Message types exchanged with the SPA host when the docs site is
 * rendered inside the `/docs` iframe.
 *
 * The SPA owns the top navigation and the theme toggle while the docs
 * site supplies only the content, so the two sides have to agree on
 * the active theme and on which docs page is showing:
 *
 *  - `THEME` is sent in both directions. The host pushes its resolved
 *    theme on iframe load and on every toggle; the docs side pushes
 *    back when its own theme changes for a reason the host doesn't
 *    know about (Fumadocs' `d` hotkey, for example) so the SPA header
 *    follows instead of drifting out of sync.
 *  - `ROUTE` is sent by the docs side only. The host mirrors it into
 *    its own URL (`/docs?p=/docs/zh/...`) so a reload or a shared link
 *    reopens the same page.
 */
const THEME_MESSAGE = 'urouters:docs:theme';
const ROUTE_MESSAGE = 'urouters:docs:route';

/** Attribute `global.css` keys the embedded layout off. */
const EMBED_ATTRIBUTE = 'data-docs-embed';

type ThemeName = 'light' | 'dark';

function isThemeName(value: unknown): value is ThemeName {
  return value === 'light' || value === 'dark';
}

/**
 * Whether this document is framed. Read lazily — never at module scope —
 * so the module stays safe to import during the static export.
 */
function isEmbedded(): boolean {
  return typeof window !== 'undefined' && window.self !== window.top;
}

/**
 * `useLayoutEffect` in the browser, `useEffect` during the static
 * render, where a layout effect is a no-op and React warns about it.
 * The choice is fixed per environment, so hook order stays stable.
 */
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Embed bridge — a render-nothing client component that keeps the
 * embedded docs site in step with its SPA host.
 *
 * The docs site is served from the same origin as the SPA (and by the
 * same gateway), so plain `postMessage` is enough; every message is
 * nonetheless pinned to `window.location.origin` and every listener
 * verifies `event.origin` before acting.
 */
export function DocsEmbedBridge() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const lastSyncedTheme = useRef<ThemeName | null>(null);

  /**
   * Re-assert the embed marker once React has hydrated.
   *
   * The bootstrap script in `app/layout.tsx` sets this attribute before
   * the first paint so the embedded page never shows the docs site's
   * own top bar — but React drops attributes on the root `<html>` that
   * its own render did not produce, so hydration silently removes it.
   * Restoring it here, in a layout effect, lands before the browser
   * paints the hydrated tree, so the bar is hidden continuously rather
   * than being hidden, revealed and hidden again.
   */
  useIsomorphicLayoutEffect(() => {
    if (!isEmbedded()) return;
    document.documentElement.setAttribute(EMBED_ATTRIBUTE, 'true');
  }, []);

  // Host → docs: adopt the theme the SPA header is showing.
  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      if (!isEmbedded() || event.origin !== window.location.origin) return;

      const data = event.data as { type?: unknown; theme?: unknown } | null;
      if (!data || typeof data !== 'object' || data.type !== THEME_MESSAGE) {
        return;
      }
      if (!isThemeName(data.theme)) return;

      // Record before applying so the effect below does not echo the
      // host's own theme straight back at it.
      lastSyncedTheme.current = data.theme;
      setTheme(data.theme);
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [setTheme]);

  // Docs → host: report a theme change the host did not initiate.
  useEffect(() => {
    if (!isEmbedded() || !isThemeName(resolvedTheme)) return;
    if (lastSyncedTheme.current === resolvedTheme) return;

    lastSyncedTheme.current = resolvedTheme;
    window.parent.postMessage(
      { type: THEME_MESSAGE, theme: resolvedTheme },
      window.location.origin
    );
  }, [resolvedTheme]);

  // Docs → host: report the page being shown so the host can put it in
  // its own URL. `trailingSlash: true` keeps `pathname` in the same
  // shape the Go static handler serves (`/docs/zh/`).
  useEffect(() => {
    if (!isEmbedded() || !pathname) return;

    window.parent.postMessage(
      { type: ROUTE_MESSAGE, path: pathname },
      window.location.origin
    );
  }, [pathname]);

  return null;
}
