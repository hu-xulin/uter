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
import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { DocsViewer } from '@/features/docs'
import { nativeDocsTarget } from '@/features/docs/native/docs-loader'
import { NativeDocsView } from '@/features/docs/native/native-docs-view'
import { resolveDocsLocaleCode } from '@/lib/docs-link'

/**
 * Layout route for `/docs`. It owns the docs shell — and deliberately
 * renders the viewer *here*, in the layout that survives every child
 * swap, rather than in the two children below.
 *
 * During the Path 2 convergence this layout serves **two renderers**:
 *
 * - `NativeDocsView` — an in-shell MDX page (no iframe) when the
 *   requested page has been migrated into `web/src/docs-content/`;
 * - `DocsViewer` — the framed Next.js export, for every page that has
 *   not migrated yet.
 *
 * The fallback keeps the whole documentation reachable while the
 * migration proceeds set by set; once every page renders natively the
 * iframe branch and `docs-web` are retired together.
 *
 * The bare entry (`routes/docs/index.tsx`) and the clean `/docs/<lang>/<page>`
 * URL (`routes/docs/$.tsx`) are **sibling** routes, so the viewer rendered
 * here must read the current page from the location — the one place that
 * always names it — exactly like the iframe viewer does.
 */
function DocsRoute() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { i18n } = useTranslation()

  const target = nativeDocsTarget(
    pathname,
    resolveDocsLocaleCode(i18n.language)
  )

  return (
    <>
      {target ? (
        <NativeDocsView locale={target.locale} pagePath={target.pagePath} />
      ) : (
        <DocsViewer />
      )}
      <Outlet />
    </>
  )
}

export const Route = createFileRoute('/_public/docs')({
  component: DocsRoute,
})
