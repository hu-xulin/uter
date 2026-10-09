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
 * Async LobeHub icon resolver.
 *
 * This module is a *component-only* module (it exports only React components)
 * so it satisfies react-refresh's `only-export-components` rule. The heavy
 * `@lobehub/icons` component set is fetched lazily via a single cached dynamic
 * `import()`, landing in its own async chunk instead of blocking first paint.
 */
import { useEffect, useState, type ComponentType, type ReactNode } from 'react'

import { CUSTOM_ICONS } from './lobe-icon-custom'

type LobeIconsModule = typeof import('@lobehub/icons')

// Cached promise: the heavy component set is fetched once, on first use, into
// its own async chunk.
let registryPromise: Promise<LobeIconsModule> | null = null
function loadRegistry(): Promise<LobeIconsModule> {
  if (!registryPromise) {
    registryPromise = import('@lobehub/icons')
  }
  return registryPromise
}

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

export function Fallback({ size, letter }: { size: number; letter: string }) {
  return (
    <div
      className='bg-muted text-muted-foreground flex items-center justify-center rounded-full text-xs font-medium'
      style={{ width: size, height: size }}
    >
      {letter}
    </div>
  )
}

/**
 * Resolves and renders a LobeHub icon by name. Until the icon registry has
 * loaded (a single cached dynamic import), it renders a lightweight fallback
 * so first paint is never blocked by the ~8 MB icon set.
 */
export function LobeIconResolver({
  iconName,
  size = 20,
}: {
  iconName: string
  size?: number
}): ReactNode {
  const [registry, setRegistry] = useState<LobeIconsModule | null>(null)

  useEffect(() => {
    let alive = true
    loadRegistry()
      .then((r) => {
        if (alive) setRegistry(r)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  if (!iconName || typeof iconName !== 'string') {
    return <Fallback size={size} letter='?' />
  }

  const trimmedName = iconName.trim()
  if (!trimmedName) {
    return <Fallback size={size} letter='?' />
  }

  // Parse component path and chained properties
  const segments = trimmedName.split('.')
  const baseKey = segments[0]
  const CustomIcon = CUSTOM_ICONS[baseKey]
  if (CustomIcon) {
    return <CustomIcon size={size} />
  }

  // Before the registry arrives, show a neutral placeholder (first letter).
  if (!registry) {
    return <Fallback size={size} letter={trimmedName.charAt(0).toUpperCase()} />
  }

  const reg = registry as unknown as Record<string, unknown>
  const BaseIcon = reg[baseKey] as Record<string, unknown> | undefined

  let IconComponent: ComponentType<Record<string, unknown>> | undefined
  let propStartIndex: number

  if (BaseIcon && segments.length > 1 && BaseIcon[segments[1]]) {
    IconComponent = BaseIcon[segments[1]] as ComponentType<
      Record<string, unknown>
    >
    propStartIndex = 2
  } else {
    IconComponent = reg[baseKey] as
      | ComponentType<Record<string, unknown>>
      | undefined
    propStartIndex = segments.length > 1 && /^[A-Z]/.test(segments[1]) ? 2 : 1
  }

  // Fallback if icon not found
  if (
    !IconComponent ||
    (typeof IconComponent !== 'function' && typeof IconComponent !== 'object')
  ) {
    return (
      <Fallback size={size} letter={trimmedName.charAt(0).toUpperCase()} />
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
