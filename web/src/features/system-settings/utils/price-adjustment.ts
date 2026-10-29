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
 * 把「定价 = 汇率 ± N」里的 N 格式化成可以嵌进句子的一小段文字。
 *
 * 定价调整量是**有符号**的（当前 +0.2，即汇率加 0.2）。后台两处说明文案
 * （「货币与展示」的汇率字段、「支付网关」的定价字段）都要引用它，直接写死
 * 「+ 0.20」会在符号反转后继续显示加价，所以统一由这里按符号生成：
 *
 *   -0.2 → "− 0.20"（用 U+2212 减号，与数字里的连字符区分，排版更稳）
 *    0.2 → "+ 0.20"
 *      0 → "unchanged"
 */
export function formatPriceAdjustment(rate: number): string {
  if (!Number.isFinite(rate) || rate === 0) return 'unchanged'
  const amount = Math.abs(rate).toFixed(2)
  return rate > 0 ? `+ ${amount}` : `\u2212 ${amount}`
}
