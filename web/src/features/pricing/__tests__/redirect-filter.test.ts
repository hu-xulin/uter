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

import { excludeRedirectedUpstreams } from '../lib/model-helpers'

describe('excludeRedirectedUpstreams', () => {
  test('keeps the whole catalog when nothing is flagged', () => {
    const models: Array<{ model_name: string; hidden_by_redirect?: boolean }> = [
      { model_name: 'gpt-4o' },
      { model_name: 'gpt-4o-dr' },
    ]
    expect(excludeRedirectedUpstreams(models)).toEqual(models)
  })

  test('drops only upstream names that a batch redirect replaced', () => {
    const models = [
      { model_name: 'MiniMax-H3', hidden_by_redirect: true },
      { model_name: 'MiniMax-H3-dr' },
      { model_name: 'claude-fable-5', hidden_by_redirect: true },
      { model_name: 'claude-fable-5-dr' },
      { model_name: 'unrelated-model' },
    ]
    expect(
      excludeRedirectedUpstreams(models).map((model) => model.model_name)
    ).toEqual(['MiniMax-H3-dr', 'claude-fable-5-dr', 'unrelated-model'])
  })

  test('does not mutate the payload shared with billing consumers', () => {
    const models = [{ model_name: 'gpt-4o', hidden_by_redirect: true }]
    expect(excludeRedirectedUpstreams(models)).toHaveLength(0)
    expect(models).toHaveLength(1)
  })
})
