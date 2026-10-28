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
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'
import { getSelf } from '@/lib/api'

import { queryAlipayOrder } from './api'
import { AffiliateRewardsCard } from './components/affiliate-rewards-card'
import { BillingHistoryDialog } from './components/dialogs/billing-history-dialog'
import { CnPayWebDialog } from './components/dialogs/cn-pay-web-dialog'
import { CreemConfirmDialog } from './components/dialogs/creem-confirm-dialog'
import { PaymentConfirmDialog } from './components/dialogs/payment-confirm-dialog'
import { TransferDialog } from './components/dialogs/transfer-dialog'
import { RechargeFormCard } from './components/recharge-form-card'
import { SubscriptionPlansCard } from './components/subscription-plans-card'
import { WalletStatsCard } from './components/wallet-stats-card'
import { DEFAULT_DISCOUNT_RATE, PAYMENT_TYPES } from './constants'
import { pollAlipayOrder } from './lib/alipay-return'
import {
  useTopupInfo,
  usePayment,
  useAffiliate,
  useRedemption,
  useCreemPayment,
  useWaffoPayment,
  useWaffoPancakePayment,
  isPayableAmount,
} from './hooks'
import {
  getDefaultPaymentType,
  getMinTopupAmount,
  dispatchSelectedPayment,
  isCnWebPayment,
} from './lib'
import type {
  UserWalletData,
  PaymentMethod,
  PresetAmount,
  CreemProduct,
  WaffoPayMethod,
} from './types'

interface WalletProps {
  initialShowHistory?: boolean
}

export function Wallet(props: WalletProps) {
  const { t } = useTranslation()
  const [user, setUser] = useState<UserWalletData | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  // 区分「加载成功」「没有数据」和「请求失败」：失败时不能把 user 留空渲染成
  // 「余额 0」，否则用户会把网络故障误读成账户状态。
  const [userError, setUserError] = useState<string | null>(null)
  const [topupAmount, setTopupAmount] = useState(0)
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod>()
  const [selectedWaffoMethodIndex, setSelectedWaffoMethodIndex] = useState<
    number | null
  >(null)
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [billingDialogOpen, setBillingDialogOpen] = useState(false)
  const [redemptionCode, setRedemptionCode] = useState('')
  const [creemDialogOpen, setCreemDialogOpen] = useState(false)
  const [selectedCreemProduct, setSelectedCreemProduct] =
    useState<CreemProduct | null>(null)
  const [showSubscriptionPanel, setShowSubscriptionPanel] = useState(true)
  const [cnWebPayOpen, setCnWebPayOpen] = useState(false)
  const [cnWebPayMethod, setCnWebPayMethod] = useState<
    PaymentMethod | undefined
  >()

  const { status } = useStatus()
  const { currency } = useSystemConfig()
  const { topupInfo, presetAmounts, loading: topupLoading } = useTopupInfo()

  // 钱包里的汇率 C = B：B 就是 /api/status 下发的 price（「支付定价」= A + 0.2），
  // 也是后端下单实扣金额所用的单价。USD 展示模式下额度本身以美元计，换算系数为 1；
  // CNY / 自定义货币模式下按 B 换算，保证面额卡片的大字金额与「应付 ¥X」是同一个数，
  // 不会出现「大字按 A、实扣按 B」的错位。
  const payRate = (status?.price as number) || 0
  const effectiveUsdExchangeRate = useMemo(() => {
    if (currency?.quotaDisplayType === 'USD') return 1
    return payRate > 0 ? payRate : currency?.usdExchangeRate || 1
  }, [currency?.quotaDisplayType, payRate, currency?.usdExchangeRate])
  const {
    amount: paymentAmount,
    calculating,
    calculatingError,
    processing,
    calculatePaymentAmount,
    processPayment,
  } = usePayment()
  const {
    affiliateLink,
    loading: affiliateLoading,
    transferQuota,
    transferring,
  } = useAffiliate()
  const { redeeming, redeemCode } = useRedemption()
  const { processing: creemProcessing, processCreemPayment } = useCreemPayment()
  const { processing: waffoProcessing, processWaffoPayment } = useWaffoPayment()
  const { processing: pancakeProcessing, processWaffoPancakePayment } =
    useWaffoPancakePayment()

  // Fetch and refresh user data
  const fetchUser = useCallback(async () => {
    try {
      setUserLoading(true)
      setUserError(null)
      const response = await getSelf()
      if (response.success && response.data) {
        setUser(response.data as UserWalletData)
      } else {
        setUserError(response.message || t('Failed to load'))
      }
    } catch (error) {
      setUserError(t('Failed to load'))
      // eslint-disable-next-line no-console
      console.error('Failed to fetch user data:', error)
    } finally {
      setUserLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  // 支付宝收银台回跳：return_url 带 pay=success&trade_no。异步回调（notify_url）
  // 在本地 / 内网环境不可达时订单会停在 pending，这里主动查单确认，与回调互为兜底。
  //
  // 刚付完款时支付宝侧状态可能有几秒延迟，所以带重试：命中 success 立即提示并刷新
  // 余额，全部尝试仍为 pending 才提示「支付确认中」，避免订单一直显示待确认。
  const alipayReturnHandledRef = useRef(false)
  useEffect(() => {
    if (alipayReturnHandledRef.current) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('pay') !== 'success') return
    const tradeNo = params.get('trade_no')
    if (!tradeNo) return
    alipayReturnHandledRef.current = true

    // 清掉查询参数，避免刷新页面时重复查询。
    params.delete('pay')
    params.delete('trade_no')
    const rest = params.toString()
    window.history.replaceState(
      {},
      '',
      window.location.pathname + (rest ? `?${rest}` : '')
    )

    let cancelled = false
    void pollAlipayOrder(tradeNo, {
      query: queryAlipayOrder,
      onSuccess: async () => {
        toast.success(t('Payment successful'))
        await fetchUser()
      },
      onPending: () => {
        toast.info(t('Payment is being confirmed'))
      },
      onUnpaid: async () => {
        // 支付宝侧查无此交易 / 交易已关闭：再等也不会变成功，必须如实告知，
        // 否则用户会一直以为系统正在确认，钱包里那条记录却永远停在「待确认」。
        toast.warning(
          t(
            'This order was not paid. If you still need to top up, please place a new order.'
          )
        )
        await fetchUser()
      },
      isCancelled: () => cancelled,
    })

    return () => {
      cancelled = true
    }
  }, [fetchUser, t])

  useEffect(() => {
    if (props.initialShowHistory) {
      setBillingDialogOpen(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [props.initialShowHistory])

  // Initialize topup amount when topup info is loaded
  const topupAmountInitializedRef = useRef(false)
  useEffect(() => {
    if (topupInfo && !topupAmountInitializedRef.current) {
      topupAmountInitializedRef.current = true
      // 默认金额取第一个预设档位，而不是「最低充值」。
      // 运营把最低额调到 0.01 之后，直接拿 minTopup 当默认值会让钱包页一打开
      // 就停在 0.01（应付 ¥0.06），既不像一次充值，也让「应付金额」看着像故障。
      // 没有预设档位时才退回最低额。
      const initialAmount =
        presetAmounts[0]?.value ?? getMinTopupAmount(topupInfo)
      setTopupAmount(initialAmount)

      // Calculate initial payment amount with default payment type
      const defaultPaymentType = getDefaultPaymentType(topupInfo)
      calculatePaymentAmount(initialAmount, defaultPaymentType)
    }
  }, [topupInfo, presetAmounts, calculatePaymentAmount])

  // 汇率（status.price）被后台修改并即时同步到钱包后，重新计价，使「应付金额」也
  // 立即跟随，无需用户重新点选面额。面额 / 支付方式变更走各自的处理函数，不在此触发。
  useEffect(() => {
    if (topupAmount > 0) {
      void calculatePaymentAmount(topupAmount, getCurrentPaymentType())
    }
    // 仅在汇率变化时重算；calculatePaymentAmount / getCurrentPaymentType 的引用
    // 变化已由各自的处理函数覆盖，这里刻意不列入依赖以避免重复计价。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.price])

  // Get current payment type (selected or default)
  const getCurrentPaymentType = useCallback(() => {
    return selectedPaymentMethod?.type || getDefaultPaymentType(topupInfo)
  }, [selectedPaymentMethod, topupInfo])

  // Handle preset selection
  const handleSelectPreset = (preset: PresetAmount) => {
    setTopupAmount(preset.value)
    setSelectedPreset(preset.value)
    calculatePaymentAmount(preset.value, getCurrentPaymentType())
  }

  // Handle topup amount change
  const handleTopupAmountChange = (amount: number) => {
    setTopupAmount(amount)
    setSelectedPreset(null)
    calculatePaymentAmount(amount, getCurrentPaymentType())
  }

  // Handle payment method selection
  const handlePaymentMethodSelect = async (method: PaymentMethod) => {
    setSelectedPaymentMethod(method)
    setSelectedWaffoMethodIndex(null)
    setPaymentLoading(method.type)

    try {
      // Validate minimum topup
      const minTopup = getMinTopupAmount(topupInfo)
      if (topupAmount < minTopup) {
        return
      }

      // Calculate payment amount and show confirmation dialog.
      // 计价失败时不能打开确认框：确认框会把 amount=0 渲染成「应付 0 元」，
      // 用户点确认就进入收款流程却不知道收了多少钱。
      const amount = await calculatePaymentAmount(topupAmount, method.type)
      if (!isPayableAmount(amount)) {
        toast.error(t('Failed to calculate payment amount. Please try again.'))
        return
      }
      setConfirmDialogOpen(true)
    } finally {
      setPaymentLoading(null)
    }
  }

  // Handle payment confirmation
  const handlePaymentConfirm = async () => {
    if (!selectedPaymentMethod) return

    // Official China website payments (Alipay / WeChat web cashier): the dialog
    // creates the order and renders a QR (PC) or redirects to the provider
    // cashier (mobile), then polls the wallet balance until it is credited.
    if (isCnWebPayment(selectedPaymentMethod.type)) {
      setCnWebPayMethod(selectedPaymentMethod)
      setCnWebPayOpen(true)
      setConfirmDialogOpen(false)
      return
    }

    // Official China payments (Alipay / WeChat website payment) open the
    // web cashier: a QR code on PC, a redirect to the provider cashier on
    // mobile. Both poll the wallet balance until it is credited.
    if (isCnWebPayment(selectedPaymentMethod.type)) {
      setCnWebPayMethod(selectedPaymentMethod)
      setCnWebPayOpen(true)
      setConfirmDialogOpen(false)
      return
    }

    const success = await dispatchSelectedPayment(
      selectedPaymentMethod,
      topupAmount,
      selectedWaffoMethodIndex,
      {
        regular: processPayment,
        waffo: processWaffoPayment,
        waffoPancake: processWaffoPancakePayment,
      }
    )

    if (success) {
      setConfirmDialogOpen(false)
      await fetchUser()
    }
  }

  // Handle redemption
  const handleRedeem = async () => {
    if (!redemptionCode) return

    const success = await redeemCode(redemptionCode)
    if (success) {
      setRedemptionCode('')
      await fetchUser()
    }
  }

  // Handle transfer
  const handleTransfer = async (amount: number) => {
    const success = await transferQuota(amount)
    if (success) {
      await fetchUser()
    }
    return success
  }

  // Handle Creem product selection
  const handleCreemProductSelect = (product: CreemProduct) => {
    setSelectedCreemProduct(product)
    setCreemDialogOpen(true)
  }

  // Handle Creem payment confirmation
  const handleCreemConfirm = async () => {
    if (!selectedCreemProduct) return

    const success = await processCreemPayment(selectedCreemProduct.productId)
    if (success) {
      setCreemDialogOpen(false)
      setSelectedCreemProduct(null)
      await fetchUser()
    }
  }

  const handleWaffoMethodSelect = async (
    method: WaffoPayMethod,
    index: number
  ) => {
    const loadingKey = `waffo-${index}`
    setSelectedPaymentMethod({
      name: method.name,
      type: PAYMENT_TYPES.WAFFO,
      icon: method.icon,
    })
    setSelectedWaffoMethodIndex(index)
    setPaymentLoading(loadingKey)

    try {
      const amount = await calculatePaymentAmount(
        topupAmount,
        PAYMENT_TYPES.WAFFO
      )
      if (!isPayableAmount(amount)) {
        toast.error(t('Failed to calculate payment amount. Please try again.'))
        return
      }
      setConfirmDialogOpen(true)
    } finally {
      setPaymentLoading(null)
    }
  }

  // Get discount rate for current topup amount
  const getDiscountRate = useCallback(() => {
    return topupInfo?.discount?.[topupAmount] || DEFAULT_DISCOUNT_RATE
  }, [topupInfo, topupAmount])

  const handleSubscriptionAvailabilityChange = useCallback(
    (available: boolean) => {
      setShowSubscriptionPanel(available)
    },
    []
  )

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Wallet')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5'>
            {userError && (
              <Alert variant='destructive'>
                <AlertTitle>{t('Failed to load')}</AlertTitle>
                <AlertDescription className='flex flex-wrap items-center gap-3'>
                  <span className='min-w-0 break-words'>{userError}</span>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => void fetchUser()}
                    disabled={userLoading}
                  >
                    {t('Retry')}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <WalletStatsCard user={user} loading={userLoading} />

            <div
              className={
                showSubscriptionPanel
                  ? 'grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] xl:items-start'
                  : 'grid gap-4'
              }
            >
              <div id='wallet-add-funds' className='scroll-mt-4'>
                <RechargeFormCard
                  topupInfo={topupInfo}
                  presetAmounts={presetAmounts}
                  selectedPreset={selectedPreset}
                  onSelectPreset={handleSelectPreset}
                  topupAmount={topupAmount}
                  onTopupAmountChange={handleTopupAmountChange}
                  paymentAmount={paymentAmount}
                  calculating={calculating}
                  calculatingError={calculatingError}
                  onRetryCalculate={() =>
                    void calculatePaymentAmount(
                      topupAmount,
                      getCurrentPaymentType()
                    )
                  }
                  onPaymentMethodSelect={handlePaymentMethodSelect}
                  paymentLoading={paymentLoading}
                  selectedPaymentMethod={selectedPaymentMethod}
                  redemptionCode={redemptionCode}
                  onRedemptionCodeChange={setRedemptionCode}
                  onRedeem={handleRedeem}
                  redeeming={redeeming}
                  topupLink={topupInfo?.topup_link}
                  loading={topupLoading}
                  priceRatio={(status?.price as number) || 1}
                  usdExchangeRate={effectiveUsdExchangeRate}
                  onOpenBilling={() => setBillingDialogOpen(true)}
                  creemProducts={topupInfo?.creem_products}
                  enableCreemTopup={topupInfo?.enable_creem_topup}
                  onCreemProductSelect={handleCreemProductSelect}
                  enableWaffoTopup={topupInfo?.enable_waffo_topup}
                  waffoPayMethods={topupInfo?.waffo_pay_methods}
                  waffoMinTopup={topupInfo?.waffo_min_topup}
                  onWaffoMethodSelect={handleWaffoMethodSelect}
                  enableWaffoPancakeTopup={
                    topupInfo?.enable_waffo_pancake_topup
                  }
                />
              </div>

              <SubscriptionPlansCard
                topupInfo={topupInfo}
                onAvailabilityChange={handleSubscriptionAvailabilityChange}
                userQuota={user?.quota}
                onPurchaseSuccess={fetchUser}
              />
            </div>

            <AffiliateRewardsCard
              user={user}
              affiliateLink={affiliateLink}
              onTransfer={() => setTransferDialogOpen(true)}
              complianceConfirmed={
                topupInfo?.payment_compliance_confirmed !== false
              }
              loading={affiliateLoading}
            />
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <PaymentConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={handlePaymentConfirm}
        topupAmount={topupAmount}
        paymentAmount={paymentAmount}
        paymentMethod={selectedPaymentMethod}
        calculating={calculating}
        processing={processing || waffoProcessing || pancakeProcessing}
        discountRate={getDiscountRate()}
        usdExchangeRate={effectiveUsdExchangeRate}
      />

      <TransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        onConfirm={handleTransfer}
        availableQuota={user?.aff_quota ?? 0}
        transferring={transferring}
      />

      <BillingHistoryDialog
        open={billingDialogOpen}
        onOpenChange={setBillingDialogOpen}
      />

      <CreemConfirmDialog
        open={creemDialogOpen}
        onOpenChange={setCreemDialogOpen}
        onConfirm={handleCreemConfirm}
        product={selectedCreemProduct}
        processing={creemProcessing}
      />

      <CnPayWebDialog
        open={cnWebPayOpen}
        onOpenChange={setCnWebPayOpen}
        topupAmount={topupAmount}
        paymentAmount={paymentAmount}
        initialQuota={user?.quota ?? 0}
        paymentMethod={cnWebPayMethod}
        onSuccess={() => {
          setCnWebPayOpen(false)
          setCnWebPayMethod(undefined)
          void fetchUser()
        }}
      />
    </>
  )
}
