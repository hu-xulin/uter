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

const SRC = join(process.cwd(), 'src')

// 钱包页的内容宽度由 PersonalPageLayout 约束；组织页须与该宽度对齐。
const WALLET_LAYOUT = join(
  SRC,
  'features/profile/components/personal-page-layout.tsx'
)
const ORG_INDEX = join(SRC, 'features/organization/index.tsx')

// 宽度契约：mx-auto 居中 + w-full 撑满可用区 + max-w-7xl 限制最大宽度。
const WIDTH_CLASSES = ['mx-auto', 'w-full', 'max-w-7xl']

describe('organization page content width matches wallet', () => {
  const wallet = readFileSync(WALLET_LAYOUT, 'utf8')
  const org = readFileSync(ORG_INDEX, 'utf8')

  it('wallet layout is the width source of truth (max-w-7xl)', () => {
    for (const cls of WIDTH_CLASSES) expect(wallet).toContain(cls)
  })

  it('organization main content container uses the same width classes', () => {
    // 锚定 'Organization Management' 标题之后的主内容容器，避开
    // loading / 创建组织卡 / 无组织卡等其他 SectionPageLayout.Content 分支。
    const match = org.match(
      /Organization Management'\)[\s\S]*?<SectionPageLayout\.Content>[\s\S]*?<div className='([^']*)'>/m
    )
    if (!match) throw new Error('main content container not found')
    const classes = match[1].split(/\s+/)
    for (const cls of WIDTH_CLASSES) expect(classes).toContain(cls)
  })
})
