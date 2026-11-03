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
import { Link } from '@tanstack/react-router'
import { ArrowRight, BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { fullPageAnchorProps } from '@/components/layout/lib/url-utils'
import { Button } from '@/components/ui/button'
import { Heading, Text } from '@/design-system'
import { useStatus } from '@/hooks/use-status'
import { isBundledDocsHref, resolveDocsHref } from '@/lib/docs-link'

import { HeroTerminalDemo } from '../hero-terminal-demo'
import { SUPPORTED_APPS } from '../supported-apps'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

/** 「支持的客户端」胶囊的共用样式，三个入口必须完全一致。 */
const APP_PILL_CLASS =
  'group border-border/40 bg-muted/15 text-muted-foreground hover:border-border hover:bg-muted/30 hover:text-foreground flex items-center gap-3 rounded-full border px-5 py-2.5 text-sm font-medium backdrop-blur-xs ds-motion-marketing-fast transition-all hover:scale-[1.02]'

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  // Admins may point this at an external knowledge base. When unset,
  // `resolveDocsHref` returns `/docs` — the SPA's locale-free entry —
  // and the SPA's `/docs` route frames the bundled docs export inside
  // the app shell, picking the locale-matching landing (`/docs/zh/` for
  // Chinese locales, `/docs/en/` for everything else) from the user's
  // current UI language.
  const docsUrl = resolveDocsHref(status?.docs_link)

  const renderDocsButton = () => {
    // The bundled entry is an SPA route, so the button is a router link
    // and the docs open without leaving the app. A configured target is
    // not ours to route: a plain anchor triggers a full document load,
    // and `fullPageAnchorProps` forces a new tab for cross-origin URLs.
    const rendered = isBundledDocsHref(docsUrl) ? (
      <Link to={docsUrl} />
    ) : (
      <a href={docsUrl} {...fullPageAnchorProps(docsUrl)} />
    )
    return (
      <Button
        variant='outline'
        className='group border-border/50 hover:border-border hover:bg-muted/50 inline-flex items-center gap-1.5 px-5'
        render={rendered}
      >
        <BookOpen className='text-muted-foreground group-hover:text-foreground ds-motion-marketing-fast size-4.5 transition-colors' />
        <span>{t('Docs')}</span>
      </Button>
    )
  }

  return (
    <section className='relative z-10 overflow-hidden px-6 pt-24 pb-16 md:pt-32 md:pb-24 lg:pt-36 lg:pb-28'>
      {/* Radial gradient background：三团光晕收在 `ds-decor-mesh-hero`
          （颜色 `--ds-decor-glow-*`、透明度 `--ds-decor-mesh-opacity-*`，
          形状在 foundations/decoration.css，规范 §11.5）。以前这里内联
          写裸 oklch，透明度还散装在 `opacity-25 dark:opacity-[0.12]` ——
          深浅两档的取舍从此不可见。 */}
      <div
        aria-hidden
        className='ds-decor-mesh-hero pointer-events-none absolute inset-0 -z-10'
      />
      {/* Grid pattern：1px 线 + 4rem 方格 + 椭圆渐隐遮罩，同一套
          `ds-decor-grid`（§11.5）。 */}
      <div aria-hidden className='ds-decor-grid absolute inset-0 -z-10' />

      <div className='mx-auto grid max-w-6xl grid-cols-1 items-start gap-12 lg:grid-cols-12 lg:gap-8'>
        {/* Left Column: Title, description, action buttons and application support */}
        <div className='flex flex-col items-start text-left lg:col-span-6'>
          {/* Top Pill Badge */}
          <div
            className='landing-animate-fade-up border-primary-border bg-primary-subtle text-sidebar-active-foreground mb-5 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium opacity-0'
            style={{ animationDelay: '0ms' }}
          >
            <span className='relative flex size-1.5'>
              <span className='bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75' />
              <span className='bg-primary relative inline-flex size-1.5 rounded-full' />
            </span>
            <span>{t('AI Application Infrastructure Foundation')}</span>
          </div>

          {/* 主标题会折成 3–4 行，用多行 display 行高（1.5）而不是
              单行的 40px，否则行与行会挤在一起。行高值见
              `--ds-line-display-multiline`（规范 §1.2）。 */}
          <Heading
            variant='display'
            level={1}
            multiline
            className='landing-animate-fade-up text-4xl md:text-5xl'
            style={{ animationDelay: '60ms' }}
          >
            {(() => {
              const heading = t('Unified API Gateway for')
              // Split on the Chinese full-width comma (，) and rebuild the
              // line break layout. We keep the empty trailing chunk (if
              // any) so an original closing comma in the source string
              // survives the rewrite, but only render <br />s between
              // chunks that actually contain text — so the gap between
              // every line is governed by a single <br /> and the same
              // `leading` value, instead of stacking two.
              const raw = heading.split('，').map((c) => c.trim())
              const hasTrailingComma = raw.at(-1) === ''
              const textChunks = hasTrailingComma ? raw.slice(0, -1) : raw
              if (textChunks.length >= 2) {
                return (
                  <>
                    {textChunks.map((chunk, i) => (
                      <span key={chunk}>
                        {chunk}
                        {i < textChunks.length - 1 || hasTrailingComma
                          ? '，'
                          : ''}
                        {i < textChunks.length - 1 ? <br /> : null}
                      </span>
                    ))}
                    {/* Trailing break so the gradient line (below) sits on
                        its own line, with the same single-<br /> gap as the
                        lines above. */}
                    <br />
                  </>
                )
              }
              return (
                <>
                  {heading}
                  <br />
                </>
              )
            })()}
            {/* 首屏品牌渐变：走 `@utility ds-text-gradient-brand`，三个停靠站
                收在 `--ds-color-brand-gradient-*`（规范 §11.5）。以前这里直接
                写 `from-blue-400 via-violet-400 to-purple-500`，那既绕过了
                Token、也让「与上游渲染一致」这句话无法被验证；现在是单一
                出口，改渐变只改 Token 一处。 */}
            <span className='ds-text-gradient-brand'>
              {t('Vast Range of AI Models')}
            </span>
          </Heading>
          {/* 副标题：首屏唯一的说明性长句，走长文本档 `body-long`（16/26）。
              不能用 `body`(14px) —— 它会和下方「常用应用支持」那两行 14px
              小字塌成同一档，层级直接消失。
              行高交回档位自带（26px），不再用 `` 覆盖成 32px：
              32px 是当年 14px 字号下「1.5 倍读着发闷」的权宜值，字号升到
              16px 后 1.625 倍本身就不闷了，再留 2 倍反而散。
              颜色保持 `muted-foreground`（二级正文色）：红字只要求字号，
              而且它比下方那两行三级小字深一档，正好撑起层级。 */}
          <Text
            as='p'
            variant='body-long'
            className='landing-animate-fade-up text-muted-foreground mt-8 max-w-xl opacity-0'
            style={{ animationDelay: '120ms' }}
          >
            {t(
              'Access a vast selection of models via a standard, unified API protocol. Power AI applications, manage digital assets, and connect the Future.'
            )}
          </Text>

          <div
            className='landing-animate-fade-up mt-10 flex flex-wrap items-center gap-3 opacity-0'
            style={{ animationDelay: '180ms' }}
          >
            {props.isAuthenticated ? (
              <>
                <Button
                  className='group px-5'
                  render={<Link to='/dashboard' />}
                >
                  {t('Go to Dashboard')}
                  <ArrowRight className='ds-motion-marketing-fast ml-1.5 size-4.5 transition-transform group-hover:translate-x-0.5' />
                </Button>
                {renderDocsButton()}
              </>
            ) : (
              <>
                <Button className='group px-5' render={<Link to='/sign-up' />}>
                  {t('Get Started')}
                  <ArrowRight className='ds-motion-marketing-fast ml-1.5 size-4.5 transition-transform group-hover:translate-x-0.5' />
                </Button>
                <Button
                  variant='outline'
                  className='border-border/50 hover:border-border hover:bg-muted/50 px-5'
                  render={<Link to='/pricing' />}
                >
                  {t('View Pricing')}
                </Button>
                {renderDocsButton()}
              </>
            )}
          </div>

          {/* Supported Apps (参考图二样式，进行卡片化和信息扩充设计，增加视觉高度) */}
          <div
            className='landing-animate-fade-up mt-10 w-full max-w-xl opacity-0'
            style={{ animationDelay: '240ms' }}
          >
            {/* 两行都是**次级文本**，统一走三级文字色 `tertiary-foreground`
                （比 `muted-foreground` 再浅一档，且是 colors.md 4.5:1 下限
                之前最浅的一档）。不要改回 `muted-foreground` —— 那会和上方
                副标题同色，小字抢正文的注意力。 */}
            <div className='mb-4 flex flex-col gap-1'>
              <span className='text-tertiary-foreground text-sm font-medium uppercase'>
                {t('Supported Applications')}
              </span>
              <p className='text-tertiary-foreground text-sm'>
                {t(
                  'Supports one-click configuration and perfectly adapts to Uter multi-protocol configuration.'
                )}
              </p>
            </div>
            <div className='flex flex-wrap items-center gap-3'>
              {/* 三个都是真实可点的外链，指向各产品的官方站点：
                  WorkBuddy AI 是桌面端工作台，DeepSeek Harness 与 Codex
                  是官方 CLI 客户端，都可以把 Uter 的 OpenAI 兼容配置
                  直接填进去用。 */}
              {SUPPORTED_APPS.map((app) => (
                <a
                  key={app.name}
                  href={app.href}
                  target='_blank'
                  rel='noopener noreferrer'
                  className={APP_PILL_CLASS}
                >
                  {app.icon}
                  <span>{app.name}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Hero Terminal API Demo */}
        <div
          className='landing-animate-fade-up flex w-full justify-center opacity-0 lg:col-span-6'
          style={{ animationDelay: '320ms' }}
        >
          <HeroTerminalDemo className='mt-8 lg:mt-0' />
        </div>
      </div>
    </section>
  )
}
