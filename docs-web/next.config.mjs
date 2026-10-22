/**
 * Next.js config for the Uter docs site.
 *
 * URL strategy:
 *  - `basePath: '/docs-content'` — the Go backend mounts the static
 *    export under `/docs-content` (see `router/web-router.go` and
 *    `scripts/copy-to-web.mjs`), so the served content URLs are
 *    `/docs-content/docs/<lang>/...` and `/docs-content/about/<lang>/...`.
 *    The SPA keeps the clean, encoding-free `/docs/<lang>/<page>` host
 *    route (and frames the content from `/docs-content/docs/...`), so the
 *    reader-facing URL stays legible while the iframe loads from the
 *    `basePath`-prefixed location.
 *  - `output: 'export'`   — fully static site, embedded via Go.
 *  - `trailingSlash: true` — every URL ends with `/`, which matches the
 *    Go static handler's directory-index lookup.
 *  - `images.unoptimized` — required for static export.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/docs-content',
  trailingSlash: true,
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  // Pin the Turbopack root to this package. Without it Next.js walks up and
  // may treat an unrelated package.json in a parent directory as the
  // workspace root, which makes the build scan far outside this project.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;