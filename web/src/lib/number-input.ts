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
import type { ChangeEvent } from 'react'

/**
 * State shape for a controlled `<input type='number'>` that must support both
 * "left blank" and negative values.
 */
export type NumberInputValue = number | ''

/**
 * Converts the raw `event.target.value` of a `<input type='number'>` into
 * {@link NumberInputValue}.
 *
 * Why this exists — `<input type='number'>` normalises every illegal
 * intermediate keystroke to the **empty string**, never to `NaN`:
 *
 * | user types | `event.target.value` | `valueAsNumber` |
 * |------------|-----------------------|-----------------|
 * | `-`        | `''`                  | `NaN`           |
 * | `.`        | `''`                  | `NaN`           |
 * | `1e`       | `''`                  | `NaN`           |
 * | `abc`      | `''`                  | `NaN`           |
 * | *(cleared)*| `''`                  | `NaN`           |
 *
 * `Number('')` is `0`, not `NaN`. So the naive
 * `onChange={(e) => setState(Number(e.target.value))}` breaks in two ways:
 *
 * - **Clearing is impossible.** Clearing the field yields `Number('') === 0`,
 *   so the state snaps back to `0` and the user can never express "blank".
 * - **Negative input is impossible.** Typing `-` is normalised to `''` by the
 *   DOM, which collapses to `0`, and React writes `value={0}` back over the
 *   input, swallowing the minus sign. The user can never enter `-5`.
 *
 * This helper keeps the blank state instead of collapsing it to `0`, so both
 * cases behave the way the user expects.
 *
 * `valueAsNumber` is deliberately not used: it is `NaN` for a legitimate blank
 * field, which is indistinguishable from a rejected keystroke.
 *
 * Note that browsers only emit a change event once the value is a valid
 * floating-point number again, so intermediate states like `-` or `1e` never
 * reach this function in a real browser — the blank state they leave behind is
 * what we must preserve.
 *
 * @param raw - `event.target.value` from the number input.
 * @returns `''` for a blank field, otherwise the parsed finite number.
 */
export function toNumberInputValue(raw: string): NumberInputValue {
  if (raw === '') {
    return ''
  }
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : ''
}

/**
 * `onChange` handler that writes {@link NumberInputValue} into a
 * `<input type='number'>` while keeping the blank state intact.
 *
 * @example
 * ```tsx
 * const [amount, setAmount] = useState<NumberInputValue>('')
 * <Input type='number' value={amount} onChange={handleNumberInput(setAmount)} />
 * ```
 */
export function handleNumberInput(
  setValue: (value: NumberInputValue) => void
): (event: ChangeEvent<HTMLInputElement>) => void {
  return (event) => setValue(toNumberInputValue(event.target.value))
}
