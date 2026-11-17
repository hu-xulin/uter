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
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  channelConfigFields,
  pluginConfigFieldValue,
  pluginConfigNumberText,
  pluginConfigNumberValue,
  setPluginConfigField,
  type PluginConfigObject,
} from '@/features/channels/lib/channel-plugin-config'
import { resolveLocalizedText } from '@/lib/localized-text'

/**
 * Renders the top-level fields of a plugin config schema over config and calls
 * onChange with the updated object. Nested shapes stay in the JSON editor.
 */
export function PluginConfigFields(props: {
  idPrefix: string
  schema: unknown
  config: PluginConfigObject
  onChange: (next: PluginConfigObject) => void
  disabled?: boolean
}) {
  const { i18n } = useTranslation()
  const fields = channelConfigFields(props.schema)
  if (fields.length === 0) return null
  return (
    <div className='flex flex-col gap-3'>
      {fields.map((field) => {
        const value = pluginConfigFieldValue(props.config, field)
        const title =
          resolveLocalizedText(field.title, i18n.language) || field.name
        const description = resolveLocalizedText(
          field.description,
          i18n.language
        )
        const update = (next: unknown) =>
          props.onChange(setPluginConfigField(props.config, field, next))
        let control = null
        if (field.type === 'boolean') {
          control = (
            <Switch
              aria-label={title}
              checked={value === true}
              disabled={props.disabled}
              onCheckedChange={(checked) => update(checked ? true : undefined)}
            />
          )
        } else if (field.enum?.length) {
          control = (
            <Select
              value={value === undefined ? null : String(value)}
              onValueChange={(next) => update(next)}
            >
              <SelectTrigger aria-label={title} disabled={props.disabled}>
                <SelectValue placeholder={title} />
              </SelectTrigger>
              <SelectContent>
                {field.enum.map((option) => (
                  <SelectItem key={String(option)} value={String(option)}>
                    {String(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        } else if (field.type === 'number' || field.type === 'integer') {
          control = (
            <Input
              aria-label={title}
              type='number'
              disabled={props.disabled}
              value={pluginConfigNumberText(value)}
              onChange={(event) =>
                update(pluginConfigNumberValue(event.target.value))
              }
            />
          )
        } else {
          control = (
            <Input
              aria-label={title}
              type={field.format === 'password' ? 'password' : 'text'}
              disabled={props.disabled}
              value={typeof value === 'string' ? value : ''}
              onChange={(event) => update(event.target.value)}
            />
          )
        }
        return (
          <div key={field.name} className='flex flex-col gap-1.5'>
            <Label htmlFor={`${props.idPrefix}-${field.name}`}>{title}</Label>
            {control}
            {description ? (
              <p className='text-muted-foreground text-sm'>{description}</p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
