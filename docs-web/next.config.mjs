/**
 * Next.js config for the URouters docs site.
 *
 * URL strategy:
 *  - No `basePath` — the docs site is mounted at the Go backend's root,
 *    so the served URLs are `/docs/<lang>/...`. The Go embed layout is:
 *      * `web/dist/`        — React SPA (handled by `static.Serve`)
 *      * `web/dist/docs/`   — Next.js static export (also mounted at
 *        the root, with fallthrough to the SPA for unknown paths)
 *  - `output: 'export'`   — fully static site, embedded via Go.
 *  - `trailingSlash: true` — every URL ends with `/`, which matches the
 *    Go static handler's directory-index lookup.
 *  - `images.unoptimized` — required for static export.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;