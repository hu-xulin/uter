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

/**
 * Layout route for `/docs`. It owns the docs shell but renders no content
 * of its own — the bare entry (`routes/docs/index.tsx`) and the clean
 * `/docs/<lang>/<page>` URL (`routes/docs/$.tsx`) provide the page through
 * this outlet.
 *
 * Rendering `<Outlet/>` (instead of `<DocsViewer/>` directly) is what makes
 * the `/docs/$` child route mount. Without it the child never renders, so
 * `DocsViewer`'s `initialHostPath` stays `undefined` and the address bar can
 * never be re-pointed at the page the reader actually navigated to — see
 * `features/docs/docs-viewer.tsx`.
 */
function DocsRoute() {
  return <Outlet />
}

export const Route = createFileRoute('/docs')({
  component: DocsRoute,
})
