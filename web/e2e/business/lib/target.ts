/**
 * 业务 E2E（Phase 2）公共常量。
 *
 * 与视觉回归轨（e2e/visual）同一套约定，但目标默认指向 Phase 2 隔离栈
 * （:3100，独立 SQLite 副本 + Redis 6380），绝不对生产栈写入。
 * 用 BUSINESS_BASE_URL 覆盖时自行承担目标合规责任。
 */

/** web/ 目录根（bun run 脚本固定从 web/ 发起）。 */
export const WEB_ROOT = process.cwd()

/**
 * 业务 E2E 目标。默认 Phase 2 隔离后端 :3100（/tmp/uter-phase2 隔离库副本）。
 * ⚠ 该栈与 :3000 生产实例完全隔离：独立 DB 文件、独立 Redis（6380），
 *   E2E 产生的所有数据（密钥等）都落在隔离副本里，测试结束后可整体丢弃。
 */
export const BASE_URL = process.env.BUSINESS_BASE_URL ?? 'http://localhost:3100'
