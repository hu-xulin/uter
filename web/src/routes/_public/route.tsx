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

For commercial licensing, please contact support@uter.ai
*/
import { createFileRoute, Outlet } from '@tanstack/react-router'

import { PublicHeader } from '@/components/layout'

/**
 * Layout route for every public page (home, docs, about, pricing, rankings,
 * the legal documents).
 *
 * It owns the public header — and *only* the header — so that the header
 * survives a move between public pages. Rendering the header inside each
 * page's `PublicLayout` instead would unmount and remount the whole tree on
 * every navigation: the notification popover, the language and theme
 * switchers, the profile dropdown and the sign-in dialog would all be torn
 * down and rebuilt, which both costs ~70 ms of main-thread work per click and
 * leaks their subscriptions and global listeners. After enough navigations the
 * accumulated work is what makes the tab stop responding entirely.
 *
 * One instance here stays mounted for as long as the reader stays in the
 * public area, so a nav click only swaps the page body underneath it.
 */
function PublicAreaLayout() {
  return (
    <>
      <PublicHeader />
      <Outlet />
    </>
  )
}

export const Route = createFileRoute('/_public')({
  component: PublicAreaLayout,
})
