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
import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Clerk-style previous/next cards under the article body.
 *
 * Only the *visual* shell lives here. The caller supplies the two card
 * elements so the docs tree and the About tree can use their own typed
 * `<Link>` targets without a union of router options leaking into this
 * shared component.
 *
 * §5 assigns cards `rounded-lg` (12px); §15.1 fixes the focus ring at 2px.
 * Navigation selected state uses `text-sidebar-active-foreground`, never
 * `text-primary` (§2.3, contrast).
 */
export const PAGE_NAV_CARD_CLASS =
  'focus-visible:ring-ring hover:bg-muted group flex min-w-0 flex-col gap-1 rounded-lg border p-4 no-underline transition-colors outline-none focus-visible:ring-2'

export function PageNavCardContent({
  direction,
  title,
}: {
  direction: 'previous' | 'next'
  title: string
}) {
  const { t } = useTranslation()
  const isPrevious = direction === 'previous'
  return (
    <>
      <span className='text-dense text-fg-secondary flex items-center gap-1.5'>
        {isPrevious ? (
          <ArrowLeft className='size-4.5 shrink-0 transition-transform group-hover:-translate-x-0.5' />
        ) : null}
        {isPrevious ? t('Previous page') : t('Next page')}
        {isPrevious ? null : (
          <ArrowRight className='size-4.5 shrink-0 transition-transform group-hover:translate-x-0.5' />
        )}
      </span>
      <span className='text-md text-fg-primary truncate font-medium'>
        {title}
      </span>
    </>
  )
}

export function PageNav({
  previous,
  next,
}: {
  previous?: ReactNode
  next?: ReactNode
}) {
  const { t } = useTranslation()
  if (!previous && !next) return null
  return (
    <nav
      aria-label={t('Page navigation')}
      className='border-border mt-16 grid gap-3 border-t pt-6 sm:grid-cols-2'
    >
      {previous ?? <span />}
      {next ?? <span />}
    </nav>
  )
}
