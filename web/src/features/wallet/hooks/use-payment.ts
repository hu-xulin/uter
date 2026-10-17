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
import i18next from 'i18next'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'

import { handleServerError } from '@/lib/handle-server-error'

import {
  calculateAmount,
  calculateStripeAmount,
  calculateWaffoAmount,
  calculateWaffoPancakeAmount,
  requestPayment,
  requestStripePayment,
  isApiSuccess,
} from '../api'
import {
  isStripePayment,
  isWaffoPayment,
  isWaffoPancakePayment,
  openPaymentRedirect,
  submitPaymentForm,
} from '../lib'
import type { AmountRequest, AmountResponse } from '../types'

// ============================================================================
// Payment Hook
// ============================================================================

type AmountCalculator = (request: AmountRequest) => Promise<AmountResponse>

export interface PaymentAmountCalculators {
  regular: AmountCalculator
  stripe: AmountCalculator
  waffo: AmountCalculator
  waffoPancake: AmountCalculator
}

const defaultPaymentAmountCalculators: PaymentAmountCalculators = {
  regular: calculateAmount,
  stripe: calculateStripeAmount,
  waffo: calculateWaffoAmount,
  waffoPancake: calculateWaffoPancakeAmount,
}

/**
 * 计价结果必须是有限且大于 0 的金额。
 *
 * 计价接口失败时不能把「0」当作应付金额：0 是「无需付款」的合法输入，
 * 用它继续流程会让确认框显示 0 元并把用户送进收款流程。
 */
export function isPayableAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/**
 * 计算应付金额。失败（接口错误、空值、非数字、非正数）一律返回 null，
 * 由调用方决定提示与重试，绝不用 0 伪装成一次成功的计价。
 */
export async function requestPaymentAmount(
  topupAmount: number,
  paymentType: string,
  calculators: PaymentAmountCalculators = defaultPaymentAmountCalculators
): Promise<number | null> {
  let calculator = calculators.regular
  if (isStripePayment(paymentType)) {
    calculator = calculators.stripe
  } else if (isWaffoPayment(paymentType)) {
    calculator = calculators.waffo
  } else if (isWaffoPancakePayment(paymentType)) {
    calculator = calculators.waffoPancake
  }

  const response = await calculator({ amount: topupAmount })
  if (!isApiSuccess(response) || response.data == null) {
    return null
  }

  const amount = Number.parseFloat(response.data)
  return isPayableAmount(amount) ? amount : null
}

export function usePayment() {
  const [amount, setAmount] = useState<number>(0)
  const [calculating, setCalculating] = useState(false)
  const [calculatingError, setCalculatingError] = useState(false)
  const [processing, setProcessing] = useState(false)

  // Calculate payment amount
  const calculatePaymentAmount = useCallback(
    async (topupAmount: number, paymentType: string) => {
      try {
        setCalculating(true)
        setCalculatingError(false)
        const calculatedAmount = await requestPaymentAmount(
          topupAmount,
          paymentType
        )
        setAmount(calculatedAmount ?? 0)
        setCalculatingError(calculatedAmount === null)
        return calculatedAmount
      } catch {
        setAmount(0)
        setCalculatingError(true)
        return null
      } finally {
        setCalculating(false)
      }
    },
    []
  )

  // Process payment
  const processPayment = useCallback(
    async (topupAmount: number, paymentType: string) => {
      try {
        setProcessing(true)

        const isStripe = isStripePayment(paymentType)
        const amount = Math.floor(topupAmount)

        const response = isStripe
          ? await requestStripePayment({
              amount,
              payment_method: 'stripe',
            })
          : await requestPayment({
              amount,
              payment_method: paymentType,
            })

        if (!isApiSuccess(response)) {
          handleServerError(response, i18next.t('Payment request failed'))
          return false
        }

        // Handle Stripe payment
        if (isStripe && response.data?.pay_link) {
          if (
            !openPaymentRedirect(response.data.pay_link as string, 'stripe')
          ) {
            return false
          }
          toast.success(i18next.t('Redirecting to payment page...'))
          return true
        }

        // Handle non-Stripe payment
        if (!isStripe && response.data) {
          const url = (response as unknown as { url?: string }).url
          if (url) {
            try {
              submitPaymentForm(url, response.data)
            } catch {
              handleServerError(
                new Error('invalid redirect'),
                i18next.t('Invalid payment redirect URL')
              )
              return false
            }
            toast.success(i18next.t('Redirecting to payment page...'))
            return true
          }
        }

        return false
      } catch (error) {
        handleServerError(error, i18next.t('Payment request failed'))
        return false
      } finally {
        setProcessing(false)
      }
    },
    []
  )

  return {
    amount,
    calculating,
    calculatingError,
    processing,
    calculatePaymentAmount,
    processPayment,
    setAmount,
  }
}
