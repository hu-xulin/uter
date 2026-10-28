/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { SecretInput } from '@/components/ui/secret-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { isMaskedSecret } from '@/lib/secret'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import { ChannelSyncModelsTable } from './channel-sync-models-table'

/**
 * 渠道登录与同步（Channel Login & Sync）
 *
 * 用途：登录上游渠道（如创梦 DreamRouter），按每天固定时刻拉取该渠道的
 * 模型清单与折扣价，再按「价格规则」换算成 uter 的售价并写入倍率表。
 *
 * 价格规则（对应后端 dreamRouterRuleFactor）：
 *   - increase（加价）：uter 价 = 官方基准价 × (上游折扣 r + 幅度)
 *   - decrease（降价）：uter 价 = 官方基准价 × (上游折扣 r − 幅度)
 * 幅度以「折」为单位（0.1 = 1 折）。降价幅度若超过上游折扣本身，算出的价格
 * 非正，后端会跳过该模型不改价并记录告警。
 *
 * 口令是 secret option：后端 GET /api/option/ 以掩码串下发，浏览器永远拿不到
 * 明文；提交时掩码串会被跳过（保留库中原值），所以留空即「不修改」。
 */

const schema = z.object({
  DreamRouterSyncEnabled: z.boolean(),
  DreamRouterSyncProvider: z.string(),
  DreamRouterSyncChannelID: z.string(),
  DreamRouterSyncUsername: z.string(),
  DreamRouterSyncPassword: z.string(),
  DreamRouterSyncHour: z.string(),
  DreamRouterSyncRuleDirection: z.string(),
  DreamRouterSyncRuleAmount: z.string(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  defaultValues: Partial<
    Record<keyof FormValues, string | number | boolean | undefined>
  >
}

const asBool = (v: unknown): boolean => v === true || v === 'true'
const asText = (v: unknown): string =>
  v === undefined || v === null ? '' : String(v)

/** 上游渠道清单。与后端 service 的 provider 常量一一对应。 */
const PROVIDER_OPTIONS = [
  { value: 'dreamrouter', labelKey: 'DreamRouter' },
] as const

/** 价格规则方向。 */
const DIRECTION_OPTIONS = [
  { value: 'increase', labelKey: 'Increase discount' },
  { value: 'decrease', labelKey: 'Decrease discount' },
] as const

export function ChannelSyncSection({ defaultValues }: Props) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    // 未配置过的 option 键在 Options 表里可能压根不存在，用默认值兜底，
    // 保证 z.boolean() 不会因 undefined 报错而无法保存。
    values: useMemo<FormValues>(
      () => ({
        DreamRouterSyncEnabled: asBool(defaultValues.DreamRouterSyncEnabled),
        DreamRouterSyncProvider:
          asText(defaultValues.DreamRouterSyncProvider) || 'dreamrouter',
        DreamRouterSyncChannelID: asText(
          defaultValues.DreamRouterSyncChannelID
        ),
        DreamRouterSyncUsername: asText(defaultValues.DreamRouterSyncUsername),
        DreamRouterSyncPassword: asText(defaultValues.DreamRouterSyncPassword),
        DreamRouterSyncHour: asText(defaultValues.DreamRouterSyncHour) || '0',
        DreamRouterSyncRuleDirection:
          asText(defaultValues.DreamRouterSyncRuleDirection) || 'increase',
        DreamRouterSyncRuleAmount:
          asText(defaultValues.DreamRouterSyncRuleAmount) || '0.1',
      }),
      [defaultValues]
    ),
  })

  const enabled = form.watch('DreamRouterSyncEnabled')
  const direction = form.watch('DreamRouterSyncRuleDirection')

  const onSubmit = (values: FormValues) => {
    // useUpdateOption 是单键更新，toast 与错误处理都由 hook 统一负责。
    const entries: Array<[keyof FormValues, string]> = [
      [
        'DreamRouterSyncEnabled',
        values.DreamRouterSyncEnabled ? 'true' : 'false',
      ],
      ['DreamRouterSyncProvider', values.DreamRouterSyncProvider.trim()],
      ['DreamRouterSyncChannelID', values.DreamRouterSyncChannelID.trim()],
      ['DreamRouterSyncUsername', values.DreamRouterSyncUsername.trim()],
      ['DreamRouterSyncHour', values.DreamRouterSyncHour.trim()],
      [
        'DreamRouterSyncRuleDirection',
        values.DreamRouterSyncRuleDirection.trim(),
      ],
      ['DreamRouterSyncRuleAmount', values.DreamRouterSyncRuleAmount.trim()],
    ]
    // 掩码串是展示态的值，不是新密钥：整条跳过，既不能用掩码覆盖真密钥，
    // 也不能把空串当成「清空口令」提交（否则每次保存都会抹掉已配置的口令）。
    const password = values.DreamRouterSyncPassword.trim()
    if (!isMaskedSecret(password) && password !== '') {
      entries.push(['DreamRouterSyncPassword', password])
    }
    for (const [key, value] of entries) {
      updateOption.mutate({ key, value })
    }
  }

  return (
    <SettingsSection title={t('Channel Login & Sync')}>
      <p className='text-muted-foreground text-sm'>
        {t(
          'Log in to an upstream channel, then sync its model list and discounted prices on a schedule. Prices are converted with the rule below and written into the ratio table automatically.'
        )}
      </p>
      <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
        <Form {...form}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />

          <SettingsSwitchItem>
            <SettingsSwitchContent>
              <FormLabel>{t('Enable scheduled sync')}</FormLabel>
              <FormDescription>
                {t(
                  'When enabled, the upstream model list and prices are synced automatically every day and converted into Uter prices.'
                )}
              </FormDescription>
            </SettingsSwitchContent>
            <FormControl>
              <Switch
                checked={enabled}
                onCheckedChange={(checked) =>
                  form.setValue('DreamRouterSyncEnabled', checked)
                }
                disabled={updateOption.isPending}
              />
            </FormControl>
          </SettingsSwitchItem>

          {enabled && (
            <>
              <FormField
                control={form.control}
                name='DreamRouterSyncProvider'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Upstream channel')}</FormLabel>
                    <Select
                      value={asText(field.value) || 'dreamrouter'}
                      onValueChange={field.onChange}
                      disabled={updateOption.isPending}
                    >
                      <FormControl>
                        <SelectTrigger>
                          {/* 必须显式给 children：Base UI 的 Value 在未展开过
                              下拉时拿不到 item 文案，会直接渲染原始值
                              （页面上就会出现英文枚举 `dreamrouter`）。 */}
                          <SelectValue>
                            {t(
                              PROVIDER_OPTIONS.find(
                                (option) => option.value === field.value
                              )?.labelKey ?? 'DreamRouter'
                            )}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROVIDER_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t('The channel whose model list and prices are read.')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='DreamRouterSyncChannelID'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Local channel ID')}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete='off'
                        {...field}
                        value={asText(field.value)}
                        placeholder='20'
                        disabled={updateOption.isPending}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'The Uter channel that carries these models. Its model list is kept in sync with the upstream one.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='DreamRouterSyncUsername'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Upstream login account')}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete='off'
                        {...field}
                        value={asText(field.value)}
                        disabled={updateOption.isPending}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'The account used to sign in to the upstream channel.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='DreamRouterSyncPassword'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Upstream login password')}</FormLabel>
                    <FormControl>
                      <SecretInput
                        {...field}
                        value={asText(field.value)}
                        disabled={updateOption.isPending}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Stored masked and never returned to the browser. Leave it empty to keep the saved password.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='DreamRouterSyncHour'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Sync time')}</FormLabel>
                    <FormControl>
                      <Select
                        value={asText(field.value) || '0'}
                        onValueChange={field.onChange}
                        disabled={updateOption.isPending}
                      >
                        <SelectTrigger>
                          <SelectValue>
                            {t('Daily at {{hour}}:00', {
                              hour: Number(asText(field.value) || '0'),
                            })}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, hour) => (
                            <SelectItem key={hour} value={String(hour)}>
                              {t('Daily at {{hour}}:00', { hour })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormDescription>
                      {t(
                        'The hour of day (server local time) when the daily sync runs. A restart after that hour still runs the sync for the day.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='DreamRouterSyncRuleDirection'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Price rule')}</FormLabel>
                    <Select
                      value={asText(field.value) || 'increase'}
                      onValueChange={field.onChange}
                      disabled={updateOption.isPending}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue>
                            {t(
                              DIRECTION_OPTIONS.find(
                                (option) => option.value === field.value
                              )?.labelKey ?? 'Increase discount'
                            )}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DIRECTION_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t(
                        'Increase: Uter price = official base price × (upstream discount + amount). Decrease: Uter price = official base price × (upstream discount − amount).'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='DreamRouterSyncRuleAmount'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t(
                        direction === 'decrease'
                          ? 'Discount to subtract'
                          : 'Discount to add'
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        step='0.01'
                        min='0'
                        max='0.99'
                        autoComplete='off'
                        {...field}
                        value={asText(field.value)}
                        placeholder='0.1'
                        disabled={updateOption.isPending}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'In discount steps: 0.1 means one tenth of the base price. A decrease larger than the upstream discount is skipped (it would produce a non-positive price).'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
        </Form>
      </SettingsForm>
      {/* 上游 / Uter 逐模型价格对照：即使关闭了定时同步也保留，管理员据此核对
          现有价格是否仍与上游一致（数据来自最近一次成功同步的快照）。 */}
      <ChannelSyncModelsTable />
    </SettingsSection>
  )
}
