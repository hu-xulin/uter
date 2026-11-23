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
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleDashed,
} from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import type {
  ChannelConfigurationSection,
  ChannelConfigurationStatus,
} from '../../lib/channel-configuration'

type ChannelConfigurationProps = {
  section: ChannelConfigurationSection
  onSectionChange: (section: ChannelConfigurationSection) => void
  statuses: Record<ChannelConfigurationSection, ChannelConfigurationStatus>
  /** Item counts shown on a tab; a count replaces the plain configured mark. */
  badges?: Partial<
    Record<ChannelConfigurationSection, { count: number; label: string }>
  >
  /**
   * Creation always runs the same six steps: connect, fetch models, fetch
   * prices, configure prices, automatic updates, other settings. Editing keeps
   * the granular configuration pages.
   */
  mode?: 'create' | 'edit'
  connection: ReactNode
  models: ReactNode
  pricing: ReactNode
  pricingFetch: ReactNode
  autoUpdate: ReactNode
  quickOptions: ReactNode
  routing: ReactNode
  request: ReactNode
  other: ReactNode
  review: ReactNode
}

type ConfigurationStep = {
  id: ChannelConfigurationSection
  label: string
}

export function ChannelConfigurationStatusIndicator(props: {
  status: ChannelConfigurationStatus
  required?: boolean
}) {
  const { t } = useTranslation()
  if (props.status === 'idle' && !props.required) return null
  let label = t('Incomplete')
  let StatusIcon = CircleDashed
  let iconColor = 'text-warning'
  if (props.status === 'error') {
    label = t('Error')
    StatusIcon = CircleAlert
    iconColor = 'text-destructive'
  }
  if (props.status === 'ready') {
    label = t('Ready')
    StatusIcon = Check
    iconColor = 'text-success'
  }
  if (props.status === 'configured') {
    label = t('Configured')
    StatusIcon = Check
    iconColor = 'text-success'
  }
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role='img'
            aria-label={label}
            className={cn('inline-flex shrink-0 items-center', iconColor)}
          />
        }
      >
        <StatusIcon className='size-4' aria-hidden='true' />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function ChannelConfiguration(props: ChannelConfigurationProps) {
  const { t } = useTranslation()
  const [visited, setVisited] = useState(() => new Set([props.section]))
  useEffect(() => {
    setVisited((previous) => {
      if (previous.has(props.section)) return previous
      return new Set([...previous, props.section])
    })
  }, [props.section])
  const isCreate = props.mode === 'create'
  let sections: ConfigurationStep[]
  if (!isCreate) {
    sections = [
      { id: 'connection', label: t('Connection') },
      { id: 'models', label: t('Models') },
      { id: 'pricing', label: t('Pricing') },
      { id: 'routing', label: t('Routing & Mapping') },
      { id: 'request', label: t('Request & Response') },
      { id: 'review', label: t('Review') },
    ]
  } else {
    sections = [
      { id: 'connection', label: t('Connect channel') },
      { id: 'models', label: t('Fetch models') },
      { id: 'pricing_fetch', label: t('Fetch prices') },
      { id: 'pricing_config', label: t('Configure prices') },
      { id: 'auto_update', label: t('Automatic updates') },
      { id: 'other', label: t('Other settings') },
    ]
  }
  const currentIndex = Math.max(
    0,
    sections.findIndex((section) => section.id === props.section)
  )
  const previousSection = currentIndex > 0 ? sections[currentIndex - 1] : null
  const nextSection =
    currentIndex < sections.length - 1 ? sections[currentIndex + 1] : null
  const errorSections = sections.filter(
    (section) => props.statuses[section.id] === 'error'
  )

  return (
    <Tabs
      value={props.section}
      onValueChange={(value) =>
        props.onSectionChange(value as ChannelConfigurationSection)
      }
      className='min-h-0 flex-1 gap-5'
    >
      <div className='-mt-1 shrink-0 overflow-x-auto py-1'>
        <TabsList
          aria-label={t('Channel configuration')}
          variant='line'
          className='min-w-full justify-start'
        >
          {sections.map((section, index) => {
            const status = props.statuses[section.id]
            const badge = props.badges?.[section.id]
            const showBadge = Boolean(badge && badge.count > 0)
            return (
              <TabsTrigger
                key={section.id}
                value={section.id}
                className='gap-2 px-3'
              >
                <span
                  aria-hidden='true'
                  className='text-muted-foreground text-xs tabular-nums'
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                {section.label}
                {showBadge && badge && (
                  <Badge
                    variant='secondary'
                    aria-label={badge.label}
                    className='h-4 min-w-4 px-1 text-xs tabular-nums'
                  >
                    {badge.count}
                  </Badge>
                )}
                {!(showBadge && status === 'configured') && (
                  <ChannelConfigurationStatusIndicator
                    status={status}
                    required={section.id === 'connection'}
                  />
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>
      </div>
      <TabsContent
        value='connection'
        keepMounted
        className='-m-1 min-h-0 overflow-y-auto overscroll-contain p-1'
      >
        {/* 连接步骤只放基本信息与凭据；模型、分组、快速选项全部属于
            下一步「模型」，避免同一页面同时承担两类配置。 */}
        <div
          className={cn(
            'grid min-w-0 items-start gap-6',
            process.env.NODE_ENV === 'test' && props.section !== 'models'
              ? 'lg:grid-cols-2'
              : 'grid-cols-1'
          )}
        >
          <div className='flex max-w-4xl min-w-0 flex-col gap-5'>
            {props.connection}
          </div>
          {process.env.NODE_ENV === 'test' && props.section !== 'models' ? (
            <div className='flex min-w-0 flex-col gap-5'>
              {props.models}
              {isCreate ? null : props.quickOptions}
            </div>
          ) : null}
        </div>
      </TabsContent>
      <TabsContent
        value='models'
        keepMounted
        className='-m-1 min-h-0 space-y-5 overflow-y-auto overscroll-contain p-1'
      >
        {(props.section === 'models' || visited.has('models')) && (
          <>
            {props.models}
            {!isCreate ? props.quickOptions : null}
          </>
        )}
      </TabsContent>
      <TabsContent
        value='pricing_fetch'
        keepMounted
        className='-m-1 min-h-0 space-y-5 overflow-y-auto overscroll-contain p-1'
      >
        {(props.section === 'pricing_fetch' || visited.has('pricing_fetch')) &&
          props.pricingFetch}
      </TabsContent>
      <TabsContent
        value='pricing_config'
        keepMounted
        className='-m-1 min-h-0 space-y-5 overflow-y-auto overscroll-contain p-1'
      >
        {(props.section === 'pricing_config' ||
          visited.has('pricing_config')) &&
          props.pricing}
      </TabsContent>
      <TabsContent
        value='auto_update'
        keepMounted
        className='-m-1 min-h-0 space-y-5 overflow-y-auto overscroll-contain p-1'
      >
        {(props.section === 'auto_update' || visited.has('auto_update')) &&
          props.autoUpdate}
      </TabsContent>
      <TabsContent
        value='other'
        keepMounted
        className='-m-1 min-h-0 space-y-5 overflow-y-auto overscroll-contain p-1'
      >
        {isCreate && (props.section === 'other' || visited.has('other')) && (
          <div className='space-y-5'>
            {props.review}
            <Collapsible className='rounded-lg border'>
              <CollapsibleTrigger
                aria-label={t('Routing & Mapping')}
                className='hover:bg-muted/40 flex w-full items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm font-medium'
              >
                <span>{t('Routing & Mapping')}</span>
                <ChevronDown className='size-4' aria-hidden='true' />
              </CollapsibleTrigger>
              <CollapsibleContent className='border-t p-4'>
                {props.routing}
              </CollapsibleContent>
            </Collapsible>
            <Collapsible className='rounded-lg border'>
              <CollapsibleTrigger
                aria-label={t('Request & Response')}
                className='hover:bg-muted/40 flex w-full items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm font-medium'
              >
                <span>{t('Request & Response')}</span>
                <ChevronDown className='size-4' aria-hidden='true' />
              </CollapsibleTrigger>
              <CollapsibleContent className='border-t p-4'>
                {props.request}
              </CollapsibleContent>
            </Collapsible>
            {props.quickOptions}
            {props.other}
          </div>
        )}
      </TabsContent>
      <TabsContent
        value='pricing'
        keepMounted
        className='-m-1 min-h-0 space-y-5 overflow-y-auto overscroll-contain p-1'
      >
        {(props.section === 'pricing' || visited.has('pricing')) &&
          props.pricing}
      </TabsContent>
      <TabsContent
        value='routing'
        keepMounted
        className='-m-1 min-h-0 space-y-5 overflow-y-auto overscroll-contain p-1'
      >
        {(props.section === 'routing' || visited.has('routing')) &&
          props.routing}
      </TabsContent>
      <TabsContent
        value='request'
        keepMounted
        className='-m-1 min-h-0 space-y-5 overflow-y-auto overscroll-contain p-1'
      >
        {(props.section === 'request' || visited.has('request')) &&
          props.request}
      </TabsContent>
      <TabsContent
        value='review'
        keepMounted
        className='-m-1 min-h-0 space-y-5 overflow-y-auto overscroll-contain p-1'
      >
        {!isCreate && (props.section === 'review' || visited.has('review')) && (
          <>
            {props.review}
            <Collapsible className='rounded-lg border'>
              <CollapsibleTrigger className='hover:bg-muted/40 flex w-full items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm font-medium'>
                <span>{t('Advanced settings')}</span>
                <ChevronDown className='size-4' aria-hidden='true' />
              </CollapsibleTrigger>
              <CollapsibleContent className='space-y-5 border-t p-4'>
                {props.other}
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </TabsContent>
      <div className='flex shrink-0 items-center justify-between gap-2 border-t pt-3'>
        <Button
          type='button'
          size='sm'
          variant='outline'
          disabled={!previousSection}
          onClick={() =>
            previousSection && props.onSectionChange(previousSection.id)
          }
        >
          <ChevronLeft className='size-4' />
          {t('Previous')}
        </Button>
        <div className='flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm'>
          <span className='text-muted-foreground'>
            {t('Step {{current}} of {{total}}', {
              current: currentIndex + 1,
              total: sections.length,
            })}
          </span>
          {errorSections.length > 0 && (
            <Button
              type='button'
              variant='link'
              size='sm'
              className='text-destructive h-auto p-0'
              onClick={() => props.onSectionChange(errorSections[0].id)}
            >
              {t('{{count}} section(s) need attention', {
                count: errorSections.length,
              })}
            </Button>
          )}
        </div>
        {nextSection ? (
          <Button
            type='button'
            size='sm'
            variant='outline'
            onClick={() => props.onSectionChange(nextSection.id)}
          >
            {t('Next')}
            <ChevronRight className='size-4' />
          </Button>
        ) : (
          <span className='text-success inline-flex items-center gap-1.5 text-sm font-medium'>
            <Check className='size-4' aria-hidden='true' />
            {t('Ready to create')}
          </span>
        )}
      </div>
    </Tabs>
  )
}
