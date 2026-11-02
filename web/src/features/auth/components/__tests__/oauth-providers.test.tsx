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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'

import { OAUTH_BRAND_COLORS } from '@/design-system/tokens/brand-colors'

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

/** 取按钮上内联的 hover 底色变量（品牌色从这里注入，避免业务代码写裸 hex）。 */
function hoverBg(button: HTMLElement): string {
  return button.style.getPropertyValue('--oauth-hover-bg')
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

describe('OAuthProviders hover 品牌色', () => {
  it('每个已知渠道用各自的官方品牌色作 hover 底色', () => {
    renderProviders()
    const buttons = buttonsInOrder()
    expect(buttons).toHaveLength(ORDER.length)

    const expected: Record<string, string> = {
      wechat_web: OAUTH_BRAND_COLORS.wechat,
      github: OAUTH_BRAND_COLORS.github,
      discord: OAUTH_BRAND_COLORS.discord,
      linuxdo: OAUTH_BRAND_COLORS.linuxdo,
      telegram: OAUTH_BRAND_COLORS.telegram,
    }
    ORDER.forEach((key, index) => {
      const brand = expected[key]
      if (!brand) return
      const button = buttons[index]
      expect(hoverBg(button), key).toBe(brand)
      // 品牌色底上必须把文字与图标一起转白，否则深色图标在深底上看不见。
      expect(button.className, key).toContain('hover:text-white')
      expect(button.className, key).toContain('hover:[&_svg]:text-white')
      expect(button.className, key).toContain('hover:bg-(--oauth-hover-bg)')
    })
  })

  it('没有已知品牌色的渠道回退站点主色，前景用 primary-foreground', () => {
    renderProviders()
    const buttons = buttonsInOrder()

    for (const key of ['oidc', 'custom'] as const) {
      const button = buttons[ORDER.indexOf(key)]
      expect(hoverBg(button), key).toBe('var(--primary)')
      expect(button.className, key).toContain('hover:text-primary-foreground')
      // 主色可能是浅色，绝不能写死白色。
      expect(button.className, key).not.toContain('hover:text-white')
    }
  })

  it('深色模式也要覆盖 outline 变体自带的 dark:hover 底色', () => {
    renderProviders()
    const wechat = buttonsInOrder()[ORDER.indexOf('wechat_web')]
    expect(wechat.className).toContain('dark:hover:bg-(--oauth-hover-bg)')
    expect(wechat.className).toContain('dark:hover:text-white')
    expect(wechat.className).toContain('dark:hover:[&_svg]:text-white')
  })

  it('写死 fill 的图标（LinuxDO）额外把 path 填白', () => {
    renderProviders()
    const buttons = buttonsInOrder()

    expect(buttons[ORDER.indexOf('linuxdo')].className).toContain(
      'hover:[&_svg_path]:fill-white'
    )
    // 其余渠道的图标走 currentColor，不需要也不该强改 fill
    expect(buttons[ORDER.indexOf('wechat_web')].className).not.toContain(
      'fill-white'
    )
  })

  it('整体禁用时所有渠道按钮都不可点', () => {
    render(<OAuthProviders status={allProviders} disabled />)
    const buttons = buttonsInOrder()
    expect(buttons).toHaveLength(ORDER.length)
    for (const button of buttons) {
      expect(button).toBeDisabled()
    }
  })

  it('只开启微信时只渲染一个按钮（回归：品牌色映射不能影响可见渠道）', () => {
    renderProviders({
      wechat_web_login: true,
    } as unknown as SystemStatus)
    const buttons = buttonsInOrder()
    expect(buttons).toHaveLength(1)
    expect(hoverBg(buttons[0])).toBe(OAUTH_BRAND_COLORS.wechat)
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
      />,
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

    expect(toast.error).toHaveBeenCalledWith('Please agree to the legal terms first')
    expect(oauthHandlers.handleWeChatWebLogin).not.toHaveBeenCalled()
  })
})
