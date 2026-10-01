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

For commercial licensing, please contact support@Uter.ai.com
*/
import { Link, useNavigate } from '@tanstack/react-router'
import { Fragment, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'
import { DEFAULT_LOGO } from '@/lib/constants'
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
  logo?: string
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
        className='text-muted-foreground hover:text-foreground text-sm transition-colors duration-200'
      >
        {label}
      </a>
    )
  }

  return (
    <Link
      to={props.link.href}
      className='text-muted-foreground hover:text-foreground text-sm transition-colors duration-200'
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
// with the parent's copyright row when they are configured in System
// Settings → Site. Emits fragmented siblings so the parent flex container's
// gap controls spacing.
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
  const { status } = useStatus()
  const navigate = useNavigate()
  const docsLocale = resolveDocsLocaleCode(i18n.language)
  const useDocsPages = isBundledDocsHref(resolveDocsHref(status?.docs_link))
  const items: { id: LegalDocId; label: string; href: string }[] = []
  if (status?.user_agreement_enabled) {
    items.push({
      id: 'user-agreement',
      label: t('User Agreement'),
      href: legalPageHref('user-agreement', useDocsPages, docsLocale),
    })
  }
  if (status?.privacy_policy_enabled) {
    items.push({
      id: 'privacy-policy',
      label: t('Privacy Policy'),
      href: legalPageHref('privacy-policy', useDocsPages, docsLocale),
    })
  }
  if (status?.recharge_agreement_enabled) {
    items.push({
      id: 'recharge-agreement',
      label: t('Recharge Agreement'),
      href: legalPageHref('recharge-agreement', useDocsPages, docsLocale),
    })
  }

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
            <span aria-hidden='true' className='text-muted-foreground/30'>
              ·
            </span>
          )}
          <a
            href={item.href}
            onClick={(event) => openInApp(event, item.id)}
            className='hover:text-foreground transition-colors duration-200'
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

// inline=true returns just the inner span for composition in a parent flex
// row. inline=false wraps in a centered/right-aligned div (default).
function ProjectAttribution(props: {
  currentYear: number
  inline?: boolean
  brandName?: string
}) {
  const { t } = useTranslation()
  const content = (
    <span className='text-muted-foreground/45'>
      &copy; {props.currentYear}{' '}
      <a
        href='https://uter.ai'
        target='_blank'
        rel='noopener noreferrer'
        className='text-foreground/70 hover:text-foreground font-medium transition-colors'
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
    <div className='text-muted-foreground/45 text-center text-xs sm:text-right'>
      {content}
    </div>
  )
}

export function Footer(props: FooterProps) {
  const { t, i18n } = useTranslation()
  const {
    logo: systemLogo,
    footerHtml,
    demoSiteEnabled,
  } = useSystemConfig()

  const displayLogo = systemLogo || props.logo || DEFAULT_LOGO
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
            <div
              className='custom-footer text-muted-foreground min-w-0 text-center text-sm sm:text-left'
              dangerouslySetInnerHTML={{ __html: footerHtml }}
            />
            <div className='border-border/60 text-muted-foreground/45 flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t pt-4 text-xs sm:w-auto sm:justify-end sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5'>
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
        <div className='flex flex-col justify-between gap-10 md:flex-row md:gap-16'>
          {/* Brand column */}
          <div className='shrink-0'>
            <Link to='/' className='group flex items-center gap-2.5'>
              <img
                src={displayLogo}
                alt={brandName}
                className='size-7 rounded-lg object-contain'
              />
              <span className='font-brand text-sm font-semibold tracking-tight'>
                {brandName}
              </span>
            </Link>
            <p className='text-muted-foreground/60 mt-3 max-w-[200px] text-xs leading-relaxed'>
              {t('Powerful API Management Platform')}
            </p>
          </div>

          {/* Links columns */}
          {isDemoSiteMode && (
            <div className='grid grid-cols-3 gap-8 md:gap-16'>
              {displayColumns.map((column, index) => (
                <div key={index}>
                  <p className='text-muted-foreground/50 mb-3 text-xs font-medium tracking-wider uppercase'>
                    {t(column.title)}
                  </p>
                  <ul className='space-y-2.5'>
                    {column.links.map((link, linkIndex) => (
                      <li key={linkIndex}>
                        <FooterLinkItem link={link} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Copyright + optional legal links inline on the left, project
            attribution on the right; wraps on narrow screens. */}
        <div className='border-border/30 mt-12 flex flex-col items-center justify-between gap-x-3 gap-y-2 border-t pt-6 sm:flex-row'>
          <div className='text-muted-foreground/40 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs sm:justify-start'>
            <span>
              &copy; {currentYear} {brandName}.{' '}
              {props.copyright ?? t('footer.defaultCopyright')}
            </span>
            <LegalLinks leadingSeparator />
          </div>
          <ProjectAttribution currentYear={currentYear} brandName={brandName} />
        </div>
      </div>
    </footer>
  )
}
