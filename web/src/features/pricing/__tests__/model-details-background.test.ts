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
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SOURCE = join(
  process.cwd(),
  'src/features/pricing/components/model-details.tsx'
)

describe('pricing model details info grid', () => {
  const source = readFileSync(SOURCE, 'utf8')

  it('fills the odd trailing cell with the same card background', () => {
    expect(source).toContain('function CatalogInfoGrid')
    expect(source).toContain('props.cells.length % 2 === 1')
    expect(source).toContain("<div aria-hidden='true' className='bg-card' />")
    expect(source).toContain(
      "className='bg-card flex min-w-0 flex-col gap-1 px-3 py-2.5'"
    )
  })

  it('uses the shared grid on every model details surface', () => {
    expect(source).toContain('<CatalogInfoGrid cells={cells} />')
    // 完整详情页与详情抽屉共用 ModelDetailsContent，避免只修其中一处。
    expect(
      source.match(/<ModelDetailsContent/g)?.length ?? 0
    ).toBeGreaterThanOrEqual(2)
  })
})
