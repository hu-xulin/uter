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
/**
 * 视觉回归基线（规范 §24「视觉回归」）。
 *
 * 为什么不用 Playwright：它要新增依赖、下载浏览器、改 bun.lock —— 而 CI 是
 * `--frozen-lockfile`。在引入这套重量级依赖之前，先用**本机 Chrome 无头截图**
 * 把基线跑起来，成本为零，能立刻发现布局漂移。将来真要接 Playwright，这条
 * 基线的目标清单可以直接复用。
 *
 * 用法：
 *   node scripts/visual-regression.mjs           对比基线（有差异 → 退出码 1）
 *   node scripts/visual-regression.mjs --update  重录基线
 *   CHROME_PATH=/path/to/chrome node …           显式指定浏览器
 *
 * 结果状态（对应 AIES §7 的五级，别把没跑说成通过）：
 *   PASS      两个视口都与基线逐字节一致
 *   FAIL      存在差异
 *   BLOCKED   找不到可用浏览器 / 目标文件缺失 —— 必须在报告里明说
 *
 * ⚠️ 本脚本**不接 CI**：不同机器 / OS 的字体渲染与抗锯齿不同，截图字节不可能
 * 跨平台一致，接进 CI 只会制造随机红灯。它的定位是「本地交付前的最后一双眼睛」。
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB_ROOT = fileURLToPath(new URL('..', import.meta.url))
const UPDATE = process.argv.includes('--update')

/** 快照图存放处（gitignore；结果大且可由 target 重算）。 */
const SNAP_DIR = join(WEB_ROOT, '.visual-snapshots')
/** 基线清单：只存哈希，体积很小，进版本库。 */
const MANIFEST = join(WEB_ROOT, 'visual-regression', 'baseline.json')

/**
 * 回归目标。目前只有核查页 —— 它是**唯一不需要后端和登录态**就能渲染完整
 * Token 的页面（涵盖了全部十档字号、七档文字色、组件与间距）。
 *
 * 规范 §24 列的真实页面（登录/注册、Dashboard、模型列表、API Key、请求日志、
 * 充值账单、用户设置、官网首页）需要起服务 + 构造登录态，属于另一件事：
 * 等有了可复用的 fixtures 再往这里加，不要假装它们已被覆盖。
 */
const TARGETS = [
  {
    id: 'design-showcase',
    file: '../docs/design-system/showcase.html',
    说明: '设计规范核查页（每档 Token 都渲染了真实样本）',
  },
]

const VIEWPORTS = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'mobile', width: 390, height: 844 },
]

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ]
  for (const path of candidates) if (existsSync(path)) return path
  const which = spawnSync('sh', ['-c', 'command -v google-chrome chromium chromium-browser'], {
    encoding: 'utf8',
  })
  return which.stdout?.trim().split('\n')[0] || null
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

const chrome = findChrome()
if (!chrome) {
  console.error(
    '✗ 找不到可用的 Chrome / Chromium，视觉回归未执行（BLOCKED）。\n' +
      '  安装 Chrome，或用 CHROME_PATH=/path/to/chrome 指定。\n' +
      '  ⚠️ 这是「没跑」，不是「通过」——交付报告里必须照实写 BLOCKED。'
  )
  process.exit(2)
}

mkdirSync(SNAP_DIR, { recursive: true })

function capture(target, viewport) {
  const out = join(SNAP_DIR, `${target.id}-${viewport.id}.png`)
  const result = spawnSync(
    chrome,
    [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${viewport.width},${viewport.height}`,
      `--screenshot=${out}`,
      '--virtual-time-budget=4000',
      `file://${resolve(WEB_ROOT, target.file)}`,
    ],
    { encoding: 'utf8', timeout: 60_000 }
  )
  if (!existsSync(out) || result.status !== 0) {
    console.error(`✗ 截图失败：${target.id} @ ${viewport.id}\n${result.stderr ?? ''}`)
    process.exit(2)
  }
  return { path: out, hash: sha256(out), bytes: statSync(out).size }
}

const previous = existsSync(MANIFEST)
  ? JSON.parse(readFileSync(MANIFEST, 'utf8'))
  : { entries: [] }
const previousByKey = new Map(previous.entries.map((e) => [e.key, e]))

const entries = []
const diffs = []
let ok = 0

for (const target of TARGETS) {
  const abs = resolve(WEB_ROOT, target.file)
  if (!existsSync(abs)) {
    console.error(`✗ 目标文件不存在：${target.file}（BLOCKED，未执行）`)
    process.exit(2)
  }

  for (const viewport of VIEWPORTS) {
    const shot = capture(target, viewport)
    const key = `${target.id}@${viewport.id}`
    const entry = {
      key,
      target: target.id,
      viewport: viewport.id,
      width: viewport.width,
      height: viewport.height,
      sha256: shot.hash,
      bytes: shot.bytes,
    }
    entries.push(entry)

    const old = previousByKey.get(key)
    if (!old) {
      diffs.push({ ...entry, how: '基线里没有这条（新增目标）' })
    } else if (old.sha256 !== entry.sha256) {
      diffs.push({ ...entry, how: `与基线不一致（基线 ${old.bytes}B → 现在 ${entry.bytes}B）` })
      copyFileSync(shot.path, join(SNAP_DIR, `${key}-diff-actual.png`))
    } else {
      ok += 1
    }
  }
}

if (UPDATE) {
  mkdirSync(join(WEB_ROOT, 'visual-regression'), { recursive: true })
  writeFileSync(
    MANIFEST,
    `${JSON.stringify(
      {
        说明:
          '视觉回归基线。这里只存截图哈希与体积，PNG 本体落在 .visual-snapshots/' +
          '（gitignore）。字体渲染因机器而异，故本基线只在同一台机器上可信，不接 CI。',
        updatedAt: new Date().toISOString(),
        viewports: VIEWPORTS,
        entries,
      },
      null,
      2
    )}\n`
  )
  console.log(`✓ 已重录 ${entries.length} 条视觉基线 → visual-regression/baseline.json`)
  process.exit(0)
}

if (diffs.length === 0) {
  console.log(
    `✓ 视觉回归通过：${entries.length} 个目标/视口组合与基线逐字节一致。`
  )
  process.exit(0)
}

console.log(`✗ 视觉回归发现 ${diffs.length} 处差异：\n`)
for (const d of diffs) {
  console.log(`  ${d.key}（${d.width}×${d.height}）  ${d.how}`)
}
console.log(
  '\n截图落在 .visual-snapshots/，逐张人工确认：\n' +
    '  · 是预期改动 → `bun run test:visual:update` 重录基线；\n' +
    '  · 不是预期改动 → 回查改了什么 Token。**截图一致不代表交互与无障碍合格**（§5.2），\n' +
    '    布局对了不等于设计对了。'
)
process.exit(1)
