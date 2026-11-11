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
declare module '*.mdx' {
  import type { ComponentType } from 'react'
  const Component: ComponentType<Record<string, unknown>>
  export default Component
}

declare module '*.md' {
  import type { ComponentType } from 'react'
  const Component: ComponentType<Record<string, unknown>>
  export default Component
}

/**
 * Rsbuild's `import.meta.glob` (Vite-compatible API) — typed narrow enough
 * for the native docs loader, which only consumes the lazy-loader form.
 */
declare interface ImportMeta {
  glob(
    pattern: string,
    options?: { eager?: boolean; import?: string; query?: string }
  ): Record<string, () => Promise<unknown>>
}
