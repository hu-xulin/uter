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
 *
 * ⚠️ 展示名刻意不复用 'Dashboard'：那个键在侧边栏等处已被译作「数据看板」，
 * 直接改它会把应用侧边栏一并改成「管理」。这里用本页专属的 'Management'，
 * 与 page-keys.ts 的注释口径（运营开关叫「管理」）一致。
 */
const PAGE_OPTIONS = [
  { key: 'home', labelKey: 'Home page' },
  { key: 'dashboard', labelKey: 'Management' },
  { key: 'pricing', labelKey: 'Pricing' },
  { key: 'rankings', labelKey: 'Rankings' },
  { key: 'docs', labelKey: 'Documentation' },
  { key: 'about', labelKey: 'About' },
] as const

type CustomerServicePageKey = (typeof PAGE_OPTIONS)[number]['key']

const customerServiceSchema = z.object({
  pages: z.array(z.string()),
})

type CustomerServiceFormValues = z.infer<typeof customerServiceSchema>

/**
 * 把后端存的逗号串解析成页面键数组。
 *
 * 三种取值，必须与后端 common.NormalizeCustomerServicePages 的语义逐一对应：
 *   - ""（未配置/存量部署）→ **全部页面键**（全开）；
 *   - "none"（界面上六个开关全关）→ **空数组**（全关）；
 *   - 具体列表 → 那些页面。
 * 三者若错位，界面上六个开关全灭却实际全开（或反之），运营会得到相反的结论。
 */
function parsePages(value: string): CustomerServicePageKey[] {
  const all = PAGE_OPTIONS.map((option) => option.key)
  // 显式哨兵 "none"：六个开关全关时前端写回该值，对应「全部页面都关」。
  // 必须早于下面的「全开」兜底判断，否则会被当成「未配置」误开成全开。
  if (value.trim().toLowerCase() === 'none') return []
  const picked = value
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part): part is CustomerServicePageKey =>
      all.includes(part as CustomerServicePageKey),
    )
  // 解析不出任何合法键（含空串、全是未知键）时按「全开」处理，与后端一致。
  // 空串来自「从未配置过」的存量部署，仍按全开兜底，与后端
  // NormalizeCustomerServicePages 的向后兼容语义一致。
  return picked.length > 0 ? picked : all
}

/** 把页面键数组序列化回后端存的逗号串，顺序固定为 PAGE_OPTIONS 顺序。 */
function serializePages(pages: string[]): string {
  // 一个页面都没选 = 全部关闭，用显式哨兵 "none" 存储，以便与「从未配置」（空串=全开）
  // 区分开来。否则空串会被后端 NormalizeCustomerServicePages 解释成全开，导致
  // 「关掉所有页面」反而变成「所有页面都开」，运营无法真正关闭入口。
  if (pages.length === 0) return 'none'
  const picked = new Set(pages)
  return PAGE_OPTIONS.filter((option) => picked.has(option.key))
    .map((option) => option.key)
    .join(',')
}

/**
 * 「站点与品牌 → 智能客服」：只保留六个页面级开关。
 *
 * 智能客服本体是独立仓库（uter-ai/uter-cs）、独立部署，Uter 只是把
 * `CUSTOMER_SERVICE_URL` 经 /api/status 下发给前端、由浏览器直连。这里关掉的**只是
 * 入口显示**，既不会停止也不影响那个服务本身——运营可以先隐藏入口、保留服务与配置。
 *
 * 曾经有一个「启动智能客服」总开关，2026-10-08 按运营要求移除：页面开关本身已能
 * 表达「在哪些页面显示」，而全开/全关就是总开关的两种取值，再加一个同级开关只会
 * 出现「总开关关着但页面开关全开」这种需要额外解释的组合。后端 common 仍保留
 * CustomerServiceEnabled（默认 true、/api/status 仍下发），仅作为部署级兜底，
 * 界面上不再暴露；改动前请确认该 option 为 true，否则入口会一直隐藏。
 */
export function CustomerServiceSection({
  defaultPages,
}: {
  /** 后端存的逗号串；空串表示未配置 = 全部页面都开。 */
  defaultPages?: string
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const parsedDefaults = useMemo(
    () => parsePages(defaultPages ?? ''),
    [defaultPages],
  )
  const form = useForm<CustomerServiceFormValues>({
    resolver: zodResolver(customerServiceSchema),
    defaultValues: { pages: parsedDefaults },
  })

  useEffect(() => {
    form.reset({ pages: parsedDefaults })
  }, [parsedDefaults, form])

  const onSubmit = async (values: CustomerServiceFormValues) => {
    // 只在真的变了时才写，避免一次保存产生无意义的审计记录。
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

          <div className='space-y-3 rounded-lg border p-4'>
            <div className='space-y-0.5'>
              <p className='text-sm leading-none font-medium'>
                {t('Pages where the entry appears')}
              </p>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'Pick the pages that show the customer service entry. With nothing selected, the entry is hidden on every page.'
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
