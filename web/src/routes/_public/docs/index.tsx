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
 * Bare `/docs` entry. The docs shell and the framed page are rendered by
 * the layout above (`routes/docs.tsx`), which owns the single iframe for the
 * whole section; this route exists only to give the entry its own URL. That
 * split is what keeps the frame mounted — a viewer rendered here instead
 * would be unmounted the moment the reader opens a page inside the docs, and
 * the reloaded iframe is exactly the "sudden page refresh" being avoided.
 *
 * A bare entry shows the locale landing (特性说明), resolved by `DocsViewer`
 * from the UI language.
 */
export const Route = createFileRoute('/_public/docs/')()
