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
import { Check, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  evaluatePasswordStrength,
  type PasswordStrengthScore,
} from '@/lib/password-strength'
import { cn } from '@/lib/utils'

const SEGMENTS = [1, 2, 3, 4] as const

const METER_LABELS: Record<Exclude<PasswordStrengthScore, 0>, string> = {
  1: 'Weak',
  2: 'Fair',
  3: 'Good',
  4: 'Strong',
}

const METER_TONES: Record<
  Exclude<PasswordStrengthScore, 0>,
  { bar: string; text: string }
> = {
  1: { bar: 'bg-destructive', text: 'text-destructive' },
  2: { bar: 'bg-warning', text: 'text-warning' },
  3: { bar: 'bg-info', text: 'text-info' },
  4: { bar: 'bg-success', text: 'text-success' },
}

/**
 * Strength hints for an account password. The account policy decides whether
 * a password is accepted; this meter only explains how strong it is.
 */
export function PasswordStrength({
  value,
  className,
}: {
  value: string
  className?: string
}) {
  const { t } = useTranslation()
  const { score, rules } = evaluatePasswordStrength(value)
  if (value.length === 0) return null
  const tone = METER_TONES[score as Exclude<PasswordStrengthScore, 0>]

  return (
    <div className={cn('space-y-2', className)} data-slot='password-strength'>
      <div className='flex items-center justify-between gap-3'>
        <span className='text-muted-foreground text-xs'>
          {t('Password strength')}
        </span>
        <span className={cn('text-xs font-medium', tone.text)}>
          {t(METER_LABELS[score as Exclude<PasswordStrengthScore, 0>])}
        </span>
      </div>
      <div className='flex gap-1' aria-hidden='true'>
        {SEGMENTS.map((segment) => (
          <span
            key={segment}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              segment <= score ? tone.bar : 'bg-muted'
            )}
          />
        ))}
      </div>
      <ul className='grid gap-1 sm:grid-cols-2'>
        {rules.map((rule) => (
          <li
            key={rule.id}
            className='text-muted-foreground flex items-start gap-1.5 text-xs'
          >
            <span
              aria-hidden='true'
              className={cn(
                'mt-0.5 grid size-4 shrink-0 place-items-center rounded-sm border',
                rule.met
                  ? 'border-success bg-success text-success-foreground'
                  : 'border-border'
              )}
            >
              {rule.met ? (
                <Check className='size-4' />
              ) : (
                <X className='size-4' />
              )}
            </span>
            <span className={cn(rule.met && 'text-foreground')}>
              {t(rule.label)}
            </span>
            <span className='sr-only'>{t(rule.met ? 'Met' : 'Not met')}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
