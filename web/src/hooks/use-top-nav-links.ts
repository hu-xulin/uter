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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'
import { isBundledDocsHref, resolveDocsHref } from '@/lib/docs-link'
import { parseHeaderNavModulesFromStatus } from '@/lib/nav-modules'
import { useAuthStore } from '@/stores/auth-store'

export type TopNavLink = {
  title: string
  href: string
  disabled?: boolean
  requiresAuth?: boolean
  /** Rendered as a plain anchor: the target is not an SPA route. */
  external?: boolean
}

/**
 * Generate top navigation links based on HeaderNavModules configuration from backend /api/status
 * Backend format example (stringified JSON):
 * {
 *   home: true,
 *   console: true,
 *   pricing: { enabled: true, requireAuth: false },
 *   rankings: { enabled: true, requireAuth: false },
 *   docs: true,
 *   about: true
 * }
 */
export function useTopNavLinks(): TopNavLink[] {
  const { t } = useTranslation()
  const { status } = useStatus()
  const { auth } = useAuthStore()

  // Parse HeaderNavModules
  const modules = useMemo(() => {
    return parseHeaderNavModulesFromStatus(
      status as Record<string, unknown> | null
    )
  }, [status])

  // Admins may point `docs_link` at an external knowledge base. When
  // unset, `resolveDocsHref` returns `/docs` — the SPA's locale-free
  // entry — and the SPA's `/docs` route renders the bundled docs export
  // inside the app shell, picking the locale-matching landing
  // (`/docs/zh/` for Chinese locales, `/docs/en/` for the rest) from
  // the user's current UI language.
  const docsLink = resolveDocsHref(status?.docs_link)

  const isAuthed = !!auth?.user

  const links: TopNavLink[] = []

  // Home
  if (modules?.home !== false) {
    links.push({ title: t('Home'), href: '/' })
  }

  // Console -> /dashboard (new console path)
  if (modules?.console !== false) {
    links.push({ title: t('Console'), href: '/dashboard' })
  }

  // Pricing
  const pricing = modules?.pricing
  if (pricing && typeof pricing === 'object' && pricing.enabled) {
    const requiresAuth = pricing.requireAuth && !isAuthed
    links.push({ title: t('Model Square'), href: '/pricing', requiresAuth })
  }

  // Rankings
  const rankings = modules?.rankings
  if (rankings && typeof rankings === 'object' && rankings.enabled) {
    const requiresAuth = rankings.requireAuth && !isAuthed
    links.push({ title: t('Rankings'), href: '/rankings', requiresAuth })
  }

  // The bundled entry (`/docs`) is an SPA route that frames the docs
  // export inside the app shell, so it renders as a router link and the
  // page never leaves the SPA. A configured `docs_link` is not ours to
  // route — it is usually an external knowledge base — so it keeps the
  // plain-anchor render path and leaves the app.
  if (modules?.docs !== false) {
    links.push({
      title: t('Docs'),
      href: docsLink,
      external: !isBundledDocsHref(docsLink),
    })
  }

  // About
  if (modules?.about !== false) {
    links.push({ title: t('About'), href: '/about' })
  }

  return links
}
