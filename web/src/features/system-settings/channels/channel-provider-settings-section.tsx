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
import { z } from 'zod'

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
import { SecretInput } from '@/components/ui/secret-input'
import { Textarea } from '@/components/ui/textarea'
import { isMaskedSecret, maskSecret } from '@/lib/secret'

import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  buildChannelProviderUpdates,
  channelProviderOptionKey,
  type ChannelProviderFormValues,
  type ChannelProviderPrefix,
} from './channel-provider-settings-form'
import type { ChannelCredentialDisclosure } from './use-channel-credential-disclosure'

const schema = z.object({
  loginUrl: z.string(),
  username: z.string(),
  password: z.string(),
  apiKey: z.string(),
})

type ChannelProviderSettingsSectionProps = {
  title: string
  description: string
  prefix: ChannelProviderPrefix
  values: ChannelProviderFormValues
  disclosure: ChannelCredentialDisclosure
}

function displaySecret(value: string) {
  return isMaskedSecret(value) ? value : maskSecret(value)
}

export function ChannelProviderSettingsSection(
  props: ChannelProviderSettingsSectionProps
) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const form = useForm<ChannelProviderFormValues>({
    resolver: zodResolver(schema),
    defaultValues: props.values,
  })

  useResetForm(form, props.values)

  const onSubmit = async (values: ChannelProviderFormValues) => {
    const updates = buildChannelProviderUpdates(
      props.prefix,
      values,
      props.values
    )
    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
    form.reset({
      ...values,
      password: displaySecret(values.password),
      apiKey: displaySecret(values.apiKey),
    })
    props.disclosure.hide(channelProviderOptionKey(props.prefix, 'password'))
    props.disclosure.hide(channelProviderOptionKey(props.prefix, 'apiKey'))
  }

  const renderCredentialField = (
    field: 'password' | 'apiKey',
    label: string,
    placeholder: string,
    description: string
  ) => {
    const optionKey = channelProviderOptionKey(props.prefix, field)
    const revealedValue = props.disclosure.revealed[optionKey]
    const isRevealed = revealedValue !== undefined
    const isPending = props.disclosure.pendingKey === optionKey
    let actionLabel = t('Reveal')
    if (isPending) {
      actionLabel = t('Revealing...')
    } else if (isRevealed) {
      actionLabel = t('Hide')
    }

    return (
      <FormField
        control={form.control}
        name={field}
        render={({ field: formField }) => (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <div className='flex flex-col gap-2'>
              <div className='flex gap-2'>
                <FormControl>
                  <SecretInput
                    value={String(formField.value ?? '')}
                    onChange={formField.onChange}
                    placeholder={placeholder}
                    autoComplete='new-password'
                  />
                </FormControl>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='shrink-0'
                  disabled={props.disclosure.isRevealing}
                  onClick={() => {
                    if (isRevealed) {
                      props.disclosure.hide(optionKey)
                      return
                    }
                    void props.disclosure.reveal(optionKey)
                  }}
                >
                  {actionLabel}
                </Button>
              </div>
              {isRevealed ? (
                <Textarea
                  readOnly
                  rows={3}
                  mono
                  value={revealedValue}
                  data-credential-key={optionKey}
                  aria-label={t('Revealed credential')}
                  className='font-mono'
                />
              ) : null}
            </div>
            <FormDescription>{description}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    )
  }

  return (
    <SettingsSection title={t(props.title)}>
      <p className='text-muted-foreground text-sm'>{t(props.description)}</p>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            isSaveDisabled={!form.formState.isDirty || updateOption.isPending}
            saveLabel='Save channel provider settings'
          />

          <FormField
            control={form.control}
            name='loginUrl'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Login URL')}</FormLabel>
                <FormControl>
                  <Input
                    value={String(field.value ?? '')}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder={t('Enter login URL')}
                    autoComplete='off'
                    mono
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'The login URL is saved as the channel base URL when a new channel omits it.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='username'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Username')}</FormLabel>
                <FormControl>
                  <Input
                    value={String(field.value ?? '')}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder={t('Enter username')}
                    autoComplete='off'
                  />
                </FormControl>
                <FormDescription>
                  {t('Username used to sign in to the upstream console.')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {renderCredentialField(
            'password',
            t('Password'),
            t('Enter new password to update'),
            t('Leave blank to keep the existing password.')
          )}
          {renderCredentialField(
            'apiKey',
            t('API Key'),
            t('Enter new API key to update'),
            t('Leave blank to keep the existing API key.')
          )}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
