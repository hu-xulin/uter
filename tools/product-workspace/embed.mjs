/*
 * UTER 产品规格中心 — 内嵌到 Uter 服务的静态投影
 *
 * 读取统一需求模型与原型 HTML，生成 web/public/product-spec/：
 *   index.html / app.js / styles.css / model.json / prototypes/**
 * Uter（Go）在 /product-spec/ 下以管理员鉴权提供这些文件；SPA 在
 * 内嵌模式下只读（编辑仍走本地 node tools/product-workspace/server.mjs）。
 *
 * 用法：node tools/product-workspace/embed.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const PUBLIC_SRC = path.join(HERE, 'public')
const OUT = path.join(ROOT, 'web', 'public', 'product-spec')
const MODEL = path.join(ROOT, 'docs', 'product', 'registry', 'product-model.json')
const PROTOTYPES = path.join(ROOT, 'docs', 'product', 'prototypes')

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
}

function copyTree(from, to, filter) {
  if (!fs.existsSync(from)) return 0
  let count = 0
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name)
    const dst = path.join(to, entry.name)
    if (entry.isDirectory()) {
      count += copyTree(src, dst, filter)
    } else if (filter(src)) {
      copyFile(src, dst)
      count += 1
    }
  }
  return count
}

if (!fs.existsSync(MODEL)) {
  console.error(`[embed] missing model: ${path.relative(ROOT, MODEL)}`)
  process.exit(1)
}

fs.mkdirSync(OUT, { recursive: true })
for (const file of ['index.html', 'app.js', 'styles.css']) {
  copyFile(path.join(PUBLIC_SRC, file), path.join(OUT, file))
}
copyFile(MODEL, path.join(OUT, 'model.json'))

// Prototypes are regenerated wholesale so deleted features cannot linger.
fs.rmSync(path.join(OUT, 'prototypes'), { recursive: true, force: true })
const prototypeCount = copyTree(
  PROTOTYPES,
  path.join(OUT, 'prototypes'),
  (file) => file.endsWith('.html')
)

const model = JSON.parse(fs.readFileSync(MODEL, 'utf8'))
console.log(
  `[embed] ${path.relative(ROOT, OUT)}: ${model.features.length} features, ` +
    `${prototypeCount} prototype pages, model v${model.model_version}`
)