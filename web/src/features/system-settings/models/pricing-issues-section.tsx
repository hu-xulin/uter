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
import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { SettingsSection } from '../components/settings-section'
import { PRICING_ISSUE_REASONS, useModelPricingIssues } from './pricing-issues'

const REASON_VARIANTS = {
  unconfigured: 'warning',
  incompatible: 'destructive',
  stale: 'secondary',
} as const

export function PricingIssuesSection() {
  const { t } = useTranslation()
  const issues = useModelPricingIssues()
  const rows = issues.data ?? []

  let body = null
  if (issues.isLoading) {
    body = <p className='text-muted-foreground text-sm'>{t('Loading...')}</p>
  } else if (rows.length === 0) {
    body = (
      <p className='text-muted-foreground text-sm'>
        {t('No pricing issues found.')}
      </p>
    )
  } else {
    body = (
      <ul className='flex flex-col gap-2'>
        {rows.map((issue) => (
          <li
            key={`${issue.model_name}-${issue.plugin_key}-${issue.reason}`}
            className='flex min-w-0 flex-wrap items-center gap-2 rounded-md border p-2.5'
          >
            <span className='min-w-0 truncate font-mono text-sm'>
              {issue.model_name}
            </span>
            <span className='text-muted-foreground text-sm'>
              {issue.plugin_name || issue.plugin_key}
            </span>
            <Badge variant={REASON_VARIANTS[issue.reason]} className='ml-auto'>
              {t(PRICING_ISSUE_REASONS[issue.reason])}
            </Badge>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <SettingsSection title={t('Pricing Issues')}>
      <div className='flex items-start justify-between gap-3'>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Plugin-provided task models an enabled channel serves whose price cannot charge the model, and saved prices whose plugin or model is gone.'
          )}
        </p>
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='h-(--ds-control-height-md) shrink-0'
          onClick={() => void issues.refetch()}
          disabled={issues.isFetching}
        >
          <RefreshCw
            className={issues.isFetching ? 'animate-spin' : undefined}
            aria-hidden='true'
          />
          {t('Refresh')}
        </Button>
      </div>
      {body}
    </SettingsSection>
  )
}
