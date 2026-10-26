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
import type { TopNavLink } from '../types'

/**
 * Page shell for a public page. It owns the page body only.
 *
 * The public header is **not** rendered here: it lives on the `/_public`
 * layout route (`src/routes/_public/route.tsx`), so it stays mounted while the
 * reader moves between public pages. Rendering it per page would remount the
 * whole header tree on every navigation.
 *
 * The header-related props are kept so callers keep compiling, but they are
 * accepted and ignored — no public page passes them today.
 */
type PublicLayoutProps = {
  children: React.ReactNode
  showMainContainer?: boolean
  /** @deprecated the header is owned by the `/_public` layout route */
  navContent?: React.ReactNode
  /** @deprecated the header is owned by the `/_public` layout route */
  headerProps?: Record<string, unknown>
  /** @deprecated the header is owned by the `/_public` layout route */
  navLinks?: TopNavLink[]
  /** @deprecated the header is owned by the `/_public` layout route */
  showThemeSwitch?: boolean
  /** @deprecated the header is owned by the `/_public` layout route */
  showAuthButtons?: boolean
  /** @deprecated the header is owned by the `/_public` layout route */
  showNotifications?: boolean
  /** @deprecated the header is owned by the `/_public` layout route */
  logo?: React.ReactNode
  /** @deprecated the header is owned by the `/_public` layout route */
  siteName?: string
}

export function PublicLayout(props: PublicLayoutProps) {
  return (
    <div className='bg-background text-foreground relative min-h-svh overflow-x-clip'>
      {props.showMainContainer !== false ? (
        <main className='container px-4 py-6 pt-20 md:px-4'>
          {props.children}
        </main>
      ) : (
        props.children
      )}
    </div>
  )
}
