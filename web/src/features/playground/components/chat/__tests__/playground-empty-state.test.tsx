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
import { beforeAll, describe, expect, it } from 'vitest'

import { PlaygroundEmptyState } from '../playground-empty-state'

describe('PlaygroundEmptyState 起始提示图标', () => {
  beforeAll(() => {
    i18next.addResourceBundle('en', 'translation', {
      'Start a playground chat': 'Start a playground chat',
      'Test a model with a starter prompt, or write your own request below.':
        'Test a model with a starter prompt.',
      'Analyze data': 'Analyze data',
      'Summarize text': 'Summarize text',
      Code: 'Code',
      'Get advice': 'Get advice',
    })
  })

  it('四个起始提示的图标都是 18px（§2.2 按钮内图标档）', () => {
    render(<PlaygroundEmptyState onSelectPrompt={() => {}} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(4)

    for (const button of buttons) {
      const icon = button.querySelector('svg')

      expect(icon).not.toBeNull()
      // 显式 `size-4`（16px）会盖掉 Button 的
      // `[&_svg:not([class*='size-'])]:size-4.5` 兜底，所以这里锁死 18px。
      expect(icon).toHaveClass('size-4.5')
      expect(icon).not.toHaveClass('size-4')
    }
  })
})
