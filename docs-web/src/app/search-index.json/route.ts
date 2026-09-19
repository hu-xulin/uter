import { buildSearchIndex } from '@/lib/search-index-data';

/**
 * The docs search index, exported as a static file.
 *
 * `output: 'export'` has no server runtime, so this route handler is
 * evaluated once at build time and its response body written out as
 * `out/search-index.json`. `docs-web/scripts/copy-to-web.mjs` then moves
 * it into `web/dist/docs/`, and the Go router serves that directory at
 * the URL root — which puts the index at `/search-index.json`, exactly
 * where `docs-search-index.ts` fetches it from.
 *
 * It is a route rather than a generated asset because the index has to
 * be built from the same `src/lib/content/` objects the pages render:
 * emitting it from a post-build step would mean either duplicating the
 * content or re-deriving anchor ids from HTML, and both drift.
 *
 * `force-static` is required — without it Next treats a route handler as
 * dynamic and refuses to export it.
 */
export const dynamic = 'force-static';

export function GET() {
  return Response.json(buildSearchIndex());
}
