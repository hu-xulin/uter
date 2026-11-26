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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useMemo, useRef, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
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
import { Label } from '@/components/ui/label'
import { SecretInput } from '@/components/ui/secret-input'
import { SecretTextarea } from '@/components/ui/secret-textarea'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { isMaskedSecret, maskMultilineSecret, maskSecret } from '@/lib/secret'

import {
  getUterAPIPricingGroups,
  type UterAPIPricingGroup,
} from '../../channels/api'
import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  CHANNEL_PROVIDER_CREDENTIAL_MODES,
  CHANNEL_PROVIDER_CREDENTIAL_STRATEGIES,
  channelProviderSlotAPIKeyOption,
  createChannelProviderCredentialSlot,
  maskChannelProviderCredentialSlots,
  type ChannelProviderCredentialMode,
  type ChannelProviderCredentialSlot,
  type ChannelProviderCredentialStrategy,
} from './channel-provider-credential-slots'
import {
  buildChannelProviderUpdates,
  channelProviderOptionKey,
  type ChannelProviderFormValues,
  type ChannelProviderPrefix,
} from './channel-provider-settings-form'
import type { ChannelCredentialDisclosure } from './use-channel-credential-disclosure'

const credentialSlotSchema = z.object({
  slotId: z.string(),
  group: z.string(),
  label: z.string(),
  mode: z.enum(['single', 'batch', 'multi_to_single']),
  strategy: z.enum(['random', 'polling']),
  apiKey: z.string(),
})

const schema = z.object({
  loginUrl: z.string(),
  username: z.string(),
  password: z.string(),
  apiKey: z.string(),
  apiUrl: z.string(),
  accessKeyId: z.string().optional(),
  accessKeySecret: z.string().optional(),
  slots: z.array(credentialSlotSchema),
})

type ChannelProviderSettingsSectionProps = {
  title: string
  description: string
  prefix: ChannelProviderPrefix
  values: ChannelProviderFormValues
  disclosure: ChannelCredentialDisclosure
}

function displaySecret(value: string, multiline = false) {
  if (isMaskedSecret(value)) return value
  return multiline ? maskMultilineSecret(value) : maskSecret(value)
}

export function ChannelProviderSettingsSection(
  props: ChannelProviderSettingsSectionProps
) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const queryClient = useQueryClient()
  // Each option write invalidates ['system-options'] and refetches. Once a
  // save succeeds, keep suppressing default-value resets: the save handler
  // owns the form state from then on and writes the masked values itself. A
  // stale refetch queued by an earlier write would otherwise replay the
  // pre-save snapshot after the handler finishes.
  const resetPauseRef = useRef(false)
  const [defaultSlot] = useState(() => createChannelProviderCredentialSlot())
  const initialValues = useMemo<ChannelProviderFormValues>(
    () => ({
      ...props.values,
      slots:
        props.values.slots?.length > 0 ? props.values.slots : [defaultSlot],
    }),
    [props.values, defaultSlot]
  )
  const form = useForm<ChannelProviderFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  })
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'slots',
  })

  useResetForm(form, initialValues, resetPauseRef)

  const isSubscription = props.prefix === 'subscription'
  const isBailian = props.prefix === 'bailian'
  const groupsQuery = useQuery({
    queryKey: ['uterapi-pricing-groups'],
    queryFn: async () => {
      const response = await getUterAPIPricingGroups()
      return (response.data?.groups ?? []) as UterAPIPricingGroup[]
    },
    enabled: isSubscription,
    staleTime: 5 * 60 * 1000,
    retry: false,
    meta: { errorToast: false },
  })
  const groupOptions = useMemo(
    () =>
      (groupsQuery.data ?? []).map((group) => ({
        value: group.key,
        label: group.name || group.key,
      })),
    [groupsQuery.data]
  )
  const watchedSlots = useWatch({ control: form.control, name: 'slots' })

  const onSubmit = async (values: ChannelProviderFormValues) => {
    resetPauseRef.current = true
    try {
      const updates = buildChannelProviderUpdates(
        props.prefix,
        values,
        props.values.slots?.length > 0 ? props.values : initialValues
      )
      for (const update of updates) {
        await updateOption.mutateAsync(update)
      }
      // Every mutation invalidates the same query, so an earlier refetch can
      // still be in flight with a partially written snapshot. Cancel those
      // readers before loading the final state; otherwise one of them can
      // resolve after the pause is released and overwrite the saved form.
      await queryClient.cancelQueries({ queryKey: ['system-options'] })
      await queryClient.refetchQueries({
        queryKey: ['system-options'],
        type: 'active',
      })

      const resetValues = {
        ...values,
        password: displaySecret(values.password),
        // API Key 一行一个，保存后按行掩码展示，与创建渠道时的多行形态一致。
        apiKey: displaySecret(values.apiKey, true),
        accessKeyId: displaySecret(values.accessKeyId ?? ''),
        accessKeySecret: displaySecret(values.accessKeySecret ?? ''),
        slots: maskChannelProviderCredentialSlots(values.slots, (value) =>
          displaySecret(value, true)
        ),
      }
      form.reset(resetValues)
      // 保存成功后必须解除暂停：否则切换到另一个渠道 section 时，新的
      // initialValues 会被 useResetForm 永久跳过，上一个渠道的凭证槽（含
      // slot id）残留并被下一次保存写回，覆盖其它渠道的分组元数据。
      // 此时 refetch 已完成、form.reset 已写入本渠道掩码，解除是安全的。
      resetPauseRef.current = false
      props.disclosure.hide(channelProviderOptionKey(props.prefix, 'password'))
      props.disclosure.hide(channelProviderOptionKey(props.prefix, 'apiKey'))
      if (isBailian) {
        props.disclosure.hide(
          channelProviderOptionKey(props.prefix, 'accessKeyId')
        )
        props.disclosure.hide(
          channelProviderOptionKey(props.prefix, 'accessKeySecret')
        )
      }
      for (const slot of values.slots) {
        props.disclosure.hide(
          channelProviderSlotAPIKeyOption(props.prefix, slot.slotId)
        )
      }
    } catch (error) {
      resetPauseRef.current = false
      throw error
    }
  }

  const renderCredentialField = (
    field: 'password' | 'apiKey' | 'accessKeyId' | 'accessKeySecret',
    label: string,
    placeholder: string,
    description: string,
    multiline = false,
    hint?: ReactNode
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
                  {multiline ? (
                    // API Key 与创建渠道时一致：一行一个 key。服务端的掩码、
                    // 保存与自动填充都按多行处理，这里必须用多行组件承载，
                    // 否则换行被单行 input 吞掉，自动读取时拿到的是被压平的
                    // 单个字符串，而不是原本的一行一个 key。
                    <SecretTextarea
                      value={String(formField.value ?? '')}
                      onChange={formField.onChange}
                      placeholder={placeholder}
                      rows={4}
                    />
                  ) : (
                    <SecretInput
                      value={String(formField.value ?? '')}
                      onChange={formField.onChange}
                      placeholder={placeholder}
                      autoComplete='new-password'
                    />
                  )}
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
            {hint}
            <FormDescription>{description}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    )
  }

  const updateSlot = (
    index: number,
    patch: Partial<ChannelProviderCredentialSlot>
  ) => {
    const current = form.getValues(`slots.${index}`)
    if (!current) return
    form.setValue(
      `slots.${index}`,
      { ...current, ...patch },
      { shouldDirty: true, shouldValidate: true }
    )
  }

  return (
    <SettingsSection title={t(props.title)}>
      <p className='text-muted-foreground text-sm'>{t(props.description)}</p>
      <Form {...form}>
        <SettingsForm
          onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
          autoComplete='off'
        >
          <SettingsPageFormActions
            onSave={() => void form.handleSubmit(onSubmit)()}
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
                    'Console login URL is used only for WorkBuddy to sign in to the upstream back office. It is NOT used to fetch models or prices.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='apiUrl'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('API address')}</FormLabel>
                <FormControl>
                  <Input
                    value={String(field.value ?? '')}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder={t('Enter API address')}
                    autoComplete='off'
                    mono
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'API address is used to fetch the model catalogue and prices. Leave empty to keep the channel built-in address. Do not add /v1 or a trailing slash.'
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

          {isBailian ? (
            <div className='space-y-4 rounded-lg border p-4'>
              <div className='space-y-1'>
                <h3 className='font-medium'>{t('Alibaba Cloud AccessKey')}</h3>
                <p className='text-muted-foreground text-sm'>
                  {t(
                    'Used by Model Studio OpenAPI to list region models without console login. A RAM user needs modelstudio:ListModels permission.'
                  )}
                </p>
              </div>
              {renderCredentialField(
                'accessKeyId',
                t('Access Key ID'),
                t('Enter Access Key ID'),
                t(
                  'The Access Key ID is stored masked and revealed only after verification.'
                )
              )}
              {renderCredentialField(
                'accessKeySecret',
                t('Access Key Secret'),
                t('Enter new Access Key Secret to update'),
                t(
                  'Leave blank to keep the existing Access Key Secret. Stored encrypted.'
                )
              )}
            </div>
          ) : null}

          <div className='space-y-4'>
            <div className='space-y-1'>
              <h3 className='font-medium'>{t('Grouped API keys')}</h3>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'Add one row per group. Each row can use its own key mode. A saved key is shown as a mask; type new keys to replace it.'
                )}
              </p>
            </div>
            {fields.map((field, index) => {
              const slot =
                watchedSlots[index] ?? (field as ChannelProviderCredentialSlot)
              const optionKey = channelProviderSlotAPIKeyOption(
                props.prefix,
                slot.slotId
              )
              const revealedValue = props.disclosure.revealed[optionKey]
              const isRevealed = revealedValue !== undefined
              const isPending = props.disclosure.pendingKey === optionKey
              return (
                <section
                  key={field.id}
                  className='space-y-3 rounded-lg border p-4'
                  aria-label={t('Group {{index}}', { index: index + 1 })}
                >
                  <div className='flex items-center justify-between gap-2'>
                    <span className='font-medium'>
                      {t('Group {{index}}', { index: index + 1 })}
                    </span>
                    {fields.length > 1 && (
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => remove(index)}
                      >
                        {t('Remove')}
                      </Button>
                    )}
                  </div>

                  <div className='space-y-2'>
                    <Label>{t('Key group')}</Label>
                    {isSubscription && groupOptions.length > 0 ? (
                      <Select
                        value={slot.group}
                        onValueChange={(value) =>
                          updateSlot(index, { group: value ?? '' })
                        }
                        items={groupOptions}
                      >
                        <SelectTrigger
                          aria-label={t('Key group {{index}}', {
                            index: index + 1,
                          })}
                        >
                          <SelectValue placeholder={t('Choose a group')} />
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                          <SelectGroup>
                            {groupOptions.map((group) => (
                              <SelectItem key={group.value} value={group.value}>
                                {group.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={slot.group}
                        onChange={(event) =>
                          updateSlot(index, { group: event.target.value })
                        }
                        placeholder={
                          isSubscription ? t('Choose a group') : 'default'
                        }
                        aria-label={t('Key group {{index}}', {
                          index: index + 1,
                        })}
                      />
                    )}
                    <p className='text-muted-foreground text-sm'>
                      {t(
                        'Saved keys are masked. Type new keys to replace them.'
                      )}
                    </p>
                  </div>

                  <div className='space-y-2'>
                    <Label>{t('Add Mode')}</Label>
                    <Select
                      value={slot.mode}
                      onValueChange={(value) =>
                        updateSlot(index, {
                          mode: value as ChannelProviderCredentialMode,
                        })
                      }
                      items={CHANNEL_PROVIDER_CREDENTIAL_MODES.map(
                        (option) => ({
                          value: option.value,
                          label: t(option.label),
                        })
                      )}
                    >
                      <SelectTrigger
                        aria-label={t('Add Mode {{index}}', {
                          index: index + 1,
                        })}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          {CHANNEL_PROVIDER_CREDENTIAL_MODES.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {t(option.label)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  {slot.mode === 'multi_to_single' && (
                    <div className='space-y-2'>
                      <Label>{t('Rotation strategy')}</Label>
                      <Select
                        value={slot.strategy}
                        onValueChange={(value) =>
                          updateSlot(index, {
                            strategy:
                              value as ChannelProviderCredentialStrategy,
                          })
                        }
                        items={CHANNEL_PROVIDER_CREDENTIAL_STRATEGIES.map(
                          (option) => ({
                            value: option.value,
                            label: t(option.label),
                          })
                        )}
                      >
                        <SelectTrigger
                          aria-label={t('Rotation strategy {{index}}', {
                            index: index + 1,
                          })}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                          <SelectGroup>
                            {CHANNEL_PROVIDER_CREDENTIAL_STRATEGIES.map(
                              (option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {t(option.label)}
                                </SelectItem>
                              )
                            )}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className='space-y-2'>
                    <Label>{t('API keys')}</Label>
                    <SecretTextarea
                      aria-label={t('API keys {{index}}', { index: index + 1 })}
                      value={slot.apiKey}
                      onChange={(value) => updateSlot(index, { apiKey: value })}
                      placeholder={t('One key per line')}
                      rows={3}
                      revealedValue={revealedValue ?? null}
                      isRevealing={isPending}
                      onReveal={() => {
                        if (isRevealed) props.disclosure.hide(optionKey)
                        else void props.disclosure.reveal(optionKey)
                      }}
                      onHide={() => props.disclosure.hide(optionKey)}
                    />
                  </div>
                </section>
              )
            })}
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={fields.length >= 20}
              onClick={() => append(createChannelProviderCredentialSlot())}
            >
              {t('Add group')}
            </Button>
          </div>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
