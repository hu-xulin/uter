/*
Copyright (C) 2023-2026 Uter.ai

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
 * Resolve the user guide's bare screenshot filenames into real asset URLs.
 *
 * The exported Markdown authors screenshots as
 * `<img alt="..." src="01-login.webp" />`. The old Next.js site resolved
 * those names against `public/user-guide/<locale>/<slug>/{light,dark}/`
 * at render time. Native MDX has no such resolver, and a literal JSX
 * `<img>` is *not* routed through `components.img` by the MDX compiler,
 * so the names have to be resolved in the source instead.
 *
 * This rewrites each bare tag into one `<img>` per available theme:
 *
 *   <img className="... dark:hidden"  src="/user-guide/zh/auth/light/01-login.webp" />
 *   <img className="hidden dark:block" src="/user-guide/zh/auth/dark/01-login.webp" />
 *
 * Both are in the DOM because the SPA has no server to pick for us;
 * Tailwind's `.dark` variant (theme-provider writes the class on `<html>`)
 * shows the matching one without a flash of the wrong theme.
 *
 * Only `zh` and `en` have screenshots. `zh-TW` uses `zh`, every other
 * locale uses `en`, mirroring `screenshotLocale()` in the retired site.
 *
 * Resolution is fail-closed: a name with no matching file aborts instead
 * of emitting a URL that would 404. Run with `--check` to verify the
 * corpus is fully resolved without writing anything.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const CONTENT_ROOT = join(process.cwd(), 'src/docs-content/user-guide')
const ASSET_ROOT = join(process.cwd(), 'public/user-guide')
const LOCALES = ['zh', 'zh-TW', 'en', 'fr', 'ja', 'ru', 'vi']
const CHECK_ONLY = process.argv.includes('--check')

/** Screenshots exist for the Chinese and English consoles only. */
function screenshotLocale(locale) {
  return locale === 'zh' || locale === 'zh-TW' ? 'zh' : 'en'
}

const IMG_TAG = /<img\b[^>]*>/gi
const SRC_ATTR = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i

/** The whole attribute expression, kept verbatim so quoting survives. */
function attribute(tag, name) {
  return new RegExp(`\\b${name}\\s*=\\s*(?:"[^"]*"|'[^']*')`, 'i').exec(tag)
}

const BASE_CLASSES = 'block w-full rounded-lg border border-border'
const LIGHT_CLASSES = `${BASE_CLASSES} dark:hidden`
const DARK_CLASSES = `${BASE_CLASSES} hidden dark:block`

let rewritten = 0
let docsChanged = 0
let alreadyResolved = 0
const failures = []

for (const locale of LOCALES) {
  const dir = join(CONTENT_ROOT, locale)
  if (!existsSync(dir)) {
    failures.push(`missing content directory: ${dir}`)
    continue
  }
  const source = screenshotLocale(locale)
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.mdx'))
    .sort()

  for (const file of files) {
    const slug = basename(file, '.mdx')
    const path = join(dir, file)
    const original = readFileSync(path, 'utf8')
    let changed = false

    const next = original.replaceAll(IMG_TAG, (tag) => {
      const src = SRC_ATTR.exec(tag)
      if (!src) {
        failures.push(`${path}: <img> without a src attribute: ${tag}`)
        return tag
      }
      const raw = (src[1] ?? src[2] ?? '').trim()
      if (!raw) {
        failures.push(`${path}: <img> with an empty src: ${tag}`)
        return tag
      }
      // Idempotent: absolute and remote URLs are already resolved.
      if (
        /^[a-z][a-z0-9+.-]*:/i.test(raw) ||
        raw.startsWith('/') ||
        raw.startsWith('//')
      ) {
        alreadyResolved += 1
        return tag
      }
      if (attribute(tag, 'className')) {
        failures.push(
          `${path}: cannot rewrite an <img> that already has className: ${tag}`
        )
        return tag
      }

      const name = raw.replace(/^\.\//, '')
      const base = `/user-guide/${source}/${slug}`
      const lightRel = join(ASSET_ROOT, source, slug, 'light', name)
      const darkRel = join(ASSET_ROOT, source, slug, 'dark', name)
      const flatRel = join(ASSET_ROOT, source, slug, name)
      const hasLight = existsSync(lightRel)
      const hasDark = existsSync(darkRel)
      const hasFlat = existsSync(flatRel)

      if (!hasLight && !hasDark && !hasFlat) {
        failures.push(
          `${path}: no asset for "${name}" (looked under ${join(ASSET_ROOT, source, slug)})`
        )
        return tag
      }

      changed = true
      rewritten += 1

      const alt = attribute(tag, 'alt')?.[0] ?? ''
      const withClass = (classes) =>
        tag.replace('<img', `<img className="${classes}"`)

      // Single file: one image, always visible.
      if (!(hasLight && hasDark)) {
        let url = `${base}/${name}`
        if (hasLight) url = `${base}/light/${name}`
        else if (hasDark) url = `${base}/dark/${name}`
        return withClass(BASE_CLASSES).replace(src[0], `src="${url}"`)
      }

      // Paired: light by default, dark under `.dark`.
      const lightTag = withClass(LIGHT_CLASSES).replace(
        src[0],
        `src="${base}/light/${name}"`
      )
      const darkTag = `<img${alt ? ` ${alt}` : ''} src="${base}/dark/${name}" className="${DARK_CLASSES}" />`
      return `${lightTag}\n${darkTag}`
    })

    if (!changed) continue
    docsChanged += 1
    if (!CHECK_ONLY) writeFileSync(path, next, 'utf8')
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`[docs-screenshots] ${failure}`)
  console.error(
    `[docs-screenshots] FAILED: ${failures.length} unresolved reference(s)`
  )
  process.exit(1)
}

if (CHECK_ONLY) {
  if (rewritten > 0) {
    console.error(
      `[docs-screenshots] FAILED: ${rewritten} bare screenshot reference(s) still unresolved in ${docsChanged} file(s)`
    )
    process.exit(1)
  }
  console.log(
    `[docs-screenshots] OK: all user-guide screenshots resolved (${alreadyResolved} absolute <img> tags verified)`
  )
} else {
  console.log(
    `[docs-screenshots] resolved ${rewritten} reference(s) across ${docsChanged} file(s); ${alreadyResolved} already absolute`
  )
}
