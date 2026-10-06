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
import { createFileRoute } from '@tanstack/react-router'

import { DocsViewer } from '@/features/docs'

/**
 * Bare `/docs` entry. Opens the docs on 特性说明 (see `docsLandingPathFor`);
 * the actual page is resolved by `DocsViewer` from the UI locale. Once the
 * reader navigates inside the frame, the `/docs/$` splat route
 * (`routes/docs/$.tsx`) takes over and mirrors the in-frame page into the
 * address bar, so a reload or a shared link reopens the same page.
 */
function DocsIndexRoute() {
  return <DocsViewer />
}

export const Route = createFileRoute('/docs/')({
  component: DocsIndexRoute,
})
