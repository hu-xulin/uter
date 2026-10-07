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
import { useEffect, useMemo } from 'react'
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
} from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'

import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

/**
 * 六个页面分组。key 必须与后端 common/env.go 的 CustomerServicePageKeys 以及
 * web/src/features/customer-service/page-keys.ts 的页面键逐字一致。
 *
 * 这里显式列出而不是 import 页面键常量：配置界面需要为每个键配一份**可翻译的
 * 展示名**，而 page-keys.ts 是给运行时用的纯逻辑模块、不含文案。
 */
const PAGE_OPTIONS = [
  { key: 'home', labelKey: 'Home page' },
  { key: 'dashboard', labelKey: 'Dashboard' },
  { key: 'pricing', labelKey: 'Pricing' },
  { key: 'rankings', labelKey: 'Rankings' },
  { key: 'docs', labelKey: 'Documentation' },
  { key: 'about', labelKey: 'About' },
] as const

type CustomerServicePageKey = (typeof PAGE_OPTIONS)[number]['key']

const customerServiceSchema = z.object({
  enabled: z.boolean(),
  pages: z.array(z.string()),
})

type CustomerServiceFormValues = z.infer<typeof customerServiceSchema>

/**
 * 把后端存的逗号串解析成页面键数组。
 *
 * 空串/未配置 → 返回**全部页面键**（全开）。必须与后端
 * common.NormalizeCustomerServicePages 的空值语义一致，否则界面上六个开关
 * 全灭但实际却是全开，运营会得到相反的结论。
 */
function parsePages(value: string): CustomerServicePageKey[] {
  const all = PAGE_OPTIONS.map((option) => option.key)
  const picked = value
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part): part is CustomerServicePageKey =>
      all.includes(part as CustomerServicePageKey),
    )
  // 解析不出任何合法键（含空串、全是未知键）时按「全开」处理，与后端一致。
  return picked.length > 0 ? picked : all
}

/** 把页面键数组序列化回后端存的逗号串，顺序固定为 PAGE_OPTIONS 顺序。 */
function serializePages(pages: string[]): string {
  const picked = new Set(pages)
  return PAGE_OPTIONS.filter((option) => picked.has(option.key))
    .map((option) => option.key)
    .join(',')
}

/**
 * 「站点与品牌 → 智能客服」：入口总开关 + 六个页面级开关。
 *
 * 智能客服本体是独立仓库（Uter-AI/AI-Customer-Service）、独立部署，Uter 只是把
 * `CUSTOMER_SERVICE_URL` 经 /api/status 下发给前端、由浏览器直连。这里关掉的**只是
 * 入口显示**，既不会停止也不影响那个服务本身——运营可以先隐藏入口、保留服务与配置。
 *
 * 三个门是**递进**关系：地址（customer_service_url）决定「挂到哪」，总开关决定
 * 「要不要挂」，页面开关决定「在哪些页面挂」。总开关关闭时页面配置不生效。
 */
export function CustomerServiceSection({
  defaultEnabled,
  defaultPages,
  serviceUrl,
}: {
  defaultEnabled: boolean
  /** 后端存的逗号串；空串表示未配置 = 全部页面都开。 */
  defaultPages?: string
  serviceUrl?: string
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const parsedDefaults = useMemo(
    () => parsePages(defaultPages ?? ''),
    [defaultPages],
  )
  const form = useForm<CustomerServiceFormValues>({
    resolver: zodResolver(customerServiceSchema),
    defaultValues: { enabled: defaultEnabled, pages: parsedDefaults },
  })

  useEffect(() => {
    form.reset({ enabled: defaultEnabled, pages: parsedDefaults })
  }, [defaultEnabled, parsedDefaults, form])

  const onSubmit = async (values: CustomerServiceFormValues) => {
    // 总开关与页面开关是两个独立 option，各自只在真的变了时才写，
    // 避免一次保存产生两条无意义的审计记录。
    if (values.enabled !== defaultEnabled) {
      await updateOption.mutateAsync({
        key: 'CustomerServiceEnabled',
        value: String(values.enabled),
      })
    }
    const serialized = serializePages(values.pages)
    if (serialized !== serializePages(parsedDefaults)) {
      await updateOption.mutateAsync({
        key: 'CustomerServicePages',
        value: serialized,
      })
    }
  }

  const pageValues = form.watch('pages')
  const togglePage = (key: string, on: boolean) => {
    const next = on
      ? [...pageValues, key]
      : pageValues.filter((page) => page !== key)
    form.setValue('pages', next, { shouldDirty: true })
  }

  return (
    <SettingsSection title={t('Customer Service')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            isSaveDisabled={!form.formState.isDirty}
            saveLabel='Save customer service settings'
          />

          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <FormLabel>{t('Enable customer service')}</FormLabel>
                  <FormDescription>
                    {serviceUrl
                      ? t(
                          'Master switch for the customer service entry. The service is deployed separately at {{url}}.',
                          { url: serviceUrl },
                        )
                      : t(
                          'Master switch for the customer service entry. No service address is configured yet, so the entry stays hidden even when this is on.',
                        )}
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={updateOption.isPending}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <div className='space-y-3 rounded-lg border p-4'>
            <div className='space-y-0.5'>
              <p className='text-sm leading-none font-medium'>
                {t('Pages where the entry appears')}
              </p>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'Pick the pages that show the customer service entry. With the master switch on and nothing selected, the entry appears on every page.'
                )}
              </p>
            </div>

            {/* 用 FormField 包每一行只为复用 FormControl/Switch 的接线，
                实际取值走 form.watch + setValue：六个独立布尔塞进一个数组字段里，
                拆成六个 FormField 反而要重复六遍 schema。 */}
            {PAGE_OPTIONS.map((option) => {
              const on = pageValues.includes(option.key)
              return (
                <FormItem
                  key={option.key}
                  className='flex flex-row items-center justify-between gap-4'
                >
                  <FormLabel className='text-sm font-normal'>
                    {t(option.labelKey)}
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={on}
                      onCheckedChange={(checked) =>
                        togglePage(option.key, checked)
                      }
                      disabled={updateOption.isPending}
                    />
                  </FormControl>
                </FormItem>
              )
            })}
          </div>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
