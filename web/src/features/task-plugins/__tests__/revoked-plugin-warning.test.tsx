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
import { render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, describe, expect, test } from 'vitest'

import { RevokedPluginWarning } from '../components/revoked-plugin-warning'

describe('RevokedPluginWarning', () => {
  afterEach(async () => {
    await i18next.changeLanguage('en')
  })

  test('renders nothing without a takedown entry', () => {
    const { container } = render(<RevokedPluginWarning />)
    expect(container).toBeEmptyDOMElement()
  })

  test('announces the takedown and its plain-text reason', () => {
    render(
      <RevokedPluginWarning
        entry={{
          sha256: 'a'.repeat(64),
          reason: 'Sends data to a third party',
        }}
      />
    )
    const warning = screen.getByRole('alert')
    expect(warning).toHaveTextContent(
      'This version was taken down from the marketplace.'
    )
    expect(warning).toHaveTextContent('Sends data to a third party')
  })

  test('renders the reason in the current interface language', async () => {
    await i18next.changeLanguage('zh')
    render(
      <RevokedPluginWarning
        entry={{
          sha256: 'a'.repeat(64),
          reason: { en: 'Backdoor code', zh: '存在后门代码' },
        }}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('存在后门代码')
  })

  test('omits the reason clause when the entry carries none', () => {
    render(<RevokedPluginWarning entry={{ sha256: 'a'.repeat(64) }} />)
    const warning = screen.getByRole('alert')
    expect(warning).toHaveTextContent(
      'This version was taken down from the marketplace.'
    )
    expect(warning).not.toHaveTextContent('Reason')
  })
})
