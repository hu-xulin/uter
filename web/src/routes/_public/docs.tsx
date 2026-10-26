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
import { createFileRoute, Outlet } from '@tanstack/react-router'

import { DocsViewer } from '@/features/docs'

/**
 * Layout route for `/docs`. It owns the docs shell — and deliberately
 * renders {@link DocsViewer} *here*, in the layout that survives every
 * child swap, rather than in the two children below.
 *
 * The bare entry (`routes/docs/index.tsx`) and the clean `/docs/<lang>/<page>`
 * URL (`routes/docs/$.tsx`) are **sibling** routes, so a viewer rendered by
 * either of them is unmounted and remounted as soon as the reader moves
 * between `/docs` and a page inside it — and a remounted `<iframe>` reloads
 * its document, which is the "sudden page refresh" that made clicking a
 * sidebar section feel like it threw the page away. One frame in the layout
 * stays mounted across the whole docs section, and reads the page it should
 * show from the location (`DocsViewer` uses `useRouterState`), so the
 * children only have to exist to own the URL.
 *
 * Rendering `<Outlet/>` is also what makes the `/docs/$` child route mount
 * at all; without it the child never renders and the address bar can never be
 * re-pointed at the page the reader navigated to.
 */
function DocsRoute() {
  return (
    <>
      <DocsViewer />
      <Outlet />
    </>
  )
}

export const Route = createFileRoute('/_public/docs')({
  component: DocsRoute,
})
