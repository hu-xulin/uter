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
type LocalizedText = Record<string, string> | string | null | undefined

export type ChannelConfigField = {
  name: string
  type: 'string' | 'number' | 'integer' | 'boolean'
  title?: LocalizedText
  description?: LocalizedText
  format?: string
  enum?: Array<string | number>
  defaultValue?: unknown
}

type SchemaProperty = {
  type?: unknown
  title?: unknown
  description?: unknown
  format?: unknown
  enum?: unknown
  default?: unknown
}

/**
 * The top-level fields of a plugin's channelConfig schema the form renders.
 * Nested objects and arrays stay in the JSON editor: their shape is the
 * plugin's own, and a generic form would misrepresent it.
 */
export function channelConfigFields(schema: unknown): ChannelConfigField[] {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return []
  const properties = (schema as { properties?: unknown }).properties
  if (
    !properties ||
    typeof properties !== 'object' ||
    Array.isArray(properties)
  ) {
    return []
  }
  const fields: ChannelConfigField[] = []
  for (const [name, raw] of Object.entries(
    properties as Record<string, SchemaProperty>
  )) {
    if (!raw || typeof raw !== 'object') continue
    const type =
      raw.type === 'string' ||
      raw.type === 'number' ||
      raw.type === 'integer' ||
      raw.type === 'boolean'
        ? raw.type
        : null
    if (!type) continue
    const field: ChannelConfigField = { name, type }
    field.title = readLocalized(raw.title)
    field.description = readLocalized(raw.description)
    if (typeof raw.format === 'string') field.format = raw.format
    if (Array.isArray(raw.enum)) {
      field.enum = raw.enum.filter(
        (item): item is string | number =>
          typeof item === 'string' || typeof item === 'number'
      )
    }
    if (raw.default !== undefined) field.defaultValue = raw.default
    fields.push(field)
  }
  return fields
}

function readLocalized(value: unknown): LocalizedText {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const texts: Record<string, string> = {}
  for (const [locale, text] of Object.entries(value)) {
    if (typeof text === 'string' && text.trim()) texts[locale] = text
  }
  return Object.keys(texts).length > 0 ? texts : null
}

export type PluginConfigObject = Record<string, unknown>

/** Parses the JSON editor text; null while it is not a JSON object. */
export function parsePluginConfigObject(
  text: string
): PluginConfigObject | null {
  const trimmed = text.trim()
  if (!trimmed) return {}
  try {
    const value: unknown = JSON.parse(trimmed)
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as PluginConfigObject
    }
    return null
  } catch {
    return null
  }
}

/** The field's value as the form shows it: the saved value, else its default. */
export function pluginConfigFieldValue(
  config: PluginConfigObject,
  field: ChannelConfigField
): unknown {
  if (Object.hasOwn(config, field.name)) return config[field.name]
  return field.defaultValue
}

/**
 * Returns config with field set to value, or removed when value is undefined
 * (a boolean switch cleared to the default, an emptied optional number).
 */
export function setPluginConfigField(
  config: PluginConfigObject,
  field: ChannelConfigField,
  value: unknown
): PluginConfigObject {
  const next: PluginConfigObject = { ...config }
  if (value === undefined) {
    delete next[field.name]
    return next
  }
  next[field.name] = value
  return next
}

/** Text a number field shows for value; empty when it has none. */
export function pluginConfigNumberText(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && value.trim()) return value
  return ''
}

/** The number an input holds, undefined when it is empty or not a number. */
export function pluginConfigNumberValue(text: string): number | undefined {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : undefined
}
