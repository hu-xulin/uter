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
import { useEffect, useRef } from 'react'
import type { DefaultValues, FieldValues, UseFormReturn } from 'react-hook-form'

export type ResetPauseRef = { current: boolean }

/**
 * Reset a react-hook-form instance whenever the provided default values change.
 * Guards against naively resetting on every render by tracking the last
 * serialized snapshot of the defaults.
 */
export function useResetForm<TFieldValues extends FieldValues>(
  form: UseFormReturn<TFieldValues>,
  values: DefaultValues<TFieldValues> | undefined,
  pauseRef?: ResetPauseRef
) {
  const lastSerializedDefaults = useRef<string | null>(null)

  useEffect(() => {
    if (!values) return

    const serializedDefaults = JSON.stringify(values)
    if (serializedDefaults === lastSerializedDefaults.current) {
      return
    }

    // While the caller is saving, advance the snapshot but do not reset. This
    // keeps a multi-option save from overwriting its own values with the
    // server's intermediate snapshots as each write invalidates the query.
    if (pauseRef?.current) {
      lastSerializedDefaults.current = serializedDefaults
      return
    }

    form.reset(values)
    lastSerializedDefaults.current = serializedDefaults
  }, [values, form, pauseRef])
}
