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
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SystemStatus } from '../../types'
import { OAuthProviders } from '../oauth-providers'

const oauthHandlers = vi.hoisted(() => ({
  isLoading: false,
  githubButtonText: '',
  githubButtonDisabled: false,
  handleGitHubLogin: vi.fn(),
  handleDiscordLogin: vi.fn(),
  handleOIDCLogin: vi.fn(),
  handleLinuxDOLogin: vi.fn(),
  handleTelegramLogin: vi.fn(),
  handleWeChatWebLogin: vi.fn(),
  handleCustomOAuthLogin: vi.fn(),
}))

vi.mock('@/features/auth/hooks/use-oauth-login', () => ({
  useOAuthLogin: () => oauthHandlers,
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}))

afterEach(cleanup)

const allProviders = {
  wechat_web_login: true,
  github_oauth: true,
  discord_oauth: true,
  oidc_enabled: true,
  oidc_display_name: 'Acme SSO',
  linuxdo_oauth: true,
  telegram_oauth: true,
  custom_oauth_providers: [{ slug: 'acme', name: 'Acme', icon: '' }],
} as unknown as SystemStatus

function renderProviders(status: SystemStatus = allProviders) {
  render(<OAuthProviders status={status} redirectTo='/wallet' />)
}

/**
 * 按钮文案会被 i18n 翻译，测试里不能靠可见文本定位；
 * 改为按渲染顺序取（顺序由 oauth-providers.tsx 的 push 顺序固定）。
 */
function buttonsInOrder(): HTMLElement[] {
  return screen.getAllByRole('button')
}

// 渲染顺序：wechat_web → github → discord → oidc → linuxdo → telegram → custom
const ORDER = [
  'wechat_web',
  'github',
  'discord',
  'oidc',
  'linuxdo',
  'telegram',
  'custom',
] as const

describe('OAuthProviders hover 语义 Token（3.0 §2.3 审计整改）', () => {
  it('所有渠道 hover 统一走 primary 底 + primary-foreground 前景，不再硬编码白字', () => {
    renderProviders()
    const buttons = buttonsInOrder()
    expect(buttons).toHaveLength(ORDER.length)

    for (const [index, key] of ORDER.entries()) {
      const button = buttons[index]
      expect(button.className, key).toContain('hover:bg-primary')
      expect(button.className, key).toContain('hover:text-primary-foreground')
      expect(button.className, key).toContain(
        'hover:[&_svg]:text-primary-foreground'
      )
      // 硬编码白字与品牌色注入变量都已移除
      expect(button.className, key).not.toContain('hover:text-white')
      expect(button.style.getPropertyValue('--oauth-hover-bg'), key).toBe('')
    }
  })

  it('深色模式同样覆盖 outline 变体的 dark:hover 底色，走语义 Token', () => {
    renderProviders()
    const wechat = buttonsInOrder()[ORDER.indexOf('wechat_web')]
    expect(wechat.className).toContain('dark:hover:bg-primary')
    expect(wechat.className).toContain('dark:hover:text-primary-foreground')
    expect(wechat.className).not.toContain('dark:hover:text-white')
  })

  it('整体禁用时所有渠道按钮都不可点', () => {
    render(<OAuthProviders status={allProviders} disabled />)
    const buttons = buttonsInOrder()
    expect(buttons).toHaveLength(ORDER.length)
    for (const button of buttons) {
      expect(button).toBeDisabled()
    }
  })

  it('只开启微信时只渲染一个按钮（回归：渲染数量不受状态映射影响）', () => {
    renderProviders({
      wechat_web_login: true,
    } as unknown as SystemStatus)
    const buttons = buttonsInOrder()
    expect(buttons).toHaveLength(1)
    expect(buttons[0].className).toContain('hover:bg-primary')
  })
})

describe('OAuthProviders 法律条款门控', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('consentRequired 时按钮保持可点击，点击弹出提示且不发起跳转', async () => {
    const user = userEvent.setup()
    render(
      <OAuthProviders
        status={allProviders}
        consentRequired
        consentRequiredMessage='请先阅读并同意用户协议和隐私政策'
      />
    )
    // 渲染顺序固定：wechat_web(0) → github(1)
    const github = screen.getAllByRole('button')[1]
    expect(github).not.toBeDisabled()

    await user.click(github)

    expect(toast.error).toHaveBeenCalledWith('请先阅读并同意用户协议和隐私政策')
    expect(oauthHandlers.handleGitHubLogin).not.toHaveBeenCalled()
  })

  it('consentRequired 缺省时点击正常发起跳转', async () => {
    const user = userEvent.setup()
    render(<OAuthProviders status={allProviders} />)

    const github = screen.getAllByRole('button')[1]
    expect(github).not.toBeDisabled()

    await user.click(github)

    expect(toast.error).not.toHaveBeenCalled()
    expect(oauthHandlers.handleGitHubLogin).toHaveBeenCalledTimes(1)
  })

  it('consentRequired 时未传自定义文案则回退法律条款通用文案', async () => {
    const user = userEvent.setup()
    render(<OAuthProviders status={allProviders} consentRequired />)

    await user.click(screen.getAllByRole('button')[0])

    expect(toast.error).toHaveBeenCalledWith(
      'Please agree to the legal terms first'
    )
    expect(oauthHandlers.handleWeChatWebLogin).not.toHaveBeenCalled()
  })
})
