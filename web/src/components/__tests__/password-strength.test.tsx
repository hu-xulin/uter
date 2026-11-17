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
import { describe, expect, it } from 'vitest'

import { PasswordStrength } from '@/components/password-strength'
import { evaluatePasswordStrength } from '@/lib/password-strength'

describe('evaluatePasswordStrength', () => {
  it('is empty for an empty password', () => {
    const result = evaluatePasswordStrength('')
    expect(result.score).toBe(0)
    expect(result.rules.every((rule) => rule.met === false)).toBe(true)
  })

  it('meets length but not variety for letters only', () => {
    const result = evaluatePasswordStrength('abcdefgh')
    expect(result.rules.map((rule) => [rule.id, rule.met])).toEqual([
      ['length', true],
      ['variety', false],
      ['long', false],
    ])
    expect(result.score).toBe(2)
  })

  it('scores mixed short passwords as good and long mixed passwords as strong', () => {
    expect(evaluatePasswordStrength('Abcdefg1').score).toBe(3)
    expect(evaluatePasswordStrength('Abcdefghijklmn1').score).toBe(4)
  })

  it('does not count a single character class as variety', () => {
    const result = evaluatePasswordStrength('!!!!!!!!')
    expect(result.rules.find((rule) => rule.id === 'variety')?.met).toBe(false)
  })
})

describe('PasswordStrength', () => {
  it('renders nothing before the user types', () => {
    const { container } = render(<PasswordStrength value='' />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the tier, rule states and accessible status text', () => {
    render(<PasswordStrength value='Abcdefghijklmn1' />)
    expect(screen.getByText('Password strength')).toBeVisible()
    expect(screen.getByText('Strong')).toBeVisible()
    expect(screen.getAllByText('Met')).toHaveLength(3)
    expect(screen.getByText('15 or more characters')).toBeVisible()
  })
})
