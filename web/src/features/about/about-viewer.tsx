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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { Heading } from '@/design-system'
import {
  CONTENT_CARD_CLASS,
  CONTENT_CARD_GRID_CLASS,
  CONTENT_CARD_TEASER_CLASS,
  CONTENT_CARD_TITLE_CLASS,
} from '@/features/docs/native/content-card'
import {
  DocsToc,
  DocsTocInline,
  type TocItem,
} from '@/features/docs/native/docs-toc'
import {
  PAGE_NAV_CARD_CLASS,
  PageNav,
  PageNavCardContent,
} from '@/features/docs/native/page-nav'
import { resolveDocsLocaleCode, type DocsLocaleCode } from '@/lib/docs-link'
import { cn } from '@/lib/utils'

import {
  ABOUT_SECTION_SLUGS,
  PARTNER_GROUP_LABELS,
  findAboutSection,
  type AboutContent,
  type AboutPartner,
  type AboutSection,
  type AboutSubSection,
} from './about-shared'
import { ABOUT_CONTENT_BY_LOCALE } from './content'

/**
 * 章节与子节的锚点 id。
 *
 * 用**序号**而不是标题文本：标题是每语言各写一遍的（中英两份不是互译），
 * 拿标题生成 slug 会让同一节在切语言后换 id，深链接当场失效。
 */
const chapterId = (index: number) => `ch-${index + 1}`
const subSectionId = (chapter: number, sub: number) =>
  `ch-${chapter + 1}-${sub + 1}`

/**
 * 右栏目录只列**当前章**内部的子节。
 *
 * 一章一页之后，章节标题已经是页面 h1，右栏不该再重复它；子节是本页
 * 能看到的最高层级，所以统一降一级为 depth 2。
 */
function outlineOfSection(section: AboutSection, chapter: number): TocItem[] {
  return (section.subSections ?? []).map((sub, i) => ({
    depth: 2 as const,
    text: sub.heading,
    id: subSectionId(chapter, i),
  }))
}

/** 卡片摘要：章节开头第一段，超长时截断。 */
function teaserOf(section: AboutSection): string {
  const first = section.subSections?.[0]?.paragraphs?.[0]
  if (!first) return ''
  return first.length > 140 ? `${first.slice(0, 140)}…` : first
}

const SIDEBAR_LINK_CLASS =
  'focus-visible:ring-ring block rounded-md py-1.5 pr-2 pl-2 no-underline transition-colors outline-none focus-visible:ring-1'
const SIDEBAR_ACTIVE_CLASS =
  'bg-primary-subtle text-sidebar-active-foreground font-medium'
const SIDEBAR_IDLE_CLASS =
  'text-fg-secondary hover:bg-muted hover:text-fg-primary'

/**
 * 左栏：公司名入口 + 九个一级章节，仅此而已。
 *
 * 二级标题（「连接智能，创造可能」「我们的目标」……）属于章节内部大纲，
 * 归右栏 TOC，不进左栏 —— 九章四十多个子节全铺开会比正文还长，左栏
 * 就失去了「一眼看到全书结构」的作用。
 */
function AboutSidebar({
  content,
  activeSlug,
}: {
  content: AboutContent
  activeSlug: string | null
}) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('Contents')} className='text-dense flex flex-col'>
      <Link
        to='/about'
        aria-current={activeSlug === null ? 'page' : undefined}
        className={cn(
          SIDEBAR_LINK_CLASS,
          activeSlug === null ? SIDEBAR_ACTIVE_CLASS : SIDEBAR_IDLE_CLASS
        )}
      >
        {t('footer.columns.about.title')}
      </Link>
      {content.sections.map((section, i) => {
        const slug = ABOUT_SECTION_SLUGS[i]
        const isActive = activeSlug === slug
        return (
          <Link
            key={slug}
            to='/about/$section'
            params={{ section: slug }}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              SIDEBAR_LINK_CLASS,
              isActive ? SIDEBAR_ACTIVE_CLASS : SIDEBAR_IDLE_CLASS
            )}
          >
            {section.heading}
          </Link>
        )
      })}
    </nav>
  )
}

/** 三栏骨架，与原生文档页同一套宽度与吸顶规则。 */
function AboutShell({
  locale,
  activeSlug,
  toc,
  children,
}: {
  locale: DocsLocaleCode
  activeSlug: string | null
  toc: TocItem[]
  children: ReactNode
}) {
  const content = ABOUT_CONTENT_BY_LOCALE[locale]
  return (
    <PublicLayout showMainContainer={false}>
      <div className='h-16 shrink-0' aria-hidden='true' />
      <div className='mx-auto flex w-full max-w-[1440px] items-start'>
        <aside className='border-border sticky top-16 hidden h-[calc(100svh-4rem)] w-64 shrink-0 overflow-y-auto border-r py-6 pr-3 pl-2 lg:block'>
          <AboutSidebar content={content} activeSlug={activeSlug} />
        </aside>
        <main className='min-w-0 flex-1'>
          <div className='mx-auto max-w-3xl px-6 py-10'>
            <DocsTocInline items={toc} />
            {children}
          </div>
        </main>
        <aside className='sticky top-16 hidden h-[calc(100svh-4rem)] w-56 shrink-0 overflow-y-auto py-6 xl:block'>
          <DocsToc items={toc} />
        </aside>
      </div>
    </PublicLayout>
  )
}

function ProfileBlock({ sub }: { sub: AboutSubSection }) {
  if (!sub.profile) return null
  return (
    <div className='mb-3 flex items-center gap-4 rounded-lg border px-4 py-3'>
      {sub.profile.avatar ? (
        <img
          src={sub.profile.avatar}
          alt={sub.profile.name}
          width={72}
          height={72}
          className='size-18 shrink-0 rounded-full object-cover'
        />
      ) : null}
      <div className='flex min-w-0 flex-col gap-0.5'>
        <span className='text-long text-fg-primary font-medium'>
          {sub.profile.name}
        </span>
        <span className='text-long text-fg-secondary'>{sub.profile.role}</span>
      </div>
    </div>
  )
}

function PartnerTile({
  partner,
  locale,
}: {
  partner: AboutPartner
  locale: DocsLocaleCode
}) {
  return (
    <div className='flex items-center gap-2 rounded-lg border px-3 py-2'>
      <img
        src={`/img/partners/${partner.id}.svg`}
        alt=''
        aria-hidden='true'
        width={20}
        height={20}
        className='size-5 shrink-0'
      />
      <div className='flex min-w-0 flex-col'>
        <span className='text-dense text-fg-primary font-medium'>
          {partner.name[locale]}
        </span>
        <span className='text-dense text-fg-secondary'>
          {partner.company[locale]}
        </span>
      </div>
    </div>
  )
}

function PartnerWallSection({
  partners,
  locale,
}: {
  partners: AboutPartner[]
  locale: DocsLocaleCode
}) {
  const groups: AboutPartner['group'][] = ['global', 'china']
  return (
    <div className='mt-6 space-y-4'>
      {groups.map((group) => {
        const members = partners.filter((p) => p.group === group)
        if (members.length === 0) return null
        return (
          <div key={group}>
            <p className='text-long text-fg-primary mb-2 font-semibold'>
              {PARTNER_GROUP_LABELS[group][locale]}
            </p>
            <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
              {members.map((partner) => (
                <PartnerTile
                  key={partner.id}
                  partner={partner}
                  locale={locale}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** 某一章的正文，且只有这一章。 */
function ChapterBody({
  section,
  chapter,
  locale,
}: {
  section: AboutSection
  /** 章节序号，用来给子节生成稳定的锚点 id。 */
  chapter: number
  locale: DocsLocaleCode
}) {
  return (
    <>
      {section.subSections?.map((sub, i) => (
        <div key={sub.heading} className='mt-6'>
          <Heading
            variant='card-title'
            level={2}
            id={subSectionId(chapter, i)}
            className='mb-2 scroll-mt-20'
          >
            {sub.heading}
          </Heading>
          <ProfileBlock sub={sub} />
          {sub.paragraphs?.map((paragraph) => (
            <p key={paragraph} className='text-long text-fg-primary mb-2'>
              {paragraph}
            </p>
          ))}
          {sub.entries ? (
            <dl className='mt-3 mb-4 grid gap-3 sm:grid-cols-2'>
              {sub.entries.map((entry) => (
                <div key={entry.label} className='rounded-lg border p-4'>
                  <dt className='text-long text-fg-primary font-medium'>
                    {entry.label}
                  </dt>
                  <dd className='text-long text-fg-secondary mt-1'>
                    {entry.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          {sub.email ? (
            <a
              href={`mailto:${sub.email}`}
              className='text-fg-link hover:text-fg-link'
            >
              {sub.email}
            </a>
          ) : null}
        </div>
      ))}
      {section.closing?.map((paragraph) => (
        <p key={paragraph} className='text-long text-fg-primary mt-4'>
          {paragraph}
        </p>
      ))}
      {section.partnerWall ? (
        <PartnerWallSection partners={section.partnerWall} locale={locale} />
      ) : null}
    </>
  )
}

/**
 * `/about` — 公司简介的索引页。
 *
 * 像 Clerk 的文档站一样，这里只放标题、简介与九个一级章节的入口卡片；
 * 正文一章一页，分别落在 `/about/<slug>`。九章内容不再全部堆在一个页面上。
 */
export function AboutViewer() {
  const { i18n } = useTranslation()
  const locale = resolveDocsLocaleCode(i18n.language)
  const content = ABOUT_CONTENT_BY_LOCALE[locale]

  return (
    <AboutShell locale={locale} activeSlug={null} toc={[]}>
      <Heading variant='page-title' level={1} className='mt-2 mb-2'>
        {content.title}
      </Heading>
      <p className='text-long text-fg-secondary mb-8'>{content.description}</p>
      <ul className={CONTENT_CARD_GRID_CLASS}>
        {content.sections.map((section, i) => {
          const teaser = teaserOf(section)
          return (
            <li key={ABOUT_SECTION_SLUGS[i]}>
              <Link
                to='/about/$section'
                params={{ section: ABOUT_SECTION_SLUGS[i] }}
                className={CONTENT_CARD_CLASS}
              >
                <span className={CONTENT_CARD_TITLE_CLASS}>
                  {section.heading}
                </span>
                {teaser ? (
                  <span className={CONTENT_CARD_TEASER_CLASS}>{teaser}</span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
      <PageNav
        next={
          <Link
            to='/about/$section'
            params={{ section: ABOUT_SECTION_SLUGS[0] }}
            className={cn(PAGE_NAV_CARD_CLASS, 'items-end text-right')}
          >
            <PageNavCardContent
              direction='next'
              title={content.sections[0].heading}
            />
          </Link>
        }
      />
    </AboutShell>
  )
}

/**
 * `/about/<slug>` — 一章一页。
 *
 * 章节标题作 h1，右栏列本章子节，正文只渲染本章；上一页 / 下一页按九章
 * 顺序推进，第一章的「上一页」回到索引页，末章没有「下一页」。
 */
export function AboutSectionViewer({ section: slug }: { section: string }) {
  const { i18n, t } = useTranslation()
  const locale = resolveDocsLocaleCode(i18n.language)
  const content = ABOUT_CONTENT_BY_LOCALE[locale]
  const found = findAboutSection(content, slug)
  if (!found) return null
  const { section, index } = found
  const toc = outlineOfSection(section, index)

  const previousSlug =
    index > 0 ? ABOUT_SECTION_SLUGS[index - 1] : undefined
  const nextSlug =
    index < ABOUT_SECTION_SLUGS.length - 1
      ? ABOUT_SECTION_SLUGS[index + 1]
      : undefined

  const previousCard = previousSlug ? (
    <Link
      to='/about/$section'
      params={{ section: previousSlug }}
      className={PAGE_NAV_CARD_CLASS}
    >
      <PageNavCardContent
        direction='previous'
        title={content.sections[index - 1].heading}
      />
    </Link>
  ) : (
    <Link to='/about' className={PAGE_NAV_CARD_CLASS}>
      <PageNavCardContent
        direction='previous'
        title={t('footer.columns.about.title')}
      />
    </Link>
  )

  const nextCard = nextSlug ? (
    <Link
      to='/about/$section'
      params={{ section: nextSlug }}
      className={cn(PAGE_NAV_CARD_CLASS, 'items-end text-right')}
    >
      <PageNavCardContent
        direction='next'
        title={content.sections[index + 1].heading}
      />
    </Link>
  ) : undefined

  return (
    <AboutShell locale={locale} activeSlug={slug} toc={toc}>
      <Heading
        variant='page-title'
        level={1}
        id={chapterId(index)}
        className='mt-2 mb-6 scroll-mt-20'
      >
        {section.heading}
      </Heading>
      <ChapterBody section={section} chapter={index} locale={locale} />
      <PageNav previous={previousCard} next={nextCard} />
    </AboutShell>
  )
}
