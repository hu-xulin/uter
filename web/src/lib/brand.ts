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
/*
 * Localized brand name for the public site.
 *
 * The admin-configurable system name (e.g. "Uter.ai 优特智能") is shown verbatim
 * regardless of locale. The product brand, however, should follow the UI
 * language: full bilingual form in Chinese, and the short "Uter.ai" mark in
 * every other language (English, Japanese, Russian, French, Vietnamese, …).
 */
export function localizedBrandName(locale?: string): string {
  const lang = (locale ?? '').toLowerCase()
  if (lang.startsWith('zh')) {
    return lang.includes('tw') || lang.includes('hant')
      ? 'Uter.ai 優特智能'
      : 'Uter.ai 优特智能'
  }
  return 'Uter.ai'
}
