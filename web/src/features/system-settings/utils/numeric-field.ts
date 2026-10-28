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
import {
  useController,
  useWatch,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from 'react-hook-form'
import { z } from 'zod'

import { toNumberInputValue } from '@/lib/number-input'

export function positiveIntegerSchema(message: string) {
  return z.number().int(message).positive(message)
}

/**
 * Props produced by {@link safeNumberFieldProps} for a native
 * `<input type="number">`. They are intentionally narrow so consumers can
 * spread them onto our shared `Input` component without leaking the
 * react-hook-form internals (e.g. `disabled`) that need overriding per call.
 */
export type SafeNumberFieldProps = {
  value: number | ''
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onBlur: () => void
  name: string
  ref: (instance: HTMLInputElement | null) => void
}

/**
 * Adapter for binding a react-hook-form numeric field to a native
 * `<input type="number">` without ever putting `NaN` into form state.
 *
 * Why this exists:
 * - `<input type="number">` reports `valueAsNumber === NaN` whenever the field
 *   is empty or holds an in-progress non-numeric token (e.g. just a minus
 *   sign or a trailing dot). Forwarding `NaN` to `field.onChange` makes Zod
 *   numeric validators (`z.number().min(...)`, `z.coerce.number()`, etc.)
 *   fail at submit time, so `form.handleSubmit` silently refuses to call
 *   `onSubmit` — the save button appears frozen with no toast and no error.
 * - Numeric inputs should snap back to the previous valid number instead of
 *   keeping `NaN`. We preserve that behaviour by ignoring `NaN`
 *   updates: React's controlled-input reconciliation will restore the last
 *   valid value to the DOM on the next render.
 *
 * Display:
 * - When the underlying state is not a finite number, the prop returns `''`
 *   so the input visibly renders empty instead of literal "NaN".
 *
 * Usage:
 * ```tsx
 * <FormField
 *   control={form.control}
 *   name='performance_setting.monitor_cpu_threshold'
 *   render={({ field }) => (
 *     <Input type='number' min={0} {...safeNumberFieldProps(field)} />
 *   )}
 * />
 * ```
 */
export function safeNumberFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>(field: ControllerRenderProps<TFieldValues, TName>): SafeNumberFieldProps {
  const raw = field.value as unknown
  const display: number | '' =
    typeof raw === 'number' && Number.isFinite(raw) ? raw : ''

  return {
    value: display,
    onChange: (event) => {
      const next = event.target.valueAsNumber
      if (Number.isFinite(next)) {
        ;(field.onChange as (value: number) => void)(next)
      }
    },
    onBlur: field.onBlur,
    name: field.name,
    ref: field.ref,
  }
}

/**
 * Adapter for binding a react-hook-form **optional** numeric field
 * (`z.number().optional()`) to a native `<input type="number">`.
 *
 * Difference from {@link safeNumberFieldProps}:
 * - {@link safeNumberFieldProps} targets required numeric schemas
 *   (`z.number().int().positive()`). There, a blank field is not a legal value,
 *   so it snaps back to the last valid number.
 * - This adapter targets optional schemas, where blank **is** a legal value the
 *   user must be able to express. It therefore preserves the blank state
 *   instead of dropping the update.
 *
 * Because `<input type="number">` normalises every illegal intermediate
 * keystroke (`-`, `.`, `1e`) to the empty string, a plain
 * `Number(event.target.value)` would turn a blank field into `0` — making the
 * field impossible to clear and swallowing minus signs. See
 * {@link toNumberInputValue}.
 *
 * Form state stays `number | undefined`, so the submitted payload shape is
 * unchanged: a cleared field is indistinguishable from never having touched it,
 * which is exactly what "optional" should mean.
 *
 * Why `useWatch` instead of `field.value`: `useController` resolves the field
 * value against `defaultValues`, so an explicit `undefined` is replaced by the
 * default and the input can never actually look blank. `useWatch` returns the
 * raw stored value, letting `undefined` render as an empty field.
 *
 * Must be called unconditionally (it is a hook), so call it at the top of the
 * component rather than inside a `FormField` render callback.
 *
 * Usage:
 * ```tsx
 * const priorityField = useOptionalNumberField(form, 'priority')
 *
 * <FormField control={form.control} name='priority' render={() => (
 *   <FormItem>
 *     <FormControl>
 *       <Input type='number' placeholder='0' {...priorityField} />
 *     </FormControl>
 *     <FormMessage />
 *   </FormItem>
 * )} />
 * ```
 */
export function useOptionalNumberField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>(form: UseFormReturn<TFieldValues>, name: TName): SafeNumberFieldProps {
  const { field } = useController({ control: form.control, name })
  const watched = useWatch({ control: form.control, name })

  const display: number | '' =
    typeof watched === 'number' && Number.isFinite(watched) ? watched : ''

  return {
    value: display,
    onChange: (event) => {
      const next = toNumberInputValue(event.target.value)
      ;(field.onChange as (value: number | undefined) => void)(
        next === '' ? undefined : next
      )
    },
    onBlur: field.onBlur,
    name: field.name,
    ref: field.ref,
  }
}
