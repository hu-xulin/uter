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
import { useState } from 'react'
import { describe, expect, test } from 'vitest'

import {
  handleNumberInput,
  type NumberInputValue,
} from '@/lib/number-input'

/**
 * Mirrors the local `useState` numeric inputs (transfer dialog amount, channel
 * affinity max entries / TTL, notification thresholds): the state is submitted
 * straight from the component, and blank is resolved at the payload boundary.
 */
function NumericSetting(props: {
  label: string
  initial: NumberInputValue
  /** How a blank field is resolved before it is sent to the backend. */
  resolveBlank: (value: NumberInputValue) => number
}) {
  const [value, setValue] = useState<NumberInputValue>(props.initial)
  const submitted = props.resolveBlank(value)

  return (
    <div>
      <input
        type='number'
        aria-label={props.label}
        value={value}
        onChange={handleNumberInput(setValue)}
      />
      <output aria-label={`${props.label}-payload`}>{submitted}</output>
    </div>
  )
}

describe('local useState numeric settings', () => {
  // Defect A
  test('clearing the field keeps it blank instead of forcing 0', async () => {
    const user = userEvent.setup()
    render(
      <NumericSetting
        label='amount'
        initial={42}
        resolveBlank={(v) => (v === '' ? 25 : v)}
      />
    )
    const input = screen.getByLabelText<HTMLInputElement>('amount')

    await user.clear(input)

    expect(input.value).toBe('')
    expect(input).toHaveValue(null)
  })

  // Defect B
  test('a negative amount can be typed into an emptied field', async () => {
    const user = userEvent.setup()
    render(
      <NumericSetting
        label='amount'
        initial={10}
        resolveBlank={(v) => (v === '' ? 25 : v)}
      />
    )
    const input = screen.getByLabelText<HTMLInputElement>('amount')

    await user.clear(input)
    await user.type(input, '-5')

    expect(input).toHaveValue(-5)
    expect(screen.getByLabelText('amount-payload')).toHaveTextContent('-5')
  })

  test('a blank field resolves to the fallback payload, never a silent 0', async () => {
    const user = userEvent.setup()
    render(
      <NumericSetting
        label='maxEntries'
        initial={100}
        resolveBlank={(v) => (v === '' ? 100 : v)}
      />
    )
    const input = screen.getByLabelText<HTMLInputElement>('maxEntries')
    const payload = screen.getByLabelText('maxEntries-payload')

    expect(payload).toHaveTextContent('100')
    await user.clear(input)

    expect(input.value).toBe('')
    // Blank falls back to the server default instead of persisting '' or 0.
    expect(payload).toHaveTextContent('100')
  })

  test('negative values are not rejected by a min={0} attribute', async () => {
    const user = userEvent.setup()
    render(
      <NumericSetting
        label='ttl'
        initial={0}
        resolveBlank={(v) => (v === '' ? 300 : v)}
      />
    )
    const input = screen.getByLabelText<HTMLInputElement>('ttl')

    await user.clear(input)
    await user.type(input, '-7')

    expect(input).toHaveValue(-7)
    expect(screen.getByLabelText('ttl-payload')).toHaveTextContent('-7')
  })
})
