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
export type SemanticColor =
  | 'blue'
  | 'green'
  | 'cyan'
  | 'purple'
  | 'pink'
  | 'red'
  | 'orange'
  | 'amber'
  | 'yellow'
  | 'lime'
  | 'light-green'
  | 'teal'
  | 'light-blue'
  | 'indigo'
  | 'violet'
  | 'grey'
  | 'slate'

/**
 * 分类色 → 背景类。用于用户**自己选颜色**的展示型标记（API 信息卡片里的
 * 彩色圆点等）。
 *
 * 规范 colors.md「图表色」一节：`chart-1…5` 就是为「区分彼此、不带成败
 * 含义的分类」准备的语义 Token。这里把 17 个语义色名收敛到 5 个 Token 上：
 * 同一个色名恒映射到同一个 Token（不会串色），深浅主题由 Token 各自给出，
 * 组件里不再需要写 `dark:` 分支。
 *
 * 为什么不留着 `bg-blue-500` 这类写法：那是直接引用调色板，换主题不跟随、
 * 深色模式对比度无人保证，而且规范禁止组件里出现调色板类名。名字保留
 * （`blue` / `teal` …）是为了兼容已经存进数据库的配置值 —— 那些是**数据**，
 * 不是样式，不能因为换 Token 就全部失效。
 */
export const colorToBgClass: Record<SemanticColor, string> = {
  blue: 'bg-chart-1',
  green: 'bg-chart-5',
  cyan: 'bg-chart-2',
  purple: 'bg-chart-3',
  pink: 'bg-chart-4',
  red: 'bg-chart-4',
  orange: 'bg-chart-3',
  amber: 'bg-chart-3',
  yellow: 'bg-chart-3',
  lime: 'bg-chart-5',
  'light-green': 'bg-chart-5',
  teal: 'bg-chart-2',
  'light-blue': 'bg-chart-1',
  indigo: 'bg-chart-1',
  violet: 'bg-chart-3',
  grey: 'bg-neutral',
  slate: 'bg-neutral',
}

export const avatarColorMap: Record<SemanticColor, string> = {
  blue: 'bg-chart-1/10 text-chart-1',
  green: 'bg-success-soft text-success',
  cyan: 'bg-chart-2/10 text-chart-2',
  purple: 'bg-chart-4/10 text-chart-4',
  pink: 'bg-chart-5/10 text-chart-5',
  red: 'bg-destructive-subtle text-destructive',
  orange: 'bg-warning-soft text-warning',
  amber: 'bg-warning-soft text-warning',
  yellow: 'bg-warning-soft text-warning',
  lime: 'bg-chart-3/10 text-chart-3',
  'light-green': 'bg-success-soft text-success',
  teal: 'bg-chart-2/10 text-chart-2',
  'light-blue': 'bg-info-soft text-info',
  indigo: 'bg-chart-1/10 text-chart-1',
  violet: 'bg-chart-4/10 text-chart-4',
  grey: 'bg-muted text-muted-foreground',
  slate: 'bg-muted text-muted-foreground',
}

export function getAvatarColorClass(name: string): string {
  return avatarColorMap[stringToColor(name)]
}

export function getBgColorClass(color?: string): string {
  if (!color) return colorToBgClass.blue
  return (
    (colorToBgClass as Record<string, string>)[color] || colorToBgClass.blue
  )
}

/**
 * Announcement status types
 */
export type AnnouncementType =
  | 'default'
  | 'ongoing'
  | 'success'
  | 'warning'
  | 'error'

/**
 * Announcement status color mapping
 */
export const ANNOUNCEMENT_TYPE_COLORS: Record<AnnouncementType, string> = {
  default: 'bg-neutral',
  ongoing: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-destructive',
}

/**
 * Get announcement status color class
 */
export function getAnnouncementColorClass(type?: string): string {
  const validType = (type || 'default') as AnnouncementType
  return ANNOUNCEMENT_TYPE_COLORS[validType] || ANNOUNCEMENT_TYPE_COLORS.default
}

/**
 * Semantic colors for tags and badges
 */
const TAG_COLORS = [
  'amber',
  'blue',
  'cyan',
  'green',
  'grey',
  'indigo',
  'light-blue',
  'lime',
  'orange',
  'pink',
  'purple',
  'red',
  'teal',
  'violet',
  'yellow',
] as const

/**
 * Convert string to a stable semantic color
 * Used for model tags, group badges, user avatars, etc.
 * Same string always returns the same color
 *
 * @param str - Input string (model name, group name, username, etc.)
 * @returns Semantic color name from TAG_COLORS
 *
 * @example
 * stringToColor('gpt-4') // 'blue'
 * stringToColor('claude-3') // 'purple'
 * stringToColor('default') // 'green'
 */
export function stringToColor(str: string): SemanticColor {
  let sum = 0
  for (let i = 0; i < str.length; i++) {
    sum += str.charCodeAt(i)
  }
  const index = sum % TAG_COLORS.length
  return TAG_COLORS[index]
}
