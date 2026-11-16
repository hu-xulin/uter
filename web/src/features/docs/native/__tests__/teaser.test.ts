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

import { firstSentence } from '../teaser'

describe('firstSentence', () => {
  it('stops at the first CJK full stop', () => {
    expect(
      firstSentence('游乐场用于在线测试模型。 用户可以输入问题并查看结果。')
    ).toBe('游乐场用于在线测试模型。')
  })

  it('stops at the first Latin sentence end', () => {
    expect(
      firstSentence(
        'The playground is used for simple online testing. Users can input questions.'
      )
    ).toBe('The playground is used for simple online testing.')
  })

  it('keeps periods that do not end a sentence', () => {
    expect(firstSentence('Visit Uter.ai or v1.0 docs before you start.')).toBe(
      'Visit Uter.ai or v1.0 docs before you start.'
    )
  })

  it('returns the whole text when no sentence terminator exists', () => {
    expect(firstSentence('  No terminator here  ')).toBe('No terminator here')
  })

  it('caps a single overlong opening sentence', () => {
    const teaser = firstSentence(`${'a'.repeat(200)}.`)
    expect(teaser).toHaveLength(141)
    expect(teaser.endsWith('…')).toBe(true)
  })
})
