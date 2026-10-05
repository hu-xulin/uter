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
/**
 * LobeHub Icon Loader
 * Dynamically load and render icons from @lobehub/icons
 *
 * Supports:
 * - Basic: "OpenAI", "OpenAI.Color"
 * - Chained properties: "OpenAI.Avatar.type={'platform'}"
 * - Size parameter: getLobeIcon("OpenAI", 20)
 */
import * as LobeIcons from '@lobehub/icons'
import type React from 'react'

import { IconSub2api } from '@/assets/custom/icon-sub2api'

const CUSTOM_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  Sub2API: IconSub2api,
}

/**
 * Parse a property value from string to appropriate type
 * @param raw - Raw string value
 * @returns Parsed value (boolean, number, or string)
 */
function parseValue(raw: string | undefined | null): string | number | boolean {
  if (raw == null) return true

  let v = String(raw).trim()

  // Remove curly braces
  if (v.startsWith('{') && v.endsWith('}')) {
    v = v.slice(1, -1).trim()
  }

  // Remove quotes
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1)
  }

  // Boolean
  if (v === 'true') return true
  if (v === 'false') return false

  // Number
  if (/^-?\d+(?:\.\d+)?$/.test(v)) return Number(v)

  // Return as string
  return v
}

/**
 * Whether a brand ships the given chained variant (e.g. "Color", "Avatar").
 *
 * @lobehub/icons exposes every brand as a monochrome default component that
 * follows `currentColor`, and attaches the alternative renderings (`.Color`,
 * `.Avatar`, `.Combine`, `.Text`) as properties on it. Custom icons are plain
 * components with no variants.
 */
function iconHasVariant(baseKey: string, variant: string): boolean {
  if (CUSTOM_ICONS[baseKey]) return false
  const entry = (LobeIcons as Record<string, unknown>)[baseKey]
  if (entry == null) return false
  if (typeof entry !== 'object' && typeof entry !== 'function') return false
  return (entry as Record<string, unknown>)[variant] != null
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
 * @returns Icon component or fallback
 *
 * @example
 * getLobeIcon("OpenAI", 24)
 * getLobeIcon("OpenAI.Color", 20)
 * getLobeIcon("Claude.Avatar.type={'platform'}", 32)
 */
export function getLobeIcon(
  iconName: string | undefined | null,
  size: number = 20
): React.ReactNode {
  if (!iconName || typeof iconName !== 'string') {
    return (
      <div
        className='bg-muted text-muted-foreground flex items-center justify-center rounded-full text-xs font-medium'
        style={{ width: size, height: size }}
      >
        ?
      </div>
    )
  }

  const trimmedName = iconName.trim()
  if (!trimmedName) {
    return (
      <div
        className='bg-muted text-muted-foreground flex items-center justify-center rounded-full text-xs font-medium'
        style={{ width: size, height: size }}
      >
        ?
      </div>
    )
  }

  // Parse component path and chained properties
  const segments = trimmedName.split('.')
  const baseKey = segments[0]
  const CustomIcon = CUSTOM_ICONS[baseKey]
  if (CustomIcon) {
    return <CustomIcon size={size} />
  }
  const BaseIcon = (LobeIcons as Record<string, unknown>)[baseKey] as
    | Record<string, unknown>
    | undefined

  let IconComponent: React.ComponentType<Record<string, unknown>> | undefined
  let propStartIndex: number

  if (BaseIcon && segments.length > 1 && BaseIcon[segments[1]]) {
    IconComponent = BaseIcon[segments[1]] as React.ComponentType<
      Record<string, unknown>
    >
    propStartIndex = 2
  } else {
    IconComponent = (LobeIcons as Record<string, unknown>)[baseKey] as
      | React.ComponentType<Record<string, unknown>>
      | undefined
    propStartIndex = segments.length > 1 && /^[A-Z]/.test(segments[1]) ? 2 : 1
  }

  // Fallback if icon not found
  if (
    !IconComponent ||
    (typeof IconComponent !== 'function' && typeof IconComponent !== 'object')
  ) {
    const firstLetter = trimmedName.charAt(0).toUpperCase()
    return (
      <div
        className='bg-muted text-muted-foreground flex items-center justify-center rounded-full text-xs font-medium'
        style={{ width: size, height: size }}
      >
        {firstLetter}
      </div>
    )
  }

  // Parse chained properties (e.g., "type={'platform'}", "shape='square'")
  const props: Record<string, string | number | boolean> = {}

  for (let i = propStartIndex; i < segments.length; i++) {
    const seg = segments[i]
    if (!seg) continue

    const eqIdx = seg.indexOf('=')
    if (eqIdx === -1) {
      props[seg.trim()] = true
      continue
    }

    const key = seg.slice(0, eqIdx).trim()
    const valRaw = seg.slice(eqIdx + 1).trim()
    props[key] = parseValue(valRaw)
  }

  // Set size if not explicitly specified in the string
  if (props.size == null && size != null) {
    props.size = size
  }

  return <IconComponent {...props} />
}

// The selector uses the same installed icon registry as the renderer.
export function getLobeIconNames(): string[] {
  const names = LobeIcons.toc.flatMap((icon) =>
    icon.param.hasColor ? [icon.id, `${icon.id}.Color`] : [icon.id]
  )
  return [...new Set([...names, ...Object.keys(CUSTOM_ICONS)])].sort()
}
