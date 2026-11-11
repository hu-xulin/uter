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
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { Heading } from '@/design-system'
import {
  DocsToc,
  DocsTocInline,
  type TocItem,
} from '@/features/docs/native/docs-toc'
import { useActiveHeading } from '@/features/docs/native/use-active-heading'
import { resolveDocsLocaleCode, type DocsLocaleCode } from '@/lib/docs-link'
import { cn } from '@/lib/utils'

import {
  PARTNER_GROUP_LABELS,
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

/** 整页大纲：章节（h2）+ 子节（h3），供右侧目录使用。 */
function outlineOf(content: AboutContent): TocItem[] {
  return content.sections.flatMap((section, i) => [
    { depth: 2 as const, text: section.heading, id: chapterId(i) },
    ...(section.subSections ?? []).map((sub, j) => ({
      depth: 3 as const,
      text: sub.heading,
      id: subSectionId(i, j),
    })),
  ])
}

/**
 * 左栏：九章导航。
 *
 * 子节默认收起，只有「当前章」展开 —— 九章四十多个子节全部铺开会比正文
 * 还长，左栏就失去了「一眼看到全书结构」的作用。
 */
function AboutSidebar({
  content,
  activeId,
}: {
  content: AboutContent
  activeId: string | null
}) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('Contents')} className='text-dense flex flex-col'>
      {content.sections.map((section, i) => {
        const id = chapterId(i)
        const subs = section.subSections ?? []
        const isActive = activeId === id
        const hasActiveSub = subs.some(
          (_, j) => subSectionId(i, j) === activeId
        )
        return (
          <div key={id}>
            <a
              href={`#${id}`}
              aria-current={isActive ? 'location' : undefined}
              className={cn(
                'block rounded-md py-1.5 pr-2 pl-2 no-underline transition-colors',
                isActive || hasActiveSub
                  ? 'bg-primary-subtle text-sidebar-active-foreground font-medium'
                  : 'text-fg-secondary hover:bg-muted hover:text-fg-primary'
              )}
            >
              {section.heading}
            </a>
            {subs.length > 0 && (isActive || hasActiveSub) ? (
              <div className='mt-0.5 mb-1 flex flex-col'>
                {subs.map((sub, j) => {
                  const subId = subSectionId(i, j)
                  const subActive = activeId === subId
                  return (
                    <a
                      key={subId}
                      href={`#${subId}`}
                      aria-current={subActive ? 'location' : undefined}
                      className={cn(
                        'block rounded-md py-1 pr-2 pl-6 no-underline transition-colors',
                        subActive
                          ? 'text-sidebar-active-foreground font-medium'
                          : 'text-fg-secondary hover:text-fg-primary'
                      )}
                    >
                      {sub.heading}
                    </a>
                  )
                })}
              </div>
            ) : null}
          </div>
        )
      })}
    </nav>
  )
}

/**
 * In-app About page for `/about` — the company profile rendered
 * natively in the SPA, no iframe, no static export.
 *
 * The framed export split the nine chapters across `/about/<lang>/<slug>/`
 * URLs the SPA route tree never had; here they are drawn continuously on
 * one page with the same content model (`about-shared.ts` + one module
 * per locale under `content/`), so the reader gets the whole profile —
 * chapters, the founder's profile block, the label/value entry cards and
 * the partner wall — without leaving the app.
 */
function ProfileBlock({ sub }: { sub: AboutSubSection }) {
  if (!sub.profile) return null
  return (
    <div className='mb-3 flex items-center gap-4 rounded-md border px-4 py-3'>
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
    <div className='flex items-center gap-2 rounded-md border px-3 py-2'>
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
            level={3}
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
                <div key={entry.label} className='rounded-md border p-4'>
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

export function AboutViewer() {
  const { i18n } = useTranslation()
  const locale = resolveDocsLocaleCode(i18n.language)
  const content = ABOUT_CONTENT_BY_LOCALE[locale]
  const outline = outlineOf(content)
  const activeId = useActiveHeading(outline.map((item) => item.id))

  return (
    <PublicLayout showMainContainer={false}>
      <div className='h-16 shrink-0' aria-hidden='true' />
      <div className='mx-auto flex w-full max-w-[1440px] items-start'>
        <aside className='border-border sticky top-16 hidden h-[calc(100svh-4rem)] w-64 shrink-0 overflow-y-auto border-r py-6 pr-3 pl-2 lg:block'>
          <AboutSidebar content={content} activeId={activeId} />
        </aside>
        <main className='min-w-0 flex-1'>
          <div className='mx-auto max-w-3xl px-6 py-10'>
            <DocsTocInline items={outline} />
            <Heading variant='section-title' level={1} className='mt-2 mb-2'>
              {content.title}
            </Heading>
            <p className='text-long text-fg-secondary mb-8'>
              {content.description}
            </p>
            {content.sections.map((section, index) => (
              <section key={section.heading} className='mb-8'>
                <Heading
                  variant='card-title'
                  level={2}
                  id={chapterId(index)}
                  className='mb-3 scroll-mt-20'
                >
                  {section.heading}
                </Heading>
                <ChapterBody
                  section={section}
                  chapter={index}
                  locale={locale}
                />
              </section>
            ))}
          </div>
        </main>
        <aside className='sticky top-16 hidden h-[calc(100svh-4rem)] w-56 shrink-0 overflow-y-auto py-6 xl:block'>
          <DocsToc items={outline} />
        </aside>
      </div>
    </PublicLayout>
  )
}
