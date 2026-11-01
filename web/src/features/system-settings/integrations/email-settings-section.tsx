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
import { Plus, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
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
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { SecretInput } from '@/components/ui/secret-input'
import { Switch } from '@/components/ui/switch'
import { getCurrencyDisplay, getCurrencyLabel } from '@/lib/currency'
import { parseQuotaFromDollars, quotaUnitsToDollars } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import { isMaskedSecret, maskSecret } from '@/lib/secret'

import {
  SettingsControlGroup,
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  createEmailSchema,
  parseResendSender,
  type EmailFormValues,
} from './email-settings-schema'

type SmtpAccountViewEntry = {
  account: string
  from: string
  daily_limit: number
  token: string
  today_sent: number
}

export type EmailSettingsSectionProps = {
  defaultValues: Omit<EmailFormValues, 'ResendSenderName' | 'SMTPAccounts'> & {
    // 后端下发的多账号视图（JSON 串）：含掩码凭据与当日用量。
    // 旧单账号三字段仅用于「列表为空时的首填预填」，保存后以列表为准。
    SMTPAccountsView: string
    SMTPAccount: string
    SMTPFrom: string
    SMTPToken: string
  }
}

type SmtpSecurityMode = 'none' | 'ssl_tls' | 'starttls'

function getSmtpSecurityMode(values: {
  SMTPSSLEnabled: boolean
  SMTPStartTLSEnabled: boolean
}): SmtpSecurityMode {
  if (values.SMTPSSLEnabled) return 'ssl_tls'
  if (values.SMTPStartTLSEnabled) return 'starttls'
  return 'none'
}

// parseSMTPAccountsView 解析后端 SMTPAccountsView；非法 JSON 容错为空。
function parseSMTPAccountsView(value: string): SmtpAccountViewEntry[] {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? (parsed as SmtpAccountViewEntry[]) : []
  } catch {
    return []
  }
}

function buildInitialAccounts(
  defaultValues: EmailSettingsSectionProps['defaultValues']
): EmailFormValues['SMTPAccounts'] {
  const view = parseSMTPAccountsView(defaultValues.SMTPAccountsView)
  if (view.length > 0) {
    return view.map((entry) => ({
      account: entry.account ?? '',
      from: entry.from ?? '',
      dailyLimit: String(entry.daily_limit ?? 0),
      token: entry.token ?? '',
    }))
  }
  // 旧单账号迁移预填：保存后进入 SMTPAccounts 列表。
  if (defaultValues.SMTPAccount.trim() !== '') {
    return [
      {
        account: defaultValues.SMTPAccount.trim(),
        from: defaultValues.SMTPFrom.trim(),
        dailyLimit: '0',
        token: defaultValues.SMTPToken ?? '',
      },
    ]
  }
  return [{ account: '', from: '', dailyLimit: '0', token: '' }]
}

export function EmailSettingsSection({
  defaultValues,
}: EmailSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const emailSchema = createEmailSchema(t)
  const initialAccounts = useMemo(
    () => buildInitialAccounts(defaultValues),
    [defaultValues]
  )
  // 当日已发量按账号索引：列表渲染时展示（保存后刷新设置页可看到最新值）。
  const todaySentByAccount = useMemo(() => {
    const view = parseSMTPAccountsView(defaultValues.SMTPAccountsView)
    return new Map(view.map((entry) => [entry.account, entry.today_sent ?? 0]))
  }, [defaultValues.SMTPAccountsView])
  const initialValues = useMemo(
    () => ({
      ...defaultValues,
      ...parseResendSender(defaultValues.ResendFrom),
      SMTPAccounts: initialAccounts,
      QuotaRemindThreshold: String(
        quotaUnitsToDollars(Number(defaultValues.QuotaRemindThreshold) || 0)
      ),
    }),
    [defaultValues, initialAccounts]
  )

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: initialValues,
  })
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'SMTPAccounts',
  })

  const [provider, smtpSSL, smtpStartTLS] = useWatch({
    control: form.control,
    name: ['EmailProvider', 'SMTPSSLEnabled', 'SMTPStartTLSEnabled'],
  })
  const tokensOnly = getCurrencyDisplay().meta.kind === 'tokens'
  const isSaving = form.formState.isSubmitting || updateOption.isPending
  useResetForm(form, isSaving ? undefined : initialValues)

  // serializeAccounts 把表单行转成后端 SMTPAccounts JSON 条目。
  // Token 语义与 SecretInput 一致：留空或掩码串 = 沿用库中原凭据，
  // 只有新输入的明文才提交。
  const serializeAccounts = (values: EmailFormValues) =>
    values.SMTPAccounts.map((row) => ({
      account: row.account.trim(),
      from: row.from.trim(),
      daily_limit: Number(row.dailyLimit.trim()) || 0,
      token:
        row.token.trim() && !isMaskedSecret(row.token.trim())
          ? row.token.trim()
          : '',
    }))

  const onSubmit = async (values: EmailFormValues) => {
    const securityMode = getSmtpSecurityMode(values)

    const updates: Array<{ key: string; value: string | boolean }> = []

    if (values.EmailProvider === 'resend') {
      const from = values.ResendFrom.trim()
      const name = values.ResendSenderName.trim()
      if (
        from !== initialValues.ResendFrom ||
        name !== initialValues.ResendSenderName
      ) {
        // Quote display names so commas, quotes and angle brackets stay text,
        // not mailbox syntax. The server also validates the combined address.
        const escapedName = name.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
        const sender = name ? `"${escapedName}" <${from}>` : from
        updates.push({ key: 'ResendFrom', value: sender })
      }
      const key = values.ResendApiKey.trim()
      // 掩码串是后端下发的展示值，不是新密钥：跳过即可，保留库中原密钥。
      if (key && !isMaskedSecret(key)) {
        updates.push({ key: 'ResendApiKey', value: key })
      }
    } else {
      if (values.SMTPServer.trim() !== defaultValues.SMTPServer.trim()) {
        updates.push({ key: 'SMTPServer', value: values.SMTPServer.trim() })
      }

      if (values.SMTPPort.trim() !== defaultValues.SMTPPort.trim()) {
        updates.push({ key: 'SMTPPort', value: values.SMTPPort.trim() })
      }

      const accounts = serializeAccounts(values)
      const initialSerialized = serializeAccounts({
        ...values,
        SMTPAccounts: initialAccounts,
      })
      if (JSON.stringify(accounts) !== JSON.stringify(initialSerialized)) {
        updates.push({
          key: 'SMTPAccounts',
          value: JSON.stringify(accounts),
        })
      }

      const sslEnabled = securityMode === 'ssl_tls'
      if (sslEnabled !== defaultValues.SMTPSSLEnabled) {
        updates.push({
          key: 'SMTPSSLEnabled',
          value: sslEnabled,
        })
      }

      const startTLSEnabled = securityMode === 'starttls'
      if (startTLSEnabled !== defaultValues.SMTPStartTLSEnabled) {
        updates.push({
          key: 'SMTPStartTLSEnabled',
          value: startTLSEnabled,
        })
      }

      if (
        values.SMTPInsecureSkipVerify !== defaultValues.SMTPInsecureSkipVerify
      ) {
        updates.push({
          key: 'SMTPInsecureSkipVerify',
          value: values.SMTPInsecureSkipVerify,
        })
      }

      if (values.SMTPForceAuthLogin !== defaultValues.SMTPForceAuthLogin) {
        updates.push({
          key: 'SMTPForceAuthLogin',
          value: values.SMTPForceAuthLogin,
        })
      }
    }

    const threshold = values.QuotaRemindThreshold.trim()
    if (threshold !== initialValues.QuotaRemindThreshold) {
      updates.push({
        key: 'QuotaRemindThreshold',
        value: String(parseQuotaFromDollars(Number(threshold || 0))),
      })
    }

    // Save credentials first. A failed configuration write must not activate
    // the new provider; only the final selector write changes delivery.
    if (values.EmailProvider !== defaultValues.EmailProvider) {
      updates.push({ key: 'EmailProvider', value: values.EmailProvider })
    }

    try {
      for (const update of updates) {
        await updateOption.mutateAsync(update)
        if (update.key === 'ResendApiKey') {
          form.setValue('ResendKeyConfigured', true)
        }
      }
      // 保存后密码字段回到留空态：留空 = 沿用库中原凭据。
      form.setValue(
        'SMTPAccounts',
        values.SMTPAccounts.map((row) => ({
          account: row.account.trim(),
          from: row.from.trim(),
          dailyLimit: row.dailyLimit.trim(),
          token: '',
        }))
      )
      // 保存后密钥字段回到掩码展示态：与 SecretInput 的约定一致
      // （表单里只保留前后各 4 位，明文不留在内存里）。
      form.setValue('ResendApiKey', maskSecret(values.ResendApiKey.trim()))
    } catch (error) {
      handleServerError(error)
    }
  }

  return (
    <SettingsSection title={t('Email & Notifications')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={isSaving}
          />
          <FormField
            control={form.control}
            name='EmailProvider'
            render={({ field }) => (
              <FormItem data-settings-form-span='full'>
                <FormLabel>{t('Email sending method')}</FormLabel>
                <FormControl>
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSaving}
                    className='grid-cols-1 gap-3 sm:grid-cols-2'
                  >
                    <Label
                      className='flex cursor-pointer items-center gap-3 rounded-lg border p-4'
                      htmlFor='email-provider-smtp'
                    >
                      <RadioGroupItem value='smtp' id='email-provider-smtp' />
                      SMTP
                    </Label>
                    <Label
                      className='flex cursor-pointer items-center gap-3 rounded-lg border p-4'
                      htmlFor='email-provider-resend'
                    >
                      <RadioGroupItem
                        value='resend'
                        id='email-provider-resend'
                      />
                      Resend API
                    </Label>
                  </RadioGroup>
                </FormControl>
                <FormDescription>
                  {t(
                    'Only the selected method sends email. The other method keeps its settings.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {provider === 'resend' ? (
            <>
              <FormField
                control={form.control}
                name='ResendFrom'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Sender email address')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoComplete='off'
                        disabled={isSaving}
                        type='email'
                        mono
                        placeholder='noreply@example.com'
                      />
                    </FormControl>
                    <FormDescription>
                      {t('The domain must be verified in Resend')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='ResendSenderName'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Sender name')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoComplete='off'
                        disabled={isSaving}
                        placeholder='New API'
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'The name recipients see. Leave blank to use the site name.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='ResendApiKey'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Resend API key')}</FormLabel>
                    <FormControl>
                      <SecretInput
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        placeholder={t('Enter new token to update')}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Leave blank to keep the existing key')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          ) : (
            <>
              <FormField
                control={form.control}
                name='SMTPServer'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('SMTP Host')}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete='off'
                        placeholder={t('smtp.example.com')}
                        mono
                        {...field}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Hostname or IP of your SMTP provider')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='flex flex-col gap-6'>
                <FormField
                  control={form.control}
                  name='SMTPPort'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Port')}</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete='off'
                          type='number'
                          placeholder='587'
                          {...field}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        {t('Common ports include 25, 465, and 587')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel>{t('SMTP encryption')}</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={getSmtpSecurityMode({
                        SMTPSSLEnabled: smtpSSL,
                        SMTPStartTLSEnabled: smtpStartTLS,
                      })}
                      onValueChange={(value) => {
                        const mode = value as SmtpSecurityMode
                        form.setValue('SMTPSSLEnabled', mode === 'ssl_tls', {
                          shouldDirty: true,
                        })
                        form.setValue(
                          'SMTPStartTLSEnabled',
                          mode === 'starttls',
                          {
                            shouldDirty: true,
                          }
                        )
                      }}
                      className='gap-3'
                    >
                      <div className='flex items-center gap-2'>
                        <RadioGroupItem value='none' id='smtp-security-none' />
                        <Label
                          htmlFor='smtp-security-none'
                          tier='default'
                          className='cursor-pointer'
                        >
                          {t('No encryption')}
                        </Label>
                      </div>
                      <div className='flex items-center gap-2'>
                        <RadioGroupItem
                          value='ssl_tls'
                          id='smtp-security-ssl-tls'
                        />
                        <Label
                          htmlFor='smtp-security-ssl-tls'
                          tier='default'
                          className='cursor-pointer'
                        >
                          {t('SSL/TLS')}
                        </Label>
                      </div>
                      <div className='flex items-center gap-2'>
                        <RadioGroupItem
                          value='starttls'
                          id='smtp-security-starttls'
                        />
                        <Label
                          htmlFor='smtp-security-starttls'
                          tier='default'
                          className='cursor-pointer'
                        >
                          {t('STARTTLS')}
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormDescription>
                    {t('Choose one SMTP transport security mode')}
                  </FormDescription>
                </FormItem>

                <FormField
                  control={form.control}
                  name='SMTPInsecureSkipVerify'
                  render={({ field }) => (
                    <SettingsSwitchItem>
                      <SettingsSwitchContent>
                        <FormLabel>
                          {t('Skip SMTP TLS certificate verification')}
                        </FormLabel>
                        <FormDescription>
                          {t(
                            'Allow self-signed or hostname-mismatched SMTP certificates'
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
                  name='SMTPForceAuthLogin'
                  render={({ field }) => (
                    <SettingsSwitchItem>
                      <SettingsSwitchContent>
                        <FormLabel>{t('Force AUTH LOGIN')}</FormLabel>
                        <FormDescription>
                          {t(
                            'Force SMTP authentication using AUTH LOGIN method'
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
              </div>

              {/* 多账号发信列表：顺序即轮换顺序，按账号当日用量满额切换 */}
              <FormItem data-settings-form-span='full'>
                <FormLabel>{t('Sender accounts')}</FormLabel>
                <FormDescription>
                  {t(
                    'Emails are sent with the first account until its daily limit is reached, then the next account is used.'
                  )}
                </FormDescription>
                <div className='space-y-4'>
                  {fields.map((fieldItem, index) => (
                    <div
                      key={fieldItem.id}
                      className='space-y-4 rounded-lg border p-4'
                    >
                      <div className='flex items-center justify-between gap-2'>
                        <Label tier='default'>
                          {t('Account {{index}}', { index: index + 1 })}
                          {(() => {
                            const row = form.getValues(
                              `SMTPAccounts.${index}.account`
                            ) as string | undefined
                            const sent = row
                              ? todaySentByAccount.get(row.trim())
                              : undefined
                            if (sent === undefined) return null
                            return (
                              <span className='text-muted-foreground text-sm'>
                                {' '}
                                · {t('Today sent: {{count}}', { count: sent })}
                              </span>
                            )
                          })()}
                        </Label>
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          disabled={isSaving || fields.length <= 1}
                          aria-label={t('Remove')}
                          onClick={() => remove(index)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                      <div className='grid gap-4 sm:grid-cols-2'>
                        <FormField
                          control={form.control}
                          name={`SMTPAccounts.${index}.account`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('Sender account')}</FormLabel>
                              <FormControl>
                                <Input
                                  autoComplete='off'
                                  type='email'
                                  mono
                                  placeholder='info@uter.ai'
                                  disabled={isSaving}
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                {t(
                                  'Account used when authenticating with the SMTP server'
                                )}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`SMTPAccounts.${index}.from`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('From Address')}</FormLabel>
                              <FormControl>
                                <Input
                                  autoComplete='off'
                                  mono
                                  placeholder={t(
                                    'New API &lt;noreply@example.com&gt;'
                                  )}
                                  disabled={isSaving}
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                {t(
                                  'Display name and email used in outgoing messages'
                                )}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`SMTPAccounts.${index}.dailyLimit`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('Daily send limit')}</FormLabel>
                              <FormControl>
                                <Input
                                  autoComplete='off'
                                  type='number'
                                  min={0}
                                  disabled={isSaving}
                                  {...field}
                                  onChange={(event) =>
                                    field.onChange(event.target.value)
                                  }
                                />
                              </FormControl>
                              <FormDescription>
                                {t(
                                  '0 uses the default limit of 400 emails per day.'
                                )}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`SMTPAccounts.${index}.token`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {t('Password / Access Token')}
                              </FormLabel>
                              <FormControl>
                                <SecretInput
                                  value={field.value ?? ''}
                                  onChange={field.onChange}
                                  disabled={isSaving}
                                  placeholder={t('Enter new token to update')}
                                />
                              </FormControl>
                              <FormDescription>
                                {t(
                                  'Leave blank to keep the existing credential'
                                )}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type='button'
                  variant='outline'
                  disabled={isSaving}
                  onClick={() =>
                    append({
                      account: '',
                      from: '',
                      dailyLimit: '0',
                      token: '',
                    })
                  }
                  className='mt-2'
                >
                  <Plus />
                  {t('Add sender account')}
                </Button>
                {form.formState.errors.SMTPAccounts?.root?.message && (
                  <p className='text-destructive text-sm'>
                    {form.formState.errors.SMTPAccounts.root.message}
                  </p>
                )}
              </FormItem>
            </>
          )}
          <SettingsControlGroup>
            <FormField
              control={form.control}
              name='QuotaRemindThreshold'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('Default reminder threshold')} ({getCurrencyLabel()})
                  </FormLabel>
                  <FormControl>
                    <Input
                      autoComplete='off'
                      type='number'
                      min={0}
                      step={tokensOnly ? 1 : 0.000001}
                      {...field}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsControlGroup>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
