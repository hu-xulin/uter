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
import { useCallback, useEffect, useRef } from 'react'

/**
 * Declarative-free timeout helper for one-shot, delayed side effects
 * ("reset the copied flag in 2s", "navigate home after the wizard finishes").
 *
 * Every instance keeps at most one pending timer:
 *  - `schedule` replaces any previously scheduled callback, so rapid repeated
 *    triggers cannot stack timers or fire stale callbacks;
 *  - the pending timer is cleared on unmount, so a delayed callback can never
 *    run against a torn-down component.
 */
export function useTimeout() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const schedule = useCallback(
    (callback: () => void, delay = 0) => {
      clear()
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        callback()
      }, delay)
    },
    [clear]
  )

  useEffect(() => clear, [clear])

  return { schedule, clear }
}
