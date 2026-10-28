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
import type { SVGProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * 微信支付（WeChat Pay）品牌标 —— **不是** 微信聊天应用的「双气泡」标。
 *
 * 两者常被混用：后端 `pay_methods` 的默认图标是 `SiWechat`（simple-icons 的
 * 微信聊天 logo），收银台因此把「微信支付」画成聊天软件。用户认的是支付标
 * （绿色气泡里带一道勾），不是 IM 标。
 *
 * 图形取自 Remix Icon `Logos/wechat-pay-fill`（Apache-2.0），与其它品牌标一样
 * 用 `fill-current`，颜色由调用方按 `PAYMENT_ICON_COLORS` 注入。
 *
 * viewBox 收紧到图形实际边界（x 2–22.1 / y 3.4–21.2）：该图形在标准 24×24
 * 画布里只占宽约 83%、高约 74%，与满版方形的支付宝标放进同样尺寸的容器时，
 * 视觉上会明显小一圈。收紧后内容按比例填满容器（宽度撑满、高度约 14/16），
 * 视觉重量与支付宝对齐，且不溢出容器、不影响布局。
 */
export function IconWeChatPay({
  className,
  title = 'WeChat Pay',
  ...props
}: SVGProps<SVGSVGElement> & {
  /** 无障碍名称。调用方有更准确的文案（例如运营配置的显示名）时可覆盖。 */
  title?: string
}) {
  return (
    <svg
      role='img'
      viewBox='2 3.4 20.1 17.8'
      xmlns='http://www.w3.org/2000/svg'
      width='24'
      height='24'
      className={cn('fill-current', className)}
      {...props}
    >
      <title>{title}</title>
      <path d='M9.27099 14.6689C8.9532 14.8312 8.56403 14.7122 8.39132 14.4L8.3477 14.3054L6.53019 10.3069C6.52269 10.2588 6.52269 10.2097 6.53019 10.1615C6.53017 10.0735 6.56564 9.98916 6.62857 9.9276C6.6915 9.86603 6.7766 9.83243 6.86462 9.83438C6.93567 9.83269 7.00508 9.85582 7.06091 9.89981L9.24191 11.4265C9.40329 11.5346 9.59293 11.5928 9.78716 11.5937C9.90424 11.5945 10.0203 11.5723 10.1289 11.5283L20.176 7.02816C18.091 4.72544 15.1103 3.43931 12.0045 3.5022C6.4793 3.5022 2.00098 7.23172 2.00098 11.87C2.06681 14.4052 3.35646 16.7515 5.4615 18.1658C5.6878 18.3326 5.78402 18.6241 5.70141 18.8928L5.25067 20.594C5.22336 20.6714 5.20625 20.7521 5.19978 20.8339C5.19777 20.9232 5.23236 21.0094 5.29552 21.0726C5.35868 21.1358 5.44491 21.1703 5.5342 21.1684C5.60098 21.1645 5.66583 21.1445 5.72322 21.1102L7.90423 19.8452C8.06383 19.7467 8.2474 19.6939 8.43494 19.6925C8.53352 19.6923 8.63157 19.707 8.72574 19.7361C9.78781 20.0363 10.8863 20.188 11.99 20.1869C17.5152 20.1869 22.001 16.4574 22.001 11.8554C22.0108 10.4834 21.6301 9.13687 20.903 7.97326L9.35096 14.6253L9.27099 14.6689Z' />
    </svg>
  )
}
