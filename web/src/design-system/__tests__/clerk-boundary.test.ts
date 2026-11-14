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
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, describe, expect, it } from 'vitest'

/**
 * `scripts/check-clerk-boundary.mjs` 的回归测试（`UDS5-S21` §8 / §10）。
 *
 * Clerk 只作为外部设计参考，不得进入 Uter 运行时。守卫必须同时挡住四类越界：
 * 依赖引入、运行时源码引用、品牌值照搬、以及把 Clerk 官方未提供的通用能力
 * 写成官方能力。这里用临时沙箱注入违例，逐项验证守卫确实会拒绝。
 */

// 按测试文件位置解析 web 根，避免依赖 process.cwd()（vitest worker cwd 不可靠）。
const TEST_DIR = dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = resolve(TEST_DIR, '..', '..', '..')
const SCRIPT = join(WEB_ROOT, 'scripts/check-clerk-boundary.mjs')
const DOCS_DIR = join(
  WEB_ROOT,
  '..',
  'docs/design-system/uter-design-system-5.0'
)

const tempRoots: string[] = []

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

/** 构造一个最小可用的「伪 web 根」，docs 指向真实 5.0 目录以隔离文档检查。 */
function makeSandbox(options: {
  dependencies?: Record<string, string>
  source?: string
  docs?: string | null
}) {
  const root = mkdtempSync(join(tmpdir(), 'clerk-boundary-'))
  tempRoots.push(root)
  mkdirSync(join(root, 'src'), { recursive: true })
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'clerk-boundary-fixture',
      dependencies: options.dependencies ?? {},
    })
  )
  writeFileSync(join(root, 'src', 'index.ts'), options.source ?? 'export const ok = true\n')

  let docs = options.docs
  if (docs === undefined) {
    docs = DOCS_DIR
  } else if (docs !== null) {
    const docsRoot = join(root, 'docs')
    mkdirSync(docsRoot, { recursive: true })
    writeFileSync(
      join(docsRoot, 'CLERK-DESIGN-REFERENCE-STANDARD.md'),
      docs
    )
    docs = docsRoot
  }

  const args = ['--root', root, '--json']
  if (docs !== null) args.push('--docs', docs)
  return args
}

afterAll(() => {
  for (const root of tempRoots) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('check-clerk-boundary.mjs', () => {
  it('当前仓库基线通过（零 Clerk 运行时依赖、零品牌照搬、能力归属清单完整）', () => {
    const result = run(['--json'])
    expect(result.exit).toBe(0)
    expect(result.stdout).toContain('"verdict": "PASS"')
    expect(result.stdout).toContain('"errors": 0')
  })

  it('拒绝 package.json 引入 @clerk/* 依赖', () => {
    const args = makeSandbox({ dependencies: { '@clerk/nextjs': '^6.0.0' } })
    const result = run(args)
    expect(result.exit).toBe(1)
    expect(result.stdout).toContain('"verdict": "FAIL"')
    expect(result.stdout).toContain('C1')
  })

  it('拒绝源码出现 ClerkProvider', () => {
    const args = makeSandbox({
      source: "import { ClerkProvider } from '@clerk/nextjs'\nexport const x = ClerkProvider\n",
    })
    const result = run(args)
    expect(result.exit).toBe(1)
    expect(result.stdout).toContain('C2')
  })

  it('拒绝源码出现 Clerk 稳定类 cl-*', () => {
    const args = makeSandbox({
      source: "export const cls = 'cl-formButtonPrimary'\n",
    })
    const result = run(args)
    expect(result.exit).toBe(1)
    expect(result.stdout).toContain('C2')
  })

  it('拒绝照搬 Clerk 品牌色 #6c47ff', () => {
    const args = makeSandbox({
      source: "export const brand = '#6c47ff'\n",
    })
    const result = run(args)
    expect(result.exit).toBe(1)
    expect(result.stdout).toContain('C3')
  })

  it('拒绝 --clerk-* 变量声明进入 Uter 样式', () => {
    const args = makeSandbox({
      source: 'export const css = `--clerk-color-primary: blue;`\n',
    })
    const result = run(args)
    expect(result.exit).toBe(1)
    expect(result.stdout).toContain('C3')
  })

  it('拒绝能力归属清单被删减（把 Clerk 未提供能力写成提供）', () => {
    const args = makeSandbox({
      docs: [
        '# fake S21',
        '| 能力类别 | 官方是否提供 |',
        '|---|---|',
        '| Data Table | 是 |',
      ].join('\n'),
    })
    const result = run(args)
    expect(result.exit).toBe(1)
    expect(result.stdout).toContain('C4')
  })

  it('C5 业务红线：拒绝 S21 §3 P3 符号登记被删减', () => {
    const args = makeSandbox({
      docs: [
        '# fake S21',
        '## 3. 禁止事项',
        '| # | 禁止项 | 5.0 约束 |',
        '|---|---|---|',
        '| P3 | 替换 Uter 认证逻辑 | 部分零改动 |',
        '## 4. 参考',
      ].join('\n'),
    })
    const result = run(args)
    expect(result.exit).toBe(1)
    expect(result.stdout).toContain('C5')
  })

  it('C5 业务红线：拒绝前端越界耦合后端业务函数 EnforceOrgQuota', () => {
    const args = makeSandbox({
      source: 'export const x = EnforceOrgQuota\n',
    })
    const result = run(args)
    expect(result.exit).toBe(1)
    expect(result.stdout).toContain('C5')
  })

  it('C5 业务红线：当前仓库基线通过（P3 已登记 + 前端无后端函数耦合）', () => {
    const result = run(['--json'])
    expect(result.exit).toBe(0)
    expect(result.stdout).toContain('"id": "C5"')
    expect(result.stdout).toContain('"passed": true')
  })

  it('排除 __tests__ 与 *.test.* 自身，守卫不自命中', () => {
    const args = makeSandbox({})
    const root = args[1]
    mkdirSync(join(root, 'src', '__tests__'), { recursive: true })
    writeFileSync(
      join(root, 'src', '__tests__', 'fixture.test.ts'),
      "import { ClerkProvider } from '@clerk/nextjs'\n"
    )
    const result = run(args)
    expect(result.exit).toBe(0)
  })
})
