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
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { BASE_URL } from './target'

/**
 * 三渠道真实栈 E2E 的管理员权限开关。
 *
 * 唯一已授权测试账号 Test123 是普通用户，而渠道 API 需要管理员权限。
 * 本 helper 只在 Phase2 隔离栈的【DB 副本】上临时把该账号提升为 root，
 * 测试结束立刻还原；生产库和 :3000 进程全程只读、绝不触碰。
 *
 * 安全护栏（fail-closed）：
 *  1. 目标必须是隔离栈端口（BUSINESS_BASE_URL 为空或 :3100）；
 *  2. UTER_TEST_STACK / UAP_TEST_STACK 必须为 isolated（由 env.sh 注入）；
 *  3. 隔离 DB 必须位于仓库之外的 TMPDIR，且必须与生产库不是同一文件；
 *  4. 还原在 finally/afterAll 中执行；进程被强杀时由下一次 start 重拷副本兜底。
 */

const ISOLATED_DIR =
  process.env.UTER_PHASE2_DIR || path.join(os.tmpdir(), 'uter-phase2')
const ISOLATED_DB = path.join(ISOLATED_DIR, 'one-api.db')

function assertIsolatedTarget(): void {
  const target = new URL(BASE_URL)
  if (target.port !== '3100' && target.port !== '3101') {
    throw new Error(
      `BLOCKED: 渠道 E2E 只准跑在隔离栈 :3100/:3101，当前目标 ${BASE_URL}`
    )
  }
  if (
    process.env.UTER_TEST_STACK !== 'isolated' &&
    process.env.UAP_TEST_STACK !== 'isolated'
  ) {
    throw new Error(
      'BLOCKED: 未检测到 UTER_TEST_STACK=isolated / UAP_TEST_STACK=isolated；请先 source 隔离栈 env.sh'
    )
  }
}

function sqlite(db: string, sql: string): string {
  return execFileSync('sqlite3', [db, sql], { encoding: 'utf8' }).trim()
}

function resolveProductionDb(): string {
  // web/e2e/business/lib -> web/e2e/business -> web/e2e -> web -> repo
  const here = path.dirname(fileURLToPath(import.meta.url))
  return path.resolve(here, '../../../../one-api.db')
}

function assertSafeCopy(): void {
  if (!fs.existsSync(ISOLATED_DB)) {
    throw new Error(`BLOCKED: 隔离 DB 副本不存在：${ISOLATED_DB}`)
  }
  const productionDb = resolveProductionDb()
  if (fs.realpathSync(ISOLATED_DB) === fs.realpathSync(productionDb)) {
    throw new Error('BLOCKED: 隔离 DB 竟然指向生产库，拒绝提权')
  }
}

let originalRole: number | null = null

/** 仅在隔离副本上把测试账号临时提升为 root；返回原角色供还原。 */
export function elevateTestAccountInIsolatedCopy(userId = 51): number {
  assertIsolatedTarget()
  assertSafeCopy()
  const before = Number(
    sqlite(ISOLATED_DB, `SELECT role FROM users WHERE id=${userId};`)
  )
  if (!Number.isFinite(before)) {
    throw new Error(`无法读取隔离副本账号 ${userId} 的角色`)
  }
  if (before === 100) {
    // 上一次异常退出留下的提权状态：保留原值 100，但测试结束仍应还原为 1。
    originalRole = 1
  } else {
    originalRole = before
    sqlite(ISOLATED_DB, `UPDATE users SET role=100 WHERE id=${userId};`)
  }
  // 隔离 Redis 仅用于本栈；清缓存让新角色立即生效，不碰生产 :6379。
  try {
    execFileSync('redis-cli', ['-p', '6380', 'FLUSHDB'], { stdio: 'ignore' })
  } catch {
    // Redis 不可用时后端仍会读库，不致命。
  }
  return before
}

/** 还原测试账号角色，并核对生产库角色始终未被改动。 */
export function restoreTestAccountInIsolatedCopy(userId = 51): void {
  if (originalRole === null) return
  assertIsolatedTarget()
  assertSafeCopy()
  sqlite(
    ISOLATED_DB,
    `UPDATE users SET role=${originalRole} WHERE id=${userId};`
  )
  try {
    execFileSync('redis-cli', ['-p', '6380', 'FLUSHDB'], { stdio: 'ignore' })
  } catch {
    // ignore
  }
  const copyRole = Number(
    sqlite(ISOLATED_DB, `SELECT role FROM users WHERE id=${userId};`)
  )
  const productionRole = Number(
    sqlite(resolveProductionDb(), `SELECT role FROM users WHERE id=${userId};`)
  )
  if (copyRole !== originalRole || productionRole !== 1) {
    throw new Error(
      `角色还原校验失败：副本=${copyRole}（期望 ${originalRole}）生产=${productionRole}（期望 1）`
    )
  }
  originalRole = null
}
