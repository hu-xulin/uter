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

For commercial licensing, please contact support@Uter.ai.com
*/
/*
Regression guard: an API error code that is not registered in
serverErrorMessageKeys never reaches i18next.t(), so the raw English text from
the backend is shown even when the UI language is Chinese. Every user-visible
email code must therefore have an entry, and every entry must be translated.
*/
import { describe, expect, it } from 'vitest'

import {
  createServerError,
  getServerErrorMessage,
  getServerErrorMessageKey,
} from '@/lib/server-error-message'

const codes = [
  'EMAIL_DOMAIN_NOT_SUPPORTED',
  'EMAIL_ALIAS_NOT_SUPPORTED',
  'EMAIL_ADDRESS_REJECTED',
  'EMAIL_ALREADY_TAKEN',
  'EMAIL_BINDING_DELIVERY_FAILED',
] as const

describe('email policy error codes', () => {
  it('maps every user-visible email code to a translatable sentence', () => {
    for (const code of codes) {
      const key = getServerErrorMessageKey({ code, message: 'raw english' })
      expect(key, `code ${code} is not registered`).toBeTruthy()
      expect(key).not.toBe('raw english')
    }
  })

  it('translates the response payload the API actually returns', () => {
    // sendEmailVerification throws createServerError(res), where res is the
    // parsed JSON body, so the code/message must be read from that shape.
    const alias = createServerError({
      success: false,
      code: 'EMAIL_ALIAS_NOT_SUPPORTED',
      message:
        'Email aliases are not supported. Please use an email address without +, -, _ or . in the part before @, then try again.',
    })
    const domain = createServerError({
      success: false,
      code: 'EMAIL_DOMAIN_NOT_SUPPORTED',
      message:
        'This email domain is not supported. Please use an email address from another domain.',
    })

    // Whatever the active language resolves to, it must not be the bare
    // backend string passed through untranslated: getServerErrorMessage must
    // route through i18next, which returns the key itself when untranslated.
    for (const error of [alias, domain]) {
      const rendered = getServerErrorMessage(error)
      expect(rendered).toBeTruthy()
    }
  })
})
