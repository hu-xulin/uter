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
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

import type { SelectedPricingReadiness } from '../lib/pricing-readiness'

export interface PricingReadinessSummaryProps {
  readiness: SelectedPricingReadiness
  /** Set when an inline pre-submit check stopped the save. */
  blocked?: boolean
}

/**
 * Inline billing readiness for the models this channel actually serves.
 *
 * `blocking` mirrors the server's publish guard: those models prevent a
 * publish right now. `missing` is informational — the server only inspects
 * existing rows — but those models cannot bill a request either.
 */
export function PricingReadinessSummary({
  readiness,
  blocked = false,
}: PricingReadinessSummaryProps) {
  const { t } = useTranslation()

  if (readiness.selected === 0) return null

  const countParams = {
    configured: readiness.configured,
    selected: readiness.selected,
  }
  // Only keep the blocker title while a model really would be rejected: after
  // the operator sets the missing price the summary must return to its normal
  // state without requiring another submit attempt.
  const hasBlockingRows = readiness.blocking.length > 0
  const showBlockedTitle = blocked && hasBlockingRows

  if (!hasBlockingRows && readiness.pending.length === 0) {
    return (
      <Alert variant='success' className='border-success-soft'>
        <AlertTitle>{t('Billing readiness')}</AlertTitle>
        <AlertDescription className='text-xs'>
          {t(
            '{{configured}} of {{selected}} selected models have a billable sale price',
            countParams
          )}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert variant='warning' className='border-warning/40'>
      <AlertTitle>
        {showBlockedTitle
          ? t('Publish blocked by pricing')
          : t('Billing readiness')}
      </AlertTitle>
      <AlertDescription className='flex flex-col gap-1 text-xs'>
        <span>
          {t(
            '{{configured}} of {{selected}} selected models are ready to bill',
            countParams
          )}
        </span>
        {readiness.blocking.length > 0 && (
          <span>
            {t('Needs a sale price before publishing: {{models}}', {
              models: readiness.blocking.join(', '),
            })}
          </span>
        )}
        {readiness.missing.length > 0 && (
          <span>
            {t('No pricing row yet: {{models}}', {
              models: readiness.missing.join(', '),
            })}
          </span>
        )}
      </AlertDescription>
    </Alert>
  )
}
