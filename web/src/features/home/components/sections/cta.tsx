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
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { Button } from '@/components/ui/button'
import { Heading, Text } from '@/design-system'

interface CTAProps {
  className?: string
  isAuthenticated?: boolean
}

export function CTA(props: CTAProps) {
  const { t } = useTranslation()

  if (props.isAuthenticated) {
    return null
  }

  return (
    <section className='relative z-10 overflow-hidden px-6 py-24 md:py-32'>
      {/* Gradient mesh background：两团光晕收在 `ds-decor-mesh-cta`
          （弱一档的 `--ds-decor-glow-*-soft`，透明度 `--ds-decor-mesh-opacity-cta`，
          规范 §11.5）。以前这里内联写裸 oklch。 */}
      <div aria-hidden className='ds-decor-mesh-cta absolute inset-0 -z-10' />

      <AnimateInView
        className='mx-auto max-w-2xl text-center'
        animation='scale-in'
      >
        <Heading
          variant='section-title'
          className='flex flex-col items-center gap-3'
        >
          <span>{t('Ready to simplify')}</span>
          {/* 与 hero 主标题共用同一套渐变停靠站：`ds-text-gradient-brand`
              （`--ds-color-brand-gradient-*`，规范 §11.5）。不要为了省钱手写
              `from-… via-… to-…` —— 那会让两个入口的渐变各自漂移。 */}
          <span className='ds-text-gradient-brand'>
            {t('your AI integration?')}
          </span>
        </Heading>
        <Text
          as='p'
          variant='body'
          className='text-muted-foreground mx-auto mt-5 max-w-md'
        >
          {t(
            'Deploy your own gateway and start routing requests through your configured upstream services.'
          )}
        </Text>
        <div className='mt-8 flex items-center justify-center gap-3'>
          <Button className='group' render={<Link to='/sign-up' />}>
            {t('Get Started')}
            <ArrowRight className='ds-motion-marketing-fast ml-1 size-4.5 transition-transform group-hover:translate-x-0.5' />
          </Button>
          <Button
            variant='outline'
            className='border-border/50 hover:border-border hover:bg-muted/50'
            render={<Link to='/pricing' />}
          >
            {t('View Pricing')}
          </Button>
        </div>
      </AnimateInView>
    </section>
  )
}
