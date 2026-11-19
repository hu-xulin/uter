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
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { DEFAULT_CONFIG, DEFAULT_PARAMETER_ENABLED } from '../../../constants'
import { PlaygroundParameterPanel } from '../playground-parameter-panel'

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

describe('PlaygroundParameterPanel trigger', () => {
  beforeAll(() => {
    i18next.addResourceBundle('en', 'translation', {
      Parameters: 'Parameters',
      'Parameter settings': 'Parameter settings',
      'Only enabled parameters are sent with the request.':
        'Only enabled parameters are sent with the request.',
    })
  })

  it('does not show a count badge even when several parameters are enabled', () => {
    render(
      <PlaygroundParameterPanel
        config={DEFAULT_CONFIG}
        onConfigChange={() => {}}
        onParameterEnabledChange={() => {}}
        parameterEnabled={DEFAULT_PARAMETER_ENABLED}
      />
    )

    const trigger = screen.getByRole('button', { name: 'Parameters' })
    expect(trigger).not.toHaveTextContent('4')
    expect(trigger.querySelector('span')).toBeNull()
  })
})