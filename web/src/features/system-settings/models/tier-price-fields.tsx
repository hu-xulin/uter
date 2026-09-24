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

For commercial licensing, please contact support@Uter.ai.com
*/
import { ChevronDown, RefreshCw } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  getOfficialPricingReference,
  getPresetPrices,
  type PresetPriceSource,
} from '@/features/model-pricing/api'
import {
  formatPricingAmount,
  type PricingCurrency,
} from '@/features/model-pricing/currency'
import { PricingAmountInput } from '@/features/model-pricing/pricing-amount-input'
import { BILLING_EXTRA_VARS } from '@/features/pricing/lib/billing-expr'
import type { VisualPrice } from '@/features/pricing/lib/billing-expression/visual'
import {
  CACHE_MODE_GENERIC,
  CACHE_MODE_TIMED,
  type CacheMode,
} from '@/features/pricing/lib/tier-expr'
import { cn } from '@/lib/utils'

import {
  computeDimensionDiscount,
  formatGeneratedPriceUSD,
  officialRequestPriceUSD,
  officialTierVariablePriceUSD,
  platformTierVariablePricesUSD,
  toNumberOrNull,
} from './model-pricing-core'

const PRICE_VARS = BILLING_EXTRA_VARS.map((variable) => ({
  ...variable,
  key: variable.key as VisualPrice['variable'],
}))
const CACHE_PRICE_VARS = PRICE_VARS.filter(
  (variable) => variable.group === 'cache' && variable.key !== 'img_cr'
)
const MEDIA_PRICE_ORDER = ['img', 'img_cr', 'img_o', 'ai', 'ao']
const MEDIA_PRICE_VARS = PRICE_VARS.filter(
  (variable) => variable.group === 'media' || variable.key === 'img_cr'
).sort(
  (left, right) =>
    MEDIA_PRICE_ORDER.indexOf(left.key) - MEDIA_PRICE_ORDER.indexOf(right.key)
)
type PriceFieldProps = {
  currency: PricingCurrency
  label: string
  hint?: string
  value: number | string
  onChange: (next: string) => void
  included?: boolean
  onInclude?: (included: boolean) => void
  invalid?: boolean
}

function PriceField({
  label,
  hint,
  value,
  onChange,
  currency,
  included,
  onInclude,
  invalid,
}: PriceFieldProps) {
  const id = useId()
  const { t } = useTranslation()
  return (
    <div className='w-36 space-y-0.5'>
      <div className='flex items-center gap-1'>
        {onInclude && (
          <Checkbox
            aria-label={t('Include {{price}}', { price: label })}
            checked={included}
            onCheckedChange={(checked) => onInclude(checked === true)}
          />
        )}
        <Label htmlFor={id} className='text-muted-foreground text-xs'>
          {label}
        </Label>
      </div>
      <PricingAmountInput
        id={id}
        currency={currency}
        aria-label={label}
        value={value}
        onChange={onChange}
        disabled={included === false}
        aria-invalid={invalid || undefined}
        className='h-8 w-full'
      />
      {hint && <p className='text-muted-foreground text-xs'>{hint}</p>}
    </div>
  )
}

type TierPriceFieldsProps = {
  modelName?: string
  billingUnit?: 'token' | 'request'
  fixedPrice?: string
  onBillingUnitChange?: (unit: 'token' | 'request') => void
  onFixedPriceChange?: (value: string) => void
  currency: PricingCurrency
  prices: Partial<Record<VisualPrice['variable'], number | string>>
  onChange: (variable: VisualPrice['variable'], value: string) => void
  onInclude?: (variable: VisualPrice['variable'], included: boolean) => void
  /** Applies several variable prices at once, including missing ones. */
  onApplyPrices?: (
    updates: Partial<Record<VisualPrice['variable'], string>>
  ) => void
  cacheMode?: CacheMode
  onCacheModeChange?: (mode: CacheMode) => void
  invalidVariables?: string[]
}

const PRESET_SOURCE_OPTIONS: { value: PresetPriceSource; label: string }[] = [
  { value: 'official', label: 'Official pricing preset' },
  { value: 'models.dev', label: 'models.dev pricing preset' },
]

/** Formats a per-dimension discount for display under a Uter price input. */
function discountHintText(
  discount: ReturnType<typeof computeDimensionDiscount>
): string | undefined {
  if (!discount || discount.tone === 'flat') return undefined
  if (discount.tone === 'markup') return `+${Math.round(discount.percent)}%`
  const zhe = discount.zhe ?? 10
  const zheStr =
    Math.abs(zhe - Math.round(zhe)) < 1e-6
      ? String(Math.round(zhe))
      : zhe.toFixed(1)
  return `-${Math.round(discount.percent)}% · ${zheStr}折`
}

export function TierPriceFields(props: TierPriceFieldsProps) {
  const { t } = useTranslation()
  const modelName = props.modelName?.trim() ?? ''
  const showReference = modelName !== ''
  const [officialSource, setOfficialSource] =
    useState<PresetPriceSource>('official')
  const [officialPrices, setOfficialPrices] = useState<
    Record<string, Record<string, number>> | undefined
  >(undefined)
  const [officialLoading, setOfficialLoading] = useState(false)
  const [officialError, setOfficialError] = useState(false)
  const [discountText, setDiscountText] = useState('')
  const [fetchingChannel, setFetchingChannel] = useState(false)
  const officialRatios = officialPrices?.[modelName]

  useEffect(() => {
    if (!showReference) return
    let cancelled = false
    setOfficialLoading(true)
    void getPresetPrices(officialSource)
      .then((prices) => {
        if (!cancelled) {
          setOfficialPrices(prices)
          setOfficialError(false)
        }
      })
      .catch(() => {
        if (!cancelled) setOfficialError(true)
      })
      .finally(() => {
        if (!cancelled) setOfficialLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [showReference, officialSource, modelName])

  const handleSyncOfficialPrices = async () => {
    if (!showReference) return
    setOfficialLoading(true)
    try {
      const prices = await getPresetPrices(officialSource, true)
      setOfficialPrices(prices)
      setOfficialError(false)
      toast.success(t('Official prices synced.'))
    } catch {
      setOfficialError(true)
      toast.error(t('Failed to sync prices'))
    } finally {
      setOfficialLoading(false)
    }
  }

  /** Generates Uter prices = official price × discount for priced dimensions. */
  const applyDiscountPrices = (discount: number) => {
    if (!officialRatios) return
    const updates: Partial<Record<VisualPrice['variable'], string>> = {}
    for (const variable of PRICE_VARS) {
      const officialUSD = officialTierVariablePriceUSD(
        officialRatios,
        variable.key
      )
      if (officialUSD == null) continue
      const isCore = variable.key === 'p' || variable.key === 'c'
      const included = props.onInclude
        ? props.prices[variable.key] !== undefined
        : true
      if (!isCore && !included) continue
      updates[variable.key] = formatGeneratedPriceUSD(officialUSD * discount)
    }
    if (Object.keys(updates).length > 0) props.onApplyPrices?.(updates)
  }

  const handleDiscountChange = (text: string) => {
    setDiscountText(text)
    const value = Number(text)
    if (text.trim() === '' || !Number.isFinite(value) || value <= 0) return
    applyDiscountPrices(value)
  }

  /** Prefills Uter prices from the platform's own (自定义渠道) pricing. */
  const handleFetchFromChannel = async () => {
    if (!showReference) return
    setFetchingChannel(true)
    try {
      const { platformPrices } = await getOfficialPricingReference()
      const entry = platformPrices[modelName]
      const usdPrices = entry ? platformTierVariablePricesUSD(entry) : undefined
      if (!usdPrices || Object.keys(usdPrices).length === 0) {
        toast.error(
          t('No custom channel pricing found for {{model}}.', {
            model: modelName,
          })
        )
        return
      }
      const updates: Partial<Record<VisualPrice['variable'], string>> = {}
      for (const [variable, usd] of Object.entries(usdPrices)) {
        const isCore = variable === 'p' || variable === 'c'
        const included = props.onInclude
          ? props.prices[variable as VisualPrice['variable']] !== undefined
          : true
        if (!isCore && !included) continue
        updates[variable as VisualPrice['variable']] = formatGeneratedPriceUSD(
          usd as number
        )
      }
      if (Object.keys(updates).length > 0) {
        props.onApplyPrices?.(updates)
      } else {
        toast.error(
          t('No custom channel pricing found for {{model}}.', {
            model: modelName,
          })
        )
      }
    } catch {
      toast.error(t('Failed to load model pricing'))
    } finally {
      setFetchingChannel(false)
    }
  }

  const hasMediaPricing = MEDIA_PRICE_VARS.some((variable) =>
    props.onInclude
      ? props.prices[variable.key] !== undefined
      : Number(props.prices[variable.key] ?? 0) > 0
  )
  const [mediaOpen, setMediaOpen] = useState(hasMediaPricing)
  useEffect(() => {
    if (hasMediaPricing) setMediaOpen(true)
  }, [hasMediaPricing])
  const renderPriceVariable = (variable: {
    key: VisualPrice['variable']
    label: string
  }) => {
    const officialUSD = showReference
      ? officialTierVariablePriceUSD(officialRatios, variable.key)
      : null
    const discount = showReference
      ? computeDimensionDiscount(
          toNumberOrNull(props.prices[variable.key]),
          officialUSD
        )
      : null
    return (
      <PriceField
        key={variable.key}
        currency={props.currency}
        label={
          variable.key === 'cc' && props.prices.cc1h !== undefined
            ? t('Cache Creation (5m)')
            : t(variable.label)
        }
        value={props.prices[variable.key] ?? 0}
        onChange={(value) => props.onChange(variable.key, value)}
        included={
          props.onInclude ? props.prices[variable.key] !== undefined : undefined
        }
        onInclude={
          props.onInclude
            ? (included) => props.onInclude?.(variable.key, included)
            : undefined
        }
        invalid={props.invalidVariables?.includes(variable.key)}
        hint={discountHintText(discount)}
      />
    )
  }
  const billingControl = props.onBillingUnitChange && (
    <Select
      items={[
        { value: 'token', label: t('Per token') },
        { value: 'request', label: t('Per-call') },
      ]}
      value={props.billingUnit ?? 'token'}
      onValueChange={(value) => {
        if (value === 'token' || value === 'request') {
          props.onBillingUnitChange?.(value)
        }
      }}
    >
      <SelectTrigger
        aria-label={t('Tier billing mode')}
        size='sm'
        className='w-full sm:w-48'
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          <SelectItem value='token'>{t('Per token')}</SelectItem>
          <SelectItem value='request'>{t('Per-call')}</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
  if (props.billingUnit === 'request') {
    const officialUSD = showReference
      ? officialRequestPriceUSD(officialRatios)
      : null
    const discount = showReference
      ? computeDimensionDiscount(
          toNumberOrNull(props.fixedPrice),
          officialUSD
        )
      : null
    const discountHint = discountHintText(discount)
    const officialHint =
      officialUSD != null
        ? `${t('Official price')}: ${formatPricingAmount(officialUSD, props.currency)}`
        : undefined
    return (
      <>
        {billingControl}
        <PriceField
          currency={props.currency}
          label={t('Price per request')}
          value={props.fixedPrice ?? ''}
          onChange={(value) => props.onFixedPriceChange?.(value)}
          hint={
            [officialHint, discountHint].filter(Boolean).join(' · ') ||
            `${props.currency.symbol}/${t('request')}`
          }
          invalid={props.invalidVariables?.includes('fixed')}
        />
      </>
    )
  }
  return (
    <>
      {billingControl}
      {/* Token official prices (read-only reference from a pricing preset) */}
      <div className='space-y-2'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <Label className='text-sm font-semibold'>
            {t('Token official prices')}
          </Label>
          {showReference && (
            <div className='flex items-center gap-2'>
              <Select
                items={PRESET_SOURCE_OPTIONS}
                value={officialSource}
                onValueChange={(value) => {
                  if (value === 'official' || value === 'models.dev') {
                    setOfficialSource(value)
                  }
                }}
              >
                <SelectTrigger
                  aria-label={t('Official pricing preset')}
                  size='sm'
                  className='w-full sm:w-52'
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {PRESET_SOURCE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.label)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={officialLoading}
                onClick={handleSyncOfficialPrices}
              >
                <RefreshCw
                  className={cn('h-3.5 w-3.5', officialLoading && 'animate-spin')}
                />
                {t('Sync prices')}
              </Button>
            </div>
          )}
        </div>
        {showReference && (
          <div className='text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums'>
            {PRICE_VARS.map((variable) => {
              const officialUSD = officialTierVariablePriceUSD(
                officialRatios,
                variable.key
              )
              return (
                <span key={variable.key}>
                  {t(variable.label)}:{' '}
                  {officialUSD != null
                    ? formatPricingAmount(officialUSD, props.currency)
                    : '—'}
                </span>
              )
            })}
            {officialError && (
              <span role='alert' className='text-destructive'>
                {t('Failed to load model pricing')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Discount ratio: regenerates the Uter prices from official prices */}
      {showReference && (
        <div className='flex flex-wrap items-center gap-2'>
          <Label className='text-sm font-semibold'>
            {t('Discount ratio')}
          </Label>
          <InputGroup className='w-28'>
            <InputGroupAddon>x</InputGroupAddon>
            <PricingAmountInput
              aria-label={t('Discount ratio')}
              inputMode='decimal'
              value={discountText}
              placeholder='0.85'
              onChange={handleDiscountChange}
            />
          </InputGroup>
          <span className='text-muted-foreground text-xs'>
            {t('Uter price = official price × discount ratio.')}
          </span>
        </div>
      )}

      {/* Token Uter prices (editable) */}
      <div className='space-y-2'>
        <div className='flex items-center justify-between gap-3'>
          <Label className='text-sm font-semibold'>
            {t('Token Uter prices')}
          </Label>
          <div className='flex items-center gap-2'>
            {showReference && (
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={fetchingChannel}
                onClick={handleFetchFromChannel}
              >
                {t('Fetch from custom channel')}
              </Button>
            )}
            <span className='bg-muted text-muted-foreground rounded-md px-2 py-1 text-xs'>
              {props.currency.symbol}/{t('1M token')}
            </span>
          </div>
        </div>

        <div className='space-y-3'>
          <div className='flex flex-wrap gap-x-4 gap-y-2'>
            {renderPriceVariable({ key: 'p', label: 'Input price' })}
            {renderPriceVariable({ key: 'c', label: 'Output price' })}
          </div>

          <div className='space-y-2'>
            <div className='flex h-7 items-center'>
              {props.onCacheModeChange && (
                <Tabs
                  value={props.cacheMode}
                  onValueChange={(value) =>
                    value !== null &&
                    props.onCacheModeChange?.(value as CacheMode)
                  }
                >
                  <TabsList className='h-8'>
                    <TabsTrigger
                      value={CACHE_MODE_GENERIC}
                      className='px-2 text-xs'
                    >
                      {t('Generic cache')}
                    </TabsTrigger>
                    <TabsTrigger
                      value={CACHE_MODE_TIMED}
                      className='px-2 text-xs'
                    >
                      {t('Time-sliced cache (Claude)')}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            </div>
            <div className='flex flex-wrap gap-x-4 gap-y-2'>
              {CACHE_PRICE_VARS.map((variable) => {
                if (
                  variable.key === 'cc1h' &&
                  props.onCacheModeChange &&
                  props.cacheMode !== CACHE_MODE_TIMED
                ) {
                  return null
                }
                return renderPriceVariable(variable)
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Media prices */}
      <div className='space-y-1.5'>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='h-7 px-2 text-xs'
          onClick={() => setMediaOpen((prev) => !prev)}
        >
          <ChevronDown
            className={cn(
              'mr-1 h-3 w-3 transition-transform',
              mediaOpen && 'rotate-180'
            )}
          />
          {t('Media pricing')}
        </Button>
        {mediaOpen && (
          <div className='flex flex-wrap gap-x-4 gap-y-2'>
            {MEDIA_PRICE_VARS.map(renderPriceVariable)}
          </div>
        )}
      </div>
    </>
  )
}
