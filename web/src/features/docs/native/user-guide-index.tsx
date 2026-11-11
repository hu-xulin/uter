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
import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Heading } from '@/design-system'
import type { DocsLocaleCode } from '@/lib/docs-link'

import {
  USER_GUIDE_CHAPTER_SLUGS,
  USER_GUIDE_PATH,
  userGuideChapterTitle,
} from './user-guide-identity'

/**
 * Landing page of the user guide, at `/docs/<locale>/guide/wiki/user-guide`.
 *
 * The guide is split into a page per chapter, so — exactly like the
 * framed export's index — this is a synthesised card page rather than a
 * Markdown document: the guide's title and blurb, then one card per
 * chapter. Each card's summary is the chapter's own opening sentence,
 * extracted from the migrated Markdown so the index cannot drift out of
 * date as the chapters are rewritten (the same rule the framed export
 * follows with its server-side teaser).
 */

/** The guide's own title and blurb, in the reader's language. */
const GUIDE_IDENTITY: Record<
  DocsLocaleCode,
  { title: string; description: string }
> = {
  zh: {
    title: '用户指南',
    description: 'Uter 使用指南：从注册登录到模型调用、聊天应用集成与日志审计',
  },
  'zh-TW': {
    title: '使用者指南',
    description: 'Uter 使用指南：從註冊登入到模型呼叫、聊天應用整合與日誌稽核',
  },
  en: {
    title: 'User Guide',
    description:
      'Uter user guide: from registration and login to model invocation, app integration and log auditing',
  },
  fr: {
    title: 'Guide de l’utilisateur',
    description:
      'Guide de l’utilisateur Uter : de l’inscription et de la connexion à l’appel de modèles, à l’intégration d’applications et à l’audit des journaux',
  },
  ja: {
    title: 'ユーザーガイド',
    description:
      'Uter ユーザーガイド：登録・ログインからモデル呼び出し、チャットアプリ連携、ログ監査まで',
  },
  ru: {
    title: 'Руководство пользователя',
    description:
      'Руководство пользователя Uter: от регистрации и входа до вызова моделей, интеграции приложений и аудита журналов',
  },
  vi: {
    title: 'Hướng dẫn sử dụng',
    description:
      'Hướng dẫn sử dụng Uter: từ đăng ký, đăng nhập đến gọi mô hình, tích hợp ứng dụng và kiểm tra nhật ký',
  },
}

/**
 * The chapter sources, loaded lazily as raw text — one small chunk per
 * chapter, fetched only when a reader opens this index.
 */
const chapterSources = import.meta.glob<string>(
  '../../../docs-content/user-guide/*.mdx',
  { query: '?raw', import: 'default' }
)

/**
 * The chapter's opening prose: the first meaningful line before the
 * first `##`, skipping the `#` title, fenced code, tables and raw JSX
 * the way the framed export's block parser does.
 */
function teaserOf(source: string): string {
  let inFence = false
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim()
    if (line.startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence || line === '' || line.startsWith('#')) continue
    if (line.startsWith('|') || line.startsWith('<')) continue
    const prose = line
      .replace(/^[-*]\s+/, '')
      .replace(/^\d+\.\s+/, '')
      .replaceAll(/[*_`[\]()]/g, '')
    if (prose) return prose.length > 140 ? `${prose.slice(0, 140)}…` : prose
  }
  return ''
}

/** One chapter card. */
function ChapterCard({
  locale,
  slug,
  teaser,
}: {
  locale: DocsLocaleCode
  slug: string
  teaser: string
}) {
  return (
    <Link
      to='/docs/$'
      params={{ _splat: `${locale}/${USER_GUIDE_PATH}/${slug}` }}
      className='hover:bg-muted block rounded-md border p-4 no-underline transition-colors'
    >
      <p className='text-long text-fg-primary mb-1 font-medium'>
        {userGuideChapterTitle(locale, slug) ?? slug}
      </p>
      {teaser ? <p className='text-dense text-fg-secondary'>{teaser}</p> : null}
    </Link>
  )
}

export function UserGuideIndex({ locale }: { locale: DocsLocaleCode }) {
  const [teasers, setTeasers] = useState<Record<string, string>>({})

  useEffect(() => {
    let alive = true
    const loaded: Record<string, string> = {}
    Promise.all(
      USER_GUIDE_CHAPTER_SLUGS.map(async (slug) => {
        const source =
          chapterSources[`../../../docs-content/user-guide/${slug}.mdx`]
        if (!source) return
        try {
          loaded[slug] = teaserOf(await source())
        } catch {
          // A missing chapter renders a card without a teaser; the rest
          // of the index stays up.
        }
      })
    )
      .then(() => {
        if (alive) setTeasers(loaded)
      })
      .catch(() => {
        // Raw-chunk load failures leave the affected cards without a
        // teaser; the rest of the index stays up.
      })
    return () => {
      alive = false
    }
  }, [])

  const identity = GUIDE_IDENTITY[locale]

  return (
    <div>
      <Heading variant='section-title' level={1} className='mt-6 mb-2'>
        {identity.title}
      </Heading>
      <p className='text-long text-fg-secondary mb-8'>{identity.description}</p>
      <div className='grid gap-4 sm:grid-cols-2'>
        {USER_GUIDE_CHAPTER_SLUGS.map((slug) => (
          <ChapterCard
            key={slug}
            locale={locale}
            slug={slug}
            teaser={teasers[slug] ?? ''}
          />
        ))}
      </div>
    </div>
  )
}
