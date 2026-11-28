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

const HEADER_SOURCE = join(
  process.cwd(),
  'src/features/pricing/components/model-details.tsx'
)
const CARD_SOURCE = join(
  process.cwd(),
  'src/features/pricing/components/model-card.tsx'
)
const HEADING_SOURCE = join(
  process.cwd(),
  'src/design-system/components/typography/heading.tsx'
)

describe('定价页等宽标题层级', () => {
  const header = readFileSync(HEADER_SOURCE, 'utf8')
  const card = readFileSync(CARD_SOURCE, 'utf8')

  it('详情页模型名用 mono-page-title（20px 页面级），不用无衬线档', () => {
    expect(header).toContain("<Heading variant='mono-page-title' level={1}>")
    expect(header).not.toContain("variant='page-title'")
    expect(header).not.toContain("variant='section-title'")
    // 等宽由变体自带，不再手写 className 补偿。
    expect(header).not.toContain(
      "variant='mono-page-title' level={1} className='font-mono'"
    )
  })

  it('详情标题保留 h1 语义层级', () => {
    const titleTag = header.match(
      /<Heading variant='mono-page-title'[^>]*>[\s\S]*?{\s*model\.model_name\s*}/
    )
    expect(titleTag).not.toBeNull()
    expect(titleTag?.[0]).toContain('level={1}')
  })

  it('卡片模型名用 mono-section-title（16px 区块级），不用旧 mono-title', () => {
    expect(card).toContain("variant='mono-section-title'")
    expect(card).not.toContain("variant='mono-title'")
  })
})

describe('Heading 变体注释与 UDS 8.0 阶梯一致', () => {
  const heading = readFileSync(HEADING_SOURCE, 'utf8')

  it('page-title 注释为 36/600/44，不再是 v1.2 的 30/600/38', () => {
    expect(heading).toContain('`page-title`    36/600/44')
    expect(heading).not.toContain('`page-title`    30/600/38')
  })

  it('section-title 注释为 30/600/38，不再是 v1.2 的 24/600/32', () => {
    expect(heading).toContain('`section-title` 30/600/38')
    expect(heading).not.toContain('`section-title` 24/600/32')
  })

  it('等宽标题族同时声明 mono-page-title 20px 与 mono-section-title 16px', () => {
    expect(heading).toContain("| 'mono-page-title'")
    expect(heading).toContain("| 'mono-section-title'")
    expect(heading).not.toContain("| 'mono-title'")
  })
})
