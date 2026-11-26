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

import {
  buildDraftCredentialUpdateFields,
  CHANNEL_FORM_DEFAULT_VALUES,
} from '../channel-form'

describe('buildDraftCredentialUpdateFields', () => {
  test('single 模式只提交 mode，不携带轮询策略', () => {
    expect(
      buildDraftCredentialUpdateFields({
        ...CHANNEL_FORM_DEFAULT_VALUES,
        multi_key_mode: 'single',
      })
    ).toEqual({ mode: 'single', multi_key_mode: undefined })
  })

  test('batch 模式不携带轮询策略', () => {
    expect(
      buildDraftCredentialUpdateFields({
        ...CHANNEL_FORM_DEFAULT_VALUES,
        multi_key_mode: 'batch',
      })
    ).toEqual({ mode: 'batch', multi_key_mode: undefined })
  })

  test('multi_to_single 模式提交用户选择的轮询策略', () => {
    expect(
      buildDraftCredentialUpdateFields({
        ...CHANNEL_FORM_DEFAULT_VALUES,
        multi_key_mode: 'multi_to_single',
        multi_key_type: 'polling',
      })
    ).toEqual({ mode: 'multi_to_single', multi_key_mode: 'polling' })
  })
})
