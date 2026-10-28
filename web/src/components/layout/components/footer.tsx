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
import { Link, useNavigate } from '@tanstack/react-router'
import { Fragment, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { HtmlContent } from '@/components/html-content'
import { useSystemConfig } from '@/hooks/use-system-config'
import { normalizeInterfaceLanguage } from '@/i18n/languages'
import { localizedBrandName } from '@/lib/brand'
import {
  isBundledDocsHref,
  legalDocsPathFor,
  resolveDocsHref,
  resolveDocsLocaleCode,
  type DocsLocaleCode,
} from '@/lib/docs-link'
import { cn } from '@/lib/utils'

interface FooterLink {
  text: string
  href: string
}

interface FooterColumnProps {
  title: string
  links: FooterLink[]
}

interface FooterProps {
  name?: string
  columns?: FooterColumnProps[]
  copyright?: string
  className?: string
}

const UTER_FOOTER_ATTRIBUTION_KEY = [
  'footer',
  'uter',
  'projectAttributionSuffix',
].join('.')

// The two regulatory filing numbers that sit at the end of the legal row.
//
// They are links to the official filing portals, opened in a new tab, and each
// one is preceded by the same `·` separator the legal documents use — so the
// row reads 用户协议 · 隐私政策 · 充值协议 · 粤ICP备… · 粤公网安备… . The
// numbers are identifiers rather than prose, so the translated label carries
// the whole string verbatim in every locale.
const FOOTER_FILING_LINKS = [
  {
    labelKey: 'ICP Filing Number',
    href: 'https://beian.miit.gov.cn',
  },
  {
    // The public-security filing portal resolves a record only through its
    // `code` query, so the link carries the filing number itself — landing on
    // the bare search page would leave the reader to type the number back in.
    labelKey: 'Police Filing Number',
    href: 'https://beian.mps.gov.cn/#/query/webSearch?code=44030002018502',
  },
] as const

// The interface languages the filing numbers are rendered for.
//
// These are filings with mainland-China regulators — ICP and public-network
// security — and their labels are only written out in the Chinese locales.
// Under any other interface language they would read as two unexplained
// alphanumeric strings, so they are dropped and the legal row ends with the
// recharge agreement.
const FILING_LINK_LANGUAGES = new Set(['zhCN', 'zhTW'])

function FooterLinkItem(props: { link: FooterLink }) {
  const { t } = useTranslation()
  const isExternal = props.link.href.startsWith('http')
  const label = t(props.link.text)

  if (isExternal) {
    return (
      <a
        href={props.link.href}
        target='_blank'
        rel='noopener noreferrer'
        className='text-tertiary-foreground hover:text-foreground ds-motion-marketing-fast text-sm transition-colors'
      >
        {label}
      </a>
    )
  }

  return (
    <Link
      to={props.link.href}
      className='text-tertiary-foreground hover:text-foreground ds-motion-marketing-fast text-sm transition-colors'
    >
      {label}
    </Link>
  )
}

/**
 * In-app route of each legal document.
 *
 * A footer legal link has to land where the top nav's 文档 link lands: on the
 * SPA route, which frames the exported docs page under the app's own
 * `PublicHeader`. Sending the reader to the exported page directly
 * (`/docs/<locale>/legal/<doc>/`) leaves the app behind and hands the top of
 * the screen to the docs site's own header — a bar that collapses into a
 * centred floating capsule once the page scrolls, instead of the app's
 * full-width solid one. The same document then appeared under two different
 * chromes depending on where it was opened from.
 */
const LEGAL_ROUTES = {
  'user-agreement': '/user-agreement',
  'privacy-policy': '/privacy-policy',
  'recharge-agreement': '/recharge-agreement',
} as const

type LegalDocId = keyof typeof LEGAL_ROUTES

// Renders User Agreement / Privacy Policy / Recharge Agreement links inline
// with the footer's bottom-left row, always on (the footer is contractually
// required to surface all three). Emits fragmented siblings so the parent flex
// container's gap controls spacing.
//
// Each link keeps a real, independently resolvable destination as its `href`
// — the bundled docs page, `/docs/<locale>/legal/<doc>/` — but a plain left
// click is routed in-app through {@link LEGAL_ROUTES}, so the reader stays
// under the app shell. The `href` is what a crawler, a link unfurler or
// anyone the reader shares the URL with follows; modified clicks (middle
// click, ⌘/Ctrl-click, "open in new tab") are left to the browser and open
// that standalone page.
//
// When an admin repoints `docs_link` at an external knowledge base there is no
// bundled page to link to and the SPA routes fall back to the configured text,
// so the `href` becomes the SPA route itself.
function LegalLinks(props: { leadingSeparator?: boolean }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const docsLocale = resolveDocsLocaleCode(i18n.language)
  // Always point the links at the bundled legal-doc pages; admins that repoint
  // `docs_link` elsewhere lose the bundled pages, but the site footer is fixed
  // to surface User Agreement / Privacy Policy / Recharge Agreement, so we fall
  // back to the default bundled entry and let the SPA routes carry the reader.
  const useDocsPages = isBundledDocsHref(resolveDocsHref(undefined))
  const items: { id: LegalDocId; label: string; href: string }[] = [
    {
      id: 'user-agreement',
      label: t('User Agreement'),
      href: legalPageHref('user-agreement', useDocsPages, docsLocale),
    },
    {
      id: 'privacy-policy',
      label: t('Privacy Policy'),
      href: legalPageHref('privacy-policy', useDocsPages, docsLocale),
    },
    {
      id: 'recharge-agreement',
      label: t('Recharge Agreement'),
      href: legalPageHref('recharge-agreement', useDocsPages, docsLocale),
    },
  ]

  // Modified clicks and non-primary buttons stay with the browser, so the
  // standalone docs page remains one keystroke away; everything else is
  // handled by the router and never reloads the document.
  const openInApp = (
    event: React.MouseEvent<HTMLAnchorElement>,
    id: LegalDocId
  ) => {
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate({ to: LEGAL_ROUTES[id] })
  }

  if (items.length === 0) {
    return null
  }
  return (
    <>
      {items.map((item, index) => (
        <Fragment key={item.id}>
          {(props.leadingSeparator || index > 0) && (
            <span aria-hidden='true' className='text-tertiary-foreground'>
              ·
            </span>
          )}
          <a
            href={item.href}
            onClick={(event) => openInApp(event, item.id)}
            className='text-tertiary-foreground hover:text-foreground ds-motion-marketing-fast text-sm transition-colors'
          >
            {item.label}
          </a>
        </Fragment>
      ))}
    </>
  )
}

/**
 * `href` of one legal link: the bundled docs page for the current locale, or
 * the SPA route when the bundled docs site is not the configured docs target.
 * This is the link's outward-facing destination — the page a click is routed
 * away from, never the one it lands on.
 */
function legalPageHref(
  docId: LegalDocId,
  useDocsPages: boolean,
  docsLocale: DocsLocaleCode
): string {
  return useDocsPages ? legalDocsPathFor(docsLocale, docId) : `/${docId}`
}

// The filing numbers, rendered as the middle block of the footer row.
//
// They used to trail the agreements inline (`… 充值协议 · 粤ICP备… · 粤公网安备…`),
// which glued the two halves of the row to the left edge and left the whole
// right side of the footer empty. They are now their own block, separated from
// the agreements by the row's column gap, so the footer reads as three evenly
// distributed groups: agreements · filings · attribution.
//
// Inside the block the numbers keep a single `·` between them; there is no
// leading separator any more, because the block boundary already separates
// them from the agreements. Rendered only for the Chinese locales.
function FilingLinks(props: { className?: string }) {
  const { t, i18n } = useTranslation()

  if (!FILING_LINK_LANGUAGES.has(normalizeInterfaceLanguage(i18n.language))) {
    return null
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-2 gap-y-1',
        props.className
      )}
    >
      {FOOTER_FILING_LINKS.map((item, index) => (
        <Fragment key={item.labelKey}>
          {index > 0 && (
            <span aria-hidden='true' className='text-tertiary-foreground'>
              ·
            </span>
          )}
          <a
            href={item.href}
            target='_blank'
            rel='noopener noreferrer'
            className='text-tertiary-foreground hover:text-foreground ds-motion-marketing-fast text-sm transition-colors'
          >
            {t(item.labelKey)}
          </a>
        </Fragment>
      ))}
    </div>
  )
}

// inline=true returns just the inner span for composition in a parent flex
// row. inline=false wraps in a centered/right-aligned div (default).
function ProjectAttribution(props: {
  currentYear: number
  inline?: boolean
  brandName?: string
}) {
  const { t } = useTranslation()
  // 整行与左侧的法律链接同色：三级文字色 `tertiary-foreground`。
  // 历史：先是比链接更深的 `text-muted-foreground`（同一行左灰右黑），后改成
  // 二级色 `text-muted-foreground`，仍然比用户期望的「页脚小字」重一档；
  // 最终统一到三级色 —— 这就是「次级文本用浅色」的落点。
  // **不要**再往下加不透明度（如 `/80`）：theme.css 里 `tertiary-foreground`
  // 已是「更浅但不破线」的最大一档（4.6:1），叠 80% 会掉到约 3:1，
  // 低于 colors.md 的 4.5:1 下限。想更浅只能改 Token 取值，不能就地压 alpha。
  // 品牌名保留 hover 加深，因为它同时是一个外链；但**不加字重** ——
  // 整行是同一档次级小字，500 会让「优特智能」在「© 2026 … 版权所有。」中间
  // 凸出来，读成三个互不相干的碎片（用户红字：「都属于次级文本」）。
  const content = (
    <span className='text-tertiary-foreground'>
      &copy; {props.currentYear}{' '}
      <a
        href='https://uter.ai'
        target='_blank'
        rel='noopener noreferrer'
        className='hover:text-foreground transition-colors'
      >
        {props.brandName ?? t('Uter')}
      </a>
      . {t(UTER_FOOTER_ATTRIBUTION_KEY)}
    </span>
  )
  if (props.inline) {
    return content
  }
  return (
    <div className='text-tertiary-foreground text-center text-sm sm:text-right'>
      {content}
    </div>
  )
}

export function Footer(props: FooterProps) {
  const { t, i18n } = useTranslation()
  const { footerHtml, demoSiteEnabled } = useSystemConfig()

  const brandName = localizedBrandName(i18n.language)
  const isDemoSiteMode = Boolean(demoSiteEnabled)
  const currentYear = new Date().getFullYear()

  const fallbackColumns = useMemo<FooterColumnProps[]>(
    () => [
      {
        title: t('footer.columns.about.title'),
        links: [
          {
            text: t('footer.columns.about.links.aboutProject'),
            href: 'https://uter.ai/docswiki/project-introduction/',
          },
          {
            text: t('footer.columns.about.links.contact'),
            href: 'https://uter.ai/docssupport/community-interaction/',
          },
          {
            text: t('footer.columns.about.links.features'),
            href: 'https://uter.ai/docswiki/features-introduction/',
          },
        ],
      },
      {
        title: t('footer.columns.docs.title'),
        links: [
          {
            text: t('footer.columns.docs.links.quickStart'),
            href: 'https://uter.ai/docsgetting-started/',
          },
          {
            text: t('footer.columns.docs.links.installation'),
            href: 'https://uter.ai/docsinstallation/',
          },
          {
            text: t('footer.columns.docs.links.apiDocs'),
            href: 'https://uter.ai/docsapi/',
          },
        ],
      },
      {
        title: t('footer.columns.related.title'),
        links: [
          {
            text: t('footer.columns.related.links.oneApi'),
            href: 'https://uter.ai',
          },
          {
            text: t('footer.columns.related.links.midjourney'),
            href: 'https://uter.ai',
          },
          {
            text: t('footer.columns.related.links.uterKeyTool'),
            href: 'https://uter.ai',
          },
        ],
      },
    ],
    [t]
  )

  const displayColumns = props.columns ?? fallbackColumns

  if (footerHtml) {
    return (
      <footer
        className={cn(
          'border-border/40 relative z-10 border-t',
          props.className
        )}
      >
        <div className='mx-auto w-full max-w-6xl px-6 py-5'>
          <div className='bg-muted/20 border-border/50 flex flex-col items-center justify-between gap-4 rounded-2xl border px-4 py-4 backdrop-blur-sm sm:flex-row sm:px-5'>
            <HtmlContent
              className='custom-footer text-muted-foreground min-w-0 text-center text-sm sm:text-left'
              content={footerHtml}
            />
            <div className='border-border/60 text-tertiary-foreground flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t pt-4 text-sm sm:w-auto sm:justify-end sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5'>
              <LegalLinks />
              <ProjectAttribution
                currentYear={currentYear}
                inline
                brandName={brandName}
              />
            </div>
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer
      className={cn('border-border/40 relative z-10 border-t', props.className)}
    >
      <div className='mx-auto max-w-6xl px-6 py-12 md:py-16'>
        {/* Links columns — demo sites only. */}
        {isDemoSiteMode && (
          <div className='mb-10 flex flex-col gap-10 md:flex-row md:gap-16'>
            <div className='grid grid-cols-3 gap-8 md:gap-16'>
              {displayColumns.map((column) => (
                <div key={column.title}>
                  <p className='text-tertiary-foreground mb-3 text-sm font-medium uppercase'>
                    {t(column.title)}
                  </p>
                  <ul className='space-y-2.5'>
                    {column.links.map((link) => (
                      <li key={link.text}>
                        <FooterLinkItem link={link} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legal row: three blocks distributed across the full width — the
            agreements on the left, the filing numbers in the middle, the
            project attribution on the right. They used to be two blocks glued
            to the left (agreements + filings) with the attribution alone on
            the right, which read as one dense run of text and a stray
            copyright. The middle block is centred by construction — the two
            sides are equal `1fr` tracks and the filings take their own width —
            so the agreements are not squeezed into a fixed third and wrapped
            onto a second line. The attribution is pinned to the third column
            so it stays on the right in the locales that render no filing
            numbers at all. The footer's own top border is the only divider
            above it. */}
        <div className='grid grid-cols-1 items-center gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]'>
          <div className='flex flex-wrap items-center justify-center gap-x-2 gap-y-1 sm:justify-start'>
            <LegalLinks />
          </div>
          <FilingLinks />
          <div className='flex justify-center sm:col-start-3 sm:justify-end'>
            <ProjectAttribution
              currentYear={currentYear}
              brandName={brandName}
            />
          </div>
        </div>
      </div>
    </footer>
  )
}
