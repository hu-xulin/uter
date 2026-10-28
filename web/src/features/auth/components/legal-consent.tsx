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
import { useTranslation } from 'react-i18next'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import type { SystemStatus } from '../types'

interface LegalConsentProps {
  status: SystemStatus | null
  checked: boolean
  onCheckedChange: (nextValue: boolean) => void
  className?: string
}

/**
 * Consent checkbox beside the sign-in / sign-up form, with links to the
 * documents being consented to.
 *
 * The links are router links so their destination is the canonical in-app
 * route rather than a hand-written path, but they deliberately keep
 * `target='_blank'`. Everything the reader has typed lives in this form's
 * local state — including a sign-up verification code that may already have
 * been sent — so navigating in place to read a document would discard it.
 * Opening a new tab leaves the half-filled form untouched. `_blank` also means
 * the router does not intercept the click at all, so this stays a real anchor
 * that a middle-click or a "copy link address" behaves normally on.
 *
 * The sentence's full stop comes from `t('.')` rather than a literal `.` so
 * Chinese and Japanese end on `。` instead of an ASCII stop after CJK text.
 */
export function LegalConsent({
  status,
  checked,
  onCheckedChange,
  className,
}: LegalConsentProps) {
  const { t } = useTranslation()
  const hasUserAgreement = Boolean(status?.user_agreement_enabled)
  const hasPrivacyPolicy = Boolean(status?.privacy_policy_enabled)

  if (!hasUserAgreement && !hasPrivacyPolicy) {
    return null
  }

  const handleChange = (value: boolean) => {
    onCheckedChange(value === true)
  }

  return (
    <div
      className={cn(
        'border-border/60 bg-muted/40 flex items-start gap-3 rounded-md border p-3',
        className
      )}
    >
      <Checkbox
        id='legal-consent'
        checked={checked}
        onCheckedChange={handleChange}
        className='mt-0.5'
      />
      <Label
        htmlFor='legal-consent'
        className='text-muted-foreground items-start gap-1 text-left text-base font-normal'
      >
        <span>
          {t('I have read and agree to the')}{' '}
          {hasUserAgreement && (
            <Link
              to='/user-agreement'
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary'
            >
              {t('User Agreement')}
            </Link>
          )}
          {hasUserAgreement && hasPrivacyPolicy && <> {t('and')} </>}
          {hasPrivacyPolicy && (
            <Link
              to='/privacy-policy'
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary'
            >
              {t('Privacy Policy')}
            </Link>
          )}
          {t('.')}
        </span>
      </Label>
    </div>
  )
}
