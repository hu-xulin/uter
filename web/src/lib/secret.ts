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
 * 密钥掩码：保留前 4 个字符与后 4 个字符，中间以星号替代，避免明文泄露。
 *
 * 规则：
 * - 空串：返回空串。
 * - 长度 <= 4：全部星号（避免短密钥被完整暴露）。
 * - 4 < 长度 <= 8：前 4 个字符 + 其余星号（长度不足以同时显示前后各 4 位，优先保留前缀）。
 * - 长度 > 8：前 4 + 中间星号 + 后 4。
 *
 * 关键：本函数只用于「显示」，绝不返回真实密钥原文（除已展示的前后各 4 位）。
 * 表单保存时务必使用真实值，切勿把掩码串写回后端。
 */
export function maskSecret(value: string): string {
  if (!value) return ''
  const len = value.length
  if (len <= 4) return '*'.repeat(len)
  if (len <= 8) return value.slice(0, 4) + '*'.repeat(len - 4)
  const head = value.slice(0, 4)
  const tail = value.slice(-4)
  const middle = '*'.repeat(Math.min(len - 8, 12))
  return head + middle + tail
}
