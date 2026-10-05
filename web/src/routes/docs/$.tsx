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

For commercial licensing, please contact support@Uter.ai.com
*/
import { createFileRoute } from '@tanstack/react-router'

import { DocsViewer } from '@/features/docs'

/**
 * Clean docs URL: `/docs/<lang>/<page>` with no query string and no
 * percent-encoding. The splat (everything after `/docs/`) is the host
 * path the iframe's content is derived from; `DocsViewer` turns it into
 * the framed content URL (`/docs-content/docs/<lang>/<page>`) and mirrors
 * any in-frame navigation back here so a reload / shared link reopens the
 * same page.
 */
function DocsSplatRoute() {
  const { _splat } = Route.useParams()
  return <DocsViewer initialHostPath={`/docs/${_splat}`} />
}

export const Route = createFileRoute('/docs/$')({
  component: DocsSplatRoute,
})
