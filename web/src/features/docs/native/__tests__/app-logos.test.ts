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
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { appLogoPath, APP_LOGO_PATHS } from '../app-logos'
import { catalogCards } from '../docs-content'

const publicDir = resolve(process.cwd(), 'public')

/** Every shipped AI-app slug, independent of the mapping under test. */
const APP_SLUGS = [
  ...new Set(
    (['zh', 'en'] as const).flatMap((locale) =>
      catalogCards(locale, 'apps').map((card) => card.id)
    )
  ),
]

describe('AI app brand logos', () => {
  it('maps every catalogued AI app to a real brand logo', () => {
    for (const slug of APP_SLUGS) {
      expect(appLogoPath(slug), `${slug} logo mapping`).toBeTruthy()
    }
    expect(Object.keys(APP_LOGO_PATHS).sort()).toEqual([...APP_SLUGS].sort())
  })

  it('points every mapping at an existing local asset', () => {
    for (const [slug, path] of Object.entries(APP_LOGO_PATHS)) {
      expect(path.startsWith('/apps-assets/logos/'), `${slug} asset path`).toBe(
        true
      )
      expect(
        existsSync(resolve(publicDir, path.replace(/^\//, ''))),
        `${slug} asset file ${path}`
      ).toBe(true)
    }
  })

  it('returns no logo for an unknown slug', () => {
    expect(appLogoPath('not-a-real-app')).toBeUndefined()
  })

  // 卡片把素材 contain 进 32px 槽位。所有位图必须是同一 128x128 画布，
  // 否则 object-contain 会按各自画布缩放，出现同排图标大小不一。
  it('exports every raster logo on a uniform 128x128 canvas', () => {
    for (const [slug, path] of Object.entries(APP_LOGO_PATHS)) {
      if (!path.endsWith('.webp')) continue
      const bytes = readFileSync(resolve(publicDir, path.replace(/^\//, '')))
      const format = bytes.subarray(12, 16).toString('ascii')
      let width: number
      let height: number
      if (format === 'VP8X') {
        width = bytes.readUIntLE(24, 3) + 1
        height = bytes.readUIntLE(27, 3) + 1
      } else if (format === 'VP8 ') {
        width = bytes.readUInt16LE(26) & 0x3fff
        height = bytes.readUInt16LE(28) & 0x3fff
      } else if (format === 'VP8L') {
        const bits = bytes.readUInt32LE(21)
        width = (bits & 0x3fff) + 1
        height = ((bits >> 14) & 0x3fff) + 1
      } else {
        throw new Error(`${slug}: unsupported WebP format ${format}`)
      }
      expect(width, `${slug} width`).toBe(128)
      expect(height, `${slug} height`).toBe(128)
    }
  })

  // 卡片把 logo 渲染进 32px 的圆角框（rounded-lg）。只有带 alpha 的位图
  // 才能在圆角外露出背景；不透明的直角 WebP（VP8 / VP8L）会顶满方框，
  // 视觉上变成直角图标。所有官方 logo 都已导出为带透明通道的 WebP，
  // 这里守住这个约定，避免以后替换素材时退回直角方块。
  it('ships every raster logo with an alpha channel so cards stay rounded', () => {
    for (const [slug, path] of Object.entries(APP_LOGO_PATHS)) {
      if (!path.endsWith('.webp')) continue
      const bytes = readFileSync(resolve(publicDir, path.replace(/^\//, '')))
      const format = bytes.subarray(12, 16).toString('ascii')
      const hasAlpha = format === 'VP8X' && (bytes[20] & 0x10) !== 0
      expect(hasAlpha, `${slug} (${path}) must be a transparent WebP`).toBe(
        true
      )
    }
  })
})
