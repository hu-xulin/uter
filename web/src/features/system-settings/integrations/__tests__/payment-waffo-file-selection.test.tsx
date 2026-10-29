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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { PaymentSettingsSection } from '../payment-settings-section'

/*
 * Waffo / Waffo Pancake 的密钥字段必须与微信支付、支付宝保持一致：只能通过
 * 「选择 PEM 文件」录入，而不是粘贴文本框。粘贴多行 PEM 极易漏掉首尾行或带入
 * BOM/CRLF，而两个 Waffo SDK 对密钥格式的容忍度不同（waffo-go 只认裸 Base64
 * DER），失败表现都是「参数齐全但签名/验签必然失败」，排查成本极高。
 */

const PKCS1_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIBOgIBAAJBAKj34GkxFhD90vcNLYLInFEX6Ppy1tPf9Cnzj4p4WGeKLs1Pt8Qu
-----END RSA PRIVATE KEY-----`

const PKCS8_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIBVQIBADANBgkqhkiG9w0BAQEFAASCAT8wggE7AgEAAkEAqPfg
-----END PRIVATE KEY-----`

const CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDazCCAlOgAwIBAgIUJz6m1oQ0kQ2m8Yy0F1oQ0kQ2m8YwDQYJKoZIhvcNAQEL
-----END CERTIFICATE-----`

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
  WechatPayEnabled: false,
  WechatPayMchId: '',
  WechatPayAppId: '',
  WechatPayApiKey: '',
  WechatPayApiV3Key: '',
  WechatPaySerialNo: '',
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
  WaffoPancakeEnabled: true,
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

describe('waffo key fields accept PEM files', () => {
  it('accepts a PKCS#1 private key file for the production field', async () => {
    const user = userEvent.setup()
    renderPayment()

    await user.click(screen.getByRole('tab', { name: 'Waffo' }))

    const input = await screen.findByLabelText('RSA Private Key (Production)')
    selectFile(
      input as HTMLInputElement,
      new File([PKCS1_PRIVATE_KEY], 'waffo_private.pem', {
        type: 'text/plain',
      })
    )

    await waitFor(() => {
      expect(screen.getByText('waffo_private.pem')).toBeInTheDocument()
    })
  })

  it('accepts the certificate Waffo issues for the public key field', async () => {
    const user = userEvent.setup()
    renderPayment()

    await user.click(screen.getByRole('tab', { name: 'Waffo' }))

    const input = await screen.findByLabelText('Waffo Public Key (Production)')
    selectFile(
      input as HTMLInputElement,
      new File([CERTIFICATE], 'waffo_cert.pem', { type: 'text/plain' })
    )

    await waitFor(() => {
      expect(screen.getByText('waffo_cert.pem')).toBeInTheDocument()
    })
  })

  it('rejects a file that is not a key at all', async () => {
    const user = userEvent.setup()
    renderPayment()

    await user.click(screen.getByRole('tab', { name: 'Waffo' }))

    const input = (await screen.findByLabelText(
      'RSA Private Key (Production)'
    )) as HTMLInputElement
    selectFile(
      input,
      new File(['this is not a key'], 'notes.txt', { type: 'text/plain' })
    )

    // 校验失败时不得把文件名当成「已选择」，否则用户会以为已经配置成功。
    await waitFor(() => {
      expect(screen.queryByText('notes.txt')).not.toBeInTheDocument()
    })
  })
})

describe('waffo pancake private key accepts PEM files', () => {
  it('accepts a PKCS#8 private key file', async () => {
    const user = userEvent.setup()
    renderPayment()

    await user.click(screen.getByRole('tab', { name: 'Waffo Pancake' }))

    const input = await screen.findByLabelText('API Private Key')
    selectFile(
      input as HTMLInputElement,
      new File([PKCS8_PRIVATE_KEY], 'pancake_private.pem', {
        type: 'text/plain',
      })
    )

    await waitFor(() => {
      expect(screen.getByText('pancake_private.pem')).toBeInTheDocument()
    })
  })
})
