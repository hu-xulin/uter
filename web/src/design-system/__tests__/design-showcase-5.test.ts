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
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

/**
 * `scripts/check-design-showcase-5.0.mjs` 的回归测试（`UDS5-S23` §11）。
 *
 * 5.0 全量 Showcase 必须覆盖：注册表的全部规范条目、组件注册表的全部组件、
 * 以及全部基础元素 / 模式分区。守卫是纯静态只读的，测试用临时副本注入违例，
 * 逐项验证它确实会拒绝「少一个规范 / 少一个组件 / 少一个元素 / 静态截图 /
 * 外链资源 / 丢了交互控件」这几类退化。
 */

const WEB_ROOT = process.cwd()
const SCRIPT = join(WEB_ROOT, 'scripts/check-design-showcase-5.0.mjs')
const SHOWCASE = join(
  WEB_ROOT,
  '..',
  'docs/design-system/uter-design-system-5.0/SHOWCASE-5.0.html'
)

const tempFiles: string[] = []

function run(args: string[] = []) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { exit: 0, stdout }
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string }
    return {
      exit: e.status ?? 1,
      stdout: `${e.stdout ?? ''}${e.stderr ?? ''}`,
    }
  }
}

/** 复制真实 showcase 到临时目录，应用一处违例，返回该副本路径。 */
function tampered(mutate: (html: string) => string) {
  const dir = mkdtempSync(join(tmpdir(), 'uds5-showcase-'))
  const file = join(dir, 'SHOWCASE-5.0.html')
  tempFiles.push(dir)
  writeFileSync(file, mutate(readFileSync(SHOWCASE, 'utf8')), 'utf8')
  return file
}

function failWith(file: string) {
  const result = run(['--html', file, '--json'])
  expect(result.exit).toBe(1)
  expect(result.stdout).toContain('"verdict": "FAIL"')
  return result.stdout
}

afterAll(() => {
  for (const dir of tempFiles) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('check-design-showcase-5.0.mjs', () => {
  it('当前仓库基线通过：37 条注册条目 / 65 个组件 / 18+ 类元素全覆盖', () => {
    const result = run(['--json'])
    expect(result.exit).toBe(0)
    expect(result.stdout).toContain('"verdict": "PASS"')
    expect(result.stdout).toContain('"errors": 0')
    expect(result.stdout).toContain('"specIds": 37')
    expect(result.stdout).toContain('"componentIds": 65')
    expect(result.stdout).toContain('"generated": false')
  })

  it('拒绝少一个规范分册分区', () => {
    const file = tampered((html) =>
      html.replace('data-spec-id="UDS5-S13"', 'data-spec-id="UDS5-S13-REMOVED"')
    )
    expect(failWith(file)).toContain('UDS5-S13')
  })

  it('拒绝少一个已注册组件', () => {
    const file = tampered((html) =>
      html.replace(
        'data-component-id="UTER-CMP-ACCORDION"',
        'data-component-id="UTER-CMP-ACCORDION-GONE"'
      )
    )
    expect(failWith(file)).toContain('UTER-CMP-ACCORDION')
  })

  it('拒绝少一类基础元素分区', () => {
    const file = tampered((html) =>
      html.replace('data-element="typography"', 'data-element="typography-removed"')
    )
    expect(failWith(file)).toContain('typography')
  })

  it('拒绝用静态截图冒充组件展示（<img>）', () => {
    const file = tampered((html) =>
      html.replace('</body>', '<img src="shot.png" alt="component" /></body>')
    )
    expect(failWith(file)).toContain('img')
  })

  it('拒绝外部资源引用（单文件 file:// 可打开）', () => {
    const file = tampered((html) =>
      html.replace(
        '</head>',
        '<link rel="stylesheet" href="https://cdn.example.com/a.css" /></head>'
      )
    )
    expect(failWith(file)).toContain('external')
  })

  it('拒绝丢失交互切换控件', () => {
    const file = tampered((html) =>
      html.replace('data-control="state"', 'data-control="state-removed"')
    )
    expect(failWith(file)).toContain('data-control')
  })

  it('拒绝 manifest 计数与实际 DOM 不一致', () => {
    const file = tampered((html) =>
      html.replace('"specIds": 37', '"specIds": 999')
    )
    expect(failWith(file)).toContain('manifest')
  })
})
