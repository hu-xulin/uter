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
import type { ComponentProps, ReactNode } from 'react'

import { FormItem } from '@/components/ui/form'
import {
  FormLabelTierProvider,
  useFormLabelTier,
  type FormLabelTier,
} from '@/components/ui/form-label-tier'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

type SettingsFormGridProps = {
  children: ReactNode
  className?: string
}

type SettingsFormGridItemProps = SettingsFormGridProps & {
  /** 兼容旧调用点：单列布局下 `full` 与默认宽度已无区别。 */
  span?: 'default' | 'full'
}

type SettingsSwitchItemProps = ComponentProps<typeof FormItem>
type SettingsSwitchRowProps = ComponentProps<'div'>
type SettingsControlGroupProps = ComponentProps<'div'>
type SettingsControlChildrenProps = ComponentProps<'div'>
type SettingsSwitchFieldProps = SettingsSwitchRowProps & {
  controlId?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
  /**
   * 标题档位。**不传时继承外层容器**（`SettingsForm` / `SettingsControlGroup`
   * 下发 field 16/600，`SettingsControlChildren` 下发 row 14/600）。
   *
   * 只有脱离设置页容器的紧凑场景（渠道弹窗的两列快捷开关）才需要显式传
   * `row`，把标题压回 14/600。
   */
  labelTier?: FormLabelTier
}

/** 无外层设置容器时的兜底档位：开关行本身就是一条配置项，16/600。 */
const ORPHAN_SWITCH_TIER: FormLabelTier = 'field'

const settingsSwitchRowClassName =
  'flex min-w-0 flex-row items-center justify-between gap-4 py-2.5'

/* ── 设置页的字号契约（两层 + 一个值档） ─────────────────────────────
 *
 * 设置页是「名称 + 说明」成对出现的列表结构，两层必须一眼分开：
 *
 *   条目标题    16/600 —— 每个配置项的标题（「启用 Turnstile」「站点密钥」
 *                       「首页」「密码登录」），与 `Heading variant='group-title'`
 *                       同档；分组容器的首行标题也走这一档
 *   子项标题    14/600 —— 分组容器里再缩进一层的子开关（「游乐场」
 *                       「要求登录才能查看模型」），与它上面 16/600 的
 *                       分组标题、下面 14/400 的说明构成三层
 *   说明文字    14/400 —— FormDescription / 手写 <p>
 *
 * 历史问题是各层全挤在 14px，只靠字重区分，整页读起来就是「一堆同号小字」。
 * 这两层靠 280 个调用点自觉守不住，所以在容器层声明一次、由上下文下发给
 * 所有后代（`FormLabelTierProvider`）。新增字段不需要任何额外类名。
 *
 * 值与标题是两回事：URL、域名、密钥、邮箱、ID 这类**机器可读的值**用等宽
 * （`SETTINGS_MONO_VALUE_CLASS`），人读的名称（站点名、发送者名称）不用。
 */

/** 机器可读的值（链接 / 域名 / 密钥 / 邮箱 / 代码 / ID）的等宽类。 */
export const SETTINGS_MONO_VALUE_CLASS = 'font-mono'

const FIELD_LABEL_TIER: FormLabelTier = 'field'
const ROW_LABEL_TIER: FormLabelTier = 'row'

/* 单列纵向排列：设置页的配置项一律「从上往下一行一项」，不再两两并排。
 * 用 flex 列而不是 `grid-cols-1`，是为了让历史遗留的 `col-span-*` 类彻底
 * 失效 —— 在单列网格里 `col-span-2` 会撑出一个隐式列，把并排布局偷偷带回来。 */
const settingsStackClassName = 'flex min-w-0 flex-col gap-6'

export function SettingsFormGrid(props: SettingsFormGridProps) {
  return (
    <FormLabelTierProvider tier={FIELD_LABEL_TIER}>
      {/* `data-settings-form-span='full'` 保留为结构标记：单列布局下它不再
          影响宽度，但仍标识「这一整块是设置项的全宽容器」，布局守卫测试也
          按它确认同一组字段落在同一个容器里。 */}
      <div
        data-settings-form-span='full'
        className={cn(settingsStackClassName, props.className)}
      >
        {props.children}
      </div>
    </FormLabelTierProvider>
  )
}

export function SettingsFormGridItem(props: SettingsFormGridItemProps) {
  return <div className='min-w-0'>{props.children}</div>
}

/**
 * 开关行容器（`FormItem` + 开关）。
 *
 * 不再自己下发档位：标题档位由外层容器决定 —— 直接挂在 `SettingsForm` /
 * `SettingsControlGroup` 下时继承 field（16/600），挂在
 * `SettingsControlChildren` 里时继承 row（14/600）。在这里硬写 row 会把
 * 「游乐场」这类子项之外的普通开关行也压回 14px，正是本轮要修的问题。
 */
export function SettingsSwitchItem({
  className,
  ...props
}: SettingsSwitchItemProps) {
  return (
    <FormItem
      data-settings-form-span='full'
      className={cn(settingsSwitchRowClassName, className)}
      {...props}
    />
  )
}

export function SettingsSwitchRow({
  className,
  ...props
}: SettingsSwitchRowProps) {
  return (
    <div
      data-settings-form-span='full'
      className={cn(settingsSwitchRowClassName, className)}
      {...props}
    />
  )
}

export function SettingsSwitchField({
  controlId,
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  className,
  labelTier,
  ...props
}: SettingsSwitchFieldProps) {
  // 档位优先级：显式 labelTier > 外层容器下发的档位 > 兜底 field。
  // 上下文没被声明时（脱离 SettingsForm 的独立区块）读到的是 'default'，
  // 那是普通表单标签档，用在开关行上会退成 14/500 —— 比说明文字只重一点，
  // 层级就没了。
  const inheritedTier = useFormLabelTier()
  const resolvedTier =
    labelTier ??
    (inheritedTier === 'default' ? ORPHAN_SWITCH_TIER : inheritedTier)

  return (
    <SettingsSwitchRow className={className} {...props}>
      <SettingsSwitchContent>
        {/* 标题档位继承容器：设置页里每一条开关都是「一个配置项」，标题走
            field（16/600），与下方 14/400 的说明拉开差距；分组容器内再缩进
            一层的子项由 SettingsControlChildren 下发 row（14/600）。 */}
        <Label htmlFor={controlId} tier={resolvedTier}>
          {label}
        </Label>
        {description ? (
          <p
            id={controlId ? `${controlId}-description` : undefined}
            className='text-muted-foreground text-sm'
          >
            {description}
          </p>
        ) : null}
      </SettingsSwitchContent>
      <Switch
        id={controlId}
        aria-describedby={
          controlId && description ? `${controlId}-description` : undefined
        }
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </SettingsSwitchRow>
  )
}

export function SettingsSwitchContent(props: SettingsFormGridProps) {
  return (
    <div className={cn('min-w-0 space-y-0.5', props.className)}>
      {props.children}
    </div>
  )
}

/**
 * 带边框的分组容器（「定价」「渠道」「通行密钥域名」）。
 *
 * 层级契约：
 *   - 容器**首行标题**用 `FormLabel` + `field` 档（16/600），与
 *     `<Heading variant='group-title'>` 同档 —— 容器有边框、视觉上就是一张卡。
 *   - 容器**内部**直接挂的开关行同为 field 档（16/600，每个配置项一个标题）；
 *     再缩进一层的子项由 `SettingsControlChildren` 降回 row 档（14/600），
 *     说明一律 14/400。
 *
 * ⚠️ 容器对后代下发的是 **field**，不是 group。这里不能下发 group：组标题
 * 是容器首行的显式档位，而下发 group 会让容器内所有直接写的 `FormLabel`
 * 一起变成 18px，比同样作为行标题的兄弟项大一号。
 */
export function SettingsControlGroup({
  className,
  ...props
}: SettingsControlGroupProps) {
  return (
    <FormLabelTierProvider tier={FIELD_LABEL_TIER}>
      <div
        data-settings-form-span='full'
        className={cn(
          'bg-muted/20 min-w-0 space-y-3 rounded-xl border px-3 py-2.5',
          className
        )}
        {...props}
      />
    </FormLabelTierProvider>
  )
}

/** 分组容器里再缩进一层的内容（「要求登录才能查看…」这类子项）。 */
export function SettingsControlChildren({
  className,
  ...props
}: SettingsControlChildrenProps) {
  return (
    <FormLabelTierProvider tier={ROW_LABEL_TIER}>
      <div
        className={cn('border-border/70 ml-2 min-w-0 border-l pl-3', className)}
        {...props}
      />
    </FormLabelTierProvider>
  )
}

export function SettingsForm({ className, ...props }: ComponentProps<'form'>) {
  return (
    <FormLabelTierProvider tier={FIELD_LABEL_TIER}>
      <form className={cn(settingsStackClassName, className)} {...props} />
    </FormLabelTierProvider>
  )
}
