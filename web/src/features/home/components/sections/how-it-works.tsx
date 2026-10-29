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
import { Settings, Zap, BarChart3 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { Heading, Text } from '@/design-system'

export function HowItWorks() {
  const { t } = useTranslation()

  const steps = [
    {
      num: '1',
      title: t('Configure'),
      desc: t(
        'Add your API keys, set up channels and configure access permissions'
      ),
      // 三步上手的图标属于「强调型功能入口」：24px（规范 §2.2 强调档），
      // 与「核心功能」四宫格入口同档。64px 容器里放 32px 会盖过标题层级。
      icon: <Settings className='size-6' />,
    },
    {
      num: '2',
      title: t('Connect'),
      desc: t(
        'Connect through OpenAI, Claude, Gemini, and other compatible API routes'
      ),
      icon: <Zap className='size-6' />,
    },
    {
      num: '3',
      title: t('Monitor'),
      desc: t('Track usage, costs and performance with real-time analytics'),
      icon: <BarChart3 className='size-6' />,
    },
  ]

  return (
    <section className='border-border/40 relative z-10 border-t px-6 py-24 md:py-32'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-16 text-center md:mb-20'>
          <Text
            as='p'
            variant='label'
            color='secondary'
            className='mb-3 uppercase'
          >
            {t('How It Works')}
          </Text>
          <Heading variant='section-title'>
            {t('Three steps to get started')}
          </Heading>
        </AnimateInView>

        <div className='grid gap-8 md:grid-cols-3 md:gap-12'>
          {steps.map((step, i) => (
            <AnimateInView
              key={step.num}
              delay={i * 150}
              animation='fade-up'
              className='relative flex flex-col items-center text-center'
            >
              <div className='relative mb-6'>
                <div className='text-muted-foreground border-border/50 bg-muted/30 flex size-16 items-center justify-center rounded-2xl border transition-colors'>
                  {step.icon}
                </div>
                <div className='bg-foreground text-background absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full text-sm font-semibold'>
                  {step.num}
                </div>
              </div>
              <Heading variant='card-title' level={3} className='mb-2'>
                {step.title}
              </Heading>
              {/* 卡片正文统一 16/400/24（规范：卡片正文 16px）。
                  这里曾用 body-sm（14px），与「核心功能」区块的 16px
                  不一致，同一页面里两种卡片正文。 */}
              <Text
                as='p'
                variant='body'
                className='text-muted-foreground max-w-[260px]'
              >
                {step.desc}
              </Text>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
