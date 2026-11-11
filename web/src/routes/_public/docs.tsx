/*
Copyright (C) 2023-2026 Uter.ai:

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
import {
  createFileRoute,
  Outlet,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { nativeDocsTarget } from '@/features/docs/native/docs-loader'
import { NativeDocsView } from '@/features/docs/native/native-docs-view'
import { resolveDocsLocaleCode } from '@/lib/docs-link'

/**
 * Layout route for `/docs` — fully native since the docs-web retirement.
 * It renders the docs shell itself (sidebar tree, article, table of
 * contents) and survives every child swap, so the bare entry
 * (`routes/docs/index.tsx`) and the clean `/docs/<lang>/<page>` URL
 * (`routes/docs/$.tsx`) both draw through this component while the shell
 * stays mounted.
 *
 * An unknown splat (a stale link to a removed page, a stray
 * `/docs/legacy/…`) redirects to the locale landing so old URLs keep
 * working instead of 404ing inside the shell.
 */
function DocsRoute() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const docsLocale = resolveDocsLocaleCode(i18n.language)

  const target = nativeDocsTarget(pathname, docsLocale)

  // `nativeDocsTarget` resolves the landing for the bare entry; a splat
  // that names no page (or a locale we do not ship) falls back to it.
  useEffect(() => {
    if (target) return
    navigate({ to: '/docs/$', params: { _splat: docsLocale }, replace: true })
  }, [target, docsLocale, navigate])

  if (!target) return null

  return (
    <>
      <NativeDocsView locale={target.locale} pagePath={target.pagePath} />
      <Outlet />
    </>
  )
}

export const Route = createFileRoute('/_public/docs')({
  component: DocsRoute,
})
