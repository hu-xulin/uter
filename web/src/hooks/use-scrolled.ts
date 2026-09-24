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
*/
import { useEffect, useState } from 'react'

/**
 * Tracks whether the page (or an inner scroll container) has been scrolled
 * past a small threshold. Used to switch top navigation bars between a
 * transparent state (at the top) and a solid, blurred background state.
 *
 * The document-level capture listener catches scroll events from nested
 * scroll containers (e.g. the admin shell, where the window itself does not
 * scroll), while the window listener covers normal document scrolling.
 */
export function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    let frame = 0

    const evaluate = () => {
      const y = window.scrollY || document.documentElement.scrollTop || 0
      setScrolled(y > threshold)
    }

    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        evaluate()
      })
    }

    const onScrollCapture = (event: Event) => {
      const target = event.target as HTMLElement | null
      if (target && target.scrollTop > threshold) {
        if (frame) window.cancelAnimationFrame(frame)
        frame = 0
        setScrolled(true)
        return
      }
      schedule()
    }

    evaluate()
    window.addEventListener('scroll', schedule, { passive: true })
    document.addEventListener('scroll', onScrollCapture, true)
    window.addEventListener('resize', schedule)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      document.removeEventListener('scroll', onScrollCapture, true)
      window.removeEventListener('resize', schedule)
    }
  }, [threshold])

  return scrolled
}
