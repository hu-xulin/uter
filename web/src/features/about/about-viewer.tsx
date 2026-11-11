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
import { resolveDocsLocaleCode, type DocsLocaleCode } from '@/lib/docs-link'

import { PARTNER_GROUP_LABELS } from './about-shared'
import type {
  AboutPartner,
  AboutSection,
  AboutSubSection,
} from './about-shared'
import { ABOUT_CONTENT_BY_LOCALE } from './content'

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
  locale,
}: {
  section: AboutSection
  locale: DocsLocaleCode
}) {
  return (
    <>
      {section.subSections?.map((sub, i) => (
        <div key={i} className='mt-6'>
          <h3 className='text-fg-primary mb-2 text-lg font-semibold'>
            {sub.heading}
          </h3>
          <ProfileBlock sub={sub} />
          {sub.paragraphs?.map((paragraph, j) => (
            <p key={j} className='text-long text-fg-primary mb-2'>
              {paragraph}
            </p>
          ))}
          {sub.entries ? (
            <dl className='mt-3 mb-4 grid gap-3 sm:grid-cols-2'>
              {sub.entries.map((entry, k) => (
                <div key={k} className='rounded-md border p-4'>
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
      {section.closing?.map((paragraph, i) => (
        <p key={i} className='text-long text-fg-primary mt-4'>
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

  return (
    <PublicLayout>
      <div className='mx-auto w-full max-w-3xl px-6 py-10'>
        <h1 className='text-fg-primary mt-6 mb-2 text-2xl font-semibold'>
          {content.title}
        </h1>
        <p className='text-long text-fg-secondary mb-8'>
          {content.description}
        </p>
        {content.sections.map((section) => (
          <section key={section.heading} className='mb-8'>
            <h2 className='text-fg-primary mb-3 scroll-mt-20 text-xl font-semibold'>
              {section.heading}
            </h2>
            <ChapterBody section={section} locale={locale} />
          </section>
        ))}
      </div>
    </PublicLayout>
  )
}
