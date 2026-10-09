/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY, without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
/**
 * LobeHub Icon Loader — synchronous metadata API + lazy renderer entry point.
 *
 * Supports:
 * - Basic: "OpenAI", "OpenAI.Color"
 * - Chained properties: "OpenAI.Avatar.type={'platform'}"
 * - Size parameter: getLobeIcon("OpenAI", 20)
 *
 * Bundle strategy (perf):
 * - The variant metadata (`@lobehub/icons/es/toc.json`, ≈100 KB) is imported
 *   synchronously so `colorIconName` / `monoIconName` / `getLobeIconNames`
 *   stay pure and synchronous (and unit-testable) without pulling the whole
 *   icon set into the first-paint graph.
 * - The actual icon components (~8 MB) are loaded lazily by the async resolver
 *   (`lobe-icon-resolver.tsx`) via a cached dynamic `import('@lobehub/icons')`,
 *   so they land in a separate async chunk fetched in parallel instead of
 *   blocking first paint. `getLobeIcon` renders a lightweight fallback until
 *   the registry arrives.
 */
import toc from '@lobehub/icons/es/toc.json'
import type { ReactNode } from 'react'

import { CUSTOM_ICONS } from './lobe-icon-custom'
import { LobeIconResolver } from './lobe-icon-resolver'

type IconParam = {
  hasColor?: boolean
  hasAvatar?: boolean
  hasCombine?: boolean
  hasText?: boolean
  hasTextCn?: boolean
  hasBrand?: boolean
  hasBrandColor?: boolean
}

type TocEntry = { id: string; param: IconParam }

// Synchronous brand → variant lookup derived from the lightweight toc.json.
// Replaces the previous `LobeIcons[baseKey]` runtime inspection, which forced
// the entire icon set into the bundle.
const tocById = new Map<string, IconParam>()
for (const entry of toc as TocEntry[]) {
  tocById.set(entry.id, entry.param)
}

function variantField(variant: string): keyof IconParam | null {
  if (variant === 'Color') return 'hasColor'
  if (variant === 'Avatar') return 'hasAvatar'
  if (variant === 'Combine') return 'hasCombine'
  if (variant === 'Text') return 'hasText'
  return null
}

/**
 * Whether a brand ships the given chained variant (e.g. "Color", "Avatar").
 */
function iconHasVariant(baseKey: string, variant: string): boolean {
  if (CUSTOM_ICONS[baseKey]) return false
  const param = tocById.get(baseKey)
  if (!param) return false
  const field = variantField(variant)
  if (!field) return false
  return param[field] === true
}

/**
 * Upgrade an icon key to its brand-color rendering.
 *
 * Prefers the `.Color` glyph; brands that only ship an `.Avatar` (brand
 * background + monochrome glyph) fall back to it so every model renders a
 * recognizable colored logo instead of a flat currentColor silhouette. Names
 * that already target a variant, and brands without any variant, are returned
 * untouched.
 */
export function colorIconName(iconName: string): string {
  const segments = iconName
    .trim()
    .split('.')
    .filter((segment) => segment !== '')
  if (segments.length === 0) return ''
  const [baseKey, ...rest] = segments
  // Already a color rendering (brand glyph or brand-background avatar).
  if (rest[0] === 'Color' || rest[0] === 'Avatar') return segments.join('.')
  if (iconHasVariant(baseKey, 'Color')) {
    return [baseKey, 'Color', ...rest].join('.')
  }
  if (iconHasVariant(baseKey, 'Avatar')) {
    return [baseKey, 'Avatar', ...rest].join('.')
  }
  return segments.join('.')
}

/**
 * Downgrade an icon key to its monochrome rendering.
 *
 * Mirrors the backend's `model.NormalizeIconKey`: only a bare "X.Color" key is
 * rewritten to "X", so advanced chain forms such as
 * "Claude.Avatar.type={'platform'}" are never mangled. The result follows
 * `currentColor`, which is what the vendor filter chips want.
 */
export function monoIconName(iconName: string): string {
  const trimmed = iconName.trim()
  const dot = trimmed.indexOf('.')
  if (dot === -1) return trimmed
  const suffix = trimmed.slice(dot + 1).trim()
  if (suffix.toLowerCase() !== 'color') return trimmed
  return trimmed.slice(0, dot).trim()
}

/**
 * Get LobeHub icon component by name
 * @param iconName - Icon name/description (e.g., "OpenAI", "OpenAI.Color", "Claude.Avatar")
 * @param size - Icon size (default: 20)
 * @returns Icon element (falls back to a placeholder until the registry loads)
 *
 * @example
 * getLobeIcon("OpenAI", 24)
 * getLobeIcon("OpenAI.Color", 20)
 * getLobeIcon("Claude.Avatar.type={'platform'}", 32)
 */
export function getLobeIcon(
  iconName: string | undefined | null,
  size: number = 20,
): ReactNode {
  return <LobeIconResolver iconName={iconName ?? ''} size={size} />
}

// The selector uses the same lightweight metadata registry as the renderer.
export function getLobeIconNames(): string[] {
  const names = (toc as TocEntry[]).flatMap((icon) =>
    icon.param.hasColor ? [icon.id, `${icon.id}.Color`] : [icon.id],
  )
  return [...new Set([...names, ...Object.keys(CUSTOM_ICONS)])].sort()
}
