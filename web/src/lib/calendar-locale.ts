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
import { enUS, fr, ja, ru, vi, zhCN, zhTW } from 'react-day-picker/locale'

/**
 * SPA 语言 → react-day-picker locale。
 *
 * 单点声明：`datetime-picker` 与日志筛选的日期区间选择器都用它，避免两处各写
 * 一份映射后其中一处漏掉某个语言（漏掉会静默回退英文，日历上出现
 * `October 2026` 与中文界面混排）。
 */
const CALENDAR_LOCALES = {
  en: enUS,
  zhCN,
  zhTW,
  fr,
  ru,
  ja,
  vi,
} as const

export function getCalendarLocale(language: string) {
  return CALENDAR_LOCALES[language as keyof typeof CALENDAR_LOCALES] ?? enUS
}
