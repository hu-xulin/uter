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
import { useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'

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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { DEFAULT_CURRENCY_CONFIG } from '@/stores/system-config-store'

import { syncExchangeRate } from '../api'
import { FormDirtyIndicator } from '../components/form-dirty-indicator'
import { FormNavigationGuard } from '../components/form-navigation-guard'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useSettingsForm } from '../hooks/use-settings-form'
import { syncStatusNow, useUpdateOption } from '../hooks/use-update-option'
import { safeNumberFieldProps } from '../utils/numeric-field'
import { formatPriceAdjustment } from '../utils/price-adjustment'

const createPricingSchema = (t: (key: string) => string) =>
  z
    .object({
      QuotaPerUnit: z.coerce.number().min(0, t('Value must be at least 0')),
      USDExchangeRate: z.coerce
        .number()
        .min(0.0001, t('Exchange rate must be greater than 0')),
      DisplayInCurrencyEnabled: z.boolean(),
      DisplayTokenStatEnabled: z.boolean(),
      general_setting: z.object({
        quota_display_type: z.enum(['USD', 'CNY', 'TOKENS', 'CUSTOM']),
        custom_currency_symbol: z.string().max(8).optional(),
        custom_currency_exchange_rate: z.coerce
          .number()
          .min(0.0001, t('Exchange rate must be greater than 0'))
          .optional(),
      }),
    })
    .superRefine((data, ctx) => {
      const displayType = data.general_setting.quota_display_type

      if (displayType === 'CUSTOM') {
        if (!data.general_setting.custom_currency_symbol?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['general_setting', 'custom_currency_symbol'],
            message: t('Custom currency symbol is required'),
          })
        }

        if (data.general_setting.custom_currency_exchange_rate == null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['general_setting', 'custom_currency_exchange_rate'],
            message: t('Exchange rate is required'),
          })
        }
      }
    })

type PricingFormValues = z.infer<ReturnType<typeof createPricingSchema>>

type PricingSectionProps = {
  defaultValues: PricingFormValues
  /** A 最近一次成功同步的时间（Unix 秒，0 / 缺省表示从未同步）。 */
  exchangeRateUpdatedAt?: number
  /** B 相对 A 的有符号调整量，由后端下发（PriceAdjustmentRate，当前 −0.2）。 */
  priceAdjustmentRate?: number
}

export function PricingSection({
  defaultValues,
  exchangeRateUpdatedAt = 0,
  priceAdjustmentRate = -0.2,
}: PricingSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const queryClient = useQueryClient()
  const [lastSyncedAt, setLastSyncedAt] = useState(exchangeRateUpdatedAt)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    setLastSyncedAt(exchangeRateUpdatedAt)
  }, [exchangeRateUpdatedAt])

  const pricingSchema = createPricingSchema(t)

  const { form, handleSubmit, handleReset, isDirty, isSubmitting } =
    useSettingsForm<PricingFormValues>({
      resolver: zodResolver(pricingSchema) as Resolver<
        PricingFormValues,
        unknown,
        PricingFormValues
      >,
      defaultValues,
      onSubmit: async (_data, changedFields) => {
        for (const [key, value] of Object.entries(changedFields)) {
          if (value === undefined || value === null) continue
          if (typeof value === 'object') continue

          let serialized: string | boolean = value as string | boolean

          if (typeof value === 'boolean') {
            serialized = String(value)
          } else if (typeof value === 'number') {
            serialized = Number.isFinite(value) ? String(value) : '0'
          }

          await updateOption.mutateAsync({
            key,
            value: serialized,
          })
        }
      },
    })

  // 立即拉取一次行情：后端会同时写入 A（汇率）与 B（定价 = A − 0.2），
  // 这里就地刷新 A 的显示、同步时间，并把 system-options / status 缓存打新，
  // 让「支付网关」页与钱包不必等下一个 10 分钟周期。
  const handleSyncExchangeRate = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      const result = await syncExchangeRate()
      if (!result.success || !result.data) {
        toast.error(result.message || t('Failed to sync exchange rate'))
        return
      }
      form.setValue('USDExchangeRate', result.data.usd_exchange_rate, {
        shouldDirty: false,
      })
      setLastSyncedAt(result.data.exchange_rate_updated_at)
      queryClient.invalidateQueries({ queryKey: ['system-options'] })
      await syncStatusNow(queryClient)
      toast.success(
        t('Exchange rate synced: 1 USD = {{rate}}', {
          rate: result.data.usd_exchange_rate.toFixed(2),
        })
      )
    } catch {
      toast.error(t('Failed to sync exchange rate'))
    } finally {
      setSyncing(false)
    }
  }

  const displayType = form.watch('general_setting.quota_display_type') ?? 'USD'
  const displayInCurrencyEnabled = form.watch('DisplayInCurrencyEnabled')
  const showTokensOnlyOption = displayType === 'TOKENS'
  const showQuotaPerUnit =
    displayType === 'TOKENS' ||
    defaultValues.QuotaPerUnit !== DEFAULT_CURRENCY_CONFIG.quotaPerUnit
  const showDisplayInCurrencyOption = displayInCurrencyEnabled === false

  let exchangeRateLabel = t('USD Exchange Rate')
  if (displayType === 'CNY') {
    exchangeRateLabel = t('CNY per USD')
  } else if (displayType === 'USD') {
    exchangeRateLabel = t('USD Exchange Rate')
  }

  return (
    <>
      <FormNavigationGuard when={isDirty} />

      <SettingsSection title={t('Pricing & Display')}>
        <Form {...form}>
          <SettingsForm onSubmit={handleSubmit}>
            <SettingsPageFormActions
              onSave={handleSubmit}
              onReset={handleReset}
              isSaving={updateOption.isPending || isSubmitting}
              isResetDisabled={!isDirty}
            />
            <FormDirtyIndicator isDirty={isDirty} />
            {showQuotaPerUnit && (
              <FormField
                control={form.control}
                name='QuotaPerUnit'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Quota Per Unit')}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete='off'
                        type='number'
                        step='0.01'
                        value={field.value as number}
                        disabled
                        name={field.name}
                        onBlur={field.onBlur}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Number of tokens per unit quota')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name='general_setting.quota_display_type'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Display Mode')}</FormLabel>
                  <Select
                    items={[
                      { value: 'USD', label: t('USD') },
                      { value: 'CNY', label: t('CNY') },
                      { value: 'CUSTOM', label: t('Custom Currency') },
                      { value: 'TOKENS', label: t('Tokens Only') },
                    ]}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('Select display mode')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        <SelectItem value='USD'>{t('USD')}</SelectItem>
                        <SelectItem value='CNY'>{t('CNY')}</SelectItem>
                        <SelectItem value='CUSTOM'>
                          {t('Custom Currency')}
                        </SelectItem>
                        {showTokensOnlyOption && (
                          <SelectItem value='TOKENS'>
                            {t('Tokens Only')}
                          </SelectItem>
                        )}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t('Choose how quota values are shown to users')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {displayType !== 'TOKENS' && (
              <FormField
                control={form.control}
                name='USDExchangeRate'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{exchangeRateLabel}</FormLabel>
                    <div className='flex flex-wrap items-start gap-2'>
                      <FormControl>
                        <Input
                          autoComplete='off'
                          placeholder='7.25'
                          type='number'
                          step='0.01'
                          className='flex-1'
                          {...safeNumberFieldProps(field)}
                          disabled
                        />
                      </FormControl>
                      <Button
                        type='button'
                        variant='outline'
                        onClick={handleSyncExchangeRate}
                        disabled={syncing}
                      >
                        <RefreshCw
                          className={cn('h-4 w-4', syncing && 'animate-spin')}
                        />
                        {syncing ? t('Syncing') : t('Sync now')}
                      </Button>
                    </div>
                    <FormDescription>
                      {t(
                        'Fetched automatically from the market USD to CNY rate every 10 minutes, so this field is read-only. The payment price in the Payment Gateway settings is derived from it as the exchange rate {{adjustment}}, which is deducted automatically.',
                        {
                          adjustment:
                            formatPriceAdjustment(priceAdjustmentRate),
                        }
                      )}
                    </FormDescription>
                    <FormDescription>
                      {lastSyncedAt > 0
                        ? t('Last synced: {{time}}', {
                            time: new Date(
                              lastSyncedAt * 1000
                            ).toLocaleString(),
                          })
                        : t('Not synced yet')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {displayType === 'CUSTOM' && (
              <div className='flex flex-col gap-4'>
                <FormField
                  control={form.control}
                  name='general_setting.custom_currency_symbol'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Custom Currency Symbol')}</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete='off'
                          type='text'
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          maxLength={8}
                          placeholder={t('e.g. ¥ or HK$')}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('Prefix used when displaying prices')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='general_setting.custom_currency_exchange_rate'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Units per USD')}</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete='off'
                          type='number'
                          step='0.01'
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ''
                                ? undefined
                                : e.target.valueAsNumber
                            )
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          placeholder={t('e.g. 8 means 1 USD = 8 units')}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('Conversion rate from USD to your custom currency')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {showDisplayInCurrencyOption && (
              <FormField
                control={form.control}
                name='DisplayInCurrencyEnabled'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>{t('Display in Currency')}</FormLabel>
                      <FormDescription>
                        {displayType === 'TOKENS'
                          ? t(
                              'Tokens-only mode will show raw quota values regardless of this toggle.'
                            )
                          : t('Show prices in currency instead of quota.')}
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
            )}

            <FormField
              control={form.control}
              name='DisplayTokenStatEnabled'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t('Display Token Statistics')}</FormLabel>
                    <FormDescription>
                      {t('Show token usage statistics in the UI')}
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
          </SettingsForm>
        </Form>
      </SettingsSection>
    </>
  )
}
