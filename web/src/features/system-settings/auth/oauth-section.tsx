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
import axios from 'axios'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'

import { CopyButton } from '@/components/copy-button'
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
import { SecretInput } from '@/components/ui/secret-input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { handleServerError } from '@/lib/handle-server-error'
import { maskSecret } from '@/lib/secret'

import { FormDirtyIndicator } from '../components/form-dirty-indicator'
import { FormNavigationGuard } from '../components/form-navigation-guard'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  buildOAuthCallbackUrl,
  resolveOAuthSiteUrl,
} from './oauth-callback-url'

/**
 * react-hook-form 7 treats dotted `name` strings as nested paths. To keep
 * form state, schema validation, and dirty tracking aligned, the
 * `discord.*` and `oidc.*` fields are modeled as nested objects here and
 * flattened back to dotted server keys only when persisting.
 */
const oauthSchema = z.object({
  GitHubOAuthEnabled: z.boolean(),
  GitHubClientId: z.string(),
  GitHubClientSecret: z.string(),
  discord: z.object({
    enabled: z.boolean(),
    client_id: z.string(),
    client_secret: z.string(),
  }),
  oidc: z.object({
    enabled: z.boolean(),
    display_name: z.string(),
    client_id: z.string(),
    client_secret: z.string(),
    well_known: z.string(),
    authorization_endpoint: z.string(),
    token_endpoint: z.string(),
    user_info_endpoint: z.string(),
  }),
  TelegramOAuthEnabled: z.boolean(),
  telegram: z.object({ client_id: z.string(), client_secret: z.string() }),
  LinuxDOOAuthEnabled: z.boolean(),
  LinuxDOClientId: z.string(),
  LinuxDOClientSecret: z.string(),
  LinuxDOMinimumTrustLevel: z.string(),
  WeChatWebAuthEnabled: z.boolean(),
  WeChatWebAppId: z.string(),
  WeChatWebAppSecret: z.string(),
  WeChatWebCallbackDomain: z.string(),
  WeChatWebUseUnionId: z.boolean(),
})

type OAuthFormValues = z.infer<typeof oauthSchema>

type FlatOAuthDefaults = {
  GitHubOAuthEnabled: boolean
  GitHubClientId: string
  GitHubClientSecret: string
  'discord.enabled': boolean
  'discord.client_id': string
  'discord.client_secret': string
  'oidc.enabled': boolean
  'oidc.display_name': string
  'oidc.client_id': string
  'oidc.client_secret': string
  'oidc.well_known': string
  'oidc.authorization_endpoint': string
  'oidc.token_endpoint': string
  'oidc.user_info_endpoint': string
  TelegramOAuthEnabled: boolean
  'telegram.client_id': string
  'telegram.client_secret': string
  LinuxDOOAuthEnabled: boolean
  LinuxDOClientId: string
  LinuxDOClientSecret: string
  LinuxDOMinimumTrustLevel: string
  WeChatWebAuthEnabled?: boolean
  WeChatWebAppId?: string
  WeChatWebAppSecret?: string
  WeChatWebCallbackDomain?: string
  WeChatWebUseUnionId?: boolean
}

/* 单列纵向排列：每个 OAuth 配置项（启用开关 / Client ID / Client Secret）
 * 各占一行，从上往下排，不再两两并排。 */
const oauthTabContentClassName = 'flex min-w-0 flex-col gap-6'

type OAuthSetupGuideRow = {
  label: ReactNode
  value: string
  copyLabel: string
}

type OAuthSetupGuideProps = {
  title: string
  description: ReactNode
  rows: OAuthSetupGuideRow[]
  children?: ReactNode
}

function OAuthSetupGuide(props: OAuthSetupGuideProps) {
  return (
    <Alert>
      {/* 标题走 field 档（16/600），由外层 FormLabelTierProvider 下发：
          截图红字要求「设置引导 16px，加粗」，说明文字保持 14px。 */}
      <AlertTitle>{props.title}</AlertTitle>
      <AlertDescription className='space-y-3 text-sm'>
        <div>{props.description}</div>
        <div className='space-y-2'>
          {props.rows.map((row) => (
            <div
              key={`${String(row.label)}-${row.value}`}
              className='flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between'
            >
              <span className='text-muted-foreground shrink-0'>
                {row.label}
              </span>
              <span className='flex min-w-0 items-center gap-2'>
                {/* 值本身是机器可读的 URL：等宽，14/20。 */}
                <code className='text-mono bg-muted text-foreground min-w-0 rounded px-1.5 py-0.5 font-mono break-all'>
                  {row.value}
                </code>
                <CopyButton
                  value={row.value}
                  size='icon'
                  className='size-7'
                  tooltip={row.copyLabel}
                  aria-label={row.copyLabel}
                />
              </span>
            </div>
          ))}
        </div>
        {props.children}
      </AlertDescription>
    </Alert>
  )
}

const buildFormDefaults = (defaults: FlatOAuthDefaults): OAuthFormValues => ({
  GitHubOAuthEnabled: defaults.GitHubOAuthEnabled,
  GitHubClientId: defaults.GitHubClientId ?? '',
  GitHubClientSecret: defaults.GitHubClientSecret ?? '',
  discord: {
    enabled: defaults['discord.enabled'],
    client_id: defaults['discord.client_id'] ?? '',
    client_secret: defaults['discord.client_secret'] ?? '',
  },
  oidc: {
    enabled: defaults['oidc.enabled'],
    display_name: defaults['oidc.display_name'] ?? '',
    client_id: defaults['oidc.client_id'] ?? '',
    client_secret: defaults['oidc.client_secret'] ?? '',
    well_known: defaults['oidc.well_known'] ?? '',
    authorization_endpoint: defaults['oidc.authorization_endpoint'] ?? '',
    token_endpoint: defaults['oidc.token_endpoint'] ?? '',
    user_info_endpoint: defaults['oidc.user_info_endpoint'] ?? '',
  },
  TelegramOAuthEnabled: defaults.TelegramOAuthEnabled,
  telegram: {
    client_id: defaults['telegram.client_id'] ?? '',
    client_secret: defaults['telegram.client_secret'] ?? '',
  },
  LinuxDOOAuthEnabled: defaults.LinuxDOOAuthEnabled,
  LinuxDOClientId: defaults.LinuxDOClientId ?? '',
  LinuxDOClientSecret: defaults.LinuxDOClientSecret ?? '',
  LinuxDOMinimumTrustLevel: defaults.LinuxDOMinimumTrustLevel ?? '',
  WeChatWebAuthEnabled: defaults.WeChatWebAuthEnabled ?? false,
  WeChatWebAppId: defaults.WeChatWebAppId ?? '',
  WeChatWebAppSecret: defaults.WeChatWebAppSecret ?? '',
  WeChatWebCallbackDomain: defaults.WeChatWebCallbackDomain ?? '',
  WeChatWebUseUnionId: defaults.WeChatWebUseUnionId ?? false,
})

const normalizeFormValues = (values: OAuthFormValues): FlatOAuthDefaults => ({
  GitHubOAuthEnabled: values.GitHubOAuthEnabled,
  GitHubClientId: values.GitHubClientId,
  GitHubClientSecret: values.GitHubClientSecret,
  'discord.enabled': values.discord.enabled,
  'discord.client_id': values.discord.client_id,
  'discord.client_secret': values.discord.client_secret,
  'oidc.enabled': values.oidc.enabled,
  'oidc.display_name': values.oidc.display_name,
  'oidc.client_id': values.oidc.client_id,
  'oidc.client_secret': values.oidc.client_secret,
  'oidc.well_known': values.oidc.well_known,
  'oidc.authorization_endpoint': values.oidc.authorization_endpoint,
  'oidc.token_endpoint': values.oidc.token_endpoint,
  'oidc.user_info_endpoint': values.oidc.user_info_endpoint,
  'telegram.client_id': values.telegram.client_id,
  'telegram.client_secret': values.telegram.client_secret,
  TelegramOAuthEnabled: values.TelegramOAuthEnabled,
  LinuxDOOAuthEnabled: values.LinuxDOOAuthEnabled,
  LinuxDOClientId: values.LinuxDOClientId,
  LinuxDOClientSecret: values.LinuxDOClientSecret,
  LinuxDOMinimumTrustLevel: values.LinuxDOMinimumTrustLevel,
  WeChatWebAuthEnabled: values.WeChatWebAuthEnabled,
  WeChatWebAppId: values.WeChatWebAppId,
  WeChatWebAppSecret: values.WeChatWebAppSecret,
  WeChatWebCallbackDomain: values.WeChatWebCallbackDomain,
  WeChatWebUseUnionId: values.WeChatWebUseUnionId,
})

// OAuth 凭据类字段：保存后按掩码回填展示态，与 SecretInput 的约定一致。
const OAUTH_SECRET_KEYS = [
  'GitHubClientSecret',
  'discord.client_secret',
  'oidc.client_secret',
  'telegram.client_secret',
  'LinuxDOClientSecret',
  'WeChatWebAppSecret',
] as const satisfies ReadonlyArray<keyof FlatOAuthDefaults>

const maskOAuthSecrets = (values: FlatOAuthDefaults): FlatOAuthDefaults => {
  const masked = { ...values }
  for (const key of OAUTH_SECRET_KEYS) {
    masked[key] = maskSecret(masked[key] ?? '')
  }
  return masked
}

type OAuthSectionProps = {
  defaultValues: FlatOAuthDefaults
  serverAddress: string
}

export function OAuthSection(props: OAuthSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [activeTab, setActiveTab] = useState('github')
  const siteUrl = resolveOAuthSiteUrl(props.serverAddress, t('Site URL'))
  const githubCallbackUrl = buildOAuthCallbackUrl(
    props.serverAddress,
    'github',
    t('Site URL')
  )
  const discordCallbackUrl = buildOAuthCallbackUrl(
    props.serverAddress,
    'discord',
    t('Site URL')
  )
  const oidcCallbackUrl = buildOAuthCallbackUrl(
    props.serverAddress,
    'oidc',
    t('Site URL')
  )
  const telegramCallbackUrl = buildOAuthCallbackUrl(
    props.serverAddress,
    'telegram',
    t('Site URL')
  )
  const linuxDOCallbackUrl = buildOAuthCallbackUrl(
    props.serverAddress,
    'linuxdo',
    t('Site URL')
  )
  const wechatWebCallbackDomain = (
    props.defaultValues.WeChatWebCallbackDomain ?? ''
  ).trim()
  // 微信开放平台「授权回调域」只接受域名（主域或其子域），且微信要求该域名
  // 已完成 ICP 备案；未配置时回退到站点地址的 host 部分。回调地址固定指向
  // 前端路由 /oauth/wechat-web，由它再调后端换码。
  const wechatWebCallbackHost =
    wechatWebCallbackDomain ||
    props.serverAddress.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  const wechatWebCallbackUrl = `https://${wechatWebCallbackHost}/oauth/wechat-web`
  const formDefaults = useMemo(
    () => buildFormDefaults(props.defaultValues),
    [props.defaultValues]
  )

  const form = useForm<OAuthFormValues>({
    resolver: zodResolver(oauthSchema),
    defaultValues: formDefaults,
  })

  const baselineRef = useRef<FlatOAuthDefaults>(props.defaultValues)
  const baselineSerializedRef = useRef<string>(
    JSON.stringify(props.defaultValues)
  )

  useEffect(() => {
    const serialized = JSON.stringify(props.defaultValues)
    if (serialized === baselineSerializedRef.current) return
    baselineRef.current = props.defaultValues
    baselineSerializedRef.current = serialized
    form.reset(buildFormDefaults(props.defaultValues))
  }, [props.defaultValues, form])

  const onSubmit = async (values: OAuthFormValues) => {
    let finalValues = values
    const wellKnown = values.oidc.well_known.trim()
    const discoveryUrlChanged =
      wellKnown !== (baselineRef.current['oidc.well_known'] ?? '').trim()
    const enablingOIDC =
      values.oidc.enabled && !baselineRef.current['oidc.enabled']

    // Other providers and disabling OIDC must not depend on OIDC discovery.
    if (wellKnown && (discoveryUrlChanged || enablingOIDC)) {
      if (
        !wellKnown.startsWith('http://') &&
        !wellKnown.startsWith('https://')
      ) {
        setActiveTab('oidc')
        form.setError('oidc.well_known', {
          type: 'validate',
          message: t('Well-Known URL must start with http:// or https://'),
        })
        return
      }

      try {
        const res = await axios.create().get(wellKnown)
        const authEndpoint = res.data['authorization_endpoint'] || ''
        const tokenEndpoint = res.data['token_endpoint'] || ''
        const userInfoEndpoint = res.data['userinfo_endpoint'] || ''

        finalValues = {
          ...values,
          oidc: {
            ...values.oidc,
            well_known: wellKnown,
            authorization_endpoint: authEndpoint,
            token_endpoint: tokenEndpoint,
            user_info_endpoint: userInfoEndpoint,
          },
        }

        form.setValue('oidc.authorization_endpoint', authEndpoint)
        form.setValue('oidc.token_endpoint', tokenEndpoint)
        form.setValue('oidc.user_info_endpoint', userInfoEndpoint)

        toast.success(t('OIDC configuration fetched successfully'))
      } catch (err) {
        handleServerError(
          err,
          t(
            'Failed to fetch OIDC configuration. Please check the URL and network status'
          )
        )
        return
      }
    }

    const normalized = normalizeFormValues(finalValues)
    // Provider "enable" switches must be persisted AFTER their credentials.
    // The backend guard for an enable flag reads the in-memory client id/secret
    // (common.GitHubClientId etc.), which is only refreshed once the credential
    // option is saved. Saving enable first would trip the "fill in client id/
    // secret first" error and abort the batch before credentials are written.
    const enableKeys = new Set<string>([
      'GitHubOAuthEnabled',
      'discord.enabled',
      'oidc.enabled',
      'TelegramOAuthEnabled',
      'LinuxDOOAuthEnabled',
      'WeChatWebAuthEnabled',
    ])
    const changedKeys = (
      Object.keys(normalized) as Array<keyof FlatOAuthDefaults>
    )
      .filter((key) => normalized[key] !== baselineRef.current[key])
      .sort((a, b) => Number(enableKeys.has(a)) - Number(enableKeys.has(b)))

    if (changedKeys.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const key of changedKeys) {
      // WeChatWeb* 等可选字段可能为 undefined（功能未完全接入时），
      // 不应把 undefined 当作「已修改值」写回 option 表。
      const value = normalized[key]
      if (value === undefined) continue
      await updateOption.mutateAsync({
        key,
        value,
      })
    }

    // 凭据字段只按掩码回填：明文不留在表单与基线里，下一次保存也不会
    // 把掩码串当「已修改值」提交。
    const maskedBaseline = maskOAuthSecrets(normalized)
    baselineRef.current = maskedBaseline
    baselineSerializedRef.current = JSON.stringify(maskedBaseline)
    form.reset(buildFormDefaults(maskedBaseline))
  }

  const handleReset = () => {
    form.reset(buildFormDefaults(baselineRef.current))
    toast.success(t('Form reset to saved values'))
  }

  return (
    <>
      <FormNavigationGuard when={form.formState.isDirty} />

      <SettingsSection title={t('OAuth Integrations')}>
        <Form {...form}>
          <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
            <SettingsPageFormActions
              onSave={form.handleSubmit(onSubmit)}
              onReset={handleReset}
              isSaving={form.formState.isSubmitting}
              isResetDisabled={!form.formState.isDirty}
            />
            <FormDirtyIndicator isDirty={form.formState.isDirty} />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className='grid w-full grid-cols-6'>
                <TabsTrigger value='github'>{t('GitHub')}</TabsTrigger>
                <TabsTrigger value='discord'>{t('Discord')}</TabsTrigger>
                <TabsTrigger value='oidc'>{t('OIDC')}</TabsTrigger>
                <TabsTrigger value='telegram'>{t('Telegram')}</TabsTrigger>
                <TabsTrigger value='linuxdo'>{t('LinuxDO')}</TabsTrigger>
                <TabsTrigger value='wechat_web'>{t('WeChat')}</TabsTrigger>
              </TabsList>

              <TabsContent value='github' className={oauthTabContentClassName}>
                <OAuthSetupGuide
                  title={t('Setup guide')}
                  description={t(
                    'Set these values in the provider application before enabling login.'
                  )}
                  rows={[
                    {
                      label: t('Homepage URL'),
                      value: siteUrl,
                      copyLabel: t('Copy homepage URL'),
                    },
                    {
                      label: t('Authorization callback URL'),
                      value: githubCallbackUrl,
                      copyLabel: t('Copy callback URL'),
                    },
                  ]}
                />

                <FormField
                  control={form.control}
                  name='GitHubOAuthEnabled'
                  render={({ field }) => (
                    <SettingsSwitchItem>
                      <SettingsSwitchContent>
                        <FormLabel>{t('Enable GitHub OAuth')}</FormLabel>
                        <FormDescription>
                          {t('Allow users to sign in with GitHub')}
                        </FormDescription>
                      </SettingsSwitchContent>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </SettingsSwitchItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='GitHubClientId'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Client ID')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('Your GitHub OAuth Client ID')}
                          autoComplete='off'
                          mono
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='GitHubClientSecret'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Client Secret')}</FormLabel>
                      <FormControl>
                        <SecretInput
                          placeholder={t('Your GitHub OAuth Client Secret')}
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          name={field.name}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value='discord' className={oauthTabContentClassName}>
                <OAuthSetupGuide
                  title={t('Setup guide')}
                  description={t(
                    'Set these values in the provider application before enabling login.'
                  )}
                  rows={[
                    {
                      label: t('Homepage URL'),
                      value: siteUrl,
                      copyLabel: t('Copy homepage URL'),
                    },
                    {
                      label: t('Authorization callback URL'),
                      value: discordCallbackUrl,
                      copyLabel: t('Copy callback URL'),
                    },
                  ]}
                />

                <FormField
                  control={form.control}
                  name='discord.enabled'
                  render={({ field }) => (
                    <SettingsSwitchItem>
                      <SettingsSwitchContent>
                        <FormLabel>{t('Enable Discord OAuth')}</FormLabel>
                        <FormDescription>
                          {t('Allow users to sign in with Discord')}
                        </FormDescription>
                      </SettingsSwitchContent>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </SettingsSwitchItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='discord.client_id'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Client ID')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('Your Discord OAuth Client ID')}
                          autoComplete='off'
                          mono
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='discord.client_secret'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Client Secret')}</FormLabel>
                      <FormControl>
                        <SecretInput
                          placeholder={t('Your Discord OAuth Client Secret')}
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          name={field.name}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value='oidc' className={oauthTabContentClassName}>
                <OAuthSetupGuide
                  title={t('Setup guide')}
                  description={
                    <div className='space-y-1'>
                      <p>
                        {t(
                          'Set these values in the provider application before enabling login.'
                        )}
                      </p>
                      <p>
                        {t(
                          'OIDC discovery can fill the endpoint fields automatically when the provider supports it.'
                        )}
                      </p>
                    </div>
                  }
                  rows={[
                    {
                      label: t('Homepage URL'),
                      value: siteUrl,
                      copyLabel: t('Copy homepage URL'),
                    },
                    {
                      label: t('Redirect URL'),
                      value: oidcCallbackUrl,
                      copyLabel: t('Copy redirect URL'),
                    },
                  ]}
                />

                <FormField
                  control={form.control}
                  name='oidc.enabled'
                  render={({ field }) => (
                    <SettingsSwitchItem>
                      <SettingsSwitchContent>
                        <FormLabel>{t('Enable OIDC')}</FormLabel>
                        <FormDescription>
                          {t('Allow users to sign in with OpenID Connect')}
                        </FormDescription>
                      </SettingsSwitchContent>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </SettingsSwitchItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='oidc.display_name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('OIDC Display Name')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('e.g. Company SSO')}
                          autoComplete='off'
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('Defaults to "OIDC" if left blank')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='oidc.client_id'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Client ID')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('OIDC Client ID')}
                          autoComplete='off'
                          mono
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='oidc.client_secret'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Client Secret')}</FormLabel>
                      <FormControl>
                        <SecretInput
                          placeholder={t('OIDC Client Secret')}
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          name={field.name}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='oidc.well_known'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Well-Known URL')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t(
                            'https://provider.com/.well-known/openid-configuration'
                          )}
                          autoComplete='off'
                          mono
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('Auto-discovers endpoints from the provider')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='oidc.authorization_endpoint'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('Authorization Endpoint (Optional)')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('Override auto-discovered endpoint')}
                          autoComplete='off'
                          mono
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='oidc.token_endpoint'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Token Endpoint (Optional)')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('Override auto-discovered endpoint')}
                          autoComplete='off'
                          mono
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='oidc.user_info_endpoint'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('User Info Endpoint (Optional)')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('Override auto-discovered endpoint')}
                          autoComplete='off'
                          mono
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent
                value='telegram'
                className={oauthTabContentClassName}
              >
                <OAuthSetupGuide
                  title={t('Setup guide')}
                  description={t(
                    'In BotFather, open Login Widget, register this callback URL, and copy the Client ID and Client Secret. Existing Telegram bindings will continue to work after configuration.'
                  )}
                  rows={[
                    {
                      label: t('Authorization callback URL'),
                      value: telegramCallbackUrl,
                      copyLabel: t('Copy callback URL'),
                    },
                  ]}
                />
                <FormField
                  control={form.control}
                  name='TelegramOAuthEnabled'
                  render={({ field }) => (
                    <SettingsSwitchItem>
                      <SettingsSwitchContent>
                        <FormLabel>{t('Enable Telegram OAuth')}</FormLabel>
                        <FormDescription>
                          {t('Allow users to sign in with Telegram')}
                        </FormDescription>
                      </SettingsSwitchContent>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </SettingsSwitchItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='telegram.client_secret'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Client Secret')}</FormLabel>
                      <FormControl>
                        <SecretInput
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          name={field.name}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='telegram.client_id'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Client ID')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t(
                            'Telegram OAuth Client ID from BotFather'
                          )}
                          autoComplete='off'
                          mono
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value='linuxdo' className={oauthTabContentClassName}>
                <OAuthSetupGuide
                  title={t('Setup guide')}
                  description={t(
                    'Set these values in the provider application before enabling login.'
                  )}
                  rows={[
                    {
                      label: t('Authorization callback URL'),
                      value: linuxDOCallbackUrl,
                      copyLabel: t('Copy callback URL'),
                    },
                  ]}
                >
                  <a
                    href='https://connect.linux.do/'
                    target='_blank'
                    rel='noreferrer'
                    className='text-fg-link inline-flex w-fit items-center gap-1 hover:no-underline'
                  >
                    {t('Manage your LinuxDO OAuth app')}
                  </a>
                </OAuthSetupGuide>

                <FormField
                  control={form.control}
                  name='LinuxDOOAuthEnabled'
                  render={({ field }) => (
                    <SettingsSwitchItem>
                      <SettingsSwitchContent>
                        <FormLabel>{t('Enable LinuxDO OAuth')}</FormLabel>
                        <FormDescription>
                          {t('Allow users to sign in with LinuxDO')}
                        </FormDescription>
                      </SettingsSwitchContent>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </SettingsSwitchItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='LinuxDOClientId'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Client ID')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('LinuxDO Client ID')}
                          autoComplete='off'
                          mono
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='LinuxDOClientSecret'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Client Secret')}</FormLabel>
                      <FormControl>
                        <SecretInput
                          placeholder={t('LinuxDO Client Secret')}
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          name={field.name}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='LinuxDOMinimumTrustLevel'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Minimum Trust Level')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='0'
                          autoComplete='off'
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('Minimum LinuxDO trust level required')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent
                value='wechat_web'
                className={oauthTabContentClassName}
              >
                <OAuthSetupGuide
                  title={t('Setup guide')}
                  description={t(
                    'Create a website app in the WeChat Open Platform console, register the callback domain there, then fill in the credentials below.'
                  )}
                  rows={[
                    {
                      label: t('Authorization callback domain'),
                      value: wechatWebCallbackHost,
                      copyLabel: t('Copy callback domain'),
                    },
                    {
                      label: t('Authorization callback URL'),
                      value: wechatWebCallbackUrl,
                      copyLabel: t('Copy callback URL'),
                    },
                  ]}
                />

                <FormField
                  control={form.control}
                  name='WeChatWebAuthEnabled'
                  render={({ field }) => (
                    <SettingsSwitchItem>
                      <SettingsSwitchContent>
                        <FormLabel>{t('Enable WeChat Login')}</FormLabel>
                        <FormDescription>
                          {t(
                            'Allow users to sign in by scanning the QR code with WeChat'
                          )}
                        </FormDescription>
                      </SettingsSwitchContent>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </SettingsSwitchItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='WeChatWebAppId'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('App ID')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('Your WeChat App ID')}
                          autoComplete='off'
                          mono
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='WeChatWebAppSecret'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('App Secret')}</FormLabel>
                      <FormControl>
                        <SecretInput
                          placeholder={t('Your WeChat App Secret')}
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          name={field.name}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='WeChatWebCallbackDomain'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('Authorization callback domain')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder='wx.example.com'
                          autoComplete='off'
                          mono
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'The callback domain registered in the WeChat Open Platform console (no scheme, e.g. wx.example.com). It must be ICP-filed and match the registered callback domain exactly. Leave empty to use the current site domain.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='WeChatWebUseUnionId'
                  render={({ field }) => (
                    <SettingsSwitchItem>
                      <SettingsSwitchContent>
                        <FormLabel>{t('Use UnionID')}</FormLabel>
                        <FormDescription>
                          {t(
                            'Identify users by UnionID when available, so accounts under the same WeChat Open Platform app share one identity'
                          )}
                        </FormDescription>
                      </SettingsSwitchContent>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </SettingsSwitchItem>
                  )}
                />
              </TabsContent>
            </Tabs>
          </SettingsForm>
        </Form>
      </SettingsSection>
    </>
  )
}
