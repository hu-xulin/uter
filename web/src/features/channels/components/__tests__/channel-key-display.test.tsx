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
import { describe, expect, it } from 'vitest'

import { ChannelKeyDisplay } from '../channel-key-display'

describe('ChannelKeyDisplay', () => {
  it('shows only the placeholder before the key is verified', () => {
    render(<ChannelKeyDisplay value={null} />)

    expect(
      screen.getByPlaceholderText('Hidden — verify to reveal')
    ).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('masks a single key by default and keeps the full value out of the DOM', () => {
    render(<ChannelKeyDisplay value='sk-abcdefghijklmnopqrstuvwxyz' />)

    expect(screen.getByText('sk-a************wxyz')).toBeInTheDocument()
    expect(
      screen.queryByText('sk-abcdefghijklmnopqrstuvwxyz')
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0)
  })

  it('renders one masked display per line for a multi-key channel', () => {
    render(
      <ChannelKeyDisplay
        value={'sk-aaaa1111\n\nsk-bbbb2222\n  sk-cccc3333  '}
      />
    )

    expect(screen.getByText('sk-a***1111')).toBeInTheDocument()
    expect(screen.getByText('sk-b***2222')).toBeInTheDocument()
    expect(screen.getByText('sk-c***3333')).toBeInTheDocument()
    // 空行跳过；三行密钥各自带一个复制按钮。
    expect(screen.getAllByLabelText('Copy Key')).toHaveLength(3)
    expect(screen.queryByText('sk-aaaa1111')).not.toBeInTheDocument()
  })

  it('keeps duplicated keys as separate rows', () => {
    render(<ChannelKeyDisplay value={'sk-aaaa1111\nsk-aaaa1111'} />)

    expect(screen.getAllByText('sk-a***1111')).toHaveLength(2)
    expect(screen.getAllByLabelText('Copy Key')).toHaveLength(2)
  })
})
