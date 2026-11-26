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
'use client'

import type { ReactNode } from 'react'

import { withCjkTermBreaks } from '@/lib/cjk-term-breaks'

/**
 * 表格首列中文术语组件：在词边界插入 `<wbr>`，让换行只发生在词与词之间。
 *
 * 实际变换逻辑在 `lib/cjk-term-breaks.tsx`（纯函数模块，避免违反 React Fast Refresh
 * 的「组件文件只导出组件」约束）。此组件是它的 JSX 便捷封装。
 */
export function CjkTermText({ children }: { children: ReactNode }) {
  return <>{withCjkTermBreaks(children)}</>
}
