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
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { VerifiedSecretInput } from '@/features/system-settings/components/verified-secret-input'

import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const adminAccountSchema = z.object({
  AdminAccount: z.string(),
  AdminPassword: z.string(),
})

type AdminAccountFormValues = z.infer<typeof adminAccountSchema>

type AdminAccountSectionProps = {
  defaultValues: AdminAccountFormValues
}

/**
 * 管理员账号配置项。账号以明文保存；密码走系统设置统一的掩码字段流程：
 * 后端只下发掩码串，完成二次验证后才按需取回明文，未改动的值不会回写。
 * 这两项供外部自动化（WorkBuddy）读取后登录使用，与 Root 登录凭据相互独立。
 */
export function AdminAccountSection(props: AdminAccountSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<AdminAccountFormValues>({
    resolver: zodResolver(adminAccountSchema),
    defaultValues: props.defaultValues,
  })

  useEffect(() => {
    form.reset(props.defaultValues)
  }, [props.defaultValues, form])

  const onSubmit = async (data: AdminAccountFormValues) => {
    const updates = Object.entries(data).filter(
      ([key, value]) =>
        value !== props.defaultValues[key as keyof AdminAccountFormValues]
    )

    for (const [key, value] of updates) {
      await updateOption.mutateAsync({ key, value: value ?? '' })
    }
  }

  return (
    <SettingsSection title={t('Admin Account')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />
          <FormField
            control={form.control}
            name='AdminAccount'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Admin Account')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('Administrator username')}
                    autoComplete='off'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='AdminPassword'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Admin Password')}</FormLabel>
                <FormControl>
                  <VerifiedSecretInput
                    placeholder={t('Admin Password')}
                    value={String(field.value ?? '')}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
