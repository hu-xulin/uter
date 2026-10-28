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
 * `chart-N` 与状态色的分工守卫。
 *
 * `colors.md` 规定：`chart-N` 是**分类色**（只是为了区分彼此），成功 / 警告 /
 * 危险 / 信息必须走 `success` / `warning` / `destructive` / `info`。这条界线
 * 很容易被抹平 —— 分类色和状态色看起来都是「一个彩色」，随手把 `danger`
 * 指向 `chart-5` 也能编译、也能跑，只是红绿色盲用户和深浅主题会一起失效。
 *
 * 扫的是两个色表的**源码**而不是渲染结果：色表本身是纯数据，静态断言比
 * 挂载组件更直接，也能给出文件行号。
 */

const ROOT = join(process.cwd(), 'src')

/** 语义状态键：它们的取值必须来自语义 Token，不得是 chart-N。 */
const STATUS_KEYS = ['success', 'warning', 'danger', 'info', 'destructive']

const COLOR_MAP_FILES = [
  'components/status-badge.tsx',
  'components/ui/icon-badge.tsx',
]

type Violation = { file: string; line: number; text: string }

function collectChartStatusMixups(): Violation[] {
  const violations: Violation[] = []
  for (const file of COLOR_MAP_FILES) {
    const lines = readFileSync(join(ROOT, file), 'utf8').split('\n')
    lines.forEach((line, index) => {
      if (!/\bchart-[1-5]\b/.test(line)) return
      const key = /^\s*'?([A-Za-z-]+)'?:/.exec(line)?.[1]
      if (!key || !STATUS_KEYS.includes(key)) return
      violations.push({ file, line: index + 1, text: line.trim() })
    })
  }
  return violations
}

describe('semantic vs categorical colors', () => {
  it('never expresses a status with a chart-N color', () => {
    const violations = collectChartStatusMixups()
    const summary = violations
      .map((item) => `${item.file}:${item.line}  ${item.text}`)
      .join('\n')
    expect(
      violations,
      `成功/警告/危险/信息必须用 success / warning / destructive / info，\`chart-N\` 只做分类色：\n${summary}`
    ).toEqual([])
  })

  it('keeps the status keys mapped to semantic tokens', () => {
    const source = readFileSync(
      join(ROOT, 'components/status-badge.tsx'),
      'utf8'
    )

    // 圆点与文字两套色表都要指向语义 Token，而不是某个具体调色板档位。
    expect(source).toContain("success: 'bg-success'")
    expect(source).toContain("warning: 'bg-warning'")
    expect(source).toContain("danger: 'bg-destructive'")
    expect(source).toContain("info: 'bg-info'")
    expect(source).toContain("success: 'text-success'")
    expect(source).toContain("danger: 'text-destructive'")
    expect(source).toContain("info: 'text-info'")
  })
})
