import net from 'node:net'

import type { FullConfig } from '@playwright/test'

import { BASE_URL } from './target'

/**
 * 开跑前的硬门槛：目标服务不可达就直接失败。
 *
 * 为什么不允许退化成「跳过」：门禁结果是要汇报给人看的，假通过比没有门禁更糟。
 * 第一轨零依赖脚本在无浏览器时是 exit 2 报 BLOCKED，这一轨必须保持同样口径——
 * 服务没起就报整轮失败，而不是报一片 skip 让外部误读成全绿。
 */

const PROBE_TIMEOUT_MS = 3000

const BLOCKED_BANNER = [
  '',
  '  ===================== BLOCKED =====================',
  '  视觉回归（Playwright 轨）无法执行：目标服务不可达。',
  `  期望地址：${BASE_URL}`,
  '',
  '  三种可选目标（认准方法：uter 登录页调 /api/user/login）：',
  '    A) 测试专用隔离栈（审计推荐，鉴权页唯一能真实登录的方式）',
  '       ./scripts/phase2-test-stack.sh start',
  '       cd web && source "${TMPDIR:-/tmp}/uter-phase2/env.sh"',
  '       bun run test:visual:e2e        # env.sh 已设好 VISUAL_BASE_URL',
  '       （隔离栈用 /tmp 上的 DB 副本开启密码登录；生产库/配置零改动）',
  '    B) Go 后端（默认，内嵌 web/dist 构建产物）',
  '       cd ~/uter && ./uter-bin        # 进程 CWD 必须是 ~/uter（SESSION_SECRET）',
  '    C) 前端 dev server',
  '       cd web && bun run dev          # 端口以启动输出为准',
  '       VISUAL_BASE_URL=http://localhost:<端口> bun run test:visual:e2e',
  '',
  '  ⚠ 生产栈 :3000 的 PasswordLoginEnabled=false（运营配置，禁止修改）；',
  '    直接对它跑鉴权轨会如实判 BLOCKED，不会伪装成通过。',
  '  ⚠ 本机 :3200 若是 uter-cs 智能客服的 dev server，勿当 uter 目标——',
  '    它的登录页是「智能客服中枢」，端点 /api/auth/login，账号库不同。',
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
    port: Number(url.port) || (url.protocol === 'https:' ? 443 : 80),
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
      `BLOCKED: ${BASE_URL} 不可达，视觉回归未执行（有意失败，不得当作通过）`
    )
  }

  // 注：.auth/readonly.json 由 `auth-setup` project 在每轮 run 内生成，
  // globalSetup 早于所有 test 运行，此时它尚未生成属正常，无需警告。
}

export default globalSetup
