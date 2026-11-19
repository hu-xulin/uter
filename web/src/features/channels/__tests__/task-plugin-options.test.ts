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
import { describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { getTaskPluginOptions } from '../api'

describe('getTaskPluginOptions', () => {
  it('normalises a null models list so channel creation cannot crash', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        success: true,
        data: [
          { key: 'no-models', name: 'No models', models: null },
          { key: 'with-models', name: 'With models', models: ['m1'] },
        ],
      },
    })

    const options = await getTaskPluginOptions()

    expect(options[0].models).toEqual([])
    expect(options[1].models).toEqual(['m1'])
  })
})