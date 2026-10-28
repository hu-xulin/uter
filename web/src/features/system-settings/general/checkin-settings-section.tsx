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
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

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
import {
  formatBillingCurrencyFromUSD,
  getCurrencyDisplay,
  getCurrencyLabel,
} from '@/lib/currency'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const schema = z.object({
  enabled: z.boolean(),
  minQuota: z.coerce.number().int().min(0),
  maxQuota: z.coerce.number().int().min(0),
})

type Values = z.infer<typeof schema>

/**
 * Check-in rewards are stored in raw quota units — the same integer unit as
 * `users.quota`, where `quotaPerUnit` (500,000 by default) equals 1 USD. They
 * are *not* dollars, so a value of 1000 is 1000 tokens ≈ $0.002, not $1000.
 *
 * The hint is rendered as money (even when the site is configured to display
 * balances as tokens) so an admin can sanity-check the amount they typed.
 */
function formatQuotaHint(quota: number): string {
  if (!Number.isFinite(quota)) return '-'
  const { config } = getCurrencyDisplay()
  return formatBillingCurrencyFromUSD(quota / config.quotaPerUnit)
}

/**
 * The field stores raw quota units, so its unit label has to follow the site's
 * display type: with `quotaDisplayType: 'TOKENS'` one quota unit renders as one
 * token and "Tokens" is accurate, but with USD/CNY/CUSTOM the same number is a
 * fraction of a dollar and calling it "Tokens" makes operators configure the
 * reward two orders of magnitude off.
 */
function quotaUnitLabel(t: (key: string) => string): string {
  return getCurrencyLabel() === 'Tokens' ? t('Tokens') : t('Quota units')
}

export function CheckinSettingsSection({
  defaultValues,
}: {
  defaultValues: {
    enabled: boolean
    minQuota: number
    maxQuota: number
  }
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: {
      enabled: defaultValues.enabled,
      minQuota: defaultValues.minQuota,
      maxQuota: defaultValues.maxQuota,
    },
  })

  const { isDirty, isSubmitting } = form.formState
  const enabled = form.watch('enabled')

  // Watched live so the USD-equivalent hint recomputes on every keystroke,
  // independent of validation timing.
  const minQuota = useWatch({ control: form.control, name: 'minQuota' })
  const maxQuota = useWatch({ control: form.control, name: 'maxQuota' })

  async function onSubmit(values: Values) {
    const updates: Array<{ key: string; value: string }> = []

    if (values.enabled !== defaultValues.enabled) {
      updates.push({
        key: 'checkin_setting.enabled',
        value: String(values.enabled),
      })
    }

    if (values.minQuota !== defaultValues.minQuota) {
      updates.push({
        key: 'checkin_setting.min_quota',
        value: String(values.minQuota),
      })
    }

    if (values.maxQuota !== defaultValues.maxQuota) {
      updates.push({
        key: 'checkin_setting.max_quota',
        value: String(values.maxQuota),
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
  }

  return (
    <SettingsSection title={t('Check-in Settings')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending || isSubmitting}
            isSaveDisabled={!isDirty}
            saveLabel='Save check-in settings'
          />
          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable check-in feature')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Allow users to check in daily for random quota rewards'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={updateOption.isPending || isSubmitting}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          {enabled && (
            <div className='flex flex-col gap-6'>
              <FormField
                control={form.control}
                name='minQuota'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('Minimum check-in quota ({{unit}})', {
                        unit: quotaUnitLabel(t),
                      })}
                    </FormLabel>
                    <FormControl>
                      <Input
                        autoComplete='off'
                        type='number'
                        min={0}
                        placeholder={t('1000')}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Minimum quota amount awarded for check-in (≈ {{amount}})',
                        { amount: formatQuotaHint(minQuota) }
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='maxQuota'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('Maximum check-in quota ({{unit}})', {
                        unit: quotaUnitLabel(t),
                      })}
                    </FormLabel>
                    <FormControl>
                      <Input
                        autoComplete='off'
                        type='number'
                        min={0}
                        placeholder={t('10000')}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Maximum quota amount awarded for check-in (≈ {{amount}})',
                        { amount: formatQuotaHint(maxQuota) }
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
