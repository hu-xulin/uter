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
 * 回归：Uter 所有表格首列必须走同一套中文构词断行规则。
 *
 * 用户决定（2026-11-26）：首列按中文词语换行（「个人信息」不得拆成
 * 「个人信」+「息」），且首列至少容纳 4 个字。规则集中在全局 CSS，
 * 用 `:first-child` 命中所有表格（DataTable / DocsTable / 原生 table），
 * 避免逐表格改列定义造成遗漏。
 */
const SRC = join(process.cwd(), 'src')
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8')

describe('表格首列中文构词断行规则（全局）', () => {
  const indexCss = read('styles/index.css')

  it('全局规则命中所有 table 的首列 td/th', () => {
    expect(indexCss).toMatch(/table[^{]*:first-child/)
  })

  it('首列把 overflow-wrap 复位为 normal，压过 prose 的 anywhere', () => {
    const rule =
      /table[^{]*first-child[^{]*:has\(\[role='checkbox'\]\)[^{]*\{([^}]*)\}/.exec(
        indexCss
      )
    expect(rule, '缺少表格首列基础规则').toBeTruthy()
    expect(rule?.[1]).toMatch(/overflow-wrap:\s*normal/)
  })

  it('首列最小宽度按 4 个汉字（4em）约束', () => {
    const rule =
      /table[^{]*first-child[^{]*:has\(\[role='checkbox'\]\)[^{]*\{([^}]*)\}/.exec(
        indexCss
      )
    expect(rule?.[1]).toMatch(/min-width:\s*4em/)
  })

  it('原子术语以 data-cjk-nowrap 禁止断行（四字一列同行）', () => {
    expect(indexCss).toMatch(
      /\[data-cjk-nowrap\][^{]*\{[^}]*white-space:\s*nowrap/
    )
  })

  it('仅对注入 <wbr> 的首列启用 keep-all，避免无断点长词撑宽列', () => {
    const rule = /table[^{]*first-child[^{]*:has\(wbr\)[^{]*\{([^}]*)\}/.exec(
      indexCss
    )
    expect(rule, '缺少带 wbr 首列的 keep-all 规则').toBeTruthy()
    expect(rule?.[1]).toMatch(/word-break:\s*keep-all/)
  })
})
