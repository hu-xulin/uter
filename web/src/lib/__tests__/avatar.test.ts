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
import { describe, expect, it } from 'vitest'

import { getUserAvatarFallback, getUserAvatarStyle } from '../avatar'

/** 独立实现的对比度计算（不引用被测模块的内部函数，避免自证）。 */
function contrastWithWhite(hsl: string): number {
  const m = /hsl\((\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\)/.exec(
    hsl
  )
  if (!m) throw new Error(`无法解析底色：${hsl}`)
  const [, h, s, l] = m.map(Number)
  const sn = s / 100
  const ln = l / 100
  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const hp = h / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  // HSL → RGB 的六段色相表。写成嵌套三元在 lint 里是 error（no-nested-ternary），
  // 而且六层嵌套读不出「哪一段对应哪个色相」。
  const sector = Math.floor(hp) % 6
  const SECTORS: [number, number, number][] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ]
  const rgb = SECTORS[sector] ?? SECTORS[0]
  const m0 = ln - c / 2
  const [r, g, b] = rgb.map((v) => (v + m0) * 255)
  const channel = (v: number) => {
    const n = v / 255
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4
  }
  const luminance =
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  return 1.05 / (luminance + 0.05)
}

describe('getUserAvatarStyle', () => {
  // 覆盖各色相：黄/绿最容易在白字下翻车（原实现在 "Uter.ai" 上只有 2.06:1）
  const names = [
    'Uter.ai',
    'admin',
    'root',
    'user-42',
    'zzzzzz',
    'OpenAI',
    '张三',
    '李雷',
    'a',
    'team@uter.ai',
  ]

  it('白字在生成底色上至少 4.5:1（规范 §1.1.2 普通文本）', () => {
    for (const name of names) {
      const { backgroundColor } = getUserAvatarStyle(name)
      const ratio = contrastWithWhite(String(backgroundColor))

      expect(
        ratio,
        `${name} → ${backgroundColor} 只有 ${ratio.toFixed(2)}:1`
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('同名恒定映射到同一颜色（哈希结果稳定）', () => {
    expect(getUserAvatarStyle('Uter.ai')).toEqual(getUserAvatarStyle('Uter.ai'))
  })

  it('首字母兜底', () => {
    expect(getUserAvatarFallback('uter')).toBe('U')
    expect(getUserAvatarFallback('   ')).toBe('?')
  })
})
