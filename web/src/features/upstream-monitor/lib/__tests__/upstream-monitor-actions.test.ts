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
import { describe, expect, it } from 'vitest'

import { formatMonitorScore } from '../upstream-monitor-actions'

describe('formatMonitorScore', () => {
  it('shows a real 0 score for a completed run instead of hiding it', () => {
    expect(formatMonitorScore(0, 1795736430)).toBe('0/100')
  })

  it('shows a dash only when the task has never run', () => {
    expect(formatMonitorScore(0, 0)).toBe('—')
    expect(formatMonitorScore(92, 0)).toBe('—')
  })

  it('shows the score for a normal completed run', () => {
    expect(formatMonitorScore(92, 1795736430)).toBe('92/100')
  })
})
