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
 * Shared enumeration of the native docs corpus.
 *
 * `src/docs-content/**` is the one source of truth for the documentation
 * that ships in the SPA: the MDX loader compiles it, the search index
 * indexes it and the sitemap lists it. All three have to agree on which
 * pages exist and on the host path each one is served under, so the
 * enumeration lives here once and the build scripts import it.
 *
 * The host path mapping mirrors `docRefForPagePath` in
 * `features/docs/native/docs-content.ts` — keep the two in step.
 */
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

export const CONTENT_ROOT = join(process.cwd(), 'src/docs-content')

export const LOCALES = ['zh', 'zh-TW', 'en', 'fr', 'ja', 'ru', 'vi']

/** The doc sets that ship content, in sidebar order. */
export const DOC_SETS = ['features', 'user-guide', 'api', 'apps', 'legal']

/** Host page path of the features landing (one file per locale). */
export const FEATURES_PAGE_PATH =
  'guide/wiki/basic-concepts/features-introduction'

/** Host page path of the model-testing section (a guide-set file). */
export const MODEL_TESTING_PAGE_PATH = 'guide/wiki/model-testing'

/**
 * Map a content file to its host page path (the part after
 * `/docs/<locale>/`).
 */
export function pagePathOf(set, slug) {
  if (set === 'features') return FEATURES_PAGE_PATH
  if (set === 'user-guide') {
    return slug === 'model-testing'
      ? MODEL_TESTING_PAGE_PATH
      : `guide/wiki/user-guide/${slug}`
  }
  return `${set}/${slug}`
}

/**
 * Every document one locale ships, in content order.
 *
 * Each entry carries the set, the slug, the host page path and the file it
 * came from, so callers can index the body, render a link or read the
 * source without re-deriving any of it.
 */
export function listLocaleDocs(locale) {
  const docs = []
  for (const set of DOC_SETS) {
    const dir = join(CONTENT_ROOT, set)
    let files
    if (set === 'features') {
      files = [`${locale}.mdx`]
    } else if (readdirSync(dir, { recursive: false }).includes(locale)) {
      files = readdirSync(join(dir, locale)).filter(
        (n) => (n.endsWith('.mdx') || n.endsWith('.md')) && n !== 'README.md'
      )
    } else {
      files = []
    }
    for (const name of files) {
      const slug = set === 'features' ? locale : name.replace(/\.mdx?$/, '')
      docs.push({
        set,
        slug,
        pagePath: pagePathOf(set, slug),
        file: set === 'features' ? join(dir, name) : join(dir, locale, name),
      })
    }
  }
  return docs
}
