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
import { act, renderHook } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { describe, expect, it } from 'vitest'

import { useResetForm, type ResetPauseRef } from '../use-reset-form'

type TestValues = {
  username: string
}

function useTestForm(values: TestValues, pauseRef?: ResetPauseRef) {
  const form = useForm<TestValues>({ defaultValues: values })
  useResetForm(form, values, pauseRef)
  return form
}

describe('useResetForm', () => {
  it('advances snapshots while paused without replaying them over the form', () => {
    const pauseRef: ResetPauseRef = { current: true }
    const { result, rerender } = renderHook(
      ({ values }) => useTestForm(values, pauseRef),
      { initialProps: { values: { username: 'operator' } } }
    )

    act(() => {
      result.current.setValue('username', 'saved-in-form')
    })

    rerender({ values: { username: 'server-step-1' } })
    expect(result.current.getValues('username')).toBe('saved-in-form')

    rerender({ values: { username: 'server-final' } })
    expect(result.current.getValues('username')).toBe('saved-in-form')

    pauseRef.current = false
    // A trailing refetch for the already-seen snapshot must not wipe the
    // form values written by the save handler.
    rerender({ values: { username: 'server-final' } })
    expect(result.current.getValues('username')).toBe('saved-in-form')

    rerender({ values: { username: 'after-release' } })
    expect(result.current.getValues('username')).toBe('after-release')
  })

  it('resets normally when no pause ref is supplied', () => {
    const { result, rerender } = renderHook(
      ({ values }) => useTestForm(values),
      {
        initialProps: { values: { username: 'operator' } },
      }
    )

    act(() => {
      result.current.setValue('username', 'typed')
    })

    rerender({ values: { username: 'server' } })
    expect(result.current.getValues('username')).toBe('server')
  })
})
