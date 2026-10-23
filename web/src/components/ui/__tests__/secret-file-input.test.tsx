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

You should have received a copy of the GNU Affero General
License along with this program. If not, see
<https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'

import { SecretFileInput } from '../secret-file-input'

/** 受控包装，模拟 react-hook-form 的 field.value / field.onChange。 */
function Harness({
  initial = '',
  expectedPemType,
  allowBase64,
  onError,
}: {
  initial?: string
  expectedPemType?: string
  allowBase64?: boolean
  onError?: (message: string) => void
}) {
  const [value, setValue] = React.useState(initial)
  return (
    <div>
      <SecretFileInput
        value={value}
        onChange={setValue}
        expectedPemType={expectedPemType}
        allowBase64={allowBase64}
        onError={onError}
      />
      <output data-testid='value'>{value}</output>
    </div>
  )
}

/** 选中一个内存中的文件。jsdom 的 input.files 只读，需用 defineProperty 覆盖。 */
function selectFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

const VALID_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQ
-----END PRIVATE KEY-----`

/** 支付宝开放平台下发的「支付宝公钥」常常只有一串 base64，没有 PEM 头。 */
const BARE_PUBLIC_KEY =
  'M'.repeat(64) + 'Q'.repeat(64) + 'z'.repeat(64) + '9'.repeat(64)

describe('SecretFileInput', () => {
  it('shows an empty state before anything is configured', () => {
    render(<Harness />)
    expect(screen.getByText('No file selected')).toBeInTheDocument()
  })

  it('shows the masked value from the backend without exposing a reveal action', () => {
    render(<Harness initial='abcd********wxyz' />)
    // 掩码串本身可见（管理员据此确认「已配置」）。
    // 用 `selector: 'p'` 收窄：测试脚手架里的 <output> 也含同一段文本。
    expect(
      screen.getByText('abcd********wxyz', { selector: 'p' })
    ).toBeInTheDocument()
    // 掩码串没有任何明文可展开，因此不出现查看/隐藏按钮。
    expect(screen.queryByRole('button', { name: 'Reveal' })).toBeNull()
  })

  it('reads a PEM file into the value with BOM and CRLF normalized', async () => {
    render(<Harness expectedPemType='PRIVATE KEY' />)

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    // 模拟 Windows 记事本：带 BOM + CRLF 行尾。
    const file = new File(
      ['\uFEFF' + VALID_PRIVATE_KEY.replace(/\n/g, '\r\n')],
      'apiclient_key.pem',
      { type: 'application/x-pem-file' }
    )
    selectFile(input, file)

    // 读文件走 FileReader / file.text()，等一个微任务队列刷新。
    await vi.waitFor(() => {
      expect(screen.getByTestId('value').textContent).toBe(VALID_PRIVATE_KEY)
    })
    expect(screen.getByText('apiclient_key.pem')).toBeInTheDocument()
    // 选中的文件是真明文，此时允许展开查看。
    expect(
      await screen.findByRole('button', { name: /Reveal/ })
    ).toBeInTheDocument()
  })

  it('rejects a file whose PEM header does not match the expected type', async () => {
    const onError = vi.fn()
    render(<Harness expectedPemType='PUBLIC KEY' onError={onError} />)

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    // 私有钥文件选到「微信支付公钥」位置：必须拦住，否则验签必然失败。
    selectFile(
      input,
      new File([VALID_PRIVATE_KEY], 'apiclient_key.pem', { type: 'text/plain' })
    )

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('not a valid PEM file')
      )
    })
    // 校验失败不得写入值。
    expect(screen.getByTestId('value').textContent).toBe('')
  })

  it('overlays the real file input on the trigger instead of forwarding clicks', () => {
    render(<Harness />)
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement

    // 点击必须落在 input 本身（由浏览器原生打开文件选择框）。sr-only 的隐藏
    // input + 按钮转发 click() 曾被多个浏览器/父级样式静默吞掉，不得回退。
    expect(input.className).toContain('absolute')
    expect(input.className).toContain('opacity-0')
    expect(input.className).not.toContain('sr-only')
    expect(input.getAttribute('aria-label')).toBe('Choose PEM file')
    expect(screen.getByText('Choose PEM file')).toBeInTheDocument()
  })

  it('accepts a base64-only key file when explicitly allowed', async () => {
    render(<Harness expectedPemType='PUBLIC KEY' allowBase64 />)

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    selectFile(
      input,
      new File([BARE_PUBLIC_KEY], 'alipay_public_key.txt', {
        type: 'text/plain',
      })
    )

    await vi.waitFor(() => {
      expect(screen.getByTestId('value').textContent).toBe(BARE_PUBLIC_KEY)
    })
  })

  it('rejects a base64-only key file unless explicitly allowed', async () => {
    const onError = vi.fn()
    render(<Harness expectedPemType='PUBLIC KEY' onError={onError} />)

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    selectFile(
      input,
      new File([BARE_PUBLIC_KEY], 'alipay_public_key.txt', {
        type: 'text/plain',
      })
    )

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('not a valid PEM file')
      )
    })
    expect(screen.getByTestId('value').textContent).toBe('')
  })

  it('clears the value through the explicit action', async () => {
    const user = userEvent.setup()
    render(<Harness initial='abcd********wxyz' />)

    await user.click(screen.getByRole('button', { name: /Clear/ }))
    expect(screen.getByTestId('value').textContent).toBe('')
    expect(screen.getByText('No file selected')).toBeInTheDocument()
  })
})
