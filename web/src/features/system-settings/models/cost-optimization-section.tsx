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
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useForm, type Control } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Form,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import { safeNumberFieldProps } from '../utils/numeric-field'

/**
 * 降本优化（Cost Optimization）
 *
 * 承载《Uter 技术降本全景方案 V2》中标记为「🟡 基础设施具备或仅部分覆盖」的项。
 * 这些项的共性缺口是：缺上游参数或策略开关。参数在后台填齐后，后端钩子即由
 * no-op 升级为完整能力；留空则维持优雅降级，不影响主链路。
 *
 * 全部字段以 `costopt_setting.` 前缀写入 Options 表，与后端
 * `setting/costopt/config.go` 的 json tag 一一对应。
 */

import { ALL_FIELDS, GROUPS, leaf, type FieldDef } from './cost-optimization-fields'

// zod schema：所有标量统一按 string 收集，提交时再按 kind 归一化，
// 避免 number/bool 的空值让整份表单无法提交。
const buildSchema = () => {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const f of ALL_FIELDS) {
    shape[leaf(f.name)] = z.union([z.string(), z.number(), z.boolean()])
  }
  return z.object({ costopt_setting: z.object(shape) })
}

const optimizationSchema = buildSchema()
type FormValues = z.infer<typeof optimizationSchema>
type FlatValues = Record<string, string | number | boolean>

const buildFormDefaults = (defaults: FlatValues): FormValues => {
  const nested: Record<string, string | number | boolean> = {}
  for (const f of ALL_FIELDS) {
    nested[leaf(f.name)] = defaults[f.name] ?? ''
  }
  return { costopt_setting: nested }
}

const normalizeFormValues = (values: FormValues): FlatValues => {
  // schema 由动态 shape 构建，TS 推断退化为 unknown，这里显式收窄。
  const nested = values.costopt_setting as Record<
    string,
    string | number | boolean
  >
  const flat: FlatValues = {}
  for (const f of ALL_FIELDS) {
    flat[f.name] = nested[leaf(f.name)]
  }
  return flat
}

interface Props {
  defaultValues: FlatValues
}

/** 把表单值按字段类型序列化成后端 Options 表期望的字符串。 */
function serialize(field: FieldDef, raw: unknown): string {
  if (field.kind === 'bool') return raw === true || raw === 'true' ? 'true' : 'false'
  if (raw === undefined || raw === null) return ''
  return String(raw)
}

function OptimizationField(props: {
  field: FieldDef
  control: Control<FormValues>
  values: FormValues
}) {
  const { field: def, control, values } = props
  const { t } = useTranslation()

  const nestedValues = values.costopt_setting as Record<
    string,
    string | number | boolean
  >
  const gateOn =
    def.gated === undefined ||
    nestedValues[leaf(def.gated)] === true ||
    nestedValues[leaf(def.gated)] === 'true'
  const gateOff = !gateOn

  return (
    <FormField
      control={control}
      name={`costopt_setting.${leaf(def.name)}` as never}
      render={({ field }) => {
        if (def.kind === 'bool') {
          return (
            <SettingsSwitchItem>
              <SettingsSwitchContent>
                <FormLabel>{t(def.label)}</FormLabel>
              </SettingsSwitchContent>
              <FormControl>
                <Switch
                  checked={field.value === true || field.value === 'true'}
                  onCheckedChange={field.onChange}
                  disabled={gateOff}
                />
              </FormControl>
            </SettingsSwitchItem>
          )
        }

        let control: ReactNode = null
        if (def.kind === 'select') {
          control = (
            <NativeSelect
              value={String(field.value ?? '')}
              onChange={(e) => field.onChange(e.target.value)}
              disabled={gateOff}
            >
              {(def.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          )
        } else if (def.kind === 'json') {
          control = (
            <Textarea
              rows={3}
              value={String(field.value ?? '')}
              onChange={field.onChange}
              disabled={gateOff}
              placeholder='[]'
              className='font-mono text-xs'
            />
          )
        } else if (def.kind === 'number') {
          control = (
            <Input
              type='number'
              {...safeNumberFieldProps(field)}
              disabled={gateOff}
            />
          )
        } else {
          control = (
            <Input
              value={String(field.value ?? '')}
              onChange={field.onChange}
              disabled={gateOff}
            />
          )
        }

        return (
          <FormItem className='max-w-xl'>
            <FormLabel>{t(def.label)}</FormLabel>
            <FormControl>{control}</FormControl>
            {def.kind === 'json' && (
              <FormDescription>{t('JSON array or object')}</FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

export function CostOptimizationSection(props: Props) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const formDefaults = useMemo(
    () => buildFormDefaults(props.defaultValues),
    [props.defaultValues]
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(optimizationSchema),
    defaultValues: formDefaults,
  })

  const baselineRef = useRef<FlatValues>(props.defaultValues)
  const baselineSerializedRef = useRef<string>(
    JSON.stringify(props.defaultValues)
  )

  useEffect(() => {
    const serialized = JSON.stringify(props.defaultValues)
    if (serialized === baselineSerializedRef.current) return
    baselineRef.current = props.defaultValues
    baselineSerializedRef.current = serialized
    form.reset(buildFormDefaults(props.defaultValues))
  }, [props.defaultValues, form])

  const values = form.watch()

  const onSubmit = async (submitted: FormValues) => {
    const normalized = normalizeFormValues(submitted)
    const changedKeys = Object.keys(normalized).filter((key) => {
      const def = ALL_FIELDS.find((f) => f.name === key)
      if (!def) return false
      return serialize(def, normalized[key]) !== serialize(def, baselineRef.current[key])
    })

    if (changedKeys.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const key of changedKeys) {
      const def = ALL_FIELDS.find((f) => f.name === key)
      if (!def) continue
      await updateOption.mutateAsync({
        key,
        value: serialize(def, normalized[key]),
      })
    }

    const nextBaseline: FlatValues = { ...baselineRef.current }
    for (const key of changedKeys) {
      const def = ALL_FIELDS.find((f) => f.name === key)
      if (def) nextBaseline[key] = serialize(def, normalized[key])
    }
    baselineRef.current = nextBaseline
    baselineSerializedRef.current = JSON.stringify(nextBaseline)
  }

  return (
    <SettingsSection title={t('Cost Optimization')}>
      <p className='text-muted-foreground text-xs'>
        {t(
          'Upstream parameters for cost optimization features that are only partially covered. Fill these in to activate the corresponding capability; leaving them empty keeps the gateway running unchanged.'
        )}
      </p>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />
          {GROUPS.map((group) => (
            <div key={group.title} className='space-y-3'>
              <div className='space-y-1'>
                <h3 className='text-sm font-semibold'>{t(group.title)}</h3>
                <p className='text-muted-foreground text-xs'>
                  {t(group.desc)}
                </p>
              </div>
              <div className='space-y-4'>
                {group.fields.map((def) => (
                  <OptimizationField
                    key={def.name}
                    field={def}
                    control={form.control}
                    values={values}
                  />
                ))}
              </div>
            </div>
          ))}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
