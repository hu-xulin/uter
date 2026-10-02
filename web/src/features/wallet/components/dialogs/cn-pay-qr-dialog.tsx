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
*/
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, QrCode, XCircle } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'

import { getSelf } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatLocalCurrencyAmount } from '@/lib/currency'

import {
  requestAlipayPayment,
  requestWechatPayment,
  isApiSuccess,
} from '../../api'
import { handleServerError } from '@/lib/handle-server-error'
import { isAlipayOfficialPayment } from '../../lib'
import type { PaymentMethod } from '../../types'

interface CnPayQrDialogProps {
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
const POLL_TIMEOUT_MS = 120_000

export function CnPayQrDialog({
  open,
  onOpenChange,
  topupAmount,
  paymentAmount,
  initialQuota,
  paymentMethod,
  onSuccess,
}: CnPayQrDialogProps) {
  const { t } = useTranslation()
  const [qrContent, setQrContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const initialQuotaRef = useRef(initialQuota)
  const onSuccessRef = useRef(onSuccess)
  const doneRef = useRef(false)

  initialQuotaRef.current = initialQuota
  onSuccessRef.current = onSuccess

  const isAlipay = isAlipayOfficialPayment(paymentMethod?.type ?? '')

  // Create the order and fetch the QR code when the dialog opens.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setQrContent(null)
    setError(null)
    setDone(false)
    doneRef.current = false

    const createOrder = async () => {
      if (!paymentMethod) return
      setLoading(true)
      try {
        const response = isAlipay
          ? await requestAlipayPayment({
              amount: Math.floor(topupAmount),
              payment_method: paymentMethod.type,
            })
          : await requestWechatPayment({
              amount: Math.floor(topupAmount),
              payment_method: paymentMethod.type,
            })

        if (cancelled) return
        if (!isApiSuccess(response) || !response.data) {
          setError(t('Failed to create payment order'))
          return
        }
        const content =
          response.data.qr_code || response.data.code_url || response.url || ''
        if (!content) {
          setError(t('Failed to create payment order'))
          return
        }
        setQrContent(content)
      } catch (err) {
        if (cancelled) return
        setError(t('Failed to create payment order'))
        handleServerError(err, t('Failed to create payment order'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void createOrder()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, paymentMethod?.type])

  // Poll wallet balance until it increases (payment success) or timeout.
  useEffect(() => {
    if (!open || !qrContent || doneRef.current) return
    let elapsed = 0
    const timer = setInterval(async () => {
      elapsed += POLL_INTERVAL_MS
      if (elapsed >= POLL_TIMEOUT_MS) {
        clearInterval(timer)
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
  }, [open, qrContent])

  const handleClose = (next: boolean) => {
    if (loading && !done) return
    onOpenChange(next)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-sm'>
        <AlertDialogHeader>
          <AlertDialogTitle className='text-xl font-semibold'>
            {isAlipay ? t('Alipay Payment') : t('WeChat Pay')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('Scan the QR code with your app to complete the payment')}
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

          <div className='flex items-center justify-center rounded-lg border bg-white p-4'>
            {loading && !qrContent && (
              <div className='flex h-48 w-48 items-center justify-center'>
                <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
              </div>
            )}
            {error && !loading && (
              <div className='flex h-48 w-48 flex-col items-center justify-center gap-2 text-center text-destructive'>
                <XCircle className='h-8 w-8' />
                <span className='text-xs'>{error}</span>
              </div>
            )}
            {qrContent && !error && (
              <QRCodeSVG value={qrContent} size={192} level='M' />
            )}
          </div>

          {done && (
            <div className='text-sm font-medium text-green-600'>
              {t('Payment successful')}
            </div>
          )}
          {!done && qrContent && !error && (
            <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
              <QrCode className='h-3.5 w-3.5' />
              {t('Waiting for payment confirmation...')}
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
