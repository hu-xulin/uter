import type { APIRequestContext } from '@playwright/test'

/**
 * 测试残留清理：任何用例失败/中断后，把该轮创建过的密钥删干净。
 * 密钥是本轮唯一允许创建的资源（不创建账号、不触发真实支付）。
 */
const createdTokenIds: number[] = []

export function trackToken(id: number): void {
  if (!createdTokenIds.includes(id)) createdTokenIds.push(id)
}

export async function cleanupTokens(request: APIRequestContext): Promise<void> {
  // pop 逐个消费：无需副本即可安全边遍历边清空。
  for (let id = createdTokenIds.pop(); id !== undefined; id = createdTokenIds.pop()) {
    try {
      await request.delete(`/api/token/${id}`)
    } catch {
      // 清理失败不掩盖测试结果本身，但也不会让残留无限堆积：下一轮同 id 会被覆盖。
    }
    const idx = createdTokenIds.indexOf(id)
    if (idx >= 0) createdTokenIds.splice(idx, 1)
  }
}
