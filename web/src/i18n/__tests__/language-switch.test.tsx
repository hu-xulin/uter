import { act, render, screen, waitFor } from '@testing-library/react'
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
import i18next from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'
import { beforeAll, expect, it } from 'vitest'

import { i18nInitOptions } from '../config'
import { applyBundle } from '../runtime-locale'

const TAGLINE_KEY = 'Powerful API Management Platform'
const TAGLINE_EN = 'Intelligent Model Service Platform'
const TAGLINE_ZH = '智能大模型服务平台'

/**
 * `src/test-setup.ts` initializes the global i18next singleton with an empty
 * resource set before this file's `beforeAll` runs, so the suite has to
 * re-initialize it with the production options — that is the point: the
 * assertions below must exercise the real `bindI18n` wiring, otherwise they
 * would pass against any config.
 *
 * `lng` + an empty detection order keep the starting language deterministic
 * instead of whatever the jsdom `navigator` happens to report.
 */
beforeAll(async () => {
  await i18next.use(initReactI18next).init({
    ...i18nInitOptions,
    lng: 'en',
    debug: false,
    detection: { ...i18nInitOptions.detection, order: [] },
  })
})

function LanguageProbe() {
  const { t } = useTranslation()
  return <p data-testid='probe'>{t(TAGLINE_KEY)}</p>
}

/**
 * Switch languages the way the UI does — config.ts listens on
 * `languageChanged` and merges that locale's code-split bundle from the very
 * event — and wait for the strings to actually land.
 *
 * The wait is the regression's whole point: `languageChanged` fires *before*
 * the bundle merge, so a component that only re-renders on that event shows
 * the English fallback and never recovers. With `bindI18n` including
 * `loaded`, the follow-up emit re-reads `t()` and the correct strings appear.
 *
 * The wait runs outside `act()` on purpose: @testing-library's `waitFor`
 * clears `IS_REACT_ACT_ENVIRONMENT` for its duration, and nesting it inside
 * an `act()` call makes React complain about the environment.
 */
async function switchLanguage(code: string) {
  await act(async () => {
    await i18next.changeLanguage(code)
  })
  await waitFor(() => {
    expect(i18next.t(TAGLINE_KEY)).toBe(TAGLINE_ZH)
  })
  // Drain the re-render the `loaded` emit scheduled so the next assertion
  // sees settled DOM instead of racing it.
  await act(async () => {})
}

it('re-renders mounted components with the new locale after a language switch', async () => {
  render(<LanguageProbe />)
  expect(screen.getByText(TAGLINE_EN)).toBeInTheDocument()

  await switchLanguage('zhCN')

  expect(screen.getByText(TAGLINE_ZH)).toBeInTheDocument()
})

it('re-renders mounted components when a runtime locale is merged without a language change', async () => {
  await switchLanguage('zhCN')
  render(<LanguageProbe />)
  expect(screen.getByText(TAGLINE_ZH)).toBeInTheDocument()

  // The runtime hot-reload path (UTER_I18N_DIR): fetchLocale merges the
  // corrected translation and then emits `loaded` — no languageChanged is
  // involved, so a bindI18n that omits `loaded` leaves every mounted
  // component on the stale string.
  const corrected = `${TAGLINE_ZH}（已修正）`
  await act(async () => {
    if (
      applyBundle('zhCN', {
        translation: { [TAGLINE_KEY]: corrected },
      })
    ) {
      i18next.emit('loaded', 'zhCN')
    }
  })

  expect(screen.getByText(corrected)).toBeInTheDocument()
})
