/**
 * The `basePath` the docs site is served under.
 *
 * `next.config.mjs` sets `basePath: '/docs-content'` because the Go backend
 * mounts this export at `/docs-content` (see `router/web-router.go`) rather
 * than at the domain root. Next.js rewrites its **own** asset URLs (the
 * `_next/*` chunks, the build manifest) with that prefix, but it does not
 * touch URLs we produce ourselves: a picture whose `src` we assemble in
 * TypeScript, or one an author wrote as `/apps-assets/…` in Markdown, comes
 * out of the export as a bare root-relative path.
 *
 * The page is therefore requested at `/docs-content/docs/…` while its
 * pictures ask for `/apps-assets/…`, which the Go SPA fallback answers with
 * `index.html` — the browser gets HTML where it expects an image and the
 * picture silently fails to render. Prefixing every self-assembled URL with
 * this constant is what keeps the two in agreement.
 *
 * Kept as a literal rather than read from `next.config.mjs` so it can be used
 * from client components too, and so a change to the mount point has exactly
 * one place to be reflected. Must stay in sync with `basePath` in
 * `next.config.mjs`.
 */
export const DOCS_BASE_PATH = '/docs-content';

/**
 * Prefix a self-assembled asset URL with {@link DOCS_BASE_PATH}.
 *
 * Only paths the export owns are rewritten. Anything already carrying the
 * prefix, and anything absolute to another origin, is returned untouched so
 * this stays safe to apply more than once.
 */
export function withDocsBasePath(url: string): string {
  if (!url) return url;
  if (!url.startsWith('/')) return url;
  if (url === DOCS_BASE_PATH || url.startsWith(`${DOCS_BASE_PATH}/`)) return url;
  // Another origin's root-relative URL (`//cdn.example.com/x.png`) is not ours.
  if (url.startsWith('//')) return url;

  return `${DOCS_BASE_PATH}${url}`;
}

/**
 * Attributes a link to the **host app** (the Uter SPA) must carry so it works
 * from inside the framed docs site.
 *
 * The docs export is mounted at {@link DOCS_BASE_PATH} and is normally
 * rendered inside the SPA's iframe (`web/src/features/docs/docs-viewer.tsx`).
 * A plain `<a href='/sign-in'>` inside that frame navigates **the frame
 * itself**, so the browser resolves it against the frame's own base —
 * `/docs-content/docs/zh/…/sign-in`, which does not exist. The reader presses
 * 「登录」 and nothing happens: no navigation, no error, no console output.
 *
 * `target="_top"` makes the link address the top-level window instead. The
 * frame's sandbox additionally needs `allow-top-navigation-by-user-activation`
 * for the browser to permit that navigation at all — that half lives on the
 * host side, in `docs-viewer.tsx`.
 *
 * Kept here, next to {@link DOCS_BASE_PATH}, because both halves of the same
 * contract live in one place and are easy to break in isolation.
 */
export const HOST_APP_LINK_TARGET = '_top';
