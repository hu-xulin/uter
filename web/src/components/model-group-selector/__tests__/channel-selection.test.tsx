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
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import { ModelGroupSelector } from '../../model-group-selector'

const channels = [
  { label: '优特渠道', value: '优特渠道' },
  { label: '聚合渠道', value: '聚合渠道' },
]
const models = [
  { label: 'gpt-4o', value: 'gpt-4o' },
  { label: 'claude-opus-4-5', value: 'claude-opus-4-5' },
]

it('lists channels instead of groups and reports the clicked channel', async () => {
  const user = userEvent.setup()
  const onChannelChange = vi.fn()

  render(
    <ModelGroupSelector
      selectedModel='gpt-4o'
      models={models}
      onModelChange={vi.fn()}
      selectedChannel='优特渠道'
      channels={channels}
      onChannelChange={onChannelChange}
    />
  )

  await user.click(screen.getByRole('combobox', { name: 'Model' }))

  expect(screen.getByText('Channels')).toBeVisible()
  expect(screen.queryByText('Model Group')).toBeNull()
  expect(screen.getByRole('button', { name: /优特渠道/ })).toBeVisible()

  await user.click(screen.getByRole('button', { name: /聚合渠道/ }))

  expect(onChannelChange).toHaveBeenCalledWith('聚合渠道')
})
