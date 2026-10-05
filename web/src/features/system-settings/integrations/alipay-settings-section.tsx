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
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { useUpdateOption } from '../hooks/use-update-option'

export type AlipaySettingsValues = {
  enabled: boolean
  appId: string
  privateKey: string
  publicKey: string
}

const alipaySchema = z.object({
  enabled: z.boolean(),
  appId: z.string().optional(),
  privateKey: z.string().optional(),
  publicKey: z.string().optional(),
})

type FormValues = z.input<typeof alipaySchema>

export function AlipaySettingsSection({
  defaultValues,
}: {
  defaultValues: AlipaySettingsValues
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<FormValues>({
    resolver: zodResolver(alipaySchema),
    defaultValues: {
      enabled: defaultValues.enabled,
      appId: defaultValues.appId ?? '',
      privateKey: defaultValues.privateKey ?? '',
      publicKey: defaultValues.publicKey ?? '',
    },
  })

  const { isDirty, isSubmitting } = form.formState
  const enabled = form.watch('enabled')

  async function onSubmit(values: FormValues) {
    const updates: Array<{ key: string; value: string }> = []

    if (values.enabled !== defaultValues.enabled) {
      updates.push({ key: 'AlipayEnabled', value: String(values.enabled) })
    }
    if ((values.appId ?? '') !== (defaultValues.appId ?? '')) {
      updates.push({ key: 'AlipayAppId', value: values.appId ?? '' })
    }
    if ((values.privateKey ?? '') !== (defaultValues.privateKey ?? '')) {
      updates.push({ key: 'AlipayPrivateKey', value: values.privateKey ?? '' })
    }
    if ((values.publicKey ?? '') !== (defaultValues.publicKey ?? '')) {
      updates.push({ key: 'AlipayPublicKey', value: values.publicKey ?? '' })
    }

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }
    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
    form.reset(values)
    toast.success(t('Saved successfully'))
  }

  return (
    <Form {...form}>
      <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
        <SettingsPageFormActions
          onSave={form.handleSubmit(onSubmit)}
          isSaving={updateOption.isPending || isSubmitting}
          isSaveDisabled={!isDirty}
          saveLabel={t('Save all settings')}
        />

        <div className='space-y-4'>
          <div>
            <h3 className='text-lg font-medium'>{t('Alipay Gateway')}</h3>
            <p className='text-muted-foreground text-sm'>
              {t('Configuration for Alipay website payment integration')}
            </p>
          </div>

          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable Alipay payments')}</FormLabel>
                  <FormDescription>
                    {t('Enable official Alipay website payment')}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={(v) => field.onChange(v)}
                    disabled={updateOption.isPending || isSubmitting}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          {enabled ? (
            <>
              <FormField
                control={form.control}
                name='appId'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('App ID')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='2021xxxxxxxxxxxx'
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Alipay open platform app ID')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='privateKey'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Application Private Key')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('PEM or base64 private key')}
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Used to sign payment requests (RSA2)')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='publicKey'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Alipay Public Key')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('PEM public key')}
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Used to verify async callback signature')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Alert variant='default'>
                <AlertTitle>{t('Setup notes')}</AlertTitle>
                <AlertDescription>
                  <ul className='list-disc space-y-1 pl-5'>
                    <li>
                      {t(
                        'Enable Alipay face-to-face (PC QR) and mobile website payment products'
                      )}
                    </li>
                    <li>
                      {t(
                        'Register the ICP-filed payment domain in the merchant platform'
                      )}
                    </li>
                    <li>
                      {t(
                        'Async callback URL is registered automatically by the server'
                      )}
                    </li>
                    <li>
                      {t(
                        'Set the payment site address in the General tab when the payment domain differs from the server address.'
                      )}
                    </li>
                  </ul>
                </AlertDescription>
              </Alert>
            </>
          ) : null}
        </div>
      </SettingsForm>
    </Form>
  )
}
