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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { PaymentSettingsSection } from '../payment-settings-section'

const VALID_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA
-----END PUBLIC KEY-----`

function selectFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

const baseDefaults = {
  PayAddress: '',
  EpayId: '',
  EpayKey: '',
  Price: 1,
  MinTopUp: 1,
  OrderTitlePrefix: '',
  CustomCallbackAddress: '',
  PaymentSiteAddress: '',
  PayMethods: '[]',
  AmountOptions: '[]',
  AmountDiscount: '{}',
  StripeApiSecret: '',
  StripeWebhookSecret: '',
  StripePriceId: '',
  StripeUnitPrice: 1,
  StripeMinTopUp: 1,
  StripePromotionCodesEnabled: false,
  CreemApiKey: '',
  CreemWebhookSecret: '',
  CreemTestMode: false,
  CreemProducts: '[]',
  AlipayEnabled: false,
  AlipayAppId: '',
  AlipayPrivateKey: '',
  AlipayPublicKey: '',
  WechatPayEnabled: true,
  WechatPayMchId: '1900000000',
  WechatPayAppId: 'wx1234567890abcdef',
  WechatPayApiV3Key: 'a'.repeat(32),
  WechatPaySerialNo: '1234567890abcdef1234567890abcdef',
  WechatPayPrivateKey: '',
  WechatPayPublicKey: '',
}

const waffoDefaults = {
  WaffoEnabled: false,
  WaffoApiKey: '',
  WaffoPrivateKey: '',
  WaffoPublicCert: '',
  WaffoSandboxPublicCert: '',
  WaffoSandboxApiKey: '',
  WaffoSandboxPrivateKey: '',
  WaffoSandbox: false,
  WaffoMerchantId: '',
  WaffoCurrency: 'USD',
  WaffoUnitPrice: 1,
  WaffoMinTopUp: 1,
  WaffoNotifyUrl: '',
  WaffoReturnUrl: '',
  WaffoPayMethods: '[]',
}

const waffoPancakeDefaults = {
  WaffoPancakeMerchantID: '',
  WaffoPancakePrivateKey: '',
  WaffoPancakeReturnURL: '',
}

function renderPayment() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  function Fixture() {
    const [actions, setActions] = useState<HTMLDivElement | null>(null)
    return (
      <SettingsPageProvider actionsContainer={actions}>
        <div ref={setActions} />
        <PaymentSettingsSection
          defaultValues={baseDefaults}
          waffoDefaultValues={waffoDefaults}
          waffoPancakeDefaultValues={waffoPancakeDefaults}
          complianceDefaults={{
            confirmed: true,
            termsVersion: 'v1',
            confirmedAt: 0,
            confirmedBy: 0,
          }}
        />
      </SettingsPageProvider>
    )
  }
  return render(
    <QueryClientProvider client={client}>
      <Fixture />
    </QueryClientProvider>
  )
}

describe('payment gateway wechat tab', () => {
  it('shows the selected public key file immediately', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'put').mockResolvedValue({ data: { success: true } })
    renderPayment()

    await user.click(screen.getByRole('tab', { name: 'WeChat Pay' }))

    const input = await screen.findByLabelText(
      'WeChat Pay Public Key (pub_key.pem)'
    )
    selectFile(
      input as HTMLInputElement,
      new File([VALID_PUBLIC_KEY], 'pub_key.pem', { type: 'text/plain' })
    )

    await waitFor(() => {
      expect(screen.getByText('pub_key.pem')).toBeInTheDocument()
    })
  })

  it('keeps showing the public key as configured after saving', async () => {
    const user = userEvent.setup()
    const put = vi.spyOn(api, 'put').mockResolvedValue({
      data: { success: true },
    })
    renderPayment()

    await user.click(screen.getByRole('tab', { name: 'WeChat Pay' }))
    const input = await screen.findByLabelText(
      'WeChat Pay Public Key (pub_key.pem)'
    )
    selectFile(
      input as HTMLInputElement,
      new File([VALID_PUBLIC_KEY], 'pub_key.pem', { type: 'text/plain' })
    )
    await waitFor(() => {
      expect(screen.getByText('pub_key.pem')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Save all settings' }))
    await waitFor(() => {
      expect(put).toHaveBeenCalledWith(
        '/api/option/',
        expect.objectContaining({
          key: 'WechatPayPublicKey',
          value: VALID_PUBLIC_KEY,
        })
      )
    })

    // 保存后「微信支付公钥」字段必须仍显示「已配置」态（掩码串或文件名），
    // 不得回到「未选择文件」——同页签下私钥字段为空是预期的，需按字段收窄。
    const label = screen.getByText('WeChat Pay Public Key (pub_key.pem)')
    const formItem = label.closest('[data-slot="form-item"]') as HTMLElement
    await waitFor(() => {
      expect(
        within(formItem).queryByText('No file selected')
      ).not.toBeInTheDocument()
    })
    // eslint-disable-next-line no-console
    console.log('公钥字段保存后展示:', formItem.textContent)
  })
})
