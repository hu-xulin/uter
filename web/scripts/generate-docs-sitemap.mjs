/*
Copyright (C) 2023-2026 Uter.ai:

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
/**
 * Build-time sitemap for the native docs.
 *
 * The docs used to be a static export with its own `sitemap.xml`, built by
 * walking the export tree. The export is gone — the same pages are served
 * by the SPA at `/docs/<locale>/<page>` — so the sitemap is built from the
 * content tree instead: every document in `src/docs-content/**` is one
 * URL, and the host path comes from the shared mapping in
 * `lib/docs-pages.mjs` (the same one the search index uses).
 *
 * The About page and the three legal pages are SPA routes of their own
 * and were part of the old export's tree, so they stay in the sitemap.
 *
 * Run automatically before `bun run build`.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { listLocaleDocs, LOCALES } from './lib/docs-pages.mjs'

const OUT_FILE = join(process.cwd(), 'public/sitemap.xml')

/**
 * Origin the sitemap's absolute URLs point at. A sitemap requires absolute
 * URLs, but a build has no request to read the host from, so the
 * production origin is the default and `DOCS_SITE_URL` overrides it for a
 * deployment that lives elsewhere.
 */
const siteUrl = (process.env.DOCS_SITE_URL ?? 'https://uter.ai').replace(
  /\/+$/,
  ''
)

/** The SPA's own pages that were part of the retired export's tree. */
const APP_PAGES = [
  '/about',
  '/user-agreement',
  '/privacy-policy',
  '/recharge-agreement',
]

const paths = new Set(APP_PAGES)
for (const locale of LOCALES) {
  for (const doc of listLocaleDocs(locale)) {
    paths.add(`/docs/${locale}/${doc.pagePath}`)
  }
}

const urls = [...paths]
  .sort()
  .map((pagePath) => `  <url>\n    <loc>${siteUrl}${pagePath}</loc>\n  </url>`)
  .join('\n')

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`

mkdirSync(join(process.cwd(), 'public'), { recursive: true })
writeFileSync(OUT_FILE, sitemap)
console.log(`docs-sitemap: ${paths.size} URLs -> public/sitemap.xml`)
