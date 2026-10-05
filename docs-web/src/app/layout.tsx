import './global.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { DocsSearchDialog } from '@/lib/docs-search';
import { withDocsBasePath } from '@/lib/docs-base-path';

/**
 * Favicon for the docs site.
 *
 * It has to carry the basePath: the export is served at `/docs-content/…`
 * (see `next.config.mjs`), so a bare `/logo.png` would miss and the SPA
 * fallback would answer with `index.html`. The `?v=` suffix must be bumped
 * together with `LOGO_ASSET_VERSION` in `web/src/lib/constants.ts` — it is
 * what evicts an already-cached copy in the browser.
 *
 * This also covers the standalone case (`/docs/zh/` opened directly): the SPA
 * shell deliberately ships no `favicon.ico` (see `web/index.html`), so without
 * an explicit declaration the browser's implicit `/favicon.ico` probe would
 * 404 and the tab would fall back to a blank icon.
 */
export const metadata: Metadata = {
  icons: {
    icon: [{ url: withDocsBasePath('/logo.png?v=3'), type: 'image/png' }],
    apple: [{ url: withDocsBasePath('/logo.png?v=3') }],
  },
};

/**
 * Runs before the first paint, so the embedded layout never flashes the
 * docs site's own top navigation.
 *
 * Two jobs, both frame-only:
 *
 *  1. Mark `<html>` as embedded when the page is inside an iframe. The
 *     `/docs` SPA route frames this site, and the SPA already renders an
 *     identical top bar — the docs one is hidden via
 *     `html[data-docs-embed]` in `global.css`.
 *  2. Seed next-themes' storage from the SPA's `vite-ui-theme` cookie,
 *     so the framed page paints in the same light/dark scheme as the
 *     host instead of flashing its own stored preference.
 *
 * The frame check is used instead of a `?embed=` query parameter
 * because internal docs links (sidebar, breadcrumbs) drop the query
 * string on navigation; `window.self !== window.top` survives them.
 *
 * This script is not the last word on the marker: React removes
 * attributes on the root `<html>` that its own render did not produce,
 * so the marker survives the first paint but not hydration.
 * `DocsEmbedBridge` re-applies it in a layout effect — before the
 * browser paints the hydrated tree — and is what keeps it set.
 */
const EMBED_BOOTSTRAP = `(function(){try{
if(window.self===window.top)return;
var root=document.documentElement;
root.setAttribute('data-docs-embed','true');
var m=/(?:^|;\\s*)vite-ui-theme=(dark|light|system)/.exec(document.cookie);
var theme=m?m[1]:'system';
if(theme==='system'){theme=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}
window.localStorage.setItem('theme',theme);
}catch(e){}})();`;

/**
 * Root layout — Fumadocs-UI's `RootProvider` ships the theme toggles
 * and base providers. The per-locale `I18nProvider` is set up in the
 * nested `[lang]/layout.tsx` so it knows the current locale from the
 * URL segment and can redirect correctly on language switch.
 *
 * `search.SearchDialog` replaces Fumadocs' default dialog. The default
 * one queries a search *server* at `/api/search`, which this deployment
 * does not have (the Go gateway owns that namespace), so search would
 * open and then show nothing. `DocsSearchDialog` keeps Fumadocs' dialog
 * shell but reads a statically generated index instead — see
 * `docs-search-index.ts`.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='zh-CN' suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: EMBED_BOOTSTRAP }} />
      </head>
      <body className='min-h-screen bg-fd-background text-fd-foreground antialiased'>
        <RootProvider search={{ SearchDialog: DocsSearchDialog }}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
