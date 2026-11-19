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
import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SecretFileInput } from '@/components/ui/secret-file-input'
import { Switch } from '@/components/ui/switch'

import {
  getAlipayCallbackDiagnostics,
  type AlipayCallbackEvent,
} from '../api'

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
  AlipayGateway: string
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
        <h3 className='text-lg font-semibold'>{t('Alipay Gateway')}</h3>
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
            name='AlipayGateway'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Alipay gateway URL')}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete='off'
                    placeholder='https://openapi.alipay.com/gateway.do'
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Production: https://openapi.alipay.com/gateway.do · Sandbox: https://openapi-sandbox.dl.alipaydev.com/gateway.do'
                  )}
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
          <AlipayCallbackDiagnosticsCard />

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
                      'Alipay Open Platform (open.alipay.com) → Console → Web & mobile apps → Create app.'
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
                      'Alipay Open Platform (open.alipay.com) → your app → Development settings → Interface signing method → set RSA2 (SHA256), then use the Alipay key generator to create an RSA 2048 pair.'
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
                      'Stay on the same page of the Alipay Open Platform (open.alipay.com): upload the application public key from step 2, and Alipay then issues the “Alipay public key”.'
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
                      'Alipay Open Platform (open.alipay.com) → your app → Product binding → request “Computer website payment” (alipay.trade.page.pay) and “Mobile website payment” (alipay.trade.wap.pay).'
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
                      'The website domain you submit when signing the products in the Alipay Open Platform (open.alipay.com) must be ICP-filed and its registrant must match the app entity.'
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
                      'Async callbacks go to /api/user/alipay/notify on this server; no fixed configuration is needed in the Alipay Open Platform (open.alipay.com).'
                    )}
                  </span>
                </li>
                <li>
                  <span className='font-medium'>
                    {t('Check the settlement account in the merchant center')}
                  </span>
                  <span className='text-muted-foreground'>
                    {' — '}
                    {t(
                      'Alipay merchant center (b.alipay.com) → Account center → settlement account — only when you need to check where funds land or change bank details.'
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


function AlipayCallbackDiagnosticsCard() {
  const { t } = useTranslation()
  const diagnostics = useQuery({
    queryKey: ['alipay-callback-diagnostics'],
    queryFn: getAlipayCallbackDiagnostics,
    enabled: false,
    meta: { errorToast: false },
  })
  const data = diagnostics.data?.data

  return (
    <div className='space-y-3 rounded-lg border p-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div>
          <h4 className='text-base font-semibold'>{t('Callback diagnostics')}</h4>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Checks the notify URL Alipay will call and lists callbacks received by this process.'
            )}
          </p>
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={diagnostics.isFetching}
          onClick={() => void diagnostics.refetch()}
        >
          <RefreshCw />
          {t('Check callback route')}
        </Button>
      </div>
      {diagnostics.isError && (
        <p className='text-destructive text-sm'>
          {diagnostics.error instanceof Error
            ? diagnostics.error.message
            : t('Failed to load callback diagnostics')}
        </p>
      )}
      {data && (
        <div className='space-y-2 text-xs'>
          <div>
            <span className='text-muted-foreground'>{t('notify_url')}: </span>
            <code className='break-all'>{data.notify_url}</code>
          </div>
          <div>
            <span className='text-muted-foreground'>{t('return_url')}: </span>
            <code className='break-all'>
              {`${window.location.origin}/wallet?pay=success&trade_no=<trade_no>`}
            </code>
          </div>
          <div>
            <span className='text-muted-foreground'>{t('Gateway')}: </span>
            <code className='break-all'>{data.gateway}</code>
          </div>
          <div>
            <span className='text-muted-foreground'>
              {t('TCP reachability')}:{' '}
            </span>
            <span
              className={
                data.tcp_reachable ? 'text-success' : 'text-destructive'
              }
            >
              {data.tcp_reachable ? t('Reachable') : t('Unreachable')}
              {!data.tcp_reachable && data.reach_error
                ? ` — ${data.reach_error}`
                : ''}
            </span>
          </div>
          <p className='text-muted-foreground'>
            {t(
              'TCP reachability only proves the host accepts connections; it does not prove the route reaches this Uter instance and database.'
            )}
          </p>
          <div>
            <span className='text-muted-foreground'>
              {t('HTTP status')}:{' '}
            </span>
            <span>
              {data.http_status || '—'} {data.content_type || ''}{' '}
              {data.http_server ? `(${data.http_server})` : ''}
            </span>
          </div>
          <div>
            <span className='text-muted-foreground'>
              {t('Notify URL target')}:{' '}
            </span>
            <span
              className={
                data.reaches_uter ? 'text-success' : 'text-destructive'
              }
            >
              {data.reaches_uter
                ? t('Notify URL reaches Uter')
                : t('Notify URL does not reach Uter')}
            </span>
          </div>
          {!data.reaches_uter && data.http_status > 0 && (
            <Alert variant='destructive'>
              <AlertTitle>{t('Callback domain is misrouted')}</AlertTitle>
              <AlertDescription>
                {t(
                  'The notify URL returned HTTP {{status}} ({{contentType}}) from {{server}}, not a Uter response. Point the callback domain to the same Uter backend as the site.',
                  {
                    status: data.http_status,
                    contentType: data.content_type || '—',
                    server: data.http_server || '—',
                  }
                )}
              </AlertDescription>
            </Alert>
          )}
          <div className='space-y-1'>
            <div className='text-muted-foreground'>
              {t('Recent callbacks')}
            </div>
            {data.events.length === 0 ? (
              <p className='text-muted-foreground'>{t('No callbacks received')}</p>
            ) : (
              <ul className='space-y-1'>
                {data.events.map((event: AlipayCallbackEvent) => (
                  <li
                    key={`${event.time}-${event.trade_no}-${event.result}-${event.reason}`}
                    className='flex flex-wrap gap-2'
                  >
                    <span>{new Date(event.time * 1000).toLocaleString()}</span>
                    <span className='font-mono'>{event.trade_no || '—'}</span>
                    <span>{event.result}</span>
                    {event.reason && <span>{event.reason}</span>}
                    {event.remote_ip && <span>{event.remote_ip}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
