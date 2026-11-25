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

const WEB = process.cwd()
const DOCS = join(WEB, '..', 'docs')
const readWeb = (rel: string) => readFileSync(join(WEB, rel), 'utf8')
const readDocs = (rel: string) => readFileSync(join(DOCS, rel), 'utf8')

const HEAD = 'fa5e1d5269f90490c17b500aa0c29bb19c022027'

/**
 * UDS8 旧边界退役执行守卫（2026-11-25 所有者裁决：全部按 UDS8 执行）。
 *
 * 这些断言锁定三件真实结果：
 *   ① CM-06 / font-sans 已做源码迁移；
 *   ② 173 组例外已写入 UDS8_ADOPTED 决策记录，EX-005 已 RESOLVED；
 *   ③ 签名材料已预填，用户只需输入姓名并手写签名。
 */
describe('UDS8 退役执行守卫', () => {
  const theme = readWeb('src/styles/theme.css')

  it('CM-06 输入框边框在 Light / Dark 都接入 UDS8 令牌', () => {
    const matches = theme.match(/--input:\s*var\(--ds-color-border-input\)/g)
    expect(matches).toHaveLength(2)
    expect(theme).not.toContain('#45465f')
    expect(theme).not.toContain('CM-06 ISOLATE')
  })

  it('font-sans / font-manrope 历史别名已删除', () => {
    expect(theme).not.toMatch(/--font-sans\s*:/)
    expect(theme).not.toMatch(/--font-manrope\s*:/)
    expect(theme).toMatch(/--font-inter:\s*var\(--font-ui\)/)
  })

  it('四处调用改用 UDS8 唯一字体工具类 font-ui', () => {
    const files = [
      'src/features/home/components/hero-terminal-demo.tsx',
      'src/features/task-plugins/components/plugin-endpoints.tsx',
      'src/features/channels/components/dialogs/advanced-custom-editor-dialog.tsx',
      'src/components/ui/kbd.tsx',
    ]
    for (const file of files) {
      const src = readWeb(file)
      expect(src, file).not.toContain('font-sans')
      expect(src, file).toContain('font-ui')
    }
  })

  it('173 组例外全部切换为 UDS8_ADOPTED 且保留原始理由', () => {
    const data = JSON.parse(
      readDocs('design-system/audit/comprehensive/decision-execution.json')
    ) as {
      ownerDirective?: { targetHead?: string }
      results: Array<{
        previousStatus?: string
        status: string
        decision?: string
        originalAction?: string
      }>
      totals: { statusCounts: Record<string, number> }
    }

    expect(data.ownerDirective?.targetHead).toBe(HEAD)
    const adopted = data.results.filter(
      (x) => x.previousStatus === 'REGISTERED_EXCEPTION'
    )
    expect(adopted).toHaveLength(173)
    expect(
      adopted.every(
        (x) =>
          x.status === 'UDS8_ADOPTED' &&
          x.decision === 'MIGRATE_UDS8' &&
          !!x.originalAction
      )
    ).toBe(true)
    expect(data.totals.statusCounts.REGISTERED_EXCEPTION).toBe(0)
    expect(data.totals.statusCounts.UDS8_ADOPTED).toBe(173)
  })

  it('EX-005 已 RESOLVED 并绑定执行证据', () => {
    const registry = JSON.parse(
      readDocs('design-system/EXCEPTION-REGISTRY.json')
    ) as {
      items: Array<{
        id: string
        status: string
        action?: string
        evidence?: string
        decision?: { groups?: number; registeredExceptionRemaining?: number }
      }>
    }
    const ex005 = registry.items.find((x) => x.id === 'EX-005')
    expect(ex005?.status).toBe('RESOLVED')
    expect(ex005?.action).toBe('MIGRATE_TO_UDS8')
    expect(ex005?.evidence).toBe(
      'docs/design-system/audit/UDS8-RETIREMENT-EXECUTION-EVIDENCE.md'
    )
    expect(ex005?.decision?.groups).toBe(173)
    expect(ex005?.decision?.registeredExceptionRemaining).toBe(0)
  })

  it('签名凭证只留下姓名输入与手写画布，其余字段已预填', () => {
    const html = readDocs('design-system/audit/UDS8-SIGNATURE-CREDENTIAL.html')
    expect(html.match(/<input\b/g) ?? []).toHaveLength(1)
    expect(html).toContain('<canvas id="sig"')
    expect(html).toContain(HEAD)
    expect(html).toContain('component_evidence:{verified:65,total:65')
    expect(html).toContain('registeredExceptions:173,uds8Adopted:173')
  })

  it('退役板与决策板已预选全部 UDS8 迁移，不再要求填写三要素', () => {
    const retirement = readDocs(
      'design-system/audit/UDS8-RETIREMENT-COMPARISON.html'
    )
    const board = readDocs(
      'design-system/audit/UDS8-FINAL-DECISION-AND-SIGNATURE.html'
    )
    expect(
      retirement.match(/name="x\d+" value="migrate" checked/g)
    ).toHaveLength(173)
    expect(retirement).toContain('name="cm06" value="migrate" checked')
    expect(retirement).toContain('name="fontalias" value="retire" checked')
    expect(board).toContain('name="r1" value="retire" checked')
    expect(board).toContain('name="r2" value="retire" checked')
    expect(board).toContain('name="r3" value="retire" checked')
    expect(board).not.toContain('acceptMode')
    expect(board).toContain('id="rScope" size="50" value=')
    expect(board).toContain('id="rAccept" size="44" value=')
  })

  it('执行证据报告存在并绑定当前 HEAD', () => {
    const report = readDocs(
      'design-system/audit/UDS8-RETIREMENT-EXECUTION-EVIDENCE.md'
    )
    expect(report).toContain(HEAD)
    expect(report).toContain('UDS8_ADOPTED')
    expect(report).toContain('font-ui')
  })
})
