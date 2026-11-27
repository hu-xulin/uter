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
const REPORT_DETAIL = join(
  SRC,
  'features/upstream-monitor/components/upstream-monitor-report-detail.tsx'
)
// 钱包页是布局真源：页面壳、内容宽度与区块间距都由它定义。
const WALLET_LAYOUT = join(
  SRC,
  'features/profile/components/personal-page-layout.tsx'
)

const WIDTH_CLASSES = ['mx-auto', 'w-full', 'max-w-7xl']
const GAP_CLASSES = ['gap-4', 'sm:gap-5']

describe('monitor report detail layout matches wallet page', () => {
  const wallet = readFileSync(WALLET_LAYOUT, 'utf8')
  const detail = readFileSync(REPORT_DETAIL, 'utf8')

  it('wallet page is the width and gap source of truth', () => {
    for (const cls of [...WIDTH_CLASSES, ...GAP_CLASSES]) {
      expect(wallet).toContain(cls)
    }
  })

  it('uses SectionPageLayout as the page shell', () => {
    expect(detail).toContain('<SectionPageLayout')
    expect(detail).toContain('<SectionPageLayout.Content>')
  })

  it('main content container reuses wallet width and gap classes', () => {
    const match = detail.match(/<div className='([^']*max-w-7xl[^']*)'>/)
    if (!match) throw new Error('main content container not found')
    const classes = match[1].split(/\s+/)
    for (const cls of [...WIDTH_CLASSES, ...GAP_CLASSES]) {
      expect(classes).toContain(cls)
    }
  })

  it('renders every data section inside a TitledCard', () => {
    // 概览、维度得分、探针结果、实测指标、历史记录共五个区块。
    expect(detail.match(/<TitledCard\b/g)?.length ?? 0).toBeGreaterThanOrEqual(
      5
    )
  })

  it('does not keep the loose bare spacing root', () => {
    expect(detail).not.toContain("className='space-y-6'")
  })
})
