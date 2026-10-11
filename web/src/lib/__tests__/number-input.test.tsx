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
  toNumberInputValue,
} from '../number-input'

describe('toNumberInputValue', () => {
  // Regression guard for the root cause: `<input type='number'>` normalises
  // every illegal intermediate keystroke to ''. `Number('')` is 0, not NaN,
  // which is what forced blank fields to 0 and swallowed minus signs.
  test('keeps the blank state instead of collapsing it to 0', () => {
    expect(toNumberInputValue('')).toBe('')
    // The buggy behaviour was `Number(e.target.value)`, i.e. 0.
    expect(Number('')).not.toBe('')
  })

  test('parses finite numbers, including negatives and decimals', () => {
    expect(toNumberInputValue('0')).toBe(0)
    expect(toNumberInputValue('42')).toBe(42)
    expect(toNumberInputValue('-5')).toBe(-5)
    expect(toNumberInputValue('-0.5')).toBe(-0.5)
    expect(toNumberInputValue('1e3')).toBe(1000)
  })

  test('never returns NaN for rejected tokens', () => {
    expect(toNumberInputValue('abc')).toBe('')
    expect(toNumberInputValue('Infinity')).toBe('')
    expect(toNumberInputValue('-Infinity')).toBe('')
  })
})

/**
 * Minimal reproduction of the controlled `<input type='number'>` used across
 * the app. `onChange` is the only line under test.
 */
function AmountField(props: {
  initial: NumberInputValue
  onState?: (value: NumberInputValue) => void
}) {
  const [value, setValue] = useState<NumberInputValue>(props.initial)
  return (
    <input
      type='number'
      aria-label='amount'
      value={value}
      onChange={(event) => {
        handleNumberInput((next) => {
          setValue(next)
          props.onState?.(next)
        })(event)
      }}
    />
  )
}

describe('handleNumberInput in a controlled number input', () => {
  // Defect A: clearing the field used to force it back to 0.
  test('clearing a filled field leaves the state empty, not 0', async () => {
    const user = userEvent.setup()
    const states: NumberInputValue[] = []
    render(<AmountField initial={42} onState={(v) => states.push(v)} />)
    const input = screen.getByLabelText<HTMLInputElement>('amount')

    expect(input).toHaveValue(42)
    await user.clear(input)

    expect(states.at(-1)).toBe('')
    expect(states.at(-1)).not.toBe(0)
    expect(input).toHaveValue(null)
    expect(input.value).toBe('')
  })

  // Defect B: typing '-' normalised to '', which became 0, and React wrote
  // value={0} back over the input, eating the minus sign.
  test('accepts a negative number typed into an empty field', async () => {
    const user = userEvent.setup()
    const states: NumberInputValue[] = []
    render(<AmountField initial={0} onState={(v) => states.push(v)} />)
    const input = screen.getByLabelText<HTMLInputElement>('amount')

    await user.clear(input)
    await user.type(input, '-5')

    expect(states.at(-1)).toBe(-5)
    expect(input).toHaveValue(-5)
  })

  test('accepts a negative number typed right after clearing', async () => {
    const user = userEvent.setup()
    const states: NumberInputValue[] = []
    render(<AmountField initial={10} onState={(v) => states.push(v)} />)
    const input = screen.getByLabelText<HTMLInputElement>('amount')

    await user.clear(input)
    await user.type(input, '-12.5')

    expect(states.at(-1)).toBe(-12.5)
    expect(input).toHaveValue(-12.5)
  })

  test('stays blank when the field is cleared and left empty', async () => {
    const user = userEvent.setup()
    const states: NumberInputValue[] = []
    render(<AmountField initial={7} onState={(v) => states.push(v)} />)
    const input = screen.getByLabelText<HTMLInputElement>('amount')

    await user.clear(input)

    expect(input).toHaveValue(null)
    expect(states).toContain('')
    expect(states).not.toContain(0)
  })

  test('typing a positive number still works', async () => {
    const user = userEvent.setup()
    const states: NumberInputValue[] = []
    render(<AmountField initial="" onState={(v) => states.push(v)} />)
    const input = screen.getByLabelText<HTMLInputElement>('amount')

    await user.type(input, '300')

    expect(states.at(-1)).toBe(300)
    expect(input).toHaveValue(300)
  })
})
