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
import {
  Zap,
  Shield,
  Globe,
  Code,
  Gauge,
  DollarSign,
  Users,
  HeartHandshake,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { Heading, Text } from '@/design-system'

interface FeaturesProps {
  className?: string
}

export function Features(_props: FeaturesProps) {
  const { t } = useTranslation()

  const features = [
    {
      id: 'fast',
      num: '01',
      title: t('Lightning Fast'),
      desc: t(
        'Optimized network architecture ensures millisecond response times'
      ),
      span: 'md:col-span-2',
      icon: <Zap className='text-primary size-4' />,
      visual: (
        <div className='mt-4 grid grid-cols-3 gap-2'>
          {['OpenAI', 'Claude', 'Gemini', 'DeepSeek', 'Qwen', 'Llama'].map(
            (name) => (
              <div
                key={name}
                className='border-border/30 bg-muted/20 text-muted-foreground hover:border-primary-border hover:bg-primary-subtle ds-motion-marketing-fast flex items-center justify-center rounded-lg border px-3 py-2 text-sm transition-colors'
              >
                {name}
              </div>
            )
          )}
        </div>
      ),
    },
    {
      id: 'secure',
      num: '02',
      title: t('Secure & Reliable'),
      desc: t(
        'Enterprise-grade security with comprehensive permission management'
      ),
      span: 'md:col-span-1',
      icon: <Shield className='text-success size-4' />,
      visual: (
        <div className='mt-4 flex items-center justify-center'>
          <div className='relative'>
            <div className='border-success/20 bg-success-soft flex size-16 items-center justify-center rounded-2xl border'>
              {/* 强调型功能入口：24px（规范 §2.2 的强调档），与下方四宫格
                  入口保持同一档，不要因为容器大就放到 32px。 */}
              <Shield className='text-success size-6' />
            </div>
            <div className='bg-success absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full'>
              <svg
                className='text-on-emphasis size-2.5'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={2}
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='m4.5 12.75 6 6 9-13.5'
                />
              </svg>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'global',
      num: '03',
      title: t('Global Coverage'),
      desc: t('Multi-region deployment for stable global access'),
      span: 'md:col-span-1',
      icon: <Globe className='text-primary size-4' />,
      visual: (
        <div className='mt-4 space-y-2'>
          {[t('Load Balancing'), t('Rate Limiting'), t('Cost Tracking')].map(
            (step, i) => (
              <div key={step} className='flex items-center gap-2'>
                <div
                  className={`flex size-6 items-center justify-center rounded-full text-sm font-semibold ${
                    i === 1
                      ? 'border-primary-border bg-primary-subtle text-primary-subtle-foreground'
                      : 'border-border/40 bg-muted text-muted-foreground border'
                  }`}
                >
                  {i + 1}
                </div>
                <div className='bg-border/40 h-px flex-1' />
                <span className='text-muted-foreground text-sm'>{step}</span>
              </div>
            )
          )}
        </div>
      ),
    },
    {
      id: 'developer',
      num: '04',
      title: t('Developer Friendly'),
      desc: t('Compatible API routes for common AI application workflows'),
      span: 'md:col-span-2',
      icon: <Code className='text-primary size-4' />,
      visual: (
        <div className='mt-4 flex items-center gap-3'>
          <div className='flex -space-x-2'>
            {['API', 'SDK', 'CLI', 'Docs'].map((n) => (
              <div
                key={n}
                // 规范 §1.4：容器描边恒 1px。这里是**镂空环**——用页面背景色
                // 画 2px 描边，把叠在一起的圆形头像「挖」出间隙，不是容器的
                // 边框。镂空环的宽度必须够 2px，1px 会被相邻圆形的填充吃掉。
                className='border-background from-muted to-muted/60 text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full border-2 bg-gradient-to-br text-sm font-normal'
              >
                {n}
              </div>
            ))}
          </div>
          <div className='text-muted-foreground flex items-center gap-1.5 text-sm'>
            <Code className='text-primary size-4' />
            {t('Multi-protocol Compatible')}
          </div>
        </div>
      ),
    },
  ]

  const additionalFeatures = [
    {
      icon: <Gauge className='size-6' />,
      title: t('High Performance'),
      desc: t('Support for high concurrency with automatic load balancing'),
    },
    {
      icon: <DollarSign className='size-6' />,
      title: t('Transparent Billing'),
      desc: t('Pay-as-you-go with real-time usage monitoring'),
    },
    {
      icon: <Users className='size-6' />,
      title: t('Team Collaboration'),
      desc: t('Multi-user management with flexible permission allocation'),
    },
    {
      icon: <HeartHandshake className='size-6' />,
      title: t('Open Source'),
      desc: t('Community driven, self-hosted, and extensible'),
    },
  ]

  return (
    <section className='relative z-10 px-6 py-24 md:py-32'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-16 max-w-lg'>
          <Text
            as='p'
            variant='label'
            color='secondary'
            className='mb-3 uppercase'
          >
            {t('Core Features')}
          </Text>
          <Heading variant='section-title'>
            {t('Built for developers,')}
            <br />
            {t('designed for scale')}
          </Heading>
        </AnimateInView>

        {/* Bento grid */}
        <div className='border-border/40 bg-border/40 grid gap-px overflow-hidden rounded-xl border md:grid-cols-3'>
          {features.map((f, i) => (
            <AnimateInView
              key={f.id}
              delay={i * 100}
              animation='scale-in'
              className={`bg-background group hover:bg-muted/20 ds-motion-marketing-fast p-7 transition-colors md:p-8 ${f.span}`}
            >
              <div className='mb-3 flex items-center gap-3'>
                <span className='border-border/40 bg-muted text-muted-foreground flex size-7 items-center justify-center rounded-md border text-sm font-semibold tabular-nums'>
                  {f.num}
                </span>
                <Heading variant='card-title' level={3}>
                  {f.title}
                </Heading>
              </div>
              <Text as='p' variant='body' className='text-muted-foreground'>
                {f.desc}
              </Text>
              {f.visual}
            </AnimateInView>
          ))}
        </div>

        {/* Additional features row */}
        <div className='mt-12 grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-12'>
          {additionalFeatures.map((f, i) => (
            <AnimateInView
              key={f.title}
              delay={i * 100}
              animation='fade-up'
              className='flex flex-col items-center text-center'
            >
              <div className='text-muted-foreground border-border/50 bg-muted/30 group-hover:text-foreground mb-3 flex size-12 items-center justify-center rounded-xl border transition-colors'>
                {f.icon}
              </div>
              <Heading variant='card-title' level={3} className='mb-1.5'>
                {f.title}
              </Heading>
              <Text
                as='p'
                variant='body'
                className='text-muted-foreground max-w-[200px]'
              >
                {f.desc}
              </Text>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
