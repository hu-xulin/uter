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

/**
 * 回归：所有表格首列（DataTable / StaticDataTable / DocsTable）都必须
 * 走中文构词断点，避免只在某一类表格修好、其余页面仍拆词。
 */
const SRC = join(process.cwd(), 'src')
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8')

describe('共享表格首列接入中文构词断点', () => {
  it('DataTableRow 首列文本经构词断点处理', () => {
    const src = read('components/data-table/core/data-table-row.tsx')
    expect(src).toMatch(/withCjkTermBreaks|CjkTermText/)
    expect(src).toMatch(/index === 0|cellIndex === 0|isFirstColumn/)
  })

  it('StaticDataTableRow 首列文本经构词断点处理', () => {
    const src = read('components/data-table/static/static-data-table.tsx')
    expect(src).toMatch(/withCjkTermBreaks|CjkTermText/)
    expect(src).toMatch(/index === 0|columnIndex === 0|isFirstColumn/)
  })

  it('DocsTable（MDX/法务表格）首列经 CjkTermText 处理', () => {
    const src = read('features/docs/native/docs-table.tsx')
    expect(src).toMatch(/CjkTermText|withCjkTermBreaks/)
  })
})
