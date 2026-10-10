import { zodResolver } from '@hookform/resolvers/zod'
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
import { HelpCircle } from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { SecretInput } from '@/components/ui/secret-input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { maskSecret } from '@/lib/secret'
import { cn } from '@/lib/utils'

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
import {
  ALL_FIELDS,
  GROUPS,
  leaf,
  type FieldDef,
  type FidelityTier,
} from './cost-optimization-fields'

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

/**
 * 把标记了 secret 的字段替换为掩码串，用于「保存后」展示。
 *
 * 与后端 common.MaskSecretValue 规则一致：前4+ 中间星号（最多 12）+ 后 4。
 * 非密钥字段原样保留（前端不做任何遮蔽），满足「非密钥保存后原样展示」。
 */
function maskSecretFields(values: FlatValues): FlatValues {
  const out: FlatValues = {}
  for (const f of ALL_FIELDS) {
    const raw = values[f.name]
    if (f.secret && typeof raw === 'string' && raw !== '') {
      out[f.name] = maskSecret(raw)
    } else {
      out[f.name] = raw as string | number | boolean
    }
  }
  return out
}

/** 把表单值按字段类型序列化成后端 Options 表期望的字符串。 */
function serialize(field: FieldDef, raw: unknown): string {
  if (field.kind === 'bool') {
    return raw === true || raw === 'true' ? 'true' : 'false'
  }
  if (raw === undefined || raw === null) return ''
  return String(raw)
}

/**
 * 门控是否关闭：布尔 false / 空值视为关，三态模式选择为 'off' 也视为关。
 * 未配置（undefined/空串）时按关处理——与后端「默认 auto、显式 off 才停」一致的前提是
 * 这些 mode 在 ModelSettings 默认值里已给出 'auto'，不会落到空串。
 */
const isGateOff = (v: string | number | boolean | undefined): boolean =>
  v === undefined || v === '' || v === false || v === 'false' || v === 'off'

/**
 * 标签后的「圆圈 + 问号」说明按钮：点击展开该配置项的说明。
 * 说明文案走 i18n（key 即英文原文，见 fields 文件的 help 字段）。
 */
function FieldHelp({ help }: { help: string }) {
  const { t } = useTranslation()
  return (
    <Popover>
      <PopoverTrigger
        // 按钮嵌在 FormLabel 里，点击不能触发表单聚焦/校验冒泡
        onClick={(e: MouseEvent) => e.preventDefault()}
        aria-label={t('Description')}
        className='text-muted-foreground hover:text-foreground ml-1 inline-flex size-4 shrink-0 items-center justify-center align-middle'
      >
        <HelpCircle className='size-3.5' />
      </PopoverTrigger>
      <PopoverContent align='start' className='w-72 text-xs'>
        {t(help)}
      </PopoverContent>
    </Popover>
  )
}

/**
 * 保真分级徽章：标在风险字段标签旁，提示「开了会不会掉质量」（safe / lossy）。
 */
function FidelityBadge({ tier }: { tier: FidelityTier }) {
  const { t } = useTranslation()
  if (tier !== 'lossy') return null
  return (
    <span className='ml-2 inline-flex shrink-0 items-center rounded bg-amber-500/10 px-1.5 py-0.5 align-middle text-xs text-amber-600 dark:text-amber-400'>
      {t('May reduce quality')}
    </span>
  )
}

/** 标签 + 可选说明按钮，供 bool 与普通字段共用。 */
function FieldLabelRow({ def }: { def: FieldDef }) {
  const { t } = useTranslation()
  return (
    <span className='inline-flex items-center'>
      {t(def.label)}
      {/* 已停用项（模型保真）：给出停用原因，避免运营以为是 bug。 */}
      {def.retired && (
        <span className='text-muted-foreground ml-2 text-xs'>
          {t(
            'Retired: cost optimization never swaps the model the customer selected. Cost savings come from token slimming, caching and batching within the same model.'
          )}
        </span>
      )}
      {/* 有损项挂质量徽章。 */}
      {!def.retired && def.fidelity && <FidelityBadge tier={def.fidelity} />}
      {def.help && <FieldHelp help={def.help} />}
    </span>
  )
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
  // 门控既可能是布尔开关（false=关），也可能是三态模式选择（off=关）。
  const gateOff =
    def.gated !== undefined && isGateOff(nestedValues[leaf(def.gated)])
  // 已停用项（模型保真）：无论父开关如何，一律禁用，避免运营误开后无效。
  const inputDisabled = gateOff || def.retired === true

  return (
    <FormField
      control={control}
      name={`costopt_setting.${leaf(def.name)}` as never}
      render={({ field }) => {
        if (def.kind === 'bool') {
          return (
            <SettingsSwitchItem>
              <SettingsSwitchContent>
                <FormLabel>
                  <FieldLabelRow def={def} />
                </FormLabel>
              </SettingsSwitchContent>
              <FormControl>
                <Switch
                  checked={field.value === true || field.value === 'true'}
                  onCheckedChange={field.onChange}
                  disabled={inputDisabled}
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
              disabled={inputDisabled}
            >
              {(def.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.label)}
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
              disabled={inputDisabled}
              placeholder={def.placeholder ?? '[]'}
              className='font-mono text-xs'
            />
          )
        } else if (def.kind === 'number') {
          control = (
            <Input
              autoComplete='off'
              type='number'
              {...safeNumberFieldProps(field)}
              disabled={inputDisabled}
              placeholder={def.placeholder}
            />
          )
        } else if (def.secret) {
          control = (
            <SecretInput
              value={String(field.value ?? '')}
              onChange={field.onChange}
              disabled={inputDisabled}
              placeholder={def.placeholder}
            />
          )
        } else {
          control = (
            <Input
              autoComplete='off'
              value={String(field.value ?? '')}
              onChange={field.onChange}
              disabled={inputDisabled}
              placeholder={def.placeholder}
            />
          )
        }

        return (
          <FormItem className='max-w-xl'>
            <FormLabel>
              <FieldLabelRow def={def} />
            </FormLabel>
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

  // 支付网关风格：把降本分类水平排列成可切换的卡片，避免长列表堆叠。
  const [activeGroup, setActiveGroup] = useState(0)
  const activeGroupData = GROUPS[activeGroup]

  const onSubmit = async (submitted: FormValues) => {
    const normalized = normalizeFormValues(submitted)
    const changedKeys = Object.keys(normalized).filter((key) => {
      const def = ALL_FIELDS.find((f) => f.name === key)
      if (!def) return false
      return (
        serialize(def, normalized[key]) !==
        serialize(def, baselineRef.current[key])
      )
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
    // 保存后把表单重置为「后端将回读到的形态」：密钥字段用掩码串占位，
    // 这样输入框立即呈现「前四位+后四位」而不是刚输入的明文。
    // 再次保存时后端会识别掩码串并保留原密钥，不会被覆盖。
    form.reset(buildFormDefaults(maskSecretFields(nextBaseline)))
  }

  return (
    <SettingsSection title={t('Cost Optimization')}>
      <p className='text-muted-foreground text-sm'>
        {t(
          'Savings never come from swapping the model a customer selected — that model is what they are paying for. Groups are ordered by where the money comes from: reuse an earlier answer, pay less for the same model, fetch knowledge instead of resending it, then the guardrails that keep all three under control.'
        )}
      </p>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />
          {/* 分类水平排列：支付网关风格的横向可切换卡片 */}
          <div className='flex gap-2 overflow-x-auto pb-2'>
            {GROUPS.map((group, idx) => {
              const active = idx === activeGroup
              // 分组卡片标出组内最低保真档（有损优先），让整组风险在切换前可见。
              // 已停用项不参与评级——它们的风险是"无效"，不是"掉质量"。
              const live = group.fields.filter((f) => !f.retired)
              const hasLossy = live.some((f) => f.fidelity === 'lossy')
              return (
                <button
                  type='button'
                  key={group.title}
                  onClick={() => setActiveGroup(idx)}
                  aria-pressed={active}
                  className={cn(
                    'flex min-w-[150px] flex-1 shrink-0 flex-col gap-1.5 rounded-lg border px-3 py-2 text-left transition-colors',
                    active
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-background hover:bg-muted/50'
                  )}
                >
                  <span
                    className={cn(
                      'text-sm font-medium leading-tight',
                      active ? 'text-primary' : 'text-foreground'
                    )}
                  >
                    {t(group.title)}
                  </span>
                  <span className='flex flex-wrap items-center gap-1.5'>
                    <span className='bg-muted text-muted-foreground inline-flex h-5 w-fit min-w-5 items-center justify-center rounded-full px-1.5 text-xs tabular-nums'>
                      {group.fields.length}
                    </span>
                    {hasLossy && (
                      <span className='inline-flex items-center rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-600 dark:text-amber-400'>
                        {t('Lossy')}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
          <p className='text-muted-foreground mt-2 text-sm'>
            {t(activeGroupData.desc)}
          </p>
          <div className='space-y-4'>
            {activeGroupData.fields.map((def) => (
              <OptimizationField
                key={def.name}
                field={def}
                control={form.control}
                values={values}
              />
            ))}
          </div>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
