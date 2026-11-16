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
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { SYNTAX_ADAPTER } from '../../components/ai-elements/code-block'

/**
 * UDS 8.0.0 语法 Adapter 专用守卫（探针 C-H01 / C-H06 的 vitest 落地）。
 *
 * 20 个语义 Token 必须与 VS Code Light+ / Dark+ 官方主题一一对应：
 * - CodeMirror Adapter 覆盖全部 20 个语义名，且 inserted / deleted / invalid
 *   独立成条，不得塌缩成 keyword；
 * - 颜色一律走 `var(--ds8-syntax-*)`，Adapter 内禁止硬编码 HEX；
 * - 运行时变量必须真实定义在 uds-semantic-bridge.css，且与 manifest 的
 *   `--ds-syntax-*` 集合一一对应（20 个，无缺、无多）。
 */

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const BRIDGE = readFileSync(
  resolve(REPO, 'web/src/design-system/tokens/uds-semantic-bridge.css'),
  'utf8',
)
const CODE_BLOCK = readFileSync(
  resolve(REPO, 'web/src/components/ai-elements/code-block.tsx'),
  'utf8',
)
const ADAPTER_START = CODE_BLOCK.indexOf('SYNTAX_ADAPTER = [')
const ADAPTER_END = CODE_BLOCK.indexOf('] as const', ADAPTER_START)
const adapterLiteral = CODE_BLOCK.slice(ADAPTER_START, ADAPTER_END)

const BRIDGE_VARS = new Set(
  [...BRIDGE.matchAll(/(--ds8-syntax-[a-z]+)\s*:/g)].map((m) => m[1]),
)

describe('UDS8 syntax adapter mapping', () => {
  it('covers exactly 20 semantic tokens with unique names', () => {
    expect(SYNTAX_ADAPTER).toHaveLength(20)
    const names = SYNTAX_ADAPTER.map((e) => e.token)
    expect(new Set(names).size).toBe(20)
  })

  it('keeps inserted / deleted / invalid independent (not collapsed into keyword)', () => {
    const names = SYNTAX_ADAPTER.map((e) => e.token)
    for (const key of ['inserted', 'deleted', 'invalid']) {
      expect(names).toContain(key)
    }
    // inserted 不得复用 keyword 的 tags 集合
    const inserted = SYNTAX_ADAPTER.find((e) => e.token === 'inserted')
    const keyword = SYNTAX_ADAPTER.find((e) => e.token === 'keyword')
    expect(inserted && keyword ? inserted.tags.includes(keyword.tags[0]) : true).toBe(false)
  })

  it('maps every entry to var(--ds8-syntax-*) with no hardcoded colors', () => {
    // HighlightStyle 统一用模板字面量生成颜色：var(--ds8-syntax-${entry.token})
    expect(CODE_BLOCK).toContain('var(--ds8-syntax-${entry.token})')
    for (const entry of SYNTAX_ADAPTER) {
      expect(adapterLiteral).toContain(`token: '${entry.token}'`)
    }
    // Adapter 数组字面量内不得出现裸 HEX（色值唯一真源是 manifest → bridge）
    expect(/#[0-9a-fA-F]{3,8}\b/.test(adapterLiteral)).toBe(false)
  })

  it('bridge defines exactly the 20 --ds8-syntax-* variables the adapter consumes', () => {
    const consumed = new Set(SYNTAX_ADAPTER.map((e) => `--ds8-syntax-${e.token}`))
    expect(BRIDGE_VARS.size).toBe(20)
    for (const v of consumed) expect(BRIDGE_VARS.has(v)).toBe(true)
    expect(BRIDGE_VARS.size).toBe(consumed.size)
  })

  it('manifest declares the same 20 semantic syntax tokens', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(REPO, 'docs/design-system/TOKEN-MANIFEST.json'), 'utf8'),
    ) as { tokens: Record<string, unknown> }
    const syntaxKeys = Object.keys(manifest.tokens).filter((n) => n.startsWith('--ds-syntax-'))
    expect(syntaxKeys).toHaveLength(20)
    for (const entry of SYNTAX_ADAPTER) {
      // manifest 名 --ds-syntax-<key> ↔ 运行时名 --ds8-syntax-<key>
      expect(manifest.tokens[`--ds-syntax-${entry.token}`]).toBeDefined()
    }
  })
})
