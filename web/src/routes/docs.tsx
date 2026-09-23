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
import { z } from 'zod'

import { DocsViewer } from '@/features/docs'

/**
 * `p` carries the docs page currently shown inside the frame
 * (`/docs/zh/guide/...`). It is written by the framed docs site through
 * `postMessage` and read back on load, so reloading or sharing the URL
 * reopens the same page. Absent on a fresh visit — `DocsViewer` then
 * falls back to the landing page of the active UI locale.
 */
const searchSchema = z.object({
  p: z.string().optional(),
})

function DocsRoute() {
  const { p } = Route.useSearch()
  return <DocsViewer initialPath={p} />
}

export const Route = createFileRoute('/docs')({
  validateSearch: searchSchema,
  component: DocsRoute,
})
