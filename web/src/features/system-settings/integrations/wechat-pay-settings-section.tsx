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

export type WechatPaySettingsValues = {
  enabled: boolean
  mchId: string
  appId: string
  apiV3Key: string
  serialNo: string
  privateKey: string
  platformCert: string
}

const wechatPaySchema = z.object({
  enabled: z.boolean(),
  mchId: z.string().optional(),
  appId: z.string().optional(),
  apiV3Key: z.string().optional(),
  serialNo: z.string().optional(),
  privateKey: z.string().optional(),
  platformCert: z.string().optional(),
})

type FormValues = z.input<typeof wechatPaySchema>

export function WechatPaySettingsSection({
  defaultValues,
}: {
  defaultValues: WechatPaySettingsValues
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<FormValues>({
    resolver: zodResolver(wechatPaySchema),
    defaultValues: {
      enabled: defaultValues.enabled,
      mchId: defaultValues.mchId ?? '',
      appId: defaultValues.appId ?? '',
      apiV3Key: defaultValues.apiV3Key ?? '',
      serialNo: defaultValues.serialNo ?? '',
      privateKey: defaultValues.privateKey ?? '',
      platformCert: defaultValues.platformCert ?? '',
    },
  })

  const { isDirty, isSubmitting } = form.formState
  const enabled = form.watch('enabled')

  async function onSubmit(values: FormValues) {
    const updates: Array<{ key: string; value: string }> = []

    if (values.enabled !== defaultValues.enabled) {
      updates.push({ key: 'WechatPayEnabled', value: String(values.enabled) })
    }
    if ((values.mchId ?? '') !== (defaultValues.mchId ?? '')) {
      updates.push({ key: 'WechatPayMchId', value: values.mchId ?? '' })
    }
    if ((values.appId ?? '') !== (defaultValues.appId ?? '')) {
      updates.push({ key: 'WechatPayAppId', value: values.appId ?? '' })
    }
    if ((values.apiV3Key ?? '') !== (defaultValues.apiV3Key ?? '')) {
      updates.push({ key: 'WechatPayApiV3Key', value: values.apiV3Key ?? '' })
    }
    if ((values.serialNo ?? '') !== (defaultValues.serialNo ?? '')) {
      updates.push({ key: 'WechatPaySerialNo', value: values.serialNo ?? '' })
    }
    if ((values.privateKey ?? '') !== (defaultValues.privateKey ?? '')) {
      updates.push({
        key: 'WechatPayPrivateKey',
        value: values.privateKey ?? '',
      })
    }
    if ((values.platformCert ?? '') !== (defaultValues.platformCert ?? '')) {
      updates.push({
        key: 'WechatPayPlatformCert',
        value: values.platformCert ?? '',
      })
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
            <h3 className='text-lg font-medium'>{t('WeChat Pay Gateway')}</h3>
            <p className='text-muted-foreground text-sm'>
              {t('Configuration for WeChat Pay website payment integration')}
            </p>
          </div>

          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable WeChat Pay')}</FormLabel>
                  <FormDescription>
                    {t('Enable official WeChat Pay website payment')}
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
                name='mchId'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Merchant ID')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='1900000000'
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('WeChat Pay merchant ID')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='appId'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('App ID')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='wx1234567890abcdef'
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Bound website payment AppID')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='apiV3Key'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('APIv3 Key')}</FormLabel>
                    <FormControl>
                      <Input type='password' autoComplete='off' {...field} />
                    </FormControl>
                    <FormDescription>
                      {t('32-byte APIv3 key for callback decryption')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='serialNo'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Certificate Serial No')}</FormLabel>
                    <FormControl>
                      <Input autoComplete='off' {...field} />
                    </FormControl>
                    <FormDescription>
                      {t('Merchant API certificate serial number')}
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
                    <FormLabel>{t('Merchant Private Key')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('PKCS8 PEM private key')}
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Used to sign payment requests (RSA)')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='platformCert'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('WeChat Pay Platform Certificate')}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('PEM platform certificate')}
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
                        'Enable WeChat Pay Native (PC QR) and H5 (mobile) payment products'
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
