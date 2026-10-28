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

/**
 * Clean docs URL: `/docs/<lang>/<page>` with no query string and no
 * percent-encoding. The splat (everything after `/docs/`) names the host page
 * the iframe's content is derived from — `/docs-content/docs/<lang>/<page>` —
 * so a reload or a shared link reopens the same page.
 *
 * Like the bare entry beside it, this route renders nothing: the shell and
 * the single frame belong to the layout (`routes/docs.tsx`), which stays
 * mounted when the reader moves between `/docs` and a page inside it. The
 * frame reads the page to show from the location, so all this route has to
 * do is give the page its own URL.
 */
export const Route = createFileRoute('/_public/docs/$')()
