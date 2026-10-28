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
import { describe, expect, test } from 'vitest'

import type { GroupOption, ModelOption } from '../../../types'
import {
  getInputControlState,
  getSubmittableInputText,
} from '../input-control-utils'

const models: ModelOption[] = [{ label: 'gpt-test', value: 'gpt-test' }]
const groups: GroupOption[] = [{ label: 'default', value: 'default', ratio: 1 }]

const baseState = {
  groups,
  hasStopHandler: true,
  models,
  text: 'hello',
}

describe('getSubmittableInputText', () => {
  test('trims the submitted text', () => {
    expect(getSubmittableInputText({ text: '  hello  ' })).toBe('hello')
    expect(getSubmittableInputText({ text: '\n\nhi\n' })).toBe('hi')
  })

  test('rejects empty or whitespace-only input', () => {
    expect(getSubmittableInputText({ text: '' })).toBeNull()
    expect(getSubmittableInputText({ text: '   ' })).toBeNull()
    expect(getSubmittableInputText({ text: null })).toBeNull()
    expect(getSubmittableInputText({})).toBeNull()
  })

  test('rejects input while generation is running', () => {
    expect(getSubmittableInputText({ text: 'hello' }, true)).toBeNull()
  })
})

describe('getInputControlState', () => {
  test('allows submitting only with a model and non-empty text', () => {
    expect(getInputControlState(baseState).canSubmit).toBe(true)
    expect(getInputControlState({ ...baseState, text: '   ' }).canSubmit).toBe(
      false
    )
    expect(getInputControlState({ ...baseState, models: [] }).canSubmit).toBe(
      false
    )
    expect(
      getInputControlState({ ...baseState, disabled: true }).canSubmit
    ).toBe(false)
  })

  test('swaps the send button for stop only while generating', () => {
    expect(
      getInputControlState({ ...baseState, isGenerating: true }).shouldShowStop
    ).toBe(true)
    expect(getInputControlState(baseState).shouldShowStop).toBe(false)
    expect(
      getInputControlState({
        ...baseState,
        isGenerating: true,
        hasStopHandler: false,
      }).shouldShowStop
    ).toBe(false)
  })

  test('disables the selectors while loading or without groups', () => {
    expect(getInputControlState(baseState).isSelectorDisabled).toBe(false)
    expect(
      getInputControlState({ ...baseState, isModelLoading: true })
        .isSelectorDisabled
    ).toBe(true)
    expect(
      getInputControlState({ ...baseState, groups: [] }).isSelectorDisabled
    ).toBe(true)
    expect(
      getInputControlState({ ...baseState, disabled: true }).isSelectorDisabled
    ).toBe(true)
  })
})
