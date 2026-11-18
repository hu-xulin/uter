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
import {
  Activity,
  BookOpen,
  ClipboardList,
  FileText,
  FlaskConical,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogIn,
  Puzzle,
  ShieldCheck,
  Tags,
  Terminal,
  Trophy,
  User,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { IconBadge } from '@/components/ui/icon-badge'
import { Heading } from '@/design-system'
import type { DocsLocaleCode } from '@/lib/docs-link'

import {
  CONTENT_CARD_CLASS,
  CONTENT_CARD_GRID_CLASS,
  CONTENT_CARD_TEASER_CLASS,
  CONTENT_CARD_TITLE_CLASS,
} from './content-card'
import { firstSentence } from './teaser'
import {
  userGuideChapterSlugs,
  USER_GUIDE_PATH,
  userGuideChapterTitle,
} from './user-guide-identity'

/**
 * Landing page of the user guide, at `/docs/<locale>/guide/wiki/user-guide`.
 *
 * The guide is split into a page per chapter, so — exactly like the
 * framed export's index — this is a synthesised card page rather than a
 * Markdown document: the guide's title and blurb, then one card per
 * chapter. Each card's summary is the chapter's own opening prose, read
 * from the build-time docs search index that is regenerated from the same
 * MDX corpus — so the cards cannot drift out of date as chapters are
 * rewritten (the same rule the framed export followed with its server-side
 * teaser).
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
 * Chapter teasers come from the build-time docs search index
 * (`public/docs-search/<locale>.json`), which `generate-docs-search-index.mjs`
 * derives from these very MDX files — one entry per chapter, in every locale.
 *
 * Rspack's `import.meta.glob` ignores both `query: '?raw'` and `as: 'raw'`
 * for `.mdx` here and hands back the compiled `MDXContent` component, so
 * reading the Markdown source at runtime is not an option. The index is the
 * canonical plain-text view of the corpus and is already generated before
 * every build.
 */
async function loadTeasers(
  locale: DocsLocaleCode
): Promise<Record<string, string>> {
  const response = await fetch(`/docs-search/${locale}.json`)
  if (!response.ok) return {}
  const rows = (await response.json()) as { p: string; b?: string }[]
  const teasers: Record<string, string> = {}
  for (const slug of userGuideChapterSlugs(locale)) {
    const row = rows.find((r) => r.p === `${USER_GUIDE_PATH}/${slug}`)
    if (!row?.b) continue
    teasers[slug] = firstSentence(row.b)
  }
  return teasers
}

/** Title icons, keyed by locale-neutral slug so labels can change safely. */
const CHAPTER_ICONS: Record<string, LucideIcon> = {
  auth: LogIn,
  playground: FlaskConical,
  overview: Activity,
  dashboard: LayoutDashboard,
  'api-keys': KeyRound,
  'usage-logs': FileText,
  'audit-logs': ClipboardList,
  'task-logs': ListChecks,
  wallet: Wallet,
  profile: User,
  security: ShieldCheck,
  pricing: Tags,
  ranking: Trophy,
  'profile-and-security': ShieldCheck,
  'api-and-playground': Terminal,
  'app-integration': Puzzle,
  'logs-and-tasks': ListChecks,
  'wallet-and-subscription': Wallet,
  'pricing-and-ranking': Trophy,
}

/** One chapter card — the framed export's `ContentCardGrid` shape. */
function ChapterCard({
  locale,
  slug,
  teaser,
}: {
  locale: DocsLocaleCode
  slug: string
  teaser: string
}) {
  const ChapterIcon = CHAPTER_ICONS[slug] ?? BookOpen
  return (
    <li>
      <Link
        to='/docs/$'
        params={{ _splat: `${locale}/${USER_GUIDE_PATH}/${slug}` }}
        className={CONTENT_CARD_CLASS}
      >
        <span className='flex items-center gap-3'>
          <IconBadge
            tone='primary'
            size='title'
            className='[&>svg]:size-(--ds-icon-sm)!'
          >
            <ChapterIcon />
          </IconBadge>
          <span className={`${CONTENT_CARD_TITLE_CLASS} min-w-0`}>
            {userGuideChapterTitle(locale, slug) ?? slug}
          </span>
        </span>
        {teaser ? (
          <span className={CONTENT_CARD_TEASER_CLASS}>{teaser}</span>
        ) : null}
      </Link>
    </li>
  )
}

export function UserGuideIndex({ locale }: { locale: DocsLocaleCode }) {
  const [teasers, setTeasers] = useState<Record<string, string>>({})

  useEffect(() => {
    let alive = true
    // A language switch must not briefly show the previous locale's prose.
    setTeasers({})
    loadTeasers(locale)
      .then((value) => {
        if (alive) setTeasers(value)
      })
      .catch(() => {
        // An index that has not been generated yet leaves the cards
        // without teasers; the links and the rest of the page stay up.
      })
    return () => {
      alive = false
    }
  }, [locale])

  const identity = GUIDE_IDENTITY[locale]

  return (
    <div>
      <Heading variant='page-title' level={1} className='mt-6 mb-2'>
        {identity.title}
      </Heading>
      <p className='text-long text-fg-secondary mb-8'>{identity.description}</p>
      <ul className={CONTENT_CARD_GRID_CLASS}>
        {userGuideChapterSlugs(locale).map((slug) => (
          <ChapterCard
            key={slug}
            locale={locale}
            slug={slug}
            teaser={teasers[slug] ?? ''}
          />
        ))}
      </ul>
    </div>
  )
}
