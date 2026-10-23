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
import { useTranslation } from 'react-i18next'
import { useFormContext, useFormState, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { SecretFileInput } from '@/components/ui/secret-file-input'
import { Switch } from '@/components/ui/switch'

import {
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'

/**
 * 支付宝在「支付网关」表单里注册的字段。
 *
 * 与微信支付同构：字段由 `PaymentSettingsSection` 的父表单持有，本组件只负责
 * 渲染。这样页头只有一个「保存所有设置」按钮（页级动作区是 portal，若子配置段
 * 自带表单就会多渲染一个），也不会出现 `<form>` 嵌套 `<form>` 的非法结构。
 * 密钥一律走「选择 PEM 文件」：粘贴极易漏掉 PEM 首尾行，而 `pem.Decode`
 * 失败的表现是「参数齐全但回调验签必然失败」，排查成本极高。
 */
export interface AlipayFormValues {
  AlipayEnabled: boolean
  AlipayAppId: string
  AlipayPrivateKey: string
  AlipayPublicKey: string
}

export function AlipaySettingsSection() {
  const { t } = useTranslation()
  const { control } = useFormContext<AlipayFormValues>()
  const { isSubmitting } = useFormState()
  const enabled = useWatch({ control, name: 'AlipayEnabled' })

  return (
    <div className='space-y-4'>
      <div>
        <h3 className='text-lg font-medium'>{t('Alipay Gateway')}</h3>
        <p className='text-muted-foreground text-sm'>
          {t('Configuration for Alipay website payment integration')}
        </p>
      </div>

      <FormField
        control={control}
        name='AlipayEnabled'
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
                disabled={isSubmitting}
              />
            </FormControl>
          </SettingsSwitchItem>
        )}
      />

      {enabled ? (
        <>
          <FormField
            control={control}
            name='AlipayAppId'
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
            control={control}
            name='AlipayPrivateKey'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Application Private Key')}</FormLabel>
                <FormControl>
                  <SecretFileInput
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    expectedPemType={['PRIVATE KEY', 'RSA PRIVATE KEY']}
                    allowBase64
                    accept='.pem,.key,.txt,text/plain'
                    onError={(message) => toast.error(message)}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Signs payment requests (RSA2). Select the private key file output by the Alipay key generator; PEM (PKCS#8 / PKCS#1) and single-line base64 are both accepted.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name='AlipayPublicKey'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Alipay Public Key')}</FormLabel>
                <FormControl>
                  <SecretFileInput
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    expectedPemType={['PUBLIC KEY', 'RSA PUBLIC KEY']}
                    allowBase64
                    accept='.pem,.key,.txt,text/plain'
                    onError={(message) => toast.error(message)}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Verifies async callback signatures. Alipay issues this value after you upload the application public key; a PEM public key file or a single-line base64 string is accepted.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Alert variant='default'>
            <AlertTitle>{t('Setup steps')}</AlertTitle>
            <AlertDescription>
              <ol className='list-decimal space-y-2 pl-5'>
                <li>
                  <span className='font-medium'>
                    {t('Create the app and copy its AppID')}
                  </span>
                  <span className='text-muted-foreground'>
                    {' — '}
                    {t(
                      'Alipay Open Platform → Console → Web & mobile apps → Create app. After approval, copy the AppID (16 digits starting with 2021) into “App ID”.'
                    )}
                  </span>
                </li>
                <li>
                  <span className='font-medium'>
                    {t('Generate the RSA2 key pair')}
                  </span>
                  <span className='text-muted-foreground'>
                    {' — '}
                    {t(
                      'App details → Development settings → Interface signing method → set RSA2 (SHA256), then use the Alipay key generator to create an RSA 2048 pair. It outputs the application private key (keep it offline) and the application public key.'
                    )}
                  </span>
                </li>
                <li>
                  <span className='font-medium'>
                    {t(
                      'Upload the application public key and copy the Alipay public key'
                    )}
                  </span>
                  <span className='text-muted-foreground'>
                    {' — '}
                    {t(
                      'Upload the application public key from step 2 in the same page; Alipay then issues the “Alipay public key”. Save that string as a .txt or .pem file and select it in “Alipay Public Key”. This is required: without it every callback fails signature verification and paid orders never credit.'
                    )}
                  </span>
                </li>
                <li>
                  <span className='font-medium'>
                    {t('Select the application private key file')}
                  </span>
                  <span className='text-muted-foreground'>
                    {' — '}
                    {t(
                      'In “Application Private Key”, select the private key file from step 2. Both PEM files (PKCS#8 or PKCS#1) and single-line base64 text files are accepted.'
                    )}
                  </span>
                </li>
                <li>
                  <span className='font-medium'>
                    {t('Sign the payment products')}
                  </span>
                  <span className='text-muted-foreground'>
                    {' — '}
                    {t(
                      'Console → Products → request “Computer website payment” (alipay.trade.page.pay) and “Mobile website payment” (alipay.trade.wap.pay). Orders are rejected until both products are signed.'
                    )}
                  </span>
                </li>
                <li>
                  <span className='font-medium'>
                    {t('Register the ICP-filed payment domain')}
                  </span>
                  <span className='text-muted-foreground'>
                    {' — '}
                    {t(
                      'The website domain you submit when signing the products must be ICP-filed and its registrant must match the app entity. Otherwise the product application is rejected or callbacks never arrive.'
                    )}
                  </span>
                </li>
                <li>
                  <span className='font-medium'>
                    {t('Confirm the callback and return address')}
                  </span>
                  <span className='text-muted-foreground'>
                    {' — '}
                    {t(
                      'Async callbacks go to /api/user/alipay/notify on this server; no fixed configuration is needed in the open platform. The payment return URL uses the payment site address: set it in the General tab when the payment domain differs from the server address.'
                    )}
                  </span>
                </li>
                <li>
                  <span className='font-medium'>
                    {t('Turn on the switch and save')}
                  </span>
                  <span className='text-muted-foreground'>
                    {' — '}
                    {t(
                      'Alipay only appears in the wallet once the switch is on and App ID, application private key, and Alipay public key are all filled.'
                    )}
                  </span>
                </li>
              </ol>
            </AlertDescription>
          </Alert>
        </>
      ) : null}
    </div>
  )
}
