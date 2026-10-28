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
import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

type SpinnerProps = Omit<
  React.ComponentProps<typeof LoaderCircle>,
  'strokeWidth'
> & {
  strokeWidth?: number
}

/* 图标统一 Lucide 线性（规范 §2.2）：16px 字形 + **2 单位**线宽 ——
 * Lucide 的 stroke-width 是 24 单位画框单位，渲染到 16px 时画框缩放
 * 16/24，因此 2 × 16 / 24 ≈ 1.33px。规范这一版的描边只有 2 一个值，
 * 早先的 1.5（换算成 1px 视觉线宽）已废止。
 * 换算细节见 `design-system/foundations/icons.css`。 */
function Spinner({ className, strokeWidth = 2, ...props }: SpinnerProps) {
  const { t } = useTranslation()
  return (
    <LoaderCircle
      strokeWidth={strokeWidth}
      role='status'
      aria-label={t('Loading')}
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  )
}

export { Spinner }
