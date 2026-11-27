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
const MONITOR_PAGE = join(SRC, 'features/upstream-monitor/index.tsx')
const SECTION_LAYOUT = join(
  SRC,
  'components/layout/components/section-page-layout.tsx'
)

describe('monitor page scroll container', () => {
  const page = readFileSync(MONITOR_PAGE, 'utf8')
  const layout = readFileSync(SECTION_LAYOUT, 'utf8')

  it('fixedContent clips its content, so the page must own a scroll container', () => {
    expect(page).toContain('fixedContent')
    // The fixedContent branch intentionally uses overflow-hidden; without a
    // scrollable child the billing card + task table overflow and cannot be
    // reached, which is exactly the reported "cannot scroll" bug.
    expect(layout).toMatch(/fixedContent[\s\S]*overflow-hidden/)
  })

  it('wraps monitor content in a full-height scrollable container', () => {
    const match = page.match(/<SectionPageLayout\.Content>\s*<div className='([^']*)'>/)
    if (!match) throw new Error('monitor content container not found')
    const classes = match[1].split(/\s+/)
    for (const cls of ['h-full', 'min-h-0', 'overflow-y-auto']) {
      expect(classes).toContain(cls)
    }
  })
})
