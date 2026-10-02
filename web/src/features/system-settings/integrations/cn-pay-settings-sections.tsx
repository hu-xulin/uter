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

// ============================================================================
// Alipay (官方直连 / 当面付) settings section
// ============================================================================

const alipaySchema = z.object({
  enabled: z.boolean(),
  appId: z.string().optional(),
  privateKey: z.string().optional(),
  publicKey: z.string().optional(),
})

type AlipayValues = z.input<typeof alipaySchema>

export function AlipaySettingsSection({
  defaultValues,
}: {
  defaultValues: {
    enabled: boolean
    appId: string
    privateKey: string
    publicKey: string
  }
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<AlipayValues>({
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

  async function onSubmit(values: AlipayValues) {
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
    toast.success(t('Settings saved'))
  }

  return (
    <SettingsSection title={t('Alipay (Official)')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending || isSubmitting}
            isSaveDisabled={!isDirty}
            saveLabel={t('Save Alipay settings')}
          />
          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable Alipay payments')}</FormLabel>
                  <FormDescription>
                    {t('Enable official Alipay (当面付) direct payment')}
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
                    <li>{t('Enable 当面付 in Alipay open platform')}</li>
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
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}

// ============================================================================
// WeChat Pay (官方直连 / APIv3 Native) settings section
// ============================================================================

const wechatSchema = z.object({
  enabled: z.boolean(),
  mchId: z.string().optional(),
  appId: z.string().optional(),
  apiV3Key: z.string().optional(),
  serialNo: z.string().optional(),
  privateKey: z.string().optional(),
  platformCert: z.string().optional(),
})

type WechatValues = z.input<typeof wechatSchema>

export function WechatPaySettingsSection({
  defaultValues,
}: {
  defaultValues: {
    enabled: boolean
    mchId: string
    appId: string
    apiV3Key: string
    serialNo: string
    privateKey: string
    platformCert: string
  }
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<WechatValues>({
    resolver: zodResolver(wechatSchema),
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

  async function onSubmit(values: WechatValues) {
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
      updates.push({ key: 'WechatPayPrivateKey', value: values.privateKey ?? '' })
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
    toast.success(t('Settings saved'))
  }

  return (
    <SettingsSection title={t('WeChat Pay (Official)')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending || isSubmitting}
            isSaveDisabled={!isDirty}
            saveLabel={t('Save WeChat Pay settings')}
          />
          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable WeChat Pay')}</FormLabel>
                  <FormDescription>
                    {t('Enable official WeChat Pay (Native) direct payment')}
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
                      <Input placeholder='1900000000' autoComplete='off' {...field} />
                    </FormControl>
                    <FormDescription>{t('WeChat Pay merchant ID')}</FormDescription>
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
                      {t('Bound public account / mini program AppID')}
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
                    <li>{t('Enable Native payment in WeChat Pay merchant')}</li>
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
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
