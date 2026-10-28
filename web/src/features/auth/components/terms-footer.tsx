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

import { cn } from '@/lib/utils'

import type { SystemStatus } from '../types'

interface TermsFooterProps {
  variant?: 'sign-in' | 'sign-up'
  className?: string
  status?: SystemStatus | null
}

/**
 * Consent footnote under the sign-in / sign-up card.
 *
 * The two document names are router links, not bare anchors. Both targets are
 * in-app routes (`/user-agreement`, `/privacy-policy`) that are already part of
 * this bundle, so a bare `<a href>` only bought a full document reload — the
 * SPA booting again from scratch — to reach a page the router could render in
 * place. The labels go through `t()` so the document names match the language
 * of the document they open, as they do in the site footer.
 *
 * The lead-in and the sentence's full stop are keys too. The stop is a key
 * rather than a literal `.` because Chinese and Japanese end the sentence with
 * `。`, and a literal ASCII stop after CJK text is a visible blemish. The
 * locale files already carry punctuation as keys (`，`, `、`), so this follows
 * the established convention.
 */
export function TermsFooter({
  variant = 'sign-in',
  className,
  status,
}: TermsFooterProps) {
  const { t } = useTranslation()
  const text = t(
    variant === 'sign-in'
      ? 'By clicking sign in, you agree to our'
      : 'By creating an account, you agree to our'
  )

  const hasUserAgreement = Boolean(status?.user_agreement_enabled)
  const hasPrivacyPolicy = Boolean(status?.privacy_policy_enabled)

  if (!hasUserAgreement && !hasPrivacyPolicy) {
    return null
  }

  return (
    <p className={cn('text-muted-foreground text-center text-base', className)}>
      {text}{' '}
      {hasUserAgreement && (
        <Link to='/user-agreement' className='hover:text-primary'>
          {t('User Agreement')}
        </Link>
      )}
      {hasUserAgreement && hasPrivacyPolicy && <> {t('and')} </>}
      {hasPrivacyPolicy && (
        <Link to='/privacy-policy' className='hover:text-primary'>
          {t('Privacy Policy')}
        </Link>
      )}
      {t('.')}
    </p>
  )
}
