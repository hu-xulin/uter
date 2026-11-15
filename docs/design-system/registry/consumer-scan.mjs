#!/usr/bin/env node
/*
 * Copyright (C) 2026 Uter.ai
 * SPDX-License-Identifier: UNLICENSED
 *
 * UDS 7.0 — Token 消费者真实性扫描（§4.1 五层架构的「真实消费者」断言）
 *
 * manifest 的 consumer 字段是「登记的预期消费者」。本脚本做双向验证：
 *   1. 正向：每个登记的 consumer 文件必须真实引用该 Token，否则判虚假登记；
 *   2. 反向：扫描 web/src 与 registry 的全部源码，找出每个 Token 的实际
 *      引用文件（actualConsumers），未登记的真实引用列为 undeclaredUsage。
 *
 * 「真实引用」的判定（只认可以下三种，不做语义猜测）：
 *   - 静态引用：文件文本含 runtimeName（--ds7-*）或 canonical name（--ds-*）；
 *     theme.css 的别名层 `--color-term-x: var(--ds7-color-terminal-x)` 属于此类。
 *   - 动态模板：`--ds7-color-chart-${i + 1}` 的静态前缀匹配整组 Token。
 *   - 全 manifest 迭代：registry 生成器中 Object.keys(T) 模式（Showcase 把每个
 *     Token 注入为运行时变量并逐行渲染），仅对 docs/ 下的 .mjs 生效。
 *
 * 输出 audit/CONSUMER-SCAN.json。存在虚假登记或零真实消费者 Token 时 exit 1。
 * 本脚本不修改 manifest —— 登记整改必须人工基于证据完成。
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const UDS7 = join(HERE, '..')
const REPO = join(UDS7, '..', '..')
const MANIFEST = JSON.parse(readFileSync(join(UDS7, 'TOKEN-MANIFEST.json'), 'utf8'))
const T = MANIFEST.tokens

const SCAN_DIRS = [
  join(REPO, 'web', 'src'),
  HERE,
]
const EXT = /\.(css|ts|tsx|js|mjs)$/
const SKIP = /(?:node_modules|__tests__|\.test\.|\.spec\.)/

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (SKIP.test(p)) continue
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (EXT.test(e)) out.push(p)
  }
  return out
}

/**
 * 从文件文本提取 Token 引用证据。
 * - CSS 只认 var() 引用，定义处不算消费；
 * - web/src 产品文件只认 --ds7-* 运行时名：canonical --ds-* 在产品运行时
 *   解析到 3.0 同名变量（值不同），不是 7.0 Token 的消费；
 * - docs/ registry 生成器认 canonical 名（manifest 键读取）与 --ds7-*；
 * - 注释不算引用。
 */
function extractRefs(text, isRegistryGenerator, isCss, isProduct) {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const name = isProduct ? '--ds7-' : '--ds(?:7)?-'
  const statics = new Set()
  const prefixes = new Set()
  if (isCss) {
    for (const m of clean.matchAll(new RegExp(String.raw`var\(\s*(${name}[a-z0-9-]+)`, 'g'))) {
      statics.add(m[1])
    }
  } else {
    for (const m of clean.matchAll(new RegExp(String.raw`${name}[a-z0-9]+(?:-[a-z0-9]+)*`, 'g'))) {
      statics.add(m[0])
    }
    for (const m of clean.matchAll(new RegExp(String.raw`${name}[a-z0-9-]+(?=\$\{)`, 'g'))) {
      prefixes.add(m[0])
    }
  }
  // 全 manifest 迭代只认未过滤的 Object.keys(T)（如 render-showcase 的
  // names = Object.keys(T).sort()）；带 .filter 前缀约束的是分组渲染，
  // 其消费范围由静态名 / 模板前缀判定，不得扩大到全部 Token。
  const wholeManifest = isRegistryGenerator && /Object\.keys\(T\)(?!\.filter)/.test(text)
  return { statics, prefixes, wholeManifest }
}

function refsToken(refs, name, runtimeName) {
  if (refs.statics.has(name) || refs.statics.has(runtimeName)) return 'static'
  for (const p of refs.prefixes) {
    if (name.startsWith(p) || runtimeName.startsWith(p)) return 'template'
  }
  if (refs.wholeManifest) return 'manifest-iteration'
  return null
}

/** consumer 字段可能带注释后缀（如 "index.css (yace)"），取纯路径。 */
const cleanPath = (s) => s.trim().replace(/\s*\(.*\)\s*$/, '')

/** docs 侧只有 Showcase 渲染链算视觉消费；其余 registry 文件是数据处理。 */
const RENDERERS = new Set([
  'docs/design-system/registry/render-showcase.mjs',
  'docs/design-system/registry/showcase-extensions.mjs',
  'docs/design-system/registry/syntax-adapter.mjs',
])
const isConsumerFile = (rel) => rel.startsWith('web/') || RENDERERS.has(rel)

const files = SCAN_DIRS.flatMap((d) => walk(d))
const fileRefs = new Map()
for (const f of files) {
  const rel = relative(REPO, f)
  fileRefs.set(rel, extractRefs(readFileSync(f, 'utf8'), rel.startsWith('docs/'), rel.endsWith('.css'), rel.startsWith('web/')))
}

const names = Object.keys(T).sort()
const report = {}
const falseDeclared = []
const noConsumer = []
const undeclaredUsage = []

for (const n of names) {
  const t = T[n]
  const declared = String(t.consumer ?? '')
    .split(/[;,\n]/)
    .map(cleanPath)
    .filter((s) => /^(web|docs)\//.test(s))
  const verified = []
  const falseHere = []
  for (const d of declared) {
    const refs = fileRefs.get(d)
    if (!refs) {
      // 文件不在扫描范围（可能是 .html / .json 等）：退化为磁盘存在 + 原文包含检查。
      const abs = join(REPO, d)
      if (existsSync(abs) && statSync(abs).isFile() && readFileSync(abs, 'utf8').includes(n)) verified.push(d)
      else falseHere.push(d)
      continue
    }
    if (refsToken(refs, n, t.runtimeName)) verified.push(d)
    else falseHere.push(d)
  }
  const actual = []
  for (const [rel, refs] of fileRefs) {
    if (refsToken(refs, n, t.runtimeName)) actual.push(rel)
  }
  const undeclared = actual.filter((a) => !declared.includes(a) && isConsumerFile(a))
  report[n] = {
    declared, verified, falseDeclared: falseHere,
    actualConsumers: actual.sort(), undeclaredUsage: undeclared.sort(),
  }
  if (falseHere.length) falseDeclared.push({ token: n, paths: falseHere })
  if (verified.length === 0) noConsumer.push(n)
  if (undeclared.length) undeclaredUsage.push({ token: n, paths: undeclared })
}

const summary = {
  scannedAt: new Date().toISOString(),
  filesScanned: files.length,
  tokens: names.length,
  declaredConsumers: names.filter((n) => report[n].declared.length > 0).length,
  verifiedTokens: names.filter((n) => report[n].verified.length > 0).length,
  falseDeclaredCount: falseDeclared.length,
  noVerifiedConsumerCount: noConsumer.length,
  undeclaredUsageCount: undeclaredUsage.length,
}
const out = { summary, falseDeclared, noVerifiedConsumer: noConsumer, undeclaredUsage, tokens: report }
const outPath = join(UDS7, 'audit', 'CONSUMER-SCAN.json')
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n')

console.log(`consumer-scan: ${files.length} 个源码文件，${names.length} 个 Token`)
console.log(`  登记消费者: ${summary.declaredConsumers}；验证通过: ${summary.verifiedTokens}`)
console.log(`  虚假登记: ${falseDeclared.length}；零真实消费者: ${noConsumer.length}；未登记真实引用: ${undeclaredUsage.length}`)
if (falseDeclared.length) {
  console.log('  虚假登记明细（前 20）:')
  for (const f of falseDeclared.slice(0, 20)) console.log(`    ${f.token} → ${f.paths.join(', ')}`)
}
console.log(`  报告: ${relative(REPO, outPath)}`)
process.exit(falseDeclared.length || noConsumer.length ? 1 : 0)