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
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  IconDiscord,
  IconGithub,
  IconLinuxDo,
  IconTelegram,
  IconWeChat,
} from '@/assets/brand-icons'
import { Button } from '@/components/ui/button'
import { OAUTH_BRAND_COLORS } from '@/design-system/tokens/brand-colors'
import { cn } from '@/lib/utils'

import { useOAuthLogin } from '../hooks/use-oauth-login'
import type { SystemStatus } from '../types'

type OAuthProvidersProps = {
  status: SystemStatus | null
  disabled?: boolean
  className?: string
  redirectTo?: string
  /**
   * 为 true 时渠道按钮保持可点击，但点击不发起跳转，改为弹出
   * `consentRequiredMessage` 提示（用于「未勾选用户协议 / 隐私政策」场景，
   * 与 Passkey 按钮的交互模式一致：按钮不置灰、点击给反馈）。
   */
  consentRequired?: boolean
  /** `consentRequired` 为 true 时点击弹出的提示文案；缺省回退法律条款通用文案。 */
  consentRequiredMessage?: string
}

type ProviderButton = {
  key: string
  label: string
  onClick: () => void
  icon?: ReactNode
  disabled?: boolean
  /**
   * hover 底色。有官方品牌色的渠道取 `OAUTH_BRAND_COLORS`；
   * 没有已知品牌色的（OIDC / 自定义 OAuth）留空，回退站点主色。
   */
  brandColor?: string
  /**
   * 少数品牌图标把颜色写死在 path 的 fill 上（LinuxDO 是白/黄/黑三色块），
   * `text-*` 改不动它，需要额外把 path 填白，否则 hover 后图标还是花的。
   */
  forceWhiteIcon?: boolean
}

export function OAuthProviders({
  status,
  disabled = false,
  className,
  redirectTo,
  consentRequired = false,
  consentRequiredMessage,
}: OAuthProvidersProps) {
  const { t } = useTranslation()
  const {
    isLoading,
    githubButtonText,
    githubButtonDisabled,
    handleGitHubLogin,
    handleDiscordLogin,
    handleOIDCLogin,
    handleLinuxDOLogin,
    handleTelegramLogin,
    handleWeChatWebLogin,
    handleCustomOAuthLogin,
  } = useOAuthLogin(status, redirectTo)

  const providerButtons: ProviderButton[] = []

  if (status?.wechat_web_login) {
    providerButtons.push({
      key: 'wechat_web',
      label: t('Continue with WeChat'),
      onClick: handleWeChatWebLogin,
      icon: <IconWeChat className='h-4 w-4' />,
      brandColor: OAUTH_BRAND_COLORS.wechat,
    })
  }

  if (status?.github_oauth) {
    providerButtons.push({
      key: 'github',
      label: githubButtonText || t('Continue with GitHub'),
      onClick: handleGitHubLogin,
      icon: <IconGithub className='h-4 w-4' />,
      disabled: githubButtonDisabled,
      brandColor: OAUTH_BRAND_COLORS.github,
    })
  }

  if (status?.discord_oauth) {
    providerButtons.push({
      key: 'discord',
      label: t('Continue with Discord'),
      onClick: handleDiscordLogin,
      icon: <IconDiscord className='h-4 w-4' />,
      brandColor: OAUTH_BRAND_COLORS.discord,
    })
  }

  if (status?.oidc_enabled) {
    const oidcDisplayName = status.oidc_display_name?.trim() || 'OIDC'
    providerButtons.push({
      key: 'oidc',
      label: t('Continue with {{name}}', {
        name: oidcDisplayName,
      }),
      onClick: handleOIDCLogin,
    })
  }

  if (status?.linuxdo_oauth) {
    providerButtons.push({
      key: 'linuxdo',
      label: t('Continue with LinuxDO'),
      onClick: handleLinuxDOLogin,
      icon: <IconLinuxDo className='h-4 w-4' />,
      brandColor: OAUTH_BRAND_COLORS.linuxdo,
      forceWhiteIcon: true,
    })
  }

  if (status?.telegram_oauth) {
    providerButtons.push({
      key: 'telegram',
      label: t('Continue with Telegram'),
      onClick: handleTelegramLogin,
      icon: <IconTelegram data-icon='inline-start' />,
      brandColor: OAUTH_BRAND_COLORS.telegram,
    })
  }

  // Custom OAuth providers
  const customProviders = status?.custom_oauth_providers
  if (customProviders && customProviders.length > 0) {
    for (const provider of customProviders) {
      providerButtons.push({
        key: `custom-${provider.slug}`,
        label: t('Continue with {{name}}', { name: provider.name }),
        onClick: () => handleCustomOAuthLogin(provider),
      })
    }
  }

  if (providerButtons.length === 0) return null

  const handleProviderClick = (action: () => void) => {
    if (consentRequired) {
      toast.error(consentRequiredMessage ?? t('Please agree to the legal terms first'))
      return
    }
    action()
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className='relative'>
        <div className='absolute inset-0 flex items-center'>
          <span className='w-full border-t' />
        </div>
        <div className='relative flex justify-center text-xs uppercase'>
          <span className='bg-background text-muted-foreground px-2'>
            {t('Or continue with')}
          </span>
        </div>
      </div>

      {/* 高度跟随输入框（同一 `--ds-control-height-md` token）：此前用 Button
          默认档（--ds-button-height-md），比登录/注册表单里的输入框（含 1px
          边线）矮 4px，与「登录 / 创建账户」按钮堆叠时整列控件高度不一。

          悬停统一走「品牌色底 + 白色图标与文字」：默认是描边态，一排渠道按钮
          彼此难以区分；换成各自的品牌色后能一眼认出是哪一家。
          底色是运行时才知道的 hex，只能用 CSS 变量传给 Tailwind（`bg-(--…)`），
          裸 hex 不允许出现在业务代码里（design-tokens T8）。 */}
      <div className='flex flex-col gap-2'>
        {providerButtons.map(
          ({
            key,
            label,
            onClick,
            icon,
            disabled: extraDisabled,
            brandColor,
            forceWhiteIcon,
          }) => (
            <Button
              key={key}
              variant='outline'
              type='button'
              disabled={disabled || isLoading || extraDisabled}
              onClick={() => handleProviderClick(onClick)}
              style={
                {
                  '--oauth-hover-bg': brandColor ?? 'var(--primary)',
                } as CSSProperties
              }
              className={cn(
                'h-(--ds-control-height-md) w-full justify-center gap-2',
                'hover:border-transparent hover:bg-(--oauth-hover-bg)',
                'dark:hover:border-transparent dark:hover:bg-(--oauth-hover-bg)',
                // 没有品牌色的渠道（OIDC / 自定义 OAuth）回退站点主色，
                // 前景用 primary-foreground 而不是白色 —— 主色可能是浅色。
                brandColor
                  ? [
                      'hover:text-white dark:hover:text-white',
                      'hover:[&_svg]:text-white dark:hover:[&_svg]:text-white',
                      forceWhiteIcon &&
                        'hover:[&_svg_path]:fill-white dark:hover:[&_svg_path]:fill-white',
                    ]
                  : [
                      'hover:text-primary-foreground dark:hover:text-primary-foreground',
                      'hover:[&_svg]:text-primary-foreground dark:hover:[&_svg]:text-primary-foreground',
                    ]
              )}
            >
              {icon}
              {label}
            </Button>
          )
        )}
      </div>
    </div>
  )
}
