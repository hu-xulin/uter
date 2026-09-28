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
import { Link } from '@tanstack/react-router'
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

// Renders User Agreement / Privacy Policy / Recharge Agreement links inline
// with the parent's copyright row when they are configured in System
// Settings → Site. Emits fragmented siblings so the parent flex container's
// gap controls spacing.
//
// The links point at the bundled docs site — `/docs/<locale>/legal/<doc>/` —
// rather than at the SPA routes that frame it. Those are the real,
// statically-exported pages: a crawler or anyone the reader shares the link
// with gets a page that resolves on its own, on the same domain, in the
// language the reader had selected. The SPA routes stay reachable (they are
// what the sign-up consent links to) but they are a client-rendered shell, so
// they are the wrong thing to hand outward.
//
// When an admin repoints `docs_link` at an external knowledge base there is no
// bundled page to link to and the SPA routes fall back to the configured text,
// so the footer follows them there instead of sending the reader into a docs
// page that is no longer ours.
function LegalLinks(props: { leadingSeparator?: boolean }) {
  const { t, i18n } = useTranslation()
  const { status } = useStatus()
  const docsLocale = resolveDocsLocaleCode(i18n.language)
  const useDocsPages = isBundledDocsHref(resolveDocsHref(status?.docs_link))
  const items: { key: string; label: string; href: string }[] = []
  if (status?.user_agreement_enabled) {
    items.push({
      key: 'user-agreement',
      label: t('User Agreement'),
      href: legalPageHref('user-agreement', useDocsPages, docsLocale),
    })
  }
  if (status?.privacy_policy_enabled) {
    items.push({
      key: 'privacy-policy',
      label: t('Privacy Policy'),
      href: legalPageHref('privacy-policy', useDocsPages, docsLocale),
    })
  }
  if (status?.recharge_agreement_enabled) {
    items.push({
      key: 'recharge-agreement',
      label: t('Recharge Agreement'),
      href: legalPageHref('recharge-agreement', useDocsPages, docsLocale),
    })
  }
  if (items.length === 0) {
    return null
  }
  return (
    <>
      {items.map((item, index) => (
        <Fragment key={item.key}>
          {(props.leadingSeparator || index > 0) && (
            <span aria-hidden='true' className='text-muted-foreground/30'>
              ·
            </span>
          )}
          <a
            href={item.href}
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
 * Destination of one legal link: the docs page for the current locale, or the
 * SPA route when the bundled docs site is not the configured docs target.
 */
function legalPageHref(
  docId: string,
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
              <span className='font-brand text-sm tracking-tight'>
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
