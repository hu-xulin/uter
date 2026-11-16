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
 * UDS 8.0.0 真实回滚演练（探针 C-M01）。
 *
 * COMPAT-MAP.json 承诺：删除 web/src/styles/index.css 中 uds-semantic-bridge.css
 * 一行 import 即完整回滚。本脚本真实执行该演练：
 *   1. 记录 index.css 与 bridge 的 SHA256；
 *   2. 删除该行 import；
 *   3. 结构验证：index.css 不再引用 bridge（回滚态成立）；
 *   4. 恢复该行 import；
 *   5. 恢复验证：文件 SHA256 与演练前一致，且引用重新存在。
 * 结果写 audit/rollback-drill.json；任何一步失败都如实写 FAIL 并以非零退出。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const REPO = process.cwd()
const INDEX_CSS = join(REPO, 'web', 'src', 'styles', 'index.css')
const BRIDGE = join(REPO, 'web', 'src', 'design-system', 'tokens', 'uds-semantic-bridge.css')
const OUT = join(REPO, 'docs', 'design-system', 'design-system', 'audit', 'rollback-drill.json')
const IMPORT_LINE = "@import '../design-system/tokens/uds-semantic-bridge.css';"

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const steps = []
let ok = true
const step = (name, pass, detail) => {
  steps.push({ name, pass, detail })
  if (!pass) ok = false
  console.log(`[UDS8-ROLLBACK-DRILL] ${pass ? 'PASS' : 'FAIL'} ${name} — ${detail}`)
}

const shaBefore = sha(INDEX_CSS)
const bridgeShaBefore = sha(BRIDGE)
const original = readFileSync(INDEX_CSS, 'utf8')
step('记录演练前 SHA256', Boolean(shaBefore && bridgeShaBefore), `index.css=${shaBefore.slice(0, 12)}… bridge=${bridgeShaBefore.slice(0, 12)}…`)

// 1. 回滚：删除唯一接线行
if (!original.includes(IMPORT_LINE)) {
  step('定位 import 行', false, 'index.css 中未找到 bridge import，无法演练')
} else {
  step('定位 import 行', true, IMPORT_LINE)
  const rolledBack = original.split('\n').filter((l) => l.trim() !== IMPORT_LINE).join('\n')
  writeFileSync(INDEX_CSS, rolledBack)
  const afterRemove = readFileSync(INDEX_CSS, 'utf8')
  step('删除 import（回滚态）', !afterRemove.includes('uds-semantic-bridge.css'), 'index.css 已不再引用 bridge → 7.0 语义层完全下线')

  // 2. 恢复
  writeFileSync(INDEX_CSS, original)
  const shaAfter = sha(INDEX_CSS)
  step('恢复 import（字节级一致）', shaAfter === shaBefore, `恢复后 SHA256=${shaAfter.slice(0, 12)}… ${shaAfter === shaBefore ? 'MATCH' : 'MISMATCH'}`)
  step('bridge 未被触碰', sha(BRIDGE) === bridgeShaBefore, 'bridge 文件全程只读')
}

const payload = {
  schema: 'UDS8-ROLLBACK-DRILL/1.0',
  executed_at: new Date().toISOString(),
  method: '删除 web/src/styles/index.css 中唯一 import 行 → 结构验证 → 字节级恢复',
  pass: ok,
  steps,
  rollbackProcedure: COMPAT_NOTE(),
}
writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n')
process.exit(ok ? 0 : 1)

function COMPAT_NOTE() {
  return "COMPAT-MAP.json policy=ISOLATE_THEN_MIGRATE · rollback='删除 web/src/styles/index.css 中 uds-semantic-bridge.css 一行 import 即完整回滚'"
}
