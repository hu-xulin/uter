import net from 'node:net'

import type { FullConfig } from '@playwright/test'

import { BASE_URL } from './target'

/**
 * 业务 E2E 的硬门槛（与视觉轨 service-gate 同口径）：
 * 目标服务不可达就直接失败 —— 不允许把「服务没起」报成 skip/passed。
 * 假通过比没有门禁更糟（fail-closed）。
 */

const PROBE_TIMEOUT_MS = 3000

function parseTarget(rawUrl: string): { host: string; port: number } {
  const url = new URL(rawUrl)
  return {
    host: url.hostname,
    port: Number(url.port) || (url.protocol === 'https:' ? 443 : 80),
  }
}

function probePort({ host, port }: { host: string; port: number }): Promise<boolean> {
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
    console.error(
      [
        '',
        '  ===================== BLOCKED =====================',
        '  业务 E2E 无法执行：目标服务不可达。',
        `  期望地址：${BASE_URL}`,
        '',
        '  Phase 2 隔离栈启动方式（默认目标）：',
        '    /usr/local/bin/redis-server --port 6380 --save "" --appendonly no \\',
        '      --dir /tmp/uter-phase2 &',
        '    cp one-api.db one-api.db-shm one-api.db-wal /tmp/uter-phase2/',
        '    PORT=3100 \\',
        '      SQLITE_PATH=/tmp/uter-phase2/one-api.db \\',
        '      REDIS_CONN_STRING=redis://127.0.0.1:6380/0 \\',
        '      /tmp/uter-phase2/uter-e2e-bin &',
        '',
        '  本轮判定为 BLOCKED，不当作通过。',
        '  ==================================================',
        '',
      ].join('\n')
    )
    throw new Error(`BLOCKED: ${BASE_URL} 不可达，业务 E2E 未执行（有意失败，不得当作通过）`)
  }
}

export default globalSetup
