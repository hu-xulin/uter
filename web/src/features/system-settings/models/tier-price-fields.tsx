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
  type OfficialRatios,
} from './model-pricing-core'
import { useOfficialPrices } from './use-official-prices'

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
/**
 * Every discountable price dimension: the base input/output variables (`p`,
 * `c`) are not part of BILLING_EXTRA_VARS but must be discounted too.
 */
const CALC_VAR_KEYS: VisualPrice['variable'][] = [
  'p',
  'c',
  ...PRICE_VARS.map((variable) => variable.key),
]
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
        <Label htmlFor={id} tier='default' className='text-muted-foreground'>
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
      {hint && <p className='text-muted-foreground text-sm'>{hint}</p>}
    </div>
  )
}

/** Read-only official reference price rendered like an editable price field. */
function OfficialPriceField(props: {
  currency: PricingCurrency
  label: string
  usd: number | null
}) {
  return (
    <div className='w-36 space-y-0.5'>
      <Label tier='default' className='text-muted-foreground'>
        {props.label}
      </Label>
      <PricingAmountInput
        currency={props.currency}
        aria-label={props.label}
        value={props.usd ?? ''}
        placeholder='—'
        disabled
        onChange={() => {}}
        className='h-8 w-full'
      />
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

/**
 * Summary of a discount ratio (e.g. 0.86 → "-14% · 8.6折") shown next to the
 * Calculate button. Returns '' for ratios >= 1 (no discount to display).
 */
function discountSummaryText(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio >= 1) return ''
  const percent = (1 - ratio) * 100
  const zhe = ratio * 10
  const zheStr =
    Math.abs(zhe - Math.round(zhe)) < 1e-6
      ? String(Math.round(zhe))
      : zhe.toFixed(1)
  return `-${Math.round(percent)}% · ${zheStr}折`
}

export function TierPriceFields(props: TierPriceFieldsProps) {
  const { t } = useTranslation()
  const modelName = props.modelName?.trim() ?? ''
  const showReference = modelName !== ''
  const [discountText, setDiscountText] = useState('')
  const [appliedDiscount, setAppliedDiscount] = useState<number | null>(null)
  const [fetchingChannel, setFetchingChannel] = useState(false)
  const {
    source: officialSource,
    setSource: setOfficialSource,
    prices: officialPrices,
    loading: officialLoading,
    error: officialError,
    sync: syncOfficialPrices,
  } = useOfficialPrices({ enabled: showReference })
  const officialRatios = officialPrices?.[modelName]

  /** Generates Uter prices = official price × discount for priced dimensions. */
  const generateDiscountPrices = (
    official: OfficialRatios | undefined,
    discount: number
  ) => {
    if (!official) return
    const updates: Partial<Record<VisualPrice['variable'], string>> = {}
    for (const key of CALC_VAR_KEYS) {
      const officialUSD = officialTierVariablePriceUSD(official, key)
      if (officialUSD == null) continue
      const isCore = key === 'p' || key === 'c'
      const included = props.onInclude ? props.prices[key] !== undefined : true
      if (!isCore && !included) continue
      updates[key] = formatGeneratedPriceUSD(officialUSD * discount)
    }
    if (Object.keys(updates).length > 0) props.onApplyPrices?.(updates)
  }

  /** Syncs the official prices into the editable Uter input/output fields. */
  const handleSync = async () => {
    const data = await syncOfficialPrices()
    if (!data) return
    const ratios = modelName ? data[modelName] : undefined
    generateDiscountPrices(ratios, 1)
    setAppliedDiscount(null)
  }

  const handleDiscountChange = (text: string) => {
    setDiscountText(text)
    setAppliedDiscount(null)
  }

  /** Computes Uter prices = official price × discount ratio. */
  const handleCalculate = () => {
    const value = Number(discountText)
    if (discountText.trim() === '' || !Number.isFinite(value) || value <= 0) {
      toast.error(t('Enter a valid discount ratio greater than 0.'))
      return
    }
    generateDiscountPrices(officialRatios, value)
    setAppliedDiscount(value)
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
      ? computeDimensionDiscount(toNumberOrNull(props.fixedPrice), officialUSD)
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
          <Label>{t('Token official prices')}</Label>
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
                onClick={() => void handleSync()}
              >
                <RefreshCw
                  className={cn(
                    'h-3.5 w-3.5',
                    officialLoading && 'animate-spin'
                  )}
                />
                {t('Sync prices')}
              </Button>
            </div>
          )}
        </div>
        {showReference && (
          <div className='space-y-3'>
            <div className='flex flex-wrap gap-x-4 gap-y-2'>
              <OfficialPriceField
                currency={props.currency}
                label={t('Input price')}
                usd={officialTierVariablePriceUSD(officialRatios, 'p')}
              />
              <OfficialPriceField
                currency={props.currency}
                label={t('Output price')}
                usd={officialTierVariablePriceUSD(officialRatios, 'c')}
              />
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
                return (
                  <OfficialPriceField
                    key={variable.key}
                    currency={props.currency}
                    label={
                      variable.key === 'cc' && props.prices.cc1h !== undefined
                        ? t('Cache Creation (5m)')
                        : t(variable.label)
                    }
                    usd={officialTierVariablePriceUSD(
                      officialRatios,
                      variable.key
                    )}
                  />
                )
              })}
              {officialError && (
                <span role='alert' className='text-destructive text-xs'>
                  {t('Failed to load model pricing')}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Discount ratio: regenerates the Uter prices from official prices */}
      {showReference && (
        <div className='flex flex-wrap items-center gap-2'>
          <Label>{t('Discount ratio')}</Label>
          <InputGroup className='w-28'>
            <InputGroupAddon>x</InputGroupAddon>
            <PricingAmountInput
              grouped
              aria-label={t('Discount ratio')}
              inputMode='decimal'
              value={discountText}
              placeholder='0.85'
              onChange={handleDiscountChange}
            />
          </InputGroup>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={!officialRatios || discountText.trim() === ''}
            onClick={handleCalculate}
          >
            {t('Calculate')}
          </Button>
          {appliedDiscount != null &&
            discountSummaryText(appliedDiscount) !== '' && (
              <span className='bg-success-soft text-success dark:bg-success-soft dark:text-success-soft-foreground rounded-md px-2 py-1 text-xs font-medium tabular-nums'>
                {discountSummaryText(appliedDiscount)}
              </span>
            )}
          <span className='text-muted-foreground text-sm'>
            {t('Uter price = official price × discount ratio.')}
          </span>
        </div>
      )}

      {/* Token Uter prices (editable) */}
      <div className='space-y-2'>
        <div className='flex items-center justify-between gap-3'>
          <Label>{t('Token Uter prices')}</Label>
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
                      className='px-2 text-sm'
                    >
                      {t('Generic cache')}
                    </TabsTrigger>
                    <TabsTrigger
                      value={CACHE_MODE_TIMED}
                      className='px-2 text-sm'
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
          className='px-2 text-sm'
          onClick={() => setMediaOpen((prev) => !prev)}
        >
          <ChevronDown
            className={cn(
              'mr-1 size-4 transition-transform',
              mediaOpen && 'rotate-180'
            )}
          />
          {t('Media pricing')}
        </Button>
        {mediaOpen && (
          <div className='space-y-3'>
            {showReference && (
              <div className='space-y-1.5'>
                <p className='text-muted-foreground text-sm font-medium'>
                  {t('Official prices')}
                </p>
                <div className='flex flex-wrap gap-x-4 gap-y-2'>
                  {MEDIA_PRICE_VARS.map((variable) => (
                    <OfficialPriceField
                      key={variable.key}
                      currency={props.currency}
                      label={t(variable.label)}
                      usd={officialTierVariablePriceUSD(
                        officialRatios,
                        variable.key
                      )}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className='space-y-1.5'>
              {showReference && (
                <p className='text-muted-foreground text-sm font-medium'>
                  {t('Uter prices')}
                </p>
              )}
              <div className='flex flex-wrap gap-x-4 gap-y-2'>
                {MEDIA_PRICE_VARS.map(renderPriceVariable)}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
