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

You should have received a copy of the GNU Affero General License
along with this program. Not found? See <https://www.gnu.org/licenses/>.
*/
import { Loader2, Smartphone } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { getSelf } from '@/lib/api'
import { formatLocalCurrencyAmount } from '@/lib/currency'

import { isAlipayMiniProgramPayment } from '../../lib'
import type { PaymentMethod } from '../../types'

interface CnPayMiniProgramDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Quota amount the user is topping up. */
  topupAmount: number
  /** Fiat amount the user pays (display only). */
  paymentAmount: number
  /** Baseline wallet quota before payment, used to detect success. */
  initialQuota: number
  paymentMethod: PaymentMethod | undefined
  onSuccess: () => void
}

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 180_000

export function CnPayMiniProgramDialog({
  open,
  onOpenChange,
  topupAmount,
  paymentAmount,
  initialQuota,
  paymentMethod,
  onSuccess,
}: CnPayMiniProgramDialogProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const initialQuotaRef = useRef(initialQuota)
  const onSuccessRef = useRef(onSuccess)
  const doneRef = useRef(false)

  initialQuotaRef.current = initialQuota
  onSuccessRef.current = onSuccess

  const isAlipay = isAlipayMiniProgramPayment(paymentMethod?.type ?? '')
  const providerName = isAlipay ? t('Alipay') : t('WeChat Pay')

  // Poll wallet balance until it increases (payment success) or timeout.
  // The actual order is created and paid inside the mini-program; on success the
  // async callback recharges this same user account, which we detect here.
  useEffect(() => {
    if (!open) return
    setLoading(true)
    setDone(false)
    doneRef.current = false
    let elapsed = 0
    const timer = setInterval(async () => {
      elapsed += POLL_INTERVAL_MS
      if (elapsed >= POLL_TIMEOUT_MS) {
        clearInterval(timer)
        setLoading(false)
        return
      }
      try {
        const res = await getSelf()
        if (res.success && res.data) {
          const quota = (res.data as { quota?: number }).quota ?? 0
          if (quota > initialQuotaRef.current) {
            clearInterval(timer)
            doneRef.current = true
            setDone(true)
            setLoading(false)
            toast.success(t('Payment successful'))
            setTimeout(() => onSuccessRef.current(), 600)
          }
        }
      } catch {
        // ignore transient poll errors
      }
    }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleClose = (next: boolean) => {
    if (loading && !done) return
    onOpenChange(next)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-sm'>
        <AlertDialogHeader>
          <AlertDialogTitle className='text-xl font-semibold'>
            {providerName}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('Complete payment in the {{provider}} mini-program', {
              provider: providerName,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className='flex flex-col items-center gap-4 py-4'>
          <div className='flex w-full items-center justify-between text-sm'>
            <span className='text-muted-foreground'>{t('Topup Amount')}</span>
            <span className='font-semibold'>
              {formatLocalCurrencyAmount(topupAmount, {
                digitsLarge: 2,
                digitsSmall: 2,
                abbreviate: false,
              })}
            </span>
          </div>
          <div className='flex w-full items-center justify-between text-sm'>
            <span className='text-muted-foreground'>{t('You Pay')}</span>
            <span className='font-semibold'>
              {formatLocalCurrencyAmount(paymentAmount, {
                digitsLarge: 2,
                digitsSmall: 2,
                abbreviate: false,
              })}
            </span>
          </div>

          <div className='bg-muted/30 flex w-full flex-col items-center gap-3 rounded-lg border p-4 text-center'>
            <Smartphone className='text-muted-foreground h-8 w-8' />
            <p className='text-muted-foreground text-sm'>
              {t(
                'Open the Uter mini-program, go to Wallet → Top up, then this page detects the successful top-up automatically.'
              )}
            </p>
          </div>

          {done && (
            <div className='text-sm font-medium text-green-600'>
              {t('Payment successful')}
            </div>
          )}
          {!done && loading && (
            <div className='text-muted-foreground flex items-center gap-1.5 text-xs'>
              <Loader2 className='h-3.5 w-3.5 animate-spin' />
              {t('Waiting for payment confirmation in the mini-program...')}
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <Button
            variant='outline'
            onClick={() => handleClose(false)}
            disabled={loading && !done}
          >
            {t('Close')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
