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
import { render, screen } from '@testing-library/react'
import { useForm, FormProvider } from 'react-hook-form'
import { describe, expect, it } from 'vitest'

import { WechatPaySettingsSection } from '../wechat-pay-settings-section'

const VALID_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA
-----END PUBLIC KEY-----`

function selectFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function Fixture() {
  const form = useForm({
    defaultValues: {
      WechatPayEnabled: true,
      WechatPayMchId: '1900000000',
      WechatPayAppId: 'wx1234567890abcdef',
      WechatPayApiV3Key: 'a'.repeat(32),
      WechatPaySerialNo: '1234567890abcdef1234567890abcdef',
      WechatPayPrivateKey: '',
      WechatPayPublicKey: '',
    },
  })
  return (
    <FormProvider {...form}>
      <WechatPaySettingsSection />
    </FormProvider>
  )
}

describe('wechat pay public key file selection', () => {
  it('shows the selected file immediately without a refresh', async () => {
    render(<Fixture />)

    // 通过 FormLabel 的 htmlFor 关联精确定位「微信支付公钥」那个 file input
    // （页面同时存在私钥与公钥两个选择框，不能靠 querySelector 顺序猜）。
    const input = screen.getByLabelText(
      'WeChat Pay Public Key (pub_key.pem)'
    ) as HTMLInputElement
    expect(input.type).toBe('file')
    selectFile(
      input,
      new File([VALID_PUBLIC_KEY], 'pub_key.pem', { type: 'text/plain' })
    )

    await screen.findByText('pub_key.pem')
  })
})
