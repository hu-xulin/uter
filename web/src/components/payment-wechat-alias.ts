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
 * 「通用微信」图标别名（微信聊天应用 logo 的各家图标库写法）。
 *
 * 后端 `pay_methods` 的默认图标是 `SiWechat`（simple-icons 的微信聊天
 * 双气泡标），运营在后台也常从图标库挑到这些别名。但本应用里微信图标
 * 出现的上下文恒为「微信支付」，渲染成聊天软件会让人以为要点开微信
 * 扫码聊天 —— 因此统一升级为微信支付品牌标。
 *
 * 消费方：`components/payment-icon-by-name.tsx`（收银台与后台编辑器
 * 共用的渲染组件）与 `features/wallet/lib/ui.tsx`（收银台套品牌色分支）。
 */
const GENERIC_WECHAT_ICON_NAMES = new Set([
  'SiWechat',
  'SiWeixin',
  'RiWechatFill',
  'RiWechatLine',
  'FaWechat',
  'FaWeixin',
  'AiFillWechat',
])

export function isGenericWechatIconName(name: string | null | undefined) {
  const trimmed = name?.trim()
  return !!trimmed && GENERIC_WECHAT_ICON_NAMES.has(trimmed)
}
