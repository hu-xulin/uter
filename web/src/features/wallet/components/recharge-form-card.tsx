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
import { Gift, Loader2, Receipt, WalletCards } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { DiscountBadge } from '@/components/ui/discount-badge'
import { IconBadge } from '@/components/ui/icon-badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatLocalCurrencyAmount } from '@/lib/currency'
import { cn } from '@/lib/utils'

import {
  formatCNYAmount,
  formatPaymentAmount,
  getDiscountLabel,
  getPaymentIcon,
  getMinTopupAmount,
  calculatePresetPricing,
} from '../lib'
import type {
  PaymentMethod,
  PresetAmount,
  TopupInfo,
  CreemProduct,
  WaffoPayMethod,
} from '../types'
import { CreemProductsSection } from './creem-products-section'

interface RechargeFormCardProps {
  topupInfo: TopupInfo | null
  presetAmounts: PresetAmount[]
  selectedPreset: number | null
  onSelectPreset: (preset: PresetAmount) => void
  topupAmount: number
  onTopupAmountChange: (amount: number) => void
  paymentAmount: number
  calculating: boolean
  /** 计价失败（接口错误 / 非数字 / 非正数）：显示错误与重试，而不是显示 0 元 */
  calculatingError?: boolean
  onRetryCalculate?: () => void
  onPaymentMethodSelect: (method: PaymentMethod) => void
  paymentLoading: string | null
  /** 当前选中的支付方式——「应付金额」按它的通道决定币种（人民币/美元）。 */
  selectedPaymentMethod?: PaymentMethod
  redemptionCode: string
  onRedemptionCodeChange: (code: string) => void
  onRedeem: () => void
  redeeming: boolean
  topupLink?: string
  loading?: boolean
  priceRatio?: number
  usdExchangeRate?: number
  onOpenBilling?: () => void
  creemProducts?: CreemProduct[]
  enableCreemTopup?: boolean
  onCreemProductSelect?: (product: CreemProduct) => void
  enableWaffoTopup?: boolean
  waffoPayMethods?: WaffoPayMethod[]
  waffoMinTopup?: number
  onWaffoMethodSelect?: (method: WaffoPayMethod, index: number) => void
  enableWaffoPancakeTopup?: boolean
}

/**
 * 「应付金额」展示。计价中显示骨架；计价失败显示可点的重试入口 ——
 * 绝不用 0 元冒充一次成功的计价（0 是合法的「无需付款」）。
 *
 * 币种由支付通道决定（formatPaymentAmount）：易支付 / 官方直连支付宝·微信
 * 恒为人民币，Stripe/Waffo/Creem 为美元——不跟随 quotaDisplayType。
 */
function PayableAmountValue({
  calculating,
  calculatingError,
  paymentAmount,
  paymentType,
  onRetryCalculate,
}: {
  calculating: boolean
  calculatingError?: boolean
  paymentAmount: number
  paymentType: string | undefined
  onRetryCalculate?: () => void
}) {
  const { t } = useTranslation()

  if (calculating) return <Skeleton className='h-5 w-16' />

  if (calculatingError) {
    return (
      <Button
        type='button'
        variant='link'
        size='inline'
        onClick={onRetryCalculate}
        className='text-destructive underline-offset-2 hover:underline'
      >
        {t('Retry')}
      </Button>
    )
  }

  return (
    <span className='text-sm font-semibold'>
      {formatPaymentAmount(paymentAmount, paymentType)}
    </span>
  )
}

/**
 * 充值档位右上角的价差角标。
 *
 * - `discount < 1` → 绿色「20% OFF」；
 * - `discount > 1` → 红色「+5%」——档位折扣允许运营填大于 1 的值（加价档位），
 *   这类档位不能显示「0% OFF」，但也必须让用户看见自己在被加价；
 * - 两者都不成立（等于 1，或折扣小到取整成 0%）→ 不渲染：只剩底色的空色块
 *   会被当成状态指示器，实际什么也没说。
 *
 * 配色由 `DiscountBadge` 统一决定，与定价页的 `DiscountTag` 同一套 Token。
 */
function PresetDiscountBadge({
  discount,
  label,
}: {
  discount: number
  label: string
}) {
  if (discount < 1) {
    if (!label) return null
    return (
      <DiscountBadge
        ratio={discount}
        title={`-${Math.round((1 - discount) * 100)}%`}
      >
        {label}
      </DiscountBadge>
    )
  }

  const markupPercent = Math.round((discount - 1) * 100)
  if (markupPercent <= 0) return null
  return (
    <DiscountBadge ratio={discount} title={`+${markupPercent}%`}>
      +{markupPercent}%
    </DiscountBadge>
  )
}

export function RechargeFormCard({
  topupInfo,
  presetAmounts,
  selectedPreset,
  onSelectPreset,
  topupAmount,
  onTopupAmountChange,
  paymentAmount,
  calculating,
  calculatingError,
  onRetryCalculate,
  onPaymentMethodSelect,
  paymentLoading,
  selectedPaymentMethod,
  redemptionCode,
  onRedemptionCodeChange,
  onRedeem,
  redeeming,
  topupLink,
  loading,
  priceRatio = 1,
  usdExchangeRate = 1,
  onOpenBilling,
  creemProducts,
  enableCreemTopup,
  onCreemProductSelect,
  enableWaffoTopup,
  waffoPayMethods,
  waffoMinTopup,
  onWaffoMethodSelect,
  enableWaffoPancakeTopup,
}: RechargeFormCardProps) {
  const { t } = useTranslation()
  const [localAmount, setLocalAmount] = useState(topupAmount.toString())

  useEffect(() => {
    setLocalAmount((prev) => {
      // 空字符串必须保留，否则输入框永远清不掉。
      if (prev === '' && topupAmount === 0) return prev
      // 用户正在输入的中间态（`1.` / `0.50` / `1.0`）数值上已经等于当前金额，
      // 原样保留。否则 `1.` 会被回写成 `1`，小数点永远打不进去 —— 最低充值
      // 改成 0.01 之后，金额输入框不能只接受整数。
      if (Number(prev) === topupAmount) return prev
      return topupAmount.toString()
    })
  }, [topupAmount])

  const handleAmountChange = (value: string) => {
    setLocalAmount(value)
    // 金额可以是小数（最低充值 0.01）。此前用 parseInt，用户输入 0.5 会被截成 0：
    // 输入框里还显示 0.5，提交的却是 0，「0.01 起充」等于没生效。
    const numValue = Number(value)
    if (Number.isFinite(numValue) && numValue >= 0) {
      onTopupAmountChange(numValue)
    }
  }

  // 官方直连（支付宝 alipay_web / 微信支付 wechat_web）不在 Epay 易支付通道内，
  // 但同样属于「可配置的在线充值」——后端在密钥就绪时会自动把它们追加进
  // pay_methods，因此这里必须一并计入，否则只配了官方直连的站点
  // （未配 EpayId/EpayKey/PayAddress）会连金额与支付方式一起被隐藏。
  const hasConfigurableTopup =
    topupInfo?.enable_online_topup ||
    topupInfo?.enable_stripe_topup ||
    topupInfo?.enable_alipay_topup ||
    topupInfo?.enable_wechat_pay_topup ||
    enableWaffoTopup ||
    enableWaffoPancakeTopup
  const hasAnyTopup = hasConfigurableTopup || enableCreemTopup
  const hasStandardPaymentMethods =
    Array.isArray(topupInfo?.pay_methods) && topupInfo.pay_methods.length > 0
  const hasWaffoPaymentMethods =
    Array.isArray(waffoPayMethods) && waffoPayMethods.length > 0
  const minTopup = getMinTopupAmount(topupInfo)
  const redemptionEnabled = topupInfo?.enable_redemption !== false

  if (loading) {
    return (
      <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
        <CardHeader className='border-b p-3 !pb-3 sm:p-5 sm:!pb-5'>
          <Skeleton className='h-6 w-32' />
          <Skeleton className='mt-2 h-4 w-48' />
        </CardHeader>
        <CardContent className='space-y-4 p-3 sm:space-y-6 sm:p-5'>
          <div className='space-y-4 sm:space-y-6'>
            {/* Preset Amounts Skeleton */}
            <div className='space-y-3'>
              <Skeleton className='h-3 w-16' />
              <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
                {Array.from({ length: 8 }, (_, index) => `preset-${index}`).map(
                  (key) => (
                    <Skeleton key={key} className='h-[72px] rounded-lg' />
                  )
                )}
              </div>
            </div>

            {/* Custom Amount Input Skeleton */}
            <div className='space-y-3'>
              <Skeleton className='h-3 w-28' />
              <Skeleton className='h-[42px] w-full' />
            </div>

            {/* Payment Methods Skeleton */}
            <div className='space-y-3'>
              <Skeleton className='h-3 w-32' />
              <div className='flex flex-wrap gap-3'>
                {['primary', 'secondary', 'tertiary'].map((key) => (
                  <Skeleton key={key} className='h-10 w-24 rounded-lg' />
                ))}
              </div>
            </div>
          </div>

          {/* Redemption Code Section Skeleton */}
          <div className='space-y-3 border-t pt-8'>
            <Skeleton className='h-3 w-24' />
            <div className='flex gap-2'>
              <Skeleton className='h-10 flex-1' />
              <Skeleton className='h-10 w-20' />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <TitledCard
      title={t('Add Funds')}
      description={t('Choose an amount and payment method')}
      icon={<WalletCards className='h-4 w-4' />}
      iconTone='success'
      disableHoverEffect
      action={
        onOpenBilling ? (
          <Button
            variant='outline'
            size='sm'
            onClick={onOpenBilling}
            className='w-full gap-2 sm:w-auto'
          >
            <Receipt className='h-4.5 w-4.5' />
            {t('Order History')}
          </Button>
        ) : null
      }
      contentClassName='space-y-4 sm:space-y-6'
    >
      {/* Online Topup Section */}
      {hasAnyTopup ? (
        <div className='space-y-4 sm:space-y-6'>
          {hasConfigurableTopup && (
            <>
              {presetAmounts.length > 0 && (
                <div className='space-y-2.5 sm:space-y-3'>
                  <Label className='text-muted-foreground'>{t('Amount')}</Label>
                  <div className='grid grid-cols-2 gap-1.5 sm:gap-3 md:grid-cols-4'>
                    {presetAmounts.map((preset) => {
                      const discount =
                        preset.discount ||
                        topupInfo?.discount?.[preset.value] ||
                        1.0
                      const {
                        displayValue,
                        actualPrice,
                        savedAmount,
                        hasDiscount,
                      } = calculatePresetPricing(
                        preset.value,
                        priceRatio,
                        discount,
                        usdExchangeRate
                      )
                      // 角标文案与底色同源：`discount < 1` 走「20% OFF」，`discount > 1`
                      // 走「+5%」。文案为空时**不渲染**角标 —— 只剩底色的空色块会被
                      // 当成一个状态指示器，实际什么也没说。
                      const discountLabel = hasDiscount
                        ? getDiscountLabel(discount, t)
                        : ''
                      return (
                        <Button
                          key={preset.value}
                          variant='outline'
                          className={cn(
                            'flex min-h-16 flex-col items-start rounded-lg px-3 py-2.5 text-left whitespace-normal sm:min-h-[72px] sm:p-4',
                            selectedPreset === preset.value
                              ? 'border-foreground bg-foreground/5 dark:border-foreground dark:bg-foreground/10'
                              : 'border-muted'
                          )}
                          onClick={() => onSelectPreset(preset)}
                        >
                          <div className='flex w-full items-center justify-between'>
                            {/* 档位金额是卡片里的主数值：18/600，不用 16/600
                                （16px 在阶梯里只有 body 400 一档，做强调会与正文同号）。 */}
                            <div className='text-lg font-semibold'>
                              {formatLocalCurrencyAmount(displayValue, {
                                digitsLarge: 2,
                                digitsSmall: 2,
                                abbreviate: false,
                              })}
                            </div>
                            <PresetDiscountBadge
                              discount={discount}
                              label={discountLabel}
                            />
                          </div>
                          {/* 「支付 ¥xx」是这一档的说明，属于 body-sm（14px）。
                              12px 只给徽标/时间戳，用它会让实付金额看起来像脚注。 */}
                          <div className='text-muted-foreground mt-1.5 w-full text-sm sm:mt-2'>
                            {hasDiscount && savedAmount > 0 ? (
                              <Trans
                                t={t}
                                i18nKey='Pay {{amount}} <savings>• Save {{saved}}</savings>'
                                values={{
                                  amount: formatCNYAmount(actualPrice),
                                  saved: formatCNYAmount(savedAmount),
                                }}
                                components={{
                                  savings: <span className='text-success' />,
                                }}
                              />
                            ) : (
                              t('Pay {{amount}}', {
                                amount: formatCNYAmount(actualPrice),
                              })
                            )}
                          </div>
                        </Button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className='space-y-2.5 sm:space-y-3'>
                <Label htmlFor='topup-amount' className='text-muted-foreground'>
                  {t('Custom Amount')}
                </Label>
                <div className='grid grid-cols-[minmax(0,1fr)_minmax(110px,0.55fr)] gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center'>
                  <Input
                    id='topup-amount'
                    type='number'
                    value={localAmount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    min={minTopup}
                    /* 与后台「最低充值」同口径（最多两位小数）。不写 step 时
                       type=number 默认 step=1，输入 0.01 会进入 :invalid 状态，
                       浏览器的原生校验与上下箭头步进都按整数走。 */
                    step='0.01'
                    placeholder={t('Minimum {{amount}}', { amount: minTopup })}
                  />
                  {/* 与同一行的输入框同高（--ds-control-height-md）：此前是
                      min-h-9（36px），比左侧 40px 的输入框矮一截。 */}
                  <div className='bg-muted/30 flex h-(--ds-control-height-md) items-center justify-between gap-2 rounded-md border px-3 lg:min-w-52'>
                    <span className='text-muted-foreground truncate text-sm'>
                      {t('Amount to pay:')}
                    </span>
                    <PayableAmountValue
                      calculating={calculating}
                      calculatingError={Boolean(calculatingError)}
                      paymentAmount={paymentAmount}
                      paymentType={selectedPaymentMethod?.type}
                      onRetryCalculate={onRetryCalculate}
                    />
                  </div>
                </div>
                {calculatingError && (
                  <Alert variant='destructive'>
                    <AlertDescription>
                      {t(
                        'Failed to calculate payment amount. Please try again.'
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className='space-y-2.5 sm:space-y-3'>
                <Label className='text-muted-foreground'>
                  {t('Payment Method')}
                </Label>
                {hasStandardPaymentMethods ? (
                  <div className='grid grid-cols-2 gap-1.5 sm:gap-3 lg:grid-cols-3'>
                    {topupInfo?.pay_methods?.map((method) => {
                      const minTopup = Math.max(
                        method.min_topup || 0,
                        getMinTopupAmount(topupInfo)
                      )
                      const disabled = minTopup > topupAmount
                      const disabledReason = disabled
                        ? t('Minimum topup amount: {{amount}}', {
                            amount: minTopup,
                          })
                        : undefined
                      const disabledLabel = disabled
                        ? `${t('Minimum:')} ${minTopup}`
                        : undefined

                      const button = (
                        <Button
                          key={method.type}
                          variant='outline'
                          onClick={() => onPaymentMethodSelect(method)}
                          disabled={disabled || !!paymentLoading}
                          title={disabledReason}
                          aria-label={
                            disabledReason
                              ? `${method.name}. ${disabledReason}`
                              : method.name
                          }
                          className='min-h-14 min-w-0 justify-start gap-2 rounded-lg px-3 py-2 text-left'
                        >
                          {paymentLoading === method.type ? (
                            <Loader2 className='h-4.5 w-4.5 animate-spin' />
                          ) : (
                            getPaymentIcon(
                              method.type,
                              'h-4 w-4',
                              method.icon,
                              method.name
                            )
                          )}
                          <span className='flex min-w-0 flex-col items-start gap-0.5'>
                            <span className='max-w-full truncate'>
                              {method.name}
                            </span>
                            {disabledLabel && (
                              <span className='text-muted-foreground max-w-full truncate text-xs font-normal'>
                                {disabledLabel}
                              </span>
                            )}
                          </span>
                        </Button>
                      )

                      return disabled ? (
                        <TooltipProvider key={method.type}>
                          <Tooltip>
                            <TooltipTrigger render={button} />
                            <TooltipContent>{disabledReason}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        button
                      )
                    })}
                  </div>
                ) : null}
                {!hasStandardPaymentMethods && !hasWaffoPaymentMethods && (
                  <Alert>
                    <AlertDescription>
                      {t(
                        'No payment methods available. Please contact administrator.'
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {enableWaffoTopup &&
                hasWaffoPaymentMethods &&
                onWaffoMethodSelect && (
                  <div className='space-y-2.5 sm:space-y-3'>
                    <Label className='text-muted-foreground'>
                      {t('Waffo Payment')}
                    </Label>
                    <div className='grid grid-cols-2 gap-1.5 sm:gap-3 lg:grid-cols-3'>
                      {waffoPayMethods?.map((method, index) => {
                        const loadingKey = `waffo-${index}`
                        const methodKey = `${method.payMethodType ?? 'unknown'}-${method.payMethodName ?? method.name}`
                        const waffoMin = waffoMinTopup || 0
                        const belowMin = waffoMin > topupAmount
                        const disabledReason = belowMin
                          ? t('Minimum topup amount: {{amount}}', {
                              amount: waffoMin,
                            })
                          : undefined
                        const disabledLabel = belowMin
                          ? `${t('Minimum:')} ${waffoMin}`
                          : undefined

                        let methodIcon = getPaymentIcon('waffo')
                        if (paymentLoading === loadingKey) {
                          methodIcon = (
                            <Loader2 className='h-4 w-4 animate-spin' />
                          )
                        } else if (method.icon) {
                          methodIcon = (
                            <img
                              src={method.icon}
                              alt={method.name}
                              className='h-4 w-4 object-contain'
                            />
                          )
                        }

                        const button = (
                          <Button
                            key={methodKey}
                            variant='outline'
                            onClick={() => onWaffoMethodSelect(method, index)}
                            disabled={belowMin || !!paymentLoading}
                            title={disabledReason}
                            aria-label={
                              disabledReason
                                ? `${method.name}. ${disabledReason}`
                                : method.name
                            }
                            className='min-h-14 min-w-0 justify-start gap-2 rounded-lg px-3 py-2 text-left'
                          >
                            {methodIcon}
                            <span className='flex min-w-0 flex-col items-start gap-0.5'>
                              <span className='max-w-full truncate'>
                                {method.name}
                              </span>
                              {disabledLabel && (
                                <span className='text-muted-foreground max-w-full truncate text-xs font-normal'>
                                  {disabledLabel}
                                </span>
                              )}
                            </span>
                          </Button>
                        )

                        return belowMin ? (
                          <TooltipProvider key={methodKey}>
                            <Tooltip>
                              <TooltipTrigger render={button} />
                              <TooltipContent>{disabledReason}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          button
                        )
                      })}
                    </div>
                  </div>
                )}
            </>
          )}
        </div>
      ) : (
        <Alert>
          <AlertDescription>
            {t(
              'Online topup is not enabled. Please use redemption code or contact administrator.'
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Creem Products Section */}
      {enableCreemTopup &&
        Array.isArray(creemProducts) &&
        creemProducts.length > 0 &&
        onCreemProductSelect && (
          <div className='space-y-2.5 border-t pt-4 sm:space-y-3 sm:pt-6'>
            <Label className='text-muted-foreground'>
              {t('Creem Payment')}
            </Label>
            <CreemProductsSection
              products={creemProducts}
              onProductSelect={onCreemProductSelect}
            />
          </div>
        )}

      {/* Redemption Code Section */}
      {redemptionEnabled ? (
        <div className='space-y-2.5 border-t pt-4 sm:space-y-3 sm:pt-6'>
          <div className='flex items-center gap-2'>
            <IconBadge tone='warning' size='xs'>
              <Gift />
            </IconBadge>
            <Label htmlFor='redemption-code' className='text-muted-foreground'>
              {t('Have a Code?')}
            </Label>
          </div>
          <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-2'>
            <Input
              id='redemption-code'
              value={redemptionCode}
              onChange={(e) => onRedemptionCodeChange(e.target.value)}
              placeholder={t('Enter your redemption code')}
              className='min-w-0'
            />
            <Button
              onClick={onRedeem}
              disabled={redeeming}
              variant='outline'
              className='h-(--ds-control-height-md) px-4'
            >
              {redeeming && (
                <Loader2 className='mr-2 h-4.5 w-4.5 animate-spin' />
              )}
              {t('Redeem')}
            </Button>
          </div>
          {topupLink && (
            <p className='text-muted-foreground text-sm'>
              {t('Need a redemption code?')}{' '}
              <a
                href={topupLink}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-1'
              >
                {t('Get one here')}
              </a>
            </p>
          )}
        </div>
      ) : (
        <Alert className='border-t'>
          <AlertDescription>
            {t(
              'Redemption codes are disabled until the administrator confirms compliance terms.'
            )}
          </AlertDescription>
        </Alert>
      )}
    </TitledCard>
  )
}
