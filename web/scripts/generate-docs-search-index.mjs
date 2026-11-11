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
 * Build-time search index for the native docs.
 *
 * Scans `src/docs-content/**` (the Markdown corpus migrated from
 * `docs-web`) and writes one flat JSON per locale into
 * `public/docs-search/<locale>.json`. The docs search dialog fetches
 * the reader's locale file on first open and matches client-side —
 * the same shape the framed export served as `search-index.json`,
 * without a server.
 *
 * Run automatically before `bun run build`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { listLocaleDocs, LOCALES } from './lib/docs-pages.mjs'

const OUT_DIR = join(process.cwd(), 'public/docs-search')

/** Strip fenced code, tables, raw JSX and inline markup from Markdown. */
function plainBody(source, limit = 2400) {
  const out = []
  let inFence = false
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim()
    if (line.startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    if (line.startsWith('#') || line.startsWith('|') || line.startsWith('<')) {
      continue
    }
    const text = line
      .replaceAll(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replaceAll(/[*_`]/g, '')
      .trim()
    if (text) out.push(text)
    if (out.join(' ').length > limit) break
  }
  return out.join(' ').slice(0, limit)
}

/** Index one locale: every set that ships a file for it. */
function indexLocale(locale) {
  const docs = []
  for (const doc of listLocaleDocs(locale)) {
    const source = readFileSync(doc.file, 'utf8')
    const title = /^#\s+(.+)$/m.exec(source)?.[1]?.trim() ?? doc.slug
    const headings = [...source.matchAll(/^##\s+(.+)$/gm)].map((m) =>
      m[1].replaceAll(/[*_`]/g, '').trim()
    )
    docs.push({
      p: doc.pagePath,
      t: title,
      h: headings.slice(0, 30),
      b: plainBody(source),
    })
  }
  docs.sort((a, b) => a.p.localeCompare(b.p))
  return docs
}

mkdirSync(OUT_DIR, { recursive: true })
let total = 0
for (const locale of LOCALES) {
  const docs = indexLocale(locale)
  total += docs.length
  writeFileSync(join(OUT_DIR, `${locale}.json`), JSON.stringify(docs))
  console.log(`docs-search: ${locale} -> ${docs.length} pages`)
}
console.log(`docs-search: ${total} pages across ${LOCALES.length} locales`)
