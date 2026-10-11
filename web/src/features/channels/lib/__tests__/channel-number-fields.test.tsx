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
import { zodResolver } from '@hookform/resolvers/zod'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { describe, expect, test, vi } from 'vitest'
import { z } from 'zod'

import { useOptionalNumberField } from '@/features/system-settings/utils/numeric-field'
import {
  CHANNEL_FORM_DEFAULT_VALUES,
  transformFormDataToCreatePayload,
  transformFormDataToUpdatePayload,
} from '../channel-form'

// Mirrors the real schema for `priority` / `weight` (channel-form.ts).
const schema = z.object({
  priority: z.number().optional(),
  weight: z.number().optional(),
})
type Values = z.infer<typeof schema>

function PriorityFields(props: { onSubmit?: (values: Values) => void }) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 0, weight: 0 },
  })
  const priorityField = useOptionalNumberField(form, 'priority')
  const weightField = useOptionalNumberField(form, 'weight')
  const submit = form.handleSubmit((values) => props.onSubmit?.(values))

  return (
    <form onSubmit={submit}>
      <input type='number' aria-label='priority' {...priorityField} />
      <input type='number' aria-label='weight' {...weightField} />
      <button type='submit'>save</button>
    </form>
  )
}

describe('useOptionalNumberField on the channel routing fields', () => {
  // Defect A on an optional (`z.number().optional()`) field: the old
  // `Number(e.target.value)` turned a cleared field into 0.
  test('clearing priority submits undefined, not 0', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<PriorityFields onSubmit={onSubmit} />)
    const input = screen.getByLabelText<HTMLInputElement>('priority')

    expect(input).toHaveValue(0)
    await user.clear(input)
    expect(input.value).toBe('')

    await user.click(screen.getByRole('button', { name: 'save' }))
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ priority: undefined })
  })

  // Defect B: typing '-' used to be normalised to '' -> 0 -> React wrote 0
  // back, so the minus sign was swallowed and -5 was impossible to enter.
  test('priority accepts a negative value', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<PriorityFields onSubmit={onSubmit} />)
    const input = screen.getByLabelText<HTMLInputElement>('priority')

    await user.clear(input)
    await user.type(input, '-5')

    expect(input).toHaveValue(-5)

    await user.click(screen.getByRole('button', { name: 'save' }))
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ priority: -5 })
  })

  test('weight accepts a negative value', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<PriorityFields onSubmit={onSubmit} />)
    const input = screen.getByLabelText<HTMLInputElement>('weight')

    await user.clear(input)
    await user.type(input, '-3')
    await user.click(screen.getByRole('button', { name: 'save' }))

    expect(input).toHaveValue(-3)
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ weight: -3 })
  })

  test('a negative value still passes zod validation (submit is not blocked)', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<PriorityFields onSubmit={onSubmit} />)
    const input = screen.getByLabelText<HTMLInputElement>('priority')

    await user.clear(input)
    await user.type(input, '-5')
    await user.click(screen.getByRole('button', { name: 'save' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  test('a cleared field stays blank after re-render', async () => {
    const user = userEvent.setup()
    render(<PriorityFields />)
    const input = screen.getByLabelText<HTMLInputElement>('priority')

    await user.clear(input)
    await user.type(input, '9')
    expect(input).toHaveValue(9)

    await user.clear(input)
    expect(input.value).toBe('')
  })
})

describe('payload semantics for a cleared optional channel field', () => {
  const base = CHANNEL_FORM_DEFAULT_VALUES

  test('create payload matches the untouched-field behaviour', () => {
    const cleared = transformFormDataToCreatePayload({
      ...base,
      priority: undefined,
      weight: undefined,
    }).channel
    const untouched = transformFormDataToCreatePayload({
      ...base,
      priority: 0,
      weight: 0,
    }).channel

    // `priority: formData.priority || null` -> cleared and 0 both mean null.
    expect(cleared?.priority).toBe(untouched?.priority)
    expect(cleared?.priority).toBeNull()
    expect(cleared?.weight).toBeNull()
  })

  test('update payload matches the untouched-field behaviour', () => {
    const cleared = transformFormDataToUpdatePayload(
      { ...base, priority: undefined, weight: undefined },
      7
    )
    const untouched = transformFormDataToUpdatePayload(
      { ...base, priority: 0, weight: 0 },
      7
    )

    // `priority: formData.priority ?? 0` -> cleared and 0 both mean 0.
    expect(cleared.priority).toBe(untouched.priority)
    expect(cleared.priority).toBe(0)
    expect(cleared.weight).toBe(0)
  })

  test('an explicit negative value is preserved in both payloads', () => {
    const created = transformFormDataToCreatePayload({
      ...base,
      priority: -5,
    }).channel
    const updated = transformFormDataToUpdatePayload(
      { ...base, priority: -5 },
      7
    )

    expect(created?.priority).toBe(-5)
    expect(updated.priority).toBe(-5)
  })
})
