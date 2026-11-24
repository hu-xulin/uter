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
 * Regression gates for the native docs corpus (Path 2 convergence).
 *
 * The framed export used to resolve screenshots at render time and ship its
 * own search index. Both now live in `web/`, so a missing asset, a bare
 * filename or a stale index is a broken docs page with no server to catch
 * it. These tests read the shipped files rather than mocking them.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'vitest'

import { docRefForPagePath, docsModulePath } from '../docs-content'

const WEB_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../..'
)
const CONTENT_ROOT = join(WEB_ROOT, 'src/docs-content')
const PUBLIC_ROOT = join(WEB_ROOT, 'public')
const LOCALES = ['zh', 'zh-TW', 'en', 'fr', 'ja', 'ru', 'vi'] as const

function mdxFiles(root: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) out.push(...mdxFiles(path))
    else if (entry.name.endsWith('.mdx')) out.push(path)
  }
  return out
}

function imageUrls(source: string): string[] {
  const urls: string[] = []
  for (const tag of source.match(/<img\b[^>]*>/gi) ?? []) {
    const src = /\bsrc\s*=\s*"([^"]*)"/i.exec(tag)
    if (src) urls.push(src[1])
  }
  for (const match of source.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) {
    urls.push(match[1])
  }
  return urls
}

describe('native docs search index', () => {
  test('all seven locales ship a complete, resolvable index', () => {
    let total = 0
    for (const locale of LOCALES) {
      const file = join(PUBLIC_ROOT, 'docs-search', `${locale}.json`)
      expect(existsSync(file), `missing ${locale} search index`).toBe(true)
      const docs = JSON.parse(readFileSync(file, 'utf8')) as { p: string }[]
      expect(docs, `${locale} index`).toHaveLength(68)
      expect(
        new Set(docs.map((doc) => doc.p)).size,
        `${locale} index has duplicate page paths`
      ).toBe(docs.length)

      for (const doc of docs) {
        const ref = docRefForPagePath(doc.p)
        expect(ref, `unmapped page ${locale}:${doc.p}`).not.toBeNull()
        if (!ref) continue
        // The user-guide landing is a synthesised React component, not MDX.
        if (ref.set === 'user-guide' && ref.slug === 'index') continue
        const modulePath = join(CONTENT_ROOT, docsModulePath(ref, locale))
        expect(
          existsSync(modulePath),
          `index points at a missing document: ${docsModulePath(ref, locale)}`
        ).toBe(true)
      }
      total += docs.length
    }
    expect(total, '476 migrated documents across 7 locales').toBe(476)
  })
})

describe('native docs assets', () => {
  test('every image reference resolves to a file under public/', () => {
    const bare: string[] = []
    const missing: string[] = []
    let checked = 0

    for (const file of mdxFiles(CONTENT_ROOT)) {
      for (const url of imageUrls(readFileSync(file, 'utf8'))) {
        checked += 1
        if (/^(https?:|data:|\/\/)/i.test(url)) continue
        if (!url.startsWith('/')) {
          bare.push(`${file} -> ${url}`)
          continue
        }
        if (!existsSync(join(PUBLIC_ROOT, url.slice(1)))) {
          missing.push(`${file} -> ${url}`)
        }
      }
    }

    expect(bare, 'bare filenames need resolve-docs-screenshots.mjs').toEqual([])
    expect(missing, 'references with no shipped asset').toEqual([])
    expect(checked).toBeGreaterThan(1000)
  })

  test('user-guide screenshots are paired for light and dark themes', () => {
    let light = 0
    let dark = 0
    for (const file of mdxFiles(join(CONTENT_ROOT, 'user-guide'))) {
      const tags = readFileSync(file, 'utf8').match(/<img\b[^>]*>/gi) ?? []
      for (const tag of tags) {
        if (tag.includes('dark:hidden')) {
          light += 1
          expect(tag, 'light shot needs a root-relative src').toMatch(
            /src="\/user-guide\//
          )
        } else if (tag.includes('hidden dark:block')) {
          dark += 1
          expect(tag, 'dark shot needs a root-relative src').toMatch(
            /src="\/user-guide\//
          )
        }
      }
    }
    expect(light).toBeGreaterThan(0)
    expect(light, 'every light screenshot needs its dark counterpart').toBe(
      dark
    )
  })
})
