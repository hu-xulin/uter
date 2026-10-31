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
import { IconWeChatPay } from '@/assets/brand-icons'

import { isGenericWechatIconName } from './payment-wechat-alias'
import { ReactIconByName } from './react-icon-by-name'

type PaymentIconByNameProps = {
  name?: string | null
  className?: string
  title?: string
}

/**
 * 按图标名渲染支付图标：通用微信别名升级为微信支付品牌标，其余图标名
 * 交给 `ReactIconByName` 按需解析（未知名称渲染为空）。
 *
 * 收银台（`features/wallet/lib/ui.tsx`）与后台支付方式编辑器共用，
 * 保证运营配置 `SiWechat` 时两处看到同一个支付标。
 */
export function PaymentIconByName({
  name,
  className,
  title,
}: PaymentIconByNameProps) {
  if (isGenericWechatIconName(name)) {
    return <IconWeChatPay className={className} title={title} />
  }
  // ReactIconByNameProps 的 name 经 SVGAttributes 交叉收窄为 string，
  // 显式归一化 null（与组件内部「空名不渲染」语义一致）。
  return (
    <ReactIconByName
      name={name ?? undefined}
      className={className}
      title={title}
    />
  )
}
