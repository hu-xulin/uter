#!/usr/bin/env node
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
 * UTER Design System 7.0 · 展示页同步门禁（design:showcase:check / G07）
 *
 * 7.0 起 Showcase 由 `docs/design-system/registry/build.mjs` 从单一真源
 * `TOKEN-MANIFEST.json` 全量生成（SHOWCASE-7.0.html + web/public 副本），
 * 不再存在手写 showcase.html / showcase.tokens.js / 3.0 §28 内联快照。
 * 本脚本因此收敛为 7.0 生成器的薄包装，避免在 web/scripts 里重复一套
 * 渲染逻辑：
 *   --check  → build.mjs --check-showcase：以当前 manifest 重新渲染并与
 *              磁盘 SHOWCASE-7.0.html 逐字节比对，漂移即 FAIL（只读，不写文件）。
 *   默认     → build.mjs：重新生成全部 7.0 产物（含 Showcase）。
 *
 * 用法（可在仓库根或 web/ 下执行）：
 *   node web/scripts/sync-design-showcase.mjs           # 重新生成
 *   node web/scripts/sync-design-showcase.mjs --check   # 只校验同步，不写文件
 *
 * 退出码：0 = 同步 / 生成成功；1 = 漂移或生成失败；2 = 输入缺失（BLOCKED）。
 */

import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const BUILD = path.join(REPO_ROOT, 'docs', 'design-system', 'registry', 'build.mjs')
const CHECK_ONLY = process.argv.includes('--check')

const args = [BUILD]
if (CHECK_ONLY) args.push('--check-showcase')

const result = spawnSync(process.execPath, args, {
  cwd: REPO_ROOT,
  stdio: 'inherit',
})

if (result.error) {
  console.error(`[G07] 无法启动 7.0 生成器：${result.error.message}`)
  process.exit(2)
}
process.exit(result.status ?? 2)