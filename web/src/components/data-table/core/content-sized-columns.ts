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
export function isContentSizedColumn(columnId: string): boolean {
  return columnId === 'actions'
}

/**
 * 内容自适应列在 `fitContainer`（table-layout: fixed）模式下的固定占位宽度。
 *
 * auto 布局里 `width: 1%` 表示「按内容收缩」，但 fixed 布局会把它当成真正的
 * 1%，把操作列压成一条缝。fixed 布局必须给出确定的宽度，这里用行内图标按钮
 * 的实测宽度（两个 icon-sm + 溢出菜单 ≈ 110px）。
 */
export const CONTENT_SIZED_COLUMN_WIDTH_PX = 110
