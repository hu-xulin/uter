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
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { formatLocalCurrencyAmount } from '@/lib/currency'

import { DEFAULT_DISCOUNT_RATE } from '../../constants'
import { isPayableAmount } from '../../hooks/use-payment'
import { formatPaymentAmount, getPaymentIcon } from '../../lib'
import type { PaymentMethod } from '../../types'

interface PaymentConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  topupAmount: number
  paymentAmount: number
  paymentMethod: PaymentMethod | undefined
  calculating: boolean
  processing: boolean
  discountRate?: number
  usdExchangeRate?: number
}

/**
 * 「应付金额」区域的渲染。计价中显示骨架；计价失败（金额非有限正数）时
 * 明确报错而不是显示 0 元 —— 0 是合法的「无需付款」，两者必须区分。
 *
 * 币种由支付通道决定（formatPaymentAmount）：易支付 / 官方直连支付宝·微信
 * 恒为人民币，Stripe/Waffo/Creem 为美元——不跟随 quotaDisplayType。
 */
function PayableAmountValue({
  calculating,
  paymentAmount,
  hasDiscount,
  originalAmount,
  paymentType,
}: {
  calculating: boolean
  paymentAmount: number
  hasDiscount: boolean
  originalAmount: number
  paymentType: string | undefined
}) {
  const { t } = useTranslation()

  if (calculating) return <Skeleton className='h-6 w-24' />

  if (!isPayableAmount(paymentAmount)) {
    return (
      <span className='text-destructive text-lg font-semibold'>
        {t('Failed to calculate payment amount. Please try again.')}
      </span>
    )
  }

  return (
    <div className='flex items-baseline gap-2'>
      <span className='text-2xl font-semibold'>
        {formatPaymentAmount(paymentAmount, paymentType)}
      </span>
      {hasDiscount && (
        <span className='text-muted-foreground text-sm line-through'>
          {formatPaymentAmount(originalAmount, paymentType)}
        </span>
      )}
    </div>
  )
}

export function PaymentConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  topupAmount,
  paymentAmount,
  paymentMethod,
  calculating,
  processing,
  discountRate = DEFAULT_DISCOUNT_RATE,
  usdExchangeRate = 1,
}: PaymentConfirmDialogProps) {
  const { t } = useTranslation()
  const hasDiscount = discountRate > 0 && discountRate < 1 && paymentAmount > 0
  const originalAmount = hasDiscount ? paymentAmount / discountRate : 0
  const discountAmount = hasDiscount ? originalAmount - paymentAmount : 0
  // 应付金额无效（0 / NaN / 负数）时不允许确认：否则用户会看到「应付 0 元」
  // 却仍能走进收款流程。计价失败应由上层拦在打开对话框之前，这里是兜底。
  const amountInvalid = !isPayableAmount(paymentAmount)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-md'>
        <AlertDialogHeader>
          <AlertDialogTitle className='text-xl font-semibold'>
            {t('Confirm Payment')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('Review your payment details')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className='space-y-3 py-3 sm:space-y-4 sm:py-4'>
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground text-sm'>
              {t('Topup Amount')}
            </span>
            <span className='text-lg font-semibold'>
              {formatLocalCurrencyAmount(topupAmount * usdExchangeRate, {
                digitsLarge: 2,
                digitsSmall: 2,
                abbreviate: false,
              })}
            </span>
          </div>

          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground text-sm'>
              {t('You Pay')}
            </span>
            <PayableAmountValue
              calculating={calculating}
              paymentAmount={paymentAmount}
              hasDiscount={hasDiscount}
              originalAmount={originalAmount}
              paymentType={paymentMethod?.type}
            />
          </div>

          {hasDiscount && !calculating && (
            <div className='bg-muted/50 rounded-lg p-3'>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>{t('You save')}</span>
                <span className='font-semibold text-green-600'>
                  {formatPaymentAmount(discountAmount, paymentMethod?.type)}
                </span>
              </div>
            </div>
          )}

          <div className='border-t pt-4'>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground text-sm'>
                {t('Payment Method')}
              </span>
              <div className='flex items-center gap-2'>
                {getPaymentIcon(
                  paymentMethod?.type,
                  'h-4 w-4',
                  paymentMethod?.icon,
                  paymentMethod?.name
                )}
                <span className='font-medium'>{paymentMethod?.name}</span>
              </div>
            </div>
          </div>
        </div>

        <AlertDialogFooter className='grid grid-cols-2 gap-2 sm:flex'>
          <AlertDialogCancel disabled={processing}>
            {t('Cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={processing || calculating || amountInvalid}
          >
            {processing && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {t('Confirm Payment')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
