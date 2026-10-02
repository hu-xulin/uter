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

You should have received a copy of the GNU Affero General License
along with this program. If not, see <https://www.gnu.org/licenses/>.
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
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

export type CnOfficialPaymentValues = {
  alipay: {
    enabled: boolean
    appId: string
    privateKey: string
    publicKey: string
  }
  wechatPay: {
    enabled: boolean
    mchId: string
    appId: string
    apiV3Key: string
    serialNo: string
    privateKey: string
    platformCert: string
  }
}

const alipaySchema = z.object({
  enabled: z.boolean(),
  appId: z.string().optional(),
  privateKey: z.string().optional(),
  publicKey: z.string().optional(),
})

const wechatPaySchema = z.object({
  enabled: z.boolean(),
  mchId: z.string().optional(),
  appId: z.string().optional(),
  apiV3Key: z.string().optional(),
  serialNo: z.string().optional(),
  privateKey: z.string().optional(),
  platformCert: z.string().optional(),
})

const cnOfficialSchema = z.object({
  alipay: alipaySchema,
  wechatPay: wechatPaySchema,
})

type FormValues = z.input<typeof cnOfficialSchema>

export function CnOfficialPaymentSettingsSection({
  defaultValues,
}: {
  defaultValues: CnOfficialPaymentValues
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<FormValues>({
    resolver: zodResolver(cnOfficialSchema),
    defaultValues: {
      alipay: {
        enabled: defaultValues.alipay.enabled,
        appId: defaultValues.alipay.appId ?? '',
        privateKey: defaultValues.alipay.privateKey ?? '',
        publicKey: defaultValues.alipay.publicKey ?? '',
      },
      wechatPay: {
        enabled: defaultValues.wechatPay.enabled,
        mchId: defaultValues.wechatPay.mchId ?? '',
        appId: defaultValues.wechatPay.appId ?? '',
        apiV3Key: defaultValues.wechatPay.apiV3Key ?? '',
        serialNo: defaultValues.wechatPay.serialNo ?? '',
        privateKey: defaultValues.wechatPay.privateKey ?? '',
        platformCert: defaultValues.wechatPay.platformCert ?? '',
      },
    },
  })

  const { isDirty, isSubmitting } = form.formState
  const alipayEnabled = form.watch('alipay.enabled')
  const wechatPayEnabled = form.watch('wechatPay.enabled')

  async function onSubmit(values: FormValues) {
    const updates: Array<{ key: string; value: string }> = []

    const a = values.alipay
    const d = defaultValues.alipay
    if (a.enabled !== d.enabled) {
      updates.push({ key: 'AlipayEnabled', value: String(a.enabled) })
    }
    if ((a.appId ?? '') !== (d.appId ?? '')) {
      updates.push({ key: 'AlipayAppId', value: a.appId ?? '' })
    }
    if ((a.privateKey ?? '') !== (d.privateKey ?? '')) {
      updates.push({ key: 'AlipayPrivateKey', value: a.privateKey ?? '' })
    }
    if ((a.publicKey ?? '') !== (d.publicKey ?? '')) {
      updates.push({ key: 'AlipayPublicKey', value: a.publicKey ?? '' })
    }

    const w = values.wechatPay
    const wd = defaultValues.wechatPay
    if (w.enabled !== wd.enabled) {
      updates.push({ key: 'WechatPayEnabled', value: String(w.enabled) })
    }
    if ((w.mchId ?? '') !== (wd.mchId ?? '')) {
      updates.push({ key: 'WechatPayMchId', value: w.mchId ?? '' })
    }
    if ((w.appId ?? '') !== (wd.appId ?? '')) {
      updates.push({ key: 'WechatPayAppId', value: w.appId ?? '' })
    }
    if ((w.apiV3Key ?? '') !== (wd.apiV3Key ?? '')) {
      updates.push({ key: 'WechatPayApiV3Key', value: w.apiV3Key ?? '' })
    }
    if ((w.serialNo ?? '') !== (wd.serialNo ?? '')) {
      updates.push({ key: 'WechatPaySerialNo', value: w.serialNo ?? '' })
    }
    if ((w.privateKey ?? '') !== (wd.privateKey ?? '')) {
      updates.push({ key: 'WechatPayPrivateKey', value: w.privateKey ?? '' })
    }
    if ((w.platformCert ?? '') !== (wd.platformCert ?? '')) {
      updates.push({ key: 'WechatPayPlatformCert', value: w.platformCert ?? '' })
    }

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }
    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
    form.reset(values)
    toast.success(t('Settings saved'))
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

        <SettingsSection title={t('Alipay (Official)')}>
          <FormField
            control={form.control}
            name='alipay.enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable Alipay payments')}</FormLabel>
                  <FormDescription>
                    {t('Enable official Alipay mini-program payment')}
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

          {alipayEnabled ? (
            <>
              <FormField
                control={form.control}
                name='alipay.appId'
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
                name='alipay.privateKey'
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
                name='alipay.publicKey'
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
                        'Enable 小程序支付 (alipay.trade.create) in Alipay open platform'
                      )}
                    </li>
                    <li>
                      {t(
                        'Async callback URL is registered automatically by the server'
                      )}
                    </li>
                  </ul>
                </AlertDescription>
              </Alert>
            </>
          ) : null}
        </SettingsSection>

        <SettingsSection title={t('WeChat Pay (Official)')}>
          <FormField
            control={form.control}
            name='wechatPay.enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable WeChat Pay')}</FormLabel>
                    <FormDescription>
                      {t('Enable official WeChat Pay mini-program payment')}
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

          {wechatPayEnabled ? (
            <>
              <FormField
                control={form.control}
                name='wechatPay.mchId'
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
                name='wechatPay.appId'
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
                      {t('Bound mini-program AppID')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='wechatPay.apiV3Key'
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
                name='wechatPay.serialNo'
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
                name='wechatPay.privateKey'
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
                name='wechatPay.platformCert'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('WeChat Pay Platform Certificate')}</FormLabel>
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
                        'Enable JSAPI (mini-program) payment in WeChat Pay merchant'
                      )}
                    </li>
                    <li>
                      {t(
                        'Async callback URL is registered automatically by the server'
                      )}
                    </li>
                  </ul>
                </AlertDescription>
              </Alert>
            </>
          ) : null}
        </SettingsSection>
      </SettingsForm>
    </Form>
  )
}
