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
import { useFormContext, useFormState, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
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
import { SecretInput } from '@/components/ui/secret-input'
import { Switch } from '@/components/ui/switch'

import {
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'

/**
 * 微信支付（APIv3）在「支付网关」表单里注册的字段。
 *
 * 这些字段由 `PaymentSettingsSection` 的父表单持有，本组件只负责渲染：
 * 独立表单 + 独立保存按钮会在页面头部渲染出**第二个**「保存所有设置」按钮
 * （页级动作区是 portal，父子各渲染一份就会重复），并且会在父表单内部
 * 形成 `<form>` 嵌套 `<form>` 的非法结构。改由父表单统一持有后，页头只保留
 * 一个保存按钮，一次提交覆盖全部网关页签。
 */
export interface WechatPayFormValues {
  WechatPayEnabled: boolean
  WechatPayMchId: string
  WechatPayAppId: string
  WechatPayApiV3Key: string
  WechatPaySerialNo: string
  WechatPayPrivateKey: string
  WechatPayPublicKey: string
}

export function WechatPaySettingsSection() {
  const { t } = useTranslation()
  const { control } = useFormContext<WechatPayFormValues>()
  const { isSubmitting } = useFormState()
  const enabled = useWatch({ control, name: 'WechatPayEnabled' })

  return (
    <div className='space-y-4'>
      <div>
        <h3 className='text-lg font-medium'>{t('WeChat Pay Gateway')}</h3>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Native (PC QR) + H5 (mobile web) only, with a verified service account as the AppID source'
          )}
        </p>
      </div>

      <FormField
        control={control}
        name='WechatPayEnabled'
        render={({ field }) => (
          <SettingsSwitchItem>
            <SettingsSwitchContent>
              <FormLabel>{t('Enable WeChat Pay')}</FormLabel>
              <FormDescription>
                {t('Enable official WeChat Pay Native + H5 payment')}
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
            name='WechatPayMchId'
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
                <FormDescription>{t('WeChat Pay merchant ID')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name='WechatPayAppId'
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
                  {t(
                    'Service account AppID (starts with wx) — mini programs and mobile apps are not used'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name='WechatPayApiV3Key'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('APIv3 Key')}</FormLabel>
                <FormControl>
                  <SecretInput
                    value={String(field.value ?? '')}
                    onChange={field.onChange}
                    placeholder='32-byte APIv3 key'
                  />
                </FormControl>
                <FormDescription>
                  {t('32-byte APIv3 key for callback decryption')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name='WechatPaySerialNo'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Certificate Serial No')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder='1234567890abcdef1234567890abcdef'
                    autoComplete='off'
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t('Merchant API certificate serial number')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name='WechatPayPrivateKey'
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('Merchant Private Key (apiclient_key.pem)')}
                </FormLabel>
                <FormControl>
                  <SecretFileInput
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    expectedPemType={['PRIVATE KEY', 'RSA PRIVATE KEY']}
                    accept='.pem,.key,.txt,text/plain'
                    onError={(message) => toast.error(message)}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Signs payment requests (RSA). Choose the apiclient_key.pem file from the merchant platform.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name='WechatPayPublicKey'
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('WeChat Pay Public Key (pub_key.pem)')}
                </FormLabel>
                <FormControl>
                  <SecretFileInput
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    expectedPemType={['PUBLIC KEY', 'RSA PUBLIC KEY']}
                    accept='.pem,.key,.txt,text/plain'
                    onError={(message) => toast.error(message)}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Verifies async callback signatures. Choose the pub_key.pem file from the merchant platform.'
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
                    {t('Apply for a verified service account')}
                  </span>
                  <span className='text-muted-foreground'>
                    {' — '}
                    {t(
                      'Official account platform (mp.weixin.qq.com) → Register → Service account. A subscription account cannot open WeChat Pay, and WeChat verification (annual fee) must be completed before the account can be linked to a merchant. The AppID (starts with wx) is shown in the account’s basic configuration.'
                    )}
                  </span>
                </li>
                <li>
                  <span className='font-medium'>
                    {t('Apply for a WeChat Pay merchant account')}
                  </span>
                  <span className='text-muted-foreground'>
                    {' — '}
                    {t(
                      'WeChat Pay merchant platform (pay.weixin.qq.com) → Become a merchant → submit business license, legal person ID and settlement account, and enter the service account AppID from step 1 in the associated AppID field. The merchant entity must match the service account subject. Approval takes 1–5 business days; the merchant number (10 digits, starting with 1) is issued afterwards and is required by every step below.'
                    )}
                  </span>
                </li>
                <li>
                  <span className='font-medium'>
                    {t('Enable Native Pay (PC QR code)')}
                  </span>
                  <span className='text-muted-foreground'>
                    {' — '}
                    {t(
                      'WeChat Pay merchant platform (pay.weixin.qq.com) → Product center → My products → enable “Native Pay”. Desktop users scan a QR code with WeChat; no domain registration is needed, so PC payment works as soon as the product is enabled.'
                    )}
                  </span>
                </li>
                <li>
                  <span className='font-medium'>
                    {t(
                      'Enable H5 Pay (mobile web) and register the payment domain'
                    )}
                  </span>
                  <span className='text-muted-foreground'>
                    {' — '}
                    {t(
                      'On the same page enable “H5 Pay”, then Product center → Development configuration → H5 pay domain: register your ICP-filed domain whose registrant matches the merchant entity (e.g. uter.cc). Mobile users are redirected to the WeChat cashier only after the domain is approved — skipping it leaves mobile payment broken even though PC Native works.'
                    )}
                  </span>
                </li>
                <li>
                  <span className='font-medium'>
                    {t('Copy the merchant ID into “Merchant ID”')}
                  </span>
                  <span className='text-muted-foreground'>
                    {' — '}
                    {t(
                      'WeChat Pay merchant platform (pay.weixin.qq.com) → Account center → Merchant info → WeChat Pay merchant ID (10 digits).'
                    )}
                  </span>
                </li>
                <li>
                  <span className='font-medium'>
                    {t('Set the APIv3 key and copy it into “APIv3 Key”')}
                  </span>
                  <span className='text-muted-foreground'>
                    {' — '}
                    {t(
                      'WeChat Pay merchant platform (pay.weixin.qq.com) → Account center → API security → Set APIv3 key. It must be exactly 32 characters; save a copy, it is shown only once.'
                    )}
                  </span>
                </li>
                <li>
                  <span className='font-medium'>
                    {t('Apply for the merchant API certificate')}
                  </span>
                  <span className='text-muted-foreground'>
                    {' — '}
                    {t(
                      'WeChat Pay merchant platform (pay.weixin.qq.com) → Account center → API security → Apply for API certificate. The certificate tool outputs apiclient_key.pem (private key) and a serial number; select apiclient_key.pem in “Merchant Private Key (apiclient_key.pem)” and paste the serial number into “Certificate Serial No”.'
                    )}
                  </span>
                </li>
                <li>
                  <span className='font-medium'>
                    {t('Download the WeChat Pay public key')}
                  </span>
                  <span className='text-muted-foreground'>
                    {' — '}
                    {t(
                      'WeChat Pay merchant platform (pay.weixin.qq.com) → Account center → API security → WeChat Pay public key → download pub_key.pem, then select it in “WeChat Pay Public Key (pub_key.pem)”. This is required: without it every callback fails signature verification and paid orders never credit.'
                    )}
                  </span>
                </li>
                <li>
                  <span className='font-medium'>
                    {t('Confirm the callback address')}
                  </span>
                  <span className='text-muted-foreground'>
                    {' — '}
                    {t(
                      'No manual entry needed: Native and H5 share the same async callback at /api/user/wechat/notify on this server. If the payment domain differs from the server address, set the payment site address in the General tab so the return URL points at the filed domain.'
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
                      'WeChat Pay only appears in the wallet once the switch is on, every field above is filled, and the APIv3 key is exactly 32 characters.'
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
