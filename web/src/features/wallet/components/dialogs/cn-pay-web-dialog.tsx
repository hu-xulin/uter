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
import { Loader2, QrCode, Smartphone, XCircle } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
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
import { handleServerError } from '@/lib/handle-server-error'

import {
  requestAlipayWebPayment,
  requestWechatWebPayment,
  isApiSuccess,
} from '../../api'
import {
  detectPayClient,
  formatCNYAmount,
  isAlipayWebPayment,
  toPayAmount,
} from '../../lib'
import type { PaymentMethod } from '../../types'

interface CnPayWebDialogProps {
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
const POLL_TIMEOUT_MS = 300_000

/**
 * Website payment cashier for the official Alipay / WeChat Pay gateways.
 *
 * Two cashier forms, chosen by the client form factor:
 * - PC     → Alipay: redirect to PC cashier (alipay.trade.page.pay) via pay_url;
 *            WeChat: QR code (Native) + balance polling.
 * - Mobile → direct browser redirect to the provider cashier
 *            (Alipay wap / WeChat H5), which then returns via return_url.
 */
export function CnPayWebDialog({
  open,
  onOpenChange,
  topupAmount,
  paymentAmount,
  initialQuota,
  paymentMethod,
  onSuccess,
}: CnPayWebDialogProps) {
  const { t } = useTranslation()
  const [qrContent, setQrContent] = useState<string | null>(null)
  const [redirecting, setRedirecting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const initialQuotaRef = useRef(initialQuota)
  const onSuccessRef = useRef(onSuccess)
  const doneRef = useRef(false)

  initialQuotaRef.current = initialQuota
  onSuccessRef.current = onSuccess

  const isAlipay = isAlipayWebPayment(paymentMethod?.type ?? '')
  const providerName = isAlipay ? t('Alipay') : t('WeChat Pay')

  // Create the order when the dialog opens.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setQrContent(null)
    setRedirecting(false)
    setError(null)
    setDone(false)
    doneRef.current = false

    const createOrder = async () => {
      if (!paymentMethod) return
      setLoading(true)
      try {
        const request = {
          amount: toPayAmount(topupAmount),
          payment_method: paymentMethod.type,
          client: detectPayClient(),
        }
        const response = isAlipay
          ? await requestAlipayWebPayment(request)
          : await requestWechatWebPayment(request)
        if (cancelled) return

        if (!isApiSuccess(response) || !response.data) {
          setError(t('Failed to create payment order'))
          return
        }
        const data = response.data
        // Mobile cashier: leave the page and let the provider app take over.
        const redirectUrl = data.pay_url || data.h5_url
        if (redirectUrl) {
          setRedirecting(true)
          window.location.href = redirectUrl
          return
        }
        // PC WeChat Pay renders a Native QR; Alipay always comes back as pay_url
        // above, so it never reaches this branch.
        const content = data.code_url || ''
        if (!content) {
          setError(t('Failed to create payment order'))
          return
        }
        setQrContent(content)
      } catch (err) {
        if (!cancelled) {
          handleServerError(err)
          setError(t('Failed to create payment order'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void createOrder()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Poll wallet balance until it increases (payment success) or timeout.
  useEffect(() => {
    if (!open || !qrContent || done) return
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
  }, [open, qrContent, done])

  const handleClose = (next: boolean) => {
    if (redirecting) return
    onOpenChange(next)
  }

  // Cashier body: error → redirecting → QR → creating.
  function renderCashier() {
    if (error) {
      return (
        <div className='border-destructive/40 bg-destructive/5 flex w-full flex-col items-center gap-2 rounded-lg border p-4 text-center'>
          <XCircle className='text-destructive size-8' />
          <p className='text-destructive text-sm'>{error}</p>
        </div>
      )
    }
    if (redirecting) {
      return (
        <div className='bg-muted/30 flex w-full flex-col items-center gap-2 rounded-lg border p-4 text-center'>
          <Smartphone className='text-muted-foreground size-8' />
          <p className='text-muted-foreground text-sm'>
            {t('Redirecting to {{provider}}...', { provider: providerName })}
          </p>
        </div>
      )
    }
    if (qrContent) {
      return (
        <div className='bg-muted/30 flex w-full flex-col items-center gap-3 rounded-lg border p-4'>
          <div className='bg-surface-pure rounded-lg p-3'>
            <QRCodeSVG value={qrContent} size={168} level='M' />
          </div>
          <p className='text-muted-foreground text-center text-sm'>
            {t('Scan the QR code with the {{provider}} app to pay', {
              provider: providerName,
            })}
          </p>
        </div>
      )
    }
    return (
      <div className='bg-muted/30 flex w-full flex-col items-center gap-3 rounded-lg border p-6'>
        {loading ? (
          <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
        ) : (
          <QrCode className='text-muted-foreground h-8 w-8' />
        )}
        <p className='text-muted-foreground text-sm'>
          {t('Creating payment order...')}
        </p>
      </div>
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-sm'>
        <AlertDialogHeader>
          <AlertDialogTitle className='font-semibold'>
            {providerName}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('Pay with {{provider}}', { provider: providerName })}
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
              {/* 官方直连（支付宝/微信）的下单金额恒为人民币：后端
                  getPayMoney = amount × Price（Price 是每美元额度的人民币价），
                  原样提交给网关。此处必须强制 ¥，跟随 quotaDisplayType 会在
                  USD 显示配置下错显成 $。 */}
              {formatCNYAmount(paymentAmount)}
            </span>
          </div>

          {renderCashier()}

          {done && (
            <div className='text-success text-sm font-medium'>
              {t('Payment successful')}
            </div>
          )}
          {!done && qrContent && !error && (
            <div className='text-muted-foreground flex items-center gap-1.5 text-xs'>
              <Loader2 className='h-4 w-4 animate-spin' />
              {t('Waiting for payment confirmation...')}
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <Button
            variant='outline'
            onClick={() => handleClose(false)}
            disabled={redirecting}
          >
            {t('Close')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
