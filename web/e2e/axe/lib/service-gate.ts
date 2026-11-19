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
import net from 'node:net'

import type { FullConfig } from '@playwright/test'

import { BASE_URL } from './target'

/**
 * axe 可访问性扫描的开跑前硬门槛：目标服务不可达就直接失败。
 *
 * 与 e2e/visual/lib/service-gate.ts 同口径（假通过比没有门禁更糟），但该文件的
 * BLOCKED 文案面向视觉回归，故此处保留一份面向可访问性扫描的薄副本。
 * 若后续两份漂移，应抽公共 probe 模块统一。
 */

const PROBE_TIMEOUT_MS = 3000

const BLOCKED_BANNER = [
  '',
  '  ===================== BLOCKED =====================',
  '  axe 可访问性扫描无法执行：目标服务不可达。',
  `  期望地址：${BASE_URL}`,
  '',
  '  两种可选目标（认准方法：uter 登录页调 /api/user/login）：',
  '    A) Go 后端（默认，内嵌 web/dist 构建产物）',
  '       cd ~/uter && ./uter-bin        # 进程 CWD 必须是 ~/uter（SESSION_SECRET）',
  '    B) 前端 dev server',
  '       cd web && bun run dev          # 端口以启动输出为准',
  '       VISUAL_BASE_URL=http://localhost:<端口> bun run test:axe',
  '',
  '  本轮判定为 BLOCKED，不当作通过。',
  '  ==================================================',
  '',
].join('\n')

interface ProbeTarget {
  host: string
  port: number
}

function parseTarget(rawUrl: string): ProbeTarget {
  const url = new URL(rawUrl)
  return {
    host: url.hostname,
    port: Number(url.port) || (url.protocol === 'https://' ? 443 : 80),
  }
}

function probePort({ host, port }: ProbeTarget): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(PROBE_TIMEOUT_MS)
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    const bail = () => {
      socket.destroy()
      resolve(false)
    }
    socket.once('timeout', bail)
    socket.once('error', bail)
    socket.connect(port, host)
  })
}

async function globalSetup(_config: FullConfig): Promise<void> {
  const reachable = await probePort(parseTarget(BASE_URL))
  if (!reachable) {
    // eslint-disable-next-line no-console
    console.error(BLOCKED_BANNER)
    throw new Error(
      `BLOCKED: ${BASE_URL} 不可达，axe 可访问性扫描未执行（有意失败，不得当作通过）`
    )
  }
}

export default globalSetup
