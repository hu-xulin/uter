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
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

const WEB_ROOT = process.cwd()
const REPO_ROOT = join(WEB_ROOT, '..')
const TOKENS_DIR = join(WEB_ROOT, 'src/design-system/tokens')
const UI_DIR = join(WEB_ROOT, 'src/components/ui')
const COMPONENT_JSON = join(WEB_ROOT, 'src/design-system/component-registry.json')
const COMPONENT_YAML = join(
  REPO_ROOT,
  'docs/design-system/uter-design-system-5.0/COMPONENT-REGISTRY.yaml'
)

function read(file: string): string {
  return readFileSync(file, 'utf8')
}

function stripBlockComments(text: string): string {
  return text.replaceAll(/\/\*[\s\S]*?\*\//g, (match) =>
    match.replaceAll(/[^\n]/g, ' ')
  )
}

function cssFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...cssFiles(full))
    else if (full.endsWith('.css')) out.push(full)
  }
  return out
}

function definedVariables(file: string): Set<string> {
  const names = new Set<string>()
  for (const line of stripBlockComments(read(file)).split('\n')) {
    const match = line.match(/^\s*(--[A-Za-z0-9_-]+)\s*:/)
    if (match) names.add(match[1])
  }
  return names
}

function blockNames(text: string, selector: RegExp): Set<string> {
  const block = text.match(selector)
  const names = new Set<string>()
  if (!block) return names
  for (const line of block[0].split('\n')) {
    const match = line.match(/^\s*(--[A-Za-z0-9_-]+)\s*:/)
    if (match) names.add(match[1])
  }
  return names
}

const tokenFiles = cssFiles(TOKENS_DIR)

describe('UTER Design System 5.0 — Token 结构不变量', () => {
  it('Token 变量不在不同 CSS 文件重复定义，避免双真源', () => {
    const owners = new Map<string, Set<string>>()
    for (const file of tokenFiles) {
      const owner = relative(WEB_ROOT, file)
      for (const name of definedVariables(file)) {
        const current = owners.get(name) ?? new Set<string>()
        current.add(owner)
        owners.set(name, current)
      }
    }
    const duplicates = [...owners.entries()]
      .filter(([, files]) => files.size > 1)
      .map(([name, files]) => `${name}: ${[...files].join(', ')}`)

    expect(duplicates).toEqual([])
    expect(owners.size).toBeGreaterThan(200)
  })

  it('字号阶梯只由 tokens/typography.css 的 theme 块声明，其余文件不得另立刻度', () => {
    const owners = new Set<string>()
    for (const file of tokenFiles) {
      for (const name of definedVariables(file)) {
        if (name.startsWith('--text-')) owners.add(relative(WEB_ROOT, file))
      }
    }
    expect([...owners]).toEqual(['src/design-system/tokens/typography.css'])
  })

  it('Primitive 层不反向引用 Semantic 变量，保持单向依赖', () => {
    const primitiveSuffixes = [
      'primitives.css',
      'typography.css',
      'spacing.css',
      'brand.css',
    ]
    const offenders = tokenFiles
      .filter((file) => primitiveSuffixes.some((suffix) => file.endsWith(suffix)))
      .filter((file) => /var\(\s*--ds-/.test(stripBlockComments(read(file))))
      .map((file) => relative(WEB_ROOT, file))

    expect(offenders).toEqual([])
  })

  it('品牌色在 Light 与 Dark 两侧变量成对，主题切换不会漏色', () => {
    const brand = join(TOKENS_DIR, 'generated/brand.css')
    expect(existsSync(brand)).toBe(true)
    const text = stripBlockComments(read(brand))
    const light = blockNames(text, /:root\s*\{[^}]*\}/)
    const dark = blockNames(text, /\.dark\s*\{[^}]*\}/)

    expect(light.size).toBeGreaterThan(0)
    expect([...light].filter((name) => !dark.has(name))).toEqual([])
    expect([...dark].filter((name) => !light.has(name))).toEqual([])
  })
})

describe('UTER Design System 5.0 — 注册表与代码一致性', () => {
  it('组件注册表 JSON 的实现文件与文件系统逐一对齐，测试文件不计入组件', () => {
    const registry = JSON.parse(read(COMPONENT_JSON)) as {
      components: Array<{ id: string; file: string }>
    }
    const implementationFiles = readdirSync(UI_DIR)
      .filter((name) => name.endsWith('.tsx'))
      .filter((name) => !/\.(test|spec)\.tsx$/.test(name))
      .map((name) => `src/components/ui/${name}`)
      .sort()
    const registeredFiles = registry.components
      .map((component) => component.file)
      .sort()

    expect(registeredFiles).toEqual(implementationFiles)
    expect(new Set(registeredFiles).size).toBe(registeredFiles.length)
  })

  it('组件注册表 5.0 YAML 投影与 JSON 真源 ID 集合完全一致，无幻影组件', () => {
    const registry = JSON.parse(read(COMPONENT_JSON)) as {
      components: Array<{ id: string }>
    }
    const jsonIds = registry.components.map((component) => component.id).sort()
    const yaml = read(COMPONENT_YAML)
    const yamlIds = [...yaml.matchAll(/^\s*- id: (UTER-CMP-[A-Z0-9_]+)$/gm)]
      .map((match) => match[1])
      .sort()

    expect(yamlIds.length).toBeGreaterThan(0)
    expect(yamlIds).toEqual(jsonIds)
    expect(new Set(yamlIds).size).toBe(yamlIds.length)
  })

  it('每个已登记组件的实现路径在 YAML 投影中解析为真实文件', () => {
    const yaml = read(COMPONENT_YAML)
    const paths = [...yaml.matchAll(/^\s*implementation_path: (.+)$/gm)].map(
      (match) => match[1].trim()
    )
    const missing = paths.filter((path) => !existsSync(join(REPO_ROOT, path)))

    expect(paths.length).toBeGreaterThan(0)
    expect(missing).toEqual([])
  })
})
