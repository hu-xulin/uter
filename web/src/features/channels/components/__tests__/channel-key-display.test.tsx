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
import { describe, expect, it, vi } from 'vitest'

import { ChannelKeyDisplay } from '../channel-key-display'

describe('ChannelKeyDisplay', () => {
  it('shows the masked placeholder with no saved key and no reveal affordance', () => {
    render(
      <ChannelKeyDisplay
        maskedValue={null}
        fullValue={null}
        onReveal={vi.fn()}
      />
    )

    expect(screen.getByPlaceholderText('No saved key')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows the backend masked value by default without revealing plaintext', () => {
    const onReveal = vi.fn()
    render(
      <ChannelKeyDisplay
        maskedValue='sk-a************wxyz'
        fullValue={null}
        onReveal={onReveal}
      />
    )

    expect(screen.getByText('sk-a************wxyz')).toBeInTheDocument()
    expect(onReveal).not.toHaveBeenCalled()
    expect(
      screen.queryByText('sk-abcdefghijklmnopqrstuvwxyz')
    ).not.toBeInTheDocument()
  })

  it('renders one masked display per line for a multi-key channel', () => {
    render(
      <ChannelKeyDisplay
        maskedValue={'sk-a***1111\nsk-b***2222\nsk-c***3333'}
        fullValue={null}
        onReveal={vi.fn()}
      />
    )

    expect(screen.getByText('sk-a***1111')).toBeInTheDocument()
    expect(screen.getByText('sk-b***2222')).toBeInTheDocument()
    expect(screen.getByText('sk-c***3333')).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: 'Copy API key' })
    ).toHaveLength(3)
  })

  it('triggers verification when a masked row is clicked before plaintext exists', async () => {
    const onReveal = vi.fn()
    const user = userEvent.setup()
    render(
      <ChannelKeyDisplay
        maskedValue='sk-a***1111'
        fullValue={null}
        onReveal={onReveal}
      />
    )

    await user.click(screen.getByText('sk-a***1111'))

    expect(onReveal).toHaveBeenCalledTimes(1)
  })

  it('shows the revealed full value once verification returns plaintext', async () => {
    const user = userEvent.setup()
    render(
      <ChannelKeyDisplay
        maskedValue='sk-a***1111'
        fullValue='sk-aaaa1111'
        onReveal={vi.fn()}
      />
    )

    await user.click(screen.getByText('sk-a***1111'))

    expect(await screen.findByDisplayValue('sk-aaaa1111')).toBeInTheDocument()
  })

  it('triggers verification when copy is pressed without a revealed value', async () => {
    const onReveal = vi.fn()
    const user = userEvent.setup()
    render(
      <ChannelKeyDisplay
        maskedValue='sk-a***1111'
        fullValue={null}
        onReveal={onReveal}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Copy API key' }))

    expect(onReveal).toHaveBeenCalledTimes(1)
  })

  it('keeps duplicated keys as separate rows', () => {
    render(
      <ChannelKeyDisplay
        maskedValue={'sk-a***1111\nsk-a***1111'}
        fullValue={null}
        onReveal={vi.fn()}
      />
    )

    expect(screen.getAllByText('sk-a***1111')).toHaveLength(2)
    expect(
      screen.getAllByRole('button', { name: 'Copy API key' })
    ).toHaveLength(2)
  })
})
