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
