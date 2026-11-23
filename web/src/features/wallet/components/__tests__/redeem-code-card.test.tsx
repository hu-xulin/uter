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
import { describe, expect, test, vi } from 'vitest'

import { RedeemCodeCard } from '../redeem-code-card'

function renderCard(
  props: {
    code?: string
    enabled?: boolean
    topupLink?: string
  } = {}
) {
  const onCodeChange = vi.fn()
  const onRedeem = vi.fn()
  render(
    <RedeemCodeCard
      code={props.code ?? 'ABC-123'}
      onCodeChange={onCodeChange}
      onRedeem={onRedeem}
      redeeming={false}
      enabled={props.enabled ?? true}
      topupLink={props.topupLink ?? 'https://example.test/codes'}
    />
  )
  return { onCodeChange, onRedeem }
}

describe('RedeemCodeCard', () => {
  test('clicking Redeem submits the current code', async () => {
    const { onRedeem } = renderCard()
    await userEvent.click(screen.getByRole('button', { name: 'Redeem' }))
    expect(onRedeem).toHaveBeenCalledOnce()
  })

  test('pressing Enter submits the current code', async () => {
    const { onRedeem } = renderCard()
    await userEvent.type(screen.getByLabelText('Have a Code?'), '{Enter}')
    expect(onRedeem).toHaveBeenCalledOnce()
  })

  test('keeps the purchase link discoverable', () => {
    renderCard()
    expect(screen.getByRole('link', { name: 'Get one here' })).toHaveAttribute(
      'href',
      'https://example.test/codes'
    )
  })

  test('disabled redemption explains that the feature is unavailable', () => {
    renderCard({ enabled: false })
    expect(screen.queryByLabelText('Have a Code?')).not.toBeInTheDocument()
    expect(
      screen.getByText(
        'Redemption codes are disabled until the administrator confirms compliance terms.'
      )
    ).toBeVisible()
  })
})
