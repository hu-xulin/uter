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
import type { CSSProperties } from 'react'

export type UserAvatarStyle = Pick<CSSProperties, 'backgroundColor' | 'color'>

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

/** HSL → sRGB（0–255）。只用于算对比度，不参与渲染。 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sn = s / 100
  const ln = l / 100
  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const hp = h / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let rgb: [number, number, number]
  if (hp < 1) rgb = [c, x, 0]
  else if (hp < 2) rgb = [x, c, 0]
  else if (hp < 3) rgb = [0, c, x]
  else if (hp < 4) rgb = [0, x, c]
  else if (hp < 5) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  const m = ln - c / 2
  return rgb.map((v) => (v + m) * 255) as [number, number, number]
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** 白字（#fff）落在该底色上的对比度。 */
function whiteContrast(rgb: [number, number, number]): number {
  return 1.05 / (relativeLuminance(rgb) + 0.05)
}

/**
 * 用户名 → 头像底色（白字）。
 *
 * 底色由名字哈希出的色相决定，但**亮度必须收敛到白字能达标**：
 * 原实现固定 `hsl(h 54–61% 52–59%)` + 白字，浅色相（黄/绿）上实测只有
 * **2.06:1**（规范 §1.1.2 要求普通文本 ≥ 4.5:1，12px 首字母属普通文本）。
 * 这里按 1% 逐档压暗，直到白字 ≥ 4.5:1 —— 只动亮度、不动色相与饱和度，
 * 同一个名字仍然稳定映射到同一个颜色，只是整体比原来深一档。
 */
const MIN_WHITE_CONTRAST = 4.5
const MIN_AVATAR_LIGHTNESS = 20

export function getUserAvatarStyle(name: string): UserAvatarStyle {
  const hash = hashString(name)
  const hue = hash % 360
  const saturation = 54 + (hash % 8)
  let lightness = 52 + ((hash >> 4) % 8)

  while (
    lightness > MIN_AVATAR_LIGHTNESS &&
    whiteContrast(hslToRgb(hue, saturation, lightness)) < MIN_WHITE_CONTRAST
  ) {
    lightness -= 1
  }

  return {
    backgroundColor: `hsl(${hue} ${saturation}% ${lightness}%)`,
    color: 'white',
  }
}

export function getUserAvatarFallback(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}
